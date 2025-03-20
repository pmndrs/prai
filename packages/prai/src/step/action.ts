import { Schema } from 'zod'
import { NonStreamingStepOptions, stringStep } from '../step.js'
import { Task } from '../task.js'
import { buildSchemaGrammar, buildSchemaTypename, defaultPrimitiveDefinitions } from '../schema/index.js'
import { createSchemaMock } from '../schema/mock.js'
import { randomInt } from '../random.js'

export type FromSchemaArray<T> = {
  [Index in keyof T]: T[Index] extends Schema<infer P> ? P : never
}

export type ParamNames<T> = { [Index in keyof T]: string }

export type Actions<I extends Record<string, Array<Schema>>, O> = {
  [Key in keyof I]: {
    paramNames: ParamNames<I[Key]>
    paramSchemas: I[Key]
    execute: (...params: FromSchemaArray<I[Key]>) => Promise<O>
    description?: string
  }
}

const actionRegex = /^([^(]+)\((.*)\)$/

export function createActions<const I extends Record<string, Array<Schema>>, O>(actions: Actions<I, O>): Actions<I, O> {
  return actions
}

//TODO: support streaming with multi actions

export async function actionStep<const I extends Record<string, Array<Schema>>, O>(
  task: Task,
  prompt: () => string,
  actions: Actions<I, O>,
  options?: Omit<
    NonStreamingStepOptions<
      string,
      {
        [Key in keyof I]: [Key & string, ...FromSchemaArray<I[Key]>]
      }[keyof I]
    >,
    'format'
  >,
): Promise<readonly [O, string, ...Array<unknown>]> {
  //checking action names
  for (const [actionName, { paramNames }] of Object.entries<Actions<I, O>[keyof I]>(
    actions as Record<string, Actions<I, O>[keyof I]>,
  )) {
    if (actionName.length === 0) {
      throw new Error(`action name can not be empty`)
    }
    if (actionName.includes('(')) {
      throw new Error(`action name cannot contain "(" (${actionName})`)
    }
    for (const paramName of paramNames) {
      if (paramName.length === 0) {
        throw new Error(`param name can not be empty`)
      }
      if (paramName.includes(')')) {
        throw new Error(`paramName name cannot contain ")" (${actionName})`)
      }
    }
  }
  const result = await stringStep(task, prompt, {
    abortSignal: options?.abortSignal,
    examples: options?.examples?.map(({ input, output: [name, ...params], reason }) => ({
      input,
      output: `${name}(${params.join(', ')})`,
      reason,
    })),
    format: {
      description: buildActionsDescription(actions),
      grammar: buildActionsGrammar(actions),
    },
    mock: (seed) => createActionsMock(actions, seed),
    stream: false,
  })
  const match = actionRegex.exec(result.value)
  if (match == null) {
    throw new Error(`output from LLM does not match the action format "${result.value}"`)
  }
  const [, actionName, actionParamsString] = match
  const actionParams = JSON.parse(`[${actionParamsString}]`)
  const action = actions[actionName as keyof I]
  if (action == null) {
    throw new Error(`LLM returned unknown action "${actionName}"`)
  }
  return [await action.execute(...actionParams), actionName, ...actionParams]
}

function buildActionsGrammar<I extends Record<string, Array<Schema>>, O>(actions: Actions<I, O>) {
  const result: Array<string> = [`root ::= ${Object.keys(actions).join(' | ')}`, ...defaultPrimitiveDefinitions]
  for (const [name, { paramSchemas, paramNames }] of Object.entries<Actions<I, O>[keyof I]>(
    actions as Record<string, Actions<I, O>[keyof I]>,
  )) {
    for (let i = 0; i < paramSchemas.length; i++) {
      const paramNonTerminalName = `${name}-${paramNames[i]}`
      result.push(
        buildSchemaGrammar(paramSchemas[i], {
          nonTerminalNamePrefix: paramNonTerminalName,
          rootName: paramNonTerminalName,
          //defaultDefinitions is empty since primitive definitions already in result
          defaultDefinitions: [],
        }),
      )
    }
    result.push(`${name} ::= "${name}(" ${paramNames.map((paramName) => `${name}-${paramName}`).join(` ", " `)} ")"`)
  }
  return result.join('\n')
}

function buildActionsDescription<I extends Record<string, Array<Schema>>, O>(actions: Actions<I, O>) {
  const result: Array<string> = []
  for (const [name, { paramSchemas, paramNames, description }] of Object.entries<Actions<I, O>[keyof I]>(
    actions as Record<string, Actions<I, O>[keyof I]>,
  )) {
    let resolvedDescription = ''
    if (description != null) {
      resolvedDescription = ` ${description}`
    }
    result.push(
      `the "${name}(${paramNames
        .map((name, index) => `${name}: ${buildSchemaTypename(paramSchemas[index])}`)
        .join(', ')})" action${resolvedDescription}`,
    )
  }
  const actioNames = Object.keys(actions)
  return `one of ${actioNames.length} actions with the respective parameters in their expected formats:\n ${result.join(
    '.\n',
  )}`
}

function createActionsMock<I extends Record<string, Array<Schema>>, O>(actions: Actions<I, O>, seed: string): string {
  const actionNames = Object.keys(actions)
  const actionName = actionNames[randomInt(seed + 'actionName', 0, actionNames.length - 1)]
  let result = `${actionName}(`
  const { paramSchemas } = actions[actionName]
  for (let i = 0; i < paramSchemas.length; i++) {
    result += createSchemaMock(paramSchemas[i], seed + i)
  }
  result += ')'
  return result
}
