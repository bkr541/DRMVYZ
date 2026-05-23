export type MediaPool = Map<string, HTMLImageElement | HTMLVideoElement>

/**
 * Returns the existing pool entry for `key`, or creates a new element and
 * stores it under `key`.  Keys must be instance-scoped (e.g. `layer:<id>`,
 * `background:<clipId>`, `overlay:<clipId>`) so that two clips sharing the
 * same source asset get independent video elements with independent playback
 * state.
 */
export function getOrCreateMediaInstance(
  pool: MediaPool,
  key: string,
  media: { type: string; url: string },
  opts: { loop?: boolean } = {},
): HTMLImageElement | HTMLVideoElement {
  const existing = pool.get(key)
  if (existing) return existing

  if (media.type === 'image') {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = media.url
    pool.set(key, img)
    return img
  }

  const vid = document.createElement('video') as HTMLVideoElement
  vid.src         = media.url
  vid.muted       = true
  vid.playsInline = true
  vid.crossOrigin = 'anonymous'
  vid.loop        = opts.loop ?? false
  pool.set(key, vid)
  return vid
}

/**
 * Pauses every video element in the pool whose key is NOT in `activeKeys`.
 * Called once per rendered frame so idle instances stop decoding.
 */
export function pauseInactiveMediaInstances(
  pool: MediaPool,
  activeKeys: Set<string>,
): void {
  pool.forEach((el, key) => {
    if (el instanceof HTMLVideoElement && !activeKeys.has(key)) {
      if (!el.paused) el.pause()
    }
  })
}

/**
 * Pauses, clears src, and removes the pool entry for `key`.
 */
export function destroyMediaInstance(pool: MediaPool, key: string): void {
  const el = pool.get(key)
  if (!el) return
  if (el instanceof HTMLVideoElement) {
    el.pause()
    el.src = ''
  }
  pool.delete(key)
}
