# aw8json

> stream async iterables and promises inside of a json

```ts
const stream = Aw8JSON.stringify({ hello: Promise.resolve("world") })

//send stream via REST body

const result = await Aw8JSON.parse(stream)
result.hello.then(console.log)
//logs "world"
```

