import {
  infer,
  number,
  object,
  Schema,
  string,
  TypeOf,
  union,
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

//TODO? support recursion?

export function buildSchemaTypename(schema: Schema): string {
  if (schema instanceof ZodLazy) {
    return buildSchemaTypename(schema.schema)
  }
  if (schema instanceof ZodNullable) {
    return `(${buildSchemaTypename(schema.unwrap())} | null)`
  }
  if (schema instanceof ZodEnum) {
    return `(${(schema.options as Array<string>).map((value) => `"${value}"`).join(' | ')})`
  }
  if (schema instanceof ZodLiteral) {
    switch (typeof schema.value) {
      case 'string':
        return `"${schema.value}"`
      case 'number':
      case 'boolean':
        return `${schema.value}`
      default:
        throw new Error(`literal of type "${typeof schema.value}" is not supported`)
    }
  }
  if (schema instanceof ZodUnion) {
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in the union schema must be in an array`)
    }
    return `(${schema.options.map(buildSchemaTypename).join(' | ')})`
  }
  if (schema instanceof ZodIntersection) {
    return `${buildSchemaTypename(schema._def.left)} & ${buildSchemaTypename(schema._def.right)}`
  }
  if (schema instanceof ZodRecord) {
    return `Record<${buildSchemaTypename(schema.keySchema)}, ${buildSchemaTypename(schema.valueSchema)}>`
  }
  if (schema instanceof ZodObject) {
    return `{ ${Object.entries<Schema>(schema.shape)
      .map(([key, schema]) => `"${key}": ${buildSchemaTypename(schema)}`)
      .join(', ')} }`
  }
  if (schema instanceof ZodNumber) {
    return 'number'
  }
  if (schema instanceof ZodString) {
    return `string`
  }
  if (schema instanceof ZodBoolean) {
    return `boolean`
  }
  if (schema instanceof ZodTuple) {
    if (!Array.isArray(schema.items)) {
      throw new Error(`the items in the tuple schema must be in an array`)
    }
    return `[${schema.items.map(buildSchemaTypename).join(', ')}]`
  }
  if (schema instanceof ZodArray) {
    return `Array<${buildSchemaTypename(schema.element)}>`
  }
  throw new Error(`unsupported schema type "${schema.constructor.name}"`)
}
