/**
 * WebGL2Renderer unit tests.
 *
 * The Vitest environment is Node — no jsdom, no browser globals.
 * All tests stub document.createElement to inject fake GL contexts so that
 * every failure scenario can be triggered deterministically without a real GPU.
 *
 * Coverage goals:
 *   A. Typed failure result on context unavailable  (existing)
 *   B. Shader compilation failure paths             (existing + extended)
 *   C. Resource allocation null returns:
 *        gl.createTexture()      → null
 *        gl.createFramebuffer()  → null
 *        gl.createBuffer()       → null
 *        gl.createVertexArray()  → null
 *   D. Framebuffer completeness check failure
 *   E. Partial-init cleanup: previously created resources are deleted
 *   F. Successful init + full dispose
 *   G. dispose() idempotency (called twice)
 *   H. Context-loss callback wiring / removal after dispose
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebGL2Renderer } from './WebGL2Renderer'
import type { WebGL2CreateResult } from './WebGL2Renderer'

// ── Minimal GL constants ──────────────────────────────────────────────────────

const GL = {
  VERTEX_SHADER:       35633,
  FRAGMENT_SHADER:     35632,
  COMPILE_STATUS:      35713,
  LINK_STATUS:         35714,
  FRAMEBUFFER:         36160,
  FRAMEBUFFER_COMPLETE: 36053,
  COLOR_ATTACHMENT0:   36064,
  TEXTURE_2D:          3553,
  TEXTURE_WRAP_S:      10242,
  TEXTURE_WRAP_T:      10243,
  TEXTURE_MIN_FILTER:  10241,
  TEXTURE_MAG_FILTER:  10240,
  CLAMP_TO_EDGE:       33071,
  LINEAR:              9729,
  ARRAY_BUFFER:        34962,
  STATIC_DRAW:         35044,
  FLOAT:               5126,
  RGBA:                6408,
  RGBA8:               32856,
  UNSIGNED_BYTE:       5121,
  TRIANGLES:           4,
  TEXTURE0:            33984,
  TEXTURE1:            33985,
}

// ── Deletion counters returned by makeGLMock ─────────────────────────────────

interface DeleteCounts {
  shaders:      number
  programs:     number
  textures:     number
  fbos:         number
  buffers:      number
  vaos:         number
}

// ── Configurable GL mock ──────────────────────────────────────────────────────

interface GlMockOpts {
  /** Fail the Nth call to createTexture (1-based). */
  failTextureAt?: number
  /** Fail the Nth call to createFramebuffer (1-based). */
  failFBOAt?: number
  /** Fail the Nth call to createBuffer (1-based). */
  failBufferAt?: number
  /** Fail the Nth call to createVertexArray (1-based). */
  failVAOAt?: number
  /**
   * Return this value from checkFramebufferStatus.
   * Defaults to FRAMEBUFFER_COMPLETE (36053).
   */
  framebufferStatus?: number
  /**
   * Return false from getShaderParameter(COMPILE_STATUS) on the Nth call
   * (1-based).  Defaults to always-success.
   */
  failShaderAt?: number
  /**
   * Return false from getProgramParameter(LINK_STATUS) on the Nth call
   * (1-based).  Defaults to always-success.
   */
  failProgramAt?: number
}

function makeGLMock(opts: GlMockOpts = {}): { gl: object; deleted: DeleteCounts } {
  const deleted: DeleteCounts = { shaders: 0, programs: 0, textures: 0, fbos: 0, buffers: 0, vaos: 0 }
  let texCount = 0, fboCount = 0, bufCount = 0, vaoCount = 0
  let shaderCompileN = 0, programLinkN = 0

  const gl: Record<string, unknown> = {
    ...GL,

    // ── Shaders ──────────────────────────────────────────────────────────
    createShader:       () => ({}),
    shaderSource:       () => {},
    compileShader:      () => {},
    getShaderParameter: (_s: unknown, pname: unknown) => {
      if (pname === GL.COMPILE_STATUS) {
        shaderCompileN++
        if (opts.failShaderAt !== undefined && shaderCompileN >= opts.failShaderAt) return false
      }
      return true
    },
    getShaderInfoLog:   () => 'mock shader log',
    deleteShader:       () => { deleted.shaders++ },

    // ── Programs ─────────────────────────────────────────────────────────
    createProgram:       () => ({}),
    attachShader:        () => {},
    linkProgram:         () => {},
    getProgramParameter: (_p: unknown, pname: unknown) => {
      if (pname === GL.LINK_STATUS) {
        programLinkN++
        if (opts.failProgramAt !== undefined && programLinkN >= opts.failProgramAt) return false
      }
      return true
    },
    getProgramInfoLog:  () => 'mock program log',
    deleteProgram:      () => { deleted.programs++ },

    // ── Textures ─────────────────────────────────────────────────────────
    createTexture: () => {
      texCount++
      if (opts.failTextureAt !== undefined && texCount >= opts.failTextureAt) return null
      return {}
    },
    bindTexture:    () => {},
    texParameteri:  () => {},
    texImage2D:     () => {},
    texSubImage2D:  () => {},
    deleteTexture:  () => { deleted.textures++ },

    // ── Framebuffers ─────────────────────────────────────────────────────
    createFramebuffer: () => {
      fboCount++
      if (opts.failFBOAt !== undefined && fboCount >= opts.failFBOAt) return null
      return {}
    },
    bindFramebuffer:        () => {},
    framebufferTexture2D:   () => {},
    checkFramebufferStatus: () => opts.framebufferStatus ?? GL.FRAMEBUFFER_COMPLETE,
    deleteFramebuffer:      () => { deleted.fbos++ },

    // ── Buffers ───────────────────────────────────────────────────────────
    createBuffer: () => {
      bufCount++
      if (opts.failBufferAt !== undefined && bufCount >= opts.failBufferAt) return null
      return {}
    },
    bindBuffer:             () => {},
    bufferData:             () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer:    () => {},
    deleteBuffer:           () => { deleted.buffers++ },

    // ── Vertex arrays ─────────────────────────────────────────────────────
    createVertexArray: () => {
      vaoCount++
      if (opts.failVAOAt !== undefined && vaoCount >= opts.failVAOAt) return null
      return {}
    },
    bindVertexArray:    () => {},
    deleteVertexArray:  () => { deleted.vaos++ },

    // ── Uniforms / misc ───────────────────────────────────────────────────
    getUniformLocation:     () => ({}),
    bindAttribLocation:     () => {},
    useProgram:             () => {},
    uniform1i:              () => {},
    uniform1f:              () => {},
    uniform2f:              () => {},
    uniform4f:              () => {},
    drawArrays:             () => {},
    flush:                  () => {},
    viewport:               () => {},
    activeTexture:          () => {},
    getExtension:           () => null,
    getParameter:           () => null,
  }

  return { gl, deleted }
}

// ── Canvas factory helpers ────────────────────────────────────────────────────

/** Build a minimal fake canvas whose getContext returns the given GL mock. */
function makeCanvas(gl: object): object {
  return {
    getContext:          () => gl,
    addEventListener:    () => {},
    removeEventListener: () => {},
  }
}

/**
 * Build a canvas that stores event listeners so tests can fire
 * 'webglcontextlost' / 'webglcontextrestored' manually.
 */
function makeEventedCanvas(gl: object): {
  canvas: object
  fire: (type: string, event?: object) => void
  listenerCount: (type: string) => number
} {
  const listeners: Record<string, Set<(e: object) => void>> = {}
  const canvas = {
    getContext: () => gl,
    addEventListener: (type: string, fn: (e: object) => void) => {
      if (!listeners[type]) listeners[type] = new Set()
      listeners[type].add(fn)
    },
    removeEventListener: (type: string, fn: (e: object) => void) => {
      listeners[type]?.delete(fn)
    },
  }
  return {
    canvas,
    fire: (type: string, event: object = {}) => {
      listeners[type]?.forEach(fn => fn(event))
    },
    listenerCount: (type: string) => listeners[type]?.size ?? 0,
  }
}

/** Stub global document so createElement('canvas') returns a given fake canvas. */
function stubCanvas(canvas: object) {
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') return canvas
      throw new Error(`unexpected createElement(${tag})`)
    },
  })
}

// ── Minimal fake canvas that returns null for every getContext call ───────────
const nullContextCanvas = () => ({ getContext: () => null, addEventListener: () => {}, removeEventListener: () => {} })

// Fake canvas returning a minimal GL-like object that fails shader compilation
const failShaderCanvas = () => ({
  getContext: () => ({
    ...GL,
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
    addEventListener:    () => {},
    removeEventListener: () => {},
  }),
  addEventListener:    () => {},
  removeEventListener: () => {},
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

// ── A. Typed failure result — context unavailable ─────────────────────────────

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

// ── B. probeSupport ───────────────────────────────────────────────────────────

describe('WebGL2Renderer.probeSupport()', () => {
  it('returns false when getContext("webgl2") returns null', () => {
    expect(WebGL2Renderer.probeSupport()).toBe(false)
  })

  it('does not throw', () => {
    expect(() => WebGL2Renderer.probeSupport()).not.toThrow()
  })
})

// ── B. Shader failure paths ───────────────────────────────────────────────────

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
      expect(result.error).toMatch(/shader|program|failed|init/i)
    }
  })

  it('error names the failing shader stage', () => {
    stubDocument(failShaderCanvas)
    const result = WebGL2Renderer.create()
    if (result.renderer === null) {
      expect(result.error).toMatch(/vertex|fragment|shader/i)
    }
  })

  it('cleanup: earlier shaders are deleted when a later shader fails', () => {
    const { gl, deleted } = makeGLMock({ failShaderAt: 5 })
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    expect(result.renderer).toBeNull()
    // The first 4 shaders were successfully compiled and tracked.
    // The 5th failed shader is deleted inside compileShader itself.
    // tracker.cleanup() deletes the other 4 previously-tracked shaders.
    expect(deleted.shaders).toBeGreaterThanOrEqual(4)
  })
})

// ── C/E. Resource allocation null returns — cleanup verification ──────────────

describe('WebGL2Renderer.create() — gl.createTexture() returns null', () => {
  it('renderer creation fails with a texture-allocation error', () => {
    const { gl, deleted } = makeGLMock({ failTextureAt: 1 })
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    expect(result.renderer).toBeNull()
    expect(result.error).toMatch(/texture.*allocation|allocation.*texture/i)
  })

  it('previously created shaders are cleaned up after texture failure', () => {
    const { gl, deleted } = makeGLMock({ failTextureAt: 1 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    // 9 shaders (1 vertex + 8 fragment) must have been deleted
    expect(deleted.shaders).toBeGreaterThanOrEqual(9)
  })

  it('previously created programs are cleaned up after texture failure', () => {
    const { gl, deleted } = makeGLMock({ failTextureAt: 1 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    expect(deleted.programs).toBeGreaterThanOrEqual(8)
  })

  it('geometry resources (VAO, VBO) are cleaned up after texture failure', () => {
    const { gl, deleted } = makeGLMock({ failTextureAt: 1 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    expect(deleted.vaos).toBeGreaterThanOrEqual(1)
    expect(deleted.buffers).toBeGreaterThanOrEqual(1)
  })
})

describe('WebGL2Renderer.create() — gl.createFramebuffer() returns null', () => {
  it('renderer creation fails with a framebuffer-allocation error', () => {
    const { gl, deleted } = makeGLMock({ failFBOAt: 1 })
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    expect(result.renderer).toBeNull()
    expect(result.error).toMatch(/framebuffer.*allocation|allocation.*framebuffer/i)
  })

  it('previously created textures are cleaned up after FBO failure', () => {
    const { gl, deleted } = makeGLMock({ failFBOAt: 1 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    // videoTex and sceneTex are created before the first FBO
    expect(deleted.textures).toBeGreaterThanOrEqual(1)
  })

  it('previously created programs are cleaned up after FBO failure', () => {
    const { gl, deleted } = makeGLMock({ failFBOAt: 1 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    expect(deleted.programs).toBeGreaterThanOrEqual(8)
  })
})

describe('WebGL2Renderer.create() — gl.createBuffer() returns null', () => {
  it('renderer creation fails with a buffer-allocation error', () => {
    const { gl, deleted } = makeGLMock({ failBufferAt: 1 })
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    expect(result.renderer).toBeNull()
    expect(result.error).toMatch(/buffer.*allocation|allocation.*buffer/i)
  })

  it('previously created VAO is cleaned up after buffer failure', () => {
    const { gl, deleted } = makeGLMock({ failBufferAt: 1 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    expect(deleted.vaos).toBeGreaterThanOrEqual(1)
  })

  it('previously created programs are cleaned up after buffer failure', () => {
    const { gl, deleted } = makeGLMock({ failBufferAt: 1 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    expect(deleted.programs).toBeGreaterThanOrEqual(8)
  })
})

describe('WebGL2Renderer.create() — gl.createVertexArray() returns null', () => {
  it('renderer creation fails with a vertex-array-allocation error', () => {
    const { gl, deleted } = makeGLMock({ failVAOAt: 1 })
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    expect(result.renderer).toBeNull()
    expect(result.error).toMatch(/vertex array|vertex.array/i)
  })

  it('previously created shaders and programs are cleaned up after VAO failure', () => {
    const { gl, deleted } = makeGLMock({ failVAOAt: 1 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    expect(deleted.shaders).toBeGreaterThanOrEqual(9)
    expect(deleted.programs).toBeGreaterThanOrEqual(8)
  })
})

// ── D. Framebuffer completeness ───────────────────────────────────────────────

describe('WebGL2Renderer.create() — framebuffer completeness check', () => {
  it('renderer creation fails when checkFramebufferStatus is not FRAMEBUFFER_COMPLETE', () => {
    const { gl, deleted } = makeGLMock({ framebufferStatus: 36054 })  // not 36053
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    expect(result.renderer).toBeNull()
    expect(result.error).toMatch(/framebuffer.*incomplete|incomplete.*framebuffer/i)
  })

  it('error message identifies the failing render target', () => {
    const { gl } = makeGLMock({ framebufferStatus: 36054 })
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    if (result.renderer === null) {
      // Should name which render target was incomplete
      expect(result.error).toMatch(/render target|scene|RGB|bloom|post.process|displacement/i)
    }
  })

  it('the incomplete FBO itself is deleted (not leaked)', () => {
    const { gl, deleted } = makeGLMock({ framebufferStatus: 36054 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    // makeFBO deletes the incomplete FBO directly, then tracker.cleanup() runs
    expect(deleted.fbos).toBeGreaterThanOrEqual(1)
  })

  it('textures created before the incomplete FBO are cleaned up', () => {
    const { gl, deleted } = makeGLMock({ framebufferStatus: 36054 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    expect(deleted.textures).toBeGreaterThanOrEqual(1)
  })
})

// ── B extended. Later program link failure cleanup ────────────────────────────

describe('WebGL2Renderer.create() — program link failure cleanup', () => {
  it('renderer creation fails when a later program fails to link', () => {
    const { gl, deleted } = makeGLMock({ failProgramAt: 5 })
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    expect(result.renderer).toBeNull()
    expect(result.error).toMatch(/program.*link|link.*failed/i)
  })

  it('all 9 shaders are cleaned up when a program link fails', () => {
    const { gl, deleted } = makeGLMock({ failProgramAt: 5 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    // 9 shaders compiled successfully before program 5 failed
    expect(deleted.shaders).toBeGreaterThanOrEqual(9)
  })

  it('previously linked programs are cleaned up when a later link fails', () => {
    const { gl, deleted } = makeGLMock({ failProgramAt: 5 })
    stubCanvas(makeCanvas(gl))
    WebGL2Renderer.create()
    // 4 programs linked before the 5th failed (which is also deleted by linkProgram itself)
    expect(deleted.programs).toBeGreaterThanOrEqual(4)
  })
})

// ── F. Successful creation + full dispose ─────────────────────────────────────

describe('WebGL2Renderer.create() — successful init and dispose', () => {
  it('create() returns a non-null renderer with null error on full mock success', () => {
    const { gl } = makeGLMock()
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    expect(result.renderer).not.toBeNull()
    expect(result.error).toBeNull()
    result.renderer?.dispose()
  })

  it('dispose() deletes all GPU programs', () => {
    const { gl, deleted } = makeGLMock()
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    result.renderer?.dispose()
    expect(deleted.programs).toBeGreaterThanOrEqual(8)
  })

  it('dispose() deletes the vertex shader', () => {
    const { gl, deleted } = makeGLMock()
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    result.renderer?.dispose()
    expect(deleted.shaders).toBeGreaterThanOrEqual(1)
  })

  it('dispose() deletes all textures (video + 6 render targets)', () => {
    const { gl, deleted } = makeGLMock()
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    result.renderer?.dispose()
    expect(deleted.textures).toBeGreaterThanOrEqual(7)
  })

  it('dispose() deletes all framebuffers (6 render targets)', () => {
    const { gl, deleted } = makeGLMock()
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    result.renderer?.dispose()
    expect(deleted.fbos).toBeGreaterThanOrEqual(6)
  })

  it('dispose() deletes geometry (VAO and VBO)', () => {
    const { gl, deleted } = makeGLMock()
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    result.renderer?.dispose()
    expect(deleted.vaos).toBeGreaterThanOrEqual(1)
    expect(deleted.buffers).toBeGreaterThanOrEqual(1)
  })
})

// ── G. dispose() idempotency ──────────────────────────────────────────────────

describe('WebGL2Renderer.dispose() — idempotency', () => {
  it('calling dispose() twice does not throw', () => {
    const { gl } = makeGLMock()
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    expect(result.renderer).not.toBeNull()
    expect(() => {
      result.renderer?.dispose()
      result.renderer?.dispose()
    }).not.toThrow()
  })

  it('calling dispose() twice does not double-delete programs', () => {
    const { gl, deleted } = makeGLMock()
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    result.renderer?.dispose()
    const afterFirst = deleted.programs
    result.renderer?.dispose()  // second call — should be no-op
    expect(deleted.programs).toBe(afterFirst)
  })

  it('calling dispose() twice does not double-delete textures', () => {
    const { gl, deleted } = makeGLMock()
    stubCanvas(makeCanvas(gl))
    const result = WebGL2Renderer.create()
    result.renderer?.dispose()
    const afterFirst = deleted.textures
    result.renderer?.dispose()
    expect(deleted.textures).toBe(afterFirst)
  })
})

// ── H. Context-loss callback wiring ──────────────────────────────────────────

describe('WebGL2Renderer — context-loss event wiring', () => {
  it('onContextLost callback is invoked with a reason string when the context is lost', () => {
    const { gl } = makeGLMock()
    const { canvas, fire } = makeEventedCanvas(gl)
    stubCanvas(canvas)

    const onContextLost = vi.fn()
    const result = WebGL2Renderer.create({ onContextLost })
    expect(result.renderer).not.toBeNull()

    const mockEvent = { preventDefault: vi.fn() }
    fire('webglcontextlost', mockEvent)

    expect(mockEvent.preventDefault).toHaveBeenCalled()
    expect(onContextLost).toHaveBeenCalledWith('WebGL2 context lost during playback')
    result.renderer?.dispose()
  })

  it('onContextRestored callback is invoked when the context is restored', () => {
    const { gl } = makeGLMock()
    const { canvas, fire } = makeEventedCanvas(gl)
    stubCanvas(canvas)

    const onContextRestored = vi.fn()
    const result = WebGL2Renderer.create({ onContextRestored })
    expect(result.renderer).not.toBeNull()

    fire('webglcontextrestored')
    expect(onContextRestored).toHaveBeenCalled()
    result.renderer?.dispose()
  })

  it('context-loss listeners are removed after dispose()', () => {
    const { gl } = makeGLMock()
    const { canvas, fire, listenerCount } = makeEventedCanvas(gl)
    stubCanvas(canvas)

    const result = WebGL2Renderer.create({
      onContextLost:     vi.fn(),
      onContextRestored: vi.fn(),
    })
    const beforeDispose = listenerCount('webglcontextlost')
    expect(beforeDispose).toBeGreaterThanOrEqual(1)

    result.renderer?.dispose()

    expect(listenerCount('webglcontextlost')).toBe(0)
    expect(listenerCount('webglcontextrestored')).toBe(0)
  })

  it('onContextLost is NOT called when dispose() triggers loseContext()', () => {
    // dispose() removes listeners BEFORE calling loseContext() — the callback
    // must not fire for a deliberate teardown.
    const { gl } = makeGLMock()
    const { canvas, fire } = makeEventedCanvas(gl)
    stubCanvas(canvas)

    const onContextLost = vi.fn()
    const result = WebGL2Renderer.create({ onContextLost })
    result.renderer?.dispose()

    // Manually fire the event to simulate what loseContext() would trigger —
    // the listener should already be removed.
    fire('webglcontextlost', { preventDefault: vi.fn() })
    expect(onContextLost).not.toHaveBeenCalled()
  })
})
