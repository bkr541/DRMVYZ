/**
 * Central production tuning for the shared loaded-track interpretation layer.
 *
 * Keep these values genre-neutral. Bass-music behavior belongs in contextual
 * evidence combinations, not one-off track thresholds. Changes here must be
 * accompanied by synthetic regression coverage.
 */
export const ANALYSIS_TUNING = Object.freeze({
  performance: Object.freeze({
    /** Stored feature cadence. FFT/transient state still advances every hop. */
    featurePointIntervalSec: 0.05,
    /** Harmonic summaries do not need frame-rate chroma snapshots. */
    chromaFrameIntervalSec: 0.25,
    /** Yield periodically so cancellation and transport replacement can run. */
    cooperativeYieldEveryFrames: 256,
    /** Bound cancellation latency during multi-channel mixdown. */
    cooperativeYieldEveryMixSamples: 262_144,
    /** Self-similarity is quadratically bounded to roughly one MiB. */
    maxSelfSimilarityBars: 512,
  }),
  structural: Object.freeze({
    gridConfidenceThreshold: 0.35,
    defaultMaxSegments: 20,
    maxPersistedCandidates: 96,
    maxAlternativeCandidates: 32,
    boundaryWeights: Object.freeze({
      acousticNovelty: 0.28,
      rhythmicNovelty: 0.15,
      harmonicNovelty: 0.16,
      selfSimilarityNovelty: 0.25,
      energyTransition: 0.09,
      silenceOrImpact: 0.07,
    }),
    phrasePrior: Object.freeze({
      targetBars: Object.freeze([4, 8, 16, 32]),
      toleranceRatio: 0.22,
      oneBarFloor: 0.12,
      twoBarFloor: 0.22,
      rewardBase: 0.16,
      evidenceScale: 0.44,
    }),
    shortSectionPenalty: Object.freeze({
      oneBarBase: 1.65,
      oneBarEvidenceScale: 1.75,
      twoBarBase: 0.95,
      twoBarEvidenceScale: 1.05,
      threeBarPenalty: 0.25,
    }),
    globalObjective: Object.freeze({
      boundaryReward: 2.05,
      cohesionReward: 1.15,
      repeatAffinityReward: 0.24,
      sectionCountPenalty: 0.34,
      stableCutPenalty: 0.52,
      weakBoundaryPenalty: 0.42,
      weakBoundaryHardFloor: 0.22,
      weakBoundaryHardScale: 3.5,
      longSectionBars: 48,
      longSectionPenaltyPerBar: 0.012,
    }),
  }),
  semantic: Object.freeze({
    classifierVersion: 'contextual-2',
    dropThreshold: 0.46,
    buildThreshold: 0.46,
    preDropThreshold: 0.48,
    familyThreshold: 0.72,
    maxAlternatives: 3,
    /** Prefer Unknown when evidence is both weak and tightly contested. */
    uncertainPrimaryScore: 0.34,
    uncertainScoreMargin: 0.035,
    uncertainLabelConfidence: 0.50,
  }),
  persistence: Object.freeze({
    maxStoredPhrases: 192,
    maxStoredSemanticMoments: 128,
    maxStoredBoundaryAlternatives: 24,
    maxStoredBoundaryCandidates: 256,
    maxStoredHierarchyUnits: 1536,
  }),
})

export type LoadedAudioAnalysisTuning = typeof ANALYSIS_TUNING
