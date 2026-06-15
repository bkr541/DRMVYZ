// Beat grid: computes beatPhase, beatIndex, bar, and phrase progress from BPM + audio time.
// Supports optional offline beat markers from TrackIntelligenceAnalysis for improved accuracy.
// All outputs are deterministic from audio time — no persistent counters needed for beat index.

import type { BeatMarkerMI } from './types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BeatGridState {
  bpm:              number
  bpmConfidence:    number
  beatPhase:        number
  beatHit:          boolean
  beatIndex:        number
  beatInBar:        number
  barIndex:         number
  downbeatHit:      boolean
  phrase4Progress:  number
  phrase8Progress:  number
  phrase16Progress: number
  phrase32Progress: number
  phrase4Hit:       boolean
  phrase8Hit:       boolean
  phrase16Hit:      boolean
  phrase32Hit:      boolean
}

const ZERO_STATE: BeatGridState = {
  bpm:              0,
  bpmConfidence:    0,
  beatPhase:        0,
  beatHit:          false,
  beatIndex:        0,
  beatInBar:        0,
  barIndex:         0,
  downbeatHit:      false,
  phrase4Progress:  0,
  phrase8Progress:  0,
  phrase16Progress: 0,
  phrase32Progress: 0,
  phrase4Hit:       false,
  phrase8Hit:       false,
  phrase16Hit:      false,
  phrase32Hit:      false,
}

// ── BeatGrid ──────────────────────────────────────────────────────────────────

export class BeatGrid {
  private bpm           = 0
  private bpmConfidence = 0
  private timeSignature = 4
  private offsetSec     = 0
  private beatMarkers:  BeatMarkerMI[] = []
  private downbeats:    BeatMarkerMI[] = []
  private prevBeatIndex = -1   // last beat index we already fired for

  // ── Configuration ──────────────────────────────────────────────────────────

  setBpm(bpm: number, confidence = 0, offsetSec?: number): void {
    // 0 means "unavailable" — preserve as-is; do NOT clamp to 1.
    this.bpm           = bpm > 0 ? bpm : 0
    this.bpmConfidence = Math.max(0, Math.min(1, confidence))
    if (offsetSec !== undefined) this.offsetSec = offsetSec
    this.prevBeatIndex = -1
  }

  setTimeSignature(sig: number): void {
    this.timeSignature = Math.max(1, Math.floor(sig))
  }

  setMarkers(beatMarkers: BeatMarkerMI[], downbeats: BeatMarkerMI[]): void {
    this.beatMarkers   = beatMarkers
    this.downbeats     = downbeats
    this.prevBeatIndex = -1
  }

  // ── Per-frame update ────────────────────────────────────────────────────────

  update(audioTime: number, isPlaying: boolean): BeatGridState {
    if (audioTime <= 0 && !isPlaying) {
      return { ...ZERO_STATE, bpm: this.bpm, bpmConfidence: this.bpmConfidence }
    }
    // bpm=0 means timing is unavailable — publish a static zero state so
    // consumers know not to use beat-phase values.
    if (this.bpm === 0) {
      return { ...ZERO_STATE, bpm: 0, bpmConfidence: 0 }
    }
    return this.beatMarkers.length >= 4
      ? this.updateFromMarkers(audioTime, isPlaying)
      : this.updateFromBpm(audioTime, isPlaying)
  }

  // ── BPM-grid path ──────────────────────────────────────────────────────────

  private updateFromBpm(audioTime: number, isPlaying: boolean): BeatGridState {
    const adj = audioTime - this.offsetSec
    if (adj < 0) return { ...ZERO_STATE, bpm: this.bpm, bpmConfidence: this.bpmConfidence }

    const beatDur   = 60 / this.bpm
    const rawIndex  = Math.floor(adj / beatDur)
    const beatPhase = (adj % beatDur) / beatDur

    // Fire beatHit exactly once per advancing beat index, never on seek/skip
    const beatHit = isPlaying && rawIndex === this.prevBeatIndex + 1
    if (rawIndex !== this.prevBeatIndex) this.prevBeatIndex = rawIndex

    const beatInBar   = rawIndex % this.timeSignature
    const barIndex    = Math.floor(rawIndex / this.timeSignature)
    const downbeatHit = beatHit && beatInBar === 0

    return this.buildState(rawIndex, beatPhase, beatHit, beatInBar, barIndex, downbeatHit)
  }

  // ── Beat-marker path ────────────────────────────────────────────────────────

  private updateFromMarkers(audioTime: number, isPlaying: boolean): BeatGridState {
    const markers = this.beatMarkers

    // Binary search: find last marker at or before audioTime
    let lo = 0, hi = markers.length - 1, idx = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (markers[mid].timeSec <= audioTime) { idx = mid; lo = mid + 1 }
      else hi = mid - 1
    }

    if (idx < 0) return this.updateFromBpm(audioTime, isPlaying)

    // Phase between current marker and next (or extrapolate from BPM past the last one)
    let beatPhase: number
    if (idx < markers.length - 1) {
      const span = markers[idx + 1].timeSec - markers[idx].timeSec
      beatPhase  = span > 0 ? (audioTime - markers[idx].timeSec) / span : 0
    } else {
      const beatDur = 60 / this.bpm
      beatPhase     = ((audioTime - markers[idx].timeSec) % beatDur) / beatDur
    }

    const rawIndex = idx
    const beatHit  = isPlaying && rawIndex === this.prevBeatIndex + 1
    if (rawIndex !== this.prevBeatIndex) this.prevBeatIndex = rawIndex

    const beatInBar = rawIndex % this.timeSignature
    const barIndex  = Math.floor(rawIndex / this.timeSignature)

    // Prefer explicit downbeat markers; fall back to bar position
    const downbeatHit = beatHit && (
      this.downbeats.length > 0
        ? this.downbeats.some(d => Math.abs(d.timeSec - markers[rawIndex].timeSec) < 0.06)
        : beatInBar === 0
    )

    return this.buildState(rawIndex, beatPhase, beatHit, beatInBar, barIndex, downbeatHit)
  }

  // ── Shared state builder ───────────────────────────────────────────────────

  private buildState(
    beatIndex:   number,
    beatPhase:   number,
    beatHit:     boolean,
    beatInBar:   number,
    barIndex:    number,
    downbeatHit: boolean,
  ): BeatGridState {
    const phrase4Progress  = (beatIndex % 4  + beatPhase) / 4
    const phrase8Progress  = (beatIndex % 8  + beatPhase) / 8
    const phrase16Progress = (beatIndex % 16 + beatPhase) / 16
    const phrase32Progress = (beatIndex % 32 + beatPhase) / 32

    const phrase4Hit  = beatHit && beatIndex % 4  === 0
    const phrase8Hit  = beatHit && beatIndex % 8  === 0
    const phrase16Hit = beatHit && beatIndex % 16 === 0
    const phrase32Hit = beatHit && beatIndex % 32 === 0

    return {
      bpm:              this.bpm,
      bpmConfidence:    this.bpmConfidence,
      beatPhase,
      beatHit,
      beatIndex,
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
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  reset(): void {
    this.prevBeatIndex = -1
  }
}
