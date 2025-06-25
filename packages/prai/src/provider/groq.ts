import OpenAI, { ClientOptions } from 'openai'
import { Provider } from '../model.js'
import { Message } from '../step.js'
import { buildJsonSchema } from '../schema/json.js'
import { Schema, ZodObject, ZodString, ZodUnion } from 'zod'
import { extractResultProperty, streamingQueryOpenai, queryOpenai } from './utils.js'

function buildAdditionalParams(schema: Schema, wrapInObject: boolean) {
  if (schema instanceof ZodString) {
    return {}
  }
  let responseSchema = buildJsonSchema(schema)
  if (wrapInObject) {
    responseSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        result: responseSchema,
      },
      required: ['result'],
      propertyOrdering: ['result'],
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

export function groq(options: ClientOptions): Provider {
  const client = new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', ...options })
  return {
    async query(model, messages, schema, abortSignal) {
      const transformedMessages = transformMessages(messages)
      if (!(schema instanceof ZodObject || schema instanceof ZodUnion || schema instanceof ZodString)) {
        const { result } = JSON.parse(
          await queryOpenai(model, client, transformedMessages, abortSignal, buildAdditionalParams(schema, true)),
        )
        return JSON.stringify(result)
      }
      return queryOpenai(model, client, transformedMessages, abortSignal, buildAdditionalParams(schema, false))
    },
    async *streamingQuery(model, messages, schema, abortSignal) {
      const transformedMessages = transformMessages(messages)
      if (!(schema instanceof ZodObject || schema instanceof ZodUnion || schema instanceof ZodString)) {
        return extractResultProperty(
          streamingQueryOpenai(model, client, transformedMessages, abortSignal, buildAdditionalParams(schema, true)),
        )
      }
      return streamingQueryOpenai(model, client, transformedMessages, abortSignal, buildAdditionalParams(schema, false))
    },
  }
}

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
