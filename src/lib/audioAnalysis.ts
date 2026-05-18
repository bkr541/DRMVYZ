// Offline audio analysis utilities — real data derived from decoded AudioBuffer.
// All metrics are browser-based approximations, not laboratory-grade measurements.

import { calcPhaseCorrelation, calcStereoReading } from '../analysis/stereo'
import { calcTonalBalance } from '../analysis/tonalBalance'

export interface TrackAnalysis {
  waveformPeaks: number[]   // 200 values 0–1
  spectrum: number[]        // 64 log-spaced bins 0–1
  loudness: OfflineLoudness
  stereo: OfflineStereo
  bands: OfflineBands
  duration: number
  sampleRate: number
}

export interface OfflineLoudness {
  lufs: number
  truePeak: number
  dynamicRange: number
  crestFactor: number
  rms: number
}

export interface OfflineStereo {
  correlation: number   // –1 to +1
  width: number         // 0–100
  balance: number       // dB, positive = louder right
}

export interface OfflineBands {
  sub: number; bass: number; lowMid: number; mid: number
  highMid: number; presence: number; air: number
}

export interface MatchScores {
  loudnessDiff: number
  lowDiff: number
  midDiff: number
  highDiff: number
  widthDiff: number
  dynDiff: number
  overall: number   // 0–100
}

// ── Main entry point ──────────────────────────────────────────────────

export async function analyzeAudioFile(file: File): Promise<TrackAnalysis> {
  const arrayBuffer = await file.arrayBuffer()
  // Use OfflineAudioContext to decode without requiring user gesture
  const tmpCtx = new OfflineAudioContext(2, 2, 44100)
  const buffer = await tmpCtx.decodeAudioData(arrayBuffer)

  const waveformPeaks = extractWaveformPeaks(buffer, 200)
  const loudness      = analyzeBufferLoudness(buffer)
  const stereo        = analyzeBufferStereo(buffer)
  const { spectrum, bands } = await analyzeFrequency(buffer)

  return { waveformPeaks, spectrum, loudness, stereo, bands, duration: buffer.duration, sampleRate: buffer.sampleRate }
}

// ── Waveform peaks ────────────────────────────────────────────────────

export function extractWaveformPeaks(buffer: AudioBuffer, numBars: number): number[] {
  const ch = buffer.getChannelData(0)
  const blockSize = Math.max(1, Math.floor(ch.length / numBars))
  return Array.from({ length: numBars }, (_, i) => {
    const start = i * blockSize
    let peak = 0
    for (let j = 0; j < blockSize && start + j < ch.length; j++) {
      const abs = Math.abs(ch[start + j])
      if (abs > peak) peak = abs
    }
    return peak
  })
}

// ── Loudness (time-domain) ────────────────────────────────────────────

export function analyzeBufferLoudness(buffer: AudioBuffer): OfflineLoudness {
  const L = buffer.getChannelData(0)
  const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L
  const len = L.length

  let sumSq = 0
  let peak = 0
  for (let i = 0; i < len; i++) {
    const m = (L[i] + R[i]) * 0.5
    sumSq += m * m
    const abs = Math.max(Math.abs(L[i]), Math.abs(R[i]))
    if (abs > peak) peak = abs
  }

  const rmsLin = Math.sqrt(sumSq / len)
  const db = (v: number) => v < 1e-9 ? -96 : 20 * Math.log10(v)

  const rmsDb  = db(rmsLin)
  const peakDb = db(peak)

  // Approximate LUFS: RMS + rough K-weighting offset (+3 dB for music content)
  const lufs = Math.max(-48, Math.min(0, rmsDb + 3.01 - 0.691))

  // Approximate true peak via simple linear interpolation between adjacent samples
  let truePeakLin = peak
  for (let i = 0; i < len - 1; i++) {
    const interp = (Math.abs(L[i]) + Math.abs(L[i + 1])) * 0.5
    if (interp > truePeakLin) truePeakLin = interp
  }
  const truePeakDb = Math.max(-48, Math.min(3, db(truePeakLin)))

  // Dynamic range: spread between loud and quiet 400ms chunks
  const chunkSize = Math.max(1, Math.floor(buffer.sampleRate * 0.4))
  const chunkRMS: number[] = []
  for (let start = 0; start + chunkSize <= len; start += chunkSize) {
    let s = 0
    for (let i = start; i < start + chunkSize; i++) s += L[i] * L[i]
    chunkRMS.push(Math.sqrt(s / chunkSize))
  }
  chunkRMS.sort((a, b) => a - b)
  let dynRange = 0
  if (chunkRMS.length > 4) {
    const p10 = chunkRMS[Math.floor(chunkRMS.length * 0.10)]
    const p90 = chunkRMS[Math.floor(chunkRMS.length * 0.90)]
    dynRange = p10 > 1e-9 ? Math.max(0, Math.min(30, 20 * Math.log10(p90 / p10))) : 0
  }

  const crestFactor = Math.max(0, Math.min(30, peakDb - rmsDb))

  return { lufs, truePeak: truePeakDb, dynamicRange: dynRange, crestFactor, rms: rmsDb }
}

// ── Stereo ────────────────────────────────────────────────────────────

export function analyzeBufferStereo(buffer: AudioBuffer): OfflineStereo {
  if (buffer.numberOfChannels < 2) return { correlation: 1, width: 0, balance: 0 }

  const L = buffer.getChannelData(0)
  const R = buffer.getChannelData(1)
  // Use at most 10s for performance
  const subLen = Math.min(L.length, buffer.sampleRate * 10)
  const subL = L.subarray(0, subLen) as Float32Array<ArrayBuffer>
  const subR = R.subarray(0, subLen) as Float32Array<ArrayBuffer>

  const reading = calcStereoReading(subL, subR)
  const balance = Math.max(-6, Math.min(6, reading.rLevel - reading.lLevel))

  return {
    correlation: reading.phaseCorrelation,
    width: Math.round(reading.stereoWidth * 100),
    balance,
  }
}

// ── Frequency domain (offline render) ────────────────────────────────

async function renderSection(
  buffer: AudioBuffer,
  startFraction: number,
  durationSecs: number,
  fftSize: number
): Promise<Uint8Array | null> {
  const sr = buffer.sampleRate
  const startSample = Math.floor(buffer.length * startFraction)
  const clipLen = Math.min(Math.floor(durationSecs * sr), buffer.length - startSample)
  if (clipLen < fftSize) return null

  // Mix to mono for spectrum analysis
  const clip = new AudioBuffer({ numberOfChannels: 1, length: clipLen, sampleRate: sr })
  const dst = clip.getChannelData(0)
  const srcL = buffer.getChannelData(0)
  const srcR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : srcL
  for (let i = 0; i < clipLen; i++) {
    dst[i] = (srcL[startSample + i] + srcR[startSample + i]) * 0.5
  }

  const offline = new OfflineAudioContext(1, clipLen, sr)
  const src = offline.createBufferSource()
  src.buffer = clip
  const analyser = offline.createAnalyser()
  analyser.fftSize = fftSize
  analyser.smoothingTimeConstant = 0

  src.connect(analyser)
  analyser.connect(offline.destination)
  src.start()

  try {
    await offline.startRendering()
    const freq = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(freq)
    return freq
  } catch {
    return null
  }
}

async function analyzeFrequency(buffer: AudioBuffer): Promise<{ spectrum: number[]; bands: OfflineBands }> {
  const fftSize = 4096
  const clipDur = Math.min(2, Math.max(0.5, buffer.duration / 5))
  const sections = [0.25, 0.50, 0.75]

  const results: Uint8Array[] = []
  for (const frac of sections) {
    const r = await renderSection(buffer, frac, clipDur, fftSize)
    if (r) results.push(r)
  }

  if (results.length === 0) {
    return {
      spectrum: new Array(64).fill(0),
      bands: { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, presence: 0, air: 0 },
    }
  }

  // Average all sections
  const binCount = results[0].length
  const avg = new Uint8Array(binCount)
  for (let i = 0; i < binCount; i++) {
    avg[i] = Math.round(results.reduce((s, r) => s + r[i], 0) / results.length)
  }

  const bands  = calcTonalBalance(avg as Uint8Array<ArrayBuffer>, buffer.sampleRate)
  const spectrum = downsampleLogSpectrum(avg, 64, buffer.sampleRate)

  return { spectrum, bands: bands as OfflineBands }
}

function downsampleLogSpectrum(freqData: Uint8Array, numBins: number, sampleRate: number): number[] {
  const nyquist = sampleRate / 2
  const minLog = Math.log10(20)
  const maxLog = Math.log10(Math.min(20000, nyquist))

  return Array.from({ length: numBins }, (_, i) => {
    const loFreq = Math.pow(10, minLog + (i / numBins) * (maxLog - minLog))
    const hiFreq = Math.pow(10, minLog + ((i + 1) / numBins) * (maxLog - minLog))
    const loBin = Math.floor((loFreq / nyquist) * freqData.length)
    const hiBin = Math.min(Math.ceil((hiFreq / nyquist) * freqData.length), freqData.length - 1)
    let sum = 0, count = 0
    for (let b = loBin; b <= hiBin; b++) { sum += freqData[b]; count++ }
    return count > 0 ? (sum / count) / 255 : 0
  })
}

// ── Match scoring ─────────────────────────────────────────────────────

export function computeMatchScore(main: TrackAnalysis, ref: TrackAnalysis): MatchScores {
  const loudnessDiff = Math.abs(main.loudness.lufs - ref.loudness.lufs)
  const lowDiff      = Math.abs(main.bands.bass   - ref.bands.bass)   + Math.abs(main.bands.sub    - ref.bands.sub)
  const midDiff      = Math.abs(main.bands.mid    - ref.bands.mid)    + Math.abs(main.bands.lowMid - ref.bands.lowMid)
  const highDiff     = Math.abs(main.bands.highMid - ref.bands.highMid) + Math.abs(main.bands.presence - ref.bands.presence) + Math.abs(main.bands.air - ref.bands.air)
  const widthDiff    = Math.abs(main.stereo.width  - ref.stereo.width) / 100
  const dynDiff      = Math.abs(main.loudness.dynamicRange - ref.loudness.dynamicRange) / 20

  const overall = Math.round(
    Math.max(0, 1 - loudnessDiff / 12) * 30 +
    Math.max(0, 1 - lowDiff)           * 20 +
    Math.max(0, 1 - midDiff)           * 25 +
    Math.max(0, 1 - highDiff * 0.5)    * 15 +
    Math.max(0, 1 - widthDiff * 2)     *  5 +
    Math.max(0, 1 - dynDiff)           *  5
  )

  return {
    loudnessDiff: Math.round(loudnessDiff * 10) / 10,
    lowDiff:  Math.round(lowDiff  * 100),
    midDiff:  Math.round(midDiff  * 100),
    highDiff: Math.round(highDiff * 100),
    widthDiff: Math.round(widthDiff * 100),
    dynDiff:  Math.round(dynDiff  * 100),
    overall:  Math.max(0, Math.min(100, overall)),
  }
}
