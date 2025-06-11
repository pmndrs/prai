import { boolean } from 'zod'
import { NonStreamingStepOptions, step } from '../step.js'

const booleanSchema = boolean()

export function isTrueStep(prompt: string, options?: NonStreamingStepOptions) {
  return step(`Return "true" exactly if ${prompt}`, booleanSchema, options)
}
