import { fftMagnitudes } from '../musicIntelligence/offlineTrackAnalyzer'
import {
  RGB_WAVEFORM_VERSION, RGB_WAVEFORM_BIN_COUNT,
  RGB_FFT_SIZE, RGB_HOP_SIZE,
  LOW_MIN_HZ, LOW_MAX_HZ, MID_MIN_HZ, MID_MAX_HZ, HIGH_MIN_HZ,
  SMOOTHING_KERNEL, BLEND_RELATIVE, BLEND_ABSOLUTE,
} from './rgbWaveformTypes'
import type { RgbWaveformAnalysis } from './rgbWaveformTypes'

// Yield to the event loop between chunks so RGB analysis doesn't jank the UI.
function yieldToMain(): Promise<void> {
  return new Promise(r => setTimeout(r, 0))
}

// Sorted-array percentile (p ∈ [0,1]).
function sortedPercentile(values: Float32Array, p: number): number {
  const nonZero: number[] = []
  for (let i = 0; i < values.length; i++) {
    if (values[i] > 1e-10) nonZero.push(values[i])
  }
  if (nonZero.length === 0) return 1
  nonZero.sort((a, b) => a - b)
  const idx = Math.min(nonZero.length - 1, Math.floor(nonZero.length * p))
  return nonZero[idx] || 1
}

function applySmoothing(arr: Float32Array, kernel: readonly number[]): Float32Array {
  const n    = arr.length
  const half = Math.floor(kernel.length / 2)
  const out  = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0, wSum = 0
    for (let k = 0; k < kernel.length; k++) {
      const j = i + k - half
      if (j >= 0 && j < n) { sum += arr[j] * kernel[k]; wSum += kernel[k] }
    }
    out[i] = sum / (wSum || 1)
  }
  return out
}

export async function analyzeRgbWaveform(
  audioBuffer: AudioBuffer,
  signal?: AbortSignal,
): Promise<RgbWaveformAnalysis> {
  const sampleRate   = audioBuffer.sampleRate
  const totalSamples = audioBuffer.length
  const durationSec  = audioBuffer.duration
  const nch          = audioBuffer.numberOfChannels
  const BIN_COUNT    = RGB_WAVEFORM_BIN_COUNT
  const FFT_SIZE     = RGB_FFT_SIZE
  const HOP_SIZE     = RGB_HOP_SIZE
  const highMaxHz    = Math.min(20000, sampleRate / 2)

  // Precompute FFT bin indices for each band (constant for this sampleRate)
  const lowBinLo  = Math.max(0, Math.floor(LOW_MIN_HZ  * FFT_SIZE / sampleRate))
  const lowBinHi  = Math.min((FFT_SIZE >> 1), Math.ceil(LOW_MAX_HZ  * FFT_SIZE / sampleRate))
  const midBinLo  = Math.max(0, Math.floor(MID_MIN_HZ  * FFT_SIZE / sampleRate))
  const midBinHi  = Math.min((FFT_SIZE >> 1), Math.ceil(MID_MAX_HZ  * FFT_SIZE / sampleRate))
  const highBinLo = Math.max(0, Math.floor(HIGH_MIN_HZ * FFT_SIZE / sampleRate))
  const highBinHi = Math.min((FFT_SIZE >> 1), Math.ceil(highMaxHz   * FFT_SIZE / sampleRate))

  // Pre-fetch channel data views (no copying)
  const channels: Float32Array[] = []
  for (let ch = 0; ch < nch; ch++) channels.push(audioBuffer.getChannelData(ch))

  // Build mono mix for FFT (average across channels)
  const monoData = new Float32Array(totalSamples)
  for (let ch = 0; ch < nch; ch++) {
    const chData = channels[ch]
    for (let i = 0; i < totalSamples; i++) monoData[i] += chData[i]
  }
  if (nch > 1) for (let i = 0; i < totalSamples; i++) monoData[i] /= nch

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // ── Pass 1: Amplitude (chunked, per-bin, all channels) ───────────────────────

  const positivePeaksRaw = new Float32Array(BIN_COUNT)
  const negativePeaksRaw = new Float32Array(BIN_COUNT)
  const rmsRaw           = new Float32Array(BIN_COUNT)

  const AMP_CHUNK = 128  // bins per amplitude chunk (~5ms per chunk)

  for (let binStart = 0; binStart < BIN_COUNT; binStart += AMP_CHUNK) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const binEnd = Math.min(binStart + AMP_CHUNK, BIN_COUNT)

    for (let bin = binStart; bin < binEnd; bin++) {
      const sStart = Math.floor( bin      * totalSamples / BIN_COUNT)
      const sEnd   = Math.floor((bin + 1) * totalSamples / BIN_COUNT)
      let posMax = 0, sumSq = 0, count = 0

      for (let ch = 0; ch < nch; ch++) {
        const chData = channels[ch]
        for (let i = sStart; i < sEnd; i++) {
          const s = chData[i]
          const a = s < 0 ? -s : s
          if (a > posMax) posMax = a
          sumSq += s * s
          count++
        }
      }

      positivePeaksRaw[bin] = posMax
      negativePeaksRaw[bin] = posMax  // symmetric — same peak used for both halves
      rmsRaw[bin] = count > 0 ? Math.sqrt(sumSq / count) : 0
    }

    await yieldToMain()
  }

  // ── Pass 2: FFT / band energy (chunked, per-window, mono) ────────────────────

  const totalWindows = Math.max(1, Math.floor((totalSamples - FFT_SIZE) / HOP_SIZE))

  const lowAccum    = new Float32Array(BIN_COUNT)
  const midAccum    = new Float32Array(BIN_COUNT)
  const highAccum   = new Float32Array(BIN_COUNT)
  const winCounts   = new Float32Array(BIN_COUNT)

  const FFT_CHUNK = 128  // windows per FFT chunk

  for (let wStart = 0; wStart < totalWindows; wStart += FFT_CHUNK) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const wEnd = Math.min(wStart + FFT_CHUNK, totalWindows)

    for (let w = wStart; w < wEnd; w++) {
      const sampleStart  = w * HOP_SIZE
      const centerSample = sampleStart + (FFT_SIZE >> 1)
      const bin = Math.min(BIN_COUNT - 1, Math.floor(centerSample / totalSamples * BIN_COUNT))

      const mags = fftMagnitudes(monoData, FFT_SIZE, sampleStart)

      // Accumulate power (magnitude²) per band, averaged over bin count
      let low = 0, mid = 0, high = 0
      for (let k = lowBinLo;  k <= lowBinHi;  k++) { const m = mags[k]; low  += m * m }
      for (let k = midBinLo;  k <= midBinHi;  k++) { const m = mags[k]; mid  += m * m }
      for (let k = highBinLo; k <= highBinHi; k++) { const m = mags[k]; high += m * m }

      const lowN  = Math.max(1, lowBinHi  - lowBinLo  + 1)
      const midN  = Math.max(1, midBinHi  - midBinLo  + 1)
      const highN = Math.max(1, highBinHi - highBinLo + 1)

      lowAccum[bin]  += low  / lowN
      midAccum[bin]  += mid  / midN
      highAccum[bin] += high / highN
      winCounts[bin]++
    }

    await yieldToMain()
  }

  // Average FFT accumulations
  for (let bin = 0; bin < BIN_COUNT; bin++) {
    const n = winCounts[bin] || 1
    lowAccum[bin]  /= n
    midAccum[bin]  /= n
    highAccum[bin] /= n
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // ── Normalization ─────────────────────────────────────────────────────────────

  const peakRef = sortedPercentile(positivePeaksRaw, 0.98)
  const rmsRef  = sortedPercentile(rmsRaw,           0.95)
  const lowRef  = sortedPercentile(lowAccum,          0.95)
  const midRef  = sortedPercentile(midAccum,          0.95)
  const highRef = sortedPercentile(highAccum,         0.95)

  // Full spectrum reference for absolute normalization
  const fullSpectrumRaw = new Float32Array(BIN_COUNT)
  for (let bin = 0; bin < BIN_COUNT; bin++) {
    fullSpectrumRaw[bin] = lowAccum[bin] + midAccum[bin] + highAccum[bin]
  }
  const fullRef = sortedPercentile(fullSpectrumRaw, 0.95) || 1

  const EPS = 1e-10

  const positivePeaks = new Float32Array(BIN_COUNT)
  const negativePeaks = new Float32Array(BIN_COUNT)
  const rms           = new Float32Array(BIN_COUNT)
  const lowRaw        = new Float32Array(BIN_COUNT)
  const midRaw        = new Float32Array(BIN_COUNT)
  const highRaw       = new Float32Array(BIN_COUNT)

  for (let bin = 0; bin < BIN_COUNT; bin++) {
    positivePeaks[bin] = Math.min(1, positivePeaksRaw[bin] / (peakRef + EPS))
    negativePeaks[bin] = Math.min(1, negativePeaksRaw[bin] / (peakRef + EPS))
    rms[bin]           = Math.min(1, rmsRaw[bin]           / (rmsRef  + EPS))

    // Blended normalization: relative preserves timbral detail, absolute keeps spectral balance
    const lRel = lowAccum[bin]  / (lowRef  + EPS)
    const mRel = midAccum[bin]  / (midRef  + EPS)
    const hRel = highAccum[bin] / (highRef + EPS)

    const lAbs = lowAccum[bin]  / fullRef
    const mAbs = midAccum[bin]  / fullRef
    const hAbs = highAccum[bin] / fullRef

    lowRaw[bin]  = Math.min(1, lRel * BLEND_RELATIVE + lAbs * BLEND_ABSOLUTE)
    midRaw[bin]  = Math.min(1, mRel * BLEND_RELATIVE + mAbs * BLEND_ABSOLUTE)
    highRaw[bin] = Math.min(1, hRel * BLEND_RELATIVE + hAbs * BLEND_ABSOLUTE)
  }

  // ── Temporal smoothing on band energies only ──────────────────────────────────

  const lowEnergy  = applySmoothing(lowRaw,  SMOOTHING_KERNEL)
  const midEnergy  = applySmoothing(midRaw,  SMOOTHING_KERNEL)
  const highEnergy = applySmoothing(highRaw, SMOOTHING_KERNEL)

  return {
    version:  RGB_WAVEFORM_VERSION,
    durationSec,
    sampleRate,
    binCount: BIN_COUNT,
    positivePeaks,
    negativePeaks,
    rms,
    lowEnergy,
    midEnergy,
    highEnergy,
  }
}
