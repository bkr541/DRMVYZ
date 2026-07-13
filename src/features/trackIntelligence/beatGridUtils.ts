import type {
  BeatMarkerMI,
  PhraseMarker,
  FeatureCurve,
  StemFeatureCurve,
  TrackSectionMI,
  TrackIntelligenceAnalysis,
  BarMarkerMI,
  BarMusicalFeatures,
  MusicalGridInfo,
} from '../musicIntelligence/types'
import { aggregateBarFeatures, buildBarMarkers } from '../musicIntelligence/musicalGridAnalysis'

/**
 * Builds a beat grid from a manual BPM override.
 *
 * Uses index-based timestamps (`offset + beatIndex * beatPeriod`) so there is
 * no floating-point accumulation drift across long tracks.
 *
 * The firstBeatOffsetSec preserves the analyzed phase anchor: if the detector
 * found the first beat at 0.18 s, the regenerated grid starts at 0.18 s rather
 * than 0, keeping bar boundaries aligned with the original feel.
 *
 * If firstBeatOffsetSec is larger than one beat period it is reduced modulo
 * beatPeriod (matching the existing buildBeatMarkers convention).
 */
export function buildEffectiveBeatGrid(
  bpm:                number,
  durationSec:        number,
  firstBeatOffsetSec: number = 0,
  beatsPerBar:        number = 4,
  downbeatPhase:      number = 0,
): BeatMarkerMI[] {
  if (bpm <= 0 || durationSec <= 0) return []

  const beatPeriodSec = 60 / bpm

  // Normalize offset into [0, beatPeriod) — same behaviour as buildBeatMarkers.
  let offset = firstBeatOffsetSec
  if (offset > beatPeriodSec) offset = offset % beatPeriodSec

  const markers: BeatMarkerMI[] = []
  let beatIndex = 0

  while (true) {
    const timeSec = offset + beatIndex * beatPeriodSec
    // Allow a tiny epsilon so a beat landing exactly on durationSec is included.
    if (timeSec > durationSec + 1e-9) break
    const normalizedPhase = ((Math.floor(downbeatPhase) % beatsPerBar) + beatsPerBar) % beatsPerBar
    const beatWithinBar = ((beatIndex - normalizedPhase) % beatsPerBar + beatsPerBar) % beatsPerBar
    const pickupShift = normalizedPhase > 0 ? beatsPerBar - normalizedPhase : 0
    markers.push({
      timeSec,
      confidence:  1.0,
      isDownbeat:  beatWithinBar === 0,
      bpm,
      beatIndex,
      beatWithinBar,
      barIndex: Math.max(0, Math.floor((beatIndex + pickupShift) / beatsPerBar)),
      gridSource: 'manual_correction',
      gridConfidence: 1,
    })
    beatIndex++
  }

  return markers
}

// ── Phrase generation ─────────────────────────────────────────────────────────

/**
 * Derives phrase boundary markers from a beat grid.
 * Emits one PhraseMarker per (beat, phraseLength) pair at each boundary.
 * Phrase lengths 4/8/16/32 are all emitted independently so consumers can
 * filter by phraseLength without re-computing.
 * Pure and deterministic — does not touch audio data.
 */
export function buildPhrasesFromGrid(
  beatGrid:    BeatMarkerMI[],
  beatsPerBar: number = 4,
): PhraseMarker[] {
  if (beatGrid.length === 0) return []

  const phraseLengths: Array<4 | 8 | 16 | 32> = [4, 8, 16, 32]
  const markers: PhraseMarker[] = []

  // Only emit at beat indices that are downbeats (bar starts), since phrases
  // align to bar boundaries. Beat indices are relative within the grid array.
  beatGrid.forEach((beat, idx) => {
    if (!beat.isDownbeat) return
    const barIndex = Math.round(idx / beatsPerBar)
    for (const len of phraseLengths) {
      if (barIndex % (len / beatsPerBar) === 0) {
        markers.push({ timeSec: beat.timeSec, phraseLength: len, confidence: 1.0 })
      }
    }
  })

  return markers
}

// ── Energy curve helpers ──────────────────────────────────────────────────────

/**
 * Returns the linearly-interpolated value from a FeatureCurve at a given time.
 * Returns 0 when the curve is empty or the time is out of range.
 */
function sampleCurveAt(curve: FeatureCurve, timeSec: number): number {
  if (curve.length === 0) return 0
  if (timeSec <= curve[0]!.timeSec) return curve[0]!.value
  if (timeSec >= curve[curve.length - 1]!.timeSec) return curve[curve.length - 1]!.value

  let lo = 0, hi = curve.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (curve[mid]!.timeSec <= timeSec) lo = mid; else hi = mid
  }
  const a = curve[lo]!, b = curve[hi]!
  const t = (timeSec - a.timeSec) / (b.timeSec - a.timeSec)
  return a.value + t * (b.value - a.value)
}

/** Average of a FeatureCurve over [startSec, endSec). */
function averageCurveWindow(curve: FeatureCurve, startSec: number, endSec: number): number {
  if (curve.length === 0 || endSec <= startSec) return 0
  // Sample at start, end, and each curve point inside the window.
  const pts: number[] = [sampleCurveAt(curve, startSec), sampleCurveAt(curve, endSec)]
  for (const p of curve) {
    if (p.timeSec > startSec && p.timeSec < endSec) pts.push(p.value)
  }
  return pts.reduce((s, v) => s + v, 0) / pts.length
}

/**
 * Returns the average energy from an energy curve over each beat's time window.
 * The window for beat[i] spans [beat[i].timeSec, beat[i+1].timeSec).
 * Pure — does not touch audio or stem data.
 */
export function computeBeatEnergySummaries(
  beatGrid:    BeatMarkerMI[],
  energyCurve: FeatureCurve,
): Array<{ timeSec: number; energy: number }> {
  if (beatGrid.length === 0) return []
  return beatGrid.map((beat, i) => {
    const next = beatGrid[i + 1]
    const end  = next ? next.timeSec : beat.timeSec + 60 / 120 // fallback: 120 bpm period
    return { timeSec: beat.timeSec, energy: averageCurveWindow(energyCurve, beat.timeSec, end) }
  })
}

/**
 * Returns the average energy from an energy curve over each bar (downbeat to downbeat).
 * Pure — does not touch audio or stem data.
 */
export function computeBarEnergySummaries(
  beatGrid:    BeatMarkerMI[],
  energyCurve: FeatureCurve,
): Array<{ timeSec: number; energy: number }> {
  const downbeats = beatGrid.filter(b => b.isDownbeat)
  if (downbeats.length === 0) return []
  return downbeats.map((db, i) => {
    const next = downbeats[i + 1]
    const end  = next ? next.timeSec : db.timeSec + 2
    return { timeSec: db.timeSec, energy: averageCurveWindow(energyCurve, db.timeSec, end) }
  })
}

// ── Stem summaries ────────────────────────────────────────────────────────────

export type StemGroupBy = 'beat' | 'bar'

export interface StemSummaryEntry {
  timeSec:     number
  vocals:      number
  drums:       number
  bass:        number
  instruments: number
  other:       number
}

/**
 * Samples stem energy curves grouped by beat or bar.
 * Returns one entry per beat (or downbeat) with per-stem average energies.
 * Pure — does not touch audio, waveform, key, or lyric data.
 */
export function computeStemSummaries(
  beatGrid:   BeatMarkerMI[],
  stemCurves: StemFeatureCurve,
  groupBy:    StemGroupBy,
): StemSummaryEntry[] {
  const grid = groupBy === 'bar' ? beatGrid.filter(b => b.isDownbeat) : beatGrid
  if (grid.length === 0) return []

  return grid.map((beat, i) => {
    const next = grid[i + 1]
    const end  = next ? next.timeSec : beat.timeSec + 2
    const s    = beat.timeSec
    return {
      timeSec:     s,
      vocals:      averageCurveWindow(stemCurves.vocals.energy,      s, end),
      drums:       averageCurveWindow(stemCurves.drums.energy,       s, end),
      bass:        averageCurveWindow(stemCurves.bass.energy,        s, end),
      instruments: averageCurveWindow(stemCurves.instruments.energy, s, end),
      other:       averageCurveWindow(stemCurves.other.energy,       s, end),
    }
  })
}

// ── Timestamp snapping ────────────────────────────────────────────────────────

/** Returns the nearest timeSec from a non-empty array of candidates. */
function nearestTime(timeSec: number, candidates: number[]): number {
  if (candidates.length === 0) return timeSec
  let best = candidates[0]!
  let bestDist = Math.abs(timeSec - best)
  for (let i = 1; i < candidates.length; i++) {
    const d = Math.abs(timeSec - candidates[i]!)
    if (d < bestDist) { bestDist = d; best = candidates[i]! }
    // Candidates are sorted; once distance starts growing we can stop.
    else if (d > bestDist) break
  }
  return best
}

/**
 * Re-snaps a timestamp to the nearest beat, downbeat (= bar start), or bar
 * boundary in the supplied beat grid.
 *
 * 'downbeat' and 'bar' are equivalent — both snap to the start of the nearest
 * bar (the nearest marker where isDownbeat === true).
 *
 * Returns the input unchanged when the grid is empty.
 * Pure — no side effects.
 */
export function snapToGrid(
  timeSec:  number,
  beatGrid: BeatMarkerMI[],
  target:   'beat' | 'downbeat' | 'bar',
): number {
  if (beatGrid.length === 0) return timeSec
  const candidates =
    target === 'beat'
      ? beatGrid.map(b => b.timeSec)
      : beatGrid.filter(b => b.isDownbeat).map(b => b.timeSec)
  return nearestTime(timeSec, candidates)
}

/**
 * Re-snaps a timestamp to the nearest section boundary (start or end of any section).
 * Returns the input unchanged when no sections are provided.
 * Pure — no side effects.
 */
export function snapToSectionBoundary(
  timeSec:  number,
  sections: Pick<TrackSectionMI, 'startSec' | 'endSec'>[],
): number {
  if (sections.length === 0) return timeSec
  const boundaries = sections.flatMap(s => [s.startSec, s.endSec])
  boundaries.sort((a, b) => a - b)
  return nearestTime(timeSec, boundaries)
}

// ── Grid rebuild ──────────────────────────────────────────────────────────────

export interface BpmDependentData {
  beatGrid:           BeatMarkerMI[]
  downbeats:          BeatMarkerMI[]
  phrases:            PhraseMarker[]
  barMarkers:         BarMarkerMI[]
  barFeatures:        BarMusicalFeatures[]
  musicalGrid:        MusicalGridInfo
  bpmUsedForGrid:     number
  lastGridRebuiltAt:  string
  lastReanalysisMode: 'grid_only'
  gridStale:          false
}

/**
 * Rebuilds all BPM-dependent fields from an existing analysis using a new BPM.
 *
 * Preserves the original beat-grid offset from analysis.beatGridOffsetSec so
 * bar boundaries stay phase-aligned with the original analysis feel.
 *
 * Does NOT modify:
 *   energyCurves, spectralCurves, stemCurves, harmonic, lyrics,
 *   durationMs, bpm (detected), bpmConfidence, semanticMoments,
 *   raw transient timestamps, waveform peaks, key detection, chroma data.
 *
 * Sections with source === 'manual' or locked === true are NOT returned in the
 * output — callers must merge those back in from the original analysis when
 * applying the result.
 *
 * Pure and deterministic — no audio decoding, no network calls, no side effects.
 */
export function rebuildBpmDependentData(
  analysis:    TrackIntelligenceAnalysis,
  bpm:         number,
  beatsPerBar: number = analysis.timeSignature ?? 4,
): BpmDependentData {
  const durationSec  = analysis.durationMs / 1000
  const offsetSec    = analysis.beatGridOffsetSec ?? 0
  const existingPhase = analysis.musicalGrid?.downbeatPhase
    ?? analysis.beatGrid.findIndex(marker => marker.isDownbeat)
  const downbeatPhase = existingPhase != null && existingPhase >= 0 ? existingPhase : 0

  const beatGrid  = buildEffectiveBeatGrid(bpm, durationSec, offsetSec, beatsPerBar, downbeatPhase)
  const downbeats = beatGrid.filter(b => b.isDownbeat)
  const phrases   = buildPhrasesFromGrid(beatGrid, beatsPerBar)
  const barMarkers = buildBarMarkers(beatGrid, durationSec, 'manual_correction', 1)
  const deriveOnset = (curve: FeatureCurve): FeatureCurve => curve.map((point, index) => ({
    timeSec: point.timeSec,
    value: index === 0 ? 0 : Math.max(0, point.value - curve[index - 1]!.value),
  }))
  const silence = analysis.energyCurves.instant.map(point => ({
    timeSec: point.timeSec,
    value: point.value < 0.035 ? 1 : 0,
  }))
  const barFeatures = aggregateBarFeatures(barMarkers, {
    energy: analysis.energyCurves.instant,
    bass: analysis.energyCurves.bass,
    mid: analysis.energyCurves.mid,
    high: analysis.energyCurves.high,
    spectralFlux: analysis.spectralCurves.flux,
    spectralCentroid: analysis.spectralCurves.centroid,
    spectralComplexity: analysis.spectralCurves.complexity,
    transient: analysis.spectralCurves.flux,
    lowFrequencyOnset: deriveOnset(analysis.energyCurves.bass),
    midFrequencyOnset: deriveOnset(analysis.energyCurves.mid),
    highFrequencyOnset: deriveOnset(analysis.energyCurves.high),
    silence,
  }, durationSec)
  const musicalGrid: MusicalGridInfo = {
    source: 'manual_correction',
    fallbackReason: null,
    timeSignature: beatsPerBar,
    downbeatPhase,
    beatPeriodSec: 60 / bpm,
    authoritative: true,
    confidence: {
      bpm: 1,
      beatPhase: 1,
      downbeatPhase: analysis.downbeatPhaseConfidence ?? analysis.musicalGrid?.confidence.downbeatPhase ?? 1,
      barGrid: 1,
    },
  }

  return {
    beatGrid,
    downbeats,
    phrases,
    barMarkers,
    barFeatures,
    musicalGrid,
    bpmUsedForGrid:     bpm,
    lastGridRebuiltAt:  new Date().toISOString(),
    lastReanalysisMode: 'grid_only',
    gridStale:          false,
  }
}
