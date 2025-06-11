import { Schema } from 'zod'

const schemaSymbol = Symbol('schema')

export function setSchema(value: unknown, schema: Schema): void {
  Object.assign(value as any, { [schemaSymbol]: schema })
}

export function getSchemaOptional(value: unknown): Schema | undefined {
  if (typeof value === 'object' && value != null && schemaSymbol in value) {
    return value[schemaSymbol] as Schema
  }
  return undefined
}

export function getSchema(value: unknown): Schema {
  const schema = getSchemaOptional(value)
  if (schema == null) {
    throw new Error(`No schema found for value`)
  }
  return schema
}
