import { Schema, ZodArray } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { Task } from '../task.js'
import { jsonArrayStep } from './json.js'
import { NonStreamingStepOptions, StreamingStepOptions } from '../step.js'
import { Data, StepData, StreamingStepData } from '../data.js'

export function separateStep<T>(
  task: Task,
  data: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options: Omit<StreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): StreamingStepData<T, Array<T>>

export function separateStep<T>(
  task: Task,
  data: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<NonStreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>>

export function separateStep<T>(
  task: Task,
  data: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<StreamingStepOptions<Array<T>, Array<T>> | NonStreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>> | StreamingStepData<T, Array<T>>

export function separateStep<T>(
  task: Task,
  data: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<StreamingStepOptions<Array<T>, Array<T>> | NonStreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>> | StreamingStepData<T, Array<T>> {
  const dataEntryInstance = buildSchemaInstance<T>((data.schema as unknown as ZodArray<Schema<T>>).element)
  return jsonArrayStep(
    task,
    () => `Turn each row in ${data} into multiple new rows by splitting them when ${fn(dataEntryInstance)}.`,
    data.schema,
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
