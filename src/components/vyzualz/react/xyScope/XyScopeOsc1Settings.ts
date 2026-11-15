// Sound Drawing XY › OSC 1: persisted settings. Each of the five response systems keeps its own sixteen control
// values and phosphor colour (as the Text Lab's tabs do); letters keep their own gain / direction offset / focus.

import { OSC1_DEFAULTS, OSC1_MODES, osc1ModeSettings, type Osc1ControlKey, type Osc1Focus, type Osc1Settings } from './XyScopeOsc1Engine'
import { OSC1_RANGES } from './XyScopeOsc1Performance'

export const OSC1_PRESET_ID = 'osc1'
export const OSC1_MAX_LETTERS = 16

export interface Osc1ControlSpec {
  id: Osc1ControlKey
  label: string
  description: string
  min: number
  max: number
  step: number
  suffix: '%' | 'ms' | '°' | 'px' | 'Hz'
}

/** Live response: the Text Lab's "motion" group. */
export const OSC1_RESPONSE_CONTROLS: readonly Osc1ControlSpec[] = Object.freeze([
  { id: 'motion', label: 'Signal expansion', description: 'Strength of sustained frequency-driven expansion.', min: 0, max: 100, step: 1, suffix: '%' },
  { id: 'readability', label: 'Legibility protection', description: 'Outer extension cap. Even 100% permits audio response.', min: 0, max: 100, step: 1, suffix: '%' },
  { id: 'depth', label: 'Burst extension', description: 'Strength of transient-driven expansion.', min: 0, max: 100, step: 1, suffix: '%' },
  { id: 'attack', label: 'Attack smoothing', description: 'Rise time for frequency and feature envelopes.', min: 8, max: 250, step: 1, suffix: 'ms' },
  { id: 'release', label: 'Release / damping', description: 'Monotonic relaxation of extensions after excitation.', min: 40, max: 800, step: 5, suffix: 'ms' },
  { id: 'sensitivity', label: 'Transient sensitivity', description: 'Contribution of new spectral energy.', min: 0, max: 100, step: 1, suffix: '%' },
])
/** XY geometry. */
export const OSC1_GEOMETRY_CONTROLS: readonly Osc1ControlSpec[] = Object.freeze([
  { id: 'rotation', label: 'Direction spread', description: 'Angular width of each frequency region’s influence.', min: 0, max: 140, step: 1, suffix: '°' },
  { id: 'correlation', label: 'X/Y coupling', description: 'Radial versus unequal-axis behavior; strongest in Stereo mode.', min: 0, max: 100, step: 1, suffix: '%' },
  { id: 'axisX', label: 'X axis scale', description: 'Manual size of the base glyph on the X axis.', min: 35, max: 150, step: 1, suffix: '%' },
  { id: 'axisY', label: 'Y axis scale', description: 'Manual size of the base glyph on the Y axis.', min: 35, max: 150, step: 1, suffix: '%' },
  { id: 'shear', label: 'Stereo direction bias', description: 'Imbalance-driven unequal outward extension.', min: 0, max: 100, step: 1, suffix: '%' },
  { id: 'harmonics', label: 'Harmonic detail', description: 'Amount of current PCM-magnitude detail.', min: 0, max: 100, step: 1, suffix: '%' },
])
/** Beam and phosphor. */
export const OSC1_BEAM_CONTROLS: readonly Osc1ControlSpec[] = Object.freeze([
  { id: 'intensity', label: 'Beam intensity', description: 'Brightness of the phosphor beam.', min: 10, max: 100, step: 1, suffix: '%' },
  { id: 'persistence', label: 'Phosphor decay', description: 'How long the glow lingers after the beam moves on.', min: 20, max: 250, step: 5, suffix: 'ms' },
  { id: 'width', label: 'Beam focus / width', description: 'Width of the beam spot.', min: .6, max: 3, step: .05, suffix: 'px' },
  { id: 'scan', label: 'Beam scan frequency', description: 'How many times per second the beam retraces each letter.', min: 8, max: 180, step: 1, suffix: 'Hz' },
])
export const OSC1_ALL_CONTROLS: readonly Osc1ControlSpec[] = Object.freeze([...OSC1_RESPONSE_CONTROLS, ...OSC1_GEOMETRY_CONTROLS, ...OSC1_BEAM_CONTROLS])

export const OSC1_FOCUS_OPTIONS = Object.freeze([
  { value: 'auto', label: 'Distributed by letter' },
  { value: 'level', label: 'Full-band level' },
  { value: 'bass', label: 'Bass / 35–180 Hz' },
  { value: 'mid', label: 'Mid / 180 Hz–2.5 kHz' },
  { value: 'air', label: 'Air / 2.5–11.5 kHz' },
] as const)

export interface Osc1LetterSettings { gain: number; offset: number; focus: Osc1Focus }
export const DEFAULT_OSC1_LETTER: Readonly<Osc1LetterSettings> = Object.freeze({ gain: 1, offset: 0, focus: 'auto' })

export interface XyScopeOsc1Settings {
  /** The selected response system, 0–4. */
  mode: number
  autoPerformance: boolean
  grid: boolean
  /** Hold freezes the displayed trace while audio and analysis continue. */
  hold: boolean
  /** Which letter channel the inspector edits; -1 edits every channel. */
  letterIndex: number
  /** Incremented by Reset signals; the runtime clears its analysis history when it changes. */
  resetSignals: number
  presets: readonly Osc1Settings[]
  letters: readonly Osc1LetterSettings[]
}

export const DEFAULT_OSC1_SETTINGS: Readonly<XyScopeOsc1Settings> = Object.freeze({
  mode: 0, autoPerformance: false, grid: true, hold: false, letterIndex: -1, resetSignals: 0,
  presets: Object.freeze(OSC1_MODES.map((_, i) => Object.freeze(osc1ModeSettings(i)))),
  letters: Object.freeze([]),
})

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const finiteOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function normalizeOsc1Preset(value: unknown, index: number): Osc1Settings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const base = osc1ModeSettings(index)
  const out = { ...base } as Osc1Settings & Record<Osc1ControlKey, number>
  for (const key of Object.keys(OSC1_DEFAULTS) as Osc1ControlKey[]) {
    const [lo, hi] = OSC1_RANGES[key]
    out[key] = Math.min(hi, Math.max(lo, finiteOr(record[key], base[key])))
  }
  out.color = typeof record.color === 'string' && HEX_COLOR.test(record.color) ? record.color.toLowerCase() : base.color
  return out
}

export function normalizeOsc1Settings(value: unknown): XyScopeOsc1Settings {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const presets = Array.isArray(record.presets) ? record.presets : []
  const letters = Array.isArray(record.letters) ? record.letters.slice(0, OSC1_MAX_LETTERS) : []
  const focus = new Set<string>(OSC1_FOCUS_OPTIONS.map(option => option.value))
  return {
    mode: Math.max(0, Math.min(OSC1_MODES.length - 1, Math.round(finiteOr(record.mode, 0)))),
    autoPerformance: typeof record.autoPerformance === 'boolean' ? record.autoPerformance : false,
    grid: typeof record.grid === 'boolean' ? record.grid : true,
    hold: typeof record.hold === 'boolean' ? record.hold : false,
    letterIndex: Math.max(-1, Math.min(OSC1_MAX_LETTERS - 1, Math.round(finiteOr(record.letterIndex, -1)))),
    resetSignals: Math.max(0, Math.min(1e9, Math.round(finiteOr(record.resetSignals, 0)))),
    presets: OSC1_MODES.map((_, i) => normalizeOsc1Preset(presets[i], i)),
    letters: letters.map(entry => {
      const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
      return {
        gain: Math.min(1.5, Math.max(0, finiteOr(item.gain, 1))),
        offset: Math.min(Math.PI * 2, Math.max(0, finiteOr(item.offset, 0))),
        focus: typeof item.focus === 'string' && focus.has(item.focus) ? item.focus as Osc1Focus : 'auto',
      }
    }),
  }
}

export function osc1LetterAt(settings: XyScopeOsc1Settings, index: number): Osc1LetterSettings {
  return settings.letters[index] ?? DEFAULT_OSC1_LETTER
}
