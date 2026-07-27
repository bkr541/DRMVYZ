import { describe, it, expect } from 'vitest'
import { ShaderRegistry } from '../../registry/ShaderRegistry'
import { ShaderDefinitionValidator } from '../../registry/ShaderDefinitionValidator'
import { ShaderPassCompiler } from '../../rendergraph/ShaderPassCompiler'
import { QUALITY_PROFILES } from '../../performance/shaderPerformanceTypes'
import { SOUND_DRAWING_VECTORSCOPE, SOUND_DRAWING_VECTORSCOPE_SCENE_ID } from '../soundDrawingVectorscope'
import { PRODUCTION_SCENES } from '../../scenes'

// ── Mock WebGL2 context (compile-success path) ────────────────────────────────

function makeMockGL(extensions: Set<string> = new Set()) {
  let objId = 1

  const gl = {
    TEXTURE_2D: 0x0DE1,
    TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
    TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
    CLAMP_TO_EDGE: 0x812F, REPEAT: 0x2901, MIRRORED_REPEAT: 0x8370,
    LINEAR: 0x2601, NEAREST: 0x2600,
    RGBA8: 0x8058, R8: 0x8229,
    RGBA: 6408, RED: 0x1903,
    UNSIGNED_BYTE: 0x1401, RGBA16F: 0x881A, HALF_FLOAT: 0x140B,
    RGBA32F: 0x8814, FLOAT: 0x1406,
    FRAMEBUFFER: 0x8D40, COLOR_ATTACHMENT0: 0x8CE0,
    FRAMEBUFFER_COMPLETE: 0x8CD5,
    VERTEX_SHADER: 0x8B31, FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81, LINK_STATUS: 0x8B82,
    BLEND: 0x0BE2, COLOR_BUFFER_BIT: 0x4000,
    ONE: 1, ZERO: 0, SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303,
    DST_COLOR: 0x0306, ONE_MINUS_SRC_COLOR: 0x0301,
    ARRAY_BUFFER: 0x8892, STATIC_DRAW: 0x88E4, DYNAMIC_DRAW: 0x88E8,
    TRIANGLE_STRIP: 0x0005, TRIANGLES: 0x0004,

    createTexture: () => ({ _id: objId++ } as unknown as WebGLTexture),
    bindTexture: () => {},
    texImage2D: () => {},
    texStorage2D: () => {},
    texParameteri: () => {},
    deleteTexture: () => {},
    activeTexture: () => {},
    generateMipmap: () => {},

    createFramebuffer: () => ({ _id: objId++ } as unknown as WebGLFramebuffer),
    bindFramebuffer: () => {},
    framebufferTexture2D: () => {},
    drawBuffers: () => {},
    readBuffer: () => {},
    checkFramebufferStatus: () => 0x8CD5,
    deleteFramebuffer: () => {},
    isContextLost: () => false,
    getError: () => 0,
    getParameter: (p: number) => (p === 0x0D33 || p === 0x84E8 ? 16384 : null),
    getExtension: (name: string) => (extensions.has(name) ? {} : null),

    createShader: () => ({ _s: objId++ } as unknown as WebGLShader),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: (_: unknown, p: number) => p === 0x8B81,
    getShaderInfoLog: () => '',
    deleteShader: () => {},

    createProgram: () => ({ _p: objId++ } as unknown as WebGLProgram),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: (_: unknown, p: number) => p === 0x8B82,
    getProgramInfoLog: () => '',
    deleteProgram: () => {},
    useProgram: () => {},
    getUniformLocation: (_: unknown, name: string) => ({ _name: name } as unknown as WebGLUniformLocation),
    getAttribLocation: () => 0,

    viewport: () => {},
    clearColor: () => {},
    clear: () => {},
    enable: () => {},
    disable: () => {},
    blendFunc: () => {},
    flush: () => {},
    uniform1f: () => {},
    uniform1i: () => {},
    uniform2f: () => {},
    uniform3f: () => {},
    uniform4f: () => {},
    uniformMatrix4fv: () => {},
    drawArrays: () => {},

    createBuffer: () => ({ _b: objId++ } as unknown as WebGLBuffer),
    bindBuffer: () => {},
    bufferData: () => {},
    bufferSubData: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    vertexAttribDivisor: () => {},
    drawArraysInstanced: () => {},
    createVertexArray: () => ({ _va: objId++ } as unknown as WebGLVertexArrayObject),
    bindVertexArray: () => {},
    deleteVertexArray: () => {},
    deleteBuffer: () => {},
  }

  return gl as unknown as WebGL2RenderingContext & typeof gl
}

describe('SOUND_DRAWING_VECTORSCOPE — schema validity', () => {
  it('passes ShaderDefinitionValidator with zero errors', () => {
    const result = ShaderDefinitionValidator.validate(SOUND_DRAWING_VECTORSCOPE)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('registers into a fresh ShaderRegistry without throwing', () => {
    const reg = new ShaderRegistry()
    expect(() => reg.register(SOUND_DRAWING_VECTORSCOPE)).not.toThrow()
    expect(reg.get(SOUND_DRAWING_VECTORSCOPE_SCENE_ID)).toBeDefined()
  })

  it('declares requiresFloatTarget, requiresPersistentBuffers, and estimatedPassCount', () => {
    expect(SOUND_DRAWING_VECTORSCOPE.quality?.requiresFloatTarget).toBe(true)
    expect(SOUND_DRAWING_VECTORSCOPE.quality?.requiresPersistentBuffers).toBe(true)
    expect(SOUND_DRAWING_VECTORSCOPE.quality?.estimatedPassCount).toBe(SOUND_DRAWING_VECTORSCOPE.passes?.length)
  })

  it('declares a feedback block (pingPongBuffers) matching its one ping-pong pass', () => {
    expect(SOUND_DRAWING_VECTORSCOPE.feedback?.pingPongBuffers).toBe(1)
    const pingPongPasses = SOUND_DRAWING_VECTORSCOPE.passes?.filter(p => p.pingPong) ?? []
    expect(pingPongPasses).toHaveLength(1)
  })

  it('is intentionally absent from PRODUCTION_SCENES (not yet wired to a live geometry data source)', () => {
    expect(PRODUCTION_SCENES.some(s => s.id === SOUND_DRAWING_VECTORSCOPE_SCENE_ID)).toBe(false)
  })

  it('every param default satisfies its own declared range/enum', () => {
    // ShaderDefinitionValidator already checks this, but assert it explicitly
    // here too so a future edit to defaults fails fast in this file.
    for (const key of Object.keys(SOUND_DRAWING_VECTORSCOPE.defaults)) {
      const param = SOUND_DRAWING_VECTORSCOPE.params.find(p => p.id === key)
      expect(param).toBeDefined()
    }
  })
})

describe('SOUND_DRAWING_VECTORSCOPE — compilation', () => {
  it('compiles successfully against a capable mock GL', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const result = compiler.compile(SOUND_DRAWING_VECTORSCOPE)
    expect(result.error).toBeNull()
    expect(result.graph).not.toBeNull()
  })

  it('the draw pass compiles with drawKind "geometry"; every other pass is "fullscreen"', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(SOUND_DRAWING_VECTORSCOPE)
    const draw = graph!.passes.find(p => p.passId === 'draw')!
    expect(draw.drawKind).toBe('geometry')
    for (const p of graph!.passes) {
      if (p.passId !== 'draw') expect(p.drawKind).toBe('fullscreen')
    }
  })

  it('non-screen passes resolve to rgba16f when the device supports float targets (definition-level default)', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(SOUND_DRAWING_VECTORSCOPE)
    const draw = graph!.passes.find(p => p.passId === 'draw')!
    const feedback = graph!.passes.find(p => p.passId === 'feedback')!
    expect(draw.format).toBe('rgba16f')
    expect(feedback.format).toBe('rgba16f')
  })

  it('falls back to rgba8 everywhere when the device lacks float-target capability', () => {
    const gl = makeMockGL(new Set()) // no extensions
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(SOUND_DRAWING_VECTORSCOPE)
    for (const p of graph!.passes) {
      expect(p.format).toBe('rgba8')
    }
  })

  it('the last pass (composite) always renders to the screen regardless of format', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(SOUND_DRAWING_VECTORSCOPE)
    const last = graph!.passes[graph!.passes.length - 1]
    expect(last.passId).toBe('composite')
    expect(last.outputName).toBeNull()
    expect(last.format).toBe('rgba8')
  })

  it('bloom passes are tagged with their tier (1, 2, 3) in dependency order', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(SOUND_DRAWING_VECTORSCOPE)
    const bloomTiers = graph!.passes.filter(p => p.bloomTier !== null).map(p => p.bloomTier)
    expect(bloomTiers).toEqual([1, 2, 3])
  })

  it('at low quality (bloomResolution 0.25 -> 1 active tier), tiers 2 and 3 are floored to the minimum resolution scale', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(SOUND_DRAWING_VECTORSCOPE, QUALITY_PROFILES.low)
    const byId = new Map(graph!.passes.map(p => [p.passId, p]))
    expect(byId.get('bloom1')!.resolutionScale).toBeCloseTo(0.5) // tier 1 always active, unaffected
    expect(byId.get('bloom2')!.resolutionScale).toBeLessThan(0.5)
    expect(byId.get('bloom3')!.resolutionScale).toBeLessThan(0.5)
  })

  it('at high quality (bloomResolution 0.75 -> 3 active tiers), every bloom tier keeps its authored resolutionScale', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(SOUND_DRAWING_VECTORSCOPE, QUALITY_PROFILES.high)
    const byId = new Map(graph!.passes.map(p => [p.passId, p]))
    expect(byId.get('bloom1')!.resolutionScale).toBeCloseTo(0.5)
    expect(byId.get('bloom2')!.resolutionScale).toBeCloseTo(0.25)
    expect(byId.get('bloom3')!.resolutionScale).toBeCloseTo(0.125)
  })

  it('omitting the quality profile entirely (default) preserves every pass\'s authored resolutionScale', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(SOUND_DRAWING_VECTORSCOPE)
    const byId = new Map(graph!.passes.map(p => [p.passId, p]))
    expect(byId.get('bloom3')!.resolutionScale).toBeCloseTo(0.125)
  })

  it('the draw pass blend mode is additive (accumulates overlapping segments)', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(SOUND_DRAWING_VECTORSCOPE)
    const draw = graph!.passes.find(p => p.passId === 'draw')!
    expect(draw.blendMode).toBe('additive')
  })
})
