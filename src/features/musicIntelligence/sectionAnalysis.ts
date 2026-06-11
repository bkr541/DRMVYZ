// Offline section detection from feature curves.
// Two-pass: (1) novelty-based boundary detection, (2) heuristic type labeling.

import type { FeatureCurve, TrackSectionMI } from './types'
import type { ReactSectionType } from '../../components/vyzualz/react/ReactTypes'

export interface SectionDetectionOptions {
  minSegmentSec?:   number  // default 8 — merge segments shorter than this
  maxSegments?:     number  // default 20 — hard cap after merging
  noveltyThreshold?: number  // 0–1, default 0.25 — minimum novelty peak height
}

// ── Internal frame representation ────────────────────────────────────────────

interface FeatureFrame {
  timeSec:  number
  energy:   number
  bass:     number
  mid:      number
  high:     number
  centroid: number
  flux:     number
}

// ── Interpolation helper ──────────────────────────────────────────────────────

function sampleCurveAt(curve: FeatureCurve, timeSec: number): number {
  if (curve.length === 0) return 0
  if (timeSec <= curve[0].timeSec) return curve[0].value
  if (timeSec >= curve[curve.length - 1].timeSec) return curve[curve.length - 1].value
  let lo = 0, hi = curve.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (curve[mid].timeSec <= timeSec) lo = mid; else hi = mid
  }
  const t = (timeSec - curve[lo].timeSec) / (curve[hi].timeSec - curve[lo].timeSec + 1e-12)
  return curve[lo].value + t * (curve[hi].value - curve[lo].value)
}

// ── Build frame list at a fixed hop ──────────────────────────────────────────

function buildFrames(
  energyCurves: { instant: FeatureCurve; bass: FeatureCurve; mid: FeatureCurve; high: FeatureCurve },
  spectralCurves: { centroid: FeatureCurve; flux: FeatureCurve },
  durationSec: number,
  hopSec = 0.5,
): FeatureFrame[] {
  const frames: FeatureFrame[] = []
  for (let t = 0; t < durationSec; t += hopSec) {
    frames.push({
      timeSec:  t,
      energy:   sampleCurveAt(energyCurves.instant, t),
      bass:     sampleCurveAt(energyCurves.bass, t),
      mid:      sampleCurveAt(energyCurves.mid, t),
      high:     sampleCurveAt(energyCurves.high, t),
      centroid: sampleCurveAt(spectralCurves.centroid, t),
      flux:     sampleCurveAt(spectralCurves.flux, t),
    })
  }
  return frames
}

// ── Novelty curve (L1 distance of adjacent feature vectors) ──────────────────

function computeNovelty(frames: FeatureFrame[]): number[] {
  if (frames.length < 2) return frames.map(() => 0)
  const novelty = new Array<number>(frames.length).fill(0)
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i]
    novelty[i] =
      Math.abs(b.energy   - a.energy)   * 1.0 +
      Math.abs(b.bass     - a.bass)     * 0.8 +
      Math.abs(b.mid      - a.mid)      * 0.6 +
      Math.abs(b.high     - a.high)     * 0.4 +
      Math.abs(b.centroid - a.centroid) * 0.7 +
      Math.abs(b.flux     - a.flux)     * 0.9
  }
  // Smooth novelty with a 3-frame window to reduce noise
  const smoothed = new Array<number>(novelty.length).fill(0)
  for (let i = 1; i < novelty.length - 1; i++) {
    smoothed[i] = (novelty[i - 1] + novelty[i] * 2 + novelty[i + 1]) / 4
  }
  smoothed[0] = novelty[0]
  smoothed[novelty.length - 1] = novelty[novelty.length - 1]
  return smoothed
}

// ── Peak picking ──────────────────────────────────────────────────────────────

function findNoveltyPeaks(
  novelty: number[],
  minDistFrames: number,
  threshold: number,
): number[] {
  // Normalize to 0–1
  let maxN = 0
  for (const v of novelty) if (v > maxN) maxN = v
  if (maxN < 1e-6) return []

  const peaks: number[] = []
  let lastPeak = -minDistFrames

  for (let i = 1; i < novelty.length - 1; i++) {
    if (i - lastPeak < minDistFrames) continue
    const norm = novelty[i] / maxN
    if (norm < threshold) continue
    if (novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1]) {
      peaks.push(i)
      lastPeak = i
    }
  }
  return peaks
}

// ── Stats over a slice of frames ──────────────────────────────────────────────

interface SegmentStats {
  energy:   number  // mean
  bass:     number
  mid:      number
  high:     number
  centroid: number
  flux:     number
  slope:    number  // linear regression slope of energy
}

function segmentStats(frames: FeatureFrame[], from: number, to: number): SegmentStats {
  const slice = frames.slice(from, to)
  if (slice.length === 0) return { energy: 0, bass: 0, mid: 0, high: 0, centroid: 0, flux: 0, slope: 0 }

  let energy = 0, bass = 0, mid = 0, high = 0, centroid = 0, flux = 0
  for (const f of slice) {
    energy   += f.energy
    bass     += f.bass
    mid      += f.mid
    high     += f.high
    centroid += f.centroid
    flux     += f.flux
  }
  const n = slice.length
  energy   /= n; bass /= n; mid /= n; high /= n; centroid /= n; flux /= n

  // Linear slope of energy (simple Theil-Sen style: first-half vs second-half)
  const half = Math.max(1, Math.floor(slice.length / 2))
  let firstHalf = 0, secondHalf = 0
  for (let i = 0; i < half; i++) firstHalf += slice[i].energy
  for (let i = half; i < slice.length; i++) secondHalf += slice[i].energy
  const slope = (secondHalf / Math.max(1, slice.length - half)) - (firstHalf / half)

  return { energy, bass, mid, high, centroid, flux, slope }
}

// ── Heuristic section type labeling ──────────────────────────────────────────

interface TrackMeans {
  energy:   number
  bass:     number
  mid:      number
  high:     number
  centroid: number
  flux:     number
}

function computeTrackMeans(frames: FeatureFrame[]): TrackMeans {
  if (frames.length === 0) return { energy: 0.5, bass: 0.5, mid: 0.5, high: 0.5, centroid: 0.5, flux: 0.5 }
  let energy = 0, bass = 0, mid = 0, high = 0, centroid = 0, flux = 0
  for (const f of frames) {
    energy   += f.energy
    bass     += f.bass
    mid      += f.mid
    high     += f.high
    centroid += f.centroid
    flux     += f.flux
  }
  const n = frames.length
  return {
    energy:   energy / n,
    bass:     bass / n,
    mid:      mid / n,
    high:     high / n,
    centroid: centroid / n,
    flux:     flux / n,
  }
}

function labelSegment(
  stats: SegmentStats,
  means: TrackMeans,
  midpointRatio: number,  // 0–1 position within the track
): { type: ReactSectionType; intensity: number; confidence: number } {
  const energyRatio   = means.energy   > 0.001 ? stats.energy   / means.energy   : 1
  const bassRatio     = means.bass     > 0.001 ? stats.bass     / means.bass     : 1
  const fluxRatio     = means.flux     > 0.001 ? stats.flux     / means.flux     : 1
  const centRatio     = means.centroid > 0.001 ? stats.centroid / means.centroid : 1
  const { slope } = stats

  // Clamp ratios so they don't blow up on nearly-silent tracks
  const eR = Math.max(0.1, Math.min(3, energyRatio))
  const bR = Math.max(0.1, Math.min(3, bassRatio))
  const fR = Math.max(0.1, Math.min(3, fluxRatio))

  // Intensity is proportional to energy ratio, capped at 1
  const intensity = Math.max(0.1, Math.min(1, eR * 0.5))

  // ── Rule-based labeling ─────────────────────────────────────────────────────
  // Intro / outro first (position-gated)
  if (midpointRatio < 0.12 && eR < 1.1) {
    return { type: 'intro', intensity: Math.min(0.45, intensity), confidence: 0.75 }
  }
  if (midpointRatio > 0.88 && eR < 1.0) {
    return { type: 'outro', intensity: Math.min(0.35, intensity), confidence: 0.75 }
  }

  // Drop: highest energy, high flux, high bass
  if (eR >= 1.35 && fR >= 1.35 && bR >= 1.2) {
    return { type: 'drop', intensity: Math.min(1, intensity + 0.3), confidence: 0.80 }
  }

  // Build / preDrop: rising slope, above-average energy, above-average flux
  if (slope > 0.015 && eR >= 0.85 && fR >= 1.1) {
    // preDrop if slope is steep and flux is high
    if (slope > 0.03 || fR >= 1.4) {
      return { type: 'preDrop', intensity: Math.min(0.9, intensity + 0.1), confidence: 0.65 }
    }
    return { type: 'build', intensity: Math.min(0.85, intensity + 0.05), confidence: 0.70 }
  }

  // Breakdown: below-average energy after a high-energy section, moderate flux
  if (eR < 0.85 && fR < 1.1 && midpointRatio > 0.25 && midpointRatio < 0.85) {
    return { type: 'breakdown', intensity: Math.max(0.3, intensity), confidence: 0.65 }
  }

  // Bridge: mid-track, unusual centroid (different brightness), moderate energy
  if (midpointRatio > 0.45 && midpointRatio < 0.78 && (centRatio < 0.8 || centRatio > 1.25)) {
    return { type: 'bridge', intensity, confidence: 0.55 }
  }

  // Verse: moderate energy around the track mean
  if (eR >= 0.7 && eR <= 1.3 && Math.abs(slope) < 0.02) {
    return { type: 'verse', intensity, confidence: 0.70 }
  }

  // Catch-all
  return { type: 'unknown', intensity, confidence: 0.35 }
}

// ── Context refinement — promote 'build' before 'drop' to 'preDrop' ───────────

function refineWithContext(
  sections: Array<{ type: ReactSectionType; intensity: number; confidence: number; startIdx: number; endIdx: number }>,
): void {
  for (let i = 1; i < sections.length; i++) {
    if (sections[i].type === 'drop' && sections[i - 1].type === 'build') {
      sections[i - 1].type       = 'preDrop'
      sections[i - 1].confidence = Math.max(sections[i - 1].confidence, 0.65)
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function detectSections(
  energyCurves: { instant: FeatureCurve; bass: FeatureCurve; mid: FeatureCurve; high: FeatureCurve },
  spectralCurves: { centroid: FeatureCurve; flux: FeatureCurve; complexity: FeatureCurve },
  durationSec: number,
  options: SectionDetectionOptions = {},
): TrackSectionMI[] {
  const {
    minSegmentSec    = 8,
    maxSegments      = 20,
    noveltyThreshold = 0.25,
  } = options

  if (durationSec < 5) return []

  const HOP_SEC        = 0.5
  const minDistFrames  = Math.max(1, Math.round(minSegmentSec / HOP_SEC))

  const frames  = buildFrames(energyCurves, spectralCurves, durationSec, HOP_SEC)
  const novelty = computeNovelty(frames)
  const peakIdx = findNoveltyPeaks(novelty, minDistFrames, noveltyThreshold)

  // Build boundary list: always start at 0, always end at last frame
  const boundaryFrames = [0, ...peakIdx, frames.length]
  // Remove duplicates and sort
  const boundaries = [...new Set(boundaryFrames)].sort((a, b) => a - b)

  // Clamp to maxSegments by dropping lowest-novelty boundaries
  let segs = boundaries.slice()
  while (segs.length - 1 > maxSegments + 1) {
    // Find the boundary (excluding 0 and last) with the lowest novelty
    let minV = Infinity, minI = 1
    for (let i = 1; i < segs.length - 1; i++) {
      const v = novelty[segs[i]] ?? 0
      if (v < minV) { minV = v; minI = i }
    }
    segs.splice(minI, 1)
  }

  const means = computeTrackMeans(frames)

  // Classify each segment
  const classified = segs.slice(0, -1).map((startIdx, i) => {
    const endIdx   = segs[i + 1]
    const stats    = segmentStats(frames, startIdx, endIdx)
    const tStart   = frames[startIdx]?.timeSec ?? 0
    const tEnd     = frames[Math.min(endIdx - 1, frames.length - 1)]?.timeSec ?? durationSec
    const midRatio = ((tStart + tEnd) / 2) / durationSec
    const labeled  = labelSegment(stats, means, midRatio)
    return { ...labeled, startIdx, endIdx }
  })

  refineWithContext(classified)

  // Convert to TrackSectionMI
  const result: TrackSectionMI[] = classified.map((seg, i) => {
    const startSec = frames[seg.startIdx]?.timeSec ?? 0
    const endSec   = seg.endIdx < frames.length
      ? frames[seg.endIdx]?.timeSec ?? durationSec
      : durationSec
    return {
      id:         `auto-sec-${i}`,
      label:      labelToDisplayName(seg.type, i),
      type:       seg.type,
      startSec,
      endSec,
      intensity:  seg.intensity,
      confidence: seg.confidence,
    }
  })

  return result
}

function labelToDisplayName(type: ReactSectionType, idx: number): string {
  const labels: Record<ReactSectionType, string> = {
    intro:     'Intro',
    verse:     'Verse',
    build:     'Build',
    preDrop:   'Pre-Drop',
    drop:      'Drop',
    breakdown: 'Breakdown',
    bridge:    'Bridge',
    outro:     'Outro',
    unknown:   'Section',
  }
  return `${labels[type]} ${idx + 1}`
}
