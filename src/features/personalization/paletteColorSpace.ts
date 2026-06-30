export interface OklabColor { l: number; a: number; b: number }
export interface RgbColor { r: number; g: number; b: number }

const HEX_RE = /^#?([0-9a-f]{6})$/i

export function normalizeHexColor(value: unknown, fallback = '#000000'): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  const short = /^#?([0-9a-f]{3})$/i.exec(trimmed)
  if (short) return `#${short[1].split('').map(c => c + c).join('').toUpperCase()}`
  const match = HEX_RE.exec(trimmed)
  return match ? `#${match[1].toUpperCase()}` : fallback
}

export function hexToRgb(hex: string): RgbColor {
  const safe = normalizeHexColor(hex)
  return {
    r: parseInt(safe.slice(1, 3), 16),
    g: parseInt(safe.slice(3, 5), 16),
    b: parseInt(safe.slice(5, 7), 16),
  }
}

export function rgbToHex(rgb: RgbColor): string {
  const byte = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${byte(rgb.r)}${byte(rgb.g)}${byte(rgb.b)}`.toUpperCase()
}

function srgbToLinear(value: number): number {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function linearToSrgb(value: number): number {
  const v = Math.max(0, Math.min(1, value))
  return (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255
}

export function rgbToOklab(rgb: RgbColor): OklabColor {
  const r = srgbToLinear(rgb.r)
  const g = srgbToLinear(rgb.g)
  const b = srgbToLinear(rgb.b)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l3 = Math.cbrt(l); const m3 = Math.cbrt(m); const s3 = Math.cbrt(s)
  return {
    l: 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3,
    a: 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3,
    b: 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3,
  }
}

export function oklabToRgb(color: OklabColor): RgbColor {
  const l3 = color.l + 0.3963377774 * color.a + 0.2158037573 * color.b
  const m3 = color.l - 0.1055613458 * color.a - 0.0638541728 * color.b
  const s3 = color.l - 0.0894841775 * color.a - 1.291485548 * color.b
  const l = l3 ** 3; const m = m3 ** 3; const s = s3 ** 3
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  }
}

export function oklabDistance(a: OklabColor, b: OklabColor): number {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b)
}

export function colorChroma(color: OklabColor): number {
  return Math.hypot(color.a, color.b)
}

export function mixHex(a: string, b: string, amount: number): string {
  const left = rgbToOklab(hexToRgb(a)); const right = rgbToOklab(hexToRgb(b))
  const t = Math.max(0, Math.min(1, amount))
  return rgbToHex(oklabToRgb({ l: left.l + (right.l - left.l) * t, a: left.a + (right.a - left.a) * t, b: left.b + (right.b - left.b) * t }))
}

export function boostHexChroma(hex: string, factor = 1.25, lightnessShift = 0): string {
  const color = rgbToOklab(hexToRgb(hex))
  return rgbToHex(oklabToRgb({
    l: Math.max(0, Math.min(1, color.l + lightnessShift)),
    a: color.a * Math.max(0, factor),
    b: color.b * Math.max(0, factor),
  }))
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a); const l2 = relativeLuminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

export function readableTextColor(background: string): '#000000' | '#FFFFFF' {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#000000') ? '#FFFFFF' : '#000000'
}
