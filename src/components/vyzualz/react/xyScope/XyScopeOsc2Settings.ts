// Sound Drawing XY › OSC 2: persisted settings and the control catalogue behind its inspector.

import { OSC2_DEFAULTS, OSC2_RANGES, type Osc2ControlKey, type Osc2Settings } from './XyScopeOsc2Engine'

export const OSC2_PRESET_ID = 'osc2'
export const PHASE_PORTAL_PRESET_ID = 'phase-portal'
export type PhasePortalTraceMode = 'waveform' | 'xy'

export interface Osc2ControlSpec {
  id: Osc2ControlKey
  label: string
  description: string
  min: number
  max: number
  step: number
  /** `percent` shows value × 100; the others show the stored value. */
  format: 'percent' | 'degrees' | 'ms' | 'px' | 'Hz' | 'plain' | 'count'
}

export const OSC2_SCENE_CONTROLS: readonly Osc2ControlSpec[] = Object.freeze([
  { id: 'depth', label: 'Solid Depth', description: 'How far the letter’s contour slices spread from front to back.', min: .05, max: 1.2, step: .01, format: 'plain' },
  { id: 'layers', label: 'Contour Slices', description: 'How many contour slices build each letter. Each answers one frequency region.', min: 2, max: 8, step: 1, format: 'count' },
  { id: 'terrain', label: 'Waveform Terrain', description: 'Height of the live waveform rows that scroll away behind the word. Zero hides them.', min: 0, max: 1, step: .01, format: 'percent' },
])
export const OSC2_CAMERA_CONTROLS: readonly Osc2ControlSpec[] = Object.freeze([
  { id: 'distance', label: 'Camera Distance', description: 'Closer exaggerates the perspective; farther flattens it.', min: 2.6, max: 9, step: .1, format: 'plain' },
  { id: 'elevation', label: 'Camera Elevation', description: 'Looks down on the word and the floor (positive) or up at it (negative).', min: -30, max: 60, step: 1, format: 'degrees' },
  { id: 'orbitRange', label: 'Orbit Range', description: 'How far the camera swings around the word. Zero keeps it straight-on.', min: 0, max: 85, step: 1, format: 'degrees' },
  { id: 'orbitSpeed', label: 'Orbit Speed', description: 'How quickly the swing advances with the music. It rests when the music is quiet or paused.', min: 0, max: 1, step: .01, format: 'percent' },
])
export const OSC2_REACT_CONTROLS: readonly Osc2ControlSpec[] = Object.freeze([
  { id: 'audioDepth', label: 'Band Depth', description: 'How strongly each frequency region pushes its slice forward and swells it.', min: 0, max: 2, step: .01, format: 'percent' },
  { id: 'kickDolly', label: 'Kick Dolly', description: 'How far the camera pushes in on each kick.', min: 0, max: 1, step: .01, format: 'percent' },
])
export const OSC2_BEAM_CONTROLS: readonly Osc2ControlSpec[] = Object.freeze([
  { id: 'intensity', label: 'Beam Intensity', description: 'Brightness of the phosphor beam.', min: 10, max: 100, step: 1, format: 'percent' },
  { id: 'persistence', label: 'Phosphor Decay', description: 'How long the glow lingers after the beam moves on.', min: 20, max: 250, step: 5, format: 'ms' },
  { id: 'width', label: 'Beam Width', description: 'Width of the beam spot.', min: .6, max: 3, step: .05, format: 'px' },
  { id: 'scan', label: 'Scan Frequency', description: 'How many times per second the beam retraces the scene.', min: 8, max: 180, step: 1, format: 'Hz' },
])

export interface XyScopeOsc2Settings {
  autoPerformance: boolean
  /** On: the camera sweep and the terrain scroll run in the track's beats. Off: at a steady tempo. */
  bpmSync: boolean
  /** Draws the perspective floor grid. */
  floor: boolean
  hold: boolean
  resetSignals: number
  values: Osc2Settings
}

export const DEFAULT_OSC2_SETTINGS: Readonly<XyScopeOsc2Settings> = Object.freeze({
  autoPerformance: false, bpmSync: true, floor: true, hold: false, resetSignals: 0, values: Object.freeze({ ...OSC2_DEFAULTS }),
})

export interface XyScopePhasePortalSettings extends XyScopeOsc2Settings {
  traceMode: PhasePortalTraceMode
}

export const DEFAULT_PHASE_PORTAL_SETTINGS: Readonly<XyScopePhasePortalSettings> = Object.freeze({
  ...DEFAULT_OSC2_SETTINGS,
  autoPerformance: true,
  floor: false,
  traceMode: 'waveform',
  values: Object.freeze({
    ...OSC2_DEFAULTS, depth: .74, layers: 4, orbitRange: 14, elevation: 9,
    kickDolly: .28, terrain: .38, persistence: 70, scan: 36,
  }),
})

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const finiteOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function normalizeOsc2Values(value: unknown, defaults = OSC2_DEFAULTS): Osc2Settings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const out = { ...defaults } as Osc2Settings & Record<Osc2ControlKey, number>
  for (const key of Object.keys(OSC2_RANGES) as Osc2ControlKey[]) {
    const [lo, hi] = OSC2_RANGES[key]
    out[key] = Math.min(hi, Math.max(lo, finiteOr(record[key], defaults[key])))
  }
  out.layers = Math.round(out.layers)
  out.color = typeof record.color === 'string' && HEX_COLOR.test(record.color) ? record.color.toLowerCase() : defaults.color
  return out
}

export function normalizeOsc2Settings(value: unknown, defaults = DEFAULT_OSC2_SETTINGS): XyScopeOsc2Settings {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    autoPerformance: typeof record.autoPerformance === 'boolean' ? record.autoPerformance : defaults.autoPerformance,
    bpmSync: typeof record.bpmSync === 'boolean' ? record.bpmSync : defaults.bpmSync,
    floor: typeof record.floor === 'boolean' ? record.floor : defaults.floor,
    hold: typeof record.hold === 'boolean' ? record.hold : defaults.hold,
    resetSignals: Math.max(0, Math.min(1e9, Math.round(finiteOr(record.resetSignals, 0)))),
    values: normalizeOsc2Values(record.values, defaults.values),
  }
}

export function normalizePhasePortalSettings(value: unknown): XyScopePhasePortalSettings {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return { ...normalizeOsc2Settings(record, DEFAULT_PHASE_PORTAL_SETTINGS), traceMode: record.traceMode === 'xy' ? 'xy' : 'waveform' }
}
