// All readings are browser-based approximations, not ITU-R BS.1770 compliant.

const DB_FLOOR = -96

export function linToDb(v: number): number {
  return v < 1e-6 ? DB_FLOOR : 20 * Math.log10(v)
}

export function calcRMS(buf: Float32Array<ArrayBuffer>): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

export function calcPeak(buf: Float32Array<ArrayBuffer>): number {
  let peak = 0
  for (let i = 0; i < buf.length; i++) {
    const abs = Math.abs(buf[i])
    if (abs > peak) peak = abs
  }
  return peak
}

// 4x linear interpolation oversampling for approximate true peak
export function calcTruePeak(buf: Float32Array<ArrayBuffer>): number {
  let peak = 0
  for (let i = 0; i < buf.length - 1; i++) {
    const a = buf[i], b = buf[i + 1]
    for (let t = 0; t < 4; t++) {
      const v = Math.abs(a + (b - a) * (t / 4))
      if (v > peak) peak = v
    }
  }
  return peak
}

// Simplified K-weighted RMS approximation using frequency-domain weighting
export function calcApproxLUFS(freqData: Uint8Array<ArrayBuffer>, sampleRate: number): number {
  const bins = freqData.length
  const nyq = sampleRate / 2
  let weightedSum = 0
  let count = 0

  for (let i = 1; i < bins; i++) {
    const freq = (i / bins) * nyq
    const linear = freqData[i] / 255
    // Simplified K-weighting: boost high-mids, slight low cut
    let weight = 1.0
    if (freq < 60) weight = 0.2
    else if (freq < 200) weight = 0.6
    else if (freq < 800) weight = 1.0
    else if (freq < 3000) weight = 1.4
    else if (freq < 8000) weight = 1.2
    else weight = 0.9
    weightedSum += linear * linear * weight
    count++
  }
  if (count === 0) return DB_FLOOR
  const rms = Math.sqrt(weightedSum / count)
  return rms < 1e-6 ? DB_FLOOR : 20 * Math.log10(rms) - 0.691
}

interface LoudnessState {
  momentaryHistory: number[]
  shortTermHistory: number[]
  integratedHistory: number[]
  peakHold: number
  peakHoldTimer: number
}

export function createLoudnessState(): LoudnessState {
  return {
    momentaryHistory: [],
    shortTermHistory: [],
    integratedHistory: [],
    peakHold: -Infinity,
    peakHoldTimer: 0,
  }
}

export function updateLoudnessReading(
  state: LoudnessState,
  freqData: Uint8Array<ArrayBuffer>,
  timeDomain: Float32Array<ArrayBuffer>,
  sampleRate: number,
  now: number
): import('../types/meters').LoudnessReading {
  const instantLUFS = calcApproxLUFS(freqData, sampleRate)
  const rmsLin = calcRMS(timeDomain)
  const peakLin = calcPeak(timeDomain)
  const truePeakLin = calcTruePeak(timeDomain)

  // Sliding window averages
  state.momentaryHistory.push(instantLUFS)
  if (state.momentaryHistory.length > 24) state.momentaryHistory.shift() // ~400ms at 60fps

  state.shortTermHistory.push(instantLUFS)
  if (state.shortTermHistory.length > 180) state.shortTermHistory.shift() // ~3s at 60fps

  state.integratedHistory.push(instantLUFS)
  if (state.integratedHistory.length > 3600) state.integratedHistory.shift() // max 60s

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  const momentary = avg(state.momentaryHistory)
  const shortTerm = avg(state.shortTermHistory)
  const integrated = avg(state.integratedHistory)

  const rmsdB = linToDb(rmsLin)
  const peakdB = linToDb(peakLin)
  const truePeakdB = linToDb(truePeakLin)

  // Peak hold
  if (peakdB > state.peakHold) {
    state.peakHold = peakdB
    state.peakHoldTimer = now
  } else if (now - state.peakHoldTimer > 2000) {
    state.peakHold = Math.max(state.peakHold - 0.5, peakdB)
  }

  const crestFactor = peakdB - rmsdB
  // Approximate dynamic range from short-term loudness variance
  const variance = state.shortTermHistory.length > 10
    ? state.shortTermHistory.reduce((acc, v) => acc + (v - shortTerm) ** 2, 0) / state.shortTermHistory.length
    : 0
  const dynamicRange = Math.min(Math.sqrt(variance) * 4, 30)

  return {
    momentary,
    shortTerm,
    integrated,
    truePeak: truePeakdB,
    rms: rmsdB,
    peak: peakdB,
    crestFactor: Math.max(0, crestFactor),
    dynamicRange,
    isClipping: truePeakdB > -0.1,
  }
}
