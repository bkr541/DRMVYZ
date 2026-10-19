import type { ShiftgridRuntimeGridState } from './ShiftgridGridState'
import { CLEAN_SHIFTGRID_EFFECT_PLAN, type ShiftgridEffectPlan } from './ShiftgridEffects'
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
  motionX: number
  motionY: number
  opacity: number
  snapFlash: number
}
export interface ShiftgridRenderPlan {
  width: number; height: number; sourceWidth: number; sourceHeight: number
  fitMode: CanvasShiftgridFitMode; compositionBounds: ShiftgridRect; sourceDraw: ShiftgridRect
  sources: readonly ShiftgridRenderSource[]
  effects: ShiftgridEffectPlan
  cleanEffects: boolean
  backdrop: ShiftgridRenderTile | null
  trails: readonly ShiftgridRenderTile[]
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

export function createShiftgridRenderPlan({ geometry, runtime, width, height, sourceWidth, sourceHeight, sources, sourceRuntime, fitMode, easing, snapStrength = 0, effects = CLEAN_SHIFTGRID_EFFECT_PLAN }: {
  geometry: ShiftgridGridGeometry; runtime: ShiftgridTilePositionRuntime
  width: number; height: number; sourceWidth: number; sourceHeight: number
  sources?: readonly ShiftgridRenderSource[]; sourceRuntime?: ShiftgridTileSourceRuntime
  fitMode: CanvasShiftgridFitMode; easing: CanvasShiftgridEasing; snapStrength?: number
  effects?: ShiftgridEffectPlan
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
  const cleanEffects = Object.values(effects).every(value => value <= 0)
  const tiles = runtime.state.tiles.map((identity, tileIndex) => {
    const sourceSlot = geometry.tiles[identity.originalSlot]!
    const position = runtime.getTileSlot(tileIndex); const rawProgress = Math.min(1, Math.max(0, position.progress))
    const progress = applyShiftgridEasing(rawProgress, easing, snapStrength)
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
    const baseDestination = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
      width: from.width + (to.width - from.width) * progress,
      height: from.height + (to.height - from.height) * progress,
    }
    const gapInset = Math.min(baseDestination.width, baseDestination.height) * effects.tileGap * 0.09
    const pulseInset = Math.min(baseDestination.width, baseDestination.height) * effects.beatPulse * -0.012
    const inset = gapInset > 0
      ? Math.max(gapInset * 0.35, gapInset + pulseInset)
      : Math.max(-Math.min(baseDestination.width, baseDestination.height) * 0.025, pulseInset)
    const moving = position.from !== position.to && rawProgress < 1
    const snapEnvelope = moving && rawProgress >= 0.78
      ? Math.sin(((rawProgress - 0.78) / 0.22) * Math.PI)
      : 0
    return Object.freeze({
      tileId: identity.id,
      source: crop(currentDraw),
      pendingSource: crop(pendingDraw),
      sourceIndex: currentIndex,
      pendingSourceIndex: pendingIndex,
      sourceTransitionProgress: applyShiftgridEasing(assignment.progress, easing),
      destination: Object.freeze({
        x: baseDestination.x + inset,
        y: baseDestination.y + inset,
        width: Math.max(0.5, baseDestination.width - inset * 2),
        height: Math.max(0.5, baseDestination.height - inset * 2),
      }),
      motionX: moving ? to.x - from.x : 0,
      motionY: moving ? to.y - from.y : 0,
      opacity: 1,
      snapFlash: snapEnvelope,
    })
  })
  const trailStrength = Math.max(effects.lightTrails, effects.motionBlur * 0.65)
  const trails: ShiftgridRenderTile[] = []
  if (trailStrength > 0) {
    for (const tile of tiles) {
      const distance = Math.hypot(tile.motionX, tile.motionY)
      if (distance <= 0) continue
      const count = effects.lightTrails > 0.66 ? 3 : effects.lightTrails > 0.2 || effects.motionBlur > 0 ? 2 : 1
      for (let index = count; index >= 1; index -= 1) {
        const lag = 0.035 + index * 0.045
        const opacity = trailStrength * (1 - index / (count + 1)) * 0.34
        trails.push(Object.freeze({ ...tile,
          tileId: `${tile.tileId}:trail-${index}`,
          destination: Object.freeze({ ...tile.destination,
            x: tile.destination.x - tile.motionX * lag,
            y: tile.destination.y - tile.motionY * lag }),
          opacity,
          snapFlash: 0,
        }))
      }
    }
  }
  const assembledSourceIndex = sourceRuntime?.currentSourceIndicesByTile[0] ?? 0
  const assembled = !runtime.moving
    && !sourceRuntime?.moving
    && runtime.state.currentSlotsByTile.every((slot, tile) => slot === tile)
    && (!sourceRuntime || sourceRuntime.currentSourceIndicesByTile.every(source => source === sourceRuntime.currentSourceIndicesByTile[0]))
  // Sliding interpolation can temporarily uncover a cell even though both
  // endpoints are complete permutations. Keep the composition occupied with
  // source-aligned artwork beneath moving tiles; settled frames omit this quad.
  const backdropSourceIndex = Math.min(normalizedSources.length - 1, Math.max(0, assembledSourceIndex))
  const backdropDraw = sourceDraws[backdropSourceIndex] ?? sourceDraw
  const backdrop = runtime.moving ? Object.freeze({
    tileId: 'shiftgrid:motion-backdrop',
    source: Object.freeze({ x: (bounds.x - backdropDraw.x) / backdropDraw.width, y: (bounds.y - backdropDraw.y) / backdropDraw.height,
      width: bounds.width / backdropDraw.width, height: bounds.height / backdropDraw.height }),
    pendingSource: Object.freeze({ x: (bounds.x - backdropDraw.x) / backdropDraw.width, y: (bounds.y - backdropDraw.y) / backdropDraw.height,
      width: bounds.width / backdropDraw.width, height: bounds.height / backdropDraw.height }),
    sourceIndex: backdropSourceIndex, pendingSourceIndex: backdropSourceIndex, sourceTransitionProgress: 1,
    destination: Object.freeze({ ...bounds }), motionX: 0, motionY: 0, opacity: 1, snapFlash: 0,
  }) : null
  return Object.freeze({ width, height, sourceWidth, sourceHeight, fitMode,
    compositionBounds: Object.freeze(bounds), sourceDraw: Object.freeze(sourceDraws[assembledSourceIndex] ?? sourceDraw), sources: Object.freeze(normalizedSources), assembled,
    effects: Object.freeze({ ...effects }), cleanEffects, backdrop, trails: Object.freeze(trails),
    tiles: Object.freeze(tiles) })
}

/** Six vertices per tile, one interleaved position/dual-UV/source/local-UV/motion/effect buffer. */
export function buildShiftgridVertexBatch(plan: ShiftgridRenderPlan): Float32Array {
  const renderTiles = [...(plan.backdrop ? [plan.backdrop] : []), ...plan.trails, ...plan.tiles]
  const result = new Float32Array(renderTiles.length * 6 * 15); let offset = 0
  for (const tile of renderTiles) {
    const d = tile.destination; const s = tile.source; const p = tile.pendingSource
    const x0 = d.x; const y0 = d.y; const x1 = d.x + d.width; const y1 = d.y + d.height
    const u0 = s.x; const v0 = s.y; const u1 = s.x + s.width; const v1 = s.y + s.height
    const pu0 = p.x; const pv0 = p.y; const pu1 = p.x + p.width; const pv1 = p.y + p.height
    const sources = [tile.sourceIndex, tile.pendingSourceIndex, tile.sourceTransitionProgress]
    const effect = [tile.motionX, tile.motionY, tile.opacity, tile.snapFlash]
    const vertices = [
      x0, y0, u0, v0, pu0, pv0, ...sources, 0, 0, ...effect,
      x1, y0, u1, v0, pu1, pv0, ...sources, 1, 0, ...effect,
      x0, y1, u0, v1, pu0, pv1, ...sources, 0, 1, ...effect,
      x0, y1, u0, v1, pu0, pv1, ...sources, 0, 1, ...effect,
      x1, y0, u1, v0, pu1, pv0, ...sources, 1, 0, ...effect,
      x1, y1, u1, v1, pu1, pv1, ...sources, 1, 1, ...effect,
    ]
    result.set(vertices, offset); offset += vertices.length
  }
  return result
}
