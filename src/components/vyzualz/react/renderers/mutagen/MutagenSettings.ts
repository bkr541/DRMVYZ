export const MUTAGEN_SETTINGS_VERSION = 3 as const

/** Same musical vocabulary as SHIFTGRID; separate from video restart timing. */
export const MUTAGEN_TRIGGER_OPTIONS = [
  { value: 'beat', label: 'Beat' },
  { value: 'kick', label: 'Kick' },
  { value: 'snare', label: 'Snare' },
  { value: 'downbeat', label: 'Downbeat' },
  { value: 'beat2', label: 'Every 2 Beats' },
  { value: 'beat4', label: 'Every 4 Beats' },
  { value: 'bar', label: 'Bar' },
  { value: 'bar4', label: 'Every 4 Bars' },
  { value: 'bar8', label: 'Every 8 Bars' },
  { value: 'phrase', label: 'Phrase' },
  { value: 'drop', label: 'Drop' },
] as const
export type MutagenTrigger = typeof MUTAGEN_TRIGGER_OPTIONS[number]['value']

export const MUTAGEN_PATTERN_OPTIONS = [
  { value: 'liquify', label: 'LIQUIFY' },
  { value: 'vortex', label: 'VORTEX' },
  { value: 'particulate', label: 'PARTICULATE' },
  { value: 'terraform', label: 'TERRAFORM' },
  { value: 'fracture', label: 'FRACTURE' },
  { value: 'spectralTear', label: 'SPECTRAL TEAR' },
  { value: 'recursion', label: 'RECURSION' },
  { value: 'morph', label: 'MORPH' },
] as const
export type MutagenPattern = typeof MUTAGEN_PATTERN_OPTIONS[number]['value']
export const MUTAGEN_PATTERNS = MUTAGEN_PATTERN_OPTIONS.map(option => option.value)
export function isMutagenPattern(value: unknown): value is MutagenPattern {
  return MUTAGEN_PATTERNS.includes(value as MutagenPattern)
}

export interface CanvasMutagenSettings {
  version: typeof MUTAGEN_SETTINGS_VERSION
  pattern: MutagenPattern
  patternChange: boolean
  trigger: MutagenTrigger
  autoPerformance: boolean
  bpmSync: boolean
  audioReactivity: number
  deterministicSeed: number
  mutation: number
  flowSpeed: number
  feedback: number
  /** 0 = mutated image; 1 = reconstruct the immutable source. */
  sourceMix: number
  preserveColors: boolean
  quality: 'auto' | 'low' | 'balanced' | 'high'
  transitionDuration: number
  glow: number
  vortexTwist: number
  cellSize: number
  terrainHeight: number
  fractureSpread: number
  tearBands: number
  recursionDepth: number
  morphScale: number
}

export const DEFAULT_CANVAS_MUTAGEN_SETTINGS: CanvasMutagenSettings = {
  version: MUTAGEN_SETTINGS_VERSION,
  pattern: 'liquify',
  patternChange: false,
  trigger: 'bar4',
  autoPerformance: false,
  bpmSync: false,
  audioReactivity: 0.65,
  deterministicSeed: 91817,
  mutation: 0.65,
  flowSpeed: 1,
  feedback: 0,
  sourceMix: 0,
  preserveColors: true,
  quality: 'balanced',
  transitionDuration: 0.55,
  glow: 0,
  vortexTwist: 0.7,
  cellSize: 0.55,
  terrainHeight: 0.65,
  fractureSpread: 0.7,
  tearBands: 18,
  recursionDepth: 4,
  morphScale: 0.5,
}

export function applyMutagenManualPattern(settings: CanvasMutagenSettings, pattern: MutagenPattern): CanvasMutagenSettings {
  return { ...settings, pattern, autoPerformance: false }
}

export function applyMutagenPatternChange(settings: CanvasMutagenSettings, patternChange: boolean): CanvasMutagenSettings {
  return { ...settings, patternChange, ...(patternChange ? { autoPerformance: false } : {}) }
}

export function applyMutagenAutoPerformance(settings: CanvasMutagenSettings, autoPerformance: boolean): CanvasMutagenSettings {
  return { ...settings, autoPerformance, ...(autoPerformance ? { patternChange: false } : {}) }
}

export function normalizeCanvasMutagenSettings(value: unknown): CanvasMutagenSettings {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
  const defaults = DEFAULT_CANVAS_MUTAGEN_SETTINGS
  const number = (key: keyof Pick<CanvasMutagenSettings, 'mutation' | 'flowSpeed' | 'feedback' | 'sourceMix' | 'transitionDuration' | 'glow' | 'vortexTwist' | 'cellSize' | 'terrainHeight' | 'fractureSpread' | 'tearBands' | 'recursionDepth' | 'morphScale' | 'audioReactivity' | 'deterministicSeed'>, max = 1, min = 0) => {
    const v = source[key]
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : defaults[key]
  }
  const boolean = (key: 'patternChange' | 'autoPerformance' | 'bpmSync') => typeof source[key] === 'boolean' ? source[key] : defaults[key]
  const patternChange = boolean('patternChange')
  return {
    version: MUTAGEN_SETTINGS_VERSION,
    pattern: isMutagenPattern(source.pattern) ? source.pattern : defaults.pattern,
    patternChange,
    autoPerformance: patternChange ? false : boolean('autoPerformance'),
    trigger: MUTAGEN_TRIGGER_OPTIONS.some(option => option.value === source.trigger) ? source.trigger as MutagenTrigger : defaults.trigger,
    bpmSync: boolean('bpmSync'),
    audioReactivity: number('audioReactivity'),
    deterministicSeed: Math.round(number('deterministicSeed', 0x7fffffff)),
    mutation: number('mutation'),
    flowSpeed: number('flowSpeed', 4),
    feedback: number('feedback'),
    sourceMix: number('sourceMix'),
    preserveColors: typeof source.preserveColors === 'boolean' ? source.preserveColors : defaults.preserveColors,
    quality: source.quality === 'auto' || source.quality === 'low' || source.quality === 'balanced' || source.quality === 'high' ? source.quality : defaults.quality,
    transitionDuration: number('transitionDuration', 2, 0.1),
    glow: number('glow'),
    vortexTwist: number('vortexTwist'),
    cellSize: number('cellSize'),
    terrainHeight: number('terrainHeight'),
    fractureSpread: number('fractureSpread'),
    tearBands: Math.round(number('tearBands', 48, 4)),
    recursionDepth: Math.round(number('recursionDepth', 6, 1)),
    morphScale: number('morphScale'),
  }
}
