import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  type LaserDmxShowDirectorWebGLQuality,
} from '../../ReactTypes'
import { createLaserDmxSceneFrame, type LaserDmxSceneFrame } from './LaserDmxSceneFrame'
import {
  LaserDmxExposureController,
  resolveLaserDmxExposureResponse,
  resolveLaserDmxHdrTargetStrategy,
  resolveLaserDmxPostQuality,
  resolveLaserDmxWebGLPostProcessPlan,
  updateLaserDmxExposureState,
  type LaserDmxExposureResponse,
} from './LaserDmxWebGLPostProcessing'

function createPostFrame(options: {
  quality?: LaserDmxShowDirectorWebGLQuality
  presentationMode?: 'edit' | 'live'
  strobe?: boolean
  blinder?: boolean
  energy?: number
  timeSec?: number
  deltaTimeSec?: number
} = {}): LaserDmxSceneFrame {
  const showDirector = createDefaultLaserDmxShowDirectorState()
  showDirector.settings.webglQuality = options.quality ?? 'high'
  showDirector.settings.presentationMode = options.presentationMode ?? 'live'
  const laser = createDefaultLaserDmxShowDirectorFixture('laser', 'post-laser', 0)
  laser.brightness = 1
  showDirector.fixtures = [laser]

  if (options.strobe) {
    const strobe = createDefaultLaserDmxShowDirectorFixture('strobe', 'post-strobe', 1)
    strobe.brightness = 1
    strobe.component.strobeRate = 1
    showDirector.fixtures.push(strobe)
  }
  if (options.blinder) {
    const blinder = createDefaultLaserDmxShowDirectorFixture('blinder', 'post-blinder', 2)
    blinder.brightness = 1
    showDirector.fixtures.push(blinder)
  }

  const evaluated = createDefaultLaserDmxBeamMatrixSettings()
  evaluated.output.masterDimmer = 1
  evaluated.output.globalGlow = 0.72
  return createLaserDmxSceneFrame({
    showDirector,
    evaluatedBeamMatrix: evaluated,
    audioTimeSec: options.timeSec ?? 0,
    deltaTimeSec: options.deltaTimeSec ?? 1 / 60,
    isPlaying: true,
    timingDiscontinuity: false,
    trackKey: 'post-track',
    bpm: 142,
    energy: options.energy ?? 0.8,
  })
}

const HDR_STRATEGY = resolveLaserDmxHdrTargetStrategy({
  webgl2: true,
  colorBufferFloat: true,
  rgba16fRenderable: true,
  floatLinearFiltering: true,
})

const LDR_STRATEGY = resolveLaserDmxHdrTargetStrategy({
  webgl2: true,
  colorBufferFloat: false,
  rgba16fRenderable: false,
  floatLinearFiltering: false,
})

describe('LaserDMX WebGL photographic post-processing', () => {
  it('selects RGBA16F only after renderability is proven and otherwise chooses a safe RGBA8 target', () => {
    expect(HDR_STRATEGY).toEqual({
      hdrEnabled: true,
      targetFormat: 'rgba16f',
      linearFiltering: true,
      maximumSceneValue: 16,
      diagnosticCode: 'hdr-rgba16f',
    })
    expect(LDR_STRATEGY).toEqual({
      hdrEnabled: false,
      targetFormat: 'rgba8',
      linearFiltering: true,
      maximumSceneValue: 1,
      diagnosticCode: 'ldr-rgba8-fallback',
    })
  })

  it('keeps automatic quality bounded under pixel pressure', () => {
    expect(resolveLaserDmxPostQuality('auto', 1, 3)).toBe('medium')
    expect(resolveLaserDmxPostQuality('auto', 1, 2)).toBe('high')
    expect(resolveLaserDmxPostQuality('auto', 0.75, 1)).toBe('ultra')
    expect(resolveLaserDmxPostQuality('low', 1, 1)).toBe('low')
  })

  it('scales a bounded bloom pyramid independently by post quality', () => {
    const levels = (['low', 'medium', 'high', 'ultra'] as const).map(quality => {
      const frame = createPostFrame({ quality })
      return resolveLaserDmxWebGLPostProcessPlan(frame, HDR_STRATEGY, { exposure: 1, washout: 0 }).bloom
    })

    expect(levels.map(level => level.levelCount)).toEqual([1, 2, 3, 4])
    expect(levels.every(level => level.threshold > 1)).toBe(true)
    expect(levels.every(level => level.radius >= 0.55 && level.radius <= 1.45)).toBe(true)
    expect(levels[3]?.levelWeights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 8)
  })


  it('reduces scanner bloom and radius during authored fast cue motion without using sample count as gain', () => {
    const source = createPostFrame({ quality: 'high', energy: 0.9 })
    const noScanner: LaserDmxSceneFrame = { ...source, scanPaths: [], exposureSamples: [] }
    const stable: LaserDmxSceneFrame = {
      ...source,
      scanPaths: source.scanPaths.map(path => ({
        ...path,
        patternAnimationActive: false,
        fixtureMovementActive: false,
      })),
      exposureSamples: source.exposureSamples.map(sample => ({ ...sample, velocityRatio: 0.2 })),
    }
    const moving: LaserDmxSceneFrame = {
      ...source,
      scanPaths: source.scanPaths.map(path => ({
        ...path,
        patternAnimationActive: true,
        fixtureMovementActive: false,
      })),
      exposureSamples: source.exposureSamples.map(sample => ({ ...sample, velocityRatio: 1 })),
    }
    const state = { exposure: 1, washout: 0 }
    const noScannerBloom = resolveLaserDmxWebGLPostProcessPlan(noScanner, HDR_STRATEGY, state).bloom
    const stableBloom = resolveLaserDmxWebGLPostProcessPlan(stable, HDR_STRATEGY, state).bloom
    const movingBloom = resolveLaserDmxWebGLPostProcessPlan(moving, HDR_STRATEGY, state).bloom

    expect(stableBloom.strength).toBeLessThan(noScannerBloom.strength)
    expect(movingBloom.strength).toBeLessThan(stableBloom.strength)
    expect(movingBloom.radius).toBeLessThan(stableBloom.radius)

    const duplicatedSamples: LaserDmxSceneFrame = {
      ...stable,
      exposureSamples: [...stable.exposureSamples, ...stable.exposureSamples.map(sample => ({ ...sample, sampleTime: sample.sampleTime + 1e-6 }))],
    }
    expect(resolveLaserDmxWebGLPostProcessPlan(duplicatedSamples, HDR_STRATEGY, state).bloom)
      .toEqual(stableBloom)
  })

  it('clamps exposure and washout during extreme inputs', () => {
    const response: LaserDmxExposureResponse = {
      baseExposure: 1,
      targetExposure: 99,
      targetWashout: 99,
      minimumExposure: 0.72,
      maximumExposure: 1.9,
      attackSec: 0.001,
      releaseSec: 0.5,
      strobeStrength: 1,
      blinderStrength: 1,
    }
    const attacked = updateLaserDmxExposureState(
      { exposure: -4, washout: -1 },
      response,
      1,
      false,
    )
    expect(attacked.exposure).toBe(1.9)
    expect(attacked.washout).toBe(1)

    const reset = updateLaserDmxExposureState(attacked, response, 1, true)
    expect(reset).toEqual({ exposure: 1, washout: 0 })
  })

  it('uses a fast deterministic flash attack and a controlled release for strobe and blinder transients', () => {
    const controller = new LaserDmxExposureController()
    const flashFrame = createPostFrame({ strobe: true, blinder: true, timeSec: 0 })
    const response = resolveLaserDmxExposureResponse(flashFrame)
    expect(response.strobeStrength).toBeGreaterThan(0.9)
    expect(response.blinderStrength).toBeGreaterThan(0.9)
    expect(response.attackSec).toBeLessThan(0.02)

    const attacked = controller.update(flashFrame).state
    expect(attacked.exposure).toBeGreaterThan(1)
    expect(attacked.washout).toBeGreaterThan(0.4)

    const calmFrame: LaserDmxSceneFrame = {
      ...createPostFrame({ timeSec: 1, deltaTimeSec: 1 / 60, energy: 0.25 }),
      transientEvents: [],
    }
    for (let index = 0; index < 180; index += 1) controller.update(calmFrame)
    expect(controller.snapshot.washout).toBeLessThan(0.01)
    expect(controller.snapshot.exposure).toBeCloseTo(resolveLaserDmxExposureResponse(calmFrame).baseExposure, 2)
  })

  it('configures concert-oriented ACES tone mapping without lifting the black floor', () => {
    const frame = createPostFrame({ quality: 'high', energy: 1 })
    const plan = resolveLaserDmxWebGLPostProcessPlan(frame, HDR_STRATEGY, { exposure: 1.25, washout: 0 })

    expect(plan.toneMapping).toMatchObject({
      curve: 'aces-fitted',
      exposure: 1.25,
      whitePoint: 7.5,
      gamma: 2.2,
    })
    expect(plan.toneMapping.saturation).toBeGreaterThanOrEqual(1)
    expect(plan.toneMapping.blackClip).toBeLessThan(0.001)
    expect(plan.toneMapping.highlightDesaturation).toBeLessThan(0.25)
  })

  it('keeps fixture optics out of fullscreen post and attenuates glare in Edit mode', () => {
    const low = resolveLaserDmxWebGLPostProcessPlan(
      createPostFrame({ quality: 'low', strobe: true }),
      HDR_STRATEGY,
      { exposure: 1.5, washout: 0.4 },
    )
    const live = resolveLaserDmxWebGLPostProcessPlan(
      createPostFrame({ quality: 'high', presentationMode: 'live', strobe: true }),
      HDR_STRATEGY,
      { exposure: 1.5, washout: 0.4 },
    )
    const edit = resolveLaserDmxWebGLPostProcessPlan(
      createPostFrame({ quality: 'high', presentationMode: 'edit', strobe: true }),
      HDR_STRATEGY,
      { exposure: 1.5, washout: 0.4 },
    )

    expect(low.optics.chromaticAmountPx).toBe(0)
    expect(live.optics.chromaticThreshold).toBeGreaterThan(2)
    expect(live.optics.chromaticAmountPx).toBe(0)
    expect(live.optics.spectralEdgeStrength).toBe(0)
    expect(edit.optics.glareStrength).toBeLessThan(live.optics.glareStrength)
    expect(edit.optics.chromaticAmountPx).toBe(0)
  })

  it('reports the lower-dynamic-range plan through diagnostics-compatible configuration', () => {
    const plan = resolveLaserDmxWebGLPostProcessPlan(
      createPostFrame({ quality: 'medium' }),
      LDR_STRATEGY,
      { exposure: 1, washout: 0 },
    )
    expect(plan.degraded).toBe(true)
    expect(plan.targetStrategy.diagnosticCode).toBe('ldr-rgba8-fallback')
    expect(plan.bloom.levelCount).toBe(2)
    expect(plan.optics.chromaticAmountPx).toBe(0)
  })
})
