import MurmurHash3 from 'imurmurhash'

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const charsLength = chars.length

export function randomString(seed: string, minSizeIncl: number, maxSizeIncl: number): string {
  const length = randomInt('length' + seed, minSizeIncl, maxSizeIncl)
  return Array.from({ length }, (_, i) => chars[randomInt('' + i + seed, 0, charsLength - 1)]).join('')
}

export function randomNumber(seed: string, minIncl: number, maxExcl: number): number {
  return minIncl + random(seed) * (maxExcl - minIncl)
}

export function randomInt(seed: string, minIncl: number, maxIncl: number): number {
  return minIncl + Math.floor(random(seed) * (maxIncl - minIncl + 1))
}

const hashState = new MurmurHash3()

export function random(seed: string): number {
  const x = hashState.reset().hash(seed).result()
  return (x >>> 0) / 0xffffffff
}
