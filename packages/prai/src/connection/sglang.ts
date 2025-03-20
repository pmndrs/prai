import { openai } from './openai.js'

export const sglang = openai.bind(null, 'ebnf')
