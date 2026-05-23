import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import type { MediaPool } from './mediaPool'
import { getOrCreateMediaInstance, pauseInactiveMediaInstances, destroyMediaInstance } from './mediaPool'

// ── Mock browser DOM APIs ──────────────────────────────────────────────────────
// Node environment has no DOM; stub the globals so instanceof checks work.

class FakeVideo {
  src         = ''
  muted       = false
  playsInline = false
  crossOrigin = ''
  loop        = false
  paused      = true
  pause = vi.fn(function(this: FakeVideo) { this.paused = true })
  play  = vi.fn(function(this: FakeVideo) { this.paused = false; return Promise.resolve() })
}

class FakeImage {
  src         = ''
  crossOrigin = ''
}

beforeAll(() => {
  vi.stubGlobal('HTMLVideoElement', FakeVideo)
  vi.stubGlobal('HTMLImageElement', FakeImage)
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'video') return new FakeVideo()
      throw new Error(`unexpected createElement: '${tag}'`)
    },
  })
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePool(): MediaPool { return new Map() }

const VIDEO_MEDIA = { type: 'video', url: 'https://example.com/clip.mp4' }
const IMAGE_MEDIA = { type: 'image', url: 'https://example.com/logo.png' }

// ── Test 1: returns existing element for a known key ──────────────────────────

describe('getOrCreateMediaInstance', () => {
  it('returns the existing element when the key is already in the pool', () => {
    const pool = makePool()
    const first  = getOrCreateMediaInstance(pool, 'background:clip-1', VIDEO_MEDIA)
    const second = getOrCreateMediaInstance(pool, 'background:clip-1', VIDEO_MEDIA)
    expect(second).toBe(first)
    expect(pool.size).toBe(1)
  })

  // ── Test 2: creates a new video element for an unknown key ────────────────

  it('creates a new video element when the key is not in the pool', () => {
    const pool = makePool()
    const el = getOrCreateMediaInstance(pool, 'background:clip-42', VIDEO_MEDIA)
    expect(el).toBeInstanceOf(HTMLVideoElement)
    expect((el as HTMLVideoElement).src).toBe(VIDEO_MEDIA.url)
    expect((el as HTMLVideoElement).muted).toBe(true)
    expect(pool.size).toBe(1)
    expect(pool.get('background:clip-42')).toBe(el)
  })

  // ── Test 3: creates an image element for image-type media ──────────────────

  it('creates an image element for image-type media', () => {
    const pool = makePool()
    const el = getOrCreateMediaInstance(pool, 'layer:li-001', IMAGE_MEDIA)
    expect(el).toBeInstanceOf(HTMLImageElement)
    expect((el as HTMLImageElement).src).toBe(IMAGE_MEDIA.url)
    expect(pool.size).toBe(1)
  })

  // ── Test 4: two clips with different IDs but same mediaId get separate entries

  it('two clips sharing the same source URL produce two independent pool entries', () => {
    const pool = makePool()
    const sharedMedia = { type: 'video', url: 'https://example.com/shared.mp4' }
    const el1 = getOrCreateMediaInstance(pool, 'background:clip-A', sharedMedia)
    const el2 = getOrCreateMediaInstance(pool, 'background:clip-B', sharedMedia)
    expect(pool.size).toBe(2)
    expect(el1).not.toBe(el2)
    expect(pool.get('background:clip-A')).toBe(el1)
    expect(pool.get('background:clip-B')).toBe(el2)
  })
})

// ── pauseInactiveMediaInstances ───────────────────────────────────────────────

describe('pauseInactiveMediaInstances', () => {
  // ── Test 5: pauses video elements NOT in activeKeys ───────────────────────

  it('pauses video elements whose key is not in activeKeys', () => {
    const pool = makePool()
    const active   = getOrCreateMediaInstance(pool, 'background:clip-active', VIDEO_MEDIA) as unknown as FakeVideo
    const inactive = getOrCreateMediaInstance(pool, 'background:clip-idle',   VIDEO_MEDIA) as unknown as FakeVideo
    // Simulate both playing
    active.paused   = false
    inactive.paused = false

    pauseInactiveMediaInstances(pool, new Set(['background:clip-active']))

    expect(inactive.pause).toHaveBeenCalled()
    expect(inactive.paused).toBe(true)
  })

  // ── Test 6: does NOT pause active video elements ──────────────────────────

  it('does not pause video elements whose key is in activeKeys', () => {
    const pool = makePool()
    const active = getOrCreateMediaInstance(pool, 'overlay:oc-001', VIDEO_MEDIA) as unknown as FakeVideo
    active.paused = false

    pauseInactiveMediaInstances(pool, new Set(['overlay:oc-001']))

    expect(active.pause).not.toHaveBeenCalled()
    expect(active.paused).toBe(false)
  })

  // ── Test 7: ignores image elements (no .pause()) ──────────────────────────

  it('ignores image elements — does not attempt to call pause on them', () => {
    const pool = makePool()
    getOrCreateMediaInstance(pool, 'layer:li-img', IMAGE_MEDIA)
    // If the function tries to call .pause() on an image, the missing method
    // would throw. Verify it does not throw.
    expect(() =>
      pauseInactiveMediaInstances(pool, new Set()),
    ).not.toThrow()
  })
})

// ── destroyMediaInstance ──────────────────────────────────────────────────────

describe('destroyMediaInstance', () => {
  // ── Test 8: removes entry and calls pause + clears src ───────────────────

  it('pauses, clears src, and removes the entry for a video key', () => {
    const pool = makePool()
    const vid = getOrCreateMediaInstance(pool, 'background:clip-del', VIDEO_MEDIA) as unknown as FakeVideo
    vid.paused = false

    destroyMediaInstance(pool, 'background:clip-del')

    expect(vid.pause).toHaveBeenCalled()
    expect(vid.src).toBe('')
    expect(pool.has('background:clip-del')).toBe(false)
    expect(pool.size).toBe(0)
  })

  it('is a no-op for a key that does not exist in the pool', () => {
    const pool = makePool()
    expect(() => destroyMediaInstance(pool, 'background:nonexistent')).not.toThrow()
  })
})
