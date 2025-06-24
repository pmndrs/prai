---
title: Advanced Usage
description: advanced prai features including streaming responses, conditional workflows, model fallbacks, and testing strategies
nav: 4
---

# Advanced Usage

This guide covers advanced **prai** features and patterns for building advanced AI workflows.

## Streaming Responses

**prai** supports streaming responses for real-time feedback during long-running operations.

### Basic Streaming

```typescript
import { step } from 'prai'
import { z } from 'zod'

const stream = step(
  'Write a detailed blog post about AI in software development',
  z.object({
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string())
  }),
  { 
    model, 
    history, 
    stream: true // Enable streaming
  }
)

// Process chunks as they arrive
for await (const chunk of stream) {
  process.stdout.write(chunk)
}

// Get the final parsed result
const result = await stream.getValue()
console.log('Final result:', result)
```

### Custom Stream Processing

```typescript
// Transform stream data as it arrives
const customStream = step(
  'Generate a list of programming concepts',
  z.array(z.string()),
  {
    model,
    history,
    stream: (input: AsyncIterable<string>) => {
      return (async function* () {
        let buffer = ''
        for await (const chunk of input) {
          buffer += chunk
          // Emit progress updates
          yield { type: 'progress', content: chunk, totalLength: buffer.length }
        }
        yield { type: 'complete', totalLength: buffer.length }
      })()
    }
  }
)

for await (const event of customStream) {
  if (event.type === 'progress') {
    console.log(`Received ${event.content.length} characters...`)
  } else if (event.type === 'complete') {
    console.log(`Stream complete! Total: ${event.totalLength} characters`)
  }
}
```

## Testing with Mock Provider

For testing workflows, use the mock provider. See [Models - Mock Provider](../concepts/model.md#mock-provider) for complete documentation.

```typescript
import { mock } from 'prai'

const mockModel = new Model({
  name: 'test',
  provider: mock()
})

// Mock provider returns predictable responses for testing
const testResult = await step(
  'Test prompt',
  z.object({ message: z.string() }),
  { model: mockModel }
)

console.log(testResult) // { message: "mock response" }
```


## Conditional Workflows

Build workflows that branch based on previous results:

```typescript
const assessment = await step(
  'Assess the complexity of this task',
  z.object({
    complexity: z.enum(['simple', 'moderate', 'complex']),
    reasoning: z.string()
  }),
  { model, history }
)

let result
if (assessment.complexity === 'simple') {
  result = await step(
    'Provide a simple solution',
    simpleSchema,
    { model, history }
  )
} else if (assessment.complexity === 'moderate') {
  result = await step(
    'Provide a detailed solution',
    detailedSchema,
    { model, history }
  )
} else {
  // Complex case - use subtasks
  result = await history.subtask('Complex analysis', async (subHistory) => {
    const breakdown = await step(
      'Break down the complex task',
      breakdownSchema,
      { model, history: subHistory }
    )
    
    const solutions = await Promise.all(
      breakdown.subtasks.map(subtask =>
        step(
          `Solve: ${subtask}`,
          solutionSchema,
          { model, history: subHistory }
        )
      )
    )
    
    return step(
      `Combine solutions: ${subHistory.reference(solutions)}`,
      combinedSchema,
      { model, history: subHistory }
    )
  })
}
```


## Model Fallback

Implement fallback mechanisms for reliability:

```typescript
async function robustStep<T>(
  prompt: string,
  schema: z.Schema<T>,
  options: any
): Promise<T> {
  const models = [
    new Model({ name: '...', provider: openai({ apiKey: process.env.OPENAI_API_KEY }) }),
    new Model({ name: '...', provider: groq({ apiKey: process.env.GROQ_API_KEY }) }),
    new Model({ name: '...', provider: gemini({ apiKey: process.env.GEMINI_API_KEY }) })
  ]
  
  for (const model of models) {
    try {
      return await step(prompt, schema, { ...options, model })
    } catch (error) {
      console.warn(`Model ${model.options.name} failed:`, error.message)
    }
  }
  
  throw new Error('All models failed')
}
```

## Dynamic Model Selection

Choose models based on task characteristics:

```typescript
function selectModel(taskComplexity: 'simple' | 'moderate' | 'complex') {
  switch (taskComplexity) {
    case 'simple':
      return new Model({
        name: '...',
        provider: openai({ apiKey: process.env.OPENAI_API_KEY })
      })
    case 'moderate':
      return new Model({
        name: '...',
        provider: groq({ apiKey: process.env.GROQ_API_KEY })
      })
    case 'complex':
      return new Model({
        name: '...',
        provider: openai({ apiKey: process.env.OPENAI_API_KEY })
      })
  }
}

const model = selectModel('complex')
const result = await step(complexPrompt, complexSchema, { model, history })
```



## Dynamic Schema Generation

Generate schemas based on runtime data:

```typescript
function createProductSchema(categories: string[]) {
  return z.object({
    name: z.string(),
    category: z.enum(categories as [string, ...string[]]),
    price: z.number().positive(),
    description: z.string()
  })
}

const availableCategories = ['electronics', 'clothing', 'books']
const productSchema = createProductSchema(availableCategories)

const product = await step(
  'Generate a product listing',
  productSchema,
  { model, history }
)
```

