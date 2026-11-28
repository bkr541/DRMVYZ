import { describe, expect, it } from 'vitest'
import { applyCutoutMask, copyPixelRegion, magicWandMask, pastePixelRegion, polygonMask, softenMaskEdge } from './cutoutPixels'

/** A width × height opaque image filled with `fill`, with `paint` applied per pixel. */
function image(width: number, height: number, fill: [number, number, number, number], paint?: (x: number, y: number) => [number, number, number, number] | null) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) pixels.set(paint?.(x, y) ?? fill, (y * width + x) * 4)
  return pixels
}
const alphaAt = (pixels: Uint8ClampedArray, width: number, x: number, y: number) => pixels[(y * width + x) * 4 + 3]

// A silver 9×9 square with a black 3×3 hole in the middle (like the counter of a D), and a separate black dot at (0,0).
const W = 9
const letter = () => image(W, W, [200, 200, 200, 255], (x, y) => (x >= 3 && x <= 5 && y >= 3 && y <= 5) || (x === 0 && y === 0) ? [10, 10, 10, 255] : null)

describe('magic wand', () => {
  it('selects only the clicked enclosed region when contiguous', () => {
    const mask = magicWandMask(letter(), W, W, 4, 4, { tolerance: 20 })!
    expect(mask.bounds).toEqual({ x: 3, y: 3, width: 3, height: 3 })
    expect(mask.coverage.reduce((sum, value) => sum + (value ? 1 : 0), 0)).toBe(9)
    expect(mask.coverage[0]).toBe(0)
  })

  it('selects every matching pixel when not contiguous', () => {
    const mask = magicWandMask(letter(), W, W, 4, 4, { tolerance: 20, contiguous: false })!
    expect(mask.coverage[0]).toBe(255)
    expect(mask.bounds).toEqual({ x: 0, y: 0, width: 6, height: 6 })
  })

  it('grows with tolerance and ignores clicks outside or on transparent pixels', () => {
    const pixels = letter()
    expect(magicWandMask(pixels, W, W, 4, 4, { tolerance: 255 })!.bounds).toEqual({ x: 0, y: 0, width: W, height: W })
    expect(magicWandMask(pixels, W, W, -1, 4, { tolerance: 20 })).toBeNull()
    pixels[(4 * W + 4) * 4 + 3] = 0
    expect(magicWandMask(pixels, W, W, 4, 4, { tolerance: 20, skipTransparent: true })).toBeNull()
  })
})

describe('lasso', () => {
  it('fills the pixels whose centres are inside the outline', () => {
    const mask = polygonMask([{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 6 }, { x: 2, y: 6 }], W, W)!
    expect(mask.bounds).toEqual({ x: 2, y: 2, width: 4, height: 4 })
    expect(mask.coverage.reduce((sum, value) => sum + (value ? 1 : 0), 0)).toBe(16)
  })

  it('returns null for an outline without area', () => {
    expect(polygonMask([{ x: 1, y: 1 }, { x: 5, y: 1 }], W, W)).toBeNull()
    expect(polygonMask([{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 3, y: 1 }], W, W)).toBeNull()
  })
})

describe('applying a mask', () => {
  it('removes, softens one pixel outward, and restores the original colour and alpha', () => {
    const original = letter()
    const working = original.slice()
    const mask = softenMaskEdge(magicWandMask(working, W, W, 4, 4, { tolerance: 20 })!, W, W)
    expect(mask.bounds).toEqual({ x: 2, y: 2, width: 5, height: 5 })
    expect(applyCutoutMask(working, original, W, mask, 'remove')).toBe(true)
    expect(alphaAt(working, W, 4, 4)).toBe(0)
    // An edge neighbour is partly removed (3 of its 9 neighbours were selected), a far pixel not at all.
    expect(alphaAt(working, W, 2, 4)).toBe(Math.round(255 * (255 - 85) / 255))
    expect(alphaAt(working, W, 0, 8)).toBe(255)

    // A transparent pixel whose colour was lost comes back with the original colour.
    working.set([0, 0, 0, 0], (4 * W + 4) * 4)
    expect(applyCutoutMask(working, original, W, mask, 'restore')).toBe(true)
    expect(Array.from(working.subarray((4 * W + 4) * 4, (4 * W + 4) * 4 + 4))).toEqual([10, 10, 10, 255])
    // A soft edge comes back part of the way (Undo is the exact inverse); a hard restore brings back everything.
    expect(alphaAt(working, W, 2, 4)).toBeGreaterThan(170)
    const hard = magicWandMask(original, W, W, 4, 4, { tolerance: 255 })!
    expect(applyCutoutMask(working, original, W, hard, 'restore')).toBe(true)
    expect(Array.from(working)).toEqual(Array.from(original))
    expect(applyCutoutMask(working, original, W, hard, 'restore')).toBe(false)
  })

  it('copies and pastes a region for undo', () => {
    const pixels = letter()
    const rect = { x: 3, y: 3, width: 3, height: 3 }
    const before = copyPixelRegion(pixels, W, rect)
    const original = pixels.slice()
    applyCutoutMask(pixels, original, W, magicWandMask(pixels, W, W, 4, 4, { tolerance: 20 })!, 'remove')
    pastePixelRegion(pixels, W, rect, before)
    expect(Array.from(pixels)).toEqual(Array.from(original))
  })
})
