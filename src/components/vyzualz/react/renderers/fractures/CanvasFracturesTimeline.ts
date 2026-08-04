import type { CanvasFractureQuantizeInterval, ReactTrackSection } from '../../ReactTypes'
import { roundFractures } from './CanvasFracturesTransforms'
import type {
  CanvasFracturesTimelineInput,
  CanvasFracturesTimelinePoint,
} from './CanvasFracturesTypes'

const FALLBACK_BPM = 120
const FALLBACK_TIME_SIGNATURE = 4
const SECTION_FALLBACK_BARS = 16

function finiteNonNegative(value: number | null | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback
}

function resolveBarFromMarkers(
  positionSec: number,
  markers: CanvasFracturesTimelineInput['barMarkers'],
): { barIndex: number; progress: number; startSec: number; endSec: number } | null {
  if (!markers || markers.length === 0) return null
  let low = 0
  let high = markers.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (markers[middle].startSec <= positionSec) low = middle
    else high = middle - 1
  }
  const marker = markers[low]
  if (!marker || positionSec < marker.startSec) return null
  const startSec = finiteNonNegative(marker.startSec)
  const endSec = Math.max(startSec + 1e-4, finiteNonNegative(marker.endSec, startSec + 1))
  return {
    barIndex: Math.max(0, Math.floor(marker.barIndex)),
    progress: Math.min(1, Math.max(0, (positionSec - startSec) / (endSec - startSec))),
    startSec,
    endSec,
  }
}


function resolveBarBoundaryFromMarkers(
  markers: CanvasFracturesTimelineInput['barMarkers'],
  targetBarIndex: number,
): number | null {
  if (!markers || markers.length === 0) return null
  let low = 0
  let high = markers.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const markerBarIndex = Math.max(0, Math.floor(markers[middle].barIndex))
    if (markerBarIndex === targetBarIndex) return finiteNonNegative(markers[middle].startSec)
    if (markerBarIndex < targetBarIndex) low = middle + 1
    else high = middle - 1
  }
  return null
}

function resolveDerivedBar(input: CanvasFracturesTimelineInput, positionSec: number) {
  const bpm = finiteNonNegative(input.bpm, FALLBACK_BPM) || FALLBACK_BPM
  const beatsPerBar = Math.max(1, Math.round(finiteNonNegative(input.timeSignature, FALLBACK_TIME_SIGNATURE) || FALLBACK_TIME_SIGNATURE))
  const barDurationSec = (60 / bpm) * beatsPerBar
  const offsetSec = finiteNonNegative(input.beatGridOffsetSec, 0)
  const relative = Math.max(0, positionSec - offsetSec)
  const barIndex = Math.max(0, Math.floor(relative / barDurationSec))
  const startSec = offsetSec + barIndex * barDurationSec
  return {
    barIndex,
    progress: Math.min(1, Math.max(0, (positionSec - startSec) / barDurationSec)),
    startSec,
    endSec: startSec + barDurationSec,
  }
}

function resolveSection(
  positionSec: number,
  sections: readonly ReactTrackSection[] | undefined,
  barIndex: number,
  barStartSec: number,
  barEndSec: number,
): { index: number; startSec: number; endSec: number } {
  if (sections && sections.length > 0) {
    const foundIndex = sections.findIndex(section => positionSec >= section.startSec && positionSec < section.endSec)
    const index = foundIndex >= 0
      ? foundIndex
      : positionSec >= sections[sections.length - 1].endSec
        ? sections.length - 1
        : 0
    const section = sections[index]
    return {
      index,
      startSec: finiteNonNegative(section.startSec),
      endSec: Math.max(finiteNonNegative(section.startSec) + 1e-4, finiteNonNegative(section.endSec, barEndSec)),
    }
  }
  const index = Math.floor(barIndex / SECTION_FALLBACK_BARS)
  const barDurationSec = Math.max(1e-4, barEndSec - barStartSec)
  return {
    index,
    startSec: Math.max(0, barStartSec - (barIndex % SECTION_FALLBACK_BARS) * barDurationSec),
    endSec: barStartSec + (SECTION_FALLBACK_BARS - (barIndex % SECTION_FALLBACK_BARS)) * barDurationSec,
  }
}

function intervalBars(interval: CanvasFractureQuantizeInterval): number | null {
  switch (interval) {
    case 'beat':
    case 'bar':
      return 1
    case '2bars':
      return 2
    case '4bars':
      return 4
    case '8bars':
      return 8
    case '16bars':
      return 16
    default:
      return null
  }
}

export function resolveCanvasFracturesIntervalIdentity(input: {
  interval: CanvasFractureQuantizeInterval
  barIndex: number
  barStartSec: number
  barDurationSec: number
  sectionIndex: number
  sectionStartSec: number
  barBoundarySec?: number | null
}): { bucket: number; boundarySec: number } {
  if (input.interval === 'manualOnly') return { bucket: 0, boundarySec: 0 }
  if (input.interval === 'section') {
    return { bucket: Math.max(0, input.sectionIndex), boundarySec: Math.max(0, input.sectionStartSec) }
  }
  const bars = intervalBars(input.interval) ?? 4
  const bucket = Math.max(0, Math.floor(input.barIndex / bars))
  const bucketStartBar = bucket * bars
  return {
    bucket,
    boundarySec: input.barBoundarySec == null
      ? Math.max(0, input.barStartSec - (input.barIndex - bucketStartBar) * input.barDurationSec)
      : Math.max(0, input.barBoundarySec),
  }
}

export function resolveCanvasFracturesTimeline(input: CanvasFracturesTimelineInput): CanvasFracturesTimelinePoint {
  const livePositionSec = finiteNonNegative(input.positionSec)
  const positionSec = input.freezeLayout
    ? finiteNonNegative(input.freezePositionSec, livePositionSec)
    : livePositionSec
  const bar = resolveBarFromMarkers(positionSec, input.barMarkers) ?? resolveDerivedBar(input, positionSec)
  const section = resolveSection(positionSec, input.sections, bar.barIndex, bar.startSec, bar.endSec)
  const barDurationSec = Math.max(1e-4, bar.endSec - bar.startSec)
  const topologyBars = intervalBars(input.topologyInterval)
  const layoutBars = intervalBars(input.layoutInterval)
  const topology = resolveCanvasFracturesIntervalIdentity({
    interval: input.topologyInterval,
    barIndex: bar.barIndex,
    barStartSec: bar.startSec,
    barDurationSec,
    sectionIndex: section.index,
    sectionStartSec: section.startSec,
    barBoundarySec: topologyBars == null
      ? null
      : resolveBarBoundaryFromMarkers(input.barMarkers, Math.floor(bar.barIndex / topologyBars) * topologyBars),
  })
  const layout = resolveCanvasFracturesIntervalIdentity({
    interval: input.layoutInterval,
    barIndex: bar.barIndex,
    barStartSec: bar.startSec,
    barDurationSec,
    sectionIndex: section.index,
    sectionStartSec: section.startSec,
    barBoundarySec: layoutBars == null
      ? null
      : resolveBarBoundaryFromMarkers(input.barMarkers, Math.floor(bar.barIndex / layoutBars) * layoutBars),
  })

  return {
    positionSec: roundFractures(positionSec, 6),
    barIndex: bar.barIndex,
    barProgress: roundFractures(bar.progress, 6),
    barStartSec: roundFractures(bar.startSec, 6),
    barEndSec: roundFractures(bar.endSec, 6),
    sectionIndex: section.index,
    sectionStartSec: roundFractures(section.startSec, 6),
    sectionEndSec: roundFractures(section.endSec, 6),
    topologyBucket: topology.bucket,
    topologyBoundarySec: roundFractures(topology.boundarySec, 6),
    layoutBucket: layout.bucket,
    layoutBoundarySec: roundFractures(layout.boundarySec, 6),
  }
}

export function resolveCanvasFracturesPreviousTimeline(
  input: CanvasFracturesTimelineInput,
  boundarySec: number,
): CanvasFracturesTimelinePoint {
  return resolveCanvasFracturesTimeline({
    ...input,
    freezeLayout: false,
    positionSec: Math.max(0, boundarySec - 1e-5),
  })
}
