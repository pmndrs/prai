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
  ZodRecord,
  ZodString,
  ZodTuple,
  ZodUnion,
} from 'zod'

export abstract class SchemaVisitor<T = void, P extends Array<any> = []> {
  visit(schema: Schema, ...params: P): T {
    if (schema instanceof ZodArray) {
      return this.visitArray(schema, ...params)
    }
    if (schema instanceof ZodBoolean) {
      return this.visitBoolean(schema, ...params)
    }
    if (schema instanceof ZodEnum) {
      return this.visitEnum(schema, ...params)
    }
    if (schema instanceof ZodIntersection) {
      return this.visitIntersection(schema, ...params)
    }
    if (schema instanceof ZodLazy) {
      return this.visitLazy(schema, ...params)
    }
    if (schema instanceof ZodLiteral) {
      return this.visitLiteral(schema, ...params)
    }
    if (schema instanceof ZodNumber) {
      return this.visitNumber(schema, ...params)
    }
    if (schema instanceof ZodObject) {
      return this.visitObject(schema, ...params)
    }
    if (schema instanceof ZodNullable) {
      return this.visitNullable(schema, ...params)
    }
    if (schema instanceof ZodString) {
      return this.visitString(schema, ...params)
    }
    if (schema instanceof ZodUnion) {
      return this.visitUnion(schema, ...params)
    }

    throw new Error(`Unsupported schema type: ${schema.constructor.name}`)
  }

  protected abstract visitArray(schema: ZodArray<any>, ...params: P): T
  protected abstract visitBoolean(schema: ZodBoolean, ...params: P): T
  protected abstract visitEnum(schema: ZodEnum<any>, ...params: P): T
  protected abstract visitIntersection(schema: ZodIntersection<any, any>, ...params: P): T
  protected abstract visitLazy(schema: ZodLazy<any>, ...params: P): T
  protected abstract visitLiteral(schema: ZodLiteral<any>, ...params: P): T
  protected abstract visitNumber(schema: ZodNumber, ...params: P): T
  protected abstract visitObject(schema: ZodObject<any>, ...params: P): T
  protected abstract visitNullable(schema: ZodNullable<any>, ...params: P): T
  protected abstract visitString(schema: ZodString, ...params: P): T
  protected abstract visitUnion(schema: ZodUnion<any>, ...params: P): T
}
