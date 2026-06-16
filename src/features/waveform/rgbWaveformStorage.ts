import { create } from 'zustand'
import type { RgbWaveformAnalysis, RgbWaveformStatus } from './rgbWaveformTypes'

export interface RgbWaveformEntry {
  status:   RgbWaveformStatus
  analysis: RgbWaveformAnalysis | null
  error:    string | null
}

interface RgbWaveformStore {
  waveforms:   Record<string, RgbWaveformEntry>
  setStatus:   (key: string, status: RgbWaveformStatus, error?: string) => void
  setWaveform: (key: string, analysis: RgbWaveformAnalysis) => void
  getEntry:    (key: string) => RgbWaveformEntry | undefined
  clear:       (key: string) => void
}

export const useRgbWaveformStore = create<RgbWaveformStore>((set, get) => ({
  waveforms: {},

  setStatus(key, status, error) {
    set(s => ({
      waveforms: {
        ...s.waveforms,
        [key]: { ...(s.waveforms[key] ?? { analysis: null }), status, error: error ?? null },
      },
    }))
  },

  setWaveform(key, analysis) {
    set(s => ({
      waveforms: {
        ...s.waveforms,
        [key]: { status: 'complete', analysis, error: null },
      },
    }))
  },

  getEntry(key) {
    return get().waveforms[key]
  },

  clear(key) {
    set(s => {
      const next = { ...s.waveforms }
      delete next[key]
      return { waveforms: next }
    })
  },
}))
