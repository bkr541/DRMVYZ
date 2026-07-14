import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
} from './ReactTypes'
import { buildLaserDmxShowDirectorPerformanceContext } from './LaserDmxShowDirectorPerformanceContext'
import {
  LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY,
  cloneLaserDmxShowDirectorPerformanceProgram,
  createDefaultLaserDmxShowDirectorPerformanceState,
  normalizeLaserDmxShowDirectorPerformanceProgram,
  normalizeLaserDmxShowDirectorPerformanceState,
  type LaserDmxShowDirectorPerformanceProgram,
} from './LaserDmxShowDirectorPerformanceProgram'
import {
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS,
  LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_PRESETS,
  createRigBackedPerformancePresetDefinition,
} from './LaserDmxShowDirectorPerformancePresets'
import {
  LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS,
  applyAuthoredFixtureBanks,
  cloneCanonicalShowDirectorRigLayout,
  createRigBackedPerformanceShowRig,
  defineAuthoredFixtureBank,
  defineBoundedTransientAction,
  getRigBackedPerformanceShowDefinition,
  selectFixturesByStableIdentifiers,
} from './LaserDmxShowDirectorRigBackedPerformanceShows'
import { createAllRigBackedPerformanceSourceInspectionReports } from './LaserDmxShowDirectorRigPerformanceInspection'
import { LASER_DMX_SHOW_DIRECTOR_TEMPLATES, createLaserDmxShowDirectorTemplateState } from './laserDmxShowDirectorTemplates'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'
import {
  applyShowDirectorPerformanceGlobalOverrides,
  enforceLaserDmxFinalBlackoutAuthority,
} from './renderers/LaserDmxRenderer'

function mixedFixtureProgram(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 3,
    id: 'mixed-fixture-test',
    name: 'Mixed Fixture Test',
    deterministicSeed: 51,
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    fixtureBanks: {
      led: defineAuthoredFixtureBank('primary', ['front-led-bar-l']),
      strobe: defineAuthoredFixtureBank('strobe', ['center-strobe']),
      atmosphere: defineAuthoredFixtureBank('atmosphere', ['soft-haze']),
    },
    bankRoles: {
      led: { fixtureSemanticKeys: ['front-led-bar-l'] },
      strobe: { fixtureSemanticKeys: ['center-strobe'] },
      atmosphere: { fixtureSemanticKeys: ['soft-haze'] },
    },
    scenes: [{
      id: 'drop', label: 'Drop', enabled: true, section: { types: ['drop'] },
      fixtureActions: [
        { id: 'led-chase', kind: 'led', color: '#ff00ff', direction: 'centerOut', brightness: 0.7 },
      ],
      beatMutations: [{
        id: 'strobe-hit', address: { bankRoles: ['strobe'] },
        fixtureActions: [{ id: 'bounded-strobe', kind: 'strobe', active: true, rateHz: 18, durationMs: 90 }],
      }],
      sectionBodyMutations: [{
        id: 'haze-body', address: { bankRoles: ['atmosphere'] },
        fixtureActions: [{ id: 'haze-amount', kind: 'haze', amount: 0.55, brightness: 0.4 }],
      }],
    }],
  }
}

function context(timeSec: number, seekIdentity = 'seek:initial', loopIdentity = 'loop:initial') {
  const beat = timeSec * 2
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: {
      ...DEFAULT_MI_FRAME,
      timeSec,
      rhythm: {
        ...DEFAULT_MI_FRAME.rhythm,
        bpm: 120,
        beatIndex: Math.floor(beat),
        beatPhase: beat - Math.floor(beat),
        barIndex: Math.floor(beat / 4),
      },
      section: { ...DEFAULT_MI_FRAME.section, type: 'drop', confidence: 1 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, beatGrid: true, sections: true, rhythmEvents: true },
    },
    resolvedSections: [{ id: 'drop', label: 'Drop', type: 'drop', startSec: 0, endSec: 64, intensity: 1, source: 'auto', confidence: 1 }],
    trackIdentity: 'track', seekIdentity, loopIdentity,
  })
}

describe('rig-backed Performance Show architecture foundation', () => {
  it('registers all seven rig-backed authored shows without changing the static template catalog', () => {
    expect(Object.keys(LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS)).toHaveLength(7)
    expect(Object.values(LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS).filter(item => item.status === 'available')).toHaveLength(7)
    expect(Object.values(LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS).filter(item => item.status === 'foundation')).toHaveLength(0)
    expect(LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_PRESETS).toHaveLength(7)
    expect(LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS).toHaveLength(15)
    expect(LASER_DMX_SHOW_DIRECTOR_TEMPLATES).toHaveLength(7)
  })

  it('clones canonical source rigs into independent runtime instances without mutating templates', () => {
    const before = JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)
    const first = createRigBackedPerformanceShowRig('small-club-rig-performance')!
    const second = createRigBackedPerformanceShowRig('small-club-rig-performance')!
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.fixtures[0]).not.toBe(second.fixtures[0])
    first.fixtures[0]!.brightness = 0
    expect(second.fixtures[0]!.brightness).not.toBe(0)
    expect(JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)).toBe(before)
  })

  it('retains stable source linkage and returns null for unknown source layouts or shows', () => {
    const definition = getRigBackedPerformanceShowDefinition('festival-front-beams-performance')!
    expect(definition.sourceRigLayoutId).toBe('festival-front-beams')
    expect(definition.createCanonicalRig()?.sourceTemplateId).toBe('festival-front-beams')
    expect(cloneCanonicalShowDirectorRigLayout('unknown-layout')).toBeNull()
    expect(getRigBackedPerformanceShowDefinition('unknown-show')).toBeNull()
    expect(createRigBackedPerformanceShowRig('unknown-show')).toBeNull()
  })

  it('serializes authored fixture banks and mixed-fixture actions idempotently', () => {
    const normalized = normalizeLaserDmxShowDirectorPerformanceProgram(mixedFixtureProgram())!
    expect(normalized.fixtureBanks?.strobe.address.fixtureSemanticKeys).toEqual(['center-strobe'])
    expect(normalized.scenes[0]?.fixtureActions?.[0]).toMatchObject({ id: 'led-chase', kind: 'led', direction: 'centerOut' })
    expect(normalized.scenes[0]?.beatMutations?.[0]?.fixtureActions?.[0]).toMatchObject({ kind: 'strobe', rateHz: 18, durationMs: 90 })
    expect(cloneLaserDmxShowDirectorPerformanceProgram(normalized)).toEqual(normalized)
  })

  it('normalizes bounded transient definitions and clamps their supported duration', () => {
    const mutation = defineBoundedTransientAction(
      'impact', { fixtureSemanticKeys: ['center-strobe'] },
      { id: 'strobe', kind: 'strobe', active: true, rateHz: 99, durationMs: 99_999 }, 999,
    )
    const normalized = normalizeLaserDmxShowDirectorPerformanceProgram({
      ...mixedFixtureProgram(),
      scenes: [{ ...mixedFixtureProgram().scenes[0]!, beatMutations: [mutation] }],
    })!
    expect(normalized.scenes[0]?.beatMutations?.[0]?.durationBeats).toBe(64)
    expect(normalized.scenes[0]?.beatMutations?.[0]?.fixtureActions?.[0]).toMatchObject({ rateHz: 30, durationMs: 10_000 })
  })

  it('applies mixed-fixture actions only to compatible fixture kinds', () => {
    const rig = createRigBackedPerformanceShowRig('small-club-rig-performance')!
    const program = mixedFixtureProgram()
    const resolution = resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: rig, program, context: context(2.1), tuning: program.tuning, programSeed: 51,
      enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming', runtimeInvalidationId: 'mixed:1',
    })
    const byKey = (key: string) => resolution.showDirector.fixtures.find(fixture => fixture.semanticKey === key)!
    expect(byKey('front-led-bar-l').color).toBe('#ff00ff')
    expect(byKey('front-led-bar-l').component.ledDirection).toBe('centerOut')
    expect(byKey('center-strobe').component.strobeRate).toBe(18)
    expect(byKey('center-strobe').trigger.fadeOutMs).toBe(90)
    expect(byKey('soft-haze').component.hazeIntensity).toBe(0.55)
    expect(resolution.diagnostics.unsupportedFixtureActionIds).toEqual([])
  })

  it('selects authored banks by stable semantic identifiers', () => {
    const rig = createRigBackedPerformanceShowRig('led-bar-grid-performance')!
    const selected = selectFixturesByStableIdentifiers(rig, { fixtureSemanticKeys: ['top-bar-1', 'top-bar-3'] })
    expect(selected.map(fixture => fixture.semanticKey)).toEqual(['top-bar-1', 'top-bar-3'])
  })

  it('produces inspection reports for all source rigs with candidate banks and capability warnings', () => {
    const reports = createAllRigBackedPerformanceSourceInspectionReports()
    expect(reports).toHaveLength(7)
    expect(reports.every(report => report.fixtureCount === report.fixtures.length)).toBe(true)
    expect(reports.every(report => report.fixtureIds.length === report.fixtureCount)).toBe(true)
    expect(reports.every(report => Object.keys(report.candidateAuthoredBankAssignments).length > 0)).toBe(true)
    expect(reports.flatMap(report => report.unsupportedPropertyWarnings)).toEqual([])
  })

  it('preserves existing saved static layouts and custom rigs', () => {
    const staticRig = createLaserDmxShowDirectorTemplateState('small-club-rig')!
    expect(normalizeLaserDmxShowDirectorState(JSON.parse(JSON.stringify(staticRig)))).toEqual(staticRig)
    const customFixture = createDefaultLaserDmxShowDirectorFixture('laser', 'custom-fixture', 0)
    const custom = normalizeLaserDmxShowDirectorState({ ...createDefaultLaserDmxShowDirectorState(), fixtures: [{ ...customFixture, semanticKey: 'custom-hero' }] })
    expect(normalizeLaserDmxShowDirectorState(JSON.parse(JSON.stringify(custom)))).toEqual(custom)
  })

  it('suppresses unknown IDs while loading the authored impact show normally', () => {
    const unknown = normalizeLaserDmxShowDirectorPerformanceState({ enabled: true, activeProgramId: 'unknown-program' })
    const authored = normalizeLaserDmxShowDirectorPerformanceState({ enabled: true, activeProgramId: 'strobe-blinder-hits-performance', activeBuiltInProgramId: 'strobe-blinder-hits-performance' })
    expect(unknown).toMatchObject({ enabled: false, activeProgramDefinition: null, activeProgramId: null })
    expect(authored).toMatchObject({ enabled: true, activeProgramId: 'strobe-blinder-hits-performance', activeBuiltInProgramId: 'strobe-blinder-hits-performance' })
    expect(authored.activeProgramDefinition?.id).toBe('strobe-blinder-hits-performance')
    expect(createDefaultLaserDmxShowDirectorPerformanceState().enabled).toBe(false)
  })

  it('keeps every available show byte-equivalent through cloning', () => {
    const available = Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY).filter(entry => entry.status === 'available')
    expect(available.map(entry => entry.id)).toEqual([
      'prism-cathedral', 'cardinal-fan-reactor', 'cyan-mirror-cage',
      'small-club-rig-performance', 'festival-front-beams-performance', 'dubstep-drop-lasers-performance',
      'led-bar-grid-performance', 'moving-head-sweep-performance',
      'strobe-blinder-hits-performance', 'haze-co2-drops-performance',
      'vocal-eclipse-exchange', 'emerald-tunnel-relay', 'white-vector-interlock',
      'aurora-canopy-drift', 'chromatic-chapter-stage',
    ])
    for (const entry of available) {
      const before = JSON.stringify(entry.program)
      expect(cloneLaserDmxShowDirectorPerformanceProgram(entry.program!)).toEqual(normalizeLaserDmxShowDirectorPerformanceProgram(entry.program))
      expect(JSON.stringify(entry.program)).toBe(before)
    }
  })

  it('publishes the authored impact and atmosphere definitions through the existing preset path', () => {
    for (const id of ['strobe-blinder-hits-performance', 'haze-co2-drops-performance'] as const) {
      const definition = getRigBackedPerformanceShowDefinition(id)!
      expect(definition.status).toBe('available')
      expect(definition.createProgram!().id).toBe(id)
      expect(createRigBackedPerformancePresetDefinition(definition)?.id).toBe(id)
    }
  })

  it('preserves safety and authored blackout authority above performance overrides', () => {
    const matrix = createDefaultLaserDmxBeamMatrixSettings()
    const authoritative = { ...matrix, output: { ...matrix.output, blackout: true } }
    const performanceAttempt = applyShowDirectorPerformanceGlobalOverrides(authoritative, { blackout: false, dimmer: 1 })
    expect(performanceAttempt.output.blackout).toBe(true)
    expect(enforceLaserDmxFinalBlackoutAuthority(authoritative, { ...performanceAttempt, output: { ...performanceAttempt.output, blackout: false } }).output.blackout).toBe(true)
  })

  it('remains deterministic across seek and loop lifecycle identities', () => {
    const rig = createRigBackedPerformanceShowRig('small-club-rig-performance')!
    const program = mixedFixtureProgram()
    const run = (seek: string, loop: string) => resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: rig, program, context: context(8.1, seek, loop), tuning: program.tuning, programSeed: 51,
      enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming', runtimeInvalidationId: 'mixed:1',
      transportDiscontinuityIdentity: `${seek}:${loop}`,
    })
    expect(run('seek:1', 'loop:1')).toEqual(run('seek:1', 'loop:1'))
    expect(run('seek:1', 'loop:1').deterministicIdentity).not.toBe(run('seek:2', 'loop:1').deterministicIdentity)
    expect(run('seek:1', 'loop:1').deterministicIdentity).not.toBe(run('seek:1', 'loop:2').deterministicIdentity)
  })

  it('can attach authored bank metadata to a future program without replacing its scenes', () => {
    const program = mixedFixtureProgram()
    const banks = { hero: defineAuthoredFixtureBank('hero', ['club-laser-l', 'club-laser-r']) }
    const next = applyAuthoredFixtureBanks(program, banks)
    expect(next.scenes).toBe(program.scenes)
    expect(next.fixtureBanks).toEqual(banks)
    expect(next.bankRoles?.hero).toEqual(banks.hero.address)
  })
})
