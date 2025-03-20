import { openai } from './openai.js'

export const vllm = openai.bind(null, 'guided_grammar')
