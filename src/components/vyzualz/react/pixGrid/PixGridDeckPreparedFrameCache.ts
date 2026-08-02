import type { PixGridPreparedFrame } from './PixGridDeckCompilerContracts'

export class PixGridDeckPreparedFrameCache {
  private readonly entries = new Map<string, PixGridPreparedFrame>()
  private bytes = 0

  constructor(
    readonly maxEntries = 64,
    readonly maxBytes = 64 * 1024 * 1024,
  ) {}

  get size(): number { return this.entries.size }
  get approximateBytes(): number { return this.bytes }
  get keys(): readonly string[] { return [...this.entries.keys()] }

  get(key: string): PixGridPreparedFrame | null {
    const entry = this.entries.get(key)
    if (!entry) return null
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry
  }

  peek(key: string): PixGridPreparedFrame | null {
    return this.entries.get(key) ?? null
  }

  set(entry: PixGridPreparedFrame): readonly string[] {
    const evicted: string[] = []
    const previous = this.entries.get(entry.cacheKey)
    if (previous) this.bytes -= previous.approximateBytes
    this.entries.delete(entry.cacheKey)
    this.entries.set(entry.cacheKey, entry)
    this.bytes += entry.approximateBytes
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value as string | undefined
      if (!oldestKey) break
      const oldest = this.entries.get(oldestKey)
      this.entries.delete(oldestKey)
      this.bytes -= oldest?.approximateBytes ?? 0
      evicted.push(oldestKey)
    }
    return evicted
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key)
    if (!entry) return false
    this.entries.delete(key)
    this.bytes -= entry.approximateBytes
    return true
  }

  /** Removes prepared frames that are no longer reachable from the active project. */
  retain(keys: Iterable<string>): readonly string[] {
    const retained = new Set(keys)
    const removed: string[] = []
    for (const [key, entry] of this.entries) {
      if (retained.has(key)) continue
      this.entries.delete(key)
      this.bytes -= entry.approximateBytes
      removed.push(key)
    }
    return removed
  }

  invalidateSource(fingerprint: string, keepRevision?: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.sourceFingerprint !== fingerprint) continue
      if (keepRevision != null && entry.sourceRevision === keepRevision) continue
      this.entries.delete(key)
      this.bytes -= entry.approximateBytes
    }
  }

  clear(): void {
    this.entries.clear()
    this.bytes = 0
  }
}

export const pixGridDeckPreparedFrameCache = new PixGridDeckPreparedFrameCache()
