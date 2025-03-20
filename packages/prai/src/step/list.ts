import { array, Schema } from 'zod'
import { Task } from '../task.js'
import { NonStreamingStepOptions, StreamingStepOptions } from '../step.js'
import { jsonArrayStep } from './json.js'
import { StepData, StreamingStepData } from '../data.js'

export function listStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<T>,
  options: Omit<StreamingStepOptions<string, Array<T>>, 'format'>,
): StreamingStepData<T, Array<T>>

export function listStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<T>,
  options?: Omit<NonStreamingStepOptions<string, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>>

export function listStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<T>,
  options?: Omit<NonStreamingStepOptions<string, Array<T>> | StreamingStepOptions<string, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>> | StreamingStepData<T, Array<T>>

export function listStep<T>(
  task: Task,
  queryPrompt: () => string,
  schema: Schema<T>,
  options?: Omit<NonStreamingStepOptions<string, Array<T>> | StreamingStepOptions<string, Array<T>>, 'format'>,
): Promise<StepData<Array<T>>> | StreamingStepData<T, Array<T>> {
  return jsonArrayStep(task, () => `Return a list of ${queryPrompt()}`, array(schema), options)
}
