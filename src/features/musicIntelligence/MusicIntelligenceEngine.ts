// Central music intelligence engine.
// Receives raw audio data (FFT buffer + time-domain buffer) every animation frame,
// computes a MusicIntelligenceFrame, and publishes it to AudioFeatureBus.
//
// Designed to be called synchronously from an existing rAF loop (LiveVisualCanvas,
// ReactPlaceholderCanvas) — it has no internal RAF or timer.
// The module-level `musicIntelligenceEngine` singleton is the intended access point.

import { AudioFeatureBus } from './AudioFeatureBus'
import { EMAFilter, PeakFollower, RunningMax, FeatureRingBuffer } from './featureSmoothing'
import { DEFAULT_MI_FRAME } from './constants'
import type {
  MusicIntelligenceFrame,
  TrackIntelligenceAnalysis,
  TrackSectionMI,
  ReactSectionType,
  ReactTrackSection,
} from './types'

// ── Band frequency ranges (Hz) ────────────────────────────────────────────────
const BAND_SUB_LO    =     20
const BAND_SUB_HI    =     60
const BAND_BASS_LO   =     60
const BAND_BASS_HI   =    250
const BAND_LOWMID_LO =    250
const BAND_LOWMID_HI =   1000
const BAND_MID_LO    =   1000
const BAND_MID_HI    =   4000
const BAND_HIGH_LO   =   4000
const BAND_HIGH_HI   =   8000
const BAND_AIR_LO    =   8000
const BAND_AIR_HI    =  20000

// ── Smoothing alpha constants ─────────────────────────────────────────────────
// Higher alpha = faster tracking. At 60 fps: 0.25→4 frames, 0.08→12, 0.002→500.
const ALPHA_FAST  = 0.25
const ALPHA_MED   = 0.08
const ALPHA_VSLOW = 0.002

// ── Onset detection thresholds ────────────────────────────────────────────────
const BEAT_COOLDOWN_FRAMES = 8   // minimum frames between beat-hit registrations

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBandAvg(
  buf: Uint8Array<ArrayBuffer>,
  sampleRate: number,
  loHz: number,
  hiHz: number,
): number {
  const n   = buf.length
  const nyq = sampleRate / 2
  const lb  = Math.max(0, Math.floor((loHz / nyq) * n))
  const hb  = Math.min(n - 1, Math.ceil((hiHz / nyq) * n))
  if (hb <= lb) return 0
  let sum = 0
  for (let i = lb; i <= hb; i++) sum += buf[i]
  return sum / ((hb - lb + 1) * 255)
}

function computeRms(timeBuf: Uint8Array<ArrayBuffer> | null): number {
  if (!timeBuf || timeBuf.length === 0) return 0
  let sum = 0
  for (let i = 0; i < timeBuf.length; i++) {
    const s = (timeBuf[i] / 128) - 1
    sum += s * s
  }
  return Math.sqrt(sum / timeBuf.length)
}

function computePeak(timeBuf: Uint8Array<ArrayBuffer> | null): number {
  if (!timeBuf || timeBuf.length === 0) return 0
  let peak = 0
  for (let i = 0; i < timeBuf.length; i++) {
    const s = Math.abs((timeBuf[i] / 128) - 1)
    if (s > peak) peak = s
  }
  return peak
}

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
  private sampleRate    = 44100
  private bpm           = 120
  private bpmConfidence = 0
  private beatGridOffset = 0
  private trackAnalysis: TrackIntelligenceAnalysis | null = null
  private manualSections: ReactTrackSection[] = []
  private sourceId: string | null = null
  private trackId:  string | null = null
  private frameId   = 0

  // Per-band fast smoothers (displayed values)
  private readonly emaFast = {
    sub:    new EMAFilter(),
    bass:   new EMAFilter(),
    lowMid: new EMAFilter(),
    mid:    new EMAFilter(),
    high:   new EMAFilter(),
    air:    new EMAFilter(),
  }

  // Per-band medium smoothers (onset detection baseline)
  private readonly emaBaseline = {
    sub:    new EMAFilter(),
    bass:   new EMAFilter(),
    lowMid: new EMAFilter(),
    mid:    new EMAFilter(),
    high:   new EMAFilter(),
    air:    new EMAFilter(),
  }

  // Running max for normalization
  private readonly runMax = {
    sub:    new RunningMax(),
    bass:   new RunningMax(),
    lowMid: new RunningMax(),
    mid:    new RunningMax(),
    high:   new RunningMax(),
    air:    new RunningMax(),
  }

  // Energy trackers
  private readonly energyShort   = new EMAFilter()
  private readonly energyLong    = new EMAFilter()
  private readonly energyPeak    = new PeakFollower()
  private readonly energyHistory = new FeatureRingBuffer(300)  // ~5 s at 60 fps

  // Rhythm state
  private prevBeatPhase    = 0
  private beatIndex        = 0
  private beatCooldown     = 0

  // Spectral flux: previous normalized frequency magnitudes
  private prevFreqNorm: Float32Array | null = null

  // ── Public API ──────────────────────────────────────────────────────────────

  initialize(options: MusicIntelligenceEngineOptions = {}): void {
    this.sampleRate = options.sampleRate ?? 44100
    this.reset()
  }

  setBpm(bpm: number, confidence = 0.8): void {
    this.bpm           = Math.max(1, bpm)
    this.bpmConfidence = Math.max(0, Math.min(1, confidence))
  }

  setBeatGridOffset(offsetSec: number): void {
    this.beatGridOffset = offsetSec
  }

  setTrackAnalysis(analysis: TrackIntelligenceAnalysis | null): void {
    this.trackAnalysis = analysis
    if (analysis && analysis.bpm > 0) {
      this.bpm           = analysis.bpm
      this.bpmConfidence = analysis.bpmConfidence
    }
  }

  setManualSections(sections: ReactTrackSection[]): void {
    this.manualSections = sections
  }

  setSourceId(sourceId: string | null, trackId: string | null = null): void {
    this.sourceId = sourceId
    this.trackId  = trackId
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

  /**
   * Feed pre-read audio buffers (called by LiveVisualCanvas after it reads the
   * analyser for its own use, avoiding a second getByteFrequencyData call).
   */
  updateFromAudioFrame(input: AudioFrameInput): void {
    const { freqBuf, timeBuf, sampleRate, audioTime, isPlaying } = input
    this.sampleRate = sampleRate > 0 ? sampleRate : this.sampleRate
    this.frameId++

    // ── 1. Raw band extraction ──────────────────────────────────────────────
    const rSub    = getBandAvg(freqBuf, this.sampleRate, BAND_SUB_LO,    BAND_SUB_HI)
    const rBass   = getBandAvg(freqBuf, this.sampleRate, BAND_BASS_LO,   BAND_BASS_HI)
    const rLowMid = getBandAvg(freqBuf, this.sampleRate, BAND_LOWMID_LO, BAND_LOWMID_HI)
    const rMid    = getBandAvg(freqBuf, this.sampleRate, BAND_MID_LO,    BAND_MID_HI)
    const rHigh   = getBandAvg(freqBuf, this.sampleRate, BAND_HIGH_LO,   BAND_HIGH_HI)
    const rAir    = getBandAvg(freqBuf, this.sampleRate, BAND_AIR_LO,    BAND_AIR_HI)

    // Smoothed display values
    const sub    = this.emaFast.sub.update(rSub,    ALPHA_FAST)
    const bass   = this.emaFast.bass.update(rBass,  ALPHA_FAST)
    const lowMid = this.emaFast.lowMid.update(rLowMid, ALPHA_FAST)
    const mid    = this.emaFast.mid.update(rMid,    ALPHA_FAST)
    const high   = this.emaFast.high.update(rHigh,  ALPHA_FAST)
    const air    = this.emaFast.air.update(rAir,    ALPHA_FAST)

    const volume = Math.min(1, (
      sub    * 1.3 +
      bass   * 1.1 +
      lowMid * 0.9 +
      mid    * 0.7 +
      high   * 0.5 +
      air    * 0.3
    ) / 2.0)

    // Update running maxima and compute normalized values
    this.runMax.sub.update(sub);       const normalizedSub    = this.runMax.sub.normalize(sub)
    this.runMax.bass.update(bass);     const normalizedBass   = this.runMax.bass.normalize(bass)
    this.runMax.lowMid.update(lowMid); const normalizedLowMid = this.runMax.lowMid.normalize(lowMid)
    this.runMax.mid.update(mid);       const normalizedMid    = this.runMax.mid.normalize(mid)
    this.runMax.high.update(high);     const normalizedHigh   = this.runMax.high.normalize(high)
    this.runMax.air.update(air);       const normalizedAir    = this.runMax.air.normalize(air)

    // ── 2. Onset / beat detection ───────────────────────────────────────────
    // Baseline EMAs track the slower-moving average each band
    const bSub    = this.emaBaseline.sub.update(rSub,    ALPHA_MED)
    const bBass   = this.emaBaseline.bass.update(rBass,  ALPHA_MED)
    const bLowMid = this.emaBaseline.lowMid.update(rLowMid, ALPHA_MED)
    const bMid    = this.emaBaseline.mid.update(rMid,    ALPHA_MED)
    const bHigh   = this.emaBaseline.high.update(rHigh,  ALPHA_MED)
    const bAir    = this.emaBaseline.air.update(rAir,    ALPHA_MED)

    // Onset ratio: how much the raw value exceeds its own baseline
    const onsetSub    = bSub    > 0.005 ? Math.max(0, rSub    - bSub)    / bSub    : 0
    const onsetBass   = bBass   > 0.005 ? Math.max(0, rBass   - bBass)   / bBass   : 0
    const onsetLowMid = bLowMid > 0.005 ? Math.max(0, rLowMid - bLowMid) / bLowMid : 0
    const onsetMid    = bMid    > 0.005 ? Math.max(0, rMid    - bMid)    / bMid    : 0
    const onsetHigh   = bHigh   > 0.005 ? Math.max(0, rHigh   - bHigh)   / bHigh   : 0

    void bAir  // not used for onset but tracked for future use

    // Kick: strong sub + bass transient
    const kickStrength  = Math.min(1, (onsetSub * 0.6 + onsetBass * 0.4))
    const kickHit       = isPlaying && kickStrength > 0.5 && (rSub + rBass) > 0.06

    // Snare: mid-range onset on rhythmically likely beats (2 and 4)
    const snareStrength = Math.min(1, (onsetLowMid * 0.4 + onsetMid * 0.6))
    const snareHit      = isPlaying && snareStrength > 0.55 && (rLowMid + rMid) > 0.05

    // Hat: high-frequency transient
    const hatStrength   = Math.min(1, (onsetHigh * 0.7 + onsetMid * 0.3))
    const hatHit        = isPlaying && hatStrength > 0.5 && rHigh > 0.04

    const transient            = Math.min(1, kickStrength * 0.5 + snareStrength * 0.3 + hatStrength * 0.2)
    const transientConfidence  = this.bpmConfidence

    // ── 3. Beat-phase rhythm ────────────────────────────────────────────────
    const beatPeriodSec = 60 / Math.max(1, this.bpm)
    const adjustedTime  = audioTime - this.beatGridOffset
    const beatPhase     = adjustedTime > 0
      ? (adjustedTime % beatPeriodSec) / beatPeriodSec
      : 0

    // Detect phase wrap (beat boundary crossed since last frame)
    let beatHit = false
    if (isPlaying && this.prevBeatPhase > 0.85 && beatPhase < 0.15) {
      if (this.beatCooldown <= 0) {
        beatHit = true
        this.beatIndex++
        this.beatCooldown = BEAT_COOLDOWN_FRAMES
      }
    }
    if (this.beatCooldown > 0) this.beatCooldown--
    this.prevBeatPhase = beatPhase

    const beatInBar  = this.beatIndex % 4
    const barIndex   = Math.floor(this.beatIndex / 4)
    const downbeatHit = beatHit && beatInBar === 0

    // Phrase progress and boundary hits
    const bi4  = this.beatIndex % 4
    const bi8  = this.beatIndex % 8
    const bi16 = this.beatIndex % 16
    const bi32 = this.beatIndex % 32

    const phrase4Progress  = (bi4  + beatPhase) / 4
    const phrase8Progress  = (bi8  + beatPhase) / 8
    const phrase16Progress = (bi16 + beatPhase) / 16
    const phrase32Progress = (bi32 + beatPhase) / 32

    const phrase4Hit  = beatHit && bi4  === 0
    const phrase8Hit  = beatHit && bi8  === 0
    const phrase16Hit = beatHit && bi16 === 0
    const phrase32Hit = beatHit && bi32 === 0

    // ── 4. Spectral flux ────────────────────────────────────────────────────
    let spectralFlux = 0
    const n = freqBuf.length

    if (this.prevFreqNorm && this.prevFreqNorm.length === n) {
      for (let i = 0; i < n; i++) {
        const delta = freqBuf[i] / 255 - this.prevFreqNorm[i]
        if (delta > 0) spectralFlux += delta
      }
      spectralFlux /= n
    }

    if (!this.prevFreqNorm || this.prevFreqNorm.length !== n) {
      this.prevFreqNorm = new Float32Array(n)
    }
    for (let i = 0; i < n; i++) this.prevFreqNorm[i] = freqBuf[i] / 255

    // ── 5. Energy ───────────────────────────────────────────────────────────
    const rms         = computeRms(timeBuf)
    const peak        = computePeak(timeBuf)
    const crestFactor = rms > 0.001 ? Math.min(20, peak / rms) : 1

    const instant   = volume
    const shortTerm = this.energyShort.update(instant, ALPHA_MED)
    const longTerm  = this.energyLong.update(instant, ALPHA_VSLOW)
    const energyPk  = this.energyPeak.update(instant, 0.995)
    const delta     = instant - shortTerm

    this.energyHistory.push(instant)
    const percentile = this.energyHistory.percentile(instant)

    const buildProgress = longTerm > 0.01
      ? Math.max(0, Math.min(1, (instant - longTerm) / longTerm))
      : 0
    const dropImpact = longTerm > 0.01
      ? Math.max(0, Math.min(1, (instant - longTerm * 0.5) / Math.max(0.01, longTerm)))
      : 0
    const tension    = Math.min(1, spectralFlux * 10 + Math.max(0, delta * 5))
    const complexity = Math.min(1, spectralFlux * 15 + (high + air) * 0.5)

    // ── 6. Section resolution ────────────────────────────────────────────────
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
        (audioTime - sectionStart) / (sectionEnd - sectionStart)
      ))
    }

    // ── 7. Assemble and publish ─────────────────────────────────────────────
    const frame: MusicIntelligenceFrame = {
      timeSec:    audioTime,
      frameId:    this.frameId,
      sampleRate: this.sampleRate,
      sourceId:   this.sourceId,
      trackId:    this.trackId,
      bands: {
        sub, bass, lowMid, mid, high, air, volume,
        normalizedSub, normalizedBass, normalizedLowMid,
        normalizedMid, normalizedHigh, normalizedAir,
      },
      rhythm: {
        bpm:              this.bpm,
        bpmConfidence:    this.bpmConfidence,
        beatPhase,
        beatHit,
        beatIndex:        this.beatIndex,
        beatInBar,
        barIndex,
        downbeatHit,
        phrase4Progress,
        phrase8Progress,
        phrase16Progress,
        phrase32Progress,
        phrase4Hit,
        phrase8Hit,
        phrase16Hit,
        phrase32Hit,
        kickHit,
        kickStrength,
        snareHit,
        snareStrength,
        hatHit,
        hatStrength,
        transient,
        transientConfidence,
      },
      energy: {
        instant,
        shortTerm,
        longTerm,
        peak:          energyPk,
        rms,
        crestFactor,
        spectralFlux,
        delta,
        percentile,
        buildProgress,
        dropImpact,
        tension,
        complexity,
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
      harmonic:  { ...DEFAULT_MI_FRAME.harmonic },
      stems:     { ...DEFAULT_MI_FRAME.stems },
      lyrics:    { ...DEFAULT_MI_FRAME.lyrics },
      semantics: { ...DEFAULT_MI_FRAME.semantics },
      raw: {
        freqData:       freqBuf,
        timeDomainData: timeBuf,
      },
      confidence: {
        overall:  sectionConfidence > 0
          ? (this.bpmConfidence + sectionConfidence) / 2
          : this.bpmConfidence * 0.5,
        rhythm:   this.bpmConfidence,
        harmonic: 0,
        section:  sectionConfidence,
      },
    }

    AudioFeatureBus.setFrame(frame)
  }

  /** No-op: engine is frame-driven, not self-ticking. Provided for API symmetry. */
  start(): void { /**/ }

  /** No-op: engine is frame-driven, not self-ticking. */
  stop(): void { /**/ }

  reset(): void {
    this.frameId         = 0
    this.beatIndex       = 0
    this.prevBeatPhase   = 0
    this.beatCooldown    = 0
    this.prevFreqNorm    = null

    for (const f of Object.values(this.emaFast))     f.reset()
    for (const f of Object.values(this.emaBaseline)) f.reset()
    for (const f of Object.values(this.runMax))      f.reset()

    this.energyShort.reset()
    this.energyLong.reset()
    this.energyPeak.reset()
    this.energyHistory.reset()

    AudioFeatureBus.reset()
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────
// All consumers (LiveVisualCanvas, ReactPlaceholderCanvas, useAudioEngine) share
// this one instance so the published frame is always consistent.
export const musicIntelligenceEngine = new MusicIntelligenceEngine()
