import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PRODUCTION_GROUP_MOVEMENT,
  DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS,
  buildProductionRig,
  deserializeLaserDmxSettings,
  normalizeLaserDmxSettings,
  normalizeLegacyLaserDmxFixture,
  serializeLaserDmxSettings,
  type ProductionGroupMovementConfig,
  type ProductionStageVector3,
} from '../../LaserDmxProductionRig'
import { createDefaultLaserDmxSettings, type LaserDmxFixture, type LaserDmxSettings } from '../../ReactTypes'
import {
  evaluateMovingHeadFixture,
  evaluateProductionGroupMovement,
  resetMovingHeadRuntime,
  resolveProfileAwareAngle,
  resolveMovementFixturePhase,
  solveMovingHeadPanTilt,
} from '../LaserDmxMovingHeadEngine'
import { compileLaserDmxFrame, resetLaserDmxCompilerState } from '../LaserDmxCompiler'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'

function movingFixture(id: string, x: number, targetId: string | null = 'target:center'): LaserDmxFixture {
  const base = createDefaultLaserDmxSettings().fixtures[0]
  return normalizeLegacyLaserDmxFixture({
    ...base,
    id,
    name: id,
    fixtureKind: 'movingHeadBeam',
    dmx: { ...base.dmx, profileId: 'genericMovingHeadBeam' },
    stageTransform: {
      position: { x, y: 6, z: 2 },
      orientation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0, panDeg: 0, tiltDeg: 0 },
    },
    targetId,
    movingHead: {
      ...DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS,
      panDeg: 0,
      tiltDeg: -20,
      panSpeedDegPerSec: 90,
      tiltSpeedDegPerSec: 90,
    },
    path: { ...base.path, kind: 'staticBeam' },
    modulationRoutes: [],
  })
}

function makeSettings(
  fixtures: LaserDmxFixture[] = [movingFixture('mh-1', 0)],
  movement?: Partial<ProductionGroupMovementConfig>,
): LaserDmxSettings {
  const defaults = createDefaultLaserDmxSettings()
  return normalizeLaserDmxSettings({
    ...defaults,
    selectedFixtureId: fixtures[0]?.id ?? null,
    fixtures,
    productionTargets: [{ id: 'target:center', name: 'Crowd Center', kind: 'point', position: { x: 0, y: 1.5, z: -5 } }],
    productionGroups: [{
      id: 'group:heads',
      name: 'Moving Heads',
      fixtureIds: fixtures.map(fixture => fixture.id),
      movement: { ...DEFAULT_PRODUCTION_GROUP_MOVEMENT, ...movement },
    }],
  })
}

function runAtFrameRate(settings: LaserDmxSettings, fps: number, durationSec: number) {
  resetMovingHeadRuntime()
  const fixture = settings.fixtures[0]
  const rig = buildProductionRig(settings)
  let frame = evaluateMovingHeadFixture({ fixture, rig, timeSec: 0, bpm: 120, shutterOpen: true })
  for (let frameIndex = 1; frameIndex <= Math.round(durationSec * fps); frameIndex += 1) {
    frame = evaluateMovingHeadFixture({ fixture, rig, timeSec: frameIndex / fps, bpm: 120, shutterOpen: true })
  }
  return frame
}

beforeEach(() => {
  resetMovingHeadRuntime()
  resetLaserDmxCompilerState()
})

describe('LaserDMX moving-head motion engine', () => {
  it('solves profile-aware pan and tilt from stage coordinates', () => {
    const origin: ProductionStageVector3 = { x: 0, y: 0, z: 0 }
    const capability = { panRangeDeg: 540, tiltRangeDeg: 270 }
    const forward = solveMovingHeadPanTilt(origin, { x: 0, y: 0, z: 10 }, { yawDeg: 0, pitchDeg: 0 }, capability)
    const stageRight = solveMovingHeadPanTilt(origin, { x: 10, y: 0, z: 0 }, { yawDeg: 0, pitchDeg: 0 }, capability)
    expect(forward.panDeg).toBeCloseTo(0, 6)
    expect(forward.tiltDeg).toBeCloseTo(0, 6)
    expect(stageRight.panDeg).toBeCloseTo(90, 6)
    expect(stageRight.tiltDeg).toBeCloseTo(0, 6)
    expect(resolveProfileAwareAngle(260, -260, 540)).toBeCloseTo(100, 6)
  })

  it('interpolates instead of teleporting unless a snap action is requested', () => {
    const settings = makeSettings()
    const fixture = settings.fixtures[0]
    const rig = buildProductionRig(settings)
    const initial = evaluateMovingHeadFixture({ fixture, rig, timeSec: 0, bpm: 120, shutterOpen: true })
    const moving = evaluateMovingHeadFixture({ fixture, rig, timeSec: 0.1, bpm: 120, shutterOpen: true })
    expect(moving.panDeg).not.toBe(initial.panDeg)
    expect(moving.movementComplete).toBe(false)

    const snappedFixture = { ...fixture, movingHead: { ...fixture.movingHead!, snapRequestId: 1 } }
    const snappedRig = buildProductionRig({ ...settings, fixtures: [snappedFixture] })
    const snapped = evaluateMovingHeadFixture({ fixture: snappedFixture, rig: snappedRig, timeSec: 0.11, bpm: 120, shutterOpen: true })
    expect(snapped.movementComplete).toBe(true)
    expect(Math.abs(snapped.panDeg - moving.panDeg)).toBeGreaterThan(1)
  })

  it('mirrors paired fixtures and applies phase offsets deterministically', () => {
    const config: ProductionGroupMovementConfig = {
      ...DEFAULT_PRODUCTION_GROUP_MOVEMENT,
      enabled: true,
      generator: 'mirroredFan',
      symmetry: 'mirrorPairs',
      phaseSpread: 0.2,
    }
    const left = evaluateProductionGroupMovement(config, 0, 4, 0.5, 120)
    const right = evaluateProductionGroupMovement(config, 3, 4, 0.5, 120)
    expect(left.phase).toBeCloseTo(right.phase, 8)
    expect(left.panOffsetDeg).toBeCloseTo(-right.panOffsetDeg, 8)
    expect(left.tiltOffsetDeg).toBeCloseTo(right.tiltOffsetDeg, 8)

    const base = resolveMovementFixturePhase({ ...config, symmetry: 'none', phaseOffset: 0 }, 1, 4, 0, 120)
    const shifted = resolveMovementFixturePhase({ ...config, symmetry: 'none', phaseOffset: 0.25 }, 1, 4, 0, 120)
    expect((shifted - base + 1) % 1).toBeCloseTo(0.25, 8)
  })

  it('evaluates every typed group generator without non-finite output', () => {
    const generators: ProductionGroupMovementConfig['generator'][] = [
      'mirroredFan', 'fanOpen', 'fanClose', 'centerOutSpread', 'outsideInCollapse',
      'crossfire', 'tunnel', 'ceilingCanopy', 'crowdScan', 'pendulum', 'figureEight',
      'panWave', 'tiltWave', 'alternatingBanks', 'staticAerialHold',
    ]
    for (const generator of generators) {
      const sample = evaluateProductionGroupMovement({
        ...DEFAULT_PRODUCTION_GROUP_MOVEMENT,
        enabled: true,
        generator,
      }, 2, 6, 1.25, 128)
      expect(Number.isFinite(sample.panOffsetDeg), generator).toBe(true)
      expect(Number.isFinite(sample.tiltOffsetDeg), generator).toBe(true)
      expect(sample.phase, generator).toBeGreaterThanOrEqual(0)
      expect(sample.phase, generator).toBeLessThan(1)
    }
  })

  it('produces the same result across different render frame rates', () => {
    const settings = makeSettings([movingFixture('mh-deterministic', 0)], {
      enabled: true,
      generator: 'figureEight',
      symmetry: 'none',
      phaseSpread: 0,
      speed: 1.25,
    })
    const at30 = runAtFrameRate(settings, 30, 1.5)
    const at60 = runAtFrameRate(settings, 60, 1.5)
    expect(at30.panDeg).toBeCloseTo(at60.panDeg, 7)
    expect(at30.tiltDeg).toBeCloseTo(at60.tiltDeg, 7)
  })

  it('falls back to the manual pose when a tracked target is lost', () => {
    const fixture = movingFixture('mh-lost-target', 0, 'target:missing')
    fixture.movingHead = { ...fixture.movingHead!, panDeg: 22, tiltDeg: -14, targetTracking: true }
    const settings = makeSettings([fixture])
    const rig = buildProductionRig(settings)
    const frame = evaluateMovingHeadFixture({ fixture: settings.fixtures[0], rig, timeSec: 0, bpm: 120, shutterOpen: true })
    expect(frame.targetAvailable).toBe(false)
    expect(frame.panDeg).toBeCloseTo(22, 8)
    expect(frame.tiltDeg).toBeCloseTo(-14, 8)
  })

  it('pre-positions while shuttered only when the fixture or active group allows it', () => {
    const fixture = movingFixture('mh-preposition', 0)
    fixture.movingHead = { ...fixture.movingHead!, prePositionWhileShuttered: false }
    const settings = makeSettings([fixture], { enabled: false, prePositionWhileShuttered: false })
    const rig = buildProductionRig(settings)
    const initial = evaluateMovingHeadFixture({ fixture: settings.fixtures[0], rig, timeSec: 0, bpm: 120, shutterOpen: false })
    const held = evaluateMovingHeadFixture({ fixture: settings.fixtures[0], rig, timeSec: 0.5, bpm: 120, shutterOpen: false })
    expect(held.panDeg).toBeCloseTo(initial.panDeg, 10)
    expect(held.tiltDeg).toBeCloseTo(initial.tiltDeg, 10)

    const enabledFixture = {
      ...settings.fixtures[0],
      movingHead: { ...settings.fixtures[0].movingHead!, prePositionWhileShuttered: true },
    }
    const enabledSettings = makeSettings([enabledFixture], { enabled: false, prePositionWhileShuttered: false })
    const enabledRig = buildProductionRig(enabledSettings)
    resetMovingHeadRuntime()
    evaluateMovingHeadFixture({ fixture: enabledSettings.fixtures[0], rig: enabledRig, timeSec: 0, bpm: 120, shutterOpen: false })
    const prePositioned = evaluateMovingHeadFixture({ fixture: enabledSettings.fixtures[0], rig: enabledRig, timeSec: 0.5, bpm: 120, shutterOpen: false })
    expect(prePositioned.panDeg).not.toBeCloseTo(initial.panDeg, 5)
  })

  it('resolves seeks without replaying elapsed frames and preserves pause/resume state', () => {
    const settings = makeSettings([movingFixture('mh-seek', 0)], { enabled: true, generator: 'pendulum' })
    const fixture = settings.fixtures[0]
    const rig = buildProductionRig(settings)
    evaluateMovingHeadFixture({ fixture, rig, timeSec: 0, bpm: 120, shutterOpen: true })
    const beforePause = evaluateMovingHeadFixture({ fixture, rig, timeSec: 0.5, bpm: 120, shutterOpen: true })
    const paused = evaluateMovingHeadFixture({ fixture, rig, timeSec: 0.5, bpm: 120, shutterOpen: true })
    expect(paused.panDeg).toBeCloseTo(beforePause.panDeg, 10)
    expect(paused.tiltDeg).toBeCloseTo(beforePause.tiltDeg, 10)

    const resumed = evaluateMovingHeadFixture({ fixture, rig, timeSec: 0.75, bpm: 120, shutterOpen: true })
    expect(resumed.panDeg).not.toBeCloseTo(paused.panDeg, 5)

    const sought = evaluateMovingHeadFixture({ fixture, rig, timeSec: 5, bpm: 120, shutterOpen: true })
    expect(sought.movementComplete).toBe(true)
    expect(Number.isFinite(sought.panDeg)).toBe(true)
    expect(Number.isFinite(sought.tiltDeg)).toBe(true)
  })

  it('round-trips moving-head and group movement configuration through persistence', () => {
    const fixtures = [movingFixture('mh-left', -2), movingFixture('mh-right', 2)]
    fixtures[0].movingHead = { ...fixtures[0].movingHead!, goboIndex: 3, prismFacets: 8, prePositionWhileShuttered: false }
    const settings = makeSettings(fixtures, {
      enabled: true,
      generator: 'crossfire',
      direction: 'reverse',
      phaseOffset: 0.35,
      quantize: 'phrase',
      centerPoint: { x: 1, y: 2, z: -6 },
    })
    const restored = deserializeLaserDmxSettings(serializeLaserDmxSettings(settings))
    expect(restored.fixtures[0].movingHead).toMatchObject({ goboIndex: 3, prismFacets: 8, prePositionWhileShuttered: false })
    expect(restored.productionGroups?.[0].movement).toMatchObject({
      enabled: true,
      generator: 'crossfire',
      direction: 'reverse',
      phaseOffset: 0.35,
      quantize: 'phrase',
      centerPoint: { x: 1, y: 2, z: -6 },
    })
  })

  it('compiles capability-gated wash optics through the shared production rig', () => {
    const fixture = movingFixture('mh-wash', 0)
    fixture.fixtureKind = 'movingHeadWash'
    fixture.dmx = { ...fixture.dmx, profileId: 'genericMovingHeadWash' }
    fixture.beam = { ...fixture.beam, shutterOpen: false, zoom: 0.72 }
    fixture.movingHead = { ...fixture.movingHead!, frost: 0.4, goboIndex: 4, prismFacets: 8 }
    const settings = makeSettings([fixture])
    const result = compileLaserDmxFrame({
      settings,
      mi: { rhythm: { bpm: 120 } } as MusicIntelligenceFrame,
      time: 1,
      timeSec: 0.25,
      canvasWidth: 1280,
      canvasHeight: 720,
    })
    const frame = result.fixtures[0]
    expect(frame.visual.movingHead).toMatchObject({ zoom: 0.72, frost: 0.4, goboIndex: 0, prismFacets: 0 })
    expect(frame.visual.intensity).toBe(0)
    expect(Object.keys(frame.channels)).toEqual(Array.from({ length: 11 }, (_, index) => `ch${index + 1}`))
    expect(result.productionRig.fixtures[0].properties.goboIndex).toBeUndefined()
    expect(result.productionRig.fixtures[0].properties.prismFacets).toBeUndefined()
  })
})
