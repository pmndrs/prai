import { array, Schema } from 'zod'
import { NonStreamingStepOptions, step, StepResponseStream, StreamingStepOptions, StreamTransform } from '../step.js'

export function listStep<T, S extends StreamTransform>(
  query: string,
  schema: Schema<T>,
  options: StreamingStepOptions<S>,
): StepResponseStream<Array<T>, S>

export function listStep<T>(query: string, schema: Schema<T>, options?: NonStreamingStepOptions): Promise<Array<T>>

export function listStep<T, S extends StreamTransform>(
  query: string,
  schema: Schema<T>,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
): Promise<Array<T>> | StepResponseStream<Array<T>, S>

export function listStep<T, S extends StreamTransform>(
  query: string,
  schema: Schema<T>,
  options?: StreamingStepOptions<S> | NonStreamingStepOptions,
): Promise<Array<T>> | StepResponseStream<Array<T>, S> {
  return step(`Return a list of ${query}`, array(schema), options)
}
