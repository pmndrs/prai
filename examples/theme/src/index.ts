import { History, Model, step, buildSimplePrice, groq } from 'prai'
import { z } from 'zod'
import { redisLogger } from 'prai-redis'
import { createClient } from 'redis'
import { setTimeout } from 'node:timers/promises'

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
const model = new Model({
  /*name: 'gemini-2.5-flash',
  provider: gemini({ apiKey: process.env.GEMINI_API_KEY }),
  price: buildSimplePrice(0.3, 2.5),
  thinkingConfig: { thinkingBudget: 0, includeThoughts: false },*/
  /*name: 'gpt-4.1-mini',
  provider: openai({ apiKey: process.env.OPENAI_API_KEY }),
  price: buildSimplePrice(0.4, 1.6),*/
  name: 'meta-llama/llama-4-scout-17b-16e-instruct',
  provider: groq({ apiKey: process.env.GROQ_API_KEY }),
  price: buildSimplePrice(0.11, 0.34),
})

// 4. create a chat history
const history = new History()
const client = createClient({ url: process.env.REDIS_URL })
await client.connect()
await redisLogger(history, { streamName: 'stream-name', client })

// 5. First step
const adjectives = await step(
  //6. Enforce a strict schema on the output (a list of strings) - LLM will be forced to comply
  `list some adjectives fitting the design of the ${brandName} brand which is a ${brandDescription}`,
  z.array(z.string()),
  { model, history },
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
    radius: z.number().describe('border radius in rem: 0 means sharp corners, 1 means very rounded corners'),
  }),
  { model, history },
)

// 10. Final step—expand into a full shadcn theme
const result = await step(
  `Expand the ${history.reference(coreTheme)} to a full shadcn theme`,
  z.object({
    background: colorScheme,
    foreground: colorScheme,
    card: colorScheme,
    cardForeground: colorScheme,
    popover: colorScheme,
    popoverForeground: colorScheme,
    primary: colorScheme,
    primaryForeground: colorScheme,
    secondary: colorScheme,
    secondaryForeground: colorScheme,
    muted: colorScheme,
    mutedForeground: colorScheme,
    accent: colorScheme,
    accentForeground: colorScheme,
    destructive: colorScheme,
    destructiveForeground: colorScheme,
    border: colorScheme,
    input: colorScheme,
    ring: colorScheme,
    radius: z.number().describe('radius in rem'),
  }),
  { model, history },
)

// Convert HSL color to OKLCH string
function hsl(color: { hue: number; saturation: number; lightness: number }): string {
  return `hsl(${color.hue}, ${color.saturation}%, ${color.lightness}%)`
}

// Format the theme as CSS variables
function formatThemeAsCss(theme: typeof result): string {
  let css = `:root {\n`
  css += `  --radius: ${theme.radius}rem;\n`
  css += `  --background: ${hsl(theme.background)};\n`
  css += `  --foreground: ${hsl(theme.foreground)};\n`
  css += `  --card: ${hsl(theme.card)};\n`
  css += `  --card-foreground: ${hsl(theme.cardForeground)};\n`
  css += `  --popover: ${hsl(theme.popover)};\n`
  css += `  --popover-foreground: ${hsl(theme.popoverForeground)};\n`
  css += `  --primary: ${hsl(theme.primary)};\n`
  css += `  --primary-foreground: ${hsl(theme.primaryForeground)};\n`
  css += `  --secondary: ${hsl(theme.secondary)};\n`
  css += `  --secondary-foreground: ${hsl(theme.secondaryForeground)};\n`
  css += `  --muted: ${hsl(theme.muted)};\n`
  css += `  --muted-foreground: ${hsl(theme.mutedForeground)};\n`
  css += `  --accent: ${hsl(theme.accent)};\n`
  css += `  --accent-foreground: ${hsl(theme.accentForeground)};\n`
  css += `  --destructive: ${hsl(theme.destructive)};\n`
  css += `  --destructive-foreground: ${hsl(theme.destructiveForeground)};\n`
  css += `  --border: ${hsl(theme.border)};\n`
  css += `  --input: ${hsl(theme.input)};\n`
  css += `  --ring: ${hsl(theme.ring)};\n`
  css += `}\n\n`

  css += `.dark {\n`
  css += `  --radius: ${theme.radius}rem;\n`
  css += `  --background: ${hsl(theme.background)};\n`
  css += `  --foreground: ${hsl(theme.foreground)};\n`
  css += `  --card: ${hsl(theme.card)};\n`
  css += `  --card-foreground: ${hsl(theme.cardForeground)};\n`
  css += `  --popover: ${hsl(theme.popover)};\n`
  css += `  --popover-foreground: ${hsl(theme.popoverForeground)};\n`
  css += `  --primary: ${hsl(theme.primary)};\n`
  css += `  --primary-foreground: ${hsl(theme.primaryForeground)};\n`
  css += `  --secondary: ${hsl(theme.secondary)};\n`
  css += `  --secondary-foreground: ${hsl(theme.secondaryForeground)};\n`
  css += `  --muted: ${hsl(theme.muted)};\n`
  css += `  --muted-foreground: ${hsl(theme.mutedForeground)};\n`
  css += `  --accent: ${hsl(theme.accent)};\n`
  css += `  --accent-foreground: ${hsl(theme.accentForeground)};\n`
  css += `  --destructive: ${hsl(theme.destructive)};\n`
  css += `  --destructive-foreground: ${hsl(theme.destructiveForeground)};\n`
  css += `  --border: ${hsl(theme.border)};\n`
  css += `  --input: ${hsl(theme.input)};\n`
  css += `  --ring: ${hsl(theme.ring)};\n`
  css += `}\n`

  return css
}

// Log the theme in CSS format
console.log(formatThemeAsCss(result))

setTimeout(500)

await client.disconnect()

console.log(`Overall Costs: ${history.getCost()}$`)

//import into https://tweakcn.com/editor/theme to visualize
