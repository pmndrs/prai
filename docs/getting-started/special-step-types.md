# Special Step Types

**prai** provides specialized step functions beyond the basic `step()` function for common data processing patterns. These functions make it easy to work with arrays, filter data, combine results, and perform other operations in AI workflows.

## Overview

Special step types handle common patterns that would otherwise require complex prompting:

- **`mapStep`** - Process arrays of data with consistent prompts
- **`filterStep`** - Filter arrays based on AI-powered criteria
- **`combineStep`** - Merge multiple data sources intelligently
- **`selectStep`** - Choose the best option from alternatives
- **`allStep`** - Check if all items meet criteria
- **`someStep`** - Check if any items meet criteria
- **`joinStep`** - Join data with intelligent matching
- **`separateStep`** - Split data into categories
- **`listStep`** - Generate lists based on criteria

## Map Step

Process arrays of data with consistent prompts applied to each element.

```typescript
import { mapStep } from 'prai'

const products = [
  { name: 'Laptop', category: 'Electronics', price: 999 },
  { name: 'Coffee Mug', category: 'Kitchen', price: 15 },
  { name: 'Notebook', category: 'Office', price: 5 }
]

const descriptions = await mapStep(
  products,
  (product) => `Write a marketing description for ${product.name} in the ${product.category} category, priced at $${product.price}`,
  z.object({
    description: z.string(),
    keyFeatures: z.array(z.string()),
    targetAudience: z.string(),
    marketingTags: z.array(z.string())
  }),
  { model, history }
)

console.log(descriptions)
// Array of descriptions, one for each product
```

### Map Step Options

```typescript
const results = await mapStep(
  data,
  (item) => `Process ${item.name}`,
  resultSchema,
  { 
    model, 
    history,
    stream: true // Optional: enable streaming
  }
)
```

## Filter Step

Filter arrays based on AI-powered criteria that would be difficult to express programmatically.

```typescript
import { filterStep } from 'prai'

const articles = [
  { title: 'AI in Healthcare', content: 'Machine learning is revolutionizing...' },
  { title: 'Best Coffee Recipes', content: 'Start your morning with...' },
  { title: 'Quantum Computing Basics', content: 'Quantum mechanics meets...' },
  { title: 'Cooking with Python', content: 'A cookbook for programmers...' }
]

const techArticles = await filterStep(
  articles,
  (article) => `Is this ${article} about technology or programming?"`,
  z.boolean(),
  { model, history }
)

console.log(techArticles)
// Only articles that the AI determined were about technology
// Expected: AI in Healthcare, Quantum Computing Basics, Cooking with Python
```

### Complex Filtering

```typescript
const candidates = [
  { name: 'Alice', experience: '5 years React, 3 years Node.js', education: 'CS Degree' },
  { name: 'Bob', experience: '2 years Python, ML research', education: 'PhD Physics' },
  { name: 'Carol', experience: '8 years backend, team lead', education: 'Bootcamp grad' }
]

const suitable = await filterStep(
  candidates,
  (candidate) => `Is this ${candidate} suitable for a senior full-stack role requiring leadership experience?`,
  z.object({
    suitable: z.boolean(),
    reasoning: z.string()
  }),
  { model, history }
)
```

## Combine Step

Intelligently merge multiple data sources or combine related information.

```typescript
import { combineStep } from 'prai'

const userFeedback = [
  'Great product, love the design!',
  'Shipping was slow but quality is good',
  'Customer service needs improvement',
  'Best purchase I made this year'
]

const analyticsData = {
  sessions: 1000,
  bounceRate: 0.3,
  avgSessionTime: 120,
  conversionRate: 0.05
}

const competitorData = {
  pricing: { average: 49.99, range: '29.99-79.99' },
  features: ['feature1', 'feature2', 'feature3'],
  marketShare: 0.15
}

const report = await combineStep(
  [userFeedback, analyticsData, competitorData],
  'Create a comprehensive product performance report combining user feedback, analytics, and competitive analysis',
  z.object({
    overallSummary: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    recommendations: z.array(z.object({
      action: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
      reasoning: z.string()
    })),
    competitivePosition: z.string()
  }),
  { model, history }
)
```

## Select Step

Choose the best option from a set of alternatives based on given criteria.

```typescript
import { selectStep } from 'prai'

const designOptions = [
  { 
    name: 'Modern Minimalist', 
    colors: ['#000000', '#ffffff', '#f5f5f5'], 
    style: 'clean, minimal, lots of whitespace',
    targetAudience: 'professionals, millennials'
  },
  { 
    name: 'Vibrant Creative', 
    colors: ['#ff6b6b', '#4ecdc4', '#45b7d1'], 
    style: 'colorful, energetic, playful',
    targetAudience: 'creatives, young adults'
  },
  { 
    name: 'Corporate Professional', 
    colors: ['#2c3e50', '#3498db', '#95a5a6'], 
    style: 'conservative, trustworthy, formal',
    targetAudience: 'enterprises, executives'
  }
]

const selectedDesign = await selectStep(
  designOptions,
  'Select the best design for a tech startup targeting young professionals who value both innovation and professionalism',
  { model, history }
)

console.log('Selected design:', selectedDesign)
// Returns the full design object that best matches the criteria
```

### Select with Custom Scoring

```typescript
const bestCandidate = await selectStep(
  candidates,
  'Select the best candidate for a senior developer role, considering technical skills, leadership experience, and cultural fit',
  { 
    model, 
    history,
    stream: false // Disable streaming for selection
  }
)
```

## All Step

Check if all items in an array meet specific criteria.

```typescript
import { allStep } from 'prai'

const documents = [
  { title: 'Privacy Policy', content: '...' },
  { title: 'Terms of Service', content: '...' },
  { title: 'User Guide', content: '...' }
]

const allCompliant = await allStep(
  documents,
  (doc) => `Is this document GDPR compliant? Check for privacy controls, data handling, and user rights. Document: ${doc.title}`,
  z.object({
    compliant: z.boolean(),
    issues: z.array(z.string()).optional()
  }),
  { model, history }
)

console.log('All documents compliant:', allCompliant)
// Returns true only if ALL documents are compliant
```

## Some Step

Check if any items in an array meet specific criteria.

```typescript
import { someStep } from 'prai'

const emails = [
  { subject: 'Meeting reminder', content: 'Don\'t forget about tomorrow\'s meeting' },
  { subject: 'URGENT: Action required', content: 'Your account will be suspended...' },
  { subject: 'Newsletter', content: 'Here are this week\'s updates...' }
]

const hasUrgent = await someStep(
  emails,
  (email) => `Is this ${email} urgent and requiring immediate action?`,
  z.boolean(),
  { model, history }
)

if (hasUrgent) {
  console.log('You have urgent emails requiring attention')
}
```

## Join Step

Join or match data from different sources based on intelligent criteria.

```typescript
import { joinStep } from 'prai'

const customers = [
  { id: 1, name: 'John Smith', company: 'Acme Corp' },
  { id: 2, name: 'Jane Doe', company: 'Tech Solutions' }
]

const orders = [
  { orderId: 'A123', customerInfo: 'J. Smith from Acme', amount: 500 },
  { orderId: 'B456', customerInfo: 'Jane D. - Tech Solutions Inc', amount: 750 }
]

const joined = await joinStep(
  customers,
  orders,
  (customer, order) => `Do this ${customer} and ${order} belong to the same person?`,
  z.object({
    customer: z.object({
      id: z.number(),
      name: z.string(),
      company: z.string()
    }),
    order: z.object({
      orderId: z.string(),
      customerInfo: z.string(),
      amount: z.number()
    }),
    confidence: z.number().min(0).max(1)
  }),
  { model, history }
)
```

## Separate Step

Split data into different categories based on AI analysis.

```typescript
import { separateStep } from 'prai'

const mixedContent = [
  { text: 'Great product, highly recommend!' },
  { text: 'Terrible quality, waste of money' },
  { text: 'The sky is blue today' },
  { text: 'Amazing customer service' }
]

const separated = await separateStep(
  mixedContent,
  (item) => `Categorize this text: ${item.text}`,
  z.enum(['positive_review', 'negative_review', 'neutral_comment', 'unrelated']),
  { model, history }
)

console.log(separated)
// {
//   positive_review: [{ text: 'Great product...' }, { text: 'Amazing customer...' }],
//   negative_review: [{ text: 'Terrible quality...' }],
//   neutral_comment: [],
//   unrelated: [{ text: 'The sky is blue...' }]
// }
```

## List Step

Generate lists based on criteria or context.

```typescript
import { listStep } from 'prai'

const projectContext = {
  type: 'e-commerce website',
  target: 'small businesses',
  timeline: '3 months',
  budget: 'medium'
}

const tasks = await listStep(
  `Generate a comprehensive task list for developing ${projectContext.type} targeting ${projectContext.target} with a ${projectContext.timeline} timeline and ${projectContext.budget} budget`,
  z.object({
    phase: z.string(),
    task: z.string(),
    estimatedHours: z.number(),
    priority: z.enum(['high', 'medium', 'low']),
    dependencies: z.array(z.string()).optional()
  }),
  { model, history }
)

console.log(tasks)
// Returns array of task objects
```