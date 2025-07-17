import { Price, Provider } from '../model.js'
import { Schema, ZodObject, ZodString, ZodUnion } from 'zod'

import { Message } from '../step.js'
import { buildJsonSchema } from '../schema/json.js'

interface LlamaOptions {
  apiKey: string
}

interface LlamaMessage {
  role: string
  content: string
}

interface LlamaResponse {
  completion_message: {
    content: {
      text: string
    }
  }
}

// Simplified JSON schema types for Llama API (which doesn't support all prai JsonSchema features)
interface LlamaJsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'integer' | 'null'
  description?: string
  additionalProperties?: boolean
  properties?: Record<string, LlamaJsonSchema>
  required?: string[]
  items?: LlamaJsonSchema
  enum?: string[]
}

interface LlamaRequestBody {
  model: string
  messages: LlamaMessage[]
  response_format?: {
    type: 'json_schema'
    json_schema: {
      name: string
      schema: LlamaJsonSchema
    }
  }
}

async function llamaQuery(
  model: string,
  messages: Array<LlamaMessage>,
  apiKey: string,
  abortSignal: AbortSignal | undefined,
  responseFormat?: LlamaRequestBody['response_format'],
): Promise<string> {
  const requestBody: LlamaRequestBody = {
    model,
    messages,
    ...(responseFormat && { response_format: responseFormat }),
  }

  const response = await fetch('https://api.llama.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: abortSignal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
  }

  const data: LlamaResponse = await response.json()
  return data.completion_message.content.text
}

function buildLlamaResponseFormat(
  schema: Schema,
  wrapInObject: boolean,
): LlamaRequestBody['response_format'] | undefined {
  if (schema instanceof ZodString) {
    return undefined
  }

  let praiSchema = buildJsonSchema(schema)

  // Convert prai JsonSchema to LlamaJsonSchema by removing unsupported properties
  const convertToLlamaSchema = (obj: any): LlamaJsonSchema => {
    if (typeof obj !== 'object' || obj === null) return obj

    const result: LlamaJsonSchema = {
      type: obj.type,
    }

    if (obj.description) result.description = obj.description
    if (obj.additionalProperties !== undefined) result.additionalProperties = obj.additionalProperties
    if (obj.enum) result.enum = obj.enum
    if (obj.required) result.required = obj.required

    if (obj.properties) {
      result.properties = {}
      for (const [key, value] of Object.entries(obj.properties)) {
        result.properties[key] = convertToLlamaSchema(value)
      }
    }

    if (obj.items) {
      result.items = convertToLlamaSchema(obj.items)
    }

    return result
  }

  let llamaSchema = convertToLlamaSchema(praiSchema)

  if (wrapInObject) {
    llamaSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        result: llamaSchema,
      },
      required: ['result'],
    }
  }

  return {
    type: 'json_schema',
    json_schema: {
      name: 'response_schema',
      schema: llamaSchema,
    },
  }
}

export function llama(options: LlamaOptions): Provider {
  return {
    async query(
      modelName: string,
      modelPrice: Price | undefined,
      modelOptions: {},
      messages: Array<Message>,
      schema: Schema,
      abortSignal: AbortSignal | undefined,
    ): Promise<{ content: string; cost?: number }> {
      const transformedMessages = transformMessages(messages)
      if (!(schema instanceof ZodObject || schema instanceof ZodUnion || schema instanceof ZodString)) {
        const responseFormat = buildLlamaResponseFormat(schema, true)
        const result = await llamaQuery(modelName, transformedMessages, options.apiKey, abortSignal, responseFormat)
        const { result: parsedResult } = JSON.parse(result)
        return { content: JSON.stringify(parsedResult) }
      }
      const responseFormat = buildLlamaResponseFormat(schema, false)
      const result = await llamaQuery(modelName, transformedMessages, options.apiKey, abortSignal, responseFormat)
      return { content: result }
    },
    async *streamingQuery(
      modelName: string,
      modelPrice: Price | undefined,
      modelOptions: {},
      messages: Array<Message>,
      schema: Schema,
      abortSignal: AbortSignal | undefined,
    ): AsyncIterable<{ content: string; cost?: number }> {
      const transformedMessages = transformMessages(messages)
      if (!(schema instanceof ZodObject || schema instanceof ZodUnion || schema instanceof ZodString)) {
        const responseFormat = buildLlamaResponseFormat(schema, true)
        const result = await llamaQuery(modelName, transformedMessages, options.apiKey, abortSignal, responseFormat)
        const { result: parsedResult } = JSON.parse(result)
        yield { content: JSON.stringify(parsedResult) }
      } else {
        const responseFormat = buildLlamaResponseFormat(schema, false)
        const result = await llamaQuery(modelName, transformedMessages, options.apiKey, abortSignal, responseFormat)
        yield { content: result }
      }
    },
  }
}

function transformMessages(messages: Array<Message>): Array<LlamaMessage> {
  return messages.map((message) => {
    if (message.role === 'user') {
      const content = message.content
        .map((item) => {
          if (item.type === 'text') {
            return item.text
          }
          return ''
        })
        .join('\n\n')
      return {
        role: message.role,
        content,
      }
    }
    return {
      role: message.role,
      content: message.content.map(({ text }) => text).join('\n\n'),
    }
  })
}
