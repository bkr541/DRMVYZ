import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'

const toSrgb = (linear: number) => linear <= .0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - .055

/**
 * The glow colors of the glowing elements (the five authored ones, then the added fixtures), as sRGB palette values. The file stores emission as linear factors, so these are encoded,
 * and decoding them again gives the file's own emission back exactly: the defaults are the original look.
 */
export const CHAMBER_PALETTE_DEFAULTS = Object.freeze({
  ringColor: Object.freeze([0, 1, toSrgb(.43265861699999997), 1]) as Cinema2Color,
  tickColor: Object.freeze([0, 1, 1, 1]) as Cinema2Color,
  beaconColor: Object.freeze([0, 1, 1, 1]) as Cinema2Color,
  lampColor: Object.freeze([0, 1, 1, 1]) as Cinema2Color,
  coreColor: Object.freeze([1, 1, 1, 1]) as Cinema2Color,
  // The room's added fixtures, in the chamber's own colours: azure blades, turquoise scan rings (the platform ring's hue), a cool white-cyan shaft (the core lamp's light), and azure wash lights (the window's spill).
  bladeColor: Object.freeze([0, .78, 1, 1]) as Cinema2Color,
  scanColor: Object.freeze([0, 1, toSrgb(.43265861699999997), 1]) as Cinema2Color,
  shaftColor: Object.freeze([.55, .9, 1, 1]) as Cinema2Color,
  washColor: Object.freeze([0, .72, 1, 1]) as Cinema2Color,
})
export type ChamberPaletteName = keyof typeof CHAMBER_PALETTE_DEFAULTS
export const CHAMBER_PALETTE_NAMES = Object.freeze(Object.keys(CHAMBER_PALETTE_DEFAULTS) as ChamberPaletteName[])
