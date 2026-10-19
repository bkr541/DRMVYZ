import type { ShiftgridRendererSource } from './ShiftgridRenderer'

export interface ShiftgridAtlasLayout {
  columns: number
  rows: number
  cellSize: number
  width: number
  height: number
  estimatedBytes: number
}

/** A single bounded RGBA atlas keeps ten pool sources below an explicit GPU budget. */
export function resolveShiftgridAtlasLayout(sourceCount: number, preferredCellSize: number, maxTextureSize: number): ShiftgridAtlasLayout {
  const count = Math.max(1, Math.min(10, Math.round(sourceCount)))
  const columns = Math.ceil(Math.sqrt(count)); const rows = Math.ceil(count / columns)
  const boundedMax = Math.max(64, Math.floor(maxTextureSize))
  const cellSize = Math.max(64, Math.min(Math.round(preferredCellSize), Math.floor(boundedMax / columns), Math.floor(boundedMax / rows)))
  const width = columns * cellSize; const height = rows * cellSize
  return Object.freeze({ columns, rows, cellSize, width, height, estimatedBytes: width * height * 4 })
}

export function createShiftgridTextureAtlas(sources: readonly ShiftgridRendererSource[], preferredCellSize: number, maxTextureSize: number): {
  canvas: HTMLCanvasElement
  layout: ShiftgridAtlasLayout
} {
  if (sources.length === 0) throw new Error('SHIFTGRID atlas requires at least one source')
  const layout = resolveShiftgridAtlasLayout(sources.length, preferredCellSize, maxTextureSize)
  const canvas = document.createElement('canvas'); canvas.width = layout.width; canvas.height = layout.height
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) throw new Error('SHIFTGRID could not allocate its bounded texture atlas')
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'
  sources.forEach((source, index) => {
    const column = index % layout.columns; const row = Math.floor(index / layout.columns)
    context.drawImage(source.element, column * layout.cellSize, row * layout.cellSize, layout.cellSize, layout.cellSize)
  })
  return { canvas, layout }
}
