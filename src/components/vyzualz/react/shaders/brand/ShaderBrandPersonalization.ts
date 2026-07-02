import type { ReactPalette } from '../../ReactTypes'
import type { BrandKit, BrandPaletteRole, BrandPersonalizationMode } from '../../../../../features/personalization/BrandKitTypes'
import { resolveEffectivePalette } from '../../../../../features/personalization/effectivePalette'
import type { ShaderDefinition, ShaderParamValue, RGBA } from '../registry/shaderRegistryTypes'
import type { ShaderProgram } from '../runtime/ShaderProgram'

const FALLBACK_PALETTE: ReactPalette = {
  primary: '#00E5FF',
  secondary: '#8B5CF6',
  accent: '#FF2BD6',
  background: '#03040A',
  highlight: '#FFFFFF',
  text: '#FFFFFF',
}

const ROLES: readonly BrandPaletteRole[] = [
  'primary', 'secondary', 'accent', 'background', 'highlight', 'text',
]

export interface ShaderBrandPaletteContext {
  basePalette: ReactPalette
  palette: ReactPalette
  enabled: boolean
  strength: number
  mode: BrandPersonalizationMode
}

export function resolveShaderBrandPalette(
  def: ShaderDefinition,
  paramValues: Readonly<Record<string, ShaderParamValue>>,
  brandKit: Readonly<BrandKit> | null | undefined,
): ShaderBrandPaletteContext {
  const basePalette = buildShaderBasePalette(def, paramValues)
  const presetRule = brandKit?.presetRules?.[def.id]
  const engineRule = brandKit?.engineRules?.shaderPads
  const mode = presetRule?.enabled === false
    ? 'original'
    : (presetRule?.mode ?? engineRule?.mode ?? 'hybrid')
  const strength = clamp01(
    presetRule?.strength
      ?? engineRule?.strength
      ?? brandKit?.defaultStrength
      ?? 0,
  )
  const enabled = !!brandKit
    && brandKit.autoApply !== false
    && presetRule?.enabled !== false
    && mode !== 'original'
    && strength > 0

  return {
    basePalette,
    palette: resolveEffectivePalette({
      basePalette,
      brandKit,
      engineId: 'shaderPads',
      presetId: def.id,
      engineRule,
      presetRule,
    }),
    enabled,
    strength: enabled ? strength : 0,
    mode: enabled ? mode : 'original',
  }
}

export function resolveShaderColorParam(
  authored: RGBA,
  brandRole: BrandPaletteRole | undefined,
  context: ShaderBrandPaletteContext,
): RGBA {
  if (!brandRole || !context.enabled) return authored
  const rgb = hexToRgba(context.palette[brandRole])
  // Preserve authored alpha. Brand Kit palettes are intentionally opaque.
  return [rgb[0], rgb[1], rgb[2], authored[3]]
}

export function applyShaderBrandUniforms(
  program: ShaderProgram,
  context: ShaderBrandPaletteContext,
): void {
  for (const role of ROLES) {
    const rgba = hexToRgba(context.palette[role])
    const suffix = role[0].toUpperCase() + role.slice(1)
    program.setVec4(`uBrand${suffix}`, rgba[0], rgba[1], rgba[2], rgba[3])
  }
  // Neutral white remains available for readable snare/drop impact flashes.
  program.setVec4('uBrandImpact', 1, 1, 1, 1)
  program.setFloat('uBrandStrength', context.strength)
  program.setFloat('uBrandEnabled', context.enabled ? 1 : 0)
}

export function shaderBrandPaletteCacheKey(
  definitionOrId: Pick<ShaderDefinition, 'id'> | string,
  brandKit: Readonly<BrandKit> | null | undefined,
): string {
  const sceneId = typeof definitionOrId === 'string' ? definitionOrId : definitionOrId.id
  if (!brandKit) return sceneId
  const presetRule = brandKit.presetRules?.[sceneId]
  const engineRule = brandKit.engineRules?.shaderPads
  return [
    sceneId,
    brandKit.id,
    brandKit.updatedAt,
    brandKit.autoApply ? '1' : '0',
    JSON.stringify(brandKit.palette),
    JSON.stringify(engineRule ?? null),
    JSON.stringify(presetRule ?? null),
  ].join(':')
}

function buildShaderBasePalette(
  def: ShaderDefinition,
  paramValues: Readonly<Record<string, ShaderParamValue>>,
): ReactPalette {
  const palette: ReactPalette = { ...FALLBACK_PALETTE }
  const authoredColors: RGBA[] = []

  for (const param of def.params) {
    if (param.type !== 'color') continue
    const value = paramValues[param.id] ?? def.defaults[param.id] ?? param.default
    const rgba = isRgba(value) ? value : param.default
    authoredColors.push(rgba)
    if (param.brandRole) palette[param.brandRole] = rgbaToHex(rgba)
  }

  if (!def.params.some(param => param.type === 'color' && param.brandRole === 'primary') && authoredColors[0]) {
    palette.primary = rgbaToHex(authoredColors[0])
  }
  if (!def.params.some(param => param.type === 'color' && param.brandRole === 'secondary') && authoredColors[1]) {
    palette.secondary = rgbaToHex(authoredColors[1])
  }
  if (!def.params.some(param => param.type === 'color' && param.brandRole === 'accent') && authoredColors[2]) {
    palette.accent = rgbaToHex(authoredColors[2])
  }

  return palette
}

function isRgba(value: ShaderParamValue | undefined): value is RGBA {
  return Array.isArray(value)
    && value.length === 4
    && value.every(channel => typeof channel === 'number' && Number.isFinite(channel))
}

export function rgbaToHex(value: RGBA): string {
  const channel = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0').toUpperCase()
  return `#${channel(value[0])}${channel(value[1])}${channel(value[2])}`
}

export function hexToRgba(value: string): RGBA {
  const match = /^#?([0-9a-f]{6})$/i.exec(value)
  if (!match) return [1, 1, 1, 1]
  const hex = match[1]
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
    1,
  ]
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}
