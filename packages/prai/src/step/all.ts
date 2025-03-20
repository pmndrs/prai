import { ZodArray, ZodType } from 'zod'
import { Task } from '../task.js'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { isTrueStep } from './true.js'
import { NonStreamingStepOptions } from '../step.js'
import { Data, StepData } from '../data.js'

export function allStep<T>(
  task: Task,
  array: Data<Array<T>>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<NonStreamingStepOptions<Array<T>, boolean>, 'format'>,
): Promise<StepData<boolean>> {
  const dataEntryInstance = buildSchemaInstance((array.schema as ZodArray<ZodType<T>>).element)
  return isTrueStep(task, () => `all entries in ${array} are ${fn(dataEntryInstance)}.`, {
    abortSignal: options?.abortSignal,
    examples: options?.examples?.map(({ input, output, reason }) => ({
      input: JSON.stringify(input),
      output,
      reason,
    })),
  })
}
