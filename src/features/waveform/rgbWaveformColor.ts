export interface RgbColor {
  r: number  // 0-255
  g: number  // 0-255
  b: number  // 0-255
}

export interface RgbWaveformColorInput {
  low:  number  // 0-1 normalized
  mid:  number  // 0-1 normalized
  high: number  // 0-1 normalized
  rms:  number  // 0-1 normalized
}

const GAMMA          = 0.7
const MIN_BRIGHTNESS = 0.18  // floor so non-silent bins stay visible

export function resolveRgbWaveformColor(input: RgbWaveformColorInput): RgbColor {
  const l = Math.max(0, Math.min(1, input.low))
  const m = Math.max(0, Math.min(1, input.mid))
  const h = Math.max(0, Math.min(1, input.high))
  const r = Math.max(0, Math.min(1, input.rms))

  // Truly silent: return black
  if (l < 1e-5 && m < 1e-5 && h < 1e-5 && r < 1e-5) {
    return { r: 0, g: 0, b: 0 }
  }

  // Gamma correction for perceptual brightness mapping
  let red   = Math.pow(l, GAMMA)
  let green = Math.pow(m, GAMMA)
  let blue  = Math.pow(h, GAMMA)

  // Mild cross-channel bleed: warms lows (red→orange) and cools highs (blue→teal)
  red   = Math.min(1, red   + green * 0.08)
  green = Math.min(1, green + blue  * 0.05)

  // Overall brightness from RMS — loud sections pop, quiet sections stay dim
  const brightness = MIN_BRIGHTNESS + r * (1 - MIN_BRIGHTNESS)

  red   = Math.min(1, red   * brightness)
  green = Math.min(1, green * brightness)
  blue  = Math.min(1, blue  * brightness)

  return {
    r: Math.round(red   * 255),
    g: Math.round(green * 255),
    b: Math.round(blue  * 255),
  }
}
