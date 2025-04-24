import {
  Schema,
  ZodLiteral,
  ZodUnion,
  ZodOptional,
  ZodLazy,
  ZodNumber,
  ZodString,
  ZodBoolean,
  ZodIntersection,
  ZodObject,
  ZodArray,
  ZodRecord,
  ZodTuple,
} from 'zod'
import { joinStrings } from '../utils.js'
import { addOptional, addDescription, flattenIntersections } from './utils.js'

export function buildSchemaDescription(
  schema: Schema,
  specifc: boolean = false,
  plural: boolean = false,
  optional: boolean = false,
) {
  const reusedSchemaNameMap = buildReusedSchemaNameMap(schema)
  return buildSchemaDescriptionRec(schema, specifc, plural, optional, {
    reusedSchemaNameMap,
    seenSchemas: new Set(),
  })
}

export function buildSchemaDescriptionRec(
  schema: Schema,
  specifc: boolean,
  plural: boolean,
  optional: boolean,
  state: {
    seenSchemas: Set<Schema>
    reusedSchemaNameMap: Map<Schema, string>
  },
): string {
  if (state.seenSchemas.has(schema)) {
    return `${specifc ? 'the ' : plural ? '' : 'a '} value${
      plural ? 's' : ''
    } of type "${state.reusedSchemaNameMap.get(schema)!}"`
  }
  state.seenSchemas.add(schema)
  if (schema instanceof ZodRecord) {
    const keyDescription = buildSchemaDescriptionRec(schema.keySchema, false, true, false, state)
    const valueDescription = buildSchemaDescriptionRec(schema.valueSchema, false, true, false, state)
    return `${specifc ? 'the ' : plural ? '' : 'a '}${addOptional(optional)}record${plural ? 's' : ''}${addTypeName(
      schema,
      state.reusedSchemaNameMap,
      plural,
    )}${addDescription(schema)} with keys as ${keyDescription} and values as ${valueDescription}`
  }
  if (schema instanceof ZodLiteral) {
    return `${specifc ? 'the ' : plural ? '' : 'a '}${addOptional(optional)}literal${plural ? 's' : ''} ${
      typeof schema.value === 'string' ? `"${schema.value}"` : String(schema.value)
    }${addDescription(schema)}`
  }
  if (schema instanceof ZodUnion) {
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in the union type must be in an array`)
    }
    return joinStrings(
      schema.options.map((option) => buildSchemaDescriptionRec(option, specifc, plural, optional, state)),
      'or',
    )
  }
  if (schema instanceof ZodTuple) {
    if (!Array.isArray(schema.items)) {
      throw new Error(`the items in the tuple schema must be in an array`)
    }
    return `${specifc ? 'the ' : plural ? '' : 'a '}${addOptional(optional)}tuple${plural ? 's' : ''}${addTypeName(
      schema,
      state.reusedSchemaNameMap,
      plural,
    )}${addDescription(schema)} containing ${joinStrings(
      schema.items.map((tupleItem: Schema) => buildSchemaDescriptionRec(tupleItem, false, false, false, state)),
      'and',
    )}`
  }
  if (schema instanceof ZodOptional) {
    return buildSchemaDescriptionRec(schema.unwrap(), specifc, plural, true, state)
  }
  if (schema instanceof ZodLazy) {
    return buildSchemaDescriptionRec(schema.schema, specifc, plural, optional, state)
  }
  if (schema instanceof ZodNumber) {
    return `${specifc ? 'the ' : plural ? '' : 'a '}${addOptional(
      optional,
    )}number${plural ? 's' : ''}${addDescription(schema)}`
  }
  if (schema instanceof ZodString) {
    return `${specifc ? 'the ' : plural ? '' : 'a '}${addOptional(
      optional,
    )}string${plural ? 's' : ''}${addDescription(schema)}`
  }
  if (schema instanceof ZodBoolean) {
    return `${specifc ? 'the ' : plural ? '' : 'a '}${addOptional(
      optional,
    )}boolean${plural ? 's' : ''}${addDescription(schema)}`
  }
  if (schema instanceof ZodIntersection) {
    const intersections = flattenIntersections(schema)
    const unsupportedSchema = intersections.find((intersectionSchema) => !(intersectionSchema instanceof ZodObject))
    if (unsupportedSchema != null) {
      throw new Error(
        `unsupported schema type "${unsupportedSchema.constructor.name}" inside intersection. Only objects allowed.`,
      )
    }
    const entries = (intersections as Array<ZodObject<any>>).reduce<Array<[string, Schema]>>(
      (prev, intersectionSchema) => prev.concat(Object.entries(intersectionSchema.shape)),
      [],
    )
    return buildObjectSchemaDescriptionFromShape(schema, entries, specifc, plural, optional, state)
  }
  if (schema instanceof ZodObject) {
    return buildObjectSchemaDescriptionFromShape(
      schema,
      Object.entries<Schema>(schema.shape),
      specifc,
      plural,
      optional,
      state,
    )
  }
  if (schema instanceof ZodArray) {
    return `${specifc ? 'the ' : plural ? '' : 'a '}${addOptional(optional)}list${plural ? 's' : ''}${addTypeName(
      schema,
      state.reusedSchemaNameMap,
      plural,
    )}${addDescription(schema)} containing ${buildSchemaDescriptionRec(schema.element, false, true, false, state)}`
  }
  throw new Error(`unsupported schema type "${schema.constructor.name}"`)
}

function buildObjectSchemaDescriptionFromShape(
  schema: Schema,
  shapeEntries: Array<[string, Schema]>,
  specifc: boolean,
  plural: boolean,
  optional: boolean,
  state: {
    seenSchemas: Set<Schema>
    reusedSchemaNameMap: Map<Schema, string>
  },
) {
  const fieldExplanations = shapeEntries.map(
    ([key, entry]) => `"${key}" which is ${buildSchemaDescriptionRec(entry, false, false, false, state)}`,
  )
  return `${specifc ? 'the ' : plural ? '' : 'an '}${addOptional(optional)}object${plural ? 's' : ''}${addTypeName(
    schema,
    state.reusedSchemaNameMap,
    plural,
  )}${addDescription(schema)} with the ${
    fieldExplanations.length > 1 ? 'fields' : 'field'
  } ${joinStrings(fieldExplanations, 'and')}`
}

function addTypeName(schema: Schema, reusedSchemaNameMap: Map<Schema, string>, plural: boolean): string {
  const name = reusedSchemaNameMap.get(schema)
  if (name == null) {
    return ''
  }
  return ` (lets call ${plural ? 'their' : 'this'} type "${name}")`
}

function buildReusedSchemaNameMap(schema: Schema): Map<Schema, string> {
  const schemasInOccuranceOrder: Array<Schema> = []
  const reusedSchemas = new Set<Schema>()
  buildReusedSchemaNameMapRec(schema, {
    schemasInOccuranceOrder,
    reusedSchemas,
  })

  let i = 0
  const reusedSchemaNameMap = new Map<Schema, string>()
  for (const schema of schemasInOccuranceOrder) {
    if (reusedSchemas.has(schema)) {
      reusedSchemaNameMap.set(schema, `Type${generateTypeName(i++)}`)
    }
  }
  return reusedSchemaNameMap
}

function generateTypeName(i: number): string {
  let result = ''
  while (i >= 26) {
    const rest = i % 26
    result = String.fromCharCode(65 + rest) + result
    i = (i - rest) / 26 - 1
  }
  result = String.fromCharCode(65 + i) + result
  return result
}

function buildReusedSchemaNameMapRec(
  schema: Schema,
  state: { schemasInOccuranceOrder: Array<Schema>; reusedSchemas: Set<Schema> },
): void {
  if (state.reusedSchemas.has(schema)) {
    return
  }
  if (state.schemasInOccuranceOrder.includes(schema)) {
    state.reusedSchemas.add(schema)
    return
  }
  state.schemasInOccuranceOrder.push(schema)

  if (schema instanceof ZodTuple) {
    for (const itemSchema of schema.items) {
      buildReusedSchemaNameMapRec(itemSchema, state)
    }
  }
  if (schema instanceof ZodRecord) {
    buildReusedSchemaNameMapRec(schema.keySchema, state)
    buildReusedSchemaNameMapRec(schema.valueSchema, state)
    return
  }
  if (schema instanceof ZodUnion) {
    for (const option of schema.options) {
      buildReusedSchemaNameMapRec(option, state)
    }
    return
  }
  if (schema instanceof ZodOptional) {
    buildReusedSchemaNameMapRec(schema.unwrap(), state)
    return
  }
  if (schema instanceof ZodLazy) {
    buildReusedSchemaNameMapRec(schema.schema, state)
    return
  }
  if (schema instanceof ZodIntersection) {
    if (!(schema._def.left instanceof ZodObject)) {
      throw new Error(
        `unsupported schema type "${schema._def.left.constructor.name}". Only object supported in intersection.`,
      )
    }
    if (!(schema._def.right instanceof ZodObject)) {
      throw new Error(
        `unsupported schema type "${schema._def.right.constructor.name}". Only object supported in intersection.`,
      )
    }
    buildReusedSchemaNameMapRec(schema._def.left, state)
    buildReusedSchemaNameMapRec(schema._def.right, state)
    return
  }
  if (schema instanceof ZodObject) {
    for (const valueSchema of Object.values<Schema>(schema.shape)) {
      buildReusedSchemaNameMapRec(valueSchema, state)
    }
    return
  }
  if (schema instanceof ZodArray) {
    buildReusedSchemaNameMapRec(schema.element, state)
    return
  }
}
