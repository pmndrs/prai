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
import { flattenIntersections } from './utils.js'
import { SchemaVisitor } from './visitor.js'

export type ToSchemaInstance<T> = T extends null
  ? never
  : T extends object
    ? { [Key in keyof T]: ToSchemaInstance<T[Key]> }
    : T extends Array<infer K>
      ? Array<ToSchemaInstance<K>>
      : { [Symbol.toPrimitive]: () => string }

// Recursion is supported via schemaInstanceMap tracking

class SchemaInstanceBuilder<T> extends SchemaVisitor<
  ToSchemaInstance<T>,
  [(() => string) | undefined, (() => string) | undefined, boolean, (() => string) | undefined]
> {
  // Map to track already visited schemas and their resulting instances to support recursion
  private schemaInstanceMap = new Map<Schema, ToSchemaInstance<any>>()

  // Override the general visit function to handle recursion
  visit(
    schema: Schema,
    prefix?: (() => string) | undefined,
    suffix?: (() => string) | undefined,
    plural: boolean = false,
    toStringOverride?: (() => string) | undefined,
  ): ToSchemaInstance<T> {
    // Check if we've already created an instance for this schema
    const existingInstance = this.schemaInstanceMap.get(schema)
    if (existingInstance != null) {
      return existingInstance as ToSchemaInstance<T>
    }

    // Create a placeholder instance to prevent infinite recursion
    const placeholderInstance = {
      [Symbol.toPrimitive]: () => `${prefix?.() ?? ''} the recursive reference ${suffix?.() ?? ''}`,
    }

    this.schemaInstanceMap.set(schema, placeholderInstance as ToSchemaInstance<any>)

    // Create the actual instance using the parent visit method
    const actualInstance = super.visit(schema, prefix, suffix, plural, toStringOverride)

    // Update the map with the actual instance
    this.schemaInstanceMap.set(schema, actualInstance)

    return actualInstance
  }

  protected visitArray(
    schema: ZodArray<any>,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ): ToSchemaInstance<T> {
    let cachedEntry: any
    const toString = toStringOverride ?? (() => `${prefix?.() ?? ''} the list${plural ? 's' : ''} ${suffix?.() ?? ''}`)
    return new Proxy([] as unknown as ToSchemaInstance<T>, {
      get: (_target, p) => {
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
        return (cachedEntry = this.visit(
          schema.element,
          prefix,
          () => ` in each entry in the list ${suffix?.() ?? ''}`,
          true,
          () => `${prefix?.() ?? ''} each entry in the list ${suffix?.() ?? ''}`,
        ))
      },
    })
  }

  protected visitBoolean(
    schema: ZodBoolean,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ) {
    return {
      [Symbol.toPrimitive]:
        toStringOverride ?? (() => `${prefix?.() ?? ''} the boolean${plural ? 's' : ''} ${suffix?.() ?? ''}`),
    } as ToSchemaInstance<T>
  }

  protected visitEnum(
    schema: ZodEnum<any>,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ) {
    return {
      [Symbol.toPrimitive]:
        toStringOverride ?? (() => `${prefix?.() ?? ''} the enum${plural ? 's' : ''} ${suffix?.() ?? ''}`),
    } as ToSchemaInstance<T>
  }

  protected visitIntersection(
    schema: ZodIntersection<any, any>,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ) {
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
    return this.buildSchemaInstanceWithElements<T>(
      'object',
      'field',
      (key) => entries.find(([entryKey]) => entryKey === key)?.[1],
      prefix,
      suffix,
      plural,
      toStringOverride,
    )
  }

  protected visitLazy(
    schema: ZodLazy<any>,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ): ToSchemaInstance<T> {
    return this.visit(schema.schema, prefix, suffix, plural, toStringOverride)
  }

  protected visitLiteral(
    schema: ZodLiteral<any>,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ) {
    return {
      [Symbol.toPrimitive]:
        toStringOverride ?? (() => `${prefix?.() ?? ''} the literal${plural ? 's' : ''} ${suffix?.() ?? ''}`),
    } as ToSchemaInstance<T>
  }

  protected visitNumber(
    schema: ZodNumber,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ) {
    return {
      [Symbol.toPrimitive]:
        toStringOverride ?? (() => `${prefix?.() ?? ''} the number${plural ? 's' : ''} ${suffix?.() ?? ''}`),
    } as ToSchemaInstance<T>
  }

  protected visitObject(
    schema: ZodObject<any>,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ) {
    return this.buildSchemaInstanceWithElements(
      'object',
      'field',
      (key) => schema.shape[key],
      prefix,
      suffix,
      plural,
      toStringOverride,
    ) as ToSchemaInstance<T>
  }

  protected visitNullable(
    schema: ZodNullable<any>,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ): ToSchemaInstance<T> {
    return this.visit(
      schema.unwrap(),
      prefix,
      () => `(can be null)${suffix != null ? ' ' + suffix() : ''}`,
      plural,
      toStringOverride,
    )
  }

  protected visitString(
    schema: ZodString,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ) {
    return {
      [Symbol.toPrimitive]:
        toStringOverride ?? (() => `${prefix?.() ?? ''} the string${plural ? 's' : ''} ${suffix?.() ?? ''}`),
    } as ToSchemaInstance<T>
  }

  protected visitUnion(
    schema: ZodUnion<any>,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ) {
    return {
      [Symbol.toPrimitive]:
        toStringOverride ?? (() => `${prefix?.() ?? ''} the union${plural ? 's' : ''} ${suffix?.() ?? ''}`),
    } as ToSchemaInstance<T>
  }

  private buildSchemaInstanceWithElements<T>(
    typeName: string,
    elementName: string,
    getElementSchema: (key: any) => Schema | undefined,
    prefix: (() => string) | undefined,
    suffix: (() => string) | undefined,
    plural: boolean,
    toStringOverride: (() => string) | undefined,
  ): ToSchemaInstance<T> {
    const cache: any = {}
    const toString =
      toStringOverride ?? (() => `${prefix?.() ?? ''} ${`the object${plural ? 's' : ''}`} ${suffix?.() ?? ''}`)
    return new Proxy({} as ToSchemaInstance<T>, {
      get: (_target, p) => {
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
        return (cache[p] = this.visit(
          shapeEntry,
          prefix,
          () => ` in the ${String(p)} ${elementName} from the ${typeName} ${suffix?.() ?? ''}`,
          false,
          () => `${prefix?.() ?? ''} the ${String(p)} ${elementName} from the ${typeName} ${suffix?.() ?? ''}`,
        ))
      },
    })
  }
}

export function buildSchemaInstance<T>(
  schema: Schema<T>,
  prefix?: () => string,
  suffix?: () => string,
  plural = false,
  toStringOverride?: () => string,
) {
  const builder = new SchemaInstanceBuilder<T>()

  // Use visitor pattern for all other schema types
  return builder.visit(schema, prefix, suffix, plural, toStringOverride)
}
