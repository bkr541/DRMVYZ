import type {
  BarMusicalFeatures,
  BeatMarkerMI,
  BoundaryAlternative,
  FeatureCurve,
  PhraseMarker,
  SemanticMomentMarker,
  StructuralBoundaryCandidate,
  TrackIntelligenceAnalysis,
  TrackSectionMI,
} from '../../../../features/musicIntelligence/types'
import type { RgbWaveformAnalysis } from '../../../../features/waveform/rgbWaveformTypes'

export interface TrackTimelinePoint {
  time: number
  value: number
}

export interface TrackTimelineBeat {
  time: number
  beatIndex: number
  barIndex: number
  beatWithinBar: number
  isDownbeat: boolean
  bpm: number | null
  confidence: number | null
}

export interface TrackTimelineBar extends Partial<Omit<BarMusicalFeatures, 'barIndex' | 'gridConfidence'>> {
  barIndex: number
  barNumber: number
  start: number
  end: number
  gridConfidence: number | null
}

export interface TrackTimelineSection {
  id: string
  label: string
  type: string
  start: number
  end: number
  intensity: number
  confidence: number | null
}

export interface TrackTimelinePhrase {
  id: string
  time: number
  lengthBars: number
  confidence: number | null
}

export interface TrackTimelineEvent {
  id: string
  time: number
  type: string
  label: string
  duration: number
  confidence: number | null
  category: string
  value?: number | null
}

export interface TrackTimelineWaveformBin {
  index: number
  start: number
  center: number
  end: number
  positive: number
  negative: number
  rms: number
  low: number
  mid: number
  high: number
}

export interface TrackTimelineModel {
  meta: {
    filename: string
    bpm: number | null
    timeSignature: number | null
    dominantKey: string
    keyConfidence: number | null
    sampleRate: number | null
    channels: number | null
    analysisVersion: string
  }
  durationSec: number
  beats: TrackTimelineBeat[]
  bars: TrackTimelineBar[]
  sections: TrackTimelineSection[]
  phrases: TrackTimelinePhrase[]
  semanticMoments: TrackTimelineEvent[]
  structuralBoundaries: TrackTimelineEvent[]
  curves: Record<string, TrackTimelinePoint[]>
  waveform: TrackTimelineWaveformBin[]
  timelineEvents: TrackTimelineEvent[]
  warnings: string[]
}

const BAR_METRICS = [
  'meanEnergy',
  'peakEnergy',
  'energySlope',
  'dynamicRange',
  'bassAverage',
  'midAverage',
  'highAverage',
  'spectralFlux',
  'spectralCentroid',
  'spectralComplexity',
  'overallTransientDensity',
  'lowFrequencyOnsetDensity',
  'midFrequencyOnsetDensity',
  'highFrequencyOnsetDensity',
  'silenceRatio',
  'harmonicChange',
] as const

export type TrackTimelineBarMetric = (typeof BAR_METRICS)[number]
export const TRACK_TIMELINE_BAR_METRICS = BAR_METRICS

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nullableFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function curve(points: FeatureCurve | undefined): TrackTimelinePoint[] {
  return (points ?? [])
    .filter(point => Number.isFinite(point.timeSec) && Number.isFinite(point.value))
    .map(point => ({ time: point.timeSec, value: point.value }))
    .sort((a, b) => a.time - b.time)
}

function beatToTimeline(beat: BeatMarkerMI, index: number): TrackTimelineBeat {
  return {
    time: finite(beat.timeSec),
    beatIndex: finite(beat.beatIndex, index),
    barIndex: finite(beat.barIndex, Math.floor(index / 4)),
    beatWithinBar: finite(beat.beatWithinBar, index % 4),
    isDownbeat: Boolean(beat.isDownbeat),
    bpm: nullableFinite(beat.bpm),
    confidence: nullableFinite(beat.gridConfidence ?? beat.confidence),
  }
}

function mergeBars(analysis: TrackIntelligenceAnalysis, beats: TrackTimelineBeat[]): TrackTimelineBar[] {
  const bars = new Map<number, TrackTimelineBar>()

  for (const marker of analysis.barMarkers ?? []) {
    bars.set(marker.barIndex, {
      barIndex: marker.barIndex,
      barNumber: marker.barIndex + 1,
      start: marker.startSec,
      end: marker.endSec,
      gridConfidence: nullableFinite(marker.gridConfidence),
    })
  }

  for (const feature of analysis.barFeatures ?? []) {
    const existing = bars.get(feature.barIndex)
    bars.set(feature.barIndex, {
      ...feature,
      ...(existing ?? {}),
      barIndex: feature.barIndex,
      barNumber: feature.barIndex + 1,
      start: existing?.start ?? feature.startSec,
      end: existing?.end ?? feature.endSec,
      gridConfidence: nullableFinite(existing?.gridConfidence ?? feature.gridConfidence),
    })
  }

  if (bars.size === 0 && beats.length > 0) {
    const grouped = new Map<number, TrackTimelineBeat[]>()
    for (const beat of beats) {
      const group = grouped.get(beat.barIndex) ?? []
      group.push(beat)
      grouped.set(beat.barIndex, group)
    }
    const sortedGroups = [...grouped.entries()].sort((a, b) => a[0] - b[0])
    sortedGroups.forEach(([barIndex, group], index) => {
      const next = sortedGroups[index + 1]?.[1]?.[0]
      const start = group[0]?.time ?? 0
      const estimatedBeatPeriod = group.length > 1
        ? Math.max(0.001, (group[group.length - 1]!.time - start) / (group.length - 1))
        : 60 / Math.max(analysis.bpm ?? 120, 1)
      bars.set(barIndex, {
        barIndex,
        barNumber: barIndex + 1,
        start,
        end: next?.time ?? start + estimatedBeatPeriod * Math.max(analysis.timeSignature, 1),
        gridConfidence: group[0]?.confidence ?? null,
      })
    })
  }

  return [...bars.values()].sort((a, b) => a.start - b.start)
}

function normalizeSection(section: TrackSectionMI): TrackTimelineSection {
  return {
    id: section.id,
    label: section.label || section.type,
    type: String(section.type || 'unknown').toLowerCase(),
    start: finite(section.startSec),
    end: finite(section.endSec),
    intensity: finite(section.intensity, 0.5),
    confidence: nullableFinite(section.analysisConfidence ?? section.confidence),
  }
}

function normalizePhrase(phrase: PhraseMarker, index: number): TrackTimelinePhrase {
  return {
    id: phrase.id ?? `phrase-${index}-${phrase.timeSec}`,
    time: finite(phrase.timeSec),
    lengthBars: finite(phrase.lengthBars ?? phrase.phraseLength, 4),
    confidence: nullableFinite(phrase.confidence),
  }
}

function event(
  type: string,
  time: number,
  label: string,
  extra: Partial<Omit<TrackTimelineEvent, 'id' | 'type' | 'time' | 'label'>> = {},
): TrackTimelineEvent {
  return {
    id: `${type}:${time}:${label}`,
    type,
    time,
    label,
    duration: extra.duration ?? 0,
    confidence: extra.confidence ?? null,
    category: extra.category ?? '',
    value: extra.value,
  }
}

function semanticToEvent(moment: SemanticMomentMarker, index: number): TrackTimelineEvent {
  return {
    id: moment.id ?? `semantic-${moment.type}-${index}-${moment.timeSec}`,
    type: moment.type,
    time: finite(moment.timeSec),
    label: moment.label || moment.type.replace(/_/g, ' '),
    duration: finite(moment.durationSec),
    confidence: nullableFinite(moment.confidence),
    category: 'semantic',
  }
}

function structuralCandidateToEvent(
  candidate: StructuralBoundaryCandidate,
  kind: 'selected_boundary' | 'boundary_candidate' | 'alternative_boundary',
  index: number,
): TrackTimelineEvent {
  return {
    id: candidate.id ?? `${kind}-${index}-${candidate.timeSec}`,
    type: kind,
    time: finite(candidate.timeSec),
    label: candidate.reason || kind.replace(/_/g, ' '),
    duration: 0,
    confidence: nullableFinite(candidate.candidateConfidence),
    category: 'boundary',
    value: nullableFinite(candidate.totalScore),
  }
}

function rankedBoundaryToEvent(boundary: BoundaryAlternative, index: number): TrackTimelineEvent {
  return {
    id: boundary.id || `ranked-boundary-${index}-${boundary.timeSec}`,
    type: 'ranked_boundary_alternative',
    time: finite(boundary.timeSec),
    label: boundary.reason || 'Ranked boundary alternative',
    duration: 0,
    confidence: nullableFinite(boundary.confidence),
    category: 'boundary',
    value: nullableFinite(boundary.rank),
  }
}

function rgbBins(waveform: RgbWaveformAnalysis): TrackTimelineWaveformBin[] {
  const count = Math.max(0, waveform.binCount)
  if (count === 0) return []
  const duration = Math.max(0, waveform.durationSec)
  const bins: TrackTimelineWaveformBin[] = []
  for (let index = 0; index < count; index += 1) {
    const start = (index / count) * duration
    const end = ((index + 1) / count) * duration
    bins.push({
      index,
      start,
      center: (start + end) / 2,
      end,
      positive: finite(waveform.positivePeaks[index]),
      negative: Math.abs(finite(waveform.negativePeaks[index])),
      rms: finite(waveform.rms[index]),
      low: finite(waveform.lowEnergy[index]),
      mid: finite(waveform.midEnergy[index]),
      high: finite(waveform.highEnergy[index]),
    })
  }
  return bins
}

function extrema(points: TrackTimelinePoint[]) {
  if (!points.length) return null
  let min = points[0]!
  let max = points[0]!
  for (const point of points) {
    if (point.value < min.value) min = point
    if (point.value > max.value) max = point
  }
  return { min, max }
}

function localPeaks(points: TrackTimelinePoint[], limit = 10): TrackTimelinePoint[] {
  const candidates: TrackTimelinePoint[] = []
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!
    if (point.value >= points[index - 1]!.value && point.value > points[index + 1]!.value) {
      candidates.push(point)
    }
  }
  return candidates.sort((a, b) => b.value - a.value).slice(0, limit).sort((a, b) => a.time - b.time)
}

function deriveTimelineEvents(model: Omit<TrackTimelineModel, 'timelineEvents'>): TrackTimelineEvent[] {
  const events: TrackTimelineEvent[] = [
    event('track_start', 0, 'Track start', { category: 'track' }),
    event('track_end', model.durationSec, 'Track end', { category: 'track' }),
  ]

  model.beats.forEach((beat, index) => {
    events.push(event('beat', beat.time, `Beat ${index + 1}`, {
      category: 'grid',
      confidence: beat.confidence,
    }))
    if (beat.isDownbeat) {
      events.push(event('downbeat', beat.time, `Downbeat · bar ${beat.barIndex + 1}`, {
        category: 'grid',
        confidence: beat.confidence,
      }))
    }
  })

  model.bars.forEach((bar, index) => {
    events.push(event('bar_start', bar.start, `Bar ${bar.barNumber || index + 1} start`, {
      category: 'grid',
      duration: Math.max(0, bar.end - bar.start),
      confidence: bar.gridConfidence,
    }))
    for (const size of [4, 8, 16, 32] as const) {
      if (bar.barIndex % size === 0) {
        events.push(event(`${size}_bar_block_start`, bar.start, `${size}-bar block ${Math.floor(bar.barIndex / size) + 1} start`, {
          category: 'recurrence',
          confidence: bar.gridConfidence,
          value: size,
        }))
      }
    }
  })

  model.phrases.forEach(phrase => {
    events.push(event('phrase_boundary', phrase.time, `${phrase.lengthBars}-bar phrase boundary`, {
      category: 'phrase',
      confidence: phrase.confidence,
      value: phrase.lengthBars,
    }))
  })

  model.sections.forEach(section => {
    events.push(event('section_start', section.start, `${section.label} starts`, {
      category: 'section',
      duration: Math.max(0, section.end - section.start),
      confidence: section.confidence,
      value: section.intensity,
    }))
    events.push(event('section_end', section.end, `${section.label} ends`, {
      category: 'section',
      confidence: section.confidence,
    }))
  })

  events.push(...model.semanticMoments, ...model.structuralBoundaries)

  Object.entries(model.curves).forEach(([name, points]) => {
    if (!points.length || name.startsWith('barFeatures.')) return
    const range = extrema(points)
    if (!range) return
    events.push(event('global_maximum', range.max.time, `${name} global maximum`, {
      category: 'extrema',
      value: range.max.value,
    }))
    events.push(event('global_minimum', range.min.time, `${name} global minimum`, {
      category: 'extrema',
      value: range.min.value,
    }))
    localPeaks(points).forEach((peak, index) => {
      events.push(event('local_peak', peak.time, `${name} local peak ${index + 1}`, {
        category: 'extrema',
        value: peak.value,
      }))
    })
  })

  BAR_METRICS.forEach(metric => {
    model.bars
      .filter(bar => nullableFinite(bar[metric]) !== null)
      .slice()
      .sort((a, b) => finite(b[metric]) - finite(a[metric]))
      .slice(0, 5)
      .forEach((bar, index) => {
        events.push(event('top_bar', bar.start, `${metric} top bar #${index + 1}`, {
          category: 'bar_extrema',
          value: finite(bar[metric]),
        }))
      })
  })

  const waveformMetrics = ['positive', 'negative', 'rms', 'low', 'mid', 'high'] as const
  waveformMetrics.forEach(metric => {
    model.waveform
      .slice()
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, 10)
      .forEach((bin, index) => {
        events.push(event('rgb_bin_peak', bin.center, `${metric} waveform peak #${index + 1}`, {
          category: 'waveform',
          value: bin[metric],
        }))
      })
  })

  const seen = new Set<string>()
  return events
    .filter(item => Number.isFinite(item.time))
    .filter(item => {
      const key = `${item.type}|${item.time.toFixed(6)}|${item.label}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.time - b.time || a.type.localeCompare(b.type))
}

export function buildTrackTimelineModel(input: {
  analysis: TrackIntelligenceAnalysis
  rgbWaveform: RgbWaveformAnalysis
  filename: string
  channels?: number | null
}): TrackTimelineModel {
  const { analysis, rgbWaveform } = input
  const beats = analysis.beatGrid.map(beatToTimeline).sort((a, b) => a.time - b.time)
  const bars = mergeBars(analysis, beats)
  const sections = analysis.sections.map(normalizeSection).sort((a, b) => a.start - b.start)
  const phrases = analysis.phrases.map(normalizePhrase).sort((a, b) => a.time - b.time)
  const semanticMoments = analysis.semanticMoments.map(semanticToEvent).sort((a, b) => a.time - b.time)

  const primaryBoundaries = analysis.structuralSegmentation?.boundaryCandidates ?? []
  const structuralBoundaries = [
    ...primaryBoundaries.map((candidate, index) => structuralCandidateToEvent(
      candidate,
      candidate.selected ? 'selected_boundary' : 'boundary_candidate',
      index,
    )),
    ...(analysis.structuralSegmentation?.alternativeBoundaryCandidates ?? [])
      .map((candidate, index) => structuralCandidateToEvent(candidate, 'alternative_boundary', index)),
    ...(analysis.boundaryAlternatives ?? []).map(rankedBoundaryToEvent),
  ].sort((a, b) => a.time - b.time)

  const curves: Record<string, TrackTimelinePoint[]> = {
    'energyCurves.instant': curve(analysis.energyCurves.instant),
    'energyCurves.shortTerm': curve(analysis.energyCurves.shortTerm),
    'energyCurves.bass': curve(analysis.energyCurves.bass),
    'energyCurves.mid': curve(analysis.energyCurves.mid),
    'energyCurves.high': curve(analysis.energyCurves.high),
    'spectralCurves.centroid': curve(analysis.spectralCurves.centroid),
    'spectralCurves.flux': curve(analysis.spectralCurves.flux),
    'spectralCurves.complexity': curve(analysis.spectralCurves.complexity),
    'harmonic.pitchCurve': curve(analysis.harmonic.pitchCurve),
    'harmonic.melodyContourCurve': curve(analysis.harmonic.melodyContourCurve),
  }

  BAR_METRICS.forEach(metric => {
    const points = bars
      .map(bar => ({ time: bar.start, value: nullableFinite(bar[metric]) }))
      .filter((point): point is { time: number; value: number } => point.value !== null)
    if (points.length) curves[`barFeatures.${metric}`] = points
  })

  Object.keys(curves).forEach(key => {
    if (!curves[key]?.length) delete curves[key]
  })

  const waveform = rgbBins(rgbWaveform)
  const durationSec = Math.max(
    analysis.durationMs / 1000,
    rgbWaveform.durationSec,
    waveform[waveform.length - 1]?.end ?? 0,
    sections[sections.length - 1]?.end ?? 0,
    0.001,
  )
  const dominantKey = analysis.harmonic.dominantKey
    ? `${analysis.harmonic.dominantKey}${analysis.harmonic.dominantMode ? ` ${analysis.harmonic.dominantMode}` : ''}`
    : ''

  const base: Omit<TrackTimelineModel, 'timelineEvents'> = {
    meta: {
      filename: input.filename,
      bpm: nullableFinite(analysis.bpmUsedForGrid ?? analysis.bpm),
      timeSignature: nullableFinite(analysis.timeSignature),
      dominantKey,
      keyConfidence: nullableFinite(analysis.harmonic.keyConfidence),
      sampleRate: nullableFinite(rgbWaveform.sampleRate),
      channels: nullableFinite(input.channels),
      analysisVersion: analysis.analysisVersion,
    },
    durationSec,
    beats,
    bars,
    sections,
    phrases,
    semanticMoments,
    structuralBoundaries,
    curves,
    waveform,
    warnings: [...new Set([
      ...analysis.warnings,
      ...analysis.errors,
      ...(analysis.analysisWarnings ?? []).map(item => item.message),
    ].filter(Boolean))],
  }

  return {
    ...base,
    timelineEvents: deriveTimelineEvents(base),
  }
}
