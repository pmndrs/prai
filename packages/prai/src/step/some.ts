import { ZodArray, ZodType } from 'zod'
import { buildSchemaInstance, ToSchemaInstance } from '../schema/index.js'
import { isTrueStep } from './true.js'
import { NonStreamingStepOptions } from '../step.js'
import { History } from '../history.js'
import { getSchema } from '../schema/store.js'

export function someStep<T>(
  array: Array<T>,
  fn: (entry: ToSchemaInstance<T>) => string,
  options?: NonStreamingStepOptions,
  inSchema?: ZodArray<ZodType<T>>,
): Promise<boolean> {
  const resolvedInSchema = inSchema ?? getSchema(array)
  const dataEntryInstance = buildSchemaInstance((resolvedInSchema as ZodArray<ZodType<T>>).element)
  let history = options?.history
  if (history == null) {
    history = new History()
    options = { ...options, history }
  }
  return isTrueStep(`at least one entry in ${history.reference(array)} is ${fn(dataEntryInstance)}.`, options)
}
