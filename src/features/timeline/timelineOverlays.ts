import type {
  BarMarkerMI,
  BeatMarkerMI,
  PhraseMarker,
  TrackIntelligenceAnalysis,
} from '../musicIntelligence/types'
import type { ReactTrackSection } from '../../components/vyzualz/react/ReactTypes'
import type { TimelineViewport } from './timelineViewport'
import { isTimeVisible } from './timelineViewport'

export type TimelineOverlayKind =
  | 'beat'
  | 'downbeat'
  | 'bar'
  | 'four_bar'
  | 'eight_bar'
  | 'sixteen_bar'
  | 'phrase'
  | 'section'

export interface TimelineOverlayMarker {
  id: string
  kind: Exclude<TimelineOverlayKind, 'section'>
  timeSec: number
  label?: string
  confidence?: number
}

export interface TimelineOverlayRange {
  id: string
  kind: 'section'
  startSec: number
  endSec: number
  label: string
  confidence?: number
}

export interface TimelineOverlaySource {
  authoritative: boolean
  markers: TimelineOverlayMarker[]
  ranges: TimelineOverlayRange[]
}

export interface TimelineOverlayVisibility {
  beats: boolean
  downbeats: boolean
  bars: boolean
  landmarks: boolean
  phrases: boolean
  sections: boolean
}

export const DEFAULT_TIMELINE_OVERLAY_VISIBILITY: TimelineOverlayVisibility = {
  beats: true,
  downbeats: true,
  bars: true,
  landmarks: true,
  phrases: true,
  sections: true,
}

function finiteTime(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null
}

function markerFromBeat(beat: BeatMarkerMI, index: number): TimelineOverlayMarker | null {
  const timeSec = finiteTime(beat.timeSec)
  if (timeSec === null) return null
  return {
    id: `beat-${beat.beatIndex ?? index}-${Math.round(timeSec * 1000)}`,
    kind: beat.isDownbeat ? 'downbeat' : 'beat',
    timeSec,
    confidence: beat.gridConfidence ?? beat.confidence,
  }
}

function barMarkersFromAnalysis(analysis: TrackIntelligenceAnalysis): BarMarkerMI[] {
  if (analysis.barMarkers?.length) return analysis.barMarkers
  const downbeats = analysis.downbeats.length ? analysis.downbeats : analysis.beatGrid.filter(beat => beat.isDownbeat)
  return downbeats.map((beat, index) => ({
    barIndex: beat.barIndex ?? index,
    startSec: beat.timeSec,
    endSec: downbeats[index + 1]?.timeSec ?? Math.min(analysis.durationMs / 1000, beat.timeSec + 4 * (60 / Math.max(1, analysis.bpm ?? 120))),
    gridSource: beat.gridSource ?? analysis.musicalGrid?.source ?? 'automatic',
    gridConfidence: beat.gridConfidence ?? beat.confidence,
  }))
}

function landmarkKind(barIndex: number): TimelineOverlayMarker['kind'] | null {
  const oneBased = barIndex + 1
  if (oneBased % 16 === 1) return 'sixteen_bar'
  if (oneBased % 8 === 1) return 'eight_bar'
  if (oneBased % 4 === 1) return 'four_bar'
  return null
}

function phraseMarker(phrase: PhraseMarker, index: number): TimelineOverlayMarker | null {
  const timeSec = finiteTime(phrase.timeSec)
  if (timeSec === null) return null
  return {
    id: phrase.id ?? `phrase-${index}-${Math.round(timeSec * 1000)}`,
    kind: 'phrase',
    timeSec,
    label: `${phrase.phraseLength}-bar phrase`,
    confidence: phrase.confidence,
  }
}

export function buildTimelineOverlaySource(
  analysis: TrackIntelligenceAnalysis | null | undefined,
  sections: readonly ReactTrackSection[] = [],
): TimelineOverlaySource {
  if (!analysis) {
    return {
      authoritative: false,
      markers: [],
      ranges: sections.map(section => ({
        id: section.id,
        kind: 'section' as const,
        startSec: section.startSec,
        endSec: section.endSec,
        label: section.label,
        confidence: section.analysisConfidence ?? section.confidence,
      })),
    }
  }

  const beats = analysis.beatGrid
    .map(markerFromBeat)
    .filter((marker): marker is TimelineOverlayMarker => marker !== null)
  const bars = barMarkersFromAnalysis(analysis).flatMap((bar) => {
    const timeSec = finiteTime(bar.startSec)
    if (timeSec === null) return []
    const result: TimelineOverlayMarker[] = [{
      id: `bar-${bar.barIndex}-${Math.round(timeSec * 1000)}`,
      kind: 'bar',
      timeSec,
      label: `Bar ${bar.barIndex + 1}`,
      confidence: bar.gridConfidence,
    }]
    const landmark = landmarkKind(bar.barIndex)
    if (landmark) result.push({
      id: `${landmark}-${bar.barIndex}-${Math.round(timeSec * 1000)}`,
      kind: landmark,
      timeSec,
      label: `${landmark === 'four_bar' ? 4 : landmark === 'eight_bar' ? 8 : 16}-bar`,
      confidence: bar.gridConfidence,
    })
    return result
  })
  const phrases = (analysis.phrases ?? [])
    .map(phraseMarker)
    .filter((marker): marker is TimelineOverlayMarker => marker !== null)
  const resolvedSections = sections.length > 0
    ? sections
    : analysis.sections.map(section => ({ ...section, source: 'auto' as const }))

  return {
    authoritative: analysis.beatGrid.length >= 2,
    markers: [...beats, ...bars, ...phrases].sort((a, b) => a.timeSec - b.timeSec || a.kind.localeCompare(b.kind)),
    ranges: resolvedSections.map(section => ({
      id: section.id,
      kind: 'section' as const,
      startSec: section.startSec,
      endSec: section.endSec,
      label: section.label,
      confidence: section.analysisConfidence ?? section.confidence,
    })),
  }
}

export function overlayKindVisibleAtScale(kind: TimelineOverlayKind, pixelsPerSecond: number): boolean {
  if (kind === 'section') return pixelsPerSecond >= 1
  if (kind === 'sixteen_bar') return pixelsPerSecond >= 2
  if (kind === 'phrase') return pixelsPerSecond >= 3
  if (kind === 'eight_bar') return pixelsPerSecond >= 5
  if (kind === 'four_bar') return pixelsPerSecond >= 9
  if (kind === 'bar') return pixelsPerSecond >= 18
  if (kind === 'downbeat') return pixelsPerSecond >= 32
  return pixelsPerSecond >= 72
}

function kindEnabled(kind: TimelineOverlayKind, visibility: TimelineOverlayVisibility): boolean {
  if (kind === 'beat') return visibility.beats
  if (kind === 'downbeat') return visibility.downbeats
  if (kind === 'bar') return visibility.bars
  if (kind === 'four_bar' || kind === 'eight_bar' || kind === 'sixteen_bar') return visibility.landmarks
  if (kind === 'phrase') return visibility.phrases
  return visibility.sections
}

export function selectVisibleTimelineOverlays(
  source: TimelineOverlaySource,
  viewport: TimelineViewport,
  widthPx: number,
  visibility: TimelineOverlayVisibility = DEFAULT_TIMELINE_OVERLAY_VISIBILITY,
  maxMarkers = 2_500,
): TimelineOverlaySource {
  const span = Math.max(0.001, viewport.endSec - viewport.startSec)
  const pixelsPerSecond = Math.max(0, widthPx) / span
  const markers = source.markers.filter(marker => (
    kindEnabled(marker.kind, visibility)
    && overlayKindVisibleAtScale(marker.kind, pixelsPerSecond)
    && isTimeVisible(marker.timeSec, viewport)
  )).slice(0, maxMarkers)
  const ranges = visibility.sections && overlayKindVisibleAtScale('section', pixelsPerSecond)
    ? source.ranges.filter(range => range.endSec > viewport.startSec && range.startSec < viewport.endSec)
    : []
  return { authoritative: source.authoritative, markers, ranges }
}
