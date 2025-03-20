export function joinStrings(strings: Array<any>, type: 'and' | 'or'): string {
  if (strings.length === 0) {
    throw new Error(`joinStrings requires the list of strings to be joined to have a length of at least 1`)
  }
  if (strings.length === 1) {
    return `${strings[0]}`
  }
  return `${strings.slice(0, -1).join(', ')}, ${type} ${strings.at(-1)}`
}

export function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown, unknown> {
  return (
    obj != null &&
    typeof obj === 'object' &&
    Symbol.asyncIterator in obj &&
    typeof obj[Symbol.asyncIterator] === 'function'
  )
}

export const booleanGrammar = `"true" | "false"`
export const numberGrammar = `"-"? ("0" [0-9]* | "." [0-9]* | [1-9] [0-9]* ("." [0-9]*)?)`
export const stringGrammar = `[^\\n\\"]+`
