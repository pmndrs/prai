import { Schema } from 'zod'
import { Model, Provider } from './model.js'
import { buildStepRequestMessage, History } from './history.js'

import { mock } from './provider/mock.js'
import { isAsyncIterable } from 'aw8json'

export type MessageContent = Array<
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | {
      type: 'input_audio'
      input_audio: { data: string; format: 'wav' | 'mp3' }
    }
>

export type Message =
  | {
      role: 'user'
      content: MessageContent
    }
  | {
      role: 'system' | 'assistant'
      content: Array<{ type: 'text'; text: string }>
    }

type StepOptions = {
  history?: History
  model?: Model<unknown>
  examples?: Array<{
    input: string
    output: string
    reason?: string
  }>
  abortSignal?: AbortSignal
  systemPrompt?: string
}

export type NonStreamingStepOptions = {
  stream?: false
} & StepOptions
export type StreamingStepOptions<S extends StreamTransform> = {
  stream: S
} & StepOptions

export type StreamTransform = true | ((input: AsyncIterable<string>) => AsyncIterable<unknown>)
export type GetStreamOutput<T> = T extends (input: AsyncIterable<string>) => AsyncIterable<infer K> ? K : string
export type StepResponseStream<T, S> = AsyncIterable<GetStreamOutput<S>> & { getValue(): Promise<T> }

let defaultProvider: Provider
function getDefaultProvider() {
  return (defaultProvider ??= mock())
}

export function step<T, S extends StreamTransform>(
  prompt: string,
  schema: Schema<T>,
  options: StreamingStepOptions<S>,
): StepResponseStream<T, S>
export function step<T>(prompt: string, schema: Schema<T>, options?: NonStreamingStepOptions): Promise<T>
export function step<T, S extends StreamTransform>(
  prompt: string,
  schema: Schema<T>,
  options?: NonStreamingStepOptions | StreamingStepOptions<S>,
): Promise<T> | StepResponseStream<T, S>

export function step<T, S extends StreamTransform>(
  prompt: string,
  schema: Schema<T>,
  {
    model = new Model({ name: 'mock', provider: getDefaultProvider() }),
    abortSignal,
    examples,
    history,
    stream: streamOption = false,
    systemPrompt,
  }: NonStreamingStepOptions | StreamingStepOptions<S> = {},
) {
  const stepId = history?.addStepRequest(prompt, schema, examples)
  let messages = history?.['messages'] ?? [buildStepRequestMessage(0, prompt, schema, new Map(), new Set(), examples)]
  if (systemPrompt != null) {
    messages = [{ role: 'system', content: [{ type: 'text', text: systemPrompt }] }, ...messages]
  }
  let { promise, stream } = model.query(messages, schema, streamOption != false, abortSignal)
  const content = promise.then(({ content, cost }) => {
    if (stepId != null && history != null) {
      history.addStepResponse(stepId, content, cost, schema)
    }
    return content
  })
  if (stream == null) {
    return content
  }
  return Object.assign(stream as AsyncIterable<GetStreamOutput<S>>, {
    getValue() {
      return content as Promise<T>
    },
  })
}
