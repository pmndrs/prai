import { APIUserAbortError } from 'openai'
import { Connection } from './connection/openai.js'
import { isData } from './data.js'
import { TaskStartEvent } from './connection/event.js'

export type Task = {
  get name(): string
  get rootName(): string
  get parentName(): string | undefined
  get goalPrompt(): () => string
  get abortSignal(): AbortSignal | undefined
  get systemPrompt(): string | undefined
} & Omit<Connection, 'addEventListener' | 'processName' | 'close'>

export type TaskOptions = {
  abortSignal?: AbortSignal
  systemPrompt?: string
  /**
   * a name for the task unique for the whole process (all tasks and subtasks in the process)
   * required for caching
   */
  name?: string
}

export async function runTask<T>(
  parentTaskOrConnection: Connection | Task,
  goalPrompt: () => string,
  fn: (task: Task) => Promise<T>,
  options?: TaskOptions,
): Promise<T> {
  const name = options?.name ?? crypto.randomUUID()
  const rootName = 'name' in parentTaskOrConnection ? parentTaskOrConnection.rootName : name
  const parentName = 'name' in parentTaskOrConnection ? parentTaskOrConnection.name : undefined
  try {
    const event: TaskStartEvent = {
      rootTaskName: rootName,
      goal: goalPrompt(),
      taskName: name,
      type: 'task-start',
      time: Date.now(),
    }
    if (parentName != null) {
      event.parentTaskName = parentName
    }
    parentTaskOrConnection.dispatchEvent('task-start', event)
    let abortSignal = options?.abortSignal
    if ('abortSignal' in parentTaskOrConnection) {
      abortSignal = AbortSignal.any(
        [parentTaskOrConnection.abortSignal, options?.abortSignal].filter((signal) => signal != null),
      )
    }
    const result = await fn({
      name,
      parentName,
      rootName,
      abortSignal,
      goalPrompt,
      query: parentTaskOrConnection.query,
      systemPrompt: options?.systemPrompt ?? parentTaskOrConnection.systemPrompt,
      dispatchEvent: parentTaskOrConnection.dispatchEvent,
    })
    if (isData(result)) {
      //TODO: write as "Result of Task x"
    }
    parentTaskOrConnection.dispatchEvent('task-finish', {
      rootTaskName: rootName,
      value: isData(result) ? result.value : result,
      taskName: name,
      type: 'task-finish',
      time: Date.now(),
    })
    return result
  } catch (e: any) {
    if (e instanceof APIUserAbortError) {
      parentTaskOrConnection.dispatchEvent('task-cancel', {
        rootTaskName: rootName,
        taskName: name,
        type: 'task-cancel',
        time: Date.now(),
      })
    } else {
      parentTaskOrConnection.dispatchEvent('task-error', {
        rootTaskName: rootName,
        error: e,
        taskName: name,
        type: 'task-error',
        time: Date.now(),
      })
    }
    throw e
  }
}
