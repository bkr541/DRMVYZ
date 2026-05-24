import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  probeWebGL2Support,
  resolveRendererType,
  resolvePreferredRenderer,
  computeFallbackStatus,
} from './rendererSelection'
import type { GpuPreference } from './rendererSelection'

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

  it('auto preference falls back to canvas2d with an informational reason when unavailable', () => {
    stubSupport(false)
    const r = resolveRendererType('auto')
    expect(r.type).toBe('canvas2d')
    expect(r.fallbackReason).toMatch(/WebGL2.*unavailable|unavailable.*WebGL2/i)
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

// ── resolvePreferredRenderer ──────────────────────────────────────────────────

describe('resolvePreferredRenderer — pure 2-arg function', () => {
  const cases: [GpuPreference, boolean, 'canvas2d' | 'webgl2'][] = [
    ['canvas2d', true,  'canvas2d'],
    ['canvas2d', false, 'canvas2d'],
    ['auto',     true,  'webgl2'],
    ['auto',     false, 'canvas2d'],
    ['webgl2',   true,  'webgl2'],
    ['webgl2',   false, 'canvas2d'],
  ]
  it.each(cases)(
    'resolvePreferredRenderer(%s, %s) → %s',
    (pref, available, expected) => {
      expect(resolvePreferredRenderer(pref, available)).toBe(expected)
    },
  )
})

// ── computeFallbackStatus ─────────────────────────────────────────────────────

describe('computeFallbackStatus', () => {
  it('canvas2d preference: never shows warning regardless of state', () => {
    for (const contextLost of [true, false]) {
      for (const reason of [null, 'some error']) {
        const r = computeFallbackStatus('canvas2d', 'canvas2d', contextLost, reason)
        expect(r.showFallbackWarning).toBe(false)
        expect(r.severity).toBe('none')
      }
    }
  })

  it('no warning when everything is working (auto + webgl2 active)', () => {
    const r = computeFallbackStatus('auto', 'webgl2', false, null)
    expect(r.showFallbackWarning).toBe(false)
    expect(r.severity).toBe('none')
  })

  it('context lost with auto preference → warning severity', () => {
    const r = computeFallbackStatus('auto', 'canvas2d', true, 'WebGL2 context lost during playback')
    expect(r.showFallbackWarning).toBe(true)
    expect(r.severity).toBe('warning')
  })

  it('context lost with explicit webgl2 preference → critical severity', () => {
    const r = computeFallbackStatus('webgl2', 'canvas2d', true, 'WebGL2 context lost during playback')
    expect(r.showFallbackWarning).toBe(true)
    expect(r.severity).toBe('critical')
  })

  it('init failure with auto preference → info severity', () => {
    const r = computeFallbackStatus('auto', 'canvas2d', false, 'WebGL2 context unavailable')
    expect(r.showFallbackWarning).toBe(true)
    expect(r.severity).toBe('info')
  })

  it('init failure with explicit webgl2 preference → warning severity', () => {
    const r = computeFallbackStatus('webgl2', 'canvas2d', false, 'WebGL2 context unavailable')
    expect(r.showFallbackWarning).toBe(true)
    expect(r.severity).toBe('warning')
  })

  it('no warning when fallbackReason is set but active renderer is still webgl2', () => {
    // Stale reason from a previous session — should not show while GPU is running
    const r = computeFallbackStatus('auto', 'webgl2', false, 'stale reason')
    expect(r.showFallbackWarning).toBe(false)
  })

  it('gpuPreference saved preference is not changed by a runtime failure scenario', () => {
    // This is a contract test: computeFallbackStatus only reads preference, never writes it.
    // Verify that calling the function with a failure state doesn't mutate the input.
    const pref: GpuPreference = 'webgl2'
    computeFallbackStatus(pref, 'canvas2d', true, 'context lost')
    expect(pref).toBe('webgl2')  // unchanged — pure function
  })
})
