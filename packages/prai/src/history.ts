import { Schema } from 'zod'
import { isStepResponse, Message, MessageContent, wrapStepResponse } from './step.js'
import { getSchemaOptional, setSchema } from './schema/store.js'
import { buildSchemaType } from './schema/type.js'
import { isAsyncIterable } from 'awaitjson'

export function buildStepRequestMessage(
  stepId: number,
  prompt: string,
  schema: Schema,
  schemaTypeDefinitions: Map<Schema, string>,
  usedSchemas: Set<Schema>,
  examples?: Array<{
    input: any
    output: any
    reason?: string
  }>,
): Message {
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: [
          `# Step${stepId + 1}`,
          `Instructions:`,
          prompt,
          ...(examples?.map(
            (example, index) =>
              `Example: ${index + 1}\nFor the input ${example.input} the output should be ${JSON.stringify(example.output)} ${
                example.reason != null ? `, since ${example.reason}` : ''
              }.`,
          ) ?? []),
          `Types:`,
          buildSchemaType(schema, `Response`, { prefix: `Step${stepId + 1}`, schemaTypeDefinitions, usedSchemas }),
        ].join('\n'),
      },
    ],
  }
}

export type HistoryAddOptions<T> = {
  derived?: { from: unknown; by?: string }
  description?: string
  text?: string
  schema?: Schema<T>
  /**
   * @default data
   */
  type?: 'image' | 'wav' | 'mp3' | 'data'
}

export type BuildReference = () => string

export type EventMap = {
  'step-request': StepRequestEvent
  'step-response': StepResponseEvent
  'step-error': StepErrorEvent
  'subtask-start': SubtaskStartEvent
  'data-reference-added': DataReferenceAddedEvent
  'subtask-response-referenced': SubtaskReponseReferencedEvent
  'history-forgot': HistoryForgotEvent
}

export type StepRequestEvent = {
  type: 'step-request'
  historyId: string
  message: Message
}

export type StepResponseEvent = {
  type: 'step-response'
  historyId: string
  message: Message
}

export type StepErrorEvent = {
  type: 'step-error'
  historyId: string
  error: string
}

export type SubtaskStartEvent = {
  type: 'subtask-start-event'
  historyId: string
  subtaskHistoryId: string
}

export type DataReferenceAddedEvent = {
  type: 'data-reference-added'
  historyId: string
  message: Message
}

export type SubtaskReponseReferencedEvent = {
  type: 'subtask-response-referenced'
  historyId: string
  requestMessage: Message
  responseMessage: Message
}

export type HistoryForgotEvent = {
  type: 'history-forgot'
  historyId: string
}

export type HistoryState = {
  messageList: Array<Message>
  referenceMap: Map<unknown, string | BuildReference>
  subtaskCount: number
  dataCount: number
  audioCount: number
  imageCount: number
  stepCount: number
  currentlyExecutingStepId: number | undefined
  schemaTypeDefinitions: Map<Schema, string>
  usedSchemas: Set<Schema>
}

export class History {
  public readonly id = crypto.randomUUID()
  private readonly subscriptionMap = new Map<string, Set<(data: any) => void>>()

  //stateful part
  private currentlyExecutingStepId: number | undefined
  private messages: Array<Message> = []
  private referenceMap = new Map<unknown, string | BuildReference>()
  private count = { subtasks: 0, datas: 0, images: 0, audios: 0, steps: 0 }
  private schemaTypeDefinitions = new Map<Schema, string>()
  private usedSchemas = new Set<Schema>()

  //TODO: modify the state so its fully serializeable and deserializable with json
  getState() {
    if (this.currentlyExecutingStepId != null) {
      throw new Error(`Step${this.currentlyExecutingStepId + 1} is still executing. Cannot get history state.`)
    }
    return {
      messages: [...this.messages],
      count: { ...this.count },
      referenceMap: Array.from(this.referenceMap.entries()),
      schemaTypeDefinitions: Array.from(this.schemaTypeDefinitions.entries()),
      usedSchemas: Array.from(this.usedSchemas),
    }
  }

  setState(state: ReturnType<History['getState']>): void {
    if (this.currentlyExecutingStepId != null) {
      throw new Error(`Step${this.currentlyExecutingStepId + 1} is still executing. Cannot forget history.`)
    }
    this.messages = [...state.messages]
    this.referenceMap = new Map(state.referenceMap)
    this.schemaTypeDefinitions = new Map(state.schemaTypeDefinitions)
    this.usedSchemas = new Set(state.usedSchemas)
    this.count = { ...state.count }
  }

  addEventListener<Type extends keyof EventMap>(
    type: Type,
    cb: (data: EventMap[Type]) => void,
    options?: { signal?: AbortSignal },
  ): void {
    if (options?.signal?.aborted) {
      return
    }
    let entries = this.subscriptionMap.get(type)
    if (entries == null) {
      this.subscriptionMap.set(type, (entries = new Set()))
    }
    entries.add(cb)
    options?.signal?.addEventListener('abort', () => entries.delete(cb))
  }

  private dispatchEvent<Type extends keyof EventMap>(type: Type, data: EventMap[Type]): void {
    const subscriptions = this.subscriptionMap.get(type)
    if (subscriptions == null) {
      return
    }
    for (const subscription of subscriptions) {
      subscription(data)
    }
  }

  /**
   * @deprecated used internally
   */
  addStepRequest(
    prompt: string,
    schema: Schema,
    examples?: Array<{ input: any; output: any; reason?: string }>,
  ): number {
    if (this.currentlyExecutingStepId != null) {
      throw new Error(`Step ${this.currentlyExecutingStepId + 1} is still executing. Cannot start a new step.`)
    }
    const stepId = (this.currentlyExecutingStepId = this.count.steps++)
    const message = buildStepRequestMessage(
      stepId,
      prompt,
      schema,
      this.schemaTypeDefinitions,
      this.usedSchemas,
      examples,
    )
    this.messages.push(message)
    this.dispatchEvent('step-request', { type: 'step-request', historyId: this.id, message })
    return stepId
  }

  /**
   * @deprecated used internally
   */
  async addStepResponse(stepId: number, promise: Promise<any>, schema: Schema): Promise<any> {
    //order is important! "await promise" must be executed first
    const value = await promise.catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.dispatchEvent('step-error', { type: 'step-error', historyId: this.id, error: errorMessage })
      return Promise.reject(error)
    })
    if (this.currentlyExecutingStepId != stepId) {
      throw new Error(
        `Step-${stepId + 1} is not currently executing. Current step is ${this.currentlyExecutingStepId == null ? 'none' : this.currentlyExecutingStepId + 1}`,
      )
    }
    setSchema(value, schema)
    this.currentlyExecutingStepId = undefined
    const message: Message = { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(value) }] }
    this.messages.push(message)
    this.referenceMap.set(value, () => {
      if (this.count.steps === stepId + 1) {
        return `response of the previous step`
      }
      return `response of Step-${stepId + 1}`
    })
    this.dispatchEvent('step-response', { historyId: this.id, message, type: 'step-response' })
    return value
  }

  private addSubtaskResponse(value: unknown, goal: string) {
    let subtaskId: number | undefined
    const buildReference: BuildReference = () => {
      if (this.currentlyExecutingStepId != null) {
        throw new Error(`Cannot build reference while a step is currently executing`)
      }
      if (subtaskId == null) {
        subtaskId = this.count.subtasks++
        const schema = getSchemaOptional(value)
        const userTextLines: Array<string> = [`# Subtask${subtaskId + 1}`, `Goal: ${goal}`]
        if (schema != null) {
          userTextLines.push(
            'Types:',
            buildSchemaType(schema, `Response`, {
              prefix: `Subtask${subtaskId + 1}`,
              schemaTypeDefinitions: this.schemaTypeDefinitions,
              usedSchemas: this.usedSchemas,
            }),
          )
        }
        const requestMessage: Message = { role: 'user', content: [{ type: 'text', text: userTextLines.join('\n') }] }
        const responseMessage: Message = { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(value) }] }
        this.messages.push(requestMessage, responseMessage)
        this.dispatchEvent('subtask-response-referenced', {
          type: 'subtask-response-referenced',
          historyId: this.id,
          requestMessage,
          responseMessage,
        })
      }
      if (subtaskId + 1 == this.count.subtasks) {
        return `response of the previous subtask`
      }
      return `response of Subtask${subtaskId + 1}`
    }
    this.referenceMap.set(value, buildReference)
  }

  forget(): void {
    this.setState({
      count: { audios: 0, datas: 0, images: 0, steps: 0, subtasks: 0 },
      messages: [],
      referenceMap: [],
      schemaTypeDefinitions: [],
      usedSchemas: [],
    })
    this.dispatchEvent('history-forgot', { type: 'history-forgot', historyId: this.id })
  }

  /**
   * @param options options are used when to add the value to the history if not yet present as a reference
   */
  reference<T>(value: T, options: HistoryAddOptions<T> = {}): string {
    if (isAsyncIterable(value)) {
      throw new Error(`Cannot reference an async iterable value directly. Use await result.getValue() instead.`)
    }
    if (value instanceof Promise) {
      throw new Error(`Cannot reference a Promise value directly. Use await to resolve the Promise first.`)
    }
    let reference = this.referenceMap.get(value)
    if (reference == null) {
      return this.add(value, options)
    }
    if (typeof reference === 'function') {
      this.referenceMap.set(value, (reference = reference()))
    }
    return reference
  }

  /**
   * @returns the reference
   */
  add<T>(value: T, options: HistoryAddOptions<T> = {}): string {
    if (this.referenceMap.has(value)) {
      throw new Error(`Value already exists in history`)
    }
    let text = options.text
    if (text == null) {
      let fileType = options.type ?? 'data'
      const resourceType = fileType == 'mp3' || fileType === 'wav' ? 'audio' : fileType
      const resourceId = this.count[`${resourceType}s`]++
      text = `${resourceType[0].toUpperCase()}${resourceType.slice(1)}${resourceId + 1}`
      const contentTexts: Array<string> = [`# ${text}`]
      if (options.description != null) {
        contentTexts.push(`Description: ${options.description}`)
      }
      if (options.schema != null) {
        contentTexts.push(
          'Types:',
          buildSchemaType(options.schema, 'Format', {
            prefix: text,
            schemaTypeDefinitions: this.schemaTypeDefinitions,
            usedSchemas: this.usedSchemas,
          }),
        )
      }
      const content: MessageContent = [{ type: 'text', text: contentTexts.join('\n') }]
      switch (fileType) {
        case 'wav':
        case 'mp3':
          content.push({ type: 'input_audio', input_audio: { data: toBase64(value), format: fileType } })
          break
        case 'image':
          content.push({ type: 'image_url', image_url: { url: `data:image/${fileType};base64,${toBase64(value)}` } })
          break
        case 'data':
          content.push({ type: 'text', text: JSON.stringify(value) })
          break
      }
      const message: Message = {
        role: 'user',
        content,
      }
      this.messages.push(message)
      this.dispatchEvent('data-reference-added', { type: 'data-reference-added', historyId: this.id, message })
    }
    this.referenceMap.set(value, text)
    return text
  }

  clone(): History {
    const result = new History()
    result.copy(this)
    return result
  }

  copy(from: History) {
    this.setState(from.getState())
  }

  /**
   * allows to execute steps that are not added to the history except for the result with its description
   * @param resultDescription should describe the result
   * @param fn is the function that produces the result providing a internal history that must be used by the steps executed insideht the fn
   * internal steps can be executed in parallel
   */
  subtask<T>(goal: string, fn: (internalHistory: History) => T): T {
    const subtaskHistory = this.clone()
    this.dispatchEvent('subtask-start', {
      type: 'subtask-start-event',
      historyId: this.id,
      subtaskHistoryId: subtaskHistory.id,
    })
    const result = fn(subtaskHistory)
    if (!isStepResponse(result)) {
      this.addSubtaskResponse(result, goal)
      return result
    }
    return wrapStepResponse(result, async (promise) => {
      const value = await promise
      //order is important! "await promise" must be executed first
      this.addSubtaskResponse(value, goal)
      return value
    }) as T
  }
}

function toBase64(buffer: unknown) {
  if (!(buffer instanceof ArrayBuffer)) {
    throw new Error(`Expected ArrayBuffer, got ${typeof buffer}`)
  }
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}
