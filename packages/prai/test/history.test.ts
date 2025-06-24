//TODO: build tests that check if the history is populated with the correct messages
//TODO: test subtasks which have their own sub histories

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { History, buildStepRequestMessage } from '../src/history.js'
import { Message } from '../src/step.js'

describe('History', () => {
  let history: History

  beforeEach(() => {
    history = new History()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should create a history with a unique ID', () => {
      const history1 = new History()
      const history2 = new History()

      expect(history1.id).toBeDefined()
      expect(history2.id).toBeDefined()
      expect(history1.id).not.toBe(history2.id)
    })

    it('should start with empty messages', () => {
      expect(history['messages']).toEqual([])
    })
  })

  describe('message population', () => {
    it('should populate history with step request message', () => {
      const schema = z.string()
      const stepId = history.addStepRequest('test prompt', schema)

      expect(stepId).toBe(0)
      expect(history['messages']).toHaveLength(1)

      const message = history['messages'][0]
      expect(message.role).toBe('user')
      expect(message.content[0].type).toBe('text')
      const textContent = message.content[0] as { type: 'text'; text: string }
      expect(textContent.text).toContain('# Step1')
      expect(textContent.text).toContain('Instructions:\ntest prompt')
    })

    it('should populate history with step request message including examples', () => {
      const schema = z.string()
      const examples = [
        { input: 'hello', output: 'world', reason: 'it is a greeting' },
        { input: 'foo', output: 'bar' },
      ]

      history.addStepRequest('test prompt', schema, examples)

      const message = history['messages'][0]
      const textContent = message.content[0] as { type: 'text'; text: string }
      expect(textContent.text).toContain('Example: 1')
      expect(textContent.text).toContain('For the input hello the output should be "world" , since it is a greeting.')
      expect(textContent.text).toContain('Example: 2')
      expect(textContent.text).toContain('For the input foo the output should be "bar" .')
    })

    it('should populate history with step response message', async () => {
      const schema = z.string()
      const stepId = history.addStepRequest('test prompt', schema)
      const response = 'test response'

      const result = await history.addStepResponse(stepId, Promise.resolve(response), schema)

      expect(result).toBe(response)
      expect(history['messages']).toHaveLength(2)

      const responseMessage = history['messages'][1]
      expect(responseMessage.role).toBe('assistant')
      expect(responseMessage.content[0].type).toBe('text')
      const textContent = responseMessage.content[0] as { type: 'text'; text: string }
      expect(textContent.text).toBe(JSON.stringify(response))
    })

    it('should populate history with data reference message', () => {
      const data = { name: 'John', age: 30 }
      const reference = history.add(data, { description: 'User data' })

      expect(reference).toBe('Data1')
      expect(history['messages']).toHaveLength(1)

      const message = history['messages'][0]
      expect(message.role).toBe('user')
      const textContent = message.content[0] as { type: 'text'; text: string }
      expect(textContent.text).toContain('# Data1')
      expect(textContent.text).toContain('Description: User data')
      const dataContent = message.content[1] as { type: 'text'; text: string }
      expect(dataContent.text).toBe(JSON.stringify(data))
    })

    it('should populate history with image reference message', () => {
      const imageBuffer = new ArrayBuffer(8)
      const reference = history.add(imageBuffer, { type: 'image', description: 'Test image' })

      expect(reference).toBe('Image1')
      expect(history['messages']).toHaveLength(1)

      const message = history['messages'][0]
      const textContent = message.content[0] as { type: 'text'; text: string }
      expect(textContent.text).toContain('# Image1')
      expect(textContent.text).toContain('Description: Test image')
      expect(message.content[1].type).toBe('image_url')
    })

    it('should populate history with audio reference message', () => {
      const audioBuffer = new ArrayBuffer(8)
      const reference = history.add(audioBuffer, { type: 'wav', description: 'Test audio' })

      expect(reference).toBe('Audio1')
      expect(history['messages']).toHaveLength(1)

      const message = history['messages'][0]
      const textContent = message.content[0] as { type: 'text'; text: string }
      expect(textContent.text).toContain('# Audio1')
      expect(textContent.text).toContain('Description: Test audio')
      expect(message.content[1].type).toBe('input_audio')
      const audioContent = message.content[1] as { type: 'input_audio'; input_audio: { format: string } }
      expect(audioContent.input_audio.format).toBe('wav')
    })
  })

  describe('event dispatching', () => {
    it('should dispatch step-request event', () => {
      const listener = vi.fn()
      history.addEventListener('step-request', listener)

      const schema = z.string()
      history.addStepRequest('test prompt', schema)

      expect(listener).toHaveBeenCalledWith({
        type: 'step-request',
        historyId: history.id,
        message: expect.any(Object),
      })
    })

    it('should dispatch step-response event', async () => {
      const listener = vi.fn()
      history.addEventListener('step-response', listener)

      const schema = z.string()
      const stepId = history.addStepRequest('test prompt', schema)
      await history.addStepResponse(stepId, Promise.resolve('response'), schema)

      expect(listener).toHaveBeenCalledWith({
        type: 'step-response',
        historyId: history.id,
        message: expect.any(Object),
      })
    })

    it('should dispatch step-error event on promise rejection', async () => {
      const listener = vi.fn()
      history.addEventListener('step-error', listener)

      const schema = z.string()
      const stepId = history.addStepRequest('test prompt', schema)
      const error = new Error('Test error')

      await expect(history.addStepResponse(stepId, Promise.reject(error), schema)).rejects.toThrow('Test error')

      expect(listener).toHaveBeenCalledWith({
        type: 'step-error',
        historyId: history.id,
        error: 'Test error',
      })
    })

    it('should dispatch data-reference-added event', () => {
      const listener = vi.fn()
      history.addEventListener('data-reference-added', listener)

      const data = { test: 'data' }
      history.add(data)

      expect(listener).toHaveBeenCalledWith({
        type: 'data-reference-added',
        historyId: history.id,
        message: expect.any(Object),
      })
    })

    it('should dispatch subtask-start event', () => {
      const listener = vi.fn()
      history.addEventListener('subtask-start', listener)

      history.subtask('test goal', () => 'result')

      expect(listener).toHaveBeenCalledWith({
        type: 'subtask-start-event',
        historyId: history.id,
        subtaskHistoryId: expect.any(String),
      })
    })

    it('should remove event listeners with abort signal', async () => {
      const controller = new AbortController()
      const listener = vi.fn()

      history.addEventListener('step-request', listener, { signal: controller.signal })

      const schema = z.string()
      const stepId = history.addStepRequest('test', schema)
      expect(listener).toHaveBeenCalledTimes(1)

      await history.addStepResponse(stepId, Promise.resolve('response'), schema)
      controller.abort()
      history.addStepRequest('test2', schema)
      expect(listener).toHaveBeenCalledTimes(1) // Should not be called again
    })

    it('should not add listener if signal is already aborted', () => {
      const controller = new AbortController()
      controller.abort()

      const listener = vi.fn()
      history.addEventListener('step-request', listener, { signal: controller.signal })

      const schema = z.string()
      history.addStepRequest('test', schema)
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('step management', () => {
    it('should prevent starting a new step while one is executing', () => {
      const schema = z.string()
      history.addStepRequest('first step', schema)

      expect(() => history.addStepRequest('second step', schema)).toThrow(
        'Step 1 is still executing. Cannot start a new step.',
      )
    })

    it('should allow starting new step after previous one completes', async () => {
      const schema = z.string()
      const stepId1 = history.addStepRequest('first step', schema)
      await history.addStepResponse(stepId1, Promise.resolve('response1'), schema)

      const stepId2 = history.addStepRequest('second step', schema)
      expect(stepId2).toBe(1)
    })

    it('should throw error when adding response for wrong step', async () => {
      const schema = z.string()
      const stepId = history.addStepRequest('test step', schema)

      await expect(history.addStepResponse(stepId + 1, Promise.resolve('response'), schema)).rejects.toThrow(
        'Step-2 is not currently executing. Current step is 1',
      )
    })
  })

  describe('reference management', () => {
    it('should create reference for new value', () => {
      const data = { test: 'value' }
      const reference = history.reference(data)

      expect(reference).toBe('Data1')
      expect(history.reference(data)).toBe('Data1') // Should return same reference
    })

    it('should throw error when referencing Promise', () => {
      const promise = Promise.resolve('value')

      expect(() => history.reference(promise)).toThrow(
        'Cannot reference a Promise value directly. Use await to resolve the Promise first.',
      )
    })

    it('should throw error when adding duplicate value', () => {
      const data = { test: 'value' }
      history.add(data)

      expect(() => history.add(data)).toThrow('Value already exists in history')
    })

    it('should use custom text for reference', () => {
      const data = { test: 'value' }
      const reference = history.add(data, { text: 'CustomRef' })

      expect(reference).toBe('CustomRef')
    })

    it('should increment counters for different resource types', () => {
      const data1 = { test: 'data1' }
      const data2 = { test: 'data2' }
      const imageBuffer = new ArrayBuffer(8)
      const audioBuffer = new ArrayBuffer(8)

      expect(history.add(data1)).toBe('Data1')
      expect(history.add(data2)).toBe('Data2')
      expect(history.add(imageBuffer, { type: 'image' })).toBe('Image1')
      expect(history.add(audioBuffer, { type: 'wav' })).toBe('Audio1')
    })
  })

  describe('clone and copy functionality', () => {
    it('should clone history correctly', async () => {
      const schema = z.string()
      const stepId = history.addStepRequest('test', schema)
      await history.addStepResponse(stepId, Promise.resolve('response'), schema)
      history.add({ test: 'data' })

      const cloned = history.clone()

      expect(cloned.id).not.toBe(history.id)
      expect(cloned['messages']).toEqual(history['messages'])
      expect(cloned['messages']).not.toBe(history['messages']) // Different array instance
    })

    it('should copy from another history', async () => {
      const source = new History()
      const schema = z.string()
      const stepId = source.addStepRequest('test', schema)
      await source.addStepResponse(stepId, Promise.resolve('response'), schema)

      history.copy(source)

      expect(history['messages']).toEqual(source['messages'])
    })

    it('should prevent copying while step is executing', () => {
      const source = new History()
      const schema = z.string()
      source.addStepRequest('test', schema)

      expect(() => history.copy(source)).toThrow('Step1 is still executing. Cannot get history state.')
    })
  })

  describe('subtask functionality', () => {
    it('should create subtask with isolated history', () => {
      const subtaskStartListener = vi.fn()
      const subtaskReferencedListener = vi.fn()

      history.addEventListener('subtask-start', subtaskStartListener)
      history.addEventListener('subtask-response-referenced', subtaskReferencedListener)

      const result = history.subtask('test goal', (internalHistory) => {
        expect(internalHistory.id).not.toBe(history.id)
        expect(internalHistory['messages']).toEqual(history['messages'])
        return 'subtask result'
      })

      expect(result).toBe('subtask result')
      expect(subtaskStartListener).toHaveBeenCalledWith({
        type: 'subtask-start-event',
        historyId: history.id,
        subtaskHistoryId: expect.any(String),
      })

      // Reference should be created when accessed
      const reference = history.reference(result)
      expect(reference).toBe('response of the previous subtask')

      expect(subtaskReferencedListener).toHaveBeenCalledWith({
        type: 'subtask-response-referenced',
        historyId: history.id,
        requestMessage: expect.objectContaining({
          role: 'user',
          content: [{ type: 'text', text: expect.stringContaining('# Subtask1\nGoal: test goal') }],
        }),
        responseMessage: expect.objectContaining({
          role: 'assistant',
          content: [{ type: 'text', text: JSON.stringify(result) }],
        }),
      })
    })

    it('should add subtask messages to history when building reference', () => {
      const result = history.subtask('test goal', () => 'subtask result')

      expect(history['messages']).toHaveLength(0) // No messages until reference is built

      history.reference(result) // This should trigger building the reference

      expect(history['messages']).toHaveLength(2) // Request and response
      expect(history['messages'][0].role).toBe('user')
      const requestContent = history['messages'][0].content[0] as { type: 'text'; text: string }
      expect(requestContent.text).toContain('# Subtask1')
      expect(requestContent.text).toContain('Goal: test goal')
      expect(history['messages'][1].role).toBe('assistant')
      const responseContent = history['messages'][1].content[0] as { type: 'text'; text: string }
      expect(responseContent.text).toBe(JSON.stringify('subtask result'))
    })

    it('should prevent building subtask reference while step is executing', () => {
      const result = history.subtask('test goal', () => 'result')

      const schema = z.string()
      history.addStepRequest('test', schema)

      expect(() => history.reference(result)).toThrow('Cannot build reference while a step is currently executing')
    })
  })

  describe('buildStepRequestMessage helper', () => {
    it('should build step request message correctly', () => {
      const schema = z.string()
      const message = buildStepRequestMessage(0, 'test prompt', schema, new Map(), new Set())

      expect(message.role).toBe('user')
      expect(message.content[0].type).toBe('text')
      const textContent = message.content[0] as { type: 'text'; text: string }
      expect(textContent.text).toContain('# Step1')
      expect(textContent.text).toContain('Instructions:\ntest prompt')
    })

    it('should include examples in step request message', () => {
      const schema = z.string()
      const examples = [{ input: 'test', output: 'result', reason: 'because' }]
      const message = buildStepRequestMessage(1, 'test prompt', schema, new Map(), new Set(), examples)

      const textContent = message.content[0] as { type: 'text'; text: string }
      expect(textContent.text).toContain('# Step2')
      expect(textContent.text).toContain('Example: 1')
      expect(textContent.text).toContain('For the input test the output should be "result" , since because.')
    })
  })

  describe('schema type definition reuse', () => {
    it('should reuse schema type definitions across multiple steps with same schema', async () => {
      const userSchema = z.object({
        name: z.string(),
        age: z.number(),
      })

      // First step with user schema
      const stepId1 = history.addStepRequest('Get user info', userSchema)
      const response1 = { name: 'John', age: 30 }
      await history.addStepResponse(stepId1, Promise.resolve(response1), userSchema)

      // Second step with same user schema
      const stepId2 = history.addStepRequest('Validate user info', userSchema)
      const response2 = { name: 'Jane', age: 25 }
      await history.addStepResponse(stepId2, Promise.resolve(response2), userSchema)

      expect(history['messages']).toHaveLength(4)

      // Check first step request message contains type definition
      const step1RequestContent = history['messages'][0].content[0] as { type: 'text'; text: string }
      expect(step1RequestContent.text).toContain('type Step1Response = {')
      expect(step1RequestContent.text).toContain('name: string')
      expect(step1RequestContent.text).toContain('age: number')

      // Check second step request message reuses the same type structure
      const step2RequestContent = history['messages'][2].content[0] as { type: 'text'; text: string }
      expect(step2RequestContent.text).toContain('type Step2Response = Step1Response')
    })

    it('should handle complex nested schemas with reuse', async () => {
      const addressSchema = z.object({
        street: z.string(),
        city: z.string(),
      })

      const userSchema = z.object({
        name: z.string(),
        address: addressSchema,
        addresses: z.array(addressSchema),
      })

      const stepId = history.addStepRequest('Process user with addresses', userSchema)
      await history.addStepResponse(
        stepId,
        Promise.resolve({
          name: 'John',
          address: { street: '123 Main St', city: 'NYC' },
          addresses: [{ street: '456 Oak Ave', city: 'LA' }],
        }),
        userSchema,
      )

      const requestContent = history['messages'][0].content[0] as { type: 'text'; text: string }

      // Should contain type definitions for reused address schema
      expect(requestContent.text).toContain('type Step1TypeA = {')
      expect(requestContent.text).toContain('street: string')
      expect(requestContent.text).toContain('city: string')

      // Main type should reference the reused type
      expect(requestContent.text).toContain('type Step1Response = {')
      expect(requestContent.text).toContain('address: Step1TypeA')
      expect(requestContent.text).toContain('addresses: Array<Step1TypeA>')
    })

    it('should maintain schema type definitions across history operations', async () => {
      const schema = z.object({ id: z.number(), name: z.string() })

      // Add first step
      const stepId1 = history.addStepRequest('First step', schema)
      await history.addStepResponse(stepId1, Promise.resolve({ id: 1, name: 'test' }), schema)

      // Clone history
      const cloned = history.clone()

      // Add step to cloned history with same schema
      const stepId2 = cloned.addStepRequest('Second step', schema)

      // Check that schema type definitions are maintained in clone
      const clonedMessages = cloned['messages']
      expect(clonedMessages).toHaveLength(3) // original 2 + new request

      const newRequestContent = clonedMessages[2].content[0] as { type: 'text'; text: string }
      expect(newRequestContent.text).toContain('type Step2Response = Step1Response')
    })
  })

  describe('message structure validation', () => {
    it('should maintain proper message structure for various content types', async () => {
      // Add data reference
      const data = { test: 'value' }
      history.add(data, { description: 'Test data' })

      // Add image reference
      const imageBuffer = new ArrayBuffer(8)
      history.add(imageBuffer, { type: 'image', description: 'Test image' })

      // Add audio reference
      const audioBuffer = new ArrayBuffer(16)
      history.add(audioBuffer, { type: 'wav', description: 'Test audio' })

      // Add step
      const schema = z.string()
      const stepId = history.addStepRequest('Test step', schema)
      await history.addStepResponse(stepId, Promise.resolve('response'), schema)

      expect(history['messages']).toHaveLength(5)

      // Validate data reference message structure
      const dataMessage = history['messages'][0]
      expect(dataMessage.role).toBe('user')
      expect(dataMessage.content).toHaveLength(2)
      expect(dataMessage.content[0].type).toBe('text')
      expect(dataMessage.content[1].type).toBe('text')
      const dataTextContent = dataMessage.content[0] as { type: 'text'; text: string }
      expect(dataTextContent.text).toContain('# Data1')
      expect(dataTextContent.text).toContain('Description: Test data')

      // Validate image reference message structure
      const imageMessage = history['messages'][1]
      expect(imageMessage.role).toBe('user')
      expect(imageMessage.content).toHaveLength(2)
      expect(imageMessage.content[0].type).toBe('text')
      expect(imageMessage.content[1].type).toBe('image_url')
      const imageTextContent = imageMessage.content[0] as { type: 'text'; text: string }
      expect(imageTextContent.text).toContain('# Image1')
      expect(imageTextContent.text).toContain('Description: Test image')

      // Validate audio reference message structure
      const audioMessage = history['messages'][2]
      expect(audioMessage.role).toBe('user')
      expect(audioMessage.content).toHaveLength(2)
      expect(audioMessage.content[0].type).toBe('text')
      expect(audioMessage.content[1].type).toBe('input_audio')
      const audioTextContent = audioMessage.content[0] as { type: 'text'; text: string }
      expect(audioTextContent.text).toContain('# Audio1')
      expect(audioTextContent.text).toContain('Description: Test audio')

      // Validate step request message structure
      const stepRequestMessage = history['messages'][3]
      expect(stepRequestMessage.role).toBe('user')
      expect(stepRequestMessage.content).toHaveLength(1)
      expect(stepRequestMessage.content[0].type).toBe('text')
      const stepRequestContent = stepRequestMessage.content[0] as { type: 'text'; text: string }
      expect(stepRequestContent.text).toContain('# Step1')
      expect(stepRequestContent.text).toContain('Instructions:\nTest step')

      // Validate step response message structure
      const stepResponseMessage = history['messages'][4]
      expect(stepResponseMessage.role).toBe('assistant')
      expect(stepResponseMessage.content).toHaveLength(1)
      expect(stepResponseMessage.content[0].type).toBe('text')
      const stepResponseContent = stepResponseMessage.content[0] as { type: 'text'; text: string }
      expect(stepResponseContent.text).toBe(JSON.stringify('response'))
    })

    it('should maintain message order and structure across complex operations', async () => {
      // Add initial data
      const userData = { name: 'John', age: 30 }
      history.add(userData, { description: 'User data' })

      // First step
      const schema1 = z.object({ processed: z.boolean() })
      const stepId1 = history.addStepRequest('Process user', schema1)
      await history.addStepResponse(stepId1, Promise.resolve({ processed: true }), schema1)

      // Add more data
      const configData = { setting: 'enabled' }
      history.add(configData, { description: 'Config data' })

      // Second step
      const schema2 = z.array(z.string())
      const stepId2 = history.addStepRequest('Generate list', schema2)
      await history.addStepResponse(stepId2, Promise.resolve(['item1', 'item2']), schema2)

      // Subtask
      const subtaskResult = history.subtask('subtask goal', () => 'subtask result')
      history.reference(subtaskResult) // This adds subtask messages

      expect(history['messages']).toHaveLength(8)

      // Verify order: userData, step1-req, step1-res, configData, step2-req, step2-res, subtask-req, subtask-res
      expect(history['messages'][0].role).toBe('user') // userData
      expect(history['messages'][1].role).toBe('user') // step1 request
      expect(history['messages'][2].role).toBe('assistant') // step1 response
      expect(history['messages'][3].role).toBe('user') // configData
      expect(history['messages'][4].role).toBe('user') // step2 request
      expect(history['messages'][5].role).toBe('assistant') // step2 response
      expect(history['messages'][6].role).toBe('user') // subtask request
      expect(history['messages'][7].role).toBe('assistant') // subtask response

      // Verify specific content patterns
      const userDataContent = history['messages'][0].content[0] as { type: 'text'; text: string }
      expect(userDataContent.text).toContain('# Data1')

      const step1Content = history['messages'][1].content[0] as { type: 'text'; text: string }
      expect(step1Content.text).toContain('# Step1')

      const configDataContent = history['messages'][3].content[0] as { type: 'text'; text: string }
      expect(configDataContent.text).toContain('# Data2')

      const step2Content = history['messages'][4].content[0] as { type: 'text'; text: string }
      expect(step2Content.text).toContain('# Step2')

      const subtaskContent = history['messages'][6].content[0] as { type: 'text'; text: string }
      expect(subtaskContent.text).toContain('# Subtask1')
    })

    it('should preserve message structure integrity after clone and copy operations', async () => {
      // Setup complex history
      history.add({ data: 'test' })
      const schema = z.object({ result: z.string() })
      const stepId = history.addStepRequest('Test', schema)
      await history.addStepResponse(stepId, Promise.resolve({ result: 'success' }), schema)

      // Clone and verify structure
      const cloned = history.clone()
      expect(cloned['messages']).toHaveLength(3)
      expect(cloned['messages']).toEqual(history['messages'])
      expect(cloned['messages']).not.toBe(history['messages']) // Different array instance

      // Copy and verify structure
      const target = new History()
      target.copy(history)
      expect(target['messages']).toHaveLength(3)
      expect(target['messages']).toEqual(history['messages'])

      // Verify each message maintains proper structure
      for (let i = 0; i < target['messages'].length; i++) {
        const originalMessage = history['messages'][i]
        const copiedMessage = target['messages'][i]

        expect(copiedMessage.role).toBe(originalMessage.role)
        expect(copiedMessage.content).toHaveLength(originalMessage.content.length)

        for (let j = 0; j < copiedMessage.content.length; j++) {
          expect(copiedMessage.content[j].type).toBe(originalMessage.content[j].type)
        }
      }
    })

    it('should handle empty and edge case message structures', () => {
      // Empty history
      expect(history['messages']).toEqual([])

      // Add data with minimal options
      history.add('simple string')
      expect(history['messages']).toHaveLength(1)

      const message = history['messages'][0]
      expect(message.role).toBe('user')
      expect(message.content).toHaveLength(2) // header + data
      expect(message.content[0].type).toBe('text')
      expect(message.content[1].type).toBe('text')

      // Verify header content
      const headerContent = message.content[0] as { type: 'text'; text: string }
      expect(headerContent.text).toContain('# Data1')
      expect(headerContent.text).not.toContain('Description:') // No description provided

      // Verify data content
      const dataContent = message.content[1] as { type: 'text'; text: string }
      expect(dataContent.text).toBe(JSON.stringify('simple string'))
    })
  })
})
