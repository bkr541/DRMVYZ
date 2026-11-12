type ViewMode = 'grid' | 'list'

/** Contact-sheet grid: four square tiles across, with this gap between tiles (px). Mirrors .vz-media-sheet in vyzualz.css. */
export const MEDIA_SHEET_COLUMNS = 4
export const MEDIA_SHEET_GAP = 6

export interface VirtualMediaWindow {
  columns: number
  rowHeight: number
  /** Edge length of one square tile in grid view (0 in list view). */
  tileSize: number
  startIndex: number
  endIndex: number
  topSpacer: number
  bottomSpacer: number
}

export function computeVirtualMediaWindow(input: {
  itemCount: number
  /** Content width of the scroll area (padding excluded); grid tiles are sized from it. */
  width: number
  height: number
  scrollTop: number
  viewMode: ViewMode
  manager: boolean
  compact?: boolean
  overscanRows?: number
}): VirtualMediaWindow {
  const height = Math.max(240, input.height || 600)
  const isList = input.viewMode === 'list'
  const columns = isList ? 1 : MEDIA_SHEET_COLUMNS
  const tileSize = isList ? 0 : Math.max(24, Math.floor((input.width - MEDIA_SHEET_GAP * (MEDIA_SHEET_COLUMNS - 1)) / MEDIA_SHEET_COLUMNS))
  const rowHeight = isList ? 58 : tileSize + MEDIA_SHEET_GAP
  const totalRows = Math.ceil(input.itemCount / columns)
  const overscan = input.overscanRows ?? 3
  const firstVisibleRow = Math.max(0, Math.floor(Math.max(0, input.scrollTop) / rowHeight))
  const visibleRows = Math.max(1, Math.ceil(height / rowHeight))
  const startRow = Math.max(0, firstVisibleRow - overscan)
  const endRow = Math.min(totalRows, firstVisibleRow + visibleRows + overscan)
  return {
    columns,
    rowHeight,
    tileSize,
    startIndex: Math.min(input.itemCount, startRow * columns),
    endIndex: Math.min(input.itemCount, endRow * columns),
    topSpacer: startRow * rowHeight,
    bottomSpacer: Math.max(0, (totalRows - endRow) * rowHeight),
  }
}

