export interface ConstellationRgbColor {
  r: number
  g: number
  b: number
}

export interface ConstellationPaletteInput {
  primary: string
  secondary: string
  accent: string
  background: string
}

export interface ConstellationResolvedPalette {
  primary: ConstellationRgbColor
  secondary: ConstellationRgbColor
  accent: ConstellationRgbColor
  background: ConstellationRgbColor
  beamCore: ConstellationRgbColor
  beamAccent: ConstellationRgbColor
  fog: ConstellationRgbColor
}

const FALLBACK_PRIMARY: ConstellationRgbColor = { r: 0.18, g: 0.82, b: 0.92 }
const FALLBACK_SECONDARY: ConstellationRgbColor = { r: 0.48, g: 0.26, b: 0.92 }
const FALLBACK_ACCENT: ConstellationRgbColor = { r: 0.92, g: 0.94, b: 1 }
const FALLBACK_BACKGROUND: ConstellationRgbColor = { r: 0.003, g: 0.008, b: 0.018 }

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function sanitizeColor(color: ConstellationRgbColor): ConstellationRgbColor {
  return { r: clamp01(color.r), g: clamp01(color.g), b: clamp01(color.b) }
}

export function parseConstellationColor(
  value: string,
  fallback: ConstellationRgbColor,
): ConstellationRgbColor {
  const normalized = typeof value === 'string' ? value.trim().replace(/^#/, '') : ''
  const expanded = normalized.length === 3
    ? normalized.split('').map(character => `${character}${character}`).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return sanitizeColor(fallback)
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16) / 255,
    g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
    b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
  }
}

export function mixConstellationColor(
  a: ConstellationRgbColor,
  b: ConstellationRgbColor,
  amount: number,
): ConstellationRgbColor {
  const t = clamp01(amount)
  return sanitizeColor({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  })
}

function brightenPreservingHue(color: ConstellationRgbColor, targetPeak: number): ConstellationRgbColor {
  const peak = Math.max(color.r, color.g, color.b, 0.0001)
  const scale = Math.max(1, clamp01(targetPeak) / peak)
  return sanitizeColor({ r: color.r * scale, g: color.g * scale, b: color.b * scale })
}

function nearBlack(color: ConstellationRgbColor): ConstellationRgbColor {
  const peak = Math.max(color.r, color.g, color.b, 0.0001)
  const scale = Math.min(1, 0.055 / peak)
  return sanitizeColor({
    r: Math.max(0.0015, color.r * scale),
    g: Math.max(0.0015, color.g * scale),
    b: Math.max(0.0025, color.b * scale),
  })
}

export function resolveConstellationPalette(input: ConstellationPaletteInput): ConstellationResolvedPalette {
  const primary = parseConstellationColor(input.primary, FALLBACK_PRIMARY)
  const secondary = parseConstellationColor(input.secondary, FALLBACK_SECONDARY)
  const accent = parseConstellationColor(input.accent, FALLBACK_ACCENT)
  const background = nearBlack(parseConstellationColor(input.background, FALLBACK_BACKGROUND))
  const beamCore = brightenPreservingHue(mixConstellationColor(primary, accent, 0.18), 0.94)
  const beamAccent = brightenPreservingHue(mixConstellationColor(secondary, accent, 0.28), 0.88)
  const fog = nearBlack(mixConstellationColor(background, mixConstellationColor(primary, secondary, 0.5), 0.18))
  return { primary, secondary, accent, background, beamCore, beamAccent, fog }
}

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const

/** CPU counterpart to the shader's ordered transparency threshold. */
export function constellationDitherThreshold(x: number, y: number): number {
  const ix = ((Math.floor(Number.isFinite(x) ? x : 0) % 4) + 4) % 4
  const iy = ((Math.floor(Number.isFinite(y) ? y : 0) % 4) + 4) % 4
  return (BAYER_4X4[iy * 4 + ix] + 0.5) / 16
}

export function constellationDitherKeepsFragment(alpha: number, x: number, y: number): boolean {
  return clamp01(alpha) >= constellationDitherThreshold(x, y)
}
