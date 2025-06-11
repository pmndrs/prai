import { Schema, ZodArray } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { NonStreamingStepOptions, step, StepResponseStream, StreamingStepOptions, StreamTransform } from '../step.js'
import { History } from '../history.js'
import { getSchema } from '../schema/store.js'

export function combineStep<T, S extends StreamTransform>(
  array: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options: StreamingStepOptions<S>,
  inSchema?: ZodArray<Schema<T>>,
): StepResponseStream<Array<T>, S>

export function combineStep<T>(
  array: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: NonStreamingStepOptions,
  inSchema?: ZodArray<Schema<T>>,
): Promise<Array<T>>

export function combineStep<T, S extends StreamTransform>(
  array: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
  inSchema?: ZodArray<Schema<T>>,
): Promise<Array<T>> | StepResponseStream<Array<T>, S>

export function combineStep<T, S extends StreamTransform>(
  array: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
  inSchema?: ZodArray<Schema<T>>,
): Promise<Array<T>> | StepResponseStream<Array<T>, S> {
  const resolvedInSchema = inSchema ?? getSchema(array)
  const dataEntryInstance = buildSchemaInstance<T>((resolvedInSchema as ZodArray<Schema<T>>).element)
  let history = options?.history
  if (history == null) {
    history = new History()
    options = { ...options, history }
  }
  return step(
    `Take multiple rows from ${history.reference(array)} and merge them into a single row when ${fn(dataEntryInstance)}.`,
    resolvedInSchema,
    options,
  )
}
