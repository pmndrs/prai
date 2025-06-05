import { ClientOptions } from 'openai'
import { base, Message } from './base.js'
import { buildJsonSchema } from '../schema/json.js'
import { Schema, ZodObject, ZodUnion } from 'zod'
import { extractResultProperty, streamingQuery, query } from './utils.js'

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
export const groq = base.bind(
  null,
  (model, client, providedMessages, schema, abortSignal) => {
    const messages = transformMessages(providedMessages)
    if (schema == null) {
      return streamingQuery(model, client, messages, abortSignal)
    }
    if (!(schema instanceof ZodObject || schema instanceof ZodUnion)) {
      return extractResultProperty(
        streamingQuery(model, client, messages, abortSignal, buildAdditionalParams(schema, true)),
      )
    }
    return streamingQuery(model, client, messages, abortSignal, buildAdditionalParams(schema, false))
  },
  async (model, client, providedMessages, schema, abortSignal) => {
    const messages = transformMessages(providedMessages)
    if (schema == null) {
      return query(model, client, messages, abortSignal)
    }
    if (!(schema instanceof ZodObject || schema instanceof ZodUnion)) {
      const { result } = JSON.parse(
        await query(model, client, messages, abortSignal, buildAdditionalParams(schema, true)),
      )
      return JSON.stringify(result)
    }
    return query(model, client, messages, abortSignal, buildAdditionalParams(schema, false))
  },
  { baseURL: 'https://api.groq.com/openai/v1' } satisfies ClientOptions,
)

function transformMessages(messages: Array<Message>): Array<Message> {
  return messages.map((message) => {
    if (message.role === 'user') {
      return message
    }
    return {
      role: message.role,
      content: message.content.map(({ text }) => text).join('\n\n') as any,
    }
  })
}
