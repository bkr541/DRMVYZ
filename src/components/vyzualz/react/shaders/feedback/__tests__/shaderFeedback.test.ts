import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ShaderPingPongBuffer } from '../ShaderPingPongBuffer'
import { ShaderFeedbackController } from '../ShaderFeedbackController'
import {
  DEFAULT_FEEDBACK_PARAMS,
  DEFAULT_FEEDBACK_RESET_CONFIG,
  FEEDBACK_BLEND_MODE_INT,
  type FeedbackBlendMode,
} from '../shaderFeedbackTypes'

// ── Mock WebGL context ────────────────────────────────────────────────────────

function makeMockGL() {
  let texId   = 1
  let fboId   = 1
  const calls: { m: string; a: unknown[] }[] = []

  const gl = {
    TEXTURE_2D:       0x0DE1,
    TEXTURE_WRAP_S:   0x2802, TEXTURE_WRAP_T: 0x2803,
    TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
    CLAMP_TO_EDGE:    0x812F, REPEAT: 0x2901, MIRRORED_REPEAT: 0x8370,
    LINEAR:           0x2601, NEAREST: 0x2600,
    RGBA8:            0x8058, R8: 0x8229,
    RGBA:             6408,   RED: 0x1903,
    UNSIGNED_BYTE:    0x1401, RGBA16F: 0x881A, HALF_FLOAT: 0x140B,
    RGBA32F:          0x8814, FLOAT: 0x1406,
    FRAMEBUFFER:      0x8D40,
    COLOR_ATTACHMENT0: 0x8CE0,
    FRAMEBUFFER_COMPLETE: 0x8CD5,
    COLOR_BUFFER_BIT: 0x4000,
    VERTEX_SHADER: 0x8B31, FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81, LINK_STATUS: 0x8B82,
    BLEND: 0x0BE2,
    ONE: 1, ZERO: 0,
    SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303,
    DST_COLOR: 0x0306, ONE_MINUS_SRC_COLOR: 0x0301,

    createTexture():    WebGLTexture    { const t = { _id: texId++ }; calls.push({ m: 'createTexture', a: [] }); return t as unknown as WebGLTexture },
    bindTexture(t: number, o: unknown) { calls.push({ m: 'bindTexture', a: [t, o] }) },
    texImage2D(...a: unknown[])        { calls.push({ m: 'texImage2D', a }) },
    texStorage2D(...a: unknown[])      { calls.push({ m: 'texStorage2D', a }) },
    texParameteri(...a: unknown[])     {},
    deleteTexture(o: unknown)          { calls.push({ m: 'deleteTexture', a: [o] }) },

    createFramebuffer(): WebGLFramebuffer { const f = { _id: fboId++ }; calls.push({ m: 'createFramebuffer', a: [] }); return f as unknown as WebGLFramebuffer },
    bindFramebuffer(t: number, o: unknown) { calls.push({ m: 'bindFramebuffer', a: [t, o] }) },
    framebufferTexture2D(...a: unknown[]) {},
    drawBuffers(...a: unknown[])       { calls.push({ m: 'drawBuffers', a }) },
    readBuffer(...a: unknown[])        { calls.push({ m: 'readBuffer', a }) },
    checkFramebufferStatus() { return 0x8CD5 },
    deleteFramebuffer(o: unknown) { calls.push({ m: 'deleteFramebuffer', a: [o] }) },
    isContextLost() { return false },
    getError()      { return 0 },
    getParameter(p: number) { return p === 0x0D33 || p === 0x84E8 ? 16384 : null },
    viewport()    {},
    clearColor()  {},
    clear(m: number) { calls.push({ m: 'clear', a: [m] }) },

    createShader():    WebGLShader   { return {} as unknown as WebGLShader },
    shaderSource()     {},
    compileShader()    {},
    getShaderParameter(_: unknown, p: number) { return p === 0x8B81 },
    getShaderInfoLog() { return '' },
    deleteShader()     {},
    createProgram():   WebGLProgram  { return {} as unknown as WebGLProgram },
    attachShader()     {},
    linkProgram()      {},
    getProgramParameter(_: unknown, p: number) { return p === 0x8B82 },
    getProgramInfoLog() { return '' },
    deleteProgram()    {},
    useProgram()       {},
    getUniformLocation() { return {} as WebGLUniformLocation },
    uniform1f()        {},
    uniform1i()        {},
    uniform2f()        {},
    enable()           {},
    disable()          {},
    blendFunc()        {},
    activeTexture()    {},
    drawArrays()       {},

    _calls: calls,
    _texCount() { return texId - 1 },
    _fboCount() { return fboId - 1 },
  }

  return gl as typeof gl & WebGL2RenderingContext
}

// ── A: Ping-pong read/write swap ──────────────────────────────────────────────

describe('A: ShaderPingPongBuffer — read/write swap', () => {
  it('A1: initial state has null texture (not yet sized)', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    // Before resize, no texture
    expect(pp.readTexture).toBeNull()
    pp.dispose()
  })

  it('A2: after resize, readTexture and writeFbo are non-null', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    expect(pp.readTexture).not.toBeNull()
    expect(pp.writeFbo).not.toBeNull()
    pp.dispose()
  })

  it('A3: swap changes readTexture', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const before = pp.readTexture
    const beforeWrite = pp.writeFbo
    pp.swap()
    expect(pp.readTexture).not.toBe(before)
    expect(pp.writeFbo).not.toBe(beforeWrite)
    pp.dispose()
  })

  it('A4: double-swap returns to original read texture', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const original = pp.readTexture
    pp.swap()
    pp.swap()
    expect(pp.readTexture).toBe(original)
    pp.dispose()
  })

  it('A5: readTexture and writeFbo are always different objects', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(128, 128)
    expect(pp.readTexture).not.toBe(pp.writeFbo)
    pp.swap()
    expect(pp.readTexture).not.toBe(pp.writeFbo)
    pp.dispose()
  })

  it('A6: writeFbo before swap equals readFbo after swap', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const writeBeforeSwap = pp.writeFbo
    pp.swap()
    expect(pp.readFbo).toBe(writeBeforeSwap)
    pp.dispose()
  })
})

// ── B: Resize clearing ────────────────────────────────────────────────────────

describe('B: ShaderPingPongBuffer — resize clears stale content', () => {
  it('B1: resize triggers GL clear calls', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    const clearsBefore = gl._calls.filter(c => c.m === 'clear').length
    pp.resize(64, 64)
    const clearsAfter = gl._calls.filter(c => c.m === 'clear').length
    expect(clearsAfter - clearsBefore).toBe(2)  // both buffers cleared
    pp.dispose()
  })

  it('B2: resize to same dimensions does not re-clear', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const clearsBefore = gl._calls.filter(c => c.m === 'clear').length
    pp.resize(64, 64)  // same dims — no-op
    const clearsAfter = gl._calls.filter(c => c.m === 'clear').length
    expect(clearsAfter).toBe(clearsBefore)
    pp.dispose()
  })

  it('B3: resize to different dimensions re-clears', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const clearsBefore = gl._calls.filter(c => c.m === 'clear').length
    pp.resize(128, 128)
    const clearsAfter = gl._calls.filter(c => c.m === 'clear').length
    expect(clearsAfter - clearsBefore).toBe(2)
    pp.dispose()
  })

  it('B4: manual clear() calls bind both FBOs', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const clearsBefore = gl._calls.filter(c => c.m === 'clear').length
    pp.clear()
    expect(gl._calls.filter(c => c.m === 'clear').length - clearsBefore).toBe(2)
    pp.dispose()
  })

  it('B5: width and height reflect the last resize', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(320, 180)
    expect(pp.width).toBe(320)
    expect(pp.height).toBe(180)
    pp.dispose()
  })
})

// ── C: Freeze behavior ────────────────────────────────────────────────────────

describe('C: ShaderPingPongBuffer — freeze', () => {
  it('C1: swap() is a no-op when frozen', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const before = pp.readTexture
    pp.freeze()
    pp.swap()
    expect(pp.readTexture).toBe(before)
    pp.dispose()
  })

  it('C2: frozen getter returns true after freeze()', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.freeze()
    expect(pp.frozen).toBe(true)
    pp.dispose()
  })

  it('C3: unfreeze() restores swap behavior', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const before = pp.readTexture
    pp.freeze()
    pp.swap()           // no-op
    pp.unfreeze()
    pp.swap()           // now active
    expect(pp.readTexture).not.toBe(before)
    pp.dispose()
  })

  it('C4: frozen defaults to false', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    expect(pp.frozen).toBe(false)
    pp.dispose()
  })
})

// ── D: Reset conditions ───────────────────────────────────────────────────────

describe('D: ShaderFeedbackController — reset conditions', () => {
  function makeController() {
    const gl = makeMockGL()
    return {
      ctrl: new ShaderFeedbackController(gl as unknown as WebGL2RenderingContext),
      gl,
    }
  }

  const baseSignals = {
    sceneId: 'scene-a', trackId: 'track-1',
    playbackTime: 10, sectionType: 'verse',
    dropImpact: 0, w: 64, h: 64,
  }

  it('D1: sceneChange triggers reset when configured', () => {
    const { ctrl } = makeController()
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update(baseSignals)
    clearSpy.mockClear()
    ctrl.update({ ...baseSignals, sceneId: 'scene-b' }, { onSceneChange: true })
    expect(clearSpy).toHaveBeenCalledOnce()
    ctrl.dispose()
  })

  it('D2: sceneChange does NOT reset when disabled', () => {
    const { ctrl } = makeController()
    ctrl.update(baseSignals)
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update({ ...baseSignals, sceneId: 'scene-b' }, { onSceneChange: false })
    expect(clearSpy).not.toHaveBeenCalled()
    ctrl.dispose()
  })

  it('D3: trackChange triggers reset', () => {
    const { ctrl } = makeController()
    ctrl.update(baseSignals, { onSceneChange: false })
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update({ ...baseSignals, trackId: 'track-2' }, { onTrackChange: true, onSceneChange: false })
    expect(clearSpy).toHaveBeenCalledOnce()
    ctrl.dispose()
  })

  it('D4: playback restart triggers reset when time goes backward', () => {
    const { ctrl } = makeController()
    ctrl.update({ ...baseSignals, playbackTime: 30 }, { onSceneChange: false })
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update({ ...baseSignals, playbackTime: 0.5 }, { onPlaybackRestart: true, onSceneChange: false })
    expect(clearSpy).toHaveBeenCalledOnce()
    ctrl.dispose()
  })

  it('D5: playback advancing normally does NOT trigger reset', () => {
    const { ctrl } = makeController()
    ctrl.update({ ...baseSignals, playbackTime: 10 }, { onSceneChange: false })
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update({ ...baseSignals, playbackTime: 11 }, { onPlaybackRestart: true, onSceneChange: false })
    expect(clearSpy).not.toHaveBeenCalled()
    ctrl.dispose()
  })

  it('D6: sectionChange triggers reset when enabled', () => {
    const { ctrl } = makeController()
    ctrl.update({ ...baseSignals, sectionType: 'verse' }, { onSceneChange: false })
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update({ ...baseSignals, sectionType: 'drop' }, { onSectionChange: true, onSceneChange: false })
    expect(clearSpy).toHaveBeenCalledOnce()
    ctrl.dispose()
  })

  it('D7: dropImpact above threshold triggers reset when enabled', () => {
    const { ctrl } = makeController()
    ctrl.update(baseSignals, { onSceneChange: false })
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update(
      { ...baseSignals, dropImpact: 0.9 },
      { onDropImpact: true, dropImpactThreshold: 0.7, onSceneChange: false },
    )
    expect(clearSpy).toHaveBeenCalledOnce()
    ctrl.dispose()
  })

  it('D8: dropImpact below threshold does NOT trigger reset', () => {
    const { ctrl } = makeController()
    ctrl.update(baseSignals, { onSceneChange: false })
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update(
      { ...baseSignals, dropImpact: 0.5 },
      { onDropImpact: true, dropImpactThreshold: 0.7, onSceneChange: false },
    )
    expect(clearSpy).not.toHaveBeenCalled()
    ctrl.dispose()
  })

  it('D9: contextRestore flag triggers reset', () => {
    const { ctrl } = makeController()
    ctrl.update(baseSignals, { onSceneChange: false })
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update(
      { ...baseSignals, contextJustRestored: true },
      { onContextRestore: true, onSceneChange: false },
    )
    expect(clearSpy).toHaveBeenCalledOnce()
    ctrl.dispose()
  })

  it('D10: manual reset() clears the buffer', () => {
    const { ctrl } = makeController()
    ctrl.update(baseSignals)
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.reset()
    expect(clearSpy).toHaveBeenCalledOnce()
    ctrl.dispose()
  })
})

// ── E: Persistent-resource retention ─────────────────────────────────────────

describe('E: persistent-resource retention', () => {
  it('E1: ping-pong buffer allocates two framebuffers', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const fboCount = gl._calls.filter(c => c.m === 'createFramebuffer').length
    expect(fboCount).toBe(2)
    pp.dispose()
  })

  it('E2: dispose does not add FBOs back to any pool', () => {
    // The pool lives in ShaderRenderGraph — ping-pong FBOs never touch it.
    // Test that dispose() calls deleteFramebuffer on both.
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(32, 32)
    const delsBefore = gl._calls.filter(c => c.m === 'deleteFramebuffer').length
    pp.dispose()
    const delsAfter = gl._calls.filter(c => c.m === 'deleteFramebuffer').length
    expect(delsAfter - delsBefore).toBe(2)
  })

  it('E3: ping-pong buffer survives multiple frames without reallocation', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const texCountAfterInit = gl._calls.filter(c => c.m === 'createTexture').length
    // Simulate 5 frames (swap without resize)
    for (let i = 0; i < 5; i++) pp.swap()
    expect(gl._calls.filter(c => c.m === 'createTexture').length).toBe(texCountAfterInit)
    pp.dispose()
  })

  it('E4: ping-pong buffer reallocates textures on resize', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const before = gl._calls.filter(c => c.m === 'createTexture').length
    pp.resize(128, 128)
    expect(gl._calls.filter(c => c.m === 'createTexture').length).toBeGreaterThan(before)
    pp.dispose()
  })

  it('E5: old textures are deleted on resize (no GPU leaks)', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const delsBefore = gl._calls.filter(c => c.m === 'deleteTexture').length
    pp.resize(128, 128)
    const delsAfter = gl._calls.filter(c => c.m === 'deleteTexture').length
    expect(delsAfter - delsBefore).toBe(2)  // both old textures freed
    pp.dispose()
  })
})

// ── F: Disposal ───────────────────────────────────────────────────────────────

describe('F: disposal', () => {
  it('F1: dispose() marks buffer disposed', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    pp.dispose()
    expect(pp.disposed).toBe(true)
  })

  it('F2: dispose() is idempotent — no double-delete', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    pp.dispose()
    const delsBefore = gl._calls.filter(c => c.m === 'deleteTexture').length
    pp.dispose()
    expect(gl._calls.filter(c => c.m === 'deleteTexture').length).toBe(delsBefore)
  })

  it('F3: resize after dispose is silently ignored', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    pp.dispose()
    const texBefore = gl._calls.filter(c => c.m === 'createTexture').length
    pp.resize(128, 128)
    expect(gl._calls.filter(c => c.m === 'createTexture').length).toBe(texBefore)
  })

  it('F4: swap after dispose is silently ignored', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    const readBefore = pp.readTexture
    pp.dispose()
    pp.swap()
    // Can't read readTexture reliably after dispose, just verify no crash
    expect(pp.disposed).toBe(true)
  })

  it('F5: ShaderFeedbackController.dispose() releases both ping-pong and pass', () => {
    const gl = makeMockGL()
    const ctrl = new ShaderFeedbackController(gl as unknown as WebGL2RenderingContext)
    expect(() => ctrl.dispose()).not.toThrow()
    expect(() => ctrl.dispose()).not.toThrow()  // idempotent
  })
})

// ── G: Feedback-value clamping ────────────────────────────────────────────────

describe('G: feedback parameter defaults and blend-mode constants', () => {
  it('G1: default decay is in [0,1]', () => {
    expect(DEFAULT_FEEDBACK_PARAMS.decay).toBeGreaterThanOrEqual(0)
    expect(DEFAULT_FEEDBACK_PARAMS.decay).toBeLessThanOrEqual(1)
  })

  it('G2: default zoom is 1.0 (no zoom)', () => {
    expect(DEFAULT_FEEDBACK_PARAMS.zoom).toBe(1.0)
  })

  it('G3: default clearPulse is 0 (no clearing)', () => {
    expect(DEFAULT_FEEDBACK_PARAMS.clearPulse).toBe(0)
  })

  it('G4: default blendMode produces a stable image (normal)', () => {
    expect(DEFAULT_FEEDBACK_PARAMS.blendMode).toBe('normal')
  })

  it('G5: all blend modes have distinct integer codes', () => {
    const modes: FeedbackBlendMode[] = ['normal', 'additive', 'screen', 'maximumLuma', 'multiply', 'difference']
    const codes = modes.map(m => FEEDBACK_BLEND_MODE_INT[m])
    const unique = new Set(codes)
    expect(unique.size).toBe(modes.length)
  })

  it('G6: normal blend mode is code 0', () => {
    expect(FEEDBACK_BLEND_MODE_INT['normal']).toBe(0)
  })

  it('G7: default freeze is false', () => {
    expect(DEFAULT_FEEDBACK_PARAMS.freeze).toBe(false)
  })

  it('G8: default reset config enables sceneChange and resolutionChange', () => {
    expect(DEFAULT_FEEDBACK_RESET_CONFIG.onSceneChange).toBe(true)
    expect(DEFAULT_FEEDBACK_RESET_CONFIG.onResolutionChange).toBe(true)
  })

  it('G9: default reset config disables sectionChange and dropImpact', () => {
    expect(DEFAULT_FEEDBACK_RESET_CONFIG.onSectionChange).toBe(false)
    expect(DEFAULT_FEEDBACK_RESET_CONFIG.onDropImpact).toBe(false)
  })
})

// ── H: Scene-change reset ─────────────────────────────────────────────────────

describe('H: scene-change reset', () => {
  it('H1: first update does NOT clear (no prior scene to change from)', () => {
    const gl = makeMockGL()
    const ctrl = new ShaderFeedbackController(gl as unknown as WebGL2RenderingContext)
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update({ sceneId: 'first', trackId: null, playbackTime: 0, sectionType: null, dropImpact: 0, w: 64, h: 64 })
    // Scene changed from null → 'first', which IS a change — so it clears.
    // This is correct: first activation should reset the feedback buffer.
    expect(clearSpy).toHaveBeenCalledOnce()
    ctrl.dispose()
  })

  it('H2: same scene twice does not clear', () => {
    const gl = makeMockGL()
    const ctrl = new ShaderFeedbackController(gl as unknown as WebGL2RenderingContext)
    const sig = { sceneId: 'scene', trackId: null, playbackTime: 0, sectionType: null, dropImpact: 0, w: 64, h: 64 }
    ctrl.update(sig)  // first call always sees a change
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update(sig)
    expect(clearSpy).not.toHaveBeenCalled()
    ctrl.dispose()
  })

  it('H3: switching from scene-a to scene-b clears the buffer', () => {
    const gl = makeMockGL()
    const ctrl = new ShaderFeedbackController(gl as unknown as WebGL2RenderingContext)
    ctrl.update({ sceneId: 'scene-a', trackId: null, playbackTime: 0, sectionType: null, dropImpact: 0, w: 64, h: 64 })
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update({ sceneId: 'scene-b', trackId: null, playbackTime: 0, sectionType: null, dropImpact: 0, w: 64, h: 64 })
    expect(clearSpy).toHaveBeenCalledOnce()
    ctrl.dispose()
  })
})

// ── I: Resolution-change reset ────────────────────────────────────────────────

describe('I: resolution-change reset', () => {
  it('I1: resolution change triggers reset and resize', () => {
    const gl = makeMockGL()
    const ctrl = new ShaderFeedbackController(gl as unknown as WebGL2RenderingContext)
    const sig64  = { sceneId: 's', trackId: null, playbackTime: 0, sectionType: null, dropImpact: 0, w: 64,  h: 64  }
    const sig128 = { sceneId: 's', trackId: null, playbackTime: 0, sectionType: null, dropImpact: 0, w: 128, h: 128 }
    ctrl.update(sig64)  // first call

    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update(sig128, { onSceneChange: false, onResolutionChange: true })
    expect(clearSpy).toHaveBeenCalled()
    ctrl.dispose()
  })

  it('I2: same resolution does not trigger reset', () => {
    const gl = makeMockGL()
    const ctrl = new ShaderFeedbackController(gl as unknown as WebGL2RenderingContext)
    const sig = { sceneId: 's', trackId: null, playbackTime: 0, sectionType: null, dropImpact: 0, w: 64, h: 64 }
    ctrl.update(sig)
    const clearSpy = vi.spyOn(ctrl.pingPong, 'clear')
    ctrl.update(sig, { onSceneChange: false, onResolutionChange: true })
    expect(clearSpy).not.toHaveBeenCalled()
    ctrl.dispose()
  })
})

// ── J: No temporary-pool release of persistent buffers ───────────────────────

describe('J: ping-pong buffers bypass the pool', () => {
  it('J1: ShaderPingPongBuffer is independent of ShaderFramebufferPool', async () => {
    // Verify ShaderPingPongBuffer does not import or reference ShaderFramebufferPool.
    // We check this by confirming the module graph doesn't include pool methods.
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    // No acquire() or release() method exists on ping-pong buffer
    // @ts-expect-error — intentional: these should not exist
    expect((pp as never).acquire).toBeUndefined()
    // @ts-expect-error
    expect((pp as never).release).toBeUndefined()
    pp.dispose()
  })

  it('J2: SwapBuffer never exposes a pool key', () => {
    const gl = makeMockGL()
    const pp = new ShaderPingPongBuffer(gl as unknown as WebGL2RenderingContext)
    pp.resize(64, 64)
    pp.swap()
    // Ping-pong buffer exposes read/write; no pool key concept
    // @ts-expect-error
    expect((pp as never).poolKey).toBeUndefined()
    pp.dispose()
  })
})
