import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import type { NeonLatticePhraseProgram, NeonLatticeSettings } from '../../ReactTypes'
import { DEFAULT_NEON_LATTICE_SETTINGS } from '../../ReactTypes'
import {
  activeNeonLatticeOverrideNames,
  applyNeonLatticePaletteRuntime,
  applyNeonLatticePhraseRuntime,
  computeNeonLatticePhraseProgressModulation,
  consumeNeonLatticeAudioFrame,
  createNeonLatticeAudioDirectorState,
  executeNeonLatticePhraseActions,
  resetNeonLatticeAudioDirector,
  resetNeonLatticePhraseOverrides,
  resolvePhraseBoundaryPriority,
  validateNeonLatticePhraseCompleteness,
} from '../neonLatticeAudioDirector'

function settings(overrides: Partial<NeonLatticeSettings> = {}): NeonLatticeSettings {
  return {
    ...DEFAULT_NEON_LATTICE_SETTINGS,
    ...overrides,
    lineEnvelope: { ...DEFAULT_NEON_LATTICE_SETTINGS.lineEnvelope, ...overrides.lineEnvelope },
    orientationWeights: { ...DEFAULT_NEON_LATTICE_SETTINGS.orientationWeights, ...overrides.orientationWeights },
    lanePattern: {
      ...DEFAULT_NEON_LATTICE_SETTINGS.lanePattern,
      ...overrides.lanePattern,
      orientations: [...(overrides.lanePattern?.orientations ?? DEFAULT_NEON_LATTICE_SETTINGS.lanePattern.orientations)],
      steps: (overrides.lanePattern?.steps ?? DEFAULT_NEON_LATTICE_SETTINGS.lanePattern.steps).map(step => ({ ...step, lanes: [...step.lanes] })),
    },
    triggerRoutes: (overrides.triggerRoutes ?? DEFAULT_NEON_LATTICE_SETTINGS.triggerRoutes).map(route => ({ ...route })),
    modulationRoutes: { ...DEFAULT_NEON_LATTICE_SETTINGS.modulationRoutes, ...overrides.modulationRoutes },
    phrasePrograms: (overrides.phrasePrograms ?? []).map(program => ({ ...program, actions: program.actions.map(action => ({ ...action })) })),
  }
}

function frame(overrides: {
  frameId?: number
  timeSec?: number
  sourceId?: string | null
  trackId?: string | null
  beatIndex?: number
  barIndex?: number
  beatHit?: boolean
  downbeatHit?: boolean
  kickHit?: boolean
  snareHit?: boolean
  hatHit?: boolean
  bass?: number
  energy?: number
  build?: number
  drop?: number
  sectionStart?: number
  phrase4Hit?: boolean
  phrase8Hit?: boolean
  phrase16Hit?: boolean
  phrase32Hit?: boolean
  phrase4Progress?: number
  phrase8Progress?: number
  phrase16Progress?: number
  phrase32Progress?: number
} = {}): MusicIntelligenceFrame {
  const beatIndex = overrides.beatIndex ?? 0
  const bands = {
    sub: 0, bass: overrides.bass ?? 0, lowMid: 0, mid: 0, high: 0, air: 0, volume: overrides.energy ?? 0,
    normalizedSub: 0, normalizedBass: overrides.bass ?? 0, normalizedLowMid: 0, normalizedMid: 0, normalizedHigh: 0, normalizedAir: 0,
  }
  return {
    timeSec: overrides.timeSec ?? 0,
    frameId: overrides.frameId ?? 1,
    sampleRate: 48_000,
    sourceId: overrides.sourceId ?? 'source-a',
    trackId: overrides.trackId ?? 'track-a',
    bands,
    rhythm: {
      bpm: 128, bpmConfidence: 1, beatPhase: 0,
      beatHit: overrides.beatHit ?? false,
      beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: overrides.barIndex ?? Math.floor(beatIndex / 4),
      downbeatHit: overrides.downbeatHit ?? false,
      phrase4Progress: overrides.phrase4Progress ?? 0,
      phrase8Progress: overrides.phrase8Progress ?? 0,
      phrase16Progress: overrides.phrase16Progress ?? 0,
      phrase32Progress: overrides.phrase32Progress ?? 0,
      phrase4Hit: overrides.phrase4Hit ?? false,
      phrase8Hit: overrides.phrase8Hit ?? false,
      phrase16Hit: overrides.phrase16Hit ?? false,
      phrase32Hit: overrides.phrase32Hit ?? false,
      kickHit: overrides.kickHit ?? false, kickStrength: 0.9,
      snareHit: overrides.snareHit ?? false, snareStrength: 0.8,
      hatHit: overrides.hatHit ?? false, hatStrength: 0.7,
      transient: 0, transientConfidence: 1,
    },
    energy: {
      instant: overrides.energy ?? 0.4, shortTerm: 0, longTerm: 0, peak: 0, rms: 0, crestFactor: 0,
      spectralFlux: 0, delta: 0, percentile: 0,
      buildProgress: overrides.build ?? 0, dropImpact: overrides.drop ?? 0, tension: 0, complexity: 0,
      spectralCentroid: 0, spectralSpread: 0, spectralRolloff: 0, spectralFlatness: 0,
    },
    section: {
      type: 'verse', label: 'verse', startSec: overrides.sectionStart ?? 0, endSec: 32,
      progress: 0.25, intensity: 0.6, confidence: 1, source: 'analysis',
    },
    harmonic: { key: null, mode: null, keyConfidence: 0, chord: null, chordConfidence: 0, chordChanged: false, rootNote: null, pitchHz: null, note: null, melodyContour: null },
    stems: { vocals: 0, drums: 0, bass: 0, instruments: 0, other: 0, vocalEnergy: 0, drumEnergy: 0, bassStemEnergy: 0, instrumentEnergy: 0, otherStemEnergy: 0, vocalActivity: 0, drumTransient: false, bassStemTransient: false },
    lyrics: { activeLine: null, activeWord: null, vocalActivity: 0, phraseConfidence: 0, lyricLineProgress: 0, wordHit: false },
    semantics: { buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0, vocalHookConfidence: 0, mood: null, texture: null },
    raw: { freqData: null, timeDomainData: null },
    confidence: { overall: 1, rhythm: 1, harmonic: 0, section: 1 },
  }
}

function consume(
  state: ReturnType<typeof createNeonLatticeAudioDirectorState>,
  nextFrame: MusicIntelligenceFrame | null,
  options: { audioTime?: number; isPlaying?: boolean; isPaused?: boolean; timingDiscontinuity?: boolean; trackKey?: string } = {},
) {
  return consumeNeonLatticeAudioFrame(state, {
    frame: nextFrame,
    settings: settings(),
    isPlaying: options.isPlaying ?? true,
    isPaused: options.isPaused,
    timingDiscontinuity: options.timingDiscontinuity,
    audioTime: options.audioTime ?? nextFrame?.timeSec ?? 0,
    trackKey: options.trackKey,
  })
}

const programs: NeonLatticePhraseProgram[] = ([4, 8, 16, 32] as const).map(scale => ({
  id: `phrase-${scale}`,
  name: `${scale} beat`,
  phraseBeats: scale,
  boundary: 'phrase',
  every: 1,
  actions: [{ type: scale === 4 ? 'spawnLine' : scale === 8 ? 'lineSweep' : scale === 16 ? 'highlightStrike' : 'blockCascade' }],
}))

describe('canonical Neon Lattice audio event consumption', () => {
  it('consumes one beat once and suppresses repeated renderer frames', () => {
    const state = createNeonLatticeAudioDirectorState()
    const first = consume(state, frame({ frameId: 10, beatIndex: 4, beatHit: true }), { audioTime: 2 })
    const duplicate = consume(state, frame({ frameId: 10, beatIndex: 4, beatHit: true }), { audioTime: 2.01 })
    expect(first.events.map(event => event.source)).toContain('beat')
    expect(duplicate.events).toEqual([])
    expect(state.diagnostics.skippedDuplicateEvent).toBe('frame:10')
  })

  it('routes kick, snare, hat, and downbeat independently without sticky duplicates', () => {
    const state = createNeonLatticeAudioDirectorState()
    const first = consume(state, frame({ frameId: 1, beatIndex: 8, barIndex: 2, downbeatHit: true, kickHit: true, snareHit: true, hatHit: true }))
    expect(first.events.map(event => event.source)).toEqual(expect.arrayContaining(['downbeat', 'kick', 'snare', 'hat']))
    const sticky = consume(state, frame({ frameId: 2, beatIndex: 8, barIndex: 2, downbeatHit: true, kickHit: true, snareHit: true, hatHit: true }))
    expect(sticky.events).toEqual([])
  })

  it('emits edge-safe bass and drop threshold events', () => {
    const state = createNeonLatticeAudioDirectorState()
    consume(state, frame({ frameId: 1, bass: 0.2, drop: 0.1 }))
    const crossed = consume(state, frame({ frameId: 2, bass: 0.9, drop: 0.9 }))
    expect(crossed.events.map(event => event.source)).toEqual(expect.arrayContaining(['bassEvent', 'dropImpact']))
    const held = consume(state, frame({ frameId: 3, bass: 0.95, drop: 0.95 }))
    expect(held.events.map(event => event.source)).not.toEqual(expect.arrayContaining(['bassEvent', 'dropImpact']))
  })

  it('stays silent with no analysis and rebases events while paused', () => {
    const state = createNeonLatticeAudioDirectorState()
    expect(consume(state, null).events).toEqual([])
    expect(consume(state, frame({ frameId: 1, beatIndex: 1, beatHit: true }), { isPlaying: false, isPaused: true }).events).toEqual([])
    expect(consume(state, frame({ frameId: 1, beatIndex: 1, beatHit: true }), { isPlaying: true }).events).toEqual([])
  })

  it('classifies track replacement, forward seek, backward seek, loop, and analysis replacement', () => {
    const state = createNeonLatticeAudioDirectorState()
    consume(state, frame({ frameId: 10, timeSec: 10 }), { audioTime: 10, trackKey: 'a' })
    expect(consume(state, frame({ frameId: 11, timeSec: 12 }), { audioTime: 12, timingDiscontinuity: true, trackKey: 'a' }).resetReason).toBe('forwardSeek')
    expect(consume(state, frame({ frameId: 12, timeSec: 4 }), { audioTime: 4, timingDiscontinuity: true, trackKey: 'a' }).resetReason).toBe('backwardSeek')
    expect(consume(state, frame({ frameId: 13, timeSec: 0.1 }), { audioTime: 0.1, timingDiscontinuity: true, trackKey: 'a' }).resetReason).toBe('loopRestart')
    expect(consume(state, frame({ frameId: 14, timeSec: 0.2 }), { audioTime: 0.2, trackKey: 'b' }).resetReason).toBe('trackReplacement')
    expect(consume(state, frame({ frameId: 2, timeSec: 0.3, sourceId: 'source-b', trackId: 'track-b' }), { audioTime: 0.3, trackKey: 'b' }).resetReason).toBe('analysisReplacement')
  })
})

describe('phrase boundary routing and priority', () => {
  it.each([4, 8, 16, 32] as const)('consumes a %i-beat phrase hit', scale => {
    const state = createNeonLatticeAudioDirectorState()
    const hit = consume(state, frame({ frameId: scale, beatIndex: 32, [`phrase${scale}Hit`]: true }))
    expect(hit.events).toContainEqual(expect.objectContaining({ source: `phrase${scale}`, phraseScale: scale }))
  })

  it('defaults to longest-only priority', () => {
    expect(resolvePhraseBoundaryPriority([4, 8, 16, 32], settings({ phrasePrograms: programs }))).toEqual([32])
  })

  it('supports stack-all and preset-defined stacking', () => {
    expect(resolvePhraseBoundaryPriority([4, 8, 16, 32], settings({ phraseStackingPolicy: 'stackAll', phrasePrograms: programs }))).toEqual([32, 16, 8, 4])
    const authored = programs.map(program => ({ ...program, stackWithLonger: program.phraseBeats === 8 }))
    expect(resolvePhraseBoundaryPriority([4, 8, 16, 32], settings({ phraseStackingPolicy: 'presetDefined', phrasePrograms: authored }))).toEqual([32, 8])
  })
})

describe('phrase actions, modulation, and validation', () => {
  it('restores temporary overrides at their authored reset boundary without mutating base settings', () => {
    const base = settings({ compositionMode: 'laneSequencer' })
    const result = executeNeonLatticePhraseActions({}, [{
      type: 'temporaryLaneCountChange', laneCount: 12, persistence: 'temporary', resetOn: 'sectionChange',
    }], base)
    expect(applyNeonLatticePhraseRuntime(base, result.runtime).lanePattern.laneCount).toBe(12)
    expect(base.lanePattern.laneCount).toBe(DEFAULT_NEON_LATTICE_SETTINGS.lanePattern.laneCount)
    const restored = resetNeonLatticePhraseOverrides(result.runtime, 'sectionChange')
    expect(activeNeonLatticeOverrideNames(restored)).toEqual([])
  })

  it('keeps persistent changes until a terminal preset reset', () => {
    const base = settings({ compositionMode: 'laneSequencer' })
    const result = executeNeonLatticePhraseActions({}, [{ type: 'mirroredLayout', enabled: true, persistence: 'persistent' }], base)
    expect(resetNeonLatticePhraseOverrides(result.runtime, 'nextPhrase').mirrored).toBeDefined()
    expect(resetNeonLatticePhraseOverrides(result.runtime, 'presetChange').mirrored).toBeUndefined()
  })

  it('uses canonical phrase progress and clamps energy-driven chord and lane bonuses', () => {
    const mod = computeNeonLatticePhraseProgressModulation(frame({
      energy: 10, build: 10, phrase4Progress: 0.5, phrase8Progress: 0.5, phrase16Progress: 0.5, phrase32Progress: 0.5,
    }), settings({
      compositionMode: 'laneSequencer',
      modulationRoutes: {
        ...DEFAULT_NEON_LATTICE_SETTINGS.modulationRoutes,
        energyToChordSize: 1,
        energyToActiveLanes: 1,
        buildToPatternRate: 1,
        phrase4ProgressToDensity: 1,
        phrase8ProgressToBloom: 1,
        phrase16ProgressToSpacing: 1,
        phrase32ProgressToDiagonalWeight: 1,
      },
    }))
    expect(mod.chordSizeBonus).toBeLessThanOrEqual(4)
    expect(mod.activeLaneBonus).toBeLessThanOrEqual(4)
    expect(mod.laneSpacingScale).toBeGreaterThanOrEqual(0.5)
    expect(mod.patternRateMultiplier).toBeLessThanOrEqual(2)
  })

  it('validates intentional and distinct 4, 8, 16, and 32 beat programs while exempting legacy presets', () => {
    expect(validateNeonLatticePhraseCompleteness(settings()).exempt).toBe(true)
    expect(validateNeonLatticePhraseCompleteness(settings({ compositionMode: 'laneSequencer', phrasePrograms: programs }))).toMatchObject({ valid: true, missing: [] })
    expect(validateNeonLatticePhraseCompleteness(settings({ compositionMode: 'laneSequencer', phrasePrograms: programs.slice(0, 3) }))).toMatchObject({ valid: false, missing: [32] })
  })

  it('applies phrase palette rotation without mutating the Brand Kit roles', () => {
    const palette = { primary: 'p', secondary: 's', accent: 'a', highlight: 'h', background: 'b' }
    const rotated = applyNeonLatticePaletteRuntime(palette, {
      paletteOffset: { value: 1, resetOn: 'nextPhrase', persistent: false },
    })
    expect(rotated).toEqual({ primary: 's', secondary: 'a', accent: 'h', highlight: 'p', background: 'b' })
    expect(palette).toEqual({ primary: 'p', secondary: 's', accent: 'a', highlight: 'h', background: 'b' })
  })

  it('clears stale event, phrase, sequence, and transport diagnostics on reset', () => {
    const state = createNeonLatticeAudioDirectorState()
    state.wasPlaying = true
    state.lastEventIdentity.beat = 'old-beat'
    state.diagnostics.lastConsumedAudioEvent = 'old-event'
    state.diagnostics.lastPhraseBoundaryConsumed = 32
    state.diagnostics.boundaryPriorityDecision = 'old-priority'
    state.diagnostics.lastPhraseActionExecuted = 'blackout'
    state.diagnostics.currentSequenceStep = 12
    state.diagnostics.activeTemporaryOverrides = ['paletteOffset']
    resetNeonLatticeAudioDirector(state, 'trackReplacement', frame({ frameId: 77 }), 'new-track')
    expect(state.wasPlaying).toBe(false)
    expect(state.lastEventIdentity).toEqual({})
    expect(state.diagnostics).toMatchObject({
      lastConsumedAudioEvent: null,
      lastPhraseBoundaryConsumed: null,
      boundaryPriorityDecision: null,
      lastPhraseActionExecuted: null,
      currentSequenceStep: -1,
      activeTemporaryOverrides: [],
      phraseResetReason: 'trackReplacement',
    })
  })

  it('contains no elapsed-seconds phrase clock', () => {
    const source = readFileSync(new URL('../neonLatticeAudioDirector.ts', import.meta.url), 'utf8')
    expect(source).toContain('phrase32Progress')
    expect(source).not.toMatch(/audioTime\s*\/\s*beat|elapsed\w*\s*\/\s*phrase/i)
  })
})
