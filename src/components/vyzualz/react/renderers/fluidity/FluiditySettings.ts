export const FLUIDITY_SURFACES = ['sourceContours', 'ripples', 'lenses', 'ribs'] as const
export const FLUIDITY_QUALITIES = ['auto', 'low', 'balanced', 'high'] as const

export interface CanvasFluiditySettings {
  version: 1
  surface: typeof FLUIDITY_SURFACES[number]
  amount: number
  refraction: number
  surfaceScale: number
  flowSpeed: number
  bevel: number
  frost: number
  highlight: number
  preserveColors: boolean
  dispersion: number
  lightAngle: number
  sourceMix: number
  audioReactivity: number
  bpmSync: boolean
  autoPerformance: boolean
  seed: number
  quality: typeof FLUIDITY_QUALITIES[number]
}

export const DEFAULT_CANVAS_FLUIDITY_SETTINGS: CanvasFluiditySettings = {
  version: 1, surface: 'ripples', amount: 0.65, refraction: 0.45, surfaceScale: 0.5, flowSpeed: 0.7,
  bevel: 0.4, frost: 0, highlight: 0.3, preserveColors: true, dispersion: 0.15, lightAngle: -45,
  sourceMix: 0, audioReactivity: 0.65, bpmSync: false, autoPerformance: false, seed: 91817, quality: 'auto',
}

export function normalizeCanvasFluiditySettings(value: unknown): CanvasFluiditySettings {
  const entry = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const defaults = DEFAULT_CANVAS_FLUIDITY_SETTINGS
  const number = (key: keyof CanvasFluiditySettings, low = 0, high = 1) => {
    const v = entry[key]
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(low, Math.min(high, v)) : defaults[key] as number
  }
  return {
    version: 1, surface: FLUIDITY_SURFACES.find(surface => surface === entry.surface) ?? defaults.surface,
    amount: number('amount'), refraction: number('refraction'), surfaceScale: number('surfaceScale'), flowSpeed: number('flowSpeed', 0, 4),
    bevel: number('bevel'), frost: number('frost'), highlight: number('highlight'), preserveColors: entry.preserveColors !== false,
    dispersion: number('dispersion'), lightAngle: number('lightAngle', -180, 180), sourceMix: number('sourceMix'),
    audioReactivity: number('audioReactivity'), bpmSync: entry.bpmSync === true, autoPerformance: entry.autoPerformance === true,
    seed: Math.round(number('seed', 0, 0x7fffffff)), quality: FLUIDITY_QUALITIES.find(quality => quality === entry.quality) ?? defaults.quality,
  }
}

export const isFluidityClean = (settings: CanvasFluiditySettings) => settings.amount === 0 || settings.sourceMix === 1

export function resolveFluidityQuality(quality: CanvasFluiditySettings['quality'], width: number, height: number) {
  const area = width * height
  const tier = quality === 'auto' ? area <= 960 * 540 ? 'high' : area <= 1920 * 1080 ? 'balanced' : 'low' : quality
  switch (tier) {
    case 'low': return { tier, outputEdge: 960, frostTaps: 3, detail: 0 }
    case 'balanced': return { tier, outputEdge: 1920, frostTaps: 5, detail: 1 }
    case 'high': return { tier, outputEdge: 2560, frostTaps: 9, detail: 2 }
  }
}

export function boundFluiditySize(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(1, width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
