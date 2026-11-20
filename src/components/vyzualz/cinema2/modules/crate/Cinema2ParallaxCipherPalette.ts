import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'

/** The authored colors, as the sRGB values the preset shipped with. The scene tints each of its materials by (chosen color / authored color), so the defaults reproduce the original look exactly. */
export const PARALLAX_CIPHER_PALETTE_DEFAULTS = Object.freeze({
  leftBankColor: Object.freeze([0x61 / 255, 0xe6 / 255, 0xf5 / 255, 1]) as Cinema2Color,
  rightBankColor: Object.freeze([0xf8 / 255, 0x76 / 255, 0xc7 / 255, 1]) as Cinema2Color,
  letterColor: Object.freeze([0xe2 / 255, 0xe7 / 255, 0xf4 / 255, 1]) as Cinema2Color,
  weaveColor: Object.freeze([0x36 / 255, 0x43 / 255, 0x51 / 255, 1]) as Cinema2Color,
  redMarkerColor: Object.freeze([1, 0x3a / 255, 0x46 / 255, 1]) as Cinema2Color,
})
export type ParallaxCipherPaletteName = keyof typeof PARALLAX_CIPHER_PALETTE_DEFAULTS
export const PARALLAX_CIPHER_PALETTE_NAMES = Object.freeze(Object.keys(PARALLAX_CIPHER_PALETTE_DEFAULTS) as ParallaxCipherPaletteName[])
