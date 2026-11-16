// Sound Drawing XY › OCTA: persisted settings and the control catalogue behind its inspector. OCTA draws the Reference Video's scope
// figure: a plus-shaped cluster of five wireframe octahedra drawn by one phosphor beam, which the music's energy distorts.

export const OCTA_PRESET_ID = 'octa'

export interface OctaValues {
  intensity: number
  audioReactivity: number
  /** How strongly the music's energy distorts the figure (0 = it never does). */
  distortion: number
  size: number
  spread: number
  tilt: number
  spin: number
  axes: boolean
  width: number
  glow: number
  trail: number
  scan: number
  energyResponse: number
  tumble: number
  slew: number
  dots: number
  wiggle: number
  color: string
  glowColor: string
  backgroundColor: string
}
export type OctaNumberKey = { [K in keyof OctaValues]: OctaValues[K] extends number ? K : never }[keyof OctaValues]

export const OCTA_DEFAULTS: Readonly<OctaValues> = Object.freeze({
  intensity: 1, audioReactivity: 1, distortion: 1,
  size: 1, spread: 1, tilt: 16, spin: .5, axes: true,
  width: 2.4, glow: 1.6, trail: 110, scan: 36,
  energyResponse: .5, tumble: 1, slew: 1, dots: 1, wiggle: .6,
  color: '#7df08e', glowColor: '#1fa83c', backgroundColor: '#000000',
})

export interface OctaControlSpec {
  id: OctaNumberKey
  label: string
  description: string
  min: number
  max: number
  step: number
  format: 'percent' | 'degrees' | 'ms' | 'px' | 'Hz' | 'plain'
}
export const OCTA_RANGES: Readonly<Record<OctaNumberKey, readonly [number, number]>> = Object.freeze({
  intensity: [0, 2], audioReactivity: [0, 1], distortion: [0, 2], size: [.5, 1.3], spread: [.6, 1.6], tilt: [-30, 60], spin: [0, 2],
  width: [.6, 4], glow: [0, 3], trail: [20, 300], scan: [12, 90], energyResponse: [0, 1], tumble: [0, 1.5], slew: [0, 1.5], dots: [0, 1.5], wiggle: [0, 2],
})

export const OCTA_MASTER_CONTROLS: readonly OctaControlSpec[] = Object.freeze([
  { id: 'intensity', label: 'Master Intensity', description: 'Overall beam brightness. Zero blanks the beam.', min: 0, max: 2, step: .01, format: 'percent' },
  { id: 'audioReactivity', label: 'Audio Reactivity', description: 'Scales how much the music distorts the figure. Zero keeps the clean cluster.', min: 0, max: 1, step: .01, format: 'percent' },
  { id: 'distortion', label: 'Distortion Amount', description: 'How far the music\'s energy pushes the figure through tumble, loops and dots. Zero never distorts it.', min: 0, max: 2, step: .01, format: 'percent' },
])
export const OCTA_SHAPE_CONTROLS: readonly OctaControlSpec[] = Object.freeze([
  { id: 'size', label: 'Cluster Size', description: 'Overall size of the five octahedra.', min: .5, max: 1.3, step: .01, format: 'percent' },
  { id: 'spread', label: 'Cluster Spread', description: 'How far the four outer octahedra sit from the centre one.', min: .6, max: 1.6, step: .01, format: 'percent' },
  { id: 'tilt', label: 'View Tilt', description: 'Looks down on the cluster (positive) or up at it (negative).', min: -30, max: 60, step: 1, format: 'degrees' },
  { id: 'spin', label: 'Spin Speed', description: 'How quickly the clean cluster turns about its vertical axis.', min: 0, max: 2, step: .01, format: 'percent' },
])
export const OCTA_BEAM_CONTROLS: readonly OctaControlSpec[] = Object.freeze([
  { id: 'width', label: 'Beam Width', description: 'Width of the beam spot.', min: .6, max: 4, step: .05, format: 'px' },
  { id: 'glow', label: 'Glow', description: 'Size of the halo around the bright lines. Zero draws a crisp trace.', min: 0, max: 3, step: .05, format: 'plain' },
  { id: 'trail', label: 'Phosphor Decay', description: 'How long the glow lingers after the beam moves on.', min: 20, max: 300, step: 5, format: 'ms' },
  { id: 'scan', label: 'Scan Frequency', description: 'How many times per second the beam redraws the whole cluster.', min: 12, max: 90, step: 1, format: 'Hz' },
])
export const OCTA_REACT_CONTROLS: readonly OctaControlSpec[] = Object.freeze([
  { id: 'energyResponse', label: 'Energy Response', description: 'How quickly the distortion follows the music\'s energy. Low is smooth; high snaps to every hit.', min: 0, max: 1, step: .01, format: 'percent' },
  { id: 'tumble', label: 'Tumble', description: 'How wildly the octahedra spin apart and tangle as the energy rises.', min: 0, max: 1.5, step: .01, format: 'percent' },
  { id: 'slew', label: 'Beam Inertia', description: 'How much the beam overshoots its corners at high energy, rounding the cluster into loops.', min: 0, max: 1.5, step: .01, format: 'percent' },
  { id: 'dots', label: 'Dot Scan', description: 'How readily the lines break into bright dots at the highest energy.', min: 0, max: 1.5, step: .01, format: 'percent' },
  { id: 'wiggle', label: 'Signal Wiggle', description: 'How much the live waveform ripples along the cluster\'s axis lines.', min: 0, max: 2, step: .01, format: 'percent' },
])

export interface XyScopeOctaSettings {
  autoPerformance: boolean
  /** On: the figure's turn and tumble run in the track's beats. Off: at a steady tempo. */
  bpmSync: boolean
  hold: boolean
  resetSignals: number
  values: OctaValues
}

export const DEFAULT_OCTA_SETTINGS: Readonly<XyScopeOctaSettings> = Object.freeze({
  autoPerformance: false, bpmSync: true, hold: false, resetSignals: 0, values: Object.freeze({ ...OCTA_DEFAULTS }) as OctaValues,
})

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const finiteOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const color = (value: unknown, fallback: string) => typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback

export function normalizeOctaValues(value: unknown): OctaValues {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const out = { ...OCTA_DEFAULTS } as OctaValues & Record<OctaNumberKey, number>
  for (const key of Object.keys(OCTA_RANGES) as OctaNumberKey[]) {
    const [lo, hi] = OCTA_RANGES[key]
    out[key] = Math.min(hi, Math.max(lo, finiteOr(record[key], OCTA_DEFAULTS[key])))
  }
  out.axes = typeof record.axes === 'boolean' ? record.axes : OCTA_DEFAULTS.axes
  out.color = color(record.color, OCTA_DEFAULTS.color)
  out.glowColor = color(record.glowColor, OCTA_DEFAULTS.glowColor)
  out.backgroundColor = color(record.backgroundColor, OCTA_DEFAULTS.backgroundColor)
  return out
}

export function normalizeOctaSettings(value: unknown): XyScopeOctaSettings {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    autoPerformance: typeof record.autoPerformance === 'boolean' ? record.autoPerformance : false,
    bpmSync: typeof record.bpmSync === 'boolean' ? record.bpmSync : true,
    hold: typeof record.hold === 'boolean' ? record.hold : false,
    resetSignals: Math.max(0, Math.min(1e9, Math.round(finiteOr(record.resetSignals, 0)))),
    values: normalizeOctaValues(record.values),
  }
}
