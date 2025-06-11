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

export function joinStrings(strings: Array<any>, type: 'and' | 'or'): string {
  if (strings.length === 0) {
    throw new Error(`joinStrings requires the list of strings to be joined to have a length of at least 1`)
  }
  if (strings.length === 1) {
    return `${strings[0]}`
  }
  return `${strings.slice(0, -1).join(', ')}, ${type} ${strings.at(-1)}`
}
