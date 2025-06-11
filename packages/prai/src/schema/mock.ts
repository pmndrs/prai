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
  ZodTypeAny,
  ZodUnion,
} from 'zod'
import { random, randomInt, randomNumber, randomString } from '../random.js'
import { SchemaVisitor } from './visitor.js'

class MockSchemaVisitor extends SchemaVisitor<any, [string]> {
  visitArray(schema: ZodArray<any>, seed: string): any {
    const length = randomInt(seed, 1, 6)
    const result = new Array<unknown>(length)
    for (let i = 0; i < length; i++) {
      result[i] = this.visit(schema.element, seed + i)
    }
    return result
  }

  visitBoolean(schema: ZodBoolean, seed: string): boolean {
    return random(seed) > 0.5
  }

  visitEnum(schema: ZodEnum<any>, seed: string): any {
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in this enum must be in an array`)
    }
    const values = schema.options
    const index = randomInt(seed, 0, values.length)
    return values[index]
  }

  visitIntersection(schema: ZodIntersection<any, any>, seed: string): any {
    return {
      ...this.visit(schema._def.left, seed),
      ...this.visit(schema._def.right, seed),
    }
  }

  visitLazy(schema: ZodLazy<any>, seed: string): any {
    return this.visit(schema.schema, seed)
  }

  visitLiteral(schema: ZodLiteral<any>, seed: string): any {
    return schema.value
  }

  visitNumber(schema: ZodNumber, seed: string): number {
    return randomNumber(seed, -1000, 1000)
  }

  visitObject(schema: ZodObject<any>, seed: string): any {
    const result: Record<string, unknown> = {}
    for (const [key, itemSchema] of Object.entries(schema.shape)) {
      result[key] = this.visit(itemSchema as ZodTypeAny, seed + key)
    }
    return result
  }

  visitNullable(schema: ZodNullable<any>, seed: string): any {
    return random(seed) > 0.5 ? this.visit(schema.unwrap(), seed) : undefined
  }

  visitString(schema: ZodString, seed: string): string {
    return randomString(seed, 4, 15)
  }

  visitUnion(schema: ZodUnion<any>, seed: string): any {
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in this union must be in an array`)
    }
    const values = schema.options
    const index = randomInt(seed, 0, values.length)
    return values[index]
  }
}

export function createSchemaMock<T>(schema: Schema<T>, seed: string): T {
  const visitor = new MockSchemaVisitor()
  return visitor.visit(schema, seed)
}
