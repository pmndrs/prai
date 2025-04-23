import { ClientOptions } from 'openai'
import { base } from './base.js'
import { buildJsonSchema } from '../schema/json.js'

export const openai = base.bind(
  null,
  (schema) => {
    let jsonSchema = buildJsonSchema(schema)
    if ('anyOf' in jsonSchema || jsonSchema.type != 'object') {
      jsonSchema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          response: jsonSchema,
        },
        required: ['response'],
      }
    }
    return {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response_schema',
          strict: true,
          schema: jsonSchema,
        },
      },
    }
  },
  { baseURL: 'https://api.openai.com/v1' } satisfies ClientOptions,
)
