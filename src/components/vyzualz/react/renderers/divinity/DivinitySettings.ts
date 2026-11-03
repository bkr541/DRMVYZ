export const DIVINITY_QUALITIES = ['auto', 'low', 'balanced', 'high'] as const

export interface CanvasDivinitySettings {
  version: 1
  amount: number
  mask: 'luminance' | 'alpha'
  originX: number
  originY: number
  length: number
  spread: number
  density: number
  decay: number
  threshold: number
  motionSpeed: number
  colorMode: 'source' | 'manual'
  color: string
  clipToAlpha: boolean
  sourceMix: number
  audioReactivity: number
  bpmSync: boolean
  autoPerformance: boolean
  seed: number
  quality: typeof DIVINITY_QUALITIES[number]
}

export const DEFAULT_CANVAS_DIVINITY_SETTINGS: CanvasDivinitySettings = {
  version: 1, amount: 0.6, mask: 'luminance', originX: 0.5, originY: 0.5, length: 0.65,
  spread: 0.5, density: 0.45, decay: 0.92, threshold: 0.65, motionSpeed: 0.2, colorMode: 'source',
  color: '#ffffff', clipToAlpha: false, sourceMix: 0, audioReactivity: 0.65, bpmSync: false,
  autoPerformance: false, seed: 91817, quality: 'auto',
}

export function normalizeCanvasDivinitySettings(value: unknown): CanvasDivinitySettings {
  const entry = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const defaults = DEFAULT_CANVAS_DIVINITY_SETTINGS
  const number = (key: keyof CanvasDivinitySettings, max = 1) => {
    const n = entry[key]
    return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : defaults[key] as number
  }
  return {
    version: 1, amount: number('amount'), mask: entry.mask === 'alpha' ? 'alpha' : 'luminance',
    originX: number('originX'), originY: number('originY'), length: number('length'), spread: number('spread'),
    density: number('density'), decay: number('decay'), threshold: number('threshold'), motionSpeed: number('motionSpeed', 4),
    colorMode: entry.colorMode === 'manual' ? 'manual' : 'source',
    color: typeof entry.color === 'string' && /^#[a-f0-9]{6}$/i.test(entry.color) ? entry.color.toLowerCase() : defaults.color,
    clipToAlpha: entry.clipToAlpha === true, sourceMix: number('sourceMix'), audioReactivity: number('audioReactivity'),
    bpmSync: entry.bpmSync === true, autoPerformance: entry.autoPerformance === true, seed: Math.round(number('seed', 0x7fffffff)),
    quality: DIVINITY_QUALITIES.find(quality => quality === entry.quality) ?? defaults.quality,
  }
}

export function isDivinityClean(settings: CanvasDivinitySettings) {
  return settings.amount === 0 || settings.sourceMix === 1 || settings.length === 0 || settings.density === 0
}

export function resolveDivinityQuality(quality: CanvasDivinitySettings['quality'], width: number, height: number) {
  const area = width * height
  const tier = quality === 'auto' ? area <= 960 * 540 ? 'high' : area <= 1920 * 1080 ? 'balanced' : 'low' : quality
  switch (tier) {
    case 'low': return { tier, outputEdge: 960, maskEdge: 384, taps: 12 }
    case 'balanced': return { tier, outputEdge: 1440, maskEdge: 640, taps: 24 }
    case 'high': return { tier, outputEdge: 2560, maskEdge: 1024, taps: 40 }
  }
}

export function boundDivinitySize(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height, 1))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
