import type {
  BarMarkerMI,
  BarMusicalFeatures,
  BeatMarkerMI,
  FeatureCurve,
  MusicalGridFallbackReason,
  MusicalGridInfo,
  MusicalGridSource,
  PhraseMarker,
} from './types'

const EPS = 1e-9
const DEFAULT_TIME_SIGNATURE = 4
const DOWNBEAT_CONFIDENCE_THRESHOLD = 0.42

export interface ChromaFrame {
  timeSec: number
  values: number[]
}

export interface MusicalFeatureCurves {
  energy: FeatureCurve
  bass: FeatureCurve
  mid: FeatureCurve
  high: FeatureCurve
  spectralFlux: FeatureCurve
  spectralCentroid: FeatureCurve
  spectralComplexity: FeatureCurve
  transient: FeatureCurve
  lowFrequencyOnset: FeatureCurve
  midFrequencyOnset: FeatureCurve
  highFrequencyOnset: FeatureCurve
  silence: FeatureCurve
  chromaFrames?: ChromaFrame[]
}

export interface DownbeatResolution {
  phase: number
  confidence: number
  phaseScores: number[]
  fallbackReason: MusicalGridFallbackReason
  authoritative: boolean
}

export interface MusicalGridResolution {
  beatGrid: BeatMarkerMI[]
  downbeats: BeatMarkerMI[]
  bars: BarMarkerMI[]
  phrases: PhraseMarker[]
  info: MusicalGridInfo
  beatGridOffsetSec: number | null
  phaseScores: number[]
}

export interface ResolveMusicalGridInput {
  durationSec: number
  bpm: number | null
  bpmConfidence: number | null
  beatPhaseConfidence: number | null
  beatOffsetSec: number | null
  timeSignature?: number
  source: MusicalGridSource
  importedBeatGrid?: BeatMarkerMI[]
  importedDownbeats?: BeatMarkerMI[]
  features: Pick<MusicalFeatureCurves,
    'energy' | 'transient' | 'lowFrequencyOnset' | 'highFrequencyOnset'>
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function finiteNonNegative(value: number, fallback = 0): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function sampleCurveAt(curve: FeatureCurve, timeSec: number): number {
  if (curve.length === 0 || !Number.isFinite(timeSec)) return 0
  if (timeSec <= curve[0]!.timeSec) return finiteNonNegative(curve[0]!.value)
  if (timeSec >= curve[curve.length - 1]!.timeSec) return finiteNonNegative(curve[curve.length - 1]!.value)

  let lo = 0
  let hi = curve.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (curve[mid]!.timeSec <= timeSec) lo = mid
    else hi = mid
  }
  const a = curve[lo]!
  const b = curve[hi]!
  const span = b.timeSec - a.timeSec
  if (span <= EPS) return finiteNonNegative(a.value)
  const ratio = clamp01((timeSec - a.timeSec) / span)
  return finiteNonNegative(a.value + (b.value - a.value) * ratio)
}

function nearestBeatIndex(beatGrid: BeatMarkerMI[], timeSec: number, toleranceSec: number): number | null {
  if (beatGrid.length === 0) return null
  let lo = 0
  let hi = beatGrid.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (beatGrid[mid]!.timeSec < timeSec) lo = mid + 1
    else hi = mid
  }
  const candidates = [lo, lo - 1].filter(index => index >= 0 && index < beatGrid.length)
  let bestIndex: number | null = null
  let bestDistance = Infinity
  for (const index of candidates) {
    const distance = Math.abs(beatGrid[index]!.timeSec - timeSec)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestDistance <= toleranceSec ? bestIndex : null
}

function inferBeatPeriod(beatGrid: BeatMarkerMI[], bpm: number | null): number | null {
  if (bpm != null && Number.isFinite(bpm) && bpm > 0) return 60 / bpm
  const deltas: number[] = []
  for (let index = 1; index < beatGrid.length; index++) {
    const delta = beatGrid[index]!.timeSec - beatGrid[index - 1]!.timeSec
    if (delta > 0.1 && delta < 3) deltas.push(delta)
  }
  if (deltas.length === 0) return null
  deltas.sort((a, b) => a - b)
  return deltas[Math.floor(deltas.length / 2)] ?? null
}

function normalizeImportedBeatGrid(
  beatGrid: BeatMarkerMI[],
  durationSec: number,
  source: MusicalGridSource,
  confidence: number,
): BeatMarkerMI[] {
  const sorted = beatGrid
    .filter(marker => Number.isFinite(marker.timeSec) && marker.timeSec >= 0 && marker.timeSec <= durationSec + EPS)
    .sort((a, b) => a.timeSec - b.timeSec)

  const result: BeatMarkerMI[] = []
  for (const marker of sorted) {
    const previous = result[result.length - 1]
    if (previous && marker.timeSec - previous.timeSec <= 1e-4) continue
    result.push({
      ...marker,
      timeSec: finiteNonNegative(marker.timeSec),
      confidence: clamp01(marker.confidence || confidence),
      gridSource: source,
      gridConfidence: confidence,
    })
  }
  return result
}

export function buildBeatMarkers(
  bpm: number,
  offsetSec: number,
  durationSec: number,
  options: {
    timeSignature?: number
    downbeatPhase?: number
    source?: MusicalGridSource
    confidence?: number
  } = {},
): BeatMarkerMI[] {
  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(durationSec) || durationSec <= 0) return []
  const timeSignature = Math.max(1, Math.floor(options.timeSignature ?? DEFAULT_TIME_SIGNATURE))
  const beatPeriodSec = 60 / bpm
  let offset = Number.isFinite(offsetSec) ? offsetSec : 0
  offset = ((offset % beatPeriodSec) + beatPeriodSec) % beatPeriodSec
  const downbeatPhase = ((Math.floor(options.downbeatPhase ?? 0) % timeSignature) + timeSignature) % timeSignature
  const source = options.source ?? 'automatic'
  const confidence = clamp01(options.confidence ?? 0.85)
  const markers: BeatMarkerMI[] = []

  const maxBeats = Math.ceil((durationSec - offset) / beatPeriodSec) + 1
  for (let beatIndex = 0; beatIndex < maxBeats; beatIndex++) {
    const timeSec = offset + beatIndex * beatPeriodSec
    if (timeSec >= durationSec - EPS) break
    if (timeSec < -EPS) continue
    const beatWithinBar = ((beatIndex - downbeatPhase) % timeSignature + timeSignature) % timeSignature
    const pickupShift = downbeatPhase > 0 ? timeSignature - downbeatPhase : 0
    const barIndex = Math.max(0, Math.floor((beatIndex + pickupShift) / timeSignature))
    markers.push({
      timeSec: Math.max(0, Math.min(durationSec, timeSec)),
      confidence,
      isDownbeat: beatWithinBar === 0,
      bpm,
      beatIndex,
      beatWithinBar,
      barIndex,
      gridSource: source,
      gridConfidence: confidence,
    })
  }
  return markers
}

function evidenceAtBeat(
  timeSec: number,
  beatPeriodSec: number,
  features: ResolveMusicalGridInput['features'],
): number {
  const lowOnset = sampleCurveAt(features.lowFrequencyOnset, timeSec)
  const transient = sampleCurveAt(features.transient, timeSec)
  const highImpact = sampleCurveAt(features.highFrequencyOnset, timeSec)
  const before = sampleCurveAt(features.energy, Math.max(0, timeSec - beatPeriodSec * 0.38))
  const after = sampleCurveAt(features.energy, timeSec + beatPeriodSec * 0.32)
  const energyRise = clamp01(0.5 + (after - before) * 0.75)
  const preSilence = clamp01(1 - sampleCurveAt(features.energy, Math.max(0, timeSec - beatPeriodSec * 0.65)))
  const preFill = sampleCurveAt(features.highFrequencyOnset, Math.max(0, timeSec - beatPeriodSec * 0.45))

  return clamp01(
    lowOnset * 0.28 +
    transient * 0.22 +
    highImpact * 0.12 +
    energyRise * 0.16 +
    preSilence * 0.10 +
    preFill * 0.12,
  )
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[], average: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Evaluate every possible phase of the configured meter. For 4/4 this is the
 * required four-phase downbeat evaluation. Imported/manual downbeats win before
 * any acoustic scoring is considered.
 */
export function resolveDownbeatPhase(
  beatGrid: BeatMarkerMI[],
  features: ResolveMusicalGridInput['features'],
  options: {
    timeSignature?: number
    bpm?: number | null
    authoritativeDownbeats?: BeatMarkerMI[]
  } = {},
): DownbeatResolution {
  const timeSignature = Math.max(1, Math.floor(options.timeSignature ?? DEFAULT_TIME_SIGNATURE))
  const phaseScores = new Array<number>(timeSignature).fill(0)
  if (beatGrid.length === 0) {
    return {
      phase: 0,
      confidence: 0,
      phaseScores,
      fallbackReason: 'insufficient_features',
      authoritative: false,
    }
  }

  const beatPeriodSec = inferBeatPeriod(beatGrid, options.bpm ?? null) ?? 0.5
  const authoritativeDownbeats = (options.authoritativeDownbeats ?? []).filter(marker => Number.isFinite(marker.timeSec))
  if (authoritativeDownbeats.length > 0) {
    const phaseCounts = new Array<number>(timeSignature).fill(0)
    const tolerance = Math.max(0.04, Math.min(0.16, beatPeriodSec * 0.25))
    for (const marker of authoritativeDownbeats) {
      const index = nearestBeatIndex(beatGrid, marker.timeSec, tolerance)
      if (index != null) phaseCounts[index % timeSignature]++
    }
    const maxCount = Math.max(...phaseCounts)
    if (maxCount > 0) {
      const phase = phaseCounts.indexOf(maxCount)
      for (let index = 0; index < timeSignature; index++) {
        phaseScores[index] = phaseCounts[index]! / authoritativeDownbeats.length
      }
      return {
        phase,
        confidence: clamp01(0.95 + 0.05 * (maxCount / authoritativeDownbeats.length)),
        phaseScores,
        fallbackReason: null,
        authoritative: true,
      }
    }
  }

  const allEvidence = beatGrid.map(marker => evidenceAtBeat(marker.timeSec, beatPeriodSec, features))
  const allMean = mean(allEvidence)

  for (let phase = 0; phase < timeSignature; phase++) {
    const candidates = allEvidence.filter((_value, index) => index % timeSignature === phase)
    const candidateMean = mean(candidates)
    const consistency = candidates.length > 1
      ? clamp01(1 - standardDeviation(candidates, candidateMean) / Math.max(0.15, candidateMean))
      : 0.35
    const contrast = clamp01(0.5 + (candidateMean - allMean) * 1.5)
    phaseScores[phase] = clamp01(candidateMean * 0.62 + consistency * 0.20 + contrast * 0.18)
  }

  const ranked = phaseScores
    .map((score, phase) => ({ score, phase }))
    .sort((a, b) => b.score - a.score || a.phase - b.phase)
  const best = ranked[0] ?? { phase: 0, score: 0 }
  const second = ranked[1] ?? { phase: best.phase, score: 0 }
  const margin = Math.max(0, best.score - second.score)
  const confidence = clamp01(best.score * 0.62 + margin * 1.75)
  const fallbackReason = confidence < DOWNBEAT_CONFIDENCE_THRESHOLD
    ? 'downbeat_phase_low_confidence'
    : null

  return {
    phase: fallbackReason ? 0 : best.phase,
    confidence,
    phaseScores,
    fallbackReason,
    authoritative: false,
  }
}

export function estimateBeatPhaseConfidence(
  beatGrid: BeatMarkerMI[],
  transientCurve: FeatureCurve,
  bpm: number | null,
): number {
  if (beatGrid.length < 4 || transientCurve.length === 0) return 0
  const beatPeriodSec = inferBeatPeriod(beatGrid, bpm)
  if (beatPeriodSec == null) return 0
  const onBeat = beatGrid.map(marker => sampleCurveAt(transientCurve, marker.timeSec))
  const offBeat = beatGrid
    .slice(0, -1)
    .map(marker => sampleCurveAt(transientCurve, marker.timeSec + beatPeriodSec * 0.5))
  const onMean = mean(onBeat)
  const offMean = mean(offBeat)
  if (onMean < 0.02) return 0
  const contrast = clamp01((onMean - offMean) / Math.max(0.08, onMean))
  const consistency = clamp01(1 - standardDeviation(onBeat, onMean) / Math.max(0.15, onMean))
  return clamp01(onMean * 0.35 + contrast * 0.45 + consistency * 0.20)
}

function applyPhaseMetadata(
  beatGrid: BeatMarkerMI[],
  phase: number,
  timeSignature: number,
  source: MusicalGridSource,
  confidence: number,
): BeatMarkerMI[] {
  const pickupShift = phase > 0 ? timeSignature - phase : 0
  return beatGrid.map((marker, beatIndex) => {
    const beatWithinBar = ((beatIndex - phase) % timeSignature + timeSignature) % timeSignature
    return {
      ...marker,
      confidence: clamp01(marker.confidence || confidence),
      isDownbeat: beatWithinBar === 0,
      beatIndex,
      beatWithinBar,
      barIndex: Math.max(0, Math.floor((beatIndex + pickupShift) / timeSignature)),
      gridSource: source,
      gridConfidence: confidence,
    }
  })
}

export function buildBarMarkers(
  beatGrid: BeatMarkerMI[],
  durationSec: number,
  source: MusicalGridSource,
  confidence: number,
): BarMarkerMI[] {
  if (durationSec <= 0 || beatGrid.length === 0) return []
  const downbeats = beatGrid.filter(marker => marker.isDownbeat)
  if (downbeats.length === 0) return []

  const bars: BarMarkerMI[] = []
  let barIndex = 0
  const firstDownbeat = downbeats[0]!.timeSec
  if (firstDownbeat > 0.05) {
    bars.push({
      barIndex: barIndex++,
      startSec: 0,
      endSec: Math.min(durationSec, firstDownbeat),
      gridSource: source,
      gridConfidence: confidence,
      isPickup: true,
    })
  }

  for (let index = 0; index < downbeats.length; index++) {
    const startSec = Math.max(0, Math.min(durationSec, downbeats[index]!.timeSec))
    const next = downbeats[index + 1]
    const endSec = Math.max(startSec, Math.min(durationSec, next?.timeSec ?? durationSec))
    if (endSec - startSec <= EPS) continue
    bars.push({
      barIndex: barIndex++,
      startSec,
      endSec,
      gridSource: source,
      gridConfidence: confidence,
    })
  }
  return bars
}

function buildPhrases(beatGrid: BeatMarkerMI[], timeSignature: number): PhraseMarker[] {
  const phraseLengths: Array<4 | 8 | 16 | 32> = [4, 8, 16, 32]
  const phrases: PhraseMarker[] = []
  for (const beat of beatGrid) {
    if (!beat.isDownbeat || beat.barIndex == null) continue
    for (const phraseLength of phraseLengths) {
      const barsPerPhrase = Math.max(1, phraseLength / timeSignature)
      if (beat.barIndex % barsPerPhrase === 0) {
        phrases.push({
          timeSec: beat.timeSec,
          phraseLength,
          confidence: beat.gridConfidence ?? beat.confidence,
        })
      }
    }
  }
  return phrases
}

export function resolveMusicalGrid(input: ResolveMusicalGridInput): MusicalGridResolution {
  const durationSec = Math.max(0, finiteNonNegative(input.durationSec))
  const timeSignature = Math.max(1, Math.floor(input.timeSignature ?? DEFAULT_TIME_SIGNATURE))
  const source = input.source
  const authoritativeSource = source === 'imported' || source === 'manual_correction' || source === 'locked_user'
  const normalizedImported = normalizeImportedBeatGrid(
    input.importedBeatGrid ?? [],
    durationSec,
    source,
    clamp01(input.beatPhaseConfidence ?? input.bpmConfidence ?? 0.95),
  )

  if (durationSec <= 0.05) {
    return emptyGridResolution(source, timeSignature, 'insufficient_duration')
  }

  let baseGrid = normalizedImported
  let bpm = input.bpm
  if ((bpm == null || bpm <= 0) && baseGrid.length >= 2) {
    const period = inferBeatPeriod(baseGrid, null)
    bpm = period != null && period > 0 ? 60 / period : null
  }
  if (baseGrid.length === 0 && bpm != null && bpm > 0) {
    baseGrid = buildBeatMarkers(bpm, input.beatOffsetSec ?? 0, durationSec, {
      timeSignature,
      downbeatPhase: 0,
      source,
      confidence: clamp01(input.beatPhaseConfidence ?? input.bpmConfidence ?? 0.5),
    })
  }
  if (baseGrid.length < 2 || bpm == null || bpm <= 0) {
    const reason: MusicalGridFallbackReason = normalizedImported.length === 0 && (input.importedBeatGrid?.length ?? 0) > 0
      ? 'invalid_imported_grid'
      : 'tempo_unavailable'
    return emptyGridResolution('legacy_fallback', timeSignature, reason)
  }

  const explicitDownbeats = (input.importedDownbeats?.length
    ? input.importedDownbeats
    : authoritativeSource
      ? normalizedImported.filter(marker => marker.isDownbeat)
      : []) ?? []
  const downbeatResolution = resolveDownbeatPhase(baseGrid, input.features, {
    timeSignature,
    bpm,
    authoritativeDownbeats: explicitDownbeats,
  })

  const bpmConfidence = clamp01(input.bpmConfidence ?? (authoritativeSource ? 0.95 : 0.5))
  const beatPhaseConfidence = clamp01(
    input.beatPhaseConfidence ?? estimateBeatPhaseConfidence(baseGrid, input.features.transient, bpm),
  )
  const barGridConfidence = clamp01(Math.min(
    Math.max(0.05, beatPhaseConfidence),
    Math.max(0.05, downbeatResolution.confidence),
  ))
  const fallbackReason = downbeatResolution.fallbackReason
    ?? (beatPhaseConfidence < 0.25 ? 'beat_phase_low_confidence' : null)
  const phase = downbeatResolution.phase
  const beatGrid = applyPhaseMetadata(baseGrid, phase, timeSignature, source, barGridConfidence)
  const downbeats = beatGrid.filter(marker => marker.isDownbeat)
  const bars = buildBarMarkers(beatGrid, durationSec, source, barGridConfidence)
  const beatPeriodSec = inferBeatPeriod(beatGrid, bpm)

  return {
    beatGrid,
    downbeats,
    bars,
    phrases: buildPhrases(beatGrid, timeSignature),
    beatGridOffsetSec: beatGrid[0]?.timeSec ?? input.beatOffsetSec ?? null,
    phaseScores: downbeatResolution.phaseScores,
    info: {
      source,
      fallbackReason,
      timeSignature,
      downbeatPhase: phase,
      beatPeriodSec,
      authoritative: authoritativeSource && downbeatResolution.authoritative,
      confidence: {
        bpm: bpmConfidence,
        beatPhase: beatPhaseConfidence,
        downbeatPhase: downbeatResolution.confidence,
        barGrid: barGridConfidence,
      },
    },
  }
}

function emptyGridResolution(
  source: MusicalGridSource,
  timeSignature: number,
  fallbackReason: MusicalGridFallbackReason,
): MusicalGridResolution {
  return {
    beatGrid: [],
    downbeats: [],
    bars: [],
    phrases: [],
    beatGridOffsetSec: null,
    phaseScores: new Array<number>(timeSignature).fill(0),
    info: {
      source,
      fallbackReason,
      timeSignature,
      downbeatPhase: null,
      beatPeriodSec: null,
      authoritative: false,
      confidence: { bpm: 0, beatPhase: 0, downbeatPhase: 0, barGrid: 0 },
    },
  }
}

function curveValuesInWindow(curve: FeatureCurve, startSec: number, endSec: number): number[] {
  if (curve.length === 0 || endSec <= startSec) return []
  const values = [sampleCurveAt(curve, startSec)]
  for (const point of curve) {
    if (point.timeSec > startSec && point.timeSec < endSec) values.push(finiteNonNegative(point.value))
  }
  values.push(sampleCurveAt(curve, endSec))
  return values
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)))
  return sorted[index] ?? 0
}

function averageChroma(frames: ChromaFrame[] | undefined, startSec: number, endSec: number): number[] {
  if (!frames?.length) return []
  const selected = frames.filter(frame => frame.timeSec >= startSec && frame.timeSec < endSec && frame.values.length === 12)
  if (selected.length === 0) return []
  const result = new Array<number>(12).fill(0)
  for (const frame of selected) {
    for (let index = 0; index < 12; index++) result[index] += finiteNonNegative(frame.values[index] ?? 0)
  }
  const total = result.reduce((sum, value) => sum + value, 0)
  if (total <= EPS) return result
  return result.map(value => value / total)
}

function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== 12 || b.length !== 12) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let index = 0; index < 12; index++) {
    dot += a[index]! * b[index]!
    normA += a[index]! ** 2
    normB += b[index]! ** 2
  }
  if (normA <= EPS || normB <= EPS) return 0
  return clamp01(1 - dot / Math.sqrt(normA * normB))
}

function fallbackWindows(durationSec: number): BarMarkerMI[] {
  if (durationSec <= 0) return []
  const windowSec = durationSec < 4 ? Math.max(0.5, durationSec / 2) : 2
  const markers: BarMarkerMI[] = []
  for (let startSec = 0, barIndex = 0; startSec < durationSec - EPS; startSec += windowSec, barIndex++) {
    markers.push({
      barIndex,
      startSec,
      endSec: Math.min(durationSec, startSec + windowSec),
      gridSource: 'legacy_fallback',
      gridConfidence: 0,
    })
  }
  return markers
}

export function aggregateBarFeatures(
  bars: BarMarkerMI[],
  features: MusicalFeatureCurves,
  durationSec: number,
): BarMusicalFeatures[] {
  const windows = bars.length > 0 ? bars : fallbackWindows(durationSec)
  const source = bars.length > 0 ? 'bar_grid' as const : 'time_window_fallback' as const
  const result: BarMusicalFeatures[] = []
  let previousChroma: number[] = []

  for (const window of windows) {
    if (!Number.isFinite(window.startSec) || !Number.isFinite(window.endSec) || window.endSec <= window.startSec) continue
    const energy = curveValuesInWindow(features.energy, window.startSec, window.endSec)
    const bass = curveValuesInWindow(features.bass, window.startSec, window.endSec)
    const mid = curveValuesInWindow(features.mid, window.startSec, window.endSec)
    const high = curveValuesInWindow(features.high, window.startSec, window.endSec)
    const flux = curveValuesInWindow(features.spectralFlux, window.startSec, window.endSec)
    const centroid = curveValuesInWindow(features.spectralCentroid, window.startSec, window.endSec)
    const complexity = curveValuesInWindow(features.spectralComplexity, window.startSec, window.endSec)
    const transient = curveValuesInWindow(features.transient, window.startSec, window.endSec)
    const lowOnset = curveValuesInWindow(features.lowFrequencyOnset, window.startSec, window.endSec)
    const midOnset = curveValuesInWindow(features.midFrequencyOnset, window.startSec, window.endSec)
    const highOnset = curveValuesInWindow(features.highFrequencyOnset, window.startSec, window.endSec)
    const silence = curveValuesInWindow(features.silence, window.startSec, window.endSec)
    const chromaSummary = averageChroma(features.chromaFrames, window.startSec, window.endSec)
    const firstHalf = energy.slice(0, Math.max(1, Math.floor(energy.length / 2)))
    const secondHalf = energy.slice(Math.max(1, Math.floor(energy.length / 2)))
    const meanEnergy = mean(energy)

    result.push({
      barIndex: window.barIndex,
      startSec: Math.max(0, window.startSec),
      endSec: Math.max(window.startSec, Math.min(durationSec, window.endSec)),
      source,
      gridSource: window.gridSource,
      gridConfidence: clamp01(window.gridConfidence),
      meanEnergy,
      peakEnergy: energy.length ? Math.max(...energy) : 0,
      energySlope: clamp01(0.5 + (mean(secondHalf) - mean(firstHalf)) * 0.5) * 2 - 1,
      dynamicRange: clamp01(percentile(energy, 0.9) - percentile(energy, 0.1)),
      bassAverage: mean(bass),
      midAverage: mean(mid),
      highAverage: mean(high),
      spectralFlux: mean(flux),
      spectralCentroid: mean(centroid),
      spectralComplexity: mean(complexity),
      overallTransientDensity: transient.length ? transient.filter(value => value >= 0.22).length / transient.length : 0,
      lowFrequencyOnsetDensity: lowOnset.length ? lowOnset.filter(value => value >= 0.22).length / lowOnset.length : 0,
      midFrequencyOnsetDensity: midOnset.length ? midOnset.filter(value => value >= 0.22).length / midOnset.length : 0,
      highFrequencyOnsetDensity: highOnset.length ? highOnset.filter(value => value >= 0.22).length / highOnset.length : 0,
      silenceRatio: clamp01(mean(silence)),
      chromaSummary,
      harmonicChange: cosineDistance(previousChroma, chromaSummary),
    })
    previousChroma = chromaSummary
  }

  return result
}
