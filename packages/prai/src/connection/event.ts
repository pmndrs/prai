import type { Connection, Message } from './openai.js'

export type PraiEventMap = {
  'data-import': DataImportEvent
  'task-start': TaskStartEvent
  'task-finish': TaskFinishEvent
  'task-cancel': TaskCancelEvent
  'task-error': TaskErrorEvent
  'query-start': QueryStartEvent
  'query-finish': QueryFinishEvent
  'query-cancel': QueryCancelEvent
  'query-error': QueryErrorEvent
}

export type DataImportEvent = {
  type: 'data-import'
  rootTaskName: string
  taskName: string
  dataName: string
  time: number
  value: unknown
}

// Task events
export type TaskStartEvent = {
  type: 'task-start'
  rootTaskName: string
  parentTaskName?: string
  taskName: string
  goal: string
  time: number
}

export type TaskFinishEvent = {
  type: 'task-finish'
  rootTaskName: string
  taskName: string
  time: number
  value: unknown
}

export type TaskCancelEvent = {
  type: 'task-cancel'
  rootTaskName: string
  taskName: string
  time: number
}

export type TaskErrorEvent = {
  type: 'task-error'
  rootTaskName: string
  taskName: string
  time: number
  error: unknown
}

// Query events
export type QueryStartEvent = {
  type: 'query-start'
  rootTaskName: string
  queryName: string
  taskName: string
  time: number
  messages: Array<Message>
}

export type QueryFinishEvent = {
  type: 'query-finish'
  rootTaskName: string
  queryName: string
  time: number
  value: unknown
}

export type QueryCancelEvent = {
  type: 'query-cancel'
  rootTaskName: string
  queryName: string
  time: number
}

export type QueryErrorEvent = {
  type: 'query-error'
  rootTaskName: string
  queryName: string
  time: number
  error: unknown
}

export interface EventEmitter {
  addEventListener<Type extends keyof PraiEventMap>(
    type: Type,
    cb: (data: PraiEventMap[Type]) => void,
    options?: { signal?: AbortSignal },
  ): void

  dispatchEvent<Type extends keyof PraiEventMap>(type: Type, data: PraiEventMap[Type]): void
}

export function buildEventEmitter(): EventEmitter {
  const subscriptionMap = new Map<string, Set<(data: any) => void>>()
  const dispatchEvent: EventEmitter['dispatchEvent'] = (type, data) => {
    const subscriptions = subscriptionMap.get(type)
    if (subscriptions == null) {
      return
    }
    for (const subscription of subscriptions) {
      subscription(data)
    }
  }
  const addEventListener: EventEmitter['addEventListener'] = (type, cb, options) => {
    if (options?.signal?.aborted) {
      return
    }
    let entries = subscriptionMap.get(type)
    if (entries == null) {
      subscriptionMap.set(type, (entries = new Set()))
    }
    entries.add(cb)
    options?.signal?.addEventListener('abort', () => entries.delete(cb))
  }
  return { dispatchEvent, addEventListener }
}

export function watchQuery(
  rootTaskName: string,
  taskName: string,
  queryName: string,
  messages: Array<Message>,
  input: Promise<string> | AsyncIterable<string>,
  dispatchEvent: EventEmitter['dispatchEvent'],
) {
  dispatchEvent('query-start', {
    queryName,
    taskName,
    rootTaskName,
    type: 'query-start',
    messages,
    time: Date.now(),
  })
  return input instanceof Promise
    ? watchQueryPromise(rootTaskName, queryName, input, dispatchEvent)
    : watchQueryAsyncIterable(rootTaskName, queryName, input, dispatchEvent)
}

async function watchQueryPromise(
  rootTaskName: string,
  queryName: string,
  input: Promise<string>,
  dispatchEvent: EventEmitter['dispatchEvent'],
): Promise<string> {
  try {
    const result = await input
    dispatchEvent('query-finish', {
      rootTaskName,
      type: 'query-finish',
      queryName,
      value: result,
      time: Date.now(),
    })
    return result
  } catch (e: any) {
    onQueryError(rootTaskName, queryName, e, dispatchEvent)
    throw e
  }
}

async function* watchQueryAsyncIterable(
  rootTaskName: string,
  queryName: string,
  input: AsyncIterable<string>,
  dispatchEvent: EventEmitter['dispatchEvent'],
): AsyncIterable<string> {
  try {
    let result = ''
    for await (const chunk of input) {
      result += chunk
      yield chunk
    }
    dispatchEvent('query-finish', {
      queryName,
      value: result,
      rootTaskName,
      type: 'query-finish',
      time: Date.now(),
    })
    return result
  } catch (e: any) {
    onQueryError(rootTaskName, queryName, e, dispatchEvent)
    throw e
  }
}

function onQueryError(
  rootTaskName: string,
  queryName: string,
  error: any,
  dispatchEvent: EventEmitter['dispatchEvent'],
) {
  dispatchEvent('query-error', {
    rootTaskName,
    type: 'query-error',
    error,
    queryName,
    time: Date.now(),
  })
}
