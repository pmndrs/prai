import chalk from 'chalk'
import { History } from './history.js'

export function consoleLogger(history: History, options?: { abort?: AbortSignal }): void {
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
  const logHeader = (historyId: string, type: string, time: number, color: typeof chalk.blue) => {
    const timestamp = colors.timestamp(`[${formatTime(time)}]`)
    const header = color(`${type}`)
    const idFormatted = `: ${formatId(historyId)}`

    console.log(`${colors.key(`[History]`)} ${timestamp} ${header}${idFormatted}`)
  }

  // Log with decorative separator
  const logSeparator = () => {
    console.log(colors.separator('───────────────────────────────────────────────────'))
  }

  // Always start with a separator for the first event
  logSeparator()

  history.addEventListener(
    'step-request',
    (event) => {
      logHeader(event.historyId, 'Step Request', Date.now(), colors.info)
      console.log('  Message:')
      console.log('  ' + formatMessages([event.message]).replace(/\n/g, '\n  '))
      logSeparator()
    },
    { signal: abortSignal },
  )

  history.addEventListener(
    'step-response',
    (event) => {
      logHeader(event.historyId, 'Step Response', Date.now(), colors.success)
      console.log('  Message:')
      console.log('  ' + formatMessages([event.message]).replace(/\n/g, '\n  '))
      logSeparator()
    },
    { signal: abortSignal },
  )

  history.addEventListener(
    'subtask-start',
    (event) => {
      logHeader(event.historyId, 'Subtask Started', Date.now(), colors.info)
      console.log('  Subtask History ID:')
      console.log('  ' + formatId(event.subtaskHistoryId))
      logSeparator()
    },
    { signal: abortSignal },
  )

  history.addEventListener(
    'data-reference-added',
    (event) => {
      logHeader(event.historyId, 'Data Added', Date.now(), colors.info)
      console.log('  Message:')
      console.log('  ' + formatMessages([event.message]).replace(/\n/g, '\n  '))
      logSeparator()
    },
    { signal: abortSignal },
  )

  history.addEventListener(
    'subtask-response-referenced',
    (event) => {
      logHeader(event.historyId, 'Subtask Response Referenced', Date.now(), colors.success)
      console.log('  Request Message:')
      console.log('  ' + formatMessages([event.requestMessage]).replace(/\n/g, '\n  '))
      console.log('  Response Message:')
      console.log('  ' + formatMessages([event.responseMessage]).replace(/\n/g, '\n  '))
      logSeparator()
    },
    { signal: abortSignal },
  )
}
