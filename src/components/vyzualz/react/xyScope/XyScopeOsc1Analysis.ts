// Sound Drawing XY › OSC 1: the live stereo feature extractor from XY / TEXT LAB 05, fed from the shared stereo
// scope window instead of two Web Audio analysers. Each channel's 2,048 PCM samples are Blackman-windowed and
// transformed exactly as an AnalyserNode with smoothing 0 would (magnitude / N), so the Text Lab's eight-band
// spectrum, onsets, flux, stereo and crest descriptors are reproduced from the same signal.

import { OSC1_BAND_COUNT, OSC1_BAND_EDGES, emptyOsc1Features, type Osc1Features } from './XyScopeOsc1Engine'
import { osc1Fft } from './XyScopeOsc1Fft'

const FFT_SIZE = 2048
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, p: number) => a + (b - a) * p
/** Shared absolute transfer curve preserves relative band energy; bands are never normalised independently. */
const energyCurve = (p: number) => clamp(Math.log1p(Math.sqrt(p) * 32) / Math.log(9))

export interface Osc1Measurement extends Osc1Features {
  spectrum: number[]
  onsets: number[]
  waveStart: number
}

let blackman: Float32Array | null = null
function blackmanWindow(): Float32Array {
  if (blackman) return blackman
  const a = .16, a0 = (1 - a) / 2, a1 = .5, a2 = a / 2
  blackman = new Float32Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) blackman[i] = a0 - a1 * Math.cos(2 * Math.PI * i / FFT_SIZE) + a2 * Math.cos(4 * Math.PI * i / FFT_SIZE)
  return blackman
}

export class Osc1Analyzer {
  readonly timeL = new Float32Array(FFT_SIZE)
  readonly timeR = new Float32Array(FFT_SIZE)
  private readonly ampL = new Float32Array(FFT_SIZE / 2)
  private readonly ampR = new Float32Array(FFT_SIZE / 2)
  private readonly re = new Float64Array(FFT_SIZE)
  private readonly im = new Float64Array(FFT_SIZE)
  private previous = new Float32Array(FFT_SIZE / 2)
  private fluxAverage = .0001
  private fluxPeak = .001

  reset(): void {
    this.previous.fill(0)
    this.fluxAverage = .0001
    this.fluxPeak = .001
  }

  private spectrumOf(time: Float32Array, out: Float32Array): void {
    const w = blackmanWindow(), re = this.re, im = this.im
    for (let i = 0; i < FFT_SIZE; i++) { re[i] = time[i] * w[i]; im[i] = 0 }
    osc1Fft(re, im)
    for (let i = 0; i < FFT_SIZE / 2; i++) out[i] = Math.hypot(re[i], im[i]) / FFT_SIZE
  }

  /**
   * Fills the PCM windows from the newest samples of each channel. A window shorter than 2,048 samples is
   * right-aligned with leading silence; a longer one contributes its latest 2,048.
   */
  load(left: ArrayLike<number>, right: ArrayLike<number>): void {
    const fill = (source: ArrayLike<number>, target: Float32Array) => {
      const n = source.length
      if (n >= FFT_SIZE) for (let i = 0; i < FFT_SIZE; i++) target[i] = source[n - FFT_SIZE + i]
      else { target.fill(0); for (let i = 0; i < n; i++) target[FFT_SIZE - n + i] = source[i] }
    }
    fill(left, this.timeL)
    fill(right, this.timeR)
  }

  /** The Text Lab's measure(): descriptors of the PCM currently loaded, or silence. */
  measure(dt: number, sampleRate: number): Osc1Measurement {
    const { timeL, timeR } = this
    let left = 0, right = 0, cross = 0, side = 0, zero = 0, peakL = 0, peakR = 0, waveStart = 0
    for (let i = 0; i < timeL.length; i++) {
      const l = timeL[i], r = timeR[i]
      peakL = Math.max(peakL, Math.abs(l)); peakR = Math.max(peakR, Math.abs(r))
      if (i < 1024 && i > 0 && timeL[i - 1] <= 0 && l > 0 && waveStart === 0) waveStart = i
      left += l * l; right += r * r; cross += l * r; side += (l - r) * (l - r) * .5
      if (i && Math.sign(l) !== Math.sign(timeL[i - 1])) zero++
    }
    const rms = Math.sqrt((left + right) / (2 * timeL.length))
    if (rms < .00015) { this.previous.fill(0); return { ...emptyOsc1Features(), spectrum: new Array(OSC1_BAND_COUNT).fill(0), onsets: new Array(OSC1_BAND_COUNT).fill(0), waveStart: 0 } }
    this.spectrumOf(timeL, this.ampL)
    this.spectrumOf(timeR, this.ampR)
    let bands = [0, 0, 0], spectrum = new Array<number>(OSC1_BAND_COUNT).fill(0), onsets = new Array<number>(OSC1_BAND_COUNT).fill(0)
    let flux = 0, weight = 0, weighted = 0, arithmetic = 0, logs = 0, nb = 0, peak = 0, peakHz = 40
    const bin = sampleRate / FFT_SIZE, previous = this.previous, bins = FFT_SIZE / 2
    for (let i = 1; i < bins; i++) {
      const hz = i * bin, amp = (this.ampL[i] + this.ampR[i]) * .5, power = amp * amp
      for (let sector = 0; sector < OSC1_BAND_COUNT; sector++) {
        if (hz >= OSC1_BAND_EDGES[sector] && hz < OSC1_BAND_EDGES[sector + 1]) {
          spectrum[sector] += power
          onsets[sector] += Math.max(0, power - previous[i] * previous[i])
          break
        }
      }
      if (hz >= 35 && hz < 180) bands[0] += power
      else if (hz >= 180 && hz < 2500) bands[1] += power
      else if (hz >= 2500 && hz < 11500) bands[2] += power
      if (hz >= 35 && hz < 11500) {
        weight += amp; weighted += hz * amp; flux += Math.max(0, amp - previous[i])
        if (hz > 80) { arithmetic += amp; logs += Math.log(Math.max(amp, 1e-9)); nb++ }
      }
      if (hz >= 40 && hz < 4000 && amp > peak) { peak = amp; peakHz = hz }
      previous[i] = amp
    }
    bands = bands.map(energyCurve)
    spectrum = spectrum.map(energyCurve)
    onsets = onsets.map(p => clamp(Math.sqrt(p) * 7))
    flux /= Math.max(1, bins)
    this.fluxPeak = Math.max(flux, this.fluxPeak * Math.exp(-dt * .9), .00001)
    const novelty = clamp((flux - this.fluxAverage * .35) / (this.fluxPeak * .9 + .00001))
    this.fluxAverage = mix(this.fluxAverage, flux, 1 - Math.exp(-dt * 1.7))
    const total = left + right
    const stereo = clamp(Math.sqrt(side / Math.max(total, .00001)))
    const correlation = clamp(cross / Math.sqrt(Math.max(left * right, .0000001)), -1, 1)
    const flatness = clamp(Math.exp(logs / Math.max(1, nb)) / Math.max(arithmetic / Math.max(1, nb), 1e-9))
    return {
      spectrum, onsets, waveStart,
      peakL: clamp(peakL), peakR: clamp(peakR),
      crest: clamp((Math.max(peakL, peakR) / Math.max(rms, .0001) - 1) / 5),
      level: clamp(rms / .28), bass: bands[0], mid: bands[1], air: bands[2], flux: novelty,
      centroid: clamp(Math.log2(1 + (weighted / Math.max(weight, .000001)) / 80) / 7),
      flatness, width: stereo, correlation,
      balance: clamp((Math.sqrt(right) - Math.sqrt(left)) / Math.max(.0001, Math.sqrt(right) + Math.sqrt(left)), -1, 1),
      dominant: clamp(Math.log2(peakHz / 40) / 7),
      roughness: clamp(zero / timeL.length / .25),
    }
  }
}
