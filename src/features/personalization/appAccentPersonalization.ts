import type { BrandKit } from './BrandKitTypes'
import { hexToRgb, readableTextColor } from './paletteColorSpace'

export const BRAND_ACCENT_VARIABLES = [
  '--drm-brand-accent',
  '--drm-brand-accent-rgb',
  '--drm-brand-accent-soft',
  '--drm-brand-accent-text',
] as const

export function restoreStandardAppAccent(root: HTMLElement = document.documentElement): void {
  for (const variable of BRAND_ACCENT_VARIABLES) root.style.removeProperty(variable)
  root.removeAttribute('data-brand-accent')
}

/**
 * Applies only opt-in decorative/selection variables. Core DRMVYZ tokens such as
 * error, warning, record, blackout, safety, clipping, and focus are never changed.
 */
export function applyBrandAppAccent(
  kit: Readonly<BrandKit> | null | undefined,
  root: HTMLElement = document.documentElement,
): void {
  if (!kit?.useForAppAccent || kit.autoApply === false) {
    restoreStandardAppAccent(root)
    return
  }
  const accent = kit.palette.primary
  const { r, g, b } = hexToRgb(accent)
  root.style.setProperty('--drm-brand-accent', accent)
  root.style.setProperty('--drm-brand-accent-rgb', `${r},${g},${b}`)
  root.style.setProperty('--drm-brand-accent-soft', `rgba(${r},${g},${b},0.28)`)
  root.style.setProperty('--drm-brand-accent-text', readableTextColor(accent))
  root.setAttribute('data-brand-accent', kit.id)
}
