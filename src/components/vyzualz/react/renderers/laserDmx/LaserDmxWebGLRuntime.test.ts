import { describe, expect, it } from 'vitest'
import { LaserDmxWebGLContextState, LaserDmxWebGLResourceLedger } from './LaserDmxWebGLRuntime'
import { getLaserDmxWebGLShaderProgramSources } from './LaserDmxWebGLShaderSources'

describe('LaserDMX WebGL context lifecycle state', () => {
  it('marks loss, schedules one deterministic resource recreation, and clears the request after consumption', () => {
    const state = new LaserDmxWebGLContextState()
    expect(state.generation).toBe(0)
    state.markLost()
    state.markLost()
    expect(state.lossCount).toBe(1)
    expect(state.contextLost).toBe(true)
    expect(state.restorePending).toBe(false)

    state.markRestored()
    expect(state.contextLost).toBe(false)
    expect(state.restorePending).toBe(true)
    expect(state.generation).toBe(1)
    expect(state.consumeRestore()).toBe(true)
    expect(state.consumeRestore()).toBe(false)
    state.markLost()
    expect(state.lossCount).toBe(2)
  })

  it('makes disposal terminal and prevents later restoration work', () => {
    const state = new LaserDmxWebGLContextState()
    state.markRestored()
    expect(state.generation).toBe(0)
    state.markLost()
    state.dispose()
    state.markRestored()
    expect(state.disposed).toBe(true)
    expect(state.contextLost).toBe(false)
    expect(state.restorePending).toBe(false)
    expect(state.generation).toBe(0)
    expect(state.consumeRestore()).toBe(false)
  })
})


describe('LaserDMX WebGL reusable resource ledger', () => {
  it('reuses named resources, releases resized targets, and clears every allocation on disposal', () => {
    const ledger = new LaserDmxWebGLResourceLedger()
    ledger.allocate('gpu-core')
    ledger.allocate('sharp-slice')
    ledger.allocate('laser-slice')
    ledger.allocate('atmosphere-slice')
    ledger.allocate('depth-composite-0')
    ledger.allocate('depth-composite-1')
    ledger.allocate('temporal-history-0-0')
    ledger.allocate('temporal-history-0-1')
    for (let index = 0; index < 4; index += 1) {
      ledger.allocate(`bloom-${index}`)
      ledger.allocate(`bloom-blur-${index}`)
    }
    ledger.allocate('atmosphere-slice')
    expect(ledger.activeCount).toBe(16)

    ledger.release('atmosphere-slice')
    ledger.release('depth-composite-0')
    expect(ledger.activeCount).toBe(14)
    ledger.allocate('atmosphere-slice')
    ledger.allocate('depth-composite-0')
    ledger.dispose()

    expect(ledger.disposed).toBe(true)
    expect(ledger.activeCount).toBe(0)
    ledger.allocate('late-resource')
    expect(ledger.activeCount).toBe(0)
  })
})


describe('LaserDMX WebGL temporal shader registration', () => {
  it('registers bounded max-composited history in the production shader set', () => {
    const temporal = getLaserDmxWebGLShaderProgramSources()
      .find(program => program.label === 'temporal-history')

    expect(temporal).toBeDefined()
    expect(temporal?.fragSrc).toContain('clamp(uRetention, 0.0, 0.45)')
    expect(temporal?.fragSrc).toContain('max(current, retained)')
    expect(temporal?.fragSrc).not.toContain('current + retained')
  })
})


describe('LaserDMX WebGL depth and fixture shader registration', () => {
  it('keeps same-slice light additive while extinguishing already accumulated deeper light', () => {
    const composite = getLaserDmxWebGLShaderProgramSources()
      .find(program => program.label === 'atmosphere-composite')

    expect(composite?.fragSrc).toContain('vec3 layerLight = sharp + laser')
    expect(composite?.fragSrc).toContain('behind * (1.0 - extinction)')
    expect(composite?.fragSrc).toContain('light += atmosphere.rgb')
  })

  it('uses analytic capsule coverage for continuous subpixel laser cores', () => {
    const beam = getLaserDmxWebGLShaderProgramSources()
      .find(program => program.label === 'sharp-beam')

    expect(beam?.vertSrc).toContain('vCapsuleCoordPx')
    expect(beam?.fragSrc).toContain('capsuleDistance')
    expect(beam?.fragSrc).toContain('analyticCoverage')
    expect(beam?.fragSrc).toContain('fwidth')
    expect(beam?.fragSrc).not.toContain('discard')
  })

  it('registers laser-only history and depth-layer accumulation inputs', () => {
    const programs = getLaserDmxWebGLShaderProgramSources()
    const beam = programs.find(program => program.label === 'sharp-beam')
    const movingHead = programs.find(program => program.label === 'moving-head-cone')
    const composite = programs.find(program => program.label === 'atmosphere-composite')

    expect(beam?.fragSrc).not.toContain('goboMask')
    expect(movingHead?.fragSrc).toContain('goboMask')
    expect(beam?.vertSrc).toContain('iPrism')
    expect(composite?.fragSrc).toContain('uCurrentLaserTexture')
    expect(composite?.fragSrc).toContain('uLaserHistoryTexture')
    expect(composite?.fragSrc).toContain('max(currentLaser, retainedLaser)')
    expect(composite?.fragSrc).toContain('uLayerExtinction')
    expect(composite?.fragSrc).not.toContain('uFinalComposite')
  })

  it('registers genuinely separated fixture shaders and removes fullscreen spectral tricks', () => {
    const programs = getLaserDmxWebGLShaderProgramSources()
    const labels = new Set(programs.map(program => program.label))
    expect(labels).toEqual(new Set([
      'sharp-beam', 'projector-aperture', 'moving-head-cone', 'wash-field',
      'led-emitter', 'strobe-blinder-source', 'video-surface',
      'atmospheric-scatter', 'foreground-veil', 'atmosphere-composite',
      'temporal-history', 'bloom-downsample', 'bloom-blur', 'photographic-post',
    ]))

    const beam = programs.find(program => program.label === 'sharp-beam')!
    const movingHead = programs.find(program => program.label === 'moving-head-cone')!
    const wash = programs.find(program => program.label === 'wash-field')!
    const led = programs.find(program => program.label === 'led-emitter')!
    const flash = programs.find(program => program.label === 'strobe-blinder-source')!
    const video = programs.find(program => program.label === 'video-surface')!
    const post = programs.find(program => program.label === 'photographic-post')!

    expect(beam.fragSrc).not.toContain('materialMode')
    expect(movingHead.fragSrc).toContain('goboMask')
    expect(wash.fragSrc).toContain('edgeSoftness')
    expect(led.fragSrc).toContain('segmented')
    expect(flash.fragSrc).toContain('atmospherePulse')
    expect(video.fragSrc).toContain('imageSignal')
    expect(new Set([movingHead.fragSrc, wash.fragSrc, led.fragSrc, flash.fragSrc, video.fragSrc]).size).toBe(5)
    expect(post.fragSrc).not.toContain('chromaticShift')
    expect(post.fragSrc).not.toContain('spectralEdge')
  })

})
