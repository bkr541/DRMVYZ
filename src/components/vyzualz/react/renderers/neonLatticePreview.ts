import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import type { ReactSectionType } from '../ReactTypes'

const PREVIEW_BEAT_INDEXES = [0, 1, 4, 8, 12, 16, 20, 24, 32] as const

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

/**
 * Deterministic preview-only Music Intelligence source.
 *
 * This is deliberately not an analyzer. It supplies a compact authored event
 * reel so thumbnails can demonstrate the same canonical beat, transient,
 * build, drop, section, and phrase contracts consumed by the live renderer.
 */
export function createNeonLatticeSyntheticPreviewFrame(input: {
  index: number
  frameBudget: number
  timeSec: number
  bpm: number
  requestedSectionType: ReactSectionType | null
  presetId: string
}): MusicIntelligenceFrame {
  const index = Math.max(0, Math.min(PREVIEW_BEAT_INDEXES.length - 1, Math.round(input.index)))
  const beatIndex = PREVIEW_BEAT_INDEXES[index]
  const progress = input.frameBudget <= 1 ? 1 : index / Math.max(1, input.frameBudget - 1)
  const buildProgress = index === 4 ? 0.24 : index === 5 ? 0.82 : index > 5 ? 1 : 0.05
  const dropImpact = index === 6 ? 0.96 : 0
  const sectionType: ReactSectionType = index >= 6
    ? 'drop'
    : index >= 4
      ? 'build'
      : input.requestedSectionType ?? 'verse'
  const beatHit = index !== 4
  const downbeatHit = index === 0 || index === 3 || index === 6 || index === 8
  const kickHit = index === 0 || index === 3 || index === 6 || index === 8
  const snareHit = index === 2 || index === 5
  const hatHit = index === 1 || index === 4 || index === 7
  const energy = clamp01(0.46 + progress * 0.34 + (dropImpact * 0.2))
  const bass = clamp01(0.38 + (kickHit ? 0.48 : 0.08) + dropImpact * 0.12)
  const mid = clamp01(0.34 + (snareHit ? 0.42 : 0.08) + buildProgress * 0.12)
  const high = clamp01(0.28 + (hatHit ? 0.48 : 0.06) + buildProgress * 0.08)
  const phraseProgress = (scale: number) => (beatIndex % scale) / scale

  return {
    timeSec: input.timeSec,
    frameId: index + 1,
    sampleRate: 48_000,
    sourceId: `thumbnail:${input.presetId}`,
    trackId: `thumbnail:${input.presetId}`,
    bands: {
      sub: bass * 0.82,
      bass,
      lowMid: mid * 0.78,
      mid,
      high,
      air: high * 0.74,
      volume: energy,
      normalizedSub: bass * 0.88,
      normalizedBass: bass,
      normalizedLowMid: mid * 0.84,
      normalizedMid: mid,
      normalizedHigh: high,
      normalizedAir: high * 0.8,
    },
    rhythm: {
      bpm: input.bpm,
      bpmConfidence: 1,
      beatPhase: 0,
      beatHit,
      beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      downbeatHit,
      phrase4Progress: phraseProgress(4),
      phrase8Progress: phraseProgress(8),
      phrase16Progress: phraseProgress(16),
      phrase32Progress: phraseProgress(32),
      phrase4Hit: index === 2,
      phrase8Hit: index === 3,
      phrase16Hit: index === 5,
      phrase32Hit: index === 8,
      kickHit,
      kickStrength: kickHit ? (index === 6 ? 1 : 0.82) : 0,
      snareHit,
      snareStrength: snareHit ? 0.82 : 0,
      hatHit,
      hatStrength: hatHit ? 0.72 : 0,
      transient: Math.max(kickHit ? 0.9 : 0, snareHit ? 0.8 : 0, hatHit ? 0.65 : 0),
      transientConfidence: 1,
    },
    energy: {
      instant: energy,
      shortTerm: clamp01(energy * 0.9),
      longTerm: clamp01(0.42 + progress * 0.2),
      peak: Math.max(energy, 0.82),
      rms: clamp01(energy * 0.72),
      crestFactor: 0.72,
      spectralFlux: index === 4 || index === 6 ? 0.78 : 0.24,
      delta: index === 6 ? 0.48 : 0.08,
      percentile: progress,
      buildProgress,
      dropImpact,
      tension: clamp01(buildProgress * 0.82 + dropImpact * 0.18),
      complexity: index >= 5 ? 0.72 : 0.38,
      spectralCentroid: high,
      spectralSpread: clamp01(mid * 0.7 + high * 0.3),
      spectralRolloff: high,
      spectralFlatness: 0.2,
    },
    section: {
      type: sectionType,
      label: sectionType,
      startSec: sectionType === 'drop' ? input.timeSec - Math.max(0, index - 6) * 0.25 : 0,
      endSec: 999,
      progress,
      intensity: sectionType === 'drop' ? 1 : sectionType === 'build' ? 0.82 : 0.62,
      confidence: 1,
      source: 'inferred',
    },
    harmonic: {
      key: 'D', mode: 'minor', keyConfidence: 1,
      chord: index % 2 === 0 ? 'Dm' : 'Bb', chordConfidence: 0.9,
      chordChanged: beatHit, rootNote: index % 2 === 0 ? 'D3' : 'Bb2',
      pitchHz: null, note: null, melodyContour: index < 5 ? 'ascending' : 'arch',
    },
    stems: {
      vocals: 0, drums: energy, bass, instruments: mid, other: high * 0.25,
      vocalEnergy: 0, drumEnergy: energy, bassStemEnergy: bass,
      instrumentEnergy: mid, otherStemEnergy: high * 0.25,
      vocalActivity: 0, drumTransient: kickHit || snareHit, bassStemTransient: kickHit,
    },
    lyrics: {
      activeLine: null, activeWord: null, vocalActivity: 0,
      phraseConfidence: 0, lyricLineProgress: 0, wordHit: false,
    },
    semantics: {
      buildConfidence: sectionType === 'build' ? 1 : 0,
      dropConfidence: sectionType === 'drop' ? 1 : 0,
      fakeoutConfidence: 0,
      vocalHookConfidence: 0,
      mood: sectionType === 'drop' ? 'aggressive' : 'tension',
      texture: sectionType === 'build' ? 'building' : sectionType === 'drop' ? 'dense' : 'sparse',
    },
    capabilities: {
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: false,
      stemCurves: false,
      lyrics: false,
    },
    raw: { freqData: null, timeDomainData: null },
    confidence: { overall: 1, rhythm: 1, harmonic: 0.9, section: 1 },
  }
}
