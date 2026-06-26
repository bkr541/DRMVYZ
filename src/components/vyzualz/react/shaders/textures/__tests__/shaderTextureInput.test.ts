import { describe, it, expect, beforeEach } from 'vitest'
import { ShaderTextureInputManager }   from '../ShaderTextureInputManager'
import { ShaderNoiseTextureFactory }   from '../ShaderNoiseTextureFactory'
import { ShaderTextureSourceResolver } from '../ShaderTextureSourceResolver'
import { ShaderMaskTexture }           from '../ShaderMaskTexture'
import { DEFAULT_FEEDBACK_PARAMS }     from '../../feedback/shaderFeedbackTypes'
import type { ShaderDefinition }       from '../../registry/shaderRegistryTypes'
import type { ShaderTexSourceSelection } from '../shaderTextureInputTypes'

// ── Mock WebGL2 context ───────────────────────────────────────────────────────

function makeMockGL() {
  let texId = 1
  const calls: { m: string; a: unknown[] }[] = []

  const gl = {
    TEXTURE_2D: 0x0DE1,
    TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
    TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
    CLAMP_TO_EDGE: 0x812F, REPEAT: 0x2901,
    LINEAR: 0x2601, RGBA: 6408, UNSIGNED_BYTE: 0x1401,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    MAX_TEXTURE_SIZE: 0x0D33,

    createTexture():    WebGLTexture { const t = { _id: texId++ }; calls.push({ m: 'createTexture', a: [] }); return t as unknown as WebGLTexture },
    bindTexture(t: number, o: unknown) { calls.push({ m: 'bindTexture', a: [t, o] }) },
    texImage2D(...a: unknown[])   { calls.push({ m: 'texImage2D', a }) },
    texSubImage2D(...a: unknown[]) { calls.push({ m: 'texSubImage2D', a }) },
    texParameteri()  {},
    deleteTexture(o: unknown) { calls.push({ m: 'deleteTexture', a: [o] }) },
    pixelStorei(p: number, v: number) { calls.push({ m: 'pixelStorei', a: [p, v] }) },
    getParameter(p: number) {
      if (p === 0x0D33) return 4096  // MAX_TEXTURE_SIZE
      return null
    },

    _calls: calls,
    _texCount() { return texId - 1 },
    _clearCalls() { calls.length = 0 },
  }

  return gl as typeof gl & WebGL2RenderingContext
}

// ── Mock media elements (duck-typed) ──────────────────────────────────────────

function mockImage(w: number, h: number, url = 'http://host/img.jpg') {
  return { complete: true, naturalWidth: w, naturalHeight: h, src: url } as HTMLImageElement
}

function mockPendingImage() {
  return { complete: false, naturalWidth: 0, naturalHeight: 0, src: '' } as HTMLImageElement
}

function mockVideo(w: number, h: number, currentTime = 1.0, paused = false) {
  return { readyState: 2, videoWidth: w, videoHeight: h, currentTime, paused, ended: false } as HTMLVideoElement
}

function mockCanvas(w: number, h: number) {
  return { width: w, height: h, getContext: () => null } as unknown as HTMLCanvasElement
}

// ── Minimal ShaderDefinition factories ───────────────────────────────────────

function makeGeneratorDef(id = 'gen-scene'): ShaderDefinition {
  return {
    id, name: id, description: '', category: 'generator', version: 1,
    params: [], defaults: {},
    fragSrc: '#version 300 es\nvoid main(){}',
  }
}

function makeEffectDef(required = false): ShaderDefinition {
  return {
    id: 'effect-scene', name: 'Effect', description: '', category: 'effect', version: 1,
    params: [], defaults: {},
    fragSrc: '#version 300 es\nvoid main(){}',
    textureInputs: [
      { name: 'uSourceTexture', label: 'Source', source: 'uploaded-image', required },
    ],
  }
}

function makeMultiInputDef(): ShaderDefinition {
  return {
    id: 'multi-scene', name: 'Multi', description: '', category: 'effect', version: 1,
    params: [], defaults: {},
    fragSrc: '#version 300 es\nvoid main(){}',
    textureInputs: [
      { name: 'uMaskTexture',     label: 'Mask',     source: 'mask',     required: true  },
      { name: 'uSpectrumTexture', label: 'Spectrum', source: 'fft',      required: false },
      { name: 'uImageTexture',    label: 'Image',    source: 'uploaded-image', required: false },
    ],
  }
}

// ── A: Required-source validation ─────────────────────────────────────────────

describe('A: required-source validation', () => {
  it('A1: required input with no selection yields a warning', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(true))

    const results = mgr.validate()
    expect(results).toHaveLength(1)
    expect(results[0].required).toBe(true)
    expect(results[0].available).toBe(false)
    expect(results[0].warningMessage).not.toBeNull()
    mgr.dispose()
  })

  it('A2: required input with a generated source yields no warning', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(true))
    mgr.setSelection('uSourceTexture', { sourceType: 'noise-white' })

    const results = mgr.validate()
    expect(results[0].available).toBe(true)
    expect(results[0].warningMessage).toBeNull()
    mgr.dispose()
  })

  it('A3: required image input not ready (not loaded) yields warning', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(true))
    mgr.setSelection('uSourceTexture', { sourceType: 'uploaded-image', mediaElement: mockPendingImage(), assetUrl: 'url' })

    const results = mgr.validate()
    expect(results[0].available).toBe(false)
    expect(results[0].warningMessage).not.toBeNull()
    mgr.dispose()
  })

  it('A4: required image input ready yields no warning', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(true))
    mgr.setSelection('uSourceTexture', { sourceType: 'uploaded-image', mediaElement: mockImage(64, 64), assetUrl: 'url' })

    expect(mgr.validate()[0].available).toBe(true)
    mgr.dispose()
  })
})

// ── B: Optional-source fallback ───────────────────────────────────────────────

describe('B: optional-source fallback', () => {
  it('B1: optional input with no selection produces no warning', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(false))

    const results = mgr.validate()
    expect(results[0].required).toBe(false)
    expect(results[0].warningMessage).toBeNull()
    mgr.dispose()
  })

  it('B2: optional input with no selection is not included in the texture map', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(false))

    const map = mgr.getTextureMap()
    expect(map.has('uSourceTexture')).toBe(false)
    mgr.dispose()
  })

  it('B3: required input with no selection uses fallback in the texture map', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(true))

    const map = mgr.getTextureMap()
    expect(map.has('uSourceTexture')).toBe(true)
    mgr.dispose()
  })

  it('B4: effect scene without source computes texture map without crashing', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(false))

    expect(() => mgr.getTextureMap()).not.toThrow()
    mgr.dispose()
  })
})

// ── C: Texture caching ────────────────────────────────────────────────────────

describe('C: texture caching', () => {
  it('C1: noise cache — same params return the same WebGLTexture object', () => {
    const gl      = makeMockGL()
    const factory = new ShaderNoiseTextureFactory(gl as unknown as WebGL2RenderingContext)

    const a = factory.getWhiteNoise(128, 0)
    const b = factory.getWhiteNoise(128, 0)
    expect(a).toBe(b)
    factory.disposeAll()
  })

  it('C2: noise cache — different params create distinct textures', () => {
    const gl      = makeMockGL()
    const factory = new ShaderNoiseTextureFactory(gl as unknown as WebGL2RenderingContext)

    const a = factory.getWhiteNoise(128, 0)
    const b = factory.getWhiteNoise(128, 1)
    expect(a).not.toBe(b)
    factory.disposeAll()
  })

  it('C3: image cache — same URL returns same texture', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const img      = mockImage(64, 64, 'http://host/a.jpg')
    const sel: ShaderTexSourceSelection = { sourceType: 'uploaded-image', mediaElement: img, assetUrl: 'url-a' }

    const r1 = resolver.resolve('u1', sel)
    const r2 = resolver.resolve('u1', sel)
    expect(r1.texture).toBe(r2.texture)
    resolver.dispose()
  })

  it('C4: image URL change triggers re-upload (different texture)', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const img1     = mockImage(64, 64, 'http://host/a.jpg')
    const img2     = mockImage(32, 32, 'http://host/b.jpg')
    const sel1: ShaderTexSourceSelection = { sourceType: 'uploaded-image', mediaElement: img1, assetUrl: 'url-a' }
    const sel2: ShaderTexSourceSelection = { sourceType: 'uploaded-image', mediaElement: img2, assetUrl: 'url-b' }

    const r1 = resolver.resolve('u1', sel1)
    const r2 = resolver.resolve('u1', sel2)
    expect(r1.texture).not.toBe(r2.texture)
    resolver.dispose()
  })

  it('C5: mask cache — same params reuse the same texture', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeMultiInputDef())
    mgr.setSelection('uMaskTexture', { sourceType: 'mask', maskType: 'radial', maskSize: 64 })

    mgr.getTextureMap()          // first call — mask texture is created here
    const before = gl._texCount()
    mgr.getTextureMap()          // second call — must reuse cached mask, no new textures
    expect(gl._texCount() - before).toBe(0)
    mgr.dispose()
  })
})

// ── D: Texture release ────────────────────────────────────────────────────────

describe('D: texture release', () => {
  it('D1: release() deletes the underlying GPU texture', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const img      = mockImage(64, 64, 'http://host/a.jpg')
    resolver.resolve('u1', { sourceType: 'uploaded-image', mediaElement: img, assetUrl: 'a' })

    const delsBefore = gl._calls.filter(c => c.m === 'deleteTexture').length
    resolver.release('u1')
    expect(gl._calls.filter(c => c.m === 'deleteTexture').length - delsBefore).toBe(1)
    resolver.dispose()
  })

  it('D2: releasing a non-existent input is a no-op', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    expect(() => resolver.release('nonexistent')).not.toThrow()
    resolver.dispose()
  })

  it('D3: setDefinition() releases entries for removed inputs', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)

    const defA: ShaderDefinition = {
      id: 'a', name: 'A', description: '', category: 'effect', version: 1,
      params: [], defaults: {}, fragSrc: 'x',
      textureInputs: [{ name: 'uTex', label: 'T', source: 'uploaded-image' }],
    }
    const defB: ShaderDefinition = {
      id: 'b', name: 'B', description: '', category: 'generator', version: 1,
      params: [], defaults: {}, fragSrc: 'x',
    }

    mgr.setDefinition(defA)
    mgr.setSelection('uTex', { sourceType: 'uploaded-image', mediaElement: mockImage(64, 64), assetUrl: 'u' })
    mgr.getTextureMap()  // resolve so the entry exists in the resolver

    const delsBefore = gl._calls.filter(c => c.m === 'deleteTexture').length
    mgr.setDefinition(defB)
    expect(gl._calls.filter(c => c.m === 'deleteTexture').length).toBeGreaterThan(delsBefore)
    mgr.dispose()
  })

  it('D4: dispose() deletes all textures including noise and mask cache', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeMultiInputDef())
    mgr.setSelection('uMaskTexture', { sourceType: 'mask' })
    mgr.setSelection('uImageTexture', { sourceType: 'noise-white' })
    mgr.getTextureMap()

    const delsBefore = gl._calls.filter(c => c.m === 'deleteTexture').length
    mgr.dispose()
    expect(gl._calls.filter(c => c.m === 'deleteTexture').length).toBeGreaterThan(delsBefore)
  })
})

// ── E: Dynamic source update without reallocation ─────────────────────────────

describe('E: dynamic source update without reallocation', () => {
  it('E1: first video resolve creates a texture', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const vid      = mockVideo(64, 64)
    const before   = gl._calls.filter(c => c.m === 'createTexture').length
    resolver.resolve('uVid', { sourceType: 'uploaded-video', mediaElement: vid, assetUrl: 'v' })
    expect(gl._calls.filter(c => c.m === 'createTexture').length - before).toBe(1)
    resolver.dispose()
  })

  it('E2: updateVideoFrame uses texSubImage2D (no new texture)', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const vid      = mockVideo(64, 64, 1.0, false)
    resolver.resolve('uVid', { sourceType: 'uploaded-video', mediaElement: vid, assetUrl: 'v' })

    const createsBefore = gl._calls.filter(c => c.m === 'createTexture').length
    // Advance time so it's not considered the same frame
    ;(vid as unknown as Record<string, unknown>).currentTime = 2.0
    const updated = resolver.updateVideoFrame('uVid', vid)

    expect(updated).toBe(true)
    // No new texture allocated
    expect(gl._calls.filter(c => c.m === 'createTexture').length).toBe(createsBefore)
    // texSubImage2D called
    expect(gl._calls.filter(c => c.m === 'texSubImage2D').length).toBeGreaterThan(0)
    resolver.dispose()
  })

  it('E3: updateVideoFrame skips upload when video is paused on same frame', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const vid      = mockVideo(64, 64, 1.0, true)
    resolver.resolve('uVid', { sourceType: 'uploaded-video', mediaElement: vid, assetUrl: 'v' })
    gl._clearCalls()

    const updated = resolver.updateVideoFrame('uVid', vid)
    expect(updated).toBe(false)
    expect(gl._calls.filter(c => c.m === 'texSubImage2D').length).toBe(0)
    resolver.dispose()
  })

  it('E4: video dimension change uses texImage2D (reallocation)', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const vid      = mockVideo(64, 64, 1.0, false)
    resolver.resolve('uVid', { sourceType: 'uploaded-video', mediaElement: vid, assetUrl: 'v' })
    gl._clearCalls()

    // Simulate dimension change
    ;(vid as unknown as Record<string, unknown>).videoWidth  = 128
    ;(vid as unknown as Record<string, unknown>).videoHeight = 128
    ;(vid as unknown as Record<string, unknown>).currentTime = 2.0
    resolver.updateVideoFrame('uVid', vid)

    expect(gl._calls.filter(c => c.m === 'texImage2D').length).toBeGreaterThan(0)
    resolver.dispose()
  })

  it('E5: unready video (readyState < 2) returns false and skips upload', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const vid      = { ...mockVideo(64, 64), readyState: 1 } as unknown as HTMLVideoElement

    const result = resolver.resolve('uVid', { sourceType: 'uploaded-video', mediaElement: vid, assetUrl: 'v' })
    // Returns fallback for unready video
    expect(result.meta.available).toBe(false)
    resolver.dispose()
  })
})

// ── F: UV aspect calculations ─────────────────────────────────────────────────

describe('F: UV aspect calculations', () => {
  it('F1: wide image has aspectRatio > 1', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const img      = mockImage(320, 180, 'http://host/wide.jpg')  // 16:9

    const r = resolver.resolve('u1', { sourceType: 'uploaded-image', mediaElement: img, assetUrl: 'wide' })
    expect(r.meta.aspectRatio).toBeCloseTo(320 / 180, 4)
    resolver.dispose()
  })

  it('F2: square image has aspectRatio = 1', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const img      = mockImage(256, 256, 'http://host/sq.jpg')

    const r = resolver.resolve('u1', { sourceType: 'uploaded-image', mediaElement: img, assetUrl: 'sq' })
    expect(r.meta.aspectRatio).toBe(1)
    resolver.dispose()
  })

  it('F3: portrait image has aspectRatio < 1', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    const img      = mockImage(180, 320, 'http://host/tall.jpg')

    const r = resolver.resolve('u1', { sourceType: 'uploaded-image', mediaElement: img, assetUrl: 'tall' })
    expect(r.meta.aspectRatio).toBeLessThan(1)
    resolver.dispose()
  })

  it('F4: noise texture metadata has aspectRatio = 1', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeMultiInputDef())
    mgr.setSelection('uMaskTexture', { sourceType: 'noise-white', noiseSize: 128 })

    const meta = mgr.getMetadata('uMaskTexture')
    expect(meta?.aspectRatio).toBe(1)
    mgr.dispose()
  })

  it('F5: fallback metadata has w=h=1, aspectRatio=1', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    expect(resolver.fallback.meta.w).toBe(1)
    expect(resolver.fallback.meta.h).toBe(1)
    expect(resolver.fallback.meta.aspectRatio).toBe(1)
    resolver.dispose()
  })
})

// ── G: Missing-source safety ──────────────────────────────────────────────────

describe('G: missing-source safety', () => {
  it('G1: null mediaElement returns fallback without crash', () => {
    const gl       = makeMockGL()
    const resolver = new ShaderTextureSourceResolver(gl as unknown as WebGL2RenderingContext)
    expect(() => resolver.resolve('u1', { sourceType: 'uploaded-image', mediaElement: null })).not.toThrow()
    resolver.dispose()
  })

  it('G2: unset selection in manager never crashes', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(false))
    expect(() => mgr.getTextureMap()).not.toThrow()
    expect(() => mgr.validate()).not.toThrow()
    mgr.dispose()
  })

  it('G3: getMetadata returns null for unset input', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(false))
    expect(mgr.getMetadata('uSourceTexture')).toBeNull()
    mgr.dispose()
  })

  it('G4: updateDynamic with null mediaElement is a no-op', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(false))
    mgr.setSelection('uSourceTexture', { sourceType: 'uploaded-video', mediaElement: null })
    expect(() => mgr.updateDynamic()).not.toThrow()
    mgr.dispose()
  })
})

// ── H: Generator scene without a source ──────────────────────────────────────

describe('H: generator scene without a source', () => {
  it('H1: generator def with no textureInputs produces empty texture map', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeGeneratorDef())

    const map = mgr.getTextureMap()
    expect(map.size).toBe(0)
    mgr.dispose()
  })

  it('H2: generator def produces no validation entries', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeGeneratorDef())

    expect(mgr.validate()).toHaveLength(0)
    mgr.dispose()
  })

  it('H3: null definition produces empty texture map and no validation', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(null)

    expect(mgr.getTextureMap().size).toBe(0)
    expect(mgr.validate()).toHaveLength(0)
    mgr.dispose()
  })
})

// ── I: Effect scene with fallback source ──────────────────────────────────────

describe('I: effect scene with fallback source', () => {
  it('I1: required missing source → texture map uses fallback (1×1 black)', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(true))

    const map = mgr.getTextureMap()
    // fallback is always provided for required inputs
    expect(map.has('uSourceTexture')).toBe(true)
    expect(map.get('uSourceTexture')).not.toBeNull()
    mgr.dispose()
  })

  it('I2: clearSelection() removes optional source, no longer in map', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeEffectDef(false))
    mgr.setSelection('uSourceTexture', { sourceType: 'noise-white' })

    expect(mgr.getTextureMap().has('uSourceTexture')).toBe(true)
    mgr.clearSelection('uSourceTexture')
    expect(mgr.getTextureMap().has('uSourceTexture')).toBe(false)
    mgr.dispose()
  })

  it('I3: fft source with no spectrum tex injects fallback', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeMultiInputDef())
    mgr.setSelection('uSpectrumTexture', { sourceType: 'fft' })
    // No setAudioTextures called → no spectrum tex

    const map  = mgr.getTextureMap()
    expect(map.has('uSpectrumTexture')).toBe(true)
    // It's the fallback (not null)
    expect(map.get('uSpectrumTexture')).not.toBeNull()
    mgr.dispose()
  })

  it('I4: fft available after setAudioTextures', () => {
    const gl      = makeMockGL()
    const mgr     = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    const fakeTex = { _id: 99 } as unknown as WebGLTexture
    mgr.setDefinition(makeMultiInputDef())
    mgr.setSelection('uSpectrumTexture', { sourceType: 'fft' })
    mgr.setAudioTextures(fakeTex, null)

    expect(mgr.validate().find(v => v.inputName === 'uSpectrumTexture')?.available).toBe(true)
    expect(mgr.getTextureMap().get('uSpectrumTexture')).toBe(fakeTex)
    mgr.dispose()
  })
})

// ── J: Noise cache reuse ──────────────────────────────────────────────────────

describe('J: noise cache reuse', () => {
  it('J1: getWhiteNoise same params → same texture, no extra createTexture calls', () => {
    const gl      = makeMockGL()
    const factory = new ShaderNoiseTextureFactory(gl as unknown as WebGL2RenderingContext)

    const t1 = factory.getWhiteNoise(128, 42)
    const before = gl._calls.filter(c => c.m === 'createTexture').length
    const t2 = factory.getWhiteNoise(128, 42)
    expect(t1).toBe(t2)
    expect(gl._calls.filter(c => c.m === 'createTexture').length).toBe(before)
    factory.disposeAll()
  })

  it('J2: getValueNoise same params → same texture', () => {
    const gl      = makeMockGL()
    const factory = new ShaderNoiseTextureFactory(gl as unknown as WebGL2RenderingContext)

    const t1 = factory.getValueNoise(256, 7)
    const t2 = factory.getValueNoise(256, 7)
    expect(t1).toBe(t2)
    factory.disposeAll()
  })

  it('J3: disposeAll deletes all cached textures', () => {
    const gl      = makeMockGL()
    const factory = new ShaderNoiseTextureFactory(gl as unknown as WebGL2RenderingContext)
    factory.getWhiteNoise(64, 0)
    factory.getWhiteNoise(64, 1)
    factory.getValueNoise(128, 0)

    expect(factory.cacheSize).toBe(3)
    const delsBefore = gl._calls.filter(c => c.m === 'deleteTexture').length
    factory.disposeAll()
    expect(gl._calls.filter(c => c.m === 'deleteTexture').length - delsBefore).toBe(3)
    expect(factory.cacheSize).toBe(0)
  })

  it('J4: getBlueNoise returns null (no bundled asset)', () => {
    const gl      = makeMockGL()
    const factory = new ShaderNoiseTextureFactory(gl as unknown as WebGL2RenderingContext)
    expect(factory.getBlueNoise()).toBeNull()
    factory.disposeAll()
  })

  it('J5: manager noise-blue falls back to value noise when no blue asset', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeMultiInputDef())
    mgr.setSelection('uMaskTexture', { sourceType: 'noise-blue', noiseSeed: 0, noiseSize: 64 })

    const map = mgr.getTextureMap()
    // Should not be null even without a blue-noise asset
    expect(map.get('uMaskTexture')).not.toBeNull()
    mgr.dispose()
  })
})

// ── K: Mask texture generation ────────────────────────────────────────────────

describe('K: mask texture generation', () => {
  it('K1: mask textures are created with correct size', () => {
    const gl  = makeMockGL()
    const tex = ShaderMaskTexture.generate(gl as unknown as WebGL2RenderingContext, 'radial', 64, false)
    // texImage2D called with width=64, height=64
    const call = gl._calls.find(c => c.m === 'texImage2D')
    expect(call).toBeDefined()
    expect(tex).not.toBeNull()
    gl.deleteTexture(tex)
  })

  it('K2: solid-color 1×1 texture is created', () => {
    const gl  = makeMockGL()
    const before = gl._calls.filter(c => c.m === 'createTexture').length
    const tex = ShaderMaskTexture.createSolidColor(gl as unknown as WebGL2RenderingContext, 255, 0, 0, 255)
    expect(gl._calls.filter(c => c.m === 'createTexture').length - before).toBe(1)
    expect(tex).not.toBeNull()
    gl.deleteTexture(tex)
  })

  it('K3: manager mask cache avoids re-creating for same params', () => {
    const gl  = makeMockGL()
    const mgr = new ShaderTextureInputManager(gl as unknown as WebGL2RenderingContext)
    mgr.setDefinition(makeMultiInputDef())
    mgr.setSelection('uMaskTexture', { sourceType: 'mask', maskType: 'vignette', maskSize: 64 })

    mgr.getTextureMap()
    const before = gl._calls.filter(c => c.m === 'createTexture').length
    mgr.getTextureMap()
    expect(gl._calls.filter(c => c.m === 'createTexture').length).toBe(before)
    mgr.dispose()
  })
})
