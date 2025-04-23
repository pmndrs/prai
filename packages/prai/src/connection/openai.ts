import { ClientOptions } from 'openai'
import { base } from './base.js'
import { buildJsonSchema } from '../schema/json.js'
import { object, ZodObject, ZodUnion } from 'zod'

export const openai = base.bind(
  null,
  (schema) => {
    if (!(schema instanceof ZodObject || schema instanceof ZodUnion)) {
      schema = object({
        response: schema,
      })
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
