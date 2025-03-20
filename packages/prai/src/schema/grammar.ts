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
  ZodUnion,
} from 'zod'
import { booleanGrammar, numberGrammar, stringGrammar } from '../utils.js'

export const defaultPrimitiveDefinitions = [
  `boolean ::= ${booleanGrammar}`,
  `number ::= ${numberGrammar}`,
  `string ::= "\\"" ${stringGrammar} "\\""`,
]

export function buildSchemaGrammar(
  schema: Schema,
  options?: {
    defaultDefinitions?: Array<string>
    nonTerminalNamePrefix?: string
    rootName?: string
  },
): string {
  const state: Parameters<typeof buildSchemaGrammarRec>[1] = {
    counter: 0,
    definitions: options?.defaultDefinitions ?? defaultPrimitiveDefinitions,
    map: new Map(),
  }
  return `${options?.rootName ?? 'root'} ::= ${buildSchemaGrammarRec(
    schema,
    state,
    options?.nonTerminalNamePrefix,
  )}\n${state.definitions.join('\n')}`
}

function buildSchemaGrammarRec(
  schema: Schema,
  state: {
    counter: number
    map: Map<Schema, string>
    definitions: Array<string>
  },
  nonTerminalNamePrefix: string | undefined,
): string {
  const existingId = state.map.get(schema)
  if (existingId != null) {
    return existingId
  }
  if (schema instanceof ZodRecord) {
    return addDefinition(
      schema,
      `"{" ("\\"[^"]*\\":" ${buildSchemaGrammarRec(
        schema.valueSchema,
        state,
        nonTerminalNamePrefix,
      )} ("," "\\"[^"]*\\":" ${buildSchemaGrammarRec(schema.valueSchema, state, nonTerminalNamePrefix)})*)? "}"`,
      state,
      nonTerminalNamePrefix,
    )
  }
  if (schema instanceof ZodLazy) {
    return buildSchemaGrammarRec(schema.schema, state, nonTerminalNamePrefix)
  }
  if (schema instanceof ZodOptional) {
    return `${buildSchemaGrammarRec(schema.unwrap(), state, nonTerminalNamePrefix)}?`
  }
  if (schema instanceof ZodLiteral) {
    switch (typeof schema.value) {
      case 'string':
        return `"\\"${schema.value}\\""`
      case 'number':
      case 'boolean':
        return `"${schema.value}"`
      default:
        throw new Error(`literal of type "${typeof schema.value}" is not supported`)
    }
  }
  if (schema instanceof ZodUnion) {
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in the union schema must be in an array`)
    }
    return addDefinition(
      schema,
      schema.options.map((option) => buildSchemaGrammarRec(option, state, nonTerminalNamePrefix)).join(' | '),
      state,
      nonTerminalNamePrefix,
    )
  }
  if (schema instanceof ZodIntersection) {
    return addDefinition(
      schema,
      buildObjectSchemaGrammarFromShape(
        Object.entries<Schema>(schema._def.left.shape).concat(Object.entries<Schema>(schema._def.right.shape)),
        state,
        nonTerminalNamePrefix,
      ),
      state,
      nonTerminalNamePrefix,
    )
  }
  if (schema instanceof ZodObject) {
    return addDefinition(
      schema,
      buildObjectSchemaGrammarFromShape(Object.entries(schema.shape), state, nonTerminalNamePrefix),
      state,
      nonTerminalNamePrefix,
    )
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
    return addDefinition(
      schema,
      `"[" ${schema.items.map((item) => buildSchemaGrammarRec(item, state, nonTerminalNamePrefix)).join(` "," `)} "]"`,
      state,
      nonTerminalNamePrefix,
    )
  }
  if (schema instanceof ZodArray) {
    const elementGrammar = buildSchemaGrammarRec(schema.element, state, nonTerminalNamePrefix)
    return addDefinition(schema, `"[" (${elementGrammar} ("," ${elementGrammar})*)? "]"`, state, nonTerminalNamePrefix)
  }
  throw new Error(`unsupported schema type`)
}

function addDefinition(
  schema: Schema,
  grammar: string,
  state: Parameters<typeof buildSchemaGrammarRec>[1],
  nonTerminalNamePrefix: string | undefined,
) {
  const nonTerminal = `${nonTerminalNamePrefix ?? 'N'}${state.counter++}`
  state.map.set(schema, nonTerminal)
  state.definitions.push(`${nonTerminal} ::= ${grammar}`)
  return nonTerminal
}

function buildObjectSchemaGrammarFromShape<T>(
  shapeEntries: Array<[string, Schema]>,
  state: Parameters<typeof buildSchemaGrammarRec>[1],
  nonTerminalNamePrefix: string | undefined,
) {
  return `"{" ${shapeEntries
    .map(([key, schema]) => `"\\"${key}\\":" ${buildSchemaGrammarRec(schema, state, nonTerminalNamePrefix)}`)
    .join(` "," `)} "}"`
}
