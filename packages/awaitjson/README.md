# awaitjson

> stream async iterables and promises inside of a json

```ts
const stream = AwaitJSON.stringify({ hello: Promise.resolve("world") })

//send stream via REST body

const result = await AwaitJSON.parse(stream)
result.hello.then(console.log)
//logs "world"
```

