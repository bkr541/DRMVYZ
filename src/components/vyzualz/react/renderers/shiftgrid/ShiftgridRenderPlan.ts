import type { ShiftgridGridRuntime } from './ShiftgridGridState'
import type { CanvasShiftgridEasing, CanvasShiftgridFitMode } from './ShiftgridSettings'
import type { ShiftgridGridGeometry } from './ShiftgridTileGeometry'

export interface ShiftgridRect { x: number; y: number; width: number; height: number }
export interface ShiftgridRenderTile {
  tileId: string; source: ShiftgridRect; destination: ShiftgridRect
}
export interface ShiftgridRenderPlan {
  width: number; height: number; sourceWidth: number; sourceHeight: number
  fitMode: CanvasShiftgridFitMode; compositionBounds: ShiftgridRect; sourceDraw: ShiftgridRect
  assembled: boolean; tiles: readonly ShiftgridRenderTile[]
}

export function applyShiftgridEasing(progress: number, easing: CanvasShiftgridEasing): number {
  const value = Math.min(1, Math.max(0, progress))
  if (easing === 'linear') return value
  if (easing === 'spring') return 1 - Math.cos(value * Math.PI * 4.5) * Math.exp(-value * 7)
  return 1 - (1 - value) ** 3
}

export function resolveShiftgridSourceDrawRect(width: number, height: number, sourceWidth: number, sourceHeight: number, fitMode: CanvasShiftgridFitMode): ShiftgridRect {
  const scale = fitMode === 'cover'
    ? Math.max(width / sourceWidth, height / sourceHeight)
    : Math.min(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale; const drawHeight = sourceHeight * scale
  return { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight }
}

export function createShiftgridRenderPlan({ geometry, runtime, width, height, sourceWidth, sourceHeight, fitMode, easing }: {
  geometry: ShiftgridGridGeometry; runtime: ShiftgridGridRuntime
  width: number; height: number; sourceWidth: number; sourceHeight: number
  fitMode: CanvasShiftgridFitMode; easing: CanvasShiftgridEasing
}): ShiftgridRenderPlan {
  const first = geometry.tiles[0]
  const last = geometry.tiles[geometry.tiles.length - 1]
  const bounds = first && last
    ? { x: first.x, y: first.y, width: last.x + last.width - first.x, height: last.y + last.height - first.y }
    : { x: 0, y: 0, width, height }
  const localSourceDraw = resolveShiftgridSourceDrawRect(bounds.width, bounds.height, sourceWidth, sourceHeight, fitMode)
  const sourceDraw = { ...localSourceDraw, x: localSourceDraw.x + bounds.x, y: localSourceDraw.y + bounds.y }
  const tiles = runtime.state.tiles.map((identity, tileIndex) => {
    const sourceSlot = geometry.tiles[identity.originalSlot]!
    const position = runtime.getTileSlot(tileIndex); const progress = applyShiftgridEasing(position.progress, easing)
    const from = geometry.tiles[position.from]!; const to = geometry.tiles[position.to]!
    return Object.freeze({
      tileId: identity.id,
      source: Object.freeze({
        x: (sourceSlot.x - sourceDraw.x) / sourceDraw.width,
        y: (sourceSlot.y - sourceDraw.y) / sourceDraw.height,
        width: sourceSlot.width / sourceDraw.width,
        height: sourceSlot.height / sourceDraw.height,
      }),
      destination: Object.freeze({
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        width: from.width + (to.width - from.width) * progress,
        height: from.height + (to.height - from.height) * progress,
      }),
    })
  })
  const assembled = runtime.state.pendingMovement === null
    && runtime.state.currentSlotsByTile.every((slot, tile) => slot === tile)
  return Object.freeze({ width, height, sourceWidth, sourceHeight, fitMode,
    compositionBounds: Object.freeze(bounds), sourceDraw: Object.freeze(sourceDraw), assembled,
    tiles: Object.freeze(tiles) })
}

/** Six vertices per tile, one interleaved position/UV buffer, one GPU draw call. */
export function buildShiftgridVertexBatch(plan: ShiftgridRenderPlan): Float32Array {
  const result = new Float32Array(plan.tiles.length * 6 * 4); let offset = 0
  for (const tile of plan.tiles) {
    const d = tile.destination; const s = tile.source
    const x0 = d.x; const y0 = d.y; const x1 = d.x + d.width; const y1 = d.y + d.height
    const u0 = s.x; const v0 = s.y; const u1 = s.x + s.width; const v1 = s.y + s.height
    const vertices = [x0, y0, u0, v0, x1, y0, u1, v0, x0, y1, u0, v1, x0, y1, u0, v1, x1, y0, u1, v0, x1, y1, u1, v1]
    result.set(vertices, offset); offset += vertices.length
  }
  return result
}
