// Sound Drawing XY › INIT: persisted settings and the control catalogue behind its inspector. INIT draws one to three
// classic oscilloscope traces; this file owns the values, ranges and normalisation (no rendering).

export const INIT_PRESET_ID = 'init'

export type InitLayout = 'stacked' | 'side' | 'overlay' | 'omni'
export type InitSignal = 'bands' | 'channels' | 'timebase'
export type InitChangeEvery = '1' | '2' | '4' | '8'

export const INIT_LAYOUTS: readonly { value: InitLayout; label: string }[] = Object.freeze([
  { value: 'stacked', label: 'Stacked' },
  { value: 'side', label: 'Side by Side' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'omni', label: 'Omnidirectional' },
])
export const INIT_SIGNALS: readonly { value: InitSignal; label: string }[] = Object.freeze([
  { value: 'bands', label: 'Frequency Bands' },
  { value: 'channels', label: 'Stereo Channels' },
  { value: 'timebase', label: 'Timebase Zoom' },
])
export const INIT_CHANGE_EVERY: readonly { value: InitChangeEvery; label: string }[] = Object.freeze([
  { value: '1', label: '1 Beat' },
  { value: '2', label: '2 Beats' },
  { value: '4', label: '1 Bar' },
  { value: '8', label: '2 Bars' },
])
export const INIT_COUNTS = Object.freeze([
  { value: '1', label: '1 oscillator' },
  { value: '2', label: '2 oscillators' },
  { value: '3', label: '3 oscillators' },
] as const)

export interface InitValues {
  intensity: number
  audioReactivity: number
  layout: InitLayout
  signal: InitSignal
  /** Lets each oscilloscope start and end away from horizontal, at positions it picks at random. */
  freeEndpoints: boolean
  waveHeight: number
  span: number
  window: number
  changeEvery: InitChangeEvery
  glide: number
  width: number
  glow: number
  trail: number
  waveResponse: number
  kickResponse: number
  snareResponse: number
  color1: string
  color2: string
  color3: string
  backgroundColor: string
}
export type InitNumberKey = { [K in keyof InitValues]: InitValues[K] extends number ? K : never }[keyof InitValues]

export const INIT_DEFAULTS: Readonly<InitValues> = Object.freeze({
  intensity: 1, audioReactivity: 1,
  layout: 'stacked', signal: 'bands', freeEndpoints: false,
  waveHeight: .5, span: .9, window: 12, changeEvery: '4', glide: 500,
  width: 1.8, glow: 1.2, trail: 120,
  waveResponse: 1, kickResponse: .8, snareResponse: .6,
  color1: '#4ac7db', color2: '#ff8a5c', color3: '#c4f06a', backgroundColor: '#02070a',
})

export interface InitControlSpec {
  id: InitNumberKey
  label: string
  description: string
  min: number
  max: number
  step: number
  format: 'percent' | 'ms' | 'px' | 'plain'
}
export const INIT_RANGES: Readonly<Record<InitNumberKey, readonly [number, number]>> = Object.freeze({
  intensity: [0, 2], audioReactivity: [0, 1], waveHeight: [.1, 1], span: [.4, 1], window: [3, 40], glide: [0, 2000],
  width: [.6, 4], glow: [0, 3], trail: [20, 600], waveResponse: [0, 2], kickResponse: [0, 2], snareResponse: [0, 2],
})

export const INIT_MASTER_CONTROLS: readonly InitControlSpec[] = Object.freeze([
  { id: 'intensity', label: 'Master Intensity', description: 'Overall trace brightness. Zero blanks the beam.', min: 0, max: 2, step: .01, format: 'percent' },
  { id: 'audioReactivity', label: 'Audio Reactivity', description: 'Scales how much the music moves the traces. Zero leaves flat lines.', min: 0, max: 1, step: .01, format: 'percent' },
])
export const INIT_SCOPE_CONTROLS: readonly InitControlSpec[] = Object.freeze([
  { id: 'waveHeight', label: 'Wave Height', description: 'How tall each trace swings from its line.', min: .1, max: 1, step: .01, format: 'percent' },
  { id: 'span', label: 'Trace Length', description: 'How much of the screen each oscilloscope line covers.', min: .4, max: 1, step: .01, format: 'percent' },
  { id: 'window', label: 'Time Window', description: 'How much of the waveform one trace shows. Shorter windows show fewer, larger cycles.', min: 3, max: 40, step: 1, format: 'ms' },
])
export const INIT_ENDPOINT_CONTROLS: readonly InitControlSpec[] = Object.freeze([
  { id: 'glide', label: 'Glide', description: 'How slowly the line ends travel to a new position. Zero jumps straight there.', min: 0, max: 2000, step: 10, format: 'ms' },
])
export const INIT_BEAM_CONTROLS: readonly InitControlSpec[] = Object.freeze([
  { id: 'width', label: 'Beam Width', description: 'Thickness of the trace line.', min: .6, max: 4, step: .05, format: 'px' },
  { id: 'glow', label: 'Glow', description: 'Halo around the bright trace. Zero draws a crisp line.', min: 0, max: 3, step: .05, format: 'plain' },
  { id: 'trail', label: 'Phosphor Decay', description: 'How long a trace lingers after it moves on.', min: 20, max: 600, step: 5, format: 'ms' },
])
export const INIT_REACT_CONTROLS: readonly InitControlSpec[] = Object.freeze([
  { id: 'waveResponse', label: 'Wave Response', description: 'How strongly the signal level swells each trace.', min: 0, max: 2, step: .01, format: 'percent' },
  { id: 'kickResponse', label: 'Kick Response', description: 'How much each kick thickens and brightens the traces.', min: 0, max: 2, step: .01, format: 'percent' },
  { id: 'snareResponse', label: 'Snare Response', description: 'How much each snare or hat flares the glow.', min: 0, max: 2, step: .01, format: 'percent' },
])

export interface XyScopeInitSettings {
  /** How many oscilloscopes are on screen: 1, 2 or 3. */
  oscillators: 1 | 2 | 3
  /** Locks endpoint changes to the track's beat grid; off, they follow a free-running clock. */
  bpmSync: boolean
  autoPerformance: boolean
  hold: boolean
  resetSignals: number
  values: InitValues
}

export const DEFAULT_INIT_SETTINGS: Readonly<XyScopeInitSettings> = Object.freeze({
  oscillators: 1, bpmSync: true, autoPerformance: false, hold: false, resetSignals: 0, values: Object.freeze({ ...INIT_DEFAULTS }) as InitValues,
})

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const finiteOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const pick = <T extends string>(value: unknown, options: readonly { value: T }[], fallback: T): T => options.find(option => option.value === value)?.value ?? fallback
const color = (value: unknown, fallback: string) => typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback

export function normalizeInitValues(value: unknown): InitValues {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const out = { ...INIT_DEFAULTS } as InitValues & Record<InitNumberKey, number>
  for (const key of Object.keys(INIT_RANGES) as InitNumberKey[]) {
    const [lo, hi] = INIT_RANGES[key]
    out[key] = Math.min(hi, Math.max(lo, finiteOr(record[key], INIT_DEFAULTS[key])))
  }
  out.window = Math.round(out.window)
  out.layout = pick(record.layout, INIT_LAYOUTS, INIT_DEFAULTS.layout)
  out.signal = pick(record.signal, INIT_SIGNALS, INIT_DEFAULTS.signal)
  out.changeEvery = pick(record.changeEvery, INIT_CHANGE_EVERY, INIT_DEFAULTS.changeEvery)
  out.freeEndpoints = typeof record.freeEndpoints === 'boolean' ? record.freeEndpoints : INIT_DEFAULTS.freeEndpoints
  out.color1 = color(record.color1, INIT_DEFAULTS.color1)
  out.color2 = color(record.color2, INIT_DEFAULTS.color2)
  out.color3 = color(record.color3, INIT_DEFAULTS.color3)
  out.backgroundColor = color(record.backgroundColor, INIT_DEFAULTS.backgroundColor)
  return out
}

export function normalizeInitSettings(value: unknown): XyScopeInitSettings {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const count = Math.round(finiteOr(record.oscillators, 1))
  return {
    oscillators: count >= 3 ? 3 : count === 2 ? 2 : 1,
    bpmSync: typeof record.bpmSync === 'boolean' ? record.bpmSync : true,
    autoPerformance: typeof record.autoPerformance === 'boolean' ? record.autoPerformance : false,
    hold: typeof record.hold === 'boolean' ? record.hold : false,
    resetSignals: Math.max(0, Math.min(1e9, Math.round(finiteOr(record.resetSignals, 0)))),
    values: normalizeInitValues(record.values),
  }
}
