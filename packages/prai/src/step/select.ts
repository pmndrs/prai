import { Schema, ZodArray } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { NonStreamingStepOptions, step } from '../step.js'
import { History } from '../history.js'
import { getSchema } from '../schema/store.js'

export function selectStep<T>(
  data: Array<T>,
  queryPrompt: (entry: ToSchemaInstance<T>) => string,
  options?: NonStreamingStepOptions,
  inSchema?: ZodArray<Schema<T>>,
): Promise<T> {
  const resolvedInSchema = inSchema ?? getSchema(data)
  const elementSchema = (resolvedInSchema as ZodArray<Schema<T>>).element
  const dataEntryInstance = buildSchemaInstance<T>(elementSchema, undefined, () => ' of each entry')
  let history = options?.history
  if (history == null) {
    history = new History()
    options = { ...options, history }
  }
  return step(
    `Out of each entry in ${history.reference(data)} select ${queryPrompt(
      dataEntryInstance,
    )}. Return all the exact data of the selected entry.`,
    elementSchema,
    options,
  )
}
