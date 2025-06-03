import {
  Schema,
  ZodArray,
  ZodBoolean,
  ZodEnum,
  ZodIntersection,
  ZodLazy,
  ZodLiteral,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodString,
  ZodUnion,
} from 'zod'
import { flattenIntersections } from './utils.js'

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
      $defs?: Record<string, JsonSchema>
    }
  | { type: 'string'; description?: string; enum?: Array<string>; $defs?: Record<string, JsonSchema> }
  | {
      type: 'number' | 'boolean' | 'integer'
      description?: string
      $defs?: Record<string, JsonSchema>
    }
  | {
      type: 'array'
      description?: string
      items?: JsonSchema
      $def?: Record<string, JsonSchema>
      $defs?: Record<string, JsonSchema>
    }
  | { type: 'null'; $defs?: Record<string, JsonSchema> }
  | {
      anyOf: Array<JsonSchema>
      $defs?: Record<string, JsonSchema>
    }
  | {
      $ref: string
      $defs?: Record<string, JsonSchema>
    }

export function buildJsonSchema(schema: Schema) {
  const referenceMap = new Map<Schema, string>()
  const definitionMap = new Map<Schema, string>()
  const counter = { current: 1 }
  const result = buildJsonSchemaRec(schema, referenceMap, definitionMap, counter, true)
  result.$defs = {}
  for (const [reusedSchema, name] of definitionMap.entries()) {
    result.$defs[name] = buildJsonSchemaRec(reusedSchema, referenceMap, definitionMap, counter)
  }
  return result
}

function buildJsonSchemaRec(
  schema: Schema,
  referenceMap: Map<Schema, string>,
  definitionMap: Map<Schema, string>,
  counter: { current: number },
  isRoot = false,
): JsonSchema {
  const reference = referenceMap.get(schema)
  if (reference != null) {
    return { $ref: reference }
  }
  if (schema instanceof ZodLazy) {
    if (isRoot) {
      referenceMap.set(schema, '#')
      return buildJsonSchemaRec(schema.schema, referenceMap, definitionMap, counter)
    }
    const name = `definition_${counter.current++}`
    definitionMap.set(schema.schema, name)
    const reference = `#/$defs/${name}`
    referenceMap.set(schema, reference)
    return {
      $ref: reference,
    }
  }
  if (schema instanceof ZodEnum) {
    return {
      type: 'string',
      description: schema.description,
      enum: schema.options,
    }
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
      anyOf: [buildJsonSchemaRec(schema.unwrap(), referenceMap, definitionMap, counter), { type: 'null' }],
    }
  }
  if (schema instanceof ZodIntersection) {
    const properties: any = {}
    const intersections = flattenIntersections(schema)
    for (const intersection of intersections) {
      if (!(intersection instanceof ZodObject)) {
        throw new Error(`Union options must be objects`)
      }
      for (const key in intersection.shape) {
        properties[key] = buildJsonSchemaRec(intersection.shape[key], referenceMap, definitionMap, counter)
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
  if (schema instanceof ZodUnion) {
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in the union schema must be in an array`)
    }
    return {
      anyOf: schema.options.map((intersectedSchema) =>
        buildJsonSchemaRec(intersectedSchema, referenceMap, definitionMap, counter),
      ),
    }
  }
  if (schema instanceof ZodObject) {
    const properties: any = {}
    for (const key in schema.shape) {
      properties[key] = buildJsonSchemaRec(schema.shape[key], referenceMap, definitionMap, counter)
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
      items: buildJsonSchemaRec(schema.element, referenceMap, definitionMap, counter),
    }
  }
  throw new Error(`Unsupported schema type: ${schema.constructor.name}`)
}
