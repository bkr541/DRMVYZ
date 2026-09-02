export interface ElectricStormRgbColor {
  r: number
  g: number
  b: number
}

export interface ElectricStormDerivedColors {
  body: ElectricStormRgbColor
  core: ElectricStormRgbColor
  glow: ElectricStormRgbColor
  branch: ElectricStormRgbColor
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function parseElectricStormHexColor(value: string, fallback: ElectricStormRgbColor): ElectricStormRgbColor {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.trim())
  if (!match) return fallback
  return {
    r: Number.parseInt(match[1], 16) / 255,
    g: Number.parseInt(match[2], 16) / 255,
    b: Number.parseInt(match[3], 16) / 255,
  }
}

function rgbToHsl(color: ElectricStormRgbColor): { h: number; s: number; l: number } {
  const max = Math.max(color.r, color.g, color.b)
  const min = Math.min(color.r, color.g, color.b)
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta <= 0.000001) return { h: 0, s: 0, l: lightness }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue: number
  if (max === color.r) hue = 60 * (((color.g - color.b) / delta) % 6)
  else if (max === color.g) hue = 60 * (((color.b - color.r) / delta) + 2)
  else hue = 60 * (((color.r - color.g) / delta) + 4)
  return { h: (hue + 360) % 360, s: clamp01(saturation), l: clamp01(lightness) }
}

function hueToRgb(p: number, q: number, t: number): number {
  let value = t
  if (value < 0) value += 1
  if (value > 1) value -= 1
  if (value < 1 / 6) return p + (q - p) * 6 * value
  if (value < 1 / 2) return q
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): ElectricStormRgbColor {
  const hue = ((h % 360) + 360) % 360 / 360
  const saturation = clamp01(s)
  const lightness = clamp01(l)
  if (saturation <= 0.000001) return { r: lightness, g: lightness, b: lightness }
  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  return {
    r: hueToRgb(p, q, hue + 1 / 3),
    g: hueToRgb(p, q, hue),
    b: hueToRgb(p, q, hue - 1 / 3),
  }
}

function mixColor(a: ElectricStormRgbColor, b: ElectricStormRgbColor, amount: number): ElectricStormRgbColor {
  const t = clamp01(amount)
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

/** Pure Stage 1 color derivation shared by the renderer and focused tests. */
export function deriveElectricStormColors(lightningColor: string): ElectricStormDerivedColors {
  const body = parseElectricStormHexColor(lightningColor, { r: 0.29, g: 0.65, b: 1 })
  const hsl = rgbToHsl(body)
  const saturated = Math.max(0.42, hsl.s)
  const glow = hslToRgb(hsl.h + 24, Math.max(0.48, saturated * 0.86), Math.min(0.78, Math.max(0.48, hsl.l + 0.18)))
  // Split-complementary branches stay distinct without forcing a harsh exact opposite hue.
  const branch = hslToRgb(hsl.h + 150, Math.max(0.5, saturated * 0.92), Math.min(0.72, Math.max(0.42, hsl.l + 0.08)))
  const core = mixColor(body, { r: 1, g: 1, b: 1 }, 0.72)
  return { body, core, glow, branch }
}
