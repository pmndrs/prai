import { ClientOptions } from 'openai'
import { base } from './base.js'
import { buildJsonSchema } from '../schema/json.js'
import { Schema, ZodObject, ZodUnion } from 'zod'
import { filterResultObject as extractResultProperty } from '../utils.js'

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
  (schema, queryStream) => {
    if (schema == null) {
      return queryStream()
    }
    if (!(schema instanceof ZodObject || schema instanceof ZodUnion)) {
      return extractResultProperty(queryStream(buildAdditionalParams(schema, true)))
    }
    return queryStream(buildAdditionalParams(schema, false))
  },
  async (schema, query) => {
    if (schema == null) {
      return query()
    }
    if (!(schema instanceof ZodObject || schema instanceof ZodUnion)) {
      const { result } = JSON.parse(await query(buildAdditionalParams(schema, true)))
      return JSON.stringify(result)
    }
    return query(buildAdditionalParams(schema, false))
  },
  { baseURL: 'https://api.openai.com/v1' } satisfies ClientOptions,
)
