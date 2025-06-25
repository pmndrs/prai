import { describe, expect, it } from 'vitest'
import { listStep, mapStep, History, Model, mock, step } from '../src/index.js'
import { object, string } from 'zod'

describe('step', () => {
  it('map step', async () => {
    const history = new History()
    const model = new Model({ provider: mock({ startupDelaySeconds: 0, tokensPerSecond: Infinity }), name: 'unknown' })
    const values = await listStep('list colors', object({ name: string(), hex: string() }), { history, model })
    await mapStep(values, ({ name }) => `a word that tymes with ${name}`, string(), { history })
    expect(history['messages'][0]).to.deep.equal({
      content: [
        {
          text: [
            '# Step1',
            '',
            'Instructions:',
            'Return a list of list colors',
            '',
            'Types:',
            'type Step1Response = Array<{',
            '\tname: string',
            '\thex: string',
            '}>',
            '',
          ].join('\n'),
          type: 'text',
        },
      ],
      role: 'user',
    })
    expect(history['messages'][2]).to.deep.equal({
      content: [
        {
          text: [
            `# Step2`,
            '',
            `Instructions:`,
            `For each entry in response of the previous step, a word that tymes with  the name field from the object  of each entry. The resulting list should have the same length and order as the input list of response of the previous step`,
            '',
            `Types:`,
            `type Step2Response = Array<string>`,
            ``,
          ].join('\n'),
          type: 'text',
        },
      ],
      role: 'user',
    })
  })

  it('string schema with describe should contain Response Format Description', async () => {
    const history = new History()
    const model = new Model({ provider: mock({ startupDelaySeconds: 0, tokensPerSecond: Infinity }), name: 'unknown' })

    await step('generate a greeting', string().describe('A friendly greeting message'), { history, model })

    const messageContent = history['messages'][0].content[0]
    if (messageContent.type === 'text') {
      expect(messageContent.text).to.include('Response Format Description')
      expect(messageContent.text).to.not.include('Types:')
    }
  })

  it('plain string schema should not contain Types or Response Format Description', async () => {
    const history = new History()
    const model = new Model({ provider: mock({ startupDelaySeconds: 0, tokensPerSecond: Infinity }), name: 'unknown' })

    await step('generate a greeting', string(), { history, model })

    const messageContent = history['messages'][0].content[0]
    if (messageContent.type === 'text') {
      expect(messageContent.text).to.not.include('Types:')
      expect(messageContent.text).to.not.include('Response Format Description')
    }
  })
})
