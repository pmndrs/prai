import { Schema, ZodArray } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { NonStreamingStepOptions, step, StepResponseStream, StreamingStepOptions, StreamTransform } from '../step.js'
import { History } from '../history.js'
import { getSchema } from '../schema/store.js'

export function separateStep<T, S extends StreamTransform>(
  data: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options: StreamingStepOptions<S>,
  inSchema?: ZodArray<Schema<T>>,
): StepResponseStream<Array<T>, S>

export function separateStep<T>(
  data: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: NonStreamingStepOptions,
  inSchema?: ZodArray<Schema<T>>,
): Promise<Array<T>>

export function separateStep<T, S extends StreamTransform>(
  data: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
  inSchema?: ZodArray<Schema<T>>,
): Promise<Array<T>> | StepResponseStream<Array<T>, S>

export function separateStep<T, S extends StreamTransform>(
  data: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
  inSchema?: ZodArray<Schema<T>>,
): Promise<Array<T>> | StepResponseStream<Array<T>, S> {
  const resolvedInSchema = inSchema ?? getSchema(data)
  const dataEntryInstance = buildSchemaInstance<T>((resolvedInSchema as unknown as ZodArray<Schema<T>>).element)
  let history = options?.history
  if (history == null) {
    history = new History()
    options = { ...options, history }
  }
  return step(
    `Turn each row in ${history.reference(data)} into multiple new rows by splitting them when ${fn(dataEntryInstance)}.`,
    resolvedInSchema,
    options,
  )
}
