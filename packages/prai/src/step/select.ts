import { Schema, ZodArray } from 'zod'
import { Data, StepData } from '../data.js'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { NonStreamingStepOptions } from '../step.js'
import { Task } from '../task.js'
import { jsonStep } from './json.js'

export function selectStep<T>(
  task: Task,
  data: Data<Array<T>>,
  queryPrompt: (entry: ToSchemaInstance<T>) => string,
  options?: Omit<NonStreamingStepOptions<Array<T>, T>, 'format'>,
): Promise<StepData<T>> {
  const elementSchema = (data.schema as ZodArray<Schema<T>>).element
  const dataEntryInstance = buildSchemaInstance<T>(elementSchema, undefined, () => ' of each entry')
  return jsonStep(
    task,
    () =>
      `Out of each entry in ${data} select ${queryPrompt(
        dataEntryInstance,
      )}. Return all the exact data of the selected entry.`,
    elementSchema,
    {
      abortSignal: options?.abortSignal,
      examples: options?.examples?.map(({ input, output, reason }) => ({
        input: JSON.stringify(input),
        output,
        reason,
      })),
      stream: false,
    },
  )
}
