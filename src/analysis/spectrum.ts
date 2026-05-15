// Spectrum processing utilities

// Slope compensation: add dB/octave tilt to flatten pink-noise spectrum for display
export function applySlopeCompensation(
  freqData: Uint8Array<ArrayBuffer>,
  sampleRate: number,
  slopeDb: number // typically +3 dB/octave
): Float32Array<ArrayBuffer> {
  const bins = freqData.length
  const nyq = sampleRate / 2
  const result = new Float32Array(bins) as Float32Array<ArrayBuffer>
  const refFreq = 1000
  for (let i = 1; i < bins; i++) {
    const freq = (i / bins) * nyq
    const octaves = Math.log2(Math.max(freq, 1) / refFreq)
    const boostDb = octaves * slopeDb
    const boostLinear = Math.pow(10, boostDb / 20)
    result[i] = Math.min((freqData[i] / 255) * boostLinear, 1)
  }
  return result
}

// Compute masking: where refFreq > mainFreq (ref masks main track)
export function calcMasking(
  mainFreq: Uint8Array<ArrayBuffer>,
  refFreq: Uint8Array<ArrayBuffer>
): Float32Array<ArrayBuffer> {
  const bins = Math.min(mainFreq.length, refFreq.length)
  const result = new Float32Array(bins) as Float32Array<ArrayBuffer>
  for (let i = 0; i < bins; i++) {
    const diff = refFreq[i] / 255 - mainFreq[i] / 255
    result[i] = Math.max(0, diff)
  }
  return result
}

// Log-scale frequency bin mapping for display
export function logBinMap(displayBins: number, fftBins: number): number[] {
  const map: number[] = []
  for (let i = 0; i < displayBins; i++) {
    const t = i / displayBins
    const logT = Math.pow(10, t * Math.log10(fftBins))
    map.push(Math.min(Math.floor(logT), fftBins - 1))
  }
  return map
}

// Find resonant peaks: bins significantly above their neighbors
export function findResonances(
  freqData: Uint8Array<ArrayBuffer>,
  sampleRate: number,
  threshold = 30
): Array<{ freq: number; magnitude: number }> {
  const bins = freqData.length
  const nyq = sampleRate / 2
  const peaks: Array<{ freq: number; magnitude: number }> = []

  for (let i = 2; i < bins - 2; i++) {
    const v = freqData[i]
    const neighbors = (freqData[i - 2] + freqData[i - 1] + freqData[i + 1] + freqData[i + 2]) / 4
    if (v > neighbors + threshold && v > 80) {
      peaks.push({
        freq: Math.round((i / bins) * nyq),
        magnitude: v,
      })
    }
  }

  // Return top 5 strongest resonances
  return peaks.sort((a, b) => b.magnitude - a.magnitude).slice(0, 5)
}
