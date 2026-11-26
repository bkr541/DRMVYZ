export const MORPH_MODES = ['smear', 'halftone', 'droste'] as const
export const MORPH_QUALITIES = ['auto', 'low', 'balanced', 'high'] as const
export const MORPH_PATTERNS = ['impact', 'undertow', 'rebirth', 'overload', 'descent', 'fractured', 'breathing', 'metamorphosis'] as const
export const MORPH_TRIGGERS = ['beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop'] as const
export const MORPH_DIRECTIONS = ['organic', 'horizontal', 'vertical', 'radial', 'spiral'] as const
export const MORPH_PALETTES = ['original', 'ember', 'ice', 'violet', 'mono'] as const
export interface CanvasMorphSettings {
  version: 1
  mode: typeof MORPH_MODES[number]
  pattern: typeof MORPH_PATTERNS[number]
  sourceMode: 'single' | 'pool' | 'default'
  poolId: string | null
  patternChange: boolean
  trigger: typeof MORPH_TRIGGERS[number]
  complexity: number
  depth: number
  direction: typeof MORPH_DIRECTIONS[number]
  rotation: number
  preserveColors: boolean
  palette: typeof MORPH_PALETTES[number]
  brightness: number
  impactStrength: number
  transitionDuration: number
  amount: number
  identity: number
  turbulence: number
  speed: number
  feedback: number
  glow: number
  dotDensity: number
  dotSize: number
  tunnelDepth: number
  twist: number
  sourceMix: number
  audioReactivity: number
  recovery: number
  bpmSync: boolean
  autoPerformance: boolean
  quality: typeof MORPH_QUALITIES[number]
  seed: number
}
export const DEFAULT_CANVAS_MORPH_SETTINGS: CanvasMorphSettings = {
  version: 1, mode: 'smear', pattern: 'impact', sourceMode: 'single', poolId: null, patternChange: false, trigger: 'phrase',
  complexity: .65, depth: .55, direction: 'organic', rotation: 0, preserveColors: true, palette: 'original', brightness: .5, impactStrength: .8, transitionDuration: .65, amount: 0.92, identity: 0.18, turbulence: 0.75,
  speed: 0.8, feedback: 0.92, glow: 0.68, dotDensity: 0.56, dotSize: 0.95,
  tunnelDepth: 0.6, twist: 0.35, sourceMix: 0, audioReactivity: 0.85, recovery: 0.55,
  bpmSync: false, autoPerformance: false, quality: 'auto', seed: 18271,
}
export function normalizeCanvasMorphSettings(value: unknown): CanvasMorphSettings {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const d = DEFAULT_CANVAS_MORPH_SETTINGS
  const n = (key: keyof CanvasMorphSettings, max = 1) => {
    const x = v[key]
    return typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(max, x)) : d[key] as number
  }
  return { version: 1, mode: MORPH_MODES.find(x => x === v.mode) ?? d.mode,
    pattern: MORPH_PATTERNS.find(x => x === v.pattern) ?? (v.pattern === 'flow' ? 'undertow' : v.pattern === 'cycle' ? 'metamorphosis' : d.pattern),
    sourceMode: v.sourceMode === 'pool' || v.sourceMode === 'default' ? v.sourceMode : 'single',
    poolId: typeof v.poolId === 'string' && v.poolId.trim() ? v.poolId.trim() : null,
    patternChange: v.patternChange === true, trigger: MORPH_TRIGGERS.find(x => x === v.trigger) ?? d.trigger,
    complexity: n('complexity'), depth: n('depth'), direction: MORPH_DIRECTIONS.find(x => x === v.direction) ?? d.direction,
    rotation: n('rotation'), preserveColors: v.preserveColors !== false, palette: MORPH_PALETTES.find(x => x === v.palette) ?? d.palette,
    brightness: n('brightness'), impactStrength: n('impactStrength'), transitionDuration: n('transitionDuration', 3),
    amount: n('amount'), identity: n('identity'), turbulence: n('turbulence'), speed: n('speed', 4),
    feedback: n('feedback'), glow: n('glow'), dotDensity: n('dotDensity'), dotSize: n('dotSize'),
    tunnelDepth: n('tunnelDepth'), twist: n('twist'), sourceMix: n('sourceMix'),
    audioReactivity: n('audioReactivity'), recovery: n('recovery'), bpmSync: v.bpmSync === true,
    autoPerformance: v.patternChange !== true && v.autoPerformance === true, quality: MORPH_QUALITIES.find(x => x === v.quality) ?? d.quality,
    seed: Math.round(n('seed', 0x7fffffff)) }
}
export const isMorphClean = (s: CanvasMorphSettings) => s.amount === 0 || s.sourceMix === 1 || s.identity === 1
export function morphOutputEdge(quality: CanvasMorphSettings['quality'], width: number, height: number) {
  if (quality === 'low') return 960
  if (quality === 'high') return 2560
  return quality === 'balanced' || width * height <= 1920 * 1080 ? 1920 : 1280
}
export function boundMorphSize(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(1, width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
