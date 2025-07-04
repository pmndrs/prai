import OpenAI from 'openai'
import { Message } from '../step.js'
import { Price } from '../model.js'
import {
  ChatCompletionCreateParamsBase,
  ChatCompletionCreateParamsNonStreaming,
} from 'openai/resources/chat/completions.mjs'

export async function* streamingQueryOpenai(
  modelName: string,
  modelPrice: Price | undefined,
  modelOptions: Omit<ChatCompletionCreateParamsBase, 'model' | 'messages' | 'stream_options' | 'stream'>,
  client: OpenAI,
  messages: Array<Message>,
  abortSignal: AbortSignal | undefined,
  additionalParams?: {},
): AsyncIterable<{ content: string; cost?: number }> {
  const result = await client.chat.completions.create(
    {
      messages,
      model: modelName,
      stream: true,
      stream_options: { include_usage: true },
      ...additionalParams,
      ...modelOptions,
    },
    {
      signal: abortSignal,
    },
  )
  for await (const chunk of result) {
    yield {
      content: chunk.choices[0].delta.content ?? '',
      cost: chunk.usage == null ? undefined : modelPrice?.(chunk.usage.prompt_tokens, 0, chunk.usage.completion_tokens),
    }
  }
}

export async function queryOpenai(
  modelName: string,
  modelPrice: Price | undefined,
  modelOptions: Omit<ChatCompletionCreateParamsBase, 'model' | 'messages' | 'stream_options' | 'stream'>,
  client: OpenAI,
  messages: Array<Message>,
  abortSignal: AbortSignal | undefined,
  options?: {},
): Promise<{ content: string; cost?: number }> {
  const result = await client.chat.completions.create(
    {
      messages,
      model: modelName,
      ...options,
      ...modelOptions,
    },
    {
      signal: abortSignal,
    },
  )
  return {
    content: result.choices[0].message.content ?? '',
    cost:
      result.usage == null ? undefined : modelPrice?.(result.usage.prompt_tokens, 0, result.usage.completion_tokens),
  }
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

function processJsonChunk(chunk: string, state: StreamState): string {
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

  return processedChunk
}

export async function* extractResultProperty(input: AsyncIterable<{ content: string; cost?: number }>) {
  let contentBuffer = ''
  let costBuffer: number | undefined

  // Initialize state for JSON processing
  const state: StreamState = {
    bracketCount: 0,
    quotationOpen: false,
    escapeNext: false,
    finished: false,
  }

  let started = false

  // Phase 1: Wait for {"result": pattern (with possible whitespace)
  for await (let { content, cost } of input) {
    if (!started) {
      contentBuffer += content
      if (cost != null) {
        costBuffer ??= 0
        costBuffer += cost ?? 0
      }

      // Look for {"result": allowing for whitespace between tokens
      const pattern = /\{\s*"result"\s*:\s*/
      const match = contentBuffer.match(pattern)

      if (!match) {
        continue
      }
      started = true
      content = contentBuffer.substring(match.index! + match[0].length)
      cost = costBuffer
    }
    yield { content: processJsonChunk(content, state), cost }
    if (state.finished) {
      return
    }
  }
}
