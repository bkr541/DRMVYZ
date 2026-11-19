export const PHASE_PORTAL_PRESET_ID = 'phase-portal'
export const PHASE_PORTAL_WINDOW_SECONDS = .02

export const PHASE_PORTAL_RANGES = {
  gain: [.5, 4],
  textSize: [.4, .9],
  intensity: [10, 100],
  traceCoupling: [0, 1],
  sweepSpeed: [.5, 2],
} as const

export interface XyScopePhasePortalSettings {
  autoPerformance: boolean
  bpmSync: boolean
  hold: boolean
  grid: boolean
  resetSignals: number
  values: { gain: number; textSize: number; intensity: number; color: string; traceCoupling: number; sweepSpeed: number }
}

export const DEFAULT_PHASE_PORTAL_SETTINGS: Readonly<XyScopePhasePortalSettings> = Object.freeze({
  autoPerformance: false,
  bpmSync: true,
  hold: false,
  grid: true,
  resetSignals: 0,
  values: Object.freeze({ gain: 1.5, textSize: .78, intensity: 80, color: '#7fd0ff', traceCoupling: .8, sweepSpeed: 1 }),
})

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

/** Keep the shared controls and phosphor color when opening a project saved with the original preset. */
export function normalizePhasePortalSettings(value: unknown): XyScopePhasePortalSettings {
  const saved = record(value)
  const values = record(saved.values)
  const defaults = DEFAULT_PHASE_PORTAL_SETTINGS.values
  return {
    autoPerformance: saved.autoPerformance === true,
    bpmSync: saved.bpmSync !== false,
    hold: saved.hold === true,
    grid: saved.grid !== false,
    resetSignals: Math.round(bounded(saved.resetSignals, 0, 0, 1e9)),
    values: {
      gain: bounded(values.gain, defaults.gain, ...PHASE_PORTAL_RANGES.gain),
      textSize: bounded(values.textSize, defaults.textSize, ...PHASE_PORTAL_RANGES.textSize),
      intensity: bounded(values.intensity, defaults.intensity, ...PHASE_PORTAL_RANGES.intensity),
      traceCoupling: bounded(values.traceCoupling, defaults.traceCoupling, ...PHASE_PORTAL_RANGES.traceCoupling),
      sweepSpeed: bounded(values.sweepSpeed, defaults.sweepSpeed, ...PHASE_PORTAL_RANGES.sweepSpeed),
      color: typeof values.color === 'string' && /^#[0-9a-f]{6}$/i.test(values.color) ? values.color.toLowerCase() : defaults.color,
    },
  }
}
