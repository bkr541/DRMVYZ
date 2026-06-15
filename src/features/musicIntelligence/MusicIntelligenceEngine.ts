// Central music intelligence engine.
// Receives raw audio data (FFT buffer + time-domain buffer) every animation frame,
// delegates to analysis modules, assembles a MusicIntelligenceFrame, and
// publishes it to AudioFeatureBus.
//
// The module-level `musicIntelligenceEngine` singleton is the intended access point.

import { AudioFeatureBus } from './AudioFeatureBus'
import { DEFAULT_MI_FRAME } from './constants'
import { MultiBandAnalyzer } from './bandAnalysis'
import { RhythmAnalyzer } from './rhythmAnalysis'
import { BeatGrid } from './beatGrid'
import { EnergyAnalyzer, type MeydaFeatureSnapshot } from './energyAnalysis'
import { HarmonicAnalyzer } from './harmonicAnalysis'
import { StemCurveInterpolator } from './stemAnalysis'
import { SemanticAnalyzer } from './semanticAnalysis'
import type { ActiveLyricState } from '../lyrics/services/lyricExtraction'
import { ActiveLyricTracker } from '../lyrics/services/lyricExtraction'
import type {
  MusicIntelligenceFrame,
  TrackIntelligenceAnalysis,
  TrackSectionMI,
  ReactSectionType,
  ReactTrackSection,
} from './types'

// ── Section resolution helpers ────────────────────────────────────────────────

function resolveManualSection(
  sections: ReactTrackSection[],
  audioTime: number,
): ReactTrackSection | null {
  for (const s of sections) {
    if (audioTime >= s.startSec && audioTime < s.endSec) return s
  }
  return null
}

function resolveAnalysisSection(
  sections: TrackSectionMI[],
  audioTime: number,
): TrackSectionMI | null {
  for (const s of sections) {
    if (audioTime >= s.startSec && audioTime < s.endSec) return s
  }
  return null
}

// ── Public input types ────────────────────────────────────────────────────────

export interface MusicIntelligenceEngineOptions {
  sampleRate?: number
}

export interface AnalyserInputFrame {
  analyser:   AnalyserNode
  sampleRate: number
  audioTime:  number
  isPlaying:  boolean
}

export interface AudioFrameInput {
  freqBuf:    Uint8Array<ArrayBuffer>
  timeBuf:    Uint8Array<ArrayBuffer> | null
  sampleRate: number
  audioTime:  number
  isPlaying:  boolean
}

// ── Engine class ──────────────────────────────────────────────────────────────

export class MusicIntelligenceEngine {
  private sampleRate     = 44100
  private bpm            = 120
  private bpmConfidence  = 0
  private beatGridOffset = 0
  private trackAnalysis: TrackIntelligenceAnalysis | null = null
  private manualSections: ReactTrackSection[] = []
  private sourceId: string | null = null
  private trackId:  string | null = null
  private frameId   = 0

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
  private readonly semanticAnalyzer = new SemanticAnalyzer()

  // ── Public API ──────────────────────────────────────────────────────────────

  initialize(options: MusicIntelligenceEngineOptions = {}): void {
    this.sampleRate = options.sampleRate ?? 44100
    this.beatGrid.setBpm(this.bpm, this.bpmConfidence, this.beatGridOffset)
    this.reset()
  }

  setBpm(bpm: number, confidence = 0.8): void {
    this.bpm           = Math.max(1, bpm)
    this.bpmConfidence = Math.max(0, Math.min(1, confidence))
    // Always pass the stored beatGridOffset so manual overrides preserve the original grid phase.
    this.beatGrid.setBpm(this.bpm, this.bpmConfidence, this.beatGridOffset)
  }

  setBeatGridOffset(offsetSec: number): void {
    this.beatGridOffset = offsetSec
    this.beatGrid.setBpm(this.bpm, this.bpmConfidence, offsetSec)
  }

  setTrackAnalysis(analysis: TrackIntelligenceAnalysis | null): void {
    this.trackAnalysis = analysis
    if (analysis && analysis.bpm > 0) {
      this.bpm            = analysis.bpm
      this.bpmConfidence  = analysis.bpmConfidence
      // beatGridOffsetSec is required in new analyses; fall back to 0 for old persisted data
      this.beatGridOffset = analysis.beatGridOffsetSec ?? 0
    }
    this.beatGrid.setBpm(this.bpm, this.bpmConfidence, this.beatGridOffset)
    if (analysis) {
      this.beatGrid.setMarkers(analysis.beatGrid, analysis.downbeats)
      if (analysis.timeSignature) this.beatGrid.setTimeSignature(analysis.timeSignature)
      // Wire stem curves
      this.stemInterpolator.setData(analysis.stemCurves)
      // Wire lyrics
      if (analysis.lyrics) {
        const lines = analysis.lyrics.lines.map(l => ({
          text:       l.text,
          startSec:   l.startMs / 1000,
          endSec:     l.endMs   / 1000,
          words:      l.words.map(w => ({
            text:       w.text,
            startSec:   w.startMs / 1000,
            endSec:     w.endMs   / 1000,
            confidence: w.confidence,
          })),
          confidence: l.confidence,
          source:     'analysis',
        }))
        this.lyricTracker.setLines(lines)
      } else {
        this.lyricTracker.setLines([])
      }
    } else {
      // No analysis — reset BPM state so the previous track's values do not leak
      // into the next track's rendering before its own analysis arrives.
      this.bpm = 0
      this.bpmConfidence = 0
      this.beatGridOffset = 0
      this.beatGrid.setBpm(0, 0, 0)
      this.beatGrid.setMarkers([], [])
      this.stemInterpolator.setData(null)
      this.lyricTracker.setLines([])
    }
  }

  setManualSections(sections: ReactTrackSection[]): void {
    this.manualSections = sections
  }

  setSourceId(sourceId: string | null, trackId: string | null = null): void {
    this.sourceId = sourceId
    this.trackId  = trackId
  }

  setMeydaFeaturesGetter(getter: () => MeydaFeatureSnapshot | null): void {
    this.meydaFeaturesGetter = getter
  }

  /** Feed a live AnalyserNode — allocates two typed arrays per call. */
  updateFromAnalyser(input: AnalyserInputFrame): void {
    const { analyser, sampleRate, audioTime, isPlaying } = input
    const freqBuf = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    analyser.getByteFrequencyData(freqBuf)
    const timeBuf = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>
    analyser.getByteTimeDomainData(timeBuf)
    this.updateFromAudioFrame({ freqBuf, timeBuf, sampleRate, audioTime, isPlaying })
  }

  updateFromAudioFrame(input: AudioFrameInput): void {
    const { freqBuf, timeBuf, sampleRate, audioTime, isPlaying } = input
    this.sampleRate = sampleRate > 0 ? sampleRate : this.sampleRate
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
    const lyricState: ActiveLyricState = this.lyricTracker.update(audioTime)

    // ── Section resolution ────────────────────────────────────────────────
    let sectionType:       ReactSectionType | null = null
    let sectionLabel       = ''
    let sectionStart       = 0
    let sectionEnd         = 0
    let sectionIntensity   = 0.5
    let sectionConfidence  = 0
    let sectionSource: 'manual' | 'analysis' | 'inferred' = 'inferred'
    let sectionProgress    = 0

    const manualSec = resolveManualSection(this.manualSections, audioTime)
    if (manualSec) {
      sectionType      = manualSec.type
      sectionLabel     = manualSec.label
      sectionStart     = manualSec.startSec
      sectionEnd       = manualSec.endSec
      sectionIntensity = manualSec.intensity
      sectionConfidence = 1.0
      sectionSource    = 'manual'
    } else if (this.trackAnalysis && this.trackAnalysis.sections.length > 0) {
      const sec = resolveAnalysisSection(this.trackAnalysis.sections, audioTime)
      if (sec) {
        sectionType      = sec.type
        sectionLabel     = sec.label
        sectionStart     = sec.startSec
        sectionEnd       = sec.endSec
        sectionIntensity = sec.intensity
        sectionConfidence = sec.confidence
        sectionSource    = 'analysis'
      }
    }

    if (sectionEnd > sectionStart) {
      sectionProgress = Math.max(0, Math.min(1,
        (audioTime - sectionStart) / (sectionEnd - sectionStart),
      ))
    }

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
        spectralCentroid:  energyResult.spectralCentroid,
        spectralSpread:    energyResult.spectralSpread,
        spectralRolloff:   energyResult.spectralRolloff,
        spectralFlatness:  energyResult.spectralFlatness,
      },
      section: {
        type:       sectionType,
        label:      sectionLabel,
        startSec:   sectionStart,
        endSec:     sectionEnd,
        progress:   sectionProgress,
        intensity:  sectionIntensity,
        confidence: sectionConfidence,
        source:     sectionSource,
      },
      harmonic: harmonicResult,
      stems:    stemValues,
      lyrics: {
        activeLine:        lyricState.activeLine,
        activeWord:        lyricState.activeWord,
        vocalActivity:     lyricState.vocalActivity,
        phraseConfidence:  lyricState.phraseConfidence,
        lyricLineProgress: lyricState.lyricLineProgress,
        wordHit:           lyricState.wordHit,
      },
      semantics: { ...DEFAULT_MI_FRAME.semantics },
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
    AudioFeatureBus.setFrame(frame)
  }

  start(): void { /**/ }
  stop():  void { /**/ }

  reset(): void {
    this.frameId = 0
    this.bandAnalyzer.reset()
    this.rhythmAnalyzer.reset()
    this.beatGrid.reset()
    this.energyAnalyzer.reset()
    this.harmonicAnalyzer.reset()
    this.stemInterpolator.reset()
    this.lyricTracker.reset()
    this.semanticAnalyzer.reset()
    AudioFeatureBus.reset()
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────
export const musicIntelligenceEngine = new MusicIntelligenceEngine()
