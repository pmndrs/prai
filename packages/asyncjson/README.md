# asyncjson

> stream async iterables and promises inside of a json

```ts
const stream = AsyncJSON.stringify({ hello: Promise.resolve("world") })

//send stream via REST body

const result = await AsyncJSON.parse(stream)
result.hello.then(console.log)
//logs "world"
```

