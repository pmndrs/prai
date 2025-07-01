import { createIterable, createWriteable, StopSymbol } from './internal.js'

export function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown, unknown> {
  return (
    obj != null &&
    typeof obj === 'object' &&
    Symbol.asyncIterator in obj &&
    typeof obj[Symbol.asyncIterator] === 'function'
  )
}

export async function* stringify(value: any): AsyncIterable<string> {
  const waitingFor: Array<AsyncIterable<unknown> | Promise<unknown>> = []
  const uuids: Array<string> = []
  let promiseCounter = 0
  let asyncIteratorCounter = 0
  yield JSON.stringify(value, (_, value) => {
    if (isAsyncIterable(value) || value instanceof Promise) {
      waitingFor.push(value)
      const uuid = value instanceof Promise ? `$p-${++promiseCounter}` : `$ai-${++asyncIteratorCounter}`
      uuids.push(uuid)
      return uuid
    }
    return value
  }) + '\n'

  const promises = waitingFor.map(toResultPromise)
  while (promises.length > 0) {
    const { src, result } = await Promise.race(promises)
    const index = waitingFor.indexOf(src)
    const uuid = uuids[index]
    if (result.done || src instanceof Promise) {
      promises.splice(index, 1)
      uuids.splice(index, 1)
      waitingFor.splice(index, 1)
    } else {
      promises[index] = toResultPromise(waitingFor[index])
    }
    if (result.done) {
      yield `${uuid}\n`
    } else {
      yield `${uuid} ${JSON.stringify(result.value)}\n`
    }
  }
}

async function toResultPromise(waitFor: AsyncIterable<unknown> | Promise<unknown>) {
  return {
    src: waitFor,
    result: waitFor instanceof Promise ? { value: await waitFor } : await waitFor[Symbol.asyncIterator]().next(),
  }
}

export async function parse(text: AsyncIterable<string>): Promise<any> {
  const lines = decodeLines(text)
  const nextResult = await lines[Symbol.asyncIterator]().next()
  const map = new Map<string, (value: unknown) => void>()
  if (nextResult.done) {
    throw new Error(`missing required initial value in the stream provided to decodeJsonWithIterators`)
  }
  let result: any = JSON.parse(nextResult.value, (_, value) => {
    if (typeof value != 'string') {
      return value
    }
    if (value.startsWith('$p-')) {
      return new Promise((resolve) => map.set(value, resolve))
    }
    if (value.startsWith('$ai-')) {
      const { queue, setResolve, write } = createWriteable()
      map.set(value, write)
      return createIterable(queue, setResolve)
    }
    return value
  })
  processLines(lines, map).catch(console.error)
  return result
}

export const Aw8JSON = { stringify, parse }

async function* decodeLines(input: AsyncIterable<string>): AsyncIterable<string> {
  let buffer = ''

  for await (const chunk of input) {
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

async function processLines<T>(
  lines: AsyncIterable<string>,
  writeMap: Map<string, ReturnType<typeof createWriteable<T>>['write']>,
) {
  for await (const line of lines) {
    const seperatorIndex = line.indexOf(' ')
    const uuid = seperatorIndex === -1 ? line : line.slice(0, seperatorIndex)
    const json = seperatorIndex === -1 ? null : line.slice(seperatorIndex + 1)
    const write = writeMap.get(uuid)
    if (write == null) {
      throw new Error(`unknown promise or async iterable "${uuid}"`)
    }
    write(json == null ? StopSymbol : JSON.parse(json))
  }
}
