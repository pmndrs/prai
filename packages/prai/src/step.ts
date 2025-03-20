import { addStepMessagesToDependencies, getCurrentTaskUuid, startStepContext, StepDependencies } from './context.js'
import { Task } from './task.js'
import { createStreamingStepData, Data, StepData, StreamingStepData } from './data.js'
import { isAsyncIterable } from './utils.js'
import { Message } from './connection/openai.js'
import { randomString } from './random.js'

const DefaultSystemPrompt =
  'You are a helpful assistant that helps the user through a multi step process while taking references to previous requests into account and exclusively answers in the requested format.'

export function stepResultToString(
  task: Task,
  stepUuid: string,
  promptFn: () => string,
  formatDescription: string | undefined,
  result: unknown,
): string {
  const [taskIndex, stepIndex] = addStepMessagesToDependencies(
    task,
    stepUuid,
    promptFn,
    (prompt, _taskIndex, stepIndex) => [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `## Step ${stepIndex + 1}\n${prompt}.${
              formatDescription != null ? ` Respond in the format of ${formatDescription}` : ''
            }. The result of Step ${stepIndex + 1} is:`,
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      },
    ],
  )
  return `the Result of Step ${stepIndex + 1}${
    getCurrentTaskUuid() == task.name ? ' of the current Task' : ` of Task ${taskIndex + 1}`
  }`
}

function buildStepMessages(
  task: Task,
  stepUuid: string,
  promptFn: () => string,
  formatDescription: string | undefined,
  examples:
    | Array<{
        input: any
        output: any
        reason?: string
      }>
    | undefined,
  endStepContext: () => StepDependencies,
  systemPrompt?: string,
): Array<Message> {
  addStepMessagesToDependencies(task, stepUuid, promptFn, (prompt, _taskIndex, stepIndex) => [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `## Step ${stepIndex + 1}\nPlease now fulfill the following instructions: ${prompt}.\n${
            examples
              ?.map(
                (example, index) =>
                  `### Example ${index + 1}\nFor the input ${example.input} the output should be ${example.output} ${
                    example.reason != null ? `, since ${example.reason}` : ''
                  }.`,
              )
              .join('\n') ?? ''
          }\nNow respond following the instructions${
            formatDescription != null ? ` in the format of ${formatDescription}` : ''
          }.`,
        },
      ],
    },
  ])
  return [
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text: systemPrompt ?? task.systemPrompt ?? DefaultSystemPrompt,
        },
      ],
    },
    ...endStepContext().reduce<Array<Message>>(
      (prev, current) =>
        current.messages.reduce((acc, msg) => {
          const lastMsg = acc[acc.length - 1]
          if (lastMsg != null && lastMsg.role === msg.role) {
            lastMsg.content = [...lastMsg.content, { type: 'text', text: '\n\n' }, ...msg.content]
            return acc
          }
          return acc.concat(msg)
        }, prev),
      [],
    ),
  ]
}

export type StepFormatOptions = {
  grammar?: string
  description?: string
}

type StepOptions<ExampleInput = string, ExampleOutput = string> = {
  format?: StepFormatOptions
  examples?: Array<{
    input: ExampleInput
    output: ExampleOutput
    reason?: string
  }>
  abortSignal?: AbortSignal
  mock?: (seed: string) => string
  systemPrompt?: string
  /**
   * a name for the step unique for the whole process (all steps in all tasks and subtasks in the process)
   * required for caching
   */
  name?: string
}

export type NonStreamingStepOptions<ExampleInput = string, ExampleOutput = string> = { stream?: false } & StepOptions<
  ExampleInput,
  ExampleOutput
>
export type StreamingStepOptions<ExampleInput = string, ExampleOutput = string> = { stream: true } & StepOptions<
  ExampleInput,
  ExampleOutput
>

export function stringStep(
  task: Task,
  prompt: () => string,
  options: StreamingStepOptions,
): StreamingStepData<string, string>
export function stringStep(
  task: Task,
  prompt: () => string,
  options?: NonStreamingStepOptions,
): Promise<StepData<string>>
export function stringStep(
  task: Task,
  prompt: () => string,
  options?: NonStreamingStepOptions | StreamingStepOptions,
): Promise<StepData<string>> | StreamingStepData<string, string>

export function stringStep(task: Task, prompt: () => string, options?: NonStreamingStepOptions | StreamingStepOptions) {
  const stepName = options?.name ?? crypto.randomUUID()
  const endStepContext = startStepContext(task.name)
  const messages = buildStepMessages(
    task,
    stepName,
    prompt,
    options?.format?.description,
    options?.examples,
    endStepContext,
    options?.systemPrompt,
  )
  const result = task.query(
    task.rootName,
    task.name,
    stepName,
    messages,
    options?.stream ?? false,
    options?.mock ?? mockStringStep,
    options?.format?.grammar,
    options?.abortSignal,
  )
  if (isAsyncIterable(result)) {
    return createStreamingStepData(result, task, stepName, prompt, options?.format?.description, collectStreamingString)
  }
  return result.then((value) => new StepData(value, task, stepName, prompt, options?.format?.description))
}

function mockStringStep(seed: string): string {
  return randomString(seed, 5, 50)
}

export async function collectStreamingString(stream: AsyncIterable<string>) {
  let string = ''
  for await (const chunk of stream) {
    string += chunk
  }
  return string
}
