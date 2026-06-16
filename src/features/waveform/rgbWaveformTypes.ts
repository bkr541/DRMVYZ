export const RGB_WAVEFORM_VERSION   = 1
export const RGB_WAVEFORM_BIN_COUNT = 4096
export const RGB_FFT_SIZE           = 2048
export const RGB_HOP_SIZE           = 1024

export const LOW_MIN_HZ  =    20
export const LOW_MAX_HZ  =   250
export const MID_MIN_HZ  =   250
export const MID_MAX_HZ  =  4000
export const HIGH_MIN_HZ =  4000
// HIGH_MAX_HZ: computed per-track as Math.min(20000, sampleRate / 2)

export const SMOOTHING_KERNEL = [0.15, 0.25, 0.20, 0.25, 0.15] as const

export const BLEND_RELATIVE = 0.65
export const BLEND_ABSOLUTE = 0.35

export type RgbWaveformStatus = 'idle' | 'queued' | 'analyzing' | 'complete' | 'error'

export interface RgbWaveformAnalysis {
  version:       number
  durationSec:   number
  sampleRate:    number
  binCount:      number
  positivePeaks: Float32Array
  negativePeaks: Float32Array
  rms:           Float32Array
  lowEnergy:     Float32Array
  midEnergy:     Float32Array
  highEnergy:    Float32Array
}
