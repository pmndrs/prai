export function joinStrings(strings: Array<any>, type: 'and' | 'or'): string {
  if (strings.length === 0) {
    throw new Error(`joinStrings requires the list of strings to be joined to have a length of at least 1`)
  }
  if (strings.length === 1) {
    return `${strings[0]}`
  }
  return `${strings.slice(0, -1).join(', ')}, ${type} ${strings.at(-1)}`
}

export function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown, unknown> {
  return (
    obj != null &&
    typeof obj === 'object' &&
    Symbol.asyncIterator in obj &&
    typeof obj[Symbol.asyncIterator] === 'function'
  )
}

export const booleanGrammar = `"true" | "false"`
export const numberGrammar = `"-"? ("0" [0-9]* | "." [0-9]* | [1-9] [0-9]* ("." [0-9]*)?)`
export const stringGrammar = `[^\\n\\"]+`

interface StreamState {
  bracketCount: number
  quotationOpen: boolean
  escapeNext: boolean
  finished: boolean
}

function* processJsonChunk(chunk: string, state: StreamState): Generator<string, void, unknown> {
  let processedChunk = ''

  for (let i = 0; i < chunk.length; i++) {
    const char = chunk[i]

    if (state.escapeNext) {
      state.escapeNext = false
      processedChunk += char
      continue
    }

    if (char === '\\' && state.quotationOpen) {
      state.escapeNext = true
      processedChunk += char
      continue
    }

    if (char === '"') {
      state.quotationOpen = !state.quotationOpen
      processedChunk += char
      continue
    }

    if (state.quotationOpen) {
      processedChunk += char
      continue
    }

    if (state.bracketCount === 0 && (char === ',' || char === '}')) {
      state.finished = true
      break
    }

    if (char === '{' || char === '[') {
      state.bracketCount++
    } else if (char === '}' || char === ']') {
      state.bracketCount--
    }

    processedChunk += char
  }

  // Yield the processed chunk
  if (processedChunk.length > 0) {
    yield processedChunk
  }
}

export async function* filterResultObject(input: AsyncIterable<string>) {
  let buffer = ''

  // Initialize state for JSON processing
  const state: StreamState = {
    bracketCount: 0,
    quotationOpen: false,
    escapeNext: false,
    finished: false,
  }

  let started = false

  // Phase 1: Wait for {"result": pattern (with possible whitespace)
  for await (let chunk of input) {
    if (!started) {
      buffer += chunk

      // Look for {"result": allowing for whitespace between tokens
      const pattern = /\{\s*"result"\s*:\s*/
      const match = buffer.match(pattern)

      if (!match) {
        continue
      }
      started = true
      chunk = buffer.substring(match.index! + match[0].length)
    }
    yield* processJsonChunk(chunk, state)
    if (state.finished) {
      return
    }
  }
}
