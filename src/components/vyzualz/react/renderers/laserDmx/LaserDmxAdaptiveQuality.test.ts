import { describe, expect, it } from 'vitest'
import {
  applyLaserDmxAdaptiveQualityToFrame,
  LaserDmxAdaptiveQualityController,
  resolveLaserDmxAutoAtmosphereQuality,
  resolveLaserDmxInitialAutoQuality,
} from './LaserDmxAdaptiveQuality'
import { createLaserDmxSceneFrame } from './LaserDmxSceneFrame'
import { createDefaultLaserDmxBeamMatrixSettings, createDefaultLaserDmxShowDirectorState } from '../../ReactTypes'

const capable = {
  hdrAvailable: true,
  maxTextureSize: 8192,
  maxRenderbufferSize: 8192,
  devicePixelRatio: 1,
}

describe('LaserDmxAdaptiveQuality', () => {
  it('bounds initial Auto quality by capabilities and pixel pressure', () => {
    expect(resolveLaserDmxInitialAutoQuality(capable)).toBe('ultra')
    expect(resolveLaserDmxInitialAutoQuality({ ...capable, hdrAvailable: false })).toBe('high')
    expect(resolveLaserDmxInitialAutoQuality({ ...capable, maxTextureSize: 3000 })).toBe('medium')
    expect(resolveLaserDmxInitialAutoQuality({ ...capable, maxTextureSize: 1024 })).toBe('low')
  })

  it('downshifts slowly, uses hysteresis, and never oscillates per frame', () => {
    const controller = new LaserDmxAdaptiveQualityController(capable)
    for (let index = 0; index < 120; index += 1) {
      controller.sample(28, index * 50, 'auto')
    }
    const slowed = controller.resolve('auto', 'auto')
    expect(['high', 'medium']).toContain(slowed.effective)
    expect(slowed.downshiftCount).toBeGreaterThan(0)

    const before = slowed.effective
    for (let index = 0; index < 30; index += 1) {
      controller.sample(7, 6_100 + index * 50, 'auto')
    }
    expect(controller.resolve('auto', 'auto').effective).toBe(before)
  })

  it('keeps explicit quality stable and scales atmosphere independently', () => {
    const controller = new LaserDmxAdaptiveQualityController(capable)
    for (let index = 0; index < 200; index += 1) controller.sample(40, index * 100, 'ultra')
    const explicit = controller.resolve('ultra', 'low')
    expect(explicit.effective).toBe('ultra')
    expect(explicit.effectiveAtmosphere).toBe('low')
    expect(resolveLaserDmxAutoAtmosphereQuality('ultra')).toBe('high')
  })

  it('changes only render-quality fields in a scene frame', () => {
    const frame = createLaserDmxSceneFrame({
      showDirector: {
        ...createDefaultLaserDmxShowDirectorState(),
        settings: {
          ...createDefaultLaserDmxShowDirectorState().settings,
          rendererMode: 'auto',
          webglQuality: 'auto',
          webglAtmosphereQuality: 'auto',
        },
      },
      evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 12,
      deltaTimeSec: 1 / 60,
      timingDiscontinuity: false,
      trackKey: 'quality-test',
      isPlaying: true,
      bpm: 142,
    })
    const adjusted = applyLaserDmxAdaptiveQualityToFrame(frame, {
      requested: 'auto',
      effective: 'medium',
      effectiveAtmosphere: 'low',
      averageFrameMs: 20,
      sampleCount: 60,
      downshiftCount: 1,
      upshiftCount: 0,
      lastChangeReason: 'slow-frame',
    })
    expect(adjusted.camera).toBe(frame.camera)
    expect(adjusted.beams).toBe(frame.beams)
    expect(adjusted.musicalState).toBe(frame.musicalState)
    expect(adjusted.quality.qualityTier).toBe('medium')
    expect(adjusted.atmosphere.qualityTier).toBe('low')
  })
})
