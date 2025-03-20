import type { Schema } from 'zod'

export function addOptional(optional: boolean) {
  return optional ? 'optional ' : ''
}

export function addDescription(schema: Schema): string {
  const { description } = schema
  return description == null ? '' : ` which is described as "${description}"`
}
