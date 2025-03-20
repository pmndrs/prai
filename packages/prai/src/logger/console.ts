import { Connection } from '../connection/index.js'
import chalk from 'chalk'

export function consoleLogger(connection: Connection, options?: { abort?: AbortSignal }): void {
  const abortSignal = options?.abort
  const initialTime = Date.now()

  // Helper function to format time - simplified to minutes:seconds.ms
  const formatTime = (time: number) => {
    // Calculate elapsed time since the logging started
    const elapsed = time - initialTime
    const totalSeconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0')
    const seconds = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, '0')
    const milliseconds = Math.floor(elapsed % 1000)
      .toString()
      .padStart(3, '0')

    return `${minutes}:${seconds}.${milliseconds}`
  }

  // Color themes for different event types
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    highlight: chalk.magenta,
    muted: chalk.gray,
    timestamp: chalk.dim,
    id: chalk.cyan.dim,
    key: chalk.cyan,
    value: chalk.white,
    separator: chalk.dim,
  }

  // Helper to format IDs in a shorter format
  const formatId = (id: string): string => {
    if (!id || id.length <= 8) return id
    return colors.id(`${id.substring(0, 6)}...${id.substring(id.length - 4)}`)
  }

  // Format JSON data with consistent indentation and colorization
  const formatJson = (data: any, indent = 2): string => {
    if (data === undefined || data === null) return colors.muted('null')
    if (typeof data !== 'object') return colors.value(String(data))

    try {
      // For arrays
      if (Array.isArray(data)) {
        if (data.length === 0) return colors.muted('[]')

        const items = data.map((item) => ' '.repeat(indent) + formatJson(item, indent + 2))
        return '[\n' + items.join(',\n') + '\n' + ' '.repeat(indent - 2) + ']'
      }

      // For objects
      const entries = Object.entries(data)
      if (entries.length === 0) return colors.muted('{}')

      const props = entries.map(([key, value]) => {
        return ' '.repeat(indent) + colors.key(`"${key}"`) + ': ' + formatJson(value, indent + 2)
      })

      return '{\n' + props.join(',\n') + '\n' + ' '.repeat(indent - 2) + '}'
    } catch (e) {
      return colors.muted(`[Unprocessable: ${typeof data}]`)
    }
  }

  // Format messages with better visual hierarchy and indentation
  const formatMessages = (messages: any[]): string => {
    if (!Array.isArray(messages)) return formatJson(messages)

    const formattedMessages = messages
      .map((msg) => {
        const roleColor = msg.role === 'user' ? colors.info : msg.role === 'system' ? colors.highlight : colors.success

        const roleHeader = roleColor(`${msg.role.toUpperCase()}`)

        let content = ''
        if (Array.isArray(msg.content)) {
          content = msg.content
            .map((item: any) => {
              if (item.type === 'text') {
                return item.text
                  .split('\n')
                  .map((line: string) => '  ' + line)
                  .join('\n')
              }
              if (item.type === 'image_url') return '  [Image]'
              if (item.type === 'input_audio') return '  [Audio]'
              return `  [${item.type}]`
            })
            .join('\n')
        } else {
          content = String(msg.content)
            .split('\n')
            .map((line: string) => '  ' + line)
            .join('\n')
        }

        return `${roleHeader}\n${content}`
      })
      .join('\n\n')

    return formattedMessages
  }

  // Log header with timestamp and event type
  const logHeader = (
    rootTaskName: string,
    type: string,
    id: string,
    time: number,
    color: typeof chalk.blue,
    taskName?: string,
  ) => {
    const timestamp = colors.timestamp(`[${formatTime(time)}]`)
    const header = color(`${type}`)
    const idFormatted = `: ${formatId(id)}`
    const taskNameStr = taskName ? ` (Task: ${formatId(taskName)})` : ''

    console.log(`${colors.key(`[${rootTaskName}]`)} ${timestamp} ${header}${idFormatted}${taskNameStr}`)
  }

  // Log with decorative separator
  const logSeparator = () => {
    console.log(colors.separator('───────────────────────────────────────────────────'))
  }

  // Always start with a separator for the first event
  logSeparator()

  connection.addEventListener(
    'data-import',
    (event) => {
      logHeader(event.rootTaskName, 'Import data', event.dataName, event.time, colors.info, event.taskName)
      console.log('  Data:')
      console.log(
        '  ' +
          formatJson(typeof event.value === 'string' ? event.value : JSON.stringify(event.value)).replace(
            /\n/g,
            '\n  ',
          ),
      )
      logSeparator()
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'task-start',
    (event) => {
      logHeader(event.rootTaskName, 'Task started', event.taskName, event.time, colors.info)
      console.log('  Goal:')
      console.log('  ' + colors.highlight(event.goal))
      logSeparator()
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'task-finish',
    (event) => {
      logHeader(event.rootTaskName, 'Task finished', event.taskName, event.time, colors.success)
      console.log('  Result:')
      try {
        const valueStr = typeof event.value === 'string' ? event.value : JSON.stringify(event.value)
        console.log('  ' + formatJson(JSON.parse(valueStr)).replace(/\n/g, '\n  '))
      } catch {
        console.log('  ' + colors.success(typeof event.value === 'string' ? event.value : JSON.stringify(event.value)))
      }
      logSeparator()
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'task-cancel',
    (event) => {
      logHeader(event.rootTaskName, 'Task cancelled', event.taskName, event.time, colors.warning)
      logSeparator()
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'task-error',
    (event) => {
      logHeader(event.rootTaskName, 'Task error', event.taskName, event.time, colors.error)
      console.error('  Error details:')
      const errorStr = typeof event.error === 'object' ? JSON.stringify(event.error) : String(event.error)
      console.log('  ' + formatJson(errorStr).replace(/\n/g, '\n  '))
      logSeparator()
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'query-start',
    (event) => {
      logHeader(event.rootTaskName, 'Query started', event.queryName, event.time, colors.info, event.taskName)
      console.log('  Messages:')
      console.log('  ' + formatMessages(event.messages).replace(/\n/g, '\n  '))
      logSeparator()
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'query-finish',
    (event) => {
      logHeader(event.rootTaskName, 'Query finished', event.queryName, event.time, colors.success)
      console.log('  Result:')
      try {
        // Try to parse the result as JSON for better formatting
        const valueStr = typeof event.value === 'string' ? event.value : JSON.stringify(event.value)
        const parsedResult = JSON.parse(valueStr)
        console.log('  ' + formatJson(parsedResult).replace(/\n/g, '\n  '))
      } catch {
        // If it's not valid JSON, display as is
        console.log('  ' + colors.success(typeof event.value === 'string' ? event.value : JSON.stringify(event.value)))
      }
      logSeparator()
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'query-cancel',
    (event) => {
      logHeader(event.rootTaskName, 'Query cancelled', event.queryName, event.time, colors.warning)
      logSeparator()
    },
    { signal: abortSignal },
  )

  connection.addEventListener(
    'query-error',
    (event) => {
      logHeader(event.rootTaskName, 'Query error', event.queryName, event.time, colors.error)
      console.error('  Error details:')
      const errorStr = typeof event.error === 'object' ? JSON.stringify(event.error) : String(event.error)
      console.log('  ' + formatJson(errorStr).replace(/\n/g, '\n  '))
      logSeparator()
    },
    { signal: abortSignal },
  )
}
