import { Schema, ZodArray } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { Task } from '../task.js'
import { jsonArrayStep } from './json.js'
import { NonStreamingStepOptions, StreamingStepOptions } from '../step.js'
import { Data, StepData, StreamingStepData } from '../data.js'

export function combineStep<T>(
  task: Task,
  array: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<NonStreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>>

export function combineStep<T>(
  task: Task,
  array: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options: Omit<StreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): StreamingStepData<T, Array<T>>

export function combineStep<T>(
  task: Task,
  array: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<StreamingStepOptions<Array<T>, Array<T>> | NonStreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>> | StreamingStepData<T, Array<T>>

export function combineStep<T>(
  task: Task,
  array: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<StreamingStepOptions<Array<T>, Array<T>> | NonStreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>> | StreamingStepData<T, Array<T>> {
  const dataEntryInstance = buildSchemaInstance<T>((array.schema as ZodArray<Schema<T>>).element)
  return jsonArrayStep(
    task,
    () => `Take multiple rows from ${array} and merge them into a single row when ${fn(dataEntryInstance)}.`,
    array.schema,
    {
      abortSignal: options?.abortSignal,
      stream: options?.stream,
      examples: options?.examples?.map(({ input, output, reason }) => ({
        input: JSON.stringify(input),
        output,
        reason,
      })),
    },
  )
}
