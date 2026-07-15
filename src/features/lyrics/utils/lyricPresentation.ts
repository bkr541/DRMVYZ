import type { LyricAnimation, LyricEffects, LyricStyle } from '../../../types/lyrics'

export type LyricAnimationPreset = 'inherit' | 'none' | 'fade' | 'fade-up' | 'pop' | 'typewriter' | 'glitch'
export type LyricEffectPreset = 'inherit' | 'none' | 'soft-glow' | 'beat-punch' | 'glitch' | 'bass-reactive'
export type LyricAnchorPreset = 'custom' | 'top' | 'center' | 'lower-third' | 'bottom'

const ANIMATION_PRESETS: Record<Exclude<LyricAnimationPreset, 'inherit'>, Partial<LyricAnimation>> = {
  none: { in: 'none', out: 'none' },
  fade: { in: 'fade', out: 'fade', inMs: 250, outMs: 250, easing: 'easeInOut' },
  'fade-up': { in: 'fadeUp', out: 'fade', inMs: 300, outMs: 250, easing: 'easeOutCubic', direction: 'up' },
  pop: { in: 'scalePop', out: 'fade', inMs: 240, outMs: 220, easing: 'easeOutCubic', intensity: 0.8 },
  typewriter: { in: 'typewriter', out: 'fade', inMs: 500, outMs: 200, easing: 'linear' },
  glitch: { in: 'glitch', out: 'glitchOut', inMs: 180, outMs: 180, easing: 'linear', intensity: 0.7 },
}

const EFFECT_PRESETS: Record<Exclude<LyricEffectPreset, 'inherit'>, Partial<LyricEffects>> = {
  none: { glow: 0, glitch: 0, rgbSplit: 0, blur: 0, shake: 0, bassScale: 0, beatPunch: 0, opacityPulse: 0, bloom: 0 },
  'soft-glow': { glow: 0.45, bloom: 0.25, glitch: 0, rgbSplit: 0, beatPunch: 0 },
  'beat-punch': { beatPunch: 0.65, glow: 0.2, bassScale: 0.15, glitch: 0 },
  glitch: { glitch: 0.55, rgbSplit: 0.4, shake: 0.18, glow: 0.1 },
  'bass-reactive': { bassScale: 0.5, beatPunch: 0.3, glow: 0.25, opacityPulse: 0.12 },
}

const ANCHORS: Record<Exclude<LyricAnchorPreset, 'custom'>, Pick<LyricStyle, 'x' | 'y' | 'align'>> = {
  top: { x: 0.5, y: 0.15, align: 'center' },
  center: { x: 0.5, y: 0.5, align: 'center' },
  'lower-third': { x: 0.5, y: 0.78, align: 'center' },
  bottom: { x: 0.5, y: 0.9, align: 'center' },
}

export function animationPresetPatch(preset: LyricAnimationPreset): Partial<LyricAnimation> | null {
  return preset === 'inherit' ? null : { ...ANIMATION_PRESETS[preset] }
}

export function effectPresetPatch(preset: LyricEffectPreset): Partial<LyricEffects> | null {
  return preset === 'inherit' ? null : { ...EFFECT_PRESETS[preset] }
}

export function anchorPresetPatch(preset: LyricAnchorPreset): Partial<LyricStyle> | null {
  return preset === 'custom' ? null : { ...ANCHORS[preset] }
}

export function mergeLyricPresentation<T extends object>(
  defaults: Partial<T> | null | undefined,
  overrides: Partial<T> | null | undefined,
): Partial<T> {
  return { ...(defaults ?? {}), ...(overrides ?? {}) }
}

export function clampPresentationNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
