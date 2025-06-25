import { GenerateContentConfig, GoogleGenAI, GoogleGenAIOptions, Part } from '@google/genai'
import { Provider } from '../model.js'
import { buildJsonSchema } from '../schema/json.js'
import { Schema, ZodString } from 'zod'
import { Message } from '../step.js'

function buildAdditionalConfig(schema: Schema): GenerateContentConfig {
  if (schema instanceof ZodString) {
    return {}
  }
  let responseSchema = buildJsonSchema(schema, false)
  return {
    responseMimeType: 'application/json',
    responseSchema: responseSchema,
  }
}

export function gemini(options: GoogleGenAIOptions): Provider {
  const client = new GoogleGenAI(options)
  return {
    async query(model, messages, schema, abortSignal) {
      const additionalConfig = buildAdditionalConfig(schema)
      const chat = client.chats.create({
        model,
        history: messages.slice(0, -1).map(({ role, content }) => ({
          role: role === 'assistant' ? 'model' : role,
          parts: content.map(messageContentToPartUnion),
        })),
      })
      const response = await chat.sendMessage({
        config: { abortSignal, ...additionalConfig },
        message: messages.at(-1)!.content.map(messageContentToPartUnion),
      })
      return response.text ?? ''
    },
    async *streamingQuery(model, messages, schema, abortSignal) {
      const additionalConfig = buildAdditionalConfig(schema)
      const chat = client.chats.create({
        model,
        history: messages.slice(0, -1).map(({ role, content }) => ({
          role: role === 'assistant' ? 'model' : role,
          parts: content.map(messageContentToPartUnion),
        })),
      })
      const response = await chat.sendMessageStream({
        config: { abortSignal, ...additionalConfig },
        message: messages.at(-1)!.content.map(messageContentToPartUnion),
      })

      for await (const chunk of response) {
        yield chunk.text ?? ''
      }
    },
  }
}

function messageContentToPartUnion(content: Message['content'][number]): Part {
  switch (content.type) {
    case 'image_url':
      return { fileData: { fileUri: content.image_url.url, displayName: 'input.png', mimeType: 'image/png' } }
    case 'input_audio':
      return {
        inlineData: {
          data: content.input_audio.data,
          mimeType: `audio/${content.input_audio.format}`,
          displayName: `input.${content.input_audio.format}`,
        },
      }
    case 'text':
      return { text: content.text }
  }
}
