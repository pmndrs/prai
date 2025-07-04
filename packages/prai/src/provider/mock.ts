import { APIUserAbortError } from 'openai'
import { randomInt } from '../random.js'
import { Provider } from '../model.js'
import { createSchemaMock } from '../schema/mock.js'

const charactersPerToken = 3
const tokenPerImage = 100
const tokenPerAudio = 150

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
    streamingQuery(modelName, modelPrice, modelOptions, messages, schema, abortSignal) {
      const querySeed = (options.seed ?? '') + queryCounter++
      const string = JSON.stringify(createSchemaMock(schema, querySeed))
      const inputTokens =
        messages.reduce(
          (prev, msg) =>
            prev +
            msg.content.reduce(
              (prev, entry) =>
                prev +
                (entry.type === 'image_url'
                  ? tokenPerImage * charactersPerToken
                  : entry.type === 'input_audio'
                    ? tokenPerAudio * charactersPerToken
                    : entry.text.length),
              0,
            ),
          0,
        ) / charactersPerToken
      const outputTokens = string.length / charactersPerToken
      const combinedAbortSignal = AbortSignal.any([abortSignal, options.abortSignal].filter((signal) => signal != null))
      const { startupDelaySeconds = 0.2, tokensPerSecond = 50 } = options
      const secondsPerCharacter = 1 / (tokensPerSecond * charactersPerToken)
      return split(
        startupDelaySeconds,
        secondsPerCharacter,
        string,
        modelPrice?.(inputTokens, 0, outputTokens),
        querySeed,
        combinedAbortSignal,
      )
    },
    async query(modelName, modelPrice, modelOptions, messages, schema, abortSignal) {
      let totalContent = ''
      let totalCost: number | undefined
      const stream = this.streamingQuery(modelName, modelPrice, modelOptions, messages, schema, abortSignal)
      for await (const { content, cost } of stream) {
        if (cost != null) {
          totalCost ??= 0
          totalCost += cost
        }
        totalContent += content
      }
      return { content: totalContent, cost: totalCost }
    },
  }
}

async function* split(
  startupDelaySeconds: number,
  secondsPerCharacter: number,
  content: string,
  cost: number | undefined,
  seed: string,
  abortSignal: AbortSignal,
) {
  const costPerCharacter = cost == null ? undefined : cost / content.length
  await wait(startupDelaySeconds, abortSignal)
  const splitAmount = randomInt(seed, 1, 10)
  const equalChunkSize = Math.round(content.length / splitAmount)
  let restContent = content
  for (let i = 0; i < splitAmount - 1; i++) {
    const characterAmount = randomInt(seed + i, Math.floor(equalChunkSize * 0.5), equalChunkSize * 2)
    await wait(secondsPerCharacter * characterAmount, abortSignal)
    yield {
      content: restContent.slice(0, characterAmount),
      cost: costPerCharacter == null ? undefined : characterAmount * costPerCharacter,
    }
    restContent = restContent.slice(characterAmount)
    if (restContent.length === 0) {
      return
    }
  }
  await wait(secondsPerCharacter * restContent.length, abortSignal)
  yield { content: restContent, cost: costPerCharacter == null ? undefined : restContent.length * costPerCharacter }
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
