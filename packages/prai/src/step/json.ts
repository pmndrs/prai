import { Schema } from 'zod'
import { buildSchemaDescription, buildSchemaGrammar } from '../schema/index.js'
import { NonStreamingStepOptions, StreamingStepOptions, stringStep } from '../step.js'
import { Task } from '../task.js'
import { isAsyncIterable } from '../utils.js'
import { StepData, StreamingStepData } from '../data.js'
import { createSchemaMock } from '../schema/mock.js'

function buildJsonFormatDescription(schema: Schema) {
  return `a json without any whitespace as ${buildSchemaDescription(schema)}`
}

export const step = jsonStep

export async function jsonStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<T>,
  options?: Omit<NonStreamingStepOptions<string, T>, 'format'>,
) {
  const string = await stringStep(task, queryPrompt, {
    abortSignal: options?.abortSignal,
    examples: options?.examples?.map(({ input, output, reason }) => ({
      input,
      output: JSON.stringify(output),
      reason,
    })),
    mock: (seed) => JSON.stringify(createSchemaMock(schema, seed)),
    format: {
      description: buildJsonFormatDescription(schema),
      grammar: buildSchemaGrammar(schema),
    },
  })
  return string.setValue<T>(JSON.parse(string.value), schema)
}

export function jsonArrayStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<Array<T>>,
  options?: Omit<NonStreamingStepOptions<string, Array<T> | string>, 'format'>,
): Promise<StepData<Array<T>>>

export function jsonArrayStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<Array<T>>,
  options: Omit<StreamingStepOptions<string, Array<T> | string>, 'format'>,
): StreamingStepData<T, Array<T>>

export function jsonArrayStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<Array<T>>,
  options?: Omit<
    StreamingStepOptions<string, Array<T> | string> | NonStreamingStepOptions<string, Array<T> | string>,
    'format'
  >,
): StreamingStepData<T, Array<T>> | Promise<StepData<Array<T>>>

export function jsonArrayStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<Array<T>>,
  options?: Omit<
    StreamingStepOptions<string, Array<T> | string> | NonStreamingStepOptions<string, Array<T> | string>,
    'format'
  >,
): StreamingStepData<T, Array<T>> | Promise<StepData<Array<T>>> {
  const asyncString = stringStep(task, queryPrompt, {
    stream: options?.stream,
    abortSignal: options?.abortSignal,
    examples: options?.examples?.map(({ input, output, reason }) => ({
      input,
      output: typeof output === 'string' ? output : JSON.stringify(output),
      reason,
    })),
    format: {
      description: buildJsonFormatDescription(schema),
      grammar: buildSchemaGrammar(schema),
    },
    mock: (seed) => JSON.stringify(createSchemaMock(schema, seed)),
  } satisfies StreamingStepOptions | NonStreamingStepOptions)
  if (!isAsyncIterable(asyncString)) {
    return asyncString.then((string) => string.setValue<Array<T>>(JSON.parse(string.value), schema))
  }
  return asyncString.setStream<T, Array<T>>(
    parseJsonFromAsyncString(
      asyncString,
      (openCurlyBrackets, openSquareBrackets, openQuotes) =>
        openCurlyBrackets === 0 && openSquareBrackets === 1 && openQuotes === false,
      (value) => JSON.parse(value),
    ),
    schema,
    collectStreamingJsonArray,
  )
}

async function collectStreamingJsonArray<T>(stream: AsyncIterable<T>): Promise<Array<T>> {
  const result: Array<T> = []
  for await (const entry of stream) {
    result.push(entry)
  }
  return result
}

const recordEntryRegex = /^"([^"]+)":(.+)$/

export function jsonRecordStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<Record<string, T>>,
  options?: Omit<NonStreamingStepOptions<string, Record<string, T>>, 'format'>,
): Promise<StepData<Record<string, T>>>

export function jsonRecordStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<Record<string, T>>,
  options: Omit<StreamingStepOptions<string, Record<string, T>>, 'format'>,
): StreamingStepData<[string, T], Record<string, T>>

export function jsonRecordStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<Record<string, T>>,
  options?: Omit<
    StreamingStepOptions<string, Record<string, T>> | NonStreamingStepOptions<string, Record<string, T>>,
    'format'
  >,
): StreamingStepData<[string, T], Record<string, T>> | Promise<StepData<Record<string, T>>>

export function jsonRecordStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<Record<string, T>>,
  options?: Omit<
    StreamingStepOptions<string, Record<string, T>> | NonStreamingStepOptions<string, Record<string, T>>,
    'format'
  >,
): StreamingStepData<[string, T], Record<string, T>> | Promise<StepData<Record<string, T>>> {
  const asyncString = stringStep(task, queryPrompt, {
    stream: options?.stream,
    abortSignal: options?.abortSignal,
    examples: options?.examples?.map(({ input, output, reason }) => ({
      input,
      output: JSON.stringify(output),
      reason,
    })),
    format: {
      description: buildJsonFormatDescription(schema),
      grammar: buildSchemaGrammar(schema),
    },
    mock: (seed) => JSON.stringify(createSchemaMock(schema, seed)),
  } satisfies StreamingStepOptions | NonStreamingStepOptions)
  if (!isAsyncIterable(asyncString)) {
    return asyncString.then((string) => string.setValue<Record<string, T>>(JSON.parse(string.value), schema))
  }
  return asyncString.setStream(
    parseJsonFromAsyncString(
      asyncString,
      (openCurlyBrackets, openSquareBrackets, openQuotes) =>
        openCurlyBrackets === 1 && openSquareBrackets === 0 && !openQuotes,
      (part) => {
        const match = recordEntryRegex.exec(part)
        if (match == null) {
          throw new Error(`Invalid key-value pair format: ${part}`)
        }
        const [, key, value] = match
        return [key, JSON.parse(value)]
      },
    ),
    schema,
    collectStreamingJsonRecord,
  )
}

async function collectStreamingJsonRecord<T>(input: AsyncIterable<[string, T]>): Promise<Record<string, T>> {
  const result: Record<string, T> = {}
  for await (const [key, value] of input) {
    result[key] = value
  }
  return result
}

async function* parseJsonFromAsyncString<T>(
  input: AsyncIterable<string>,
  filter: (openCurlyBrackets: number, openSquareBrackets: number, openQuotes: boolean) => boolean,
  parse: (value: string) => T,
): AsyncIterable<T> {
  let openCurlyBrackets = 0
  let openSquareBrackets = 0
  let unprocessed = ''
  let openQuotes = false
  for await (const part of input) {
    let i = unprocessed.length
    unprocessed += part
    for (; i < unprocessed.length; i++) {
      const char = unprocessed[i]
      switch (char) {
        case '{':
          openCurlyBrackets++
          break
        case '}':
          openCurlyBrackets--
          break
        case `"`:
          openQuotes = !openQuotes
          break
        case '[':
          openSquareBrackets++
          break
        case ']':
          openSquareBrackets--
          break
        case ',':
          if (filter(openCurlyBrackets, openSquareBrackets, openQuotes)) {
            const unparsed = unprocessed.slice(0, i)
            yield parse(unparsed)
            unprocessed = unprocessed.slice(i + 1)
          }
          break
      }
    }
  }
}
