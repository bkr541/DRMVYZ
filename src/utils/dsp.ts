// DSP utilities — K-weighting approximation, band energy, LUFS, True Peak

// ─── K-weighted LUFS approximation ──────────────────────────────────────────
// Real EBU R128 requires a pre-filter + high-pass filter and gating.
// This approximation applies a simplified weighting curve to the FFT magnitude
// and computes mean square → dB. Displayed as "approx. LUFS".

export function calcApproxLUFS(freqData: Uint8Array<ArrayBuffer>, sampleRate: number): number {
  if (freqData.length === 0) return -100
  const bins = freqData.length
  const nyquist = sampleRate / 2

  let weightedSum = 0
  let count = 0

  for (let i = 1; i < bins; i++) {
    const freq = (i / bins) * nyquist
    const linear = freqData[i] / 255

    // K-weighting curve approximation:
    // - Roll off below 80 Hz (high-pass at 38 Hz, but approximate)
    // - Slight shelf boost above 1.5 kHz
    let weight = 1.0
    if (freq < 38)   weight = 0
    else if (freq < 200) weight = (freq - 38) / 162
    if (freq > 1500) weight *= 1 + 3.5 * Math.min(1, (freq - 1500) / 6000)

    weightedSum += linear * linear * weight
    count++
  }

  if (count === 0 || weightedSum <= 0) return -100
  const meanSquare = weightedSum / count
  return Math.max(-60, 10 * Math.log10(meanSquare) - 0.691)
}

// ─── True Peak approximation ─────────────────────────────────────────────────
// Approximates true peak using linear interpolation between samples (4× upsampling).
// Not ITU-R BS.1770-4 compliant — labeled as "approx." in the UI.
export function calcTruePeak(timeDomain: Uint8Array<ArrayBuffer>): number {
  let peak = 0
  for (let i = 0; i < timeDomain.length - 1; i++) {
    const s0 = (timeDomain[i] / 128) - 1
    const s1 = (timeDomain[i + 1] / 128) - 1
    // Check 4 interpolated points between samples
    for (let t = 0; t <= 4; t++) {
      const interp = s0 + (s1 - s0) * (t / 4)
      const abs = Math.abs(interp)
      if (abs > peak) peak = abs
    }
  }
  return peak
}

// ─── Band energy ─────────────────────────────────────────────────────────────
// Returns [bass, mid, high] normalised energy [0..1] from frequency data.
export function calcBandEnergy(
  freqData: Uint8Array<ArrayBuffer>,
  sampleRate: number
): [number, number, number] {
  const bins = freqData.length
  const nyquist = sampleRate / 2

  let bass = 0, bassN = 0
  let mid  = 0, midN  = 0
  let high = 0, highN = 0

  for (let i = 0; i < bins; i++) {
    const freq = (i / bins) * nyquist
    const v = freqData[i] / 255
    if (freq < 250)       { bass += v * v; bassN++ }
    else if (freq < 4000) { mid  += v * v; midN++  }
    else                  { high += v * v; highN++ }
  }

  return [
    bassN > 0 ? Math.sqrt(bass / bassN) : 0,
    midN  > 0 ? Math.sqrt(mid  / midN)  : 0,
    highN > 0 ? Math.sqrt(high / highN) : 0,
  ]
}

// ─── Phase correlation ───────────────────────────────────────────────────────
// Pearson correlation between left and right time-domain signals.
// +1 = perfectly in phase, 0 = uncorrelated, -1 = opposite phase
export function calcPhaseCorrelation(
  bufL: Float32Array<ArrayBuffer>,
  bufR: Float32Array<ArrayBuffer>
): number {
  const n = Math.min(bufL.length, bufR.length)
  if (n === 0) return 0
  let sumL = 0, sumR = 0, sumLL = 0, sumRR = 0, sumLR = 0
  for (let i = 0; i < n; i++) {
    sumL  += bufL[i]
    sumR  += bufR[i]
    sumLL += bufL[i] * bufL[i]
    sumRR += bufR[i] * bufR[i]
    sumLR += bufL[i] * bufR[i]
  }
  const meanL = sumL / n, meanR = sumR / n
  const varL  = sumLL / n - meanL * meanL
  const varR  = sumRR / n - meanR * meanR
  const cov   = sumLR / n - meanL * meanR
  const denom = Math.sqrt(varL * varR)
  return denom < 1e-10 ? 0 : cov / denom
}

// ─── RMS ─────────────────────────────────────────────────────────────────────
export function calcRMS(buf: Float32Array<ArrayBuffer>): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

// ─── Linear to dB ────────────────────────────────────────────────────────────
export function linToDb(v: number): number {
  return v <= 0 ? -100 : Math.max(-100, 20 * Math.log10(v))
}

// ─── Exponential smoothing ───────────────────────────────────────────────────
export function smooth(current: number, target: number, factor: number): number {
  return current + (target - current) * factor
}
