import { vllm, task, step, mock } from 'prai'
import { array, number, object, string, tuple } from 'zod'

const brandName = `pmndrs`
const brandDescription = `Open source developer collective`

const colorScheme = tuple([
  number().describe('hue in degree (0-360)'),
  number().describe('saturation in percent (0-100)'),
  number().describe('lightness in percent (0-100)'),
]).describe('hsl color')

const result = await task(
  mock(), //vllm({ baseURL: "...", model: "...", apiKey: "..." }),
  () => `Define a shadcn theme for my brand`,
  async (task) => {
    const adjectives = step(
      task,
      () => `list some adjectives fitting the design of the ${brandName} brand which is a ${brandDescription}`,
      array(string()),
    )
    const coreTheme = step(
      task,
      () => `Based on the ${adjectives}, derive fitting color theme`,
      object({
        background: colorScheme,
        foreground: colorScheme,
        primary: colorScheme,
        secondary: colorScheme,
        accent: colorScheme,
        border: colorScheme,
        radius: number().describe('radius in rem'),
      }),
    )

    return step(
      task,
      () => `Expand the ${coreTheme} to a full shadcn theme`,
      object({
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
        radius: number().describe('radius in rem'),
      }),
    )
  },
)

console.log(result.value)
