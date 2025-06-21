import { describe, it, expect } from 'vitest'
import { stringify, parse } from '../src/index.js'
import { createIterable, createWriteable, StopSymbol } from '../src/internal.js'

function createAsyncState<T>(currentValue: T): AsyncIterable<unknown> & {
  get(): typeof StopSymbol | T
  set(value: T): void
  finish(): void
} {
  const { queue, setResolve, write } = createWriteable<T>()
  queue.push(currentValue)
  return Object.assign(createIterable<T>(queue, setResolve), {
    finish() {
      write(StopSymbol)
    },
    get() {
      return currentValue
    },
    set(value: T) {
      currentValue = value
      write(value)
    },
  })
}

describe('async-json', () => {
  describe('stringify and parse', () => {
    it('should encode and decode basic JSON without async iterables', async () => {
      const data = {
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { a: 1, b: 2 },
      }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      expect(decoded).toEqual(data)
    })

    it('should encode and decode JSON with async iterables', async () => {
      const state1 = createAsyncState('value1')
      const state2 = createAsyncState(42)

      const data = {
        field1: state1,
        nested: {
          field2: state2,
        },
      }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      // Check that the decoded values match the original states
      for await (const value of decoded.field1) {
        expect(value).toBe('value1')
        break
      }

      for await (const value of decoded.nested.field2) {
        expect(value).toBe(42)
        break
      }
    })

    it('should throw error on malformed input', async () => {
      async function* malformedGenerator() {
        yield 'invalid json'
        yield 'more invalid data'
      }

      await expect(parse(malformedGenerator())).rejects.toThrow()
    })

    it('should handle multiple async iterables updating in parallel', async () => {
      const state1 = createAsyncState(1)
      const state2 = createAsyncState('a')
      const data = { num: state1, str: state2 }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      const values1: number[] = []
      const values2: string[] = []

      const done = Promise.all([
        (async () => {
          for await (const value of decoded.num) {
            values1.push(value)
          }
        })(),
        (async () => {
          for await (const value of decoded.str) {
            values2.push(value)
          }
        })(),
      ])

      state1.set(2)
      state2.set('b')
      state1.finish()
      state2.finish()

      await done
      expect(values1).toEqual([1, 2])
      expect(values2).toEqual(['a', 'b'])
    })

    it('should handle nested arrays with async iterables', async () => {
      const state1 = createAsyncState(1)
      const state2 = createAsyncState(2)
      const data = {
        array: [state1, state2],
      }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      const values1: number[] = []
      const values2: number[] = []

      for await (const value of decoded.array[0]) {
        values1.push(value)
        break
      }

      for await (const value of decoded.array[1]) {
        values2.push(value)
        break
      }

      expect(values1).toEqual([1])
      expect(values2).toEqual([2])
    })

    it('should handle early termination of async iterables', async () => {
      const state = createAsyncState(1)
      const data = { value: state }

      const encoded = stringify(data)
      const abortController = new AbortController()
      const decoded = await parse(encoded)

      const values: number[] = []
      for await (const value of decoded.value) {
        values.push(value)
        break // Early termination
      }

      // Update after breaking from the loop
      state.set(2)
      state.set(3)

      expect(values).toEqual([1])
    })
  })
  it('should handle basic encoding and decoding', async () => {
    const data = { value: 'test' }
    const encoded = stringify(data)
    const decoded = await parse(encoded)
    expect(decoded).toEqual(data)
  })

  it('should handle merged chunks', async () => {
    const state = createAsyncState('initial')
    const data = { value: state }

    // Get the encoded stream
    const encodedStream = stringify(data)

    // Create a new stream that merges chunks
    async function* mergeChunks(): AsyncIterable<string> {
      let buffer = ''
      let i = 0
      for await (const chunk of encodedStream) {
        buffer += chunk
        i++
        // Only yield after accumulating multiple chunks
        if (i >= 2) {
          i = 0
          yield buffer
          buffer = ''
        }
      }
      if (buffer.length > 0) {
        yield buffer
      }
    }

    // Decode the merged stream
    const decoded = await parse(mergeChunks())

    // Verify the initial value
    const values: string[] = []
    const done = new Promise<void>(async (resolve) => {
      for await (const value of decoded.value) {
        values.push(value)
      }
      resolve()
    }).catch(console.error)

    // Update the state
    state.set('updated')
    state.finish()

    await done

    expect(values).toEqual(['initial', 'updated'])
  })

  describe('promises', () => {
    it('should encode and decode basic promises', async () => {
      const promise1 = Promise.resolve('resolved value')
      const promise2 = Promise.resolve(42)

      const data = {
        text: promise1,
        number: promise2,
      }

      const encoded = stringify(data)
      const decoded = (await parse(encoded)) as typeof data

      expect(await decoded.text).toBe('resolved value')
      expect(await decoded.number).toBe(42)
    })

    it('should handle nested promises', async () => {
      const nestedPromise = Promise.resolve({ inner: 'value' })
      const data = {
        outer: {
          nested: nestedPromise,
        },
      }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      expect(await decoded.outer.nested).toEqual({ inner: 'value' })
    })

    it('should handle promises in arrays', async () => {
      const promise1 = Promise.resolve('first')
      const promise2 = Promise.resolve('second')

      const data = {
        promises: [promise1, promise2],
      }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      expect(await decoded.promises[0]).toBe('first')
      expect(await decoded.promises[1]).toBe('second')
    })

    it('should handle mixed promises and async iterables', async () => {
      const promise = Promise.resolve('promise value')
      const state = createAsyncState('iterable value')

      const data = {
        promise: promise,
        iterable: state,
      }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      expect(await decoded.promise).toBe('promise value')

      const iterableValues: string[] = []
      for await (const value of decoded.iterable) {
        iterableValues.push(value)
        break
      }
      expect(iterableValues).toEqual(['iterable value'])
    })

    it('should handle promises that resolve to complex objects', async () => {
      const complexObject = {
        array: [1, 2, 3],
        nested: { a: 'test', b: true },
        nullValue: null,
      }
      const promise = Promise.resolve(complexObject)

      const data = { complex: promise }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      expect(await decoded.complex).toEqual(complexObject)
    })

    it('should handle promises that resolve to null', async () => {
      const nullPromise = Promise.resolve(null)

      const data = {
        nullValue: nullPromise,
      }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      expect(await decoded.nullValue).toBe(null)
    })

    it('should handle multiple promises resolving at different times', async () => {
      let resolve1: (value: string) => void
      let resolve2: (value: number) => void

      const promise1 = new Promise<string>((resolve) => {
        resolve1 = resolve
      })
      const promise2 = new Promise<number>((resolve) => {
        resolve2 = resolve
      })

      const data = {
        delayed1: promise1,
        delayed2: promise2,
      }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      // Resolve promises after parsing has started
      setTimeout(() => resolve1('delayed value 1'), 10)
      setTimeout(() => resolve2(999), 20)

      expect(await decoded.delayed1).toBe('delayed value 1')
      expect(await decoded.delayed2).toBe(999)
    })

    it('should handle promises with primitive values', async () => {
      const stringPromise = Promise.resolve('string')
      const numberPromise = Promise.resolve(123)
      const booleanPromise = Promise.resolve(true)
      const nullPromise = Promise.resolve(null)

      const data = {
        str: stringPromise,
        num: numberPromise,
        bool: booleanPromise,
        nullVal: nullPromise,
      }

      const encoded = stringify(data)
      const decoded = await parse(encoded)

      expect(await decoded.str).toBe('string')
      expect(await decoded.num).toBe(123)
      expect(await decoded.bool).toBe(true)
      expect(await decoded.nullVal).toBe(null)
    })
  })
})
