import type { ReactEngineId, ReactPalette, ReactPreset } from '../../components/vyzualz/react/ReactTypes'
import type {
  BrandKit,
  BrandKitEngineRule,
  BrandKitPresetRule,
  BrandPersonalizationMode,
} from './BrandKitTypes'
import { contrastRatio, mixHex, normalizeHexColor, readableTextColor } from './paletteColorSpace'

const HEX_COLOR = /^#[0-9A-F]{6}$/i
export const PALETTE_NATIVE_REACT_ENGINES: ReadonlySet<ReactEngineId> = new Set([
  'oscilloscope',
  'neonLattice',
  'cinematicPortal',
  'laserDmx',
  'shaderPads',
])
const PALETTE_KEYS: ReadonlyArray<keyof ReactPalette> = [
  'primary', 'secondary', 'accent', 'background', 'highlight', 'text',
]

export interface EffectivePaletteInput {
  basePalette: Readonly<ReactPalette>
  brandKit: Readonly<BrandKit> | null | undefined
  engineId: ReactEngineId
  presetId: string
  engineRule?: Readonly<BrandKitEngineRule> | null
  presetRule?: Readonly<BrandKitPresetRule> | null
}

function clonePalette(palette: Readonly<ReactPalette>): ReactPalette {
  return {
    primary: palette.primary,
    secondary: palette.secondary,
    accent: palette.accent,
    background: palette.background,
    highlight: palette.highlight,
    text: palette.text,
  }
}

function isPalette(value: unknown): value is ReactPalette {
  if (!value || typeof value !== 'object') return false
  const input = value as Partial<Record<keyof ReactPalette, unknown>>
  return PALETTE_KEYS.every(key => typeof input[key] === 'string' && HEX_COLOR.test(input[key] as string))
}

function normalizePalette(palette: ReactPalette): ReactPalette {
  return {
    primary: normalizeHexColor(palette.primary),
    secondary: normalizeHexColor(palette.secondary),
    accent: normalizeHexColor(palette.accent),
    background: normalizeHexColor(palette.background),
    highlight: normalizeHexColor(palette.highlight),
    text: normalizeHexColor(palette.text),
  }
}

function normalizedStrength(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(1, value))
}

function isMode(value: unknown): value is BrandPersonalizationMode {
  return value === 'original' || value === 'hybrid' || value === 'brand' || value === 'custom'
}

function protectReadableRoles(palette: ReactPalette): ReactPalette {
  const next = { ...palette }
  if (contrastRatio(next.text, next.background) < 4.5) {
    next.text = readableTextColor(next.background)
  }
  if (contrastRatio(next.highlight, next.background) < 2.25) {
    next.highlight = readableTextColor(next.background)
  }
  return next
}

/**
 * Override precedence is intentionally narrow and deterministic:
 * global auto-apply -> preset enabled/mode/strength/palette -> engine rule ->
 * kit default strength and palette. A preset can therefore opt out without
 * changing either the saved preset or another engine's personalization.
 */
function resolveRule(
  brandKit: Readonly<BrandKit>,
  engineRule: Readonly<BrandKitEngineRule> | null | undefined,
  presetRule: Readonly<BrandKitPresetRule> | null | undefined,
): { mode: BrandPersonalizationMode; strength: number; customPalette: ReactPalette | null } | null {
  if (presetRule?.enabled === false) return { mode: 'original', strength: 0, customPalette: null }

  const rawMode = presetRule?.mode ?? engineRule?.mode ?? 'hybrid'
  if (!isMode(rawMode)) return null

  const strength = normalizedStrength(
    presetRule?.strength ?? engineRule?.strength,
    typeof brandKit.defaultStrength === 'number' && Number.isFinite(brandKit.defaultStrength)
      ? Math.max(0, Math.min(1, brandKit.defaultStrength))
      : 0.75,
  )
  if (strength === null) return null

  const customCandidate = presetRule?.palette ?? engineRule?.customPalette ?? null
  if (rawMode === 'custom' && !isPalette(customCandidate)) return null

  return {
    mode: rawMode,
    strength,
    customPalette: isPalette(customCandidate) ? normalizePalette(customCandidate) : null,
  }
}

function directPalette(base: ReactPalette, target: ReactPalette, strength: number): ReactPalette {
  if (strength >= 1) return protectReadableRoles(normalizePalette({ ...target }))
  const mixed = {} as ReactPalette
  for (const key of PALETTE_KEYS) mixed[key] = mixHex(base[key], target[key], strength)
  return protectReadableRoles(normalizePalette(mixed))
}

function hybridPalette(base: ReactPalette, brand: ReactPalette, strength: number): ReactPalette {
  // Role-specific blend weights keep the visual grammar of the original preset.
  // A restrained dark preset stays restrained, while vivid presets retain their
  // contrast and temperature instead of collapsing into one six-color template.
  const roleWeights: Record<keyof ReactPalette, number> = {
    primary: 0.82,
    secondary: 0.68,
    accent: 0.76,
    background: 0.42,
    highlight: 0.55,
    text: 0.38,
  }
  const mixed = {} as ReactPalette
  for (const key of PALETTE_KEYS) {
    mixed[key] = mixHex(base[key], brand[key], strength * roleWeights[key])
  }
  return protectReadableRoles(normalizePalette(mixed))
}

/**
 * Pure deterministic palette resolution. Inputs are never mutated.
 */
export function resolveEffectivePalette(input: EffectivePaletteInput): ReactPalette {
  const original = clonePalette(input.basePalette)
  if (!PALETTE_NATIVE_REACT_ENGINES.has(input.engineId)) return original
  const kit = input.brandKit
  if (!kit || kit.autoApply === false || !isPalette(kit.palette)) return original

  const presetRule = input.presetRule ?? kit.presetRules?.[input.presetId]
  const engineRule = input.engineRule ?? kit.engineRules?.[input.engineId]
  const rule = resolveRule(kit, engineRule, presetRule)
  if (!rule || rule.mode === 'original' || rule.strength === 0) return original

  const normalizedOriginal = normalizePalette(original)
  const brand = normalizePalette(kit.palette)
  if (rule.mode === 'brand') return directPalette(normalizedOriginal, brand, rule.strength)
  if (rule.mode === 'custom') return directPalette(normalizedOriginal, rule.customPalette ?? normalizedOriginal, rule.strength)
  return hybridPalette(normalizedOriginal, brand, rule.strength)
}

export function resolveEffectiveReactPreset(
  preset: Readonly<ReactPreset>,
  brandKit: Readonly<BrandKit> | null | undefined,
): ReactPreset {
  const palette = resolveEffectivePalette({
    basePalette: preset.palette,
    brandKit,
    engineId: preset.engine,
    presetId: preset.id,
  })
  return { ...preset, palette }
}

export function resolveEffectiveReactPresets(
  presets: readonly ReactPreset[],
  brandKit: Readonly<BrandKit> | null | undefined,
): ReactPreset[] {
  return presets.map(preset => resolveEffectiveReactPreset(preset, brandKit))
}
