import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'

const toSrgb = (linear: number) => linear <= .0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - .055

/**
 * The authored glow colors of the five glowing elements, as sRGB palette values. The file stores emission as linear factors, so these are encoded,
 * and decoding them again gives the file's own emission back exactly: the defaults are the original look.
 */
export const CHAMBER_PALETTE_DEFAULTS = Object.freeze({
  ringColor: Object.freeze([0, 1, toSrgb(.43265861699999997), 1]) as Cinema2Color,
  tickColor: Object.freeze([0, 1, 1, 1]) as Cinema2Color,
  beaconColor: Object.freeze([0, 1, 1, 1]) as Cinema2Color,
  lampColor: Object.freeze([0, 1, 1, 1]) as Cinema2Color,
  coreColor: Object.freeze([1, 1, 1, 1]) as Cinema2Color,
})
export type ChamberPaletteName = keyof typeof CHAMBER_PALETTE_DEFAULTS
export const CHAMBER_PALETTE_NAMES = Object.freeze(Object.keys(CHAMBER_PALETTE_DEFAULTS) as ChamberPaletteName[])
