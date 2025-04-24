import {
  Schema,
  ZodArray,
  ZodBoolean,
  ZodIntersection,
  ZodLazy,
  ZodLiteral,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodRecord,
  ZodString,
  ZodTuple,
  ZodTypeAny,
  ZodUnion,
} from 'zod'
import { random, randomInt, randomNumber, randomString } from '../random.js'

export function createSchemaMock<T>(schema: Schema<T>, seed: string): T {
  if (schema instanceof ZodRecord) {
    const size = randomInt(seed, 1, 5)
    const result: Record<string, any> = {}
    for (let i = 0; i < size; i++) {
      const key = createSchemaMock(schema.keySchema, seed + i) as string
      result[key] = createSchemaMock(schema.valueSchema, seed + key)
    }
    return result as T
  }
  if (schema instanceof ZodLazy) {
    return createSchemaMock(schema.schema, seed)
  }
  if (schema instanceof ZodOptional) {
    return random(seed) > 0.5 ? createSchemaMock(schema.unwrap(), seed) : (undefined as T)
  }
  if (schema instanceof ZodLiteral) {
    return schema.value
  }
  if (schema instanceof ZodUnion) {
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in the union schema must be in an array`)
    }
    throw new Error(`not implemented`)
  }
  if (schema instanceof ZodIntersection) {
    return {
      ...createSchemaMock(schema._def.left, seed),
      ...createSchemaMock(schema._def.right, seed),
    }
  }
  if (schema instanceof ZodObject) {
    const result: Record<string, unknown> = {}
    for (const [key, itemSchema] of Object.entries(schema.shape)) {
      result[key] = createSchemaMock(itemSchema as ZodTypeAny, seed + key)
    }
    return result as T
  }
  if (schema instanceof ZodNumber) {
    return randomNumber(seed, -1000, 1000) as T
  }
  if (schema instanceof ZodString) {
    return randomString(seed, 4, 15) as T
  }
  if (schema instanceof ZodBoolean) {
    return (random(seed) > 0.5) as T
  }
  if (schema instanceof ZodTuple) {
    if (!Array.isArray(schema.items)) {
      throw new Error(`the items in the tuple schema must be in an array`)
    }
    return schema.items.map((itemSchema, i) => createSchemaMock(itemSchema, seed + i)) as T
  }
  if (schema instanceof ZodArray) {
    const length = randomInt(seed, 1, 6)
    const result = new Array<unknown>(length)
    for (let i = 0; i < length; i++) {
      result[i] = createSchemaMock(schema.element, seed + i)
    }
    return result as T
  }
  throw new Error(`unsupported schema type "${schema.constructor.name}"`)
}
