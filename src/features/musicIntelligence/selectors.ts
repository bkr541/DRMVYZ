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

export function getModulationSourceValue(
  frame: MusicIntelligenceFrame,
  sourceKey: string,
): number {
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
    // Phrase progress
    case 'phrase4':   return frame.rhythm.phrase4Progress
    case 'phrase8':   return frame.rhythm.phrase8Progress
    case 'phrase16':  return frame.rhythm.phrase16Progress
    case 'phrase32':  return frame.rhythm.phrase32Progress
    // Energy
    case 'energy':        return frame.energy.instant
    case 'energyShort':   return frame.energy.shortTerm
    case 'energyLong':    return frame.energy.longTerm
    case 'spectralFlux':  return frame.energy.spectralFlux
    case 'tension':       return frame.energy.tension
    case 'complexity':    return frame.energy.complexity
    case 'buildProgress': return frame.energy.buildProgress
    case 'dropImpact':    return frame.energy.dropImpact
    // Section
    case 'sectionProgress': return frame.section.progress
    case 'sectionIntensity': return frame.section.intensity
    // Harmonic
    case 'pitchHz':      return frame.harmonic.pitchHz != null ? Math.min(1, frame.harmonic.pitchHz / 2000) : 0
    // Stems
    case 'stemVocals':      return frame.stems.vocals
    case 'stemDrums':       return frame.stems.drums
    case 'stemBass':        return frame.stems.bass
    case 'stemInstruments': return frame.stems.instruments
    default: return 0
  }
}

// ── Event / trigger source (returns boolean) ──────────────────────────────────

export function getTriggerSourceValue(
  frame: MusicIntelligenceFrame,
  sourceKey: string,
): boolean {
  switch (sourceKey) {
    case 'beat':      return frame.rhythm.beatHit
    case 'kick':      return frame.rhythm.kickHit
    case 'snare':     return frame.rhythm.snareHit
    case 'hat':       return frame.rhythm.hatHit
    case 'downbeat':  return frame.rhythm.downbeatHit
    case 'phrase4':   return frame.rhythm.phrase4Hit
    case 'phrase8':   return frame.rhythm.phrase8Hit
    case 'phrase16':  return frame.rhythm.phrase16Hit
    case 'phrase32':  return frame.rhythm.phrase32Hit
    default:          return false
  }
}

// ── Condition source (boolean predicate on section / state) ──────────────────

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
    case 'isHighEnergy': return frame.energy.instant > 0.6
    case 'isBeat':       return frame.rhythm.beatHit
    default:             return false
  }
}
