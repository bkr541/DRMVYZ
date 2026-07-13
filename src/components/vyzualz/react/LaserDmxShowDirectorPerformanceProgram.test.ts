import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
} from './ReactTypes'
import {
  LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY,
  applyLaserDmxShowDirectorPerformanceProgramState,
  clearLaserDmxShowDirectorPerformanceProgramState,
  cloneLaserDmxShowDirectorPerformanceProgram,
  createDefaultLaserDmxShowDirectorPerformanceState,
  normalizeLaserDmxShowDirectorPerformanceProgram,
  normalizeLaserDmxShowDirectorPerformanceState,
  type LaserDmxShowDirectorPerformanceProgram,
} from './LaserDmxShowDirectorPerformanceProgram'
import { LASER_DMX_SHOW_DIRECTOR_TEMPLATES, createLaserDmxShowDirectorTemplateState } from './laserDmxShowDirectorTemplates'
import { mergeReactStoreState, migrateReactStore, reactStorePartialize, useReactStore } from '../../../stores/reactStore'

function program(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 1,
    id: 'test-program',
    name: 'Test Program',
    deterministicSeed: 42,
    tuning: { intensity: 1, variation: 0.8, audioIntelligenceResponse: 1, transitionScale: 1 },
    scenes: [{
      id: 'drop-one',
      label: 'Drop One',
      enabled: true,
      section: { types: ['drop'], occurrence: { occurrences: [1] } },
      fixture: { brightness: 0.9 },
      fourBarVariations: [{ id: 'four-bars', address: { fixtureSemanticKeys: ['outer-left'] }, fixture: { rotation: 15 } }],
    }],
  }
}

describe('Show Director performance-program foundation', () => {
  it('normalizes missing and malformed performance data to a disabled state', () => {
    expect(normalizeLaserDmxShowDirectorPerformanceState(undefined)).toEqual(createDefaultLaserDmxShowDirectorPerformanceState())
    const malformed = normalizeLaserDmxShowDirectorPerformanceState({ enabled: true, activeProgramDefinition: { id: 'bad' } })
    expect(malformed.enabled).toBe(false)
    expect(malformed.activeProgramDefinition).toBeNull()
    expect(malformed.activeProgramId).toBeNull()
  })

  it('hydrates legacy built-in ID-only state from the current registry and suppresses missing IDs', () => {
    const hydrated = normalizeLaserDmxShowDirectorPerformanceState({
      enabled: true,
      activeProgramId: 'prism-cathedral',
      activeBuiltInProgramId: 'prism-cathedral',
    })
    expect(hydrated.enabled).toBe(true)
    expect(hydrated.activeProgramId).toBe('prism-cathedral')
    expect(hydrated.activeProgramDefinition?.id).toBe('prism-cathedral')
    expect(hydrated.activeProgramDefinition).not.toBe(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY['prism-cathedral'].program)

    const missing = normalizeLaserDmxShowDirectorPerformanceState({ enabled: true, activeProgramId: 'removed-built-in' })
    expect(missing.enabled).toBe(false)
    expect(missing.activeProgramDefinition).toBeNull()
    expect(missing.activeProgramId).toBeNull()
  })

  it('serializes, clones, and normalizes programs idempotently', () => {
    const normalized = normalizeLaserDmxShowDirectorPerformanceProgram(program())
    expect(normalized).not.toBeNull()
    const clone = cloneLaserDmxShowDirectorPerformanceProgram(normalized!)
    expect(clone).toEqual(normalized)
    expect(clone).not.toBe(normalized)
    expect(normalizeLaserDmxShowDirectorPerformanceProgram(normalized)).toEqual(normalized)
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized)
  })


  it('deep-normalizes nested mutations, targets, conditions, transitions, and output values', () => {
    const malformed = {
      ...program(),
      scenes: [{
        ...program().scenes[0],
        transitionIn: { durationBars: -5, durationMs: 999999, curve: 'bogus' },
        beatMutations: [{
          id: 'deep', beatOffsets: [-2, 3, 3], beatCycleLength: 0, probability: 4,
          address: { fixtureSemanticKeys: [' A ', 'A'], fixtureKinds: ['laser', 'bogus'] },
          fixture: {
            brightness: 8, fanSpread: 900, targetMode: 'bogus', participatingGroupSemanticKeys: [' Group A '],
            targetPoints: Array.from({ length: 20 }, (_, index) => ({ id: `point-${index}`, x: index * 100, y: -index * 100 })),
            targetPointsByFixtureSemanticKey: {
              ' Hero Fixture ': Array.from({ length: 20 }, (_, index) => ({ id: `hero-point-${index}`, x: index * 100, y: -index * 100 })),
              '': [{ id: 'discarded-empty-key', x: 1, y: 1 }],
            },
            beamAppearance: { geometry: 'bogus', width: 999, glow: -2 },
          },
          global: { globalGlow: 3, dimmer: -1, globalBeamWidth: 99 },
          conditions: [{ source: ' energy ', operator: 'gte', value: 0.5 }, { source: '', operator: 'gte' }],
        }],
      }],
    }
    const normalized = normalizeLaserDmxShowDirectorPerformanceProgram(malformed)!
    const scene = normalized.scenes[0]!
    const mutation = scene.beatMutations![0]!
    expect(normalized.schemaVersion).toBe(3)
    expect(scene.transitionIn).toMatchObject({ durationBars: 0, durationMs: 120000 })
    expect(scene.transitionIn?.curve).toBeUndefined()
    expect(mutation.probability).toBe(1)
    expect(mutation.beatOffsets).toEqual([0, 3])
    expect(mutation.beatCycleLength).toBe(1)
    expect(mutation.address?.fixtureSemanticKeys).toEqual(['A'])
    expect(mutation.address?.fixtureKinds).toEqual(['laser'])
    expect(mutation.fixture?.brightness).toBe(2)
    expect(mutation.fixture?.fanSpread).toBe(180)
    expect(mutation.fixture?.targetMode).toBeUndefined()
    expect(mutation.fixture?.targetPoints).toHaveLength(12)
    expect(Object.keys(mutation.fixture?.targetPointsByFixtureSemanticKey ?? {})).toEqual(['Hero Fixture'])
    expect(mutation.fixture?.targetPointsByFixtureSemanticKey?.['Hero Fixture']).toHaveLength(12)
    expect(mutation.fixture?.participatingGroupSemanticKeys).toEqual(['Group A'])
    expect(mutation.fixture?.beamAppearance?.geometry).toBeUndefined()
    expect(mutation.fixture?.beamAppearance?.width).toBe(8)
    expect(mutation.fixture?.beamAppearance?.glow).toBe(0)
    expect(mutation.global).toEqual({ globalGlow: 1, dimmer: 0, globalBeamWidth: 6 })
    expect(mutation.conditions).toHaveLength(1)
    expect(normalizeLaserDmxShowDirectorPerformanceProgram(normalized)).toEqual(normalized)
  })

  it('creates stable, unique semantic fixture and group keys without replacing fixture IDs', () => {
    const left = createDefaultLaserDmxShowDirectorFixture('laser', 'fixture-left', 0)
    const right = createDefaultLaserDmxShowDirectorFixture('laser', 'fixture-right', 1)
    const state = normalizeLaserDmxShowDirectorState({
      ...createDefaultLaserDmxShowDirectorState(),
      groups: [{ id: 'group-a', label: 'Outer Pair', semanticKey: 'OUTER pair' }],
      fixtures: [
        { ...left, label: 'Upper Left Outer', semanticKey: 'UPPER LEFT OUTER', groupId: 'group-a' },
        { ...right, label: 'Upper Right Outer', semanticKey: 'upper left outer', groupId: 'group-a' },
      ],
    })

    expect(state.fixtures.map(fixture => fixture.id)).toEqual(['fixture-left', 'fixture-right'])
    expect(state.fixtures.map(fixture => fixture.semanticKey)).toEqual(['upper-left-outer', 'upper-left-outer-2'])
    expect(state.groups[0]?.semanticKey).toBe('outer-pair')
    expect(normalizeLaserDmxShowDirectorState(state)).toEqual(state)

    const longKeyState = normalizeLaserDmxShowDirectorState({
      ...createDefaultLaserDmxShowDirectorState(),
      fixtures: [
        { ...left, semanticKey: 'x'.repeat(100) },
        { ...right, semanticKey: 'x'.repeat(100) },
      ],
    })
    expect(longKeyState.fixtures[0]?.semanticKey).toHaveLength(64)
    expect(longKeyState.fixtures[1]?.semanticKey).toMatch(/-2$/)
  })

  it('recreates every static template with identical semantic keys while retaining generated IDs', () => {
    for (const template of LASER_DMX_SHOW_DIRECTOR_TEMPLATES) {
      let leftIndex = 0
      let rightIndex = 0
      const first = createLaserDmxShowDirectorTemplateState(template.id, () => `first-${leftIndex++}`)!
      const second = createLaserDmxShowDirectorTemplateState(template.id, () => `second-${rightIndex++}`)!
      expect(first.fixtures.map(fixture => fixture.semanticKey)).toEqual(second.fixtures.map(fixture => fixture.semanticKey))
      expect(first.fixtures.map(fixture => fixture.id)).not.toEqual(second.fixtures.map(fixture => fixture.id))
      expect(first.fixtures.map(({ semanticKey: _semanticKey, schemaVersion: _schemaVersion, id: _id, ...fixture }) => fixture))
        .toEqual(second.fixtures.map(({ semanticKey: _semanticKey, schemaVersion: _schemaVersion, id: _id, ...fixture }) => fixture))
    }
  })

  it('keeps all eight finished programs available while reserving later rig-backed foundation IDs', () => {
    const entries = Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY)
    const available = entries.filter(entry => entry.status === 'available')
    const foundations = entries.filter(entry => entry.status === 'foundation')
    expect(available.map(entry => entry.name)).toEqual([
      'Prism Cathedral',
      'Cardinal Fan Reactor',
      'Cyan Mirror Cage',
      'Small Club Performance',
      'Festival Front Beams Performance',
      'Dubstep Drop Lasers Performance',
      'LED Bar Grid Performance',
      'Moving Head Sweep Performance',
    ])
    expect(available.map(entry => entry.program?.id)).toEqual([
      'prism-cathedral',
      'cardinal-fan-reactor',
      'cyan-mirror-cage',
      'small-club-rig-performance',
      'festival-front-beams-performance',
      'dubstep-drop-lasers-performance',
      'led-bar-grid-performance',
      'moving-head-sweep-performance',
    ])
    expect(foundations).toHaveLength(2)
    expect(foundations.every(entry => entry.program === null)).toBe(true)
  })

  it('migrates existing state and round-trips performance state through persistence', () => {
    const migrated = migrateReactStore({ laserDmxShowDirector: createDefaultLaserDmxShowDirectorState() }, 43)
    expect(normalizeLaserDmxShowDirectorPerformanceState(migrated.laserDmxShowDirectorPerformance).enabled).toBe(false)

    const current = useReactStore.getState()
    const active = applyLaserDmxShowDirectorPerformanceProgramState(createDefaultLaserDmxShowDirectorPerformanceState(), program())
    const persisted = reactStorePartialize({ ...current, laserDmxShowDirectorPerformance: active })
    const merged = mergeReactStoreState(persisted, current)
    expect(merged.laserDmxShowDirectorPerformance).toEqual(active)
  })

  it('clears the program without mutating the authored fixture rig', () => {
    const authored = normalizeLaserDmxShowDirectorState({
      ...createDefaultLaserDmxShowDirectorState(),
      fixtures: [createDefaultLaserDmxShowDirectorFixture('laser', 'authored-fixture', 0)],
    })
    const authoredSnapshot = JSON.stringify(authored)
    const applied = applyLaserDmxShowDirectorPerformanceProgramState(createDefaultLaserDmxShowDirectorPerformanceState(), program())
    const cleared = clearLaserDmxShowDirectorPerformanceProgramState(applied)

    expect(cleared.enabled).toBe(false)
    expect(cleared.activeProgramDefinition).toBeNull()
    expect(JSON.stringify(authored)).toBe(authoredSnapshot)
  })
})
