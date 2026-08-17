// Offline audio analysis: custom FFT + feature extraction + BPM detection.
// Uses a custom radix-2 FFT to avoid conflicting with the real-time Meyda
// instance (which holds a global bufferSize state).

import { guess } from 'web-audio-beat-detector'
import { PitchDetector } from 'pitchy'
import { analyzeStructuralRegions } from './sectionAnalysis'
import { detectSemanticMoments } from './semanticAnalysis'
import { generateMusicalHierarchy } from './musicalHierarchyAnalysis'
import { CURRENT_ANALYSIS_VERSION } from './analysisVersion'
import { ANALYSIS_TUNING } from './analysisTuning'
import {
  aggregateBarFeatures,
  buildBeatMarkers as buildMusicalBeatMarkers,
  estimateBeatPhaseConfidence,
  resolveMusicalGrid,
  type ChromaFrame,
  type MusicalFeatureCurves,
} from './musicalGridAnalysis'
import type { RekordboxFeatureAvailability, RekordboxImportSource, RekordboxPhrase } from '../rekordboxImport/sourceTypes'
import type {
  TrackIntelligenceAnalysis,
  FeatureCurve,
  FeatureCurvePoint,
  BeatMarkerMI,
  ChordMarker,
  TrackSectionMI,
  PhraseMarker,
  AnalysisProgressInfo,
  AnalysisWarning,
  MusicalGridSource,
} from './types'

// Krumhansl-Schmuckler profiles (same as in harmonicAnalysis.ts for offline use)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
const NOTE_NAMES    = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export interface TrackAnalysisSeed {
  source?: RekordboxImportSource | 'analysis' | 'manual'
  featureAvailability?: RekordboxFeatureAvailability
  bpm?: number | null
  bpmConfidence?: number | null
  beatGridOffsetSec?: number | null
  beatGrid?: BeatMarkerMI[]
  downbeats?: BeatMarkerMI[]
  rekordboxPhrases?: RekordboxPhrase[]
  phrases?: PhraseMarker[]
  sections?: TrackSectionMI[]
  key?: string | null
  keyConfidence?: number | null
}

export interface TrackAnalysisOptions {
  fftSize?:       number  // default 2048, must be power of 2
  hopSize?:       number  // default 1024
  maxCurvePoints?: number // default 300 — max stored per curve
  minSectionSec?:  number // default 8
  /** Optional trusted timing/key metadata from Rekordbox or another importer. */
  seed?: TrackAnalysisSeed
  /** Optional stage-level progress reporting owned by the shared coordinator. */
  onProgress?: (progress: AnalysisProgressInfo) => void
  /** Cancels CPU analysis as well as decode when a track is removed or replaced. */
  signal?: AbortSignal
}


function mergeSeededSections(seeded: TrackSectionMI[], detected: TrackSectionMI[], durationSec: number): TrackSectionMI[] {
  const cleaned = seeded
    .filter(section => Number.isFinite(section.startSec) && Number.isFinite(section.endSec) && section.endSec > section.startSec)
    .map(section => ({
      ...section,
      startSec: Math.max(0, Math.min(durationSec, section.startSec)),
      endSec: Math.max(0, Math.min(durationSec, section.endSec)),
      source: section.source ?? 'rekordbox',
      locked: section.locked ?? true,
    }))
    .filter(section => section.endSec > section.startSec)
    .sort((a, b) => a.startSec - b.startSec)

  if (cleaned.length === 0) return detected

  const overlapsSeed = (section: TrackSectionMI) => cleaned.some(seed => (
    section.startSec < seed.endSec && section.endSec > seed.startSec
  ))

  return [
    ...cleaned,
    ...detected.filter(section => !overlapsSeed(section)),
  ].sort((a, b) => a.startSec - b.startSec)
}

function parseSeededKey(key: string | null): { key: string; mode: 'major' | 'minor' } | null {
  if (!key) return null
  const trimmed = key.trim()
  if (!trimmed) return null

  const camelot = trimmed.match(/^(\d{1,2})([ab])$/i)
  if (camelot) return null

  const normalized = trimmed
    .replace(/maj(or)?/i, ' major')
    .replace(/min(or)?/i, ' minor')
    .replace(/\s+/g, ' ')
    .trim()

  const parts = normalized.split(' ')
  const tonic = parts[0]?.replace('♯', '#').replace('♭', 'b')
  if (!tonic) return null
  const lower = normalized.toLowerCase()
  const mode: 'major' | 'minor' = lower.includes('minor') || /m$/.test(trimmed) ? 'minor' : 'major'
  const keyName = tonic.charAt(0).toUpperCase() + tonic.slice(1)
  return { key: keyName, mode }
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
  options: Parameters<typeof buildMusicalBeatMarkers>[3] = {},
): BeatMarkerMI[] {
  return buildMusicalBeatMarkers(bpm, offsetSec, durationSec, options)
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
  captureFrame: boolean = false,
): number[] | null {
  for (let i = 0; i < 12; i++) chromaAcc[i] *= decay
  const frameChroma = captureFrame ? new Float32Array(12) : null
  const binCount = mags.length
  for (let bin = 1; bin < binCount; bin++) {
    const hz = bin * sampleRate / N
    if (hz < 50 || hz > sampleRate / 2) continue
    const midi = 12 * Math.log2(hz / 440) + 69
    const pc = ((Math.round(midi) % 12) + 12) % 12
    const magnitude = mags[bin] ?? 0
    chromaAcc[pc] += magnitude
    if (frameChroma) frameChroma[pc] += magnitude
  }
  if (!frameChroma) return null
  const total = frameChroma.reduce((sum, value) => sum + value, 0)
  return total > 1e-10
    ? Array.from(frameChroma, value => value / total)
    : Array.from(frameChroma)
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

function frameRms(samples: Float32Array, start: number, length: number): number {
  let sumSquares = 0
  let count = 0
  const end = Math.min(samples.length, start + length)
  for (let index = start; index < end; index++) {
    const sample = samples[index] ?? 0
    sumSquares += sample * sample
    count++
  }
  return count > 0 ? Math.sqrt(sumSquares / count) : 0
}

function isRekordboxSeed(seed: TrackAnalysisSeed | undefined): seed is TrackAnalysisSeed & { source: RekordboxImportSource } {
  return seed?.source === 'rekordbox_xml' || seed?.source === 'rekordbox_usb'
}

function usableImportedBeatGrid(seed: TrackAnalysisSeed | undefined, durationSec: number): BeatMarkerMI[] {
  const sorted = (seed?.beatGrid ?? [])
    .filter(marker => Number.isFinite(marker.timeSec) && marker.timeSec >= 0 && marker.timeSec <= durationSec + 1e-6)
    .sort((a, b) => a.timeSec - b.timeSec)
  const result: BeatMarkerMI[] = []
  for (const marker of sorted) {
    if (result.length === 0 || marker.timeSec - result[result.length - 1]!.timeSec > 1e-4) result.push(marker)
  }
  if (result.length < 2) return []
  const hasOnlyPlausibleBeatIntervals = result.slice(1).every((marker, index) => {
    const delta = marker.timeSec - result[index]!.timeSec
    return delta >= 0.1 && delta <= 3
  })
  return hasOnlyPlausibleBeatIntervals ? result : []
}

function seedGridSource(seed: TrackAnalysisSeed | undefined, importedBeatGrid: BeatMarkerMI[]): MusicalGridSource {
  if (seed?.source === 'manual') return 'manual_correction'
  if (isRekordboxSeed(seed) && importedBeatGrid.length >= 2) return 'imported'
  return 'automatic'
}

function sectionFeatureSource(sections: TrackSectionMI[]): 'rekordbox' | 'drmvyz' | 'mixed' {
  const hasRekordbox = sections.some(section => section.source === 'rekordbox')
  const hasDrmvyz = sections.some(section => section.source !== 'rekordbox')
  if (hasRekordbox && hasDrmvyz) return 'mixed'
  return hasRekordbox ? 'rekordbox' : 'drmvyz'
}


function analysisAbortError(): Error {
  const error = new Error('Loaded-audio analysis was cancelled.')
  error.name = 'AbortError'
  return error
}

function throwIfAnalysisAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw analysisAbortError()
}

async function cooperativeAnalysisYield(signal: AbortSignal | undefined): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  throwIfAnalysisAborted(signal)
}

async function mixDownToMono(
  audioBuffer: AudioBuffer,
  signal: AbortSignal | undefined,
): Promise<{ samples: Float32Array; cooperativeYieldCount: number }> {
  const length = Math.max(0, audioBuffer.length)
  const channelCount = Math.max(0, audioBuffer.numberOfChannels)
  if (length === 0 || channelCount === 0) {
    return { samples: new Float32Array(0), cooperativeYieldCount: 0 }
  }
  if (channelCount === 1) {
    return { samples: audioBuffer.getChannelData(0), cooperativeYieldCount: 0 }
  }

  const channels = Array.from({ length: channelCount }, (_, channel) => audioBuffer.getChannelData(channel))
  const samples = new Float32Array(length)
  const chunkSize = ANALYSIS_TUNING.performance.cooperativeYieldEveryMixSamples
  let cooperativeYieldCount = 0
  for (let start = 0; start < length; start += chunkSize) {
    const end = Math.min(length, start + chunkSize)
    for (let index = start; index < end; index++) {
      let sum = 0
      for (const channel of channels) sum += channel[index] ?? 0
      samples[index] = sum / channelCount
    }
    if (end < length) {
      cooperativeYieldCount++
      await cooperativeAnalysisYield(signal)
    }
  }
  return { samples, cooperativeYieldCount }
}

function progressReporter(options: TrackAnalysisOptions): (progress: AnalysisProgressInfo) => void {
  return progress => options.onProgress?.({
    ...progress,
    progress: Math.max(0, Math.min(1, progress.progress)),
  })
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
    seed,
  } = options
  const report = progressReporter(options)
  const signal = options.signal
  throwIfAnalysisAborted(signal)

  const sampleRate  = audioBuffer.sampleRate
  const durationSec = Math.max(0, audioBuffer.duration)
  const durationMs  = Math.round(durationSec * 1000)
  const typedWarnings: AnalysisWarning[] = []

  // The coordinator owns decoding. This analyzer starts with the already-decoded
  // buffer and performs one shared feature pass reused by every later stage.
  report({ stage: 'extracting_features', progress: 0.08 })

  const mixdown = await mixDownToMono(audioBuffer, signal)
  const monoData = mixdown.samples
  let cooperativeYieldCount = mixdown.cooperativeYieldCount

  const instantPoints:  FeatureCurvePoint[] = []
  const shortTermPts:   FeatureCurvePoint[] = []
  const bassPoints:     FeatureCurvePoint[] = []
  const midPoints:      FeatureCurvePoint[] = []
  const highPoints:     FeatureCurvePoint[] = []
  const centroidPoints: FeatureCurvePoint[] = []
  const fluxPoints:     FeatureCurvePoint[] = []
  const complexityPts:  FeatureCurvePoint[] = []
  const transientPts:   FeatureCurvePoint[] = []
  const lowOnsetPts:    FeatureCurvePoint[] = []
  const midOnsetPts:    FeatureCurvePoint[] = []
  const highOnsetPts:   FeatureCurvePoint[] = []
  const rmsPoints:      FeatureCurvePoint[] = []
  const pitchPoints:    FeatureCurvePoint[] = []
  const chromaFrames:   ChromaFrame[] = []
  const chromaAcc       = new Float32Array(12)

  const pitchDetector = PitchDetector.forFloat32Array(fftSize)
  pitchDetector.minVolumeDecibels = -40

  let prevMags = new Float32Array((fftSize >> 1) + 1) as Float32Array<ArrayBuffer>
  let prevBass = 0
  let prevMid = 0
  let prevHigh = 0
  let shortTermEma = 0
  const EMA_ALPHA = 0.1
  const CHROMA_DECAY = 0.999
  const totalFrames = monoData.length >= fftSize
    ? Math.floor((monoData.length - fftSize) / hopSize) + 1
    : 0
  const progressStride = Math.max(1, Math.floor(totalFrames / 4))
  const featureCaptureStride = Math.max(1, Math.round(
    ANALYSIS_TUNING.performance.featurePointIntervalSec * sampleRate / hopSize,
  ))
  const chromaCaptureStride = Math.max(1, Math.round(
    ANALYSIS_TUNING.performance.chromaFrameIntervalSec * sampleRate / hopSize,
  ))

  for (let frame = 0; frame < totalFrames; frame++) {
    const sampleOffset = frame * hopSize
    const timeSec = sampleOffset / sampleRate
    const mags = fftMagnitudes(monoData, fftSize, sampleOffset)
    const energy = bandSum(mags, 20, 20000, sampleRate, fftSize)
    const bass = bandSum(mags, 60, 250, sampleRate, fftSize)
    const mid = bandSum(mags, 250, 4000, sampleRate, fftSize)
    const high = bandSum(mags, 4000, 20000, sampleRate, fftSize)
    const centroid = spectralCentroid(mags, sampleRate, fftSize)
    const flux = spectralFlux(mags, prevMags)
    const lowOnset = Math.max(0, bass - prevBass)
    const midOnset = Math.max(0, mid - prevMid)
    const highOnset = Math.max(0, high - prevHigh)
    const transient = flux * 0.5 + lowOnset * 0.28 + midOnset * 0.12 + highOnset * 0.10
    const bassWeight = bass * 4
    const midWeight = mid * 4
    const highWeight = high * 4
    const spectralTotal = bassWeight + midWeight + highWeight + 1e-8
    const complexity = 1 - Math.max(bassWeight, midWeight, highWeight) / spectralTotal
    const rms = frameRms(monoData, sampleOffset, fftSize)

    shortTermEma = EMA_ALPHA * energy + (1 - EMA_ALPHA) * shortTermEma

    const captureFeaturePoint = frame % featureCaptureStride === 0 || frame === totalFrames - 1
    if (captureFeaturePoint) {
      instantPoints.push({ timeSec, value: energy })
      shortTermPts.push({ timeSec, value: shortTermEma })
      bassPoints.push({ timeSec, value: bass })
      midPoints.push({ timeSec, value: mid })
      highPoints.push({ timeSec, value: high })
      centroidPoints.push({ timeSec, value: centroid })
      fluxPoints.push({ timeSec, value: flux })
      complexityPts.push({ timeSec, value: complexity })
      transientPts.push({ timeSec, value: transient })
      lowOnsetPts.push({ timeSec, value: lowOnset })
      midOnsetPts.push({ timeSec, value: midOnset })
      highOnsetPts.push({ timeSec, value: highOnset })
      rmsPoints.push({ timeSec, value: rms })

      const window = monoData.subarray(sampleOffset, sampleOffset + fftSize)
      try {
        const [pitch, clarity] = pitchDetector.findPitch(window, sampleRate)
        pitchPoints.push({
          timeSec,
          value: clarity > 0.85 && pitch > 50 && pitch < 2000 ? pitch : 0,
        })
      } catch {
        pitchPoints.push({ timeSec, value: 0 })
      }
    }

    const frameChroma = accumulateChroma(
      mags,
      chromaAcc,
      sampleRate,
      fftSize,
      CHROMA_DECAY,
      frame % chromaCaptureStride === 0 || frame === totalFrames - 1,
    )
    if (frameChroma) chromaFrames.push({ timeSec, values: frameChroma })

    prevMags = mags
    prevBass = bass
    prevMid = mid
    prevHigh = high

    if (frame > 0 && frame % progressStride === 0) {
      report({
        stage: 'extracting_features',
        progress: 0.08 + 0.30 * (frame / Math.max(1, totalFrames)),
      })
    }
    if (frame > 0 && frame % ANALYSIS_TUNING.performance.cooperativeYieldEveryFrames === 0) {
      cooperativeYieldCount++
      await cooperativeAnalysisYield(signal)
    }
  }

  throwIfAnalysisAborted(signal)

  const normInstant  = normalizeCurve(instantPoints)
  const normBass     = normalizeCurve(bassPoints)
  const normMid      = normalizeCurve(midPoints)
  const normHigh     = normalizeCurve(highPoints)
  const normCentroid = normalizeCurve(centroidPoints)
  const normFlux     = normalizeCurve(fluxPoints)
  const normComplex  = normalizeCurve(complexityPts)
  const normShort    = normalizeCurve(shortTermPts)
  const normTransient = normalizeCurve(transientPts)
  const normLowOnset = normalizeCurve(lowOnsetPts)
  const normMidOnset = normalizeCurve(midOnsetPts)
  const normHighOnset = normalizeCurve(highOnsetPts)
  const normRms = normalizeCurve(rmsPoints)
  const silenceCurve: FeatureCurve = normRms.map(point => ({
    timeSec: point.timeSec,
    value: point.value < 0.035 ? 1 : 0,
  }))

  if (durationSec < 5) {
    typedWarnings.push({
      code: 'short_track',
      stage: 'extracting_features',
      message: 'Track is too short for confident musical-structure analysis; deterministic fallback windows are retained.',
      recoverable: true,
    })
  }
  const nonSilentFrames = silenceCurve.filter(point => point.value < 0.5).length
  if (silenceCurve.length > 0 && nonSilentFrames / silenceCurve.length < 0.05) {
    typedWarnings.push({
      code: 'silent_track',
      stage: 'extracting_features',
      message: 'Track contains too little audible energy for authoritative tempo or bar analysis.',
      recoverable: true,
    })
  }

  const musicalFeatures: MusicalFeatureCurves = {
    energy: normInstant,
    bass: normBass,
    mid: normMid,
    high: normHigh,
    spectralFlux: normFlux,
    spectralCentroid: normCentroid,
    spectralComplexity: normComplex,
    transient: normTransient,
    lowFrequencyOnset: normLowOnset,
    midFrequencyOnset: normMidOnset,
    highFrequencyOnset: normHighOnset,
    silence: silenceCurve,
    chromaFrames,
  }

  // Tempo is intentionally resolved after the shared high-resolution feature
  // pass so confidence can be measured against real transient alignment.
  report({ stage: 'resolving_tempo', progress: 0.42 })
  const importedBeatGrid = usableImportedBeatGrid(seed, durationSec)
  const rekordboxSeed = isRekordboxSeed(seed)
  let bpm: number | null = null
  let bpmConfidence: number | null = null
  let beatPhaseConfidence: number | null = null
  let beatOffsetSec: number | null = null

  if (seed?.bpm != null && seed.bpm > 0) {
    bpm = seed.bpm
    beatOffsetSec = rekordboxSeed && importedBeatGrid.length === 0
      ? 0
      : seed.beatGridOffsetSec ?? importedBeatGrid[0]?.timeSec ?? 0
    bpmConfidence = seed.bpmConfidence ?? 0.97
    beatPhaseConfidence = importedBeatGrid.length >= 2 ? 0.99 : 0.92
  } else if (importedBeatGrid.length >= 2) {
    const deltas = importedBeatGrid.slice(1).map((marker, index) => marker.timeSec - importedBeatGrid[index]!.timeSec)
      .filter(delta => delta > 0.1 && delta < 3)
      .sort((a, b) => a - b)
    const medianDelta = deltas[Math.floor(deltas.length / 2)]
    bpm = medianDelta ? 60 / medianDelta : null
    beatOffsetSec = importedBeatGrid[0]?.timeSec ?? 0
    bpmConfidence = bpm ? 0.96 : null
    beatPhaseConfidence = bpm ? 0.99 : null
  } else {
    try {
      const result = await guess(audioBuffer)
      bpm = Number.isFinite(result.bpm) && result.bpm > 0 ? result.bpm : null
      beatOffsetSec = Number.isFinite(result.offset) ? result.offset : 0
      if (bpm != null) {
        const provisional = buildMusicalBeatMarkers(bpm, beatOffsetSec ?? 0, durationSec)
        beatPhaseConfidence = estimateBeatPhaseConfidence(provisional, normTransient, bpm)
        bpmConfidence = beatPhaseConfidence > 0
          ? Math.max(0.05, Math.min(1, 0.15 + beatPhaseConfidence * 0.85))
          : 0.05
      }
    } catch (error) {
      typedWarnings.push({
        code: 'bpm_detection_failed',
        stage: 'resolving_tempo',
        message: `BPM detection failed: ${error instanceof Error ? error.message : String(error)}`,
        recoverable: true,
      })
    }
  }

  if (bpm != null && (bpmConfidence ?? 0) < 0.35) {
    typedWarnings.push({
      code: 'low_bpm_confidence',
      stage: 'resolving_tempo',
      message: 'Tempo was detected with low confidence; structural analysis will retain explicit fallback metadata.',
      recoverable: true,
    })
  }
  if (bpm != null && (beatPhaseConfidence ?? 0) < 0.25) {
    typedWarnings.push({
      code: 'low_beat_phase_confidence',
      stage: 'resolving_tempo',
      message: 'Beat phase is weakly supported by transients; the grid remains usable but is not marked authoritative.',
      recoverable: true,
    })
  }

  throwIfAnalysisAborted(signal)
  report({ stage: 'resolving_musical_grid', progress: 0.55 })
  const gridSource = seedGridSource(seed, importedBeatGrid)
  const gridResolution = resolveMusicalGrid({
    durationSec,
    bpm,
    bpmConfidence,
    beatPhaseConfidence,
    beatOffsetSec,
    timeSignature: 4,
    source: gridSource,
    importedBeatGrid: importedBeatGrid.length ? importedBeatGrid : undefined,
    importedDownbeats: importedBeatGrid.length ? seed?.downbeats : undefined,
    features: {
      energy: normInstant,
      transient: normTransient,
      lowFrequencyOnset: normLowOnset,
      highFrequencyOnset: normHighOnset,
    },
  })

  if (gridResolution.info.fallbackReason === 'downbeat_phase_low_confidence') {
    typedWarnings.push({
      code: 'low_downbeat_phase_confidence',
      stage: 'resolving_musical_grid',
      message: 'No downbeat phase clearly won the four-phase evaluation; deterministic phase-zero fallback is explicitly marked.',
      recoverable: true,
    })
  }
  if (gridResolution.info.source === 'legacy_fallback') {
    typedWarnings.push({
      code: gridResolution.info.fallbackReason === 'invalid_imported_grid'
        ? 'invalid_imported_grid'
        : 'time_domain_fallback',
      stage: 'resolving_musical_grid',
      message: 'Authoritative bars could not be resolved; fixed time-window features preserve Track Map and section fallback behavior.',
      recoverable: true,
    })
  }

  report({ stage: 'building_bar_features', progress: 0.66 })
  const barFeatures = aggregateBarFeatures(gridResolution.bars, musicalFeatures, durationSec)

  const CONTOUR_WINDOW = 10
  const CONTOUR_RANGE = 200
  const melodyContourCurve: FeatureCurve = pitchPoints.map((point, index) => {
    if (point.value === 0) return { timeSec: point.timeSec, value: 0.5 }
    const low = Math.max(0, index - CONTOUR_WINDOW)
    const window = pitchPoints.slice(low, index + 1).filter(candidate => candidate.value > 0)
    if (window.length < 2) return { timeSec: point.timeSec, value: 0.5 }
    const difference = window[window.length - 1]!.value - window[0]!.value
    return {
      timeSec: point.timeSec,
      value: Math.max(0, Math.min(1, (difference / CONTOUR_RANGE + 1) / 2)),
    }
  })

  // Structural analysis consumes the resolved grid-derived bar features.
  // Bar-aware self-similarity is primary; the deterministic time-domain detector
  // remains available only as an explicitly marked low-confidence fallback.
  throwIfAnalysisAborted(signal)
  report({ stage: 'structural_analysis', progress: 0.76 })
  const structuralResult = analyzeStructuralRegions(
    { instant: normInstant, bass: normBass, mid: normMid, high: normHigh },
    { centroid: normCentroid, flux: normFlux, complexity: normComplex },
    durationSec,
    { minSegmentSec: minSectionSec, barFeatures, musicalGrid: gridResolution.info },
  )
  const baseSections = seed?.sections?.length
    ? mergeSeededSections(seed.sections, structuralResult.sections, durationSec)
    : structuralResult.sections
  const hierarchy = generateMusicalHierarchy({
    durationSec,
    beatGrid: gridResolution.beatGrid,
    barMarkers: gridResolution.bars,
    barFeatures,
    musicalGrid: gridResolution.info,
    sections: baseSections,
    structuralSegmentation: structuralResult.structuralSegmentation,
    importedPhrases: seed?.phrases,
  })
  const sections = hierarchy.sections

  const detectedKey = detectOfflineKey(chromaAcc)
  const seededKey = parseSeededKey(seed?.key ?? null)
  const dominantKey = seededKey?.key ?? detectedKey.dominantKey
  const dominantMode = seededKey?.mode ?? detectedKey.dominantMode
  const keyConfidence = seededKey ? (seed?.keyConfidence ?? 0.92) : detectedKey.keyConfidence
  const keyChanges = seededKey
    ? [{ timeSec: 0, key: seededKey.key, mode: seededKey.mode, confidence: keyConfidence }]
    : detectedKey.keyChanges
  const chordProgression: ChordMarker[] = []

  report({ stage: 'finalizing', progress: 0.90 })
  const downsample = (curve: FeatureCurvePoint[]) => downsampleCurve(curve, maxCurvePoints)
  const warnings = [
    ...typedWarnings.map(warning => warning.message),
    ...(seed?.bpm != null ? [`BPM seeded from ${seed.source ?? 'external metadata'}.`] : []),
    ...(seed?.sections?.length ? [`Sections seeded from ${seed.source ?? 'external metadata'}.`] : []),
    ...(seededKey ? [`Key seeded from ${seed?.source ?? 'external metadata'}.`] : []),
  ]

  const analysisSources = {
    bpm: rekordboxSeed && ((seed?.bpm ?? 0) > 0 || importedBeatGrid.length >= 2) ? 'rekordbox' as const : 'drmvyz' as const,
    beatGrid: rekordboxSeed && importedBeatGrid.length >= 2 ? 'rekordbox' as const : 'drmvyz' as const,
    key: rekordboxSeed && seededKey ? 'rekordbox' as const : 'drmvyz' as const,
    trackSections: sectionFeatureSource(sections),
  }
  const inferredRekordboxAvailability: RekordboxFeatureAvailability | undefined = rekordboxSeed
    ? {
        bpm: (seed?.bpm ?? 0) > 0 || importedBeatGrid.length >= 2,
        beatGrid: importedBeatGrid.length >= 2,
        key: Boolean(seed?.key?.trim()),
        phrases: (seed?.rekordboxPhrases?.length ?? 0) > 0,
      }
    : undefined
  const rekordboxFeatureAvailability = rekordboxSeed
    ? inferredRekordboxAvailability
    : undefined

  const partialAnalysis: TrackIntelligenceAnalysis = {
    analysisVersion: CURRENT_ANALYSIS_VERSION,
    createdAt: new Date().toISOString(),
    durationMs,
    bpm,
    bpmConfidence,
    beatPhaseConfidence,
    downbeatPhaseConfidence: gridResolution.info.confidence.downbeatPhase,
    barGridConfidence: gridResolution.info.confidence.barGrid,
    beatGridOffsetSec: gridResolution.beatGridOffsetSec,
    timeSignature: 4,
    beatGrid: gridResolution.beatGrid,
    downbeats: gridResolution.downbeats,
    barMarkers: gridResolution.bars,
    barFeatures,
    musicalGrid: gridResolution.info,
    phrases: hierarchy.phrases,
    phraseHierarchy: hierarchy.phraseHierarchy,
    sections,
    structuralSegmentation: structuralResult.structuralSegmentation,
    boundaryAlternatives: hierarchy.boundaryAlternatives,
    energyCurves: {
      instant: downsample(normInstant),
      shortTerm: downsample(normShort),
      bass: downsample(normBass),
      mid: downsample(normMid),
      high: downsample(normHigh),
    },
    spectralCurves: {
      centroid: downsample(normCentroid),
      flux: downsample(normFlux),
      complexity: downsample(normComplex),
    },
    stemCurves: null,
    harmonic: {
      keyChanges,
      chordProgression,
      dominantKey,
      dominantMode,
      keyConfidence,
      pitchCurve: downsample(normalizeCurve(pitchPoints)),
      melodyContourCurve: downsample(melodyContourCurve),
    },
    lyrics: null,
    semanticMoments: [],
    warnings,
    errors: [],
    analysisSources,
    trackProvenance: rekordboxSeed
      ? {
          trackOrigin: 'rekordbox',
          rekordboxSource: seed.source,
          rekordboxFeatureAvailability,
        }
      : { trackOrigin: 'ordinary' },
    rekordboxSourceData: rekordboxSeed
      ? {
          source: seed.source,
          featureAvailability: rekordboxFeatureAvailability!,
          phrases: (seed.rekordboxPhrases ?? []).map(phrase => ({
            ...phrase,
            sourceFlags: { ...phrase.sourceFlags },
            sourcePayload: { ...phrase.sourcePayload },
          })),
        }
      : undefined,
    analysisWarnings: typedWarnings,
    analysisDiagnostics: {
      featureFrameCount: totalFrames,
      featureExtractionPassCount: 1,
      retainedFeaturePointCount: instantPoints.length,
      retainedChromaFrameCount: chromaFrames.length,
      cooperativeYieldCount,
      beatCount: gridResolution.beatGrid.length,
      downbeatCount: gridResolution.downbeats.length,
      barCount: gridResolution.bars.length,
      barFeatureCount: barFeatures.length,
      sectionCount: sections.length,
      usedFallback: structuralResult.structuralSegmentation.diagnostics.usedFallback,
      gridSource: gridResolution.info.source,
      fallbackReason: gridResolution.info.fallbackReason,
      downbeatPhaseScores: gridResolution.phaseScores,
      structuralSource: structuralResult.structuralSegmentation.source,
      structuralCandidateCount: structuralResult.structuralSegmentation.diagnostics.candidateCount,
      selectedStructuralBoundaryCount: structuralResult.structuralSegmentation.diagnostics.selectedBoundaryCount,
      similarityMatrixDimension: structuralResult.structuralSegmentation.diagnostics.matrixDimension,
      similarityMatrixBytes: structuralResult.structuralSegmentation.diagnostics.matrixBytes,
      contextualClassifierVersion: structuralResult.structuralSegmentation.contextualDiagnostics?.classifierVersion,
      detectedDropAnchorCount: structuralResult.structuralSegmentation.contextualDiagnostics?.dropAnchorCount,
      refinedBuildBoundaryCount: structuralResult.structuralSegmentation.contextualDiagnostics?.buildRefinementCount,
      detectedPreDropCount: structuralResult.structuralSegmentation.contextualDiagnostics?.preDropCount,
      sectionFamilyCount: structuralResult.structuralSegmentation.contextualDiagnostics?.familyCount,
      ambiguousSectionCount: structuralResult.structuralSegmentation.contextualDiagnostics?.ambiguousSectionCount,
      structuralPhraseCount: hierarchy.phrases.filter(phrase => phrase.structurallyDetected).length,
      gridDerivedPhraseCount: hierarchy.phrases.filter(phrase => !phrase.structurallyDetected).length,
      boundaryAlternativeCount: hierarchy.boundaryAlternatives.length,
      hierarchyUnitCount: hierarchy.phraseHierarchy.units.length,
    },
    detectedBpm: bpm,
    bpmUsedForGrid: bpm,
    gridStale: false,
    lastGridRebuiltAt: null,
    lastReanalysisMode: 'full',
  }

  throwIfAnalysisAborted(signal)
  const semanticMoments = detectSemanticMoments(partialAnalysis)
  const result = {
    ...partialAnalysis,
    semanticMoments,
    analysisDiagnostics: partialAnalysis.analysisDiagnostics
      ? { ...partialAnalysis.analysisDiagnostics, semanticMomentCount: semanticMoments.length }
      : partialAnalysis.analysisDiagnostics,
  }
  report({ stage: 'finalizing', progress: 1 })
  return result
}
