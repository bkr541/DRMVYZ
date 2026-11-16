// Sound Drawing XY › WIREFRAME: what the figure is told about the music. One read-only adapter turns the shared performance context (the same
// analysis every engine reads, never a second analyser) into the three things the figure needs: the features and hits that move it
// (WireReading), the musical position the director works from (WireCue), and an honest account of what is and is not known.
//
// Honesty rules, from the guide and the audit: a live microphone has no sections or phrases, so structure is null there and the director
// never invents any; a feature that is not a real measurement is marked unavailable instead of read as zero.

import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { Osc1Features } from './XyScopeOsc1Engine'
import { osc1StructureFromContext } from './XyScopeOsc1Performance'
import type { WireBoundaries, WireStructure } from './XyScopeWireDirector'
import { silentReading, type WireReading } from './XyScopeWireModulation'
import { NEUTRAL_MOOD, type WireMood } from './XyScopeWireConductor'

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))

export interface WireCue {
  bpm: number | null
  /** True when the tempo comes from a beat grid, not a guess. */
  bpmValid: boolean
  structure: WireStructure | null
  boundaries: WireBoundaries
  /** A drop began on this frame. */
  drop: boolean
  gridConfident: boolean
  trackIdentity: string | null
}

export function emptyWireCue(): WireCue {
  return { bpm: null, bpmValid: false, structure: null, boundaries: { section: false, phrase: false, bar4: false, bar8: false, id: '' }, drop: false, gridConfident: false, trackIdentity: null }
}

/** The musical position from this frame's context and the one before it (events are the differences between them). */
export function deriveWireCue(context: SharedPerformanceContext | null, previous: SharedPerformanceContext | null): WireCue {
  if (!context) return emptyWireCue()
  const structure = osc1StructureFromContext(context)
  const b = context.boundaries
  const phrase = previous != null && context.phraseIndex !== previous.phraseIndex
  const parts: string[] = []
  if (b.sectionEntry) parts.push(`section:${b.currentSectionId ?? context.sectionId ?? context.sectionIdentity}`)
  if (phrase) parts.push(`phrase:${context.phraseIndex}`)
  if (b.eightBarBoundary) parts.push(`bar8:${context.barIndex}`)
  if (b.fourBarBoundary) parts.push(`bar4:${context.barIndex}`)
  const gridConfidence = Math.max(context.confidence.grid, context.confidence.rhythm * .8)
  return {
    bpm: context.bpm > 0 ? context.bpm : null,
    bpmValid: context.capabilities.beatGrid && context.bpm > 0,
    structure: structure ? { confidence: structure.confidence, build: structure.build } : null,
    boundaries: { section: b.sectionEntry, phrase, bar4: b.fourBarBoundary, bar8: b.eightBarBoundary, id: parts.join('|') },
    drop: previous != null && context.dropOccurrence > previous.dropOccurrence,
    gridConfident: context.capabilities.beatGrid && gridConfidence >= .5,
    trackIdentity: context.trackIdentity,
  }
}

/**
 * The features and hits for one frame. Band energies come from the shared analysis when there is a context; the stereo analyser's features
 * are the fallback when there is not. `hits` are this frame's kick, snare and hat strengths (zero between hits).
 */
export function buildWireReading(
  context: SharedPerformanceContext | null,
  features: Osc1Features | null,
  hits: { kick: number; snare: number; hat: number },
  playing: boolean,
): WireReading {
  const reading = silentReading()
  if (!playing) return { ...reading, playing: false }
  if (context) {
    const n = context.intelligence.bands.normalized
    const caps = context.capabilities
    const bands = caps.liveBands
    return {
      features: {
        sub: clamp(n.normalizedSub), bass: clamp(n.normalizedBass), lowMid: clamp(n.normalizedLowMid), mid: clamp(n.normalizedMid),
        air: clamp(n.normalizedHigh * .6 + n.normalizedAir * .4), flux: clamp(context.spectralFlux), level: clamp(context.energy),
      },
      available: { sub: bands, bass: bands, lowMid: bands, mid: bands, air: bands, flux: caps.rhythmEvents, level: true },
      hits,
      confidence: clamp(Math.max(context.confidence.rhythm, context.confidence.overall)),
      playing: true,
    }
  }
  if (features) {
    return {
      features: { sub: 0, bass: clamp(features.bass), lowMid: 0, mid: clamp(features.mid), air: clamp(features.air), flux: clamp(features.flux), level: clamp(features.level) },
      available: { sub: false, bass: true, lowMid: false, mid: true, air: true, flux: true, level: true },
      hits: { kick: 0, snare: 0, hat: 0 }, confidence: .5, playing: true,
    }
  }
  return reading
}

const KEY_INDEX: Readonly<Record<string, number>> = Object.freeze({ C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 })

/**
 * Everything the music says about how the figure should feel right now, from all the audio intelligence there is: the shared analysis
 * (track-relative energy, tension, build, drop impact, complexity, spectral flux, band balance, the section and phrase the track is in,
 * the key and mode, the tempo) or, with no analysis, only what the live signal itself shows. A microphone carries no sections, phrases
 * or key, so those fields are absent there and the conductor never pretends otherwise.
 */
export function deriveWireMood(context: SharedPerformanceContext | null, features: Osc1Features | null, playing: boolean): WireMood {
  if (!playing) return { ...NEUTRAL_MOOD }
  if (context) {
    const n = context.intelligence.bands.normalized
    const harmonic = context.intelligence.harmonic
    const caps = context.capabilities
    const structured = caps.sections && context.sectionType != null && context.sectionType !== 'unknown'
    const lowEnd = clamp(n.normalizedSub * .5 + n.normalizedBass * .5), highEnd = clamp(n.normalizedHigh * .5 + n.normalizedAir * .5)
    const keyConfident = harmonic.key != null && harmonic.keyConfidence >= .4
    return {
      energy: clamp(caps.sections || caps.liveBands ? context.trackRelativeEnergy : context.energy),
      level: clamp(context.energy),
      tension: clamp(context.tension), build: clamp(context.buildProgress), drop: clamp(context.dropImpact), complexity: clamp(context.complexity),
      flux: clamp(context.spectralFlux),
      brightness: clamp(.5 + (highEnd - lowEnd) * .8),
      tempo: context.bpm > 0 && caps.beatGrid ? context.bpm : null,
      keyIndex: keyConfident ? (KEY_INDEX[harmonic.key!] ?? null) : null, minor: keyConfident ? harmonic.mode === 'minor' : null,
      sectionType: structured ? context.sectionType : null,
      sectionProgress: structured ? clamp(context.sectionProgress) : 0,
      phraseIndex: structured || caps.beatGrid ? context.phraseIndex : 0,
      phraseProgress: structured || caps.beatGrid ? clamp(context.phraseProgress) : 0,
      structured, confidence: clamp(Math.max(context.confidence.overall, context.confidence.rhythm)),
    }
  }
  if (features) {
    return {
      ...NEUTRAL_MOOD,
      energy: clamp(features.level), level: clamp(features.level), flux: clamp(features.flux), tension: clamp(features.flux * .6 + features.air * .4),
      brightness: clamp(.5 + (features.air - features.bass) * .5), complexity: clamp(features.flux), confidence: .4,
    }
  }
  return { ...NEUTRAL_MOOD }
}
