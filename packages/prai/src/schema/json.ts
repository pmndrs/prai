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
      propertyOrdering: Array<string>
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

export function buildJsonSchema(schema: Schema, supportsRefs: boolean = true) {
  const jsonSchemaVisitor = new JsonSchemaVisitor(supportsRefs)
  const result = jsonSchemaVisitor.visit(schema, [], true)
  result.$defs = jsonSchemaVisitor.$defs
  return result
}

type Reference = { schema: Schema; name?: string; isRoot: boolean }

class JsonSchemaVisitor extends SchemaVisitor<JsonSchema, [references: Array<Reference>, isRoot?: boolean]> {
  private definitionCounter: number = 0
  public $defs: Record<string, JsonSchema> = {}

  constructor(private readonly supportsRefs: boolean) {
    super()
  }

  visit(schema: Schema, references: Array<Reference>, isRoot: boolean = false): JsonSchema {
    let reference = references.find(({ schema: s }) => s === schema)
    if (reference != null) {
      //recursion detected
      if (!this.supportsRefs) {
        throw new Error(`Recursive schema references are not supported by this provider`)
      }
      reference.name ??= reference.isRoot ? '#' : `definition_${1 + this.definitionCounter++}`
      return { $ref: reference.isRoot ? reference.name : `#/$defs/${reference.name}` }
    }
    reference = { schema, isRoot }
    const result = super.visit(schema, [...references, reference])
    if (reference?.name != null && !isRoot) {
      this.$defs[reference?.name] = result
      return { $ref: reference.isRoot ? reference.name : `#/$defs/${reference.name}` }
    }
    return result
  }

  visitArray(schema: ZodArray<any>, references: Array<Reference>): JsonSchema {
    return {
      type: 'array',
      description: schema.description,
      items: this.visit(schema.element, references),
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

  visitIntersection(schema: ZodIntersection<any, any>, references: Array<Reference>): JsonSchema {
    const properties: any = {}
    const intersections = flattenIntersections(schema)
    for (const intersection of intersections) {
      if (!(intersection instanceof ZodObject)) {
        throw new Error(`Union options must be objects`)
      }
      for (const key in intersection.shape) {
        properties[key] = this.visit(intersection.shape[key], references)
      }
    }
    return {
      type: 'object',
      additionalProperties: false,
      properties,
      required: Object.keys(properties),
      description: schema.description,
      propertyOrdering: Object.keys(properties),
    }
  }

  visitLazy(schema: ZodLazy<any>, references: Array<Reference>): JsonSchema {
    return this.visit(schema.schema, references)
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

  visitObject(schema: ZodObject<any>, references: Array<Reference>): JsonSchema {
    const properties: any = {}
    for (const key in schema.shape) {
      properties[key] = this.visit(schema.shape[key], references)
    }
    return {
      type: 'object',
      additionalProperties: false,
      properties,
      required: Object.keys(properties),
      description: schema.description,
      propertyOrdering: Object.keys(properties),
    }
  }

  visitNullable(schema: ZodNullable<any>, references: Array<Reference>): JsonSchema {
    return {
      anyOf: [this.visit(schema.unwrap(), references), { type: 'null' }],
    }
  }

  visitString(schema: ZodString): JsonSchema {
    return {
      type: 'string',
      description: schema.description,
    }
  }

  visitUnion(schema: ZodUnion<any>, references: Array<Reference>): JsonSchema {
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in the union schema must be in an array`)
    }
    return {
      anyOf: schema.options.map((intersectedSchema) => this.visit(intersectedSchema, references)),
    }
  }
}
