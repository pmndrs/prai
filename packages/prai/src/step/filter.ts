import { array, Schema, ZodArray } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { NonStreamingStepOptions, step, StepResponseStream, StreamingStepOptions, StreamTransform } from '../step.js'
import { History } from '../history.js'
import { getSchema } from '../schema/store.js'

export function filterStep<T, S extends StreamTransform>(
  data: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options: StreamingStepOptions<S>,
  inSchema?: ZodArray<Schema<T>>,
): StepResponseStream<Array<T>, S>

export function filterStep<T>(
  data: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: NonStreamingStepOptions,
  inSchema?: ZodArray<Schema<T>>,
): Promise<Array<T>>

export function filterStep<T, S extends StreamTransform>(
  data: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
  inSchema?: ZodArray<Schema<T>>,
): Promise<Array<T>> | StepResponseStream<Array<T>, S>

export function filterStep<T, S extends StreamTransform>(
  data: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
  inSchema?: ZodArray<Schema<T>>,
): Promise<Array<T>> | StepResponseStream<Array<T>, S> {
  const resolvedInSchema = inSchema ?? getSchema(data)
  const schemaElement = (resolvedInSchema as ZodArray<Schema<T>>).element
  const dataEntryInstance = buildSchemaInstance<T>(schemaElement)
  let history = options?.history
  if (history == null) {
    history = new History()
    options = { ...options, history }
  }
  return step(
    `Filter ${history.reference(data)} by only keeping the entries where ${fn(dataEntryInstance)}.`,
    array(schemaElement).max(data.length),
    options,
  )
}
