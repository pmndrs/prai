import { ClientOptions } from 'openai'
import { base } from './base.js'
import { buildJsonSchema } from '../schema/json.js'
import { ZodObject, ZodUnion } from 'zod'

export const openai = base.bind(
  null,
  (schema) => {
    if (!(schema instanceof ZodObject || schema instanceof ZodUnion)) {
      throw new Error(`the root element in the schema must be an object`)
    }
    return {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response_schema',
          strict: true,
          schema: buildJsonSchema(schema),
        },
      },
    }
  },
  { baseURL: 'https://api.openai.com/v1' } satisfies ClientOptions,
)
