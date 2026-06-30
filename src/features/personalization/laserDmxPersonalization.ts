import type {
  LaserDmxFixture,
  LaserDmxMatrixBeam,
  LaserDmxReactionGroup,
} from '../../components/vyzualz/react/ReactTypes'
import type {
  BrandKit,
  BrandPalette,
  BrandPaletteRole,
  BrandPersonalizationMode,
  LaserDmxSemanticSource,
} from './BrandKitTypes'
import { hexToRgb, mixHex, rgbToHex } from './paletteColorSpace'

export interface LaserDmxPersonalizationContext {
  kitId: string
  kitName: string
  mode: 'hybrid' | 'brand' | 'custom'
  strength: number
  palette: BrandPalette
  preserveTriggerSemantics: boolean
  semanticRoleMapping: Record<LaserDmxSemanticSource, BrandPaletteRole>
  paletteFingerprint: string
}

export interface RgbwColor {
  red: number
  green: number
  blue: number
  white: number
  alpha: number
}

const DEFAULT_ROLE_MAPPING: Record<LaserDmxSemanticSource, BrandPaletteRole> = {
  bass: 'primary',
  snare: 'secondary',
  beat: 'accent',
  other: 'highlight',
  white: 'highlight',
}

const SEMANTIC_TERMS: ReadonlyArray<[LaserDmxSemanticSource, RegExp]> = [
  ['bass', /(?:^|[^a-z])(bass|sub|kick|low)(?:[^a-z]|$)/i],
  ['snare', /(?:^|[^a-z])(snare|clap|mid)(?:[^a-z]|$)/i],
  ['beat', /(?:^|[^a-z])(beat|pulse|downbeat|rhythm|tempo)(?:[^a-z]|$)/i],
  ['white', /(?:^|[^a-z])(white|flash|strobe|impact)(?:[^a-z]|$)/i],
  ['other', /(?:^|[^a-z])(fill|other|high|air|accent)(?:[^a-z]|$)/i],
]

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(Number.isFinite(value) ? value : 0)))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function semanticFromText(values: readonly string[]): LaserDmxSemanticSource | null {
  const text = values.filter(Boolean).join(' ')
  for (const [source, pattern] of SEMANTIC_TERMS) {
    if (pattern.test(text)) return source
  }
  return null
}

function deterministicSemantic(id: string): LaserDmxSemanticSource {
  const roles: LaserDmxSemanticSource[] = ['bass', 'snare', 'beat', 'other']
  return roles[stableHash(id) % roles.length]
}

function isLaserMode(mode: BrandPersonalizationMode): mode is LaserDmxPersonalizationContext['mode'] {
  return mode === 'hybrid' || mode === 'brand' || mode === 'custom'
}

/**
 * LaserDMX follows the same non-mutating precedence as palette-native engines:
 * global kit disable -> preset opt-out/override -> engine rule -> kit defaults.
 * Returning null is the explicit Original path and preserves compiler inputs.
 */
export function resolveLaserDmxPersonalization(
  kit: Readonly<BrandKit> | null | undefined,
  presetId?: string | null,
): LaserDmxPersonalizationContext | null {
  if (!kit || kit.autoApply === false) return null
  const engineRule = kit.engineRules.laserDmx
  const presetRule = presetId ? kit.presetRules[presetId] : undefined
  if (presetRule?.enabled === false) return null

  const mode = presetRule?.mode ?? engineRule?.mode ?? 'hybrid'
  const strength = Math.max(0, Math.min(1, presetRule?.strength ?? engineRule?.strength ?? kit.defaultStrength))
  if (!isLaserMode(mode) || strength <= 0) return null

  const customPalette = presetRule?.palette ?? engineRule?.customPalette
  if (mode === 'custom' && !customPalette) return null
  const palette = mode === 'custom' ? customPalette! : kit.palette
  const semanticRoleMapping = { ...DEFAULT_ROLE_MAPPING, ...(engineRule?.semanticRoleMapping ?? {}) }
  return {
    kitId: kit.id,
    kitName: kit.name,
    mode,
    strength,
    palette,
    preserveTriggerSemantics: engineRule?.preserveTriggerSemantics !== false,
    semanticRoleMapping,
    paletteFingerprint: [
      kit.id,
      presetId ?? '',
      mode,
      strength.toFixed(3),
      ...Object.values(palette),
      ...Object.values(semanticRoleMapping),
    ].join('|'),
  }
}

export function inferSpatialFixtureSemantic(fixture: Readonly<LaserDmxFixture>): LaserDmxSemanticSource {
  const fromRoutes = semanticFromText(fixture.modulationRoutes.map(route => `${route.source} ${route.target}`))
  return fromRoutes ?? semanticFromText([fixture.name, fixture.path.kind, fixture.color.paletteId]) ?? deterministicSemantic(fixture.id)
}

export function inferBeamSemantic(
  beam: Readonly<LaserDmxMatrixBeam>,
  group: Readonly<LaserDmxReactionGroup> | null,
): LaserDmxSemanticSource {
  if (group?.launch.trigger === 'kick') return 'bass'
  if (group?.launch.trigger === 'snare') return 'snare'
  if (group?.launch.trigger === 'beat' || group?.launch.trigger === 'downbeat') return 'beat'
  if (group?.launch.trigger === 'dropImpact') return 'white'
  const routeText = [
    ...(group?.modulationRoutes ?? []),
    ...beam.modulationRoutes,
  ].map(route => `${route.source} ${route.target}`)
  return semanticFromText(routeText)
    ?? semanticFromText([group?.name ?? '', beam.name])
    ?? deterministicSemantic(group?.id ?? beam.id)
}

export function personalizeRgbw(
  color: Readonly<RgbwColor>,
  semantic: LaserDmxSemanticSource,
  context: Readonly<LaserDmxPersonalizationContext> | null | undefined,
): RgbwColor {
  const original: RgbwColor = {
    red: clampByte(color.red),
    green: clampByte(color.green),
    blue: clampByte(color.blue),
    white: clampByte(color.white),
    alpha: clamp01(color.alpha),
  }
  if (!context) return original

  const source = context.preserveTriggerSemantics ? semantic : 'bass'
  const role = context.semanticRoleMapping[source]
  const targetHex = context.palette[role]
  const originalHex = rgbToHex({ r: original.red, g: original.green, b: original.blue })
  const amount = context.mode === 'hybrid' ? context.strength * 0.72 : context.strength
  const mixed = hexToRgb(mixHex(originalHex, targetHex, amount))
  return {
    red: clampByte(mixed.r),
    green: clampByte(mixed.g),
    blue: clampByte(mixed.b),
    white: original.white,
    alpha: original.alpha,
  }
}
