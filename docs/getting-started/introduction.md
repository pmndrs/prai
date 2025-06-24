# Introduction to prai

**prai** (programmable ai) is a JavaScript framework for building step-by-step LLM instructions. It transforms messy natural language prompts into structured, maintainable, and debuggable code, leading to high-quality, reliable outputs.


```bash
npm install prai
# or
pnpm add prai
```

## Quick Example

Here's a simple example that generates brand adjectives and creates a color theme:

```typescript
import { History, Model, openai, step } from 'prai'
import { z } from 'zod'

// Create a model
const model = new Model({
  name: 'gpt-4.1-mini',
  provider: openai({ apiKey: process.env.OPENAI_API_KEY })
})

// Create history to track the workflow
const history = new History()

// Step 1: Generate brand adjectives
const adjectives = await step(
  `List some adjectives fitting the design of the pmndrs brand which is a open source developer collective`,
  z.array(z.string()),
  { model, history }
)

// Step 2: Create a color theme based on the adjectives
const theme = await step(
  `Based on the ${history.reference(adjectives)}, derive a fitting color theme`,
  z.object({
    primary: z.string().describe('hex color'),
    secondary: z.string().describe('hex color'),
    accent: z.string().describe('hex color')
  }),
  { model, history }
)

console.log(theme)
// { primary: "#1a1a1a", secondary: "#f0f0f0", accent: "#ff6b6b" }
```

## Why prai?

Writing prompts in natural language is great—until they become messy with multiple steps, output format descriptions, and too many lines of text. **prai** solves this by making prompts into code that is:

- **Structured**: Break complex tasks into clear, sequential steps
- **Maintainable**: Code is easier to version, review, and modify than long text prompts
- **Debuggable**: Track execution history and see exactly what happened at each step
- **Type-safe**: Use Zod schemas to enforce strict output formats
- **Reliable**: Get consistent, predictable results from your AI workflows

## Core Concepts

### Steps
Steps are the fundamental building blocks of prai. Each step represents a single instruction to an AI model with a defined input prompt and expected output schema.

### History
History tracks the conversation flow between steps, allowing later steps to reference results from previous steps. This creates a coherent workflow where each step builds upon previous results.

### Models
Models represent AI providers (OpenAI, Groq, Gemini) and handle the actual communication with AI services. They abstract away provider-specific details.

### Schemas
Schemas define the expected structure of outputs using Zod. This ensures type safety and forces the AI to return data in the exact format you need.

## When to Use prai

We recommend **prai** for problems that are best solved with a structured process, where some steps involve reasoning or decision-making. Examples include:

- **Content Generation**: Creating structured content like presentations, documentation, or marketing materials
- **Data Processing**: Analyzing, transforming, or extracting insights from data
- **Design Systems**: Generating themes, color schemes, or design specifications
- **Decision Workflows**: Multi-step reasoning processes that require intermediate results


## Next Steps

- [First Workflow](./first-workflow.md) - Build your first complete prai workflow
- [Special Step Types](./special-step-types.md) - Learn about specialized functions for data processing
- [Advanced Usage](./advanced-usage.md) - Learn about advanced features and patterns
- [Best Practices](./best-practices.md) - Production guidelines and optimization tips
- [Core Concepts](../concepts/) - Deep dive into prai's architecture

