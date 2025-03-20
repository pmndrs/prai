import { Schema } from 'zod'
import { createOrGetDataIndex, hasStepContext, startTaskContext } from './context.js'
import { Task } from './task.js'
import { buildSchemaDescription } from './schema/description.js'
import { stepResultToString } from './step.js'

export type Data<T> = {
  get name(): string
  get value(): T
  get schema(): Schema<T>
  toString(): string
}

export function isData(val: unknown): val is Data<any> {
  return val != null && typeof val === 'object' && 'value' in val && 'schema' in val && 'toString' in val
}

export class StepData<T> implements Data<T> {
  constructor(
    public readonly value: T,
    private readonly task: Task,
    private readonly stepName: string,
    private readonly prompt: () => string,
    private readonly formatDescription: string | undefined,
    private readonly _schema?: Schema<T>,
  ) {}

  get name() {
    return `${this.stepName}-result`
  }

  get schema(): Schema<T> {
    if (this._schema == null) {
      throw new Error(`step data is schemaless`)
    }
    return this._schema
  }

  toString(): string {
    if (hasStepContext()) {
      return stepResultToString(this.task, this.stepName, this.prompt, this.formatDescription, this.value)
    }
    return 'result form some previous step'
  }

  setValue<R>(value: R, schema?: Schema<R>): StepData<R> {
    return new StepData(value, this.task, this.stepName, this.prompt, this.formatDescription, schema)
  }
}

export function createStreamingStepData<T, C>(
  stream: AsyncIterable<T>,
  task: Task,
  stepUuid: string,
  prompt: () => string,
  formatDescription: string | undefined,
  waitForAll: (stream: AsyncIterable<T>) => Promise<C>,
  schema?: Schema<C>,
): StreamingStepData<T, C> {
  return Object.assign(stream, {
    async waitForAll(): Promise<Data<C>> {
      const value = await waitForAll(stream)
      return new StepData(value, task, stepUuid, prompt, formatDescription, schema)
    },
    setStream<K, R>(
      stream: AsyncIterable<K>,
      schema: Schema<R> | undefined,
      waitForAll: (stream: AsyncIterable<K>) => Promise<R>,
    ): StreamingStepData<K, R> {
      return createStreamingStepData(stream, task, stepUuid, prompt, formatDescription, waitForAll, schema)
    },
  })
}

export type StreamingStepData<T, C> = AsyncIterable<T> & {
  waitForAll(): Promise<Data<C>>
  setStream<K, R>(
    stream: AsyncIterable<K>,
    schema: Schema<R> | undefined,
    waitForAll: (stream: AsyncIterable<K>) => Promise<R>,
  ): StreamingStepData<K, R>
}

export type ImportDataOptions = {
  descriptionPrompt?: () => string
  name?: string
}

export function importImage(task: Task, buffer: ArrayBufferLike, format: string, options?: ImportDataOptions) {
  const name = options?.name ?? crypto.randomUUID()
  task.dispatchEvent('data-import', {
    rootTaskName: task.rootName,
    time: Date.now(),
    value: 'image',
    dataName: name,
    taskName: task.name,
    type: 'data-import',
  })
  const base64 = toBase64(buffer)
  return {
    name,
    value: buffer,
    get schema(): Schema<any> {
      throw new Error('image data is schemaless')
    },
    toString() {
      if (!hasStepContext()) {
        return 'imported image'
      }
      const audioIndex = createOrGetDataIndex(
        task,
        'image',
        options?.name ?? crypto.randomUUID(),
        (taskEntry, dataIndex) => {
          let resolvedDescription: string = ''
          if (options?.descriptionPrompt != null) {
            const endTaskContext = startTaskContext(task.name)
            resolvedDescription = `\nThe Image ${dataIndex + 1} shows ${options.descriptionPrompt()}`
            endTaskContext()
          }
          taskEntry.messages.push({
            role: 'user',
            content: [
              {
                type: 'text',
                text: `## Image ${dataIndex + 1}${resolvedDescription}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/${format};base64,${base64}`,
                },
              },
            ],
          })
        },
      )
      return `Image ${audioIndex + 1}`
    },
  } satisfies Data<ArrayBufferLike>
}

export function importAudio(
  task: Task,
  buffer: ArrayBufferLike,
  format: 'wav' | 'mp3',
  options?: ImportDataOptions,
): Data<ArrayBufferLike> {
  const name = options?.name ?? crypto.randomUUID()
  task.dispatchEvent('data-import', {
    rootTaskName: task.rootName,
    time: Date.now(),
    value: 'audio',
    dataName: name,
    taskName: task.name,
    type: 'data-import',
  })
  const base64 = toBase64(buffer)
  return {
    name,
    value: buffer,
    get schema(): Schema<any> {
      throw new Error('audio data is schemaless')
    },
    toString() {
      if (!hasStepContext()) {
        return 'imported audio'
      }
      const audioIndex = createOrGetDataIndex(
        task,
        'audio',
        options?.name ?? crypto.randomUUID(),
        (taskEntry, dataIndex) => {
          let resolvedDescription: string = ''
          if (options?.descriptionPrompt != null) {
            const endTaskContext = startTaskContext(task.name)
            resolvedDescription = `The audio Data ${dataIndex + 1}$ is ${options.descriptionPrompt()}`
            endTaskContext()
          }
          taskEntry.messages.push({
            role: 'user',
            content: [
              {
                type: 'text',
                text: `## Audio ${dataIndex + 1}`,
              },
              {
                type: 'input_audio',
                input_audio: {
                  format,
                  data: base64,
                },
              },
            ],
          })
        },
      )
      return `Audio ${audioIndex + 1}`
    },
  }
}

function toBase64(buffer: ArrayBufferLike) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

export function importJson<T>(
  task: Task,
  value: T,
  schema: Schema<T>,
  toString?: () => string,
  options?: ImportDataOptions,
): Data<T> {
  const name = options?.name ?? crypto.randomUUID()
  task.dispatchEvent('data-import', {
    rootTaskName: task.rootName,
    time: Date.now(),
    value: value,
    dataName: name,
    taskName: task.name,
    type: 'data-import',
  })
  return {
    schema,
    value,
    name,
    toString() {
      if (!hasStepContext()) {
        return 'imported data'
      }
      if (toString != null) {
        return toString()
      }
      let resolvedDescription: string = ''
      if (options?.descriptionPrompt != null) {
        const endTaskContext = startTaskContext(task.name)
        resolvedDescription = ` represents ${options.descriptionPrompt()} and`
        endTaskContext()
      }
      const dataIndex = createOrGetDataIndex(task, 'json', name, (taskEntry, dataIndex) => {
        taskEntry.messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `## Data ${dataIndex + 1}\nThe json Data ${
                dataIndex + 1
              }${resolvedDescription} is formatted as ${buildSchemaDescription(
                schema,
              )}.\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``,
            },
          ],
        })
      })
      return `Data ${dataIndex + 1}`
    },
  }
}

export function parseJson<T>(task: Task, data: unknown, schema: Schema<T>, representsPrompt?: () => string) {
  return importJson(task, schema.parse(data), schema, representsPrompt)
}
