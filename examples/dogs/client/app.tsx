import { useState, useEffect, useMemo, CSSProperties, useRef, ReactNode } from 'react'
import type { StringifiedPraiEvent } from '@prai/redis'
import { decodeAsyncJson } from 'prai'
import { usePRaiStore } from './store.js'
import type { Task, Query, DataImport } from './store'

// Define the dog input type
interface DogInput {
  gender: string
  heightInMeter: number
}

// TaskTimeline component that displays a hierarchical view of tasks and their subtasks/queries
function TaskTimeline({ rootTaskName }: { rootTaskName: string }) {
  const state = usePRaiStore()
  const allTasks = Object.values(state.tasks)
  // Force re-render on tick
  const [tick, setTick] = useState(0)

  // Update while tasks are running
  useEffect(() => {
    const hasRunningTasks = allTasks.some(
      (task) =>
        task.status === 'running' ||
        Object.values(task.subtasks).some((subtask) => subtask.status === 'running') ||
        Object.values(task.queries).some((query) => query.status === 'running'),
    )

    if (hasRunningTasks) {
      const interval = setInterval(() => setTick((t) => t + 1), 50)
      return () => clearInterval(interval)
    }
  }, [allTasks])

  const rootTask = state.getTaskByName(rootTaskName)
  if (rootTask == null) {
    return null
  }

  // Get the current time for running tasks
  const now = Date.now()
  const timeRange = {
    start: rootTask.startTime,
    end: rootTask.endTime ?? now,
  }

  return (
    <div className="rounded-lg h-full p-4 bg-background flex-col flex">
      {/* Timeline ruler with markers */}
      <TimelineRuler timeRange={timeRange} />

      {/* Timeline content - root task doesn't have a parent */}
      <TaskTree task={rootTask} now={now} />

      <TaskQueryDataDetails />
    </div>
  )
}

// Shared utility functions for details components
const formatName = (name: string) => {
  // Check if name is a UUID (simple check for UUID format)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidPattern.test(name)) {
    return '' // Don't display UUIDs
  }
  return name
}

// Format JSON data for better display
const formatJsonValue = (value: any) => {
  try {
    // If it's already a string, parse it first to ensure it's valid JSON
    const jsonObj = typeof value === 'string' ? JSON.parse(value) : value
    return <pre className="mt-1 p-2 bg-muted overflow-y-auto rounded text-xs">{JSON.stringify(jsonObj, null, 2)}</pre>
  } catch (e) {
    // If it's not valid JSON, just display as string
    return <span>{JSON.stringify(value)}</span>
  }
}

// Format timestamps in a more readable way
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Shared header component for all detail views
function DetailsHeader({
  title,
  subtitle,
  status,
  parentTask,
  onClose,
}: {
  title: string
  subtitle?: string
  status?: string
  parentTask?: Task
  onClose: () => void
}) {
  const state = usePRaiStore()

  return (
    <div className="flex justify-between items-start mb-4">
      <div>
        <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-4">
          <div className="flex items-center gap-2">
            {status && (
              <span
                className={`inline-block w-3 h-3 rounded-full ${
                  status === 'error'
                    ? 'bg-destructive'
                    : status === 'cancelled'
                    ? 'bg-warning'
                    : status === 'running'
                    ? 'bg-primary animate-pulse'
                    : 'bg-primary'
                }`}
              ></span>
            )}
            <span>
              {title}
              {subtitle && `: ${subtitle}`}
            </span>
          </div>
          {parentTask && (
            <button
              className="inline-flex cursor-pointer items-center gap-1 px-2 py-1 text-xs font-medium text-secondary-foreground bg-secondary rounded-md hover:bg-secondary/90 focus:outline-none focus:ring-1 focus:ring-secondary/50 focus:ring-offset-1 transition-colors duration-200"
              onClick={() =>
                state.setSelectedItem({
                  type: 'task',
                  item: parentTask,
                })
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3 h-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              View Parent Task
            </button>
          )}
        </h3>
        {status && (
          <p className="text-sm text-muted-foreground">
            Status: <span className="capitalize">{status}</span>
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:text-destructive cursor-pointer"
        aria-label="Close details"
      >
        ✕
      </button>
    </div>
  )
}

// Shared timing information component
function TimingInfo({ startTime, endTime }: { startTime?: number; endTime?: number }) {
  if (!startTime) return null

  // Calculate duration if both start and end times exist
  const getDuration = () => {
    if (startTime && endTime) {
      const duration = endTime - startTime
      const seconds = Math.floor(duration / 1000)
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60

      if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`
      }
      return `${seconds}s`
    }
    return null
  }

  const duration = getDuration()

  return (
    <div className="flex flex-wrap gap-4 mb-3 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
      <div>
        <span className="font-medium">Time:</span> {formatTime(startTime)}
      </div>
      {endTime && (
        <div>
          <span className="font-medium">Ended:</span> {formatTime(endTime)}
        </div>
      )}
      {duration && (
        <div>
          <span className="font-medium">Duration:</span> {duration}
        </div>
      )}
    </div>
  )
}

// Task details component
function TaskDetails({ task }: { task: Task }) {
  const state = usePRaiStore()

  // Find parent task
  const getParentTask = () => {
    // Check all top-level tasks
    for (const parentTaskName in state.tasks) {
      const parentTask = state.tasks[parentTaskName]
      // Check if this task is a subtask of the current parent task
      if (parentTask.subtasks[task.name]) {
        return parentTask
      }
    }
    return undefined
  }

  const parentTask = getParentTask()
  const displayName = formatName(task.name)

  return (
    <div className="mt-8 overflow-hidden flex flex-col">
      <DetailsHeader
        title="Task"
        subtitle={displayName}
        status={task.status}
        parentTask={parentTask}
        onClose={() => state.setSelectedItem(null)}
      />

      <TimingInfo startTime={task.startTime} endTime={task.endTime} />

      <div className="overflow-hidden flex flex-col">
        <div className="pr-2 flex flex-col gap-3 overflow-hidden">
          <div className="text-sm text-card-foreground flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
              <span className="font-medium">Goal</span>
            </div>
            <div className="mt-1 p-2 bg-muted rounded text-xs whitespace-pre-wrap">{task.goal}</div>
          </div>
          {task.value && (
            <div className="text-sm text-card-foreground flex flex-col gap-1 overflow-hidden">
              <div className="flex items-center gap-2 overflow-hidden">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="font-medium">Result</span>
              </div>
              {formatJsonValue(task.value)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Query details component
function QueryDetails({ query }: { query: Query }) {
  const state = usePRaiStore()

  // Get parent task for query
  const getParentTask = () => {
    return state.getTaskByName(query.taskName)
  }

  const parentTask = getParentTask()
  const displayName = formatName(query.name)

  return (
    <div className="mt-8 overflow-hidden flex flex-col">
      <DetailsHeader
        title="Query"
        subtitle={displayName}
        status={query.status}
        parentTask={parentTask}
        onClose={() => state.setSelectedItem(null)}
      />

      <TimingInfo startTime={query.startTime} endTime={query.endTime} />

      <div className="overflow-hidden flex flex-col">
        <div className="flex flex-col gap-3 overflow-hidden">
          {query.messages.length > 0 && (
            <div className="overflow-hidden flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-card-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="font-medium">Messages</span>
              </div>
              <div className="pr-2 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  {query.messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`w-full rounded-lg px-3 py-2 text-xs ${
                          message.role === 'assistant'
                            ? 'bg-primary/10 text-primary'
                            : message.role === 'user'
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              message.role === 'assistant'
                                ? 'bg-primary text-primary-foreground'
                                : message.role === 'user'
                                ? 'bg-secondary-foreground text-secondary'
                                : 'bg-muted-foreground text-muted'
                            }`}
                          >
                            {message.role === 'assistant' ? 'A' : message.role === 'user' ? 'U' : 'S'}
                          </div>
                          <span className="font-medium capitalize">{message.role}</span>
                        </div>
                        <div className="whitespace-pre-wrap break-words">
                          {Array.isArray(message.content)
                            ? message.content.map((item: any, i: number) => (
                                <div key={i}>
                                  {item.type === 'text'
                                    ? item.text
                                    : item.type === 'image_url'
                                    ? '[Image]'
                                    : item.type === 'input_audio'
                                    ? '[Audio]'
                                    : `[${item.type}]`}
                                </div>
                              ))
                            : typeof message.content === 'string'
                            ? message.content
                            : JSON.stringify(message.content)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {query.value && (
            <div className="overflow-hidden flex gap-2 flex-col text-card-foreground">
              <div className="flex items-center gap-2 text-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="font-medium">Result</span>
              </div>
              <div className="overflow-hidden pr-2 text-xs flex flex-col">{formatJsonValue(query.value)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Data import details component
function DataImportDetails({ dataImport }: { dataImport: DataImport }) {
  const state = usePRaiStore()

  // Get parent task for data import
  const getParentTask = () => {
    if (dataImport.taskName) {
      return state.getTaskByName(dataImport.taskName)
    }
    return undefined
  }

  const parentTask = getParentTask()
  const displayName = formatName(dataImport.name)

  return (
    <div className="mt-8 overflow-hidden flex flex-col">
      <DetailsHeader
        title="Data Import"
        subtitle={displayName}
        status={dataImport.status}
        parentTask={parentTask}
        onClose={() => state.setSelectedItem(null)}
      />

      <TimingInfo startTime={dataImport.time} />

      <div className="overflow-hidden flex flex-col">
        <div className="pr-2 flex flex-col gap-3 overflow-hidden">
          <div className="text-sm text-card-foreground flex flex-col gap-1 overflow-hidden">
            <div className="flex items-center gap-2 overflow-hidden">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="font-medium">Data</span>
            </div>
            {formatJsonValue(dataImport.data)}
          </div>
        </div>
      </div>
    </div>
  )
}

// Main component that renders the appropriate details component based on selected item type
function TaskQueryDataDetails() {
  const state = usePRaiStore()
  const selectedItem = state.selectedItem

  if (!selectedItem) {
    return (
      <div className="mt-8 flex-grow flex flex-col items-center justify-center max-h-64 text-center">
        <div className="text-muted-foreground text-sm flex flex-col items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p>Click on any element in the timeline above to view its details</p>
        </div>
      </div>
    )
  }

  const { type, item } = selectedItem

  switch (type) {
    case 'task':
      return <TaskDetails task={item as Task} />
    case 'query':
      return <QueryDetails query={item as Query} />
    case 'data':
      return <DataImportDetails dataImport={item as DataImport} />
    default:
      return null
  }
}

// Timeline ruler with time markers
function TimelineRuler({ timeRange }: { timeRange: { start: number; end: number } }) {
  const rulerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  // Update width when component mounts or resizes
  useEffect(() => {
    if (!rulerRef.current) return

    const updateWidth = () => {
      if (rulerRef.current) {
        setWidth(rulerRef.current.getBoundingClientRect().width)
      }
    }

    // Initial measurement
    updateWidth()

    // Setup resize observer
    const observer = new ResizeObserver(updateWidth)
    observer.observe(rulerRef.current)

    return () => {
      if (rulerRef.current) {
        observer.unobserve(rulerRef.current)
      }
    }
  }, [])

  const markers = useMemo(() => {
    const { start, end } = timeRange
    const duration = end - start

    // Calculate the optimal number of markers based on width
    // Target: approximately one marker per 100-150px
    const targetMarkerCount = Math.max(2, Math.min(20, Math.floor(width / 60)))

    // Calculate the ideal interval based on targetMarkerCount
    const idealInterval = duration / (targetMarkerCount - 1)

    // Round to a "nice" interval value
    let interval = 1000 // default: 1 second

    // Define standard intervals in milliseconds for various time scales
    const intervals = [
      1000, // 1 second
      2000, // 2 seconds
      5000, // 5 seconds
      10000, // 10 seconds
      15000, // 15 seconds
      30000, // 30 seconds
      60000, // 1 minute
      120000, // 2 minutes
      300000, // 5 minutesx
      600000, // 10 minutes
      900000, // 15 minutes
      1800000, // 30 minutes
      3600000, // 1 hour
    ]

    // Find the closest "nice" interval
    for (let i = 0; i < intervals.length; i++) {
      if (idealInterval <= intervals[i] || i === intervals.length - 1) {
        interval = intervals[i]
        break
      }
    }

    // Generate markers
    const result = []
    const firstMarkerTime = start

    for (let time = firstMarkerTime; time <= end; time += interval) {
      const position = calculatePercentage(time, timeRange)
      result.push({ time, position })
    }

    return result
  }, [timeRange, width])

  return (
    <div className="relative h-6 mb-1 shrink-0 overflow-hidden" ref={rulerRef}>
      {markers.map(({ time, position }, index) => {
        // Calculate time elapsed since start
        const elapsedMs = time - timeRange.start
        const totalSeconds = Math.floor(elapsedMs / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60

        // Format the time string with units
        let timeString = ''
        if (minutes > 0) {
          timeString = `${minutes}m ${seconds}s`
        } else {
          timeString = `${seconds}s`
        }

        return (
          <div
            key={`marker-${index}`}
            className="absolute bottom-0 flex flex-col items-center transition-all"
            style={{ left: `${position}%` }}
          >
            <div className="text-xs text-muted-foreground mb-1">{timeString}</div>
            <div className="h-2 w-px bg-muted-foreground"></div>
          </div>
        )
      })}
    </div>
  )
}

// Single timeline bar component
function TimelineBar({ item, children }: { item: Task | Query; children?: ReactNode }) {
  const isTask = 'subtasks' in item
  const isQuery = 'messages' in item
  const isDataImport = 'data' in item && !isTask && !isQuery
  const state = usePRaiStore()
  const isSelected = state.selectedItem?.item === item

  // Base gradient and opacity classes for different states - with more subtle gradients
  const defaultGradient = 'from-primary/90 to-primary/40'
  const hoverGradient = 'from-primary/95 to-primary/50'

  const errorGradient = {
    default: 'from-destructive/90 to-destructive/40',
    hover: 'from-destructive/95 to-destructive/50',
    selected: 'from-destructive to-destructive/60',
  }

  const warningGradient = {
    default: 'from-warning/90 to-warning/40',
    hover: 'from-warning/95 to-warning/50',
    selected: 'from-warning to-warning/60',
  }

  const dataGradient = {
    default: 'from-success/90 to-success/40',
    hover: 'from-success/95 to-success/50',
    selected: 'from-success to-success/60',
  }

  // Determine the gradient based on status and selection state
  let gradientClasses = defaultGradient

  if (isDataImport) {
    gradientClasses = isSelected ? dataGradient.selected : dataGradient.default
  } else {
    switch (item.status) {
      case 'error':
        gradientClasses = isSelected ? errorGradient.selected : errorGradient.default
        break
      case 'cancelled':
        gradientClasses = isSelected ? warningGradient.selected : warningGradient.default
        break
      case 'running':
        gradientClasses += ' animate-pulse'
        break
    }
  }

  // Opacity and interaction states - now identical for tasks and queries
  let stateClasses = isSelected
    ? 'ring-2 ring-ring ring-offset-2 ring-offset-background opacity-100'
    : `opacity-90 hover:opacity-100 hover:ring-1 hover:ring-ring hover:ring-offset-1 hover:ring-offset-background ${
        isDataImport
          ? `hover:${dataGradient.hover}`
          : item.status === 'error'
          ? `hover:${errorGradient.hover}`
          : item.status === 'cancelled'
          ? `hover:${warningGradient.hover}`
          : `hover:${hoverGradient}`
      }`

  const handleClick = () => {
    state.setSelectedItem({
      type: isTask ? 'task' : isQuery ? 'query' : 'data',
      item,
    })
  }

  return (
    <div
      className={`h-3 rounded-md flex flex-row bg-gradient-to-b cursor-pointer ${gradientClasses} ${stateClasses}`}
      title={`${item.name} - ${isDataImport ? 'imported' : item.status}`}
      style={{ width: 'calc(100% - 0.2rem)', marginLeft: '.1rem' }}
      onClick={handleClick}
    >
      <div className="relative grow mx-[0.375rem] h-full">{children}</div>
    </div>
  )
}

// Recursive component to render a task and all its mixed rows
function TaskTree({ task, now, style }: { task: Task; now: number; style?: CSSProperties }) {
  const state = usePRaiStore()

  // Calculate task's position and width relative to its parent's timeframe if provided
  const taskStartTime = task.startTime
  const taskEndTime = task.endTime ?? now

  // Create task's own timeRange for its children
  const taskOwnTimeRange = {
    start: taskStartTime,
    end: taskEndTime,
  }

  // Get all mixed rows (tasks and queries) using getNonOverlappingMixedRows
  const mixedRows = state.getNonOverlappingMixedRows(task)

  // Get data imports for this task
  const dataImports = Object.values(task.dataImports)

  return (
    <div className="flex flex-col gap-1 transition-all" style={style}>
      <TimelineBar item={task}>
        {dataImports.map((dataImport, index) => {
          // Calculate position as percentage based on time
          const position = calculatePercentage(dataImport.time, taskOwnTimeRange)

          // Check if this data import is selected
          const isSelected = state.selectedItem?.type === 'data' && state.selectedItem?.item === dataImport

          return (
            <div
              key={`data-import-${dataImport.id}-${index}`}
              className={`absolute h-3 w-3 rounded-full bg-gradient-to-b from-success to-success/60 z-10 
                ${
                  isSelected
                    ? 'ring-2 ring-ring ring-offset-2 ring-offset-background opacity-100'
                    : 'hover:ring-1 hover:ring-ring hover:ring-offset-1 hover:ring-offset-background opacity-90 hover:opacity-100'
                } 
                cursor-pointer transition-all duration-150 shadow-sm border border-success/30`}
              style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
              title={`Data Import: ${dataImport.name} at ${new Date(dataImport.time).toLocaleTimeString()}`}
              onClick={(e) => {
                e.stopPropagation()
                state.setSelectedItem({
                  type: 'data',
                  item: dataImport,
                })
              }}
            />
          )
        })}
      </TimelineBar>

      {/* Render all mixed rows (containing both subtasks and queries) */}
      {mixedRows.length > 0 && (
        <div className="relative w-full flex flex-col gap-1">
          {mixedRows.map((row, rowIndex) => (
            <div key={`row-${task.name}-${rowIndex}`} className="relative w-full flex flex-row">
              {row.map((item, itemIndex) => {
                const isTask = 'subtasks' in item
                const previousItem = itemIndex > 0 ? row[itemIndex - 1] : null
                const previousEndTime = previousItem ? previousItem.endTime ?? now : undefined

                const style = {
                  marginLeft: `${calculateMarginLeft(item.startTime, taskOwnTimeRange, previousEndTime)}%`,
                  width: `${calculateWidth(item.startTime, item.endTime ?? now, taskOwnTimeRange)}%`,
                }

                return isTask ? (
                  <TaskTree key={`subtask-${item.name}`} task={item as Task} now={now} style={style} />
                ) : (
                  <div key={`query-${item.name}`} className="transition-all" style={style}>
                    <TimelineBar item={item} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper functions
function calculatePercentage(time: number, timeRange: { start: number; end: number }): number {
  const totalDuration = timeRange.end - timeRange.start
  if (totalDuration <= 0) return 0
  return Math.max(0, Math.min(100, ((time - timeRange.start) / totalDuration) * 100))
}

function calculateWidth(startTime: number, endTime: number, timeRange: { start: number; end: number }): number {
  const totalDuration = timeRange.end - timeRange.start
  if (totalDuration <= 0) return 1 // Minimum width for visibility

  const startPercent = calculatePercentage(startTime, timeRange)
  const endPercent = calculatePercentage(endTime, timeRange)

  // Ensure minimum width of 1% for visibility
  return Math.max(1, Math.min(100 - startPercent, endPercent - startPercent))
}

// Calculate margin left, accounting for previous element if provided
function calculateMarginLeft(
  startTime: number,
  timeRange: { start: number; end: number },
  previousElementEndTime?: number,
): number {
  // If there's a previous element, calculate margin relative to it
  if (previousElementEndTime !== undefined) {
    // Calculate the gap between this element's start and previous element's end
    // as a percentage of the parent time range
    return calculatePercentage(startTime, timeRange) - calculatePercentage(previousElementEndTime, timeRange)
  }

  // If no previous element, calculate margin from the start of timeRange
  return calculatePercentage(startTime, timeRange)
}

export function App() {
  const [isLoading, setIsLoading] = useState(false)
  const { processEvent, reset } = usePRaiStore()
  const [rootTaskName, setRootTaskName] = useState<string | null>(null)

  // State for dog inputs
  const [dogInputs, setDogInputs] = useState<DogInput[]>([
    { gender: 'male', heightInMeter: 0.5 },
    { gender: 'female', heightInMeter: 1 },
  ])

  // Add a new dog input
  const addDogInput = () => {
    setDogInputs([...dogInputs, { gender: 'male', heightInMeter: 0.5 }])
  }

  // Remove a dog input
  const removeDogInput = (index: number) => {
    const newInputs = [...dogInputs]
    newInputs.splice(index, 1)
    setDogInputs(newInputs)
  }

  // Update a dog input field
  const updateDogInput = (index: number, field: keyof DogInput, value: string | number) => {
    const newInputs = [...dogInputs]
    newInputs[index] = {
      ...newInputs[index],
      [field]: field === 'heightInMeter' ? parseFloat(value as string) : value,
    }
    setDogInputs(newInputs)
  }

  const handleStart = async () => {
    setIsLoading(true)
    reset() // Reset the store before starting a new request
    setRootTaskName(null) // Reset root task name

    try {
      // First POST the dog data to get the key
      const response = await fetch('http://localhost:3000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dogInputs),
      })

      const responseRootTaskName = await response.text()
      setRootTaskName(responseRootTaskName)

      // Second fetch to get the logs stream
      const logsResponse = await fetch(`http://localhost:3000/logs/${responseRootTaskName}`)
      const stream = logsResponse.body

      if (!stream) {
        throw new Error('Failed to get response stream')
      }

      const events = await decodeAsyncJson<AsyncIterable<StringifiedPraiEvent>>(
        streamToAsyncIterable(stream),
        new AbortController().signal,
      )

      // Process each event through our store
      for await (const event of events) {
        processEvent(event)
      }
    } catch (error) {
      console.error('Error:', error)
      reset()
      setRootTaskName(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-row justify-between overflow-hidden gap-6 p-6 h-screen bg-background">
      {/* Left column - Input Form */}
      <div className="bg-card p-6 rounded-lg grow">
        <h2 className="text-xl font-semibold mb-4 text-card-foreground">Configure Your Dogs</h2>

        <div className="flex flex-col gap-6 mb-6">
          {dogInputs.map((dog, index) => (
            <div key={index} className="p-4 border rounded-md relative border-border">
              <button
                onClick={() => removeDogInput(index)}
                className="absolute top-2 right-2 text-destructive hover:text-destructive/80"
                disabled={dogInputs.length <= 1}
              >
                ✕
              </button>

              <div className="mb-3">
                <label className="block text-sm font-medium mb-1 text-card-foreground">Gender</label>
                <select
                  className="w-full p-2 border rounded bg-input border-input text-card-foreground"
                  value={dog.gender}
                  onChange={(e) => updateDogInput(index, 'gender', e.target.value)}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-card-foreground">Height (meters)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="w-full p-2 border rounded bg-input border-input text-card-foreground"
                  value={dog.heightInMeter}
                  onChange={(e) => updateDogInput(index, 'heightInMeter', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-row gap-3 justify-between mb-6">
          <button
            onClick={addDogInput}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
            disabled={isLoading}
          >
            + Add Dog
          </button>

          <button
            onClick={handleStart}
            disabled={isLoading}
            className="px-4 py-2 cursor-pointer bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Calculate Food Costs'}
          </button>
        </div>
      </div>

      {/* Right column - Task results */}
      <div className="flex flex-col grow max-w-[600px] min-w-[600px] overflow-hidden bg-card rounded-lg border border-border ">
        {/* Pass the root task name to TaskTimeline */}
        {rootTaskName != null && <TaskTimeline rootTaskName={rootTaskName} />}
      </div>
    </div>
  )
}

function streamToAsyncIterable(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = stream.getReader()

  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          try {
            const { done, value } = await reader.read()

            if (done) {
              return { done: true, value: undefined }
            }

            // Convert the Uint8Array to text
            const text = new TextDecoder().decode(value)
            return { done: false, value: text }
          } catch (error) {
            // Release the reader on error
            reader.releaseLock()
            throw error
          }
        },
        async return() {
          // Make sure to release the reader when iteration is cancelled
          reader.releaseLock()
          return { done: true, value: undefined }
        },
      }
    },
  }
}
