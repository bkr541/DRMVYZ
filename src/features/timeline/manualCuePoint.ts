import type { VzCueMarker } from '../../types/cue'
import { cueMarkerBelongsToTrack } from '../../types/cue'
import type { WaveformCueCreateRequest } from './waveformCuePoint'

export function buildManualCueMarker(
  request: WaveformCueCreateRequest,
  existingMarkers: readonly VzCueMarker[],
  trackId: string,
): Omit<VzCueMarker, 'id'> {
  const activeManualLabels = new Set(existingMarkers
    .filter(marker => marker.source !== 'rekordbox' && cueMarkerBelongsToTrack(marker, trackId))
    .map(marker => marker.label.trim().toUpperCase()))

  let cueNumber = 1
  while (activeManualLabels.has(`CUE ${cueNumber}`)) cueNumber += 1

  const beat = request.beat
  return {
    label: `CUE ${cueNumber}`,
    time: request.timeSec,
    type: 'custom',
    color: '#e2364f',
    source: 'manual',
    kind: 'memory_cue',
    trackId,
    authoredTime: request.authoredTimeSec,
    beatIndex: beat?.beatIndex,
    barIndex: beat?.barIndex,
    beatInBar: beat?.beatInBar,
    beatTime: beat?.beatTimeSec,
    beatOffsetSec: beat?.offsetSec,
    snappedToBeat: request.snappedToBeat,
  }
}
