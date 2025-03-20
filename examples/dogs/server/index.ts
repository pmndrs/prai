import Fastify from 'fastify'
import cors from '@fastify/cors'
import { getNamesFoodAndMonthlyCosts } from './dogs.js'
import { createClient, RedisClientOptions, RedisClientType } from 'redis'
import { readPraiEvents } from '@prai/redis'
//@ts-ignore
import toStream from 'it-to-stream'
import { encodeAsyncJson } from 'prai'

const options = {
  username: 'default',
  password: 'ejNTxHHWg6oMqwFR2Hl1tpwy6I8VW552NZTfb3rucdasrxDAchCABlY4BERzOASp',
  socket: {
    host: 'redis.internal.drawcall.ai',
    port: 5432,
  },
} satisfies RedisClientOptions

const subClient: RedisClientType = createClient(options)
const nonSubClient: RedisClientType = createClient(options)

subClient.on('error', (err) => console.log('Redis Client Error', err))
nonSubClient.on('error', (err) => console.log('Redis Client Error', err))

await subClient.connect()
await nonSubClient.connect()

// Create Fastify instance
const fastify = Fastify({
  //logger: true,
})

// Register CORS
await fastify.register(cors, {
  origin: true,
})

// Set up the route to accept POST with JSON body
fastify.post('/', {}, async (request, reply) => {
  const taskName = crypto.randomUUID()
  const dogsInput = request.body

  const result = getNamesFoodAndMonthlyCosts(taskName, dogsInput, nonSubClient).catch(console.error)

  reply.send(taskName)
  return reply
})

// Set up the logs route to stream data from Redis
fastify.get('/logs/:key', async (request, reply) => {
  const abortController = new AbortController()
  request.raw.on('close', () => abortController.abort())
  const { key } = request.params as { key: string }

  try {
    const events = readPraiEvents(subClient, nonSubClient, key, {
      abort: abortController.signal,
    })

    return reply.send(toStream(encodeAsyncJson(events)))
  } catch (err) {
    fastify.log.error(err)
    reply.code(500).send({ error: 'Internal server error' })
    return reply
  }
})

// Run the server
try {
  await fastify.listen({ port: 3000, host: '0.0.0.0' })
  console.log('Server is running on http://localhost:3000')
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
