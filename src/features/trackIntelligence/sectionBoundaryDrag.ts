import type { ReactTrackSection } from '../../components/vyzualz/react/ReactTypes'
import type { BeatMarkerMI } from '../musicIntelligence/types'

/** How close two boundaries must be (in seconds) to be treated as shared. */
export const ADJACENCY_TOLERANCE_SEC = 0.05

export type SectionEdge = 'start' | 'end'

/**
 * Transient drag preview — held in component state during a boundary drag.
 * Never written to Zustand persistence until pointer release.
 */
export interface SectionBoundaryDragState {
  sectionId:     string
  edge:          SectionEdge
  originalStart: number
  originalEnd:   number
  previewStart:  number
  previewEnd:    number
  /** Adjacent section that shares this boundary and should move in tandem. */
  sharedNeighborId:      string | null
  originalNeighborStart: number | null
  originalNeighborEnd:   number | null
  previewNeighborStart:  number | null
  previewNeighborEnd:    number | null
}

/**
 * Returns the minimum allowed section duration in seconds.
 * When a valid BPM is available, uses one beat (clamped to ≥ 0.1 s).
 * Fallback: 0.1 s.
 */
export function computeMinDuration(bpm?: number | null): number {
  if (bpm != null && bpm > 0 && isFinite(bpm)) {
    return Math.max(0.1, 60 / bpm)
  }
  return 0.1
}

/**
 * Converts a pointer X coordinate within a timeline container to a track time.
 * Supports zoomed viewports via explicit viewportStart / viewportEnd so this
 * function is zoom-safe when full-song zoom is replaced with a windowed view.
 */
export function pointerXToTime(
  pointerX:       number,
  containerLeft:  number,
  containerWidth: number,
  viewportStart:  number,
  viewportEnd:    number,
): number {
  if (containerWidth <= 0) return viewportStart
  const frac = Math.max(0, Math.min(1, (pointerX - containerLeft) / containerWidth))
  return viewportStart + frac * (viewportEnd - viewportStart)
}

/**
 * Snaps a time value to the nearest beat marker in the effective beat grid.
 * Bypassed when `altKeyHeld` is true (free-movement modifier) or the grid is empty.
 */
export function snapToNearestBeat(
  time:       number,
  beatGrid:   BeatMarkerMI[],
  altKeyHeld: boolean,
): number {
  if (altKeyHeld || beatGrid.length === 0) return time

  let nearest = beatGrid[0].timeSec
  let minDist  = Math.abs(time - nearest)
  for (const beat of beatGrid) {
    const d = Math.abs(time - beat.timeSec)
    if (d < minDist) { minDist = d; nearest = beat.timeSec }
  }
  return nearest
}

/**
 * Finds the adjacent section that shares the boundary being dragged.
 *
 * - edge `'end'`  → next section (sections[idx+1]) whose startSec ≈ section.endSec
 * - edge `'start'`→ prev section (sections[idx-1]) whose endSec  ≈ section.startSec
 *
 * Returns `null` when no adjacent section shares the boundary within `tolerance`.
 * Sections must be sorted by startSec (ascending) before calling.
 * User-created overlay sections (non-contiguous intent) that happen to be adjacent
 * are included — adjacency is determined by position, not source.
 */
export function findSharedBoundaryNeighbor(
  sections:  ReactTrackSection[],
  sectionId: string,
  edge:      SectionEdge,
  tolerance  = ADJACENCY_TOLERANCE_SEC,
): ReactTrackSection | null {
  const idx = sections.findIndex(s => s.id === sectionId)
  if (idx < 0) return null
  const section = sections[idx]

  if (edge === 'end') {
    const next = sections[idx + 1]
    if (!next) return null
    return Math.abs(next.startSec - section.endSec) <= tolerance ? next : null
  } else {
    const prev = sections[idx - 1]
    if (!prev) return null
    return Math.abs(prev.endSec - section.startSec) <= tolerance ? prev : null
  }
}

/**
 * Clamps a proposed new boundary time so that:
 *  1. The section duration never falls below `minDuration`.
 *  2. The value stays within [0, trackDuration].
 *
 * `originalSection` provides the fixed opposite boundary used as the hard limit.
 */
export function clampEdge(
  edge:            SectionEdge,
  rawTime:         number,
  originalSection: { startSec: number; endSec: number },
  minDuration:     number,
  trackDuration:   number,
): number {
  if (edge === 'start') {
    const maxStart = originalSection.endSec - minDuration
    return Math.max(0, Math.min(maxStart, rawTime))
  } else {
    const minEnd = originalSection.startSec + minDuration
    return Math.max(minEnd, Math.min(trackDuration, rawTime))
  }
}

/**
 * Returns the keyboard nudge step size for boundary adjustments.
 * Base step: one beat when BPM is valid, else 0.1 s.
 * Shift key multiplies the step by 4 for coarser movement.
 */
export function computeKeyStep(bpm: number | null | undefined, shiftHeld: boolean): number {
  const base = bpm != null && bpm > 0 && isFinite(bpm) ? 60 / bpm : 0.1
  return shiftHeld ? base * 4 : base
}
