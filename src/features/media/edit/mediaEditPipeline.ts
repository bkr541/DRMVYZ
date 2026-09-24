// Pure render parameters derived from a MediaEditState. The WebGL renderer
// uploads exactly these numbers, and the exporters size their output from the
// same geometry, so preview and saved output cannot drift apart.

import {
  MEDIA_EDIT_RANGES,
  normalizeMediaEdit,
  orientationInverse,
  orientationOf,
  orientationSwapsAxes,
  type MediaEditState,
} from './mediaEditModel'

export interface EditGeometryOptions {
  /** Downscale so the longest output edge is at most this many pixels. */
  maxEdge?: number
  /** Round output sides down to even numbers (required by most video encoders). */
  even?: boolean
}

export interface EditGeometry {
  /** Crop rectangle in whole source pixels. */
  cropPx: { x: number; y: number; width: number; height: number }
  outputWidth: number
  outputHeight: number
  /** Inverse orientation, row-major [[a, b], [c, d]]. */
  inverseOrientation: readonly [readonly [number, number], readonly [number, number]]
  /** Normalized crop origin/size in source space. */
  cropOrigin: readonly [number, number]
  cropSize: readonly [number, number]
}

function roundAtLeastOne(value: number): number {
  return Math.max(1, Math.round(value))
}

export function resolveEditGeometry(
  editInput: MediaEditState,
  sourceWidth: number,
  sourceHeight: number,
  options: EditGeometryOptions = {},
): EditGeometry {
  const edit = normalizeMediaEdit(editInput)
  const orientation = orientationOf(edit)
  const cropPx = {
    x: Math.min(sourceWidth - 1, Math.round(edit.crop.x * sourceWidth)),
    y: Math.min(sourceHeight - 1, Math.round(edit.crop.y * sourceHeight)),
    width: roundAtLeastOne(edit.crop.width * sourceWidth),
    height: roundAtLeastOne(edit.crop.height * sourceHeight),
  }
  cropPx.width = Math.min(cropPx.width, sourceWidth - cropPx.x)
  cropPx.height = Math.min(cropPx.height, sourceHeight - cropPx.y)

  const swaps = orientationSwapsAxes(orientation)
  let outputWidth = swaps ? cropPx.height : cropPx.width
  let outputHeight = swaps ? cropPx.width : cropPx.height

  const longest = Math.max(outputWidth, outputHeight)
  if (options.maxEdge && longest > options.maxEdge) {
    const scale = options.maxEdge / longest
    outputWidth = roundAtLeastOne(outputWidth * scale)
    outputHeight = roundAtLeastOne(outputHeight * scale)
  }
  if (options.even) {
    outputWidth = Math.max(2, outputWidth - (outputWidth % 2))
    outputHeight = Math.max(2, outputHeight - (outputHeight % 2))
  }

  return {
    cropPx,
    outputWidth,
    outputHeight,
    inverseOrientation: orientationInverse(orientation),
    cropOrigin: [cropPx.x / sourceWidth, cropPx.y / sourceHeight],
    cropSize: [cropPx.width / sourceWidth, cropPx.height / sourceHeight],
  }
}

// ── Color ────────────────────────────────────────────────────────────────────

export interface ColorTransform {
  /** Row-major 3×3. */
  matrix: number[]
  offset: number[]
}

const LUMA = [0.2126, 0.7152, 0.0722] as const

const IDENTITY_3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

function multiply3(a: number[], b: number[]): number[] {
  const out = new Array<number>(9).fill(0)
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      for (let k = 0; k < 3; k += 1) out[row * 3 + col]! += a[row * 3 + k]! * b[k * 3 + col]!
    }
  }
  return out
}

/** Applies `next` after `first`: x → next(first(x)). */
function chain(first: ColorTransform, next: ColorTransform): ColorTransform {
  const matrix = multiply3(next.matrix, first.matrix)
  const offset = [0, 1, 2].map(row =>
    next.matrix[row * 3]! * first.offset[0]!
    + next.matrix[row * 3 + 1]! * first.offset[1]!
    + next.matrix[row * 3 + 2]! * first.offset[2]!
    + next.offset[row]!)
  return { matrix, offset }
}

function scaleTransform(factor: number, pivot: number): ColorTransform {
  return { matrix: IDENTITY_3.map(value => value * factor), offset: [pivot * (1 - factor), pivot * (1 - factor), pivot * (1 - factor)] }
}

function saturationTransform(factor: number): ColorTransform {
  const matrix = new Array<number>(9)
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      matrix[row * 3 + col] = (1 - factor) * LUMA[col]! + (row === col ? factor : 0)
    }
  }
  return { matrix, offset: [0, 0, 0] }
}

function hueTransform(degrees: number): ColorTransform {
  const angle = (degrees * Math.PI) / 180
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  // The same matrix CSS hue-rotate() and SVG feColorMatrix type="hueRotate" use.
  const matrix = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ]
  return { matrix, offset: [0, 0, 0] }
}

/**
 * brightness → contrast → saturation → hue collapsed into a single affine RGB
 * transform. Neutral sliders give the exact identity, so an unedited image is
 * reproduced bit-for-bit by the color stage.
 */
export function buildColorTransform(edit: Pick<MediaEditState, 'brightness' | 'contrast' | 'saturation' | 'hue'>): ColorTransform {
  const brightness = 1 + edit.brightness / 100
  const contrast = 1 + edit.contrast / 100
  const saturation = 1 + edit.saturation / 100
  let transform: ColorTransform = { matrix: [...IDENTITY_3], offset: [0, 0, 0] }
  transform = chain(transform, scaleTransform(brightness, 0))
  transform = chain(transform, scaleTransform(contrast, 0.5))
  transform = chain(transform, saturationTransform(saturation))
  transform = chain(transform, hueTransform(edit.hue))
  return transform
}

export function isColorNeutral(edit: Pick<MediaEditState, 'brightness' | 'contrast' | 'saturation' | 'hue'>): boolean {
  return edit.brightness === MEDIA_EDIT_RANGES.brightness.neutral
    && edit.contrast === MEDIA_EDIT_RANGES.contrast.neutral
    && edit.saturation === MEDIA_EDIT_RANGES.saturation.neutral
    && edit.hue === MEDIA_EDIT_RANGES.hue.neutral
}

// ── Detail ───────────────────────────────────────────────────────────────────

const SHARPEN_MAX = 0.75

/** Laplacian sharpen strength: 0 (off) … SHARPEN_MAX. */
export function sharpenAmount(sharpness: number): number {
  return Math.min(1, Math.max(0, sharpness / 100)) * SHARPEN_MAX
}

/** Blur sigma in output pixels. Scales with the output so preview and export match. */
export const MAX_BLUR_SIGMA_FRACTION = 0.03

export function blurSigmaPx(blur: number, outputWidth: number, outputHeight: number): number {
  const fraction = Math.min(1, Math.max(0, blur / 100))
  return fraction * MAX_BLUR_SIGMA_FRACTION * Math.max(outputWidth, outputHeight)
}

export function opacityAmount(opacity: number): number {
  return Math.min(1, Math.max(0, opacity / 100))
}
