import type { BrandKit } from '../../../../../features/personalization/BrandKitTypes'
import type {
  CanvasFractureColorSourceMode,
  CanvasFractureEffectRole,
  CanvasFractureLumaMode,
  CanvasFractureResolvedQualityTier,
} from '../../ReactTypes'
import type {
  CanvasFractureEffectAssignment,
  CanvasFracturesEffectSettings,
  CanvasFracturesQualityBudget,
  CanvasFracturesResolvedEffectSettings,
  CanvasFracturesResolvedFragmentEffects,
  CanvasFracturesResolvedPalette,
  CanvasFracturesSourceElement,
  CanvasFractureBlendMode,
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

/** Compact deterministic secondary-effect capabilities. */
export const CANVAS_FRACTURES_EFFECT_MODIFIERS = {
  posterize: 1 << 0,
  hueShift: 1 << 1,
  duotone: 1 << 2,
  shadow: 1 << 3,
  duplicate: 1 << 4,
  flash: 1 << 5,
  blur: 1 << 6,
  sharpen: 1 << 7,
  dissolve: 1 << 8,
} as const

export type CanvasFracturesEffectModifierName = keyof typeof CANVAS_FRACTURES_EFFECT_MODIFIERS

export function canvasFracturesHasModifier(mask: number, modifier: CanvasFracturesEffectModifierName): boolean {
  return (mask & CANVAS_FRACTURES_EFFECT_MODIFIERS[modifier]) !== 0
}

const QUALITY_BUDGETS: Readonly<Record<CanvasFractureResolvedQualityTier, CanvasFracturesQualityBudget>> = {
  low: {
    trailScale: 0.45,
    trailMaxWidth: 640,
    trailMaxHeight: 360,
    maxDuplicateCopies: 1,
    maxBlurFragments: 2,
    maxSharpenFragments: 1,
    maxBlurPasses: 1,
    maxSharpenPasses: 1,
    shadowQuality: 0,
    maxExpensiveFragments: 4,
  },
  balanced: {
    trailScale: 0.65,
    trailMaxWidth: 960,
    trailMaxHeight: 540,
    maxDuplicateCopies: 2,
    maxBlurFragments: 4,
    maxSharpenFragments: 2,
    maxBlurPasses: 1,
    maxSharpenPasses: 1,
    shadowQuality: 1,
    maxExpensiveFragments: 8,
  },
  high: {
    trailScale: 0.8,
    trailMaxWidth: 1280,
    trailMaxHeight: 720,
    maxDuplicateCopies: 3,
    maxBlurFragments: 7,
    maxSharpenFragments: 4,
    maxBlurPasses: 1,
    maxSharpenPasses: 1,
    shadowQuality: 2,
    maxExpensiveFragments: 14,
  },
  ultra: {
    trailScale: 0.9,
    trailMaxWidth: 1600,
    trailMaxHeight: 900,
    maxDuplicateCopies: 4,
    maxBlurFragments: 10,
    maxSharpenFragments: 6,
    maxBlurPasses: 1,
    maxSharpenPasses: 1,
    shadowQuality: 2,
    maxExpensiveFragments: 20,
  },
}

export function resolveCanvasFracturesQualityBudget(quality: CanvasFractureResolvedQualityTier): CanvasFracturesQualityBudget {
  return { ...QUALITY_BUDGETS[quality] }
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

function resolveDeterministicModifierMask(role: CanvasFractureEffectRole, identity: string): number {
  if (role === 'clean') return 0
  let mask = 0
  const include = (modifier: CanvasFracturesEffectModifierName, threshold: number) => {
    if (deterministicUnit(`${identity}|modifier:${modifier}`) < threshold) {
      mask |= CANVAS_FRACTURES_EFFECT_MODIFIERS[modifier]
    }
  }
  if (role === 'texture') mask |= CANVAS_FRACTURES_EFFECT_MODIFIERS.posterize
  else include('posterize', 0.28)
  if (role === 'glow' || role === 'luma') mask |= CANVAS_FRACTURES_EFFECT_MODIFIERS.hueShift
  else include('hueShift', 0.34)
  if (role === 'luma') mask |= CANVAS_FRACTURES_EFFECT_MODIFIERS.duotone
  else include('duotone', 0.3)
  if (role === 'outline' || role === 'displacement') mask |= CANVAS_FRACTURES_EFFECT_MODIFIERS.shadow
  else include('shadow', 0.44)
  if (role === 'glitch' || role === 'displacement') mask |= CANVAS_FRACTURES_EFFECT_MODIFIERS.duplicate
  else include('duplicate', 0.3)
  if (role === 'glitch') mask |= CANVAS_FRACTURES_EFFECT_MODIFIERS.flash
  else include('flash', 0.16)
  if (role === 'glow') mask |= CANVAS_FRACTURES_EFFECT_MODIFIERS.blur
  else include('blur', role === 'texture' ? 0.4 : 0.2)
  if (role === 'texture' && !canvasFracturesHasModifier(mask, 'blur')) mask |= CANVAS_FRACTURES_EFFECT_MODIFIERS.sharpen
  else include('sharpen', 0.2)
  if (role === 'glitch' || role === 'texture') mask |= CANVAS_FRACTURES_EFFECT_MODIFIERS.dissolve
  else include('dissolve', 0.22)
  return mask
}

function resolveDeterministicBlendMode(role: CanvasFractureEffectRole, identity: string): CanvasFractureBlendMode {
  if (role === 'clean' || role === 'outline') return 'normal'
  const pick = deterministicUnit(`${identity}|blend-mode`)
  if (role === 'glow') return pick < 0.5 ? 'screen' : 'additive'
  if (role === 'glitch') return pick < 0.4 ? 'difference' : pick < 0.75 ? 'exclusion' : 'screen'
  if (role === 'luma') return pick < 0.7 ? 'screen' : 'normal'
  if (role === 'displacement') return pick < 0.35 ? 'difference' : 'normal'
  return pick < 0.28 ? 'exclusion' : 'normal'
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
    modifiers: resolveDeterministicModifierMask(role, identity),
    blendMode: resolveDeterministicBlendMode(role, identity),
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

function mixNumber(a: number, b: number, amount: number): number {
  return a + (b - a) * clamp01(amount)
}

/**
 * The one canonical macro resolver. Render backends consume only this resolved
 * structure and never independently reinterpret user-facing macro values.
 */
export function resolveCanvasFracturesEffectMacros(
  settings: CanvasFracturesEffectSettings,
): CanvasFracturesResolvedEffectSettings {
  const intensity = clamp01(settings.intensity)
  const glow = intensity * clamp01(settings.glow)
  const glitch = intensity * clamp01(settings.glitch)
  const texture = intensity * clamp01(settings.texture)
  const trails = intensity * clamp01(settings.trails)
  const depth = intensity * clamp01(settings.depth)
  const duplication = intensity * clamp01(settings.duplication)
  const colorTreatment = intensity * clamp01(settings.colorTreatment)
  const posterization = clamp01(Math.max(texture * 0.82, colorTreatment * 0.5))
  const quality = settings.quality
  const budget = resolveCanvasFracturesQualityBudget(quality)
  const levelSpan = quality === 'low' ? 8 : quality === 'high' ? 13 : 10
  const flashTrigger = settings.reducedMotion ? 0 : clamp01(settings.flashTrigger ?? 0)
  return {
    intensity,
    outlineIntensity: clamp01(glow * (0.3 + clamp01(settings.outlineIntensity) * 0.7)),
    outlineThickness: clamp01(0.15 + clamp01(settings.outlineThickness) * 0.85),
    bloomIntensity: clamp01(glow * (0.35 + clamp01(settings.bloomIntensity) * 0.65)),
    rgbSplit: clamp01(glitch * (0.3 + clamp01(settings.rgbSplit) * 0.7)),
    lumaMode: settings.lumaMode,
    lumaThreshold: clamp01(settings.lumaThreshold),
    displacement: clamp01(glitch * (0.28 + clamp01(settings.displacement) * 0.72)),
    pixelation: clamp01(texture * (0.25 + clamp01(settings.pixelation) * 0.75)),
    scanlines: clamp01(texture * (0.25 + clamp01(settings.scanlines) * 0.75)),
    noise: clamp01(texture * (0.25 + clamp01(settings.noise) * 0.75)),
    posterization,
    posterizeLevels: Math.max(2, Math.min(16, Math.round(16 - posterization * levelSpan))),
    trailOpacity: clamp01(trails * 0.72),
    trailPersistence: trails <= 1e-4 ? 0 : Math.min(0.9, mixNumber(0.28, 0.88, trails)),
    hueShift: colorTreatment * 0.34,
    duotone: colorTreatment * 0.86,
    depth,
    shadowOffsetPx: depth * 18,
    shadowBlurPx: depth * (quality === 'low' ? 5 : quality === 'high' ? 18 : 11),
    shadowOpacity: depth * 0.58,
    parallaxPx: depth * 12,
    depthScale: depth * 0.08,
    duplication,
    copyOpacity: duplication * 0.62,
    copyOffsetPx: duplication * (quality === 'low' ? 10 : quality === 'high' ? 28 : 18),
    flash: Math.min(0.52, glitch * flashTrigger * 0.65),
    blur: texture * 0.52,
    sharpen: texture * 0.62,
    dissolve: clamp01(Math.max(glitch * 0.64, texture * 0.38)),
    quality,
    budget,
  }
}

export function resolveCanvasFracturesFragmentEffects(input: {
  assignment: CanvasFractureEffectAssignment
  settings: CanvasFracturesResolvedEffectSettings
  fragmentOrdinal: number
}): CanvasFracturesResolvedFragmentEffects {
  const { assignment, settings } = input
  const clean = assignment.role === 'clean' || settings.intensity <= 1e-5
  if (clean) {
    return {
      blendMode: 'normal',
      posterization: 0,
      posterizeLevels: settings.posterizeLevels,
      hueShift: 0,
      duotone: 0,
      shadow: 0,
      shadowOffsetPx: 0,
      shadowBlurPx: 0,
      duplicateCount: 0,
      copyOpacity: 0,
      copyOffsetPx: 0,
      flash: 0,
      blur: 0,
      sharpen: 0,
      dissolve: 0,
    }
  }
  const ordinal = Math.max(0, Math.floor(input.fragmentOrdinal))
  const budget = settings.budget
  const expensiveAllowed = ordinal < budget.maxExpensiveFragments
  const blurAllowed = expensiveAllowed && budget.maxBlurPasses > 0 && ordinal < budget.maxBlurFragments
  const sharpenAllowed = expensiveAllowed && budget.maxSharpenPasses > 0 && ordinal < budget.maxSharpenFragments
  const duplicateCount = canvasFracturesHasModifier(assignment.modifiers, 'duplicate')
    ? Math.min(budget.maxDuplicateCopies, Math.floor(settings.duplication * (budget.maxDuplicateCopies + 0.999)))
    : 0
  const hueSign = (assignment.seed & 1) === 0 ? -1 : 1
  let blur = blurAllowed && canvasFracturesHasModifier(assignment.modifiers, 'blur') ? settings.blur : 0
  let sharpen = sharpenAllowed && canvasFracturesHasModifier(assignment.modifiers, 'sharpen') ? settings.sharpen : 0
  if (blur > 0 && sharpen > 0) {
    if ((assignment.seed & 2) === 0) sharpen = 0
    else blur = 0
  }
  return {
    blendMode: assignment.blendMode,
    posterization: canvasFracturesHasModifier(assignment.modifiers, 'posterize') ? settings.posterization : 0,
    posterizeLevels: settings.posterizeLevels,
    hueShift: canvasFracturesHasModifier(assignment.modifiers, 'hueShift')
      ? settings.hueShift * hueSign * (0.55 + assignment.phase * 0.45)
      : 0,
    duotone: canvasFracturesHasModifier(assignment.modifiers, 'duotone')
      ? settings.duotone * (0.6 + assignment.phase * 0.4)
      : 0,
    shadow: expensiveAllowed && canvasFracturesHasModifier(assignment.modifiers, 'shadow') ? settings.depth : 0,
    shadowOffsetPx: settings.shadowOffsetPx * (0.7 + assignment.phase * 0.6),
    shadowBlurPx: settings.shadowBlurPx * (budget.shadowQuality === 0 ? 0.25 : budget.shadowQuality === 1 ? 0.65 : 1),
    duplicateCount,
    copyOpacity: settings.copyOpacity * (0.7 + assignment.phase * 0.3),
    copyOffsetPx: settings.copyOffsetPx * (0.65 + assignment.phase * 0.7),
    flash: canvasFracturesHasModifier(assignment.modifiers, 'flash') ? settings.flash : 0,
    blur,
    sharpen,
    dissolve: canvasFracturesHasModifier(assignment.modifiers, 'dissolve')
      ? settings.dissolve * (0.62 + assignment.phase * 0.38)
      : 0,
  }
}

export function resolveCanvasFracturesTrailBufferSize(input: {
  pixelWidth: number
  pixelHeight: number
  budget: CanvasFracturesQualityBudget
}): { width: number; height: number } {
  const sourceWidth = Math.max(1, Math.round(input.pixelWidth))
  const sourceHeight = Math.max(1, Math.round(input.pixelHeight))
  const scale = Math.min(
    1,
    input.budget.trailScale,
    input.budget.trailMaxWidth / sourceWidth,
    input.budget.trailMaxHeight / sourceHeight,
  )
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

export function resolveCanvasFracturesUvTransform(
  localX: number,
  localY: number,
  mirrorX: boolean,
  mirrorY: boolean,
): { x: number; y: number } {
  const x = clamp01(localX)
  const y = clamp01(localY)
  return { x: mirrorX ? 1 - x : x, y: mirrorY ? 1 - y : y }
}

export function resolveCanvasFracturesDissolveSample(seed: number, x: number, y: number): number {
  const xi = Math.floor(Number.isFinite(x) ? x : 0)
  const yi = Math.floor(Number.isFinite(y) ? y : 0)
  let hash = Math.imul((seed >>> 0) ^ Math.imul(xi, 0x45d9f3b), 0x45d9f3b)
  hash = Math.imul(hash ^ Math.imul(yi, 0x27d4eb2d), 0x27d4eb2d)
  return ((hash ^ (hash >>> 15)) >>> 0) / 0x100000000
}

function rotateHue(color: readonly [number, number, number], amount: number): readonly [number, number, number] {
  const angle = amount * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const [r, g, b] = color
  return [
    clamp01((0.213 + cos * 0.787 - sin * 0.213) * r + (0.715 - cos * 0.715 - sin * 0.715) * g + (0.072 - cos * 0.072 + sin * 0.928) * b),
    clamp01((0.213 - cos * 0.213 + sin * 0.143) * r + (0.715 + cos * 0.285 + sin * 0.14) * g + (0.072 - cos * 0.072 - sin * 0.283) * b),
    clamp01((0.213 - cos * 0.213 - sin * 0.787) * r + (0.715 - cos * 0.715 + sin * 0.715) * g + (0.072 + cos * 0.928 + sin * 0.072) * b),
  ]
}

export function applyCanvasFracturesPixelTreatment(input: {
  rgba: readonly [number, number, number, number]
  posterization: number
  posterizeLevels: number
  hueShift: number
  duotone: number
  primary: readonly [number, number, number]
  supporting: readonly [number, number, number]
  dissolveMask?: number
}): readonly [number, number, number, number] {
  const originalAlpha = Math.min(255, Math.max(0, Math.round(input.rgba[3])))
  let color: readonly [number, number, number] = [
    clamp01(input.rgba[0] / 255),
    clamp01(input.rgba[1] / 255),
    clamp01(input.rgba[2] / 255),
  ]
  const posterization = clamp01(input.posterization)
  if (posterization > 0) {
    const levels = Math.max(2, Math.min(32, Math.round(input.posterizeLevels)))
    color = color.map(value => mixNumber(value, Math.round(value * (levels - 1)) / (levels - 1), posterization)) as [number, number, number]
  }
  if (Math.abs(input.hueShift) > 1e-6) color = rotateHue(color, input.hueShift)
  const duotone = clamp01(input.duotone)
  if (duotone > 0) {
    const luma = clamp01(color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722)
    const mapped = input.primary.map((component, index) => mixNumber(component, input.supporting[index], luma)) as [number, number, number]
    color = color.map((component, index) => mixNumber(component, mapped[index], duotone)) as [number, number, number]
  }
  const dissolveMask = clamp01(input.dissolveMask ?? 1)
  return [
    Math.round(color[0] * 255),
    Math.round(color[1] * 255),
    Math.round(color[2] * 255),
    Math.round(originalAlpha * dissolveMask),
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
  posterization: number
  posterizeLevels: number
  hueShift: number
  duotone: number
  flash: number
  blur: number
  sharpen: number
  dissolve: number
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

const QUALITY_INDEX: Record<CanvasFractureResolvedQualityTier, number> = {
  low: 0,
  balanced: 1,
  high: 2,
  ultra: 2,
}

export function packCanvasFracturesEffectParams(input: {
  assignment: CanvasFractureEffectAssignment
  settings: CanvasFracturesResolvedEffectSettings
  fragmentEffects: CanvasFracturesResolvedFragmentEffects
  palette: CanvasFracturesResolvedPalette
}): CanvasFracturesPackedEffectParams {
  return {
    role: ROLE_INDEX[input.assignment.role],
    intensity: clamp01(input.settings.intensity),
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
    posterization: clamp01(input.fragmentEffects.posterization),
    posterizeLevels: Math.max(2, Math.min(32, input.fragmentEffects.posterizeLevels)),
    hueShift: Math.max(-1, Math.min(1, input.fragmentEffects.hueShift)),
    duotone: clamp01(input.fragmentEffects.duotone),
    flash: clamp01(input.fragmentEffects.flash),
    blur: clamp01(input.fragmentEffects.blur),
    sharpen: clamp01(input.fragmentEffects.sharpen),
    dissolve: clamp01(input.fragmentEffects.dissolve),
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
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height }
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
