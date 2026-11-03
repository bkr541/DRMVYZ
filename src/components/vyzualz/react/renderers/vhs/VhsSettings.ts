export const VHS_TREATMENTS = ['tape', 'crt', 'hybrid'] as const
export const VHS_QUALITIES = ['auto', 'low', 'balanced', 'high'] as const
export const VHS_HISTORY_WARMUP_FRAMES = 6

export interface CanvasVhsSettings {
  version: 1
  treatment: typeof VHS_TREATMENTS[number]
  amount: number
  damage: number
  tracking: number
  dropout: number
  bleed: number
  roll: number
  grain: number
  scanlines: number
  curvature: number
  phosphor: number
  persistence: number
  misalignment: number
  speed: number
  sourceMix: number
  audioReactivity: number
  bpmSync: boolean
  autoPerformance: boolean
  seed: number
  quality: typeof VHS_QUALITIES[number]
}

export const DEFAULT_CANVAS_VHS_SETTINGS: CanvasVhsSettings = {
  version: 1, treatment: 'hybrid', amount: 0.65, damage: 0.25, tracking: 0.15, dropout: 0.1,
  bleed: 0.25, roll: 0.15, grain: 0.15, scanlines: 0.3, curvature: 0.08, phosphor: 0.2,
  persistence: 0.15, misalignment: 0.08, speed: 1, sourceMix: 0, audioReactivity: 0.65,
  bpmSync: false, autoPerformance: false, seed: 91817, quality: 'auto',
}

export function normalizeCanvasVhsSettings(value: unknown): CanvasVhsSettings {
  const entry = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const defaults = DEFAULT_CANVAS_VHS_SETTINGS
  const number = (key: keyof CanvasVhsSettings, max = 1) => {
    const n = entry[key]
    return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : defaults[key] as number
  }
  return {
    version: 1, treatment: VHS_TREATMENTS.find(treatment => treatment === entry.treatment) ?? defaults.treatment,
    amount: number('amount'), damage: number('damage'), tracking: number('tracking'), dropout: number('dropout'),
    bleed: number('bleed'), roll: number('roll'), grain: number('grain'), scanlines: number('scanlines'),
    curvature: number('curvature'), phosphor: number('phosphor'), persistence: number('persistence', 0.85),
    misalignment: number('misalignment'), speed: number('speed', 4), sourceMix: number('sourceMix'),
    audioReactivity: number('audioReactivity'), bpmSync: entry.bpmSync === true, autoPerformance: entry.autoPerformance === true,
    seed: Math.round(number('seed', 0x7fffffff)), quality: VHS_QUALITIES.find(quality => quality === entry.quality) ?? defaults.quality,
  }
}

export const isVhsClean = (settings: CanvasVhsSettings) => settings.amount === 0 || settings.sourceMix === 1

export function resolveVhsQuality(quality: CanvasVhsSettings['quality'], width: number, height: number) {
  const area = width * height
  const tier = quality === 'auto' ? area <= 960 * 540 ? 'high' : area <= 1920 * 1080 ? 'balanced' : 'low' : quality
  switch (tier) {
    case 'low': return { tier, outputEdge: 960, chromaTaps: 3, crtLines: 144 }
    case 'balanced': return { tier, outputEdge: 1440, chromaTaps: 5, crtLines: 216 }
    case 'high': return { tier, outputEdge: 2560, chromaTaps: 7, crtLines: 270 }
  }
}

export function boundVhsSize(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height, 1))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
