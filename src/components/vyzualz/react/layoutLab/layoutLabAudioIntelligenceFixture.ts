import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame, TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'

// Static Audio Intelligence readings for Layout Lab, taken a little over twelve seconds into a track. Every bar,
// dot and text field is given a different value so the panel's states can be reviewed with no audio playing: bars
// run from nearly empty to full, some dots are lit and some not, and every section has text in it.

export const LAB_TRACK_POSITION_SEC = 12.777
export const LAB_TRACK_DURATION_SEC = 119.069

export const LAB_AUDIO_FRAME: MusicIntelligenceFrame = {
  ...DEFAULT_MI_FRAME,
  timeSec: LAB_TRACK_POSITION_SEC,
  frameId: 767,
  sampleRate: 48000,
  bands: {
    ...DEFAULT_MI_FRAME.bands,
    sub: 0.98, bass: 0.85, lowMid: 0.66, mid: 0.56, high: 0.5, air: 0.23, volume: 0.74,
    normalizedSub: 1, normalizedBass: 0.89, normalizedLowMid: 0.88, normalizedMid: 0.9, normalizedHigh: 0.79, normalizedAir: 0.51,
  },
  rhythm: {
    ...DEFAULT_MI_FRAME.rhythm,
    bpm: 129, bpmConfidence: 0.94, bpmSource: 'analysis' as MusicIntelligenceFrame['rhythm']['bpmSource'],
    beatPhase: 0.37, beatHit: true, beatIndex: 25, beatEventId: 25, beatEventTimeSec: 12.558,
    beatInBar: 1, barIndex: 6, downbeatHit: false,
    phrase4Progress: 0.62, phrase8Progress: 0.31, phrase16Progress: 0.16, phrase32Progress: 0.08,
    phrase4Hit: false, phrase8Hit: false, phrase16Hit: true, phrase32Hit: false,
    kickHit: true, kickStrength: 0.78, snareHit: false, snareStrength: 0.41, hatHit: true, hatStrength: 0.57,
    transient: 0.66, transientConfidence: 0.72,
  },
  energy: {
    ...DEFAULT_MI_FRAME.energy,
    instant: 0.71, shortTerm: 0.64, longTerm: 0.52, peak: 0.93, rms: 0.48, crestFactor: 8, spectralFlux: 0.12,
    delta: 0.08, percentile: 0.81, buildProgress: 0.35, dropImpact: 0.22, tension: 0.58, complexity: 0.67,
    trackCurve: 0.6, spectralCentroid: 0.44, spectralSpread: 0.31, spectralRolloff: 0.73, spectralFlatness: 0.18,
  },
  section: {
    type: 'build', label: 'Build 1', startSec: 8, endSec: 24.5, progress: 0.29, intensity: 0.66, confidence: 0.83, source: 'analysis',
  } as MusicIntelligenceFrame['section'],
  harmonic: {
    ...DEFAULT_MI_FRAME.harmonic,
    key: 'C#', mode: 'major', keyConfidence: 0.81, chord: 'F#m', chordConfidence: 0.64, chordChanged: true,
    rootNote: 'F#', note: 'A#', pitchHz: 233, melodyContour: 'ascending',
  } as MusicIntelligenceFrame['harmonic'],
  stems: {
    ...DEFAULT_MI_FRAME.stems,
    vocalEnergy: 0.62, drumEnergy: 0.88, bassStemEnergy: 0.71, instrumentEnergy: 0.45, otherStemEnergy: 0.27, vocalActivity: 0.56,
    drumTransient: true, bassStemTransient: false,
  },
  lyrics: {
    ...DEFAULT_MI_FRAME.lyrics,
    activeLine: 'We bout to start an epidemic', activeLineId: 'line-12', previousLine: 'Mocha ID', nextLine: 'with this one',
    activeWord: 'epidemic', activeWordId: 'word-31', vocalActivity: 0.74,
    phraseConfidence: 0.91, lyricLineProgress: 0.43, wordProgress: 0.68,
    wordHit: true, lineEnter: false, lineExit: false, isGap: false,
  },
  semantics: {
    ...DEFAULT_MI_FRAME.semantics,
    buildConfidence: 0.72, dropConfidence: 0.31, fakeoutConfidence: 0.12, vocalHookConfidence: 0.58, mood: 'euphoric', texture: 'building',
  },
}

const MOMENT_TYPES = [
  ['build_start', 8], ['pre_drop_start', 22.1], ['drop_impact', 24.5], ['major_impact', 24.5], ['breakdown_entry', 61.4],
  ['energy_release', 24.9], ['fakeout_candidate', 55], ['silence_or_stop', 59.9], ['section_entry', 8], ['section_exit', 24.5],
] as const

/**
 * The offline-analysis half of the panel (beat grid, phrases, per-bar measurements, structure and event markers),
 * cut down to what the panel reads. It is a fixture, not a real analysis, so it is cast to the full type.
 */
export const LAB_AUDIO_ANALYSIS = {
  beatGridOffsetSec: 0.132,
  musicalGrid: {
    source: 'automatic', fallbackReason: null, timeSignature: 4, downbeatPhase: 0, beatPeriodSec: 0.465, authoritative: true,
    confidence: { bpm: 0.94, beatPhase: 0.88, downbeatPhase: 0.71, barGrid: 0.8 },
  },
  phrases: [
    { timeSec: 0, phraseLength: 8, lengthBars: 8, barIndex: 0, confidence: 0.87, source: 'section_boundary', relatedSectionId: 'section-1', structurallyDetected: true, supportingSignals: ['Energy rise'] },
    { timeSec: 8, phraseLength: 16, lengthBars: 16, barIndex: 4, confidence: 0.76, source: 'repeated_material', relatedSectionId: 'section-2', structurallyDetected: true, supportingSignals: ['Bass entry', 'Hat density up'] },
  ],
  barFeatures: [{
    barIndex: 6, startSec: 11.16, endSec: 13.02, source: 'analysis', gridSource: 'automatic', gridConfidence: 0.8,
    meanEnergy: 0.62, peakEnergy: 0.91, energySlope: 0.34, dynamicRange: 0.58, bassAverage: 0.84, midAverage: 0.52, highAverage: 0.41,
    spectralFlux: 0.27, spectralCentroid: 0.46, spectralComplexity: 0.69, overallTransientDensity: 0.73, lowFrequencyOnsetDensity: 0.88,
    midFrequencyOnsetDensity: 0.44, highFrequencyOnsetDensity: 0.61, silenceRatio: 0.06, harmonicChange: 0.38,
    chromaSummary: [0.92, 0.18, 0.31, 0.12, 0.66, 0.24, 0.81, 0.08, 0.47, 0.35, 0.74, 0.15],
  }],
  sections: [{
    id: 'section-2', label: 'Build 1', type: 'build', startSec: 8, endSec: 24.5, intensity: 0.66, confidence: 0.83,
    boundaryConfidence: 0.79, labelConfidence: 0.68, dropConfidence: 0.41,
    interpretation: { familyId: 'family-build', occurrenceIndex: 1, isVariation: false },
  }],
  phraseHierarchy: { units: [], sectionOccurrences: [], sectionFamilies: [{ familyId: 'family-build', occurrenceSectionIds: ['section-2', 'section-7', 'section-10'] }] },
  structuralSegmentation: {
    source: 'bar_self_similarity',
    regions: [{
      id: 'region-2', startSec: 8, endSec: 24.5, boundaryConfidence: 0.79, internalCohesion: 0.74,
      relatedRegions: [{ regionId: 'region-7', similarity: 0.82 }, { regionId: 'region-10', similarity: 0.61 }],
    }],
    boundaryCandidates: [{
      barIndex: 4, timeSec: 8, selected: true, candidateConfidence: 0.77, acousticNovelty: 0.69, rhythmicNovelty: 0.52,
      harmonicNovelty: 0.38, selfSimilarityNovelty: 0.81, energyTransitionEvidence: 0.73, silenceOrImpactEvidence: 0.24,
    }],
    alternativeBoundaryCandidates: [],
  },
  boundaryAlternatives: [{ id: 'alt-1', timeSec: 8.465, barIndex: 4, confidence: 0.58, rank: 2, reason: 'Energy step', supportingSignals: [], source: 'bar_self_similarity' }],
  semanticMoments: MOMENT_TYPES.map(([type, timeSec], index) => ({
    id: `moment-${index}`, type, timeSec, durationSec: 0.5 + index * 0.25, confidence: 0.55 + (index % 5) * 0.09,
    source: index % 2 ? 'energy_curve' : 'section_context', relatedSectionId: 'section-2',
  })),
} as unknown as TrackIntelligenceAnalysis

export const LAB_TRACK_INFO: readonly (readonly [label: string, value: string])[] = [
  ['Track Title', 'Jeremih x Max Styler - Birthday Sex x I Know You Want To (RAFAEL Edit) 6A 129'],
  ['Artist Name', '—'],
  ['Length', '01:59.069'],
  ['BPM', '129'],
  ['Time Signature', '4/4'],
  ['Key', 'C# major'],
  ['Beats', '256'],
  ['Sections', '12'],
  ['Sample Rate', '48,000 Hz'],
  ['Position', '00:12.777 / 01:59.069'],
]
