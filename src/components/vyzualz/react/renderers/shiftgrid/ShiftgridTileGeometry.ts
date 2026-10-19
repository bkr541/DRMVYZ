import type { CanvasShiftgridSettings } from './ShiftgridSettings'

export interface ShiftgridTileGeometry {
  id: string
  row: number
  column: number
  index: number
  x: number
  y: number
  width: number
  height: number
  sourceU: number
  sourceV: number
  sourceWidth: number
  sourceHeight: number
}

export interface ShiftgridGridGeometry {
  columns: number
  rows: number
  tiles: readonly ShiftgridTileGeometry[]
}

/** Stable row/column identity survives source replacement and reconstruction. */
export function getShiftgridTileId(row: number, column: number): string {
  return `shiftgrid:${row}:${column}`
}

/**
 * Produces one renderer-owned grid. Geometry is viewport-local and never
 * creates authored CANVAS layers. Square tiles are centered without silently
 * changing their source UV identity; mixed grids alternate square/rect cells.
 */
export function createShiftgridTileGeometry(
  settings: Pick<CanvasShiftgridSettings, 'gridColumns' | 'gridRows' | 'tileShape'>,
  viewportWidth: number,
  viewportHeight: number,
): ShiftgridGridGeometry {
  const columns = Math.max(1, Math.round(settings.gridColumns))
  const rows = Math.max(1, Math.round(settings.gridRows))
  const width = Math.max(1, viewportWidth)
  const height = Math.max(1, viewportHeight)
  const cellWidth = width / columns
  const cellHeight = height / rows
  const squareSide = Math.min(cellWidth, cellHeight)
  const squareOffsetX = (cellWidth - squareSide) / 2
  const squareOffsetY = (cellHeight - squareSide) / 2
  const tiles: ShiftgridTileGeometry[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column
      const square = settings.tileShape === 'square' || (settings.tileShape === 'mixed' && index % 2 === 0)
      tiles.push(Object.freeze({
        id: getShiftgridTileId(row, column),
        row,
        column,
        index,
        x: column * cellWidth + (square ? squareOffsetX : 0),
        y: row * cellHeight + (square ? squareOffsetY : 0),
        width: square ? squareSide : cellWidth,
        height: square ? squareSide : cellHeight,
        sourceU: column / columns,
        sourceV: row / rows,
        sourceWidth: 1 / columns,
        sourceHeight: 1 / rows,
      }))
    }
  }

  return Object.freeze({ columns, rows, tiles: Object.freeze(tiles) })
}
