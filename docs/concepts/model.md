---
title: Models
description: What is a prai model?
nav: 12
---

# Models

Models in prai represent AI providers and handle the communication with AI services. They abstract away provider-specific details while providing a consistent interface for all AI interactions.

## Core Concepts

A Model consists of a **Provider** (the AI service e.g. OpenAI, Groq, Gemini) and the **Model Name** (the specific model to use).

## Basic Usage

```typescript
import { Model, openai } from 'prai'

const model = new Model({
  name: 'gpt-4.1-mini',
  provider: openai({ apiKey: process.env.OPENAI_API_KEY })
})

// Use the model in steps
const result = await step(
  'Generate a product description',
  productSchema,
  { model, history }
)
```

## Supported Providers

### OpenAI

```typescript
import { openai } from 'prai'

const openaiModel = new Model({
  name: '...', 
  provider: openai({
    apiKey: process.env.API_KEY
  })
})
```

### Groq

```typescript
import { groq } from 'prai'

const groqModel = new Model({
  name: '...',
  provider: groq({
    apiKey: process.env.API_KEY
  })
})
```

### Google Gemini

```typescript
import { gemini } from 'prai'

const geminiModel = new Model({
  name: '...',
  provider: gemini({
    apiKey: process.env.API_KEY
  })
})
```

### Mock Provider

For testing and development:

```typescript
import { mock } from 'prai'

const mockModel = new Model({
  name: 'test-model',
  provider: mock()
})

// Returns predictable responses for testing
const result = await step(
  'Test prompt',
  z.object({ message: z.string() }),
  { model: mockModel }
)
// Result: { message: "mock response" }
```
