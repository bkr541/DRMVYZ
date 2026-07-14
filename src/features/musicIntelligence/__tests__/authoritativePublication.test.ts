import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AudioFeatureBus } from '../AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../constants'
import { MusicIntelligenceEngine } from '../MusicIntelligenceEngine'
import type { TrackIntelligenceAnalysis } from '../types'
import type { ReactFrameContext } from '../../../components/vyzualz/react/renderers/reactRenderUtils'
import { resolveAuthoritativeFrameSection } from '../../../components/vyzualz/react/renderers/reactRenderUtils'
import { resolveLaserDmxMusicIntelligenceFrame } from '../../../components/vyzualz/react/renderers/LaserDmxRenderer'
import { DEFAULT_REACT_RENDER_PARAMS, resolveCurrentSection } from '../../../components/vyzualz/react/renderers/ReactEngineRenderer'
import { ShaderAudioBridge } from '../../../components/vyzualz/react/shaders/audio/ShaderAudioBridge'
import { encodeSectionType } from '../../../components/vyzualz/react/shaders/audio/shaderAudioTypes'
import { cinematicInputFromReactFrame } from '../../../components/vyzualz/react/renderers/CinematicWorldRenderer'
import { createCinematicWorldConfig } from '../../../components/vyzualz/react/CinematicWorldConfig'
import {
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_REACT_PRESETS,
  type ReactTrackSection,
} from '../../../components/vyzualz/react/ReactTypes'
import { resolveOscillatorSectionModifiers } from '../../../components/vyzualz/react/renderers/SoundDrawingRenderer'
import { resolveAuthoritativeTimeline, resolveSectionAtTime } from '../../trackIntelligence/authoritativeTimeline'

const CURVE = [{ timeSec: 0, value: 0.5 }]

function makeAnalysis(): TrackIntelligenceAnalysis {
  const beat = { timeSec: 0, confidence: 0.9, isDownbeat: true, beatIndex: 0, beatWithinBar: 0, barIndex: 0, gridSource: 'automatic' as const, gridConfidence: 0.9 }
  return {
    analysisVersion: 'auto-5.0',
    createdAt: '2026-07-13T00:00:00.000Z',
    durationMs: 40_000,
    bpm: 140,
    bpmConfidence: 0.9,
    beatPhaseConfidence: 0.9,
    downbeatPhaseConfidence: 0.85,
    barGridConfidence: 0.85,
    beatGridOffsetSec: 0,
    timeSignature: 4,
    beatGrid: [beat],
    downbeats: [beat],
    musicalGrid: {
      source: 'automatic',
      fallbackReason: null,
      timeSignature: 4,
      downbeatPhase: 0,
      beatPeriodSec: 60 / 140,
      authoritative: false,
      confidence: { bpm: 0.9, beatPhase: 0.9, downbeatPhase: 0.85, barGrid: 0.85 },
    },
    phrases: [{ id: 'phrase-0', timeSec: 0, phraseLength: 8, confidence: 0.8, source: 'section_boundary' }],
    sections: [
      { id: 'auto-intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 20, intensity: 0.4, confidence: 0.82, source: 'analysis' },
      { id: 'auto-drop', label: 'Drop', type: 'drop', startSec: 20, endSec: 40, intensity: 1, confidence: 0.9, source: 'analysis' },
    ],
    energyCurves: { instant: CURVE, shortTerm: CURVE, bass: CURVE, mid: CURVE, high: CURVE },
    spectralCurves: { centroid: CURVE, flux: CURVE, complexity: CURVE },
    stemCurves: null,
    harmonic: {
      keyChanges: [], chordProgression: [], dominantKey: null, dominantMode: null, keyConfidence: 0,
      pitchCurve: [], melodyContourCurve: [],
    },
    lyrics: null,
    semanticMoments: [{ id: 'impact', timeSec: 20, type: 'drop_impact', confidence: 0.9, source: 'section_context' }],
    warnings: [],
    errors: [],
    bpmUsedForGrid: 140,
    gridStale: false,
  }
}

function manualReplacement(): ReactTrackSection {
  return {
    id: 'manual-build',
    label: 'Corrected Build',
    type: 'build',
    startSec: 0,
    endSec: 20,
    intensity: 0.75,
    source: 'user-edited-auto',
    confidence: 1,
    provenance: {
      authority: 'manual_replacement',
      originalId: 'auto-intro',
      analysisSource: 'manual',
    },
  }
}

function resolvedTimeline(): ReactTrackSection[] {
  return resolveAuthoritativeTimeline({
    durationSec: 40,
    analyzedSections: makeAnalysis().sections.map(section => ({
      ...section,
      source: 'auto' as const,
      provenance: { authority: 'automatic' as const, originalId: section.id, analysisSource: section.source },
    })),
    manualSections: [manualReplacement()],
    suppressedIds: ['auto-drop'],
  })
}

function reactFrame(audioTime: number, resolvedSection: ReactFrameContext['resolvedSection']): ReactFrameContext {
  const musicIntelligence = AudioFeatureBus.getFrame()
  return {
    W: 1280,
    H: 720,
    dpr: 1,
    t: audioTime * 60,
    elapsedTimeSec: audioTime,
    deltaTimeSec: 1 / 60,
    timeSec: audioTime,
    audioTime,
    trackKey: 'track-a',
    bpm: 140,
    beatPhase: 0.25,
    beatHit: false,
    isPlaying: true,
    audio: { bass: 0.5, mid: 0.4, high: 0.3, volume: 0.6 },
    freqData: null,
    timeDomainData: null,
    musicIntelligence,
    trackSections: musicIntelligence.resolvedSections,
    resolvedSection,
  }
}

describe('authoritative Music Intelligence publication', () => {
  let engine: MusicIntelligenceEngine

  beforeEach(() => {
    AudioFeatureBus.reset()
    engine = new MusicIntelligenceEngine()
    engine.setSourceId('track-a', 'track-a')
    AudioFeatureBus.updatePartial({ timeSec: 10 })
  })

  afterEach(() => {
    engine.reset()
  })

  it('publishes one atomic snapshot whose Track Map and Music Intelligence current section agree', () => {
    const timeline = resolvedTimeline()
    const publications: Array<ReturnType<typeof AudioFeatureBus.getFrame>> = []
    const unsubscribe = AudioFeatureBus.subscribe(frame => publications.push(frame))

    expect(engine.setAuthoritativeTrackState({ analysis: makeAnalysis(), resolvedSections: timeline, trackId: 'track-a', sourceId: 'track-a' })).toBe(true)
    unsubscribe()

    expect(publications).toHaveLength(1)
    const frame = publications[0]
    const trackMapSection = resolveSectionAtTime(timeline, 10)
    expect(frame.currentResolvedSection?.id).toBe(trackMapSection?.id)
    expect(frame.currentResolvedSection?.type).toBe('build')
    expect(frame.section.type).toBe('build')
    expect(frame.resolvedSections).toEqual(timeline)
    expect(frame.phraseMarkers?.[0].id).toBe('phrase-0')
    expect(frame.semanticMoments?.[0].id).toBe('impact')
    expect(frame.analysisRevision).toContain('auto-5.0')
    expect(frame.timelineRevision).toMatch(/^timeline-/)
    expect(frame.analysisSource).toBe('manual')
    expect(frame.analysisCapabilities).toMatchObject({
      reliableBeatGrid: true,
      reliableDownbeatGrid: true,
      phraseHierarchy: true,
      semanticMoments: true,
    })
  })

  it('keeps suppressed automatic sections absent and manual replacements authoritative across seeks and loop wraps', () => {
    const timeline = resolvedTimeline()
    engine.setAuthoritativeTrackState({ analysis: makeAnalysis(), resolvedSections: timeline, trackId: 'track-a', sourceId: 'track-a' })

    expect(timeline.some(section => section.provenance?.originalId === 'auto-drop' && section.provenance.authority === 'automatic')).toBe(false)
    expect(timeline[0].provenance?.authority).toBe('manual_replacement')

    engine.resolveLyricsAt(20, 'discontinuous')
    expect(AudioFeatureBus.getFrame().currentResolvedSection?.provenance?.authority).toBe('fallback')
    engine.resolveLyricsAt(39, 'continuous')
    expect(AudioFeatureBus.getFrame().currentResolvedSection?.type).toBe('unknown')
    engine.resolveLyricsAt(1, 'discontinuous')
    expect(AudioFeatureBus.getFrame().currentResolvedSection?.id).toBe('manual-build')
    expect(resolveCurrentSection(AudioFeatureBus.getFrame().resolvedSections ?? [], 1)).toMatchObject({ type: 'build' })
  })

  it('rejects stale analysis publication after the selected track changes', () => {
    engine.setSourceId('track-b', 'track-b')
    const accepted = engine.setAuthoritativeTrackState({
      analysis: makeAnalysis(),
      resolvedSections: resolvedTimeline(),
      trackId: 'track-a',
      sourceId: 'track-a',
    })

    expect(accepted).toBe(false)
    expect(AudioFeatureBus.getFrame().trackId).toBe('track-b')
    expect(AudioFeatureBus.getFrame().resolvedSections).toEqual([])
  })

  it('feeds the same resolved section to LaserDMX, Shaders, Cinematic Worlds, and Sound Drawing', () => {
    const timeline = resolvedTimeline()
    engine.setAuthoritativeTrackState({ analysis: makeAnalysis(), resolvedSections: timeline, trackId: 'track-a', sourceId: 'track-a' })
    const resolved = resolveAuthoritativeFrameSection({ musicIntelligence: AudioFeatureBus.getFrame(), trackSections: timeline, audioTime: 10 })
    const frame = reactFrame(10, resolved)

    const laser = resolveLaserDmxMusicIntelligenceFrame(frame, AudioFeatureBus.getFrame())
    expect(laser.section.type).toBe('build')
    expect(laser.currentResolvedSection?.id).toBe('manual-build')

    const shader = new ShaderAudioBridge()
    shader.update(frame, 10, 1 / 60, 40)
    expect(shader.timingFrame.sectionType).toBe(encodeSectionType('build'))
    expect(shader.timingFrame.sectionPhase).toBeCloseTo(0.5)

    const cinematicPreset = DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'cinematicPortal')!
    const cinematic = cinematicInputFromReactFrame(
      frame,
      cinematicPreset,
      DEFAULT_REACT_RENDER_PARAMS,
      null,
      createCinematicWorldConfig('legacyPortal', {}),
    )
    expect(cinematic.section.type).toBe('build')
    expect(cinematic.section.progress).toBeCloseTo(0.5)

    const soundDrawing = resolveOscillatorSectionModifiers(frame.resolvedSection?.type ?? null, {
      ...DEFAULT_OSCILLATOR_SETTINGS,
      autoSectionMode: true,
    })
    expect(soundDrawing.rotationSpeed).toBeCloseTo(DEFAULT_OSCILLATOR_SETTINGS.rotationSpeed * 1.5)
  })

  it('reports a capability-safe legacy fallback when no classified section is available', () => {
    const fallback = resolveAuthoritativeTimeline({ durationSec: 12 })
    engine.setAuthoritativeTrackState({ analysis: null, resolvedSections: fallback, trackId: 'track-a', sourceId: 'track-a' })
    const frame = AudioFeatureBus.getFrame()

    expect(frame.section).toMatchObject({ type: 'unknown', source: 'inferred' })
    expect(frame.analysisSource).toBe('legacy_fallback')
    expect(frame.analysisCapabilities?.legacyFallbackOnly).toBe(true)
    expect(frame.capabilities?.sections).toBe(false)
  })
})
