# prai-redis

> redis logger for prai

```ts
import { Model, History } from 'prai'
import { redisLogger } from 'prai-redis'
import { createClient } from 'redis'

const model = new Model({ ... })
const history = new History()


const client = createClient({ url: process.env.REDIS_URL })
await client.connect()
await redisLogger(history, { streamName: 'stream-name', client })

const result = await step(...)
```
