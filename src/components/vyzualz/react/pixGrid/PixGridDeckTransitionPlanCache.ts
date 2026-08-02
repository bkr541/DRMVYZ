import type { PixGridDeckTransitionPlan } from './PixGridDeckCompilerContracts'

export class PixGridDeckTransitionPlanCache {
  private readonly entries = new Map<string, PixGridDeckTransitionPlan>()
  private bytes = 0

  constructor(
    readonly maxEntries = 256,
    readonly maxBytes = 32 * 1024 * 1024,
  ) {}

  get size(): number { return this.entries.size }
  get approximateBytes(): number { return this.bytes }
  get keys(): readonly string[] { return [...this.entries.keys()] }

  get(key: string): PixGridDeckTransitionPlan | null {
    const entry = this.entries.get(key)
    if (!entry) return null
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry
  }

  peek(key: string): PixGridDeckTransitionPlan | null {
    return this.entries.get(key) ?? null
  }

  set(entry: PixGridDeckTransitionPlan): readonly string[] {
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

  retain(keys: ReadonlySet<string>): void {
    for (const [key, entry] of this.entries) {
      if (keys.has(key)) continue
      this.entries.delete(key)
      this.bytes -= entry.approximateBytes
    }
  }

  invalidateFrame(frameCacheKey: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.sourceFrameCacheKey !== frameCacheKey && entry.targetFrameCacheKey !== frameCacheKey) continue
      this.entries.delete(key)
      this.bytes -= entry.approximateBytes
    }
  }

  clear(): void {
    this.entries.clear()
    this.bytes = 0
  }
}

export const pixGridDeckTransitionPlanCache = new PixGridDeckTransitionPlanCache()
