import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorFixtureKind,
} from '../../ReactTypes'
import { compileLaserDmxShowDirectorToBeamMatrix } from '../LaserDmxShowDirectorBeamMatrixCompiler'
import { resolveLaserDmxBeamOpticalProfile } from './LaserDmxBeamOptics'
import { createLaserDmxSceneFrame } from './LaserDmxSceneFrame'
import { buildLaserDmxDedicatedFixtureRenderPlan } from './LaserDmxDedicatedFixturePlan'
import { buildLaserDmxWebGLBeamRenderPlan } from './LaserDmxWebGLBeamPlan'

const KINDS: readonly LaserDmxShowDirectorFixtureKind[] = [
  'laser', 'movingHead', 'parWash', 'ledBar', 'ledTube', 'strobe', 'blinder', 'videoWall', 'haze', 'co2Jet',
]

function createFixtureScene() {
  const showDirector = createDefaultLaserDmxShowDirectorState()
  showDirector.settings.webglQuality = 'ultra'
  showDirector.fixtures = KINDS.map((kind, index) => {
    const fixture = createDefaultLaserDmxShowDirectorFixture(kind, `fixture-${kind}`, index)
    fixture.x = 1 + index
    fixture.y = 2 + (index % 3)
    fixture.brightness = 1
    fixture.beam.beamEnabled = true
    fixture.beam.targetMode = 'fixed'
    fixture.beam.targetX = Math.max(0, 13 - index)
    fixture.beam.targetY = 8
    fixture.optics = {
      ...fixture.optics,
      primitiveType: kind === 'laser' ? 'fan' : kind === 'movingHead' || kind === 'parWash' ? 'washCone' : fixture.optics.primitiveType,
      rayCount: kind === 'laser' ? 7 : kind === 'movingHead' || kind === 'parWash' ? 4 : fixture.optics.rayCount,
      goboAmount: kind === 'movingHead' ? 0.75 : 0,
      goboPattern: kind === 'movingHead' ? 'star' : 'open',
      goboRotation: kind === 'movingHead' ? 32 : 0,
      prismFacets: kind === 'laser' ? 3 : kind === 'movingHead' ? 5 : 1,
      prismRotation: kind === 'movingHead' ? 18 : 0,
      zoom: kind === 'movingHead' ? 0.38 : fixture.optics.zoom,
      iris: kind === 'movingHead' ? 0.72 : fixture.optics.iris,
      frost: kind === 'movingHead' ? 0.09 : fixture.optics.frost,
    }
    if (kind === 'strobe') fixture.component.strobeRate = 1
    if (kind === 'ledBar' || kind === 'ledTube') { fixture.component.ledCellCount = 16; fixture.component.ledDirection = 'chase'; fixture.rotation = kind === 'ledTube' ? 90 : 24 }
    if (kind === 'videoWall') fixture.component.videoWallSource = 'media'
    return fixture
  })
  return createLaserDmxSceneFrame({
    showDirector,
    evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    audioTimeSec: 0,
    deltaTimeSec: 1 / 60,
    isPlaying: true,
    timingDiscontinuity: false,
    trackKey: 'fixture-optics-track',
    bpm: 142,
    beatIndex: 0,
    beatHit: true,
    downbeat: true,
    kickHit: true,
    kickStrength: 1,
  })
}

describe('LaserDMX fixture-specific WebGL optics', () => {
  it('normalizes older saved fixtures that lack advanced gobo and prism fields', () => {
    const legacyState = createDefaultLaserDmxShowDirectorState()
    legacyState.fixtures = [createDefaultLaserDmxShowDirectorFixture('movingHead', 'legacy-moving-head', 0)]
    const legacy = JSON.parse(JSON.stringify(legacyState)) as Record<string, unknown>
    const fixture = (legacy.fixtures as Array<Record<string, unknown>>)[0]!
    const optics = { ...(fixture.optics as Record<string, unknown>) }
    delete optics.goboPattern
    delete optics.goboRotation
    delete optics.prismRotation
    fixture.optics = optics

    const normalized = normalizeLaserDmxShowDirectorState(legacy)
    expect(normalized.fixtures[0]?.optics).toMatchObject({
      goboPattern: 'open',
      goboRotation: 0,
      prismRotation: 0,
    })
  })

  it('uses materially different beam profiles for lasers, spots, and washes', () => {
    const common = { intensity: 1, focus: 0.85, spreadDeg: 48, visualRole: 'primary' as const }
    const laser = resolveLaserDmxBeamOpticalProfile({ ...common, fixtureKind: 'laser', opticalSoftness: 0.05, zoom: 0.2, iris: 1, frost: 0 })
    const spot = resolveLaserDmxBeamOpticalProfile({ ...common, fixtureKind: 'movingHead', opticalSoftness: 0.34, zoom: 0.45, iris: 0.85, frost: 0.08 })
    const wash = resolveLaserDmxBeamOpticalProfile({ ...common, fixtureKind: 'parWash', opticalSoftness: 0.82, zoom: 0.85, iris: 1, frost: 0.7 })
    expect(laser.width).toBeLessThan(spot.width)
    expect(spot.width).toBeLessThan(wash.width)
    expect(laser.divergence).toBeLessThan(spot.divergence)
    expect(spot.divergence).toBeLessThan(wash.divergence)
    expect(wash.scatterEnvelopeWidth).toBeGreaterThan(laser.scatterEnvelopeWidth)
  })

  it('routes lasers and every nonlaser fixture through genuinely separated render plans', () => {
    const frame = createFixtureScene()
    const viewport = { backingWidth: 1920, backingHeight: 1080, cssWidth: 960, cssHeight: 540 }
    const laserPlan = buildLaserDmxWebGLBeamRenderPlan(frame, viewport)
    const fixturePlan = buildLaserDmxDedicatedFixtureRenderPlan(frame, viewport)

    expect(new Set(laserPlan.beams.map(beam => beam.materialMode))).toEqual(new Set([0]))
    expect(laserPlan.beams.every(beam => beam.fixtureKind === 'laser')).toBe(true)
    expect(laserPlan.beams.filter(beam => beam.historyEligible).every(beam => beam.fixtureKind === 'laser')).toBe(true)
    expect(laserPlan.laserHistoryBeamCount).toBe(laserPlan.beams.length)
    expect(laserPlan.apertures.every(aperture => aperture.fixtureKind === 'laser' && aperture.shapeMode === 0)).toBe(true)

    expect(fixturePlan.movingHeads).toHaveLength(5)
    expect(fixturePlan.movingHeads.every(head => head.goboPattern === 5 && head.goboAmount === 0.75)).toBe(true)
    expect(fixturePlan.movingHeads.every(head => head.iris === 0.72 && head.frost === 0.09)).toBe(true)
    expect(fixturePlan.washes).toHaveLength(1)
    expect(fixturePlan.leds.find(led => led.id.startsWith('fixture-ledBar'))).toMatchObject({ behavior: 2, segments: 16 })
    expect(fixturePlan.leds.find(led => led.id.startsWith('fixture-ledTube'))?.rotationRad).toBeCloseTo(Math.PI / 2, 6)
    expect(fixturePlan.videoSurfaces.find(surface => surface.id.startsWith('fixture-videoWall'))).toMatchObject({ sourceVariant: 2 })
    expect(fixturePlan.flashes.some(flash => flash.kind === 'strobe')).toBe(true)
    expect(fixturePlan.flashes.some(flash => flash.kind === 'blinder')).toBe(true)
    expect(fixturePlan.universalRibbonFixtureCount).toBe(0)
  })

  it('quality-scales moving-head prism work without changing sharp laser core semantics', () => {
    const frame = createFixtureScene()
    const viewport = { backingWidth: 1280, backingHeight: 720, cssWidth: 1280, cssHeight: 720 }
    const ultraLaser = buildLaserDmxWebGLBeamRenderPlan(frame, viewport)
    const ultraFixtures = buildLaserDmxDedicatedFixtureRenderPlan(frame, viewport)
    const lowFrame = {
      ...frame,
      quality: { ...frame.quality, qualityTier: 'low' as const },
      atmosphere: { ...frame.atmosphere, qualityTier: 'low' as const },
    }
    const lowLaser = buildLaserDmxWebGLBeamRenderPlan(lowFrame, viewport)
    const lowFixtures = buildLaserDmxDedicatedFixtureRenderPlan(lowFrame, viewport)

    expect(ultraLaser.depthPolicy.sliceCount).toBeGreaterThan(lowLaser.depthPolicy.sliceCount)
    expect(ultraFixtures.movingHeads).toHaveLength(5)
    expect(lowFixtures.movingHeads).toHaveLength(3)
    expect(lowLaser.beams.every(beam => beam.coreIntensity >= 0 && beam.coreIntensity <= 1)).toBe(true)
    expect(lowFixtures.movingHeads.reduce((sum, head) => sum + head.intensity, 0))
      .toBeCloseTo(ultraFixtures.movingHeads.reduce((sum, head) => sum + head.intensity, 0), 5)
  })

  it('emits deterministic CO₂ atmosphere, transient events, and partial beam occlusion', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    showDirector.settings.webglQuality = 'ultra'
    const laser = createDefaultLaserDmxShowDirectorFixture('laser', 'co2-crossing-laser', 0)
    laser.x = 7
    laser.y = 1
    laser.beam.targetMode = 'fixed'
    laser.beam.targetX = 7
    laser.beam.targetY = 8
    laser.beam.targets = [{ id: 'co2-crossing-target', x: 7, y: 8 }]
    const co2 = createDefaultLaserDmxShowDirectorFixture('co2Jet', 'fixture-co2Jet', 1)
    co2.x = 7
    co2.y = 5
    co2.brightness = 1
    co2.component.co2BurstDurationMs = 800
    showDirector.fixtures = [laser, co2]
    const frame = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 0,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'co2-occlusion-track',
      bpm: 142,
      beatIndex: 0,
      beatHit: true,
      downbeat: true,
    })
    const plan = buildLaserDmxWebGLBeamRenderPlan(frame, {
      backingWidth: 1920,
      backingHeight: 1080,
      cssWidth: 960,
      cssHeight: 540,
    })
    expect(frame.atmosphereSources.some(source => source.fixtureId === 'fixture-co2Jet')).toBe(true)
    expect(frame.transientEvents.some(event => event.kind === 'co2' && event.strength > 0)).toBe(true)
    expect(plan.beams.find(beam => beam.id.startsWith('co2-crossing-laser'))?.co2Occlusion).toBeGreaterThan(0)
    expect(buildLaserDmxWebGLBeamRenderPlan(frame, { backingWidth: 1920, backingHeight: 1080, cssWidth: 960, cssHeight: 540 })).toEqual(plan)

    const lifecycleFrames = Array.from({ length: 40 }, (_, index) => createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: index * 0.04,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'co2-occlusion-track',
      bpm: 142,
      beatIndex: index,
      beatHit: index % 4 === 0,
      downbeat: index % 16 === 0,
    }))
    const lifecycleSources = lifecycleFrames.map(sample =>
      sample.atmosphereSources.find(source => source.fixtureId === 'fixture-co2Jet')!,
    )
    expect(lifecycleSources.some(source => source.enabled && source.density > 0.001)).toBe(true)
    expect(lifecycleSources.some(source => !source.enabled && source.density === 0)).toBe(true)
    expect(lifecycleSources.every(source => source.ageSec >= 0 && source.lifetimeSec === 0.8)).toBe(true)
    expect(lifecycleSources.every(source => source.expansion >= 0 && source.expansion <= 1)).toBe(true)
    const inactiveIndex = lifecycleSources.findIndex(source => !source.enabled)
    expect(lifecycleFrames[inactiveIndex]?.transientEvents.some(event => event.kind === 'co2')).toBe(false)
  })

  it('degrades named primitives and strobes safely through the Canvas2D compiler', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    showDirector.settings.webglQuality = 'medium'
    const laser = createDefaultLaserDmxShowDirectorFixture('laser', 'fallback-laser', 0)
    laser.optics = { ...laser.optics, primitiveType: 'layeredFan', rayCount: 7, fanWidth: 64 }
    const strobe = createDefaultLaserDmxShowDirectorFixture('strobe', 'fallback-strobe', 1)
    strobe.component.strobeRate = 12
    showDirector.fixtures = [laser, strobe]
    const compiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })
    expect(compiled.beams.filter(beam => beam.id.startsWith('sd-fallback-laser-'))).toHaveLength(7)
    const strobeBeams = compiled.beams.filter(beam => beam.id.startsWith('sd-fallback-strobe-'))
    expect(strobeBeams).toHaveLength(1)
    expect(strobeBeams[0]?.appearance.geometry).toBe('volumetricCone')
  })
})
