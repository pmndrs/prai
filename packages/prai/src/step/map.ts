import { array, Schema, ZodArray } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { Task } from '../task.js'
import { jsonArrayStep } from './json.js'
import { NonStreamingStepOptions, StreamingStepOptions } from '../step.js'
import { Data, StepData, StreamingStepData } from '../data.js'

//TODO: allow mapping to specific property e.g. allow both = "() => string" and "() => ({ x: string, y: string })"
export function mapStep<T, R>(
  task: Task,
  data: Data<Array<T>>,
  schema: Schema<R>,
  fn: ((entry: ToSchemaInstance<T>) => string) | undefined,
  options: Omit<StreamingStepOptions<T, R>, 'format'>,
): StreamingStepData<R, Array<R>>

export function mapStep<T, R>(
  task: Task,
  data: Data<Array<T>>,
  schema: Schema<R>,
  fn?: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<NonStreamingStepOptions<T, R>, 'format'>,
): Promise<StepData<Array<R>>>

export function mapStep<T, R>(
  task: Task,
  data: Data<Array<T>>,
  schema: Schema<R>,
  fn?: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<StreamingStepOptions<T, R> | NonStreamingStepOptions<T, R>, 'format'>,
): Promise<StepData<Array<R>>> | StreamingStepData<R, Array<R>>

export function mapStep<T, R>(
  task: Task,
  data: Data<Array<T>>,
  schema: Schema<R>,
  queryPrompt?: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<StreamingStepOptions<T, R> | NonStreamingStepOptions<T, R>, 'format'>,
): Promise<StepData<Array<R>>> | StreamingStepData<R, Array<R>> {
  const dataEntryInstance = buildSchemaInstance<T>(
    (data.schema as ZodArray<Schema<T>>).element,
    undefined,
    () => ' of each entry',
  )
  return jsonArrayStep(
    task,
    () =>
      `For each entry in ${data}, ${
        queryPrompt?.(dataEntryInstance) ?? 'map it onto the result structure defined below.'
      }. The resulting list should have the same length and order as the input list of ${data}`,
    array(schema).length(data.value.length) as unknown as Schema<Array<R>>,
    {
      abortSignal: options?.abortSignal,
      examples: options?.examples?.map(({ input, output, reason }) => ({
        input: JSON.stringify(input),
        output: JSON.stringify(output),
        reason,
      })),
      stream: options?.stream,
    },
  )
}
