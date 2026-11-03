export const PHASE_DRAG_MODES = ['vertical', 'horizontal', 'radial', 'map'] as const
export const PHASE_DRAG_DIRECTIONS = ['forward', 'reverse', 'pingPong'] as const
export const PHASE_DRAG_CURVES = ['linear', 'ease', 'wave'] as const
export const PHASE_DRAG_QUALITIES = ['auto', 'low', 'balanced', 'high'] as const

export interface CanvasPhaseDragSettings {
  version: 1
  scanMode: typeof PHASE_DRAG_MODES[number]
  direction: typeof PHASE_DRAG_DIRECTIONS[number]
  timeCurve: typeof PHASE_DRAG_CURVES[number]
  quality: typeof PHASE_DRAG_QUALITIES[number]
  amount: number
  historyWindow: number
  historySamples: number
  slitWidth: number
  scanSpeed: number
  stillMovement: number
  sourceMix: number
  audioReactivity: number
  deterministicSeed: number
  freezeHistory: boolean
  bpmSync: boolean
  autoPerformance: boolean
}

export const DEFAULT_CANVAS_PHASE_DRAG_SETTINGS: CanvasPhaseDragSettings = {
  version: 1, scanMode: 'vertical', direction: 'forward', timeCurve: 'wave', quality: 'auto',
  amount: 0.65, historyWindow: 1, historySamples: 8, slitWidth: 0.15, scanSpeed: 1,
  stillMovement: 0.25, sourceMix: 0, audioReactivity: 0.65, deterministicSeed: 91817,
  freezeHistory: false, bpmSync: false, autoPerformance: false,
}

export function normalizeCanvasPhaseDragSettings(value: unknown): CanvasPhaseDragSettings {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const defaults = DEFAULT_CANVAS_PHASE_DRAG_SETTINGS
  const choice = <T extends string>(values: readonly T[], value: unknown, fallback: T) => values.find(option => option === value) ?? fallback
  const number = (key: keyof CanvasPhaseDragSettings, min = 0, max = 1) => {
    const v = data[key]
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : defaults[key] as number
  }
  const toggle = (key: 'freezeHistory' | 'bpmSync' | 'autoPerformance') => typeof data[key] === 'boolean' ? data[key] as boolean : defaults[key]
  return {
    version: 1, scanMode: choice(PHASE_DRAG_MODES, data.scanMode, defaults.scanMode),
    direction: choice(PHASE_DRAG_DIRECTIONS, data.direction, defaults.direction),
    timeCurve: choice(PHASE_DRAG_CURVES, data.timeCurve, defaults.timeCurve),
    quality: choice(PHASE_DRAG_QUALITIES, data.quality, defaults.quality),
    amount: number('amount'), historyWindow: number('historyWindow', 0.1, 2),
    historySamples: Math.round(number('historySamples', 4, 12)), slitWidth: number('slitWidth', 0.01),
    scanSpeed: number('scanSpeed', 0, 4), stillMovement: number('stillMovement'),
    sourceMix: number('sourceMix'), audioReactivity: number('audioReactivity'),
    deterministicSeed: Math.round(number('deterministicSeed', 0, 0x7fffffff)),
    freezeHistory: toggle('freezeHistory'), bpmSync: toggle('bpmSync'), autoPerformance: toggle('autoPerformance'),
  }
}

let clearRevision = 0
export const clearPhaseDragHistory = () => { clearRevision++ }
export const getPhaseDragClearRevision = () => clearRevision

export function isPhaseDragClean(settings: CanvasPhaseDragSettings, video: boolean) {
  return settings.amount === 0 || settings.sourceMix === 1 || (!video && settings.stillMovement === 0)
}
