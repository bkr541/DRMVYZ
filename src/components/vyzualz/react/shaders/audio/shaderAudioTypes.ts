import type {
  MelodyContourLabel,
  MoodLabel,
  ReactSectionType,
  SectionSource,
  TextureLabel,
} from '../../../../../features/musicIntelligence/types'

// ── Scalar audio uniform frame ────────────────────────────────────────────────
//
// Values in this frame are finite and normalized to 0..1. Hit values are
// short decaying envelopes rather than one-frame booleans.

export interface ShaderAudioUniformFrame {
  sub: number
  bass: number
  lowMid: number
  mid: number
  highMid: number
  high: number
  air: number

  kick: number
  snare: number
  hat: number

  kickHit: number
  snareHit: number
  hatHit: number
  beatHit: number
  downbeatHit: number

  energy: number
  spectralCentroid: number
  spectralFlux: number
  spectralSpread: number
  spectralFlatness: number

  tension: number
  buildProgress: number
  dropImpact: number
}

// ── Timing uniform frame ──────────────────────────────────────────────────────

export interface ShaderTimingUniformFrame {
  time: number
  deltaTime: number
  playbackTime: number
  playbackProgress: number

  beatPhase: number
  barPhase: number
  phrasePhase: number // backward-compatible alias for phrase8Progress
  phrase4Progress: number
  phrase8Progress: number
  phrase16Progress: number
  phrase32Progress: number
  sectionPhase: number

  beatIndex: number
  beatInBar: number
  barIndex: number

  phrase4Hit: number
  phrase8Hit: number
  phrase16Hit: number
  phrase32Hit: number

  sectionType: number
  sectionStartPulse: number
  sectionChangePulse: number
}

// ── Extended canonical Music Intelligence frame ──────────────────────────────
//
// This frame exposes the rest of the canonical MI contract without forcing
// strings into GLSL. Continuous values are normalized unless their name states
// otherwise. Codes and indices are stable non-negative integers uploaded as
// floats for broad shader compatibility.

export interface ShaderMusicUniformFrame {
  // Raw bands and amplitude
  rawSub: number
  rawBass: number
  rawLowMid: number
  rawMid: number
  rawHigh: number
  rawAir: number
  volume: number
  rms: number
  peak: number
  crestFactor: number // normalized from the canonical 0..20 practical range

  // Rhythm
  bpm: number
  bpmConfidence: number
  transient: number
  transientConfidence: number

  // Energy
  energyShort: number
  energyLong: number
  energyDelta: number // signed, clamped to -1..1
  energyPercentile: number
  complexity: number
  spectralRolloff: number
  trackEnergy: number

  // Section
  sectionIntensity: number
  sectionConfidence: number
  sectionSource: number

  // Harmonic
  keyCode: number
  modeCode: number
  keyConfidence: number
  chordCode: number
  chordConfidence: number
  chordChangeHit: number
  rootNoteCode: number
  pitchHz: number
  pitchNormalized: number
  melodyContourCode: number

  // Stems
  vocalEnergy: number
  drumEnergy: number
  bassStemEnergy: number
  instrumentEnergy: number
  otherStemEnergy: number
  vocalActivity: number
  drumStemTransient: number
  bassStemTransient: number

  // Lyrics
  lyricActivity: number
  lyricLineProgress: number
  lyricWordProgress: number
  lyricWordHit: number
  lyricLineEnter: number
  lyricLineExit: number
  lyricGap: number
  lyricPhraseConfidence: number

  // Semantic intelligence
  buildConfidence: number
  dropConfidence: number
  fakeoutConfidence: number
  vocalHookConfidence: number
  moodCode: number
  textureCode: number

  // Capability gates
  hasLiveBands: number
  hasRhythmEvents: number
  hasBeatGrid: number
  hasSections: number
  hasTrackEnergyCurve: number
  hasStems: number
  hasLyrics: number
  hasHarmonics: number
  hasSemantics: number

  // Confidence gates
  overallConfidence: number
  rhythmConfidence: number
  harmonicConfidence: number
}

// ── Stable string encodings ───────────────────────────────────────────────────

export const SECTION_TYPE_CODES: Readonly<Record<string, number>> = Object.freeze({
  intro: 1,
  verse: 2,
  build: 3,
  preDrop: 4,
  drop: 5,
  breakdown: 6,
  bridge: 7,
  outro: 8,
  unknown: 9,
})

export const SECTION_SOURCE_CODES: Readonly<Record<SectionSource, number>> = Object.freeze({
  manual: 1,
  analysis: 2,
  inferred: 3,
  rekordbox: 4,
})

export const MELODY_CONTOUR_CODES: Readonly<Record<MelodyContourLabel, number>> = Object.freeze({
  ascending: 1,
  descending: 2,
  arch: 3,
  'inverted-arch': 4,
  flat: 5,
  jagged: 6,
})

export const MOOD_CODES: Readonly<Record<MoodLabel, number>> = Object.freeze({
  energetic: 1,
  aggressive: 2,
  atmospheric: 3,
  emotional: 4,
  bright: 5,
  dark: 6,
  chaotic: 7,
  minimal: 8,
  calm: 9,
  euphoric: 10,
  melancholic: 11,
  tension: 12,
  release: 13,
  neutral: 14,
})

export const TEXTURE_CODES: Readonly<Record<TextureLabel, number>> = Object.freeze({
  sparse: 1,
  dense: 2,
  building: 3,
  falling: 4,
  sustained: 5,
})

const PITCH_CLASS_CODES: Readonly<Record<string, number>> = Object.freeze({
  C: 1,
  'C#': 2,
  Db: 2,
  D: 3,
  'D#': 4,
  Eb: 4,
  E: 5,
  F: 6,
  'F#': 7,
  Gb: 7,
  G: 8,
  'G#': 9,
  Ab: 9,
  A: 10,
  'A#': 11,
  Bb: 11,
  B: 12,
})

const CHORD_QUALITY_CODES: Readonly<Record<string, number>> = Object.freeze({
  major: 1,
  minor: 2,
  diminished: 3,
  augmented: 4,
  sus2: 5,
  sus4: 6,
  dominant7: 7,
  major7: 8,
  minor7: 9,
  other: 15,
})

export function encodeSectionType(type: ReactSectionType | null): number {
  return type === null ? 0 : (SECTION_TYPE_CODES[type] ?? 0)
}

export function encodeSectionSource(source: SectionSource | null | undefined): number {
  return source ? (SECTION_SOURCE_CODES[source] ?? 0) : 0
}

export function encodeMode(mode: 'major' | 'minor' | null): number {
  if (mode === 'major') return 1
  if (mode === 'minor') return 2
  return 0
}

export function encodePitchClass(value: string | null | undefined): number {
  if (!value) return 0
  const match = value.trim().match(/^([A-Ga-g])([#b]?)/)
  if (!match) return 0
  const pitchClass = `${match[1].toUpperCase()}${match[2] ?? ''}`
  return PITCH_CLASS_CODES[pitchClass] ?? 0
}

/**
 * Stable chord code: pitch-class * 16 + quality. Zero means unavailable.
 * This keeps the root and broad quality independently recoverable in GLSL.
 */
export function encodeChord(chord: string | null | undefined): number {
  const root = encodePitchClass(chord)
  if (!root || !chord) return 0
  const suffix = chord.trim().replace(/^([A-Ga-g])([#b]?)/, '').toLowerCase()
  let quality = CHORD_QUALITY_CODES.other
  if (/maj7/.test(suffix)) quality = CHORD_QUALITY_CODES.major7
  else if (/m7|min7/.test(suffix)) quality = CHORD_QUALITY_CODES.minor7
  else if (/dim|°/.test(suffix)) quality = CHORD_QUALITY_CODES.diminished
  else if (/aug|\+/.test(suffix)) quality = CHORD_QUALITY_CODES.augmented
  else if (/sus2/.test(suffix)) quality = CHORD_QUALITY_CODES.sus2
  else if (/sus4|sus/.test(suffix)) quality = CHORD_QUALITY_CODES.sus4
  else if (/^7/.test(suffix)) quality = CHORD_QUALITY_CODES.dominant7
  else if (/^m|min/.test(suffix)) quality = CHORD_QUALITY_CODES.minor
  else if (suffix === '' || /^maj/.test(suffix)) quality = CHORD_QUALITY_CODES.major
  return root * 16 + quality
}

export function encodeMelodyContour(value: MelodyContourLabel | null): number {
  return value ? (MELODY_CONTOUR_CODES[value] ?? 0) : 0
}

export function encodeMood(value: MoodLabel | null): number {
  return value ? (MOOD_CODES[value] ?? 0) : 0
}

export function encodeTexture(value: TextureLabel | null): number {
  return value ? (TEXTURE_CODES[value] ?? 0) : 0
}

// ── Safe neutral frames ───────────────────────────────────────────────────────

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
  beatPhase: 0, barPhase: 0, phrasePhase: 0,
  phrase4Progress: 0, phrase8Progress: 0, phrase16Progress: 0, phrase32Progress: 0,
  sectionPhase: 0,
  beatIndex: 0, beatInBar: 0, barIndex: 0,
  phrase4Hit: 0, phrase8Hit: 0, phrase16Hit: 0, phrase32Hit: 0,
  sectionType: 0, sectionStartPulse: 0, sectionChangePulse: 0,
})

export const NEUTRAL_MUSIC_FRAME: Readonly<ShaderMusicUniformFrame> = Object.freeze({
  rawSub: 0, rawBass: 0, rawLowMid: 0, rawMid: 0, rawHigh: 0, rawAir: 0,
  volume: 0, rms: 0, peak: 0, crestFactor: 0,
  bpm: 0, bpmConfidence: 0, transient: 0, transientConfidence: 0,
  energyShort: 0, energyLong: 0, energyDelta: 0, energyPercentile: 0,
  complexity: 0, spectralRolloff: 0, trackEnergy: 0,
  sectionIntensity: 0, sectionConfidence: 0, sectionSource: 0,
  keyCode: 0, modeCode: 0, keyConfidence: 0, chordCode: 0, chordConfidence: 0,
  chordChangeHit: 0, rootNoteCode: 0, pitchHz: 0, pitchNormalized: 0,
  melodyContourCode: 0,
  vocalEnergy: 0, drumEnergy: 0, bassStemEnergy: 0, instrumentEnergy: 0,
  otherStemEnergy: 0, vocalActivity: 0, drumStemTransient: 0, bassStemTransient: 0,
  lyricActivity: 0, lyricLineProgress: 0, lyricWordProgress: 0, lyricWordHit: 0,
  lyricLineEnter: 0, lyricLineExit: 0, lyricGap: 0, lyricPhraseConfidence: 0,
  buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0,
  vocalHookConfidence: 0, moodCode: 0, textureCode: 0,
  hasLiveBands: 0, hasRhythmEvents: 0, hasBeatGrid: 0, hasSections: 0,
  hasTrackEnergyCurve: 0, hasStems: 0, hasLyrics: 0, hasHarmonics: 0,
  hasSemantics: 0,
  overallConfidence: 0, rhythmConfidence: 0, harmonicConfidence: 0,
})
