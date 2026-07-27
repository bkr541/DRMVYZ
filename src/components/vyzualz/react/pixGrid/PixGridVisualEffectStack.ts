/**
 * Post-composite pixel operators for PixGrid.
 *
 * The compositor produces a logical RGBA matrix whose content is authored at
 * low opacity over a black field. That is correct for layer compositing but it
 * leaves the finished frame perceptually flat: measured mean luminance of the
 * authored presets never exceeded 40/255, and frame-to-frame pixel change during
 * a drop sat at 4-5% where 25-60% is required to read as a drop on an LED wall.
 *
 * This module runs *after* layer composition and group effects, on the final
 * logical buffer, so it can raise magnitude without disturbing the authoring
 * model. Operators are pure, deterministic, and allocation-free once a scratch
 * buffer has been created.
 */

export type PixGridVisualEffectKind =
  | 'exposure'
  | 'contrast'
  | 'bloom'
  | 'chromaShift'
  | 'posterize'
  | 'invert'
  | 'strobe'
  | 'scanline'
  | 'shake'

export interface PixGridVisualEffectOp {
  /** Stable identity, used for diagnostics and test assertions. */
  readonly id: string
  readonly kind: PixGridVisualEffectKind
  /** Normalized 0..1 strength. Operators are no-ops at or below zero. */
  readonly amount: number
  readonly axis?: 'x' | 'y'
  readonly seed?: number
  /** Luminance threshold in 0..1, used by `bloom`. */
  readonly threshold?: number
  /** Blur radius in cells, used by `bloom`. */
  readonly radius?: number
}

export interface PixGridVisualEffectScratch {
  buffer: Uint8Array
  secondary: Uint8Array
}

export const MAX_PIX_GRID_VISUAL_EFFECT_OPS = 12

/** Contrast pivot. LED content is mostly dark, so pivoting at mid grey crushes it. */
const CONTRAST_PIVOT = 0.35 * 255

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function createPixGridVisualEffectScratch(): PixGridVisualEffectScratch {
  return { buffer: new Uint8Array(0), secondary: new Uint8Array(0) }
}

function ensureScratch(scratch: PixGridVisualEffectScratch, length: number): PixGridVisualEffectScratch {
  if (scratch.buffer.length !== length) scratch.buffer = new Uint8Array(length)
  if (scratch.secondary.length !== length) scratch.secondary = new Uint8Array(length)
  return scratch
}

function applyExposure(pixels: Uint8Array, amount: number): void {
  const gain = 1 + clamp01(amount) * 3.25
  if (gain <= 1.0001) return
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] === 0) continue
    pixels[offset] = clampByte(pixels[offset] * gain)
    pixels[offset + 1] = clampByte(pixels[offset + 1] * gain)
    pixels[offset + 2] = clampByte(pixels[offset + 2] * gain)
  }
}

function applyContrast(pixels: Uint8Array, amount: number): void {
  const factor = 1 + clamp01(amount) * 1.85
  if (factor <= 1.0001) return
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] === 0) continue
    pixels[offset] = clampByte((pixels[offset] - CONTRAST_PIVOT) * factor + CONTRAST_PIVOT)
    pixels[offset + 1] = clampByte((pixels[offset + 1] - CONTRAST_PIVOT) * factor + CONTRAST_PIVOT)
    pixels[offset + 2] = clampByte((pixels[offset + 2] - CONTRAST_PIVOT) * factor + CONTRAST_PIVOT)
  }
}

function boxBlurAxis(
  source: Uint8Array,
  target: Uint8Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): void {
  const span = radius * 2 + 1
  const major = horizontal ? height : width
  const minor = horizontal ? width : height
  for (let outer = 0; outer < major; outer += 1) {
    for (let inner = 0; inner < minor; inner += 1) {
      let r = 0
      let g = 0
      let b = 0
      for (let step = -radius; step <= radius; step += 1) {
        const sampled = Math.max(0, Math.min(minor - 1, inner + step))
        const x = horizontal ? sampled : outer
        const y = horizontal ? outer : sampled
        const offset = (y * width + x) * 4
        r += source[offset]
        g += source[offset + 1]
        b += source[offset + 2]
      }
      const x = horizontal ? inner : outer
      const y = horizontal ? outer : inner
      const offset = (y * width + x) * 4
      target[offset] = clampByte(r / span)
      target[offset + 1] = clampByte(g / span)
      target[offset + 2] = clampByte(b / span)
      target[offset + 3] = 255
    }
  }
}

function applyBloom(
  pixels: Uint8Array,
  width: number,
  height: number,
  amount: number,
  threshold: number,
  radius: number,
  scratch: PixGridVisualEffectScratch,
): void {
  const strength = clamp01(amount)
  if (strength <= 0.001) return
  const cut = clamp01(threshold) * 255
  const blurRadius = Math.max(1, Math.min(6, Math.round(radius)))
  const { buffer, secondary } = ensureScratch(scratch, pixels.length)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const value = luminance(pixels[offset], pixels[offset + 1], pixels[offset + 2])
    const keep = value > cut ? 1 : 0
    buffer[offset] = pixels[offset] * keep
    buffer[offset + 1] = pixels[offset + 1] * keep
    buffer[offset + 2] = pixels[offset + 2] * keep
    buffer[offset + 3] = 255
  }
  boxBlurAxis(buffer, secondary, width, height, blurRadius, true)
  boxBlurAxis(secondary, buffer, width, height, blurRadius, false)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const r = pixels[offset] + buffer[offset] * strength
    const g = pixels[offset + 1] + buffer[offset + 1] * strength
    const b = pixels[offset + 2] + buffer[offset + 2] * strength
    pixels[offset] = clampByte(r)
    pixels[offset + 1] = clampByte(g)
    pixels[offset + 2] = clampByte(b)
    const added = luminance(buffer[offset], buffer[offset + 1], buffer[offset + 2]) * strength
    if (added > 8) pixels[offset + 3] = Math.max(pixels[offset + 3], clampByte(added))
  }
}

function applyChromaShift(
  pixels: Uint8Array,
  width: number,
  height: number,
  amount: number,
  axis: 'x' | 'y',
  scratch: PixGridVisualEffectScratch,
): void {
  const strength = clamp01(amount)
  if (strength <= 0.001) return
  const extent = axis === 'x' ? width : height
  const shift = Math.max(1, Math.round(strength * extent * 0.09))
  const { buffer } = ensureScratch(scratch, pixels.length)
  buffer.set(pixels)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const redX = axis === 'x' ? (x + shift + width) % width : x
      const redY = axis === 'y' ? (y + shift + height) % height : y
      const blueX = axis === 'x' ? (x - shift + width) % width : x
      const blueY = axis === 'y' ? (y - shift + height) % height : y
      const redOffset = (redY * width + redX) * 4
      const blueOffset = (blueY * width + blueX) * 4
      pixels[offset] = buffer[redOffset]
      pixels[offset + 2] = buffer[blueOffset + 2]
      pixels[offset + 3] = Math.max(buffer[offset + 3], Math.max(buffer[redOffset + 3], buffer[blueOffset + 3]))
    }
  }
}

function applyPosterize(pixels: Uint8Array, amount: number): void {
  const strength = clamp01(amount)
  if (strength <= 0.001) return
  const levels = Math.max(2, Math.round(24 - strength * 21))
  const step = 255 / (levels - 1)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] === 0) continue
    pixels[offset] = clampByte(Math.round(pixels[offset] / step) * step)
    pixels[offset + 1] = clampByte(Math.round(pixels[offset + 1] / step) * step)
    pixels[offset + 2] = clampByte(Math.round(pixels[offset + 2] / step) * step)
  }
}

function applyInvert(pixels: Uint8Array, amount: number): void {
  const strength = clamp01(amount)
  if (strength <= 0.001) return
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] === 0) continue
    pixels[offset] = clampByte(pixels[offset] + (255 - 2 * pixels[offset]) * strength)
    pixels[offset + 1] = clampByte(pixels[offset + 1] + (255 - 2 * pixels[offset + 1]) * strength)
    pixels[offset + 2] = clampByte(pixels[offset + 2] + (255 - 2 * pixels[offset + 2]) * strength)
  }
}

function applyStrobe(pixels: Uint8Array, amount: number): void {
  const strength = clamp01(amount)
  if (strength <= 0.001) return
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] === 0) continue
    pixels[offset] = clampByte(pixels[offset] + (255 - pixels[offset]) * strength)
    pixels[offset + 1] = clampByte(pixels[offset + 1] + (255 - pixels[offset + 1]) * strength)
    pixels[offset + 2] = clampByte(pixels[offset + 2] + (255 - pixels[offset + 2]) * strength)
    pixels[offset + 3] = Math.max(pixels[offset + 3], clampByte(255 * strength))
  }
}

function applyScanline(pixels: Uint8Array, width: number, height: number, amount: number): void {
  const strength = clamp01(amount)
  if (strength <= 0.001) return
  const attenuation = 1 - strength * 0.82
  for (let y = 1; y < height; y += 2) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      pixels[offset] = clampByte(pixels[offset] * attenuation)
      pixels[offset + 1] = clampByte(pixels[offset + 1] * attenuation)
      pixels[offset + 2] = clampByte(pixels[offset + 2] * attenuation)
    }
  }
}

function applyShake(
  pixels: Uint8Array,
  width: number,
  height: number,
  amount: number,
  axis: 'x' | 'y',
  seed: number,
  scratch: PixGridVisualEffectScratch,
): void {
  const strength = clamp01(amount)
  if (strength <= 0.02) return
  const extent = axis === 'x' ? width : height
  const magnitude = Math.max(1, Math.round(strength * extent * 0.14))
  const direction = hash(`shake:${seed}`) % 2 === 0 ? 1 : -1
  const shift = magnitude * direction
  const { buffer } = ensureScratch(scratch, pixels.length)
  buffer.set(pixels)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = axis === 'x' ? (((x + shift) % width) + width) % width : x
      const sourceY = axis === 'y' ? (((y + shift) % height) + height) % height : y
      const target = (y * width + x) * 4
      const source = (sourceY * width + sourceX) * 4
      pixels[target] = buffer[source]
      pixels[target + 1] = buffer[source + 1]
      pixels[target + 2] = buffer[source + 2]
      pixels[target + 3] = buffer[source + 3]
    }
  }
}

/**
 * Applies operators in array order, mutating `pixels` in place.
 * Operators past `MAX_PIX_GRID_VISUAL_EFFECT_OPS` are ignored so a runaway
 * choreography cannot stall a frame.
 */
export function applyPixGridVisualEffectStack(
  pixels: Uint8Array,
  width: number,
  height: number,
  ops: readonly PixGridVisualEffectOp[],
  scratch?: PixGridVisualEffectScratch,
): void {
  if (ops.length === 0 || width <= 0 || height <= 0) return
  const workspace = scratch ?? createPixGridVisualEffectScratch()
  const limit = Math.min(ops.length, MAX_PIX_GRID_VISUAL_EFFECT_OPS)
  for (let index = 0; index < limit; index += 1) {
    const op = ops[index]
    if (!Number.isFinite(op.amount) || op.amount <= 0) continue
    switch (op.kind) {
      case 'exposure':
        applyExposure(pixels, op.amount)
        break
      case 'contrast':
        applyContrast(pixels, op.amount)
        break
      case 'bloom':
        applyBloom(pixels, width, height, op.amount, op.threshold ?? 0.22, op.radius ?? 2, workspace)
        break
      case 'chromaShift':
        applyChromaShift(pixels, width, height, op.amount, op.axis ?? 'x', workspace)
        break
      case 'posterize':
        applyPosterize(pixels, op.amount)
        break
      case 'invert':
        applyInvert(pixels, op.amount)
        break
      case 'strobe':
        applyStrobe(pixels, op.amount)
        break
      case 'scanline':
        applyScanline(pixels, width, height, op.amount)
        break
      case 'shake':
        applyShake(pixels, width, height, op.amount, op.axis ?? 'x', op.seed ?? index, workspace)
        break
    }
  }
}

/** Mean luminance of a logical frame in 0..255. Shared by diagnostics and tests. */
export function measurePixGridMeanLuminance(pixels: Uint8Array): number {
  if (pixels.length === 0) return 0
  let total = 0
  const count = pixels.length / 4
  for (let offset = 0; offset < pixels.length; offset += 4) {
    total += luminance(pixels[offset], pixels[offset + 1], pixels[offset + 2])
  }
  return total / count
}

/**
 * Fraction of cells whose luminance changed by more than `tolerance` between two
 * frames, in 0..1. This is the metric that showed 4-5% during drops.
 */
export function measurePixGridFrameChange(
  previous: Uint8Array,
  current: Uint8Array,
  tolerance = 8,
): number {
  if (previous.length !== current.length || previous.length === 0) return 0
  let changed = 0
  const count = previous.length / 4
  for (let offset = 0; offset < previous.length; offset += 4) {
    const before = luminance(previous[offset], previous[offset + 1], previous[offset + 2])
    const after = luminance(current[offset], current[offset + 1], current[offset + 2])
    if (Math.abs(after - before) > tolerance) changed += 1
  }
  return changed / count
}
