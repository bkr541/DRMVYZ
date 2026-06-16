// Offline audio analysis: custom FFT + feature extraction + BPM detection.
// Uses a custom radix-2 FFT to avoid conflicting with the real-time Meyda
// instance (which holds a global bufferSize state).

import { guess } from 'web-audio-beat-detector'
import { PitchDetector } from 'pitchy'
import { detectSections } from './sectionAnalysis'
import { detectSemanticMoments } from './semanticAnalysis'
import type {
  TrackIntelligenceAnalysis,
  FeatureCurve,
  FeatureCurvePoint,
  BeatMarkerMI,
  ChordMarker,
} from './types'

// Krumhansl-Schmuckler profiles (same as in harmonicAnalysis.ts for offline use)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
const NOTE_NAMES    = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export interface TrackAnalysisOptions {
  fftSize?:       number  // default 2048, must be power of 2
  hopSize?:       number  // default 1024
  maxCurvePoints?: number // default 300 — max stored per curve
  minSectionSec?:  number // default 8
}

// ── Custom radix-2 DIT FFT (real input) ───────────────────────────────────────
// Returns magnitudes for bins 0 .. N/2 (inclusive).

export function fftMagnitudes(samples: Float32Array, N: number, start: number): Float32Array<ArrayBuffer> {
  const log2N = Math.round(Math.log2(N))
  const re = new Float32Array(N)
  const im = new Float32Array(N)

  // Bit-reversed order + Hann window
  for (let i = 0; i < N; i++) {
    const sample = samples[start + i] ?? 0
    const hann   = 0.5 - 0.5 * Math.cos(6.283185307179586 * i / (N - 1))
    let rev = 0, x = i
    for (let b = 0; b < log2N; b++) { rev = (rev << 1) | (x & 1); x >>= 1 }
    re[rev] = sample * hann
  }

  // Cooley-Tukey butterfly
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1
    const ang = -6.283185307179586 / len
    const baseRe = Math.cos(ang)
    const baseIm = Math.sin(ang)
    for (let i = 0; i < N; i += len) {
      let wRe = 1, wIm = 0
      for (let j = 0; j < halfLen; j++) {
        const uRe = re[i + j],           uIm = im[i + j]
        const vRe = re[i + j + halfLen] * wRe - im[i + j + halfLen] * wIm
        const vIm = re[i + j + halfLen] * wIm + im[i + j + halfLen] * wRe
        re[i + j]           = uRe + vRe;  im[i + j]           = uIm + vIm
        re[i + j + halfLen] = uRe - vRe;  im[i + j + halfLen] = uIm - vIm
        const nextRe = wRe * baseRe - wIm * baseIm
        wIm = wRe * baseIm + wIm * baseRe
        wRe = nextRe
      }
    }
  }

  const half = (N >> 1) + 1
  const mags = new Float32Array(half) as Float32Array<ArrayBuffer>
  const scale = 2 / N
  for (let i = 0; i < half; i++) {
    mags[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) * scale
  }
  return mags
}

// ── Band and spectral helpers ──────────────────────────────────────────────────

function bandSum(mags: Float32Array, loHz: number, hiHz: number, sampleRate: number, N: number): number {
  const binLo = Math.max(0,               Math.floor(loHz * N / sampleRate))
  const binHi = Math.min(mags.length - 1, Math.ceil( hiHz * N / sampleRate))
  if (binHi <= binLo) return 0
  let s = 0
  for (let i = binLo; i <= binHi; i++) s += mags[i]
  return s / (binHi - binLo + 1)
}

function spectralCentroid(mags: Float32Array, sampleRate: number, N: number): number {
  let weighted = 0, total = 0
  for (let i = 0; i < mags.length; i++) {
    const hz = i * sampleRate / N
    weighted += hz * mags[i]
    total    += mags[i]
  }
  return total > 1e-10 ? weighted / total : 0
}

function spectralFlux(mags: Float32Array, prevMags: Float32Array): number {
  let flux = 0
  const len = Math.min(mags.length, prevMags.length)
  for (let i = 0; i < len; i++) {
    const diff = mags[i] - prevMags[i]
    if (diff > 0) flux += diff
  }
  return flux
}

// ── Downsampling helper ───────────────────────────────────────────────────────

function downsampleCurve(curve: FeatureCurve, maxPoints: number): FeatureCurve {
  if (curve.length <= maxPoints) return curve
  const step = curve.length / maxPoints
  const result: FeatureCurve = []
  for (let i = 0; i < maxPoints; i++) {
    const lo = Math.floor(i * step)
    const hi = Math.min(curve.length - 1, Math.floor((i + 1) * step))
    let sum = 0, count = 0
    for (let j = lo; j <= hi; j++) { sum += curve[j].value; count++ }
    result.push({ timeSec: curve[lo].timeSec, value: count > 0 ? sum / count : 0 })
  }
  return result
}

// ── Normalize a curve to 0–1 using running percentile ────────────────────────

function normalizeCurve(curve: FeatureCurve): FeatureCurve {
  if (curve.length === 0) return curve
  const values = curve.map(p => p.value).sort((a, b) => a - b)
  const p95    = values[Math.floor(values.length * 0.95)] || 1
  if (p95 < 1e-8) return curve
  return curve.map(p => ({ timeSec: p.timeSec, value: Math.min(1, p.value / p95) }))
}

// ── Build beat markers from BPM + offset ─────────────────────────────────────

export function buildBeatMarkers(
  bpm: number,
  offsetSec: number,
  durationSec: number,
): BeatMarkerMI[] {
  const beatPeriod = 60 / Math.max(1, bpm)
  const markers: BeatMarkerMI[] = []
  let t = offsetSec
  if (t > beatPeriod) t = t % beatPeriod
  let beatInBar = 0
  while (t < durationSec) {
    markers.push({ timeSec: t, confidence: 0.85, isDownbeat: beatInBar === 0 })
    t        += beatPeriod
    beatInBar = (beatInBar + 1) % 4
  }
  return markers
}

// ── Harmonic helpers ──────────────────────────────────────────────────────────

function pearsonCorrelation(a: ArrayLike<number>, b: number[]): number {
  const n = a.length
  let sumA = 0, sumB = 0
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i] }
  const meanA = sumA / n, meanB = sumB / n
  let num = 0, varA = 0, varB = 0
  for (let i = 0; i < n; i++) {
    const da = (a[i] as number) - meanA, db = b[i] - meanB
    num += da * db; varA += da * da; varB += db * db
  }
  const denom = Math.sqrt(varA * varB)
  return denom < 1e-10 ? 0 : num / denom
}

function accumulateChroma(
  mags: Float32Array,
  chromaAcc: Float32Array,
  sampleRate: number,
  N: number,
  decay: number,
): void {
  for (let i = 0; i < 12; i++) chromaAcc[i] *= decay
  const binCount = mags.length
  for (let bin = 1; bin < binCount; bin++) {
    const hz = bin * sampleRate / N
    if (hz < 50 || hz > sampleRate / 2) continue
    const midi = 12 * Math.log2(hz / 440) + 69
    const pc = ((Math.round(midi) % 12) + 12) % 12
    chromaAcc[pc] += mags[bin]
  }
}

function detectOfflineKey(chromaAcc: Float32Array): {
  dominantKey:  string | null
  dominantMode: 'major' | 'minor' | null
  keyConfidence: number
  keyChanges:   Array<{ timeSec: number; key: string; mode: 'major' | 'minor'; confidence: number }>
} {
  const sum = chromaAcc.reduce((a, b) => a + b, 0)
  if (sum < 1e-10) return { dominantKey: null, dominantMode: null, keyConfidence: 0, keyChanges: [] }
  const normalized = Array.from(chromaAcc).map(v => v / sum)
  let bestCorr = -Infinity, bestRoot = 0
  let bestMode: 'major' | 'minor' = 'major'
  for (let root = 0; root < 12; root++) {
    const rotated = Array.from({ length: 12 }, (_, i) => normalized[(i + root) % 12]!)
    const mCorr = pearsonCorrelation(rotated, MAJOR_PROFILE)
    const nCorr = pearsonCorrelation(rotated, MINOR_PROFILE)
    if (mCorr > bestCorr) { bestCorr = mCorr; bestRoot = root; bestMode = 'major' }
    if (nCorr > bestCorr) { bestCorr = nCorr; bestRoot = root; bestMode = 'minor' }
  }
  return {
    dominantKey:   NOTE_NAMES[bestRoot] ?? null,
    dominantMode:  bestMode,
    keyConfidence: Math.max(0, Math.min(1, (bestCorr + 1) / 2)),
    keyChanges:    [],
  }
}

// ── Main analysis function ────────────────────────────────────────────────────

export async function analyzeTrackBuffer(
  audioBuffer: AudioBuffer,
  options: TrackAnalysisOptions = {},
): Promise<TrackIntelligenceAnalysis> {
  const {
    fftSize        = 2048,
    hopSize        = 1024,
    maxCurvePoints = 300,
    minSectionSec  = 8,
  } = options

  const sampleRate  = audioBuffer.sampleRate
  const durationSec = audioBuffer.duration
  const durationMs  = Math.round(durationSec * 1000)

  // Mix to mono
  const monoData = new Float32Array(audioBuffer.length)
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const chData = audioBuffer.getChannelData(ch)
    for (let i = 0; i < monoData.length; i++) monoData[i] += chData[i]
  }
  const chCount = audioBuffer.numberOfChannels
  if (chCount > 1) for (let i = 0; i < monoData.length; i++) monoData[i] /= chCount

  // ── BPM detection ──────────────────────────────────────────────────────────
  // bpm is null when detection fails — beat markers will not be generated.
  // bpmConfidence is null because web-audio-beat-detector does not expose
  // a meaningful confidence value (distance from 120 is not a valid heuristic).
  let bpm: number | null = null
  let bpmConfidence: number | null = null
  let beatOffsetSec = 0
  const bpmWarnings: string[] = []
  try {
    const result = await guess(audioBuffer)
    bpm           = result.bpm
    beatOffsetSec = result.offset
    // web-audio-beat-detector does not expose a confidence score; leave null.
    bpmConfidence = null
  } catch (err) {
    bpmWarnings.push(
      `BPM detection failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // ── Feature extraction (frame-by-frame FFT) ────────────────────────────────
  const instantPoints:  FeatureCurvePoint[] = []
  const shortTermPts:   FeatureCurvePoint[] = []
  const bassPoints:     FeatureCurvePoint[] = []
  const midPoints:      FeatureCurvePoint[] = []
  const highPoints:     FeatureCurvePoint[] = []
  const centroidPoints: FeatureCurvePoint[] = []
  const fluxPoints:     FeatureCurvePoint[] = []
  const complexityPts:  FeatureCurvePoint[] = []
  const pitchPoints:    FeatureCurvePoint[] = []  // Hz (raw), normalized later
  const chromaAcc       = new Float32Array(12)    // accumulated chroma for key

  // Offline pitch detector (separate from real-time one)
  const pitchDetector = PitchDetector.forFloat32Array(fftSize)
  pitchDetector.minVolumeDecibels = -40

  let prevMags     = new Float32Array((fftSize >> 1) + 1) as Float32Array<ArrayBuffer>
  let shortTermEma = 0
  const EMA_ALPHA  = 0.1   // ~100ms at typical hop=1024/44100
  const CHROMA_DECAY = 0.999

  const totalFrames = Math.floor((monoData.length - fftSize) / hopSize)

  for (let frame = 0; frame < totalFrames; frame++) {
    const sampleOffset = frame * hopSize
    const timeSec      = sampleOffset / sampleRate

    const mags    = fftMagnitudes(monoData, fftSize, sampleOffset)
    const energy  = bandSum(mags,  20, 20000, sampleRate, fftSize)
    const bass    = bandSum(mags,  60,   250, sampleRate, fftSize)
    const mid     = bandSum(mags, 250,  4000, sampleRate, fftSize)
    const high    = bandSum(mags, 4000,20000, sampleRate, fftSize)
    const cent    = spectralCentroid(mags, sampleRate, fftSize)
    const flux    = spectralFlux(mags, prevMags)

    // Spectral complexity: spread of energy across bands
    const bassW = bass * 4, midW = mid * 4, highW = high * 4
    const total = bassW + midW + highW + 1e-8
    const complexity = 1 - Math.max(bassW, midW, highW) / total

    shortTermEma = EMA_ALPHA * energy + (1 - EMA_ALPHA) * shortTermEma

    instantPoints .push({ timeSec, value: energy })
    shortTermPts  .push({ timeSec, value: shortTermEma })
    bassPoints    .push({ timeSec, value: bass })
    midPoints     .push({ timeSec, value: mid })
    highPoints    .push({ timeSec, value: high })
    centroidPoints.push({ timeSec, value: cent })
    fluxPoints    .push({ timeSec, value: flux })
    complexityPts .push({ timeSec, value: complexity })

    // Accumulate chroma (for key detection)
    accumulateChroma(mags, chromaAcc, sampleRate, fftSize, CHROMA_DECAY)

    // Offline pitch detection from time-domain window
    const windowStart = frame * hopSize
    if (windowStart + fftSize <= monoData.length) {
      const window = monoData.subarray(windowStart, windowStart + fftSize)
      try {
        const [pitch, clarity] = pitchDetector.findPitch(window, sampleRate)
        if (clarity > 0.85 && pitch > 50 && pitch < 2000) {
          pitchPoints.push({ timeSec, value: pitch })
        } else {
          pitchPoints.push({ timeSec, value: 0 })
        }
      } catch {
        pitchPoints.push({ timeSec, value: 0 })
      }
    }

    prevMags = mags
  }

  // Normalize curves before section detection
  const normInstant  = normalizeCurve(instantPoints)
  const normBass     = normalizeCurve(bassPoints)
  const normMid      = normalizeCurve(midPoints)
  const normHigh     = normalizeCurve(highPoints)
  const normCentroid = normalizeCurve(centroidPoints)
  const normFlux     = normalizeCurve(fluxPoints)
  const normComplex  = normalizeCurve(complexityPts)
  const normShort    = normalizeCurve(shortTermPts)

  // ── Melody contour curve (0=descending, 0.5=flat, 1=ascending) ──────────────
  const CONTOUR_WINDOW = 10
  const CONTOUR_RANGE  = 200  // ±200 Hz maps to 0–1
  const melodyContourCurve: FeatureCurve = pitchPoints.map((p, i) => {
    if (p.value === 0) return { timeSec: p.timeSec, value: 0.5 }
    const lo = Math.max(0, i - CONTOUR_WINDOW)
    const windowPts = pitchPoints.slice(lo, i + 1).filter(x => x.value > 0)
    if (windowPts.length < 2) return { timeSec: p.timeSec, value: 0.5 }
    const diff = windowPts[windowPts.length - 1]!.value - windowPts[0]!.value
    return { timeSec: p.timeSec, value: Math.max(0, Math.min(1, (diff / CONTOUR_RANGE + 1) / 2)) }
  })

  // ── Section detection ──────────────────────────────────────────────────────
  const sections = detectSections(
    { instant: normInstant, bass: normBass, mid: normMid, high: normHigh },
    { centroid: normCentroid, flux: normFlux, complexity: normComplex },
    durationSec,
    { minSegmentSec: minSectionSec },
  )

  // ── Offline key detection (from accumulated chroma) ───────────────────────
  const { dominantKey, dominantMode, keyChanges, keyConfidence } = detectOfflineKey(chromaAcc)
  const chordProgression: ChordMarker[] = []

  // ── Beat grid ──────────────────────────────────────────────────────────────
  // Only generate markers when BPM is known; an empty grid triggers the BPM-
  // grid fallback path in BeatGrid.update(), which is unavailable when bpm=null.
  const beatMarkers = bpm !== null ? buildBeatMarkers(bpm, beatOffsetSec, durationSec) : []
  const downbeats   = beatMarkers.filter(b => b.isDownbeat)

  // ── Downsample curves for storage ─────────────────────────────────────────
  const ds = (c: FeatureCurvePoint[]) => downsampleCurve(c, maxCurvePoints)

  const partialAnalysis: TrackIntelligenceAnalysis = {
    analysisVersion:   'auto-1.0',
    createdAt:         new Date().toISOString(),
    durationMs,
    bpm,
    bpmConfidence,
    beatGridOffsetSec: beatOffsetSec,
    timeSignature:     4,
    beatGrid:          beatMarkers,
    downbeats,
    phrases:           [],
    sections,
    energyCurves: {
      instant:   ds(normInstant),
      shortTerm: ds(normShort),
      bass:      ds(normBass),
      mid:       ds(normMid),
      high:      ds(normHigh),
    },
    spectralCurves: {
      centroid:   ds(normCentroid),
      flux:       ds(normFlux),
      complexity: ds(normComplex),
    },
    stemCurves: null,
    harmonic: {
      keyChanges,
      chordProgression,
      dominantKey,
      dominantMode,
      keyConfidence,
      pitchCurve:         ds(normalizeCurve(pitchPoints)),
      melodyContourCurve: ds(melodyContourCurve),
    },
    lyrics:          null,
    semanticMoments: [],
    warnings:        bpmWarnings,
    errors:          [],
  }

  return {
    ...partialAnalysis,
    semanticMoments: detectSemanticMoments(partialAnalysis),
  }
}
