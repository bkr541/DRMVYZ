// ─── Module Types ────────────────────────────────────────────────────────────

export type ModuleType =
  | 'spectrum'
  | 'spectrogram'
  | 'waveform'
  | 'vectorscope'
  | 'oscilloscope'
  | 'loudness'
  | 'lr'
  | 'midside'
  | 'phase'
  | 'bands'
  | 'level' // configurable: rms | peak | truepeak | vu

export type ModuleWidth = 'sm' | 'md' | 'lg' | 'xl'
export type ModuleHeight = 'compact' | 'normal' | 'tall'

export type SpectrumMode = 'bars' | 'line' | 'filled' | 'curve'
export type OscMode = 'L' | 'R' | 'Mid' | 'Side'
export type VUMode = 'needle' | 'bar'
export type WaveformMode = 'scroll' | 'centered'
export type LevelMode = 'rms' | 'peak' | 'truepeak' | 'vu'
export type ColorMapName = 'cyan-green' | 'fire' | 'ice' | 'mono' | 'rainbow' | 'plasma'

export interface ModuleSettings {
  // Spectrum
  spectrumMode?: SpectrumMode
  colorMap?: ColorMapName
  showTargetCurve?: boolean
  // Oscilloscope
  oscMode?: OscMode
  // VU / Level
  vuMode?: VUMode
  levelMode?: LevelMode
  // Waveform
  waveformMode?: WaveformMode
  // Spectrogram
  scrollSpeed?: number
  // General
  showPeakHold?: boolean
  peakDecay?: number
  smoothing?: number
  sensitivity?: number
}

export interface ModuleInstance {
  id: string
  type: ModuleType
  label: string
  enabled: boolean
  order: number
  width: ModuleWidth
  height: ModuleHeight
  settings: ModuleSettings
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export type AudioSource = 'file' | 'microphone' | 'demo'

export type FftSize = 512 | 1024 | 2048 | 4096 | 8192

// Re-exported so callers import from one place
export type { TrackAnalysisStatus } from './features/musicIntelligence/types'
import type { TrackIntelligenceAnalysis, TrackAnalysisStatus, BeatMarkerMI } from './features/musicIntelligence/types'

export type BpmSource = 'offline_analysis' | 'live_analysis' | 'manual_override'

export interface TrackAnalysisRuntime {
  status:            TrackAnalysisStatus
  analysis:          TrackIntelligenceAnalysis | null
  error:             string | null
  analysisKey:       string
  analysisVersion:   string
  bpmOverride:       number | null
  bpmOverrideSource: 'live_analysis' | 'manual_override' | null
  /**
   * Regenerated beat grid produced when a manual BPM override is active.
   * null when no override is in effect — consumers must fall back to
   * analysis.beatGrid / analysis.downbeats in that case.
   * Stored per-track so switching tracks never bleeds one override onto another.
   */
  effectiveBeatGrid: BeatMarkerMI[] | null
}

export const DEFAULT_TRACK_ANALYSIS_RUNTIME: TrackAnalysisRuntime = {
  status:            'not_analyzed',
  analysis:          null,
  error:             null,
  analysisKey:       '',
  analysisVersion:   '',
  bpmOverride:       null,
  bpmOverrideSource: null,
  effectiveBeatGrid: null,
}

export interface Track {
  id: string
  name: string
  displayName: string
  url: string
  duration: number
  sourceKind:      'file' | 'remote'
  sourceFile?:     File
  analysisRuntime: TrackAnalysisRuntime
}

// ─── Layout & Themes ─────────────────────────────────────────────────────────

export type LayoutPreset = '16:9' | '9:16' | '1:1' | 'horizontal' | 'quad' | 'dashboard'

export type Theme = 'cyan-green' | 'cyan-blue' | 'green-gold' | 'purple-cyan'

export const THEME_COLORS: Record<Theme, { primary: string; secondary: string }> = {
  'cyan-green':  { primary: '#00e5ff', secondary: '#00ff88' },
  'cyan-blue':   { primary: '#00e5ff', secondary: '#448aff' },
  'green-gold':  { primary: '#00ff88', secondary: '#ffcc00' },
  'purple-cyan': { primary: '#bb86fc', secondary: '#00e5ff' },
}

// ─── Global Settings ─────────────────────────────────────────────────────────

export interface GlobalSettings {
  theme: Theme
  accentIntensity: number
  showScanlines: boolean
  showGlow: boolean
  showGrid: boolean
  showLogo: boolean
  showModuleBorders: boolean
  transparentBg: boolean
  fontDensity: 'compact' | 'normal' | 'large'
  fftSize: FftSize
  smoothing: number
  sensitivity: number
  showPeakHold: boolean
  peakDecay: number
  displayNameOverride: string
  recordingMode: boolean
  showRecIndicator: boolean
  showSafeMargins: boolean
  safeMarginsAspect: '9:16' | '1:1' | '16:9'
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  theme: 'cyan-green',
  accentIntensity: 0.7,
  showScanlines: false,
  showGlow: true,
  showGrid: true,
  showLogo: true,
  showModuleBorders: true,
  transparentBg: false,
  fontDensity: 'normal',
  fftSize: 2048,
  smoothing: 0.8,
  sensitivity: 1.0,
  showPeakHold: true,
  peakDecay: 0.97,
  displayNameOverride: '',
  recordingMode: false,
  showRecIndicator: true,
  showSafeMargins: false,
  safeMarginsAspect: '9:16',
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export interface VisualPreset {
  id: string
  name: string
  createdAt: number
  settings: GlobalSettings
  modules: ModuleInstance[]
  layout: LayoutPreset
}

// ─── Default module catalog ───────────────────────────────────────────────────

export const DEFAULT_MODULES: ModuleInstance[] = [
  { id: 'm-spectrum',    type: 'spectrum',    label: 'Spectrum',         enabled: true,  order: 0,  width: 'xl',  height: 'normal', settings: { spectrumMode: 'bars',   colorMap: 'cyan-green', showTargetCurve: false, showPeakHold: true, peakDecay: 0.97 } },
  { id: 'm-waveform',   type: 'waveform',    label: 'Waveform',         enabled: true,  order: 1,  width: 'xl',  height: 'compact', settings: { waveformMode: 'centered', colorMap: 'cyan-green' } },
  { id: 'm-spectrogram',type: 'spectrogram', label: 'Spectrogram',      enabled: true,  order: 2,  width: 'lg',  height: 'normal', settings: { colorMap: 'fire', scrollSpeed: 2 } },
  { id: 'm-vectorscope',type: 'vectorscope', label: 'Vectorscope',      enabled: true,  order: 3,  width: 'sm',  height: 'normal', settings: {} },
  { id: 'm-oscilloscope',type:'oscilloscope',label: 'Oscilloscope',     enabled: true,  order: 4,  width: 'md',  height: 'normal', settings: { oscMode: 'L' } },
  { id: 'm-loudness',   type: 'loudness',    label: 'Loudness (approx)',enabled: true,  order: 5,  width: 'md',  height: 'normal', settings: {} },
  { id: 'm-lr',         type: 'lr',          label: 'L/R Meters',       enabled: true,  order: 6,  width: 'sm',  height: 'normal', settings: { showPeakHold: true } },
  { id: 'm-midside',    type: 'midside',     label: 'Mid/Side',         enabled: true,  order: 7,  width: 'sm',  height: 'normal', settings: { showPeakHold: true } },
  { id: 'm-phase',      type: 'phase',       label: 'Phase Correlation',enabled: true,  order: 8,  width: 'sm',  height: 'compact', settings: {} },
  { id: 'm-bands',      type: 'bands',       label: 'Band Meters',      enabled: true,  order: 9,  width: 'md',  height: 'compact', settings: {} },
  { id: 'm-peak',       type: 'level',       label: 'Peak',             enabled: false, order: 10, width: 'sm',  height: 'compact', settings: { levelMode: 'peak' } },
  { id: 'm-rms',        type: 'level',       label: 'RMS',              enabled: false, order: 11, width: 'sm',  height: 'compact', settings: { levelMode: 'rms' } },
  { id: 'm-truepeak',   type: 'level',       label: 'True Peak',        enabled: false, order: 12, width: 'sm',  height: 'compact', settings: { levelMode: 'truepeak' } },
  { id: 'm-vu',         type: 'level',       label: 'VU Meter',         enabled: false, order: 13, width: 'md',  height: 'normal', settings: { levelMode: 'vu', vuMode: 'needle' } },
]
