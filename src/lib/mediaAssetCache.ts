import { BoundedLruCache } from './boundedLru'

export class BoundedObjectUrlCache {
  private readonly cache: BoundedLruCache<string, string>

  constructor(maxEntries: number) {
    this.cache = new BoundedLruCache({
      maxEntries,
      onEvict: value => {
        if (value.startsWith('blob:')) URL.revokeObjectURL(value)
      },
    })
  }

  get size(): number { return this.cache.size }
  get(key: string): string | undefined { return this.cache.get(key) }
  set(key: string, url: string): void { this.cache.set(key, url) }
  delete(key: string): boolean { return this.cache.delete(key) }
  purgePrefix(prefix: string): number { return this.cache.deleteWhere((_value, key) => key.startsWith(prefix)) }
  clear(): void { this.cache.clear() }
}
