import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../musicIntelligence/types'
import type { ReactTrackSection } from '../../components/vyzualz/react/ReactTypes'
import {
  applySharedPerformanceActions,
  buildSharedPerformanceContext,
  resolveSharedPerformanceCadence,
  resolveSharedPerformanceEventEnvelope,
  resolveSharedPerformanceProgram,
  resolveSharedPerformanceSignals,
  selectSharedPerformanceWeightedVariation,
  smoothSharedPerformanceModulation,
} from '.'
import { buildLaserDmxShowDirectorPerformanceContext } from '../../components/vyzualz/react/LaserDmxShowDirectorPerformanceContext'

function frame(timeSec: number, overrides: Partial<MusicIntelligenceFrame> = {}): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    ...overrides,
    timeSec,
    frameId: 1,
    trackId: 'track-a',
    analysisRevision: 'analysis-r1',
    timelineRevision: 'timeline-r1',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      normalizedBass: 0.72,
      normalizedMid: 0.48,
      normalizedHigh: 0.35,
      ...overrides.bands,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: overrides.rhythm?.beatHit ?? false,
      downbeatHit: overrides.rhythm?.downbeatHit ?? false,
      ...overrides.rhythm,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.68,
      percentile: 0.74,
      spectralFlux: 0.43,
      tension: 0.61,
      complexity: 0.52,
      buildProgress: 0.3,
      dropImpact: 0.2,
      ...overrides.energy,
    },
    section: { ...DEFAULT_MI_FRAME.section, ...overrides.section },
    harmonic: { ...DEFAULT_MI_FRAME.harmonic, ...overrides.harmonic },
    stems: { ...DEFAULT_MI_FRAME.stems, vocalEnergy: 0.44, ...overrides.stems },
    lyrics: { ...DEFAULT_MI_FRAME.lyrics, ...overrides.lyrics },
    semantics: { ...DEFAULT_MI_FRAME.semantics, ...overrides.semantics },
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, beatGrid: true, sections: true, ...overrides.capabilities },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.9, rhythm: 0.9, section: 0.9, ...overrides.confidence },
    raw: { ...DEFAULT_MI_FRAME.raw, ...overrides.raw },
  }
}

const sections: ReactTrackSection[] = [
  {
    id: 'drop-1a', label: 'Drop 1 A', type: 'drop', startSec: 0, endSec: 8, intensity: 0.9,
    source: 'auto', confidence: 0.92, interpretation: { familyId: 'drop-family', occurrenceIndex: 1 },
  },
  {
    id: 'drop-1b', label: 'Drop 1 B', type: 'drop', startSec: 8, endSec: 16, intensity: 0.94,
    source: 'auto', confidence: 0.91, interpretation: { familyId: 'drop-family', occurrenceIndex: 1, isVariation: true },
  },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 16, endSec: 24, intensity: 0.25, source: 'auto', confidence: 0.86 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 24, endSec: 40, intensity: 1, source: 'auto', confidence: 0.95, interpretation: { familyId: 'drop-family', occurrenceIndex: 2 } },
]

function contextAt(timeSec: number, previous: ReturnType<typeof buildSharedPerformanceContext> | null = null, identities: { seek?: string; loop?: string; track?: string } = {}) {
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: frame(timeSec),
    resolvedSections: sections,
    trackIdentity: identities.track ?? 'track-a',
    seekIdentity: identities.seek ?? 'seek-0',
    loopIdentity: identities.loop ?? 'loop-0',
    trackChangeIdentity: `track-change:${identities.track ?? 'track-a'}`,
    previous,
  })
}

describe('shared musical Performance Core', () => {
  it('publishes engine-neutral cadence, section family, and continuous analysis without reanalyzing the track', () => {
    const context = contextAt(10)
    expect(context).toMatchObject({
      beatIndex: 20,
      barIndex: 5,
      sectionId: 'drop-1b',
      sectionFamily: 'drop-family',
      sectionOccurrence: 1,
      dropOccurrence: 1,
      macroSectionType: 'drop',
      performanceFourBarBlockIndex: 1,
      performanceEightBarBlockIndex: 0,
      bass: 0.72,
      trackRelativeEnergy: 0.74,
      tension: 0.61,
      vocalEnergy: 0.44,
    })
    expect(resolveSharedPerformanceCadence(context)).toMatchObject({
      barStage: 6,
      fourBarBlockIndex: 1,
      eightBarRecruitmentStage: 1,
      sixteenBarEvolutionStage: 1,
    })
  })

  it('keeps the macro clock continuous across fine same-role sections while exposing entry, body, and exit phases', () => {
    const entry = contextAt(0.1)
    const body = contextAt(4, entry)
    const fineBoundary = contextAt(8.1, body)
    const exit = contextAt(15.7, fineBoundary)
    expect(entry.sectionPhase).toBe('entry')
    expect(body.sectionPhase).toBe('body')
    expect(fineBoundary.boundaries.sectionEntry).toBe(true)
    expect(fineBoundary.boundaries.macroSectionEntry).toBe(false)
    expect(fineBoundary.performanceFourBarBlockIndex).toBe(1)
    expect(exit.macroSectionPhase).toBe('exit')
  })

  it('detects seek, loop wrap, and track replacement independently and retains deterministic variation at the same musical position', () => {
    const direct = contextAt(25)
    const sought = contextAt(25, direct, { seek: 'seek-1' })
    const looped = contextAt(25, sought, { seek: 'seek-1', loop: 'loop-1' })
    const replaced = contextAt(25, looped, { seek: 'seek-1', loop: 'loop-1', track: 'track-b' })
    expect(sought.seekDetected).toBe(true)
    expect(sought.loopWrapDetected).toBe(false)
    expect(looped.loopWrapDetected).toBe(true)
    expect(replaced.trackReplacementDetected).toBe(true)
    expect(sought.deterministicVariationSeed).toBe(direct.deterministicVariationSeed)
    expect(looped.deterministicVariationSeed).toBe(direct.deterministicVariationSeed)
  })

  it('separates discrete events from continuous modulation values', () => {
    const previous = contextAt(1.9)
    const context = buildSharedPerformanceContext({
      audioTimeSec: 2,
      frame: frame(2, {
        rhythm: { ...frame(2).rhythm, beatHit: true, downbeatHit: true, kickHit: true, kickStrength: 0.9 },
      }),
      resolvedSections: sections,
      trackIdentity: 'track-a',
      previous,
    })
    const signals = resolveSharedPerformanceSignals(context)
    expect(signals.discrete.beat.active).toBe(true)
    expect(signals.discrete.downbeat.active).toBe(true)
    expect(signals.discrete.kick).toMatchObject({ active: true, strength: 0.9 })
    expect(signals.continuous).toMatchObject({ bass: 0.72, energy: 0.68, tension: 0.61 })
  })

  it('resolves attack/hold/release pulses and continuous smoothing independently', () => {
    const envelope = { attack: 0.1, hold: 0.2, release: 0.7, curve: 'linear' as const }
    expect(resolveSharedPerformanceEventEnvelope(0.05, envelope)).toBeCloseTo(0.5)
    expect(resolveSharedPerformanceEventEnvelope(0.2, envelope)).toBe(1)
    expect(resolveSharedPerformanceEventEnvelope(0.65, envelope)).toBeCloseTo(0.5)
    expect(resolveSharedPerformanceEventEnvelope(1, envelope)).toBe(0)

    const state = { value: 0, initialized: false }
    expect(smoothSharedPerformanceModulation(state, 0.25, 1 / 60, 0.1, 0.3)).toBe(0.25)
    const rising = smoothSharedPerformanceModulation(state, 1, 1 / 60, 0.1, 0.3)
    const falling = smoothSharedPerformanceModulation(state, 0, 1 / 60, 0.1, 0.3)
    expect(rising).toBeGreaterThan(0.25)
    expect(falling).toBeLessThan(rising)
    expect(falling).toBeGreaterThan(0)
  })

  it('resolves scene fallback, occurrence variation, cadence actions, and event intent without engine objects', () => {
    const lowConfidence = buildSharedPerformanceContext({
      audioTimeSec: 25,
      frame: frame(25, { confidence: { ...frame(25).confidence, section: 0.2 } }),
      resolvedSections: sections.map(section => ({ ...section, confidence: 0.2 })),
      trackIdentity: 'track-a',
    })
    const program = {
      id: 'generic-program',
      fallbackOrder: ['verse'] as const,
      scenes: [
        { id: 'drop', sectionTypes: ['drop'] as const, minConfidence: 0.8, actions: ['drop-base'] },
        {
          id: 'verse', sectionTypes: ['verse'] as const, actions: ['fallback-base'],
          entryActions: ['enter'], bodyActions: ['body'], exitActions: ['exit'],
          fourBarActions: [['motif-a'], ['motif-b']],
          eightBarRecruitment: [['recruit-a'], ['recruit-b']],
          eventActions: { kick: ['kick-hit'] },
          variations: [{ id: 'v1', weight: 1, actions: ['variation'] }],
        },
      ],
    }
    const resolution = resolveSharedPerformanceProgram(program, lowConfidence)
    expect(resolution.scene?.id).toBe('verse')
    expect(resolution.variation?.id).toBe('v1')
    expect(resolution.intents.map(intent => intent.reason)).toContain('fourBarMotif')
    expect(resolution.deterministicIdentity).toContain('generic-program|verse')
  })

  it('gives adapter-defined user locks precedence over performance actions', () => {
    const result = applySharedPerformanceActions(
      { locked: new Set(['brightness']), values: { brightness: 0.4, motion: 0.2 } },
      [
        { key: 'brightness' as const, value: 1 },
        { key: 'motion' as const, value: 0.8 },
      ],
      {
        isLocked: (state, action) => state.locked.has(action.key),
        apply: (state, action) => ({ ...state, values: { ...state.values, [action.key]: action.value } }),
      },
    )
    expect(result.values).toEqual({ brightness: 0.4, motion: 0.8 })
  })

  it('keeps deterministic weighted variation stable across seek and loop identities', () => {
    const direct = selectSharedPerformanceWeightedVariation([{ id: 'a', weight: 1 }, { id: 'b', weight: 2 }], [77, 'scene', 'section', 2, 3])
    const repeated = selectSharedPerformanceWeightedVariation([{ id: 'a', weight: 1 }, { id: 'b', weight: 2 }], [77, 'scene', 'section', 2, 3])
    expect(repeated).toEqual(direct)
  })

  it('keeps the legacy LaserDMX context facade equivalent to the shared implementation', () => {
    const input = { audioTimeSec: 10, frame: frame(10), resolvedSections: sections, trackIdentity: 'track-a' }
    expect(JSON.stringify(buildLaserDmxShowDirectorPerformanceContext(input))).toBe(JSON.stringify(buildSharedPerformanceContext(input)))
  })
})
