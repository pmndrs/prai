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
import { SchemaVisitor } from './visitor.js'
import { ReusedSchemaVisitor } from './reused.js'

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
  const reusedSchemaVisitor = new ReusedSchemaVisitor()
  reusedSchemaVisitor.visit(schema)
  const jsonSchemaVisitor = new JsonSchemaVisitor(reusedSchemaVisitor.reusedSchemas)
  const result = jsonSchemaVisitor.visit(schema, true)
  result.$defs = jsonSchemaVisitor.$defs
  return result
}

class JsonSchemaVisitor extends SchemaVisitor<JsonSchema, [isRoot?: boolean]> {
  private referenceMap = new Map<Schema, string>()
  private definitionCounter: number = 0
  public $defs: Record<string, JsonSchema> = {}

  constructor(private readonly reusedSchemas: Set<Schema>) {
    super()
  }

  visit(schema: Schema, isRoot: boolean = false): JsonSchema {
    if (!this.reusedSchemas.has(schema)) {
      return super.visit(schema)
    }
    let reference = this.referenceMap.get(schema)
    if (isRoot && reference == null) {
      this.referenceMap.set(schema, '#')
      return super.visit(schema)
    }
    if (reference == null) {
      const name = `definition_${1 + this.definitionCounter++}`
      this.referenceMap.set(schema, (reference = `#/$defs/${name}`))
      this.$defs[name] = super.visit(schema)
    }
    return {
      $ref: reference,
    }
  }

  visitArray(schema: ZodArray<any>): JsonSchema {
    return {
      type: 'array',
      description: schema.description,
      items: this.visit(schema.element),
    }
  }

  visitBoolean(schema: ZodBoolean): JsonSchema {
    return {
      type: 'boolean',
      description: schema.description,
    }
  }

  visitEnum(schema: ZodEnum<any>): JsonSchema {
    return {
      type: 'string',
      description: schema.description,
      enum: schema.options,
    }
  }

  visitIntersection(schema: ZodIntersection<any, any>): JsonSchema {
    const properties: any = {}
    const intersections = flattenIntersections(schema)
    for (const intersection of intersections) {
      if (!(intersection instanceof ZodObject)) {
        throw new Error(`Union options must be objects`)
      }
      for (const key in intersection.shape) {
        properties[key] = this.visit(intersection.shape[key])
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

  visitLazy(schema: ZodLazy<any>): JsonSchema {
    return this.visit(schema.schema)
  }

  visitLiteral(schema: ZodLiteral<any>): JsonSchema {
    return {
      type: 'string',
      description: schema.description,
      enum: [schema.value],
    }
  }

  visitNumber(schema: ZodNumber): JsonSchema {
    return {
      type: 'number',
      description: schema.description,
    }
  }

  visitObject(schema: ZodObject<any>): JsonSchema {
    const properties: any = {}
    for (const key in schema.shape) {
      properties[key] = this.visit(schema.shape[key])
    }
    return {
      type: 'object',
      additionalProperties: false,
      properties,
      required: Object.keys(properties),
      description: schema.description,
    }
  }

  visitNullable(schema: ZodNullable<any>): JsonSchema {
    return {
      anyOf: [this.visit(schema.unwrap()), { type: 'null' }],
    }
  }

  visitString(schema: ZodString): JsonSchema {
    return {
      type: 'string',
      description: schema.description,
    }
  }

  visitUnion(schema: ZodUnion<any>): JsonSchema {
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in the union schema must be in an array`)
    }
    return {
      anyOf: schema.options.map((intersectedSchema) => this.visit(intersectedSchema)),
    }
  }
}
