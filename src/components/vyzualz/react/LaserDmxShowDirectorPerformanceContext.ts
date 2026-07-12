import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import {
  getConditionSourceValue,
  getModulationSourceValue,
  getTriggerSourceValue,
} from '../../../features/musicIntelligence/selectors'
import type {
  MusicIntelligenceCapabilities,
  MusicIntelligenceFrame,
  TrackIntelligenceAnalysis,
} from '../../../features/musicIntelligence/types'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import type { ReactSectionType, ReactTrackSection } from './ReactTypes'

const EPSILON_SEC = 1e-5

export interface LaserDmxShowDirectorPerformanceGridPosition {
  bpm: number
  timeSignature: number
  beatIndex: number
  beatWithinBar: number
  beatPhase: number
  absoluteBeat: number
  barIndex: number
  absoluteBar: number
  downbeat: boolean
}

export interface LaserDmxShowDirectorPerformanceBoundaryInfo {
  beatBoundary: boolean
  barBoundary: boolean
  fourBarBoundary: boolean
  eightBarBoundary: boolean
  sixteenBarBoundary: boolean
  sectionEntry: boolean
  sectionExit: boolean
  previousSectionId: string | null
  currentSectionId: string | null
  timingDiscontinuity: boolean
}

export interface LaserDmxShowDirectorPerformanceResolvedSection {
  id: string
  label: string
  type: ReactSectionType
  startSec: number
  endSec: number
  intensity: number
  confidence: number
  source: ReactTrackSection['source']
}

export interface LaserDmxShowDirectorPerformanceMusicIntelligenceAdapter {
  frame: MusicIntelligenceFrame
  capabilities: MusicIntelligenceCapabilities
  confidence: MusicIntelligenceFrame['confidence']
  rhythm: MusicIntelligenceFrame['rhythm']
  bands: {
    raw: Pick<MusicIntelligenceFrame['bands'], 'sub' | 'bass' | 'lowMid' | 'mid' | 'high' | 'air' | 'volume'>
    normalized: Pick<MusicIntelligenceFrame['bands'], 'normalizedSub' | 'normalizedBass' | 'normalizedLowMid' | 'normalizedMid' | 'normalizedHigh' | 'normalizedAir'>
  }
  energy: MusicIntelligenceFrame['energy'] & { trend: number }
  section: MusicIntelligenceFrame['section']
  semantics: MusicIntelligenceFrame['semantics']
  harmonic: MusicIntelligenceFrame['harmonic']
  stems: MusicIntelligenceFrame['stems']
  lyrics: MusicIntelligenceFrame['lyrics']
  modulation(source: string): number
  trigger(source: string): boolean
  condition(source: string): boolean
  supports(source: string): boolean
  sourceConfidence(source: string): number
}

export interface LaserDmxShowDirectorPerformanceTimingContext extends LaserDmxShowDirectorPerformanceGridPosition {
  audioTimeSec: number
  trackIdentity: string | null
  analysisIdentity: string | null
  sectionIdentity: string
  runtimeIdentity: string
  seekIdentity: string
  loopIdentity: string
  trackChangeIdentity: string
  timingDiscontinuityIdentity: string
  resolvedSection: LaserDmxShowDirectorPerformanceResolvedSection | null
  sectionProgress: number
  sectionConfidence: number
  sectionOccurrence: number
  dropOccurrence: number
  barWithinSection: number
  barsSinceSectionStart: number
  fourBarBlockIndex: number
  eightBarBlockIndex: number
  sixteenBarBlockIndex: number
  kick: boolean
  kickStrength: number
  snare: boolean
  snareStrength: number
  hat: boolean
  hatStrength: number
  transient: number
  transientConfidence: number
  energy: number
  energyTrend: number
  boundaries: LaserDmxShowDirectorPerformanceBoundaryInfo
  intelligence: LaserDmxShowDirectorPerformanceMusicIntelligenceAdapter
}

export interface BuildLaserDmxShowDirectorPerformanceContextInput {
  audioTimeSec: number
  frame?: MusicIntelligenceFrame | null
  analysis?: TrackIntelligenceAnalysis | null
  resolvedSections?: readonly ReactTrackSection[] | null
  analyzedSections?: readonly ReactTrackSection[] | null
  manualSections?: readonly ReactTrackSection[] | null
  suppressedSectionIds?: readonly string[] | null
  durationSec?: number
  trackIdentity?: string | null
  seekIdentity?: string | number | null
  loopIdentity?: string | number | null
  trackChangeIdentity?: string | number | null
  timingDiscontinuityIdentity?: string | number | null
  previous?: LaserDmxShowDirectorPerformanceTimingContext | null
}

function finite(value: unknown, fallback = 0): number {
  const candidate = typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(candidate) ? candidate : fallback
}

function clamp01(value: unknown): number {
  return Math.max(0, Math.min(1, finite(value, 0)))
}

function identityToken(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function sectionSourcePriority(source: ReactTrackSection['source']): number {
  switch (source) {
    case 'manual':
    case 'user-created':
    case 'user-edited-auto': return 3
    case 'mock': return 2
    case 'auto': return 1
    default: return 0
  }
}

function normalizeSection(section: ReactTrackSection): LaserDmxShowDirectorPerformanceResolvedSection | null {
  const startSec = finite(section.startSec, Number.NaN)
  const endSec = finite(section.endSec, Number.NaN)
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) return null
  return {
    id: typeof section.id === 'string' && section.id.trim() ? section.id.trim() : `section-${startSec}-${endSec}`,
    label: typeof section.label === 'string' ? section.label : '',
    type: section.type ?? 'unknown',
    startSec,
    endSec,
    intensity: clamp01(section.intensity),
    confidence: clamp01(section.confidence ?? (section.source === 'auto' ? 0 : 1)),
    source: section.source,
  }
}

export function createLaserDmxShowDirectorAnalysisIdentity(
  analysis: TrackIntelligenceAnalysis | null | undefined,
): string | null {
  if (!analysis) return null
  const firstBeat = analysis.beatGrid[0]?.timeSec ?? -1
  const lastBeat = analysis.beatGrid[analysis.beatGrid.length - 1]?.timeSec ?? -1
  const firstSection = analysis.sections[0]
  const lastSection = analysis.sections[analysis.sections.length - 1]
  return [
    analysis.analysisVersion,
    analysis.createdAt,
    analysis.durationMs,
    analysis.bpm ?? 'none',
    analysis.bpmUsedForGrid ?? 'none',
    analysis.beatGridOffsetSec ?? 'none',
    analysis.timeSignature,
    analysis.beatGrid.length,
    firstBeat,
    lastBeat,
    analysis.sections.length,
    firstSection?.id ?? '',
    firstSection?.startSec ?? '',
    lastSection?.id ?? '',
    lastSection?.endSec ?? '',
    analysis.lastGridRebuiltAt ?? '',
  ].join('|')
}

export function createLaserDmxShowDirectorSectionIdentity(
  sections: readonly ReactTrackSection[] | readonly LaserDmxShowDirectorPerformanceResolvedSection[],
): string {
  return sections.map(section => [
    section.id,
    section.type,
    finite(section.startSec),
    finite(section.endSec),
    section.source ?? '',
    finite(section.confidence, 0),
  ].join(':')).join('|')
}

export function resolveLaserDmxShowDirectorPerformanceSections(
  input: Pick<BuildLaserDmxShowDirectorPerformanceContextInput,
    'analysis' | 'resolvedSections' | 'analyzedSections' | 'manualSections' | 'suppressedSectionIds' | 'durationSec'>,
): LaserDmxShowDirectorPerformanceResolvedSection[] {
  const sourceSections = input.resolvedSections
    ? [...input.resolvedSections]
    : resolveTrackSections({
        analyzedSections: input.analyzedSections
          ? [...input.analyzedSections]
          : input.analysis
            ? adaptMIAnalysis(input.analysis)
            : [],
        manualSections: input.manualSections ? [...input.manualSections] : [],
        durationSec: Math.max(0, finite(input.durationSec, (input.analysis?.durationMs ?? 0) / 1000)),
        suppressedIds: input.suppressedSectionIds ? [...input.suppressedSectionIds] : [],
      })

  return sourceSections
    .map(normalizeSection)
    .filter((section): section is LaserDmxShowDirectorPerformanceResolvedSection => section !== null)
    .sort((a, b) => a.startSec - b.startSec || sectionSourcePriority(b.source) - sectionSourcePriority(a.source) || a.id.localeCompare(b.id))
}

export function resolveLaserDmxShowDirectorSectionAtTime(
  sections: readonly LaserDmxShowDirectorPerformanceResolvedSection[],
  audioTimeSec: number,
): LaserDmxShowDirectorPerformanceResolvedSection | null {
  const time = Math.max(0, finite(audioTimeSec))
  const active = sections.filter(section => time + EPSILON_SEC >= section.startSec && time < section.endSec - EPSILON_SEC)
  if (active.length === 0) return null
  return [...active].sort((a, b) => (
    sectionSourcePriority(b.source) - sectionSourcePriority(a.source)
    || b.startSec - a.startSec
    || a.endSec - b.endSec
    || a.id.localeCompare(b.id)
  ))[0] ?? null
}

export function resolveLaserDmxShowDirectorSectionOccurrence(
  sections: readonly LaserDmxShowDirectorPerformanceResolvedSection[],
  current: LaserDmxShowDirectorPerformanceResolvedSection | null,
): number {
  if (!current) return 0
  const ordered = [...sections]
    .filter(section => section.type === current.type)
    .sort((a, b) => a.startSec - b.startSec || sectionSourcePriority(b.source) - sectionSourcePriority(a.source) || a.id.localeCompare(b.id))
    .filter((section, index, sameTypeSections) => !sameTypeSections.slice(0, index).some(previous => {
      const overlap = Math.min(previous.endSec, section.endSec) - Math.max(previous.startSec, section.startSec)
      return overlap > EPSILON_SEC && sectionSourcePriority(previous.source) > sectionSourcePriority(section.source)
    }))
  const index = ordered.findIndex(section => section.id === current.id && Math.abs(section.startSec - current.startSec) < EPSILON_SEC)
  return index >= 0 ? index + 1 : 0
}

export function resolveLaserDmxShowDirectorDropOccurrence(
  sections: readonly LaserDmxShowDirectorPerformanceResolvedSection[],
  current: LaserDmxShowDirectorPerformanceResolvedSection | null,
): number {
  return current?.type === 'drop' ? resolveLaserDmxShowDirectorSectionOccurrence(sections, current) : 0
}

function sortedBeatGrid(analysis: TrackIntelligenceAnalysis): TrackIntelligenceAnalysis['beatGrid'] {
  return analysis.beatGrid
    .filter(marker => Number.isFinite(marker.timeSec))
    .slice()
    .sort((a, b) => a.timeSec - b.timeSec)
}

function beatPositionFromGrid(
  timeSec: number,
  analysis: TrackIntelligenceAnalysis,
): { beatIndex: number; beatPhase: number; absoluteBeat: number } | null {
  const grid = sortedBeatGrid(analysis)
  if (grid.length === 0) return null
  if (timeSec < grid[0].timeSec - EPSILON_SEC) {
    const bpm = finite(analysis.bpmUsedForGrid ?? analysis.bpm, 0)
    if (bpm <= 0) return { beatIndex: 0, beatPhase: 0, absoluteBeat: 0 }
    const absoluteBeat = Math.max(0, (timeSec - finite(analysis.beatGridOffsetSec, grid[0].timeSec)) * bpm / 60)
    return { beatIndex: Math.floor(absoluteBeat), beatPhase: absoluteBeat % 1, absoluteBeat }
  }

  let low = 0
  let high = grid.length - 1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (grid[mid].timeSec <= timeSec + EPSILON_SEC) low = mid + 1
    else high = mid - 1
  }
  const index = Math.max(0, Math.min(grid.length - 1, high))
  const current = grid[index]
  const next = grid[index + 1]
  const bpm = finite(current.bpm ?? analysis.bpmUsedForGrid ?? analysis.bpm, 0)
  const fallbackDuration = bpm > 0 ? 60 / bpm : 0.5
  const beatDuration = Math.max(EPSILON_SEC, next ? next.timeSec - current.timeSec : fallbackDuration)
  const beatsFromMarker = Math.max(0, (timeSec - current.timeSec) / beatDuration)
  const absoluteBeat = index + (next ? Math.min(0.999999, beatsFromMarker) : beatsFromMarker)
  const beatIndex = Math.floor(absoluteBeat)
  return { beatIndex, beatPhase: absoluteBeat - beatIndex, absoluteBeat }
}

export function resolveLaserDmxShowDirectorGridPosition(
  audioTimeSec: number,
  frame: MusicIntelligenceFrame,
  analysis?: TrackIntelligenceAnalysis | null,
): LaserDmxShowDirectorPerformanceGridPosition {
  const time = Math.max(0, finite(audioTimeSec))
  const timeSignature = Math.max(1, Math.min(32, Math.round(finite(analysis?.timeSignature, 4))))
  const bpm = Math.max(0, finite(analysis?.bpmUsedForGrid ?? analysis?.bpm ?? frame.rhythm.bpm, 0))
  const fromGrid = analysis ? beatPositionFromGrid(time, analysis) : null
  const fromBpm = !fromGrid && bpm > 0
    ? Math.max(0, (time - finite(analysis?.beatGridOffsetSec, 0)) * bpm / 60)
    : null
  const absoluteBeat = fromGrid?.absoluteBeat
    ?? fromBpm
    ?? Math.max(0, finite(frame.rhythm.beatIndex) + clamp01(frame.rhythm.beatPhase))
  const beatIndex = Math.max(0, Math.floor(absoluteBeat + EPSILON_SEC))
  const beatPhase = Math.max(0, Math.min(0.999999, absoluteBeat - beatIndex))
  const beatWithinBar = ((beatIndex % timeSignature) + timeSignature) % timeSignature
  const absoluteBar = absoluteBeat / timeSignature
  const barIndex = Math.floor(absoluteBar + EPSILON_SEC)
  return {
    bpm,
    timeSignature,
    beatIndex,
    beatWithinBar,
    beatPhase,
    absoluteBeat,
    barIndex,
    absoluteBar,
    downbeat: beatWithinBar === 0,
  }
}

export function didCrossLaserDmxShowDirectorBeatBoundary(
  previousBeatIndex: number,
  currentBeatIndex: number,
  discontinuity = false,
): boolean {
  return !discontinuity && currentBeatIndex > previousBeatIndex
}

export function didCrossLaserDmxShowDirectorBarBoundary(
  previousBarIndex: number,
  currentBarIndex: number,
  discontinuity = false,
): boolean {
  return !discontinuity && currentBarIndex > previousBarIndex
}

export function didCrossLaserDmxShowDirectorEveryNBarsBoundary(
  previousBarIndex: number,
  currentBarIndex: number,
  intervalBars: number,
  discontinuity = false,
): boolean {
  const interval = Math.max(1, Math.round(finite(intervalBars, 1)))
  return !discontinuity
    && currentBarIndex > previousBarIndex
    && Math.floor(previousBarIndex / interval) < Math.floor(currentBarIndex / interval)
}

export function didCrossLaserDmxShowDirectorFourBarBoundary(previousBarIndex: number, currentBarIndex: number, discontinuity = false): boolean {
  return didCrossLaserDmxShowDirectorEveryNBarsBoundary(previousBarIndex, currentBarIndex, 4, discontinuity)
}

export function didCrossLaserDmxShowDirectorEightBarBoundary(previousBarIndex: number, currentBarIndex: number, discontinuity = false): boolean {
  return didCrossLaserDmxShowDirectorEveryNBarsBoundary(previousBarIndex, currentBarIndex, 8, discontinuity)
}

export function didCrossLaserDmxShowDirectorSixteenBarBoundary(previousBarIndex: number, currentBarIndex: number, discontinuity = false): boolean {
  return didCrossLaserDmxShowDirectorEveryNBarsBoundary(previousBarIndex, currentBarIndex, 16, discontinuity)
}

export function didEnterLaserDmxShowDirectorSection(previousSectionId: string | null, currentSectionId: string | null): boolean {
  return currentSectionId !== null && previousSectionId !== currentSectionId
}

export function didExitLaserDmxShowDirectorSection(previousSectionId: string | null, currentSectionId: string | null): boolean {
  return previousSectionId !== null && previousSectionId !== currentSectionId
}

function capabilityForSource(source: string): keyof MusicIntelligenceCapabilities | null {
  if (/^(sub|bass|lowMid|mid|high|air|volume|nSub|nBass|nLowMid|nMid|nHigh|nAir|audioBand:)/.test(source)) return 'liveBands'
  if (/^(kick|snare|hat|transient|kickHit|snareHit|hatHit|drumTrans|bassTrans|hasRhythmEvents)/.test(source)) return 'rhythmEvents'
  if (/^(beat|downbeat|phrase4|phrase8|phrase16|phrase32|bpm|hasBeatGrid)/.test(source)) return 'beatGrid'
  if (/^(section|isDrop|isBuild|isVerse|isIntro|isOutro|isBreakdown|isPreDrop|isBridge|isUnknown|hasSections)/.test(source)) return 'sections'
  if (/^(trackEnergy|hasTrackEnergyCurve)/.test(source)) return 'trackEnergyCurve'
  if (/^(stem|vocal|drumEnergy|bassStem|instrumentEnergy|otherStem|hasStems)/.test(source)) return 'stemCurves'
  if (/^(lyric|wordHit|lineEnter|lineExit|hasActiveLine|hasActiveWord|hasLyrics)/.test(source)) return 'lyrics'
  return null
}

function confidenceForSource(frame: MusicIntelligenceFrame, source: string): number {
  const capability = capabilityForSource(source)
  if (capability === 'beatGrid' || capability === 'rhythmEvents') return clamp01(frame.confidence.rhythm)
  if (capability === 'sections') return clamp01(Math.max(frame.confidence.section, frame.section.confidence))
  if (capability === 'stemCurves' || capability === 'lyrics') return clamp01(frame.confidence.overall)
  if (/^(key|chord|harmonic|pitch|melody|isMajor|isMinor)/.test(source)) return clamp01(frame.confidence.harmonic)
  return clamp01(frame.confidence.overall)
}

export function createLaserDmxShowDirectorMusicIntelligenceAdapter(
  sourceFrame: MusicIntelligenceFrame | null | undefined,
  availability: { analysis?: TrackIntelligenceAnalysis | null; hasSections?: boolean } = {},
): LaserDmxShowDirectorPerformanceMusicIntelligenceAdapter {
  const baseFrame = sourceFrame ?? DEFAULT_MI_FRAME
  const analysis = availability.analysis ?? null
  const capabilities: MusicIntelligenceCapabilities = {
    liveBands: baseFrame.capabilities?.liveBands === true,
    rhythmEvents: baseFrame.capabilities?.rhythmEvents === true,
    beatGrid: baseFrame.capabilities?.beatGrid === true || Boolean(analysis && (analysis.beatGrid.length > 0 || (analysis.bpm ?? 0) > 0)),
    sections: baseFrame.capabilities?.sections === true || availability.hasSections === true || Boolean(analysis?.sections.length),
    trackEnergyCurve: baseFrame.capabilities?.trackEnergyCurve === true || Boolean(analysis && Object.values(analysis.energyCurves).some(curve => curve.length > 0)),
    stemCurves: baseFrame.capabilities?.stemCurves === true || analysis?.stemCurves != null,
    lyrics: baseFrame.capabilities?.lyrics === true || Boolean(analysis?.lyrics?.lines.length),
  }
  const frame: MusicIntelligenceFrame = baseFrame.capabilities === capabilities
    ? baseFrame
    : { ...baseFrame, capabilities }
  return {
    frame,
    capabilities,
    confidence: frame.confidence,
    rhythm: frame.rhythm,
    bands: {
      raw: {
        sub: frame.bands.sub,
        bass: frame.bands.bass,
        lowMid: frame.bands.lowMid,
        mid: frame.bands.mid,
        high: frame.bands.high,
        air: frame.bands.air,
        volume: frame.bands.volume,
      },
      normalized: {
        normalizedSub: frame.bands.normalizedSub,
        normalizedBass: frame.bands.normalizedBass,
        normalizedLowMid: frame.bands.normalizedLowMid,
        normalizedMid: frame.bands.normalizedMid,
        normalizedHigh: frame.bands.normalizedHigh,
        normalizedAir: frame.bands.normalizedAir,
      },
    },
    energy: { ...frame.energy, trend: finite(frame.energy.delta, frame.energy.shortTerm - frame.energy.longTerm) },
    section: frame.section,
    semantics: frame.semantics,
    harmonic: frame.harmonic,
    stems: frame.stems,
    lyrics: frame.lyrics,
    modulation: source => getModulationSourceValue(frame, source),
    trigger: source => getTriggerSourceValue(frame, source),
    condition: source => getConditionSourceValue(frame, source),
    supports: source => {
      const capability = capabilityForSource(source)
      return capability === null || capabilities[capability]
    },
    sourceConfidence: source => confidenceForSource(frame, source),
  }
}

export function buildLaserDmxShowDirectorPerformanceContext(
  input: BuildLaserDmxShowDirectorPerformanceContextInput,
): LaserDmxShowDirectorPerformanceTimingContext {
  const frame = input.frame ?? DEFAULT_MI_FRAME
  const audioTimeSec = Math.max(0, finite(input.audioTimeSec, frame.timeSec))
  const analysis = input.analysis ?? null
  const sections = resolveLaserDmxShowDirectorPerformanceSections(input)
  const resolvedSection = resolveLaserDmxShowDirectorSectionAtTime(sections, audioTimeSec)
  const grid = resolveLaserDmxShowDirectorGridPosition(audioTimeSec, frame, analysis)
  const sectionStartGrid = resolvedSection
    ? resolveLaserDmxShowDirectorGridPosition(resolvedSection.startSec, frame, analysis)
    : null
  const barsSinceSectionStart = sectionStartGrid
    ? Math.max(0, (grid.absoluteBeat - sectionStartGrid.absoluteBeat) / grid.timeSignature)
    : 0
  const sectionDuration = resolvedSection ? resolvedSection.endSec - resolvedSection.startSec : 0
  const sectionProgress = resolvedSection && sectionDuration > EPSILON_SEC
    ? clamp01((audioTimeSec - resolvedSection.startSec) / sectionDuration)
    : 0
  const trackIdentity = input.trackIdentity ?? frame.trackId ?? frame.sourceId ?? null
  const analysisIdentity = createLaserDmxShowDirectorAnalysisIdentity(analysis)
  const sectionIdentity = createLaserDmxShowDirectorSectionIdentity(sections)
  const seekIdentity = identityToken(input.seekIdentity, 'seek:0')
  const loopIdentity = identityToken(input.loopIdentity, 'loop:0')
  const trackChangeIdentity = identityToken(input.trackChangeIdentity, `track:${trackIdentity ?? 'none'}`)
  const timingDiscontinuityIdentity = identityToken(input.timingDiscontinuityIdentity, 'timing:0')
  const runtimeIdentity = [trackIdentity ?? 'none', analysisIdentity ?? 'none', sectionIdentity, seekIdentity, loopIdentity, trackChangeIdentity, timingDiscontinuityIdentity].join('::')
  const previous = input.previous ?? null
  const timingDiscontinuity = Boolean(previous && (
    previous.runtimeIdentity !== runtimeIdentity
    || audioTimeSec + EPSILON_SEC < previous.audioTimeSec
    || Math.abs(audioTimeSec - previous.audioTimeSec) > 1
  ))
  const previousSectionId = previous?.resolvedSection?.id ?? null
  const currentSectionId = resolvedSection?.id ?? null
  const intelligence = createLaserDmxShowDirectorMusicIntelligenceAdapter(frame, { analysis, hasSections: sections.length > 0 })

  return {
    audioTimeSec,
    trackIdentity,
    analysisIdentity,
    sectionIdentity,
    runtimeIdentity,
    seekIdentity,
    loopIdentity,
    trackChangeIdentity,
    timingDiscontinuityIdentity,
    ...grid,
    resolvedSection,
    sectionProgress,
    sectionConfidence: resolvedSection?.confidence ?? 0,
    sectionOccurrence: resolveLaserDmxShowDirectorSectionOccurrence(sections, resolvedSection),
    dropOccurrence: resolveLaserDmxShowDirectorDropOccurrence(sections, resolvedSection),
    barWithinSection: Math.floor(barsSinceSectionStart + EPSILON_SEC),
    barsSinceSectionStart,
    fourBarBlockIndex: Math.floor(grid.barIndex / 4),
    eightBarBlockIndex: Math.floor(grid.barIndex / 8),
    sixteenBarBlockIndex: Math.floor(grid.barIndex / 16),
    kick: frame.rhythm.kickHit,
    kickStrength: clamp01(frame.rhythm.kickStrength),
    snare: frame.rhythm.snareHit,
    snareStrength: clamp01(frame.rhythm.snareStrength),
    hat: frame.rhythm.hatHit,
    hatStrength: clamp01(frame.rhythm.hatStrength),
    transient: clamp01(frame.rhythm.transient),
    transientConfidence: clamp01(frame.rhythm.transientConfidence),
    energy: clamp01(frame.energy.instant),
    energyTrend: finite(frame.energy.delta, frame.energy.shortTerm - frame.energy.longTerm),
    boundaries: {
      beatBoundary: previous ? didCrossLaserDmxShowDirectorBeatBoundary(previous.beatIndex, grid.beatIndex, timingDiscontinuity) : false,
      barBoundary: previous ? didCrossLaserDmxShowDirectorBarBoundary(previous.barIndex, grid.barIndex, timingDiscontinuity) : false,
      fourBarBoundary: previous ? didCrossLaserDmxShowDirectorFourBarBoundary(previous.barIndex, grid.barIndex, timingDiscontinuity) : false,
      eightBarBoundary: previous ? didCrossLaserDmxShowDirectorEightBarBoundary(previous.barIndex, grid.barIndex, timingDiscontinuity) : false,
      sixteenBarBoundary: previous ? didCrossLaserDmxShowDirectorSixteenBarBoundary(previous.barIndex, grid.barIndex, timingDiscontinuity) : false,
      sectionEntry: didEnterLaserDmxShowDirectorSection(previousSectionId, currentSectionId),
      sectionExit: didExitLaserDmxShowDirectorSection(previousSectionId, currentSectionId),
      previousSectionId,
      currentSectionId,
      timingDiscontinuity,
    },
    intelligence,
  }
}

export function buildLaserDmxShowDirectorPerformanceContextFromAudioFeatureBus(
  input: Omit<BuildLaserDmxShowDirectorPerformanceContextInput, 'frame'>,
): LaserDmxShowDirectorPerformanceTimingContext {
  return buildLaserDmxShowDirectorPerformanceContext({ ...input, frame: AudioFeatureBus.getFrame() })
}
