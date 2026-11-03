export const CELLULAR_QUALITIES = ['auto', 'low', 'balanced', 'high'] as const

export interface CanvasCellularSettings {
  version: 1
  amount: number
  speed: number
  cellScale: number
  feed: number
  kill: number
  diffusion: number
  injection: number
  edge: number
  colorMode: 'source' | 'duotone'
  colorA: string
  colorB: string
  expandAlpha: boolean
  sourceMix: number
  audioReactivity: number
  bpmSync: boolean
  autoPerformance: boolean
  seed: number
  quality: typeof CELLULAR_QUALITIES[number]
}

export const DEFAULT_CANVAS_CELLULAR_SETTINGS: CanvasCellularSettings = {
  version: 1, amount: 0.65, speed: 1, cellScale: 12, feed: 0.0367, kill: 0.0649,
  diffusion: 0.5, injection: 0.5, edge: 0.55, colorMode: 'source',
  colorA: '#13202b', colorB: '#55ffcc', expandAlpha: false, sourceMix: 0,
  audioReactivity: 0.65, bpmSync: false, autoPerformance: false, seed: 91817, quality: 'auto',
}

export function normalizeCanvasCellularSettings(value: unknown): CanvasCellularSettings {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const defaults = DEFAULT_CANVAS_CELLULAR_SETTINGS
  const number = (key: keyof CanvasCellularSettings, min = 0, max = 1) => {
    const entry = record[key]
    return typeof entry === 'number' && Number.isFinite(entry) ? Math.max(min, Math.min(max, entry)) : defaults[key] as number
  }
  const color = (key: 'colorA' | 'colorB') => typeof record[key] === 'string' && /^#[0-9a-f]{6}$/i.test(record[key]) ? record[key].toLowerCase() : defaults[key]
  return {
    version: 1, amount: number('amount'), speed: number('speed', 0, 2), cellScale: Math.round(number('cellScale', 2, 64)),
    feed: number('feed', 0, 0.1), kill: number('kill', 0, 0.1), diffusion: number('diffusion'), injection: number('injection'), edge: number('edge'),
    colorMode: record.colorMode === 'duotone' ? 'duotone' : 'source', colorA: color('colorA'), colorB: color('colorB'),
    expandAlpha: record.expandAlpha === true, sourceMix: number('sourceMix'), audioReactivity: number('audioReactivity'),
    bpmSync: record.bpmSync === true, autoPerformance: record.autoPerformance === true,
    seed: Math.round(number('seed', 0, 0x7fffffff)), quality: CELLULAR_QUALITIES.find(option => option === record.quality) ?? defaults.quality,
  }
}

let reseedRevision = 0
export const reseedCellular = () => { reseedRevision++ }
export const getCellularReseedRevision = () => reseedRevision
export const isCellularClean = (settings: CanvasCellularSettings) => settings.amount === 0 || settings.sourceMix === 1

export function cellularSize(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(1, width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function resolveCellularPlan(settings: CanvasCellularSettings, width: number, height: number, dpr = 1) {
  const area = width * height
  const tier = settings.quality === 'auto' ? area <= 960 * 540 ? 'high' : area <= 1920 * 1080 ? 'balanced' : 'low' : settings.quality
  const caps = { low: [256, 960], balanced: [512, 1920], high: [768, 2560] }[tier]
  const density = Math.min(2, Math.max(1, dpr))
  return { tier, fieldEdge: caps[0], output: cellularSize(width * density, height * density, caps[1]) }
}
