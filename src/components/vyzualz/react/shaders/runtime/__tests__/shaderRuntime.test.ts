/**
 * Focused unit tests for the Shader WebGL2 runtime.
 *
 * All tests run in the Node environment (no real GPU).  Each module under
 * test receives a lightweight GL mock that tracks deletion counts and can be
 * configured to fail specific allocations.
 *
 * Coverage:
 *   A. Structured shader compile errors
 *   B. Shader deletion on compile failure (no leaks)
 *   C. Program link failure cleanup (shaders + program deleted)
 *   D. Vertex compile failure propagation
 *   E. Fragment compile failure with vertex shader cleanup
 *   F. Runtime resize calculations (W, H, aspect, pixelRatio)
 *   G. Resolution scale clamping (min and max edges)
 *   H. Context unavailable → graceful failure
 *   I. Runtime dispose idempotence
 *   J. beginFrame returns null when context lost / after dispose
 *   K. ShaderResourceManager disposal idempotence
 *   L. ShaderFramebuffer resize frees old resources
 *   M. ShaderFramebuffer resize is a no-op for same size
 *   N. ShaderFramebuffer dispose idempotence
 *   O. ShaderFramebuffer incomplete FBO → throws and cleans up
 */

import { describe, it, expect, vi } from 'vitest'
import { ShaderCompiler } from '../ShaderCompiler'
import { ShaderProgram }  from '../ShaderProgram'
import { ShaderResourceManager } from '../ShaderResourceManager'
import { ShaderFramebuffer }     from '../ShaderFramebuffer'
import {
  ShaderWebGLRuntime,
  MIN_RESOLUTION_SCALE,
  MAX_RESOLUTION_SCALE,
} from '../ShaderWebGLRuntime'

// Unwraps a successful create result; throws if the mock was configured wrong.
function ok(result: ReturnType<typeof ShaderWebGLRuntime.create>): ShaderWebGLRuntime {
  if (!result.runtime) throw new Error(`Expected runtime to be created, got error: ${result.error}`)
  return result.runtime
}

// ── Minimal GL constants ──────────────────────────────────────────────────────

const GL = {
  VERTEX_SHADER:        35633,
  FRAGMENT_SHADER:      35632,
  COMPILE_STATUS:       35713,
  LINK_STATUS:          35714,
  FRAMEBUFFER:          36160,
  FRAMEBUFFER_COMPLETE: 36053,
  FRAMEBUFFER_INCOMPLETE_ATTACHMENT:         0x8CD6,
  FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 0x8CD7,
  FRAMEBUFFER_INCOMPLETE_DIMENSIONS:         0x8CD9,
  FRAMEBUFFER_UNSUPPORTED:                   0x8CDD,
  COLOR_ATTACHMENT0:    36064,
  TEXTURE_2D:           3553,
  TEXTURE_WRAP_S:       10242,
  TEXTURE_WRAP_T:       10243,
  TEXTURE_MIN_FILTER:   10241,
  TEXTURE_MAG_FILTER:   10240,
  CLAMP_TO_EDGE:        33071,
  REPEAT:               10497,
  MIRRORED_REPEAT:      33648,
  LINEAR:               9729,
  NEAREST:              9728,
  RGBA8:                32856,
  RGBA:                 6408,
  UNSIGNED_BYTE:        5121,
  R8:                   33321,
  RED:                  6403,
  RGBA16F:              34842,
  RGBA32F:              34836,
  HALF_FLOAT:           36193,
  FLOAT:                5126,
  TRIANGLES:            4,
  COLOR_BUFFER_BIT:     16384,
  TEXTURE0:             33984,
  MAX_TEXTURE_SIZE:     0x0D33,
  MAX_RENDERBUFFER_SIZE: 0x84E8,
  NO_ERROR:             0,
}

// ── GL mock ───────────────────────────────────────────────────────────────────

interface DeleteCounts {
  shaders:      number
  programs:     number
  textures:     number
  framebuffers: number
  buffers:      number
  vaos:         number
}

interface MockOpts {
  failShaderAt?:      number   // fail COMPILE_STATUS on the Nth compile check (1-based)
  failProgramAt?:     number   // fail LINK_STATUS on the Nth link check (1-based)
  failTextureAt?:     number   // return null from createTexture on the Nth call (1-based)
  failFramebufferAt?: number   // return null from createFramebuffer on the Nth call (1-based)
  framebufferStatus?: number   // override checkFramebufferStatus return value
}

function makeGL(opts: MockOpts = {}): { gl: WebGL2RenderingContext; deleted: DeleteCounts } {
  const deleted: DeleteCounts = { shaders: 0, programs: 0, textures: 0, framebuffers: 0, buffers: 0, vaos: 0 }
  let shaderN = 0, programN = 0, textureN = 0, fboN = 0

  const gl: Record<string, unknown> = {
    ...GL,

    createShader:       () => ({}),
    shaderSource:       () => {},
    compileShader:      () => {},
    getShaderParameter: (_s: unknown, pname: unknown) => {
      if (pname === GL.COMPILE_STATUS) {
        shaderN++
        if (opts.failShaderAt !== undefined && shaderN >= opts.failShaderAt) return false
      }
      return true
    },
    getShaderInfoLog:   () => 'mock compile error at 0:5: undefined variable',
    deleteShader:       () => { deleted.shaders++ },

    createProgram:       () => ({}),
    attachShader:        () => {},
    bindAttribLocation:  () => {},
    linkProgram:         () => {},
    getProgramParameter: (_p: unknown, pname: unknown) => {
      if (pname === GL.LINK_STATUS) {
        programN++
        if (opts.failProgramAt !== undefined && programN >= opts.failProgramAt) return false
      }
      return true
    },
    getProgramInfoLog:  () => 'mock link error',
    deleteProgram:      () => { deleted.programs++ },
    getUniformLocation: () => ({}),
    getAttribLocation:  () => 0,
    useProgram:         () => {},
    uniform1f:          () => {},
    uniform1i:          () => {},
    uniform2f:          () => {},
    uniform3f:          () => {},
    uniform4f:          () => {},
    uniformMatrix4fv:   () => {},

    createTexture: () => {
      textureN++
      if (opts.failTextureAt !== undefined && textureN >= opts.failTextureAt) return null
      return { _id: textureN }
    },
    bindTexture:    () => {},
    texImage2D:     () => {},
    texStorage2D:   () => {},
    texParameteri:  () => {},
    pixelStorei:    () => {},
    activeTexture:  () => {},
    deleteTexture:  () => { deleted.textures++ },

    createFramebuffer: () => {
      fboN++
      if (opts.failFramebufferAt !== undefined && fboN >= opts.failFramebufferAt) return null
      return { _id: fboN }
    },
    bindFramebuffer:       () => {},
    framebufferTexture2D:  () => {},
    drawBuffers:           () => {},
    readBuffer:            () => {},
    checkFramebufferStatus: () => opts.framebufferStatus ?? GL.FRAMEBUFFER_COMPLETE,
    deleteFramebuffer:     () => { deleted.framebuffers++ },
    isContextLost:         () => false,
    getError:              () => 0,
    getParameter:          (pname: number) => {
      if (pname === GL.MAX_TEXTURE_SIZE)      return 16384
      if (pname === GL.MAX_RENDERBUFFER_SIZE) return 16384
      return null
    },

    createBuffer:   () => ({}),
    deleteBuffer:   () => { deleted.buffers++ },

    createVertexArray: () => ({}),
    deleteVertexArray: () => { deleted.vaos++ },

    drawArrays:   () => {},
    viewport:     () => {},
    clearColor:   () => {},
    clear:        () => {},
    flush:        () => {},
    getExtension: () => null,
  }

  return { gl: gl as unknown as WebGL2RenderingContext, deleted }
}

// ── Canvas mock ───────────────────────────────────────────────────────────────

function makeCanvas(gl: WebGL2RenderingContext | null): {
  canvas: HTMLCanvasElement
  fire: (type: string, event?: object) => void
} {
  const listeners: Record<string, Set<(e: object) => void>> = {}
  const canvas: Record<string, unknown> = {
    width:  0,
    height: 0,
    getContext: () => gl,
    addEventListener:    (type: string, fn: (e: object) => void) => {
      ;(listeners[type] ??= new Set()).add(fn)
    },
    removeEventListener: (type: string, fn: (e: object) => void) => {
      listeners[type]?.delete(fn)
    },
  }
  const fire = (type: string, event: object = {}) => {
    listeners[type]?.forEach(fn => fn(event))
  }
  return { canvas: canvas as unknown as HTMLCanvasElement, fire }
}

// ── Minimal GLSL sources for program creation tests ───────────────────────────

const MINIMAL_VERT = '#version 300 es\nvoid main() { gl_Position = vec4(0); }'
const MINIMAL_FRAG = '#version 300 es\nout vec4 o; void main() { o = vec4(1); }'

// ── A. Structured compile errors ─────────────────────────────────────────────

describe('A — structured shader compile errors', () => {
  it('returns a typed error with stage=fragment and the log text', () => {
    const { gl } = makeGL({ failShaderAt: 1 })
    const compiler = new ShaderCompiler(gl)
    const result = compiler.compile('fragment', MINIMAL_FRAG, 'test/frag')
    expect(result.shader).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.stage).toBe('fragment')
    expect(result.error!.label).toBe('test/frag')
    expect(result.error!.log).toBeTruthy()
  })

  it('returns a typed error with stage=vertex', () => {
    const { gl } = makeGL({ failShaderAt: 1 })
    const compiler = new ShaderCompiler(gl)
    const result = compiler.compile('vertex', MINIMAL_VERT, 'test/vert')
    expect(result.error?.stage).toBe('vertex')
  })

  it('annotates source when the log contains a line reference (0:<N>:)', () => {
    const { gl } = makeGL({ failShaderAt: 1 })
    const compiler = new ShaderCompiler(gl)
    // The mock log contains "0:5: undefined variable" — annotatedSource should include line 5
    const src = Array.from({ length: 10 }, (_, i) => `// line ${i + 1}`).join('\n')
    const result = compiler.compile('fragment', src, 'annotate-test')
    expect(result.error?.annotatedSource).toContain('>>>')
  })

  it('returns a success result when compilation succeeds', () => {
    const { gl } = makeGL()
    const compiler = new ShaderCompiler(gl)
    const result = compiler.compile('vertex', MINIMAL_VERT, 'ok/vert')
    expect(result.shader).not.toBeNull()
    expect(result.error).toBeNull()
  })

  it('returns a graceful error when createShader returns null', () => {
    const base = makeGL()
    const gl: WebGL2RenderingContext = { ...base.gl, createShader: () => null } as unknown as WebGL2RenderingContext
    const compiler = new ShaderCompiler(gl)
    const result = compiler.compile('vertex', MINIMAL_VERT, 'null-shader')
    expect(result.shader).toBeNull()
    expect(result.error!.log).toContain('null')
  })
})

// ── B. Shader deletion on compile failure ─────────────────────────────────────

describe('B — shader deletion on compile failure', () => {
  it('deletes the failed shader object (no GPU leak)', () => {
    const { gl, deleted } = makeGL({ failShaderAt: 1 })
    const compiler = new ShaderCompiler(gl)
    compiler.compile('vertex', MINIMAL_VERT, 'leak-test')
    expect(deleted.shaders).toBe(1)
  })

  it('does NOT delete a successfully compiled shader (caller owns it)', () => {
    const { gl, deleted } = makeGL()
    const compiler = new ShaderCompiler(gl)
    const result = compiler.compile('vertex', MINIMAL_VERT, 'ok')
    expect(result.shader).not.toBeNull()
    expect(deleted.shaders).toBe(0)
  })
})

// ── C. Program link failure cleanup ──────────────────────────────────────────

describe('C — program link failure cleanup', () => {
  it('deletes both shaders and the program when linking fails', () => {
    const { gl, deleted } = makeGL({ failProgramAt: 1 })
    const compiler = new ShaderCompiler(gl)
    const result = ShaderProgram.create(gl, compiler, {
      vertSrc: MINIMAL_VERT, fragSrc: MINIMAL_FRAG, label: 'link-fail',
    })
    expect(result.program).toBeNull()
    expect(result.error?.stage).toBe('link')
    expect(deleted.shaders).toBe(2)   // vert + frag deleted after attach
    expect(deleted.programs).toBe(1)  // program deleted after link failure
  })
})

// ── D. Vertex compile failure ─────────────────────────────────────────────────

describe('D — vertex compile failure', () => {
  it('returns an error before creating the program; frag is never compiled', () => {
    const { gl, deleted } = makeGL({ failShaderAt: 1 })
    const compiler = new ShaderCompiler(gl)
    const result = ShaderProgram.create(gl, compiler, {
      vertSrc: MINIMAL_VERT, fragSrc: MINIMAL_FRAG, label: 'vert-fail',
    })
    expect(result.program).toBeNull()
    expect(result.error?.stage).toBe('vertex')
    expect(deleted.shaders).toBe(1)   // only the failed vert shader is deleted
    expect(deleted.programs).toBe(0)  // no program was ever created
  })
})

// ── E. Fragment compile failure with vertex cleanup ───────────────────────────

describe('E — fragment compile failure', () => {
  it('deletes the already-compiled vertex shader and the failed fragment shader', () => {
    // failShaderAt: 2 → first compile (vert) succeeds, second (frag) fails
    const { gl, deleted } = makeGL({ failShaderAt: 2 })
    const compiler = new ShaderCompiler(gl)
    const result = ShaderProgram.create(gl, compiler, {
      vertSrc: MINIMAL_VERT, fragSrc: MINIMAL_FRAG, label: 'frag-fail',
    })
    expect(result.program).toBeNull()
    expect(result.error?.stage).toBe('fragment')
    // frag deleted by ShaderCompiler (1) + vert deleted by ShaderProgram.create (1)
    expect(deleted.shaders).toBe(2)
    expect(deleted.programs).toBe(0)
  })
})

// ── F. Runtime resize calculations ───────────────────────────────────────────

describe('F — runtime resize calculations', () => {
  it('computes W, H, aspect, and pixelRatio correctly', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas, { resolutionScale: 0.5 }))
    runtime.resize(1920, 1080, 2)
    const dims = runtime.dims
    // 1920 × 2 × 0.5 = 1920, 1080 × 2 × 0.5 = 1080
    expect(dims.W).toBe(1920)
    expect(dims.H).toBe(1080)
    expect(dims.aspect).toBeCloseTo(1920 / 1080, 5)
    expect(dims.pixelRatio).toBe(2)
  })

  it('clamps W and H to at least 1', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas))
    runtime.resize(0, 0, 1)
    expect(runtime.dims.W).toBe(1)
    expect(runtime.dims.H).toBe(1)
  })

  it('rounds fractional pixel sizes', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas, { resolutionScale: 0.75 }))
    // 800 × 1 × 0.75 = 600 (exact), 600 × 1 × 0.75 = 450 (exact)
    runtime.resize(800, 600, 1)
    expect(runtime.dims.W).toBe(600)
    expect(runtime.dims.H).toBe(450)
  })
})

// ── G. Resolution scale clamping ─────────────────────────────────────────────

describe('G — resolution scale clamping', () => {
  it('clamps scale=0 to MIN_RESOLUTION_SCALE at construction', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas, { resolutionScale: 0 }))
    expect(runtime.resolutionScale).toBe(MIN_RESOLUTION_SCALE)
  })

  it('clamps scale=99 to MAX_RESOLUTION_SCALE via setResolutionScale', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas))
    runtime.setResolutionScale(99)
    expect(runtime.resolutionScale).toBe(MAX_RESOLUTION_SCALE)
  })

  it('accepts a valid mid-range scale', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas))
    runtime.setResolutionScale(0.5)
    expect(runtime.resolutionScale).toBe(0.5)
  })

  it('negative scale is clamped to MIN_RESOLUTION_SCALE', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas))
    runtime.setResolutionScale(-1)
    expect(runtime.resolutionScale).toBe(MIN_RESOLUTION_SCALE)
  })
})

// ── H. Context unavailable ────────────────────────────────────────────────────

describe('H — context unavailable', () => {
  it('returns a typed failure with runtime=null when getContext returns null', () => {
    const { canvas } = makeCanvas(null)
    const result = ShaderWebGLRuntime.create(canvas)
    expect(result.runtime).toBeNull()
    expect(typeof result.error).toBe('string')
    expect(result.error!.length).toBeGreaterThan(0)
  })
})

// ── I. Runtime dispose idempotence ────────────────────────────────────────────

describe('I — runtime dispose idempotence', () => {
  it('can be disposed twice without error', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas))
    runtime.dispose()
    expect(() => runtime.dispose()).not.toThrow()
    expect(runtime.disposed).toBe(true)
  })
})

// ── J. beginFrame returns null when inactive ──────────────────────────────────

describe('J — beginFrame returns null after dispose or context loss', () => {
  it('returns null after dispose()', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas))
    runtime.dispose()
    expect(runtime.beginFrame()).toBeNull()
  })

  it('returns null when context is lost', () => {
    const { gl } = makeGL()
    const { canvas, fire } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas))
    fire('webglcontextlost', { preventDefault: vi.fn() })
    expect(runtime.beginFrame()).toBeNull()
    expect(runtime.contextLost).toBe(true)
  })

  it('returns a FrameState when the context is healthy', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas))
    const state = runtime.beginFrame()
    expect(state).not.toBeNull()
    expect(typeof state!.time).toBe('number')
    expect(typeof state!.deltaTime).toBe('number')
    expect(state!.deltaTime).toBeGreaterThanOrEqual(0)
    expect(state!.deltaTime).toBeLessThanOrEqual(0.1)
  })
})

// ── K. ShaderResourceManager disposal idempotence ────────────────────────────

describe('K — ShaderResourceManager disposal idempotence', () => {
  it('calls deleteTexture exactly once even when disposeAll() is called twice', () => {
    const { gl, deleted } = makeGL()
    const mgr = new ShaderResourceManager(gl)
    const fakeTex = {} as WebGLTexture
    mgr.trackTexture(fakeTex)
    mgr.disposeAll()
    mgr.disposeAll()
    expect(deleted.textures).toBe(1)
  })

  it('deletes all tracked resource types on disposeAll()', () => {
    const { gl, deleted } = makeGL()
    const mgr = new ShaderResourceManager(gl)
    mgr.trackProgram({} as WebGLProgram)
    mgr.trackTexture({} as WebGLTexture)
    mgr.trackFramebuffer({} as WebGLFramebuffer)
    mgr.trackBuffer({} as WebGLBuffer)
    mgr.trackVAO({} as WebGLVertexArrayObject)
    mgr.disposeAll()
    expect(deleted.programs).toBe(1)
    expect(deleted.textures).toBe(1)
    expect(deleted.framebuffers).toBe(1)
    expect(deleted.buffers).toBe(1)
    expect(deleted.vaos).toBe(1)
  })

  it('resetForRestore() allows the manager to accept new resources after context loss', () => {
    const { gl, deleted } = makeGL()
    const mgr = new ShaderResourceManager(gl)
    mgr.trackTexture({} as WebGLTexture)
    // Simulate context loss: don't call disposeAll(), just reset.
    mgr.resetForRestore()
    // Now track a new resource from the restored context.
    const newTex = {} as WebGLTexture
    mgr.trackTexture(newTex)
    mgr.disposeAll()
    // Only the post-restore texture should be deleted.
    expect(deleted.textures).toBe(1)
  })
})

// ── L. ShaderFramebuffer resize frees old resources ──────────────────────────

describe('L — ShaderFramebuffer resize frees old resources', () => {
  it('deletes the previous texture and FBO when resized to a new size', () => {
    const { gl, deleted } = makeGL()
    const fb = new ShaderFramebuffer(gl)
    fb.resize(100, 100)  // initial allocation
    fb.resize(200, 200)  // must free previous tex + fbo, then create new ones
    expect(deleted.textures).toBe(1)
    expect(deleted.framebuffers).toBe(1)
  })
})

// ── M. ShaderFramebuffer resize no-op for same size ──────────────────────────

describe('M — ShaderFramebuffer resize no-op for same size', () => {
  it('does not allocate new resources when size is unchanged', () => {
    let texCount = 0
    const { gl } = makeGL()
    const countingGl: WebGL2RenderingContext = {
      ...gl,
      createTexture: () => { texCount++; return {} as WebGLTexture },
    } as unknown as WebGL2RenderingContext
    const fb = new ShaderFramebuffer(countingGl)
    fb.resize(64, 64)
    fb.resize(64, 64)  // same size — must not create a second texture
    expect(texCount).toBe(1)
  })
})

// ── N. ShaderFramebuffer dispose idempotence ──────────────────────────────────

describe('N — ShaderFramebuffer dispose idempotence', () => {
  it('deletes texture and FBO exactly once even when dispose() is called twice', () => {
    const { gl, deleted } = makeGL()
    const fb = new ShaderFramebuffer(gl)
    fb.resize(64, 64)
    fb.dispose()
    fb.dispose()  // second call must be a no-op
    expect(deleted.textures).toBe(1)
    expect(deleted.framebuffers).toBe(1)
  })
})

// ── O. ShaderFramebuffer incomplete FBO ──────────────────────────────────────

describe('O — ShaderFramebuffer incomplete FBO throws and cleans up', () => {
  it('throws with a descriptive message when the FBO is not FRAMEBUFFER_COMPLETE', () => {
    const { gl, deleted } = makeGL({ framebufferStatus: 0x8CD6 /* INCOMPLETE_ATTACHMENT */ })
    const fb = new ShaderFramebuffer(gl)
    expect(() => fb.resize(64, 64)).toThrow('[ShaderFramebuffer]')
    // Both the texture and FBO must have been freed before the throw.
    expect(deleted.textures).toBe(1)
    expect(deleted.framebuffers).toBe(1)
  })

  it('error message includes hex status code and size', () => {
    const { gl } = makeGL({ framebufferStatus: 0x8CDD /* FRAMEBUFFER_UNSUPPORTED */ })
    const fb = new ShaderFramebuffer(gl)
    let msg = ''
    try { fb.resize(64, 64) } catch (e) { msg = (e as Error).message }
    expect(msg).toContain('0x8cdd')
    expect(msg).toContain('64')
  })
})

// ── P. StrictMode lifecycle ────────────────────────────────────────────────────

describe('P — Strict Mode lifecycle: setup → cleanup → setup on same canvas', () => {
  it('P1: normal dispose() does NOT call WEBGL_lose_context.loseContext()', () => {
    const { gl } = makeGL()
    let loseContextCalled = false
    const mockExt = { loseContext: () => { loseContextCalled = true } }
    const glWithExt = {
      ...gl,
      getExtension: (name: string) => name === 'WEBGL_lose_context' ? mockExt : null,
    } as unknown as WebGL2RenderingContext
    const { canvas } = makeCanvas(glWithExt)
    const runtime = ok(ShaderWebGLRuntime.create(canvas))
    runtime.dispose()
    expect(loseContextCalled).toBe(false)
  })

  it('P2: second runtime created on the same canvas can allocate an RGBA8 FBO', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)

    // First setup + cleanup (simulates React.StrictMode mount 1 → unmount)
    const r1 = ok(ShaderWebGLRuntime.create(canvas))
    r1.dispose()
    expect(r1.disposed).toBe(true)

    // Second setup on the SAME canvas (simulates StrictMode remount)
    const r2 = ok(ShaderWebGLRuntime.create(canvas))
    const fb = new ShaderFramebuffer(r2.gl)
    expect(() => fb.resize(64, 64)).not.toThrow()
    expect(fb.framebuffer).not.toBeNull()
    expect(fb.texture).not.toBeNull()
    fb.dispose()
    r2.dispose()
  })

  it('P3: dispose() twice is safe (idempotent)', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    const runtime = ok(ShaderWebGLRuntime.create(canvas))
    runtime.dispose()
    expect(() => runtime.dispose()).not.toThrow()
    expect(runtime.disposed).toBe(true)
  })

  it('P4: onContextLost callback is never fired by normal dispose()', () => {
    const { gl } = makeGL()
    const { canvas } = makeCanvas(gl)
    let fired = false
    const runtime = ok(ShaderWebGLRuntime.create(canvas, {
      onContextLost: () => { fired = true },
    }))
    runtime.dispose()
    expect(fired).toBe(false)
  })
})

// ── Q. ShaderFramebuffer — transactional allocation and guards ────────────────

describe('Q — ShaderFramebuffer transactional allocation', () => {
  it('Q1: RGBA8 allocation produces a non-null framebuffer and texture', () => {
    const { gl } = makeGL()
    const fb = new ShaderFramebuffer(gl)
    expect(() => fb.resize(128, 128)).not.toThrow()
    expect(fb.framebuffer).not.toBeNull()
    expect(fb.texture).not.toBeNull()
    fb.dispose()
  })

  it('Q2: drawBuffers([COLOR_ATTACHMENT0]) is called on successful allocation', () => {
    const { gl } = makeGL()
    const drawCalls: number[][] = []
    const glSpy = {
      ...gl,
      drawBuffers: (bufs: number[]) => { drawCalls.push([...bufs]) },
    } as unknown as WebGL2RenderingContext
    const fb = new ShaderFramebuffer(glSpy)
    fb.resize(64, 64)
    expect(drawCalls.length).toBeGreaterThan(0)
    expect(drawCalls[0]).toContain(GL.COLOR_ATTACHMENT0)
    fb.dispose()
  })

  it('Q3: readBuffer(COLOR_ATTACHMENT0) is called on successful allocation', () => {
    const { gl } = makeGL()
    const readCalls: number[] = []
    const glSpy = {
      ...gl,
      readBuffer: (src: number) => { readCalls.push(src) },
    } as unknown as WebGL2RenderingContext
    const fb = new ShaderFramebuffer(glSpy)
    fb.resize(64, 64)
    expect(readCalls).toContain(GL.COLOR_ATTACHMENT0)
    fb.dispose()
  })

  it('Q4: failed replacement preserves the previous valid texture and framebuffer', () => {
    const { gl } = makeGL()
    let fboStatusOverride = GL.FRAMEBUFFER_COMPLETE
    const glDynamic = {
      ...gl,
      checkFramebufferStatus: () => fboStatusOverride,
    } as unknown as WebGL2RenderingContext

    const fb = new ShaderFramebuffer(glDynamic)
    fb.resize(64, 64)
    const origTex = fb.texture
    const origFbo = fb.framebuffer

    // Force next allocation to fail
    fboStatusOverride = 0x8CDD
    expect(() => fb.resize(128, 128)).toThrow('[ShaderFramebuffer]')

    // Original resources must be preserved intact
    expect(fb.texture).toBe(origTex)
    expect(fb.framebuffer).toBe(origFbo)
    expect(fb.width).toBe(64)
    expect(fb.height).toBe(64)

    fb.dispose()
  })

  it('Q5: context-lost resize exits without throwing and allocates nothing', () => {
    const { gl } = makeGL()
    let contextLost = true
    const glLost = {
      ...gl,
      isContextLost: () => contextLost,
      createTexture: () => { throw new Error('must not be called on lost context') },
    } as unknown as WebGL2RenderingContext

    const fb = new ShaderFramebuffer(glLost)
    expect(() => fb.resize(64, 64)).not.toThrow()
    expect(fb.framebuffer).toBeNull()
  })

  it('Q6: non-finite width is silently ignored', () => {
    const { gl } = makeGL()
    const fb = new ShaderFramebuffer(gl)
    expect(() => fb.resize(Infinity, 64)).not.toThrow()
    expect(() => fb.resize(NaN, 64)).not.toThrow()
    expect(fb.framebuffer).toBeNull()
  })

  it('Q7: zero dimensions normalise to 1×1 (not skipped)', () => {
    const { gl } = makeGL()
    const fb = new ShaderFramebuffer(gl)
    fb.resize(0, 0)
    expect(fb.framebuffer).not.toBeNull()
    expect(fb.width).toBe(1)
    expect(fb.height).toBe(1)
    fb.dispose()
  })

  it('Q8: failure diagnostics include status hex and size', () => {
    const { gl } = makeGL({ framebufferStatus: 0x8CDD })
    const fb = new ShaderFramebuffer(gl)
    let msg = ''
    try { fb.resize(684, 1026) } catch (e) { msg = (e as Error).message }
    expect(msg).toContain('0x8cdd')
    expect(msg).toContain('684')
    expect(msg).toContain('1026')
  })

  it('Q9: texStorage2D is used when available', () => {
    const { gl } = makeGL()
    let storageCalls = 0
    const glWithStorage = {
      ...gl,
      texStorage2D: () => { storageCalls++ },
    } as unknown as WebGL2RenderingContext
    const fb = new ShaderFramebuffer(glWithStorage)
    fb.resize(64, 64)
    expect(storageCalls).toBeGreaterThan(0)
    fb.dispose()
  })

  it('Q10: falls back to texImage2D when texStorage2D is absent', () => {
    const { gl } = makeGL()
    let imageCalls = 0
    // Build a GL object WITHOUT texStorage2D to simulate the fallback path
    const glBase = { ...gl } as Record<string, unknown>
    delete glBase['texStorage2D']
    const glNoStorage = {
      ...glBase,
      texImage2D: () => { imageCalls++ },
    } as unknown as WebGL2RenderingContext
    const fb = new ShaderFramebuffer(glNoStorage)
    fb.resize(64, 64)
    expect(imageCalls).toBeGreaterThan(0)
    fb.dispose()
  })
})
