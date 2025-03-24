import { runTask, step, mock } from 'prai'
import { z } from 'zod'

const brandName = `pmndrs`
const brandDescription = `Open source developer collective`

const colorScheme = z
  .tuple([
    z.number().describe('hue in degree (0-360)'),
    z.number().describe('saturation in percent (0-100)'),
    z.number().describe('lightness in percent (0-100)'),
  ])
  .describe('hsl color')

const result = await runTask(
  mock(), //vllm({ baseURL: "...", model: "...", apiKey: "..." }),
  () => `Define a shadcn theme for my brand`,
  async (task) => {
    const adjectives = step(
      task,
      () => `list some adjectives fitting the design of the ${brandName} brand which is a ${brandDescription}`,
      z.array(z.string()),
    )
    const coreTheme = step(
      task,
      () => `Based on the ${adjectives}, derive fitting color theme`,
      z.object({
        background: colorScheme,
        foreground: colorScheme,
        primary: colorScheme,
        secondary: colorScheme,
        accent: colorScheme,
        border: colorScheme,
        radius: z.number().describe('radius in rem'),
      }),
    )

    return step(
      task,
      () => `Expand the ${coreTheme} to a full shadcn theme`,
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

console.log(result.value)
