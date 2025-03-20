import { create } from 'zustand'
import type { StringifiedPraiEvent } from 'prai-redis'
import { produce } from 'immer'
import { Message } from 'prai'

// Define the structure of our Task type
export type Task = {
  name: string
  goal: string
  startTime: number
  endTime?: number
  status: 'running' | 'finished' | 'cancelled' | 'error'
  value?: any
  error?: any
  queries: Record<string, Query>
  subtasks: Record<string, Task>
  dataImports: Record<string, DataImport>
}

// Define the structure of our Query type
export type Query = {
  name: string
  taskName: string
  startTime: number
  endTime?: number
  status: 'running' | 'finished' | 'cancelled' | 'error'
  messages: Array<any>
  value?: any
  error?: any
}

// Define the structure of our DataImport type
export type DataImport = {
  id: string
  name: string
  time: number
  data: any
  taskName?: string
  status: 'imported'
}

// Selected item can be either a Task or Query
export type SelectedItem = {
  type: 'task' | 'query' | 'data'
  item: Task | Query | DataImport
}

// Generic type for items that have start and end times
type TimeItem = {
  startTime: number
  endTime?: number
}

// Generic function to find non-overlapping rows of time-based items
function getNonOverlappingRows<T extends TimeItem>(items: T[]): T[][] {
  // Sort items by start time
  const sortedItems = [...items].sort((a, b) => a.startTime - b.startTime)
  const rows: T[][] = []

  outer: for (const item of sortedItems) {
    // Try to place the item in an existing row
    for (const row of rows) {
      const canPlaceInRow = row.every((existingItem) => {
        // Check if items overlap
        const existingEnd = existingItem.endTime || existingItem.startTime
        const itemEnd = item.endTime || item.startTime
        // Allow items to be placed in the same row when one starts exactly when another ends
        return existingEnd <= item.startTime || existingItem.startTime >= itemEnd
      })

      if (canPlaceInRow) {
        row.push(item)
        continue outer
      }
    }

    // If we couldn't place the item in any existing row, create a new row
    rows.push([item])
  }

  return rows
}

// Define our store's state structure
interface PRaiState {
  tasks: Record<string, Task>
  selectedItem: SelectedItem | null
  // Actions to update the store
  processEvent: (event: StringifiedPraiEvent) => void
  reset: () => void
  setSelectedItem: (item: SelectedItem | null) => void
  // Selectors
  getNonOverlappingMixedRows: (task: Task) => (Task | Query)[][]
  getTaskByName(taskName: string): Task | undefined
  getTaskDataImports(taskName: string): DataImport[]
}

// Create the store
export const usePRaiStore = create<PRaiState>((set, get) => ({
  tasks: {},
  selectedItem: null,

  setSelectedItem: (item) => set({ selectedItem: item }),

  processEvent: (event) => {
    // Helper function that searches for a task by name and, if found, applies an update to it
    const updateTaskByName = (taskName: string, updater: (task: Task) => void) => {
      set(
        produce((state) => {
          // Check if it's a top-level task
          if (state.tasks[taskName]) {
            updater(state.tasks[taskName])
            return
          }

          // Check if it's a subtask
          for (const parentName in state.tasks) {
            const parentTask = state.tasks[parentName]
            if (parentTask.subtasks[taskName]) {
              updater(parentTask.subtasks[taskName])
              return
            }
          }
        }),
      )
    }

    // Helper function to find and update a query within a task
    const updateQueryByName = (queryName: string, updater: (query: Query) => void) => {
      // Helper function to recursively search for a query in tasks and subtasks
      const findAndUpdateQuery = (tasks: Record<string, Task>): boolean => {
        // Check all tasks at this level
        for (const taskName in tasks) {
          const task = tasks[taskName]

          // Check if this task has the query
          if (task.queries[queryName]) {
            updater(task.queries[queryName])
            return true
          }

          // Recursively check subtasks
          if (findAndUpdateQuery(task.subtasks)) {
            return true
          }
        }

        return false
      }

      // Execute the search and update in a single produce call
      set(
        produce((state) => {
          findAndUpdateQuery(state.tasks)
        }),
      )
    }

    // Process events using the helper functions
    switch (event.type) {
      case 'data-import': {
        // Handle data import event
        set(
          produce((state) => {
            // Only add to task if taskName is provided
            if (event.taskName) {
              const importId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
              const dataImport = {
                id: importId,
                name: event.dataName || 'Data Import',
                time: Number(event.time),
                data: event.value,
                taskName: event.taskName,
                status: 'imported' as const,
              }

              // Find the task (could be top-level or subtask)
              const task = findTaskByName(state.tasks, event.taskName)
              if (task) {
                task.dataImports[importId] = dataImport
              }
            }
          }),
        )
        break
      }

      case 'task-start': {
        const parentName = event.parentTaskName
        // Handle the renamed field with type assertion
        const taskEvent = event

        const newTask = {
          name: taskEvent.taskName,
          // Use goal if available, otherwise fall back to prompt for backward compatibility
          goal: taskEvent.goal,
          startTime: Number(taskEvent.time),
          status: 'running' as const,
          queries: {},
          subtasks: {},
          dataImports: {},
        }

        // If this is a subtask, add it to the parent
        if (parentName) {
          set(
            produce((state) => {
              if (state.tasks[parentName]) {
                state.tasks[parentName].subtasks[event.taskName] = newTask
              }
            }),
          )
        } else {
          // Otherwise, add it as a top-level task
          set(
            produce((state) => {
              state.tasks[event.taskName] = newTask
            }),
          )
        }
        break
      }

      case 'task-finish': {
        updateTaskByName(event.taskName, (task: Task) => {
          task.status = 'finished'
          task.endTime = Number(event.time)
          task.value = event.value
        })
        break
      }

      case 'task-cancel': {
        updateTaskByName(event.taskName, (task: Task) => {
          task.status = 'cancelled'
          task.endTime = Number(event.time)
        })
        break
      }

      case 'task-error': {
        updateTaskByName(event.taskName, (task: Task) => {
          task.status = 'error'
          task.endTime = Number(event.time)
          task.error = event.error
        })
        break
      }

      case 'query-start': {
        // Ensure messages is always an array

        updateTaskByName(event.taskName, (task: Task) => {
          task.queries[event.queryName] = {
            name: event.queryName,
            taskName: event.taskName,
            startTime: Number(event.time),
            status: 'running',
            messages: JSON.parse(event.messages) as Array<Message>,
          }
        })
        break
      }

      case 'query-finish': {
        updateQueryByName(event.queryName, (query: Query) => {
          query.status = 'finished'
          query.endTime = Number(event.time)
          query.value = event.value
        })
        break
      }

      case 'query-cancel': {
        updateQueryByName(event.queryName, (query: Query) => {
          query.status = 'cancelled'
          query.endTime = Number(event.time)
        })
        break
      }

      case 'query-error': {
        updateQueryByName(event.queryName, (query: Query) => {
          query.status = 'error'
          query.endTime = Number(event.time)
          query.error = event.error
        })
        break
      }
    }
  },

  reset: () => set({ tasks: {} }),

  // Selectors
  getTaskByName: (taskName) => {
    const state = get()
    return findTaskByName(state.tasks, taskName)
  },

  // Get data imports for a specific task
  getTaskDataImports: (taskName) => {
    const task = get().getTaskByName(taskName)
    if (!task) {
      return []
    }
    return Object.values(task.dataImports)
  },

  // New selector that combines subtasks and queries for a given task
  getNonOverlappingMixedRows: (task: Task) => {
    // Combine subtasks and queries into a single array
    const subtasks = Object.values(task.subtasks)
    const queries = Object.values(task.queries)
    const combinedItems = [...subtasks, ...queries] as (Task | Query)[]

    return getNonOverlappingRows(combinedItems)
  },
}))

// Helper function to find a task by name (returns the task object or undefined)
function findTaskByName(tasks: Record<string, Task>, taskName: string): Task | undefined {
  // Check if it's a top-level task
  if (tasks[taskName]) {
    return tasks[taskName]
  }

  // Check if it's a subtask
  for (const parentName in tasks) {
    const parentTask = tasks[parentName]
    if (parentTask.subtasks[taskName]) {
      return parentTask.subtasks[taskName]
    }
  }

  return undefined
}
