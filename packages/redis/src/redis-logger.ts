import { Connection } from 'prai'
import { RedisClientType } from 'redis'

export function redisLogger(nonSubClient: RedisClientType, connection: Connection, options?: { abort?: AbortSignal }) {
  const abortSignal = options?.abort

  // Helper function to convert any value to a string safe for Redis
  const safeStringify = (value: any): string => {
    if (typeof value === 'string') {
      return value
    }
    try {
      return JSON.stringify(value)
    } catch (e) {
      return String(value)
    }
  }

  const notify = (key: string, eventType: string) => {
    nonSubClient.publish(`${key}-event`, eventType)
  }

  connection.addEventListener(
    'data-import',
    (event) => {
      nonSubClient.xAdd(event.rootTaskName, '*', {
        ...event,
        time: String(event.time),
        value: safeStringify(event.value),
      })
      notify(event.rootTaskName, event.type)
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'task-start',
    (event) => {
      nonSubClient.xAdd(event.rootTaskName, '*', {
        ...event,
        time: String(event.time),
      })
      notify(event.rootTaskName, event.type)
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'task-finish',
    (event) => {
      nonSubClient.xAdd(event.rootTaskName, '*', {
        ...event,
        time: String(event.time),
        value: safeStringify(event.value),
      })
      notify(event.rootTaskName, event.type)
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'task-cancel',
    (event) => {
      nonSubClient.xAdd(event.rootTaskName, '*', {
        ...event,
        time: String(event.time),
      })
      notify(event.rootTaskName, event.type)
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'task-error',
    (event) => {
      nonSubClient.xAdd(event.rootTaskName, '*', {
        ...event,
        time: String(event.time),
        error: safeStringify(event.error),
      })
      notify(event.rootTaskName, event.type)
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'query-start',
    (event) => {
      nonSubClient.xAdd(event.rootTaskName, '*', {
        ...event,
        time: String(event.time),
        messages: JSON.stringify(event.messages),
      })
      notify(event.rootTaskName, event.type)
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'query-finish',
    (event) => {
      nonSubClient.xAdd(event.rootTaskName, '*', {
        ...event,
        time: String(event.time),
        value: safeStringify(event.value),
      })
      notify(event.rootTaskName, event.type)
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'query-cancel',
    (event) => {
      nonSubClient.xAdd(event.rootTaskName, '*', {
        ...event,
        time: String(event.time),
      })
      notify(event.rootTaskName, event.type)
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'query-error',
    (event) => {
      nonSubClient.xAdd(event.rootTaskName, '*', {
        ...event,
        time: String(event.time),
        error: safeStringify(event.error),
      })
      notify(event.rootTaskName, event.type)
    },
    { signal: abortSignal },
  )
}
