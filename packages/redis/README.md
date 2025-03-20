# @prai/redis

> redis logging adapter for [prai](https://github.com/pmndrs/prai)

```ts
import { createClient } from "redis";
import { redisLogger } from "@prai/redis";

const redisClient = createClient(options);
redisLogger(redisClient, praiConnection);
```