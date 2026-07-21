import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { DEFAULT_OSCILLATOR_SETTINGS, type OscillatorSettings, type ReactTrackSection } from '../ReactTypes'
import type { ReactFrameContext } from '../renderers/reactRenderUtils'
import { computeRuntimeSoundDrawingContourScale, sampleCoherentSoundDrawingNoise, shouldApplyGenericSoundDrawingPathDisplacement } from '../renderers/SoundDrawingRenderer'
import { getSoundDrawingBehaviorRuntimeStats } from './SoundDrawingBehaviorRuntime'
import { resolveSoundDrawingPerformanceFrame } from './SoundDrawingPerformanceEngine'
import { SOUND_DRAWING_PERFORMANCE_SHOWS } from './SoundDrawingPerformanceShows'
import { computeCombinedContourBudget } from './SoundDrawingSourceResolver'
import {
  DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  MAX_SOUND_DRAWING_PERFORMANCE_LAYERS,
  MAX_SOUND_DRAWING_SVG_DUPLICATES,
  MAX_SOUND_DRAWING_TEXT_DUPLICATES,
  type SoundDrawingPerformanceSettings,
  type SoundDrawingPerformanceTemporalState,
  type SoundDrawingResolvedPerformanceFrame,
} from './SoundDrawingPerformanceTypes'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.2, source: 'auto', confidence: 0.95 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 8, endSec: 16, intensity: 0.45, source: 'auto', confidence: 0.95 },
  { id: 'build', label: 'Build', type: 'build', startSec: 16, endSec: 24, intensity: 0.75, source: 'auto', confidence: 0.95 },
  { id: 'pre', label: 'Pre-Drop', type: 'preDrop', startSec: 24, endSec: 28, intensity: 0.45, source: 'auto', confidence: 0.95 },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 28, endSec: 68, intensity: 0.95, source: 'auto', confidence: 0.97, interpretation: { familyId: 'drop', occurrenceIndex: 1 } },
  { id: 'break', label: 'Breakdown', type: 'breakdown', startSec: 68, endSec: 84, intensity: 0.25, source: 'auto', confidence: 0.94 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 84, endSec: 124, intensity: 1, source: 'auto', confidence: 0.98, interpretation: { familyId: 'drop', occurrenceIndex: 2 } },
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 124, endSec: 140, intensity: 0.18, source: 'auto', confidence: 0.9 },
]

type EventName = 'kick' | 'snare' | 'hat' | 'downbeat'

function intelligence(timeSec: number, events: readonly EventName[] = [], bass = 0.72, trackId = 'track-a'): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const eventSet = new Set(events)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.floor(timeSec * 60)),
    trackId,
    sourceId: trackId,
    analysisRevision: 'analysis-r1',
    timelineRevision: 'timeline-r1',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      bass,
      mid: 0.48,
      high: 0.56,
      volume: 0.68,
      normalizedBass: bass,
      normalizedMid: 0.48,
      normalizedHigh: 0.56,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.96,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: events.length > 0,
      downbeatHit: eventSet.has('downbeat'),
      kickHit: eventSet.has('kick'),
      kickStrength: eventSet.has('kick') ? 0.95 : 0,
      snareHit: eventSet.has('snare'),
      snareStrength: eventSet.has('snare') ? 0.9 : 0,
      hatHit: eventSet.has('hat'),
      hatStrength: eventSet.has('hat') ? 0.82 : 0,
      transient: events.length > 0 ? 0.9 : 0,
      transientConfidence: 0.96,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.68,
      shortTerm: 0.66,
      longTerm: 0.58,
      percentile: 0.74,
      spectralFlux: 0.52,
      tension: 0.61,
      complexity: 0.58,
      buildProgress: timeSec >= 16 && timeSec < 24 ? (timeSec - 16) / 8 : 0,
      dropImpact: eventSet.has('downbeat') ? 0.92 : 0,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: false,
      stemCurves: false,
      lyrics: false,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.96, rhythm: 0.96, section: 0.96 },
  }
}

function frameAt(timeSec: number, options: { events?: readonly EventName[]; bass?: number; trackKey?: string; timingDiscontinuity?: boolean } = {}): ReactFrameContext {
  const trackKey = options.trackKey ?? 'track-a'
  const mi = intelligence(timeSec, options.events, options.bass, trackKey)
  return {
    W: 1280,
    H: 720,
    dpr: 1,
    t: timeSec * 1000,
    elapsedTimeSec: timeSec,
    deltaTimeSec: 1 / 60,
    timingDiscontinuity: options.timingDiscontinuity,
    timeSec,
    audioTime: timeSec,
    trackKey,
    bpm: 120,
    beatPhase: mi.rhythm.beatPhase,
    beatHit: mi.rhythm.beatHit,
    isPlaying: true,
    audio: { bass: options.bass ?? 0.72, mid: 0.48, high: 0.56, volume: 0.68 },
    freqData: null,
    timeDomainData: null,
    musicIntelligence: mi,
    trackSections: SECTIONS,
  }
}

function performanceSettings(patch: Partial<SoundDrawingPerformanceSettings> = {}): SoundDrawingPerformanceSettings {
  return {
    ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
    autoPerformance: true,
    complexity: 1,
    motionIntensity: 1,
    reactionIntensity: 1,
    trailIntensity: 1,
    ...patch,
    locks: {
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks,
      ...(patch.locks ?? {}),
    },
  }
}

const textOscillator: OscillatorSettings = {
  ...DEFAULT_OSCILLATOR_SETTINGS,
  sourceType: 'text',
  text: 'DRMVYZ',
  textWaveformMode: 'off',
  textWaveformAmount: 0.22,
  textLetterReactionMode: 'ripple',
  audioDisplacement: 0.25,
  midTwist: 0.7,
  highJitter: 0.25,
  beatBloom: 0.9,
  duplicateTraces: 6,
}

const originalSvgOscillator: OscillatorSettings = {
  ...DEFAULT_OSCILLATOR_SETTINGS,
  sourceType: 'svg',
  selectedSvgId: 'logo-svg',
  svgRenderMode: 'originalArtwork',
  audioDisplacement: 0.25,
  midTwist: 0.7,
  highJitter: 0.25,
  duplicateTraces: 6,
}

const tracedSvgOscillator: OscillatorSettings = {
  ...originalSvgOscillator,
  svgRenderMode: 'reactivePath',
}

function resolve(
  timeSec: number,
  oscillator: OscillatorSettings,
  settingsPatch: Partial<SoundDrawingPerformanceSettings> = {},
  options: Parameters<typeof frameAt>[1] = {},
  previousContext: SoundDrawingResolvedPerformanceFrame['context'] | null = null,
  temporalState?: SoundDrawingPerformanceTemporalState,
): SoundDrawingResolvedPerformanceFrame {
  const result = resolveSoundDrawingPerformanceFrame({
    frame: frameAt(timeSec, options),
    settings: performanceSettings(settingsPatch),
    manualOscillator: oscillator,
    previousContext,
    temporalState,
  })
  expect(result).not.toBeNull()
  return result as SoundDrawingResolvedPerformanceFrame
}

function selectedSource(frame: SoundDrawingResolvedPerformanceFrame) {
  const layer = frame.layers.find(candidate => candidate.source.kind !== 'generated')
  expect(layer).toBeDefined()
  return layer!
}

describe('first-class Sound Drawing text and SVG performance sources', () => {
  it('keeps active text as the primary motif and recruits generated support in every authored show', () => {
    for (const show of SOUND_DRAWING_PERFORMANCE_SHOWS) {
      const result = resolve(31, textOscillator, { selectedShowId: show.id })
      expect(result.activeSourceKind).toBe('text')
      expect(result.activeIdentityProfile).toBe('readableText')
      expect(result.layers[0]).toMatchObject({ role: 'primaryMotif', source: { kind: 'text' } })
      expect(result.supportingGeneratedLayers.length).toBeGreaterThan(0)
      expect(result.layers.some(layer => layer.source.kind === 'generated')).toBe(true)
    }
  })

  it('keeps active SVG as the primary motif and preserves original versus traced rendering paths', () => {
    const original = resolve(31, originalSvgOscillator)
    const traced = resolve(31, tracedSvgOscillator, { preserveIdentity: false, sourceTreatment: 'controlledReactive' })
    expect(selectedSource(original)).toMatchObject({ source: { kind: 'svg', renderMode: 'original-artwork' }, identityProfile: 'originalArtwork' })
    expect(selectedSource(original).contourBudget).toBe(0)
    expect(selectedSource(original).appliedContourDeformation).toBe(0)
    expect(selectedSource(traced)).toMatchObject({ source: { kind: 'svg', renderMode: 'traced-path' }, identityProfile: 'logo' })
    expect(selectedSource(traced).appliedContourDeformation).toBeLessThanOrEqual(0.05)
  })

  it('treats runtime lyric text as a valid first-class source without baking cue text into its identity', () => {
    const lyricText = resolve(31, {
      ...textOscillator,
      text: '',
      textSource: 'activeLyricLine',
      lyricFallbackText: 'LYRICS',
    }, { performanceSource: 'activeText' })
    expect(lyricText.activeSourceKind).toBe('text')
    expect(selectedSource(lyricText).source.identity).toContain('activeLyricLine')
    expect(selectedSource(lyricText).source.identity).not.toContain('undefined')
  })

  it('falls back safely when an explicitly requested source is unavailable', () => {
    const missingText = resolve(31, DEFAULT_OSCILLATOR_SETTINGS, { performanceSource: 'activeText' })
    const missingSvg = resolve(31, { ...DEFAULT_OSCILLATOR_SETTINGS, sourceType: 'svg', selectedSvgId: null }, { performanceSource: 'activeSvg' })
    expect(missingText.layers.every(layer => layer.source.kind === 'generated')).toBe(true)
    expect(missingText.sourceFallbackState).toContain('Active Text')
    expect(missingSvg.layers.every(layer => layer.source.kind === 'generated')).toBe(true)
    expect(missingSvg.sourceFallbackState).toContain('Active SVG')

    const emptyActiveUserText = resolve(31, { ...textOscillator, text: '', textSource: 'static' })
    expect(emptyActiveUserText.layers.every(layer => layer.source.kind === 'generated')).toBe(true)
    expect(emptyActiveUserText.sourceFallbackState).toContain('empty')
  })

  it('supports primary, supporting, both, and generated-only source policies', () => {
    const primary = resolve(31, textOscillator, { useSourceAs: 'primaryMotif' })
    const supporting = resolve(31, textOscillator, { useSourceAs: 'supportingLayer' })
    const both = resolve(31, textOscillator, { useSourceAs: 'both' })
    const generated = resolve(31, textOscillator, { performanceSource: 'generatedVisual' })
    expect(primary.layers[0].source.kind).toBe('text')
    expect(supporting.layers[0].source.kind).toBe('generated')
    expect(supporting.layers.some(layer => layer.source.kind === 'text' && layer.role === 'echoLayer')).toBe(true)
    expect(both.layers.filter(layer => layer.source.kind === 'text').length).toBeGreaterThan(1)
    expect(generated.layers.every(layer => layer.source.kind === 'generated')).toBe(true)
  })

  it('uses conservative combined budgets for controlled and liquid treatments while retaining legacy abstract headroom', () => {
    const controlled = computeCombinedContourBudget({
      profile: 'readableText', treatment: 'controlledReactive', contourReactivity: 1,
      waveform: 0.2, twist: 0.08, jitter: 0.2, character: 0.08, section: 0.05, event: 0.05,
    })
    const liquid = computeCombinedContourBudget({
      profile: 'readableText', treatment: 'liquidContour', contourReactivity: 1,
      waveform: 0.2, twist: 0.08, jitter: 0.2, character: 0.08, section: 0.05, event: 0.05,
    })
    const abstract = computeCombinedContourBudget({
      profile: 'abstract', treatment: 'abstractDeformation', contourReactivity: 1,
      waveform: 0.2, twist: 0.08, jitter: 0.2, character: 0.08, section: 0.05, event: 0.05,
    })
    expect(controlled.applied).toBeLessThanOrEqual(0.03)
    expect(controlled.clamped).toBe(true)
    expect(liquid.applied).toBeGreaterThan(controlled.applied)
    expect(liquid.applied).toBeLessThanOrEqual(0.06)
    expect(abstract.applied).toBeGreaterThan(liquid.applied)
  })

  it('keeps Controlled Reactive subtly active while Preserve Readability caps the total budget', () => {
    const controlled = selectedSource(resolve(31, textOscillator, {
      sourceTreatment: 'controlledReactive',
      preserveIdentity: true,
      contourReactivity: 1,
    }))
    expect(controlled.appliedContourDeformation).toBeGreaterThan(0)
    expect(controlled.appliedContourDeformation).toBeLessThanOrEqual(0.03)
    expect(controlled.allowCharacterDeformation).toBe(false)
  })

  it('regresses the old stacked-deformation failure under Preserve Identity and Controlled Reactive', () => {
    const preserved = resolve(31, textOscillator, { sourceTreatment: 'preserveIdentity', preserveIdentity: true })
    const controlled = resolve(31, textOscillator, { sourceTreatment: 'controlledReactive', preserveIdentity: false, contourReactivity: 1 })
    expect(selectedSource(preserved)).toMatchObject({
      requestedContourDeformation: expect.any(Number),
      appliedContourDeformation: 0,
      contourScale: 0,
      readabilityClamped: true,
    })
    expect(selectedSource(controlled).requestedContourDeformation).toBeGreaterThan(selectedSource(controlled).appliedContourDeformation)
    expect(selectedSource(controlled).appliedContourDeformation).toBeLessThanOrEqual(selectedSource(controlled).contourBudget)
  })

  it('re-applies the combined budget after runtime bass and event amplification', () => {
    const scale = computeRuntimeSoundDrawingContourScale({
      budget: 0.03,
      waveform: 0.025,
      twist: 0.01,
      jitter: 0.015,
      character: 0.01,
    })
    expect(scale).toBeLessThan(1)
    expect((0.025 + 0.01 + 0.015 + 0.01) * scale).toBeLessThanOrEqual(0.0300001)
  })

  it('uses deterministic, temporally coherent point noise instead of unrelated frame offsets', () => {
    const start = sampleCoherentSoundDrawingNoise(42, 1000, 6)
    const nextFrame = sampleCoherentSoundDrawingNoise(42, 1016.67, 6)
    const repeated = sampleCoherentSoundDrawingNoise(42, 1000, 6)
    expect(repeated).toBe(start)
    expect(Math.abs(nextFrame - start)).toBeLessThan(0.35)
  })

  it('keeps Abstract Deformation available as an explicit legacy-strength treatment', () => {
    const liquid = selectedSource(resolve(31, textOscillator, {
      sourceTreatment: 'liquidContour', preserveIdentity: false, contourReactivity: 1,
    }))
    const abstract = selectedSource(resolve(31, textOscillator, {
      sourceTreatment: 'abstractDeformation', preserveIdentity: false, contourReactivity: 1,
    }))
    expect(abstract.contourBudget).toBeGreaterThan(liquid.contourBudget)
    expect(abstract.appliedContourDeformation).toBeGreaterThan(liquid.appliedContourDeformation)
    expect(abstract.allowCharacterDeformation).toBe(true)
  })

  it('prevents text waveform off from falling through to generic path displacement', () => {
    expect(shouldApplyGenericSoundDrawingPathDisplacement('text', 'off', false, 1)).toBe(false)
    expect(shouldApplyGenericSoundDrawingPathDisplacement('text', 'normal', false, 1)).toBe(false)
    expect(shouldApplyGenericSoundDrawingPathDisplacement('svg', 'off', true, 1)).toBe(false)
    expect(shouldApplyGenericSoundDrawingPathDisplacement('svg', 'off', false, 1)).toBe(true)
  })

  it('translates kick, snare, hats, and downbeats into distinct whole-source actions', () => {
    const baseline = selectedSource(resolve(31.01, textOscillator))
    const kick = selectedSource(resolve(31.01, textOscillator, {}, { events: ['kick'] }))
    const snare = selectedSource(resolve(31.01, textOscillator, {}, { events: ['snare'] }))
    const hat = selectedSource(resolve(31.01, textOscillator, {}, { events: ['hat'] }))
    const downbeat = selectedSource(resolve(32.01, textOscillator, {}, { events: ['downbeat'] }))
    const downbeatBase = selectedSource(resolve(32.01, textOscillator))
    expect(kick.scale).toBeGreaterThan(baseline.scale)
    expect(snare.echoStrength).toBeGreaterThan(baseline.echoStrength)
    expect(snare.rotation).not.toBe(baseline.rotation)
    expect(hat.strokeWidth).toBeGreaterThan(baseline.strokeWidth)
    expect(downbeat.topologyVariant).toBeGreaterThan(downbeatBase.topologyVariant)
    expect(kick.appliedContourDeformation).toBe(0)
    expect(snare.appliedContourDeformation).toBe(0)
    expect(hat.appliedContourDeformation).toBe(0)
  })

  it('uses section composition for build tension, pre-drop stillness, drop release, breakdown readability, and outro retirement', () => {
    const build = resolve(22, textOscillator)
    const preDrop = resolve(26, textOscillator)
    const drop = resolve(31, textOscillator)
    const breakdown = resolve(72, textOscillator)
    const outro = resolve(136, textOscillator)
    const buildSource = selectedSource(build)
    const preSource = selectedSource(preDrop)
    const dropSource = selectedSource(drop)
    const breakdownSource = selectedSource(breakdown)
    const outroSource = selectedSource(outro)
    expect(preSource.scale).toBeLessThan(buildSource.scale)
    expect(preSource.rotation).toBeLessThan(Math.abs(buildSource.rotation) + 0.001)
    expect(dropSource.scale).toBeGreaterThan(preSource.scale)
    expect(dropSource.glow).toBeGreaterThan(preSource.glow)
    expect(breakdownSource.appliedContourDeformation).toBe(0)
    expect(breakdownSource.sourceTrailStrength).toBeLessThanOrEqual(0.35)
    expect(outroSource.opacity).toBeLessThan(dropSource.opacity)
  })

  it('retains source identity through four-, eight-, and sixteen-bar evolution and Drop 2', () => {
    const opening = resolve(31, textOscillator)
    const four = resolve(39, textOscillator)
    const eight = resolve(47, textOscillator)
    const sixteen = resolve(63, textOscillator)
    const dropTwo = resolve(87, textOscillator)
    const identity = selectedSource(opening).source.identity
    for (const candidate of [four, eight, sixteen, dropTwo]) {
      expect(selectedSource(candidate).source.identity).toBe(identity)
    }
    expect(four.deterministicIdentity).not.toBe(opening.deterministicIdentity)
    expect(eight.layers.filter(layer => layer.source.kind === 'generated' && layer.enabled).length)
      .toBeGreaterThanOrEqual(opening.layers.filter(layer => layer.source.kind === 'generated' && layer.enabled).length)
    expect(selectedSource(sixteen).scale).toBeGreaterThan(selectedSource(opening).scale)
    expect(dropTwo.sceneId).toContain('drop-2')
  })

  it('is deterministic across direct resolution, seek, loop wrap, track replacement, and source replacement', () => {
    const direct = resolve(47, textOscillator)
    const repeated = resolve(47, textOscillator)
    const beforeSeek = resolve(60, textOscillator)
    const sought = resolve(47, textOscillator, {}, { timingDiscontinuity: true }, beforeSeek.context)
    const beforeLoop = resolve(58, textOscillator)
    const looped = resolve(47, textOscillator, {}, {}, beforeLoop.context)
    const replacement = resolve(47, textOscillator, {}, { trackKey: 'track-b' }, direct.context)
    const freshReplacement = resolve(47, textOscillator, {}, { trackKey: 'track-b' })
    const svgReplacement = resolve(47, originalSvgOscillator, {}, {}, direct.context)
    const freshSvg = resolve(47, originalSvgOscillator)
    expect(repeated.layers).toEqual(direct.layers)
    expect(sought.layers).toEqual(direct.layers)
    expect(looped.layers).toEqual(direct.layers)
    expect(replacement.layers).toEqual(freshReplacement.layers)
    expect(svgReplacement.layers).toEqual(freshSvg.layers)
    expect(replacement.context.trackReplacementDetected).toBe(true)
  })

  it('honors source-aware locks while retaining authoritative safety clamps', () => {
    const unlocked = selectedSource(resolve(31.01, textOscillator, {}, { events: ['kick', 'snare'] }))
    const locked = selectedSource(resolve(31.01, textOscillator, {
      locks: {
        ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks,
        scale: true,
        rotation: true,
        glow: true,
        echoBehavior: true,
        trailBehavior: true,
      },
    }, { events: ['kick', 'snare'] }))
    expect(locked.scale).toBeCloseTo(textOscillator.pathScale)
    expect(locked.rotation).toBe(0)
    expect(locked.glow).toBeCloseTo(textOscillator.beatBloom)
    expect(locked.traceCount).toBeLessThanOrEqual(MAX_SOUND_DRAWING_TEXT_DUPLICATES)
    expect(unlocked.echoStrength).toBeGreaterThan(locked.echoStrength)
  })

  it('retains true temporal attack and release state and resets it for track and source identities', () => {
    const temporal: SoundDrawingPerformanceTemporalState = { identity: '' }
    const low = resolve(31, DEFAULT_OSCILLATOR_SETTINGS, { performanceSource: 'generatedVisual' }, { bass: 0 }, null, temporal)
    const attacked = resolve(31.016, DEFAULT_OSCILLATOR_SETTINGS, { performanceSource: 'generatedVisual' }, { bass: 1 }, low.context, temporal)
    const immediate = resolve(31.016, DEFAULT_OSCILLATOR_SETTINGS, { performanceSource: 'generatedVisual' }, { bass: 1 })
    expect(getSoundDrawingBehaviorRuntimeStats(temporal)?.routeStateCount).toBeGreaterThan(0)
    expect(attacked.layers[0].scale).toBeLessThan(immediate.layers[0].scale)

    const released = resolve(31.032, DEFAULT_OSCILLATOR_SETTINGS, { performanceSource: 'generatedVisual' }, { bass: 0 }, attacked.context, temporal)
    const immediateLow = resolve(31.032, DEFAULT_OSCILLATOR_SETTINGS, { performanceSource: 'generatedVisual' }, { bass: 0 })
    expect(released.layers[0].scale).toBeGreaterThan(immediateLow.layers[0].scale)

    const trackIdentity = temporal.identity
    resolve(31.032, DEFAULT_OSCILLATOR_SETTINGS, { performanceSource: 'generatedVisual' }, { bass: 0, trackKey: 'track-b' }, released.context, temporal)
    expect(temporal.identity).not.toBe(trackIdentity)
    const sourceIdentity = temporal.identity
    resolve(31.032, textOscillator, {}, { bass: 0, trackKey: 'track-b' }, null, temporal)
    expect(temporal.identity).not.toBe(sourceIdentity)

    const builtinCircle = { ...DEFAULT_OSCILLATOR_SETTINGS, sourceType: 'builtinShape' as const, builtinShape: 'circle' as const }
    const builtinStar = { ...builtinCircle, builtinShape: 'star' as const }
    resolve(31.032, builtinCircle, {}, { bass: 0, trackKey: 'track-b' }, null, temporal)
    const builtinIdentity = temporal.identity
    resolve(31.032, builtinStar, {}, { bass: 0, trackKey: 'track-b' }, null, temporal)
    expect(temporal.identity).not.toBe(builtinIdentity)
  })

  it('bounds layers, text/SVG duplicates, traces, and source copies', () => {
    const text = resolve(63, textOscillator, { useSourceAs: 'both', echoStrength: 1, complexity: 1 })
    const svg = resolve(63, tracedSvgOscillator, { useSourceAs: 'both', echoStrength: 1, complexity: 1, preserveIdentity: false, sourceTreatment: 'liquidContour' })
    expect(text.layers.length).toBeLessThanOrEqual(MAX_SOUND_DRAWING_PERFORMANCE_LAYERS)
    expect(svg.layers.length).toBeLessThanOrEqual(MAX_SOUND_DRAWING_PERFORMANCE_LAYERS)
    expect(text.layers.filter(layer => layer.source.kind === 'text').length).toBeLessThanOrEqual(MAX_SOUND_DRAWING_TEXT_DUPLICATES)
    expect(svg.layers.filter(layer => layer.source.kind === 'svg').length).toBeLessThanOrEqual(MAX_SOUND_DRAWING_SVG_DUPLICATES)
    expect(text.layers.filter(layer => layer.source.kind === 'text').every(layer => layer.traceCount <= MAX_SOUND_DRAWING_TEXT_DUPLICATES)).toBe(true)
    expect(svg.layers.filter(layer => layer.source.kind === 'svg').every(layer => layer.traceCount <= MAX_SOUND_DRAWING_SVG_DUPLICATES)).toBe(true)
  })

  it('preserves manual operation when Auto Performance is disabled', () => {
    expect(resolveSoundDrawingPerformanceFrame({
      frame: frameAt(31),
      settings: performanceSettings({ autoPerformance: false }),
      manualOscillator: textOscillator,
    })).toBeNull()
  })
})
