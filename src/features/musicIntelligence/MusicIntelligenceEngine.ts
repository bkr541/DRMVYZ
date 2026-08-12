// Central music intelligence engine.
// Receives raw audio data (FFT buffer + time-domain buffer) every animation frame,
// delegates to analysis modules, assembles a MusicIntelligenceFrame, and
// publishes it to AudioFeatureBus.
//
// The module-level `musicIntelligenceEngine` singleton is the intended access point.

import { AudioFeatureBus } from './AudioFeatureBus'
import { DEFAULT_MI_FRAME } from './constants'
import { buildBeatMarkers } from './offlineTrackAnalyzer'
import { MultiBandAnalyzer } from './bandAnalysis'
import { RhythmAnalyzer } from './rhythmAnalysis'
import { BeatGrid } from './beatGrid'
import { EnergyAnalyzer, type MeydaFeatureSnapshot } from './energyAnalysis'
import { HarmonicAnalyzer } from './harmonicAnalysis'
import { StemCurveInterpolator } from './stemAnalysis'
import { SemanticAnalyzer } from './semanticAnalysis'
import { adaptMIAnalysis } from '../trackIntelligence/trackMapAdapter'
import { resolveAuthoritativeTimeline, resolveSectionAtTime, timelineRevision } from '../trackIntelligence/authoritativeTimeline'
import { LyricPlaybackBus } from '../lyrics/runtime/LyricPlaybackBus'
import {
  ActiveLyricTracker,
  EMPTY_LYRIC_PLAYBACK_STATE,
  type ActiveLyricState,
  type ActiveLyricTrackerSource,
  type LyricPlaybackState,
  type LyricPlaybackTransitionMode,
} from '../lyrics/runtime/lyricPlaybackResolver'
import type {
  MusicIntelligenceCapabilities,
  MusicIntelligenceFrame,
  MILyrics,
  TrackIntelligenceAnalysis,
  MIResolvedSection,
  ResolvedTimelineAnalysisSource,
  TrackAnalysisCapabilities,
  ReactTrackSection,
} from './types'

// ── Public input types ────────────────────────────────────────────────────────

export interface MusicIntelligenceEngineOptions {
  sampleRate?: number
}

function sampleFeatureCurveAt(
  curve: ReadonlyArray<{ timeSec: number; value: number }>,
  timeSec: number,
): number {
  if (curve.length === 0) return 0
  if (timeSec <= curve[0].timeSec) return curve[0].value
  const last = curve[curve.length - 1]
  if (timeSec >= last.timeSec) return last.value
  let lo = 0
  let hi = curve.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (curve[mid].timeSec <= timeSec) lo = mid
    else hi = mid
  }
  const a = curve[lo]
  const b = curve[hi]
  const span = b.timeSec - a.timeSec
  const t = span > 0 ? (timeSec - a.timeSec) / span : 0
  return Math.max(0, Math.min(1, a.value + (b.value - a.value) * t))
}

export interface AnalyserInputFrame {
  analyser:   AnalyserNode
  sampleRate: number
  audioTime:  number
  isPlaying:  boolean
  publisherId?: string
}

export interface AudioFrameInput {
  freqBuf:    Uint8Array<ArrayBuffer>
  timeBuf:    Uint8Array<ArrayBuffer> | null
  sampleRate: number
  audioTime:  number
  isPlaying:  boolean
  publisherId?: string
}

// ── Engine class ──────────────────────────────────────────────────────────────

export class MusicIntelligenceEngine {
  private sampleRate     = 44100
  private bpm            = 0
  private bpmConfidence  = 0
  private beatGridOffset = 0
  private trackAnalysis: TrackIntelligenceAnalysis | null = null
  private resolvedSections: ReactTrackSection[] = []
  private resolvedTimelineRevision: string | null = null
  private sourceId: string | null = null
  private trackId:  string | null = null
  private frameId   = 0
  private lastAnalyserAudioTime: number | null = null
  private lastAnalyserSourceId: string | null = null
  private lastAnalyserTrackId: string | null = null
  private lastAnalyserIsPlaying = false

  // Optional getter registered by useAudioEngine so Meyda features flow in
  private meydaFeaturesGetter: (() => MeydaFeatureSnapshot | null) | null = null

  // ── Layer modules ──────────────────────────────────────────────────────────
  private readonly bandAnalyzer    = new MultiBandAnalyzer()
  private readonly rhythmAnalyzer  = new RhythmAnalyzer()
  private readonly beatGrid        = new BeatGrid()
  private readonly energyAnalyzer  = new EnergyAnalyzer()
  private readonly harmonicAnalyzer = new HarmonicAnalyzer()
  private readonly stemInterpolator = new StemCurveInterpolator()
  private readonly lyricTracker    = new ActiveLyricTracker()
  private managedLyricsConfigured  = false
  private lyricState: ActiveLyricState = {
    playback: EMPTY_LYRIC_PLAYBACK_STATE,
    activeLine: null,
    activeWord: null,
    vocalActivity: 0,
    phraseConfidence: 0,
    lyricLineProgress: 0,
    wordProgress: 0,
    wordHit: false,
    lineEnter: false,
    lineExit: false,
    isGap: false,
  }
  private readonly semanticAnalyzer = new SemanticAnalyzer()

  private resetRhythmRuntimeState(): void {
    this.rhythmAnalyzer.reset()
    this.lastAnalyserAudioTime = null
    this.lastAnalyserSourceId = null
    this.lastAnalyserTrackId = null
    this.lastAnalyserIsPlaying = false
  }

  private analyserIdentityMatches(): boolean {
    return this.lastAnalyserSourceId === this.sourceId
      && this.lastAnalyserTrackId === this.trackId
  }

  private isDuplicateAnalyserPublication(
    audioTime: number,
    isPlaying: boolean,
    publisherId: string | undefined,
  ): boolean {
    if (!publisherId || this.lastAnalyserAudioTime === null || !this.analyserIdentityMatches()) return false
    return Math.abs(audioTime - this.lastAnalyserAudioTime) <= 1 / 240
      && isPlaying === this.lastAnalyserIsPlaying
  }

  private resetRhythmForTransportDiscontinuity(audioTime: number): void {
    if (this.lastAnalyserAudioTime === null || !this.analyserIdentityMatches()) return
    const delta = audioTime - this.lastAnalyserAudioTime
    if (delta < -0.001 || delta > 0.75) {
      // BeatGrid derives indices from absolute audio time and already suppresses
      // seek/skip hits. Drum/onset detectors are stateful and must discard their
      // EMA/cooldown history across discontinuous transport positions.
      this.rhythmAnalyzer.reset()
    }
  }

  private rememberAnalyserPublication(audioTime: number, isPlaying: boolean): void {
    this.lastAnalyserAudioTime = audioTime
    this.lastAnalyserSourceId = this.sourceId
    this.lastAnalyserTrackId = this.trackId
    this.lastAnalyserIsPlaying = isPlaying
  }

  private analysisCapabilities(): TrackAnalysisCapabilities {
    const analysis = this.trackAnalysis
    const reliableBeatGrid = Boolean(analysis && analysis.beatGrid.length > 0 && (analysis.beatPhaseConfidence ?? analysis.bpmConfidence ?? 0) >= 0.55)
    const reliableDownbeatGrid = Boolean(analysis && analysis.downbeats.length > 0 && (analysis.downbeatPhaseConfidence ?? analysis.barGridConfidence ?? 0) >= 0.5)
    const barAwareSections = this.resolvedSections.some(section => (
      section.interpretation?.startBar != null
      || section.interpretation?.endBar != null
      || (section.gridConfidence ?? 0) > 0
    ))
    const selfSimilarityAnalysis = analysis?.structuralSegmentation?.source === 'bar_self_similarity'
    const semanticClassification = this.resolvedSections.some(section => (
      section.provenance?.authority !== 'fallback'
      && section.type !== 'unknown'
      && (section.labelConfidence ?? section.confidence ?? 0) > 0
    ))
    const phraseHierarchy = Boolean((analysis?.phrases.length ?? 0) > 0 || (analysis?.phraseHierarchy?.units.length ?? 0) > 0)
    const semanticMoments = Boolean((analysis?.semanticMoments.length ?? 0) > 0)
    const legacyFallbackOnly = this.resolvedSections.length > 0
      && this.resolvedSections.every(section => section.provenance?.authority === 'fallback')
    return {
      reliableBeatGrid,
      reliableDownbeatGrid,
      barAwareSections,
      selfSimilarityAnalysis,
      semanticClassification,
      phraseHierarchy,
      semanticMoments,
      legacyFallbackOnly,
    }
  }

  private resolvedAnalysisSource(): ResolvedTimelineAnalysisSource {
    if (this.resolvedSections.length === 0) return 'none'
    const authorities = new Set(this.resolvedSections.map(section => section.provenance?.authority))
    authorities.delete('fallback')
    if (authorities.size > 1) return 'mixed'
    if (authorities.has('locked_user') || authorities.has('user_created') || authorities.has('manual_replacement')) return 'manual'
    if (authorities.has('imported')) return 'imported'
    const structuralSource = this.trackAnalysis?.structuralSegmentation?.source
    if (structuralSource) return structuralSource
    if (authorities.has('automatic') || this.resolvedSections.some(section => section.provenance?.authority === 'fallback')) {
      return 'legacy_fallback'
    }
    return 'none'
  }

  private currentSectionAt(audioTime: number): MIResolvedSection | null {
    const section = resolveSectionAtTime(this.resolvedSections, audioTime)
    if (!section) return null
    const duration = section.endSec - section.startSec
    return {
      ...section,
      progress: duration > 0 ? Math.max(0, Math.min(1, (audioTime - section.startSec) / duration)) : 0,
    }
  }

  private legacySectionAt(audioTime: number): MusicIntelligenceFrame['section'] {
    const current = this.currentSectionAt(audioTime)
    if (!current) return { ...DEFAULT_MI_FRAME.section }
    const authority = current.provenance?.authority
    const source = authority === 'imported'
      ? 'rekordbox' as const
      : authority === 'automatic'
        ? 'analysis' as const
        : authority === 'fallback'
          ? 'inferred' as const
          : 'manual' as const
    return {
      type: current.type,
      label: current.label,
      startSec: current.startSec,
      endSec: current.endSec,
      progress: current.progress,
      intensity: current.intensity,
      confidence: current.analysisConfidence ?? current.confidence ?? 0,
      source,
    }
  }

  private analysisRevision(): string | null {
    const analysis = this.trackAnalysis
    if (!analysis) return null
    return [
      analysis.analysisVersion,
      analysis.createdAt,
      analysis.durationMs,
      analysis.bpmUsedForGrid ?? analysis.bpm ?? 'none',
      analysis.lastGridRebuiltAt ?? 'original',
    ].join(':')
  }

  private analysisPublication(audioTime: number): Pick<MusicIntelligenceFrame,
    | 'section'
    | 'resolvedSections'
    | 'currentResolvedSection'
    | 'phraseMarkers'
    | 'semanticMoments'
    | 'gridConfidence'
    | 'analysisSource'
    | 'analysisCapabilities'
    | 'analysisRevision'
    | 'timelineRevision'
  > {
    return {
      section: this.legacySectionAt(audioTime),
      resolvedSections: this.resolvedSections,
      currentResolvedSection: this.currentSectionAt(audioTime),
      phraseMarkers: this.trackAnalysis?.phrases ?? [],
      semanticMoments: this.trackAnalysis?.semanticMoments ?? [],
      gridConfidence: this.trackAnalysis?.musicalGrid?.confidence ?? null,
      analysisSource: this.resolvedAnalysisSource(),
      analysisCapabilities: this.analysisCapabilities(),
      analysisRevision: this.analysisRevision(),
      timelineRevision: this.resolvedTimelineRevision,
    }
  }

  private capabilityState(preserveLiveState = true): MusicIntelligenceCapabilities {
    const currentFrame = AudioFeatureBus.getFrame()
    const sameSource = currentFrame.sourceId === this.sourceId && currentFrame.trackId === this.trackId
    const current = currentFrame.capabilities ?? DEFAULT_MI_FRAME.capabilities!
    return {
      liveBands: preserveLiveState && sameSource && current.liveBands,
      rhythmEvents: preserveLiveState && sameSource && current.rhythmEvents,
      beatGrid: this.bpm > 0,
      sections: this.resolvedSections.some(section => section.provenance?.authority !== 'fallback'),
      trackEnergyCurve: Boolean(this.trackAnalysis?.energyCurves.shortTerm.length),
      stemCurves: this.trackAnalysis?.stemCurves != null,
      lyrics: this.lyricTracker.hasLyrics(),
    }
  }

  private publishCapabilityState(preserveLiveState = true): void {
    AudioFeatureBus.updatePartial({
      sourceId: this.sourceId,
      trackId: this.trackId,
      capabilities: this.capabilityState(preserveLiveState),
    })
  }

  private clearLyricStateForSource(sourceIdentity: string): void {
    this.lyricTracker.setLyrics({ cues: [], sourceIdentity, globalOffsetMs: 0 })
    this.lyricState = {
      ...this.lyricState,
      playback: EMPTY_LYRIC_PLAYBACK_STATE,
      activeLine: null,
      activeWord: null,
      vocalActivity: 0,
      phraseConfidence: 0,
      lyricLineProgress: 0,
      wordProgress: 0,
      wordHit: false,
      lineEnter: false,
      lineExit: false,
      isGap: false,
    }
    LyricPlaybackBus.reset()
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  initialize(options: MusicIntelligenceEngineOptions = {}): void {
    this.sampleRate = options.sampleRate ?? 44100
    this.beatGrid.setBpm(this.bpm, this.bpmConfidence, this.beatGridOffset)
    this.reset()
  }

  setBpm(bpm: number, confidence = 0.8): void {
    // 0 is the sentinel for "unavailable" — do NOT clamp to 1.
    this.bpm           = bpm > 0 ? bpm : 0
    this.bpmConfidence = Math.max(0, Math.min(1, confidence))
    // Always pass the stored beatGridOffset so manual overrides preserve the original grid phase.
    this.beatGrid.setBpm(this.bpm, this.bpmConfidence, this.beatGridOffset)
    this.publishCapabilityState()
  }

  setBeatGridOffset(offsetSec: number): void {
    this.beatGridOffset = offsetSec
    this.beatGrid.setBpm(this.bpm, this.bpmConfidence, offsetSec)
    this.publishCapabilityState()
  }

  /**
   * Apply an effective BPM (e.g. from a manual override) and regenerate beat
   * markers from it so beat-phase, downbeats, and sequencer timing all reflect
   * the override rather than the stale analyzed grid.
   *
   * When bpm <= 0, clears the beat grid (timing unavailable).
   */
  setEffectiveBpm(bpm: number, confidence: number, offsetSec: number, durationSec: number): void {
    if (bpm <= 0) {
      this.bpm            = 0
      this.bpmConfidence  = 0
      this.beatGridOffset = offsetSec
      this.beatGrid.setBpm(0, 0, offsetSec)
      this.beatGrid.setMarkers([], [])
      this.publishCapabilityState()
      return
    }
    this.bpm            = bpm
    this.bpmConfidence  = Math.max(0, Math.min(1, confidence))
    this.beatGridOffset = offsetSec
    this.beatGrid.setBpm(bpm, this.bpmConfidence, offsetSec)
    const downbeatPhase = this.trackAnalysis?.musicalGrid?.downbeatPhase
      ?? this.trackAnalysis?.beatGrid.findIndex(marker => marker.isDownbeat)
      ?? 0
    const markers = buildBeatMarkers(bpm, offsetSec, durationSec, {
      timeSignature: this.trackAnalysis?.timeSignature ?? 4,
      downbeatPhase: downbeatPhase >= 0 ? downbeatPhase : 0,
      source: 'manual_correction',
      confidence: this.bpmConfidence,
    })
    this.beatGrid.setMarkers(markers, markers.filter(m => m.isDownbeat))
    this.publishCapabilityState()
  }

  /**
   * Restore the beat markers from the stored track analysis (used when a BPM
   * override is cleared — returns to the original analyzed grid).
   */
  restoreAnalysisMarkers(): void {
    if (this.trackAnalysis) {
      this.beatGrid.setMarkers(this.trackAnalysis.beatGrid, this.trackAnalysis.downbeats)
    } else {
      this.beatGrid.setMarkers([], [])
    }
    this.publishCapabilityState()
  }

  private applyTrackAnalysis(analysis: TrackIntelligenceAnalysis | null): void {
    this.trackAnalysis = analysis
    if (analysis) {
      const analyzedBpm = analysis.bpm !== null && analysis.bpm > 0 ? analysis.bpm : 0
      this.bpm = analyzedBpm
      this.bpmConfidence = analysis.bpmConfidence ?? 0
      this.beatGridOffset = analysis.beatGridOffsetSec ?? 0
      this.beatGrid.setBpm(this.bpm, this.bpmConfidence, this.beatGridOffset)
      this.beatGrid.setMarkers(analysis.beatGrid, analysis.downbeats)
      if (analysis.timeSignature) this.beatGrid.setTimeSignature(analysis.timeSignature)
      this.stemInterpolator.setData(analysis.stemCurves)
      if (!this.managedLyricsConfigured) {
        if (analysis.lyrics) {
          const lines = analysis.lyrics.lines.map(line => ({
            text: line.text,
            startSec: line.startMs / 1000,
            endSec: line.endMs / 1000,
            words: line.words.map(word => ({
              text: word.text,
              startSec: word.startMs / 1000,
              endSec: word.endMs / 1000,
              confidence: word.confidence,
            })),
            confidence: line.confidence,
            source: 'analysis',
          }))
          this.lyricTracker.setLines(lines, this.analysisLyricSourceIdentity())
        } else {
          this.lyricTracker.setLines([], this.analysisLyricSourceIdentity())
        }
      }
    } else {
      this.bpm = 0
      this.bpmConfidence = 0
      this.beatGridOffset = 0
      this.beatGrid.setBpm(0, 0, 0)
      this.beatGrid.setMarkers([], [])
      this.stemInterpolator.setData(null)
      if (!this.managedLyricsConfigured) this.lyricTracker.setLines([], this.analysisLyricSourceIdentity())
    }
  }

  setAuthoritativeTrackState(input: {
    analysis: TrackIntelligenceAnalysis | null
    resolvedSections: readonly ReactTrackSection[]
    trackId: string
    sourceId?: string | null
  }): boolean {
    if (this.trackId !== null && input.trackId !== this.trackId) return false
    if (input.sourceId !== undefined && this.sourceId !== null && input.sourceId !== this.sourceId) return false
    this.applyTrackAnalysis(input.analysis)
    this.resolvedSections = input.resolvedSections.map(section => ({ ...section }))
    this.resolvedTimelineRevision = this.resolvedSections.length > 0
      ? timelineRevision(this.resolvedSections)
      : null
    const currentTime = AudioFeatureBus.getFrame().timeSec
    AudioFeatureBus.updatePartial({
      sourceId: this.sourceId,
      trackId: this.trackId,
      capabilities: this.capabilityState(),
      ...this.analysisPublication(currentTime),
    })
    return true
  }

  setTrackAnalysis(analysis: TrackIntelligenceAnalysis | null): void {
    const resolvedSections = analysis
      ? resolveAuthoritativeTimeline({
          analyzedSections: adaptMIAnalysis(analysis),
          durationSec: analysis.durationMs / 1000,
        })
      : []
    this.applyTrackAnalysis(analysis)
    this.resolvedSections = resolvedSections
    this.resolvedTimelineRevision = resolvedSections.length > 0 ? timelineRevision(resolvedSections) : null
    const currentTime = AudioFeatureBus.getFrame().timeSec
    AudioFeatureBus.updatePartial({
      sourceId: this.sourceId,
      trackId: this.trackId,
      capabilities: this.capabilityState(),
      ...this.analysisPublication(currentTime),
    })
  }

  /** Backward-compatible bridge for callers that still publish manual-only sections. */
  setManualSections(sections: ReactTrackSection[]): void {
    const analyzedSections = this.trackAnalysis ? adaptMIAnalysis(this.trackAnalysis) : []
    const durationSec = this.trackAnalysis?.durationMs
      ? this.trackAnalysis.durationMs / 1000
      : Math.max(0, ...sections.map(section => section.endSec))
    this.setResolvedTimeline(resolveAuthoritativeTimeline({ analyzedSections, manualSections: sections, durationSec }), this.trackId)
  }

  setResolvedTimeline(sections: readonly ReactTrackSection[], trackId: string | null = this.trackId): boolean {
    if (trackId !== this.trackId) return false
    this.resolvedSections = sections.map(section => ({ ...section }))
    this.resolvedTimelineRevision = this.resolvedSections.length > 0 ? timelineRevision(this.resolvedSections) : null
    const currentTime = AudioFeatureBus.getFrame().timeSec
    AudioFeatureBus.updatePartial({
      sourceId: this.sourceId,
      trackId: this.trackId,
      capabilities: this.capabilityState(),
      ...this.analysisPublication(currentTime),
    })
    return true
  }

  setSourceId(sourceId: string | null, trackId: string | null = null): void {
    const changed = this.sourceId !== sourceId || this.trackId !== trackId
    this.sourceId = sourceId
    this.trackId  = trackId
    if (!changed) {
      this.publishCapabilityState()
      return
    }

    this.trackAnalysis = null
    this.resolvedSections = []
    this.resolvedTimelineRevision = null
    this.bpm = 0
    this.bpmConfidence = 0
    this.beatGridOffset = 0
    this.beatGrid.setBpm(0, 0, 0)
    this.beatGrid.setMarkers([], [])
    this.stemInterpolator.setData(null)
    this.resetRhythmRuntimeState()
    this.clearLyricStateForSource(`source:${trackId ?? sourceId ?? 'none'}`)
    AudioFeatureBus.reset()
    this.publishCapabilityState(false)
  }

  setMeydaFeaturesGetter(getter: () => MeydaFeatureSnapshot | null): void {
    this.meydaFeaturesGetter = getter
  }

  private analysisLyricSourceIdentity(): string {
    return `track-analysis:${this.trackId ?? this.sourceId ?? 'unbound'}`
  }

  /** Configure the active lyric document used by every live lyric consumer. */
  setActiveLyrics(source: ActiveLyricTrackerSource): void {
    this.managedLyricsConfigured = true
    this.lyricTracker.setLyrics(source)
    this.publishCapabilityState()
  }

  private updateLyricState(
    audioTimeSec: number,
    transitionMode: LyricPlaybackTransitionMode,
  ): LyricPlaybackState {
    this.lyricState = this.lyricTracker.update(audioTimeSec, transitionMode)
    LyricPlaybackBus.setState(this.lyricState.playback)
    return this.lyricState.playback
  }

  private lyricFrameState(): MILyrics {
    return {
      activeLine:        this.lyricState.activeLine,
      activeLineId:      this.lyricState.playback.activeCue?.id ?? null,
      previousLine:      this.lyricState.playback.previousCue?.text ?? null,
      nextLine:          this.lyricState.playback.nextCue?.text ?? null,
      activeWord:        this.lyricState.activeWord,
      activeWordId:      this.lyricState.playback.activeWord?.id ?? null,
      vocalActivity:     this.lyricState.vocalActivity,
      phraseConfidence:  this.lyricState.phraseConfidence,
      lyricLineProgress: this.lyricState.lyricLineProgress,
      wordProgress:      this.lyricState.wordProgress,
      wordHit:           this.lyricState.wordHit,
      lineEnter:         this.lyricState.lineEnter,
      lineExit:          this.lyricState.lineExit,
      isGap:             this.lyricState.isGap,
    }
  }

  /**
   * Resolve outside the analyser frame path, for paused edits, seeks, and source
   * replacement. This also refreshes the lyric slice of the current MI frame.
   */
  resolveLyricsAt(
    audioTimeSec: number,
    transitionMode: LyricPlaybackTransitionMode = 'continuous',
  ): LyricPlaybackState {
    const playback = this.updateLyricState(audioTimeSec, transitionMode)
    const currentFrame = AudioFeatureBus.getFrame()
    const capabilities = currentFrame.capabilities ?? {
      liveBands: false,
      rhythmEvents: false,
      beatGrid: false,
      sections: false,
      trackEnergyCurve: false,
      stemCurves: false,
      lyrics: false,
    }
    const resolvedTime = Number.isFinite(audioTimeSec) ? audioTimeSec : 0
    AudioFeatureBus.updatePartial({
      timeSec: resolvedTime,
      lyrics: this.lyricFrameState(),
      capabilities: {
        ...capabilities,
        sections: this.resolvedSections.some(section => section.provenance?.authority !== 'fallback'),
        lyrics: this.lyricTracker.hasLyrics(),
      },
      ...this.analysisPublication(resolvedTime),
    })
    return playback
  }

  getLyricPlaybackState(): LyricPlaybackState {
    return this.lyricTracker.getState()
  }

  /** Feed a live AnalyserNode — allocates two typed arrays per call. */
  updateFromAnalyser(input: AnalyserInputFrame): void {
    const { analyser, sampleRate, audioTime, isPlaying, publisherId } = input
    const freqBuf = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    analyser.getByteFrequencyData(freqBuf)
    const timeBuf = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>
    analyser.getByteTimeDomainData(timeBuf)
    this.updateFromAudioFrame({ freqBuf, timeBuf, sampleRate, audioTime, isPlaying, publisherId })
  }

  updateFromAudioFrame(input: AudioFrameInput): void {
    const { freqBuf, timeBuf, sampleRate, isPlaying, publisherId } = input
    const audioTime = Number.isFinite(input.audioTime) ? Math.max(0, input.audioTime) : 0
    this.sampleRate = sampleRate > 0 ? sampleRate : this.sampleRate

    // Several renderer surfaces can coexist briefly during navigation/StrictMode.
    // Preserve the first canonical snapshot for one transport instant instead of
    // advancing the singleton detector twice and overwriting one-frame hit edges.
    if (this.isDuplicateAnalyserPublication(audioTime, isPlaying, publisherId)) return

    this.resetRhythmForTransportDiscontinuity(audioTime)
    this.frameId++

    const fftSize = freqBuf.length * 2  // analyser frequencyBinCount = fftSize/2

    // ── Layer 1: Band analysis ──────────────────────────────────────────────
    const bandResult = this.bandAnalyzer.analyze(freqBuf, this.sampleRate)

    // ── Layer 2: Rhythm / onset detection ───────────────────────────────────
    const rhythmResult = this.rhythmAnalyzer.analyze(freqBuf, bandResult, isPlaying)

    // ── Layer 3: Beat grid / phrase tracking ────────────────────────────────
    const beatState = this.beatGrid.update(audioTime, isPlaying)

    // ── Layer 4: Energy (+ optional Meyda spectral features) ────────────────
    const meyda        = this.meydaFeaturesGetter ? this.meydaFeaturesGetter() : null
    const energyResult = this.energyAnalyzer.analyze(
      bandResult, timeBuf, rhythmResult.spectralFlux, meyda, this.sampleRate,
    )

    // ── Layer 6: Harmonic analysis ───────────────────────────────────────────
    const harmonicResult = this.harmonicAnalyzer.analyze(
      freqBuf, timeBuf, this.sampleRate, fftSize,
    )

    // ── Layer 7: Stem interpolation ──────────────────────────────────────────
    const stemValues = this.stemInterpolator.sampleAt(audioTime)

    // ── Lyric tracker ────────────────────────────────────────────────────────
    this.updateLyricState(audioTime, 'continuous')

    // ── Authoritative section resolution ───────────────────────────────────
    const analysisPublication = this.analysisPublication(audioTime)
    const sectionConfidence = analysisPublication.section.confidence

    // ── Assemble partial frame for semantic analysis ──────────────────────────
    const partialFrame: MusicIntelligenceFrame = {
      timeSec:    audioTime,
      frameId:    this.frameId,
      sampleRate: this.sampleRate,
      sourceId:   this.sourceId,
      trackId:    this.trackId,
      bands: bandResult.bands,
      rhythm: {
        bpm:              beatState.bpm,
        bpmConfidence:    beatState.bpmConfidence,
        beatPhase:        beatState.beatPhase,
        beatHit:          beatState.beatHit,
        beatIndex:        beatState.beatIndex,
        beatInBar:        beatState.beatInBar,
        barIndex:         beatState.barIndex,
        downbeatHit:      beatState.downbeatHit,
        phrase4Progress:  beatState.phrase4Progress,
        phrase8Progress:  beatState.phrase8Progress,
        phrase16Progress: beatState.phrase16Progress,
        phrase32Progress: beatState.phrase32Progress,
        phrase4Hit:       beatState.phrase4Hit,
        phrase8Hit:       beatState.phrase8Hit,
        phrase16Hit:      beatState.phrase16Hit,
        phrase32Hit:      beatState.phrase32Hit,
        kickHit:          rhythmResult.kickHit,
        kickStrength:     rhythmResult.kickStrength,
        snareHit:         rhythmResult.snareHit,
        snareStrength:    rhythmResult.snareStrength,
        hatHit:           rhythmResult.hatHit,
        hatStrength:      rhythmResult.hatStrength,
        transient:        rhythmResult.transient,
        transientConfidence: rhythmResult.transientConfidence,
      },
      energy: {
        instant:      energyResult.instant,
        shortTerm:    energyResult.shortTerm,
        longTerm:     energyResult.longTerm,
        peak:         energyResult.peak,
        rms:          energyResult.rms,
        crestFactor:  energyResult.crestFactor,
        spectralFlux: energyResult.spectralFlux,
        delta:        energyResult.delta,
        percentile:   energyResult.percentile,
        buildProgress: energyResult.buildProgress,
        dropImpact:   energyResult.dropImpact,
        tension:      energyResult.tension,
        complexity:   energyResult.complexity,
        trackCurve: this.trackAnalysis?.energyCurves.shortTerm.length
          ? sampleFeatureCurveAt(this.trackAnalysis.energyCurves.shortTerm, audioTime)
          : undefined,
        spectralCentroid:  energyResult.spectralCentroid,
        spectralSpread:    energyResult.spectralSpread,
        spectralRolloff:   energyResult.spectralRolloff,
        spectralFlatness:  energyResult.spectralFlatness,
      },
      section: analysisPublication.section,
      harmonic: harmonicResult,
      stems:    stemValues,
      lyrics: this.lyricFrameState(),
      semantics: { ...DEFAULT_MI_FRAME.semantics },
      capabilities: {
        liveBands: true,
        rhythmEvents: true,
        beatGrid: beatState.bpm > 0,
        sections: this.resolvedSections.some(section => section.provenance?.authority !== 'fallback'),
        trackEnergyCurve: Boolean(this.trackAnalysis?.energyCurves.shortTerm.length),
        stemCurves: this.trackAnalysis?.stemCurves != null,
        lyrics: this.lyricTracker.hasLyrics(),
      },
      resolvedSections: analysisPublication.resolvedSections,
      currentResolvedSection: analysisPublication.currentResolvedSection,
      phraseMarkers: analysisPublication.phraseMarkers,
      semanticMoments: analysisPublication.semanticMoments,
      gridConfidence: analysisPublication.gridConfidence,
      analysisSource: analysisPublication.analysisSource,
      analysisCapabilities: analysisPublication.analysisCapabilities,
      analysisRevision: analysisPublication.analysisRevision,
      timelineRevision: analysisPublication.timelineRevision,
      raw: {
        freqData:       freqBuf,
        timeDomainData: timeBuf,
      },
      confidence: {
        overall:  sectionConfidence > 0
          ? (beatState.bpmConfidence + sectionConfidence) / 2
          : beatState.bpmConfidence * 0.5,
        rhythm:   beatState.bpmConfidence,
        harmonic: harmonicResult.keyConfidence,
        section:  sectionConfidence,
      },
    }

    // ── Layer 8: Semantic analysis (reads the assembled frame) ───────────────
    const semanticsResult = this.semanticAnalyzer.analyze(partialFrame)

    // Publish final frame with semantics filled in
    const frame: MusicIntelligenceFrame = { ...partialFrame, semantics: semanticsResult }
    AudioFeatureBus.setFrame(frame, publisherId ?? null)
    this.rememberAnalyserPublication(audioTime, isPlaying)
  }

  start(): void { /**/ }
  stop():  void { /**/ }

  reset(): void {
    this.frameId = 0
    this.bandAnalyzer.reset()
    this.resetRhythmRuntimeState()
    this.beatGrid.reset()
    this.energyAnalyzer.reset()
    this.harmonicAnalyzer.reset()
    this.stemInterpolator.reset()
    this.lyricTracker.reset()
    this.lyricState = {
      ...this.lyricState,
      playback: EMPTY_LYRIC_PLAYBACK_STATE,
      activeLine: null,
      activeWord: null,
      vocalActivity: 0,
      phraseConfidence: 0,
      lyricLineProgress: 0,
      wordProgress: 0,
      wordHit: false,
      lineEnter: false,
      lineExit: false,
      isGap: false,
    }
    this.semanticAnalyzer.reset()
    LyricPlaybackBus.reset()
    AudioFeatureBus.reset()
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────
export const musicIntelligenceEngine = new MusicIntelligenceEngine()
