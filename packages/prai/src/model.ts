import { Schema, ZodString } from 'zod'
import { Message } from './step.js'

export type Provider<T = {}> = {
  streamingQuery(
    modelName: string,
    modelPrice: Price | undefined,
    modelOptions: T,
    messages: Array<Message>,
    schema: Schema,
    abortSignal: AbortSignal | undefined,
  ): AsyncIterable<{ content: string; cost?: number }>

  query(
    modelName: string,
    modelPrice: Price | undefined,
    modelOptions: T,
    messages: Array<Message>,
    schema: Schema,
    abortSignal: AbortSignal | undefined,
  ): Promise<{ content: string; cost?: number }>
}

export type Price = (inputTokens: number, thoughtTokens: number, outputTokens: number) => number

export function buildSimplePrice(pricePer1MInput: number, pricePer1MOutput: number): Price {
  return (input, throught, output) => (input * pricePer1MInput + (throught + output) * pricePer1MOutput) / 1_000_000
}

export type ModelOptions<T> = {
  name: string
  price?: Price
  provider: Provider<T>
} & T

export class Model<T> {
  private readonly name: string
  private readonly provider: Provider<T>
  private readonly price: Price | undefined
  private readonly options: T

  constructor({ name, provider, price, ...options }: ModelOptions<T>) {
    this.name = name
    this.provider = provider
    this.price = price
    this.options = options as T
  }

  query(
    messages: Array<Message>,
    schema: Schema,
    stream: false,
    abortSignal: AbortSignal | undefined,
  ): {
    promise: Promise<{ content: unknown; cost?: number }>
  }
  query(
    messages: Array<Message>,
    schema: Schema,
    stream: true,
    abortSignal: AbortSignal | undefined,
  ): {
    promise: Promise<{ content: unknown; cost?: number }>
    stream: AsyncIterable<string>
  }
  query(
    messages: Array<Message>,
    schema: Schema,
    stream: boolean,
    abortSignal: AbortSignal | undefined,
  ): {
    promise: Promise<{ content: unknown; cost?: number }>
    stream?: AsyncIterable<string>
  }
  query(
    messages: Array<Message>,
    schema: Schema,
    streamOption: boolean,
    abortSignal: AbortSignal | undefined,
  ): {
    promise: Promise<{ content: unknown; cost?: number }>
    stream?: AsyncIterable<string>
  } {
    if (!streamOption) {
      return {
        promise: this.provider
          .query(this.name, this.price, this.options, messages, schema, abortSignal)
          .then(({ content, cost }) => ({ content: jsonParse(schema, content), cost })),
      }
    }
    const responseStream = this.provider.streamingQuery(
      this.name,
      this.price,
      this.options,
      messages,
      schema,
      abortSignal,
    )
    let finish: (value: { content: string; cost?: number }) => void
    const value = new Promise<{ content: string; cost?: number }>((resolve) => (finish = resolve))
    return { stream: collectStream(schema, responseStream, finish!), promise: value }
  }
}

async function* collectStream(
  schema: Schema,
  input: AsyncIterable<{ content: string; cost?: number }>,
  finish: (result: { content: string; cost?: number }) => void,
): AsyncIterable<string> {
  let totalContent = ''
  let totalCost: number | undefined
  for await (const { content, cost } of input) {
    yield content
    totalContent += content
    if (cost != null) {
      totalCost ??= 0
      totalCost += cost
    }
  }
  finish({ content: jsonParse(schema, totalContent), cost: totalCost })
}

function jsonParse(schema: Schema, content: string) {
  if (!(schema instanceof ZodString) || (content.at(0) === '"' && content.at(-1) === '"')) {
    return JSON.parse(content)
  }
  return content
}
