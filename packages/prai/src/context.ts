import { Message } from './connection/base.js'
import { Task } from './task.js'

export type StepDependencies = Array<{
  audioDataIndices: Map<string, number>
  imageDataIndices: Map<string, number>
  jsonDataIndices: Map<string, number>
  stepIndicies: Map<string, number>
  taskUuid: string
  messages: Array<Message>
}>

export function addStepMessagesToDependencies<T>(
  task: Task,
  stepUuid: string,
  buildDependencies: () => T,
  buildMessages: (dependencies: T, taskIndex: number, stepIndex: number) => Array<Message>,
) {
  if (stepDependencies == null) {
    throw new Error(`addStepMessagesToDependencies cannot be executed here`)
  }
  let taskIndex = getTaskEntryIndex(task.name)
  let stepIndex = taskIndex == null ? undefined : stepDependencies[taskIndex].stepIndicies.get(stepUuid)
  const dependencies = stepIndex == null ? buildDependencies() : undefined
  //the task might now exist because it was created while going through the dependencies
  taskIndex ??= getTaskEntryIndex(task.name)
  taskIndex ??= createTaskEntry(task.name, task.goalPrompt())
  if (stepIndex == null) {
    const taskEntry = stepDependencies[taskIndex]
    stepIndex = taskEntry.stepIndicies.size
    taskEntry.messages.push(...buildMessages(dependencies!, taskIndex, stepIndex))
    taskEntry.stepIndicies.set(stepUuid, stepIndex)
  }
  return [taskIndex, stepIndex] as const
}

function getTaskEntry(task: Task): StepDependencies[number] {
  if (stepDependencies == null) {
    throw new Error(`getTaskEntry cannot be executed here`)
  }
  return stepDependencies[getTaskEntryIndex(task.name) ?? createTaskEntry(task.name, task.goalPrompt())]
}

function getTaskEntryIndex(taskUuid: string): number | undefined {
  if (stepDependencies == null) {
    throw new Error(`getTaskEntryIndex cannot be executed here`)
  }
  let taskIndex = stepDependencies.findIndex((taskEntry) => taskEntry.taskUuid === taskUuid)
  return taskIndex === -1 ? undefined : taskIndex
}

function createTaskEntry(uuid: string, goal: string): number {
  if (stepDependencies == null) {
    throw new Error(`createTaskEntry cannot be executed here`)
  }
  const taskIndex = stepDependencies.length
  stepDependencies.push({
    jsonDataIndices: new Map(),
    audioDataIndices: new Map(),
    imageDataIndices: new Map(),
    stepIndicies: new Map(),
    taskUuid: uuid,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `# Task ${taskIndex + 1}\n${goal != null ? `The goal is to ${goal}` : ''}`,
          },
        ],
      },
    ],
  })
  return taskIndex
}

let currentTaskUuid: string | undefined
export function getCurrentTaskUuid(): string {
  if (currentTaskUuid == null) {
    throw new Error('getCurrentTaskUuid cannot be executed here')
  }
  return currentTaskUuid
}

export function startTaskContext(taskUuid: string): () => void {
  const previousTaskUuid = getCurrentTaskUuid()
  currentTaskUuid = taskUuid
  return () => {
    currentTaskUuid = previousTaskUuid
  }
}

export function hasStepContext(): boolean {
  return currentTaskUuid != null
}

let stepDependencies: StepDependencies | undefined
export function startStepContext(taskUuid: string): () => StepDependencies {
  if (currentTaskUuid != null || stepDependencies != null) {
    throw new Error('startStepContext cannot be executed here')
  }
  const result: StepDependencies = []
  currentTaskUuid = taskUuid
  stepDependencies = result
  return () => {
    currentTaskUuid = undefined
    stepDependencies = undefined
    return result
  }
}

export function createOrGetDataIndex(
  task: Task,
  type: 'json' | 'audio' | 'image',
  dataUuid: string,
  onCreate: (taskEntry: StepDependencies[number], dataIndex: number) => void,
) {
  const taskEntry = getTaskEntry(task)
  const map = taskEntry[`${type}DataIndices`]
  let dataIndex = map.get(dataUuid)
  if (dataIndex == null) {
    dataIndex = map.size
    onCreate(taskEntry, dataIndex)
    map.set(dataUuid, dataIndex)
  }
  return dataIndex
}
