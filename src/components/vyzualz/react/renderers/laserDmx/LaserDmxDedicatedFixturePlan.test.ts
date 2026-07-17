import { describe, expect, it } from 'vitest'
import { createDefaultLaserDmxBeamMatrixSettings, createDefaultLaserDmxShowDirectorFixture, createDefaultLaserDmxShowDirectorState } from '../../ReactTypes'
import { createLaserDmxSceneFrame } from './LaserDmxSceneFrame'
import { buildLaserDmxDedicatedFixtureRenderPlan } from './LaserDmxDedicatedFixturePlan'

function frameAt(time = 0) {
  const state = createDefaultLaserDmxShowDirectorState()
  state.settings.webglQuality = 'high'
  state.fixtures = ['movingHead', 'parWash', 'ledBar', 'ledTube', 'strobe', 'blinder', 'videoWall', 'haze', 'co2Jet'].map((kind, index) => {
    const fixture = createDefaultLaserDmxShowDirectorFixture(kind as Parameters<typeof createDefaultLaserDmxShowDirectorFixture>[0], `fixture-${kind}`, index)
    fixture.brightness = 1
    fixture.beam.beamEnabled = true
    fixture.optics.goboPattern = 'star'
    fixture.optics.goboAmount = 0.8
    fixture.optics.prismFacets = kind === 'movingHead' ? 3 : 1
    fixture.component.strobeRate = kind === 'strobe' ? 1 : fixture.component.strobeRate
    fixture.component.ledCellCount = 12
    fixture.component.ledDirection = 'chase'
    fixture.component.videoWallSource = 'media'
    return fixture
  })
  return createLaserDmxSceneFrame({
    showDirector: state, evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    audioTimeSec: time, deltaTimeSec: 1 / 60, isPlaying: true, timingDiscontinuity: false,
    trackKey: 'fixture-plan', bpm: 140, beatIndex: 0, beatHit: true, downbeat: true,
    kickHit: true, kickStrength: 1,
  })
}

describe('LaserDMX dedicated nonlaser fixture planning', () => {
  it('separates moving heads, washes, LEDs, flashes, video, haze, and CO2', () => {
    const plan = buildLaserDmxDedicatedFixtureRenderPlan(frameAt(), { backingWidth: 1280, backingHeight: 720, cssWidth: 1280, cssHeight: 720 })
    expect(plan.movingHeads).toHaveLength(3)
    expect(plan.washes).toHaveLength(1)
    expect(plan.leds).toHaveLength(2)
    expect(plan.flashes.some(flash => flash.kind === 'strobe')).toBe(true)
    expect(plan.flashes.some(flash => flash.kind === 'blinder')).toBe(true)
    expect(plan.videoSurfaces).toHaveLength(1)
    expect(plan.hazeSourceCount).toBeGreaterThan(0)
    expect(plan.co2SourceCount).toBeGreaterThan(0)
    expect(plan.universalRibbonFixtureCount).toBe(0)
  })

  it('projects real gobos and distinct moving-head prism copies', () => {
    const plan = buildLaserDmxDedicatedFixtureRenderPlan(frameAt(2), { backingWidth: 960, backingHeight: 540, cssWidth: 960, cssHeight: 540 })
    expect(new Set(plan.movingHeads.map(head => `${head.target.x.toFixed(5)}:${head.target.y.toFixed(5)}`)).size).toBe(3)
    expect(plan.movingHeads.every(head => head.goboPattern === 5 && head.goboAmount > 0)).toBe(true)
  })

  it('is deterministic for seek and loop reconstruction', () => {
    const viewport = { backingWidth: 800, backingHeight: 450, cssWidth: 800, cssHeight: 450 }
    expect(buildLaserDmxDedicatedFixtureRenderPlan(frameAt(8), viewport)).toEqual(buildLaserDmxDedicatedFixtureRenderPlan(frameAt(8), viewport))
  })
  it('maps moving-head zoom, iris, frost, focus, gobo rotation, and prism energy into cone instances', () => {
    const frame = frameAt(3)
    const fixture = frame.fixtures.find(candidate => candidate.kind === 'movingHead')!
    fixture.optics.zoom = 0.78
    fixture.optics.iris = 0.42
    fixture.optics.frost = 0.66
    fixture.optics.goboRotation = 35
    const beam = frame.beams.find(candidate => candidate.fixtureId === fixture.id)!
    beam.focus = 0.74
    const plan = buildLaserDmxDedicatedFixtureRenderPlan(frame, { backingWidth: 1280, backingHeight: 720, cssWidth: 1280, cssHeight: 720 })

    expect(plan.movingHeads).toHaveLength(3)
    expect(plan.movingHeads.every(head => head.zoom === 0.78 && head.iris === 0.42 && head.frost === 0.66 && head.focus === 0.74)).toBe(true)
    expect(plan.movingHeads[0]?.goboRotationRad).toBeCloseTo(35 * Math.PI / 180 + 3 * 0.22, 6)
    expect(plan.movingHeads.reduce((sum, head) => sum + head.intensity, 0)).toBeCloseTo(fixture.intensity * fixture.optics.sourceIntensity, 5)
  })

  it('keeps washes broad and soft without laser cores', () => {
    const plan = buildLaserDmxDedicatedFixtureRenderPlan(frameAt(), { backingWidth: 1280, backingHeight: 720, cssWidth: 1280, cssHeight: 720 })
    const wash = plan.washes[0]!
    expect(wash.fieldWidthCssPx).toBeGreaterThan(wash.sourceWidthCssPx * 4)
    expect(wash.edgeSoftness).toBeGreaterThanOrEqual(0.45)
    expect(wash.intensity).toBeGreaterThan(0)
  })

  it('emits strobe and blinder source pulses without narrow beam persistence', () => {
    const frame = frameAt()
    const plan = buildLaserDmxDedicatedFixtureRenderPlan(frame, { backingWidth: 1280, backingHeight: 720, cssWidth: 1280, cssHeight: 720 })
    const strobe = plan.flashes.find(flash => flash.kind === 'strobe')!
    const blinder = plan.flashes.find(flash => flash.kind === 'blinder')!

    expect(strobe.radiusCssPx).toBeGreaterThan(10)
    expect(strobe.atmosphereLift).toBeGreaterThan(0)
    expect(blinder.radiusCssPx).toBeGreaterThan(strobe.radiusCssPx)
    expect(blinder.warmth).toBeGreaterThan(0)
    expect(frame.scannerHeads.every(head => head.fixtureId !== strobe.id && head.fixtureId !== blinder.id)).toBe(true)
  })

  it('supports continuous tubes, segmented chases, and media-safe video surfaces', () => {
    const plan = buildLaserDmxDedicatedFixtureRenderPlan(frameAt(4), { backingWidth: 1280, backingHeight: 720, cssWidth: 1280, cssHeight: 720 })
    const ledBar = plan.leds.find(led => led.id.includes('ledBar'))!
    const ledTube = plan.leds.find(led => led.id.includes('ledTube'))!
    const video = plan.videoSurfaces[0]!

    expect(ledBar.segments).toBe(12)
    expect(ledBar.behavior).toBe(2)
    expect(ledTube.aspect).toBeLessThan(ledBar.aspect)
    expect(video.aspect).toBeCloseTo(16 / 9, 6)
    expect(video.sourceVariant).toBe(2)
    expect(video.intensity).toBeGreaterThan(0)
  })

})
