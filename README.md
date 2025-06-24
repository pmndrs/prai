<h1 align="center">prai 🤖</h1>
<h3 align="center">JS Framework for building step-by-step LLM instructions<br>(<ins>pr</ins>ogrammable <ins>ai</ins>)</h3>
<br/>

<p align="center">
  <a href="https://npmjs.com/package/prai" target="_blank">
    <img src="https://img.shields.io/npm/v/prai?style=flat&colorA=000000&colorB=000000" alt="NPM" />
  </a>
  <a href="https://npmjs.com/package/prai" target="_blank">
    <img src="https://img.shields.io/npm/dt/prai.svg?style=flat&colorA=000000&colorB=000000" alt="NPM" />
  </a>
  <a href="https://twitter.com/pmndrs" target="_blank">
    <img src="https://img.shields.io/twitter/follow/pmndrs?label=%40pmndrs&style=flat&colorA=000000&colorB=000000&logo=twitter&logoColor=000000" alt="Twitter" />
  </a>
  <a href="https://discord.gg/ZZjjNvJ" target="_blank">
    <img src="https://img.shields.io/discord/740090768164651008?style=flat&colorA=000000&colorB=000000&label=discord&logo=discord&logoColor=000000" alt="Discord" />
  </a>
</p>

Writing prompts in natural language is great—until they become messy with multiple steps, output format descriptions, and too many lines of text...

With **prai**, prompts become code—structured, maintainable, and debuggable—leading to high-quality, reliable outputs.

```bash
npm install prai
```

### What does it look like?

```ts
import { History, Model, openai, step } from 'prai'
import { z } from 'zod'

// 1. Inputs for our theme generation process
const brandName = `pmndrs`
const brandDescription = `Open source developer collective`

// 2. Zod schema for a color in hsl - will be given to the LLM as the expected output format
const colorScheme = z
  .object({
    hue: z.number().describe('in degree (0-360)'),
    saturation: z.number().describe('in percent (0-100)'),
    lightness: z.number().describe('in percent (0-100)'),
  })
  .describe('hsl color')

// 3. Create a model based on an AI provider (openai, groq, more support comming soon)
const model = new Model({ name: 'gpt-4.1-mini', apiKey: 'insert key here', provider: openai({ apiKey: "" }) })

// 4. create a chat history
const history = new History()

// 5. First step
const adjectives = await step(
    //6. Enforce a strict schema on the output (a list of strings) - LLM will be forced to comply
  `list some adjectives fitting the design of the ${brandName} brand which is a ${brandDescription}`,
  z.array(z.string()),
  { model, history }
)

// 7. Second step—generate a basic theme
const coreTheme = await step(
  // 9. We can reference results from history using history.reference
  `Based on the ${history.reference(adjectives)}, derive fitting color theme`,
  z.object({
    background: colorScheme,
    foreground: colorScheme,
    primary: colorScheme,
    secondary: colorScheme,
    accent: colorScheme,
    border: colorScheme,
    radius: z.number().describe('radius in rem'),
  }),
  { model, history }
)

// 10. Final step—expand into a full shadcn theme
const result = await step(
  `Expand the ${history.reference(coreTheme)} to a full shadcn theme`,
  z.object({
    background: colorScheme,
    //Full scheme in /examples/theme
  }),
  { model, history }
)

console.log(result.value)
```

## [Documentation](https://pmndrs.github.io/prai)

Explore the complete **prai** documentation to learn everything from basic concepts to advanced patterns:

### Getting Started
- **[Introduction](https://pmndrs.github.io/prai/getting-started/introduction)** - Overview of prai concepts and core philosophy
- **[Your First Workflow](https://pmndrs.github.io/prai/getting-started/first-workflow)** - Step-by-step tutorial building a complete brand theme generator
- **[Special Step Types](https://pmndrs.github.io/prai/getting-started/special-step-typestypescript)** - Specialized functions for data processing (`mapStep`, `filterStep`, `combineStep`, etc.)
- **[Advanced Usage](https://pmndrs.github.io/prai/getting-started/advanced-usagetypescript)** - Streaming responses, conditional workflows, model fallbacks, and testing strategies
- **[Best Practices](https://pmndrs.github.io/prai/getting-started/best-practicestypescript)** - Production guidelines and optimization tips

### Core Concepts
- **[Steps](https://pmndrs.github.io/prai/concepts/steptypescript)** - Fundamental building blocks of prai workflows with schema integration and examples
- **[Models](https://pmndrs.github.io/prai/concepts/modeltypescript)** - AI provider abstraction supporting OpenAI, Groq, Gemini, and mock providers
- **[History](https://pmndrs.github.io/prai/concepts/historytypescript)** - Conversation tracking, reference system, subtasks, and multimodal support

