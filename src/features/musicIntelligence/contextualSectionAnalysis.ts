// Contextual, sequence-aware interpretation of Patch 2 structural regions.
//
// This layer deliberately does not replace the neutral self-similarity result.
// It consumes those regions plus per-bar musical evidence, detects Drop anchors,
// refines Build/Pre-Drop boundaries, and emits compatibility section labels with
// separate boundary, label, grid, and overall confidence values.

import type {
  BarMusicalFeatures,
  ContextualSectionAnalysisDiagnostics,
  StructuralBoundaryCandidate,
  StructuralRegion,
  TrackSectionMI,
} from './types'
import { ANALYSIS_TUNING } from './analysisTuning'
import type {
  ReactDropAnchorDiagnostics,
  ReactSectionEnergyShape,
  ReactSectionHarmonicCharacter,
  ReactSectionLabelAlternative,
  ReactSectionRhythmicCharacter,
  ReactSectionTransitionCharacter,
  ReactSectionType,
} from '../../components/vyzualz/react/ReactTypes'

export const CONTEXTUAL_SECTION_CLASSIFIER_VERSION = ANALYSIS_TUNING.semantic.classifierVersion

const EPS = 1e-9
const DROP_THRESHOLD = ANALYSIS_TUNING.semantic.dropThreshold
const BUILD_THRESHOLD = ANALYSIS_TUNING.semantic.buildThreshold
const PRE_DROP_THRESHOLD = ANALYSIS_TUNING.semantic.preDropThreshold
const FAMILY_THRESHOLD = ANALYSIS_TUNING.semantic.familyThreshold
const MAX_ALTERNATIVES = ANALYSIS_TUNING.semantic.maxAlternatives

export interface ContextualSectionClassificationInput {
  regions: StructuralRegion[]
  barFeatures: BarMusicalFeatures[]
  durationSec: number
  boundaryCandidates?: StructuralBoundaryCandidate[]
}

export interface ContextualSectionClassificationResult {
  sections: TrackSectionMI[]
  diagnostics: ContextualSectionAnalysisDiagnostics
}

interface TrackContext {
  meanEnergy: number
  energyValues: number[]
  transientValues: number[]
  densityValues: number[]
}

interface RegionFeatures {
  startBar: number
  endBar: number
  startSec: number
  endSec: number
  durationBars: number
  position: number
  meanEnergy: number
  peakEnergy: number
  energyRelative: number
  energyRank: number
  bass: number
  bassProminence: number
  transientDensity: number
  drumDensity: number
  spectralDensity: number
  harmonicChange: number
  harmonicStability: number
  silenceRatio: number
  entryImpact: number
  exitTransitionStrength: number
  energyTrend: number
  densityTrend: number
  energyVariance: number
  densityVariance: number
  energyShape: ReactSectionEnergyShape
  rhythmicCharacter: ReactSectionRhythmicCharacter
  harmonicCharacter: ReactSectionHarmonicCharacter
  exitTransition: ReactSectionTransitionCharacter
  bestEarlierSimilarity: number
  bestLaterSimilarity: number
  sourceRegionIds: string[]
}

interface DropAnchor {
  barIndex: number
  confidence: number
  diagnostics: ReactDropAnchorDiagnostics
}

interface BuildRefinement {
  dropBar: number
  buildStartBar: number | null
  buildEndBar: number
  buildConfidence: number
  preDropStartBar: number | null
  preDropConfidence: number
  reason: string | null
}

interface ForcedInterval {
  startBar: number
  endBar: number
  type: 'build' | 'preDrop' | 'drop'
  confidence: number
  reason: string
  dropAnchor?: DropAnchor
}

interface SectionDraft {
  startBar: number
  endBar: number
  features: RegionFeatures
  type: ReactSectionType
  labelConfidence: number
  alternatives: ReactSectionLabelAlternative[]
  scores: Partial<Record<ReactSectionType, number>>
  evidence: string[]
  boundaryConfidence: number
  gridConfidence: number
  analysisConfidence: number
  dropConfidence: number
  boundaryReason?: string
  dropAnchor?: DropAnchor
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function rounded(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(clamp01(value) * factor) / factor
}

function average(values: ArrayLike<number>): number {
  if (values.length === 0) return 0
  let sum = 0
  for (let index = 0; index < values.length; index++) sum += Number(values[index] ?? 0)
  return sum / values.length
}

function variance(values: number[]): number {
  if (values.length < 2) return 0
  const mean = average(values)
  return average(values.map(value => (value - mean) ** 2))
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const position = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)))
  return sorted[position] ?? 0
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0.5
  let below = 0
  let equal = 0
  for (const candidate of values) {
    if (candidate < value - 1e-9) below++
    else if (Math.abs(candidate - value) <= 1e-9) equal++
  }
  return clamp01((below + equal * 0.5) / values.length)
}

function meanBars(
  bars: BarMusicalFeatures[],
  start: number,
  end: number,
  read: (bar: BarMusicalFeatures) => number,
): number {
  if (end <= start) return 0
  let sum = 0
  let count = 0
  for (let index = Math.max(0, start); index < Math.min(bars.length, end); index++) {
    sum += read(bars[index]!)
    count++
  }
  return count > 0 ? sum / count : 0
}

function valuesForBars(
  bars: BarMusicalFeatures[],
  start: number,
  end: number,
  read: (bar: BarMusicalFeatures) => number,
): number[] {
  const result: number[] = []
  for (let index = Math.max(0, start); index < Math.min(bars.length, end); index++) result.push(read(bars[index]!))
  return result
}

function spectralDensity(bar: BarMusicalFeatures): number {
  return clamp01(
    bar.spectralComplexity * 0.34 +
    bar.spectralCentroid * 0.18 +
    bar.midAverage * 0.18 +
    bar.highAverage * 0.14 +
    bar.overallTransientDensity * 0.16,
  )
}

function tensionValue(bar: BarMusicalFeatures): number {
  return clamp01(
    bar.meanEnergy * 0.23 +
    bar.overallTransientDensity * 0.23 +
    bar.spectralFlux * 0.17 +
    bar.highFrequencyOnsetDensity * 0.13 +
    bar.spectralCentroid * 0.10 +
    bar.spectralComplexity * 0.10 +
    Math.max(0, bar.energySlope) * 0.12 -
    bar.silenceRatio * 0.12,
  )
}

function normalizedPositiveTrend(values: number[]): number {
  if (values.length < 2) return 0
  const midpoint = (values.length - 1) * 0.5
  let numerator = 0
  let denominator = 0
  for (let index = 0; index < values.length; index++) {
    const centered = index - midpoint
    numerator += centered * (values[index] ?? 0)
    denominator += centered * centered
  }
  if (denominator <= EPS) return 0
  const slope = numerator / denominator
  return clamp01(slope * values.length * 3.2)
}

function signedTrend(values: number[]): number {
  if (values.length < 2) return 0
  const midpoint = (values.length - 1) * 0.5
  let numerator = 0
  let denominator = 0
  for (let index = 0; index < values.length; index++) {
    const centered = index - midpoint
    numerator += centered * (values[index] ?? 0)
    denominator += centered * centered
  }
  if (denominator <= EPS) return 0
  return Math.max(-1, Math.min(1, (numerator / denominator) * values.length * 3.2))
}

function positiveStepCoverage(values: number[]): number {
  if (values.length < 2) return 0
  let positive = 0
  for (let index = 1; index < values.length; index++) {
    if (values[index]! >= values[index - 1]! - 0.012) positive++
  }
  return positive / (values.length - 1)
}

function activeRiseCoverage(values: number[]): number {
  if (values.length < 2) return 0
  let rising = 0
  for (let index = 1; index < values.length; index++) {
    if (values[index]! - values[index - 1]! > 0.012) rising++
  }
  return rising / (values.length - 1)
}

function phraseLengthPrior(length: number): number {
  let best = 0
  for (const target of [4, 8, 16]) {
    const tolerance = Math.max(1, target * 0.2)
    best = Math.max(best, Math.exp(-Math.abs(length - target) / tolerance))
  }
  return clamp01(best)
}

function buildTrackContext(bars: BarMusicalFeatures[]): TrackContext {
  const energyValues = bars.map(bar => bar.meanEnergy)
  const transientValues = bars.map(bar => bar.overallTransientDensity)
  const densityValues = bars.map(spectralDensity)
  return {
    meanEnergy: average(energyValues),
    energyValues,
    transientValues,
    densityValues,
  }
}

function windowVector(bars: BarMusicalFeatures[], start: number, end: number): number[] {
  return [
    meanBars(bars, start, end, bar => bar.meanEnergy),
    meanBars(bars, start, end, bar => bar.bassAverage),
    meanBars(bars, start, end, bar => bar.midAverage),
    meanBars(bars, start, end, bar => bar.highAverage),
    meanBars(bars, start, end, bar => bar.overallTransientDensity),
    meanBars(bars, start, end, bar => bar.lowFrequencyOnsetDensity),
    meanBars(bars, start, end, bar => bar.midFrequencyOnsetDensity),
    meanBars(bars, start, end, bar => bar.highFrequencyOnsetDensity),
    meanBars(bars, start, end, bar => bar.spectralCentroid),
    meanBars(bars, start, end, bar => bar.spectralFlux),
    meanBars(bars, start, end, bar => bar.spectralComplexity),
    meanBars(bars, start, end, bar => bar.harmonicChange),
    meanBars(bars, start, end, bar => bar.silenceRatio),
  ]
}

function vectorSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0
  let distance = 0
  const count = Math.min(a.length, b.length)
  for (let index = 0; index < count; index++) distance += Math.abs((a[index] ?? 0) - (b[index] ?? 0))
  return clamp01(1 - distance / count)
}

function repeatedWindowSimilarity(bars: BarMusicalFeatures[], start: number, length: number): number {
  const source = windowVector(bars, start, Math.min(bars.length, start + length))
  let best = 0
  for (let candidate = 0; candidate + length <= bars.length; candidate += Math.max(1, Math.floor(length / 2))) {
    if (Math.abs(candidate - start) < Math.max(8, length)) continue
    best = Math.max(best, vectorSimilarity(source, windowVector(bars, candidate, candidate + length)))
  }
  return best
}

function structuralBoundaryMap(
  regions: StructuralRegion[],
  candidates: StructuralBoundaryCandidate[],
  barCount: number,
): Map<number, number> {
  const support = new Map<number, number>([[0, 1], [barCount, 1]])
  for (const region of regions) {
    if (region.startBar != null) support.set(region.startBar, Math.max(support.get(region.startBar) ?? 0, region.boundaryConfidence))
    if (region.endBar != null) support.set(region.endBar, Math.max(support.get(region.endBar) ?? 0, region.boundaryConfidence))
  }
  for (const candidate of candidates) {
    if (candidate.barIndex == null) continue
    const confidence = candidate.selected
      ? candidate.candidateConfidence
      : candidate.candidateConfidence * 0.55
    support.set(candidate.barIndex, Math.max(support.get(candidate.barIndex) ?? 0, confidence))
  }
  return support
}

function dropDiagnosticsAt(
  bars: BarMusicalFeatures[],
  context: TrackContext,
  barIndex: number,
  boundarySupport: Map<number, number>,
): ReactDropAnchorDiagnostics {
  const preStart = Math.max(0, barIndex - 4)
  const postEnd = Math.min(bars.length, barIndex + 4)
  const preEnergy = meanBars(bars, preStart, barIndex, bar => bar.meanEnergy)
  const postEnergy = meanBars(bars, barIndex, postEnd, bar => bar.meanEnergy)
  const preBass = meanBars(bars, preStart, barIndex, bar => bar.bassAverage)
  const postBass = meanBars(bars, barIndex, postEnd, bar => bar.bassAverage)
  const preTransient = meanBars(bars, preStart, barIndex, bar => bar.overallTransientDensity)
  const postTransient = meanBars(bars, barIndex, postEnd, bar => bar.overallTransientDensity)
  const lastPre = bars[Math.max(0, barIndex - 1)]!
  const firstPost = bars[barIndex]!
  const entryImpact = clamp01(
    Math.max(0, firstPost.meanEnergy - lastPre.meanEnergy) * 1.55 * 0.31 +
    Math.max(0, firstPost.bassAverage - lastPre.bassAverage) * 1.8 * 0.27 +
    Math.max(0, firstPost.overallTransientDensity - lastPre.overallTransientDensity) * 1.5 * 0.24 +
    Math.max(0, firstPost.spectralFlux - lastPre.spectralFlux) * 1.35 * 0.18,
  )
  const postVariance = variance(valuesForBars(bars, barIndex, postEnd, bar => bar.meanEnergy))
  const postEntryStability = clamp01(
    percentileRank(context.energyValues, postEnergy) * 0.68 +
    (1 - Math.min(1, postVariance * 12)) * 0.32,
  )
  const earlierStart = Math.max(0, preStart - 4)
  const earlierBass = meanBars(bars, earlierStart, preStart, bar => bar.bassAverage)
  const earlierTransient = meanBars(bars, earlierStart, preStart, bar => bar.overallTransientDensity)
  const preSilence = meanBars(bars, preStart, barIndex, bar => bar.silenceRatio)
  const preEntryReduction = clamp01(
    Math.max(0, earlierBass - preBass) * 1.35 * 0.42 +
    Math.max(0, earlierTransient - preTransient) * 1.25 * 0.30 +
    preSilence * 0.55,
  )
  let precedingRise = 0
  for (const length of [4, 8, 16]) {
    if (barIndex < length) continue
    precedingRise = Math.max(precedingRise, normalizedPositiveTrend(valuesForBars(bars, barIndex - length, barIndex, tensionValue)))
  }
  return {
    entryImpact: rounded(entryImpact),
    energyIncrease: rounded(clamp01((postEnergy - preEnergy) * 1.7)),
    bassIncrease: rounded(clamp01((postBass - preBass) * 1.9)),
    transientIncrease: rounded(clamp01((postTransient - preTransient) * 1.65)),
    postEntryStability: rounded(postEntryStability),
    preEntryReduction: rounded(preEntryReduction),
    precedingRise: rounded(precedingRise),
    repeatedHighEnergySimilarity: rounded(repeatedWindowSimilarity(bars, barIndex, Math.min(8, bars.length - barIndex))),
    structuralBoundarySupport: rounded(boundarySupport.get(barIndex) ?? 0),
  }
}

function dropScore(diagnostics: ReactDropAnchorDiagnostics): number {
  return clamp01(
    diagnostics.entryImpact * 0.25 +
    diagnostics.bassIncrease * 0.15 +
    diagnostics.transientIncrease * 0.15 +
    diagnostics.energyIncrease * 0.11 +
    diagnostics.postEntryStability * 0.13 +
    diagnostics.preEntryReduction * 0.08 +
    diagnostics.precedingRise * 0.07 +
    diagnostics.repeatedHighEnergySimilarity * 0.03 +
    diagnostics.structuralBoundarySupport * 0.03,
  )
}

function detectDropAnchors(
  bars: BarMusicalFeatures[],
  context: TrackContext,
  boundarySupport: Map<number, number>,
): DropAnchor[] {
  const candidates: DropAnchor[] = []
  for (let barIndex = 1; barIndex < bars.length - 1; barIndex++) {
    const diagnostics = dropDiagnosticsAt(bars, context, barIndex, boundarySupport)
    const confidence = dropScore(diagnostics)
    const impactGate = diagnostics.entryImpact >= 0.16 && (
      diagnostics.bassIncrease >= 0.14 ||
      diagnostics.transientIncrease >= 0.14 ||
      diagnostics.energyIncrease >= 0.18
    )
    const stabilityGate = diagnostics.postEntryStability >= 0.48
    const contextualGate = diagnostics.precedingRise >= 0.16 ||
      diagnostics.preEntryReduction >= 0.12 ||
      (diagnostics.structuralBoundarySupport >= 0.72 && diagnostics.entryImpact >= 0.24)
    if (confidence >= DROP_THRESHOLD && impactGate && stabilityGate && contextualGate) {
      candidates.push({ barIndex, confidence: rounded(confidence), diagnostics })
    }
  }

  const selected: DropAnchor[] = []
  for (const candidate of [...candidates].sort((a, b) => b.confidence - a.confidence || a.barIndex - b.barIndex)) {
    if (selected.every(existing => Math.abs(existing.barIndex - candidate.barIndex) >= 4)) selected.push(candidate)
  }
  return selected.sort((a, b) => a.barIndex - b.barIndex)
}

function preDropCandidateScore(
  bars: BarMusicalFeatures[],
  drop: DropAnchor,
  length: 1 | 2 | 4,
): number {
  const start = drop.barIndex - length
  if (start < 0) return 0
  const previousStart = Math.max(0, start - Math.max(2, length * 2))
  const preBass = meanBars(bars, start, drop.barIndex, bar => bar.bassAverage)
  const priorBass = meanBars(bars, previousStart, start, bar => bar.bassAverage)
  const preDrums = meanBars(bars, start, drop.barIndex, bar => bar.overallTransientDensity)
  const priorDrums = meanBars(bars, previousStart, start, bar => bar.overallTransientDensity)
  const silence = meanBars(bars, start, drop.barIndex, bar => bar.silenceRatio)
  const fillActivity = clamp01(
    meanBars(bars, start, drop.barIndex, bar => bar.midFrequencyOnsetDensity + bar.highFrequencyOnsetDensity) * 0.6 +
    meanBars(bars, start, drop.barIndex, bar => bar.spectralFlux) * 0.4 -
    meanBars(bars, start, drop.barIndex, bar => bar.lowFrequencyOnsetDensity) * 0.35,
  )
  const tensionPeak = clamp01(
    Math.max(0, meanBars(bars, start, drop.barIndex, tensionValue) - meanBars(bars, previousStart, start, tensionValue)) * 1.8,
  )
  const bassRemoval = clamp01((priorBass - preBass) * 2.1)
  const drumReduction = clamp01((priorDrums - preDrums) * 1.9)
  const consistency = clamp01(1 - variance(valuesForBars(bars, start, drop.barIndex, bar => (
    bar.bassAverage * 0.5 + bar.overallTransientDensity * 0.5
  ))) * 10)
  const durationPrior = length === 2 ? 0.10 : length === 1 ? 0.075 : 0.055
  const evidenceGate = Math.max(bassRemoval, drumReduction, silence) >= 0.28 ||
    (fillActivity >= 0.58 && bassRemoval >= 0.16)
  if (!evidenceGate) return 0
  return clamp01(
    bassRemoval * 0.27 +
    drumReduction * 0.20 +
    silence * 0.16 +
    fillActivity * 0.13 +
    tensionPeak * 0.11 +
    consistency * 0.06 +
    drop.confidence * 0.07 +
    durationPrior,
  )
}

function detectPreDrop(
  bars: BarMusicalFeatures[],
  drop: DropAnchor,
): { startBar: number | null; confidence: number } {
  const candidates = ([1, 2, 4] as const)
    .map(length => ({ length, score: preDropCandidateScore(bars, drop, length) }))
    .filter(candidate => candidate.score >= PRE_DROP_THRESHOLD)
    .sort((a, b) => b.score - a.score || Math.abs(a.length - 2) - Math.abs(b.length - 2) || a.length - b.length)
  const best = candidates[0]
  if (!best) return { startBar: null, confidence: 0 }
  return { startBar: drop.barIndex - best.length, confidence: rounded(best.score) }
}

function buildCandidateScore(
  bars: BarMusicalFeatures[],
  start: number,
  end: number,
  boundarySupport: Map<number, number>,
): { score: number; netRise: number; activeCoverage: number } {
  const tension = valuesForBars(bars, start, end, tensionValue)
  const density = valuesForBars(bars, start, end, spectralDensity)
  if (tension.length < 4) return { score: 0, netRise: 0, activeCoverage: 0 }
  const quarter = Math.max(1, Math.floor(tension.length / 4))
  const first = average(tension.slice(0, quarter))
  const last = average(tension.slice(-quarter))
  const netRise = clamp01((last - first) * 2.2)
  const positiveTrend = normalizedPositiveTrend(tension)
  const coverage = positiveStepCoverage(tension)
  const activeCoverage = activeRiseCoverage(tension)
  const densityRise = clamp01((average(density.slice(-quarter)) - average(density.slice(0, quarter))) * 2.0)
  const firstHalf = tension.slice(0, Math.max(2, Math.floor(tension.length / 2)))
  const firstHalfRise = normalizedPositiveTrend(firstHalf)
  const delayedRisePenalty = clamp01(Math.max(0, positiveTrend - firstHalfRise) * (1 - firstHalfRise) * 0.7)
  const length = end - start
  const score = clamp01(
    netRise * 0.31 +
    positiveTrend * 0.23 +
    coverage * 0.08 +
    activeCoverage * 0.17 +
    densityRise * 0.12 +
    phraseLengthPrior(length) * 0.11 +
    (boundarySupport.get(start) ?? 0) * 0.06 -
    delayedRisePenalty * 0.34,
  )
  return { score, netRise, activeCoverage }
}

function detectBuildStart(
  bars: BarMusicalFeatures[],
  buildEnd: number,
  boundarySupport: Map<number, number>,
): { startBar: number | null; confidence: number } {
  const candidates: Array<{ startBar: number; length: number; score: number; netRise: number }> = []
  const maxLength = Math.min(16, buildEnd)
  for (let length = 4; length <= maxLength; length++) {
    const startBar = buildEnd - length
    const evidence = buildCandidateScore(bars, startBar, buildEnd, boundarySupport)
    if (evidence.netRise < 0.10 || evidence.activeCoverage < 0.42 || evidence.score < BUILD_THRESHOLD) continue
    candidates.push({ startBar, length, score: evidence.score, netRise: evidence.netRise })
  }
  if (candidates.length === 0) return { startBar: null, confidence: 0 }
  candidates.sort((a, b) => b.score - a.score || a.startBar - b.startBar)
  const bestScore = candidates[0]!.score
  const close = candidates
    .filter(candidate => candidate.score >= bestScore - 0.035)
    .sort((a, b) => b.length - a.length || b.score - a.score)
  const best = close[0]!
  return { startBar: best.startBar, confidence: rounded(best.score) }
}

function buildRefinements(
  bars: BarMusicalFeatures[],
  drops: DropAnchor[],
  boundarySupport: Map<number, number>,
): BuildRefinement[] {
  return drops.map(drop => {
    const preDrop = detectPreDrop(bars, drop)
    const buildEndBar = preDrop.startBar ?? drop.barIndex
    const build = detectBuildStart(bars, buildEndBar, boundarySupport)
    const reason = build.startBar == null
      ? null
      : `Build start refined to bar ${build.startBar + 1} from sustained tension and density rise before Drop at bar ${drop.barIndex + 1}; ${buildEndBar - build.startBar}-bar evidence score ${build.confidence.toFixed(2)}.`
    return {
      dropBar: drop.barIndex,
      buildStartBar: build.startBar,
      buildEndBar,
      buildConfidence: build.confidence,
      preDropStartBar: preDrop.startBar,
      preDropConfidence: preDrop.confidence,
      reason,
    }
  })
}

function nextStructuralBoundary(regions: StructuralRegion[], startBar: number, barCount: number): number {
  let next = barCount
  for (const region of regions) {
    if (region.startBar != null && region.startBar > startBar) next = Math.min(next, region.startBar)
    if (region.endBar != null && region.endBar > startBar) next = Math.min(next, region.endBar)
  }
  return Math.max(startBar + 1, next)
}

function forcedIntervals(
  regions: StructuralRegion[],
  drops: DropAnchor[],
  refinements: BuildRefinement[],
  barCount: number,
): ForcedInterval[] {
  const result: ForcedInterval[] = []
  for (const refinement of refinements) {
    const drop = drops.find(candidate => candidate.barIndex === refinement.dropBar)!
    if (refinement.buildStartBar != null && refinement.buildEndBar > refinement.buildStartBar) {
      result.push({
        startBar: refinement.buildStartBar,
        endBar: refinement.buildEndBar,
        type: 'build',
        confidence: refinement.buildConfidence,
        reason: refinement.reason ?? 'Build attached contextually to the following Drop.',
      })
    }
    if (refinement.preDropStartBar != null && refinement.dropBar > refinement.preDropStartBar) {
      result.push({
        startBar: refinement.preDropStartBar,
        endBar: refinement.dropBar,
        type: 'preDrop',
        confidence: refinement.preDropConfidence,
        reason: `Optional ${refinement.dropBar - refinement.preDropStartBar}-bar Pre-Drop isolated by bass/drum reduction or transition evidence immediately before Drop at bar ${refinement.dropBar + 1}.`,
      })
    }
    const dropEnd = Math.min(barCount, nextStructuralBoundary(regions, refinement.dropBar, barCount))
    result.push({
      startBar: refinement.dropBar,
      endBar: dropEnd,
      type: 'drop',
      confidence: drop.confidence,
      reason: `Drop anchor at bar ${refinement.dropBar + 1} requires impact, bass/transient increase, and stable post-entry energy; energy alone is insufficient.`,
      dropAnchor: drop,
    })
  }
  return result.sort((a, b) => a.startBar - b.startBar || a.endBar - b.endBar || a.type.localeCompare(b.type))
}

function sourceRegionsForSpan(regions: StructuralRegion[], startBar: number, endBar: number): string[] {
  return regions
    .filter(region => {
      const regionStart = region.startBar ?? 0
      const regionEnd = region.endBar ?? Number.POSITIVE_INFINITY
      return startBar < regionEnd && endBar > regionStart
    })
    .map(region => region.id)
}

function energyShape(values: number[], trend: number): ReactSectionEnergyShape {
  if (values.length < 2) return 'stable'
  const spread = Math.sqrt(variance(values))
  const half = Math.max(1, Math.floor(values.length / 2))
  const first = average(values.slice(0, half))
  const second = average(values.slice(half))
  const middle = average(values.slice(Math.floor(values.length * 0.25), Math.max(1, Math.ceil(values.length * 0.75))))
  const edges = average([values[0] ?? 0, values[values.length - 1] ?? 0])
  if (middle > edges + 0.09) return 'arched'
  if (spread > 0.16 && Math.abs(trend) < 0.22) return 'volatile'
  if (trend > 0.18 || second > first + 0.07) return 'rising'
  if (trend < -0.18 || first > second + 0.07) return 'falling'
  return 'stable'
}

function transitionCharacter(
  bars: BarMusicalFeatures[],
  endBar: number,
): { strength: number; character: ReactSectionTransitionCharacter } {
  if (endBar <= 0 || endBar >= bars.length) return { strength: 0, character: 'continuous' }
  const before = bars[endBar - 1]!
  const after = bars[endBar]!
  const energyDelta = after.meanEnergy - before.meanEnergy
  const bassDelta = after.bassAverage - before.bassAverage
  const transientDelta = after.overallTransientDensity - before.overallTransientDensity
  const strength = clamp01(
    Math.abs(energyDelta) * 0.38 * 1.7 +
    Math.abs(bassDelta) * 0.24 * 1.8 +
    Math.abs(transientDelta) * 0.22 * 1.6 +
    Math.abs(after.spectralFlux - before.spectralFlux) * 0.16 * 1.4,
  )
  if (after.silenceRatio > 0.55 || energyDelta < -0.32) return { strength, character: 'cut' }
  if (energyDelta > 0.16 && (bassDelta > 0.10 || transientDelta > 0.10)) return { strength, character: 'impact' }
  if (energyDelta > 0.08 || after.spectralCentroid > before.spectralCentroid + 0.12) return { strength, character: 'lift' }
  if (energyDelta < -0.10 || bassDelta < -0.12) return { strength, character: 'release' }
  return { strength, character: 'continuous' }
}

function extractRegionFeatures(
  bars: BarMusicalFeatures[],
  context: TrackContext,
  regions: StructuralRegion[],
  startBar: number,
  endBar: number,
  durationSec: number,
): RegionFeatures {
  const slice = bars.slice(startBar, endBar)
  const energy = slice.map(bar => bar.meanEnergy)
  const density = slice.map(spectralDensity)
  const energyTrend = signedTrend(energy)
  const densityTrend = signedTrend(density)
  const meanEnergy = average(energy)
  const bass = average(slice.map(bar => bar.bassAverage))
  const transientDensity = average(slice.map(bar => bar.overallTransientDensity))
  const harmonicChange = average(slice.map(bar => bar.harmonicChange))
  const silenceRatio = average(slice.map(bar => bar.silenceRatio))
  const mid = average(slice.map(bar => bar.midAverage))
  const high = average(slice.map(bar => bar.highAverage))
  const bandTotal = bass + mid + high
  const entryImpact = startBar > 0
    ? dropDiagnosticsAt(bars, context, startBar, new Map()).entryImpact
    : 0
  const transition = transitionCharacter(bars, endBar)
  const startSec = startBar <= 0 ? 0 : bars[startBar]!.startSec
  const endSec = endBar >= bars.length ? durationSec : bars[endBar]!.startSec
  const drumDensity = average(slice.map(bar => (
    bar.lowFrequencyOnsetDensity * 0.45 +
    bar.midFrequencyOnsetDensity * 0.30 +
    bar.highFrequencyOnsetDensity * 0.25
  )))
  const highOnset = average(slice.map(bar => bar.highFrequencyOnsetDensity))
  const lowOnset = average(slice.map(bar => bar.lowFrequencyOnsetDensity))
  const rhythmicCharacter: ReactSectionRhythmicCharacter = transientDensity < percentile(context.transientValues, 0.28)
    ? 'sparse'
    : highOnset > lowOnset + 0.16 && average(slice.map(bar => bar.spectralFlux)) > 0.55
      ? 'fill-heavy'
      : transientDensity > percentile(context.transientValues, 0.70)
        ? 'driving'
        : 'steady'
  const harmonicCharacter: ReactSectionHarmonicCharacter = slice.every(bar => bar.chromaSummary.length === 0)
    ? 'unavailable'
    : harmonicChange < 0.22
      ? 'stable'
      : harmonicChange > 0.58
        ? 'changing'
        : 'evolving'
  return {
    startBar,
    endBar,
    startSec,
    endSec,
    durationBars: endBar - startBar,
    position: ((startSec + endSec) * 0.5) / Math.max(EPS, durationSec),
    meanEnergy,
    peakEnergy: slice.reduce((peak, bar) => Math.max(peak, bar.peakEnergy), 0),
    energyRelative: clamp01(meanEnergy / Math.max(0.05, context.meanEnergy) / 2),
    energyRank: percentileRank(context.energyValues, meanEnergy),
    bass,
    bassProminence: clamp01(bass / Math.max(0.05, bass + mid + high)),
    transientDensity,
    drumDensity,
    spectralDensity: average(density),
    harmonicChange,
    harmonicStability: clamp01(1 - harmonicChange),
    silenceRatio,
    entryImpact,
    exitTransitionStrength: transition.strength,
    energyTrend,
    densityTrend,
    energyVariance: variance(energy),
    densityVariance: variance(density),
    energyShape: energyShape(energy, energyTrend),
    rhythmicCharacter,
    harmonicCharacter,
    exitTransition: transition.character,
    bestEarlierSimilarity: 0,
    bestLaterSimilarity: 0,
    sourceRegionIds: sourceRegionsForSpan(regions, startBar, endBar),
  }
}

function regionFeatureVector(feature: RegionFeatures): number[] {
  return [
    feature.meanEnergy,
    feature.bass,
    feature.transientDensity,
    feature.drumDensity,
    feature.spectralDensity,
    feature.harmonicChange,
    feature.silenceRatio,
    clamp01((feature.energyTrend + 1) * 0.5),
    clamp01((feature.densityTrend + 1) * 0.5),
  ]
}

function populateNeighborSimilarity(features: RegionFeatures[]): void {
  for (let index = 0; index < features.length; index++) {
    const current = regionFeatureVector(features[index]!)
    let earlier = 0
    let later = 0
    for (let other = 0; other < features.length; other++) {
      if (other === index) continue
      const similarity = vectorSimilarity(current, regionFeatureVector(features[other]!))
      if (other < index) earlier = Math.max(earlier, similarity)
      else later = Math.max(later, similarity)
    }
    features[index]!.bestEarlierSimilarity = earlier
    features[index]!.bestLaterSimilarity = later
  }
}

function intervalForSpan(intervals: ForcedInterval[], startBar: number, endBar: number): ForcedInterval | null {
  return intervals.find(interval => startBar >= interval.startBar && endBar <= interval.endBar) ?? null
}

function isInteriorForcedCut(intervals: ForcedInterval[], cut: number): boolean {
  return intervals.some(interval => cut > interval.startBar && cut < interval.endBar)
}

function buildSemanticCuts(
  regions: StructuralRegion[],
  intervals: ForcedInterval[],
  barCount: number,
): number[] {
  const cuts = new Set<number>([0, barCount])
  for (const region of regions) {
    if (region.startBar != null) cuts.add(Math.max(0, Math.min(barCount, region.startBar)))
    if (region.endBar != null) cuts.add(Math.max(0, Math.min(barCount, region.endBar)))
  }
  for (const interval of intervals) {
    cuts.add(interval.startBar)
    cuts.add(interval.endBar)
  }
  return [...cuts]
    .filter(cut => !isInteriorForcedCut(intervals, cut) || intervals.some(interval => cut === interval.startBar || cut === interval.endBar))
    .sort((a, b) => a - b)
}

function contextDistanceToDrop(drops: DropAnchor[], bar: number, direction: 'previous' | 'next'): number | null {
  const candidates = drops
    .map(drop => drop.barIndex)
    .filter(dropBar => direction === 'previous' ? dropBar < bar : dropBar >= bar)
  if (candidates.length === 0) return null
  return direction === 'previous'
    ? bar - Math.max(...candidates)
    : Math.min(...candidates) - bar
}

function normalizedAlternatives(
  scores: Partial<Record<ReactSectionType, number>>,
): {
  type: ReactSectionType
  alternatives: ReactSectionLabelAlternative[]
  labelConfidence: number
  rawPrimaryScore: number
  rawScoreMargin: number
} {
  const entries = (Object.entries(scores) as Array<[ReactSectionType, number]>)
    .map(([type, score]) => ({ type, score: clamp01(score) }))
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type))
    .slice(0, MAX_ALTERNATIVES)
  const total = entries.reduce((sum, entry) => sum + Math.max(0.001, entry.score), 0)
  const alternatives = entries.map(entry => ({
    type: entry.type,
    confidence: rounded(Math.max(0.001, entry.score) / total),
  }))
  const primary = alternatives[0] ?? { type: 'unknown' as const, confidence: 1 }
  const second = alternatives[1]?.confidence ?? 0
  const margin = Math.max(0, primary.confidence - second)
  const rawPrimary = entries[0]?.score ?? 0
  const rawSecond = entries[1]?.score ?? 0
  const labelConfidence = rounded(0.24 + primary.confidence * 0.46 + margin * 0.22 + rawPrimary * 0.08)
  return {
    type: primary.type,
    alternatives,
    labelConfidence,
    rawPrimaryScore: rawPrimary,
    rawScoreMargin: Math.max(0, rawPrimary - rawSecond),
  }
}

function alternativesWithUnknown(alternatives: ReactSectionLabelAlternative[]): ReactSectionLabelAlternative[] {
  const withoutUnknown = alternatives.filter(alternative => alternative.type !== 'unknown')
  const unknownWeight = Math.max(0.55, alternatives[0]?.confidence ?? 0.55)
  const weighted = [
    { type: 'unknown' as const, confidence: unknownWeight },
    ...withoutUnknown.map(alternative => ({ ...alternative, confidence: alternative.confidence })),
  ].slice(0, MAX_ALTERNATIVES)
  const total = weighted.reduce((sum, alternative) => sum + alternative.confidence, 0) || 1
  return weighted.map(alternative => ({
    ...alternative,
    confidence: rounded(alternative.confidence / total),
  }))
}

function scoreSection(
  feature: RegionFeatures,
  forced: ForcedInterval | null,
  drops: DropAnchor[],
  previousFeature: RegionFeatures | null,
  nextFeature: RegionFeatures | null,
): { scores: Partial<Record<ReactSectionType, number>>; evidence: string[] } {
  const scores: Partial<Record<ReactSectionType, number>> = {
    intro: 0.05,
    verse: 0.16,
    build: 0.03,
    preDrop: 0.01,
    drop: 0.03,
    breakdown: 0.04,
    bridge: 0.12,
    outro: 0.05,
    unknown: 0.18,
  }
  const evidence: string[] = []
  const early = clamp01((0.24 - feature.position) / 0.24)
  const late = clamp01((feature.position - 0.74) / 0.26)
  const middle = clamp01(1 - Math.abs(feature.position - 0.52) / 0.48)
  const stable = clamp01(1 - Math.abs(feature.energyTrend) * 0.8 - Math.min(0.55, feature.energyVariance * 4))
  const moderateEnergy = clamp01(1 - Math.abs(feature.energyRank - 0.52) / 0.52)
  const lowEnergy = clamp01(1 - feature.energyRank)
  const highEnergy = feature.energyRank
  const sparse = clamp01(
    (1 - percentileRank([0.15, 0.35, 0.55, 0.75], feature.transientDensity)) * 0.45 +
    feature.silenceRatio * 0.35 +
    (1 - feature.spectralDensity) * 0.20,
  )
  const repeat = Math.max(feature.bestEarlierSimilarity, feature.bestLaterSimilarity)
  const previousDropDistance = contextDistanceToDrop(drops, feature.startBar, 'previous')
  const nextDropDistance = contextDistanceToDrop(drops, feature.endBar, 'next')
  const afterDrop = previousDropDistance == null ? 0 : clamp01(1 - previousDropDistance / 24)
  const beforeDrop = nextDropDistance == null ? 0 : clamp01(1 - nextDropDistance / 20)
  const precedingContrast = previousFeature
    ? clamp01((previousFeature.meanEnergy - feature.meanEnergy) * 1.7 + (previousFeature.transientDensity - feature.transientDensity) * 1.2)
    : 0
  const followingContrast = nextFeature
    ? clamp01((nextFeature.meanEnergy - feature.meanEnergy) * 1.5 + (nextFeature.transientDensity - feature.transientDensity) * 1.0)
    : 0

  scores.intro = clamp01(0.08 + early * 0.52 + lowEnergy * 0.18 + stable * 0.10 + (drops.some(drop => drop.barIndex < feature.endBar) ? 0 : 0.08))
  scores.outro = clamp01(0.07 + late * 0.56 + lowEnergy * 0.15 + (feature.exitTransition === 'continuous' ? 0.06 : 0) + Math.max(0, -feature.energyTrend) * 0.14)
  scores.verse = clamp01(0.18 + stable * 0.23 + moderateEnergy * 0.17 + repeat * 0.20 + (feature.rhythmicCharacter === 'steady' ? 0.10 : 0.03) + (beforeDrop > 0.35 ? 0.05 : 0))
  scores.bridge = clamp01(0.13 + middle * 0.18 + feature.harmonicChange * 0.23 + feature.exitTransitionStrength * 0.15 + (1 - repeat) * 0.13 + moderateEnergy * 0.08)
  scores.breakdown = clamp01(0.04 + afterDrop * 0.31 + precedingContrast * 0.25 + sparse * 0.17 + middle * 0.08 + followingContrast * 0.10)
  if (afterDrop < 0.20 || precedingContrast < 0.12) scores.breakdown = Math.min(scores.breakdown, 0.34)
  scores.build = clamp01(0.03 + Math.max(0, feature.energyTrend) * 0.15 + Math.max(0, feature.densityTrend) * 0.12 + beforeDrop * 0.08)
  scores.drop = clamp01(0.03 + highEnergy * 0.13 + feature.entryImpact * 0.10)
  scores.preDrop = 0.01
  scores.unknown = clamp01(0.16 + (1 - stable) * 0.07 + (1 - repeat) * 0.05)

  // Sequence context outranks superficial resemblance. Repeated quiet material
  // at the start can be an Intro, while the same material after a Drop is a
  // Breakdown; likewise a late release should not remain Verse merely because
  // its timbre resembles an earlier region.
  if (afterDrop > 0.45 && precedingContrast > 0.20) {
    scores.breakdown = clamp01((scores.breakdown ?? 0) + 0.30)
    scores.verse = Math.min(scores.verse ?? 0, 0.58)
    scores.bridge = Math.min(scores.bridge ?? 0, 0.52)
  }
  if (late > 0.65 && lowEnergy > 0.45) {
    scores.outro = clamp01((scores.outro ?? 0) + 0.22)
    scores.verse = Math.min(scores.verse ?? 0, 0.60)
  }
  if (!nextFeature && feature.position > 0.68 && lowEnergy > 0.35) {
    scores.outro = clamp01((scores.outro ?? 0) + 0.24)
    scores.verse = Math.min(scores.verse ?? 0, 0.54)
    evidence.push('final low-energy release supports Outro over repeated Verse material')
  }
  if (early > 0.72 && lowEnergy > 0.45) {
    scores.intro = clamp01((scores.intro ?? 0) + 0.14)
    scores.verse = Math.min(scores.verse ?? 0, 0.68)
  }

  if (early > 0.65) evidence.push('early-track placement supports Intro')
  if (late > 0.65) evidence.push('late-track release supports Outro')
  if (repeat > 0.72) evidence.push('self-similar material supports a repeated section role')
  if (afterDrop > 0.45 && precedingContrast > 0.20) evidence.push('post-Drop energy and density release supports Breakdown')
  if (feature.harmonicChange > 0.55) evidence.push('harmonic change supports Bridge over a stable Verse')
  if ((highEnergy > 0.58 || feature.meanEnergy > 0.68) && !forced) evidence.push('high energy lacks an accepted contextual Drop anchor, so loudness alone is not treated as Drop')

  if (forced) {
    scores[forced.type] = clamp01(0.88 + forced.confidence * 0.12)
    evidence.push(forced.reason)
    if (forced.type === 'drop') {
      scores.verse = Math.min(scores.verse ?? 0, 0.36)
      scores.bridge = Math.min(scores.bridge ?? 0, 0.28)
    } else if (forced.type === 'build') {
      scores.verse = Math.min(scores.verse ?? 0, 0.40)
    } else {
      scores.build = Math.min(scores.build ?? 0, 0.34)
    }
  }

  return { scores, evidence }
}

function boundaryConfidenceForSpan(
  startBar: number,
  endBar: number,
  boundarySupport: Map<number, number>,
  intervals: ForcedInterval[],
  gridConfidence: number,
): number {
  const forcedAt = (bar: number) => intervals
    .filter(interval => interval.startBar === bar || interval.endBar === bar)
    .reduce((best, interval) => Math.max(best, interval.confidence), 0)
  const start = Math.max(boundarySupport.get(startBar) ?? 0, forcedAt(startBar), startBar === 0 ? gridConfidence : 0)
  const end = Math.max(boundarySupport.get(endBar) ?? 0, forcedAt(endBar), endBar === Math.max(...boundarySupport.keys()) ? gridConfidence : 0)
  return rounded(average([start || gridConfidence * 0.55, end || gridConfidence * 0.55]))
}

function patch2RelationSimilarity(
  regions: StructuralRegion[],
  aIds: string[],
  bIds: string[],
): number {
  const byId = new Map(regions.map(region => [region.id, region]))
  let best = 0
  for (const aId of aIds) {
    const a = byId.get(aId)
    if (!a) continue
    for (const relation of a.relatedRegions) {
      if (bIds.includes(relation.regionId)) best = Math.max(best, relation.similarity)
    }
  }
  return best
}

function sectionSimilarity(
  a: SectionDraft,
  b: SectionDraft,
  regions: StructuralRegion[],
): number {
  const contextual = vectorSimilarity(regionFeatureVector(a.features), regionFeatureVector(b.features))
  const patch2 = patch2RelationSimilarity(regions, a.features.sourceRegionIds, b.features.sourceRegionIds)
  const durationSimilarity = clamp01(1 - Math.abs(a.features.durationBars - b.features.durationBars) / Math.max(1, Math.max(a.features.durationBars, b.features.durationBars)))
  return rounded(Math.max(patch2, contextual * 0.84 + durationSimilarity * 0.16))
}

function assignFamilies(
  sections: TrackSectionMI[],
  drafts: SectionDraft[],
  regions: StructuralRegion[],
): number {
  const parent = drafts.map((_, index) => index)
  const find = (index: number): number => {
    let current = index
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]!]!
      current = parent[current]!
    }
    return current
  }
  const union = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[Math.max(rootA, rootB)] = Math.min(rootA, rootB)
  }

  for (let a = 0; a < drafts.length; a++) {
    for (let b = a + 1; b < drafts.length; b++) {
      if (drafts[a]!.type !== drafts[b]!.type) continue
      if (['intro', 'outro', 'unknown', 'preDrop'].includes(drafts[a]!.type)) continue
      if (sectionSimilarity(drafts[a]!, drafts[b]!, regions) >= FAMILY_THRESHOLD) union(a, b)
    }
  }

  const groups = new Map<number, number[]>()
  for (let index = 0; index < drafts.length; index++) {
    const root = find(index)
    const group = groups.get(root) ?? []
    group.push(index)
    groups.set(root, group)
  }

  let familyCount = 0
  for (const indices of [...groups.values()].sort((a, b) => a[0]! - b[0]!)) {
    if (indices.length < 2) continue
    familyCount++
    const firstIndex = indices[0]!
    const type = drafts[firstIndex]!.type
    const familyId = `family-${type}-${familyCount}`
    for (let occurrence = 0; occurrence < indices.length; occurrence++) {
      const index = indices[occurrence]!
      const rootSimilarity = index === firstIndex ? 1 : sectionSimilarity(drafts[firstIndex]!, drafts[index]!, regions)
      const relatedSectionIds = indices.filter(other => other !== index).map(other => sections[other]!.id)
      const durationMismatch = drafts[index]!.features.durationBars !== drafts[firstIndex]!.features.durationBars
      sections[index]!.interpretation = {
        ...sections[index]!.interpretation,
        familyId,
        occurrenceIndex: occurrence + 1,
        familySimilarity: rounded(rootSimilarity),
        relatedSectionIds,
        isVariation: index !== firstIndex && (rootSimilarity < 0.90 || durationMismatch),
      }
    }
  }
  return familyCount
}

function applyDisplayLabels(sections: TrackSectionMI[]): void {
  const counts = new Map<ReactSectionType, number>()
  const display: Record<ReactSectionType, string> = {
    intro: 'Intro',
    verse: 'Verse',
    build: 'Build',
    preDrop: 'Pre-Drop',
    drop: 'Drop',
    breakdown: 'Breakdown',
    bridge: 'Bridge',
    outro: 'Outro',
    unknown: 'Section',
  }
  for (const section of sections) {
    const next = (counts.get(section.type) ?? 0) + 1
    counts.set(section.type, next)
    section.label = `${display[section.type]} ${next}`
    if (section.interpretation?.occurrenceIndex == null && section.interpretation) {
      section.interpretation.occurrenceIndex = next
    }
  }
}

export function classifyContextualSections(
  input: ContextualSectionClassificationInput,
): ContextualSectionClassificationResult {
  const bars = [...input.barFeatures].sort((a, b) => a.startSec - b.startSec || a.barIndex - b.barIndex)
  const regions = [...input.regions].sort((a, b) => a.startSec - b.startSec || a.id.localeCompare(b.id))
  if (bars.length === 0 || regions.length === 0) {
    return {
      sections: [],
      diagnostics: {
        classifierVersion: CONTEXTUAL_SECTION_CLASSIFIER_VERSION,
        dropAnchorCount: 0,
        buildRefinementCount: 0,
        preDropCount: 0,
        familyCount: 0,
        ambiguousSectionCount: 0,
      },
    }
  }

  const context = buildTrackContext(bars)
  const boundarySupport = structuralBoundaryMap(regions, input.boundaryCandidates ?? [], bars.length)
  const drops = detectDropAnchors(bars, context, boundarySupport)
  const refinements = buildRefinements(bars, drops, boundarySupport)
  const intervals = forcedIntervals(regions, drops, refinements, bars.length)
  const cuts = buildSemanticCuts(regions, intervals, bars.length)
  const gridConfidence = rounded(average(bars.map(bar => bar.gridConfidence)))
  const features: RegionFeatures[] = []
  for (let index = 0; index < cuts.length - 1; index++) {
    const startBar = cuts[index]!
    const endBar = cuts[index + 1]!
    if (endBar <= startBar) continue
    features.push(extractRegionFeatures(bars, context, regions, startBar, endBar, input.durationSec))
  }
  populateNeighborSimilarity(features)

  const drafts: SectionDraft[] = features.map((feature, index) => {
    const forced = intervalForSpan(intervals, feature.startBar, feature.endBar)
    const previous = features[index - 1] ?? null
    const next = features[index + 1] ?? null
    const scored = scoreSection(feature, forced, drops, previous, next)
    const resolved = normalizedAlternatives(scored.scores)
    const remainsUnknown = !forced && resolved.type !== 'unknown' &&
      resolved.rawPrimaryScore < ANALYSIS_TUNING.semantic.uncertainPrimaryScore &&
      resolved.rawScoreMargin < ANALYSIS_TUNING.semantic.uncertainScoreMargin &&
      resolved.labelConfidence < ANALYSIS_TUNING.semantic.uncertainLabelConfidence
    if (remainsUnknown) {
      scored.evidence.push('Competing semantic roles are too close and weak; the region remains Unknown instead of publishing a confident guess.')
    }
    const labelConfidence = forced
      ? rounded(Math.max(resolved.labelConfidence, forced.confidence * 0.86 + 0.12))
      : remainsUnknown
        ? rounded(Math.min(resolved.labelConfidence, ANALYSIS_TUNING.semantic.uncertainLabelConfidence - 0.01))
        : resolved.labelConfidence
    const boundaryConfidence = boundaryConfidenceForSpan(
      feature.startBar,
      feature.endBar,
      boundarySupport,
      intervals,
      gridConfidence,
    )
    const analysisConfidence = rounded(
      boundaryConfidence * 0.30 +
      labelConfidence * 0.42 +
      gridConfidence * 0.18 +
      clamp01(1 - feature.energyVariance * 2.5) * 0.10,
    )
    return {
      startBar: feature.startBar,
      endBar: feature.endBar,
      features: feature,
      type: remainsUnknown ? 'unknown' : resolved.type,
      labelConfidence,
      alternatives: remainsUnknown ? alternativesWithUnknown(resolved.alternatives) : resolved.alternatives,
      scores: scored.scores,
      evidence: scored.evidence,
      boundaryConfidence,
      gridConfidence,
      analysisConfidence,
      dropConfidence: forced?.type === 'drop' ? forced.confidence : 0,
      boundaryReason: forced?.reason,
      dropAnchor: forced?.dropAnchor,
    }
  })

  const sections: TrackSectionMI[] = drafts.map((draft, index) => ({
    id: `auto-sec-${index}`,
    label: '',
    type: draft.type,
    startSec: draft.features.startSec,
    endSec: draft.features.endSec,
    intensity: rounded(clamp01(draft.features.energyRank * 0.68 + draft.features.transientDensity * 0.20 + draft.features.bass * 0.12)),
    confidence: draft.analysisConfidence,
    boundaryConfidence: draft.boundaryConfidence,
    labelConfidence: draft.labelConfidence,
    gridConfidence: draft.gridConfidence,
    analysisConfidence: draft.analysisConfidence,
    dropConfidence: rounded(draft.dropConfidence),
    source: 'analysis',
    interpretation: {
      startBar: draft.startBar,
      endBar: draft.endBar,
      durationBars: draft.endBar - draft.startBar,
      energyShape: draft.features.energyShape,
      densityCategory: draft.features.spectralDensity < percentile(context.densityValues, 0.33)
        ? 'sparse'
        : draft.features.spectralDensity > percentile(context.densityValues, 0.67)
          ? 'dense'
          : 'moderate',
      rhythmicCharacter: draft.features.rhythmicCharacter,
      harmonicCharacter: draft.features.harmonicCharacter,
      entryImpact: rounded(draft.features.entryImpact),
      exitTransition: draft.features.exitTransition,
      alternativeLabels: draft.alternatives,
      boundaryRefinementReason: draft.boundaryReason,
      classificationDiagnostics: {
        scores: Object.fromEntries(
          Object.entries(draft.scores).map(([type, score]) => [type, rounded(score ?? 0)]),
        ) as Partial<Record<ReactSectionType, number>>,
        evidence: draft.evidence,
        sourceRegionIds: draft.features.sourceRegionIds,
        ...(draft.dropAnchor ? { dropAnchor: draft.dropAnchor.diagnostics } : {}),
      },
    },
  }))

  const familyCount = assignFamilies(sections, drafts, regions)
  applyDisplayLabels(sections)
  const ambiguousSectionCount = drafts.filter(draft => {
    const primary = draft.alternatives[0]?.confidence ?? 0
    const second = draft.alternatives[1]?.confidence ?? 0
    return primary < 0.62 || primary - second < 0.18
  }).length

  return {
    sections,
    diagnostics: {
      classifierVersion: CONTEXTUAL_SECTION_CLASSIFIER_VERSION,
      dropAnchorCount: drops.length,
      buildRefinementCount: refinements.filter(refinement => refinement.buildStartBar != null).length,
      preDropCount: refinements.filter(refinement => refinement.preDropStartBar != null).length,
      familyCount,
      ambiguousSectionCount,
    },
  }
}
