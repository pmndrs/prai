export function arrayStreamTransform(input: AsyncIterable<string>) {
  return parseJsonFromAsyncString(
    input,
    (openCurlyBrackets, openSquareBrackets, openQuotes) =>
      openCurlyBrackets === 0 && openSquareBrackets === 1 && openQuotes === false,
    (value) => JSON.parse(value),
  )
}

const recordEntryRegex = /^"([^"]+)":(.+)$/

export function recordStreamTransform(input: AsyncIterable<string>) {
  return parseJsonFromAsyncString(
    input,
    (openCurlyBrackets, openSquareBrackets, openQuotes) =>
      openCurlyBrackets === 1 && openSquareBrackets === 0 && !openQuotes,
    (part) => {
      const match = recordEntryRegex.exec(part)
      if (match == null) {
        throw new Error(`Invalid key-value pair format: ${part}`)
      }
      const [, key, value] = match
      return [key, JSON.parse(value)]
    },
  )
}

async function* parseJsonFromAsyncString<T>(
  input: AsyncIterable<string>,
  filter: (openCurlyBrackets: number, openSquareBrackets: number, openQuotes: boolean) => boolean,
  parse: (value: string) => T,
): AsyncIterable<T> {
  let openCurlyBrackets = 0
  let openSquareBrackets = 0
  let unprocessed = ''
  let openQuotes = false
  for await (const part of input) {
    let i = unprocessed.length
    unprocessed += part
    for (; i < unprocessed.length; i++) {
      const char = unprocessed[i]
      switch (char) {
        case '{':
          openCurlyBrackets++
          break
        case '}':
          openCurlyBrackets--
          break
        case `"`:
          openQuotes = !openQuotes
          break
        case '[':
          openSquareBrackets++
          break
        case ']':
          openSquareBrackets--
          break
        case ',':
          if (filter(openCurlyBrackets, openSquareBrackets, openQuotes)) {
            const unparsed = unprocessed.slice(0, i)
            yield parse(unparsed)
            unprocessed = unprocessed.slice(i + 1)
          }
          break
      }
    }
  }
}
