import type { ShiftgridGridGeometry } from './ShiftgridTileGeometry'

export type ShiftgridTilePhase = 'home' | 'moving' | 'holding' | 'returning'

export interface ShiftgridRuntimeTileState {
  tileId: string
  sourceMediaId: string | null
  sourceSlot: number
  x: number
  y: number
  phase: ShiftgridTilePhase
  progress: number
}

export interface ShiftgridRuntimeGridState {
  identity: string
  patternRevision: number
  tiles: readonly ShiftgridRuntimeTileState[]
}

/** Transient reconstruction state. This type must never be added to persistence. */
export function createShiftgridRuntimeGridState(
  geometry: ShiftgridGridGeometry,
  sourceMediaIds: readonly string[],
  identity: string,
): ShiftgridRuntimeGridState {
  return Object.freeze({
    identity,
    patternRevision: 0,
    tiles: Object.freeze(geometry.tiles.map(tile => Object.freeze({
      tileId: tile.id,
      sourceMediaId: sourceMediaIds.length > 0 ? sourceMediaIds[tile.index % sourceMediaIds.length]! : null,
      sourceSlot: sourceMediaIds.length > 0 ? tile.index % sourceMediaIds.length : -1,
      x: tile.x,
      y: tile.y,
      phase: 'home' as const,
      progress: 1,
    }))),
  })
}
