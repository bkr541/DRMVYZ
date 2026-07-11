import type { BeatMarkerMI } from '../musicIntelligence/types'
import type { TimelineViewport } from './timelineViewport'

export interface WaveformCueBeatReference {
  /** Zero-based beat index in the effective beat grid. */
  beatIndex: number
  /** Zero-based bar index. */
  barIndex: number
  /** Zero-based beat position inside the bar. */
  beatInBar: number
  /** Exact timestamp of the referenced beat marker. */
  beatTimeSec: number
  /** Signed distance from the authored timestamp to the referenced beat. */
  offsetSec: number
  isDownbeat: boolean
}

export interface WaveformCueCreateRequest {
  /** Final cue timestamp after optional beat snapping. */
  timeSec: number
  /** Exact pointer-derived timestamp before optional snapping. */
  authoredTimeSec: number
  beat: WaveformCueBeatReference | null
  snappedToBeat: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Converts a client-space X coordinate into a timestamp inside the supplied
 * waveform viewport. The result is always clamped to the track duration.
 */
export function waveformClientXToTime(
  clientX: number,
  rect: Pick<DOMRect, 'left' | 'width'>,
  viewport: TimelineViewport,
  durationSec: number,
): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || !Number.isFinite(rect.width) || rect.width <= 0) {
    return 0
  }

  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
  const viewportDuration = Math.max(0, viewport.endSec - viewport.startSec)
  return clamp(viewport.startSec + ratio * viewportDuration, 0, durationSec)
}

/**
 * Finds the closest valid beat marker and derives its musical bar position.
 * Downbeat flags are used when available; a 4/4 index fallback keeps older or
 * partial grids useful when no downbeat precedes the selected beat.
 */
export function resolveNearestCueBeat(
  beatGrid: readonly BeatMarkerMI[] | null | undefined,
  authoredTimeSec: number,
): WaveformCueBeatReference | null {
  if (!beatGrid || beatGrid.length === 0 || !Number.isFinite(authoredTimeSec)) return null

  const validBeats = beatGrid
    .map((beat, sourceIndex) => ({ beat, sourceIndex }))
    .filter(({ beat }) => Number.isFinite(beat.timeSec) && beat.timeSec >= 0)

  if (validBeats.length === 0) return null

  let nearestValidIndex = 0
  let nearestDistance = Math.abs(validBeats[0].beat.timeSec - authoredTimeSec)
  for (let index = 1; index < validBeats.length; index += 1) {
    const distance = Math.abs(validBeats[index].beat.timeSec - authoredTimeSec)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestValidIndex = index
    }
  }

  const nearest = validBeats[nearestValidIndex].beat
  let lastDownbeatIndex = -1
  let barIndex = -1
  for (let index = 0; index <= nearestValidIndex; index += 1) {
    if (validBeats[index].beat.isDownbeat) {
      lastDownbeatIndex = index
      barIndex += 1
    }
  }

  const beatInBar = lastDownbeatIndex >= 0
    ? nearestValidIndex - lastDownbeatIndex
    : nearestValidIndex % 4
  const resolvedBarIndex = lastDownbeatIndex >= 0
    ? Math.max(0, barIndex)
    : Math.floor(nearestValidIndex / 4)

  return {
    beatIndex: validBeats[nearestValidIndex].sourceIndex,
    barIndex: resolvedBarIndex,
    beatInBar,
    beatTimeSec: nearest.timeSec,
    offsetSec: authoredTimeSec - nearest.timeSec,
    isDownbeat: nearest.isDownbeat,
  }
}

export function buildWaveformCueRequest(
  authoredTimeSec: number,
  beatGrid: readonly BeatMarkerMI[] | null | undefined,
  snapToBeat: boolean,
): WaveformCueCreateRequest {
  const beat = resolveNearestCueBeat(beatGrid, authoredTimeSec)
  const snapped = snapToBeat && beat != null
  return {
    timeSec: snapped ? beat.beatTimeSec : authoredTimeSec,
    authoredTimeSec,
    beat: beat
      ? {
          ...beat,
          offsetSec: snapped ? 0 : beat.offsetSec,
        }
      : null,
    snappedToBeat: snapped,
  }
}

export function formatCueBeatReference(beat: WaveformCueBeatReference | null): string | null {
  if (!beat) return null
  return `Bar ${beat.barIndex + 1} · Beat ${beat.beatInBar + 1}`
}
