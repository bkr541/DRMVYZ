import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  type LaserDmxShowDirectorWebGLQuality,
} from '../../ReactTypes'
import { createLaserDmxSceneFrame, resolveLaserDmxSceneFrameOutput } from './LaserDmxSceneFrame'
import {
  buildLaserDmxWebGLAtmosphereRenderPlan,
  resolveLaserDmxAtmosphereQualityPolicy,
  resolveLaserDmxAtmosphereTargetSize,
  resolveLaserDmxDeterministicAtmosphereTime,
} from './LaserDmxWebGLAtmospherePlan'

const VIEWPORT = {
  backingWidth: 1200,
  backingHeight: 700,
  cssWidth: 1200,
  cssHeight: 700,
}

function createAtmosphereFrame(options: {
  quality?: LaserDmxShowDirectorWebGLQuality
  fogEnabled?: boolean
  trackKey?: string | null
  audioTimeSec?: number
  includeHaze?: boolean
} = {}) {
  const showDirector = createDefaultLaserDmxShowDirectorState()
  showDirector.settings.webglQuality = 'high'
  showDirector.settings.webglAtmosphereQuality = options.quality ?? 'medium'

  const laser = createDefaultLaserDmxShowDirectorFixture('laser', 'atmosphere-laser', 0)
  laser.x = 3
  laser.y = 2
  laser.z = 0.05
  laser.brightness = 0.95
  laser.beam.targetMode = 'fixed'
  laser.beam.targetX = 11
  laser.beam.targetY = 7
  laser.beam.targetZ = -0.25
  laser.beam.targets = [{ id: 'atmosphere-target', x: 11, y: 7 }]

  showDirector.fixtures = [laser]
  if (options.includeHaze) {
    const haze = createDefaultLaserDmxShowDirectorFixture('haze', 'local-haze', 1)
    haze.x = 6
    haze.y = 5
    haze.z = -0.15
    haze.rotation = -70
    haze.brightness = 0.8
    haze.component.hazeIntensity = 0.75
    haze.color = '#7fd8ff'
    showDirector.fixtures.push(haze)
  }

  const evaluated = createDefaultLaserDmxBeamMatrixSettings()
  evaluated.output.masterDimmer = 1
  evaluated.fog = {
    ...evaluated.fog,
    enabled: options.fogEnabled ?? false,
    density: 0.62,
    opacity: 0.54,
    beamScatter: 0.73,
    turbulence: 0.31,
    noiseScale: 1.45,
    driftSpeed: 0.18,
    driftDirection: 0.62,
    diffusion: 0.44,
    dissipation: 0.37,
    colorAbsorption: 0.21,
  }

  return {
    frame: createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: evaluated,
      audioTimeSec: options.audioTimeSec ?? 24.5,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: options.trackKey ?? 'atmosphere-track',
      bpm: 142,
      beatIndex: 58,
      barIndex: 14,
      phraseIndex: 1,
    }),
    evaluated,
  }
}

describe('LaserDMX WebGL atmosphere compilation', () => {
  it('compiles authored haze parameters into bounded deterministic atmosphere inputs', () => {
    const { frame } = createAtmosphereFrame({ fogEnabled: true })

    expect(frame.atmosphere).toMatchObject({
      enabled: true,
      density: 0.62,
      opacity: 0.54,
      beamScatter: 0.73,
      turbulence: 0.31,
      noiseScale: 1.45,
      driftSpeed: 0.18,
      driftDirection: 0.62,
      diffusion: 0.44,
      dissipation: 0.37,
      colorAbsorption: 0.21,
      qualityTier: 'medium',
    })
    expect(frame.atmosphere.baselineDensity).toBeGreaterThan(0)
    expect(frame.atmosphere.deterministicSeed).toBeGreaterThanOrEqual(0)
    expect(frame.atmosphere.deterministicSeed).toBeLessThanOrEqual(1)
  })

  it('provides subtle baseline venue haze when lasers are active without an authored haze fixture', () => {
    const { frame } = createAtmosphereFrame({ fogEnabled: false, includeHaze: false })
    const plan = buildLaserDmxWebGLAtmosphereRenderPlan(frame, VIEWPORT)

    expect(frame.atmosphere.enabled).toBe(true)
    expect(frame.atmosphere.baselineDensity).toBeGreaterThan(0)
    expect(plan.enabled).toBe(true)
    expect(plan.sources).toHaveLength(0)
    expect(plan.beams.length).toBeGreaterThan(0)
  })

  it('converts haze fixtures into local directional density sources and follows output modulation', () => {
    const { frame, evaluated } = createAtmosphereFrame({ fogEnabled: true, includeHaze: true })
    expect(frame.atmosphereSources).toHaveLength(1)
    const source = frame.atmosphereSources[0]!
    expect(source.density).toBeCloseTo(0.6, 8)
    expect(source.spread).toBeGreaterThan(0.12)
    expect(source.direction.x).not.toBe(0)

    evaluated.output.masterDimmer = 0.5
    evaluated.fog.dissipation = 0.8
    const resolved = resolveLaserDmxSceneFrameOutput(frame, evaluated)
    const resolvedSource = resolved.atmosphereSources[0]!
    expect(resolvedSource.density).toBeCloseTo(0.3, 8)
    expect(resolvedSource.dissipation).toBeGreaterThan(source.dissipation)

    const plan = buildLaserDmxWebGLAtmosphereRenderPlan(resolved, VIEWPORT)
    expect(plan.sources[0]).toMatchObject({ id: 'local-haze-haze-source' })
    expect(plan.sources[0]?.density).toBeCloseTo(0.3, 8)
  })

  it('weights front, middle, and rear beam volumes differently without changing the locked camera', () => {
    const { frame } = createAtmosphereFrame({ fogEnabled: true })
    const template = frame.beams[0]!
    frame.beams = [
      { ...template, id: 'front', origin: { ...template.origin, z: 0.65 }, target: { ...template.target, z: 0.55 } },
      { ...template, id: 'middle', origin: { ...template.origin, z: 0.05 }, target: { ...template.target, z: -0.05 } },
      { ...template, id: 'rear', origin: { ...template.origin, z: -0.55 }, target: { ...template.target, z: -0.65 } },
    ]
    frame.scannerHeads = []
    frame.scanPaths = []
    frame.scannerInstantaneousRays = []
    frame.exposureSamples = []
    frame.opticalCopies = []
    const plan = buildLaserDmxWebGLAtmosphereRenderPlan(frame, VIEWPORT)
    const front = plan.beams.find(beam => beam.id.startsWith('front-atmosphere'))!
    const middle = plan.beams.find(beam => beam.id.startsWith('middle-atmosphere'))!
    const rear = plan.beams.find(beam => beam.id.startsWith('rear-atmosphere'))!

    expect(new Set([front.depthSlice, middle.depthSlice, rear.depthSlice]).size).toBeGreaterThan(1)
    expect(new Set([front.depthWeight, middle.depthWeight, rear.depthWeight]).size).toBeGreaterThan(1)
    expect(rear.extinctionWeight).not.toBe(front.extinctionWeight)
    expect(frame.camera.locked).toBe(true)
    expect(frame.camera.controls).toMatchObject({ pan: false, orbit: false, roll: false, animate: false })
  })

  it('scales atmosphere resolution and bounded work independently from sharp beam quality', () => {
    const low = resolveLaserDmxAtmosphereQualityPolicy('low')
    const high = resolveLaserDmxAtmosphereQualityPolicy('high')
    const lowSize = resolveLaserDmxAtmosphereTargetSize(1600, 900, 'low')
    const highSize = resolveLaserDmxAtmosphereTargetSize(1600, 900, 'high')

    expect(lowSize).toEqual({ width: 400, height: 225 })
    expect(highSize.width).toBeGreaterThan(lowSize.width)
    expect(high.sampleCount).toBeGreaterThan(low.sampleCount)
    expect(high.maxBeamInstances).toBeGreaterThan(low.maxBeamInstances)
    expect(high.sampleCount).toBeLessThanOrEqual(6)
    expect(high.maxHazeSources).toBeLessThanOrEqual(8)
  })

  it('derives atmospheric motion only from canonical transport time for stable seek and loop replay', () => {
    const first = createAtmosphereFrame({ audioTimeSec: 42.125, trackKey: 'same-track' }).frame
    const replay = createAtmosphereFrame({ audioTimeSec: 42.125, trackKey: 'same-track' }).frame
    const later = createAtmosphereFrame({ audioTimeSec: 43.125, trackKey: 'same-track' }).frame

    expect(resolveLaserDmxDeterministicAtmosphereTime(first)).toBe(42.125)
    expect(buildLaserDmxWebGLAtmosphereRenderPlan(first, VIEWPORT).deterministicTimeSec)
      .toBe(buildLaserDmxWebGLAtmosphereRenderPlan(replay, VIEWPORT).deterministicTimeSec)
    expect(first.atmosphere.deterministicSeed).toBe(replay.atmosphere.deterministicSeed)
    expect(resolveLaserDmxDeterministicAtmosphereTime(later)).toBe(43.125)
  })

  it('falls back to the bounded legacy depth partition when continuous slicing is unavailable', () => {
    const { frame } = createAtmosphereFrame({ fogEnabled: true, includeHaze: true })
    const plan = buildLaserDmxWebGLAtmosphereRenderPlan(frame, VIEWPORT, false)

    expect(plan.depthMode).toBe('binary-fallback')
    expect(plan.sliceCount).toBe(2)
    expect(plan.depthPolicy.plumePrecision).toBeLessThan(0.3)
    expect(plan.beams.every(beam => beam.depthSlice === 0 || beam.depthSlice === 1)).toBe(true)
  })

  it('declares beam-volume-only atmosphere and creates no room, wall, floor, ceiling, or venue geometry', () => {
    const { frame } = createAtmosphereFrame({ fogEnabled: true, includeHaze: true })
    const plan = buildLaserDmxWebGLAtmosphereRenderPlan(frame, VIEWPORT)

    expect(plan.geometryMode).toBe('depthSlicedBeamVolumes')
    expect(plan.createsVenueGeometry).toBe(false)
    expect(frame.depthZones.every(zone => zone.visible === false)).toBe(true)
  })
})
