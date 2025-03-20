import { StepData, StreamingStepData } from '../data.js'
import { randomString } from '../random.js'
import { collectStreamingString, NonStreamingStepOptions, StreamingStepOptions, stringStep } from '../step.js'
import { Task } from '../task.js'
import { isAsyncIterable } from '../utils.js'

const fullCodeRegex = /^```[^\n]+\n([^`]*)\n```$/

export function codeStep(
  task: Task,
  queryPrompt: () => string,
  language: string,
  options: Omit<StreamingStepOptions, 'format'>,
): StreamingStepData<string, string>

export function codeStep(
  task: Task,
  queryPrompt: () => string,
  language: string,
  options?: Omit<NonStreamingStepOptions, 'format'>,
): Promise<StepData<string>>

export function codeStep(
  task: Task,
  queryPrompt: () => string,
  language: string,
  options?: Omit<NonStreamingStepOptions | StreamingStepOptions, 'format'>,
): Promise<StepData<string>> | StreamingStepData<string, string>

export function codeStep(
  task: Task,
  queryPrompt: () => string,
  language: string,
  options?: Omit<NonStreamingStepOptions | StreamingStepOptions, 'format'>,
): Promise<StepData<string>> | StreamingStepData<string, string> {
  const asyncString = stringStep(task, queryPrompt, {
    format: {
      description: `A markdown code block containing the ${language} code to fulfill the request without using backticks except for the start and end of the code block.`,
      grammar: `root ::= "\`\`\`${language}\\n" [^\`]* "\\n\`\`\`"`,
    },
    abortSignal: options?.abortSignal,
    examples: options?.examples,
    stream: options?.stream,
    mock: (seed) => `\`\`\`${language}\n${randomString(seed, 20, 40)}\n\`\`\``,
  })
  if (!isAsyncIterable(asyncString)) {
    return asyncString.then((string) => {
      const match = fullCodeRegex.exec(string.value)
      if (match == null) {
        throw new Error(`Unexpected returned code format "${string.value}".`)
      }
      return string.setValue(match[1])
    })
  }
  return asyncString.setStream(processStreamingCodeStep(asyncString), undefined, collectStreamingString)
}

const startCodeRegex = /^```[^\n]+\n(.*)/
const endCodeRegex = /^([^`]*)\n`/

async function* processStreamingCodeStep(input: AsyncIterable<string>): AsyncIterable<string> {
  let startComplete = false
  let unprocessed = ''
  for await (const string of input) {
    unprocessed += string
    if (!startComplete) {
      const startMatch = startCodeRegex.exec(unprocessed)
      if (startMatch == null) {
        continue
      }
      startComplete = true
      unprocessed = startMatch[1]
    }
    const endMatch = endCodeRegex.exec(unprocessed)
    if (endMatch != null) {
      yield endMatch[1]
      return
    }
    yield unprocessed
    unprocessed = ''
  }
  throw new Error(``)
}
