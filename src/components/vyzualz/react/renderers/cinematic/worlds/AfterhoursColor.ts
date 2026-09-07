import type { AfterhoursColorMode } from '../../../CinematicWorldSettings'

/**
 * Afterhours Stage 3 — deterministic laser colour resolution.
 *
 * Pure, allocation-light, and shared by the renderer and focused tests. Manual
 * mode renders the persisted Primary/Accent hues; Auto mode derives an active
 * pair from a stable app-native palette source (the Cinema preset palette) and
 * never writes back to the persisted manual fields, so Manual -> Auto -> Manual
 * restores the user's colours untouched.
 */

export interface AfterhoursRgb {
  r: number
  g: number
  b: number
}

export const AFTERHOURS_DEFAULT_PRIMARY: AfterhoursRgb = Object.freeze({ r: 116 / 255, g: 245 / 255, b: 1 })
export const AFTERHOURS_DEFAULT_ACCENT: AfterhoursRgb = Object.freeze({ r: 1, g: 1, b: 1 })
export const AFTERHOURS_DEFAULT_BACKGROUND: AfterhoursRgb = Object.freeze({ r: 0, g: 0, b: 0 })

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

/** Accepts `#rgb`, `#rrggbb`, and the same without the leading `#`. */
export function parseAfterhoursHexColor(value: string, fallback: AfterhoursRgb): AfterhoursRgb {
  const normalized = value.trim().replace(/^#/, '')
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return fallback
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16) / 255,
    g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
    b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
  }
}

function rgbToHsl(color: AfterhoursRgb): { h: number; s: number; l: number } {
  const r = clamp01(color.r)
  const g = clamp01(color.g)
  const b = clamp01(color.b)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const delta = max - min
  if (delta <= 0.000001) return { h: 0, s: 0, l }
  const s = delta / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = 60 * (((g - b) / delta) % 6)
  else if (max === g) h = 60 * (((b - r) / delta) + 2)
  else h = 60 * (((r - g) / delta) + 4)
  return { h: (h + 360) % 360, s: clamp01(s), l: clamp01(l) }
}

function hueChannel(p: number, q: number, t: number): number {
  let value = t
  if (value < 0) value += 1
  if (value > 1) value -= 1
  if (value < 1 / 6) return p + (q - p) * 6 * value
  if (value < 1 / 2) return q
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): AfterhoursRgb {
  const hue = (((h % 360) + 360) % 360) / 360
  const sat = clamp01(s)
  const light = clamp01(l)
  if (sat <= 0.000001) return { r: light, g: light, b: light }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q
  return {
    r: hueChannel(p, q, hue + 1 / 3),
    g: hueChannel(p, q, hue),
    b: hueChannel(p, q, hue - 1 / 3),
  }
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

/**
 * Keep Primary and Accent perceptually separable. Only nudges when the two are
 * genuinely near-identical (close hue *and* both saturated), so a user who
 * deliberately picks matching manual colours still gets what they asked for
 * while an Auto palette that happens to be monochrome still reads as two roles.
 */
function ensureDistinct(primary: AfterhoursRgb, accent: AfterhoursRgb): AfterhoursRgb {
  const p = rgbToHsl(primary)
  const a = rgbToHsl(accent)
  const nearHue = hueDistance(p.h, a.h) < 18
  const nearLightness = Math.abs(p.l - a.l) < 0.14
  if ((p.s < 0.12 && a.s < 0.12) || (nearHue && nearLightness)) {
    return hslToRgb(p.h + 150, Math.max(0.45, p.s * 0.9), clamp01(Math.max(0.68, p.l + 0.2)))
  }
  return { r: clamp01(accent.r), g: clamp01(accent.g), b: clamp01(accent.b) }
}

export interface AfterhoursPalette {
  primary: AfterhoursRgb
  accent: AfterhoursRgb
}

export interface AfterhoursColorInput {
  colorMode: AfterhoursColorMode
  primaryColor: string
  accentColor: string
}

/** Stable, deterministic palette context — the Cinema preset palette. */
export interface AfterhoursAutoPaletteSource {
  primary: string
  accent?: string
  secondary?: string
}

/**
 * Resolve the active laser palette for this frame. Deterministic: no
 * `Math.random()`, no per-frame drift. `input` is never mutated.
 */
export function resolveAfterhoursPalette(
  input: AfterhoursColorInput,
  autoSource: AfterhoursAutoPaletteSource | null,
): AfterhoursPalette {
  if (input.colorMode === 'auto' && autoSource) {
    const primary = parseAfterhoursHexColor(autoSource.primary, AFTERHOURS_DEFAULT_PRIMARY)
    const accentRaw = parseAfterhoursHexColor(autoSource.accent ?? autoSource.secondary ?? '', AFTERHOURS_DEFAULT_ACCENT)
    return { primary, accent: ensureDistinct(primary, accentRaw) }
  }
  // Manual (and Auto with no usable palette source): persisted user colours,
  // each falling back independently to the Afterhours default.
  return {
    primary: parseAfterhoursHexColor(input.primaryColor, AFTERHOURS_DEFAULT_PRIMARY),
    accent: parseAfterhoursHexColor(input.accentColor, AFTERHOURS_DEFAULT_ACCENT),
  }
}
