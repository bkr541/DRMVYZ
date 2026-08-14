// Streaming tempo + beat clock for analysis-only Live Input.
//
// The tracker deliberately consumes onset *events* rather than audio buffers so
// the canonical Music Intelligence engine can reuse its existing realtime onset
// detector. State is runtime-only and bounded; nothing in this module persists.

export const LIVE_TEMPO_TUNING = Object.freeze({
  minBpm: 65,
  maxBpm: 190,
  minOnsetSpacingSec: 0.08,
  onsetHistorySize: 32,
  onsetHistoryHorizonSec: 16,
  candidateIntervalCount: 10,
  clusterToleranceRatio: 0.085,
  sameTempoToleranceRatio: 0.06,
  minimumIntervalsForEstimate: 3,
  minimumLockConfidence: 0.45,
  minimumBeatConfidence: 0.42,
  tempoSwitchConfirmations: 4,
  phaseCorrectionWindowRatio: 0.24,
  phaseCorrectionGain: 0.18,
  phaseCorrectionMaxRatio: 0.08,
})

interface OnsetSample {
  timeSec: number
  strength: number
}

interface TempoCandidate {
  bpm: number
  confidence: number
}

export interface LiveTempoInput {
  audioTime: number
  onsetHit: boolean
  onsetStrength: number
  isPlaying: boolean
}

export interface LiveTempoState {
  bpm: number
  bpmConfidence: number
  beatAvailable: boolean
  beatPhase: number
  beatHit: boolean
  beatIndex: number
  beatEventId: number | null
  beatEventTimeSec: number | null
}

export interface LiveTempoDiagnostics {
  onsetHistoryLength: number
  acceptedBpm: number
  acceptedConfidence: number
  alternateConfirmationCount: number
}

const ZERO_STATE: LiveTempoState = {
  bpm: 0,
  bpmConfidence: 0,
  beatAvailable: false,
  beatPhase: 0,
  beatHit: false,
  beatIndex: 0,
  beatEventId: null,
  beatEventTimeSec: null,
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function normalizeTempoFromInterval(intervalSec: number): number {
  if (!Number.isFinite(intervalSec) || intervalSec <= 0) return 0
  let bpm = 60 / intervalSec
  while (bpm < LIVE_TEMPO_TUNING.minBpm) bpm *= 2
  while (bpm > LIVE_TEMPO_TUNING.maxBpm) bpm /= 2
  return bpm >= LIVE_TEMPO_TUNING.minBpm && bpm <= LIVE_TEMPO_TUNING.maxBpm ? bpm : 0
}

function relativeDifference(a: number, b: number): number {
  if (a <= 0 || b <= 0) return Number.POSITIVE_INFINITY
  return Math.abs(a - b) / Math.max(a, b)
}

function positiveModulo(value: number, modulus: number): number {
  if (modulus <= 0) return 0
  return ((value % modulus) + modulus) % modulus
}

export class LiveTempoAnalyzer {
  private readonly onsets: OnsetSample[] = []
  private acceptedBpm = 0
  private acceptedConfidence = 0
  private alternateBpm = 0
  private alternateConfirmationCount = 0
  private lastOnsetTime: number | null = null
  private lastUpdateTime: number | null = null
  private lastBeatTime: number | null = null
  private nextBeatTime: number | null = null
  private beatIndex = 0

  update(input: LiveTempoInput): LiveTempoState {
    const audioTime = Number.isFinite(input.audioTime) ? Math.max(0, input.audioTime) : 0

    if (this.lastUpdateTime !== null) {
      const delta = audioTime - this.lastUpdateTime
      if (delta < -0.001 || delta > 0.75) this.reset()
    }
    this.lastUpdateTime = audioTime

    const onsetAccepted = input.isPlaying && input.onsetHit && this.recordOnset(audioTime, input.onsetStrength)
    if (onsetAccepted) {
      const candidate = this.estimateTempo()
      if (candidate) this.acceptCandidate(candidate, audioTime)
      this.correctBeatPhaseFromOnset(audioTime)
    }

    if (this.acceptedBpm <= 0 || this.lastOnsetTime === null) return { ...ZERO_STATE, beatIndex: this.beatIndex }

    const periodSec = 60 / this.acceptedBpm
    const ageSec = Math.max(0, audioTime - this.lastOnsetTime)
    const confidence = this.decayedConfidence(ageSec, periodSec)
    if (confidence <= 0.001) {
      this.clearTempoLock()
      return { ...ZERO_STATE, beatIndex: this.beatIndex }
    }

    const beatAvailable = confidence >= LIVE_TEMPO_TUNING.minimumBeatConfidence
    let beatHit = false
    let beatEventTimeSec: number | null = null

    if (beatAvailable && input.isPlaying && this.nextBeatTime !== null && this.lastBeatTime !== null) {
      if (audioTime + 1e-6 >= this.nextBeatTime) {
        const crossed = Math.max(1, Math.floor((audioTime - this.nextBeatTime) / periodSec) + 1)
        beatEventTimeSec = this.nextBeatTime + (crossed - 1) * periodSec
        // Do not synthesize a burst of catch-up identities after a stalled frame
        // or low-confidence gap. Only the latest valid boundary emits one event;
        // normal realtime frames still advance exactly one identity per beat.
        this.beatIndex += 1
        this.lastBeatTime = beatEventTimeSec
        this.nextBeatTime = beatEventTimeSec + periodSec
        beatHit = true
      }
    }

    const beatPhase = beatAvailable && this.lastBeatTime !== null
      ? clamp01(positiveModulo(audioTime - this.lastBeatTime, periodSec) / periodSec)
      : 0

    return {
      bpm: this.acceptedBpm,
      bpmConfidence: confidence,
      beatAvailable,
      beatPhase,
      beatHit,
      beatIndex: this.beatIndex,
      beatEventId: beatHit ? this.beatIndex : null,
      beatEventTimeSec,
    }
  }

  reset(): void {
    this.onsets.length = 0
    this.acceptedBpm = 0
    this.acceptedConfidence = 0
    this.alternateBpm = 0
    this.alternateConfirmationCount = 0
    this.lastOnsetTime = null
    this.lastUpdateTime = null
    this.lastBeatTime = null
    this.nextBeatTime = null
    this.beatIndex = 0
  }

  get diagnostics(): LiveTempoDiagnostics {
    return {
      onsetHistoryLength: this.onsets.length,
      acceptedBpm: this.acceptedBpm,
      acceptedConfidence: this.acceptedConfidence,
      alternateConfirmationCount: this.alternateConfirmationCount,
    }
  }

  private recordOnset(audioTime: number, strength: number): boolean {
    const previous = this.onsets.length > 0 ? this.onsets[this.onsets.length - 1] : null
    if (previous && audioTime - previous.timeSec < LIVE_TEMPO_TUNING.minOnsetSpacingSec) return false

    const safeStrength = Math.max(0.1, clamp01(strength))
    this.onsets.push({ timeSec: audioTime, strength: safeStrength })
    this.lastOnsetTime = audioTime

    const cutoff = audioTime - LIVE_TEMPO_TUNING.onsetHistoryHorizonSec
    while (this.onsets.length > 0 && this.onsets[0].timeSec < cutoff) this.onsets.shift()
    if (this.onsets.length > LIVE_TEMPO_TUNING.onsetHistorySize) {
      this.onsets.splice(0, this.onsets.length - LIVE_TEMPO_TUNING.onsetHistorySize)
    }
    return true
  }

  private estimateTempo(): TempoCandidate | null {
    if (this.onsets.length < LIVE_TEMPO_TUNING.minimumIntervalsForEstimate + 1) return null

    const start = Math.max(1, this.onsets.length - LIVE_TEMPO_TUNING.candidateIntervalCount)
    const candidates: Array<{ bpm: number; weight: number }> = []
    let age = 0
    for (let index = this.onsets.length - 1; index >= start; index--, age++) {
      const current = this.onsets[index]
      const previous = this.onsets[index - 1]
      const bpm = normalizeTempoFromInterval(current.timeSec - previous.timeSec)
      if (bpm <= 0) continue
      const recencyWeight = Math.pow(0.78, age)
      const strengthWeight = 0.5 + 0.5 * Math.min(current.strength, previous.strength)
      candidates.push({ bpm, weight: recencyWeight * strengthWeight })
    }
    if (candidates.length < LIVE_TEMPO_TUNING.minimumIntervalsForEstimate) return null

    let bestCenter = 0
    let bestWeight = 0
    for (const candidate of candidates) {
      let clusterWeight = 0
      for (const other of candidates) {
        if (relativeDifference(candidate.bpm, other.bpm) <= LIVE_TEMPO_TUNING.clusterToleranceRatio) {
          clusterWeight += other.weight
        }
      }
      if (clusterWeight > bestWeight) {
        bestWeight = clusterWeight
        bestCenter = candidate.bpm
      }
    }

    let clusterBpmSum = 0
    let clusterWeight = 0
    let clusterCount = 0
    let totalWeight = 0
    for (const candidate of candidates) {
      totalWeight += candidate.weight
      if (relativeDifference(bestCenter, candidate.bpm) <= LIVE_TEMPO_TUNING.clusterToleranceRatio) {
        // Use recency for cluster selection, but not for the final BPM average.
        // This avoids biasing quantized frame intervals (e.g. alternating 0.42 /
        // 0.44 s samples around a true 140 BPM period) toward the latest bucket.
        clusterBpmSum += candidate.bpm
        clusterWeight += candidate.weight
        clusterCount++
      }
    }
    if (clusterCount < LIVE_TEMPO_TUNING.minimumIntervalsForEstimate || clusterWeight <= 0 || totalWeight <= 0) return null

    const bpm = clusterBpmSum / clusterCount
    let variance = 0
    for (const candidate of candidates) {
      if (relativeDifference(bestCenter, candidate.bpm) <= LIVE_TEMPO_TUNING.clusterToleranceRatio) {
        const diff = (candidate.bpm - bpm) / bpm
        variance += diff * diff
      }
    }
    const relativeStd = Math.sqrt(variance / clusterCount)
    const consistency = Math.exp(-relativeStd * 14)
    const support = clusterWeight / totalWeight
    const evidence = clamp01((clusterCount - 2) / 5)
    const confidence = clamp01(evidence * (0.55 + support * 0.45) * consistency)
    return { bpm, confidence }
  }

  private acceptCandidate(candidate: TempoCandidate, onsetTime: number): void {
    if (candidate.confidence < 0.2) return

    if (this.acceptedBpm <= 0) {
      if (candidate.confidence >= LIVE_TEMPO_TUNING.minimumLockConfidence) {
        this.lockTempo(candidate.bpm, candidate.confidence, onsetTime)
      }
      return
    }

    if (relativeDifference(candidate.bpm, this.acceptedBpm) <= LIVE_TEMPO_TUNING.sameTempoToleranceRatio) {
      this.acceptedBpm = this.acceptedBpm * 0.82 + candidate.bpm * 0.18
      this.acceptedConfidence = Math.max(candidate.confidence, this.acceptedConfidence * 0.82 + candidate.confidence * 0.18)
      this.alternateBpm = 0
      this.alternateConfirmationCount = 0
      return
    }

    this.acceptedConfidence *= 0.94
    if (relativeDifference(candidate.bpm, this.alternateBpm) <= LIVE_TEMPO_TUNING.sameTempoToleranceRatio) {
      this.alternateBpm = this.alternateBpm * 0.7 + candidate.bpm * 0.3
      this.alternateConfirmationCount += 1
    } else {
      this.alternateBpm = candidate.bpm
      this.alternateConfirmationCount = 1
    }

    if (
      this.alternateConfirmationCount >= LIVE_TEMPO_TUNING.tempoSwitchConfirmations
      && candidate.confidence >= LIVE_TEMPO_TUNING.minimumLockConfidence
    ) {
      this.lockTempo(this.alternateBpm, candidate.confidence, onsetTime, true)
    }
  }

  private lockTempo(bpm: number, confidence: number, anchorTime: number, preserveBeatIndex = false): void {
    this.acceptedBpm = bpm
    this.acceptedConfidence = clamp01(confidence)
    this.alternateBpm = 0
    this.alternateConfirmationCount = 0
    if (!preserveBeatIndex) this.beatIndex = 0
    const periodSec = 60 / bpm
    this.lastBeatTime = anchorTime
    this.nextBeatTime = anchorTime + periodSec
  }

  private correctBeatPhaseFromOnset(onsetTime: number): void {
    if (this.acceptedBpm <= 0 || this.lastBeatTime === null || this.nextBeatTime === null) return
    const periodSec = 60 / this.acceptedBpm
    const relative = (onsetTime - this.lastBeatTime) / periodSec
    const nearestBeatTime = this.lastBeatTime + Math.round(relative) * periodSec
    const errorSec = onsetTime - nearestBeatTime
    if (Math.abs(errorSec) > periodSec * LIVE_TEMPO_TUNING.phaseCorrectionWindowRatio) return

    const maxCorrection = periodSec * LIVE_TEMPO_TUNING.phaseCorrectionMaxRatio
    const correction = Math.max(
      -maxCorrection,
      Math.min(maxCorrection, errorSec * LIVE_TEMPO_TUNING.phaseCorrectionGain),
    )
    this.lastBeatTime += correction
    this.nextBeatTime += correction
  }

  private decayedConfidence(ageSec: number, periodSec: number): number {
    const holdSec = Math.max(1.25, periodSec * 2.5)
    const releaseSec = Math.max(3.5, periodSec * 5)
    if (ageSec <= holdSec) return clamp01(this.acceptedConfidence)
    if (ageSec >= releaseSec) return 0
    return clamp01(this.acceptedConfidence * (1 - (ageSec - holdSec) / (releaseSec - holdSec)))
  }

  private clearTempoLock(): void {
    this.acceptedBpm = 0
    this.acceptedConfidence = 0
    this.alternateBpm = 0
    this.alternateConfirmationCount = 0
    this.lastBeatTime = null
    this.nextBeatTime = null
  }
}
