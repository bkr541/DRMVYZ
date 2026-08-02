import { describe, expect, it } from 'vitest'
import type { BrandKit } from '../../../../../features/personalization/BrandKitTypes'
import {
  PIX_GRID_DECK_FALLBACK_TRANSPARENT_BACKGROUND,
  resolvePixGridDeckTransparentBackground,
} from '../PixGridDeckBrandBackground'

function kit(palette: Partial<BrandKit['palette']>): Pick<BrandKit, 'palette'> {
  return { palette: palette as BrandKit['palette'] }
}

describe('PixGrid Deck transparent background resolution', () => {
  it('uses normalized Brand Kit background before primary', () => {
    expect(resolvePixGridDeckTransparentBackground(kit({ background: ' #0a1b2c ', primary: '#112233' }))).toBe('#0A1B2C')
  })

  it('uses primary when background is malformed', () => {
    expect(resolvePixGridDeckTransparentBackground(kit({ background: 'transparent', primary: '#abc' }))).toBe('#AABBCC')
  })

  it('uses deterministic black for malformed or missing kits', () => {
    expect(resolvePixGridDeckTransparentBackground(kit({ background: 'not-a-color', primary: 'also-not-a-color' }))).toBe(PIX_GRID_DECK_FALLBACK_TRANSPARENT_BACKGROUND)
    expect(resolvePixGridDeckTransparentBackground(null)).toBe('#000000')
  })
})
