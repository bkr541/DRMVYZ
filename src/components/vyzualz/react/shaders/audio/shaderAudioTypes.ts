import type { ReactSectionType } from '../../../../../features/musicIntelligence/types'

// ── Scalar audio uniform frame ────────────────────────────────────────────────
//
// All values are guaranteed finite and in 0..1 (triggers decay from 1 toward 0).
// The bridge enforces this invariant — no NaN or Infinity ever reaches GLSL.

export interface ShaderAudioUniformFrame {
  // ── Spectral bands (0–1, MI normalizedBand) ──────────────────────────────
  sub:     number  // MIBands.normalizedSub    (20–60 Hz)
  bass:    number  // MIBands.normalizedBass   (60–250 Hz)
  lowMid:  number  // MIBands.normalizedLowMid (250–1000 Hz)
  mid:     number  // MIBands.normalizedMid    (1000–4000 Hz)
  // highMid is derived: average of normalizedMid and normalizedHigh.
  // MIBands has no separate highMid band — its 6 bands are sub/bass/lowMid/mid/high/air.
  // The GLSL band sequence (sub→air) maps: MIBands.high → uHighMid, MIBands.air → uHigh,
  // and uAir aliases uHigh for GLSL authors who prefer the "air" name.
  highMid: number  // derived: (normalizedMid + normalizedHigh) * 0.5
  high:    number  // MIBands.normalizedHigh   (4000–8000 Hz)
  air:     number  // MIBands.normalizedAir    (8000–20 kHz)

  // ── Instrument-class energies (0–1, smoothed) ────────────────────────────
  kick:  number  // MIRhythm.kickStrength  (smoothed)
  snare: number  // MIRhythm.snareStrength (smoothed)
  hat:   number  // MIRhythm.hatStrength   (smoothed)

  // ── Hit triggers (decaying envelope 1→0; fires on each onset) ───────────
  kickHit:    number  // MIRhythm.kickHit
  snareHit:   number  // MIRhythm.snareHit
  hatHit:     number  // MIRhythm.hatHit
  beatHit:    number  // MIRhythm.beatHit
  downbeatHit: number // MIRhythm.downbeatHit (beatHit && beatInBar === 0)

  // ── Energy and spectral features (0–1) ──────────────────────────────────
  energy:          number  // MIEnergy.instant
  spectralCentroid: number  // MIEnergy.spectralCentroid
  spectralFlux:     number  // MIEnergy.spectralFlux
  spectralSpread:   number  // MIEnergy.spectralSpread
  spectralFlatness: number  // MIEnergy.spectralFlatness

  // ── Musical tension and progression (0–1) ───────────────────────────────
  tension:       number  // MIEnergy.tension       (spectral flux + energy delta)
  buildProgress: number  // MIEnergy.buildProgress (energy rise above long-term avg)
  dropImpact:    number  // MIEnergy.dropImpact    (burst when energy drops below avg)
}

// ── Timing uniform frame ──────────────────────────────────────────────────────

export interface ShaderTimingUniformFrame {
  // ── Wall-clock and runtime time ──────────────────────────────────────────
  time:      number  // seconds since ShaderWebGLRuntime creation
  deltaTime: number  // seconds since last frame (FrameState.deltaTime)

  // ── Playback position ────────────────────────────────────────────────────
  playbackTime:     number  // audio time in seconds (ReactFrameContext.audioTime)
  playbackProgress: number  // 0–1 through the track; 0 when duration is unknown

  // ── Beat-grid phases (all 0–1) ───────────────────────────────────────────
  beatPhase:   number  // 0–1 within current beat (MIRhythm.beatPhase)
  // Smooth 0–1 through a 4-beat bar: (beatInBar + beatPhase) / 4
  barPhase:    number
  phrasePhase: number  // 0–1 through 8-beat phrase (MIRhythm.phrase8Progress)
  sectionPhase: number  // 0–1 through the current section (MISection.progress)

  // ── Beat and bar indices (integers exposed as floats for GLSL compat) ───
  beatIndex: number  // MIRhythm.beatIndex (monotonically increasing)
  barIndex:  number  // MIRhythm.barIndex  (monotonically increasing)

  // ── Section metadata ─────────────────────────────────────────────────────
  // Stable integer code: 0=none, 1=intro, 2=verse, 3=build, 4=drop, 5=breakdown, 6=outro
  sectionType:        number
  // 1.0 on the first frame of a section, else 0.0.
  sectionStartPulse:  number
  // 1.0 when the section changed this frame (same as sectionStartPulse; both names
  // are exposed so GLSL authors may use whichever is more readable for their intent).
  sectionChangePulse: number
}

// ── Section-type integer encoding ─────────────────────────────────────────────
//
// This mapping is stable across builds. Do not reorder or reassign values —
// any GLSL shader that encodes section behavior (e.g. `if (uSectionType == 4.0)`)
// depends on these codes remaining constant.

export const SECTION_TYPE_CODES: Readonly<Record<string, number>> = Object.freeze({
  intro:     1,
  verse:     2,
  build:     3,
  drop:      4,
  breakdown: 5,
  outro:     6,
})

export function encodeSectionType(type: ReactSectionType | null): number {
  if (type === null) return 0
  return SECTION_TYPE_CODES[type] ?? 0
}

// ── Safe neutral frames ───────────────────────────────────────────────────────
//
// Used as the initial state and when no audio is playing.
// spectralCentroid / spectralSpread / spectralFlatness are set to 0 (not 0.5)
// because MI produces 0 when Meyda is not running.

export const NEUTRAL_AUDIO_FRAME: Readonly<ShaderAudioUniformFrame> = Object.freeze({
  sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, air: 0,
  kick: 0, snare: 0, hat: 0,
  kickHit: 0, snareHit: 0, hatHit: 0, beatHit: 0, downbeatHit: 0,
  energy: 0,
  spectralCentroid: 0, spectralFlux: 0, spectralSpread: 0, spectralFlatness: 0,
  tension: 0, buildProgress: 0, dropImpact: 0,
})

export const NEUTRAL_TIMING_FRAME: Readonly<ShaderTimingUniformFrame> = Object.freeze({
  time: 0, deltaTime: 0, playbackTime: 0, playbackProgress: 0,
  beatPhase: 0, barPhase: 0, phrasePhase: 0, sectionPhase: 0,
  beatIndex: 0, barIndex: 0,
  sectionType: 0, sectionStartPulse: 0, sectionChangePulse: 0,
})
