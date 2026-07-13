import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorState,
  type ReactTrackSection,
} from './ReactTypes'
import { buildLaserDmxShowDirectorPerformanceContext, type LaserDmxShowDirectorPerformanceTimingContext } from './LaserDmxShowDirectorPerformanceContext'
import type { LaserDmxShowDirectorPerformanceProgram } from './LaserDmxShowDirectorPerformanceProgram'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'
import { compileLaserDmxShowDirectorToBeamMatrix } from './renderers/LaserDmxShowDirectorBeamMatrixCompiler'

const sections: ReactTrackSection[] = [
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 0, endSec: 64, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 64, endSec: 128, intensity: 1, source: 'auto', confidence: 1 },
]

function miFrame(timeSec: number, overrides: { kick?: boolean; snare?: boolean; transient?: number; energy?: number } = {}): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: 1,
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      kickHit: overrides.kick ?? false,
      kickStrength: overrides.kick ? 1 : 0,
      snareHit: overrides.snare ?? false,
      snareStrength: overrides.snare ? 1 : 0,
      transient: overrides.transient ?? 0,
      transientConfidence: 1,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: overrides.energy ?? 0.85,
      shortTerm: overrides.energy ?? 0.85,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: 'drop',
      confidence: 1,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 1,
      rhythm: 1,
      section: 1,
    },
  }
}

function contextAt(
  timeSec: number,
  options: { previous?: LaserDmxShowDirectorPerformanceTimingContext; seek?: string; loop?: string; kick?: boolean; snare?: boolean; transient?: number } = {},
): LaserDmxShowDirectorPerformanceTimingContext {
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: miFrame(timeSec, options),
    resolvedSections: sections,
    trackIdentity: 'track-a',
    seekIdentity: options.seek ?? 'seek-0',
    loopIdentity: options.loop ?? 'loop-0',
    previous: options.previous ?? null,
  })
}

function rig(): LaserDmxShowDirectorState {
  const hero = createDefaultLaserDmxShowDirectorFixture('laser', 'hero-id', 0)
  const recruit = createDefaultLaserDmxShowDirectorFixture('laser', 'recruit-id', 1)
  const led = createDefaultLaserDmxShowDirectorFixture('ledBar', 'led-id', 2)
  return normalizeLaserDmxShowDirectorState({
    ...createDefaultLaserDmxShowDirectorState(),
    groups: [
      { id: 'hero-group', semanticKey: 'hero-group', label: 'Hero Group' },
      { id: 'recruit-group', semanticKey: 'recruit-group', label: 'Recruit Group' },
    ],
    fixtures: [
      { ...hero, semanticKey: 'hero-left', groupId: 'hero-group', rotation: 10, color: '#00ffff', beam: { ...hero.beam, targetX: 7, targetY: 2 } },
      { ...recruit, semanticKey: 'recruit-right', groupId: 'recruit-group', enabled: false, rotation: -10, color: '#ff00ff' },
      { ...led, semanticKey: 'led-detail', groupId: 'hero-group', component: { ...led.component, ledCellCount: 16 } },
    ],
  })
}

function program(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 1,
    id: 'runtime-test',
    name: 'Runtime Test',
    deterministicSeed: 77,
    fallbackOrder: ['drop', 'verse'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    scenes: [
      {
        id: 'drop-one',
        label: 'Drop One',
        enabled: true,
        priority: 10,
        section: { types: ['drop'], occurrence: { occurrences: [1] } },
        address: { fixtureSemanticKeys: ['hero-left'] },
        fixture: { brightness: 0.55, rotation: 10, beamPriorityRole: 'heroImpact' },
        beatMutations: [{ id: 'beat-turn', address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { rotation: 35 } }],
        kickMutations: [{ id: 'kick-width', threshold: 0.5, address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { beamAppearance: { width: 3 } } }],
        snareMutations: [{ id: 'snare-white', threshold: 0.5, address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { color: '#ffffff' } }],
        transientMutations: [{ id: 'transient-focus', threshold: 0.5, address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { focus: 0.25 } }],
        fourBarVariations: [
          { id: 'four-a', address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { color: '#ff0000' } },
          { id: 'four-b', address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { color: '#0000ff' } },
        ],
        eightBarRecruitment: [
          { id: 'stage-one', stage: 1, address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { fanSpread: 20 } },
          { id: 'stage-two', stage: 2, address: { fixtureSemanticKeys: ['recruit-right'] }, fixture: { enabled: true, targetPosition: { x: 3, y: 2 }, beamPriorityRole: 'primaryArchitecture' } },
        ],
        sixteenBarEvolution: [{ id: 'phrase-evolve', phraseLengthBars: 16, address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { beamTravel: { mode: 'projectile' } } }],
      },
      {
        id: 'drop-two',
        label: 'Drop Two',
        enabled: true,
        priority: 10,
        section: { types: ['drop'], occurrence: { occurrences: [2] } },
        address: { fixtureSemanticKeys: ['hero-left'] },
        fixture: { brightness: 0.95, color: '#00ff00', rotation: -40 },
      },
    ],
  }
}

function resolve(timeSec: number, options: Parameters<typeof contextAt>[1] = {}, enabled = true) {
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: rig(),
    program: program(),
    context: contextAt(timeSec, options),
    tuning: program().tuning,
    programSeed: 77,
    enabled,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: 'runtime:1',
  })
}

function fixtureByKey(result: ReturnType<typeof resolve>, key: string) {
  return result.showDirector.fixtures.find(fixture => fixture.semanticKey === key)!
}

describe('Show Director deterministic performance resolver', () => {
  it('does not mutate the authored rig, program, or canonical context', () => {
    const authored = rig()
    const authoredProgram = program()
    const context = contextAt(2.1)
    const snapshots = [JSON.stringify(authored), JSON.stringify(authoredProgram), JSON.stringify(context)]
    resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: authored,
      program: authoredProgram,
      context,
      tuning: authoredProgram.tuning,
      programSeed: 77,
      enabled: true,
      audioIntelligenceEnabled: true,
      fallbackBehavior: 'basicTiming',
      runtimeInvalidationId: 'runtime:1',
    })
    expect(JSON.stringify(authored)).toBe(snapshots[0])
    expect(JSON.stringify(authoredProgram)).toBe(snapshots[1])
    expect(JSON.stringify(context)).toBe(snapshots[2])
  })

  it('produces identical output for the same timestamp and seed', () => {
    expect(resolve(10.1)).toEqual(resolve(10.1))
  })

  it('makes beat, kick, snare, and other transient layers visible', () => {
    const beatOpen = resolve(2.1)
    const beatClosed = resolve(2.4)
    expect(fixtureByKey(beatOpen, 'hero-left').rotation).not.toBe(fixtureByKey(beatClosed, 'hero-left').rotation)
    expect(fixtureByKey(resolve(2.1, { kick: true }), 'hero-left').runtimeBeamAppearance?.width).toBe(3)
    expect(fixtureByKey(resolve(2.1, { snare: true }), 'hero-left').color).toBe('#ffffff')
    expect(fixtureByKey(resolve(2.1, { transient: 1 }), 'hero-left').beam.focus).toBe(0.25)
  })

  it('changes four-bar variation only at true four-bar boundaries', () => {
    const beforeBoundary = resolve(7.9)
    const afterBoundary = resolve(8.1)
    expect(beforeBoundary.fourBarVariation).toBe('four-a')
    expect(afterBoundary.fourBarVariation).toBe('four-b')
    expect(fixtureByKey(beforeBoundary, 'hero-left').color).not.toBe(fixtureByKey(afterBoundary, 'hero-left').color)
  })

  it('recruits at eight bars and retargets fixtures already active', () => {
    const stageOne = resolve(15.9)
    const stageTwo = resolve(16.1)
    expect(stageOne.eightBarRecruitmentStage).toBe(1)
    expect(fixtureByKey(stageOne, 'recruit-right').enabled).toBe(false)
    expect(stageTwo.eightBarRecruitmentStage).toBe(2)
    expect(fixtureByKey(stageTwo, 'recruit-right').enabled).toBe(true)
    expect(fixtureByKey(stageTwo, 'hero-left').beam.targetX).not.toBe(fixtureByKey(stageOne, 'hero-left').beam.targetX)
    expect(fixtureByKey(stageTwo, 'hero-left').rotation).not.toBe(fixtureByKey(stageOne, 'hero-left').rotation)
  })

  it('addresses Drop 2 independently from Drop 1', () => {
    const dropOne = resolve(10.1)
    const dropTwo = resolve(70.1)
    expect(dropOne.activeSceneId).toBe('drop-one')
    expect(dropTwo.activeSceneId).toBe('drop-two')
    expect(fixtureByKey(dropTwo, 'hero-left').color).toBe('#00ff00')
    expect(fixtureByKey(dropTwo, 'hero-left').rotation).toBe(-40)
  })

  it('reconstructs the same state after seeking and looping', () => {
    const direct = resolve(18.1)
    const seekContext = contextAt(18.1, { previous: contextAt(40), seek: 'seek-2' })
    const loopContext = contextAt(18.1, { previous: contextAt(30), loop: 'loop-2' })
    const inputBase = {
      authoredShowDirector: rig(), program: program(), tuning: program().tuning, programSeed: 77,
      enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming' as const, runtimeInvalidationId: 'runtime:1',
    }
    const sought = resolveLaserDmxShowDirectorPerformance({ ...inputBase, context: seekContext })
    const looped = resolveLaserDmxShowDirectorPerformance({ ...inputBase, context: loopContext })
    expect(sought.showDirector).toEqual(direct.showDirector)
    expect(looped.showDirector).toEqual(direct.showDirector)
    expect(sought.activeSceneId).toBe(direct.activeSceneId)
    expect(looped.eightBarRecruitmentStage).toBe(direct.eightBarRecruitmentStage)
  })

  it('preserves authored behavior exactly when disabled', () => {
    const authored = rig()
    const result = resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: authored,
      program: program(),
      context: contextAt(10.1),
      tuning: program().tuning,
      programSeed: 77,
      enabled: false,
      audioIntelligenceEnabled: true,
      fallbackBehavior: 'basicTiming',
      runtimeInvalidationId: 'runtime:1',
    })
    expect(result.showDirector).toEqual(normalizeLaserDmxShowDirectorState(authored))
    const baseMatrix = createDefaultLaserDmxBeamMatrixSettings()
    expect(compileLaserDmxShowDirectorToBeamMatrix({ showDirector: authored, beamMatrix: baseMatrix }))
      .toEqual(compileLaserDmxShowDirectorToBeamMatrix({ showDirector: result.showDirector, beamMatrix: baseMatrix }))
  })

  it('fails malformed programs safely', () => {
    const malformed = { ...program(), scenes: [{ id: 'broken' }] } as unknown as LaserDmxShowDirectorPerformanceProgram
    const authored = rig()
    const result = resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: authored,
      program: malformed,
      context: contextAt(2),
      tuning: program().tuning,
      programSeed: 1,
      enabled: true,
      audioIntelligenceEnabled: true,
      fallbackBehavior: 'authoredRig',
      runtimeInvalidationId: 'runtime:1',
    })
    expect(result.showDirector).toEqual(normalizeLaserDmxShowDirectorState(authored))
    expect(result.diagnostics.suppressionReason).toContain('Malformed')
  })

  it('reports and deterministically bounds excessive beam demand', () => {
    const base = createDefaultLaserDmxShowDirectorState()
    const fixtures = Array.from({ length: 40 }, (_, index) => {
      const fixture = createDefaultLaserDmxShowDirectorFixture('ledBar', `led-${index}`, index)
      return { ...fixture, semanticKey: `led-${index}`, component: { ...fixture.component, ledCellCount: 16 } }
    })
    const authored = normalizeLaserDmxShowDirectorState({ ...base, fixtures })
    const broadProgram = { ...program(), scenes: [{ ...program().scenes[0], address: undefined, fixture: { enabled: true } }] }
    const result = resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: authored,
      program: broadProgram,
      context: contextAt(2),
      tuning: broadProgram.tuning,
      programSeed: 77,
      enabled: true,
      audioIntelligenceEnabled: true,
      fallbackBehavior: 'basicTiming',
      runtimeInvalidationId: 'runtime:1',
    })
    expect(result.estimatedBeamDemand).toBeGreaterThan(300)
    expect(result.boundedBeamDemand).toBe(300)
    expect(result.diagnostics.beamBudgetWarning).toContain('bounded')
    const compiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: result.showDirector,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      fixturePriorityById: result.fixturePriorityById,
    })
    expect(compiled.beams).toHaveLength(300)
  })

  it('keeps mandatory choreography active at Variation Amount zero while suppressing optional accents', () => {
    const authoredProgram = program()
    authoredProgram.scenes[0]!.sectionBodyMutations = [{
      id: 'optional-accent', probability: 1,
      address: { fixtureSemanticKeys: ['hero-left'] },
      fixture: { beamAppearance: { glow: 0.123 } },
    }]
    const tuning = { ...authoredProgram.tuning, variation: 0 }
    const result = resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: rig(), program: authoredProgram, context: contextAt(16.1), tuning,
      programSeed: 77, enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming',
      runtimeInvalidationId: 'runtime:variation-zero',
    })
    expect(result.activeFixtureKeys.length).toBeGreaterThan(0)
    expect(result.activeFixtureKeys).toContain('recruit-right')
    expect(result.estimatedBeamDemand).toBeGreaterThan(0)
    expect(fixtureByKey(result, 'hero-left').runtimeBeamAppearance?.glow).not.toBe(0.123)
  })

  it('uses an explicit or inferred beat cycle instead of the number of offsets', () => {
    const beatProgram = program()
    beatProgram.scenes = [{
      id: 'beat-cycle', label: 'Beat Cycle', enabled: true, section: { types: ['drop'] },
      beatMutations: [{
        id: 'beats-zero-and-three', beatDivision: 1, beatOffsets: [0, 3], beatCycleLength: 4,
        address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { rotation: 99 },
      }],
    }]
    const resolveBeat = (timeSec: number) => resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: rig(), program: beatProgram, context: contextAt(timeSec), tuning: beatProgram.tuning,
      programSeed: 77, enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming',
      runtimeInvalidationId: 'runtime:beat-cycle',
    })
    expect(fixtureByKey(resolveBeat(0.1), 'hero-left').rotation).toBe(99)
    expect(fixtureByKey(resolveBeat(0.6), 'hero-left').rotation).toBe(10)
    expect(fixtureByKey(resolveBeat(1.6), 'hero-left').rotation).toBe(99)
  })

  it('applies participating semantic group overrides and reports missing requested groups', () => {
    const groupProgram = program()
    groupProgram.scenes = [{
      id: 'group-participation', label: 'Group Participation', enabled: true, section: { types: ['drop'] },
      address: { fixtureSemanticKeys: ['hero-left'] },
      fixture: { participatingGroupSemanticKeys: ['recruit-group', 'missing-group'] },
    }]
    const result = resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: rig(), program: groupProgram, context: contextAt(2.1), tuning: groupProgram.tuning,
      programSeed: 77, enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming',
      runtimeInvalidationId: 'runtime:groups',
    })
    expect(fixtureByKey(result, 'hero-left').groupId).toBe('recruit-group')
    expect(result.diagnostics.missingGroupKeys).toContain('missing-group')
  })

  it('interpolates transitions between adjacent performance scenes instead of the authored rig', () => {
    const transitionProgram = program()
    transitionProgram.scenes = [
      {
        id: 'transition-one', label: 'Transition One', enabled: true, priority: 10,
        section: { types: ['drop'], occurrence: { occurrences: [1] } },
        address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { rotation: 0 },
        transitionOut: { durationBars: 1, curve: 'linear' },
      },
      {
        id: 'transition-two', label: 'Transition Two', enabled: true, priority: 10,
        section: { types: ['drop'], occurrence: { minOccurrence: 2 } },
        address: { fixtureSemanticKeys: ['hero-left'] }, fixture: { rotation: 100 },
      },
    ]
    const result = resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: rig(), program: transitionProgram, context: contextAt(63.75), tuning: transitionProgram.tuning,
      programSeed: 77, enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming',
      runtimeInvalidationId: 'runtime:transition',
    })
    expect(fixtureByKey(result, 'hero-left').rotation).toBeGreaterThan(50)
    expect(fixtureByKey(result, 'hero-left').rotation).toBeLessThan(100)
  })

  it('resolves fixture-keyed local targets without creating a shared target network', () => {
    const localProgram = program()
    localProgram.scenes = [{
      id: 'fixture-local-targets',
      label: 'Fixture Local Targets',
      enabled: true,
      section: { types: ['drop'] },
      address: { fixtureKinds: ['laser'] },
      fixture: {
        enabled: true,
        targetMode: 'fixed',
        targetPoints: [{ id: 'legacy-fallback', x: 9, y: 5 }],
        targetPointsByFixtureSemanticKey: {
          'hero-left': [
            { id: 'hero-a', x: 5, y: 3 },
            { id: 'hero-b', x: 6, y: 5 },
            { id: 'hero-c', x: 5, y: 7 },
          ],
          'recruit-right': [
            { id: 'recruit-a', x: 13, y: 3 },
            { id: 'recruit-b', x: 12, y: 5 },
            { id: 'recruit-c', x: 13, y: 7 },
          ],
        },
      },
    }]
    const result = resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: rig(), program: localProgram, context: contextAt(2.1), tuning: localProgram.tuning,
      programSeed: 77, enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming',
      runtimeInvalidationId: 'runtime:fixture-local-targets',
    })
    const heroTargets = fixtureByKey(result, 'hero-left').beam.targets
    const recruitTargets = fixtureByKey(result, 'recruit-right').beam.targets

    expect(heroTargets?.map(target => [target.x, target.y])).toEqual([[5, 3], [6, 5], [5, 7]])
    expect(recruitTargets?.map(target => [target.x, target.y])).toEqual([[13, 3], [12, 5], [13, 7]])
    expect(heroTargets).not.toEqual(recruitTargets)
  })

})
