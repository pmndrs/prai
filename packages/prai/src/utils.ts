export function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown, unknown> {
  return (
    obj != null &&
    typeof obj === 'object' &&
    Symbol.asyncIterator in obj &&
    typeof obj[Symbol.asyncIterator] === 'function'
  )
}
