import { Schema, ZodString } from 'zod'
import { Message, MessageContent, StepResponseStream } from './step.js'
import { getSchemaOptional, setSchema } from './schema/store.js'
import { buildSchemaType } from './schema/type.js'
import { isAsyncIterable } from 'aw8json'

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
  const schemaDescriptionLines: Array<string> = []
  if (!(schema instanceof ZodString)) {
    schemaDescriptionLines.push(
      '', //newline
      `Types:`,
      buildSchemaType(schema, `Response`, { prefix: `Step${stepId + 1}`, schemaTypeDefinitions, usedSchemas }),
    )
  } else if (schema.description != null) {
    schemaDescriptionLines.push(
      '', //new line
      `Response Format Description:`,
      schema.description,
    )
  }
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: [
          `# Step${stepId + 1}`,
          '', //new line
          `Instructions:`,
          prompt,
          ...(examples?.map(
            (example, index) =>
              `Example: ${index + 1}\nFor the input ${example.input} the output should be ${JSON.stringify(example.output)} ${
                example.reason != null ? `, since ${example.reason}` : ''
              }.`,
          ) ?? []),
          ...schemaDescriptionLines,
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
  'subtask-start': SubtaskStartEvent
  'data-reference-added': DataReferenceAddedEvent
  'subtask-response-referenced': SubtaskReponseReferencedEvent
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
  private cost: number | undefined = 0

  getCost() {
    return this.cost
  }

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
      throw new Error(`Step${this.currentlyExecutingStepId + 1} is still executing. Cannot write the history.`)
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
  addStepResponse(stepId: number, content: any, cost: number | undefined, schema: Schema) {
    if (this.currentlyExecutingStepId != stepId) {
      throw new Error(
        `Step-${stepId + 1} is not currently executing. Current step is ${this.currentlyExecutingStepId == null ? 'none' : this.currentlyExecutingStepId + 1}`,
      )
    }
    setSchema(content, schema)
    this.currentlyExecutingStepId = undefined
    const message: Message = { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(content) }] }
    this.messages.push(message)
    this.referenceMap.set(content, () => {
      if (this.count.steps === stepId + 1) {
        return `response of the previous step`
      }
      return `response of Step-${stepId + 1}`
    })
    this.dispatchEvent('step-response', { historyId: this.id, message, type: 'step-response' })
    this.cost = cost == null || this.cost == null ? undefined : this.cost + cost
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
          content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${toBase64(value)}` } })
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
    if (!(result instanceof Promise) && !isAsyncIterable(result)) {
      this.addSubtaskResponse(result, goal)
      return result
    }
    const wrap = async (content: any) => {
      if (this.cost != null) {
        const subtaskCost = subtaskHistory.getCost()
        this.cost = subtaskCost == null ? undefined : this.cost + subtaskCost
      }
      this.addSubtaskResponse(content, goal)
      return content
    }
    if (!isAsyncIterable(result)) {
      return result.then(wrap) as T
    }
    const stream = result as unknown as StepResponseStream<T, any>
    stream.getValue = () => stream.getValue().then(wrap) as Promise<T>
    return result
  }
}

function toBase64(buffer: unknown) {
  if (!(buffer instanceof ArrayBuffer)) {
    throw new Error(`Expected ArrayBuffer, got ${typeof buffer}`)
  }
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}
