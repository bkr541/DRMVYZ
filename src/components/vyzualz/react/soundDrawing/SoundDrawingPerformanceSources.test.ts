import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { DEFAULT_OSCILLATOR_SETTINGS, type OscillatorSettings, type ReactTrackSection } from '../ReactTypes'
import type { ReactFrameContext } from '../renderers/reactRenderUtils'
import {
  computeRuntimeSoundDrawingContourScale,
  sampleCoherentSoundDrawingNoise,
  shouldApplyGenericSoundDrawingPathDisplacement,
} from '../renderers/SoundDrawingRenderer'
import { resolveSoundDrawingPerformanceFrame } from './SoundDrawingPerformanceEngine'
import { computeCombinedContourBudget } from './SoundDrawingSourceResolver'
import {
  DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
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
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 84, endSec: 100, intensity: 0.18, source: 'auto', confidence: 0.9 },
]

function intelligence(timeSec: number, trackId = 'track-a'): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
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
      bass: 0.72,
      mid: 0.48,
      high: 0.56,
      volume: 0.68,
      normalizedBass: 0.72,
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

function frameAt(timeSec: number, trackKey = 'track-a'): ReactFrameContext {
  const mi = intelligence(timeSec, trackKey)
  return {
    W: 1280,
    H: 720,
    dpr: 1,
    t: timeSec * 1000,
    elapsedTimeSec: timeSec,
    deltaTimeSec: 1 / 60,
    timeSec,
    audioTime: timeSec,
    trackKey,
    bpm: 120,
    beatPhase: mi.rhythm.beatPhase,
    beatHit: false,
    isPlaying: true,
    audio: { bass: 0.72, mid: 0.48, high: 0.56, volume: 0.68 },
    freqData: null,
    timeDomainData: null,
    musicIntelligence: mi,
    trackSections: SECTIONS,
  }
}

function settings(patch: Partial<SoundDrawingPerformanceSettings> = {}): SoundDrawingPerformanceSettings {
  return {
    ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
    selectedShowId: 'radialPressureSystem',
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

function resolve(
  oscillator: OscillatorSettings,
  patch: Partial<SoundDrawingPerformanceSettings> = {},
  temporalState?: SoundDrawingPerformanceTemporalState,
): SoundDrawingResolvedPerformanceFrame {
  const result = resolveSoundDrawingPerformanceFrame({
    frame: frameAt(31),
    settings: settings(patch),
    manualOscillator: oscillator,
    temporalState,
  })
  expect(result).not.toBeNull()
  return result!
}

const textOscillator: OscillatorSettings = {
  ...DEFAULT_OSCILLATOR_SETTINGS,
  sourceType: 'text',
  text: 'DRMVYZ',
  duplicateTraces: 6,
}

const svgOscillator: OscillatorSettings = {
  ...DEFAULT_OSCILLATOR_SETTINGS,
  sourceType: 'svg',
  selectedSvgId: 'logo-svg',
  svgRenderMode: 'originalArtwork',
}

describe('Auto Performance source isolation', () => {
  it('uses only authored generated layers even when a legacy project requests the current Engine Mode', () => {
    for (const oscillator of [DEFAULT_OSCILLATOR_SETTINGS, textOscillator, svgOscillator]) {
      const result = resolve(oscillator, {
        performanceSource: 'activeUserSource',
        useSourceAs: 'both',
        sourceTreatment: 'abstractDeformation',
      })
      expect(result.activeSourceKind).toBe('generated')
      expect(result.sourceRole).toBe('generatedOnly')
      expect(result.sourceFallbackState).toBeNull()
      expect(result.layers.every(layer => layer.source.kind === 'generated')).toBe(true)
    }
  })

  it('does not let Classic Scope, text, SVG, generator preference, or legacy locks alter the running show', () => {
    const baseline = resolve(DEFAULT_OSCILLATOR_SETTINGS, { selectedShowId: 'phaseOrbit' })
    const contaminated = resolve({
      ...textOscillator,
      sourceType: 'classic',
      classicMode: 'waveform',
      duplicateTraces: 8,
      mirrorX: true,
      renderMode: 'dots',
    }, {
      selectedShowId: 'phaseOrbit',
      performanceSource: 'activeUserSource',
      generatorPreference: 'horizontalOscilloscope',
      locks: Object.fromEntries(
        Object.keys(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks).map(key => [key, true]),
      ) as SoundDrawingPerformanceSettings['locks'],
    })

    expect(contaminated.layers).toEqual(baseline.layers)
    expect(contaminated.global).toEqual(baseline.global)
    expect(contaminated.deterministicIdentity).toBe(baseline.deterministicIdentity)
  })

  it('keeps temporal behavior stable across manual source changes and resets it for show changes', () => {
    const temporal: SoundDrawingPerformanceTemporalState = { identity: '' }
    resolve(textOscillator, { selectedShowId: 'phaseOrbit' }, temporal)
    const phaseIdentity = temporal.identity
    resolve(svgOscillator, { selectedShowId: 'phaseOrbit' }, temporal)
    expect(temporal.identity).toBe(phaseIdentity)

    resolve(svgOscillator, { selectedShowId: 'scopeAndShape' }, temporal)
    expect(temporal.identity).not.toBe(phaseIdentity)
  })

  it('changes the temporal identity when choreography is toggled without changing the selected show', () => {
    const temporal: SoundDrawingPerformanceTemporalState = { identity: '' }
    resolve(textOscillator, { selectedShowId: 'phaseOrbit', autoPerformance: false }, temporal)
    const baseIdentity = temporal.identity
    resolve(textOscillator, { selectedShowId: 'phaseOrbit', autoPerformance: true }, temporal)
    expect(temporal.identity).not.toBe(baseIdentity)
  })

  it('keeps the selected authored source active while Auto Performance is off', () => {
    const performance = resolveSoundDrawingPerformanceFrame({
      frame: frameAt(31),
      settings: settings({ autoPerformance: false }),
      manualOscillator: textOscillator,
    })!
    expect(performance.choreographyActive).toBe(false)
    expect(performance.activeSourceKind).toBe('generated')
    expect(performance.sceneId).toMatch(/^base:/)
  })

  it('returns no authored frame only when no Performance Show is selected', () => {
    expect(resolveSoundDrawingPerformanceFrame({
      frame: frameAt(31),
      settings: settings({ autoPerformance: false, selectedShowId: null }),
      manualOscillator: textOscillator,
    })).toBeNull()
  })
})

describe('retained manual-source geometry utilities', () => {
  it('keeps conservative contour budgets for manual text and SVG rendering', () => {
    const controlled = computeCombinedContourBudget({
      profile: 'readableText', treatment: 'controlledReactive', contourReactivity: 1,
      waveform: 0.2, twist: 0.08, jitter: 0.2, character: 0.08, section: 0.05, event: 0.05,
    })
    const liquid = computeCombinedContourBudget({
      profile: 'readableText', treatment: 'liquidContour', contourReactivity: 1,
      waveform: 0.2, twist: 0.08, jitter: 0.2, character: 0.08, section: 0.05, event: 0.05,
    })
    expect(controlled.applied).toBeLessThanOrEqual(0.03)
    expect(controlled.clamped).toBe(true)
    expect(liquid.applied).toBeGreaterThan(controlled.applied)
    expect(liquid.applied).toBeLessThanOrEqual(0.06)
  })

  it('re-applies the combined budget after runtime amplification', () => {
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

  it('uses deterministic temporally coherent point noise', () => {
    const start = sampleCoherentSoundDrawingNoise(42, 1000, 6)
    const nextFrame = sampleCoherentSoundDrawingNoise(42, 1016.67, 6)
    expect(sampleCoherentSoundDrawingNoise(42, 1000, 6)).toBe(start)
    expect(Math.abs(nextFrame - start)).toBeLessThan(0.35)
  })

  it('does not apply generic deformation twice to text or traced SVG paths', () => {
    expect(shouldApplyGenericSoundDrawingPathDisplacement('text', 'off', false, 1)).toBe(false)
    expect(shouldApplyGenericSoundDrawingPathDisplacement('text', 'normal', false, 1)).toBe(false)
    expect(shouldApplyGenericSoundDrawingPathDisplacement('svg', 'off', true, 1)).toBe(false)
    expect(shouldApplyGenericSoundDrawingPathDisplacement('svg', 'off', false, 1)).toBe(true)
  })
})
