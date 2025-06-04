import { ZodIntersection, type Schema } from 'zod'

export function addDescription(schema: Schema): string {
  const { description } = schema
  return description == null ? '' : ` which is described as "${description}"`
}

export function flattenIntersections(schema: Schema): Array<Schema> {
  if (!(schema instanceof ZodIntersection)) {
    return [schema]
  }
  return [...flattenIntersections(schema._def.left), ...flattenIntersections(schema._def.right)]
}
