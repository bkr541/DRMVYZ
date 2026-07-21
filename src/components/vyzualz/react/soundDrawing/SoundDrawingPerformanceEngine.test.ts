import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { DEFAULT_OSCILLATOR_SETTINGS, type ReactTrackSection } from '../ReactTypes'
import type { ReactFrameContext } from '../renderers/reactRenderUtils'
import {
  buildSoundDrawingPerformanceContext,
  resolveSoundDrawingPerformanceFrame,
} from './SoundDrawingPerformanceEngine'
import { SOUND_DRAWING_PERFORMANCE_SHOWS } from './SoundDrawingPerformanceShows'
import {
  DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  MAX_SOUND_DRAWING_PERFORMANCE_LAYERS,
  MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES,
  MAX_SOUND_DRAWING_PERFORMANCE_TRACES,
  type SoundDrawingPerformanceSettings,
  type SoundDrawingResolvedPerformanceFrame,
} from './SoundDrawingPerformanceTypes'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.25, source: 'auto', confidence: 0.92 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 8, endSec: 16, intensity: 0.5, source: 'auto', confidence: 0.9 },
  { id: 'build', label: 'Build', type: 'build', startSec: 16, endSec: 24, intensity: 0.72, source: 'auto', confidence: 0.91 },
  { id: 'pre-drop', label: 'Pre-Drop', type: 'preDrop', startSec: 24, endSec: 28, intensity: 0.45, source: 'auto', confidence: 0.94 },
  {
    id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 28, endSec: 68, intensity: 0.95,
    source: 'auto', confidence: 0.96, interpretation: { familyId: 'drop-family', occurrenceIndex: 1 },
  },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 68, endSec: 84, intensity: 0.28, source: 'auto', confidence: 0.9 },
  {
    id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 84, endSec: 124, intensity: 1,
    source: 'auto', confidence: 0.97, interpretation: { familyId: 'drop-family', occurrenceIndex: 2 },
  },
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 124, endSec: 140, intensity: 0.2, source: 'auto', confidence: 0.88 },
]

type RhythmEvent = 'beat' | 'kick' | 'snare' | 'hat' | 'downbeat'

function intelligenceFrame(
  timeSec: number,
  events: readonly RhythmEvent[] = [],
  confidence = 0.92,
  trackId = 'track-a',
): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const beatPhase = absoluteBeat - beatIndex
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
      bpmConfidence: confidence,
      beatIndex,
      beatPhase,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: eventSet.has('beat') || eventSet.has('kick') || eventSet.has('snare') || eventSet.has('downbeat'),
      downbeatHit: eventSet.has('downbeat'),
      kickHit: eventSet.has('kick'),
      kickStrength: eventSet.has('kick') ? 0.95 : 0,
      snareHit: eventSet.has('snare'),
      snareStrength: eventSet.has('snare') ? 0.9 : 0,
      hatHit: eventSet.has('hat'),
      hatStrength: eventSet.has('hat') ? 0.82 : 0,
      transient: events.length ? 0.88 : 0,
      transientConfidence: confidence,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.68,
      shortTerm: 0.66,
      longTerm: 0.6,
      percentile: 0.74,
      spectralFlux: 0.52,
      tension: 0.61,
      complexity: 0.58,
      buildProgress: timeSec >= 16 && timeSec < 24 ? (timeSec - 16) / 8 : 0,
      dropImpact: events.includes('downbeat') ? 0.9 : 0,
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocalEnergy: 0.44 },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: DEFAULT_MI_FRAME.capabilities?.trackEnergyCurve ?? false,
      stemCurves: DEFAULT_MI_FRAME.capabilities?.stemCurves ?? false,
      lyrics: DEFAULT_MI_FRAME.capabilities?.lyrics ?? false,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: confidence,
      rhythm: confidence,
      section: confidence,
    },
  }
}

function frameAt(
  timeSec: number,
  options: {
    events?: readonly RhythmEvent[]
    confidence?: number
    trackKey?: string
    timingDiscontinuity?: boolean
    sections?: readonly ReactTrackSection[]
  } = {},
): ReactFrameContext {
  const trackKey = options.trackKey ?? 'track-a'
  const mi = intelligenceFrame(timeSec, options.events, options.confidence, trackKey)
  return {
    W: 1280,
    H: 720,
    dpr: 1,
    t: timeSec * 60,
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
    audio: { bass: 0.72, mid: 0.48, high: 0.56, volume: 0.68 },
    freqData: null,
    timeDomainData: null,
    musicIntelligence: mi,
    trackSections: options.sections ?? SECTIONS,
  }
}

function settings(patch: Partial<SoundDrawingPerformanceSettings> = {}): SoundDrawingPerformanceSettings {
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

function resolved(
  timeSec: number,
  options: Parameters<typeof frameAt>[1] = {},
  settingPatch: Partial<SoundDrawingPerformanceSettings> = {},
  previousContext: SoundDrawingResolvedPerformanceFrame['context'] | null = null,
): SoundDrawingResolvedPerformanceFrame {
  const result = resolveSoundDrawingPerformanceFrame({
    frame: frameAt(timeSec, options),
    settings: settings(settingPatch),
    manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    previousContext,
  })
  expect(result).not.toBeNull()
  return result as SoundDrawingResolvedPerformanceFrame
}

function role(frame: SoundDrawingResolvedPerformanceFrame, name: SoundDrawingResolvedPerformanceFrame['layers'][number]['role']) {
  const found = frame.layers.find(layer => layer.role === name)
  expect(found).toBeDefined()
  return found!
}

describe('Sound Drawing authored Performance Engine', () => {
  it('publishes all built-in authored shows with meaningfully different generator systems', () => {
    expect(SOUND_DRAWING_PERFORMANCE_SHOWS.map(show => show.name)).toEqual([
      'Radial Pressure System',
      'Harmonic Ribbon Reactor',
      'Phase-Knot Cathedral',
    ])
    const generators = SOUND_DRAWING_PERFORMANCE_SHOWS.map(show => {
      const scene = show.program.scenes.find(candidate => candidate.id.endsWith('-drop'))
      const action = scene?.actions?.find(candidate => candidate.type === 'scene')
      return action?.type === 'scene' ? action.layers[0]?.generator : null
    })
    expect(new Set(generators).size).toBe(3)
  })

  it('consumes the authoritative shared context and preserves manual mode when Auto Performance is off', () => {
    const context = buildSoundDrawingPerformanceContext(frameAt(31))
    expect(context).toMatchObject({
      trackIdentity: 'track-a',
      macroSectionType: 'drop',
      dropOccurrence: 1,
      performanceFourBarBlockIndex: 0,
      bass: 0.72,
    })
    expect(resolveSoundDrawingPerformanceFrame({
      frame: frameAt(31),
      settings: settings({ autoPerformance: false }),
      manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    })).toBeNull()
  })

  it('uses the fallback Music Intelligence frame without reading the AudioFeatureBus', () => {
    const frame = frameAt(31)
    frame.musicIntelligence = null
    const context = buildSoundDrawingPerformanceContext(frame)
    expect(context.trackIdentity).toBe('track-a')
    expect(context.audioTimeSec).toBe(31)
    expect(context.bass).toBeGreaterThanOrEqual(0)
    const result = resolveSoundDrawingPerformanceFrame({
      frame,
      settings: settings(),
      manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    })
    expect(result).not.toBeNull()
  })

  it('separates kick, snare, hat, and downbeat responsibilities by layer role', () => {
    const baseline = resolved(29.01)
    const kick = resolved(29.01, { events: ['kick'] })
    const snare = resolved(29.01, { events: ['snare'] })
    const hat = resolved(29.01, { events: ['hat'] })
    const downbeatBaseline = resolved(28.01)
    const downbeat = resolved(28.01, { events: ['downbeat'] })

    expect(role(kick, 'primaryMotif').scale).toBeGreaterThan(role(baseline, 'primaryMotif').scale)
    expect(role(snare, 'rhythmAccent').rotation).toBeGreaterThan(role(baseline, 'rhythmAccent').rotation)
    expect(role(hat, 'atmosphereLayer').jitter).toBeGreaterThan(role(baseline, 'atmosphereLayer').jitter)
    expect(role(downbeat, 'primaryMotif').topologyVariant).toBeGreaterThan(role(downbeatBaseline, 'primaryMotif').topologyVariant)
    expect(role(hat, 'primaryMotif').scale).toBeCloseTo(role(baseline, 'primaryMotif').scale)
  })

  it('develops four-bar motifs, recruits at eight bars, and evolves at sixteen bars', () => {
    const opening = resolved(31)
    const fourBar = resolved(39)
    const eightBar = resolved(47)
    const sixteenBar = resolved(63)

    expect(role(fourBar, 'primaryMotif').rotation).not.toBe(role(opening, 'primaryMotif').rotation)
    expect(role(opening, 'harmonicLayer').enabled).toBe(false)
    expect(role(eightBar, 'harmonicLayer').enabled).toBe(true)
    expect(role(sixteenBar, 'primaryMotif').traceCount).toBeGreaterThan(role(opening, 'primaryMotif').traceCount)
    expect(role(sixteenBar, 'primaryMotif').symmetry).toBeGreaterThan(role(opening, 'primaryMotif').symmetry)
  })

  it('keeps Drop 2 recognizable while applying occurrence-aware evolution', () => {
    const first = resolved(31)
    const second = resolved(87)
    expect(first.sceneId).toBe('rps-drop')
    expect(second.sceneId).toBe('rps-drop-2')
    expect(role(second, 'primaryMotif').generator).toBe(role(first, 'primaryMotif').generator)
    expect(role(second, 'primaryMotif').symmetry).toBeGreaterThan(role(first, 'primaryMotif').symmetry)
    expect(role(second, 'echoLayer').enabled).toBe(true)
  })

  it('contracts before a drop and simplifies during breakdown', () => {
    const preDrop = resolved(25)
    const drop = resolved(31)
    const breakdown = resolved(72)
    expect(role(preDrop, 'primaryMotif').scale).toBeLessThan(role(drop, 'primaryMotif').scale)
    expect(preDrop.global.feedbackAmount).toBeLessThan(drop.global.feedbackAmount)
    expect(breakdown.layers.filter(layer => layer.enabled).length).toBeLessThan(drop.layers.filter(layer => layer.enabled).length)
    expect(breakdown.layers.reduce((sum, layer) => sum + layer.traceCount, 0)).toBeLessThan(drop.layers.reduce((sum, layer) => sum + layer.traceCount, 0))
  })

  it('is deterministic for direct resolution, seek discontinuities, and loop wraps', () => {
    const direct = resolved(47)
    const repeated = resolved(47)
    const beforeSeek = resolved(60)
    const sought = resolved(47, { timingDiscontinuity: true }, {}, beforeSeek.context)
    const beforeLoop = resolved(58)
    const looped = resolved(47, {}, {}, beforeLoop.context)

    expect(repeated.layers).toEqual(direct.layers)
    expect(sought.layers).toEqual(direct.layers)
    expect(looped.layers).toEqual(direct.layers)
    expect(sought.context.boundaries.timingDiscontinuity).toBe(true)
    expect(looped.context.loopWrapDetected).toBe(true)
  })

  it('restores explicit user locks after authored, modulation, and event mutations', () => {
    const lockedOscillator = {
      ...DEFAULT_OSCILLATOR_SETTINGS,
      duplicateTraces: 5,
      mirrorX: true,
      mirrorY: false,
      renderMode: 'dots' as const,
    }
    const result = resolveSoundDrawingPerformanceFrame({
      frame: frameAt(29.01, { events: ['kick', 'downbeat'] }),
      settings: settings({ locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, topology: true } }),
      manualOscillator: lockedOscillator,
    }) as SoundDrawingResolvedPerformanceFrame
    expect(role(result, 'primaryMotif')).toMatchObject({ symmetry: 2, traceCount: 5, renderMode: 'dots' })
  })

  it('enforces bounded layers, traces, particles, and low-confidence fallback', () => {
    const result = resolved(63)
    expect(result.layers.length).toBeLessThanOrEqual(MAX_SOUND_DRAWING_PERFORMANCE_LAYERS)
    for (const layer of result.layers) {
      expect(layer.traceCount).toBeLessThanOrEqual(MAX_SOUND_DRAWING_PERFORMANCE_TRACES)
      expect(layer.particleCount).toBeLessThanOrEqual(MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES)
    }

    const lowConfidenceSections = SECTIONS.map(section => ({ ...section, confidence: 0.12 }))
    const fallback = resolved(31, { confidence: 0.12, sections: lowConfidenceSections })
    expect(fallback.fallbackUsed).toBe(true)
    expect(fallback.sceneId).toContain('fallback')
    expect(fallback.layers.filter(layer => layer.enabled)).toHaveLength(1)
  })

  it('detects track replacement and resolves the replacement from a clean deterministic state', () => {
    const original = resolved(31, { trackKey: 'track-a' })
    const replaced = resolved(31, { trackKey: 'track-b' }, {}, original.context)
    const freshReplacement = resolved(31, { trackKey: 'track-b' })
    expect(replaced.context.trackReplacementDetected).toBe(true)
    expect(replaced.layers).toEqual(freshReplacement.layers)
  })
})
