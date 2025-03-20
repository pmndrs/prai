import { openai } from './openai.js'

export const llamacpp = openai.bind(null, 'grammar')
