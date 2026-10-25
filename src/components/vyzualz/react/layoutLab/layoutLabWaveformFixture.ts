import type { RgbWaveformAnalysis } from '../../../../features/waveform/rgbWaveformTypes'
import type { VzCueMarker } from '../../../../types/cue'

// A synthetic loaded-track waveform for Layout Lab's audio dock: the same RgbWaveformAnalysis shape the app's analyser
// produces (4096 bins of peaks, RMS and low / mid / high energy), generated deterministically from a song-shaped
// loudness envelope (quiet intro, a build, a drop, a breakdown, a second build and drop, an outro) so the production
// canvas draws it exactly as it draws a real track, with no audio decoded or analysed.

export const LAB_WAVEFORM_DURATION_SEC = 119.069
export const LAB_WAVEFORM_START_SEC = 12.777
const BINS = 4096

// [startSec, endSec, startLevel, endLevel] — a linear loudness ramp per section.
const ENVELOPE: readonly (readonly [number, number, number, number])[] = [
  [0, 8, 0.22, 0.3], [8, 24.5, 0.34, 0.74], [24.5, 56, 0.9, 0.94], [56, 70, 0.3, 0.2],
  [70, 90, 0.26, 0.78], [90, 110, 0.92, 0.9], [110, 119.069, 0.6, 0.12],
]

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function level(timeSec: number): number {
  const section = ENVELOPE.find(([start, end]) => timeSec >= start && timeSec < end) ?? ENVELOPE[ENVELOPE.length - 1]!
  const [start, end, from, to] = section
  return from + (to - from) * ((timeSec - start) / Math.max(0.001, end - start))
}

function buildAnalysis(): RgbWaveformAnalysis {
  const positivePeaks = new Float32Array(BINS)
  const negativePeaks = new Float32Array(BINS)
  const rms = new Float32Array(BINS)
  const lowEnergy = new Float32Array(BINS)
  const midEnergy = new Float32Array(BINS)
  const highEnergy = new Float32Array(BINS)
  for (let i = 0; i < BINS; i++) {
    const t = (i / BINS) * LAB_WAVEFORM_DURATION_SEC
    const beat = Math.pow(Math.abs(Math.sin(t * Math.PI * (129 / 60))), 3) // kick pulse at 129 BPM
    const body = level(t)
    const energy = Math.min(1, body * (0.7 + 0.3 * beat))
    positivePeaks[i] = Math.min(1, energy * (0.78 + 0.22 * hash(i)))
    negativePeaks[i] = -Math.min(1, energy * (0.72 + 0.26 * hash(i + 9000)))
    rms[i] = energy * (0.46 + 0.1 * hash(i + 4000))
    lowEnergy[i] = Math.min(1, body * (0.55 + 0.45 * beat))
    midEnergy[i] = Math.min(1, body * (0.45 + 0.25 * hash(i + 1500)))
    highEnergy[i] = Math.min(1, body * (0.2 + 0.5 * hash(i + 2500)) * (t > 24.5 && t < 56 ? 1.2 : 0.8))
  }
  return { version: 1, durationSec: LAB_WAVEFORM_DURATION_SEC, sampleRate: 48000, binCount: BINS, positivePeaks, negativePeaks, rms, lowEnergy, midEnergy, highEnergy }
}

export const LAB_WAVEFORM: RgbWaveformAnalysis = buildAnalysis()

export const LAB_WAVEFORM_CUES: VzCueMarker[] = [
  { id: 'lab-cue-1', label: 'Intro', time: 0.4, type: 'intro', color: '#4ac7db' },
  { id: 'lab-cue-2', label: 'Build', time: 8, type: 'build', color: '#d8b95a' },
  { id: 'lab-cue-3', label: 'Drop', time: 24.5, type: 'drop', color: '#e2364f' },
  { id: 'lab-cue-4', label: 'Break', time: 56, type: 'break', color: '#61d6aa' },
  { id: 'lab-cue-5', label: 'Drop 2', time: 90, type: 'drop', color: '#e2364f' },
]
