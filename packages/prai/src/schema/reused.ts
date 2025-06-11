import {
  Schema,
  ZodArray,
  ZodBoolean,
  ZodEnum,
  ZodIntersection,
  ZodLazy,
  ZodLiteral,
  ZodNumber,
  ZodObject,
  ZodNullable,
  ZodString,
  ZodUnion,
} from 'zod'
import { SchemaVisitor } from './visitor.js'

export class ReusedSchemaVisitor extends SchemaVisitor {
  public readonly reusedSchemas = new Set<Schema>()
  constructor(private readonly usedSchemas: Set<Schema> = new Set()) {
    super()
  }

  override visit(schema: Schema): void {
    if (this.usedSchemas.has(schema)) {
      this.reusedSchemas.add(schema)
      return
    }
    this.usedSchemas.add(schema)
    super.visit(schema)
  }

  visitArray(schema: ZodArray<any>): void {
    this.visit(schema.element)
  }

  visitBoolean(schema: ZodBoolean): void {
    // Boolean schemas don't have nested schemas to visit
  }

  visitEnum(schema: ZodEnum<any>): void {
    // Enum schemas don't have nested schemas to visit
  }

  visitIntersection(schema: ZodIntersection<any, any>): void {
    this.visit(schema._def.left)
    this.visit(schema._def.right)
  }

  visitLazy(schema: ZodLazy<any>): void {
    // For lazy schemas, we need to get the actual schema
    const actualSchema = schema._def.getter()
    this.visit(actualSchema)
  }

  visitLiteral(schema: ZodLiteral<any>): void {
    // Literal schemas don't have nested schemas to visit
  }

  visitNumber(schema: ZodNumber): void {
    // Number schemas don't have nested schemas to visit
  }

  visitObject(schema: ZodObject<any>): void {
    const shape = schema._def.shape()
    for (const key in shape) {
      this.visit(shape[key])
    }
  }

  visitNullable(schema: ZodNullable<any>): void {
    this.visit(schema._def.innerType)
  }

  visitString(schema: ZodString): void {
    // String schemas don't have nested schemas to visit
  }

  visitUnion(schema: ZodUnion<any>): void {
    for (const option of schema._def.options) {
      this.visit(option)
    }
  }
}
