import { describe, it, expect } from 'vitest'
import { extractResultProperty } from '../src/connection/utils.js'

describe('extractResultProperty', () => {
  // Helper function to create an async iterable from chunks
  async function* createAsyncIterable(chunks: string[]): AsyncIterable<string> {
    for (const chunk of chunks) {
      yield chunk
    }
  }

  // Helper function to collect results from async iterable
  async function collectResults(asyncIterable: AsyncIterable<string>): Promise<string> {
    let result = ''
    for await (const chunk of asyncIterable) {
      result += chunk
    }
    return result
  }

  it('should extract result property from JSON in 5 slices', async () => {
    const testObject = {
      name: 'John Doe',
      age: 30,
      skills: ['JavaScript', 'TypeScript', 'React'],
      address: {
        street: '123 Main St',
        city: 'New York',
        country: 'USA',
      },
    }

    const wrappedJson = JSON.stringify({ result: testObject })

    // Split into 5 roughly equal chunks
    const chunkSize = Math.ceil(wrappedJson.length / 5)
    const chunks: string[] = []

    for (let i = 0; i < wrappedJson.length; i += chunkSize) {
      chunks.push(wrappedJson.slice(i, i + chunkSize))
    }

    expect(chunks).toHaveLength(5)

    const input = createAsyncIterable(chunks)
    const output = extractResultProperty(input)
    const result = await collectResults(output)

    // The result should be the original object stringified
    expect(result).toBe(JSON.stringify(testObject))
    expect(JSON.parse(result)).toEqual(testObject)
  })

  it('should extract result property from single JSON chunk', async () => {
    const testObject = {
      message: 'Hello World',
      timestamp: '2023-12-01T10:00:00Z',
      data: {
        items: [1, 2, 3, 4, 5],
        metadata: {
          version: '1.0.0',
          author: 'Test User',
        },
      },
    }

    const wrappedJson = JSON.stringify({ result: testObject })
    const chunks = [wrappedJson] // Single chunk

    const input = createAsyncIterable(chunks)
    const output = extractResultProperty(input)
    const result = await collectResults(output)

    // The result should be the original object stringified
    expect(result).toBe(JSON.stringify(testObject))
    expect(JSON.parse(result)).toEqual(testObject)
  })

  it('should handle JSON with nested objects and arrays in multiple chunks', async () => {
    const complexObject = {
      users: [
        { id: 1, name: 'Alice', preferences: { theme: 'dark', language: 'en' } },
        { id: 2, name: 'Bob', preferences: { theme: 'light', language: 'fr' } },
      ],
      settings: {
        notifications: {
          email: true,
          push: false,
          sms: true,
        },
        privacy: {
          profile: 'public',
          search: 'friends',
        },
      },
    }

    const wrappedJson = JSON.stringify({ result: complexObject })

    // Split into uneven chunks to test robustness
    const chunks = [
      wrappedJson.slice(0, 20),
      wrappedJson.slice(20, 60),
      wrappedJson.slice(60, 120),
      wrappedJson.slice(120, 200),
      wrappedJson.slice(200),
    ].filter((chunk) => chunk.length > 0)

    const input = createAsyncIterable(chunks)
    const output = extractResultProperty(input)
    const result = await collectResults(output)

    expect(result).toBe(JSON.stringify(complexObject))
    expect(JSON.parse(result)).toEqual(complexObject)
  })

  it('should handle JSON with escaped quotes and special characters', async () => {
    const testObject = {
      message: 'He said "Hello, world!" and then left.',
      path: 'C:\\Users\\test\\file.txt',
      regex: '\\d+\\.\\d+',
      unicode: '🚀 Unicode test 中文',
    }

    const wrappedJson = JSON.stringify({ result: testObject })

    // Split into 5 chunks
    const chunkSize = Math.ceil(wrappedJson.length / 5)
    const chunks: string[] = []

    for (let i = 0; i < wrappedJson.length; i += chunkSize) {
      chunks.push(wrappedJson.slice(i, i + chunkSize))
    }

    const input = createAsyncIterable(chunks)
    const output = extractResultProperty(input)
    const result = await collectResults(output)

    expect(result).toBe(JSON.stringify(testObject))
    expect(JSON.parse(result)).toEqual(testObject)
  })

  it('should handle JSON with whitespace around result property', async () => {
    const testObject = { simple: 'test' }
    const wrappedJson = `{  "result"  :  ${JSON.stringify(testObject)}  }`

    const chunks = [wrappedJson]

    const input = createAsyncIterable(chunks)
    const output = extractResultProperty(input)
    const result = await collectResults(output)

    expect(result).toBe(JSON.stringify(testObject) + '  ')
    expect(JSON.parse(result)).toEqual(testObject)
  })

  it('should handle empty result object', async () => {
    const testObject = {}
    const wrappedJson = JSON.stringify({ result: testObject })

    const chunks = [wrappedJson]

    const input = createAsyncIterable(chunks)
    const output = extractResultProperty(input)
    const result = await collectResults(output)

    expect(result).toBe('{}')
    expect(JSON.parse(result)).toEqual({})
  })

  it('should handle result with array value', async () => {
    const testArray = ['item1', 'item2', { nested: 'object' }, 42, true, null]
    const wrappedJson = JSON.stringify({ result: testArray })

    // Split into chunks
    const chunkSize = Math.ceil(wrappedJson.length / 3)
    const chunks: string[] = []

    for (let i = 0; i < wrappedJson.length; i += chunkSize) {
      chunks.push(wrappedJson.slice(i, i + chunkSize))
    }

    const input = createAsyncIterable(chunks)
    const output = extractResultProperty(input)
    const result = await collectResults(output)

    expect(result).toBe(JSON.stringify(testArray))
    expect(JSON.parse(result)).toEqual(testArray)
  })

  it('should handle result with primitive values', async () => {
    const testCases = [{ result: 'simple string' }, { result: 42 }, { result: true }, { result: null }]

    for (const testCase of testCases) {
      const wrappedJson = JSON.stringify(testCase)
      const chunks = [wrappedJson]

      const input = createAsyncIterable(chunks)
      const output = extractResultProperty(input)
      const result = await collectResults(output)

      expect(result).toBe(JSON.stringify(testCase.result))
      expect(JSON.parse(result)).toEqual(testCase.result)
    }
  })
})
