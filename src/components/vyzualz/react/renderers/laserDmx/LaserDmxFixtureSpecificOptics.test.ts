import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  type LaserDmxShowDirectorFixtureKind,
} from '../../ReactTypes'
import { compileLaserDmxShowDirectorToBeamMatrix } from '../LaserDmxShowDirectorBeamMatrixCompiler'
import { resolveLaserDmxBeamOpticalProfile } from './LaserDmxBeamOptics'
import { createLaserDmxSceneFrame } from './LaserDmxSceneFrame'
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
      prismFacets: kind === 'laser' || kind === 'movingHead' ? 3 : 1,
    }
    if (kind === 'strobe') fixture.component.strobeRate = 1
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

  it('compiles line-capable fixtures to separate shader materials and physical sources to distinct aperture shapes', () => {
    const frame = createFixtureScene()
    const plan = buildLaserDmxWebGLBeamRenderPlan(frame, {
      backingWidth: 1920,
      backingHeight: 1080,
      cssWidth: 960,
      cssHeight: 540,
    })
    expect(new Set(plan.beams.map(beam => beam.materialMode))).toEqual(new Set([0, 1, 2]))
    expect(plan.beams.find(beam => beam.id.startsWith('fixture-laser'))).toMatchObject({ goboAmount: 0, prismAmount: 0.5 })
    expect(plan.beams.find(beam => beam.id.startsWith('fixture-movingHead'))).toMatchObject({ goboAmount: 0.75, prismAmount: 0.5 })
    expect(new Set(plan.apertures.map(aperture => aperture.shapeMode))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]))
    expect(plan.beams.some(beam => beam.id.startsWith('fixture-strobe'))).toBe(false)
    expect(plan.beams.some(beam => beam.id.startsWith('fixture-ledBar'))).toBe(false)
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
  })

  it('degrades named primitives and strobes safely through the Canvas2D compiler', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
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
