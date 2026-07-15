import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  type LaserDmxShowDirectorOpticalPrimitiveType,
} from './ReactTypes'
import { createLaserDmxShowDirectorBeamBudgetReport } from './LaserDmxShowDirectorBeamBudget'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from './LaserDmxShowDirectorPerformancePresets'
import { migrateLaserDmxShowDirectorToProfessionalOptics } from './LaserDmxShowDirectorProfessionalOpticsMigration'
import { compileLaserDmxShowDirectorToBeamMatrix } from './renderers/LaserDmxShowDirectorBeamMatrixCompiler'

function ids(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-${++index}`
}

const ACCEPTED_SHOW_IDS = ['prism-cathedral', 'cardinal-fan-reactor', 'cyan-mirror-cage'] as const
const RIG_MIGRATION_IDS = [
  'small-club-rig-performance',
  'festival-front-beams-performance',
  'dubstep-drop-lasers-performance',
  'led-bar-grid-performance',
  'moving-head-sweep-performance',
  'strobe-blinder-hits-performance',
  'haze-co2-drops-performance',
] as const

describe('Show Director professional optics migration', () => {
  it('changes presentation metadata without changing fixture identity, targeting, or timing data', () => {
    const state = createDefaultLaserDmxShowDirectorState()
    const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'preserved-fixture', 0)
    fixture.semanticKey = 'cathedral-apex-center'
    fixture.beam.targetX = 4.25
    fixture.beam.targetY = 6.75
    fixture.beam.targets = [
      { id: 'target-a', x: 4.25, y: 6.75 },
      { id: 'target-b', x: 10.5, y: 7.25 },
    ]
    fixture.trigger.mode = 'phrase'
    fixture.trigger.phraseLengthBars = 16
    state.fixtures = [fixture]
    const before = structuredClone(state)

    const migrated = migrateLaserDmxShowDirectorToProfessionalOptics('prism-cathedral', state)
    expect(migrated.fixtures[0]).toMatchObject({
      id: before.fixtures[0]?.id,
      semanticKey: before.fixtures[0]?.semanticKey,
      beam: { targets: before.fixtures[0]?.beam.targets },
      trigger: before.fixtures[0]?.trigger,
      optics: { primitiveType: 'diamondPlane', prismFacets: 3 },
    })
    expect(state).toEqual(before)
  })

  it('assigns recognizable professional structures to the three accepted show identities', () => {
    const expected: Record<(typeof ACCEPTED_SHOW_IDS)[number], Set<LaserDmxShowDirectorOpticalPrimitiveType>> = {
      'prism-cathedral': new Set(['diamondPlane', 'canopy', 'layeredFan']),
      'cardinal-fan-reactor': new Set(['crossBank', 'audienceRake', 'layeredFan']),
      'cyan-mirror-cage': new Set(['mirroredCorridor', 'rotatingLattice', 'tunnel']),
    }
    for (const showId of ACCEPTED_SHOW_IDS) {
      const preset = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(candidate => candidate.id === showId)!
      const rig = preset.createRig(ids(showId))
      const laserPrimitives = new Set(rig.fixtures.filter(fixture => fixture.kind === 'laser').map(fixture => fixture.optics.primitiveType))
      for (const primitive of expected[showId]) expect(laserPrimitives.has(primitive), `${showId}:${primitive}`).toBe(true)
      expect(rig.fixtures.some(fixture => fixture.optics.atmosphereResponse >= 0.9)).toBe(true)
      expect(new Set(rig.fixtures.map(fixture => fixture.depthLayer)).size).toBeGreaterThan(1)
    }
  })

  it('migrates converted Rig Layout shows with fixture-specific optics and keeps Canvas fallback compatible', () => {
    for (const showId of RIG_MIGRATION_IDS) {
      const preset = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(candidate => candidate.id === showId)!
      const rig = preset.createRig(ids(showId))
      const compiled = compileLaserDmxShowDirectorToBeamMatrix({
        showDirector: rig,
        beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      })
      expect(compiled.beams.length, showId).toBeGreaterThan(0)
      expect(compiled.beams.length, showId).toBeLessThanOrEqual(300)
      if (rig.fixtures.some(fixture => fixture.kind === 'strobe')) {
        expect(compiled.beams.filter(beam => beam.name.toLowerCase().includes('strobe')).every(beam => beam.appearance.geometry === 'volumetricCone')).toBe(true)
      }
      if (rig.fixtures.some(fixture => fixture.kind === 'co2Jet')) {
        expect(compiled.beams.some(beam => beam.name.toLowerCase().includes('co2'))).toBe(true)
      }
    }
  })

  it('is deterministic and enforces the global beam budget after migration', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS) {
      const first = preset.createRig(ids(`${preset.id}-deterministic`))
      const second = preset.createRig(ids(`${preset.id}-deterministic`))
      expect(second).toEqual(first)
      const report = createLaserDmxShowDirectorBeamBudgetReport(first.fixtures)
      expect(report.boundedDemand, preset.id).toBeLessThanOrEqual(300)
      expect(report.fixtures.reduce((sum, fixture) => sum + fixture.allocatedDemand, 0)).toBe(report.boundedDemand)
    }
  })
})
