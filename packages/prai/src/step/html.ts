import { StepData, StreamingStepData } from '../data.js'
import { random, randomInt, randomNumber, randomString } from '../random.js'
import { StepFormatOptions, NonStreamingStepOptions, stringStep, StreamingStepOptions } from '../step.js'
import { Task } from '../task.js'
import { booleanGrammar, numberGrammar, stringGrammar } from '../utils.js'

export type HtmlAttributeSchema =
  | {
      type: 'number' | 'string' | 'boolean'
      /**
       * @default false
       */
      optional?: boolean
      description?: string
    }
  | {
      type: 'grammar'
      grammar: string
      mock: (seed: string) => string
      /**
       * @default false
       */
      optional?: boolean
      description?: string
    }

export type HtmlTagsSchema = Record<
  string,
  {
    /**
     * @default true
     * children set to "false" means the tag is self closing
     */
    children?: boolean
    attributes?: Record<string, HtmlAttributeSchema>
    description?: string
  }
>

export function htmlStep(
  task: Task,
  queryPrompt: () => string,
  options: Omit<StreamingStepOptions, 'format'> & {
    tags?: HtmlTagsSchema
    prefixGrammar?: string
    suffixGrammar?: string
  },
): StreamingStepData<string, string>

export function htmlStep(
  task: Task,
  queryPrompt: () => string,
  options?: Omit<NonStreamingStepOptions, 'format'> & {
    tags?: HtmlTagsSchema
    prefixGrammar?: string
    suffixGrammar?: string
  },
): Promise<StepData<string>>

export function htmlStep(
  task: Task,
  queryPrompt: () => string,
  options?: Omit<StreamingStepOptions | NonStreamingStepOptions, 'format'> & {
    tags?: HtmlTagsSchema
    prefixGrammar?: string
    suffixGrammar?: string
  },
): Promise<StepData<string>> | StreamingStepData<string, string>

export function htmlStep(
  task: Task,
  queryPrompt: () => string,
  options?: Omit<StreamingStepOptions | NonStreamingStepOptions, 'format'> & {
    tags?: HtmlTagsSchema
    prefixGrammar?: string
    suffixGrammar?: string
  },
) {
  return stringStep(task, queryPrompt, {
    stream: options?.stream,
    abortSignal: options?.abortSignal,
    examples: options?.examples,
    format: buildHtmlStepFormatOptions(options?.tags),
    mock: (seed) =>
      createHtmlTagsSchemaMock(options?.tags == null ? undefined : Object.keys(options?.tags), options?.tags, seed),
  })
}

const DefaultHtmlGrammar =
  'root ::= tag+\n' +
  'elements ::= ([^<] | tag)*\n' +
  'tag ::= "<" tag-name attributes ("/>" | (">" elements "</>" tag-name ">"))\n' +
  'tag-name ::= [a-zA-Z][a-zA-Z0-9]*\n' +
  'attributes ::= (" " attribute)*\n' +
  'attribute ::= attribute-name "=\\"" attribute-value "\\""\n' +
  'attribute-name ::= [a-zA-Z][a-zA-Z0-9\\-]*\n' +
  'attribute-value ::= [^"]*'

const DefaultHtmlFormatDescription =
  'Generate HTML following these rules:\n' +
  '1. Tags must start with a letter followed by letters or numbers (e.g. div1, span, h1)\n' +
  '2. Attributes must start with a letter followed by letters, numbers or hyphens (e.g. class, data-value)\n' +
  '3. Attribute values must be enclosed in double quotes and can contain any characters except double quotes\n' +
  '4. Tags can be either:\n' +
  '   - Self-closing with />, like <input/>\n' +
  '   - Have content with a matching closing tag, like <div>content</div>\n' +
  '5. Between tags can be any text or nested tags\n' +
  '6. Each tag can have any number of space-separated attributes (e.g. <div class="container" id="main">)'

function buildHtmlStepFormatOptions(tags: HtmlTagsSchema | undefined): StepFormatOptions {
  if (tags == null) {
    return {
      grammar: DefaultHtmlGrammar,
      description: DefaultHtmlFormatDescription,
    }
  }
  return {
    grammar: buildHtmlTagsSchemaGrammar(tags),
    description: buildHtmlTagsSchemaDescription(tags),
  }
}

function buildHtmlTagsSchemaDescription(tags: HtmlTagsSchema, prefix: string = '', suffix: string = ''): string {
  const tagDescriptions = Object.entries(tags)
    .map(([tagName, options]) => {
      const { children = true, attributes, description } = options
      const tagDesc = description ? ` described as ${description}` : ''

      const attributeDescriptions =
        attributes == null
          ? undefined
          : Object.entries(attributes)
              .map(([attributeName, attributeOptions]) => {
                const optional = attributeOptions.optional ?? false
                let typeDesc = ''
                if (attributeOptions.type === 'grammar') {
                  typeDesc = `matching pattern "${attributeOptions.grammar}"`
                } else {
                  typeDesc = `of type ${attributeOptions.type}`
                }
                const attrDesc = attributeOptions.description ? ` described as ${attributeOptions.description}` : ''
                return `${attributeName} (${optional ? 'optional' : 'required'}) ${typeDesc}${attrDesc}`
              })
              .join(', ')

      return `<${tagName}>${tagDesc}\n${attributeDescriptions != null ? `Attributes: ${attributeDescriptions}` : ''}${
        children ? '\nCan contain other tags as children' : '\nSelf-closing tag'
      }`
    })
    .join('\n\n')

  return `Generate HTML with the following structure:
${prefix ? `Must start with: ${prefix}\n` : ''}${suffix ? `Must end with: ${suffix}\n` : ''}
Available tags:
${tagDescriptions}`
}

function buildHtmlTagsSchemaGrammar(tags: HtmlTagsSchema): string {
  return [
    `root ::= tag`,
    `tag ::= ${Object.keys(tags).join(' | ')}`,
    `tags ::= ([^<] | tag)*`,
    `number ::= ${numberGrammar}`,
    `string ::= ${stringGrammar}`,
    `boolean ::= ${booleanGrammar}`,
    ...Object.entries(tags).reduce<Array<string>>((prev, [tagName, options]) => {
      let tagGrammar = `${tagName} ::= "<${tagName}"`
      const { children = false, attributes } = options
      if (attributes != null) {
        for (const [attributeName, attributeOptions] of Object.entries(attributes)) {
          let attributeGrammar = `${tagName}-${attributeName} ::= " ${attributeName}=\\""`
          const optional = attributeOptions.optional ?? false
          tagGrammar += ` ${tagName}-${attributeName}${optional ? '?' : ''}`
          if (attributeOptions.type === 'grammar') {
            attributeGrammar += attributeOptions.grammar
          } else {
            attributeGrammar += attributeOptions.type
          }
          attributeGrammar += `"\\""`
          prev.push(attributeGrammar)
        }
      }
      if (children) {
        tagGrammar += ` ">" tags "</${tagName}>"`
      } else {
        tagGrammar += ` "/>"`
      }
      prev.push(tagGrammar)
      return prev
    }, []),
  ].join('\n')
}

function createHtmlTagsSchemaMock(
  tagNames: Array<string> | undefined,
  tagsSchema: HtmlTagsSchema | undefined,
  seed: string,
): string {
  let result: string = '<'
  let name: string
  let attributes: Record<string, HtmlAttributeSchema> | undefined
  let children: boolean
  if (tagNames != null && tagsSchema != null) {
    name = tagNames[randomInt(seed + 'name', 0, tagNames.length - 1)]
    const tagSchema = tagsSchema[name]
    attributes = tagSchema.attributes ?? {}
    children = tagSchema.children ?? true
    result += name
    for (const [name, schema] of Object.entries(attributes)) {
      result += createHtmlAttributeSchemaMock(name, schema, seed + name)
    }
  } else {
    children = random(seed + 'children') > 0.5
    name = randomString(seed + 'name', 4, 10)
    result += name
    const attributeLength = randomInt(seed + 'attributeLength', 0, 4)
    for (let i = 0; i < attributeLength; i++) {
      result += createHtmlAttributeSchemaMock(undefined, undefined, seed + 'attribute' + i)
    }
  }

  if (children) {
    const childrenAmount = randomInt(seed + 'childrenAmount', 0, 5)
    result += `>`
    for (let i = 0; i < childrenAmount; i++) {
      result += createHtmlTagsSchemaMock(tagNames, tagsSchema, seed + i)
    }
    result += `</${name}>`
  } else {
    result += '/>'
  }
  return result
}

function createHtmlAttributeSchemaMock(
  attributeName: string | undefined,
  attributeSchema: HtmlAttributeSchema | undefined,
  seed: string,
): string {
  if (attributeSchema?.optional && random(seed + 'optional') > 0.5) {
    return ''
  }
  let result = ` ${attributeName}="`
  if (attributeSchema == null) {
    result += randomString(seed, 5, 20)
  } else {
    switch (attributeSchema.type) {
      case 'boolean':
        result += random(seed) > 0.5 ? 'true' : 'false'
        break
      case 'number':
        result += randomNumber(seed, -1000, 1000)
        break
      case 'string':
        result += randomString(seed, 5, 20)
        break
      case 'grammar':
        result += attributeSchema.mock(seed)
        break
    }
  }
  result += `"`
  return result
}
