import {
  Schema,
  ZodArray,
  ZodBoolean,
  ZodIntersection,
  ZodLazy,
  ZodLiteral,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodString,
  ZodUnion,
} from 'zod'

export type JsonSchema =
  | {
      type: 'object'
      description?: string
      additionalProperties: false
      properties: Record<string, JsonSchema>
      /**
       * all fields must be required
       */
      required: Array<string>
    }
  | { type: 'string'; description?: string; enum?: Array<string> }
  | {
      type: 'number' | 'boolean' | 'integer'
      description?: string
    }
  | {
      type: 'array'
      description?: string
      items?: JsonSchema
    }
  | { type: 'null' }
  | {
      anyOf: Array<JsonSchema>
      description?: string
    }

export function buildJsonSchema(schema: Schema): JsonSchema {
  //TODO: support recursion!
  if (schema instanceof ZodLazy) {
    return buildJsonSchema(schema.schema)
  }
  if (schema instanceof ZodLiteral) {
    return {
      type: 'string',
      description: schema.description,
      enum: [schema.value],
    }
  }
  if (schema instanceof ZodNullable) {
    return {
      anyOf: [buildJsonSchema(schema.unwrap()), { type: 'null' }],
      description: schema.description,
    }
  }
  if (schema instanceof ZodUnion) {
    const properties: any = {}
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in the union schema must be in an array`)
    }
    for (const option of schema.options) {
      if (!(option instanceof ZodObject)) {
        throw new Error(`Union options must be objects`)
      }
      for (const key in option.shape) {
        properties[key] = buildJsonSchema(option.shape[key])
      }
    }
    return {
      type: 'object',
      additionalProperties: false,
      properties,
      required: Object.keys(properties),
      description: schema.description,
    }
  }
  if (schema instanceof ZodIntersection) {
    return {
      anyOf: [schema._def.left, schema._def.right],
    }
  }
  if (schema instanceof ZodObject) {
    const properties: any = {}
    for (const key in schema.shape) {
      properties[key] = buildJsonSchema(schema.shape[key])
    }
    return {
      type: 'object',
      additionalProperties: false,
      properties,
      required: Object.keys(properties),
      description: schema.description,
    }
  }
  if (schema instanceof ZodNumber) {
    return {
      type: 'number',
      description: schema.description,
    }
  }
  if (schema instanceof ZodString) {
    return {
      type: 'string',
      description: schema.description,
    }
  }
  if (schema instanceof ZodBoolean) {
    return {
      type: 'boolean',
      description: schema.description,
    }
  }
  if (schema instanceof ZodArray) {
    return {
      type: 'array',
      description: schema.description,
      items: buildJsonSchema(schema.element),
    }
  }
  throw new Error(`Unsupported schema type: ${schema.constructor.name}`)
}
