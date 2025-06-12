import OpenAI, { ClientOptions } from 'openai'
import { Provider } from '../model.js'
import { Message } from '../step.js'
import { Schema, ZodObject, ZodUnion } from 'zod'
import { extractResultProperty } from './utils.js'
import { buildJsonSchema } from '../schema/json.js'

function buildAdditionalParams(schema: Schema, wrapInObject: boolean) {
  let responseSchema = buildJsonSchema(schema)
  if (wrapInObject) {
    responseSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        result: responseSchema,
      },
      required: ['result'],
    }
  }
  return {
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'response_schema',
        strict: true,
        schema: responseSchema,
      },
    },
  }
}

export function openai(options: ClientOptions): Provider {
  const client = new OpenAI(options)
  return {
    async query(model, messages, schema, abortSignal) {
      if (schema == null) {
        return openaiQuery(model, client, messages, abortSignal)
      }
      if (!(schema instanceof ZodObject || schema instanceof ZodUnion)) {
        const { result } = JSON.parse(
          await openaiQuery(model, client, messages, abortSignal, buildAdditionalParams(schema, true)),
        )
        return JSON.stringify(result)
      }
      return openaiQuery(model, client, messages, abortSignal, buildAdditionalParams(schema, false))
    },
    async *streamingQuery(model, messages, schema, abortSignal) {
      if (schema == null) {
        return openaiStreamingQuery(model, client, messages, abortSignal)
      }
      if (!(schema instanceof ZodObject || schema instanceof ZodUnion)) {
        return extractResultProperty(
          openaiStreamingQuery(model, client, messages, abortSignal, buildAdditionalParams(schema, true)),
        )
      }
      return openaiStreamingQuery(model, client, messages, abortSignal, buildAdditionalParams(schema, false))
    },
  }
}

export async function* openaiStreamingQuery(
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

export async function openaiQuery(
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
