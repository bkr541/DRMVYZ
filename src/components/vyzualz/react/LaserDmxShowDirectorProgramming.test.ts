import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorState,
  type ReactTrackSection,
} from './ReactTypes'
import { buildLaserDmxShowDirectorPerformanceContext } from './LaserDmxShowDirectorPerformanceContext'
import type { LaserDmxShowDirectorPerformanceProgram } from './LaserDmxShowDirectorPerformanceProgram'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'
import {
  createLegacyLaserProgrammingAdapter,
  normalizeLaserShowProgrammingDocument,
  resolveLaserShowProgramming,
  sanitizeTransientLaserProgrammingPayload,
  validateLaserShowProgrammingDocument,
  type LaserFixtureGroupRelationship,
  type LaserGroupRelationshipMode,
  type LaserShowProgrammingDocument,
} from './LaserDmxShowDirectorProgramming'

const sections: ReactTrackSection[] = [
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 0, endSec: 32, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 32, endSec: 64, intensity: 1, source: 'auto', confidence: 1 },
]

function frameAt(timeSec: number, hits: { kick?: boolean; snare?: boolean; hat?: boolean } = {}): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.round(timeSec * 60),
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      kickHit: Boolean(hits.kick),
      kickStrength: hits.kick ? 1 : 0,
      snareHit: Boolean(hits.snare),
      snareStrength: hits.snare ? 1 : 0,
      hatHit: Boolean(hits.hat),
      hatStrength: hits.hat ? 1 : 0,
    },
    energy: { ...DEFAULT_MI_FRAME.energy, instant: 0.8, shortTerm: 0.8 },
    section: { ...DEFAULT_MI_FRAME.section, type: 'drop', confidence: 1 },
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: true, sections: true },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 1, rhythm: 1, section: 1 },
  }
}

function contextAt(timeSec: number, options: { seek?: string; loop?: string; kick?: boolean; snare?: boolean; hat?: boolean } = {}) {
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec, options),
    resolvedSections: sections,
    trackIdentity: 'programming-test-track',
    seekIdentity: options.seek ?? 'seek-0',
    loopIdentity: options.loop ?? 'loop-0',
  })
}

function rig(presentationMode: 'edit' | 'live' | 'capture' = 'edit'): LaserDmxShowDirectorState {
  const left = createDefaultLaserDmxShowDirectorFixture('laser', 'laser-left', 0)
  const right = createDefaultLaserDmxShowDirectorFixture('laser', 'laser-right', 1)
  return normalizeLaserDmxShowDirectorState({
    ...createDefaultLaserDmxShowDirectorState(),
    settings: { ...createDefaultLaserDmxShowDirectorState().settings, presentationMode },
    groups: [{ id: 'laser-bank', semanticKey: 'laser-bank', label: 'Laser Bank' }],
    fixtures: [
      {
        ...left,
        semanticKey: 'laser-left',
        groupId: 'laser-bank',
        x: 0.2,
        brightness: 0.8,
        linkedPairId: 'hero-pair',
        mirrorAxis: 'horizontal',
        beam: { ...left.beam, beamAngle: -20, beamSpread: 18, targetX: 2, targetY: 3 },
      },
      {
        ...right,
        semanticKey: 'laser-right',
        groupId: 'laser-bank',
        x: 0.8,
        brightness: 0.8,
        linkedPairId: 'hero-pair',
        mirrorAxis: 'horizontal',
        beam: { ...right.beam, beamAngle: 20, beamSpread: 18, targetX: 8, targetY: 3 },
      },
    ],
  })
}

function program(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 4,
    id: 'programming-test',
    name: 'Programming Test',
    deterministicSeed: 42,
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    scenes: [{
      id: 'drop-scene',
      label: 'Drop Scene',
      enabled: true,
      priority: 10,
      section: { types: ['drop'] },
      address: { fixtureSemanticKeys: ['laser-left', 'laser-right'] },
      fixture: { brightness: 0.75, scanner: { patternType: 'fanSweep', scanRatePps: 24_000, fanWidth: 60 } },
      kickMutations: [{
        id: 'kick-accent',
        threshold: 0.5,
        address: { fixtureSemanticKeys: ['laser-left', 'laser-right'] },
        fixture: { brightness: 0.95, targetPosition: { x: 9, y: 9 }, scanner: { patternType: 'circle', opticalCopyCount: 12 } },
      }],
      snareMutations: [{
        id: 'snare-accent',
        threshold: 0.5,
        address: { fixtureSemanticKeys: ['laser-left', 'laser-right'] },
        fixture: { color: '#ffffff' },
      }],
      hatMutations: [{
        id: 'hat-accent',
        threshold: 0.5,
        address: { fixtureSemanticKeys: ['laser-left', 'laser-right'] },
        fixture: { focus: 0.9 },
      }],
    }],
  }
}

function adapterDocument(): LaserShowProgrammingDocument {
  return createLegacyLaserProgrammingAdapter(program(), rig())
}

function resolveDocument(document: LaserShowProgrammingDocument, timeSec: number, options: Parameters<typeof contextAt>[1] = {}) {
  const baseProgram = { ...program(), laserProgramming: document }
  return resolveLaserShowProgramming({
    document,
    program: baseProgram,
    selectedScene: baseProgram.scenes[0],
    authoredRig: rig(),
    runtimeRig: rig(),
    context: contextAt(timeSec, options),
    programSeed: 42,
  })
}

function relationship(mode: LaserGroupRelationshipMode): LaserFixtureGroupRelationship {
  const assignmentId = adapterDocument().macros[0].fixtureGroupAssignments[0].id
  return {
    schemaVersion: 1,
    id: `relationship-${mode}`,
    name: mode,
    mode,
    memberAssignmentIds: [assignmentId],
    phaseOffset: 0.25,
    sharedSpeed: true,
    sharedSpread: true,
    sharedIntensity: true,
    sharedColor: true,
  }
}

function withRelationship(mode: LaserGroupRelationshipMode): LaserShowProgrammingDocument {
  const document = adapterDocument()
  const rel = relationship(mode)
  document.groupRelationships = [rel]
  document.macros[0].fixtureGroupAssignments[0].relationshipId = rel.id
  return document
}

function fixture(result: ReturnType<typeof resolveDocument>, semanticKey: string) {
  return result.showDirector.fixtures.find(item => item.semanticKey === semanticKey)!
}

function mixedFixtureRig(): LaserDmxShowDirectorState {
  const base = rig()
  const extras = [
    createDefaultLaserDmxShowDirectorFixture('movingHead', 'moving-head-a', 2),
    createDefaultLaserDmxShowDirectorFixture('strobe', 'strobe-a', 3),
    createDefaultLaserDmxShowDirectorFixture('blinder', 'blinder-a', 4),
    createDefaultLaserDmxShowDirectorFixture('ledBar', 'led-a', 5),
    createDefaultLaserDmxShowDirectorFixture('haze', 'haze-a', 6),
    createDefaultLaserDmxShowDirectorFixture('co2Jet', 'co2-a', 7),
  ].map(item => ({ ...item, semanticKey: item.id, groupId: 'laser-bank', brightness: 0.8 }))
  return normalizeLaserDmxShowDirectorState({ ...base, fixtures: [...base.fixtures, ...extras] })
}

function resolveMixedFixtureFamily(family: LaserShowProgrammingDocument['macros'][number]['family']) {
  const authoredRig = mixedFixtureRig()
  const document = createLegacyLaserProgrammingAdapter(program(), authoredRig)
  const macro = document.macros[0]
  macro.family = family
  macro.fixtureGroupAssignments[0].address = {
    fixtureSemanticKeys: authoredRig.fixtures.map(item => item.semanticKey).filter((key): key is string => Boolean(key)),
  }
  const baseProgram = { ...program(), laserProgramming: document }
  return resolveLaserShowProgramming({
    document,
    program: baseProgram,
    selectedScene: baseProgram.scenes[0],
    authoredRig,
    runtimeRig: authoredRig,
    context: contextAt(0),
    programSeed: 42,
  })
}

describe('LaserDMX show programming architecture', () => {
  it('creates versioned macros and cue stacks without deleting the legacy source', () => {
    const document = adapterDocument()
    expect(document.schemaVersion).toBe(1)
    expect(document.macros).toHaveLength(1)
    expect(document.cueStacks[0].cues).toHaveLength(1)
    expect(document.compatibility.source).toBe('legacy-adapter')
    expect(document.compatibility.originalProgramBackup).toEqual(program())
    expect(document.macros[0].compatibility?.provisional).toBe(true)
    expect(document.groupRelationships[0].memberAssignmentIds.length).toBeGreaterThan(0)
    expect(document.macros[0].fixtureGroupAssignments.some(assignment => assignment.relationshipId === document.groupRelationships[0].id)).toBe(true)
    expect(document.cueStacks[0].cues[0].fixtureGroupAssignmentIds).toEqual([document.macros[0].fixtureGroupAssignments[0].id])
  })

  it('round-trips persisted programming documents through normalization', () => {
    const document = adapterDocument()
    const restored = normalizeLaserShowProgrammingDocument(JSON.parse(JSON.stringify(document)), program())
    expect(restored).toEqual(document)
  })

  it('keeps frame topology and ray slots stable while cue-relative progress advances', () => {
    const document = adapterDocument()
    const first = resolveDocument(document, 1)
    const later = resolveDocument(document, 1.5)
    expect(first.frame?.id).toBe(later.frame?.id)
    expect(first.frame?.topologyId).toBe(later.frame?.topologyId)
    expect(first.frame?.raySlots).toEqual(later.frame?.raySlots)
    expect(first.frame?.cueProgress).not.toBe(later.frame?.cueProgress)
    expect(first.diagnostics.geometryRebuildCount).toBe(0)
    expect(first.diagnostics.unexpectedTopologyChanges).toBe(0)
  })

  it('starts cues only on their quantized boundary and honors their duration', () => {
    const document = adapterDocument()
    const baseCue = document.cueStacks[0].cues[0]
    document.cueStacks[0].cues = [
      { ...baseCue, id: 'cue-a', name: 'Cue A', startQuantize: 'bar', startOffsetBeats: 3, duration: { kind: 'explicitBeats', beats: 4 }, priority: 10 },
      { ...baseCue, id: 'cue-b', name: 'Cue B', startQuantize: 'bar', startOffsetBeats: 8, duration: { kind: 'explicitBeats', beats: 4 }, priority: 10 },
    ]
    expect(resolveDocument(document, 1.75).cue).toBeNull()
    expect(resolveDocument(document, 2).cue?.id).toBe('cue-a')
    expect(resolveDocument(document, 4).cue?.id).toBe('cue-b')
    expect(resolveDocument(document, 6.1).cue).toBeNull()
  })

  it('repeats a cue deterministically only when repeatEveryBeats is authored', () => {
    const document = adapterDocument()
    const cue = document.cueStacks[0].cues[0]
    document.cueStacks[0].cues = [{ ...cue, startQuantize: 'beat', startOffsetBeats: 0, repeatEveryBeats: 4, duration: { kind: 'twoBeats' } }]
    const first = resolveDocument(document, 0.5)
    const gap = resolveDocument(document, 1.5)
    const second = resolveDocument(document, 2.5)
    expect(first.cue).not.toBeNull()
    expect(gap.cue).toBeNull()
    expect(second.cue).not.toBeNull()
    expect(second.frame?.revision).toBe(1)
  })

  it('reconstructs the same pattern frame after seek and loop identity changes', () => {
    const document = adapterDocument()
    const normal = resolveDocument(document, 5)
    const seeked = resolveDocument(document, 5, { seek: 'seek-9' })
    const looped = resolveDocument(document, 5, { loop: 'loop-9' })
    expect(seeked.frame).toEqual(normal.frame)
    expect(looped.frame).toEqual(normal.frame)
  })

  it('evaluates bounded automation from cue-relative progress without mutating source data', () => {
    const document = adapterDocument()
    document.cueStacks[0].cues[0].duration = { kind: 'explicitBeats', beats: 8 }
    document.macros[0].automation = [{
      id: 'fan-width-rise', parameter: 'fanSpread', from: 10, to: 50, startProgress: 0, endProgress: 1, curve: 'linear',
    }]
    const before = JSON.stringify(document)
    const result = resolveDocument(document, 1)
    expect(result.frame?.fanSpread).toBeCloseTo(20, 5)
    expect(JSON.stringify(document)).toBe(before)
  })

  it('keeps mirrored banks synchronized around a shared center', () => {
    const result = resolveDocument(withRelationship('mirrored'), 2)
    const left = fixture(result, 'laser-left')
    const right = fixture(result, 'laser-right')
    expect(left.beam.beamAngle).toBeCloseTo(-right.beam.beamAngle, 6)
    expect(left.beam.beamSpread).toBe(right.beam.beamSpread)
    expect(left.runtimeScanner?.scanRatePps).toBe(right.runtimeScanner?.scanRatePps)
  })

  it('supports opposed, phase-offset, chase, and center-out relationships', () => {
    const opposed = resolveDocument(withRelationship('opposed'), 2)
    expect(Math.abs(fixture(opposed, 'laser-right').beam.beamAngle - fixture(opposed, 'laser-left').beam.beamAngle)).toBe(180)

    const phase = resolveDocument(withRelationship('phaseOffset'), 2)
    expect(fixture(phase, 'laser-right').runtimeScanner?.phase).toBeCloseTo(((fixture(phase, 'laser-left').runtimeScanner?.phase ?? 0) + 0.25) % 1, 6)

    const chase = resolveDocument(withRelationship('chase'), 2)
    expect(fixture(chase, 'laser-right').runtimeScanner?.phase).toBeCloseTo(((fixture(chase, 'laser-left').runtimeScanner?.phase ?? 0) + 0.5) % 1, 6)

    const centerOut = resolveDocument(withRelationship('centerOut'), 2)
    expect(fixture(centerOut, 'laser-left').beam.beamAngle).toBeLessThan(0)
    expect(fixture(centerOut, 'laser-right').beam.beamAngle).toBeGreaterThan(0)
  })

  it('layers kick, snare, and hat accents over the stable primary cue', () => {
    const document = adapterDocument()
    expect(resolveDocument(document, 2, { kick: true }).activeAccentCueIds).toContain('drop-scene:kick-accent')
    expect(resolveDocument(document, 2, { snare: true }).activeAccentCueIds).toContain('drop-scene:snare-accent')
    expect(resolveDocument(document, 2, { hat: true }).activeAccentCueIds).toContain('drop-scene:hat-accent')
    expect(resolveDocument(document, 2, { kick: true }).cue?.id).toBe(resolveDocument(document, 2).cue?.id)
  })

  it('blocks transient geometry redraw while preserving bounded scalar accents', () => {
    const sanitized = sanitizeTransientLaserProgrammingPayload({
      fixture: {
        brightness: 0.9,
        fanSpread: 8,
        rotation: 90,
        beamAngle: 45,
        targetPosition: { x: 1, y: 2 },
        scanner: { patternType: 'circle', direction: 'reverse', opticalCopyCount: 20, phase: 0.25 },
      },
      modulations: [
        { source: 'energy', target: 'fixture.geometry.rayCount', amount: 1 },
        { source: 'energy', target: 'fixture.brightness', amount: 0.2 },
      ],
    }, 'transient')
    expect(sanitized.payload.fixture?.brightness).toBe(0.9)
    expect(sanitized.payload.fixture?.fanSpread).toBe(8)
    expect(sanitized.payload.fixture?.scanner?.phase).toBe(0.25)
    expect(sanitized.payload.fixture?.rotation).toBeUndefined()
    expect(sanitized.payload.fixture?.beamAngle).toBeUndefined()
    expect(sanitized.payload.fixture?.targetPosition).toBeUndefined()
    expect(sanitized.payload.fixture?.scanner?.patternType).toBeUndefined()
    expect(sanitized.payload.fixture?.scanner?.direction).toBeUndefined()
    expect(sanitized.payload.modulations).toHaveLength(1)
    expect(sanitized.suppressed).toContain('fixture.targetPosition')
  })

  it('reports unsafe topology, optics, relationship, duration, and transition definitions', () => {
    const document = adapterDocument()
    const macro = document.macros[0]
    macro.pattern.raySlotCount = 65
    macro.optics.copyCount = 26
    macro.fixtureGroupAssignments[0].relationshipId = 'missing-relationship'
    macro.family = 'tunnel'
    macro.transitionIn = { type: 'opticalModeSwap', durationBeats: 1, blankDisconnectedTravel: false, shutterDuringSwap: false }
    document.cueStacks[0].cues[0].duration = { kind: 'beat' }
    const codes = validateLaserShowProgrammingDocument(document).map(issue => issue.code)
    expect(codes).toContain('continuous-ray-count-mutation')
    expect(codes).toContain('optical-copy-count-unbounded')
    expect(codes).toContain('group-relationship-missing')
    expect(codes).toContain('transition-blanking-required')
    expect(codes).toContain('cue-too-short')
  })

  it('suppresses legacy transient geometry in the integrated resolver and reapplies safe accents after the macro frame', () => {
    const authoredProgram = program()
    const result = resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: rig(),
      program: authoredProgram,
      context: contextAt(2, { kick: true }),
      tuning: authoredProgram.tuning,
      programSeed: 42,
      enabled: true,
      audioIntelligenceEnabled: true,
      fallbackBehavior: 'basicTiming',
      runtimeInvalidationId: 'runtime-1',
    })
    expect(result.activePrimaryCueId).toBe('legacy-cue:drop-scene')
    expect(result.activeAccentCueIds).toContain('drop-scene:kick-accent')
    expect(result.diagnostics.suppressedAudioGeometryMappings).toContain('fixture.targetPosition')
    expect(result.diagnostics.suppressedAudioGeometryMappings).toContain('fixture.scanner.patternType')
    expect(result.showDirector.fixtures.every(item => item.brightness === 0.95)).toBe(true)
    expect(result.stablePatternFrame?.topologyId).toBe('legacy-topology:drop-scene')
  })

  it('preserves Live and Capture presentation state without adding renderer-facing overlays', () => {
    for (const presentationMode of ['live', 'capture'] as const) {
      const authoredProgram = program()
      const result = resolveLaserDmxShowDirectorPerformance({
        authoredShowDirector: rig(presentationMode),
        program: authoredProgram,
        context: contextAt(2),
        tuning: authoredProgram.tuning,
        programSeed: 42,
        enabled: true,
        audioIntelligenceEnabled: true,
        fallbackBehavior: 'basicTiming',
        runtimeInvalidationId: `runtime-${presentationMode}`,
      })
      expect(result.showDirector.settings.presentationMode).toBe(presentationMode)
      expect(result.showDirector.settings.showGrid).toBe(rig(presentationMode).settings.showGrid)
    }
  })

  it('attaches one authoritative macro scan plan per controlled fixture', () => {
    const result = resolveDocument(withRelationship('mirrored'), 2)
    const plans = result.showDirector.fixtures.map(item => item.runtimeScanner?.macroPlan)
    expect(plans.every(Boolean)).toBe(true)
    expect(result.showDirector.fixtures.every(item => item.runtimeScanner?.authoritativeSource === 'macro')).toBe(true)
    expect(new Set(plans.map(plan => plan?.topologyCacheKey)).size).toBe(1)
    expect(plans[0]?.relationshipMode).toBe('mirrored')
    expect(plans[0]?.fixtureMemberCount).toBe(2)
  })

  it('uses the topology cache without keying it to raw audio values', () => {
    const document = adapterDocument()
    document.macros[0].id = 'cache-audio-independent'
    document.macros[0].pattern.topologyId = 'cache-audio-independent-topology'
    document.cueStacks[0].cues[0].macroId = document.macros[0].id
    const baseProgram = { ...program(), laserProgramming: document }
    const resolveWithContext = (energy: number) => resolveLaserShowProgramming({
      document,
      program: baseProgram,
      selectedScene: baseProgram.scenes[0],
      authoredRig: rig(),
      runtimeRig: rig(),
      context: { ...contextAt(1), energy, trackRelativeEnergy: energy },
      programSeed: 42,
    })
    const cold = resolveWithContext(0.1)
    const hot = resolveWithContext(0.95)
    expect(cold.frame?.topologyCacheKey).toBe(hot.frame?.topologyCacheKey)
    expect(cold.frame?.raySlots).toEqual(hot.frame?.raySlots)
    expect(hot.frame?.patternFrameCacheHit).toBe(true)
    expect(hot.diagnostics.topologyChangesPerCue).toBe(0)
  })

  it('keeps opposed groups locked to one cue with deterministic opposite directions', () => {
    const result = resolveDocument(withRelationship('opposed'), 2)
    const [left, right] = result.showDirector.fixtures.map(item => item.runtimeScanner?.macroPlan)
    expect(left?.cueFrameId).toBe(right?.cueFrameId)
    expect(left?.scanRatePps).toBe(right?.scanRatePps)
    expect(left?.fanSpreadDeg).toBe(right?.fanSpreadDeg)
    expect(left?.direction).not.toBe(right?.direction)
    expect(result.diagnostics.fixtureGroupSynchronizationStatus).toBe('synchronized')
  })

  it('drives nonlaser fixtures from authored macro events instead of raw energy', () => {
    const strobe = resolveMixedFixtureFamily('strobeAccent')
    expect(fixture(strobe, 'strobe-a').brightness).toBeGreaterThan(0)
    expect(fixture(strobe, 'strobe-a').component.strobeRate).toBeGreaterThan(0)
    expect(fixture(strobe, 'co2-a').brightness).toBe(0)

    const blinder = resolveMixedFixtureFamily('blinderImpact')
    expect(fixture(blinder, 'blinder-a').brightness).toBeGreaterThan(0)
    expect(fixture(blinder, 'strobe-a').brightness).toBe(0)

    const co2 = resolveMixedFixtureFamily('co2Impact')
    expect(fixture(co2, 'co2-a').brightness).toBeGreaterThan(0)
    expect(fixture(co2, 'co2-a').component.co2BurstDurationMs).toBeGreaterThanOrEqual(80)
    expect(fixture(co2, 'co2-a').component.co2BurstDurationMs).toBeLessThanOrEqual(1_500)

    const mixedA = resolveMixedFixtureFamily('mixedFixtureScene')
    const mixedB = resolveMixedFixtureFamily('mixedFixtureScene')
    expect(fixture(mixedA, 'led-a').rotation).toBe(fixture(mixedB, 'led-a').rotation)
    expect(fixture(mixedA, 'haze-a').component.hazeIntensity).toBeGreaterThanOrEqual(0)
    expect(fixture(mixedA, 'moving-head-a').optics.goboRotation % 15).toBe(0)
  })

  it('quantizes direction automation and shutters the scanner during a safe swap', () => {
    const document = adapterDocument()
    document.cueStacks[0].cues[0].duration = { kind: 'explicitBeats', beats: 8 }
    document.macros[0].automation = [{
      id: 'quantized-reverse', parameter: 'direction', from: 0, to: 1, startProgress: 0, endProgress: 1, curve: 'linear',
    }]
    document.macros[0].transitionIn = {
      type: 'shutterOutIn', durationBeats: 2, blankDisconnectedTravel: true, shutterDuringSwap: true,
    }
    const sameBeatA = resolveDocument(document, 0.1)
    const sameBeatB = resolveDocument(document, 0.2)
    const swap = resolveDocument(document, 0.5)
    expect(sameBeatA.frame?.direction).toBe(sameBeatB.frame?.direction)
    expect(swap.frame?.shutterClosed).toBe(true)
    expect(swap.showDirector.fixtures.every(item => item.runtimeScanner?.macroPlan?.clearTemporalHistory)).toBe(true)
  })

})
