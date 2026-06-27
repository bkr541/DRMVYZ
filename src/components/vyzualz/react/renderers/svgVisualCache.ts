/**
 * Module-level cache for decoded SVG artwork images.
 *
 * The active selection remains in Zustand as sourceType === 'svg' + selectedSvgId.
 * This cache contains only non-serializable browser objects and is rebuilt after
 * hydration by the unified SVG lifecycle.
 */

export interface SvgVisualCacheEntry {
  id:          string
  /** True while an image fetch/decode is in progress. Prevents duplicate fetches. */
  loading:     boolean
  image:       HTMLImageElement | null
  objectUrl:   string | null
  loaded:      boolean
  error:       string | null
  width:       number
  height:      number
  /** Media identity fields — used to detect stale cache when media URL/content changes
   *  under the same media ID (e.g. after a re-upload). Stored at load time. */
  mediaUrl?:    string
  storagePath?: string
  /** Per-media decode generation. Late image events from an evicted/replaced request are ignored. */
  generation?: number
}

const cache = new Map<string, SvgVisualCacheEntry>()
const listeners = new Set<() => void>()
let cacheVersion = 0

function emitChange(): void {
  cacheVersion++
  for (const listener of listeners) listener()
}

export function subscribeSvgVisualCache(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSvgVisualCacheVersion(): number {
  return cacheVersion
}

export function getSvgVisualEntry(id: string): SvgVisualCacheEntry | null {
  return cache.get(id) ?? null
}

export function setSvgVisualEntry(entry: SvgVisualCacheEntry): void {
  const prev = cache.get(entry.id)
  if (prev?.objectUrl && prev.objectUrl !== entry.objectUrl) {
    URL.revokeObjectURL(prev.objectUrl)
  }
  cache.set(entry.id, entry)
  emitChange()
}

export function isCurrentSvgVisualGeneration(id: string, generation: number): boolean {
  return cache.get(id)?.generation === generation
}

export function evictSvgVisual(id: string): void {
  const entry = cache.get(id)
  if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl)
  if (cache.delete(id)) emitChange()
}

export function clearSvgVisualCache(): void {
  for (const entry of cache.values()) {
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl)
  }
  if (cache.size > 0) {
    cache.clear()
    emitChange()
  }
}
