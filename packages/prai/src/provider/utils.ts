import OpenAI from 'openai'
import { Message } from '../step.js'

export async function* streamingQueryOpenai(
  model: string,
  client: OpenAI,
  messages: Array<Message>,
  abortSignal: AbortSignal | undefined,
  additionalParams?: {},
): AsyncIterable<string> {
  const result = await client.chat.completions.create(
    {
      messages,
      model,
      stream: true,
      ...additionalParams,
    },
    {
      signal: abortSignal,
    },
  )
  for await (const chunk of result) {
    yield chunk.choices[0].delta.content ?? ''
  }
}

export async function queryOpenai(
  model: string,
  client: OpenAI,
  messages: Array<Message>,
  abortSignal: AbortSignal | undefined,
  options?: {},
): Promise<string> {
  const result = await client.chat.completions.create(
    {
      messages,
      model,
      ...options,
    },
    {
      signal: abortSignal,
    },
  )
  return result.choices[0].message.content ?? ''
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

export async function* extractResultProperty(input: AsyncIterable<string>) {
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
