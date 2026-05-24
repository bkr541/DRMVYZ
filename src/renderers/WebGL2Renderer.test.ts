/**
 * WebGL2Renderer unit tests.
 *
 * The Vitest environment is Node — no jsdom, no browser globals.
 * We stub document.createElement to return a fake canvas whose getContext
 * returns null (simulating "no WebGL2") so we can test the typed failure path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebGL2Renderer } from './WebGL2Renderer'
import type { WebGL2CreateResult } from './WebGL2Renderer'

// Minimal fake canvas that returns null for every getContext call
const nullContextCanvas = () => ({ getContext: () => null })

// Fake canvas returning a minimal GL-like object that fails shader compilation
const failShaderCanvas = () => ({
  getContext: () => ({
    createShader:       () => ({}),
    shaderSource:       () => {},
    compileShader:      () => {},
    getShaderParameter: () => false,   // always fail
    getShaderInfoLog:   () => 'syntax error',
    deleteShader:       () => {},
    createProgram:      () => null,
    linkProgram:        () => {},
    getProgramParameter: () => false,
    getProgramInfoLog:  () => '',
    deleteProgram:      () => {},
    getExtension:       () => null,
    VERTEX_SHADER:   35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS:  35713,
    LINK_STATUS:     35714,
    addEventListener:    () => {},
  }),
  addEventListener: () => {},
})

function stubDocument(canvasFactory: () => object) {
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') return canvasFactory()
      throw new Error(`unexpected createElement(${tag})`)
    },
  })
}

beforeEach(() => { stubDocument(nullContextCanvas) })
afterEach(() => { vi.unstubAllGlobals() })

// ── Typed failure result — context unavailable ────────────────────────────

describe('WebGL2Renderer.create() — typed result', () => {
  it('returns { renderer: null, error: "WebGL2 context unavailable" } when context is null', () => {
    const result: WebGL2CreateResult = WebGL2Renderer.create()
    expect(result.renderer).toBeNull()
    expect(result.error).toBe('WebGL2 context unavailable')
  })

  it('result shape contains both renderer and error fields', () => {
    const result = WebGL2Renderer.create()
    expect('renderer' in result).toBe(true)
    expect('error'    in result).toBe(true)
  })

  it('does not throw even when WebGL2 context is unavailable', () => {
    expect(() => WebGL2Renderer.create()).not.toThrow()
  })

  it('error is a non-empty string when context fails', () => {
    const result = WebGL2Renderer.create()
    if (result.renderer === null) {
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  it('accepts optional callbacks without throwing', () => {
    const onContextLost     = vi.fn()
    const onContextRestored = vi.fn()
    expect(() => WebGL2Renderer.create({ onContextLost, onContextRestored })).not.toThrow()
  })

  it('does not invoke onContextLost on creation failure', () => {
    const onContextLost = vi.fn()
    WebGL2Renderer.create({ onContextLost })
    expect(onContextLost).not.toHaveBeenCalled()
  })
})

// ── probeSupport ───────────────────────────────────────────────────────────

describe('WebGL2Renderer.probeSupport()', () => {
  it('returns false when getContext("webgl2") returns null', () => {
    expect(WebGL2Renderer.probeSupport()).toBe(false)
  })

  it('does not throw', () => {
    expect(() => WebGL2Renderer.probeSupport()).not.toThrow()
  })
})

// ── Typed error from shader failure ───────────────────────────────────────

describe('WebGL2Renderer.create() — shader failure paths', () => {
  it('returns typed error string (not null) when shader compilation fails', () => {
    stubDocument(failShaderCanvas)
    const result = WebGL2Renderer.create()
    expect(result.renderer).toBeNull()
    if (result.renderer === null) {
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  it('error contains a recognisable failure description', () => {
    stubDocument(failShaderCanvas)
    const result = WebGL2Renderer.create()
    if (result.renderer === null) {
      // Should be something like "vertex shader compilation failed"
      expect(result.error).toMatch(/shader|program|failed|init/i)
    }
  })
})
