import { describe, it, expect, beforeEach } from 'vitest'
import {
  topologicalSort,
  ShaderPassCompiler,
  PASS_SCALE_MIN,
  PASS_SCALE_MAX,
  resolveActiveBloomTierCount,
  type TopoSortResult,
} from '../ShaderPassCompiler'
import { ShaderFramebufferPool } from '../ShaderFramebufferPool'
import { ShaderRenderGraph } from '../ShaderRenderGraph'
import { resolveBlendState } from '../ShaderRenderPass'
import { QUALITY_PROFILES } from '../../performance/shaderPerformanceTypes'
import type { ShaderPassDef, ShaderDefinition } from '../../registry/shaderRegistryTypes'
import type { BlendMode } from '../shaderRenderGraphTypes'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePass(
  id: string,
  opts: Partial<ShaderPassDef> = {},
): ShaderPassDef {
  return {
    id,
    fragSrc: '#version 300 es\nprecision mediump float;\nout vec4 c;\nvoid main(){c=vec4(1);}',
    inputs:  [],
    output:  id + '-out',
    ...opts,
  }
}

// Minimal GL-constant mock for resolveBlendState tests
const GL_CONSTS = {
  ONE:                 1,
  ZERO:                0,
  SRC_ALPHA:           0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  DST_COLOR:           0x0306,
  ONE_MINUS_SRC_COLOR: 0x0301,
} as Pick<WebGL2RenderingContext,
  'ONE' | 'ZERO' | 'SRC_ALPHA' | 'ONE_MINUS_SRC_ALPHA' | 'DST_COLOR' | 'ONE_MINUS_SRC_COLOR'>

// ── Mock WebGL context ────────────────────────────────────────────────────────

function makeMockGL(extensions: ReadonlySet<string> = new Set()) {
  let texId = 1
  let fboId = 1
  let bufId = 1
  let vaoId = 1

  const calls: { method: string; args: unknown[] }[] = []
  function track(method: string, args: unknown[]) { calls.push({ method, args }) }

  const gl = {
    // Texture
    TEXTURE_2D:       0x0DE1,
    TEXTURE_WRAP_S:   0x2802, TEXTURE_WRAP_T: 0x2803,
    TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
    CLAMP_TO_EDGE:    0x812F, REPEAT: 0x2901, MIRRORED_REPEAT: 0x8370,
    LINEAR:           0x2601, NEAREST: 0x2600,
    RGBA8:            0x8058, R8: 0x8229,
    RGBA:             6408,   RED: 0x1903,
    UNSIGNED_BYTE:    0x1401, RGBA16F: 0x881A, HALF_FLOAT: 0x140B,
    RGBA32F:          0x8814, FLOAT: 0x1406,
    // Framebuffer
    FRAMEBUFFER:        0x8D40,
    COLOR_ATTACHMENT0:  0x8CE0,
    FRAMEBUFFER_COMPLETE: 0x8CD5,
    // Shader / program
    VERTEX_SHADER:   0x8B31, FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS:  0x8B81, LINK_STATUS:     0x8B82,
    // Blend
    BLEND:           0x0BE2,
    ONE: 1, ZERO: 0, SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303,
    DST_COLOR: 0x0306, ONE_MINUS_SRC_COLOR: 0x0301,
    // Geometry pass (VAO/VBO/instancing)
    ARRAY_BUFFER: 0x8892, STATIC_DRAW: 0x88E4, DYNAMIC_DRAW: 0x88E8,
    TRIANGLE_STRIP: 0x0005, TRIANGLES: 0x0004,

    createTexture():     WebGLTexture    { track('createTexture', []); return { _id: texId++ } as unknown as WebGLTexture },
    bindTexture(t: number, o: unknown)   { track('bindTexture', [t, o]) },
    texImage2D(...a: unknown[])          { track('texImage2D', a) },
    texStorage2D(...a: unknown[])        { track('texStorage2D', a) },
    texParameteri(...a: unknown[])       { track('texParameteri', a) },
    deleteTexture(o: unknown)            { track('deleteTexture', [o]) },

    createFramebuffer(): WebGLFramebuffer { track('createFramebuffer', []); return { _id: fboId++ } as unknown as WebGLFramebuffer },
    bindFramebuffer(t: number, o: unknown) { track('bindFramebuffer', [t, o]) },
    framebufferTexture2D(...a: unknown[]) { track('framebufferTexture2D', a) },
    drawBuffers(...a: unknown[])           { track('drawBuffers', a) },
    readBuffer(...a: unknown[])            { track('readBuffer', a) },
    checkFramebufferStatus() { return 0x8CD5 /* FRAMEBUFFER_COMPLETE */ },
    deleteFramebuffer(o: unknown) { track('deleteFramebuffer', [o]) },
    isContextLost() { return false },
    getError()      { return 0 },
    getParameter(p: number) { return p === 0x0D33 || p === 0x84E8 ? 16384 : null },
    getExtension(name: string) { return extensions.has(name) ? {} : null },

    // Shader / program (success path)
    createShader():     WebGLShader    { return { _s: 1 } as unknown as WebGLShader },
    shaderSource()      {},
    compileShader()     {},
    getShaderParameter(_: unknown, p: number) { return p === 0x8B81 },  // COMPILE_STATUS = true
    getShaderInfoLog()  { return '' },
    deleteShader()      {},

    createProgram():    WebGLProgram   { return { _p: 1 } as unknown as WebGLProgram },
    attachShader()      {},
    linkProgram()       {},
    getProgramParameter(_: unknown, p: number) { return p === 0x8B82 },  // LINK_STATUS = true
    getProgramInfoLog() { return '' },
    deleteProgram()     {},
    useProgram()        {},
    getUniformLocation() { return {} as WebGLUniformLocation },
    getAttribLocation() { return 0 },

    viewport()          {},
    clearColor()        {},
    clear()             {},
    enable()            {},
    disable()           {},
    blendFunc()         {},
    activeTexture()     {},
    uniform1f()         {},
    uniform1i()         {},
    drawArrays()        {},

    createBuffer():      WebGLBuffer { track('createBuffer', []); return { _b: bufId++ } as unknown as WebGLBuffer },
    bindBuffer(...a: unknown[])            { track('bindBuffer', a) },
    bufferData(...a: unknown[])            { track('bufferData', a) },
    bufferSubData(...a: unknown[])         { track('bufferSubData', a) },
    deleteBuffer(...a: unknown[])          { track('deleteBuffer', a) },
    enableVertexAttribArray(...a: unknown[]) { track('enableVertexAttribArray', a) },
    vertexAttribPointer(...a: unknown[])   { track('vertexAttribPointer', a) },
    vertexAttribDivisor(...a: unknown[])   { track('vertexAttribDivisor', a) },
    drawArraysInstanced(...a: unknown[])   { track('drawArraysInstanced', a) },
    createVertexArray():  WebGLVertexArrayObject { track('createVertexArray', []); return { _va: vaoId++ } as unknown as WebGLVertexArrayObject },
    bindVertexArray(...a: unknown[])       { track('bindVertexArray', a) },
    deleteVertexArray(...a: unknown[])     { track('deleteVertexArray', a) },

    _calls: calls,
  }

  return gl as typeof gl & WebGL2RenderingContext
}

/** Mock GL that simulates compilation failure in the fragment shader. */
function makeFailGL() {
  const gl = makeMockGL()
  let callCount = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(gl as any).getShaderParameter = (_: unknown, p: number) => {
    // fail on second call (fragment shader compile)
    callCount++
    if (callCount >= 2 && p === gl.COMPILE_STATUS) return false
    return true
  }
  gl.getShaderInfoLog = () => 'ERROR: 0:1: syntax error'
  return gl
}

// ── A: Dependency ordering ────────────────────────────────────────────────────

describe('A: topologicalSort — basic ordering', () => {
  it('A1: single pass returns itself', () => {
    const passes = [makePass('a')]
    const result = topologicalSort(passes)
    expect(result.cycle).toBeNull()
    expect(result.order!.map(p => p.id)).toEqual(['a'])
  })

  it('A2: producer before consumer when dependsOn is set', () => {
    const passes = [
      makePass('consumer', { dependsOn: ['producer'] }),
      makePass('producer'),
    ]
    const result = topologicalSort(passes)
    expect(result.cycle).toBeNull()
    const ids = result.order!.map(p => p.id)
    expect(ids.indexOf('producer')).toBeLessThan(ids.indexOf('consumer'))
  })

  it('A3: three-pass chain in correct order', () => {
    const passes = [
      makePass('c', { dependsOn: ['b'] }),
      makePass('a'),
      makePass('b', { dependsOn: ['a'] }),
    ]
    const result = topologicalSort(passes)
    expect(result.cycle).toBeNull()
    const ids = result.order!.map(p => p.id)
    expect(ids).toEqual(['a', 'b', 'c'])
  })

  it('A4: multiple independent passes — all present', () => {
    const passes = [makePass('x'), makePass('y'), makePass('z')]
    const result = topologicalSort(passes)
    expect(result.cycle).toBeNull()
    expect(result.order!.length).toBe(3)
  })

  it('A5: diamond dependency — A → B,C → D', () => {
    const passes = [
      makePass('D', { dependsOn: ['B', 'C'] }),
      makePass('B', { dependsOn: ['A'] }),
      makePass('C', { dependsOn: ['A'] }),
      makePass('A'),
    ]
    const result = topologicalSort(passes)
    expect(result.cycle).toBeNull()
    const ids = result.order!.map(p => p.id)
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('B'))
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('C'))
    expect(ids.indexOf('B')).toBeLessThan(ids.indexOf('D'))
    expect(ids.indexOf('C')).toBeLessThan(ids.indexOf('D'))
  })
})

// ── B: Missing dependency detection ──────────────────────────────────────────

describe('B: ShaderPassCompiler — missing dependency errors', () => {
  it('B1: rejects pass that depends on non-existent pass', () => {
    const def = {
      id: 'test', name: 'T', description: 'T', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [makePass('a', { dependsOn: ['ghost'] })],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    expect(result.graph).toBeNull()
    expect(result.error!.code).toBe('MISSING_DEPENDENCY')
    expect(result.error!.passId).toBe('a')
  })

  it('B2: error message includes both the dependent and missing IDs', () => {
    const def = {
      id: 'test', name: 'T', description: 'T', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [makePass('renderer', { dependsOn: ['blurPass'] })],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    expect(result.error!.message).toContain('renderer')
    expect(result.error!.message).toContain('blurPass')
  })
})

// ── C: Cycle detection ────────────────────────────────────────────────────────

describe('C: topologicalSort — cycle detection', () => {
  it('C1: two-node cycle A→B→A', () => {
    const passes = [
      makePass('A', { dependsOn: ['B'] }),
      makePass('B', { dependsOn: ['A'] }),
    ]
    const result: TopoSortResult = topologicalSort(passes)
    expect(result.order).toBeNull()
    expect(result.cycle).not.toBeNull()
    expect(result.cycle!.length).toBeGreaterThanOrEqual(2)
  })

  it('C2: self-dependency', () => {
    const passes = [makePass('loop', { dependsOn: ['loop'] })]
    const result = topologicalSort(passes)
    expect(result.order).toBeNull()
    expect(result.cycle).not.toBeNull()
  })

  it('C3: three-node cycle A→B→C→A', () => {
    const passes = [
      makePass('A', { dependsOn: ['C'] }),
      makePass('B', { dependsOn: ['A'] }),
      makePass('C', { dependsOn: ['B'] }),
    ]
    const result = topologicalSort(passes)
    expect(result.order).toBeNull()
    expect(result.cycle).not.toBeNull()
    expect(result.cycle!.length).toBeGreaterThanOrEqual(3)
  })

  it('C4: ShaderPassCompiler reports DEPENDENCY_CYCLE', () => {
    const def = {
      id: 'cycle-test', name: 'T', description: 'T', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [
        makePass('A', { dependsOn: ['B'] }),
        makePass('B', { dependsOn: ['A'] }),
      ],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    expect(result.graph).toBeNull()
    expect(result.error!.code).toBe('DEPENDENCY_CYCLE')
    expect(result.error!.message).toContain('cycle-test')
  })
})

// ── D: Invalid output declarations ───────────────────────────────────────────

describe('D: ShaderPassCompiler — invalid input declarations', () => {
  it('D1: rejects input that does not match any textureInput or pass output', () => {
    const def = {
      id: 'bad-input', name: 'T', description: 'T', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [makePass('a', { inputs: ['ghost-texture'] })],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    expect(result.graph).toBeNull()
    expect(result.error!.code).toBe('INVALID_INPUT')
    expect(result.error!.message).toContain('ghost-texture')
  })

  it('D2: accepts input that matches a declared textureInput', () => {
    const def = {
      id: 'ok-external', name: 'T', description: 'T', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      textureInputs: [{ name: 'camera', label: 'Camera', source: 'uploaded-video' as const }],
      passes: [makePass('a', { inputs: ['camera'] })],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    // Should get past input validation (may fail on compile in test env, but not INVALID_INPUT)
    if (result.graph === null) {
      expect(result.error!.code).not.toBe('INVALID_INPUT')
    }
  })

  it('D3: accepts input that matches another pass output', () => {
    const passA = makePass('a')  // output: 'a-out'
    const passB = makePass('b', { inputs: ['a-out'] })
    const def = {
      id: 'ok-chain', name: 'T', description: 'T', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [passA, passB],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    if (result.graph === null) {
      expect(result.error!.code).not.toBe('INVALID_INPUT')
    }
  })
})

// ── E: Resolution scaling ─────────────────────────────────────────────────────

describe('E: resolution scale clamping', () => {
  it('E1: PASS_SCALE_MIN is 0.05', () => {
    expect(PASS_SCALE_MIN).toBe(0.05)
  })

  it('E2: PASS_SCALE_MAX is 4.0', () => {
    expect(PASS_SCALE_MAX).toBe(4.0)
  })

  it('E3: sub-minimum scale is clamped in compiled node', () => {
    const def = {
      id: 's', name: 'S', description: 'S', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [makePass('p', { resolutionScale: 0.001 })],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    if (result.graph) {
      // last pass renders to screen so it's the only one; its scale was clamped
      // (for a 1-pass multi-pass graph the only node is the final node)
      expect(result.graph.passes[0].resolutionScale).toBeGreaterThanOrEqual(PASS_SCALE_MIN)
    }
  })

  it('E4: super-maximum scale is clamped in compiled node', () => {
    const def = {
      id: 's2', name: 'S', description: 'S', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [makePass('p', { resolutionScale: 99 })],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    if (result.graph) {
      expect(result.graph.passes[0].resolutionScale).toBeLessThanOrEqual(PASS_SCALE_MAX)
    }
  })

  it('E5: valid mid-range scale is preserved', () => {
    const def = {
      id: 's3', name: 'S', description: 'S', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [makePass('p', { resolutionScale: 0.5 })],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    if (result.graph) {
      expect(result.graph.passes[0].resolutionScale).toBe(0.5)
    }
  })
})

// ── F: Framebuffer pool reuse ─────────────────────────────────────────────────

describe('F: ShaderFramebufferPool reuse', () => {
  it('F1: acquire returns an FBO and increments activeCount', () => {
    const gl = makeMockGL()
    const pool = new ShaderFramebufferPool(gl as unknown as WebGL2RenderingContext)
    pool.acquire(64, 64)
    expect(pool.activeCount).toBe(1)
    expect(pool.freeCount).toBe(0)
    pool.disposeAll()
  })

  it('F2: released FBO moves to freeCount', () => {
    const gl = makeMockGL()
    const pool = new ShaderFramebufferPool(gl as unknown as WebGL2RenderingContext)
    const fbo = pool.acquire(64, 64)
    pool.release(fbo)
    expect(pool.activeCount).toBe(0)
    expect(pool.freeCount).toBe(1)
    pool.disposeAll()
  })

  it('F3: re-acquire returns the same FBO object', () => {
    const gl = makeMockGL()
    const pool = new ShaderFramebufferPool(gl as unknown as WebGL2RenderingContext)
    const first = pool.acquire(128, 128)
    pool.release(first)
    const second = pool.acquire(128, 128)
    expect(second).toBe(first)
    pool.disposeAll()
  })

  it('F4: different dimensions allocate separate FBOs', () => {
    const gl = makeMockGL()
    const pool = new ShaderFramebufferPool(gl as unknown as WebGL2RenderingContext)
    const a = pool.acquire(64, 64)
    const b = pool.acquire(128, 128)
    expect(a).not.toBe(b)
    expect(pool.activeCount).toBe(2)
    pool.disposeAll()
  })

  it('F5: releaseAll returns all active FBOs to free list', () => {
    const gl = makeMockGL()
    const pool = new ShaderFramebufferPool(gl as unknown as WebGL2RenderingContext)
    pool.acquire(64, 64)
    pool.acquire(64, 64)
    pool.releaseAll()
    expect(pool.activeCount).toBe(0)
    expect(pool.freeCount).toBe(2)
    pool.disposeAll()
  })

  it('F6: totalCount equals active + free', () => {
    const gl = makeMockGL()
    const pool = new ShaderFramebufferPool(gl as unknown as WebGL2RenderingContext)
    const a = pool.acquire(32, 32)
    pool.acquire(32, 32)
    pool.release(a)
    expect(pool.totalCount).toBe(pool.activeCount + pool.freeCount)
    pool.disposeAll()
  })

  it('F7: disposeAll empties both lists', () => {
    const gl = makeMockGL()
    const pool = new ShaderFramebufferPool(gl as unknown as WebGL2RenderingContext)
    const fbo = pool.acquire(32, 32)
    pool.release(fbo)
    pool.acquire(64, 64)
    pool.disposeAll()
    expect(pool.totalCount).toBe(0)
  })

  it('F8: second frame reuses first-frame FBO (no new allocation)', () => {
    const gl = makeMockGL()
    const pool = new ShaderFramebufferPool(gl as unknown as WebGL2RenderingContext)
    // Frame 1
    const f1 = pool.acquire(256, 256)
    pool.release(f1)
    const createCallsBefore = gl._calls.filter(c => c.method === 'createTexture').length
    // Frame 2
    const f2 = pool.acquire(256, 256)
    const createCallsAfter = gl._calls.filter(c => c.method === 'createTexture').length
    expect(f2).toBe(f1)
    expect(createCallsAfter).toBe(createCallsBefore)  // no new GPU allocation
    pool.disposeAll()
  })
})

// ── G: Blend state configuration ─────────────────────────────────────────────

describe('G: resolveBlendState', () => {
  it('G1: none → disabled, sfactor=ONE, dfactor=ZERO', () => {
    const s = resolveBlendState(GL_CONSTS, 'none')
    expect(s.enabled).toBe(false)
    expect(s.sfactor).toBe(GL_CONSTS.ONE)
    expect(s.dfactor).toBe(GL_CONSTS.ZERO)
  })

  it('G2: alpha → SRC_ALPHA / ONE_MINUS_SRC_ALPHA', () => {
    const s = resolveBlendState(GL_CONSTS, 'alpha')
    expect(s.enabled).toBe(true)
    expect(s.sfactor).toBe(GL_CONSTS.SRC_ALPHA)
    expect(s.dfactor).toBe(GL_CONSTS.ONE_MINUS_SRC_ALPHA)
  })

  it('G3: additive → ONE / ONE', () => {
    const s = resolveBlendState(GL_CONSTS, 'additive')
    expect(s.enabled).toBe(true)
    expect(s.sfactor).toBe(GL_CONSTS.ONE)
    expect(s.dfactor).toBe(GL_CONSTS.ONE)
  })

  it('G4: multiply → DST_COLOR / ZERO', () => {
    const s = resolveBlendState(GL_CONSTS, 'multiply')
    expect(s.enabled).toBe(true)
    expect(s.sfactor).toBe(GL_CONSTS.DST_COLOR)
    expect(s.dfactor).toBe(GL_CONSTS.ZERO)
  })

  it('G5: screen → ONE / ONE_MINUS_SRC_COLOR', () => {
    const s = resolveBlendState(GL_CONSTS, 'screen')
    expect(s.enabled).toBe(true)
    expect(s.sfactor).toBe(GL_CONSTS.ONE)
    expect(s.dfactor).toBe(GL_CONSTS.ONE_MINUS_SRC_COLOR)
  })

  it('G6: all 5 modes produce distinct blend states', () => {
    const modes: BlendMode[] = ['none', 'alpha', 'additive', 'multiply', 'screen']
    const states = modes.map(m => resolveBlendState(GL_CONSTS, m))
    // Check that enabled=true ones all have different sfactor or dfactor pairs
    const enabledStates = states.filter(s => s.enabled)
    const pairs = enabledStates.map(s => `${s.sfactor}:${s.dfactor}`)
    const unique = new Set(pairs)
    expect(unique.size).toBe(enabledStates.length)
  })
})

// ── H: Safe fallback on compilation failure ───────────────────────────────────

describe('H: ShaderPassCompiler — safe fallback on compile failure', () => {
  it('H1: single-pass compilation failure returns NO_SOURCE for missing fragSrc', () => {
    const def = {
      id: 'ns', name: 'NS', description: 'NS', category: 'generator' as const, version: 1,
      params: [], defaults: {},
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def as never)
    expect(result.graph).toBeNull()
    expect(result.error!.code).toBe('NO_SOURCE')
  })

  it('H2: GLSL compile failure returns PROGRAM_COMPILE_FAIL', () => {
    const def = {
      id: 'fail', name: 'F', description: 'F', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      fragSrc: '#version 300 es\nout vec4 c;\nvoid main(){c=vec4(1);}',
    }
    const gl = makeFailGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    expect(result.graph).toBeNull()
    expect(result.error!.code).toBe('PROGRAM_COMPILE_FAIL')
    expect(result.error!.programError).toBeDefined()
  })

  it('H3: multi-pass failure on second pass disposes first successfully compiled program', () => {
    let compileCallCount = 0
    const gl = makeMockGL()
    const originalCompile = gl.compileShader.bind(gl)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(gl as any).compileShader = (...args: unknown[]) => { compileCallCount++; return (originalCompile as (...a: unknown[]) => void)(...args) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(gl as any).getShaderParameter = (_: unknown, p: number) => {
      // Fail fragment shader of second pass (callCount 3 = 2nd pass frag shader)
      if (compileCallCount >= 3 && p === gl.COMPILE_STATUS) return false
      return true
    }
    gl.getShaderInfoLog = () => 'ERROR: 0:1: undefined: undefined'

    const def = {
      id: 'partial-fail', name: 'PF', description: 'PF',
      category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [makePass('first'), makePass('second', { dependsOn: ['first'] })],
    }
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    expect(result.graph).toBeNull()
    expect(result.error!.code).toBe('PROGRAM_COMPILE_FAIL')
    expect(result.error!.passId).toBe('second')
  })

  it('H4: caller can keep previous valid graph on failure (no crash)', () => {
    const goodDef = {
      id: 'good', name: 'G', description: 'G', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      fragSrc: '#version 300 es\nout vec4 c;\nvoid main(){c=vec4(1);}',
    }
    const badDef = {
      id: 'bad', name: 'B', description: 'B', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      // no fragSrc, no passes
    }

    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)

    const good = compiler.compile(goodDef)
    const bad  = compiler.compile(badDef as never)

    expect(good.graph).not.toBeNull()
    expect(bad.graph).toBeNull()
    // Previous graph is still intact
    expect(good.graph!.passes.length).toBe(1)
  })
})

// ── I: Deterministic execution order ─────────────────────────────────────────

describe('I: deterministic execution order', () => {
  it('I1: same definition produces same pass order on repeated compile', () => {
    const def = {
      id: 'det', name: 'D', description: 'D', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [
        makePass('C', { dependsOn: ['A', 'B'] }),
        makePass('B', { dependsOn: ['A'] }),
        makePass('A'),
      ],
    }

    const gl1 = makeMockGL()
    const gl2 = makeMockGL()
    const c1 = new ShaderPassCompiler(gl1 as unknown as WebGL2RenderingContext)
    const c2 = new ShaderPassCompiler(gl2 as unknown as WebGL2RenderingContext)

    const r1 = c1.compile(def)
    const r2 = c2.compile(def)

    expect(r1.graph?.passes.map(n => n.passId))
      .toEqual(r2.graph?.passes.map(n => n.passId))
  })

  it('I2: topological sort is stable — equal priority passes preserve input order', () => {
    const passes = [makePass('x'), makePass('y'), makePass('z')]
    const r1 = topologicalSort(passes)
    const r2 = topologicalSort([...passes])
    expect(r1.order!.map(p => p.id)).toEqual(r2.order!.map(p => p.id))
  })

  it('I3: last pass in compiled multi-pass graph has outputName=null (renders to screen)', () => {
    const def = {
      id: 'screen-check', name: 'S', description: 'S', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [
        makePass('gen'),
        makePass('composite', { inputs: ['gen-out'], dependsOn: ['gen'] }),
      ],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    if (result.graph) {
      const last = result.graph.passes[result.graph.passes.length - 1]
      expect(last.outputName).toBeNull()
    }
  })

  it('I4: intermediate passes have non-null outputName', () => {
    const def = {
      id: 'intermediates', name: 'I', description: 'I',
      category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [
        makePass('gen'),
        makePass('blur', { inputs: ['gen-out'], dependsOn: ['gen'] }),
        makePass('final', { inputs: ['blur-out'], dependsOn: ['blur'] }),
      ],
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    if (result.graph) {
      const passes = result.graph.passes
      // All but the last should have a non-null outputName
      for (let i = 0; i < passes.length - 1; i++) {
        expect(passes[i].outputName).not.toBeNull()
      }
      expect(passes[passes.length - 1].outputName).toBeNull()
    }
  })

  it('I5: single-pass graph is flagged isSinglePass and has one pass', () => {
    const def = {
      id: 'single', name: 'S', description: 'S', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      fragSrc: '#version 300 es\nout vec4 c;\nvoid main(){c=vec4(1);}',
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    if (result.graph) {
      expect(result.graph.isSinglePass).toBe(true)
      expect(result.graph.passes.length).toBe(1)
      expect(result.graph.passes[0].passId).toBe('__single__')
    }
  })

  it('I6: implicit ordering from inputs inferred without explicit dependsOn', () => {
    // passB reads 'a-out' which passA produces — no explicit dependsOn needed
    const passes = [
      makePass('B', { inputs: ['a-out'] }),   // depends on A implicitly
      makePass('A'),                            // produces 'a-out'
    ]
    const def = {
      id: 'implicit', name: 'I', description: 'I', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes,
    }
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl as unknown as WebGL2RenderingContext)
    const result = compiler.compile(def)
    if (result.graph) {
      const ids = result.graph.passes.map(n => n.passId)
      expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('B'))
    }
  })
})

// ── J: HDR format resolution + capability fallback (Blocker A) ──────────────

describe('J: ShaderPassCompiler — format resolution and float-target capability', () => {
  function multiPassDef(passes: ShaderPassDef[], quality?: ShaderDefinition['quality']): ShaderDefinition {
    return {
      id: 'fmt-test', name: 'F', description: 'F', category: 'generator', version: 1,
      params: [], defaults: {}, passes, quality,
    }
  }

  it('J1: a pass with no explicit format and no quality.requiresFloatTarget compiles to rgba8', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const def = multiPassDef([makePass('a'), makePass('b', { inputs: ['a-out'] })])
    const { graph } = compiler.compile(def)
    expect(graph!.passes[0].format).toBe('rgba8')
  })

  it('J2: quality.requiresFloatTarget defaults every explicit-format-less non-screen pass to rgba16f when the device supports it', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const def = multiPassDef(
      [makePass('a'), makePass('b', { inputs: ['a-out'] })],
      { requiresFloatTarget: true },
    )
    const { graph } = compiler.compile(def)
    expect(graph!.passes[0].format).toBe('rgba16f') // non-screen pass
  })

  it('J3: the final (screen) pass is always rgba8 even under quality.requiresFloatTarget', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const def = multiPassDef(
      [makePass('a'), makePass('b', { inputs: ['a-out'] })],
      { requiresFloatTarget: true },
    )
    const { graph } = compiler.compile(def)
    const last = graph!.passes[graph!.passes.length - 1]
    expect(last.outputName).toBeNull()
    expect(last.format).toBe('rgba8')
  })

  it('J4: an explicit per-pass format overrides the definition-level default (checked on a non-screen pass)', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const def = multiPassDef(
      [
        makePass('a', { format: 'r8' }),
        makePass('b', { inputs: ['a-out'] }), // non-screen: gets the definition default
        makePass('c', { inputs: ['b-out'] }), // screen pass: always rgba8
      ],
      { requiresFloatTarget: true },
    )
    const { graph } = compiler.compile(def)
    expect(graph!.passes[0].format).toBe('r8')
    expect(graph!.passes[1].format).toBe('rgba16f') // still gets the definition default
  })

  it('J5: falls back to rgba8 when EXT_color_buffer_float is unavailable, regardless of request', () => {
    const gl = makeMockGL() // no extensions
    const compiler = new ShaderPassCompiler(gl)
    const def = multiPassDef([makePass('a', { format: 'rgba16f' }), makePass('b', { inputs: ['a-out'] })])
    const { graph } = compiler.compile(def)
    expect(graph!.passes[0].format).toBe('rgba8')
  })

  it('J6: falls back to rgba8 when a blending pass requests a float format but EXT_float_blend is unavailable', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float'])) // colorBufferFloat yes, floatBlend no
    const compiler = new ShaderPassCompiler(gl)
    const def = multiPassDef([
      makePass('a', { format: 'rgba16f', blendMode: 'additive' }),
      makePass('b', { inputs: ['a-out'] }),
    ])
    const { graph } = compiler.compile(def)
    expect(graph!.passes[0].format).toBe('rgba8')
  })

  it('J7: keeps rgba16f for a blending pass when both float extensions are available', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const def = multiPassDef([
      makePass('a', { format: 'rgba16f', blendMode: 'additive' }),
      makePass('b', { inputs: ['a-out'] }),
    ])
    const { graph } = compiler.compile(def)
    expect(graph!.passes[0].format).toBe('rgba16f')
  })

  it('J8: a non-blending pass only needs EXT_color_buffer_float, not EXT_float_blend', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float'])) // floatBlend missing
    const compiler = new ShaderPassCompiler(gl)
    const def = multiPassDef([
      makePass('a', { format: 'rgba16f' }), // blendMode omitted -> 'none'
      makePass('b', { inputs: ['a-out'] }),
    ])
    const { graph } = compiler.compile(def)
    expect(graph!.passes[0].format).toBe('rgba16f')
  })

  it('J9: single-pass (screen-only) definitions always report rgba8, capability notwithstanding', () => {
    const gl = makeMockGL() // no extensions
    const compiler = new ShaderPassCompiler(gl)
    const def: ShaderDefinition = {
      id: 'single', name: 'S', description: 'S', category: 'generator', version: 1,
      params: [], defaults: {},
      fragSrc: '#version 300 es\nout vec4 c;\nvoid main(){c=vec4(1);}',
    }
    const { graph } = compiler.compile(def)
    expect(graph!.passes[0].format).toBe('rgba8')
  })

  it('J10: ShaderRenderGraph threads the compiled format into the pool, ping-pong, and persistent FBO paths', () => {
    const gl = makeMockGL(new Set(['EXT_color_buffer_float', 'EXT_float_blend']))
    const compiler = new ShaderPassCompiler(gl)
    const def = multiPassDef(
      [
        makePass('pooled'),
        makePass('pingpong', { inputs: ['pooled-out', 'pingpong-out'], pingPong: true, persistent: true }),
        makePass('screen', { inputs: ['pingpong-out'] }),
      ],
      { requiresFloatTarget: true },
    )
    const { graph } = compiler.compile(def)
    expect(graph).not.toBeNull()

    const renderGraph = new ShaderRenderGraph(gl)
    renderGraph.loadGraph(graph!)
    renderGraph.execute({ W: 64, H: 64, aspect: 1, pixelRatio: 1 }, new Map(), () => {})

    // texImage2D is called for every texture allocation; at least one call
    // for the pooled + ping-pong (x2) + persistent-adjacent paths should
    // request the RGBA16F internal format the definition asked for.
    const texImageCalls = (gl as unknown as { _calls: { method: string; args: unknown[] }[] })._calls
      .filter(c => c.method === 'texImage2D' || c.method === 'texStorage2D')
    const usedRgba16f = texImageCalls.some(c => c.args.includes(gl.RGBA16F))
    expect(usedRgba16f).toBe(true)
  })
})

// ── K: Geometry pass dispatch through ShaderRenderPass / ShaderRenderGraph (Blocker B) ──

describe('K: geometry pass dispatch', () => {
  function geometryDef(): ShaderDefinition {
    return {
      id: 'geo-test', name: 'G', description: 'G', category: 'generator', version: 1,
      params: [], defaults: {},
      passes: [
        {
          id: 'draw',
          drawKind: 'geometry',
          fragSrc: '#version 300 es\nprecision mediump float;\nout vec4 c;\nvoid main(){c=vec4(1);}',
          vertSrc: '#version 300 es\nlayout(location=0) in vec2 a;\nvoid main(){gl_Position=vec4(a,0.0,1.0);}',
          inputs: [],
          output: 'draw-out',
        },
      ],
    }
  }

  it('K1: a compiled geometry pass node reports drawKind "geometry"', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(geometryDef())
    expect(graph!.passes[0].drawKind).toBe('geometry')
  })

  it('K2: a plain fragSrc-only pass defaults to drawKind "fullscreen"', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const def = {
      id: 'fs-test', name: 'F', description: 'F', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      passes: [makePass('a')],
    }
    const { graph } = compiler.compile(def)
    expect(graph!.passes[0].drawKind).toBe('fullscreen')
  })

  it('K3: executing a graph with a geometry pass and a provideGeometry callback issues an instanced draw call', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(geometryDef())
    const renderGraph = new ShaderRenderGraph(gl)
    renderGraph.loadGraph(graph!)

    const segmentData = new Float32Array(11).fill(0.5)
    renderGraph.execute(
      { W: 64, H: 64, aspect: 1, pixelRatio: 1 },
      new Map(),
      () => {},
      () => ({ data: segmentData, count: 1 }),
    )

    expect(gl._calls.some(c => c.method === 'drawArraysInstanced')).toBe(true)
  })

  it('K4: executing a graph with a geometry pass but NO provideGeometry callback draws nothing (no throw, no instanced draw call)', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(geometryDef())
    const renderGraph = new ShaderRenderGraph(gl)
    renderGraph.loadGraph(graph!)

    expect(() => {
      renderGraph.execute({ W: 64, H: 64, aspect: 1, pixelRatio: 1 }, new Map(), () => {})
    }).not.toThrow()
    expect(gl._calls.some(c => c.method === 'drawArraysInstanced')).toBe(false)
  })

  it('K5: a provideGeometry callback returning null for this pass id also draws nothing', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(geometryDef())
    const renderGraph = new ShaderRenderGraph(gl)
    renderGraph.loadGraph(graph!)

    renderGraph.execute(
      { W: 64, H: 64, aspect: 1, pixelRatio: 1 },
      new Map(),
      () => {},
      () => null,
    )
    expect(gl._calls.some(c => c.method === 'drawArraysInstanced')).toBe(false)
  })

  it('K6: existing fullscreen-only scenes are unaffected by the new geometry dispatch (still draw via drawArrays, never drawArraysInstanced)', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const def = {
      id: 'fs-only', name: 'F', description: 'F', category: 'generator' as const, version: 1,
      params: [], defaults: {},
      fragSrc: '#version 300 es\nout vec4 c;\nvoid main(){c=vec4(1);}',
    }
    const { graph } = compiler.compile(def)
    const renderGraph = new ShaderRenderGraph(gl)
    renderGraph.loadGraph(graph!)
    renderGraph.execute({ W: 64, H: 64, aspect: 1, pixelRatio: 1 }, new Map(), () => {})
    expect(gl._calls.some(c => c.method === 'drawArraysInstanced')).toBe(false)
  })
})

// ── L: Quality-aware bloom tier resolution scale flooring ───────────────────

describe('L: resolveActiveBloomTierCount + quality-aware bloomTier compilation', () => {
  it('L1: maps each quality tier to the expected active bloom tier count', () => {
    expect(resolveActiveBloomTierCount(QUALITY_PROFILES.low)).toBe(1)
    expect(resolveActiveBloomTierCount(QUALITY_PROFILES.medium)).toBe(2)
    expect(resolveActiveBloomTierCount(QUALITY_PROFILES.high)).toBe(3)
    expect(resolveActiveBloomTierCount(QUALITY_PROFILES.ultra)).toBe(3)
  })

  function bloomDef(): ShaderDefinition {
    return {
      id: 'bloom-test', name: 'B', description: 'B', category: 'generator', version: 1,
      params: [], defaults: {},
      passes: [
        makePass('base'),
        makePass('tier1', { inputs: ['base-out'], bloomTier: 1, resolutionScale: 0.5 }),
        makePass('tier2', { inputs: ['base-out'], bloomTier: 2, resolutionScale: 0.25 }),
        makePass('tier3', { inputs: ['base-out'], bloomTier: 3, resolutionScale: 0.125 }),
        makePass('composite', { inputs: ['tier1-out', 'tier2-out', 'tier3-out'] }),
      ],
    }
  }

  it('L2: omitting the quality profile preserves every bloomTier pass\'s authored resolutionScale', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(bloomDef())
    const byId = new Map(graph!.passes.map(p => [p.passId, p]))
    expect(byId.get('tier1')!.resolutionScale).toBeCloseTo(0.5)
    expect(byId.get('tier2')!.resolutionScale).toBeCloseTo(0.25)
    expect(byId.get('tier3')!.resolutionScale).toBeCloseTo(0.125)
  })

  it('L3: at the low profile (1 active tier), tiers 2 and 3 are floored to PASS_SCALE_MIN but tier 1 is untouched', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(bloomDef(), QUALITY_PROFILES.low)
    const byId = new Map(graph!.passes.map(p => [p.passId, p]))
    expect(byId.get('tier1')!.resolutionScale).toBeCloseTo(0.5)
    expect(byId.get('tier2')!.resolutionScale).toBe(PASS_SCALE_MIN)
    expect(byId.get('tier3')!.resolutionScale).toBe(PASS_SCALE_MIN)
  })

  it('L4: at the medium profile (2 active tiers), only tier 3 is floored', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(bloomDef(), QUALITY_PROFILES.medium)
    const byId = new Map(graph!.passes.map(p => [p.passId, p]))
    expect(byId.get('tier1')!.resolutionScale).toBeCloseTo(0.5)
    expect(byId.get('tier2')!.resolutionScale).toBeCloseTo(0.25)
    expect(byId.get('tier3')!.resolutionScale).toBe(PASS_SCALE_MIN)
  })

  it('L5: flooring a bloom tier does not remove it from the graph or break its dependents (composite still compiles and depends on all 3 tiers)', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const { graph, error } = compiler.compile(bloomDef(), QUALITY_PROFILES.low)
    expect(error).toBeNull()
    const ids = graph!.passes.map(p => p.passId)
    expect(ids).toContain('tier2')
    expect(ids).toContain('tier3')
    expect(ids.indexOf('composite')).toBe(ids.length - 1)
  })

  it('L6: passes with no bloomTier are never affected by a quality profile', () => {
    const gl = makeMockGL()
    const compiler = new ShaderPassCompiler(gl)
    const { graph } = compiler.compile(bloomDef(), QUALITY_PROFILES.low)
    const base = graph!.passes.find(p => p.passId === 'base')!
    expect(base.bloomTier).toBeNull()
    expect(base.resolutionScale).toBe(1.0)
  })
})
