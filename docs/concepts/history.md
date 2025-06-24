# History

History is **prai**'s conversation tracking system that maintains context across multiple steps, enabling complex workflows where later steps can reference and build upon previous results.

## Core Concepts

History serves several key functions:

1. **Context Preservation**: Maintains conversation flow between AI interactions
2. **Reference System**: Allows steps to reference previous results
3. **State Management**: Tracks workflow state and enables serialization
4. **Event System**: Provides observability into workflow execution

## Basic Usage

```typescript
import { History } from 'prai'

// Create a new history instance
const history = new History()

// Use history in steps
const analysis = await step(
  'Analyze this market data',
  analysisSchema,
  { model, history }
)

const recommendations = await step(
  `Based on ${history.reference(analysis)}, provide recommendations`,
  recommendationsSchema,
  { model, history }
)
```

## Reference System

The reference system allows steps to refer to previous results in a natural way:

### Basic References

```typescript
const userProfile = await step(
  'Create a user profile',
  z.object({
    name: z.string(),
    interests: z.array(z.string()),
    experience: z.string()
  }),
  { model, history }
)

const recommendations = await step(
  `Given the user profile from ${history.reference(userProfile)}, suggest relevant content`,
  z.array(z.object({
    title: z.string(),
    reason: z.string()
  })),
  { model, history }
)
```

### Custom References

Add custom data to history with descriptions:

```typescript
// Add external data to history
const marketData = { revenue: 1000000, growth: 0.15, customers: 5000 }
const dataRef = history.add(marketData, {
  description: 'Q3 market performance data',
  type: 'data'
})

const analysis = await step(
  `Analyze this market data: ${dataRef}`,
  analysisSchema,
  { model, history }
)
```

### Derived References

Reference data that's derived from other data:

```typescript
const salesData = await step('Get sales data', salesSchema, { model, history })

const processedData = processSalesData(salesData)
const processedRef = history.add(processedData, {
  derived: { from: salesData, by: 'data processing pipeline' },
  description: 'Processed sales metrics'
})

const insights = await step(
  `Generate insights from ${processedRef}`,
  insightsSchema,
  { model, history }
)
```

## Multimodal Support

History supports various data types including images and audio:

### Images

```typescript
// Add image data
history.add(imageBuffer, {
  type: 'image',
  description: 'Product photo for analysis'
})

const analysis = await step(
  `Analyze this product image: ${history.reference(imageBuffer)}. Describe the product and its features.`,
  z.object({
    productType: z.string(),
    features: z.array(z.string()),
    suggestions: z.array(z.string())
  }),
  { model, history }
)
```

### Audio

```typescript
// Add audio data
history.add(audioBuffer, {
  type: 'wav',
  description: 'Customer feedback recording'
})

const transcription = await step(
  `Transcribe and analyze this audio: ${history.reference(audioBuffer)}`,
  z.object({
    transcription: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    keyTopics: z.array(z.string())
  }),
  { model, history }
)
```

## Subtasks

Subtasks allow you to create isolated workflows within a larger history:

```typescript
const history = new History()

// Run parallel subtasks
const [brandAnalysis, marketAnalysis] = await Promise.all([
  history.subtask('Brand analysis', async (subHistory) => {
    const brandData = await step(
      'Analyze brand positioning',
      brandSchema,
      { model, history: subHistory }
    )
    
    const brandInsights = await step(
      `Generate insights from ${subHistory.reference(brandData)}`,
      insightsSchema,
      { model, history: subHistory }
    )
    
    return brandInsights
  }),
  
  history.subtask('Market analysis', async (subHistory) => {
    const marketData = await step(
      'Analyze market conditions',
      marketSchema,
      { model, history: subHistory }
    )
    
    return marketData
  })
])

// Combine subtask results in main history
const strategy = await step(
  `Create strategy based on:
   - Brand analysis: ${history.reference(brandAnalysis)}
   - Market analysis: ${history.reference(marketAnalysis)}`,
  strategySchema,
  { model, history }
)
```

## State Management

### Serialization

History can be serialized and restored:

```typescript
// Save history state
const historyState = history.getState()
const serialized = JSON.stringify(historyState)

// Later, restore history
const restoredHistory = new History()
restoredHistory.setState(JSON.parse(serialized))
```

## Event System

History provides an event system for observability:

```typescript
import { consoleLogger } from 'prai'

const history = new History()

// Built-in console logger
consoleLogger(history)

// Custom event handling
history.addEventListener('step-request', (event) => {
  console.log('Step started:', event.historyId)
})

history.addEventListener('step-response', (event) => {
  console.log('Step completed:', event.historyId)
})

history.addEventListener('step-error', (event) => {
  console.error('Step failed:', event.error)
})

history.addEventListener('data-reference-added', (event) => {
  console.log('Data added to history')
})

history.addEventListener('subtask-start', (event) => {
  console.log('Subtask started:', event.subtaskHistoryId)
})
```