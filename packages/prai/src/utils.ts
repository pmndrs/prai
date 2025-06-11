export function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown, unknown> {
  return (
    obj != null &&
    typeof obj === 'object' &&
    Symbol.asyncIterator in obj &&
    typeof obj[Symbol.asyncIterator] === 'function'
  )
}

export const NewLine = `\n`

export function lines(...lines: Array<string>): string {
  return lines.join(NewLine)
}
