export const StopSymbol = Symbol('stop')

export function createWriteable<T = unknown>(): {
  queue: Array<T | typeof StopSymbol>
  setResolve: (resolve: (value: T | typeof StopSymbol) => void) => void
  write: (value: T | typeof StopSymbol) => void
} {
  const queue: Array<T | typeof StopSymbol> = []
  let resolve: ((value: T | typeof StopSymbol) => void) | undefined
  return {
    write(value) {
      if (resolve != null) {
        resolve(value)
        resolve = undefined
        return
      }
      queue.push(value)
    },
    setResolve(newResolve) {
      resolve = newResolve
    },
    queue,
  }
}

export async function* createIterable<T>(
  queue: Array<T | typeof StopSymbol>,
  setResolve: (resolve: (value: T | typeof StopSymbol) => void) => void,
): AsyncIterable<T> {
  while (true) {
    const result = await new Promise<T | typeof StopSymbol>((resolve) => {
      if (queue.length > 0) {
        resolve(queue.shift()!)
        return
      }
      setResolve(resolve)
    })
    if (result === StopSymbol) {
      return
    }
    yield result
  }
}
