// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import type { BrandKit } from '../BrandKitTypes'
import {
  applyBrandAppAccent,
  BRAND_ACCENT_VARIABLES,
  restoreStandardAppAccent,
} from '../appAccentPersonalization'

function kit(patch: Partial<BrandKit> = {}): BrandKit {
  return {
    id: 'kit-a', userId: 'user-a', name: 'Brand',
    palette: { primary: '#FF3366', secondary: '#22CCAA', accent: '#7755FF', background: '#05070A', highlight: '#FFFFFF', text: '#FFFFFF' },
    extractedPalette: null, extractionMetadata: null, defaultStrength: 0.75,
    engineRules: {}, presetRules: {}, useForAppAccent: true, autoApply: true,
    createdAt: '', updatedAt: '', ...patch,
  }
}

afterEach(() => restoreStandardAppAccent())

describe('application accent personalization', () => {
  it('applies only dedicated decorative Brand Kit variables', () => {
    const root = document.documentElement
    root.style.setProperty('--az-error', '#DE0000')
    root.style.setProperty('--laser-blackout', '#000000')
    applyBrandAppAccent(kit(), root)
    expect(root.getAttribute('data-brand-accent')).toBe('kit-a')
    expect(root.style.getPropertyValue('--drm-brand-accent')).toBe('#FF3366')
    expect(root.style.getPropertyValue('--drm-brand-accent-rgb')).toBe('255,51,102')
    expect(root.style.getPropertyValue('--az-error')).toBe('#DE0000')
    expect(root.style.getPropertyValue('--laser-blackout')).toBe('#000000')
  })

  it('restores standard variables when disabled, signed out, or active kit is removed', () => {
    const root = document.documentElement
    applyBrandAppAccent(kit(), root)
    applyBrandAppAccent(kit({ useForAppAccent: false }), root)
    expect(root.hasAttribute('data-brand-accent')).toBe(false)
    for (const variable of BRAND_ACCENT_VARIABLES) expect(root.style.getPropertyValue(variable)).toBe('')

    applyBrandAppAccent(kit(), root)
    applyBrandAppAccent(null, root)
    expect(root.hasAttribute('data-brand-accent')).toBe(false)
    for (const variable of BRAND_ACCENT_VARIABLES) expect(root.style.getPropertyValue(variable)).toBe('')
  })

  it('does not apply accents while all Brand Kit application is disabled', () => {
    const root = document.documentElement
    applyBrandAppAccent(kit({ autoApply: false }), root)
    expect(root.hasAttribute('data-brand-accent')).toBe(false)
    expect(root.style.getPropertyValue('--drm-brand-accent')).toBe('')
  })
})
