// Pure coordinate utilities for the LaserDMX Beam Matrix editor.
// No imports, no side effects — safe to call from any context including tests.

import { LASER_DMX_MATRIX_COLUMNS, LASER_DMX_MATRIX_ROWS } from './ReactTypes'
import type { LaserDmxMatrixGridTarget, LaserDmxMatrixStageTarget, LaserDmxMatrixTarget } from './ReactTypes'

const COLS = LASER_DMX_MATRIX_COLUMNS  // 15
const ROWS = LASER_DMX_MATRIX_ROWS     // 10

// ── Grid ↔ normalized ─────────────────────────────────────────────────────────

/** Cell center in normalized [0,1] output space. col/row are 1-indexed. */
export function gridCellToNormalized(column: number, row: number): { x: number; y: number } {
  return {
    x: (column - 0.5) / COLS,
    y: (row    - 0.5) / ROWS,
  }
}

/**
 * Nearest grid cell for a normalized point. Returns clamped 1-indexed col/row.
 * Works even for points outside [0,1] — result is clamped to grid bounds.
 */
export function normalizedToNearestGridCell(x: number, y: number): { column: number; row: number } {
  const column = Math.max(1, Math.min(COLS, Math.round(x * COLS + 0.5)))
  const row    = Math.max(1, Math.min(ROWS, Math.round(y * ROWS + 0.5)))
  return { column, row }
}

// ── Stage ↔ editor-view ───────────────────────────────────────────────────────
// The editor "view" is the full overlay rectangle (width × height pixels).
// With overscanAmount = 0 the view is identical to the output [0,1] space.
// With overscanAmount > 0 the view shows [-overscan, 1+overscan] in both axes.

function viewRange(overscanAmount: number) {
  const lo = -overscanAmount
  const span = 1 + 2 * overscanAmount
  return { lo, span }
}

/** Convert a stage coordinate to a fraction of the editor view [0,1]. */
export function stageToViewFraction(
  stageX: number,
  stageY: number,
  overscanAmount: number,
): { fx: number; fy: number } {
  const { lo, span } = viewRange(overscanAmount)
  return {
    fx: (stageX - lo) / span,
    fy: (stageY - lo) / span,
  }
}

/** Convert a fraction of the editor view [0,1] back to a stage coordinate. */
export function viewFractionToStage(
  fx: number,
  fy: number,
  overscanAmount: number,
): { stageX: number; stageY: number } {
  const { lo, span } = viewRange(overscanAmount)
  return {
    stageX: fx * span + lo,
    stageY: fy * span + lo,
  }
}

/** Convert a stage target (grid or stage) to editor-view pixel position. */
export function targetToViewPx(
  target: LaserDmxMatrixTarget,
  viewWidth: number,
  viewHeight: number,
  overscanAmount: number,
): { px: number; py: number } {
  let normX: number, normY: number
  if (target.kind === 'grid') {
    const n = gridCellToNormalized(target.column, target.row)
    normX = n.x
    normY = n.y
  } else {
    normX = target.x
    normY = target.y
  }
  const { fx, fy } = stageToViewFraction(normX, normY, overscanAmount)
  return { px: fx * viewWidth, py: fy * viewHeight }
}

/** Convert a grid anchor origin to editor-view pixel position. */
export function originToViewPx(
  column: number, row: number,
  viewWidth: number, viewHeight: number,
  overscanAmount: number,
): { px: number; py: number } {
  const { x, y } = gridCellToNormalized(column, row)
  const { fx, fy } = stageToViewFraction(x, y, overscanAmount)
  return { px: fx * viewWidth, py: fy * viewHeight }
}

/** Convert a pointer position within the overlay to a normalized output coordinate. */
export function viewPxToNormalized(
  px: number, py: number,
  viewWidth: number, viewHeight: number,
  overscanAmount: number,
): { x: number; y: number } {
  const { stageX: x, stageY: y } = viewFractionToStage(px / viewWidth, py / viewHeight, overscanAmount)
  return { x, y }
}

/** Convert a pointer position to the nearest grid cell. */
export function viewPxToNearestGridCell(
  px: number, py: number,
  viewWidth: number, viewHeight: number,
  overscanAmount: number,
): { column: number; row: number } {
  const { x, y } = viewPxToNormalized(px, py, viewWidth, viewHeight, overscanAmount)
  return normalizedToNearestGridCell(x, y)
}

/** Convert a pointer position to a stage target (unclamped). */
export function viewPxToStageTarget(
  px: number, py: number,
  viewWidth: number, viewHeight: number,
  overscanAmount: number,
  currentZ = 0,
): LaserDmxMatrixStageTarget {
  const { x, y } = viewPxToNormalized(px, py, viewWidth, viewHeight, overscanAmount)
  const clamp = (v: number) => Math.max(-1, Math.min(2, v))
  return { kind: 'stage', x: clamp(x), y: clamp(y), z: currentZ }
}

/** Convert a pointer position to a grid target. */
export function viewPxToGridTarget(
  px: number, py: number,
  viewWidth: number, viewHeight: number,
  overscanAmount: number,
  currentZ = 0,
): LaserDmxMatrixGridTarget {
  const { column, row } = viewPxToNearestGridCell(px, py, viewWidth, viewHeight, overscanAmount)
  return { kind: 'grid', column, row, z: currentZ }
}

/** True when the normalized coordinate is inside the output area [0,1]. */
export function isPointInsideOutput(x: number, y: number): boolean {
  return x >= 0 && x <= 1 && y >= 0 && y <= 1
}

/** Output rectangle in editor-view fractions (useful for drawing the boundary box). */
export function outputRectInView(overscanAmount: number): {
  left: number; top: number; right: number; bottom: number
} {
  const { lo, span } = viewRange(overscanAmount)
  return {
    left:   (0 - lo) / span,
    top:    (0 - lo) / span,
    right:  (1 - lo) / span,
    bottom: (1 - lo) / span,
  }
}
