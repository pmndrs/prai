---
title: Steps
description: What is a prai step?
nav: 11
---

# Steps

Steps are the fundamental building blocks of prai workflows. Each step represents a single instruction to an AI model with a defined input prompt and expected output schema.

## Basic Step Structure

Executing a step requires 3 things:

1. **Prompt**: Natural language instruction for the AI
2. **Schema**: Zod schema defining the expected output structure
3. **Options**: Configuration including model, history, and other settings

```typescript
import { step } from 'prai'
import { z } from 'zod'

const result = await step(
  'Generate a product description for a wireless headphone',  // Prompt
  z.object({                                                  // Schema
    name: z.string(),
    description: z.string(),
    features: z.array(z.string())
  }),
  { model, history }                                         // Options
)
```

## Step Options

### Core Options

- **`model`**: The AI model to use for this step
- **`history`**: History object to track conversation flow
- **`abortSignal`**: AbortSignal for canceling the step
- **`systemPrompt`**: System-level instructions for the AI

```typescript
const result = await step(
  'Analyze this data and provide insights',
  analysisSchema,
  {
    model: smartModel,
    history: workflowHistory,
    systemPrompt: 'You are a data analyst expert. Provide detailed insights.',
    abortSignal: controller.signal
  }
)
```

### Examples

Provide examples to guide the AI's output:

```typescript
const result = await step(
  'Classify the sentiment of this text',
  z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number()
  }),
  {
    model,
    history,
    examples: [
      {
        input: 'I love this product!',
        output: { sentiment: 'positive', confidence: 0.9 },
        reason: 'Contains strong positive language'
      },
      {
        input: 'This is okay, I guess',
        output: { sentiment: 'neutral', confidence: 0.6 },
        reason: 'Lukewarm, non-committal language'
      }
    ]
  }
)
```

### Streaming

Enable streaming for real-time responses:

```typescript
// Basic streaming
const stream = step(
  'Write a long article about AI',
  z.object({ title: z.string(), content: z.string() }),
  { model, history, stream: true }
)

for await (const chunk of stream) {
  process.stdout.write(chunk)
}

const result = await stream.getValue()
```

## Schema Integration

Steps use Zod schemas to ensure type safety and guide AI output:

```typescript
// Simple schema
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0).max(120)
})

// Complex nested schema
const projectSchema = z.object({
  title: z.string().describe('Project title'),
  description: z.string().describe('Detailed project description'),
  tasks: z.array(z.object({
    name: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    estimatedHours: z.number().positive()
  })).describe('List of project tasks'),
  deadline: z.string().datetime().optional()
})

const project = await step(
  'Create a project plan for building a mobile app',
  projectSchema,
  { model, history }
)
```

## Specialized Steps

**prai** provides specialized step functions for common patterns like processing arrays, filtering data, and combining results - see [Special Step Types](../getting-started/special-step-types.md).