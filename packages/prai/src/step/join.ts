import { array, intersection, ZodArray, ZodType } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { NonStreamingStepOptions, step, StepResponseStream, StreamingStepOptions, StreamTransform } from '../step.js'
import { History } from '../history.js'
import { getSchema } from '../schema/store.js'

export function leftInnerJoinStep<T extends object, K extends object, S extends StreamTransform>(
  leftData: Array<T>,
  rightData: Array<K>,
  where: Array<
    [left: (left: ToSchemaInstance<T>) => string, () => string, right: (right: ToSchemaInstance<K>) => string]
  >,
  options: StreamingStepOptions<S>,
  leftSchema?: ZodArray<ZodType<T>>,
  rightSchema?: ZodArray<ZodType<K>>,
): StepResponseStream<Array<T & K>, S>

export function leftInnerJoinStep<T extends object, K extends object>(
  leftData: Array<T>,
  rightData: Array<K>,
  where: Array<
    [left: (left: ToSchemaInstance<T>) => string, () => string, right: (right: ToSchemaInstance<K>) => string]
  >,
  options?: NonStreamingStepOptions,
  leftSchema?: ZodArray<ZodType<T>>,
  rightSchema?: ZodArray<ZodType<K>>,
): Promise<Array<T & K>>

export function leftInnerJoinStep<T extends object, K extends object, S extends StreamTransform>(
  leftData: Array<T>,
  rightData: Array<K>,
  where: Array<
    [left: (left: ToSchemaInstance<T>) => string, () => string, right: (right: ToSchemaInstance<K>) => string]
  >,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
  leftSchema?: ZodArray<ZodType<T>>,
  rightSchema?: ZodArray<ZodType<K>>,
): Promise<Array<T & K>> | StepResponseStream<Array<T & K>, S>

export function leftInnerJoinStep<T extends object, K extends object, S extends StreamTransform>(
  leftData: Array<T>,
  rightData: Array<K>,
  where: Array<
    [left: (left: ToSchemaInstance<T>) => string, () => string, right: (right: ToSchemaInstance<K>) => string]
  >,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
  leftInSchema?: ZodArray<ZodType<T>>,
  rightInSchema?: ZodArray<ZodType<K>>,
): Promise<Array<T & K>> | StepResponseStream<Array<T & K>, S> {
  const resolvedLeftSchema = leftInSchema ?? getSchema(leftData)
  const resolvedRightSchema = rightInSchema ?? getSchema(rightData)

  const leftEntryInstance = buildSchemaInstance(
    (resolvedLeftSchema as ZodArray<ZodType<T>>).element,
    undefined,
    () => ` of each entry in the left data`,
  )
  const rightEntryInstance = buildSchemaInstance(
    (resolvedRightSchema as ZodArray<ZodType<K>>).element,
    undefined,
    () => ` of each entry in the right data`,
  )

  let history = options?.history
  if (history == null) {
    history = new History()
    options = { ...options, history }
  }

  return step<Array<T & K>, S>(
    `For each entry in ${history.reference(leftData)} find the best matching entry in ${history.reference(rightData)} based on whether ${where
      .map(([left, metric, right]) => `${left(leftEntryInstance)} ${metric()} ${right(rightEntryInstance)}`)
      .join(' and ')}`,
    array(
      intersection(
        (resolvedLeftSchema as ZodArray<ZodType<T>>).element,
        (resolvedRightSchema as ZodArray<ZodType<K>>).element,
      ),
    ),
    options,
  )
}
