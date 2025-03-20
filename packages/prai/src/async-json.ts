import { isAsyncIterable } from './utils.js'

/**
 * supports sending json mixed with async interables and promises through async interables
 */
export async function* encodeAsyncJson(json: unknown): AsyncIterable<string> {
  const iterables: Array<AsyncIterable<unknown>> = []
  const uuids: Array<string> = []
  yield JSON.stringify(json, (_, value) => {
    if (isAsyncIterable(value)) {
      iterables.push(value)
      const uuid = `async-iterator-${crypto.randomUUID()}`
      uuids.push(uuid)
      return uuid
    }
    return value
  }) + '\n'

  const promises = iterables.map(nextAsyncIterable)
  try {
    while (iterables.length > 0) {
      const { iterable, result } = await Promise.race(promises)
      const index = iterables.indexOf(iterable)
      const uuid = uuids[index]
      if (result.done) {
        promises.splice(index, 1)
        uuids.splice(index, 1)
        iterables.splice(index, 1)
        yield `${uuid}\n`
      } else {
        promises[index] = nextAsyncIterable(iterables[index])
        yield `${uuid} ${JSON.stringify(result.value)}\n`
      }
    }
  } finally {
    for (const iterator of iterables) {
      iterator[Symbol.asyncIterator]().return?.()
    }
  }
}

const uuidRegex = /^async-iterator-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUUID(value: unknown): boolean {
  return typeof value === 'string' && uuidRegex.test(value)
}

async function nextAsyncIterable(iterable: AsyncIterable<unknown>) {
  return { iterable, result: await iterable[Symbol.asyncIterator]().next() }
}

export async function decodeAsyncJson<T>(_input: AsyncIterable<string>, abortSignal: AbortSignal): Promise<T> {
  const lines = decodeLines(_input, abortSignal)
  const nextResult = await lines[Symbol.asyncIterator]().next()
  if (abortSignal.aborted) {
    throw new Error(`decodeJsonWithIterators was aborted`)
  }
  const map = new Map<string, ReturnType<typeof createWriteIterable<T>>['write']>()
  if (nextResult.done) {
    throw new Error(`missing required initial value in the stream provided to decodeJsonWithIterators`)
  }
  let result: T = JSON.parse(nextResult.value, (_, value) => {
    if (!isUUID(value)) {
      return value
    }
    const { queue, setResolve, write } = createWriteIterable<T>()
    map.set(value, write)
    return createIterable(queue, setResolve, abortSignal)
  })
  processLines(lines, map).catch(console.error)
  return result!
}

async function* decodeLines(input: AsyncIterable<string>, abortSignal: AbortSignal): AsyncIterable<string> {
  let buffer = ''

  for await (const chunk of input) {
    if (abortSignal.aborted) {
      return
    }
    buffer += chunk
    if (!buffer.includes('\n')) {
      continue
    }
    let lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      yield line
    }
  }

  // Process any remaining data in the buffer
  if (buffer !== '') {
    yield buffer
  }
}

const lineRegex = /^(async-iterator-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})( (.*))?$/

async function processLines<T>(
  lines: AsyncIterable<string>,
  writeMap: Map<string, ReturnType<typeof createWriteIterable<T>>['write']>,
) {
  for await (const line of lines) {
    const result = lineRegex.exec(line)
    if (result == null) {
      throw new Error(`unexpected format for line "${line}"`)
    }
    const [, uuid, json] = result
    const write = writeMap.get(uuid)
    if (write == null) {
      throw new Error(`unknown async iterable "${uuid}"`)
    }
    write(json == null ? StopSymbol : JSON.parse(json))
  }
}

export function createAsyncState<T>(currentValue: T): AsyncIterable<unknown> & {
  get(): typeof StopSymbol | T
  set(value: T): void
  finish(): void
} {
  const { queue, setResolve, write } = createWriteIterable<T>()
  queue.push(currentValue)
  return Object.assign(createIterable<T>(queue, setResolve), {
    finish() {
      write(StopSymbol)
    },
    get() {
      return currentValue
    },
    set(value: T) {
      currentValue = value
      write(value)
    },
  })
}

export async function subscribeAsyncState<T>(
  input: AsyncIterable<T>,
  fn: (value: T) => void,
  abortSignal: AbortSignal,
): Promise<void> {
  for await (const entry of input) {
    if (abortSignal.aborted) {
      return
    }
    fn(entry)
  }
}

const StopSymbol = Symbol('stop')

function createWriteIterable<T>(): {
  queue: Array<T | typeof StopSymbol>
  setResolve: (resolve: (value: T | typeof StopSymbol) => void) => void
  write: (value: T | typeof StopSymbol) => void
} {
  const queue: Array<T | typeof StopSymbol> = []
  let resolve: ((value: T | typeof StopSymbol) => void) | undefined
  return {
    write(value) {
      if (resolve != null) {
        resolve(value)
        resolve = undefined
        return
      }
      queue.push(value)
    },
    setResolve(newResolve) {
      resolve = newResolve
    },
    queue,
  }
}

async function* createIterable<T>(
  queue: Array<T | typeof StopSymbol>,
  setResolve: (resolve: (value: T | typeof StopSymbol) => void) => void,
  abortSignal?: AbortSignal,
): AsyncIterable<T> {
  let currentResolve: ((value: typeof StopSymbol) => void) | undefined
  abortSignal?.addEventListener('abort', () => currentResolve?.(StopSymbol))
  while (!abortSignal?.aborted) {
    const result = await new Promise<T | typeof StopSymbol>((resolve) => {
      if (queue.length > 0) {
        resolve(queue.shift()!)
        return
      }
      currentResolve = resolve
      setResolve(resolve)
    })
    if (result === StopSymbol) {
      return
    }
    yield result
  }
}
