import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import type { MediaPool } from './mediaPool'
import { getOrCreateMediaInstance, pauseInactiveMediaInstances, destroyMediaInstance, MAX_MEDIA_POOL_INSTANCES } from './mediaPool'

// ── Mock browser DOM APIs ──────────────────────────────────────────────────────
// Node environment has no DOM; stub the globals so instanceof checks work.

class FakeVideo {
  src         = ''
  muted       = false
  playsInline = false
  crossOrigin = ''
  loop        = false
  preload     = ''
  paused      = true
  pause = vi.fn(function(this: FakeVideo) { this.paused = true })
  play  = vi.fn(function(this: FakeVideo) { this.paused = false; return Promise.resolve() })
  load  = vi.fn()
  addEventListener    = vi.fn()
  removeEventListener = vi.fn()
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


  it('bounds decoded media instances and evicts the least-recently-used video', () => {
    const pool = makePool()
    for (let index = 0; index < MAX_MEDIA_POOL_INSTANCES; index += 1) {
      getOrCreateMediaInstance(pool, `background:${index}`, VIDEO_MEDIA)
    }
    const oldest = pool.get('background:0') as unknown as FakeVideo
    getOrCreateMediaInstance(pool, 'background:1', VIDEO_MEDIA)
    getOrCreateMediaInstance(pool, 'background:new', VIDEO_MEDIA)
    expect(pool.size).toBe(MAX_MEDIA_POOL_INSTANCES)
    expect(pool.has('background:0')).toBe(false)
    expect(pool.has('background:1')).toBe(true)
    expect(oldest.pause).toHaveBeenCalled()
    expect(oldest.src).toBe('')
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

// ── Video element initialization ordering ─────────────────────────────────────
//
// Proves that crossOrigin is assigned before src so the browser issues a
// CORS-mode request from the first fetch, making decoded frames usable for
// Canvas drawImage() and WebGL texImage2D().
//
// Uses property-setter tracking so the ordering is verified at runtime
// rather than inferred from static analysis.

describe('video element initialization — crossOrigin-before-src contract', () => {
  // A FakeVideo variant that records property assignment order via setters.
  class TrackingVideo {
    private _assignments: string[] = []
    private _src         = ''
    private _crossOrigin = ''
    muted       = false
    playsInline = false
    loop        = false
    preload     = ''
    paused      = true
    pause = vi.fn()
    play  = vi.fn(() => Promise.resolve())
    load  = vi.fn()
    addEventListener    = vi.fn()
    removeEventListener = vi.fn()

    get src()          { return this._src }
    set src(v: string) { this._src = v;          this._assignments.push('src') }
    get crossOrigin()          { return this._crossOrigin }
    set crossOrigin(v: string) { this._crossOrigin = v;   this._assignments.push('crossOrigin') }

    get assignments() { return [...this._assignments] }
  }

  let lastCreated: TrackingVideo | null = null

  beforeEach(() => {
    lastCreated = null
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'video') { lastCreated = new TrackingVideo(); return lastCreated }
        throw new Error(`unexpected createElement: '${tag}'`)
      },
    })
  })

  afterEach(() => {
    // Restore the standard FakeVideo-backed document mock for subsequent suites.
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'video') return new FakeVideo()
        throw new Error(`unexpected createElement: '${tag}'`)
      },
    })
  })

  it('assigns crossOrigin before src', () => {
    const pool = makePool()
    getOrCreateMediaInstance(pool, 'background:order-1', VIDEO_MEDIA)
    const idx = lastCreated!.assignments
    expect(idx.indexOf('crossOrigin')).toBeGreaterThanOrEqual(0)
    expect(idx.indexOf('src')).toBeGreaterThan(idx.indexOf('crossOrigin'))
  })

  it('sets muted, playsInline, preload and calls load()', () => {
    const pool = makePool()
    getOrCreateMediaInstance(pool, 'background:config-1', VIDEO_MEDIA)
    const vid = lastCreated!
    expect(vid.muted).toBe(true)
    expect(vid.playsInline).toBe(true)
    expect(vid.preload).toBe('auto')
    expect(vid.load).toHaveBeenCalledOnce()
  })

  it('crossOrigin-before-src holds for local blob: URLs', () => {
    const pool = makePool()
    const blobMedia = { type: 'video', url: 'blob:http://localhost/uuid-1234' }
    getOrCreateMediaInstance(pool, 'background:blob-1', blobMedia)
    const idx = lastCreated!.assignments
    expect(idx.indexOf('crossOrigin')).toBeLessThan(idx.indexOf('src'))
    expect(lastCreated!.src).toBe(blobMedia.url)
  })

  it('crossOrigin-before-src holds for remote/cloud URLs', () => {
    const pool = makePool()
    const cloudMedia = { type: 'video', url: 'https://storage.supabase.co/bucket/v.mp4?token=abc' }
    getOrCreateMediaInstance(pool, 'background:cloud-1', cloudMedia)
    const idx = lastCreated!.assignments
    expect(idx.indexOf('crossOrigin')).toBeLessThan(idx.indexOf('src'))
    expect(lastCreated!.crossOrigin).toBe('anonymous')
  })

  it('loop default is false when no opts supplied', () => {
    const pool = makePool()
    getOrCreateMediaInstance(pool, 'background:loop-default', VIDEO_MEDIA)
    expect(lastCreated!.loop).toBe(false)
  })

  it('loop is true when opts.loop is true', () => {
    const pool = makePool()
    getOrCreateMediaInstance(pool, 'background:loop-on', VIDEO_MEDIA, { loop: true })
    expect(lastCreated!.loop).toBe(true)
  })
})
