import { ClientOptions } from 'openai'
import { base } from './base.js'
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

export const openai = base.bind(
  null,
  (model, client, messages, schema, abortSignal) => {
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
  async (model, client, messages, schema, abortSignal) => {
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
  { baseURL: 'https://api.openai.com/v1' } satisfies ClientOptions,
)
