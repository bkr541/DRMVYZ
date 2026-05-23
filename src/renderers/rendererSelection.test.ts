import { describe, it, expect, vi, afterEach } from 'vitest'
import { probeWebGL2Support, resolveRendererType } from './rendererSelection'

afterEach(() => { vi.unstubAllGlobals() })

// ── probeWebGL2Support ────────────────────────────────────────────────────────

describe('probeWebGL2Support', () => {
  it('returns false when document is undefined (SSR / Node)', () => {
    vi.stubGlobal('document', undefined)
    expect(probeWebGL2Support()).toBe(false)
  })

  it('returns false when WebGL2RenderingContext is undefined (old browser)', () => {
    vi.stubGlobal('WebGL2RenderingContext', undefined)
    expect(probeWebGL2Support()).toBe(false)
  })

  it('returns false when getContext("webgl2") returns null', () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => null }),
    })
    expect(probeWebGL2Support()).toBe(false)
  })

  it('returns true when getContext("webgl2") succeeds', () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    const fakeGl = { getExtension: () => null }
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => fakeGl }),
    })
    expect(probeWebGL2Support()).toBe(true)
  })

  it('calls loseContext when the extension is available', () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    const loseContext = vi.fn()
    const fakeGl = { getExtension: () => ({ loseContext }) }
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => fakeGl }),
    })
    probeWebGL2Support()
    expect(loseContext).toHaveBeenCalled()
  })

  it('returns false (does not throw) when getContext throws', () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => { throw new Error('blocked') } }),
    })
    expect(probeWebGL2Support()).toBe(false)
  })
})

// ── resolveRendererType ───────────────────────────────────────────────────────

describe('resolveRendererType', () => {
  function stubSupport(available: boolean) {
    if (available) {
      vi.stubGlobal('WebGL2RenderingContext', class {})
      vi.stubGlobal('document', {
        createElement: () => ({ getContext: () => ({ getExtension: () => null }) }),
      })
    } else {
      vi.stubGlobal('document', undefined)
    }
  }

  it('canvas2d preference always returns canvas2d with no fallback', () => {
    stubSupport(true)
    const r = resolveRendererType('canvas2d')
    expect(r.type).toBe('canvas2d')
    expect(r.fallbackReason).toBeNull()
  })

  it('auto preference returns webgl2 when hardware is available', () => {
    stubSupport(true)
    const r = resolveRendererType('auto')
    expect(r.type).toBe('webgl2')
    expect(r.fallbackReason).toBeNull()
  })

  it('auto preference silently falls back to canvas2d when unavailable', () => {
    stubSupport(false)
    const r = resolveRendererType('auto')
    expect(r.type).toBe('canvas2d')
    expect(r.fallbackReason).toBeNull()
  })

  it('webgl2 preference returns webgl2 when hardware is available', () => {
    stubSupport(true)
    const r = resolveRendererType('webgl2')
    expect(r.type).toBe('webgl2')
    expect(r.fallbackReason).toBeNull()
  })

  it('webgl2 preference falls back with an explicit reason when unavailable', () => {
    stubSupport(false)
    const r = resolveRendererType('webgl2')
    expect(r.type).toBe('canvas2d')
    expect(r.fallbackReason).toMatch(/WebGL2 not available/)
  })
})
