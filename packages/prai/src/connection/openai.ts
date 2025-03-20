import { ClientOptions, OpenAI } from 'openai'
import { buildEventEmitter, EventEmitter, PraiEventMap, watchQuery } from './event.js'

export type Connection = {
  query(
    rootTaskName: string,
    taskName: string,
    queryName: string,
    messages: Array<Message>,
    stream: true,
    mock: (seed: string) => string,
    grammar?: string,
    abortSignal?: AbortSignal,
  ): AsyncIterable<string>
  query(
    rootTaskName: string,
    taskName: string,
    queryName: string,
    messages: Array<Message>,
    stream: false,
    mock: (seed: string) => string,
    grammar?: string,
    abortSignal?: AbortSignal,
  ): Promise<string>
  query(
    rootTaskName: string,
    taskName: string,
    queryName: string,
    messages: Array<Message>,
    stream: boolean,
    mock: (seed: string) => string,
    grammar?: string,
    abortSignal?: AbortSignal,
  ): Promise<string> | AsyncIterable<string>
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

export function openai(
  grammarKey: string,
  options: ClientOptions & {
    model: string
    systemPrompt?: string
    abortSignal?: AbortSignal
  },
) {
  const client = new OpenAI(options)
  const { addEventListener, dispatchEvent } = buildEventEmitter()
  return {
    dispatchEvent,
    addEventListener,
    systemPrompt: options.systemPrompt,
    query(rootTaskName, taskUuid, queryUuid, messages, stream, _mock, grammar, abortSignal) {
      const combinedAbortSignal = AbortSignal.any([abortSignal, options.abortSignal].filter((signal) => signal != null))
      return watchQuery(
        rootTaskName,
        taskUuid,
        queryUuid,
        messages,
        stream
          ? streamingQuery(grammarKey, options.model, client, messages, grammar, combinedAbortSignal)
          : nonStreamingQuery(grammarKey, options.model, client, messages, grammar, combinedAbortSignal),
        dispatchEvent,
      )
    },
  } as Connection
}

async function* streamingQuery(
  grammarKey: string,
  model: string,
  client: OpenAI,
  messages: Array<Message>,
  grammar: string | undefined,
  abortSignal: AbortSignal | undefined,
): AsyncIterable<string> {
  let collectedResult = ''
  const result = await client.chat.completions.create(
    {
      messages,
      model,
      stream: true,
      //@ts-ignore
      [grammarKey]: grammar,
    },
    {
      signal: abortSignal,
    },
  )
  for await (const chunk of result) {
    collectedResult += chunk
    yield chunk.choices[0].delta.content ?? ''
  }
}

async function nonStreamingQuery(
  grammarKey: string,
  model: string,
  client: OpenAI,
  messages: Array<Message>,
  grammar: string | undefined,
  abortSignal: AbortSignal | undefined,
): Promise<string> {
  const result = await client.chat.completions.create(
    {
      messages,
      model,
      //@ts-ignore
      [grammarKey]: grammar,
    },
    {
      signal: abortSignal,
    },
  )
  return result.choices[0].message.content ?? ''
}
