// Read-only helpers for extracting data from a MusicIntelligenceFrame.
// All functions are pure — no state, no imports with side effects.

import type { MusicIntelligenceFrame, MIBands, MIRhythm, MIEnergy, MISection } from './types'
import type { AudioBandValues } from '../../lib/audioModulation'

// ── Frame sub-object accessors ────────────────────────────────────────────────

export function selectBands(frame: MusicIntelligenceFrame): MIBands {
  return frame.bands
}

export function selectRhythm(frame: MusicIntelligenceFrame): MIRhythm {
  return frame.rhythm
}

export function selectEnergy(frame: MusicIntelligenceFrame): MIEnergy {
  return frame.energy
}

export function selectCurrentSection(frame: MusicIntelligenceFrame): MISection {
  return frame.section
}

// ── Compatibility bridge ──────────────────────────────────────────────────────

/**
 * Convert MusicIntelligenceFrame bands to the AudioBandValues shape used by
 * the existing audioModulation.ts routes.  Lets future code read from the MI
 * frame rather than re-extracting from a raw FFT buffer.
 */
export function miFrameToAudioBandValues(frame: MusicIntelligenceFrame): AudioBandValues {
  return {
    bass:   frame.bands.bass,
    lowMid: frame.bands.lowMid,
    mid:    frame.bands.mid,
    high:   frame.bands.high,
    volume: frame.bands.volume,
    // beat: decay from 1 at hit, fall through transient otherwise
    beat: frame.rhythm.beatHit
      ? 1
      : Math.max(0, frame.rhythm.transient * (1 - frame.rhythm.beatPhase)),
  }
}

// ── Continuous modulation source (returns 0–1 float) ─────────────────────────

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function canonicalSectionType(type: string | null | undefined): string {
  switch (type) {
    case 'break': return 'breakdown'
    case 'preDrop': return 'build'
    case 'bridge': return 'verse'
    default: return type ?? 'unknown'
  }
}

function parseSectionSourceList(sourceKey: string): string[] {
  return sourceKey
    .slice('section:'.length)
    .split(',')
    .map(part => canonicalSectionType(part.trim()))
    .filter(Boolean)
}

function getSectionGateValue(frame: MusicIntelligenceFrame, sourceKey: string): number {
  const allowed = parseSectionSourceList(sourceKey)
  if (allowed.length === 0) return 0
  const current = canonicalSectionType(frame.section.type)
  if (!allowed.includes(current)) return 0
  const intensity = frame.section.intensity
  const confidence = frame.section.confidence
  const gate = Math.max(
    Number.isFinite(intensity) ? intensity : 0,
    Number.isFinite(confidence) ? confidence : 0,
    1,
  )
  return clamp01(gate)
}

export function getModulationSourceValue(
  frame: MusicIntelligenceFrame,
  sourceKey: string,
): number {
  if (sourceKey.startsWith('section:')) return getSectionGateValue(frame, sourceKey)
  if (sourceKey.startsWith('audioBand:')) return getModulationSourceValue(frame, sourceKey.slice('audioBand:'.length))

  switch (sourceKey) {
    // Band energies
    case 'sub':     return frame.bands.sub
    case 'bass':    return frame.bands.bass
    case 'lowMid':  return frame.bands.lowMid
    case 'mid':     return frame.bands.mid
    case 'high':    return frame.bands.high
    case 'air':     return frame.bands.air
    case 'volume':  return frame.bands.volume
    // Normalized band energies
    case 'nSub':    return frame.bands.normalizedSub
    case 'nBass':   return frame.bands.normalizedBass
    case 'nLowMid': return frame.bands.normalizedLowMid
    case 'nMid':    return frame.bands.normalizedMid
    case 'nHigh':   return frame.bands.normalizedHigh
    case 'nAir':    return frame.bands.normalizedAir
    // Beat / rhythm
    case 'beat':      return frame.rhythm.beatHit ? 1 : frame.rhythm.transient
    case 'beatPhase': return frame.rhythm.beatPhase
    case 'kick':      return frame.rhythm.kickStrength
    case 'snare':     return frame.rhythm.snareStrength
    case 'hat':       return frame.rhythm.hatStrength
    case 'transient': return frame.rhythm.transient
    case 'bpm': return Math.max(0, Math.min(1, (frame.rhythm.bpm - 40) / 200))
    case 'bpmConfidence': return frame.rhythm.bpmConfidence
    case 'transientConfidence': return frame.rhythm.transientConfidence
    // Phrase progress
    case 'phrase4':   return frame.rhythm.phrase4Progress
    case 'phrase8':   return frame.rhythm.phrase8Progress
    case 'phrase16':  return frame.rhythm.phrase16Progress
    case 'phrase32':  return frame.rhythm.phrase32Progress
    // Energy (Layer 4)
    case 'energy':        return frame.energy.instant
    case 'energyShort':   return frame.energy.shortTerm
    case 'energyLong':    return frame.energy.longTerm
    case 'spectralFlux':  return frame.energy.spectralFlux
    case 'tension':       return frame.energy.tension
    case 'complexity':    return frame.energy.complexity
    case 'buildProgress': return frame.energy.buildProgress
    case 'dropImpact':    return frame.energy.dropImpact
    case 'rms':           return frame.energy.rms
    case 'peak':          return frame.energy.peak
    case 'crestFactor':   return Math.min(1, frame.energy.crestFactor / 20)  // 0–20 → 0–1
    case 'percentile':    return frame.energy.percentile
    case 'delta':         return Math.max(0, Math.min(1, frame.energy.delta + 0.5))  // center around 0.5
    // Meyda spectral features (0–1 normalized)
    case 'spectralCentroid':  return frame.energy.spectralCentroid
    case 'spectralSpread':    return frame.energy.spectralSpread
    case 'spectralRolloff':   return frame.energy.spectralRolloff
    case 'spectralFlatness':  return frame.energy.spectralFlatness
    case 'trackEnergy':       return frame.energy.trackCurve ?? 0
    // Section
    case 'sectionProgress':   return frame.section.progress
    case 'sectionIntensity':  return frame.section.intensity
    case 'sectionConfidence': return frame.section.confidence
    // Harmonic
    case 'pitchHz':          return frame.harmonic.pitchHz != null ? Math.min(1, frame.harmonic.pitchHz / 2000) : 0
    case 'melodyHeight':     return frame.harmonic.pitchHz != null ? Math.min(1, Math.max(0, (frame.harmonic.pitchHz - 50) / 1950)) : 0
    case 'keyConfidence':       return frame.harmonic.keyConfidence
    case 'chordConfidence':     return frame.harmonic.chordConfidence
    // Backward-compat alias (older routes and LaserDMX mod matrix may use this key)
    case 'harmonicConfidence':  return Math.max(frame.confidence.harmonic, frame.harmonic.keyConfidence, frame.harmonic.chordConfidence)
    // Stems
    case 'stemVocals':       return frame.stems.vocals
    case 'stemDrums':        return frame.stems.drums
    case 'stemBass':         return frame.stems.bassStemEnergy
    case 'stemInstruments':  return frame.stems.instrumentEnergy
    case 'vocalEnergy':      return frame.stems.vocalEnergy
    case 'drumEnergy':       return frame.stems.drumEnergy
    case 'bassStemEnergy':   return frame.stems.bassStemEnergy
    case 'instrumentEnergy': return frame.stems.instrumentEnergy
    case 'otherStemEnergy':  return frame.stems.otherStemEnergy
    case 'vocalActivity':    return frame.stems.vocalActivity
    // Lyrics
    case 'lyricActivity':    return frame.lyrics.vocalActivity
    case 'lyricLineProgress':return frame.lyrics.lyricLineProgress
    case 'phraseConfidence': return frame.lyrics.phraseConfidence
    case 'lyricWordProgress':return frame.lyrics.wordProgress ?? 0
    // Semantics
    case 'buildConfidence':     return frame.semantics.buildConfidence
    case 'dropConfidence':      return frame.semantics.dropConfidence
    case 'fakeoutConfidence':   return frame.semantics.fakeoutConfidence
    case 'vocalHookConfidence': return frame.semantics.vocalHookConfidence
    case 'overallConfidence':  return frame.confidence.overall
    case 'rhythmConfidence':   return frame.confidence.rhythm
    case 'hasLiveBands':       return frame.capabilities?.liveBands ? 1 : 0
    case 'hasRhythmEvents':    return frame.capabilities?.rhythmEvents ? 1 : 0
    case 'hasBeatGrid':        return frame.capabilities?.beatGrid ? 1 : 0
    case 'hasSections':        return frame.capabilities?.sections ? 1 : 0
    case 'hasTrackEnergyCurve':return frame.capabilities?.trackEnergyCurve ? 1 : 0
    case 'hasStems':           return frame.capabilities?.stemCurves ? 1 : 0
    case 'hasLyrics':          return frame.capabilities?.lyrics ? 1 : 0
    default: return 0
  }
}

// ── Event / trigger source (returns boolean) ──────────────────────────────────

export function getTriggerSourceValue(
  frame: MusicIntelligenceFrame,
  sourceKey: string,
): boolean {
  switch (sourceKey) {
    // Primary names
    case 'beat':       return frame.rhythm.beatHit
    case 'kick':       return frame.rhythm.kickHit
    case 'snare':      return frame.rhythm.snareHit
    case 'hat':        return frame.rhythm.hatHit
    case 'downbeat':   return frame.rhythm.downbeatHit
    case 'dropImpact': return frame.energy.dropImpact > 0
    case 'phrase4':    return frame.rhythm.phrase4Hit
    case 'phrase8':    return frame.rhythm.phrase8Hit
    case 'phrase16':   return frame.rhythm.phrase16Hit
    case 'phrase32':   return frame.rhythm.phrase32Hit
    case 'chordChange':return frame.harmonic.chordChanged
    case 'wordHit':    return frame.lyrics.wordHit
    case 'lineEnter':  return frame.lyrics.lineEnter === true
    case 'lineExit':   return frame.lyrics.lineExit === true
    case 'drumTrans':  return frame.stems.drumTransient
    case 'bassTrans':  return frame.stems.bassStemTransient
    // Explicit Hit aliases (Beam Matrix reaction groups use these)
    case 'beatHit':      return frame.rhythm.beatHit
    case 'kickHit':      return frame.rhythm.kickHit
    case 'snareHit':     return frame.rhythm.snareHit
    case 'hatHit':       return frame.rhythm.hatHit
    case 'downbeatHit':  return frame.rhythm.downbeatHit
    case 'phrase4Hit':   return frame.rhythm.phrase4Hit
    case 'phrase8Hit':   return frame.rhythm.phrase8Hit
    case 'phrase16Hit':  return frame.rhythm.phrase16Hit
    case 'phrase32Hit':  return frame.rhythm.phrase32Hit
    default:             return false
  }
}

// ── Condition source (boolean predicate on section / state) ──────────────────

const CONDITION_SOURCE_KEYS = new Set([
  'isActive', 'isDrop', 'isBuild', 'isVerse', 'isIntro', 'isOutro', 'isBreakdown', 'isPreDrop', 'isBridge', 'isUnknown',
  'isHighEnergy', 'isBeat', 'isMajor', 'isMinor', 'isChordChange', 'hasActiveLine', 'hasActiveWord', 'lyricGap',
  'hasLiveBands', 'hasRhythmEvents', 'hasBeatGrid', 'hasSections', 'hasTrackEnergyCurve', 'hasStems', 'hasLyrics',
  'isBuildPhase', 'isDropPhase', 'isFakeout', 'isVocalHook', 'isEnergetic', 'isAggressive', 'isAtmospheric', 'isDark', 'isCalm',
])

export function isMusicIntelligenceConditionSource(sourceKey: string): boolean {
  return CONDITION_SOURCE_KEYS.has(sourceKey)
}

export function getConditionSourceValue(
  frame: MusicIntelligenceFrame,
  sourceKey: string,
): boolean {
  switch (sourceKey) {
    case 'isActive':    return frame.frameId > 0
    case 'isDrop':      return frame.section.type === 'drop'
    case 'isBuild':     return frame.section.type === 'build'
    case 'isVerse':     return frame.section.type === 'verse'
    case 'isIntro':     return frame.section.type === 'intro'
    case 'isOutro':     return frame.section.type === 'outro'
    case 'isBreakdown': return frame.section.type === 'breakdown'
    case 'isPreDrop':    return frame.section.type === 'preDrop'
    case 'isBridge':     return frame.section.type === 'bridge'
    case 'isUnknown':    return frame.section.type === 'unknown'
    case 'isHighEnergy': return frame.energy.instant > 0.6
    case 'isBeat':       return frame.rhythm.beatHit
    // Harmonic conditions
    case 'isMajor':      return frame.harmonic.mode === 'major'
    case 'isMinor':      return frame.harmonic.mode === 'minor'
    case 'isChordChange':return frame.harmonic.chordChanged
    // Lyric conditions
    case 'hasActiveLine':return frame.lyrics.activeLine !== null
    case 'hasActiveWord':return frame.lyrics.activeWord !== null
    case 'lyricGap':     return frame.lyrics.isGap === true
    case 'hasLiveBands': return frame.capabilities?.liveBands === true
    case 'hasRhythmEvents': return frame.capabilities?.rhythmEvents === true
    case 'hasBeatGrid':  return frame.capabilities?.beatGrid === true
    case 'hasSections':  return frame.capabilities?.sections === true
    case 'hasTrackEnergyCurve': return frame.capabilities?.trackEnergyCurve === true
    case 'hasStems':     return frame.capabilities?.stemCurves === true
    case 'hasLyrics':    return frame.capabilities?.lyrics === true
    // Semantic conditions
    case 'isBuildPhase': return frame.semantics.buildConfidence > 0.5
    case 'isDropPhase':  return frame.semantics.dropConfidence > 0.5
    case 'isFakeout':    return frame.semantics.fakeoutConfidence > 0.5
    case 'isVocalHook':  return frame.semantics.vocalHookConfidence > 0.5
    // Mood conditions
    case 'isEnergetic':  return frame.semantics.mood === 'energetic'
    case 'isAggressive': return frame.semantics.mood === 'aggressive'
    case 'isAtmospheric':return frame.semantics.mood === 'atmospheric'
    case 'isDark':       return frame.semantics.mood === 'dark'
    case 'isCalm':       return frame.semantics.mood === 'calm'
    default:             return false
  }
}

export type MusicIntelligenceSourceValue = number | boolean | string | null

/**
 * Canonical heterogeneous source lookup for authored condition expressions.
 * Numeric routes continue through getModulationSourceValue, boolean predicates
 * continue through getConditionSourceValue, and categorical values are read
 * directly from the already-populated Music Intelligence frame.
 */
export function getMusicIntelligenceSourceValue(
  frame: MusicIntelligenceFrame,
  sourceKey: string,
): MusicIntelligenceSourceValue {
  if (isMusicIntelligenceConditionSource(sourceKey)) {
    return getConditionSourceValue(frame, sourceKey)
  }
  switch (sourceKey) {
    case 'sectionType': return frame.section.type ?? 'unknown'
    case 'key':
    case 'harmonicKey': return frame.harmonic.key
    case 'mode':
    case 'harmonicMode': return frame.harmonic.mode
    case 'chord': return frame.harmonic.chord
    case 'rootNote': return frame.harmonic.rootNote
    case 'note': return frame.harmonic.note
    case 'melodyContour': return frame.harmonic.melodyContour
    case 'mood': return frame.semantics.mood
    case 'texture': return frame.semantics.texture
    default: return getModulationSourceValue(frame, sourceKey)
  }
}
