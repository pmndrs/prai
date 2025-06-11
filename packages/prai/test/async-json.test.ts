import { describe, it, expect } from 'vitest'
import { encodeAsyncJson, decodeAsyncJson, createAsyncState } from '../src/async-json.js'

describe('async-json', () => {
  describe('encodeAsyncJson and decodeAsyncJson', () => {
    it('should encode and decode basic JSON without async iterables', async () => {
      const data = {
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { a: 1, b: 2 },
      }

      const encoded = encodeAsyncJson(data)
      const decoded = await decodeAsyncJson<typeof data>(encoded, new AbortController().signal)

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

      const encoded = encodeAsyncJson(data)
      const decoded = await decodeAsyncJson<{
        field1: AsyncIterable<string>
        nested: {
          field2: AsyncIterable<number>
        }
      }>(encoded, new AbortController().signal)

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

    it('should handle updates to async states during streaming', async () => {
      const state = createAsyncState(1)
      const data = { counter: state }

      const encoded = encodeAsyncJson(data)
      const abortController = new AbortController()
      const decoded = await decodeAsyncJson<{
        counter: AsyncIterable<number>
      }>(encoded, abortController.signal)

      const values: number[] = []
      const done = new Promise<void>(async (resolve) => {
        for await (const value of decoded.counter) {
          values.push(value)
          if (values.length === 2) {
            resolve()
            break
          }
        }
      })

      // Update the state
      state.set(2)
      await done

      expect(values).toEqual([1, 2])
    })

    it('should handle abort signal', async () => {
      const state = createAsyncState('test')
      const data = { value: state }

      const encoded = encodeAsyncJson(data)
      const abortController = new AbortController()
      const decoded = await decodeAsyncJson<{
        value: AsyncIterable<string>
      }>(encoded, abortController.signal)

      const iterationPromise = (async () => {
        for await (const _ of decoded.value) {
          // Should not get here after abort
        }
      })()

      // Abort after a small delay
      setTimeout(() => abortController.abort(), 10)

      await expect(iterationPromise).resolves.toBeUndefined()
    })

    it('should throw error on malformed input', async () => {
      async function* malformedGenerator() {
        yield 'invalid json'
        yield 'more invalid data'
      }

      await expect(decodeAsyncJson(malformedGenerator(), new AbortController().signal)).rejects.toThrow()
    })

    it('should handle multiple async iterables updating in parallel', async () => {
      const state1 = createAsyncState(1)
      const state2 = createAsyncState('a')
      const data = { num: state1, str: state2 }

      const encoded = encodeAsyncJson(data)
      const decoded = await decodeAsyncJson<{
        num: AsyncIterable<number>
        str: AsyncIterable<string>
      }>(encoded, new AbortController().signal)

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

      const encoded = encodeAsyncJson(data)
      const decoded = await decodeAsyncJson<{
        array: [AsyncIterable<number>, AsyncIterable<number>]
      }>(encoded, new AbortController().signal)

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

      const encoded = encodeAsyncJson(data)
      const abortController = new AbortController()
      const decoded = await decodeAsyncJson<{
        value: AsyncIterable<number>
      }>(encoded, abortController.signal)

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
    const encoded = encodeAsyncJson(data)
    const decoded = await decodeAsyncJson(encoded, new AbortController().signal)
    expect(decoded).toEqual(data)
  })

  it('should handle merged chunks', async () => {
    const state = createAsyncState('initial')
    const data = { value: state }

    // Get the encoded stream
    const encodedStream = encodeAsyncJson(data)

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
    const decoded = await decodeAsyncJson<{
      value: AsyncIterable<string>
    }>(mergeChunks(), new AbortController().signal)

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
})
