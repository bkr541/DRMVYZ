// Shared loaded-audio structural segmentation.
//
// Patch 2 prefers a reliable musical grid and performs deterministic,
// bar-aligned global segmentation from robust per-bar features and a bounded
// self-similarity matrix. The legacy half-second detector remains only as an
// explicitly marked fallback for tracks without a usable grid.

import type {
  BarMusicalFeatures,
  FeatureCurve,
  MusicalGridInfo,
  StructuralBoundaryCandidate,
  StructuralRegion,
  StructuralSegmentationAnalysis,
  TrackSectionMI,
} from './types'
import type { ReactSectionType } from '../../components/vyzualz/react/ReactTypes'
import { classifyContextualSections } from './contextualSectionAnalysis'
import { ANALYSIS_TUNING } from './analysisTuning'

const EPS = 1e-9
const MAX_SELF_SIMILARITY_BARS = ANALYSIS_TUNING.performance.maxSelfSimilarityBars
const MAX_PERSISTED_CANDIDATES = ANALYSIS_TUNING.structural.maxPersistedCandidates
const MAX_ALTERNATIVE_CANDIDATES = ANALYSIS_TUNING.structural.maxAlternativeCandidates
const DEFAULT_MAX_SEGMENTS = ANALYSIS_TUNING.structural.defaultMaxSegments
const GRID_CONFIDENCE_THRESHOLD = ANALYSIS_TUNING.structural.gridConfidenceThreshold
const STRUCTURAL_DIMENSION = 28

export interface SectionDetectionOptions {
  minSegmentSec?: number
  maxSegments?: number
  noveltyThreshold?: number
  barFeatures?: BarMusicalFeatures[]
  musicalGrid?: MusicalGridInfo
}

export interface StructuralSegmentationResult {
  sections: TrackSectionMI[]
  structuralSegmentation: StructuralSegmentationAnalysis
}

interface FeatureFrame {
  timeSec: number
  energy: number
  bass: number
  mid: number
  high: number
  centroid: number
  flux: number
}

interface NormalizedBar {
  startBar: number
  endBar: number
  startSec: number
  endSec: number
  vector: Float32Array
}

interface LocalEvidence {
  acoustic: number
  rhythmic: number
  harmonic: number
  energy: number
  silenceImpact: number
}

interface SegmentStats {
  energy: number
  bass: number
  mid: number
  high: number
  centroid: number
  flux: number
  slope: number
}

interface TrackMeans {
  energy: number
  bass: number
  mid: number
  high: number
  centroid: number
  flux: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function average(values: ArrayLike<number>): number {
  if (values.length === 0) return 0
  let sum = 0
  for (let index = 0; index < values.length; index++) sum += Number(values[index] ?? 0)
  return sum / values.length
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const position = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)))
  return sorted[position] ?? 0
}

function sampleCurveAt(curve: FeatureCurve, timeSec: number): number {
  if (curve.length === 0) return 0
  if (timeSec <= curve[0]!.timeSec) return curve[0]!.value
  if (timeSec >= curve[curve.length - 1]!.timeSec) return curve[curve.length - 1]!.value
  let lo = 0
  let hi = curve.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (curve[mid]!.timeSec <= timeSec) lo = mid
    else hi = mid
  }
  const a = curve[lo]!
  const b = curve[hi]!
  const ratio = (timeSec - a.timeSec) / Math.max(EPS, b.timeSec - a.timeSec)
  return a.value + ratio * (b.value - a.value)
}

function buildFrames(
  energyCurves: { instant: FeatureCurve; bass: FeatureCurve; mid: FeatureCurve; high: FeatureCurve },
  spectralCurves: { centroid: FeatureCurve; flux: FeatureCurve },
  durationSec: number,
  hopSec = 0.5,
): FeatureFrame[] {
  const frames: FeatureFrame[] = []
  for (let timeSec = 0; timeSec < durationSec; timeSec += hopSec) {
    frames.push({
      timeSec,
      energy: sampleCurveAt(energyCurves.instant, timeSec),
      bass: sampleCurveAt(energyCurves.bass, timeSec),
      mid: sampleCurveAt(energyCurves.mid, timeSec),
      high: sampleCurveAt(energyCurves.high, timeSec),
      centroid: sampleCurveAt(spectralCurves.centroid, timeSec),
      flux: sampleCurveAt(spectralCurves.flux, timeSec),
    })
  }
  return frames
}

function rawBarVector(bar: BarMusicalFeatures): number[] {
  const bandTotal = bar.bassAverage + bar.midAverage + bar.highAverage
  const bassBalance = bandTotal > EPS ? bar.bassAverage / bandTotal : 0
  const midBalance = bandTotal > EPS ? bar.midAverage / bandTotal : 0
  const highBalance = bandTotal > EPS ? bar.highAverage / bandTotal : 0
  const chroma = new Array<number>(12).fill(0)
  const chromaTotal = bar.chromaSummary.reduce((sum, value) => sum + Math.max(0, value), 0)
  if (chromaTotal > EPS) {
    for (let index = 0; index < 12; index++) chroma[index] = Math.max(0, bar.chromaSummary[index] ?? 0) / chromaTotal
  }
  return [
    bar.meanEnergy,
    bar.peakEnergy,
    bar.energySlope,
    bar.dynamicRange,
    bassBalance,
    midBalance,
    highBalance,
    bar.spectralCentroid,
    bar.spectralFlux,
    bar.spectralComplexity,
    bar.overallTransientDensity,
    bar.lowFrequencyOnsetDensity,
    bar.midFrequencyOnsetDensity,
    bar.highFrequencyOnsetDensity,
    bar.silenceRatio,
    bar.harmonicChange,
    ...chroma,
  ]
}

/** Robust per-track scaling prevents one extreme Drop from flattening every other transition. */
function normalizeBarVectors(barFeatures: BarMusicalFeatures[]): Float32Array[] {
  const raw = barFeatures.map(rawBarVector)
  if (raw.length === 0) return []
  const lower = new Array<number>(16).fill(0)
  const upper = new Array<number>(16).fill(1)
  for (let dimension = 0; dimension < 16; dimension++) {
    const values = raw.map(vector => Number.isFinite(vector[dimension]) ? vector[dimension]! : 0)
    lower[dimension] = percentile(values, 0.10)
    upper[dimension] = percentile(values, 0.90)
  }

  return raw.map(vector => {
    const normalized = new Float32Array(STRUCTURAL_DIMENSION)
    for (let dimension = 0; dimension < 16; dimension++) {
      const lo = lower[dimension]!
      const hi = upper[dimension]!
      const span = hi - lo
      normalized[dimension] = span > 1e-7
        ? clamp01((vector[dimension]! - lo) / span)
        : 0.5
    }
    for (let dimension = 16; dimension < STRUCTURAL_DIMENSION; dimension++) {
      normalized[dimension] = clamp01(vector[dimension] ?? 0)
    }
    return normalized
  })
}

function meanVector(vectors: Float32Array[], from: number, to: number): Float32Array {
  const result = new Float32Array(STRUCTURAL_DIMENSION)
  const count = Math.max(1, to - from)
  for (let index = from; index < to; index++) {
    const vector = vectors[index]!
    for (let dimension = 0; dimension < STRUCTURAL_DIMENSION; dimension++) result[dimension] += vector[dimension]!
  }
  for (let dimension = 0; dimension < STRUCTURAL_DIMENSION; dimension++) result[dimension] /= count
  return result
}

function buildAnalyzedBars(barFeatures: BarMusicalFeatures[], normalized: Float32Array[]): { bars: NormalizedBar[]; stride: number } {
  const stride = Math.max(1, Math.ceil(barFeatures.length / MAX_SELF_SIMILARITY_BARS))
  const bars: NormalizedBar[] = []
  for (let start = 0; start < barFeatures.length; start += stride) {
    const end = Math.min(barFeatures.length, start + stride)
    bars.push({
      startBar: start,
      endBar: end,
      startSec: barFeatures[start]!.startSec,
      endSec: barFeatures[end - 1]!.endSec,
      vector: meanVector(normalized, start, end),
    })
  }
  return { bars, stride }
}

function meanAbsoluteDistance(a: Float32Array, b: Float32Array, dimensions: number[]): number {
  if (dimensions.length === 0) return 0
  let sum = 0
  for (const dimension of dimensions) sum += Math.abs(a[dimension]! - b[dimension]!)
  return clamp01(sum / dimensions.length)
}

function chromaDistance(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let dimension = 16; dimension < 28; dimension++) {
    dot += a[dimension]! * b[dimension]!
    normA += a[dimension]! ** 2
    normB += b[dimension]! ** 2
  }
  if (normA <= EPS || normB <= EPS) return 0
  return clamp01(1 - dot / Math.sqrt(normA * normB))
}

function structuralSimilarity(a: Float32Array, b: Float32Array): number {
  const energy = meanAbsoluteDistance(a, b, [0, 1, 2, 3])
  const balance = meanAbsoluteDistance(a, b, [4, 5, 6])
  const spectral = meanAbsoluteDistance(a, b, [7, 8, 9])
  const rhythm = meanAbsoluteDistance(a, b, [10, 11, 12, 13])
  const harmonic = 0.35 * Math.abs(a[15]! - b[15]!) + 0.65 * chromaDistance(a, b)
  const silence = Math.abs(a[14]! - b[14]!)
  const distance =
    energy * 0.12 +
    balance * 0.19 +
    spectral * 0.20 +
    rhythm * 0.23 +
    harmonic * 0.23 +
    silence * 0.03
  return clamp01(1 - distance)
}

function buildSimilarityMatrix(bars: NormalizedBar[]): Float32Array {
  const dimension = bars.length
  const matrix = new Float32Array(dimension * dimension)
  for (let row = 0; row < dimension; row++) {
    matrix[row * dimension + row] = 1
    for (let column = row + 1; column < dimension; column++) {
      const similarity = structuralSimilarity(bars[row]!.vector, bars[column]!.vector)
      matrix[row * dimension + column] = similarity
      matrix[column * dimension + row] = similarity
    }
  }
  return matrix
}

function normalizeEvidence(values: number[], floor: number = 0.08): number[] {
  const max = values.reduce((current, value) => Math.max(current, value), 0)
  if (max < 1e-7) return values.map(() => 0)
  const reference = Math.max(floor, percentile(values, 0.90))
  return values.map(value => clamp01(value / reference))
}

function computeLocalEvidence(vectors: Float32Array[]): LocalEvidence[] {
  const raw: LocalEvidence[] = vectors.map(() => ({ acoustic: 0, rhythmic: 0, harmonic: 0, energy: 0, silenceImpact: 0 }))
  for (let boundary = 1; boundary < vectors.length; boundary++) {
    const before = vectors[boundary - 1]!
    const after = vectors[boundary]!
    const energy = meanAbsoluteDistance(before, after, [0, 1, 2, 3])
    const frequency = meanAbsoluteDistance(before, after, [4, 5, 6])
    const spectral = meanAbsoluteDistance(before, after, [7, 8, 9])
    const rhythmic = meanAbsoluteDistance(before, after, [10, 11, 12, 13])
    const harmonic = clamp01(0.35 * Math.abs(before[15]! - after[15]!) + 0.65 * chromaDistance(before, after))
    const silenceChange = Math.abs(before[14]! - after[14]!)
    const impact = Math.max(0, after[0]! - before[0]!)
    raw[boundary] = {
      acoustic: clamp01(energy * 0.25 + frequency * 0.23 + spectral * 0.25 + rhythmic * 0.27),
      rhythmic,
      harmonic,
      energy,
      silenceImpact: clamp01(Math.max(silenceChange, impact * 0.8 + Math.abs(after[1]! - before[1]!) * 0.2)),
    }
  }
  const acoustic = normalizeEvidence(raw.map(value => value.acoustic))
  const rhythmic = normalizeEvidence(raw.map(value => value.rhythmic))
  const harmonic = normalizeEvidence(raw.map(value => value.harmonic))
  const energy = normalizeEvidence(raw.map(value => value.energy))
  const silenceImpact = normalizeEvidence(raw.map(value => value.silenceImpact))
  return raw.map((_, index) => ({
    acoustic: acoustic[index]!,
    rhythmic: rhythmic[index]!,
    harmonic: harmonic[index]!,
    energy: energy[index]!,
    silenceImpact: silenceImpact[index]!,
  }))
}

function matrixAverage(
  matrix: Float32Array,
  dimension: number,
  rowStart: number,
  rowEnd: number,
  columnStart: number,
  columnEnd: number,
): number {
  let sum = 0
  let count = 0
  for (let row = rowStart; row < rowEnd; row++) {
    for (let column = columnStart; column < columnEnd; column++) {
      if (row === column) continue
      sum += matrix[row * dimension + column]!
      count++
    }
  }
  return count > 0 ? sum / count : 1
}

function computeCheckerboardNovelty(matrix: Float32Array, dimension: number): number[] {
  const novelty = new Array<number>(dimension + 1).fill(0)
  for (let boundary = 1; boundary < dimension; boundary++) {
    const window = Math.min(8, boundary, dimension - boundary)
    if (window <= 0) continue
    const leftStart = boundary - window
    const rightEnd = boundary + window
    const withinLeft = matrixAverage(matrix, dimension, leftStart, boundary, leftStart, boundary)
    const withinRight = matrixAverage(matrix, dimension, boundary, rightEnd, boundary, rightEnd)
    const across = matrixAverage(matrix, dimension, leftStart, boundary, boundary, rightEnd)
    novelty[boundary] = Math.max(0, (withinLeft + withinRight) * 0.5 - across)
  }
  return normalizeEvidence(novelty, 0.05)
}

function strongestEvidenceInRange(local: LocalEvidence[], from: number, to: number): LocalEvidence {
  const result: LocalEvidence = { acoustic: 0, rhythmic: 0, harmonic: 0, energy: 0, silenceImpact: 0 }
  for (let index = Math.max(1, from); index <= Math.min(local.length - 1, to); index++) {
    result.acoustic = Math.max(result.acoustic, local[index]!.acoustic)
    result.rhythmic = Math.max(result.rhythmic, local[index]!.rhythmic)
    result.harmonic = Math.max(result.harmonic, local[index]!.harmonic)
    result.energy = Math.max(result.energy, local[index]!.energy)
    result.silenceImpact = Math.max(result.silenceImpact, local[index]!.silenceImpact)
  }
  return result
}

function buildBoundaryCandidates(
  originalBars: BarMusicalFeatures[],
  analyzedBars: NormalizedBar[],
  localEvidence: LocalEvidence[],
  checkerboardNovelty: number[],
  stride: number,
  gridConfidence: number,
): StructuralBoundaryCandidate[] {
  const candidates: StructuralBoundaryCandidate[] = []
  for (let boundary = 1; boundary < analyzedBars.length; boundary++) {
    const barIndex = analyzedBars[boundary]!.startBar
    const evidence = strongestEvidenceInRange(localEvidence, barIndex - Math.max(0, stride - 1), barIndex + Math.max(0, stride - 1))
    const selfSimilarityNovelty = checkerboardNovelty[boundary] ?? 0
    const totalScore = clamp01(
      evidence.acoustic * ANALYSIS_TUNING.structural.boundaryWeights.acousticNovelty +
      evidence.rhythmic * ANALYSIS_TUNING.structural.boundaryWeights.rhythmicNovelty +
      evidence.harmonic * ANALYSIS_TUNING.structural.boundaryWeights.harmonicNovelty +
      selfSimilarityNovelty * ANALYSIS_TUNING.structural.boundaryWeights.selfSimilarityNovelty +
      evidence.energy * ANALYSIS_TUNING.structural.boundaryWeights.energyTransition +
      evidence.silenceImpact * ANALYSIS_TUNING.structural.boundaryWeights.silenceOrImpact,
    )
    candidates.push({
      barIndex,
      timeSec: originalBars[barIndex]!.startSec,
      totalScore,
      acousticNovelty: evidence.acoustic,
      rhythmicNovelty: evidence.rhythmic,
      harmonicNovelty: evidence.harmonic,
      selfSimilarityNovelty,
      energyTransitionEvidence: evidence.energy,
      silenceOrImpactEvidence: evidence.silenceImpact,
      gridConfidence,
      candidateConfidence: clamp01(totalScore * 0.82 + gridConfidence * 0.18),
      selected: false,
      offGrid: false,
    })
  }
  return candidates
}

function buildMatrixPrefix(matrix: Float32Array, dimension: number): Float32Array {
  const width = dimension + 1
  const prefix = new Float32Array(width * width)
  for (let row = 0; row < dimension; row++) {
    let rowSum = 0
    for (let column = 0; column < dimension; column++) {
      rowSum += matrix[row * dimension + column]!
      prefix[(row + 1) * width + (column + 1)] = prefix[row * width + (column + 1)]! + rowSum
    }
  }
  return prefix
}

function rectangleSum(prefix: Float32Array, dimension: number, rowStart: number, rowEnd: number, columnStart: number, columnEnd: number): number {
  const width = dimension + 1
  return prefix[rowEnd * width + columnEnd]!
    - prefix[rowStart * width + columnEnd]!
    - prefix[rowEnd * width + columnStart]!
    + prefix[rowStart * width + columnStart]!
}

function intervalCohesion(prefix: Float32Array, dimension: number, start: number, end: number): number {
  const length = end - start
  if (length <= 1) return 1
  const squareSum = rectangleSum(prefix, dimension, start, end, start, end)
  return clamp01((squareSum - length) / Math.max(1, length * (length - 1)))
}

function phrasePriorScore(lengthBars: number): number {
  if (lengthBars <= 0) return 0
  let best = 0
  for (const target of ANALYSIS_TUNING.structural.phrasePrior.targetBars) {
    const tolerance = Math.max(1, target * ANALYSIS_TUNING.structural.phrasePrior.toleranceRatio)
    best = Math.max(best, Math.exp(-Math.abs(lengthBars - target) / tolerance))
  }
  if (lengthBars === 1) best = Math.max(best, ANALYSIS_TUNING.structural.phrasePrior.oneBarFloor)
  if (lengthBars === 2) best = Math.max(best, ANALYSIS_TUNING.structural.phrasePrior.twoBarFloor)
  return clamp01(best)
}

function buildReturnAffinity(matrix: Float32Array, dimension: number): number[] {
  const affinity = new Array<number>(dimension).fill(0)
  for (let row = 0; row < dimension; row++) {
    let best = 0
    for (let column = 0; column < dimension; column++) {
      if (Math.abs(row - column) < 4) continue
      best = Math.max(best, matrix[row * dimension + column]!)
    }
    affinity[row] = best
  }
  return affinity
}

function averageRange(values: number[], start: number, end: number): number {
  if (end <= start) return 0
  let sum = 0
  for (let index = start; index < end; index++) sum += values[index] ?? 0
  return sum / (end - start)
}

function selectBoundariesGlobal(
  bars: NormalizedBar[],
  candidates: StructuralBoundaryCandidate[],
  matrix: Float32Array,
  maxSegments: number,
): { boundaries: number[]; objective: number } {
  const dimension = bars.length
  if (dimension <= 1) return { boundaries: [0, dimension], objective: 0 }
  const candidateAt = new Map<number, StructuralBoundaryCandidate>()
  candidates.forEach((candidate, index) => candidateAt.set(index + 1, candidate))
  const prefix = buildMatrixPrefix(matrix, dimension)
  const returnAffinity = buildReturnAffinity(matrix, dimension)
  const allowedSegments = Math.max(1, Math.min(maxSegments, dimension))
  const scores = Array.from({ length: allowedSegments + 1 }, () => new Float64Array(dimension + 1).fill(Number.NEGATIVE_INFINITY))
  const previous = Array.from({ length: allowedSegments + 1 }, () => new Int32Array(dimension + 1).fill(-1))
  scores[0]![0] = 0

  for (let segmentCount = 1; segmentCount <= allowedSegments; segmentCount++) {
    for (let end = 1; end <= dimension; end++) {
      const endCandidate = end < dimension ? candidateAt.get(end) : undefined
      const evidence = endCandidate?.totalScore ?? 0
      for (let start = segmentCount - 1; start < end; start++) {
        const priorScore = scores[segmentCount - 1]![start]!
        if (!Number.isFinite(priorScore)) continue
        const lengthBars = bars[end - 1]!.endBar - bars[start]!.startBar
        const startCandidate = start > 0 ? candidateAt.get(start) : undefined
        const startEvidence = startCandidate?.totalScore ?? 1
        const shortEvidence = end >= dimension
          ? startEvidence
          : start === 0
            ? evidence
            : Math.min(startEvidence, evidence)
        const cohesion = intervalCohesion(prefix, dimension, start, end)
        const phrase = phrasePriorScore(lengthBars)
        const repeatAffinity = averageRange(returnAffinity, start, end)
        const adjacentSimilarity = end < dimension ? matrix[(end - 1) * dimension + end]! : 0
        const stableCutPenalty = endCandidate
          ? adjacentSimilarity * (1 - endCandidate.selfSimilarityNovelty) * ANALYSIS_TUNING.structural.globalObjective.stableCutPenalty
          : 0
        const weakBoundaryPenalty = endCandidate
          ? (1 - evidence) * ANALYSIS_TUNING.structural.globalObjective.weakBoundaryPenalty +
            Math.max(0, ANALYSIS_TUNING.structural.globalObjective.weakBoundaryHardFloor - evidence) *
              ANALYSIS_TUNING.structural.globalObjective.weakBoundaryHardScale
          : 0
        let shortPenalty = 0
        if (lengthBars === 1) {
          shortPenalty = Math.max(
            0,
            ANALYSIS_TUNING.structural.shortSectionPenalty.oneBarBase -
              shortEvidence * ANALYSIS_TUNING.structural.shortSectionPenalty.oneBarEvidenceScale,
          )
        } else if (lengthBars === 2) {
          shortPenalty = Math.max(
            0,
            ANALYSIS_TUNING.structural.shortSectionPenalty.twoBarBase -
              shortEvidence * ANALYSIS_TUNING.structural.shortSectionPenalty.twoBarEvidenceScale,
          )
        } else if (lengthBars === 3) {
          shortPenalty = ANALYSIS_TUNING.structural.shortSectionPenalty.threeBarPenalty
        }
        const longPenalty = lengthBars > ANALYSIS_TUNING.structural.globalObjective.longSectionBars
          ? (lengthBars - ANALYSIS_TUNING.structural.globalObjective.longSectionBars) * ANALYSIS_TUNING.structural.globalObjective.longSectionPenaltyPerBar
          : 0
        const boundaryReward = endCandidate ? evidence * ANALYSIS_TUNING.structural.globalObjective.boundaryReward : 0
        const phraseReward = phrase * (
          ANALYSIS_TUNING.structural.phrasePrior.rewardBase +
          evidence * ANALYSIS_TUNING.structural.phrasePrior.evidenceScale
        )
        const segmentScore =
          boundaryReward +
          (cohesion - 0.5) * ANALYSIS_TUNING.structural.globalObjective.cohesionReward +
          phraseReward +
          repeatAffinity * ANALYSIS_TUNING.structural.globalObjective.repeatAffinityReward -
          ANALYSIS_TUNING.structural.globalObjective.sectionCountPenalty -
          shortPenalty -
          longPenalty -
          weakBoundaryPenalty -
          stableCutPenalty
        const total = priorScore + segmentScore
        if (total > scores[segmentCount]![end]! + 1e-12) {
          scores[segmentCount]![end] = total
          previous[segmentCount]![end] = start
        }
      }
    }
  }

  let bestCount = 1
  let bestScore = scores[1]![dimension]!
  for (let count = 2; count <= allowedSegments; count++) {
    if (scores[count]![dimension]! > bestScore + 1e-12) {
      bestScore = scores[count]![dimension]!
      bestCount = count
    }
  }

  const boundaries = [dimension]
  let end = dimension
  let count = bestCount
  while (count > 0 && end > 0) {
    const start = previous[count]![end]!
    if (start < 0) break
    boundaries.push(start)
    end = start
    count--
  }
  if (boundaries[boundaries.length - 1] !== 0) boundaries.push(0)
  boundaries.sort((a, b) => a - b)
  return { boundaries: [...new Set(boundaries)], objective: Number.isFinite(bestScore) ? bestScore : 0 }
}

function segmentStats(frames: FeatureFrame[], from: number, to: number): SegmentStats {
  const slice = frames.slice(from, to)
  if (slice.length === 0) return { energy: 0, bass: 0, mid: 0, high: 0, centroid: 0, flux: 0, slope: 0 }
  const stats = {
    energy: average(slice.map(frame => frame.energy)),
    bass: average(slice.map(frame => frame.bass)),
    mid: average(slice.map(frame => frame.mid)),
    high: average(slice.map(frame => frame.high)),
    centroid: average(slice.map(frame => frame.centroid)),
    flux: average(slice.map(frame => frame.flux)),
    slope: 0,
  }
  const half = Math.max(1, Math.floor(slice.length / 2))
  stats.slope = average(slice.slice(half).map(frame => frame.energy)) - average(slice.slice(0, half).map(frame => frame.energy))
  return stats
}

function computeTrackMeans(frames: FeatureFrame[]): TrackMeans {
  if (frames.length === 0) return { energy: 0.5, bass: 0.5, mid: 0.5, high: 0.5, centroid: 0.5, flux: 0.5 }
  return {
    energy: average(frames.map(frame => frame.energy)),
    bass: average(frames.map(frame => frame.bass)),
    mid: average(frames.map(frame => frame.mid)),
    high: average(frames.map(frame => frame.high)),
    centroid: average(frames.map(frame => frame.centroid)),
    flux: average(frames.map(frame => frame.flux)),
  }
}

// Legacy fallback labels remain intentionally simple. The grid-aligned path uses
// contextualSectionAnalysis instead, but tracks without a reliable grid must
// still degrade deterministically rather than losing sections entirely.
function labelSegment(stats: SegmentStats, means: TrackMeans, midpointRatio: number): { type: ReactSectionType; intensity: number; confidence: number } {
  const ratio = (value: number, mean: number) => Math.max(0.1, Math.min(3, mean > 0.001 ? value / mean : 1))
  const energyRatio = ratio(stats.energy, means.energy)
  const bassRatio = ratio(stats.bass, means.bass)
  const fluxRatio = ratio(stats.flux, means.flux)
  const centroidRatio = ratio(stats.centroid, means.centroid)
  const intensity = Math.max(0.1, Math.min(1, energyRatio * 0.5))
  if (midpointRatio < 0.12 && energyRatio < 1.1) return { type: 'intro', intensity: Math.min(0.45, intensity), confidence: 0.75 }
  if (midpointRatio > 0.88 && energyRatio < 1) return { type: 'outro', intensity: Math.min(0.35, intensity), confidence: 0.75 }
  if (energyRatio >= 1.35 && fluxRatio >= 1.35 && bassRatio >= 1.2) return { type: 'drop', intensity: Math.min(1, intensity + 0.3), confidence: 0.8 }
  if (stats.slope > 0.015 && energyRatio >= 0.85 && fluxRatio >= 1.1) {
    if (stats.slope > 0.03 || fluxRatio >= 1.4) return { type: 'preDrop', intensity: Math.min(0.9, intensity + 0.1), confidence: 0.65 }
    return { type: 'build', intensity: Math.min(0.85, intensity + 0.05), confidence: 0.7 }
  }
  if (energyRatio < 0.85 && fluxRatio < 1.1 && midpointRatio > 0.25 && midpointRatio < 0.85) return { type: 'breakdown', intensity: Math.max(0.3, intensity), confidence: 0.65 }
  if (midpointRatio > 0.45 && midpointRatio < 0.78 && (centroidRatio < 0.8 || centroidRatio > 1.25)) return { type: 'bridge', intensity, confidence: 0.55 }
  if (energyRatio >= 0.7 && energyRatio <= 1.3 && Math.abs(stats.slope) < 0.02) return { type: 'verse', intensity, confidence: 0.7 }
  return { type: 'unknown', intensity, confidence: 0.35 }
}

function refineWithContext(sections: Array<{ type: ReactSectionType; confidence: number }>): void {
  for (let index = 1; index < sections.length; index++) {
    if (sections[index]!.type === 'drop' && sections[index - 1]!.type === 'build') {
      sections[index - 1]!.type = 'preDrop'
      sections[index - 1]!.confidence = Math.max(sections[index - 1]!.confidence, 0.65)
    }
  }
}

function labelToDisplayName(type: ReactSectionType, index: number): string {
  const labels: Record<ReactSectionType, string> = {
    intro: 'Intro', verse: 'Verse', build: 'Build', preDrop: 'Pre-Drop', drop: 'Drop',
    breakdown: 'Breakdown', bridge: 'Bridge', outro: 'Outro', unknown: 'Section',
  }
  return `${labels[type]} ${index + 1}`
}

function crossRegionSimilarity(matrix: Float32Array, dimension: number, aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  if (aEnd <= aStart || bEnd <= bStart) return 0
  return clamp01(matrixAverage(matrix, dimension, aStart, aEnd, bStart, bEnd))
}

function buildStructuralRegions(
  boundaries: number[],
  analyzedBars: NormalizedBar[],
  originalBars: BarMusicalFeatures[],
  candidates: StructuralBoundaryCandidate[],
  matrix: Float32Array,
  durationSec: number,
  gridConfidence: number,
): StructuralRegion[] {
  const dimension = analyzedBars.length
  const candidateAtBoundary = new Map<number, StructuralBoundaryCandidate>()
  candidates.forEach((candidate, index) => candidateAtBoundary.set(index + 1, candidate))
  const prefix = buildMatrixPrefix(matrix, dimension)
  const returnAffinity = buildReturnAffinity(matrix, dimension)
  const regionRanges: Array<{ start: number; end: number }> = []
  const regions: StructuralRegion[] = []

  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index]!
    const end = boundaries[index + 1]!
    if (end <= start) continue
    const startBar = analyzedBars[start]!.startBar
    const endBar = end < dimension ? analyzedBars[end]!.startBar : originalBars.length
    const bars = originalBars.slice(startBar, endBar)
    const startCandidate = candidateAtBoundary.get(start)
    const endCandidate = candidateAtBoundary.get(end)
    const boundaryConfidence = index === 0
      ? endCandidate?.candidateConfidence ?? gridConfidence
      : average([startCandidate?.candidateConfidence ?? gridConfidence, endCandidate?.candidateConfidence ?? gridConfidence])
    regions.push({
      id: `structural-region-${index}`,
      startSec: index === 0 ? 0 : originalBars[startBar]!.startSec,
      endSec: end >= dimension ? durationSec : originalBars[endBar]!.startSec,
      startBar,
      endBar,
      durationBars: endBar - startBar,
      boundaryConfidence: clamp01(boundaryConfidence),
      internalCohesion: intervalCohesion(prefix, dimension, start, end),
      gridConfidence,
      relatedRegions: [],
      analysisSource: 'bar_self_similarity',
      diagnostics: {
        meanEnergy: average(bars.map(bar => bar.meanEnergy)),
        energySlope: average(bars.map(bar => bar.energySlope)),
        transientDensity: average(bars.map(bar => bar.overallTransientDensity)),
        harmonicChange: average(bars.map(bar => bar.harmonicChange)),
        repeatAffinity: averageRange(returnAffinity, start, end),
        phrasePriorScore: phrasePriorScore(endBar - startBar),
      },
    })
    regionRanges.push({ start, end })
  }

  for (let index = 0; index < regions.length; index++) {
    const relations = regions
      .map((region, otherIndex) => ({
        regionId: region.id,
        similarity: otherIndex === index ? 0 : crossRegionSimilarity(
          matrix,
          dimension,
          regionRanges[index]!.start,
          regionRanges[index]!.end,
          regionRanges[otherIndex]!.start,
          regionRanges[otherIndex]!.end,
        ),
      }))
      .filter(relation => relation.similarity >= 0.55)
      .sort((a, b) => b.similarity - a.similarity || a.regionId.localeCompare(b.regionId))
      .slice(0, 3)
    regions[index]!.relatedRegions = relations
  }
  return regions
}

function barGridIsUsable(barFeatures: BarMusicalFeatures[], musicalGrid: MusicalGridInfo | undefined): boolean {
  if (barFeatures.length < 2) return false
  if (barFeatures.some(bar => bar.source !== 'bar_grid')) return false
  if (musicalGrid?.source === 'legacy_fallback') return false
  const gridConfidence = musicalGrid?.confidence.barGrid ?? average(barFeatures.map(bar => bar.gridConfidence))
  return musicalGrid?.authoritative === true || gridConfidence >= GRID_CONFIDENCE_THRESHOLD
}

function boundedCandidateOutput(candidates: StructuralBoundaryCandidate[]): {
  boundaryCandidates: StructuralBoundaryCandidate[]
  alternatives: StructuralBoundaryCandidate[]
} {
  const selected = candidates.filter(candidate => candidate.selected)
  const unselected = candidates
    .filter(candidate => !candidate.selected)
    .sort((a, b) => b.totalScore - a.totalScore || a.timeSec - b.timeSec)
  const alternatives = unselected.slice(0, MAX_ALTERNATIVE_CANDIDATES)
  const retained = [...selected, ...unselected.slice(0, Math.max(0, MAX_PERSISTED_CANDIDATES - selected.length))]
    .sort((a, b) => a.timeSec - b.timeSec)
  return { boundaryCandidates: retained, alternatives }
}

function analyzeBarAligned(
  barFeatures: BarMusicalFeatures[],
  durationSec: number,
  maxSegments: number,
  musicalGrid: MusicalGridInfo | undefined,
): StructuralSegmentationResult {
  const sortedBars = [...barFeatures].sort((a, b) => a.startSec - b.startSec || a.barIndex - b.barIndex)
  const normalized = normalizeBarVectors(sortedBars)
  const { bars: analyzedBars, stride } = buildAnalyzedBars(sortedBars, normalized)
  const matrix = buildSimilarityMatrix(analyzedBars)
  const localEvidence = computeLocalEvidence(normalized)
  const checkerboardNovelty = computeCheckerboardNovelty(matrix, analyzedBars.length)
  const gridConfidence = clamp01(musicalGrid?.confidence.barGrid ?? average(sortedBars.map(bar => bar.gridConfidence)))
  const candidates = buildBoundaryCandidates(sortedBars, analyzedBars, localEvidence, checkerboardNovelty, stride, gridConfidence)
  const selection = selectBoundariesGlobal(analyzedBars, candidates, matrix, maxSegments)
  const selectedSet = new Set(selection.boundaries.slice(1, -1))
  candidates.forEach((candidate, index) => { candidate.selected = selectedSet.has(index + 1) })
  const regions = buildStructuralRegions(selection.boundaries, analyzedBars, sortedBars, candidates, matrix, durationSec, gridConfidence)
  const contextual = classifyContextualSections({
    regions,
    barFeatures: sortedBars,
    durationSec,
    boundaryCandidates: candidates,
  })
  const sections = contextual.sections
  const bounded = boundedCandidateOutput(candidates)
  return {
    sections,
    structuralSegmentation: {
      source: 'bar_self_similarity',
      regions,
      boundaryCandidates: bounded.boundaryCandidates,
      alternativeBoundaryCandidates: bounded.alternatives,
      diagnostics: {
        analyzedBarCount: analyzedBars.length,
        originalBarCount: sortedBars.length,
        selfSimilarityStride: stride,
        matrixDimension: analyzedBars.length,
        matrixBytes: matrix.byteLength,
        candidateCount: candidates.length,
        selectedBoundaryCount: selectedSet.size,
        alternativeCandidateCount: bounded.alternatives.length,
        globalObjectiveScore: selection.objective,
        usedFallback: false,
      },
      contextualDiagnostics: contextual.diagnostics,
    },
  }
}

function computeLegacyNovelty(frames: FeatureFrame[]): number[] {
  const novelty = new Array<number>(frames.length).fill(0)
  for (let index = 1; index < frames.length; index++) {
    const before = frames[index - 1]!
    const after = frames[index]!
    novelty[index] =
      Math.abs(after.energy - before.energy) * 1.0 +
      Math.abs(after.bass - before.bass) * 0.8 +
      Math.abs(after.mid - before.mid) * 0.6 +
      Math.abs(after.high - before.high) * 0.4 +
      Math.abs(after.centroid - before.centroid) * 0.7 +
      Math.abs(after.flux - before.flux) * 0.9
  }
  const smoothed = [...novelty]
  for (let index = 1; index < novelty.length - 1; index++) {
    smoothed[index] = (novelty[index - 1]! + novelty[index]! * 2 + novelty[index + 1]!) / 4
  }
  return normalizeEvidence(smoothed, 0.08)
}

function analyzeFallback(
  energyCurves: { instant: FeatureCurve; bass: FeatureCurve; mid: FeatureCurve; high: FeatureCurve },
  spectralCurves: { centroid: FeatureCurve; flux: FeatureCurve },
  durationSec: number,
  minSegmentSec: number,
  maxSegments: number,
  noveltyThreshold: number,
): StructuralSegmentationResult {
  const frames = buildFrames(energyCurves, spectralCurves, durationSec)
  if (frames.length < 2) {
    return {
      sections: [],
      structuralSegmentation: {
        source: 'time_domain_fallback', regions: [], boundaryCandidates: [], alternativeBoundaryCandidates: [],
        diagnostics: {
          analyzedBarCount: 0, originalBarCount: 0, selfSimilarityStride: 0, matrixDimension: 0, matrixBytes: 0,
          candidateCount: 0, selectedBoundaryCount: 0, alternativeCandidateCount: 0, globalObjectiveScore: 0, usedFallback: true,
        },
      },
    }
  }
  const novelty = computeLegacyNovelty(frames)
  const candidateIndices: number[] = []
  for (let index = 1; index < novelty.length - 1; index++) {
    if (novelty[index]! >= noveltyThreshold && novelty[index]! >= novelty[index - 1]! && novelty[index]! >= novelty[index + 1]!) {
      candidateIndices.push(index)
    }
  }
  // Fallback selection is strongest-first non-max suppression, not the primary grid path.
  const selectedIndices: number[] = []
  for (const index of [...candidateIndices].sort((a, b) => novelty[b]! - novelty[a]! || a - b)) {
    const timeSec = frames[index]!.timeSec
    if (selectedIndices.every(selected => Math.abs(frames[selected]!.timeSec - timeSec) >= minSegmentSec)) selectedIndices.push(index)
    if (selectedIndices.length >= Math.max(0, maxSegments - 1)) break
  }
  selectedIndices.sort((a, b) => a - b)
  const boundaries = [0, ...selectedIndices, frames.length]
  const means = computeTrackMeans(frames)
  const classified = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]!
    const startSec = index === 0 ? 0 : frames[start]!.timeSec
    const endSec = end < frames.length ? frames[end]!.timeSec : durationSec
    return {
      start,
      end,
      startSec,
      endSec,
      ...labelSegment(segmentStats(frames, start, end), means, ((startSec + endSec) * 0.5) / Math.max(EPS, durationSec)),
    }
  })
  refineWithContext(classified)
  const sections: TrackSectionMI[] = classified.map((segment, index) => ({
    id: `auto-sec-${index}`,
    label: labelToDisplayName(segment.type, index),
    type: segment.type,
    startSec: segment.startSec,
    endSec: segment.endSec,
    intensity: segment.intensity,
    confidence: Math.min(0.45, segment.confidence),
    boundaryConfidence: Math.min(0.45, segment.confidence),
    labelConfidence: Math.min(0.45, segment.confidence),
    gridConfidence: 0,
    analysisConfidence: Math.min(0.45, segment.confidence),
    dropConfidence: segment.type === 'drop' ? Math.min(0.35, segment.confidence) : 0,
    source: 'analysis',
    interpretation: {
      startBar: null,
      endBar: null,
      durationBars: null,
      energyShape: segment.type === 'build' || segment.type === 'preDrop'
        ? 'rising'
        : segment.type === 'outro'
          ? 'falling'
          : 'stable',
      densityCategory: segment.intensity >= 0.72 ? 'dense' : segment.intensity <= 0.34 ? 'sparse' : 'moderate',
      rhythmicCharacter: 'steady',
      harmonicCharacter: 'unavailable',
      entryImpact: 0,
      exitTransition: 'continuous',
      alternativeLabels: [{ type: segment.type, confidence: 1 }],
      classificationDiagnostics: {
        scores: { [segment.type]: Math.min(0.45, segment.confidence) },
        evidence: ['Legacy time-domain fallback used because a reliable musical grid was unavailable.'],
        sourceRegionIds: [`structural-region-${index}`],
      },
    },
  }))
  const candidates: StructuralBoundaryCandidate[] = candidateIndices.map(index => ({
    barIndex: null,
    timeSec: frames[index]!.timeSec,
    totalScore: novelty[index]!,
    acousticNovelty: novelty[index]!,
    rhythmicNovelty: novelty[index]! * 0.5,
    harmonicNovelty: 0,
    selfSimilarityNovelty: 0,
    energyTransitionEvidence: novelty[index]!,
    silenceOrImpactEvidence: 0,
    gridConfidence: 0,
    candidateConfidence: Math.min(0.45, novelty[index]! * 0.45),
    selected: selectedIndices.includes(index),
    offGrid: true,
  }))
  const regions: StructuralRegion[] = sections.map((section, index) => ({
    id: `structural-region-${index}`,
    startSec: section.startSec,
    endSec: section.endSec,
    startBar: null,
    endBar: null,
    durationBars: null,
    boundaryConfidence: section.confidence,
    internalCohesion: 0,
    gridConfidence: 0,
    relatedRegions: [],
    analysisSource: 'time_domain_fallback',
    diagnostics: {
      meanEnergy: segmentStats(frames, boundaries[index]!, boundaries[index + 1]!).energy,
      energySlope: segmentStats(frames, boundaries[index]!, boundaries[index + 1]!).slope,
      transientDensity: 0,
      harmonicChange: 0,
      repeatAffinity: 0,
      phrasePriorScore: 0,
    },
  }))
  const bounded = boundedCandidateOutput(candidates)
  return {
    sections,
    structuralSegmentation: {
      source: 'time_domain_fallback',
      regions,
      boundaryCandidates: bounded.boundaryCandidates,
      alternativeBoundaryCandidates: bounded.alternatives,
      diagnostics: {
        analyzedBarCount: 0,
        originalBarCount: 0,
        selfSimilarityStride: 0,
        matrixDimension: 0,
        matrixBytes: 0,
        candidateCount: candidates.length,
        selectedBoundaryCount: selectedIndices.length,
        alternativeCandidateCount: bounded.alternatives.length,
        globalObjectiveScore: selectedIndices.reduce((sum, index) => sum + novelty[index]!, 0),
        usedFallback: true,
      },
    },
  }
}

export function analyzeStructuralRegions(
  energyCurves: { instant: FeatureCurve; bass: FeatureCurve; mid: FeatureCurve; high: FeatureCurve },
  spectralCurves: { centroid: FeatureCurve; flux: FeatureCurve; complexity: FeatureCurve },
  durationSec: number,
  options: SectionDetectionOptions = {},
): StructuralSegmentationResult {
  const minSegmentSec = options.minSegmentSec ?? 8
  const maxSegments = options.maxSegments ?? DEFAULT_MAX_SEGMENTS
  const noveltyThreshold = options.noveltyThreshold ?? 0.25
  if (durationSec < 0.05) return analyzeFallback(energyCurves, spectralCurves, durationSec, minSegmentSec, maxSegments, noveltyThreshold)
  const barFeatures = options.barFeatures?.filter(bar => Number.isFinite(bar.startSec) && Number.isFinite(bar.endSec) && bar.endSec > bar.startSec) ?? []
  if (barGridIsUsable(barFeatures, options.musicalGrid)) {
    return analyzeBarAligned(barFeatures, durationSec, maxSegments, options.musicalGrid)
  }
  return analyzeFallback(energyCurves, spectralCurves, durationSec, minSegmentSec, maxSegments, noveltyThreshold)
}

/** Backward-compatible section API used by existing consumers. */
export function detectSections(
  energyCurves: { instant: FeatureCurve; bass: FeatureCurve; mid: FeatureCurve; high: FeatureCurve },
  spectralCurves: { centroid: FeatureCurve; flux: FeatureCurve; complexity: FeatureCurve },
  durationSec: number,
  options: SectionDetectionOptions = {},
): TrackSectionMI[] {
  return analyzeStructuralRegions(energyCurves, spectralCurves, durationSec, options).sections
}
