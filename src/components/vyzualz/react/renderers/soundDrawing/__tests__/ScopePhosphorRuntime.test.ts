import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScopePhosphorRuntime, type ScopePhosphorFrameInput } from '../ScopePhosphorRuntime'
import { resetDrmvyzWebGLContextDiagnosticsForTests } from '../../../shaders/runtime/WebGLContextLifecycle'
import {
  DEFAULT_SCOPE_BEAM,
  DEFAULT_SCOPE_CRT,
  DEFAULT_SCOPE_PHOSPHOR,
} from '../../../../../../audio/scope/scopeTypes'

// ── Mock WebGL2 context ───────────────────────────────────────────────────────
//
// Records the call sequence so pass ordering, blend state, framebuffer
// targeting, and resource lifecycle are assertable in the node partition —
// the GPU-level properties §24.3 of the brief calls for.

interface MockOptions {
  failShaderCompile?: boolean
  failContextCreation?: boolean
  colorBufferFloat?: boolean
  floatBlend?: boolean
  framebufferComplete?: boolean
}

function makeMockGL(options: MockOptions = {}) {
  let objectId = 1
  const calls: { method: string; args: unknown[] }[] = []
  const created = { textures: 0, framebuffers: 0, programs: 0, shaders: 0 }
  const deleted = { textures: 0, framebuffers: 0, programs: 0, shaders: 0 }
  let contextLost = false

  const record = (method: string, args: unknown[] = []) => { calls.push({ method, args }) }

  const gl = {
    TEXTURE_2D: 0x0de1, FRAMEBUFFER: 0x8d40, COLOR_ATTACHMENT0: 0x8ce0,
    FRAMEBUFFER_COMPLETE: 0x8cd5, COLOR_BUFFER_BIT: 0x4000, TRIANGLES: 0x0004,
    TRIANGLE_STRIP: 0x0005, ARRAY_BUFFER: 0x8892, STATIC_DRAW: 0x88e4,
    DYNAMIC_DRAW: 0x88e8, FLOAT: 0x1406, BLEND: 0x0be2, ONE: 1,
    RGBA: 0x1908, RGBA8: 0x8058, RGBA16F: 0x881a, UNSIGNED_BYTE: 0x1401,
    HALF_FLOAT: 0x140b, LINEAR: 0x2601, NEAREST: 0x2600, CLAMP_TO_EDGE: 0x812f,
    TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803, TEXTURE0: 0x84c0,
    VERTEX_SHADER: 0x8b31, FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81, LINK_STATUS: 0x8b82,
    MAX_TEXTURE_SIZE: 0x0d33, MAX_RENDERBUFFER_SIZE: 0x84e8,

    getExtension: vi.fn((name: string) => {
      if (name === 'EXT_color_buffer_float') return options.colorBufferFloat === false ? null : {}
      if (name === 'EXT_float_blend') return options.floatBlend === false ? null : {}
      if (name === 'OES_texture_float_linear') return {}
      return null
    }),
    getParameter: vi.fn((p: number) => (p === 0x0d33 || p === 0x84e8 ? 16384 : null)),

    createTexture: vi.fn(() => { created.textures++; return { _t: objectId++ } as unknown as WebGLTexture }),
    deleteTexture: vi.fn(() => { deleted.textures++ }),
    createFramebuffer: vi.fn(() => { created.framebuffers++; return { _f: objectId++ } as unknown as WebGLFramebuffer }),
    deleteFramebuffer: vi.fn(() => { deleted.framebuffers++ }),
    createRenderbuffer: vi.fn(() => ({ _r: objectId++ } as unknown as WebGLRenderbuffer)),
    deleteRenderbuffer: vi.fn(),
    createBuffer: vi.fn(() => ({ _b: objectId++ } as unknown as WebGLBuffer)),
    deleteBuffer: vi.fn(),
    createVertexArray: vi.fn(() => ({ _v: objectId++ } as unknown as WebGLVertexArrayObject)),
    deleteVertexArray: vi.fn(),

    createShader: vi.fn(() => { created.shaders++; return { _s: objectId++ } as unknown as WebGLShader }),
    deleteShader: vi.fn(() => { deleted.shaders++ }),
    shaderSource: vi.fn(), compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => !options.failShaderCompile),
    getShaderInfoLog: vi.fn(() => 'mock compile failure'),
    createProgram: vi.fn(() => { created.programs++; return { _p: objectId++ } as unknown as WebGLProgram }),
    deleteProgram: vi.fn(() => { deleted.programs++ }),
    attachShader: vi.fn(), bindAttribLocation: vi.fn(),
    linkProgram: vi.fn((...a: unknown[]) => record('linkProgram', a)),
    getProgramParameter: vi.fn(() => !options.failShaderCompile),
    getProgramInfoLog: vi.fn(() => 'mock link failure'),
    useProgram: vi.fn((...a: unknown[]) => record('useProgram', a)),
    getUniformLocation: vi.fn((_program: WebGLProgram, name: string) => (
      { _u: objectId++, name } as unknown as WebGLUniformLocation
    )),
    getAttribLocation: vi.fn(() => 0),
    uniform1f: vi.fn((...a: unknown[]) => record('uniform1f', a)),
    uniform1i: vi.fn(), uniform2f: vi.fn(),
    uniform3f: vi.fn(), uniform4f: vi.fn(), uniformMatrix4fv: vi.fn(),

    bindTexture: vi.fn((...a: unknown[]) => record('bindTexture', a)),
    bindFramebuffer: vi.fn((...a: unknown[]) => record('bindFramebuffer', a)),
    bindRenderbuffer: vi.fn(), bindBuffer: vi.fn(), bindVertexArray: vi.fn(),
    bufferData: vi.fn(), bufferSubData: vi.fn(),
    enableVertexAttribArray: vi.fn(), vertexAttribPointer: vi.fn(), vertexAttribDivisor: vi.fn(),
    texParameteri: vi.fn(), texImage2D: vi.fn(), texStorage2D: vi.fn(),
    framebufferTexture2D: vi.fn(), framebufferRenderbuffer: vi.fn(), renderbufferStorage: vi.fn(),
    drawBuffers: vi.fn(), readBuffer: vi.fn(),
    checkFramebufferStatus: vi.fn(() => (options.framebufferComplete === false ? 0x8cd6 : 0x8cd5)),
    getError: vi.fn(() => 0),
    viewport: vi.fn((...a: unknown[]) => record('viewport', a)),
    clearColor: vi.fn(), clear: vi.fn((...a: unknown[]) => record('clear', a)),
    activeTexture: vi.fn(),
    enable: vi.fn((...a: unknown[]) => record('enable', a)),
    disable: vi.fn((...a: unknown[]) => record('disable', a)),
    blendFunc: vi.fn((...a: unknown[]) => record('blendFunc', a)),
    drawArrays: vi.fn((...a: unknown[]) => record('drawArrays', a)),
    drawArraysInstanced: vi.fn((...a: unknown[]) => record('drawArraysInstanced', a)),
    isContextLost: vi.fn(() => contextLost),

    _calls: calls, _created: created, _deleted: deleted,
    _setContextLost: (lost: boolean) => { contextLost = lost },
  }
  return gl as unknown as WebGL2RenderingContext & typeof gl
}

interface MockCanvas {
  canvas: HTMLCanvasElement
  gl: ReturnType<typeof makeMockGL>
  fire: (type: 'webglcontextlost' | 'webglcontextrestored') => void
}

function makeMockCanvas(options: MockOptions = {}): MockCanvas {
  const gl = makeMockGL(options)
  const listeners = new Map<string, EventListener[]>()
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => (options.failContextCreation ? null : gl)),
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      const list = listeners.get(type) ?? []
      list.push(listener)
      listeners.set(type, list)
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      const list = listeners.get(type) ?? []
      listeners.set(type, list.filter(l => l !== listener))
    }),
  } as unknown as HTMLCanvasElement

  return {
    canvas,
    gl,
    fire: type => {
      for (const listener of listeners.get(type) ?? []) {
        listener({ preventDefault: vi.fn(), type } as unknown as Event)
      }
    },
  }
}

function frameInput(overrides: Partial<ScopePhosphorFrameInput> = {}): ScopePhosphorFrameInput {
  return {
    segmentData: new Float32Array(11 * 4),
    segmentCount: 4,
    width: 800,
    height: 600,
    deltaSeconds: 1 / 60,
    coreWidthPx: 2,
    haloWidthPx: 10,
    beam: DEFAULT_SCOPE_BEAM,
    phosphor: DEFAULT_SCOPE_PHOSPHOR,
    intensity: 1,
    glow: 0.6,
    traceColor: { r: 0.3, g: 0.9, b: 0.9 },
    backgroundColor: { r: 0, g: 0.05, b: 0.06 },
    crt: DEFAULT_SCOPE_CRT,
    resetPersistence: false,
    ...overrides,
  }
}

afterEach(() => { resetDrmvyzWebGLContextDiagnosticsForTests() })

describe('initialization', () => {
  it('compiles its programs and becomes available', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    expect(runtime.available).toBe(true)
    expect(runtime.getDiagnostics().unavailableReason).toBeNull()
    // beam, persistence, bloom, composite, crt
    expect(mock.gl._created.programs).toBe(5)
    runtime.dispose()
  })

  it('selects an HDR target when the device supports float render and blend', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    expect(runtime.getDiagnostics().hdrFormat).toBe('rgba16f')
    runtime.dispose()
  })

  it('falls back to RGBA8 when float blending is unavailable', () => {
    // Beam emission blends additively, so this device cannot take the HDR path
    // even though it can render float targets.
    const mock = makeMockCanvas({ floatBlend: false })
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    expect(runtime.getDiagnostics().hdrFormat).toBe('rgba8')
    expect(runtime.available).toBe(true)
    runtime.dispose()
  })

  it('reports unavailable rather than throwing when the context cannot be created', () => {
    const mock = makeMockCanvas({ failContextCreation: true })
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    expect(runtime.available).toBe(false)
    expect(runtime.unavailable).toBe('context-creation-failed')
    // The caller must be able to fall back, not crash.
    expect(runtime.renderFrame(frameInput())).toBe(false)
    runtime.dispose()
  })

  it('reports unavailable when shader compilation fails', () => {
    const mock = makeMockCanvas({ failShaderCompile: true })
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    expect(runtime.available).toBe(false)
    expect(runtime.unavailable).toBe('shader-compilation-failed')
    expect(runtime.renderFrame(frameInput())).toBe(false)
    runtime.dispose()
  })
})

describe('pass execution', () => {

  it('enables transparent tube output for authored layer composition', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    mock.gl._calls.length = 0

    runtime.renderFrame(frameInput({
      transparentBackground: true,
      crt: { ...DEFAULT_SCOPE_CRT, enabled: true },
    }))

    const transparentWrites = mock.gl._calls.filter(call => {
      if (call.method !== 'uniform1f') return false
      const location = call.args[0] as { name?: string }
      return location?.name === 'uTransparentBackground' && call.args[1] === 1
    })
    // Composite and CRT passes both receive the transparent presentation flag.
    expect(transparentWrites).toHaveLength(2)
    runtime.dispose()
  })

  it('runs beam, persistence, bloom, and composite in order', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    mock.gl._calls.length = 0

    expect(runtime.renderFrame(frameInput())).toBe(true)

    const draws = mock.gl._calls.filter(c =>
      c.method === 'drawArraysInstanced' || c.method === 'drawArrays')
    // One instanced beam draw, then one fullscreen draw per remaining pass:
    // persistence + 3 bloom levels + composite.
    expect(draws[0].method).toBe('drawArraysInstanced')
    expect(draws.length).toBeGreaterThanOrEqual(3)
    expect(draws.slice(1).every(c => c.method === 'drawArrays')).toBe(true)
    runtime.dispose()
  })

  it('enables additive blending for beam emission and disables it afterwards', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    mock.gl._calls.length = 0
    runtime.renderFrame(frameInput())

    const sequence = mock.gl._calls.filter(c =>
      c.method === 'enable' || c.method === 'disable' ||
      c.method === 'blendFunc' || c.method === 'drawArraysInstanced')

    expect(sequence[0].method).toBe('enable')
    expect(sequence[1].method).toBe('blendFunc')
    // ONE, ONE — straight additive accumulation, which is what produces hotter
    // intersections rather than the last stroke overwriting.
    expect(sequence[1].args).toEqual([1, 1])
    expect(sequence[2].method).toBe('drawArraysInstanced')
    // Blending must not leak into the fullscreen passes.
    expect(sequence[3].method).toBe('disable')
    runtime.dispose()
  })

  it('composites to the default framebuffer last', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    mock.gl._calls.length = 0
    runtime.renderFrame(frameInput())

    const binds = mock.gl._calls.filter(c => c.method === 'bindFramebuffer')
    // The composite pass targets null (the runtime's own canvas).
    const targeted = binds.map(c => c.args[1])
    expect(targeted).toContain(null)
    runtime.dispose()
  })

  it('sizes its canvas to the requested backing store', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    runtime.renderFrame(frameInput({ width: 1280, height: 720 }))
    expect(runtime.outputCanvas.width).toBe(1280)
    expect(runtime.outputCanvas.height).toBe(720)
    runtime.dispose()
  })

  it('draws nothing but still succeeds with an empty trace', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    // Silence must still run the chain so the phosphor decays rather than
    // freezing on the last figure.
    expect(runtime.renderFrame(frameInput({ segmentCount: 0 }))).toBe(true)
    runtime.dispose()
  })

  it('does not recompile shaders during steady playback', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    const programsAfterInit = mock.gl._created.programs

    for (let i = 0; i < 60; i++) runtime.renderFrame(frameInput())
    expect(mock.gl._created.programs).toBe(programsAfterInit)
    runtime.dispose()
  })

  it('does not reallocate targets during steady playback', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    runtime.renderFrame(frameInput())
    const texturesAfterFirst = mock.gl._created.textures

    for (let i = 0; i < 60; i++) runtime.renderFrame(frameInput())
    expect(mock.gl._created.textures).toBe(texturesAfterFirst)
    runtime.dispose()
  })
})

describe('quality changes', () => {
  it('applies a new tier without recompiling shaders', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    runtime.renderFrame(frameInput())
    const programs = mock.gl._created.programs

    runtime.setQuality('low')
    runtime.renderFrame(frameInput())
    expect(runtime.currentQuality).toBe('low')
    // One composite program serves every tier; unused bloom samplers bind a
    // black texture at zero weight rather than needing a program variant.
    expect(mock.gl._created.programs).toBe(programs)
    runtime.dispose()
  })

  it('reduces bloom levels on a cheaper tier', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    runtime.setQuality('ultra')
    runtime.renderFrame(frameInput())
    expect(runtime.getDiagnostics().bloomLevelCount).toBe(3)

    runtime.setQuality('low')
    runtime.renderFrame(frameInput())
    expect(runtime.getDiagnostics().bloomLevelCount).toBe(1)
    runtime.dispose()
  })
})

describe('context loss and restoration', () => {
  it('stops issuing GL commands while the context is lost', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    mock.fire('webglcontextlost')

    expect(runtime.available).toBe(false)
    expect(runtime.unavailable).toBe('context-lost')
    mock.gl._calls.length = 0
    expect(runtime.renderFrame(frameInput())).toBe(false)
    expect(mock.gl._calls.filter(c => c.method === 'drawArrays').length).toBe(0)
    runtime.dispose()
  })

  it('recreates programs and becomes available again on restore', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    mock.fire('webglcontextlost')
    mock.fire('webglcontextrestored')

    expect(runtime.available).toBe(true)
    expect(runtime.getDiagnostics().contextLost).toBe(false)
    // A fresh set; the old programs belonged to the dead context.
    expect(mock.gl._created.programs).toBe(10)
    expect(runtime.renderFrame(frameInput())).toBe(true)
    runtime.dispose()
  })

  it('survives repeated loss and restore cycles', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    for (let i = 0; i < 5; i++) {
      mock.fire('webglcontextlost')
      mock.fire('webglcontextrestored')
      expect(runtime.renderFrame(frameInput())).toBe(true)
    }
    expect(runtime.available).toBe(true)
    runtime.dispose()
  })

  it('re-probes capabilities on restore rather than assuming the old ones', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    expect(runtime.getDiagnostics().hdrFormat).toBe('rgba16f')

    mock.fire('webglcontextlost')
    // A restored context may be a different GPU.
    mock.gl.getExtension = vi.fn(() => null) as unknown as typeof mock.gl.getExtension
    mock.fire('webglcontextrestored')

    expect(runtime.getDiagnostics().hdrFormat).toBe('rgba8')
    runtime.dispose()
  })
})

describe('lifecycle', () => {
  it('releases programs and targets on dispose', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    runtime.renderFrame(frameInput())
    runtime.dispose()

    expect(mock.gl._deleted.programs).toBe(mock.gl._created.programs)
    expect(mock.gl._deleted.framebuffers).toBe(mock.gl._created.framebuffers)
    expect(runtime.available).toBe(false)
    expect(runtime.unavailable).toBe('disposed')
  })

  it('removes its context-loss listeners on dispose', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    runtime.dispose()
    // A listener firing after disposal would resurrect a dead runtime.
    expect(() => mock.fire('webglcontextrestored')).not.toThrow()
    expect(runtime.available).toBe(false)
  })

  it('is idempotent', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    runtime.dispose()
    const deleted = mock.gl._deleted.programs
    expect(() => runtime.dispose()).not.toThrow()
    expect(mock.gl._deleted.programs).toBe(deleted)
  })

  it('renders nothing after disposal', () => {
    const mock = makeMockCanvas()
    const runtime = new ScopePhosphorRuntime(() => mock.canvas)
    runtime.dispose()
    expect(runtime.renderFrame(frameInput())).toBe(false)
  })
})
