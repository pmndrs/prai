<h1 align="center">prai 🤖</h1>
<h3 align="center">JS Framework for building step-by-step LLM instructions<br>(<ins>pr</ins>ogrammable <ins>ai</ins>)</h3>
<br/>

<p align="center">
  <a href="https://npmjs.com/package/prai" target="_blank">
    <img src="https://img.shields.io/npm/v/prai?style=flat&colorA=000000&colorB=000000" alt="NPM" />
  </a>
  <a href="https://npmjs.com/package/prai" target="_blank">
    <img src="https://img.shields.io/npm/dt/prai.svg?style=flat&colorA=000000&colorB=000000" alt="NPM" />
  </a>
  <a href="https://twitter.com/pmndrs" target="_blank">
    <img src="https://img.shields.io/twitter/follow/pmndrs?label=%40pmndrs&style=flat&colorA=000000&colorB=000000&logo=twitter&logoColor=000000" alt="Twitter" />
  </a>
  <a href="https://discord.gg/ZZjjNvJ" target="_blank">
    <img src="https://img.shields.io/discord/740090768164651008?style=flat&colorA=000000&colorB=000000&label=discord&logo=discord&logoColor=000000" alt="Discord" />
  </a>
</p>

Writing prompts in natural language is great—until they become messy with multiple steps, output format descriptions, and too many lines of text...

With **prai**, prompts become code—structured, maintainable, and debuggable—leading to high-quality, reliable outputs.

```bash
npm install prai
```

Let's look at some **prai** <ins>use cases</ins>.

| Desinging a Homepage       | ![](./diagrams/homepage.png)        |
| -------------------------- | ----------------------------------- |
| Creating a Presentation    | ![](./diagrams/presentation.png)    |
| Creating a Database Schema | ![](./diagrams/database-schema.png) |

We recommend **prai** for problems that are best solved with a structured process, where some steps involve reasoning or decision-making.

### What does it look like?

```ts
import { openai, runTask, step } from 'prai'
import { z } from 'zod'

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

// 3. Create a connection to an LLM inference engine / provider (openai, more support comming soon)
const connection = openai({ model: 'gpt-4.1-mini', apiKey: 'insert key here' })

// 4. Run a task
const result = await runTask(
  connection,
  // 5. Define the goal of the task
  () => `Define a shadcn theme for my brand`,
  async (task) => {
    // 6. First step of the task
    const adjectives = await step(
      task,
      () => `list some adjectives fitting the design of the ${brandName} brand which is a ${brandDescription}`,
      //7. Enforce a strict schema on the output (a list of strings) - LLM will be forced to comply
      z.object({ adjectives: z.array(z.string()) }),
    )

    // 8. Second step—generate a basic theme
    const coreTheme = await step(
      task,
      // 9. Reference previous results, adding them to the message history so the LLM sees the full "chain of steps"
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

    // 10. Final step—expand into a full shadcn theme
    return await step(
      task,
      () => `Expand the ${coreTheme} to a full shadcn theme`,
      z.object({
        background: colorScheme,
        //Full scheme in /examples/theme
      }),
    )
  },
)

console.log(result.value)
```

| Concept | Description                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task    | A task represents a single AI interaction with a specific goal. It manages the conversation context and provides methods to communicate with the AI.                                                                                                                                                                                                                                                           |
| Step    | Steps are the core building blocks for processing data. They allow to structured data based on a natural language prompt while guranteeing the correct structure on the output. By default steps like filter or combine are provided which can be extended to build higher level abstractions. Steps can be chained together to create processing pipelines. Each step creates one or more queries to the LLM. |
| Query   | A query is the request sent to the LLM containing the message history. It includes a unique requestId, taskId, messages array, and returns a result. Steps use queries to communicate with the LLM and process the responses.                                                                                                                                                                                  |
| Data    | The information flowing through steps in a task. This can be imported images, imported audio, imported json data, outputs from previous steps such as raw text, or structured data.                                                                                                                                                                                                                            |

### TODO for release

- rename data -> resource

- prai-trace

- generic caching implementation + implement this caching with the events already send with prai-redis which should allow to continue interrupted tasks and allow interrupting a task for a user request + dont jump into task executions if the task result is already computed to safe time (find the steps/tasks in the cache based on their name which is unqiue inside each process)
- support abstract multiplexing interface with concrete interface for redis (add a "running" event that the current process owner must send every 10 seconds. After a 20 second timeout all other runners will try to take over the process by sending "alive" the first one to be written into the stream will be the new process owner)

- multi-step (concatenate multiple steps into one llm request e.g. allowing to put a thinking step before another step)
- sql step, think/criticise step

- option to use all previous steps in the current task as dependencies (e.g. for the webxr operator)

### Roadmap

- Metrics (prometheus integration for metrics)
- RabbitMQ integration for logging, caching, and multiplexing
- prebuild image & audio embeddings for reuse
- RAG step?
- toolStep (support tool calls to build agent steps; make sure we can do a multi-step with a tool call and then e.g. a json result for e.g. returning specific data from a general search)
- try out the concept of interleaved multi step (basically have the grammar enforce a thinking structure - same as multi step but giving the invidiual thinking steps inside the grammar and not in the instructions at the start)
