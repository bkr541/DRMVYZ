import { describe, expect, it } from 'vitest'
import {
  APPEARANCE_FIELD_OWNERSHIP,
  resolveCanonicalAppearanceTheme,
} from '../appearanceCompatibility'

describe('canonical appearance compatibility boundary', () => {
  it('keeps a valid canonical preference authoritative', () => {
    expect(resolveCanonicalAppearanceTheme({
      canonicalTheme: 'cdj',
      legacyWorkspaceTheme: 'light',
    })).toBe('cdj')
  })

  it('translates only exact live legacy IDs when no canonical value exists', () => {
    expect(resolveCanonicalAppearanceTheme({ legacyWorkspaceTheme: 'light' })).toBe('light')
    expect(resolveCanonicalAppearanceTheme({ legacyWorkspaceTheme: 'cyan-green' })).toBe('dark')
  })

  it('documents engine-local presentation fields outside global appearance', () => {
    expect(APPEARANCE_FIELD_OWNERSHIP.compatibilityOnly).toContain('WorkspacePreset.theme')
    expect(APPEARANCE_FIELD_OWNERSHIP.reservedOrEngineLocal).toContain('visualStore.scanlines')
  })
})
