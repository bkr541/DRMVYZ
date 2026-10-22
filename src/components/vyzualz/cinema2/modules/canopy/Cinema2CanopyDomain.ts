/**
 * CANOPY: a suspended array of luminous LED rods hanging from an overhead mounting grid.
 *
 * World space is right-handed with Y up. The array is centred on the X/Z origin; rows run front (+Z, towards the camera) to back (-Z),
 * columns left (-X) to right (+X). Every rod has a stable row-major address.
 */

export const CANOPY_PATTERN_IDS = Object.freeze(['waterfall', 'crosswave', 'crown', 'splitWings', 'checkerLift', 'downpour'] as const)
export type CanopyPatternId = typeof CANOPY_PATTERN_IDS[number]
export const CANOPY_DEFAULT_PATTERN: CanopyPatternId = 'waterfall'
export const CANOPY_PATTERN_LABELS: Readonly<Record<CanopyPatternId, string>> = Object.freeze({
  waterfall: 'Waterfall',
  crosswave: 'Crosswave',
  crown: 'Crown',
  splitWings: 'Split Wings',
  checkerLift: 'Checker Lift',
  downpour: 'Downpour',
})

export const CANOPY_MIN_AXIS = 4
export const CANOPY_MAX_AXIS = 12
/** Hard cap on rods, whatever Rows and Columns ask for. */
export const CANOPY_MAX_RODS = 144

/** Height of the overhead mounting plane. */
export const CANOPY_MOUNT_Y = 4.6
/** Distance from the mounting plane down to a rod's cap when it is neither lifted nor lowered. */
export const CANOPY_BASE_HANG = 0.7
/** A cap never rises closer to the mounting plane than this, nor hangs lower than the maximum. */
export const CANOPY_MIN_HANG = 0.14
export const CANOPY_MAX_HANG = 1.95
/** The lowest a rod tip can ever go; keeps every tip clear of the lower frame edge. */
export const CANOPY_MIN_TIP_Y = 0.9
/** An oversized array is scaled about this height so it keeps its vertical place in the frame. */
export const CANOPY_PIVOT_Y = 3.85
export const CANOPY_CAP_HEIGHT = 0.16
export const CANOPY_CAP_WIDTH = 0.2
export const CANOPY_ROD_RADIUS = 0.05
export const CANOPY_STEM_WIDTH = 0.012
export const CANOPY_RAIL_WIDTH = 0.07
export const CANOPY_RAIL_HEIGHT = 0.1

export interface CanopyStructure {
  readonly rows: number
  readonly columns: number
  readonly rowSpacing: number
  readonly columnSpacing: number
  readonly rodLength: number
  readonly lengthVariation: number
}

export const CANOPY_DEFAULT_STRUCTURE: Readonly<CanopyStructure> = Object.freeze({
  rows: 8, columns: 8, rowSpacing: 1, columnSpacing: 1.08, rodLength: 1.45, lengthVariation: 0.22,
})

export const CANOPY_STRUCTURE_LIMITS = Object.freeze({
  rows: Object.freeze({ min: CANOPY_MIN_AXIS, max: CANOPY_MAX_AXIS }),
  columns: Object.freeze({ min: CANOPY_MIN_AXIS, max: CANOPY_MAX_AXIS }),
  rowSpacing: Object.freeze({ min: 0.75, max: 1.4 }),
  columnSpacing: Object.freeze({ min: 0.75, max: 1.4 }),
  rodLength: Object.freeze({ min: 0.6, max: 2.1 }),
  lengthVariation: Object.freeze({ min: 0, max: 0.65 }),
})

/** The widest X/Z extent the camera frames at full scale: the default array with a margin. Larger arrays are scaled down uniformly to fit. */
export const CANOPY_FRAME_HALF_WIDTH = 4
export const CANOPY_FRAME_HALF_DEPTH = 3.8

export interface CanopyAddress {
  readonly index: number
  readonly row: number
  readonly column: number
}

export function clampCanopyStructure(input: Partial<Readonly<CanopyStructure>>): Readonly<CanopyStructure> {
  const limits = CANOPY_STRUCTURE_LIMITS
  const num = (value: number | undefined, fallback: number, min: number, max: number) =>
    Math.min(max, Math.max(min, typeof value === 'number' && Number.isFinite(value) ? value : fallback))
  let rows = Math.round(num(input.rows, CANOPY_DEFAULT_STRUCTURE.rows, limits.rows.min, limits.rows.max))
  let columns = Math.round(num(input.columns, CANOPY_DEFAULT_STRUCTURE.columns, limits.columns.min, limits.columns.max))
  // The axis limits already keep rows * columns at or under the cap; this guards a future limit change.
  while (rows * columns > CANOPY_MAX_RODS) {
    if (rows >= columns) rows -= 1
    else columns -= 1
  }
  return Object.freeze({
    rows,
    columns,
    rowSpacing: num(input.rowSpacing, CANOPY_DEFAULT_STRUCTURE.rowSpacing, limits.rowSpacing.min, limits.rowSpacing.max),
    columnSpacing: num(input.columnSpacing, CANOPY_DEFAULT_STRUCTURE.columnSpacing, limits.columnSpacing.min, limits.columnSpacing.max),
    rodLength: num(input.rodLength, CANOPY_DEFAULT_STRUCTURE.rodLength, limits.rodLength.min, limits.rodLength.max),
    lengthVariation: num(input.lengthVariation, CANOPY_DEFAULT_STRUCTURE.lengthVariation, limits.lengthVariation.min, limits.lengthVariation.max),
  })
}

/** Uniform scale that keeps an oversized array inside the camera's fixed frame. 1 for anything up to the default array and a margin. */
export function resolveCanopyFitScale(structure: Readonly<CanopyStructure>): number {
  const halfWidth = ((structure.columns - 1) / 2) * structure.columnSpacing + CANOPY_CAP_WIDTH
  const halfDepth = ((structure.rows - 1) / 2) * structure.rowSpacing + CANOPY_CAP_WIDTH
  return Math.min(1, CANOPY_FRAME_HALF_WIDTH / halfWidth, CANOPY_FRAME_HALF_DEPTH / halfDepth)
}

/** A deterministic 0..1 value per rod index and salt; never reads a random source. */
export function canopyHash(index: number, salt = 0): number {
  let h = Math.imul((index + 1) ^ Math.imul(salt + 0x9e3779b1, 0x85ebca6b), 0xc2b2ae35)
  h ^= h >>> 15
  h = Math.imul(h, 0x27d4eb2d)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

export const clampCanopy = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
export const clampCanopy01 = (value: number): number => clampCanopy(value, 0, 1)
