/**
 * Module-level cache for SVG Visual mode images.
 *
 * Written by reactStore actions (selectSvgVisual, clearSvgVisualForMedia).
 * Read by SoundDrawingRenderer on every frame.
 *
 * HTMLImageElement objects live here, not in Zustand, because they are
 * non-serializable browser objects. The cache key is the media item ID
 * (e.g. "db-xxx") stored in oscillatorSettings.selectedSvgVisualId.
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
}

const cache = new Map<string, SvgVisualCacheEntry>()

export function getSvgVisualEntry(id: string): SvgVisualCacheEntry | null {
  return cache.get(id) ?? null
}

export function setSvgVisualEntry(entry: SvgVisualCacheEntry): void {
  const prev = cache.get(entry.id)
  if (prev?.objectUrl && prev.objectUrl !== entry.objectUrl) {
    URL.revokeObjectURL(prev.objectUrl)
  }
  cache.set(entry.id, entry)
}

export function evictSvgVisual(id: string): void {
  const entry = cache.get(id)
  if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl)
  cache.delete(id)
}

export function clearSvgVisualCache(): void {
  for (const entry of cache.values()) {
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl)
  }
  cache.clear()
}
