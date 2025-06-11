import { array, Schema, ZodArray, ZodType } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { NonStreamingStepOptions, step, StepResponseStream, StreamingStepOptions, StreamTransform } from '../step.js'
import { History } from '../history.js'
import { getSchema } from '../schema/store.js'

//TODO: allow mapping to specific property e.g. allow both = "() => string" and "() => ({ x: string, y: string })"
export function mapStep<T, R, S extends StreamTransform>(
  data: Array<T>,
  prompt: (entry: ToSchemaInstance<T>) => string,
  schema: Schema<R>,
  options: StreamingStepOptions<S>,
): StepResponseStream<R, S>

export function mapStep<T, R>(
  data: Array<T>,
  prompt: (entry: ToSchemaInstance<T>) => string,
  schema: Schema<R>,
  options?: NonStreamingStepOptions,
): Promise<Array<R>>

export function mapStep<T, R, S extends StreamTransform>(
  data: Array<T>,
  prompt: (entry: ToSchemaInstance<T>) => string,
  schema: Schema<R>,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
): Promise<Array<R>> | StepResponseStream<R, S>

export function mapStep<T, R, S extends StreamTransform>(
  data: Array<T>,
  prompt: (entry: ToSchemaInstance<T>) => string,
  schema: Schema<R>,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
  inSchema?: Schema<Array<T>>,
) {
  const resolvedInSchema = inSchema ?? getSchema(data)
  const dataEntryInstance = buildSchemaInstance<T>(
    (resolvedInSchema as ZodArray<ZodType<T>>).element,
    undefined,
    () => ' of each entry',
  )
  let history = options?.history
  if (history == null) {
    history = new History()
    options = { ...options, history }
  }
  return step(
    `For each entry in ${history.reference(data)}, ${
      prompt(dataEntryInstance) ?? 'map it onto the result structure defined below.'
    }. The resulting list should have the same length and order as the input list of ${history.reference(data)}`,
    array(schema),
    options,
  )
}
