import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import {
  getConditionSourceValue,
  getModulationSourceValue,
  getMusicIntelligenceSourceValue,
  getTriggerSourceValue,
  type MusicIntelligenceSourceValue,
} from '../../../features/musicIntelligence/selectors'
import type {
  MusicIntelligenceCapabilities,
  MusicIntelligenceFrame,
  TrackIntelligenceAnalysis,
} from '../../../features/musicIntelligence/types'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import type { ReactSectionType, ReactTrackSection } from './ReactTypes'

const EPSILON_SEC = 1e-5
const analysisIdentityCache = new WeakMap<TrackIntelligenceAnalysis, string>()
const sortedBeatGridCache = new WeakMap<TrackIntelligenceAnalysis, TrackIntelligenceAnalysis['beatGrid']>()
const resolvedSectionsCache = new WeakMap<object, { sourceIdentity: string; sections: LaserDmxShowDirectorPerformanceResolvedSection[] }>()
const macroSectionsCache = new Map<string, LaserDmxShowDirectorPerformanceMacroSection[]>()
const MAX_MACRO_SECTION_CACHE_ENTRIES = 32

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

export type LaserDmxShowDirectorPerformanceBoundaryClassification = 'none' | 'hardReset' | 'continuation' | 'variation'

export interface LaserDmxShowDirectorPerformanceBoundaryInfo {
  beatBoundary: boolean
  barBoundary: boolean
  fourBarBoundary: boolean
  eightBarBoundary: boolean
  sixteenBarBoundary: boolean
  performanceFourBarBoundary: boolean
  performanceEightBarBoundary: boolean
  performanceSixteenBarBoundary: boolean
  sectionEntry: boolean
  sectionExit: boolean
  previousSectionId: string | null
  currentSectionId: string | null
  macroSectionEntry: boolean
  macroSectionExit: boolean
  previousMacroSectionId: string | null
  currentMacroSectionId: string | null
  boundaryClassification: LaserDmxShowDirectorPerformanceBoundaryClassification
  hardMusicalReset: boolean
  microSectionContinuation: boolean
  variationBoundary: boolean
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

export interface LaserDmxShowDirectorPerformanceMacroSection {
  id: string
  label: string
  type: ReactSectionType
  startSec: number
  endSec: number
  intensity: number
  confidence: number
  source: ReactTrackSection['source']
  sectionIds: string[]
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
  value(source: string): MusicIntelligenceSourceValue
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
  macroSectionIdentity: string
  runtimeIdentity: string
  seekIdentity: string
  loopIdentity: string
  trackChangeIdentity: string
  timingDiscontinuityIdentity: string
  sections: LaserDmxShowDirectorPerformanceResolvedSection[]
  macroSections: LaserDmxShowDirectorPerformanceMacroSection[]
  resolvedSection: LaserDmxShowDirectorPerformanceResolvedSection | null
  resolvedMacroSection: LaserDmxShowDirectorPerformanceMacroSection | null
  sectionProgress: number
  sectionConfidence: number
  fineSectionOccurrence: number
  sectionOccurrence: number
  dropOccurrence: number
  macroSectionOccurrence: number
  macroDropOccurrence: number
  boundaryClassification: LaserDmxShowDirectorPerformanceBoundaryClassification
  absoluteTrackBarIndex: number
  barWithinSection: number
  barWithinMacroSection: number
  barsSinceSectionStart: number
  barsUntilSectionEnd: number
  barsSinceMacroSectionStart: number
  barsUntilMacroSectionEnd: number
  fourBarBlockIndex: number
  eightBarBlockIndex: number
  sixteenBarBlockIndex: number
  performanceFourBarBlockIndex: number
  performanceEightBarBlockIndex: number
  performanceSixteenBarBlockIndex: number
  sceneLocalVariationIndex: number
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
  const cached = analysisIdentityCache.get(analysis)
  if (cached) return cached

  let hash = 2166136261
  const add = (value: unknown) => {
    const text = String(value ?? '')
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    hash ^= 124
    hash = Math.imul(hash, 16777619)
  }
  const addCurve = (curve: readonly { timeSec: number; value: number }[]) => {
    add(curve.length)
    for (const point of curve) {
      add(point.timeSec)
      add(point.value)
    }
  }

  add(analysis.analysisVersion)
  add(analysis.createdAt)
  add(analysis.durationMs)
  add(analysis.bpm)
  add(analysis.bpmUsedForGrid)
  add(analysis.bpmConfidence)
  add(analysis.beatGridOffsetSec)
  add(analysis.timeSignature)
  add(analysis.lastGridRebuiltAt)
  for (const marker of analysis.beatGrid) {
    add(marker.timeSec)
    add(marker.confidence)
    add(marker.isDownbeat)
    add(marker.bpm)
  }
  for (const phrase of analysis.phrases) {
    add(phrase.timeSec)
    add(phrase.phraseLength)
    add(phrase.confidence)
  }
  for (const section of analysis.sections) {
    add(section.id)
    add(section.label)
    add(section.type)
    add(section.startSec)
    add(section.endSec)
    add(section.intensity)
    add(section.confidence)
    add(section.source)
    add(section.locked)
  }
  for (const curve of Object.values(analysis.energyCurves)) addCurve(curve)
  for (const curve of Object.values(analysis.spectralCurves)) addCurve(curve)
  add(analysis.harmonic.dominantKey)
  add(analysis.harmonic.dominantMode)
  add(analysis.harmonic.keyConfidence)
  for (const change of analysis.harmonic.keyChanges) {
    add(change.timeSec)
    add(change.key)
    add(change.mode)
    add(change.confidence)
  }
  for (const chord of analysis.harmonic.chordProgression) {
    add(chord.timeSec)
    add(chord.chord)
    add(chord.confidence)
    add(chord.durationSec)
  }
  addCurve(analysis.harmonic.pitchCurve)
  addCurve(analysis.harmonic.melodyContourCurve)
  if (analysis.stemCurves) {
    for (const stem of Object.values(analysis.stemCurves)) {
      addCurve(stem.energy)
      addCurve(stem.rms)
      addCurve(stem.transient)
    }
  }
  if (analysis.lyrics) {
    for (const line of analysis.lyrics.lines) {
      add(line.text)
      add(line.startMs)
      add(line.endMs)
      add(line.confidence)
      for (const word of line.words) {
        add(word.text)
        add(word.startMs)
        add(word.endMs)
        add(word.confidence)
      }
    }
  }
  for (const moment of analysis.semanticMoments) {
    add(moment.timeSec)
    add(moment.durationSec)
    add(moment.type)
    add(moment.confidence)
    add(moment.label)
    add(moment.source)
  }

  const identity = `${analysis.analysisVersion}|${analysis.createdAt}|${(hash >>> 0).toString(36)}`
  analysisIdentityCache.set(analysis, identity)
  return identity
}

export function createLaserDmxShowDirectorSectionIdentity(
  sections: readonly ReactTrackSection[] | readonly LaserDmxShowDirectorPerformanceResolvedSection[],
): string {
  return sections.map(section => [
    section.id,
    section.type,
    finite(section.startSec),
    finite(section.endSec),
    section.label ?? '',
    finite(section.intensity, 0),
    section.source ?? '',
    finite(section.confidence, 0),
  ].join(':')).join('|')
}

export function resolveLaserDmxShowDirectorPerformanceSections(
  input: Pick<BuildLaserDmxShowDirectorPerformanceContextInput,
    'analysis' | 'resolvedSections' | 'analyzedSections' | 'manualSections' | 'suppressedSectionIds' | 'durationSec'>,
): LaserDmxShowDirectorPerformanceResolvedSection[] {
  const resolvedSourceIdentity = input.resolvedSections
    ? resolvedSectionSourceIdentity(input.resolvedSections)
    : null
  if (input.resolvedSections && resolvedSourceIdentity) {
    const cached = resolvedSectionsCache.get(input.resolvedSections as object)
    if (cached?.sourceIdentity === resolvedSourceIdentity) return cached.sections
  }
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

  const resolved = sourceSections
    .map(normalizeSection)
    .filter((section): section is LaserDmxShowDirectorPerformanceResolvedSection => section !== null)
    .sort((a, b) => a.startSec - b.startSec || sectionSourcePriority(b.source) - sectionSourcePriority(a.source) || a.id.localeCompare(b.id))
  if (input.resolvedSections && resolvedSourceIdentity) {
    resolvedSectionsCache.set(input.resolvedSections as object, { sourceIdentity: resolvedSourceIdentity, sections: resolved })
  }
  return resolved
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

function resolvedSectionSourceIdentity(sections: readonly ReactTrackSection[]): string {
  return createLaserDmxShowDirectorSectionIdentity(sections)
}

function explicitMacroOccurrence(label: string, type: ReactSectionType): number | null {
  const normalized = label.trim().toLowerCase().replace(/[._-]+/g, ' ')
  const role = type === 'preDrop' ? 'pre\\s*drop' : type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = normalized.match(new RegExp(`\\b${role}\\s*(\\d+)\\s*[a-z]?\\b`, 'i'))
    ?? normalized.match(/\b(?:first|1st)\b/i)
    ?? normalized.match(/\b(?:second|2nd)\b/i)
  if (!match) return null
  if (/first|1st/i.test(match[0])) return 1
  if (/second|2nd/i.test(match[0])) return 2
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null
}

function normalizedSectionLabelFamily(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\b(part|phrase|segment|section|variation|var)\s*[a-z0-9ivx-]*$/i, '')
    .replace(/\s+(?:[a-z]|[ivx]+|\d+[a-z]?)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveAuthoritativeSectionSpans(
  sections: readonly LaserDmxShowDirectorPerformanceResolvedSection[],
): LaserDmxShowDirectorPerformanceResolvedSection[] {
  const boundaries = Array.from(new Set(sections.flatMap(section => [section.startSec, section.endSec])))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const spans: LaserDmxShowDirectorPerformanceResolvedSection[] = []
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startSec = boundaries[index]
    const endSec = boundaries[index + 1]
    if (endSec - startSec <= EPSILON_SEC) continue
    const active = resolveLaserDmxShowDirectorSectionAtTime(sections, startSec + (endSec - startSec) * 0.5)
    if (!active) continue
    const previous = spans[spans.length - 1]
    if (previous && previous.id === active.id && Math.abs(previous.endSec - startSec) <= EPSILON_SEC) {
      previous.endSec = endSec
      continue
    }
    spans.push({ ...active, startSec, endSec })
  }
  return spans
}

export function resolveLaserDmxShowDirectorMacroSections(
  sections: readonly LaserDmxShowDirectorPerformanceResolvedSection[],
  sectionIdentity = createLaserDmxShowDirectorSectionIdentity(sections),
): LaserDmxShowDirectorPerformanceMacroSection[] {
  const cached = macroSectionsCache.get(sectionIdentity)
  if (cached) return cached

  const spans = resolveAuthoritativeSectionSpans(sections)
  const groups: Array<{
    type: ReactSectionType
    startSec: number
    endSec: number
    weightedIntensity: number
    weightedConfidence: number
    duration: number
    source: ReactTrackSection['source']
    labels: string[]
    sectionIds: string[]
    explicitOccurrence: number | null
  }> = []

  for (const span of spans) {
    const duration = Math.max(EPSILON_SEC, span.endSec - span.startSec)
    const previous = groups[groups.length - 1]
    const occurrence = explicitMacroOccurrence(span.label, span.type)
    const continuous = Boolean(previous
      && previous.type === span.type
      && Math.abs(previous.endSec - span.startSec) <= EPSILON_SEC
      && !(previous.explicitOccurrence != null && occurrence != null && previous.explicitOccurrence !== occurrence))
    if (continuous && previous) {
      previous.endSec = span.endSec
      previous.weightedIntensity += span.intensity * duration
      previous.weightedConfidence += span.confidence * duration
      previous.duration += duration
      if (sectionSourcePriority(span.source) > sectionSourcePriority(previous.source)) previous.source = span.source
      if (!previous.labels.includes(span.label)) previous.labels.push(span.label)
      if (!previous.sectionIds.includes(span.id)) previous.sectionIds.push(span.id)
      if (previous.explicitOccurrence == null) previous.explicitOccurrence = occurrence
      continue
    }
    groups.push({
      type: span.type,
      startSec: span.startSec,
      endSec: span.endSec,
      weightedIntensity: span.intensity * duration,
      weightedConfidence: span.confidence * duration,
      duration,
      source: span.source,
      labels: [span.label],
      sectionIds: [span.id],
      explicitOccurrence: occurrence,
    })
  }

  const macroSections = groups.map((group, index): LaserDmxShowDirectorPerformanceMacroSection => ({
    id: `macro-${group.type}-${index + 1}-${group.startSec.toFixed(6)}-${group.sectionIds.join('+')}`,
    label: group.labels.filter(Boolean).join(' / ') || group.type,
    type: group.type,
    startSec: group.startSec,
    endSec: group.endSec,
    intensity: clamp01(group.weightedIntensity / Math.max(EPSILON_SEC, group.duration)),
    confidence: clamp01(group.weightedConfidence / Math.max(EPSILON_SEC, group.duration)),
    source: group.source,
    sectionIds: [...group.sectionIds],
  }))

  macroSectionsCache.set(sectionIdentity, macroSections)
  if (macroSectionsCache.size > MAX_MACRO_SECTION_CACHE_ENTRIES) {
    const oldest = macroSectionsCache.keys().next().value
    if (oldest) macroSectionsCache.delete(oldest)
  }
  return macroSections
}

export function resolveLaserDmxShowDirectorMacroSectionAtTime(
  macroSections: readonly LaserDmxShowDirectorPerformanceMacroSection[],
  audioTimeSec: number,
): LaserDmxShowDirectorPerformanceMacroSection | null {
  const time = Math.max(0, finite(audioTimeSec))
  return macroSections.find(section => time + EPSILON_SEC >= section.startSec && time < section.endSec - EPSILON_SEC) ?? null
}

export function resolveLaserDmxShowDirectorMacroSectionOccurrence(
  macroSections: readonly LaserDmxShowDirectorPerformanceMacroSection[],
  current: LaserDmxShowDirectorPerformanceMacroSection | null,
): number {
  if (!current) return 0
  const sameType = macroSections.filter(section => section.type === current.type)
  const index = sameType.findIndex(section => section.id === current.id)
  return index >= 0 ? index + 1 : 0
}

export function classifyLaserDmxShowDirectorPerformanceBoundary(
  sections: readonly LaserDmxShowDirectorPerformanceResolvedSection[],
  macroSections: readonly LaserDmxShowDirectorPerformanceMacroSection[],
  current: LaserDmxShowDirectorPerformanceResolvedSection | null,
  audioTimeSec: number,
): LaserDmxShowDirectorPerformanceBoundaryClassification {
  if (!current) return 'none'
  const spans = resolveAuthoritativeSectionSpans(sections)
  const time = Math.max(0, finite(audioTimeSec))
  const activeSpanIndex = spans.findIndex(span => (
    span.id === current.id
    && time + EPSILON_SEC >= span.startSec
    && time < span.endSec - EPSILON_SEC
  ))
  if (activeSpanIndex <= 0) return 'hardReset'
  const previous = spans[activeSpanIndex - 1]
  const active = spans[activeSpanIndex]
  const previousMacro = resolveLaserDmxShowDirectorMacroSectionAtTime(macroSections, Math.max(previous.startSec, previous.endSec - EPSILON_SEC * 2))
  const currentMacro = resolveLaserDmxShowDirectorMacroSectionAtTime(macroSections, active.startSec + EPSILON_SEC)
  if (!previousMacro || !currentMacro || previousMacro.id !== currentMacro.id) return 'hardReset'
  const sameLabelFamily = normalizedSectionLabelFamily(previous.label) === normalizedSectionLabelFamily(active.label)
  const intensityChanged = Math.abs(previous.intensity - active.intensity) >= 0.12
  return sameLabelFamily && !intensityChanged ? 'continuation' : 'variation'
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
  const cached = sortedBeatGridCache.get(analysis)
  if (cached) return cached
  const sorted = analysis.beatGrid
    .filter(marker => Number.isFinite(marker.timeSec))
    .slice()
    .sort((a, b) => a.timeSec - b.timeSec)
  sortedBeatGridCache.set(analysis, sorted)
  return sorted
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

function capabilityKey(value: string): keyof MusicIntelligenceCapabilities | null {
  const normalized = value.replace(/[\s_-]+/g, '').toLowerCase()
  switch (normalized) {
    case 'livebands': return 'liveBands'
    case 'rhythmevents': return 'rhythmEvents'
    case 'beatgrid': return 'beatGrid'
    case 'sections': return 'sections'
    case 'trackenergycurve': return 'trackEnergyCurve'
    case 'stemcurves': return 'stemCurves'
    case 'lyrics': return 'lyrics'
    default: return null
  }
}

function capabilityForSource(source: string): keyof MusicIntelligenceCapabilities | null {
  const explicit = capabilityKey(source)
  if (explicit) return explicit
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
    value: source => getMusicIntelligenceSourceValue(frame, source),
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
  const sectionIdentity = createLaserDmxShowDirectorSectionIdentity(sections)
  const macroSections = resolveLaserDmxShowDirectorMacroSections(sections, sectionIdentity)
  const macroSectionIdentity = macroSections.map(section => [
    section.id,
    section.type,
    section.startSec,
    section.endSec,
    section.sectionIds.join(','),
  ].join(':')).join('|')
  const resolvedSection = resolveLaserDmxShowDirectorSectionAtTime(sections, audioTimeSec)
  const resolvedMacroSection = resolveLaserDmxShowDirectorMacroSectionAtTime(macroSections, audioTimeSec)
  const boundaryClassification = classifyLaserDmxShowDirectorPerformanceBoundary(sections, macroSections, resolvedSection, audioTimeSec)
  const grid = resolveLaserDmxShowDirectorGridPosition(audioTimeSec, frame, analysis)
  const sectionStartGrid = resolvedSection
    ? resolveLaserDmxShowDirectorGridPosition(resolvedSection.startSec, frame, analysis)
    : null
  const sectionEndGrid = resolvedSection
    ? resolveLaserDmxShowDirectorGridPosition(Math.max(resolvedSection.startSec, resolvedSection.endSec - EPSILON_SEC), frame, analysis)
    : null
  const macroSectionStartGrid = resolvedMacroSection
    ? resolveLaserDmxShowDirectorGridPosition(resolvedMacroSection.startSec, frame, analysis)
    : null
  const macroSectionEndGrid = resolvedMacroSection
    ? resolveLaserDmxShowDirectorGridPosition(Math.max(resolvedMacroSection.startSec, resolvedMacroSection.endSec - EPSILON_SEC), frame, analysis)
    : null
  const barsSinceSectionStart = sectionStartGrid
    ? Math.max(0, (grid.absoluteBeat - sectionStartGrid.absoluteBeat) / grid.timeSignature)
    : 0
  const barsUntilSectionEnd = sectionEndGrid
    ? Math.max(0, (sectionEndGrid.absoluteBeat - grid.absoluteBeat) / grid.timeSignature)
    : 0
  const barsSinceMacroSectionStart = macroSectionStartGrid
    ? Math.max(0, (grid.absoluteBeat - macroSectionStartGrid.absoluteBeat) / grid.timeSignature)
    : 0
  const barsUntilMacroSectionEnd = macroSectionEndGrid
    ? Math.max(0, (macroSectionEndGrid.absoluteBeat - grid.absoluteBeat) / grid.timeSignature)
    : 0
  const sectionDuration = resolvedSection ? resolvedSection.endSec - resolvedSection.startSec : 0
  const sectionProgress = resolvedSection && sectionDuration > EPSILON_SEC
    ? clamp01((audioTimeSec - resolvedSection.startSec) / sectionDuration)
    : 0
  const fineSectionOccurrence = resolveLaserDmxShowDirectorSectionOccurrence(sections, resolvedSection)
  const macroSectionOccurrence = resolveLaserDmxShowDirectorMacroSectionOccurrence(macroSections, resolvedMacroSection)
  const macroDropOccurrence = resolvedMacroSection?.type === 'drop' ? macroSectionOccurrence : 0
  const performanceFourBarBlockIndex = Math.floor(barsSinceMacroSectionStart / 4 + EPSILON_SEC)
  const performanceEightBarBlockIndex = Math.floor(barsSinceMacroSectionStart / 8 + EPSILON_SEC)
  const performanceSixteenBarBlockIndex = Math.floor(barsSinceMacroSectionStart / 16 + EPSILON_SEC)
  const trackIdentity = input.trackIdentity ?? frame.trackId ?? frame.sourceId ?? null
  const analysisIdentity = createLaserDmxShowDirectorAnalysisIdentity(analysis)
  const seekIdentity = identityToken(input.seekIdentity, 'seek:0')
  const loopIdentity = identityToken(input.loopIdentity, 'loop:0')
  const trackChangeIdentity = identityToken(input.trackChangeIdentity, `track:${trackIdentity ?? 'none'}`)
  const timingDiscontinuityIdentity = identityToken(input.timingDiscontinuityIdentity, 'timing:0')
  const runtimeIdentity = [trackIdentity ?? 'none', analysisIdentity ?? 'none', sectionIdentity, macroSectionIdentity, seekIdentity, loopIdentity, trackChangeIdentity, timingDiscontinuityIdentity].join('::')
  const previous = input.previous ?? null
  const timingDiscontinuity = Boolean(previous && (
    previous.runtimeIdentity !== runtimeIdentity
    || audioTimeSec + EPSILON_SEC < previous.audioTimeSec
  ))
  const previousSectionId = previous?.resolvedSection?.id ?? null
  const currentSectionId = resolvedSection?.id ?? null
  const previousMacroSectionId = previous?.resolvedMacroSection?.id ?? null
  const currentMacroSectionId = resolvedMacroSection?.id ?? null
  const sectionEntry = didEnterLaserDmxShowDirectorSection(previousSectionId, currentSectionId)
  const sectionExit = didExitLaserDmxShowDirectorSection(previousSectionId, currentSectionId)
  const macroSectionEntry = didEnterLaserDmxShowDirectorSection(previousMacroSectionId, currentMacroSectionId)
  const macroSectionExit = didExitLaserDmxShowDirectorSection(previousMacroSectionId, currentMacroSectionId)
  const boundaryForFrame = sectionEntry ? boundaryClassification : 'none'
  const sameMacroClock = Boolean(previous && previousMacroSectionId !== null && previousMacroSectionId === currentMacroSectionId)
  const crossedPerformanceBlock = (previousIndex: number, currentIndex: number) => (
    !timingDiscontinuity && sameMacroClock && currentIndex > previousIndex
  )
  const intelligence = createLaserDmxShowDirectorMusicIntelligenceAdapter(frame, { analysis, hasSections: sections.length > 0 })

  return {
    audioTimeSec,
    trackIdentity,
    analysisIdentity,
    sectionIdentity,
    macroSectionIdentity,
    runtimeIdentity,
    seekIdentity,
    loopIdentity,
    trackChangeIdentity,
    timingDiscontinuityIdentity,
    ...grid,
    sections,
    macroSections,
    resolvedSection,
    resolvedMacroSection,
    sectionProgress,
    sectionConfidence: resolvedSection?.confidence ?? resolvedMacroSection?.confidence ?? 0,
    fineSectionOccurrence,
    sectionOccurrence: macroSectionOccurrence,
    dropOccurrence: macroDropOccurrence,
    macroSectionOccurrence,
    macroDropOccurrence,
    boundaryClassification,
    absoluteTrackBarIndex: grid.barIndex,
    barWithinSection: Math.floor(barsSinceSectionStart + EPSILON_SEC),
    barWithinMacroSection: Math.floor(barsSinceMacroSectionStart + EPSILON_SEC),
    barsSinceSectionStart,
    barsUntilSectionEnd,
    barsSinceMacroSectionStart,
    barsUntilMacroSectionEnd,
    fourBarBlockIndex: Math.floor(grid.barIndex / 4),
    eightBarBlockIndex: Math.floor(grid.barIndex / 8),
    sixteenBarBlockIndex: Math.floor(grid.barIndex / 16),
    performanceFourBarBlockIndex,
    performanceEightBarBlockIndex,
    performanceSixteenBarBlockIndex,
    sceneLocalVariationIndex: performanceFourBarBlockIndex % 4,
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
      performanceFourBarBoundary: previous ? crossedPerformanceBlock(previous.performanceFourBarBlockIndex, performanceFourBarBlockIndex) : false,
      performanceEightBarBoundary: previous ? crossedPerformanceBlock(previous.performanceEightBarBlockIndex, performanceEightBarBlockIndex) : false,
      performanceSixteenBarBoundary: previous ? crossedPerformanceBlock(previous.performanceSixteenBarBlockIndex, performanceSixteenBarBlockIndex) : false,
      sectionEntry,
      sectionExit,
      previousSectionId,
      currentSectionId,
      macroSectionEntry,
      macroSectionExit,
      previousMacroSectionId,
      currentMacroSectionId,
      boundaryClassification: boundaryForFrame,
      hardMusicalReset: macroSectionEntry || boundaryForFrame === 'hardReset',
      microSectionContinuation: boundaryForFrame === 'continuation',
      variationBoundary: boundaryForFrame === 'variation',
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
