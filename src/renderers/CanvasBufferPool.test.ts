/**
 * CanvasBufferPool unit tests.
 *
 * Vitest environment is Node — no browser globals.
 * We stub document.createElement to return plain objects whose `width`/`height`
 * properties CanvasBufferPool reads/writes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CanvasBufferPool } from './CanvasBufferPool'

function makeCanvas(w = 0, h = 0) {
  return { width: w, height: h } as unknown as HTMLCanvasElement
}

beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') return makeCanvas()
      throw new Error(`unexpected createElement(${tag})`)
    },
  })
})
afterEach(() => { vi.unstubAllGlobals() })

// ── acquire ───────────────────────────────────────────────────────────────────

describe('CanvasBufferPool.acquire()', () => {
  it('returns a canvas with the requested dimensions', () => {
    const pool = new CanvasBufferPool()
    const c = pool.acquire('test', 800, 600)
    expect(c.width).toBe(800)
    expect(c.height).toBe(600)
  })

  it('returns the same canvas instance on repeated calls with identical key+dims', () => {
    const pool = new CanvasBufferPool()
    const a = pool.acquire('key', 100, 100)
    const b = pool.acquire('key', 100, 100)
    expect(a).toBe(b)
  })

  it('returns different canvases for different keys', () => {
    const pool = new CanvasBufferPool()
    const a = pool.acquire('a', 100, 100)
    const b = pool.acquire('b', 100, 100)
    expect(a).not.toBe(b)
  })

  it('resizes the canvas in-place when dimensions change', () => {
    const pool = new CanvasBufferPool()
    const c1 = pool.acquire('key', 100, 100)
    const c2 = pool.acquire('key', 200, 150)
    expect(c1).toBe(c2)       // same object
    expect(c2.width).toBe(200)
    expect(c2.height).toBe(150)
  })

  it('does not reallocate when dimensions are unchanged', () => {
    const pool = new CanvasBufferPool()
    const calls: number[] = []
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') { calls.push(1); return makeCanvas() }
        throw new Error('unexpected')
      },
    })
    pool.acquire('k', 10, 10)
    pool.acquire('k', 10, 10)
    expect(calls.length).toBe(1)   // only one canvas created
  })
})

// ── size ──────────────────────────────────────────────────────────────────────

describe('CanvasBufferPool.size', () => {
  it('returns 0 for a fresh pool', () => {
    expect(new CanvasBufferPool().size).toBe(0)
  })

  it('tracks the number of distinct keys', () => {
    const pool = new CanvasBufferPool()
    pool.acquire('a', 1, 1)
    pool.acquire('b', 1, 1)
    expect(pool.size).toBe(2)
  })
})

// ── endFrame ─────────────────────────────────────────────────────────────────

describe('CanvasBufferPool.endFrame()', () => {
  it('evicts an entry not acquired in the subsequent frame', () => {
    const pool = new CanvasBufferPool()
    // Frame 1: entry is acquired and used
    pool.acquire('stale', 10, 10)
    pool.endFrame()
    expect(pool.size).toBe(1)   // kept after frame 1

    // Frame 2: entry is not re-acquired → evicted
    pool.endFrame()
    expect(pool.size).toBe(0)
  })

  it('keeps an entry that was acquired this frame when endFrame is called', () => {
    const pool = new CanvasBufferPool()
    pool.acquire('active', 10, 10)
    pool.endFrame()   // 'active' was marked used this frame → kept
    expect(pool.size).toBe(1)

    // Still active in next frame
    pool.acquire('active', 10, 10)
    pool.endFrame()
    expect(pool.size).toBe(1)
  })

  it('evicts entries that become inactive after being active', () => {
    const pool = new CanvasBufferPool()
    // Frame 1: both keys active
    pool.acquire('a', 10, 10)
    pool.acquire('b', 10, 10)
    pool.endFrame()
    expect(pool.size).toBe(2)

    // Frame 2: only 'a' active
    pool.acquire('a', 10, 10)
    pool.endFrame()
    expect(pool.size).toBe(1)
  })

  it('resets the used-this-frame set so previously-evicted key can be re-added', () => {
    const pool = new CanvasBufferPool()
    pool.acquire('x', 5, 5)
    pool.endFrame()   // 'x' evicted (not re-acquired before endFrame)

    // Re-acquire in a later frame
    pool.acquire('x', 5, 5)
    pool.endFrame()
    expect(pool.size).toBe(1)
  })
})

// ── dispose ───────────────────────────────────────────────────────────────────

describe('CanvasBufferPool.dispose()', () => {
  it('clears all entries', () => {
    const pool = new CanvasBufferPool()
    pool.acquire('a', 1, 1)
    pool.acquire('b', 1, 1)
    pool.dispose()
    expect(pool.size).toBe(0)
  })

  it('can be called multiple times without throwing', () => {
    const pool = new CanvasBufferPool()
    pool.acquire('a', 1, 1)
    expect(() => { pool.dispose(); pool.dispose() }).not.toThrow()
  })

  it('allows fresh acquire after dispose', () => {
    const pool = new CanvasBufferPool()
    pool.acquire('a', 1, 1)
    pool.dispose()
    expect(pool.size).toBe(0)
    pool.acquire('a', 2, 2)
    expect(pool.size).toBe(1)
  })
})
