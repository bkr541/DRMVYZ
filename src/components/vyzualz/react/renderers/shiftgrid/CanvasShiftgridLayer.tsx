import { useMemo } from 'react'
import { DrawerNotice } from '../../../shared/DrawerNotice'
import type { CanvasMediaPool } from '../../canvasPerformance'
import type { CanvasMediaItem } from '../../ReactTypes'
import { resolveShiftgridSourceSet } from './ShiftgridSourceMedia'
import type { CanvasShiftgridSettings } from './ShiftgridSettings'

/**
 * P0 lifecycle boundary for the one renderer that will own the complete tile
 * grid. It intentionally publishes no canvas and renders no substitute art.
 */
export function CanvasShiftgridLayer({
  settings,
  activeMediaId,
  activePool,
  mediaItems,
}: {
  settings: CanvasShiftgridSettings
  activeMediaId: string | null
  activePool: CanvasMediaPool | null
  mediaItems: readonly CanvasMediaItem[]
}) {
  const sources = useMemo(() => resolveShiftgridSourceSet({
    settings,
    activeMediaId,
    activePool,
    mediaItems,
  }), [activeMediaId, activePool, mediaItems, settings])

  return (
    <div
      className="rv-canvas-engine-surface rv-canvas-engine-surface--empty rv-canvas-engine-surface--shiftgrid"
      role="region"
      aria-label="SHIFTGRID development render surface"
      data-renderer-kind="shiftgrid"
      data-shiftgrid-source-mode={sources.mode}
      data-shiftgrid-source-count={sources.media.length}
    >
      <DrawerNotice tone="info" role="status" title="SHIFTGRID · Phase 0">
        Tile rendering arrives in Phase 1. The dedicated renderer contract is active with {sources.media.length} eligible {sources.media.length === 1 ? 'source' : 'sources'}; no fallback artwork is being displayed.
      </DrawerNotice>
    </div>
  )
}
