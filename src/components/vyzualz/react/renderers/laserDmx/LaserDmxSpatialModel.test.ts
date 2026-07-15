import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
} from '../../ReactTypes'
import {
  LASER_DMX_FRONT_LOCKED_CAMERA,
  createLaserDmxSceneFrame,
} from './LaserDmxSceneFrame'
import {
  LASER_DMX_SCENE_DEPTH_ZONES,
  projectLaserDmxScenePoint,
  resolveLaserDmxFixtureDepth,
  resolveLaserDmxTargetDepth,
} from './LaserDmxSpatialModel'

function frameFor(fixtures: ReturnType<typeof createDefaultLaserDmxShowDirectorFixture>[], audioTimeSec = 0) {
  const showDirector = createDefaultLaserDmxShowDirectorState()
  showDirector.fixtures = fixtures
  return createLaserDmxSceneFrame({
    showDirector,
    evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    audioTimeSec,
    deltaTimeSec: 1 / 60,
    isPlaying: true,
    timingDiscontinuity: false,
    trackKey: 'depth-test-track',
    bpm: 150,
    beatIndex: Math.floor(audioTimeSec * 2.5),
    barIndex: Math.floor(audioTimeSec * 0.625),
    phraseIndex: Math.floor(audioTimeSec * 0.078125),
  })
}

describe('LaserDMX locked camera and invisible depth semantics', () => {
  it('keeps one immutable frontLocked camera with no public movement paths', () => {
    const first = frameFor([], 0)
    const afterSeek = frameFor([], 83.25)

    expect(first.camera).toBe(LASER_DMX_FRONT_LOCKED_CAMERA)
    expect(afterSeek.camera).toBe(LASER_DMX_FRONT_LOCKED_CAMERA)
    expect(first.camera).toMatchObject({
      id: 'frontLocked',
      locked: true,
      projection: 'orthographicDepth',
      controls: {
        pan: false,
        orbit: false,
        roll: false,
        animate: false,
        presetOverride: false,
      },
    })
  })

  it('infers deterministic invisible air zones from fixture role and target mode', () => {
    const rearDiamond = createDefaultLaserDmxShowDirectorFixture('laser', 'rear-diamond', 0)
    rearDiamond.semanticKey = 'rear-geometric-diamond'
    const canopy = createDefaultLaserDmxShowDirectorFixture('laser', 'canopy', 1)
    canopy.semanticKey = 'ceiling-canopy'
    const lowRake = createDefaultLaserDmxShowDirectorFixture('parWash', 'low-rake', 2)
    lowRake.semanticKey = 'low-audience-rake'
    const corridor = createDefaultLaserDmxShowDirectorFixture('laser', 'corridor-left', 3)
    corridor.semanticKey = 'mirror-corridor-left'
    corridor.linkedPairId = 'mirror-corridor-pair'
    corridor.beam.targetMode = 'mirror'

    expect(resolveLaserDmxFixtureDepth(rearDiamond, 0.3).zoneId).toBe('deepAir')
    expect(resolveLaserDmxFixtureDepth(canopy, 0.2).zoneId).toBe('upperAir')
    expect(resolveLaserDmxFixtureDepth(lowRake, 0.8).zoneId).toBe('lowerAir')

    const origin = { x: 0.2, y: 0.4, z: 0 }
    const zones = [0, 1, 2].map(targetIndex => resolveLaserDmxTargetDepth({
      fixture: corridor,
      target: { id: `target-${targetIndex}`, x: 7, y: 4 },
      targetIndex,
      origin,
      normalizedTarget: { x: 0.5, y: 0.5 },
    }).zoneId)
    expect(new Set(zones)).toEqual(new Set(['frontAir', 'midAir', 'deepAir']))
    expect(zones).toEqual([0, 1, 2].map(targetIndex => resolveLaserDmxTargetDepth({
      fixture: corridor,
      target: { id: `target-${targetIndex}`, x: 7, y: 4 },
      targetIndex,
      origin,
      normalizedTarget: { x: 0.5, y: 0.5 },
    }).zoneId))
  })

  it('honors explicit fixture and target layers without exposing raw 3D editing', () => {
    const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'explicit-depth', 0)
    fixture.depthLayer = 'frontAir'
    fixture.beam.targetDepthLayer = 'deepAir'
    fixture.beam.targets = [{ id: 'explicit-target', x: 9.25, y: 5.5 }]
    fixture.beam.targetX = 9.25
    fixture.beam.targetY = 5.5

    const frame = frameFor([fixture])
    expect(frame.fixtures[0]).toMatchObject({ depthZone: 'frontAir', depthSource: 'explicitLayer' })
    expect(frame.targets[0]).toMatchObject({ depthZone: 'deepAir', depthSource: 'explicitLayer' })
    expect(frame.beams[0]?.startDepth).toBeGreaterThan(frame.beams[0]?.endDepth ?? 0)
  })

  it('expands fan and mirror patterns directly in continuous scene geometry', () => {
    const fan = createDefaultLaserDmxShowDirectorFixture('laser', 'direct-fan', 0)
    fan.x = 7.125
    fan.y = 4.375
    fan.beam.targetMode = 'fan'
    fan.beam.beamSpread = 36

    const mirror = createDefaultLaserDmxShowDirectorFixture('laser', 'direct-mirror', 1)
    mirror.x = 7
    mirror.y = 4
    mirror.beam.targetMode = 'mirror'
    mirror.beam.beamSpread = 30

    const frame = frameFor([fan, mirror])
    const fanBeams = frame.beams.filter(beam => beam.fixtureId === fan.id)
    const mirrorBeams = frame.beams.filter(beam => beam.fixtureId === mirror.id)

    expect(fanBeams).toHaveLength(4)
    expect(new Set(fanBeams.map(beam => `${beam.target.x.toFixed(6)}:${beam.target.y.toFixed(6)}`)).size).toBe(4)
    expect(mirrorBeams).toHaveLength(2)
    expect(mirrorBeams[0]?.direction.y).not.toBeCloseTo(mirrorBeams[1]?.direction.y ?? 0, 8)
    expect(mirrorBeams[0]?.sortDepth).not.toBe(mirrorBeams[1]?.sortDepth)
  })

  it('preserves mirrored X/Y composition while assigning equal deterministic depth', () => {
    const left = createDefaultLaserDmxShowDirectorFixture('laser', 'mirror-left', 0)
    left.semanticKey = 'cyan-corridor-left'
    left.linkedPairId = 'cyan-corridor-pair'
    left.x = 2.125
    left.y = 2.75
    left.beam.targetX = 5.5
    left.beam.targetY = 6.25
    left.beam.targets = [{ id: 'left-target', x: 5.5, y: 6.25 }]

    const right = structuredClone(left)
    right.id = 'mirror-right'
    right.semanticKey = 'cyan-corridor-right'
    right.x = 14 - left.x
    right.beam.targetX = 14 - (left.beam.targetX ?? 0)
    right.beam.targets = [{ id: 'right-target', x: right.beam.targetX, y: 6.25 }]

    const frame = frameFor([left, right])
    const [leftFixture, rightFixture] = frame.fixtures
    expect((leftFixture?.position.x ?? 0) + (rightFixture?.position.x ?? 0)).toBeCloseTo(1, 10)
    expect(leftFixture?.position.y).toBeCloseTo(rightFixture?.position.y ?? 0, 10)
    expect(leftFixture?.position.z).toBeCloseTo(rightFixture?.position.z ?? 0, 10)

    const leftProjection = projectLaserDmxScenePoint(frame.camera, leftFixture!.position)
    const rightProjection = projectLaserDmxScenePoint(frame.camera, rightFixture!.position)
    expect(leftProjection.x + rightProjection.x).toBeCloseTo(1, 10)
    expect(leftProjection.y).toBeCloseTo(rightProjection.y, 10)
  })

  it('allows shared screen coordinates on separate depth planes with restrained parallax', () => {
    const point = { x: 0.5, y: 0.5 }
    const front = projectLaserDmxScenePoint(LASER_DMX_FRONT_LOCKED_CAMERA, { ...point, z: 0.48 })
    const rear = projectLaserDmxScenePoint(LASER_DMX_FRONT_LOCKED_CAMERA, { ...point, z: -0.52 })

    expect(front.x).toBe(rear.x)
    expect(Math.abs(front.y - rear.y)).toBeLessThanOrEqual(0.0121)
    expect(front.clipDepth).not.toBe(rear.clipDepth)
  })

  it('normalizes legacy projects and deterministically rebuilds depth after seek or loop', () => {
    const legacy = normalizeLaserDmxShowDirectorState({
      schemaVersion: 8,
      settings: createDefaultLaserDmxShowDirectorState().settings,
      fixtures: [{
        schemaVersion: 8,
        id: 'legacy-fan',
        kind: 'laser',
        label: 'Static Fan',
        enabled: true,
        x: 3.25,
        y: 2.5,
        z: 0,
        rotation: 0,
        color: '#4ac7db',
        colorMode: 'fixed',
        brightness: 0.85,
        beam: {
          beamEnabled: true,
          beamAngle: 0,
          beamSpread: 18,
          focus: 0.8,
          targetMode: 'fan',
          targetX: 10.75,
          targetY: 7.5,
          targetZ: 0,
          targets: [{ id: 'legacy-target', x: 10.75, y: 7.5 }],
        },
      }],
    })
    const before = frameFor(legacy.fixtures, 8)
    const afterSeek = frameFor(legacy.fixtures, 96)
    const afterLoop = frameFor(legacy.fixtures, 8)
    const currentRoundTrip = normalizeLaserDmxShowDirectorState(legacy)
    const afterReload = frameFor(currentRoundTrip.fixtures, 8)

    expect(legacy.fixtures[0]?.depthLayer).toBe('auto')
    expect(before.fixtures[0]?.position.x * 14).toBeCloseTo(3.25, 8)
    expect(legacy.fixtures[0]?.beam.targets?.[0]?.id).toBe('legacy-target')
    expect(before.targets).toHaveLength(3)
    expect(afterSeek.fixtures.map(item => [item.depthZone, item.position.z])).toEqual(before.fixtures.map(item => [item.depthZone, item.position.z]))
    expect(afterSeek.targets.map(item => [item.depthZone, item.position.z])).toEqual(before.targets.map(item => [item.depthZone, item.position.z]))
    expect(afterLoop.depthOrdering).toEqual(before.depthOrdering)
    expect(afterReload.fixtures.map(item => [item.depthZone, item.position.z])).toEqual(before.fixtures.map(item => [item.depthZone, item.position.z]))
    expect(afterReload.targets.map(item => [item.depthZone, item.position.z])).toEqual(before.targets.map(item => [item.depthZone, item.position.z]))
  })

  it('adds only invisible reference volumes and no venue render geometry', () => {
    const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'no-venue', 0)
    const frame = frameFor([fixture])

    expect(LASER_DMX_SCENE_DEPTH_ZONES.every(depthZone => depthZone.visible === false)).toBe(true)
    expect(frame.depthZones).toBe(LASER_DMX_SCENE_DEPTH_ZONES)
    expect(frame).not.toHaveProperty('walls')
    expect(frame).not.toHaveProperty('floor')
    expect(frame).not.toHaveProperty('ceiling')
    expect(frame).not.toHaveProperty('audience')
    expect(frame).not.toHaveProperty('venueGeometry')
  })
})
