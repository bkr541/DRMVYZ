import type { CutbankClock } from './CutbankClock'
import { clamp01, cutbankUnit, lerp } from './CutbankRandom'
import type { CanvasCutbankSettings } from './CutbankSettings'

export type CutbankRgb = readonly [number, number, number]

export function hexToCutbankRgb(hex: string): CutbankRgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [1, 1, 1]
  const n = parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export interface CutbankPalettePlan {
  /** 0 source colour, 1 monochrome, 2 duotone (accent map). */
  modeCode: 0 | 1 | 2
  sourceAmount: number
  /** Multipliers / stops resolved from the 0..1 sliders. */
  saturation: number
  contrast: number
  exposureStops: number
  blackPoint: number
  whitePoint: number
  tint: CutbankRgb
  tintAmount: number
  accent1: CutbankRgb
  accent2: CutbankRgb
  colorize: number
  invert: boolean
  /** Auto palette state (index of the current bar block); 0 for non-auto modes. */
  stateIndex: number
  label: string
}

type AutoVariant = { mode: 0 | 1 | 2; invert: boolean; accent: 1 | 2 | 0; label: string }
const AUTO_VARIANTS: readonly AutoVariant[] = [
  { mode: 1, invert: false, accent: 0, label: 'mono' },
  { mode: 1, invert: true, accent: 0, label: 'mono-inverted' },
  { mode: 0, invert: false, accent: 0, label: 'source' },
  { mode: 2, invert: false, accent: 1, label: 'duotone-1' },
  { mode: 2, invert: false, accent: 2, label: 'duotone-2' },
  { mode: 2, invert: true, accent: 1, label: 'duotone-1-inverted' },
]

/** Colour Change Rate 0 → a new palette state every 16 bars, 1 → every bar. */
export function autoPaletteBars(rate: number): number {
  return Math.max(1, Math.round(lerp(16, 1, clamp01(rate))))
}

export function resolveCutbankPalette(settings: CanvasCutbankSettings, clock: CutbankClock, identitySeed: number): CutbankPalettePlan {
  const bipolar = (settings.saturation - 0.5) * 2
  const contrastBipolar = (settings.contrast - 0.5) * 2
  const base = {
    sourceAmount: clamp01(settings.sourceColorAmount),
    saturation: 1 + bipolar * (bipolar < 0 ? 1 : 1),
    contrast: 1 + contrastBipolar * (contrastBipolar < 0 ? 0.6 : 1.4),
    exposureStops: (settings.exposure - 0.5) * 2 * 1.2,
    blackPoint: clamp01(settings.blackLevel) * 0.35,
    whitePoint: lerp(0.5, 1, clamp01(settings.whiteLevel)),
    tint: hexToCutbankRgb(settings.tintColor),
    tintAmount: clamp01(settings.tintAmount),
    accent1: hexToCutbankRgb(settings.accentColor1),
    accent2: hexToCutbankRgb(settings.accentColor2),
    colorize: clamp01(settings.colorizeAmount),
  }
  switch (settings.paletteMode) {
    case 'source':
      return { ...base, modeCode: 0, colorize: 0, invert: settings.invertColors, stateIndex: 0, label: 'source' }
    case 'monochrome':
      return { ...base, modeCode: 1, colorize: 0, sourceAmount: 0, invert: settings.invertColors, stateIndex: 0, label: 'monochrome' }
    case 'custom':
      return { ...base, modeCode: 2, invert: settings.invertColors, stateIndex: 0, label: 'custom' }
    case 'auto':
    default: {
      // Changes only on bar-block boundaries — never per frame.
      const stateIndex = Math.floor(clock.bar / autoPaletteBars(settings.colorChangeRate))
      const variant = AUTO_VARIANTS[Math.min(AUTO_VARIANTS.length - 1, Math.floor(cutbankUnit('palette', identitySeed, stateIndex) * AUTO_VARIANTS.length))]
      return {
        ...base,
        modeCode: variant.mode,
        sourceAmount: variant.mode === 1 ? 0 : base.sourceAmount,
        colorize: variant.mode === 2 ? base.colorize : 0,
        accent1: variant.accent === 2 ? base.accent2 : base.accent1,
        accent2: variant.accent === 2 ? base.accent1 : base.accent2,
        invert: settings.invertColors !== variant.invert,
        stateIndex,
        label: `auto:${variant.label}`,
      }
    }
  }
}
