import { runTask, step, openai } from 'prai'
import { z } from 'zod'

const brandName = `pmndrs`
const brandDescription = `Open Source Developer Collective`

const colorScheme = z
  .object({
    hue: z.number().describe('in degree (0-360)'),
    saturation: z.number().describe('in percent (0-100)'),
    lightness: z.number().describe('in percent (0-100)'),
  })
  .describe('hsl color')

const result = await runTask(
  openai({
    model: 'gpt-4.1',
    systemPrompt: 'you are an expert designer for modern trendy websites',
    apiKey: 'api key', //TODO
  }),
  () => `Define a shadcn theme for my brand`,
  async (task) => {
    const adjectives = await step(
      task,
      () => `list some adjectives fitting the design of the ${brandName} brand which is a ${brandDescription}`,
      z.object({ adjectives: z.array(z.string()) }),
    )
    const coreTheme = await step(
      task,
      () => `Based on the ${adjectives}, derive a fitting color theme for a modern web design`,
      z.object({
        background: colorScheme,
        foreground: colorScheme,
        primary: colorScheme,
        secondary: colorScheme,
        accent: colorScheme,
        border: colorScheme,
        radius: z.number().describe('border radius in rem: 0 means sharp corners, 1 means very rounded corners'),
      }),
    )

    return step(
      task,
      () => `Expand the ${coreTheme} to a full shadcn theme for a modern web design with well designed contrasts`,
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
    )
  },
)

// Convert HSL color to OKLCH string
function hsl(color: { hue: number; saturation: number; lightness: number }): string {
  return `hsl(${color.hue}, ${color.saturation}%, ${color.lightness}%)`
}

// Format the theme as CSS variables
function formatThemeAsCss(theme: any): string {
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
console.log(formatThemeAsCss(result.value))

//import into https://tweakcn.com/editor/theme to visualize
