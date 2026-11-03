export const TERMINAL_FAMILIES = ['ascii', 'numbers', 'symbols'] as const
export const TERMINAL_QUALITIES = ['auto', 'low', 'balanced', 'high'] as const

export interface CanvasTerminalSettings {
  version: 1
  amount: number
  family: typeof TERMINAL_FAMILIES[number]
  cellSize: number
  contrast: number
  brightness: number
  edge: number
  changeRate: number
  colorMode: 'source' | 'monochrome'
  color: string
  background: number
  glow: number
  sourceMix: number
  audioReactivity: number
  bpmSync: boolean
  autoPerformance: boolean
  seed: number
  quality: typeof TERMINAL_QUALITIES[number]
}

export const DEFAULT_CANVAS_TERMINAL_SETTINGS: CanvasTerminalSettings = {
  version: 1, amount: 1, family: 'ascii', cellSize: 10, contrast: 1, brightness: 0, edge: 0.4,
  changeRate: 0.5, colorMode: 'source', color: '#55ff99', background: 0, glow: 0,
  sourceMix: 0, audioReactivity: 0.65, bpmSync: false, autoPerformance: false, seed: 91817, quality: 'auto',
}

export function normalizeCanvasTerminalSettings(value: unknown): CanvasTerminalSettings {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const number = (key: keyof CanvasTerminalSettings, min = 0, max = 1) => {
    const entry = input[key]
    return typeof entry === 'number' && Number.isFinite(entry)
      ? Math.max(min, Math.min(max, entry)) : DEFAULT_CANVAS_TERMINAL_SETTINGS[key] as number
  }
  return {
    version: 1, amount: number('amount'), family: TERMINAL_FAMILIES.find(option => option === input.family) ?? 'ascii',
    cellSize: Math.round(number('cellSize', 4, 48)), contrast: number('contrast', 0, 2), brightness: number('brightness', -1, 1),
    edge: number('edge'), changeRate: number('changeRate', 0, 4),
    colorMode: input.colorMode === 'monochrome' ? 'monochrome' : 'source',
    color: typeof input.color === 'string' && /^#[a-f0-9]{6}$/i.test(input.color) ? input.color.toLowerCase() : '#55ff99',
    background: number('background'), glow: number('glow'), sourceMix: number('sourceMix'),
    audioReactivity: number('audioReactivity'), bpmSync: input.bpmSync === true, autoPerformance: input.autoPerformance === true,
    seed: Math.round(number('seed', 0, 0x7fffffff)), quality: TERMINAL_QUALITIES.find(option => option === input.quality) ?? 'auto',
  }
}

export const isTerminalClean = (settings: CanvasTerminalSettings) => settings.amount === 0 || settings.sourceMix === 1

export function terminalBoundedSize(width: number, height: number, cap: number) {
  const scale = Math.min(1, cap / Math.max(1, width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function resolveTerminalPlan(quality: CanvasTerminalSettings['quality'], width: number, height: number) {
  const area = width * height
  const tier = quality === 'auto' ? area <= 960 * 540 ? 'high' : area <= 1920 * 1080 ? 'balanced' : 'low' : quality
  const [columns, rows, outputEdge] = { low: [96, 72, 960], balanced: [160, 120, 1920], high: [240, 180, 2560] }[tier]
  return { columns, rows, outputEdge }
}

export function resolveTerminalGrid(width: number, height: number, cellSize: number, columns: number, rows: number) {
  const pitch = Math.max(cellSize, width / (columns * 0.65), height / rows)
  return { columns: Math.max(1, Math.round(width / (pitch * 0.65))), rows: Math.max(1, Math.round(height / pitch)) }
}
