import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'

const toSrgb = (linear: number) => linear <= .0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - .055
const INK = toSrgb(.8464433773127846), INK_BLUE = toSrgb(.812893709811717)

/**
 * The five inks of the scene, as sRGB palette values. The file has two flat unlit materials: a black one (Material.001, the figure's fill, the hatching
 * on the planets and the water's invisible floor) and an off-white one (Material.002, every line). The file stores them as linear factors, so these are
 * encoded and decoding them again gives the file's own colours back exactly: the defaults are the original look.
 *
 * `voidColor` is the black one and is also the picture's background, so the figure and the planets stay cut out of the sky whatever it is set to. The
 * off-white ink is split into four roles so each can be set apart: the figure's outline and eyes, the water's ripples, the planets' bands and rings,
 * and the stars with the three small moons.
 */
export const SPACE_BOI_PALETTE_DEFAULTS = Object.freeze({
  voidColor: Object.freeze([0, 0, 0, 1]) as Cinema2Color,
  figureColor: Object.freeze([INK, INK_BLUE, INK_BLUE, 1]) as Cinema2Color,
  waterColor: Object.freeze([INK, INK_BLUE, INK_BLUE, 1]) as Cinema2Color,
  planetColor: Object.freeze([INK, INK_BLUE, INK_BLUE, 1]) as Cinema2Color,
  starColor: Object.freeze([INK, INK_BLUE, INK_BLUE, 1]) as Cinema2Color,
})
export type SpaceBoiPaletteName = keyof typeof SPACE_BOI_PALETTE_DEFAULTS
export const SPACE_BOI_PALETTE_NAMES = Object.freeze(Object.keys(SPACE_BOI_PALETTE_DEFAULTS) as SpaceBoiPaletteName[])
