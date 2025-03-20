import { PraiEventMap } from 'prai'
import { RedisClientType } from 'redis'

export type StringifiedPraiEvent = {
  [Key in keyof PraiEventMap]: {
    [InnerKey in keyof PraiEventMap[Key]]: PraiEventMap[Key][InnerKey] extends string
      ? PraiEventMap[Key][InnerKey]
      : string
  }
}[keyof PraiEventMap]

export async function* readPraiEvents(
  subClient: RedisClientType,
  nonSubClient: RedisClientType,
  rootTaskName: string,
  options?: { abort?: AbortSignal },
): AsyncIterable<StringifiedPraiEvent> {
  let stopWait: (() => void) | undefined
  let dontWait = false
  const channel = `${rootTaskName}-event`
  const listener = () => {
    dontWait = true
    stopWait?.()
  }
  subClient.subscribe(channel, listener)
  const unsubscribe = () => void subClient.unsubscribe(channel, listener)
  options?.abort?.addEventListener('abort', () => {
    stopWait?.()
    unsubscribe()
  })
  while (!options?.abort?.aborted) {
    dontWait = false
    let prevId = '0'
    const existingEntries = (await nonSubClient.xRead({ id: prevId, key: rootTaskName }))?.[0].messages
    if (existingEntries != null && existingEntries.length > 0) {
      for (const entry of existingEntries) {
        const { message } = entry as unknown as {
          message: StringifiedPraiEvent
        }
        yield message
        if (
          (message.type === 'task-error' || message.type === 'task-cancel' || message.type === 'task-finish') &&
          message.taskName === rootTaskName
        ) {
          unsubscribe()
          return
        }
      }
      prevId = existingEntries[existingEntries.length - 1].id
    }
    //wait for needs read
    await new Promise<void>((resolve) => {
      if (dontWait) {
        //immediately read
        resolve()
      }
      stopWait = resolve
    })
    stopWait = undefined
  }
}
