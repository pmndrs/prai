import { boolean } from 'zod'
import { Task } from '../task.js'
import { jsonStep } from './json.js'
import { NonStreamingStepOptions } from '../step.js'
import { StepData } from '../data.js'

const booleanSchema = boolean()

export function isTrueStep(
  task: Task,
  queryPrompt: () => string,
  options?: Omit<NonStreamingStepOptions<string, boolean>, 'format'>,
): Promise<StepData<boolean>> {
  return jsonStep(task, () => `Return "true" exactly if ${queryPrompt()}`, booleanSchema, options)
}
