import { array, intersection, ZodArray, ZodType } from 'zod'
import {
  buildSchemaInstance,
  Data,
  NonStreamingStepOptions,
  StepData,
  StreamingStepData,
  StreamingStepOptions,
  Task,
  ToSchemaInstance,
} from '../index.js'
import { jsonArrayStep } from './json.js'

export function leftInnerJoinStep<T extends object, K extends object>(
  task: Task,
  leftData: Data<Array<T>>,
  rightData: Data<Array<K>>,
  where: Array<
    [left: (left: ToSchemaInstance<T>) => string, () => string, right: (right: ToSchemaInstance<K>) => string]
  >,
  options?: Omit<NonStreamingStepOptions<{ left: Array<T>; right: Array<K> }, Array<T & K>>, 'format'>,
): Promise<StepData<Array<T & K>>>

export function leftInnerJoinStep<T extends object, K extends object>(
  task: Task,
  leftData: Data<Array<T>>,
  rightData: Data<Array<K>>,
  where: Array<
    [left: (left: ToSchemaInstance<T>) => string, () => string, right: (right: ToSchemaInstance<K>) => string]
  >,
  options: Omit<StreamingStepOptions<{ left: Array<T>; right: Array<K> }, Array<T & K>>, 'format'>,
): StreamingStepData<T & K, Array<T & K>>

export function leftInnerJoinStep<T extends object, K extends object>(
  task: Task,
  leftData: Data<Array<T>>,
  rightData: Data<Array<K>>,
  where: Array<
    [left: (left: ToSchemaInstance<T>) => string, () => string, right: (right: ToSchemaInstance<K>) => string]
  >,
  options?: Omit<
    | StreamingStepOptions<{ left: Array<T>; right: Array<K> }, Array<T & K>>
    | NonStreamingStepOptions<{ left: Array<T>; right: Array<K> }, Array<T & K>>,
    'format'
  >,
): Promise<StepData<Array<T & K>>> | StreamingStepData<T & K, Array<T & K>>

export function leftInnerJoinStep<T extends object, K extends object>(
  task: Task,
  leftData: Data<Array<T>>,
  rightData: Data<Array<K>>,
  where: Array<
    [left: (left: ToSchemaInstance<T>) => string, () => string, right: (right: ToSchemaInstance<K>) => string]
  >,
  options?: Omit<
    | StreamingStepOptions<{ left: Array<T>; right: Array<K> }, Array<T & K>>
    | NonStreamingStepOptions<{ left: Array<T>; right: Array<K> }, Array<T & K>>,
    'format'
  >,
): Promise<StepData<Array<T & K>>> | StreamingStepData<T & K, Array<T & K>> {
  const leftEntryInstace = buildSchemaInstance(
    (leftData.schema as ZodArray<ZodType<T>>).element,
    undefined,
    () => ` of each entry in ${leftData}`,
  )
  const rightEntryInstance = buildSchemaInstance(
    (rightData.schema as ZodArray<ZodType<K>>).element,
    undefined,
    () => ` of each entry in ${rightData}`,
  )
  return jsonArrayStep<T & K>(
    task,
    () =>
      `For each entry in ${leftData} find the best matching entry in ${rightData} based on whether ${where
        .map(([left, metric, right]) => `${left(leftEntryInstace)} ${metric()} ${right(rightEntryInstance)}`)
        .join(' and ')}`,
    array(
      intersection(
        (leftData.schema as ZodArray<ZodType<T>>).element,
        (rightData.schema as ZodArray<ZodType<K>>).element,
      ),
    ),
    {
      stream: options?.stream,
      abortSignal: options?.abortSignal,
      examples: options?.examples?.map(({ input, output, reason }) => ({
        input: JSON.stringify(input),
        output,
        reason,
      })),
    } satisfies Omit<
      StreamingStepOptions<string, Array<T & K>> | NonStreamingStepOptions<string, Array<T & K>>,
      'format'
    >,
  )
}
