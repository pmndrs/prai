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
import { buildSchemaDescription } from './description.js'
import { flattenIntersections } from './utils.js'

export type ToSchemaInstance<T> = T extends object
  ? { [Key in keyof T]: ToSchemaInstance<T[Key]> }
  : T extends Array<infer K>
    ? Array<ToSchemaInstance<K>>
    : { [Symbol.toPrimitive]: () => string }

//TODO: support recursion

export function buildSchemaInstance<T>(
  schema: Schema<T>,
  prefix?: () => string,
  suffix?: () => string,
  plural = false,
  toStringOverride?: () => string,
): ToSchemaInstance<T> {
  if (schema instanceof ZodRecord) {
    const toString =
      toStringOverride ??
      (() =>
        `${prefix?.() ?? ''}${buildSchemaDescription(schema as unknown as Schema<T>, true, plural)}${suffix?.() ?? ''}`)
    let cache: ToSchemaInstance<T> | undefined
    return new Proxy({} as ToSchemaInstance<T>, {
      get(_target, p) {
        if (p === Symbol.toPrimitive) {
          return toString
        }
        if (typeof p === 'symbol') {
          throw new Error(`symbols cannot be used as key of an record schema`)
        }

        if (cache != null) {
          return cache
        }

        return (cache = buildSchemaInstance(
          schema.valueSchema,
          prefix,
          () => ` in the ${p} field from the record ${suffix?.() ?? ''}`,
          undefined,
          () => `${prefix?.() ?? ''} the ${p} field from the record ${suffix?.() ?? ''}`,
        ))
      },
    })
  }
  if (schema instanceof ZodTuple) {
    return buildSchemaInstanceWithElements<T>(
      'tuple',
      'entry',
      (key) => schema.items[key],
      prefix,
      suffix,
      plural,
      toStringOverride,
    )
  }
  if (schema instanceof ZodLazy) {
    buildSchemaInstance(schema.schema, prefix, suffix, plural, toStringOverride)
  }
  if (schema instanceof ZodNullable) {
    return buildSchemaInstance(schema.unwrap(), prefix, suffix, plural, toStringOverride)
  }
  if (
    schema instanceof ZodNumber ||
    schema instanceof ZodString ||
    schema instanceof ZodBoolean ||
    schema instanceof ZodLiteral ||
    schema instanceof ZodUnion ||
    schema instanceof ZodEnum
  ) {
    return {
      [Symbol.toPrimitive]:
        toStringOverride ??
        (() =>
          `${prefix?.() ?? ''}${buildSchemaDescription(
            schema as unknown as Schema<T>,
            true,
            plural,
          )}${suffix?.() ?? ''}`),
    } as ToSchemaInstance<T>
  }
  if (schema instanceof ZodObject) {
    return buildSchemaInstanceWithElements<T>(
      'object',
      'field',
      (key) => schema.shape[key],
      prefix,
      suffix,
      plural,
      toStringOverride,
    )
  }
  if (schema instanceof ZodIntersection) {
    const intersections = flattenIntersections(schema)
    const unsupportedSchema = intersections.find((intersectionSchema) => !(intersectionSchema instanceof ZodObject))
    if (unsupportedSchema != null) {
      throw new Error(
        `unsupported schema type "${unsupportedSchema.constructor.name}" inside intersection. Only objects allowed.`,
      )
    }
    const entries = intersections.reduce<Array<[string, Schema]>>(
      (prev, result) => prev.concat(Object.entries(result)),
      [],
    )
    return buildSchemaInstanceWithElements<T>(
      'object',
      'field',
      (key) => entries.find(([entryKey]) => entryKey === key)?.[1],
      prefix,
      suffix,
      plural,
      toStringOverride,
    )
  }
  if (schema instanceof ZodArray) {
    let cachedEntry: any
    const toString = toStringOverride ?? (() => `${prefix?.() ?? ''} the list${plural ? 's' : ''} ${suffix?.() ?? ''}`)
    return new Proxy([] as unknown as ToSchemaInstance<T>, {
      get(_target, p) {
        if (p === Symbol.toPrimitive) {
          return toString
        }
        if (typeof p === 'symbol') {
          throw new Error(`symbols cannot be used as index of an array schema`)
        }
        if (isNaN(parseInt(p))) {
          throw new Error(`${p} cannot be used to index an array schema`)
        }
        if (cachedEntry != null) {
          return cachedEntry
        }
        return (cachedEntry = buildSchemaInstance(
          schema.element,
          prefix,
          () => ` in each entry in the list ${suffix?.() ?? ''}`,
          true,
          () => `${prefix?.() ?? ''} each entry in the list ${suffix?.() ?? ''}`,
        ))
      },
    })
  }
  throw new Error(`unsupported schema type "${schema.constructor.name}"`)
}

function buildSchemaInstanceWithElements<T>(
  typeName: string,
  elementName: string,
  getElementSchema: (key: any) => Schema | undefined,
  prefix: (() => string) | undefined,
  suffix: (() => string) | undefined,
  plural: boolean,
  toStringOverride: (() => string) | undefined,
) {
  const cache: any = {}
  const toString =
    toStringOverride ?? (() => `${prefix?.() ?? ''} ${`the object${plural ? 's' : ''}`} ${suffix?.() ?? ''}`)
  return new Proxy({} as ToSchemaInstance<T>, {
    get(_target, p) {
      if (p === Symbol.toPrimitive) {
        return toString
      }
      const cachedField = cache[p]
      if (cachedField != null) {
        return cachedField
      }
      const shapeEntry = getElementSchema(p)
      if (shapeEntry == null) {
        throw new Error(`key ${String(p)} is not part of the schema`)
      }
      return (cache[p] = buildSchemaInstance(
        shapeEntry,
        prefix,
        () => ` in the ${String(p)} ${elementName} from the ${typeName} ${suffix?.() ?? ''}`,
        undefined,
        () => `${prefix?.() ?? ''} the ${String(p)} ${elementName} from the ${typeName} ${suffix?.() ?? ''}`,
      ))
    },
  })
}
