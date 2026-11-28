// Pixel work for the Media Manager's Select & Remove tools (Magic Wand and Lasso). Everything here works on plain RGBA arrays
// so it runs the same in the editor and in tests. A mask holds 0..255 coverage per pixel for the whole image, plus the
// rectangle that contains every covered pixel (so undo only copies that region).

export interface PixelRect { x: number; y: number; width: number; height: number }
export interface CutoutMask { coverage: Uint8Array; bounds: PixelRect }
export type CutoutAction = 'remove' | 'restore'
export interface CutoutPoint { x: number; y: number }

/** Below this alpha a pixel counts as already transparent: the wand does not start on it in Remove. */
const TRANSPARENT_ALPHA = 8

function boundsOf(coverage: Uint8Array, width: number, height: number, hint?: PixelRect): PixelRect | null {
  const x0 = hint ? Math.max(0, hint.x) : 0, y0 = hint ? Math.max(0, hint.y) : 0
  const x1 = hint ? Math.min(width, hint.x + hint.width) : width, y1 = hint ? Math.min(height, hint.y + hint.height) : height
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = y0; y < y1; y += 1) {
    const row = y * width
    for (let x = x0; x < x1; x += 1) {
      if (!coverage[row + x]) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/**
 * Softens a hard selection by one pixel outward: each unselected neighbour of the selection gets the share of its 3×3
 * neighbourhood that is selected. Selected pixels stay fully selected. This takes the anti-aliased fringe between the
 * selected area and its surroundings along with it (no dark halo), as Photoshop's anti-alias option does.
 */
export function softenMaskEdge(mask: CutoutMask, width: number, height: number): CutoutMask {
  const { coverage, bounds } = mask
  const out = coverage.slice()
  const x0 = Math.max(0, bounds.x - 1), y0 = Math.max(0, bounds.y - 1)
  const x1 = Math.min(width - 1, bounds.x + bounds.width), y1 = Math.min(height - 1, bounds.y + bounds.height)
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const index = y * width + x
      if (coverage[index] === 255) continue
      let sum = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          sum += coverage[ny * width + nx]!
        }
      }
      out[index] = Math.max(coverage[index]!, Math.round(sum / 9))
    }
  }
  return { coverage: out, bounds: { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } }
}

/**
 * Magic Wand: the pixels whose colour is within `tolerance` (0..255, per channel, alpha included) of the clicked pixel.
 * Contiguous keeps to the region connected to the click (4-connected); otherwise every matching pixel in the image is taken.
 * Returns null when the click is outside the image, or (with `skipTransparent`) lands on a pixel that is already transparent.
 */
export function magicWandMask(
  pixels: Uint8ClampedArray, width: number, height: number, seedX: number, seedY: number,
  options: { tolerance: number; contiguous?: boolean; skipTransparent?: boolean },
): CutoutMask | null {
  const sx = Math.floor(seedX), sy = Math.floor(seedY)
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null
  const seed = (sy * width + sx) * 4
  const sr = pixels[seed]!, sg = pixels[seed + 1]!, sb = pixels[seed + 2]!, sa = pixels[seed + 3]!
  if (options.skipTransparent && sa < TRANSPARENT_ALPHA) return null
  const tolerance = Math.max(0, Math.min(255, options.tolerance))
  const matches = (index: number) => {
    const p = index * 4, a = pixels[p + 3]!
    if (Math.abs(a - sa) > tolerance) return false
    // Two (nearly) transparent pixels match whatever colour they hold.
    if (a < TRANSPARENT_ALPHA && sa < TRANSPARENT_ALPHA) return true
    return Math.abs(pixels[p]! - sr) <= tolerance && Math.abs(pixels[p + 1]! - sg) <= tolerance && Math.abs(pixels[p + 2]! - sb) <= tolerance
  }
  const coverage = new Uint8Array(width * height)
  let minX = sx, maxX = sx, minY = sy, maxY = sy
  if (options.contiguous === false) {
    for (let index = 0; index < coverage.length; index += 1) if (matches(index)) coverage[index] = 255
    const bounds = boundsOf(coverage, width, height)
    return bounds ? { coverage, bounds } : null
  }
  // Scanline flood fill: fill a whole run on a row, then queue the rows above and below it.
  const stack: number[] = [sx, sy]
  coverage[sy * width + sx] = 255
  while (stack.length) {
    const y = stack.pop()!, x = stack.pop()!
    const row = y * width
    let left = x, right = x
    while (left > 0 && !coverage[row + left - 1] && matches(row + left - 1)) { left -= 1; coverage[row + left] = 255 }
    while (right < width - 1 && !coverage[row + right + 1] && matches(row + right + 1)) { right += 1; coverage[row + right] = 255 }
    if (left < minX) minX = left
    if (right > maxX) maxX = right
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= height) continue
      const nrow = ny * width
      for (let nx = left; nx <= right; nx += 1) {
        const index = nrow + nx
        if (coverage[index] || !matches(index)) continue
        coverage[index] = 255
        stack.push(nx, ny)
      }
    }
  }
  return { coverage, bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } }
}

/** Lasso: the pixels whose centres fall inside the closed outline (even-odd rule). Null for an outline with no area. */
export function polygonMask(points: readonly CutoutPoint[], width: number, height: number): CutoutMask | null {
  if (points.length < 3) return null
  const coverage = new Uint8Array(width * height)
  let top = Infinity, bottom = -Infinity
  for (const point of points) { top = Math.min(top, point.y); bottom = Math.max(bottom, point.y) }
  const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(height - 1, Math.ceil(bottom))
  const crossings: number[] = []
  for (let y = y0; y <= y1; y += 1) {
    const cy = y + 0.5
    crossings.length = 0
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const a = points[i]!, b = points[j]!
      if ((a.y > cy) === (b.y > cy)) continue
      crossings.push(a.x + (cy - a.y) / (b.y - a.y) * (b.x - a.x))
    }
    crossings.sort((p, q) => p - q)
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      // Pixel x is inside when its centre (x + 0.5) lies between the two crossings.
      const from = Math.max(0, Math.ceil(crossings[k]! - 0.5)), to = Math.min(width - 1, Math.floor(crossings[k + 1]! - 0.5))
      if (to >= from) coverage.fill(255, y * width + from, y * width + to + 1)
    }
  }
  const bounds = boundsOf(coverage, width, height, { x: 0, y: y0, width, height: y1 - y0 + 1 })
  return bounds ? { coverage, bounds } : null
}

/**
 * Applies a mask to the working pixels in place. Remove lowers alpha by the coverage. Restore brings back the original
 * pixel by the coverage (colour from the original, since a fully transparent working pixel may have lost its colour).
 * Returns whether any pixel changed.
 */
export function applyCutoutMask(working: Uint8ClampedArray, original: Uint8ClampedArray, width: number, mask: CutoutMask, action: CutoutAction): boolean {
  const { coverage, bounds } = mask
  let changed = false
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const index = y * width + x, m = coverage[index]!
      if (!m) continue
      const p = index * 4, alpha = working[p + 3]!
      if (action === 'remove') {
        const next = Math.round(alpha * (255 - m) / 255)
        if (next !== alpha) { working[p + 3] = next; changed = true }
      } else {
        const target = original[p + 3]!
        const next = Math.round(alpha + (target - alpha) * m / 255)
        if (next !== alpha || working[p] !== original[p] || working[p + 1] !== original[p + 1] || working[p + 2] !== original[p + 2]) {
          working[p] = original[p]!; working[p + 1] = original[p + 1]!; working[p + 2] = original[p + 2]!; working[p + 3] = next
          changed = true
        }
      }
    }
  }
  return changed
}

/** Copies a rectangle of RGBA pixels out (for undo). */
export function copyPixelRegion(pixels: Uint8ClampedArray, width: number, rect: PixelRect): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rect.width * rect.height * 4)
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * width + rect.x) * 4
    out.set(pixels.subarray(start, start + rect.width * 4), row * rect.width * 4)
  }
  return out
}

/** Writes a rectangle copied by copyPixelRegion back. */
export function pastePixelRegion(pixels: Uint8ClampedArray, width: number, rect: PixelRect, region: Uint8ClampedArray): void {
  for (let row = 0; row < rect.height; row += 1) {
    pixels.set(region.subarray(row * rect.width * 4, (row + 1) * rect.width * 4), ((rect.y + row) * width + rect.x) * 4)
  }
}

/** Tolerance as shown (0..100%) to the per-channel distance the wand uses. */
export function toleranceToChannelDistance(percent: number): number {
  return Math.round(Math.max(0, Math.min(100, percent)) / 100 * 255)
}
