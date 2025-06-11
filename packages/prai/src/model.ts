import { Schema } from 'zod'
import { Message } from './step.js'

export type Provider = {
  streamingQuery(
    model: string,
    messages: Array<Message>,
    schema: Schema,
    abortSignal: AbortSignal | undefined,
  ): AsyncIterable<string>

  query(model: string, messages: Array<Message>, schema: Schema, abortSignal: AbortSignal | undefined): Promise<string>
}

export type ModelOptions = { name: string; provider: Provider }

export class Model {
  constructor(private readonly options: ModelOptions) {}

  query(
    messages: Array<Message>,
    schema: Schema,
    stream: false,
    abortSignal: AbortSignal | undefined,
  ): { value: Promise<unknown> }
  query(
    messages: Array<Message>,
    schema: Schema,
    stream: true,
    abortSignal: AbortSignal | undefined,
  ): { value: Promise<unknown>; stream: AsyncIterable<string> }
  query(
    messages: Array<Message>,
    schema: Schema,
    stream: boolean,
    abortSignal: AbortSignal | undefined,
  ): { value: Promise<unknown>; stream?: AsyncIterable<string> }
  query(
    messages: Array<Message>,
    schema: Schema,
    streamOption: boolean,
    abortSignal: AbortSignal | undefined,
  ): { value: Promise<unknown>; stream?: AsyncIterable<string> } {
    if (!streamOption) {
      return {
        value: this.options.provider
          .query(this.options.name, messages, schema, abortSignal)
          .then((response) => JSON.parse(response)),
      }
    }
    const responseStream = this.options.provider.streamingQuery(this.options.name, messages, schema, abortSignal)
    let finish: (value: unknown) => void
    const value = new Promise<unknown>((resolve) => (finish = resolve))
    return { stream: collectStream(responseStream, finish!), value }
  }
}

async function* collectStream(input: AsyncIterable<string>, finish: (value: unknown) => void): AsyncIterable<string> {
  let string = ''
  for await (const chunk of input) {
    yield chunk
    string += string
  }
  finish(JSON.parse(string))
}
