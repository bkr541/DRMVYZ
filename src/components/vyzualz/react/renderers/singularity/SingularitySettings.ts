export const SINGULARITY_PATTERNS = ['origin', 'gravity', 'event horizon', 'signal lost', 'supernova', 'undertow', 'resonance', 'corruption', 'polarity', 'rebirth'] as const
export const SINGULARITY_TRIGGERS = ['beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop'] as const
export const SINGULARITY_MODES = ['emissive', 'original color', 'holographic', 'particle construct'] as const
export const SINGULARITY_PALETTES = ['cryogenic', 'inferno', 'ultraviolet', 'void', 'toxic', 'solar', 'source color'] as const
export const SINGULARITY_QUALITIES = ['auto', 'low', 'balanced', 'high'] as const
export const DEFAULT_CANVAS_SINGULARITY_SETTINGS = {
  version: 1 as const, sourceMode: 'single' as 'single' | 'pool' | 'default', poolId: null as string | null,
  pattern: 'origin' as typeof SINGULARITY_PATTERNS[number], trigger: 'phrase' as typeof SINGULARITY_TRIGGERS[number],
  mode: 'emissive' as typeof SINGULARITY_MODES[number], palette: 'cryogenic' as typeof SINGULARITY_PALETTES[number],
  quality: 'auto' as typeof SINGULARITY_QUALITIES[number], patternChange: false, autoPerformance: true,
  fragmentDensity: .65, fragmentSize: .5, depth: .8, particleDensity: .75, sourceScale: .84, identity: .35,
  speed: .6, turbulence: .45, camera: .25, recovery: .6, glow: .7, bloomRadius: .6, trails: .45, glitch: .55, background: 1,
  audioReactivity: .85, impactStrength: .8, preserveColors: false, seed: 28317,
}
export type CanvasSingularitySettings = typeof DEFAULT_CANVAS_SINGULARITY_SETTINGS
export function normalizeCanvasSingularitySettings(value: unknown): CanvasSingularitySettings {
  const d = DEFAULT_CANVAS_SINGULARITY_SETTINGS
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const n = (key: keyof CanvasSingularitySettings, max = 1) => typeof v[key] === 'number' && Number.isFinite(v[key]) ? Math.max(0, Math.min(max, v[key] as number)) : d[key] as number
  return { ...d, sourceMode: v.sourceMode === 'pool' || v.sourceMode === 'default' ? v.sourceMode : 'single',
    poolId: typeof v.poolId === 'string' && v.poolId.trim() ? v.poolId.trim() : null,
    pattern: SINGULARITY_PATTERNS.find(x => x === v.pattern) ?? d.pattern, trigger: SINGULARITY_TRIGGERS.find(x => x === v.trigger) ?? d.trigger,
    mode: SINGULARITY_MODES.find(x => x === v.mode) ?? d.mode, palette: SINGULARITY_PALETTES.find(x => x === v.palette) ?? d.palette,
    quality: SINGULARITY_QUALITIES.find(x => x === v.quality) ?? d.quality,
    patternChange: v.patternChange === true, autoPerformance: v.patternChange !== true && v.autoPerformance !== false,
    preserveColors: v.preserveColors === true, fragmentDensity: n('fragmentDensity'), fragmentSize: n('fragmentSize'), depth: n('depth'),
    particleDensity: n('particleDensity'), sourceScale: n('sourceScale'), identity: n('identity'), speed: n('speed'), turbulence: n('turbulence'),
    camera: n('camera'), recovery: n('recovery'), glow: n('glow'), bloomRadius: n('bloomRadius'), trails: n('trails'), glitch: n('glitch'), background: n('background'), audioReactivity: n('audioReactivity'),
    impactStrength: n('impactStrength'), seed: Math.round(n('seed', 0x7fffffff)) }
}
export function singularityBudget(quality: CanvasSingularitySettings['quality'], width: number, height: number) {
  if (quality === 'low') return { edge: 960, dpr: 1, fragments: 120, particles: 8000, ribbons: 4 }
  if (quality === 'high') return { edge: 2560, dpr: 2, fragments: 800, particles: 60000, ribbons: 14 }
  return { edge: quality === 'auto' && width * height > 1920 * 1080 ? 1280 : 1920, dpr: 1.5, fragments: 350, particles: 24000, ribbons: 8 }
}
