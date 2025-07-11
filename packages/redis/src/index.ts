import type { createClient } from 'redis'
import { History, Message } from 'prai'

export type RedisLoggerOptions = {
  /**
   * Redis stream name to store history events (default: 'prai:history')
   */
  streamName: string

  /**
   * Stream TTL in seconds (optional - default: no expiration)
   */
  streamTTL?: number

  /**
   * Redis client instance
   */
  client: ReturnType<typeof createClient>

  /**
   * Abort signal to stop logging
   */
  abort?: AbortSignal
}

export async function redisLogger(histories: History | Array<History>, options: RedisLoggerOptions): Promise<void> {
  const { streamName, streamTTL, client, abort: abortSignal } = options

  // Helper to safely serialize messages
  const serializeMessageContent = (content: Message['content']): string => {
    try {
      return JSON.stringify(content)
    } catch (error) {
      return `[Serialization Error: ${error}]`
    }
  }

  let firstEntry = true

  // Common function to add entry to Redis stream
  const addStreamEntry = async (eventType: string, historyId: string, data: Record<string, string>) => {
    try {
      await client.xAdd(streamName, '*', {
        eventType,
        historyId,
        ...data,
      })
      if (firstEntry && streamTTL) {
        await client.expire(streamName, streamTTL)
      }
      firstEntry = false
    } catch (error) {
      console.error(`Failed to log to Redis stream: ${error}`)
    }
  }

  histories = Array.isArray(histories) ? histories : [histories]

  for (const history of histories) {
    // Register event listeners matching the console logger
    history.addEventListener(
      'step-request',
      async (event) => {
        addStreamEntry('step-request', event.historyId, {
          messageRole: event.message.role,
          messageContent: serializeMessageContent(event.message.content),
        })
      },
      { signal: abortSignal },
    )

    history.addEventListener(
      'step-response',
      (event) => {
        addStreamEntry('step-response', event.historyId, {
          messageRole: event.message.role,
          messageContent: serializeMessageContent(event.message.content),
        })
      },
      { signal: abortSignal },
    )

    history.addEventListener(
      'subtask-start',
      (event) => {
        addStreamEntry('subtask-start', event.historyId, {
          subtaskHistoryId: event.subtaskHistoryId,
        })
      },
      { signal: abortSignal },
    )

    history.addEventListener(
      'data-reference-added',
      (event) => {
        addStreamEntry('data-reference-added', event.historyId, {
          messageRole: event.message.role,
          messageContent: serializeMessageContent(event.message.content),
        })
      },
      { signal: abortSignal },
    )

    history.addEventListener(
      'subtask-response-referenced',
      (event) => {
        addStreamEntry('subtask-response-referenced', event.historyId, {
          requestMessageRole: event.requestMessage.role,
          requestMessageContent: serializeMessageContent(event.requestMessage.content),
          reponseMessageRole: event.responseMessage.role,
          reponseMessageContent: serializeMessageContent(event.responseMessage.content),
        })
      },
      { signal: abortSignal },
    )
  }
}
