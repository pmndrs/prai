import { ClientOptions, OpenAI } from 'openai'
import { buildEventEmitter, EventEmitter, watchQuery } from './event.js'
import { Schema } from 'zod'

export type ConnectionQueryParams = {
  rootTaskName: string
  taskName: string
  queryName: string
  messages: Array<Message>
  stream: true
  mock: (seed: string) => string
  grammar?: string
  abortSignal?: AbortSignal
}

export type QueryInput<Stream> = [
  rootTaskName: string,
  taskName: string,
  queryName: string,
  messages: Array<Message>,
  stream: Stream,
  mock: (seed: string) => string,
  schema?: Schema,
  abortSignal?: AbortSignal,
]

export type Connection = {
  query(...input: QueryInput<true>): AsyncIterable<string>
  query(...input: QueryInput<false>): Promise<string>
  query(...input: QueryInput<boolean>): Promise<string> | AsyncIterable<string>
  get systemPrompt(): string | undefined
} & EventEmitter

export type Message =
  | {
      role: 'user'
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
        | {
            type: 'input_audio'
            input_audio: { data: string; format: 'wav' | 'mp3' }
          }
      >
    }
  | {
      role: 'system' | 'assistant'
      content: Array<{ type: 'text'; text: string }>
    }

export function base(
  streamingQuery: (
    model: string,
    client: OpenAI,
    messages: Array<Message>,
    schema: Schema | undefined,
    abortSignal: AbortSignal | undefined,
  ) => AsyncIterable<string>,
  query: (
    model: string,
    client: OpenAI,
    messages: Array<Message>,
    schema: Schema | undefined,
    abortSignal: AbortSignal | undefined,
  ) => Promise<string>,
  clientOptions: ClientOptions | undefined,
  options: ClientOptions & {
    model: string
    systemPrompt?: string
    abortSignal?: AbortSignal
  },
) {
  const client = new OpenAI({ ...clientOptions, ...options })
  const { addEventListener, dispatchEvent } = buildEventEmitter()
  return {
    dispatchEvent,
    addEventListener,
    systemPrompt: options.systemPrompt,
    query(rootTaskName, taskUuid, queryUuid, messages, stream, _mock, schema, abortSignal) {
      const combinedAbortSignal = AbortSignal.any([abortSignal, options.abortSignal].filter((signal) => signal != null))
      return watchQuery(
        rootTaskName,
        taskUuid,
        queryUuid,
        messages,
        stream
          ? streamingQuery(options.model, client, messages, schema, combinedAbortSignal)
          : query(options.model, client, messages, schema, combinedAbortSignal),
        dispatchEvent,
      )
    },
  } as Connection
}
