import type { BrandKit } from '../../../../../features/personalization/BrandKitTypes'
import type {
  CanvasFractureColorSourceMode,
  CanvasFractureEffectRole,
  CanvasFractureLumaMode,
  CanvasFractureQualityMode,
} from '../../ReactTypes'
import type {
  CanvasFractureEffectAssignment,
  CanvasFracturesEffectSettings,
  CanvasFracturesResolvedPalette,
  CanvasFracturesSourceElement,
} from './CanvasFracturesTypes'

export const CANVAS_FRACTURES_EFFECT_ROLE_ORDER: readonly CanvasFractureEffectRole[] = [
  'clean',
  'glow',
  'outline',
  'glitch',
  'luma',
  'displacement',
  'texture',
] as const

export const SAFE_CANVAS_FRACTURES_ROLE_WEIGHTS: Readonly<Record<CanvasFractureEffectRole, number>> = {
  clean: 0.34,
  glow: 0.14,
  outline: 0.14,
  glitch: 0.1,
  luma: 0.08,
  displacement: 0.1,
  texture: 0.1,
}


function stableEffectsHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const DEFAULT_PALETTE: CanvasFracturesResolvedPalette = {
  primary: '#4AC7DB',
  supporting: '#61D6AA',
  accent: '#FF4FD8',
  source: 'fallback',
}

function clamp01(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0
}

function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1).split('')
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return fallback
}

export function normalizeCanvasFracturesRoleWeights(
  weights: Partial<Record<CanvasFractureEffectRole, unknown>> | null | undefined,
): Record<CanvasFractureEffectRole, number> {
  const normalized = Object.fromEntries(
    CANVAS_FRACTURES_EFFECT_ROLE_ORDER.map(role => [role, clamp01(weights?.[role])]),
  ) as Record<CanvasFractureEffectRole, number>
  const sum = CANVAS_FRACTURES_EFFECT_ROLE_ORDER.reduce((total, role) => total + normalized[role], 0)
  if (sum <= 1e-8) return { ...SAFE_CANVAS_FRACTURES_ROLE_WEIGHTS }
  for (const role of CANVAS_FRACTURES_EFFECT_ROLE_ORDER) normalized[role] /= sum
  return normalized
}

function deterministicUnit(value: string): number {
  return stableEffectsHash(value) / 0x100000000
}

export function resolveCanvasFracturesEffectAssignment(input: {
  presetId: string
  sourceIdentity: string
  topologyIdentity: string
  fragmentId: string
  variationSeed: number
  roleWeights: Partial<Record<CanvasFractureEffectRole, unknown>> | null | undefined
}): CanvasFractureEffectAssignment {
  const weights = normalizeCanvasFracturesRoleWeights(input.roleWeights)
  const identity = [
    input.presetId,
    input.sourceIdentity,
    input.topologyIdentity,
    input.fragmentId,
    Math.floor(Number.isFinite(input.variationSeed) ? input.variationSeed : 0),
    CANVAS_FRACTURES_EFFECT_ROLE_ORDER.map(role => weights[role].toFixed(6)).join(','),
  ].join('|')
  const pick = deterministicUnit(`${identity}|role`)
  let cursor = 0
  let role: CanvasFractureEffectRole = CANVAS_FRACTURES_EFFECT_ROLE_ORDER[CANVAS_FRACTURES_EFFECT_ROLE_ORDER.length - 1]
  for (const candidate of CANVAS_FRACTURES_EFFECT_ROLE_ORDER) {
    cursor += weights[candidate]
    if (pick < cursor) {
      role = candidate
      break
    }
  }
  const angle = deterministicUnit(`${identity}|direction`) * Math.PI * 2
  return {
    role,
    seed: stableEffectsHash(identity),
    directionX: Math.cos(angle),
    directionY: Math.sin(angle),
    phase: deterministicUnit(`${identity}|phase`),
  }
}

export function resolveCanvasFracturesPalette(input: {
  mode: CanvasFractureColorSourceMode
  manualPrimary: string
  manualSupporting: string
  brandKit?: Readonly<BrandKit> | null
  sampled?: readonly string[] | null
}): CanvasFracturesResolvedPalette {
  const sampled = (input.sampled ?? []).map(color => normalizeHex(color, '')).filter(Boolean)
  if (input.mode === 'imageSampled' && sampled.length > 0) {
    return {
      primary: sampled[0] ?? DEFAULT_PALETTE.primary,
      supporting: sampled[1] ?? sampled[0] ?? DEFAULT_PALETTE.supporting,
      accent: sampled[2] ?? sampled[1] ?? sampled[0] ?? DEFAULT_PALETTE.accent,
      source: 'imageSampled',
    }
  }
  if (input.mode === 'brandKit' && input.brandKit) {
    const palette = input.brandKit.palette
    return {
      primary: normalizeHex(palette.primary, DEFAULT_PALETTE.primary),
      supporting: normalizeHex(palette.secondary, normalizeHex(palette.accent, DEFAULT_PALETTE.supporting)),
      accent: normalizeHex(palette.highlight, normalizeHex(palette.accent, DEFAULT_PALETTE.accent)),
      source: 'brandKit',
    }
  }
  if (input.mode === 'manualOverride') {
    return {
      primary: normalizeHex(input.manualPrimary, DEFAULT_PALETTE.primary),
      supporting: normalizeHex(input.manualSupporting, DEFAULT_PALETTE.supporting),
      accent: normalizeHex(input.manualSupporting, DEFAULT_PALETTE.accent),
      source: 'manualOverride',
    }
  }
  return { ...DEFAULT_PALETTE }
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const safe = normalizeHex(hex, '#FFFFFF')
  return [
    Number.parseInt(safe.slice(1, 3), 16) / 255,
    Number.parseInt(safe.slice(3, 5), 16) / 255,
    Number.parseInt(safe.slice(5, 7), 16) / 255,
  ]
}

export interface CanvasFracturesPackedEffectParams {
  role: number
  intensity: number
  outlineThickness: number
  outlineIntensity: number
  bloomIntensity: number
  rgbSplit: number
  lumaThreshold: number
  lumaMode: number
  displacement: number
  pixelation: number
  scanlines: number
  noise: number
  quality: number
  directionX: number
  directionY: number
  phase: number
  primary: readonly [number, number, number]
  supporting: readonly [number, number, number]
  accent: readonly [number, number, number]
}

const ROLE_INDEX: Record<CanvasFractureEffectRole, number> = {
  clean: 0,
  outline: 1,
  glow: 2,
  glitch: 3,
  luma: 4,
  displacement: 5,
  texture: 6,
}

const LUMA_MODE_INDEX: Record<CanvasFractureLumaMode, number> = {
  highlights: 0,
  shadows: 1,
  band: 2,
}

const QUALITY_INDEX: Record<CanvasFractureQualityMode, number> = {
  low: 0,
  balanced: 1,
  high: 2,
}

export function packCanvasFracturesEffectParams(input: {
  assignment: CanvasFractureEffectAssignment
  settings: CanvasFracturesEffectSettings
  palette: CanvasFracturesResolvedPalette
}): CanvasFracturesPackedEffectParams {
  const intensity = clamp01(input.settings.intensity)
  return {
    role: ROLE_INDEX[input.assignment.role],
    intensity,
    outlineThickness: clamp01(input.settings.outlineThickness),
    outlineIntensity: clamp01(input.settings.outlineIntensity),
    bloomIntensity: clamp01(input.settings.bloomIntensity),
    rgbSplit: clamp01(input.settings.rgbSplit),
    lumaThreshold: clamp01(input.settings.lumaThreshold),
    lumaMode: LUMA_MODE_INDEX[input.settings.lumaMode],
    displacement: clamp01(input.settings.displacement),
    pixelation: clamp01(input.settings.pixelation),
    scanlines: clamp01(input.settings.scanlines),
    noise: clamp01(input.settings.noise),
    quality: QUALITY_INDEX[input.settings.quality],
    directionX: Number.isFinite(input.assignment.directionX) ? input.assignment.directionX : 1,
    directionY: Number.isFinite(input.assignment.directionY) ? input.assignment.directionY : 0,
    phase: clamp01(input.assignment.phase),
    primary: hexToRgb(input.palette.primary),
    supporting: hexToRgb(input.palette.supporting),
    accent: hexToRgb(input.palette.accent),
  }
}

export function resolveCanvasFracturesFallbackEffect(role: CanvasFractureEffectRole): CanvasFractureEffectRole {
  return CANVAS_FRACTURES_EFFECT_ROLE_ORDER.includes(role) ? role : 'clean'
}

function sourceDimensions(source: CanvasFracturesSourceElement): { width: number; height: number } {
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight }
  }
  const image = source as HTMLImageElement
  return { width: image.naturalWidth, height: image.naturalHeight }
}

function colorDistance(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

function rgbToHex(rgb: readonly [number, number, number]): string {
  return `#${rgb.map(value => Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/**
 * Small, bounded palette cache. Sampling occurs only when the media identity,
 * revision, or decoded dimensions change. Transparent pixels are ignored.
 */
export class CanvasFracturesImagePaletteCache {
  private readonly entries = new Map<string, readonly string[]>()
  private readonly canvas: HTMLCanvasElement | OffscreenCanvas | null
  private readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null

  constructor() {
    let canvas: HTMLCanvasElement | OffscreenCanvas | null = null
    let context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(32, 32)
        context = canvas.getContext('2d', { willReadFrequently: true })
      } else if (typeof document !== 'undefined') {
        const element = document.createElement('canvas')
        element.width = 32
        element.height = 32
        canvas = element
        context = element.getContext('2d', { willReadFrequently: true })
      }
    } catch {
      canvas = null
      context = null
    }
    this.canvas = canvas
    this.context = context
  }

  get size(): number {
    return this.entries.size
  }

  sample(source: CanvasFracturesSourceElement, identity: string, revision: number): readonly string[] {
    const dimensions = sourceDimensions(source)
    const key = `${identity}|${Math.max(0, Math.floor(revision))}|${dimensions.width}x${dimensions.height}`
    const cached = this.entries.get(key)
    if (cached) return cached
    const palette = this.readPalette(source)
    this.entries.set(key, palette)
    if (this.entries.size > 8) {
      const oldest = this.entries.keys().next().value as string | undefined
      if (oldest) this.entries.delete(oldest)
    }
    return palette
  }

  clear(): void {
    this.entries.clear()
  }

  private readPalette(source: CanvasFracturesSourceElement): readonly string[] {
    if (!this.canvas || !this.context) return []
    const dimensions = sourceDimensions(source)
    if (dimensions.width <= 0 || dimensions.height <= 0) return []
    const context = this.context
    try {
      context.clearRect(0, 0, 32, 32)
      context.drawImage(source, 0, 0, 32, 32)
      const pixels = context.getImageData(0, 0, 32, 32).data
      const bins = new Map<number, { count: number; r: number; g: number; b: number }>()
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3]
        if (alpha < 32) continue
        const r = pixels[index]
        const g = pixels[index + 1]
        const b = pixels[index + 2]
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const saturation = max === 0 ? 0 : (max - min) / max
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const weight = 1 + saturation * 2 + (luminance > 20 && luminance < 238 ? 0.5 : 0)
        const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
        const current = bins.get(bin) ?? { count: 0, r: 0, g: 0, b: 0 }
        current.count += weight
        current.r += r * weight
        current.g += g * weight
        current.b += b * weight
        bins.set(bin, current)
      }
      const candidates = [...bins.values()]
        .map(entry => ({
          score: entry.count,
          rgb: [entry.r / entry.count, entry.g / entry.count, entry.b / entry.count] as const,
        }))
        .sort((a, b) => b.score - a.score)
      const selected: Array<readonly [number, number, number]> = []
      for (const candidate of candidates) {
        if (selected.every(existing => colorDistance(existing, candidate.rgb) > 1800)) selected.push(candidate.rgb)
        if (selected.length >= 3) break
      }
      return selected.map(rgbToHex)
    } catch {
      // Cross-origin/tainted sources and transient video frames fall back safely.
      return []
    }
  }
}
