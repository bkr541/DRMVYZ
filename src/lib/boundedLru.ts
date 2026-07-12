export interface BoundedLruOptions<K, V> {
  maxEntries: number
  onEvict?: (value: V, key: K) => void
}

/**
 * Small deterministic LRU used by media caches. Map insertion order is the
 * recency list: every successful read moves the entry to the newest position.
 */
export class BoundedLruCache<K, V> {
  private readonly entries = new Map<K, V>()
  private readonly maxEntries: number
  private readonly onEvict?: (value: V, key: K) => void

  constructor(options: BoundedLruOptions<K, V>) {
    if (!Number.isSafeInteger(options.maxEntries) || options.maxEntries < 1) {
      throw new Error('BoundedLruCache requires maxEntries >= 1.')
    }
    this.maxEntries = options.maxEntries
    this.onEvict = options.onEvict
  }

  get size(): number { return this.entries.size }

  has(key: K): boolean { return this.entries.has(key) }

  get(key: K): V | undefined {
    const value = this.entries.get(key)
    if (value === undefined) return undefined
    this.entries.delete(key)
    this.entries.set(key, value)
    return value
  }

  peek(key: K): V | undefined { return this.entries.get(key) }

  set(key: K, value: V): void {
    const previous = this.entries.get(key)
    if (previous !== undefined) {
      this.entries.delete(key)
      if (previous !== value) this.onEvict?.(previous, key)
    }
    this.entries.set(key, value)
    this.trim()
  }

  delete(key: K): boolean {
    const value = this.entries.get(key)
    if (value === undefined) return false
    this.entries.delete(key)
    this.onEvict?.(value, key)
    return true
  }

  deleteWhere(predicate: (value: V, key: K) => boolean): number {
    let removed = 0
    for (const [key, value] of Array.from(this.entries.entries())) {
      if (!predicate(value, key)) continue
      this.entries.delete(key)
      this.onEvict?.(value, key)
      removed += 1
    }
    return removed
  }

  clear(): void {
    for (const [key, value] of this.entries) this.onEvict?.(value, key)
    this.entries.clear()
  }

  keys(): K[] { return Array.from(this.entries.keys()) }

  private trim(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.entries().next().value as [K, V] | undefined
      if (!oldest) return
      const [key, value] = oldest
      this.entries.delete(key)
      this.onEvict?.(value, key)
    }
  }
}
