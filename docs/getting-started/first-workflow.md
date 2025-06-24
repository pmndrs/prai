---
title: Your First Workflow
description: Build a complete prai workflow from scratch
nav: 2
---

# Your First prai Workflow

In this tutorial, we'll build a complete workflow that generates a brand theme. This will teach you the fundamental concepts of prai through hands-on practice.

## What We'll Build

We'll create a workflow that:
1. Takes a brand name and description as input
2. Generates fitting adjectives for the brand
3. Creates a core color theme based on those adjectives
4. Expands it into a full design system theme

## Prerequisites

Make sure you have:
- Node.js installed
- An API key from OpenAI, Groq, or Google Gemini

## Setup

First, create a new project and install dependencies:

```bash
mkdir my-prai-workflow
cd my-prai-workflow
npm init -y
npm install prai zod
npm install -D typescript @types/node
```

Create a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Step 1: Basic Setup

Create `src/index.ts`:

```typescript
import { History, Model, openai, step, consoleLogger } from 'prai'
import { z } from 'zod'

// 1. Define your inputs
const brandName = 'Acme Corp'
const brandDescription = 'Innovative software solutions company'

// 2. Create a model with your preferred provider
const model = new Model({
  name: 'gpt-4.1-mini',
  provider: openai({ apiKey: process.env.API_KEY })
})

// 3. Create history to track the workflow
const history = new History()

// 4. Optional: Add logging to see what's happening
consoleLogger(history)

async function main() {
  console.log(`Generating theme for ${brandName}...`)
  
  // We'll add our steps here
}

main().catch(console.error)
```

## Step 2: Generate Brand Adjectives

Add the first step to generate adjectives that describe your brand:

```typescript
// Add this inside the main() function

// Step 1: Generate brand adjectives
const adjectives = await step(
  `List some adjectives fitting the design of the ${brandName} brand which is a ${brandDescription}`,
  z.array(z.string()).describe('List of adjectives that describe the brand'),
  { model, history }
)

console.log('Brand adjectives:', adjectives)
```

## Step 3: Create a Color Scheme

Define a reusable color schema and create a basic theme:

```typescript
// Add this before the main() function

// Reusable schema for HSL colors
const colorScheme = z.object({
  hue: z.number().min(0).max(360).describe('Hue in degrees (0-360)'),
  saturation: z.number().min(0).max(100).describe('Saturation as percentage (0-100)'),
  lightness: z.number().min(0).max(100).describe('Lightness as percentage (0-100)')
}).describe('HSL color representation')

// Add this inside main() after the adjectives step

// Step 2: Create core color theme
const coreTheme = await step(
  `Based on the ${history.reference(adjectives)}, derive a fitting color theme`,
  z.object({
    background: colorScheme,
    foreground: colorScheme,
    primary: colorScheme,
    secondary: colorScheme,
    accent: colorScheme,
    border: colorScheme,
    radius: z.number().min(0).max(2).describe('Border radius in rem units')
  }).describe('Core brand color theme'),
  { model, history }
)

console.log('Core theme:', coreTheme)
```

## Step 4: Expand to Full Theme

Create a comprehensive design system theme:

```typescript
// Add this inside main() after the coreTheme step

// Step 3: Expand to full design system
const fullTheme = await step(
  `Expand the ${history.reference(coreTheme)} to a complete design system theme with all necessary color variants`,
  z.object({
    // Base colors
    background: colorScheme,
    foreground: colorScheme,
    
    // Component colors
    card: colorScheme,
    cardForeground: colorScheme,
    popover: colorScheme,
    popoverForeground: colorScheme,
    
    // Brand colors
    primary: colorScheme,
    primaryForeground: colorScheme,
    secondary: colorScheme,
    secondaryForeground: colorScheme,
    
    // State colors
    muted: colorScheme,
    mutedForeground: colorScheme,
    accent: colorScheme,
    accentForeground: colorScheme,
    destructive: colorScheme,
    destructiveForeground: colorScheme,
    
    // UI colors
    border: colorScheme,
    input: colorScheme,
    ring: colorScheme,
    
    // Design tokens
    radius: z.number().describe('Base border radius in rem')
  }).describe('Complete design system theme'),
  { model, history }
)

console.log('Full theme generated!', fullTheme)
```

## Step 5: Format the Output

Add a utility function to convert the theme to CSS variables:

```typescript
// Add this before main()

function hslToString(color: { hue: number; saturation: number; lightness: number }): string {
  return `${color.hue} ${color.saturation}% ${color.lightness}%`
}

function formatThemeAsCss(theme: typeof fullTheme): string {
  return `
:root {
  --radius: ${theme.radius}rem;
  --background: ${hslToString(theme.background)};
  --foreground: ${hslToString(theme.foreground)};
  --card: ${hslToString(theme.card)};
  --card-foreground: ${hslToString(theme.cardForeground)};
  --popover: ${hslToString(theme.popover)};
  --popover-foreground: ${hslToString(theme.popoverForeground)};
  --primary: ${hslToString(theme.primary)};
  --primary-foreground: ${hslToString(theme.primaryForeground)};
  --secondary: ${hslToString(theme.secondary)};
  --secondary-foreground: ${hslToString(theme.secondaryForeground)};
  --muted: ${hslToString(theme.muted)};
  --muted-foreground: ${hslToString(theme.mutedForeground)};
  --accent: ${hslToString(theme.accent)};
  --accent-foreground: ${hslToString(theme.accentForeground)};
  --destructive: ${hslToString(theme.destructive)};
  --destructive-foreground: ${hslToString(theme.destructiveForeground)};
  --border: ${hslToString(theme.border)};
  --input: ${hslToString(theme.input)};
  --ring: ${hslToString(theme.ring)};
}
`.trim()
}

// Add this at the end of main()
const cssTheme = formatThemeAsCss(fullTheme)
console.log('\nGenerated CSS theme:')
console.log(cssTheme)
```

## Step 6: Run Your Workflow

Set your API key and run the workflow:

```bash
export API_KEY="your-api-key-here"
npx tsx src/index.ts
```

## What You've Learned

Congratulations! You've built your first prai workflow. Here's what you've learned:

1. **Steps**: How to create sequential AI instructions with `step()`
2. **Schemas**: How to use Zod to enforce output structure
3. **History**: How to reference previous results with `history.reference()`
4. **Models**: How to configure AI providers
5. **Logging**: How to debug workflows with `consoleLogger()`

## Next Steps

- Try different AI providers (Groq, Gemini)
- Experiment with more complex schemas
- Learn about [Special Step Types](./special-step-types.md) for data processing
- Learn about [Advanced Usage](./advanced-usage.md) patterns
- Follow [Best Practices](./best-practices.md) for production workflows
- Explore the [Concepts](../concepts/) documentation

