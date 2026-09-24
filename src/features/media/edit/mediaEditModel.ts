// Shared Media Manager edit definition for images AND videos.
//
// One normalized MediaEditState describes every visual edit. The live preview,
// the still-image exporter and the video exporter all interpret this same
// object through the same renderer, so what the user sees while editing is what
// Save writes. Nothing here touches the DOM, so it is fully unit-testable.
//
// Pipeline order (fixed, documented once here):
//   1. crop            — a rectangle of the *source* frame (normalized 0..1)
//   2. orientation     — rotate, then vertical flip, then horizontal mirror
//   3. sharpness       — 3×3 Laplacian sharpen at output resolution
//   4. color           — brightness → contrast → saturation → hue (one matrix)
//   5. blur            — Gaussian, sigma relative to the output size
//   6. opacity         — final alpha multiply

export interface MediaEditCrop {
  /** Left edge, normalized to the source width (0..1). */
  x: number
  /** Top edge, normalized to the source height (0..1). */
  y: number
  width: number
  height: number
}

/** Clockwise quarter turns applied to the cropped frame, before flip/mirror. */
export type MediaEditRotation = 0 | 90 | 180 | 270

export interface MediaEditState {
  crop: MediaEditCrop
  rotation: MediaEditRotation
  /** Vertical flip (top ↔ bottom). */
  flip: boolean
  /** Horizontal reflection (left ↔ right). */
  mirror: boolean
  brightness: number
  contrast: number
  saturation: number
  hue: number
  opacity: number
  sharpness: number
  blur: number
}

export type MediaEditSliderKey =
  | 'brightness' | 'contrast' | 'saturation' | 'hue' | 'opacity' | 'sharpness' | 'blur'

export interface MediaEditRange {
  min: number
  max: number
  step: number
  /** The value that leaves the source untouched. */
  neutral: number
}

export const MEDIA_EDIT_RANGES: Readonly<Record<MediaEditSliderKey, MediaEditRange>> = {
  brightness: { min: -100, max: 100, step: 1, neutral: 0 },
  contrast: { min: -100, max: 100, step: 1, neutral: 0 },
  saturation: { min: -100, max: 100, step: 1, neutral: 0 },
  hue: { min: -180, max: 180, step: 1, neutral: 0 },
  opacity: { min: 0, max: 100, step: 1, neutral: 100 },
  sharpness: { min: 0, max: 100, step: 1, neutral: 0 },
  blur: { min: 0, max: 100, step: 1, neutral: 0 },
}

/** Smallest crop side, as a fraction of the source, so a crop can never collapse. */
export const MIN_CROP_FRACTION = 0.02
const EPSILON = 1e-6

export const FULL_CROP: Readonly<MediaEditCrop> = Object.freeze({ x: 0, y: 0, width: 1, height: 1 })

export function createDefaultMediaEdit(): MediaEditState {
  return {
    crop: { ...FULL_CROP },
    rotation: 0,
    flip: false,
    mirror: false,
    brightness: MEDIA_EDIT_RANGES.brightness.neutral,
    contrast: MEDIA_EDIT_RANGES.contrast.neutral,
    saturation: MEDIA_EDIT_RANGES.saturation.neutral,
    hue: MEDIA_EDIT_RANGES.hue.neutral,
    opacity: MEDIA_EDIT_RANGES.opacity.neutral,
    sharpness: MEDIA_EDIT_RANGES.sharpness.neutral,
    blur: MEDIA_EDIT_RANGES.blur.neutral,
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

export function normalizeCrop(crop: MediaEditCrop): MediaEditCrop {
  const width = clamp(crop.width, MIN_CROP_FRACTION, 1)
  const height = clamp(crop.height, MIN_CROP_FRACTION, 1)
  const x = clamp(crop.x, 0, 1 - width)
  const y = clamp(crop.y, 0, 1 - height)
  return { x: roundTo(x, 6), y: roundTo(y, 6), width: roundTo(width, 6), height: roundTo(height, 6) }
}

export function normalizeRotation(value: number): MediaEditRotation {
  const turns = ((Math.round(value / 90) % 4) + 4) % 4
  return (turns * 90) as MediaEditRotation
}

/** Clamps every value into its safe range. Always returns a fresh object. */
export function normalizeMediaEdit(edit: MediaEditState): MediaEditState {
  const next: MediaEditState = {
    crop: normalizeCrop(edit.crop),
    rotation: normalizeRotation(edit.rotation),
    flip: edit.flip === true,
    mirror: edit.mirror === true,
    brightness: 0, contrast: 0, saturation: 0, hue: 0, opacity: 100, sharpness: 0, blur: 0,
  }
  for (const key of Object.keys(MEDIA_EDIT_RANGES) as MediaEditSliderKey[]) {
    const range = MEDIA_EDIT_RANGES[key]
    next[key] = clamp(edit[key], range.min, range.max)
  }
  return next
}

// ── Orientation ──────────────────────────────────────────────────────────────

/** Row-major 2×2 integer matrix acting on centred, y-down coordinates. */
export type Orientation = readonly [readonly [number, number], readonly [number, number]]

function multiply(a: Orientation, b: Orientation): Orientation {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ]
}

const IDENTITY: Orientation = [[1, 0], [0, 1]]
/** One clockwise quarter turn in y-down coordinates: (x, y) → (−y, x). */
const ROTATE_CW: Orientation = [[0, -1], [1, 0]]
const FLIP_VERTICAL: Orientation = [[1, 0], [0, -1]]
const MIRROR_HORIZONTAL: Orientation = [[-1, 0], [0, 1]]

/** The single transform (rotate → flip → mirror) the renderer applies to the cropped frame. */
export function orientationOf(edit: Pick<MediaEditState, 'rotation' | 'flip' | 'mirror'>): Orientation {
  let matrix: Orientation = IDENTITY
  for (let turn = 0; turn < edit.rotation / 90; turn += 1) matrix = multiply(ROTATE_CW, matrix)
  if (edit.flip) matrix = multiply(FLIP_VERTICAL, matrix)
  if (edit.mirror) matrix = multiply(MIRROR_HORIZONTAL, matrix)
  return matrix
}

export function orientationInverse(matrix: Orientation): Orientation {
  // Orientations are signed permutation matrices, so the inverse is the transpose.
  return [[matrix[0][0], matrix[1][0]], [matrix[0][1], matrix[1][1]]]
}

export function orientationSwapsAxes(matrix: Orientation): boolean {
  return matrix[0][0] === 0
}

export function isOrientationIdentity(edit: Pick<MediaEditState, 'rotation' | 'flip' | 'mirror'>): boolean {
  const matrix = orientationOf(edit)
  return matrix[0][0] === 1 && matrix[1][1] === 1
}

function orientationsEqual(a: Orientation, b: Orientation): boolean {
  return a[0][0] === b[0][0] && a[0][1] === b[0][1] && a[1][0] === b[1][0] && a[1][1] === b[1][1]
}

function reflectionIsOdd(edit: Pick<MediaEditState, 'flip' | 'mirror'>): boolean {
  return edit.flip !== edit.mirror
}

/**
 * Rotates what the user *sees* by `quarterTurns` clockwise (negative = counter-
 * clockwise). Because the stored order is rotate → flip → mirror, a visible
 * clockwise turn on an odd-parity reflection must step the stored rotation the
 * other way; doing that here means the buttons always behave visually.
 */
export function rotateMediaEdit(edit: MediaEditState, quarterTurns: number): MediaEditState {
  const direction = reflectionIsOdd(edit) ? -1 : 1
  return { ...edit, rotation: normalizeRotation(edit.rotation + direction * quarterTurns * 90) }
}

export function toggleMediaEditFlip(edit: MediaEditState): MediaEditState {
  return { ...edit, flip: !edit.flip }
}

export function toggleMediaEditMirror(edit: MediaEditState): MediaEditState {
  return { ...edit, mirror: !edit.mirror }
}

// ── Crop ↔ oriented space ────────────────────────────────────────────────────
//
// Crop is stored in source space so it stays attached to the same pixels when
// the user rotates or flips afterwards. The crop overlay, however, is drawn over
// the *oriented* full frame the user is looking at, so it converts both ways.

function mapRect(rect: MediaEditCrop, linear: Orientation): MediaEditCrop {
  const corners: Array<[number, number]> = [[rect.x, rect.y], [rect.x + rect.width, rect.y + rect.height]]
  const mapped = corners.map(([x, y]) => {
    const cx = x - 0.5
    const cy = y - 0.5
    return [linear[0][0] * cx + linear[0][1] * cy + 0.5, linear[1][0] * cx + linear[1][1] * cy + 0.5] as const
  })
  const x0 = Math.min(mapped[0]![0], mapped[1]![0])
  const x1 = Math.max(mapped[0]![0], mapped[1]![0])
  const y0 = Math.min(mapped[0]![1], mapped[1]![1])
  const y1 = Math.max(mapped[0]![1], mapped[1]![1])
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/** A source-space crop rectangle expressed in the oriented (rotated/flipped) full frame. */
export function sourceCropToOriented(
  crop: MediaEditCrop,
  edit: Pick<MediaEditState, 'rotation' | 'flip' | 'mirror'>,
): MediaEditCrop {
  return mapRect(crop, orientationOf(edit))
}

/** A rectangle drawn on the oriented full frame, expressed back in source space. */
export function orientedCropToSource(
  rect: MediaEditCrop,
  edit: Pick<MediaEditState, 'rotation' | 'flip' | 'mirror'>,
): MediaEditCrop {
  return normalizeCrop(mapRect(rect, orientationInverse(orientationOf(edit))))
}

// ── Equality / dirtiness ─────────────────────────────────────────────────────

function cropsEqual(a: MediaEditCrop, b: MediaEditCrop): boolean {
  return Math.abs(a.x - b.x) < EPSILON
    && Math.abs(a.y - b.y) < EPSILON
    && Math.abs(a.width - b.width) < EPSILON
    && Math.abs(a.height - b.height) < EPSILON
}

/**
 * Semantic equality. Two edits are equal when they would render the same
 * pixels, e.g. flip + mirror together equal a 180° rotation, so returning a
 * control to its baseline always makes the session clean again.
 */
export function mediaEditsEqual(a: MediaEditState, b: MediaEditState): boolean {
  if (!cropsEqual(a.crop, b.crop)) return false
  if (!orientationsEqual(orientationOf(a), orientationOf(b))) return false
  for (const key of Object.keys(MEDIA_EDIT_RANGES) as MediaEditSliderKey[]) {
    if (Math.abs(a[key] - b[key]) > EPSILON) return false
  }
  return true
}

export function isMediaEditNeutral(edit: MediaEditState): boolean {
  return mediaEditsEqual(edit, createDefaultMediaEdit())
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

export function formatDegrees(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}°`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

// ── Crop dragging ────────────────────────────────────────────────────────────

export type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/**
 * Applies a drag of (dx, dy) — in the same normalized units as the rectangle —
 * to `start` from the given handle. The result always stays inside the frame and
 * never shrinks below MIN_CROP_FRACTION.
 */
export function dragCropRect(start: MediaEditCrop, handle: CropHandle, dx: number, dy: number): MediaEditCrop {
  if (handle === 'move') {
    return normalizeCrop({
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height),
    })
  }
  let left = start.x
  let top = start.y
  let right = start.x + start.width
  let bottom = start.y + start.height
  if (handle.includes('w')) left = clamp(left + dx, 0, right - MIN_CROP_FRACTION)
  if (handle.includes('e')) right = clamp(right + dx, left + MIN_CROP_FRACTION, 1)
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - MIN_CROP_FRACTION)
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + MIN_CROP_FRACTION, 1)
  return normalizeCrop({ x: left, y: top, width: right - left, height: bottom - top })
}
