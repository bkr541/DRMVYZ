import type {
  CinemaBrandColorPolicy,
  CinemaBrandRole,
  CinemaColor,
  CinemaColorParameterDefinition,
  CinemaParameterValue,
} from './CinemaDomain'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'

export interface CinemaBrandKitPaletteSource {
  primary: string
  secondary: string
  accent: string
  background: string
  highlight: string
  text: string
}

export interface CinemaBrandKitSource {
  palette: Readonly<CinemaBrandKitPaletteSource>
}

export interface CinemaBrandBridgeSnapshot {
  available: boolean
  colors: Readonly<Partial<Record<CinemaBrandRole, CinemaColor>>>
  diagnostics: CinemaDiagnosticSnapshot
}

export interface CinemaBrandPolicyResolution {
  value: CinemaParameterValue
  applied: boolean
  protectedExactColor: CinemaColor | null
  diagnostics: readonly CinemaDiagnostic[]
}

/**
 * The one semantic bridge from the canonical DRMVYZ Brand Kit palette into
 * Cinema roles. It returns immutable normalized colors and does not retain the
 * Brand Kit object or duplicate its persisted state.
 */
export function bridgeCinemaBrandKit(
  brandKit: Readonly<CinemaBrandKitSource> | null | undefined,
): CinemaBrandBridgeSnapshot {
  if (!brandKit) {
    return Object.freeze({
      available: false,
      colors: Object.freeze({}),
      diagnostics: createCinemaDiagnosticSnapshot([]),
    })
  }

  const diagnostics: CinemaDiagnostic[] = []
  const palette = brandKit.palette
  const background = parseCinemaHexColor(palette.background, 'background', diagnostics)
  const colors = Object.freeze({
    primary: parseCinemaHexColor(palette.primary, 'primary', diagnostics),
    secondary: parseCinemaHexColor(palette.secondary, 'secondary', diagnostics),
    accent: parseCinemaHexColor(palette.accent, 'accent', diagnostics),
    background,
    foreground: parseCinemaHexColor(palette.text, 'foreground', diagnostics),
    highlight: parseCinemaHexColor(palette.highlight, 'highlight', diagnostics),
    shadow: darkenCinemaColor(background, 0.65),
  }) satisfies Readonly<Record<CinemaBrandRole, CinemaColor>>

  return Object.freeze({
    available: true,
    colors,
    diagnostics: createCinemaDiagnosticSnapshot(diagnostics),
  })
}

export function normalizeCinemaBrandColorPolicy(
  value: unknown,
  fallback: CinemaBrandColorPolicy = 'free',
): CinemaBrandColorPolicy {
  return value === 'exact' || value === 'derived' || value === 'free' ? value : fallback
}

/** Applies the semantic Brand Kit role before master/modulation/performance stages. */
export function applyCinemaBrandColorPolicy(input: {
  schema: Readonly<CinemaColorParameterDefinition>
  currentValue: CinemaParameterValue
  brandColors?: Readonly<Partial<Record<CinemaBrandRole, CinemaColor>>>
}): CinemaBrandPolicyResolution {
  const role = input.schema.brandRole
  const policy = normalizeCinemaBrandColorPolicy(input.schema.brandPolicy, role ? 'derived' : 'free')
  if (!role || policy === 'free') {
    return { value: input.currentValue, applied: false, protectedExactColor: null, diagnostics: [] }
  }

  const brandColor = input.brandColors?.[role]
  if (!brandColor) {
    return {
      value: input.currentValue,
      applied: false,
      protectedExactColor: null,
      diagnostics: [createCinemaDiagnostic({
        code: 'CINEMA_BRAND_ROLE_UNAVAILABLE',
        severity: 'warning',
        message: `Cinema Brand Kit role "${role}" is unavailable; the authored color remains active.`,
        details: { role, policy },
      })],
    }
  }

  const color = cloneCinemaColor(brandColor)
  return {
    value: color,
    applied: true,
    protectedExactColor: policy === 'exact' ? color : null,
    diagnostics: [],
  }
}

/** Reasserts protected exact colors after transient stages without mutating canonical state. */
export function protectCinemaExactBrandColor(
  value: CinemaParameterValue,
  protectedExactColor: CinemaColor | null,
): CinemaParameterValue {
  return protectedExactColor ? cloneCinemaColor(protectedExactColor) : value
}

export function parseCinemaHexColor(
  value: string,
  role?: CinemaBrandRole,
  diagnostics: CinemaDiagnostic[] = [],
): CinemaColor {
  const normalized = typeof value === 'string' ? value.trim().replace(/^#/, '') : ''
  const expanded = normalized.length === 3
    ? normalized.split('').map(character => character + character).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_BRAND_POLICY_INVALID',
      severity: 'warning',
      message: `Cinema received an invalid Brand Kit color${role ? ` for ${role}` : ''}; transparent black was used.`,
      ...(role ? { details: { role, value: String(value) } } : { details: { value: String(value) } }),
    }))
    return Object.freeze([0, 0, 0, 0]) as CinemaColor
  }
  return Object.freeze([
    Number.parseInt(expanded.slice(0, 2), 16) / 255,
    Number.parseInt(expanded.slice(2, 4), 16) / 255,
    Number.parseInt(expanded.slice(4, 6), 16) / 255,
    1,
  ]) as CinemaColor
}

function darkenCinemaColor(color: CinemaColor, amount: number): CinemaColor {
  const scale = Math.min(1, Math.max(0, 1 - amount))
  return Object.freeze([
    color[0] * scale,
    color[1] * scale,
    color[2] * scale,
    color[3],
  ]) as CinemaColor
}

function cloneCinemaColor(color: CinemaColor): CinemaColor {
  return Object.freeze([color[0], color[1], color[2], color[3]]) as CinemaColor
}
