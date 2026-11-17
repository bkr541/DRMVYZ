import type { CanvasPresetSettings } from '../components/vyzualz/react/ReactTypes'

/**
 * Applies the user's Auto Performance default (System Settings) to every Auto Performance toggle the React view owns outside Cinema 2.0:
 * the ten CANVAS renderers, the six XY Scope instruments and the XY Scope parameter, and Sound Drawing's show toggle.
 * Pure: returns a patch with only what changes, or null when every toggle already has the value.
 */
export const CANVAS_AUTO_PERFORMANCE_ENGINES = ['cutbank', 'mutagen', 'dataBleed', 'phaseDrag', 'cellular', 'terminal', 'fluidity', 'divinity', 'vhs', 'shiftgrid'] as const
export const XY_SCOPE_AUTO_PERFORMANCE_INSTRUMENTS = ['textV2', 'osc1', 'osc2', 'octa', 'wire', 'init'] as const

type Settings = Record<string, unknown>
interface Source {
  canvasPresetSettings: unknown
  xyScopeSettings: unknown
  soundDrawingPerformanceSettings: unknown
}
export interface AutoPerformanceDefaultPatch {
  canvasPresetSettings?: CanvasPresetSettings
  xyScopeSettings?: unknown
  soundDrawingPerformanceSettings?: unknown
}

const isRecord = (value: unknown): value is Settings => value != null && typeof value === 'object' && !Array.isArray(value)

/** Copies `record` with `autoPerformance` set when it is a record that has the toggle at a different value; otherwise returns the same object. */
function withToggle<T>(record: T, value: boolean): T {
  return isRecord(record) && typeof record.autoPerformance === 'boolean' && record.autoPerformance !== value
    ? { ...record, autoPerformance: value } as T
    : record
}

/** The CANVAS preset settings with every renderer's toggle at `value`; the same object when nothing changes. */
export function applyAutoPerformanceDefaultToCanvasSettings(settings: CanvasPresetSettings, value: boolean): CanvasPresetSettings {
  if (!isRecord(settings)) return settings
  let changed = false
  const next: Settings = { ...settings }
  for (const engine of CANVAS_AUTO_PERFORMANCE_ENGINES) {
    const updated = withToggle(next[engine], value)
    if (updated !== next[engine]) { next[engine] = updated; changed = true }
  }
  return changed ? next as unknown as CanvasPresetSettings : settings
}

/** The XY Scope settings with every instrument's toggle, and the shared parameter, at `value`; the same object when nothing changes. */
export function applyAutoPerformanceDefaultToXyScopeSettings<T>(settings: T, value: boolean): T {
  if (!isRecord(settings)) return settings
  let changed = false
  const next: Settings = { ...settings }
  for (const instrument of XY_SCOPE_AUTO_PERFORMANCE_INSTRUMENTS) {
    const updated = withToggle(next[instrument], value)
    if (updated !== next[instrument]) { next[instrument] = updated; changed = true }
  }
  const parameters = next.parameters
  if (isRecord(parameters) && typeof parameters.autoPerformance === 'boolean' && parameters.autoPerformance !== value) {
    next.parameters = { ...parameters, autoPerformance: value }
    changed = true
  }
  return changed ? next as T : settings
}

export function applyAutoPerformanceDefaultToReactState(state: Source, value: boolean): AutoPerformanceDefaultPatch | null {
  const patch: AutoPerformanceDefaultPatch = {}
  const canvas = applyAutoPerformanceDefaultToCanvasSettings(state.canvasPresetSettings as CanvasPresetSettings, value)
  if (canvas !== state.canvasPresetSettings) patch.canvasPresetSettings = canvas
  const xy = applyAutoPerformanceDefaultToXyScopeSettings(state.xyScopeSettings, value)
  if (xy !== state.xyScopeSettings) patch.xyScopeSettings = xy
  return Object.keys(patch).length > 0 ? patch : null
}

/**
 * Sound Drawing's toggle only works while a Sound Drawing show is selected (it is cleared whenever the app restarts), so the default is applied
 * at the moment a show becomes selected and whenever the setting changes while one is.
 */
export function applyAutoPerformanceDefaultToSoundDrawing(settings: unknown, value: boolean): unknown | null {
  if (!isRecord(settings) || settings.selectedShowId == null) return null
  const next = withToggle(settings, value)
  return next === settings ? null : next
}
