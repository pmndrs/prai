import { APIUserAbortError } from 'openai'
import { randomInt } from '../random.js'
import { Provider } from '../model.js'
import { createSchemaMock } from '../schema/mock.js'

const charactersPerToken = 3

export function mock(
  options: {
    seed?: string
    abortSignal?: AbortSignal
    startupDelaySeconds?: number
    tokensPerSecond?: number
  } = {},
): Provider {
  let queryCounter = 0
  return {
    streamingQuery(model, messages, schema, abortSignal) {
      const querySeed = (options.seed ?? '') + queryCounter++
      const string = JSON.stringify(createSchemaMock(schema, querySeed))
      const combinedAbortSignal = AbortSignal.any([abortSignal, options.abortSignal].filter((signal) => signal != null))
      const { startupDelaySeconds = 0.2, tokensPerSecond = 50 } = options
      const secondsPerCharacter = 1 / (tokensPerSecond * charactersPerToken)
      return split(startupDelaySeconds, secondsPerCharacter, string, querySeed, combinedAbortSignal)
    },
    async query(model, messages, schema, abortSignal) {
      let result = ''
      const stream = this.streamingQuery(model, messages, schema, abortSignal)
      for await (const chunk of stream) {
        result += chunk
      }
      return result
    },
  }
}

async function* split(
  startupDelaySeconds: number,
  secondsPerCharacter: number,
  string: string,
  seed: string,
  abortSignal: AbortSignal,
) {
  await wait(startupDelaySeconds, abortSignal)
  const splitAmount = randomInt(seed, 1, 10)
  const equalChunkSize = Math.round(string.length / splitAmount)
  let rest = string
  for (let i = 0; i < splitAmount - 1; i++) {
    const characterAmount = randomInt(seed + i, Math.floor(equalChunkSize * 0.5), equalChunkSize * 2)
    await wait(secondsPerCharacter * characterAmount, abortSignal)
    yield rest.slice(0, characterAmount)
    rest = rest.slice(characterAmount)
    if (rest.length === 0) {
      return
    }
  }
  await wait(secondsPerCharacter * rest.length, abortSignal)
  yield rest
}

function wait(seconds: number, abortSignal: AbortSignal | undefined) {
  return new Promise<void>((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new APIUserAbortError())
    }
    const ref = setTimeout(() => {
      resolve()
      abortSignal?.removeEventListener('abort', unsubscribe)
    }, seconds * 1000)
    const unsubscribe = () => {
      clearTimeout(ref)
      reject(new APIUserAbortError())
    }
    abortSignal?.addEventListener('abort', unsubscribe)
  })
}
