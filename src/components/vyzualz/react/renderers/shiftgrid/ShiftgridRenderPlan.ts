import type { ShiftgridRuntimeGridState } from './ShiftgridGridState'
import type { CanvasShiftgridEasing, CanvasShiftgridFitMode } from './ShiftgridSettings'
import type { ShiftgridGridGeometry } from './ShiftgridTileGeometry'

export interface ShiftgridRect { x: number; y: number; width: number; height: number }
export interface ShiftgridRenderSource { id: string; width: number; height: number }
export interface ShiftgridRenderTile {
  tileId: string
  source: ShiftgridRect
  pendingSource: ShiftgridRect
  sourceIndex: number
  pendingSourceIndex: number
  sourceTransitionProgress: number
  destination: ShiftgridRect
}
export interface ShiftgridRenderPlan {
  width: number; height: number; sourceWidth: number; sourceHeight: number
  fitMode: CanvasShiftgridFitMode; compositionBounds: ShiftgridRect; sourceDraw: ShiftgridRect
  sources: readonly ShiftgridRenderSource[]
  assembled: boolean; tiles: readonly ShiftgridRenderTile[]
}

export interface ShiftgridTileSourceRuntime {
  readonly moving: boolean
  readonly currentSourceIndicesByTile: readonly number[]
  getTileSource(tileIndex: number): { current: number; pending: number; progress: number }
}

export interface ShiftgridTilePositionRuntime {
  readonly state: ShiftgridRuntimeGridState
  readonly moving: boolean
  getTileSlot(tileIndex: number): { from: number; to: number; progress: number }
}

export function applyShiftgridEasing(progress: number, easing: CanvasShiftgridEasing, snapStrength = 0): number {
  const value = Math.min(1, Math.max(0, progress))
  const base = easing === 'linear' ? value
    : easing === 'spring' ? 1 - Math.cos(value * Math.PI * 4.5) * Math.exp(-value * 7)
      : 1 - (1 - value) ** 3
  const snap = value < 0.78 ? value * 0.62 : 0.4836 + ((value - 0.78) / 0.22) * 0.5164
  return base + (snap - base) * Math.min(1, Math.max(0, snapStrength))
}

export function resolveShiftgridSourceDrawRect(width: number, height: number, sourceWidth: number, sourceHeight: number, fitMode: CanvasShiftgridFitMode): ShiftgridRect {
  const scale = fitMode === 'cover'
    ? Math.max(width / sourceWidth, height / sourceHeight)
    : Math.min(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale; const drawHeight = sourceHeight * scale
  return { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight }
}

export function createShiftgridRenderPlan({ geometry, runtime, width, height, sourceWidth, sourceHeight, sources, sourceRuntime, fitMode, easing, snapStrength = 0 }: {
  geometry: ShiftgridGridGeometry; runtime: ShiftgridTilePositionRuntime
  width: number; height: number; sourceWidth: number; sourceHeight: number
  sources?: readonly ShiftgridRenderSource[]; sourceRuntime?: ShiftgridTileSourceRuntime
  fitMode: CanvasShiftgridFitMode; easing: CanvasShiftgridEasing; snapStrength?: number
}): ShiftgridRenderPlan {
  const first = geometry.tiles[0]
  const last = geometry.tiles[geometry.tiles.length - 1]
  const bounds = first && last
    ? { x: first.x, y: first.y, width: last.x + last.width - first.x, height: last.y + last.height - first.y }
    : { x: 0, y: 0, width, height }
  const normalizedSources = sources?.length ? sources : [{ id: 'source-0', width: sourceWidth, height: sourceHeight }]
  const sourceDraws = normalizedSources.map(source => {
    const local = resolveShiftgridSourceDrawRect(bounds.width, bounds.height, source.width, source.height, fitMode)
    return { ...local, x: local.x + bounds.x, y: local.y + bounds.y }
  })
  const localSourceDraw = resolveShiftgridSourceDrawRect(bounds.width, bounds.height, sourceWidth, sourceHeight, fitMode)
  const sourceDraw = { ...localSourceDraw, x: localSourceDraw.x + bounds.x, y: localSourceDraw.y + bounds.y }
  const tiles = runtime.state.tiles.map((identity, tileIndex) => {
    const sourceSlot = geometry.tiles[identity.originalSlot]!
    const position = runtime.getTileSlot(tileIndex); const progress = applyShiftgridEasing(position.progress, easing, snapStrength)
    const from = geometry.tiles[position.from]!; const to = geometry.tiles[position.to]!
    const assignment = sourceRuntime?.getTileSource(tileIndex) ?? { current: 0, pending: 0, progress: 1 }
    const currentIndex = Math.min(normalizedSources.length - 1, Math.max(0, assignment.current))
    const pendingIndex = Math.min(normalizedSources.length - 1, Math.max(0, assignment.pending))
    const currentDraw = sourceDraws[currentIndex]!; const pendingDraw = sourceDraws[pendingIndex]!
    const crop = (draw: ShiftgridRect) => Object.freeze({
      x: (sourceSlot.x - draw.x) / draw.width,
      y: (sourceSlot.y - draw.y) / draw.height,
      width: sourceSlot.width / draw.width,
      height: sourceSlot.height / draw.height,
    })
    return Object.freeze({
      tileId: identity.id,
      source: crop(currentDraw),
      pendingSource: crop(pendingDraw),
      sourceIndex: currentIndex,
      pendingSourceIndex: pendingIndex,
      sourceTransitionProgress: applyShiftgridEasing(assignment.progress, easing),
      destination: Object.freeze({
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        width: from.width + (to.width - from.width) * progress,
        height: from.height + (to.height - from.height) * progress,
      }),
    })
  })
  const assembledSourceIndex = sourceRuntime?.currentSourceIndicesByTile[0] ?? 0
  const assembled = !runtime.moving
    && !sourceRuntime?.moving
    && runtime.state.currentSlotsByTile.every((slot, tile) => slot === tile)
    && (!sourceRuntime || sourceRuntime.currentSourceIndicesByTile.every(source => source === sourceRuntime.currentSourceIndicesByTile[0]))
  return Object.freeze({ width, height, sourceWidth, sourceHeight, fitMode,
    compositionBounds: Object.freeze(bounds), sourceDraw: Object.freeze(sourceDraws[assembledSourceIndex] ?? sourceDraw), sources: Object.freeze(normalizedSources), assembled,
    tiles: Object.freeze(tiles) })
}

/** Six vertices per tile, one interleaved position/dual-UV/source buffer, one GPU draw call. */
export function buildShiftgridVertexBatch(plan: ShiftgridRenderPlan): Float32Array {
  const result = new Float32Array(plan.tiles.length * 6 * 9); let offset = 0
  for (const tile of plan.tiles) {
    const d = tile.destination; const s = tile.source; const p = tile.pendingSource
    const x0 = d.x; const y0 = d.y; const x1 = d.x + d.width; const y1 = d.y + d.height
    const u0 = s.x; const v0 = s.y; const u1 = s.x + s.width; const v1 = s.y + s.height
    const pu0 = p.x; const pv0 = p.y; const pu1 = p.x + p.width; const pv1 = p.y + p.height
    const sources = [tile.sourceIndex, tile.pendingSourceIndex, tile.sourceTransitionProgress]
    const vertices = [
      x0, y0, u0, v0, pu0, pv0, ...sources,
      x1, y0, u1, v0, pu1, pv0, ...sources,
      x0, y1, u0, v1, pu0, pv1, ...sources,
      x0, y1, u0, v1, pu0, pv1, ...sources,
      x1, y0, u1, v0, pu1, pv0, ...sources,
      x1, y1, u1, v1, pu1, pv1, ...sources,
    ]
    result.set(vertices, offset); offset += vertices.length
  }
  return result
}
