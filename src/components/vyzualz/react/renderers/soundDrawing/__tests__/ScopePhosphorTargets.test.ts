import { describe, expect, it, vi } from 'vitest'
import { ScopePhosphorTargets } from '../ScopePhosphorTargets'
import {
  resolveScopeHdrTargetStrategy,
  resolveScopePhosphorPlan,
  type ScopePhosphorQuality,
} from '../soundDrawingPhosphorPlan'

// ── Mock WebGL2 context ───────────────────────────────────────────────────────
//
// Follows the established GeometryPass.test.ts pattern: a hand-built context
// that records object creation and deletion, so resource lifecycle and
// framebuffer wiring are assertable in the node partition.

function makeMockGL() {
  let objectId = 1
  const created = { textures: 0, framebuffers: 0, renderbuffers: 0 }
  const deleted = { textures: 0, framebuffers: 0, renderbuffers: 0 }
  let contextLost = false

  const gl = {
    TEXTURE_2D: 0x0de1,
    FRAMEBUFFER: 0x8d40,
    COLOR_ATTACHMENT0: 0x8ce0,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    COLOR_BUFFER_BIT: 0x4000,
    RGBA: 0x1908,
    RGBA8: 0x8058,
    RGBA16F: 0x881a,
    UNSIGNED_BYTE: 0x1401,
    HALF_FLOAT: 0x140b,
    LINEAR: 0x2601,
    NEAREST: 0x2600,
    CLAMP_TO_EDGE: 0x812f,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,

    createTexture: vi.fn(() => {
      created.textures++
      return { _t: objectId++ } as unknown as WebGLTexture
    }),
    deleteTexture: vi.fn(() => { deleted.textures++ }),
    createFramebuffer: vi.fn(() => {
      created.framebuffers++
      return { _f: objectId++ } as unknown as WebGLFramebuffer
    }),
    deleteFramebuffer: vi.fn(() => { deleted.framebuffers++ }),
    createRenderbuffer: vi.fn(() => {
      created.renderbuffers++
      return { _r: objectId++ } as unknown as WebGLRenderbuffer
    }),
    deleteRenderbuffer: vi.fn(() => { deleted.renderbuffers++ }),

    bindTexture: vi.fn(),
    bindFramebuffer: vi.fn(),
    bindRenderbuffer: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    texStorage2D: vi.fn(),
    framebufferTexture2D: vi.fn(),
    framebufferRenderbuffer: vi.fn(),
    renderbufferStorage: vi.fn(),
    checkFramebufferStatus: vi.fn(() => 0x8cd5),
    getError: vi.fn(() => 0),
    getParameter: vi.fn(() => null),
    drawBuffers: vi.fn(),
    readBuffer: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    isContextLost: vi.fn(() => contextLost),

    _created: created,
    _deleted: deleted,
    _setContextLost: (lost: boolean) => { contextLost = lost },
  }
  return gl as unknown as WebGL2RenderingContext & typeof gl
}

const HDR = resolveScopeHdrTargetStrategy({
  colorBufferFloat: true, rgba16fRenderable: true, floatLinearFiltering: true, floatBlend: true,
})
const LDR = resolveScopeHdrTargetStrategy({
  colorBufferFloat: false, rgba16fRenderable: false, floatLinearFiltering: false, floatBlend: false,
})

function plan(quality: ScopePhosphorQuality, hdr = HDR) {
  return resolveScopePhosphorPlan(quality, hdr)
}

describe('allocation', () => {
  it('creates a scene target, a persistence pair, and one target per bloom level', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('ultra'), { width: 1920, height: 1080 })

    const diagnostics = targets.getDiagnostics()
    expect(diagnostics.hasScene).toBe(true)
    expect(diagnostics.hasPersistence).toBe(true)
    expect(diagnostics.bloomLevelCount).toBe(3)
    expect(diagnostics.width).toBe(1920)
    expect(diagnostics.height).toBe(1080)
  })

  it('allocates fewer bloom targets on cheaper tiers', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('low'), { width: 1280, height: 720 })
    expect(targets.getDiagnostics().bloomLevelCount).toBe(1)
    expect(targets.bloomTarget(0)).not.toBeNull()
    // A level the tier does not run must not be addressable.
    expect(targets.bloomTarget(1)).toBeNull()
  })

  it('reports whether it actually allocated, so the caller can clear deliberately', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    expect(targets.ensure(plan('high'), { width: 800, height: 600 })).toBe(true)
    // Same plan and size — nothing to do.
    expect(targets.ensure(plan('high'), { width: 800, height: 600 })).toBe(false)
  })

  it('does not reallocate every frame during steady playback', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 800, height: 600 })
    const afterFirst = gl._created.textures

    for (let i = 0; i < 120; i++) targets.ensure(plan('high'), { width: 800, height: 600 })
    expect(gl._created.textures).toBe(afterFirst)
  })

  it('clamps degenerate sizes rather than allocating a zero-area target', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 0, height: 0 })
    const diagnostics = targets.getDiagnostics()
    expect(diagnostics.width).toBeGreaterThan(0)
    expect(diagnostics.height).toBeGreaterThan(0)
  })

  it('allocates nothing while the context is lost', () => {
    const gl = makeMockGL()
    gl._setContextLost(true)
    const targets = new ScopePhosphorTargets(gl)
    expect(targets.ensure(plan('high'), { width: 800, height: 600 })).toBe(false)
    expect(gl._created.textures).toBe(0)
  })
})

describe('resize and quality changes', () => {
  it('resizes to new dimensions without leaking the old targets', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 800, height: 600 })
    const createdAfterFirst = gl._created.framebuffers

    expect(targets.ensure(plan('high'), { width: 1600, height: 900 })).toBe(true)
    expect(targets.getDiagnostics().width).toBe(1600)

    // ShaderFramebuffer.resize allocates a replacement texture and framebuffer
    // and swaps them in only once the new pair is complete, so a failed resize
    // keeps the old target usable. The property that matters here is that the
    // superseded objects are released rather than accumulating per resize.
    expect(gl._created.framebuffers).toBeGreaterThan(createdAfterFirst)
    expect(gl._deleted.framebuffers).toBe(gl._created.framebuffers - createdAfterFirst)
    expect(gl._deleted.textures).toBe(gl._created.textures - createdAfterFirst)
  })

  it('does not accumulate GL objects across many resizes', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    for (let i = 0; i < 30; i++) {
      targets.ensure(plan('high'), { width: 800 + i * 8, height: 600 })
    }
    targets.dispose()
    // Every object ever created is accounted for after disposal.
    expect(gl._deleted.framebuffers).toBe(gl._created.framebuffers)
    expect(gl._deleted.textures).toBe(gl._created.textures)
  })

  it('does not rebuild targets when the tier keeps the same layout', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 800, height: 600 })
    const before = gl._deleted.framebuffers

    // High and Ultra share bloom shape and persistence scale, so a change
    // between them must not flash or cost an allocation.
    expect(targets.ensure(plan('ultra'), { width: 800, height: 600 })).toBe(false)
    expect(gl._deleted.framebuffers).toBe(before)
  })

  it('rebuilds when the bloom level count changes', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 800, height: 600 })
    expect(targets.getDiagnostics().bloomLevelCount).toBe(3)

    expect(targets.ensure(plan('low'), { width: 800, height: 600 })).toBe(true)
    expect(targets.getDiagnostics().bloomLevelCount).toBe(1)
  })

  it('rebuilds when the HDR format changes', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high', HDR), { width: 800, height: 600 })
    const before = gl._deleted.framebuffers
    // A context restore can land on a device without float targets.
    expect(targets.ensure(plan('high', LDR), { width: 800, height: 600 })).toBe(true)
    expect(gl._deleted.framebuffers).toBeGreaterThan(before)
  })

  it('scales persistence and bloom targets below full resolution per the plan', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    const low = plan('low')
    targets.ensure(low, { width: 1000, height: 800 })

    // Low halves persistence; the sole bloom level runs at full scale.
    expect(low.persistenceResolutionScale).toBe(0.5)
    expect(targets.persistenceBuffer!.width).toBe(500)
    expect(targets.persistenceBuffer!.height).toBe(400)
  })
})

describe('feedback-loop safety', () => {
  it('rejects sampling the texture currently attached as the write target', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 256, height: 256 })

    const writeTexture = targets.persistenceBuffer!.writeTexture
    expect(writeTexture).not.toBeNull()
    // Undefined behaviour in WebGL, and silent — so it must fail loudly here.
    expect(() => targets.assertNotSampling(writeTexture, 'persistence pass'))
      .toThrow(/write target/)
  })

  it('allows sampling the read texture, which is the whole point of ping-pong', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 256, height: 256 })

    const readTexture = targets.persistenceBuffer!.readTexture
    expect(() => targets.assertNotSampling(readTexture, 'persistence pass')).not.toThrow()
  })

  it('follows the swap, so what was safe last frame is rejected this frame', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 256, height: 256 })
    const buffer = targets.persistenceBuffer!

    const previouslySafe = buffer.readTexture
    buffer.swap()
    // After the swap the old read texture is the new write target.
    expect(() => targets.assertNotSampling(previouslySafe, 'persistence pass')).toThrow()
  })

  it('ignores a null texture and an unrelated texture', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 256, height: 256 })
    const unrelated = {} as WebGLTexture
    expect(() => targets.assertNotSampling(null, 'x')).not.toThrow()
    expect(() => targets.assertNotSampling(unrelated, 'x')).not.toThrow()
  })
})

describe('lifecycle', () => {
  it('releases every created GL object on dispose', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('ultra'), { width: 800, height: 600 })
    targets.dispose()

    expect(gl._deleted.framebuffers).toBe(gl._created.framebuffers)
    expect(gl._deleted.textures).toBe(gl._created.textures)
    expect(targets.getDiagnostics().disposed).toBe(true)
  })

  it('is idempotent, since owners may dispose more than once', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 800, height: 600 })
    targets.dispose()
    const deletedAfterFirst = gl._deleted.framebuffers
    expect(() => targets.dispose()).not.toThrow()
    expect(gl._deleted.framebuffers).toBe(deletedAfterFirst)
  })

  it('allocates nothing after disposal', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.dispose()
    expect(targets.ensure(plan('high'), { width: 800, height: 600 })).toBe(false)
    expect(targets.getDiagnostics().hasScene).toBe(false)
  })

  it('can rebuild after a context-loss release, which is the restore path', () => {
    const gl = makeMockGL()
    const targets = new ScopePhosphorTargets(gl)
    targets.ensure(plan('high'), { width: 800, height: 600 })

    targets.releaseTargets()
    expect(targets.getDiagnostics().hasScene).toBe(false)

    // Not disposed — the owner outlives the lost context and reallocates.
    expect(targets.ensure(plan('high'), { width: 800, height: 600 })).toBe(true)
    expect(targets.getDiagnostics().hasScene).toBe(true)
  })
})
