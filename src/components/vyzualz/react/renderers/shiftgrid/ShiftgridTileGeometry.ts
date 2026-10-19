import type { CanvasShiftgridGridPreset, CanvasShiftgridQuality, CanvasShiftgridSettings } from './ShiftgridSettings'

export interface ShiftgridGridDimensions { columns: number; rows: number }
export interface ShiftgridTileGeometry {
  id: string; row: number; column: number; index: number
  x: number; y: number; width: number; height: number
  sourceU: number; sourceV: number; sourceWidth: number; sourceHeight: number
}
export interface ShiftgridGridGeometry extends ShiftgridGridDimensions { tiles: readonly ShiftgridTileGeometry[] }

export const SHIFTGRID_REQUESTED_GRID_DIMENSIONS = Object.freeze([
  Object.freeze({ columns: 3, rows: 3 }), Object.freeze({ columns: 4, rows: 4 }),
  Object.freeze({ columns: 5, rows: 5 }), Object.freeze({ columns: 6, rows: 6 }),
  Object.freeze({ columns: 8, rows: 8 }), Object.freeze({ columns: 10, rows: 6 }),
  Object.freeze({ columns: 16, rows: 9 }),
] as const)

const GRID_PRESET_DIMENSIONS: Partial<Record<CanvasShiftgridGridPreset, ShiftgridGridDimensions>> = {
  '3x3': { columns: 3, rows: 3 }, '4x4': { columns: 4, rows: 4 },
  '5x5': { columns: 5, rows: 5 }, '6x6': { columns: 6, rows: 6 },
  '8x8': { columns: 8, rows: 8 }, '10x6': { columns: 10, rows: 6 },
  '16x9': { columns: 16, rows: 9 },
}

export function getShiftgridTileId(row: number, column: number): string { return `shiftgrid:${row}:${column}` }

function qualityTarget(quality: CanvasShiftgridQuality, longestEdge: number): number {
  if (quality === 'low') return 4
  if (quality === 'balanced') return 6
  if (quality === 'high') return 8
  return longestEdge >= 1800 ? 8 : longestEdge >= 900 ? 6 : 5
}

/** Selects only supported P1 layouts while considering source, target, quality and budget. */
export function resolveShiftgridGridDimensions({ settings, sourceWidth, sourceHeight, viewportWidth, viewportHeight }: {
  settings: Pick<CanvasShiftgridSettings, 'gridPreset' | 'gridColumns' | 'gridRows' | 'quality' | 'tileBudget'>
  sourceWidth: number; sourceHeight: number; viewportWidth: number; viewportHeight: number
}): ShiftgridGridDimensions {
  if (settings.gridPreset === 'custom') return { columns: Math.max(2, Math.round(settings.gridColumns)), rows: Math.max(2, Math.round(settings.gridRows)) }
  const fixed = GRID_PRESET_DIMENSIONS[settings.gridPreset]
  if (fixed) return fixed
  const sourceAspect = Math.max(0.01, sourceWidth) / Math.max(0.01, sourceHeight)
  const viewportAspect = Math.max(0.01, viewportWidth) / Math.max(0.01, viewportHeight)
  const target = qualityTarget(settings.quality, Math.max(viewportWidth, viewportHeight))
  const candidates = SHIFTGRID_REQUESTED_GRID_DIMENSIONS.filter(value => value.columns * value.rows <= settings.tileBudget)
  const pool = candidates.length > 0 ? candidates : SHIFTGRID_REQUESTED_GRID_DIMENSIONS.slice(0, 1)
  const score = (value: ShiftgridGridDimensions) => {
    const aspect = value.columns / value.rows
    return Math.abs(Math.log(aspect / sourceAspect)) * 0.7
      + Math.abs(Math.log(aspect / viewportAspect)) * 0.3
      + Math.abs(Math.max(value.columns, value.rows) - target) * 0.11
  }
  return pool.reduce((best, candidate) => score(candidate) < score(best) ? candidate : best, pool[0]!)
}

/** Produces one renderer-owned regular grid with exactly one stable tile per slot. */
export function createShiftgridTileGeometry(settings: Pick<CanvasShiftgridSettings, 'gridColumns' | 'gridRows' | 'tileShape'>, viewportWidth: number, viewportHeight: number): ShiftgridGridGeometry {
  const columns = Math.max(1, Math.round(settings.gridColumns)); const rows = Math.max(1, Math.round(settings.gridRows))
  const width = Math.max(1, viewportWidth); const height = Math.max(1, viewportHeight)
  const squareSide = Math.min(width / columns, height / rows)
  const gridWidth = settings.tileShape === 'square' ? squareSide * columns : width
  const gridHeight = settings.tileShape === 'square' ? squareSide * rows : height
  const offsetX = (width - gridWidth) / 2; const offsetY = (height - gridHeight) / 2
  const cellWidth = gridWidth / columns; const cellHeight = gridHeight / rows
  const tiles: ShiftgridTileGeometry[] = []
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const index = row * columns + column
    tiles.push(Object.freeze({ id: getShiftgridTileId(row, column), row, column, index,
      x: offsetX + column * cellWidth, y: offsetY + row * cellHeight, width: cellWidth, height: cellHeight,
      sourceU: column / columns, sourceV: row / rows, sourceWidth: 1 / columns, sourceHeight: 1 / rows }))
  }
  return Object.freeze({ columns, rows, tiles: Object.freeze(tiles) })
}
