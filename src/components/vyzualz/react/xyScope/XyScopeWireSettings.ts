// Sound Drawing XY › WIREFRAME: persisted settings and the control catalogue behind its inspector. WIREFRAME draws 3D wireframe cubes as one
// phosphor beam. The cubes are an immutable shape; the music moves them through bounded, per-feature mappings, and an optional director
// (Auto Performance) changes how the cluster moves on musical boundaries. See docs/sound-drawing-xy.md.

import type { WireSceneCadence } from './XyScopeWireDirector'

export const WIRE_SOURCE_MODE = 'wire' as const
export const CUBES_PRESET_ID = 'cubes'

export type WireHiddenEdges = 'show' | 'dim'
export type WireTravel = 'blank' | 'dim' | 'visible'

export interface WireValues {
  intensity: number
  audioReactivity: number
  bpmSync: boolean
  /** Dims and spaces out brightness accents (no more than about four a second) and limits how bright they get. On by default. */
  flashLimit: boolean
  // Design › Wireframe
  satellites: number
  size: number
  spread: number
  perspective: number
  tilt: number
  spin: number
  hiddenEdges: WireHiddenEdges
  depthCue: number
  duplicates: number
  outline: boolean
  // Design › Beam & Phosphor
  width: number
  glow: number
  trail: number
  scan: number
  travel: WireTravel
  // React
  waveAmount: number
  waveDepth: number
  waveDetail: number
  readableFloor: number
  maxDisplacement: number
  minReadable: number
  attack: number
  release: number
  bassResponse: number
  midResponse: number
  lowMidResponse: number
  airResponse: number
  kickResponse: number
  snareResponse: number
  sceneEvery: WireSceneCadence
  seed: number
  // Palette
  color: string
  glowColor: string
  backgroundColor: string
}
export type WireNumberKey = { [K in keyof WireValues]: WireValues[K] extends number ? K : never }[keyof WireValues]
export type WireBooleanKey = { [K in keyof WireValues]: WireValues[K] extends boolean ? K : never }[keyof WireValues]

export const WIRE_DEFAULTS: Readonly<WireValues> = Object.freeze({
  intensity: 1, audioReactivity: 1, bpmSync: true, flashLimit: true,
  satellites: 2, size: 1, spread: 1, perspective: .45, tilt: 22, spin: .6, hiddenEdges: 'dim', depthCue: .5, duplicates: 1, outline: true,
  width: 2.2, glow: 1.5, trail: 110, scan: 40, travel: 'blank',
  waveAmount: 1, waveDepth: .22, waveDetail: 7, readableFloor: .72, maxDisplacement: .12, minReadable: .65, attack: 45, release: 240,
  bassResponse: 1, midResponse: 1, lowMidResponse: 1, airResponse: 1, kickResponse: 1, snareResponse: 1, sceneEvery: 'phrase', seed: 7,
  color: '#7df08e', glowColor: '#1fa83c', backgroundColor: '#000000',
})

export const WIRE_RANGES: Readonly<Record<WireNumberKey, readonly [number, number]>> = Object.freeze({
  intensity: [0, 2], audioReactivity: [0, 1],
  satellites: [0, 4], size: [.5, 1.4], spread: [.6, 1.5], perspective: [0, 1], tilt: [-30, 60], spin: [0, 2], depthCue: [0, 1], duplicates: [1, 4],
  width: [.6, 4], glow: [0, 3], trail: [20, 300], scan: [12, 90],
  waveAmount: [0, 1.5], waveDepth: [0, .4], waveDetail: [1, 16], readableFloor: [.4, .95], maxDisplacement: [0, .3], minReadable: [.3, .95], attack: [5, 500], release: [40, 1500],
  bassResponse: [0, 2], midResponse: [0, 2], lowMidResponse: [0, 2], airResponse: [0, 2], kickResponse: [0, 2], snareResponse: [0, 2], seed: [0, 999],
})
const INTEGER_KEYS: ReadonlySet<WireNumberKey> = new Set<WireNumberKey>(['satellites', 'duplicates', 'seed', 'waveDetail'])

export const WIRE_HIDDEN_OPTIONS: readonly { value: WireHiddenEdges; label: string }[] = Object.freeze([{ value: 'show', label: 'Show all edges' }, { value: 'dim', label: 'Dim hidden edges' }])
export const WIRE_TRAVEL_OPTIONS: readonly { value: WireTravel; label: string }[] = Object.freeze([{ value: 'blank', label: 'Blank' }, { value: 'dim', label: 'Dim' }, { value: 'visible', label: 'Visible' }])
export const WIRE_CADENCE_OPTIONS: readonly { value: WireSceneCadence; label: string }[] = Object.freeze([
  { value: 'section', label: 'Every section' }, { value: 'phrase', label: 'Every phrase' }, { value: 'bar8', label: 'Every 8 bars' }, { value: 'bar4', label: 'Every 4 bars' },
])

export interface WireControlSpec {
  id: WireNumberKey
  label: string
  description: string
  step: number
  format: 'percent' | 'degrees' | 'ms' | 'px' | 'Hz' | 'plain' | 'count'
}
const spec = (id: WireNumberKey, label: string, description: string, step: number, format: WireControlSpec['format']): WireControlSpec => ({ id, label, description, step, format })

export const WIRE_MASTER_CONTROLS: readonly WireControlSpec[] = Object.freeze([
  spec('intensity', 'Master Intensity', 'Overall beam brightness. Zero blanks the beam.', .01, 'percent'),
  spec('audioReactivity', 'Audio Reactivity', 'Scales how much the music moves the cubes. Zero keeps the clean figure.', .01, 'percent'),
])
export const WIRE_FIGURE_CONTROLS: readonly WireControlSpec[] = Object.freeze([
  spec('satellites', 'Satellite Cubes', 'How many smaller cubes orbit the core cube.', 1, 'count'),
  spec('size', 'Figure Size', 'Overall size of the figure on the screen.', .01, 'percent'),
  spec('spread', 'Orbit Spread', 'How far the satellite cubes sit from the core.', .01, 'percent'),
  spec('perspective', 'Perspective', 'Zero draws every cube with no foreshortening (orthographic); one draws a full pinhole camera.', .01, 'percent'),
  spec('tilt', 'View Tilt', 'Looks down on the figure (positive) or up at it (negative).', 1, 'degrees'),
  spec('spin', 'Spin Speed', 'How quickly the figure turns. With BPM Sync on it follows the track\'s tempo.', .01, 'percent'),
  spec('depthCue', 'Depth Cue', 'Fades the edges that are farther from you, so the cubes read as solid.', .01, 'percent'),
  spec('duplicates', 'Duplicates', 'Draws this many copies of the figure. The first is the figure itself; the others are fainter echoes turned slightly apart.', 1, 'count'),
])
export const WIRE_BEAM_CONTROLS: readonly WireControlSpec[] = Object.freeze([
  spec('width', 'Beam Width', 'Width of the beam spot.', .05, 'px'),
  spec('glow', 'Glow', 'Size of the halo around the bright lines. Zero draws a crisp trace.', .05, 'plain'),
  spec('trail', 'Phosphor Decay', 'How long the glow lingers after the beam moves on.', 5, 'ms'),
  spec('scan', 'Scan Frequency', 'How many times per second the beam redraws the whole figure.', 1, 'Hz'),
])
export const WIRE_REACT_CONTROLS: readonly WireControlSpec[] = Object.freeze([
  spec('waveAmount', 'Wave Amount', 'How strongly the live audio waveform ripples along every edge of the cubes. Zero draws straight lines.', .01, 'percent'),
  spec('waveDepth', 'Wave Depth', 'The farthest the waveform may push a line sideways, as a share of that edge\'s length. The corners never move, so the cubes stay readable.', .005, 'percent'),
  spec('waveDetail', 'Wave Detail', 'How many times the live waveform repeats along each edge. Higher draws a denser, more jagged trace; one draws a single sweep.', 1, 'count'),
  spec('readableFloor', 'Readability Floor', 'The least a cube may look like itself. When the music would push it past this, the movement is eased back until it holds.', .01, 'percent'),
  spec('maxDisplacement', 'Max Displacement', 'The farthest any corner may move from its place, as a share of a cube\'s edge.', .005, 'percent'),
  spec('minReadable', 'Minimum Readable Time', 'The share of the recent bars the figure must have been undisturbed before the director may break the cluster apart.', .01, 'percent'),
  spec('attack', 'Attack', 'How quickly the cubes follow a rise in the music.', 1, 'ms'),
  spec('release', 'Release', 'How slowly they settle back.', 5, 'ms'),
  spec('bassResponse', 'Bass Response', 'How much bass swells the cubes (up to 8% at full).', .01, 'percent'),
  spec('midResponse', 'Mid Response', 'How much the mids turn the cubes against each other (up to 10°).', .01, 'percent'),
  spec('lowMidResponse', 'Low-Mid Response', 'How much the low mids lean each cube sideways.', .01, 'percent'),
  spec('airResponse', 'Air Response', 'How much the highs make the edges shimmer.', .01, 'percent'),
  spec('kickResponse', 'Kick Response', 'How much each kick expands the cubes and widens the beam.', .01, 'percent'),
  spec('snareResponse', 'Snare Response', 'How much each snare brightens the lines.', .01, 'percent'),
  spec('seed', 'Variation Seed', 'The number that decides which scene the director picks. The same track and seed always give the same show.', 1, 'count'),
])

export interface XyScopeWireSettings {
  autoPerformance: boolean
  hold: boolean
  resetSignals: number
  values: WireValues
}

export const DEFAULT_WIRE_SETTINGS: Readonly<XyScopeWireSettings> = Object.freeze({
  autoPerformance: false, hold: false, resetSignals: 0, values: Object.freeze({ ...WIRE_DEFAULTS }) as WireValues,
})

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const finiteOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const color = (value: unknown, fallback: string) => typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback
const pick = <T extends string>(value: unknown, options: readonly { value: T }[], fallback: T): T => options.find(option => option.value === value)?.value ?? fallback

export function normalizeWireValues(value: unknown): WireValues {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const out = { ...WIRE_DEFAULTS } as WireValues & Record<WireNumberKey, number>
  for (const key of Object.keys(WIRE_RANGES) as WireNumberKey[]) {
    const [lo, hi] = WIRE_RANGES[key]
    const number = Math.min(hi, Math.max(lo, finiteOr(record[key], WIRE_DEFAULTS[key])))
    out[key] = INTEGER_KEYS.has(key) ? Math.round(number) : number
  }
  out.bpmSync = typeof record.bpmSync === 'boolean' ? record.bpmSync : WIRE_DEFAULTS.bpmSync
  out.flashLimit = typeof record.flashLimit === 'boolean' ? record.flashLimit : WIRE_DEFAULTS.flashLimit
  out.outline = typeof record.outline === 'boolean' ? record.outline : WIRE_DEFAULTS.outline
  out.hiddenEdges = pick(record.hiddenEdges, WIRE_HIDDEN_OPTIONS, WIRE_DEFAULTS.hiddenEdges)
  out.travel = pick(record.travel, WIRE_TRAVEL_OPTIONS, WIRE_DEFAULTS.travel)
  out.sceneEvery = pick(record.sceneEvery, WIRE_CADENCE_OPTIONS, WIRE_DEFAULTS.sceneEvery)
  out.color = color(record.color, WIRE_DEFAULTS.color)
  out.glowColor = color(record.glowColor, WIRE_DEFAULTS.glowColor)
  out.backgroundColor = color(record.backgroundColor, WIRE_DEFAULTS.backgroundColor)
  return out
}

export function normalizeWireSettings(value: unknown): XyScopeWireSettings {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    autoPerformance: typeof record.autoPerformance === 'boolean' ? record.autoPerformance : false,
    hold: typeof record.hold === 'boolean' ? record.hold : false,
    resetSignals: Math.max(0, Math.min(1e9, Math.round(finiteOr(record.resetSignals, 0)))),
    values: normalizeWireValues(record.values),
  }
}
