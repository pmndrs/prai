import { array, Schema, ZodArray } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { Task } from '../task.js'
import { jsonArrayStep } from './json.js'
import { NonStreamingStepOptions, StreamingStepOptions } from '../step.js'
import { Data, StepData, StreamingStepData } from '../data.js'

export function filterStep<T>(
  task: Task,
  data: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options: Omit<StreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): StreamingStepData<T, Array<T>>

export function filterStep<T>(
  task: Task,
  data: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<NonStreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>>

export function filterStep<T>(
  task: Task,
  data: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<StreamingStepOptions<Array<T>, Array<T>> | NonStreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>> | StreamingStepData<T, Array<T>>

export function filterStep<T>(
  task: Task,
  data: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<StreamingStepOptions<Array<T>, Array<T>> | NonStreamingStepOptions<Array<T>, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>> | StreamingStepData<T, Array<T>> {
  const schemaElement = (data.schema as ZodArray<Schema<T>>).element
  const dataEntryInstance = buildSchemaInstance<T>(schemaElement)
  return jsonArrayStep(
    task,
    () => `Filter ${data} by only keeping the entries where ${fn(dataEntryInstance)}.`,
    array(schemaElement).max(data.value.length),
    {
      abortSignal: options?.abortSignal,
      examples: options?.examples?.map(({ input, output, reason }) => ({
        input: JSON.stringify(input),
        output,
        reason,
      })),
      stream: options?.stream,
    },
  )
}
