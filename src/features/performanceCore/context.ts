import { AudioFeatureBus } from '../musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../musicIntelligence/constants'
import {
  getConditionSourceValue,
  getModulationSourceValue,
  getMusicIntelligenceSourceValue,
  getTriggerSourceValue,
  type MusicIntelligenceSourceValue,
} from '../musicIntelligence/selectors'
import type {
  MusicIntelligenceCapabilities,
  MusicIntelligenceFrame,
  PhraseMarker,
  ReactSectionType,
  ReactTrackSection,
  SemanticMomentMarker,
  TrackAnalysisCapabilities,
  TrackIntelligenceAnalysis,
} from '../musicIntelligence/types'
import { adaptMIAnalysis, resolveTrackSections } from '../trackIntelligence/trackMapAdapter'
import { resolveSharedPerformanceTransportTransition } from './transport'

const EPSILON_SEC = 1e-5
const analysisIdentityCache = new WeakMap<TrackIntelligenceAnalysis, string>()
const sortedBeatGridCache = new WeakMap<TrackIntelligenceAnalysis, TrackIntelligenceAnalysis['beatGrid']>()
const resolvedSectionsCache = new WeakMap<object, { sourceIdentity: string; sections: SharedPerformanceResolvedSection[] }>()
const macroSectionsCache = new Map<string, SharedPerformanceMacroSection[]>()
const MAX_MACRO_SECTION_CACHE_ENTRIES = 32

export interface SharedPerformanceGridPosition {
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

export type SharedPerformanceBoundaryClassification = 'none' | 'hardReset' | 'continuation' | 'variation'
export type SharedPerformanceSectionPhase = 'none' | 'entry' | 'body' | 'exit'

export interface SharedPerformanceBoundaryInfo {
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
  boundaryClassification: SharedPerformanceBoundaryClassification
  hardMusicalReset: boolean
  microSectionContinuation: boolean
  variationBoundary: boolean
  timingDiscontinuity: boolean
}

export interface SharedPerformanceResolvedSection {
  id: string
  label: string
  type: ReactSectionType
  startSec: number
  endSec: number
  intensity: number
  confidence: number
  source: ReactTrackSection['source']
  familyId: string | null
  occurrenceIndex: number | null
  dropConfidence: number
}

export interface SharedPerformanceSectionBarSpan {
  id: string
  type: ReactSectionType
  startBar: number
  endBar: number
}

export interface SharedPerformanceMacroSection {
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

export interface SharedPerformanceMusicIntelligenceAdapter {
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

export interface SharedPerformanceContext extends SharedPerformanceGridPosition {
  audioTimeSec: number
  trackIdentity: string | null
  analysisIdentity: string | null
  analysisRevision: string | null
  timelineRevision: string
  deterministicVariationSeed: number
  sectionIdentity: string
  macroSectionIdentity: string
  runtimeIdentity: string
  seekIdentity: string
  loopIdentity: string
  trackChangeIdentity: string
  timingDiscontinuityIdentity: string
  sections: SharedPerformanceResolvedSection[]
  /** Non-overlapping authoritative section spans projected onto the musical bar grid. */
  sectionBarTimeline: SharedPerformanceSectionBarSpan[]
  macroSections: SharedPerformanceMacroSection[]
  resolvedSection: SharedPerformanceResolvedSection | null
  resolvedMacroSection: SharedPerformanceMacroSection | null
  sectionType: ReactSectionType | null
  sectionId: string | null
  sectionFamily: string | null
  sectionPhase: SharedPerformanceSectionPhase
  macroSectionType: ReactSectionType | null
  macroSectionProgress: number
  macroSectionPhase: SharedPerformanceSectionPhase
  sectionProgress: number
  sectionConfidence: number
  fineSectionOccurrence: number
  sectionOccurrence: number
  dropOccurrence: number
  macroSectionOccurrence: number
  macroDropOccurrence: number
  boundaryClassification: SharedPerformanceBoundaryClassification
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
  fourBarProgress: number
  eightBarProgress: number
  sixteenBarProgress: number
  phraseIndex: number
  phraseLengthBars: number
  phraseProgress: number
  sceneLocalVariationIndex: number
  kick: boolean
  kickStrength: number
  snare: boolean
  snareStrength: number
  hat: boolean
  hatStrength: number
  transient: number
  transientConfidence: number
  bass: number
  mid: number
  high: number
  energy: number
  trackRelativeEnergy: number
  energyTrend: number
  spectralFlux: number
  tension: number
  complexity: number
  buildProgress: number
  dropImpact: number
  vocalEnergy: number
  upcomingSemanticMoments: readonly SemanticMomentMarker[]
  seekDetected: boolean
  loopWrapDetected: boolean
  trackReplacementDetected: boolean
  capabilities: MusicIntelligenceCapabilities
  analysisCapabilities: TrackAnalysisCapabilities | null
  confidence: {
    overall: number
    rhythm: number
    section: number
    grid: number
    downbeat: number
    phrase: number
    semantics: number
  }
  boundaries: SharedPerformanceBoundaryInfo
  intelligence: SharedPerformanceMusicIntelligenceAdapter
}

export interface BuildSharedPerformanceContextInput {
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
  previous?: SharedPerformanceContext | null
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

function stableSeed(...parts: Array<string | number | null | undefined>): number {
  let hash = 2166136261
  for (const part of parts) {
    const text = String(part ?? '')
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    hash ^= 124
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function phaseForBars(barsSinceStart: number, barsUntilEnd: number, active: boolean): SharedPerformanceSectionPhase {
  if (!active) return 'none'
  if (barsSinceStart < 1) return 'entry'
  if (barsUntilEnd < 1) return 'exit'
  return 'body'
}

function resolvePhrasePosition(
  audioTimeSec: number,
  bpm: number,
  frame: MusicIntelligenceFrame,
  analysis: TrackIntelligenceAnalysis | null,
): { index: number; lengthBars: number; progress: number; confidence: number } {
  const markers = (frame.phraseMarkers?.length ? frame.phraseMarkers : analysis?.phrases) ?? []
  let current: PhraseMarker | null = null
  let currentIndex = -1
  let nextTimeSec = Number.NaN
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index]
    if (marker.timeSec <= audioTimeSec + EPSILON_SEC) {
      current = marker
      currentIndex = index
      continue
    }
    nextTimeSec = marker.timeSec
    break
  }
  if (!current) {
    return {
      index: Math.max(0, Math.floor(finite(frame.rhythm.barIndex) / 4)),
      lengthBars: 4,
      progress: clamp01(frame.rhythm.phrase16Progress),
      confidence: clamp01(frame.confidence.rhythm),
    }
  }
  const lengthBars = Math.max(1, finite(current.lengthBars ?? current.phraseLength, 4))
  const estimatedDuration = bpm > 0 ? (60 / bpm) * 4 * lengthBars : lengthBars * 2
  const endSec = Number.isFinite(nextTimeSec) && nextTimeSec > current.timeSec
    ? nextTimeSec
    : current.timeSec + estimatedDuration
  return {
    index: Math.max(0, currentIndex),
    lengthBars,
    progress: clamp01((audioTimeSec - current.timeSec) / Math.max(EPSILON_SEC, endSec - current.timeSec)),
    confidence: clamp01(current.confidence),
  }
}

function resolveUpcomingSemanticMoments(
  audioTimeSec: number,
  frame: MusicIntelligenceFrame,
  analysis: TrackIntelligenceAnalysis | null,
): readonly SemanticMomentMarker[] {
  const moments = (frame.semanticMoments?.length ? frame.semanticMoments : analysis?.semanticMoments) ?? []
  const upcoming: SemanticMomentMarker[] = []
  for (const moment of moments) {
    if (moment.timeSec + EPSILON_SEC < audioTimeSec) continue
    upcoming.push(moment)
    if (upcoming.length >= 4) break
  }
  return upcoming
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

function normalizeSection(section: ReactTrackSection): SharedPerformanceResolvedSection | null {
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
    familyId: section.interpretation?.familyId?.trim() || null,
    occurrenceIndex: Number.isFinite(section.interpretation?.occurrenceIndex)
      ? Math.max(1, Math.floor(section.interpretation?.occurrenceIndex ?? 1))
      : null,
    dropConfidence: clamp01(section.dropConfidence),
  }
}

export function createSharedPerformanceAnalysisIdentity(
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

export function createSharedPerformanceSectionIdentity(
  sections: readonly ReactTrackSection[] | readonly SharedPerformanceResolvedSection[],
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

export function resolveSharedPerformanceSections(
  input: Pick<BuildSharedPerformanceContextInput,
    'analysis' | 'resolvedSections' | 'analyzedSections' | 'manualSections' | 'suppressedSectionIds' | 'durationSec'>,
): SharedPerformanceResolvedSection[] {
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
    .filter((section): section is SharedPerformanceResolvedSection => section !== null)
    .sort((a, b) => a.startSec - b.startSec || sectionSourcePriority(b.source) - sectionSourcePriority(a.source) || a.id.localeCompare(b.id))
  if (input.resolvedSections && resolvedSourceIdentity) {
    resolvedSectionsCache.set(input.resolvedSections as object, { sourceIdentity: resolvedSourceIdentity, sections: resolved })
  }
  return resolved
}

export function resolveSharedPerformanceSectionAtTime(
  sections: readonly SharedPerformanceResolvedSection[],
  audioTimeSec: number,
): SharedPerformanceResolvedSection | null {
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
  return createSharedPerformanceSectionIdentity(sections)
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
  sections: readonly SharedPerformanceResolvedSection[],
): SharedPerformanceResolvedSection[] {
  const boundaries = Array.from(new Set(sections.flatMap(section => [section.startSec, section.endSec])))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const spans: SharedPerformanceResolvedSection[] = []
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startSec = boundaries[index]
    const endSec = boundaries[index + 1]
    if (endSec - startSec <= EPSILON_SEC) continue
    const active = resolveSharedPerformanceSectionAtTime(sections, startSec + (endSec - startSec) * 0.5)
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

export function resolveSharedPerformanceMacroSections(
  sections: readonly SharedPerformanceResolvedSection[],
  sectionIdentity = createSharedPerformanceSectionIdentity(sections),
): SharedPerformanceMacroSection[] {
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

  const macroSections = groups.map((group, index): SharedPerformanceMacroSection => ({
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

export function resolveSharedPerformanceMacroSectionAtTime(
  macroSections: readonly SharedPerformanceMacroSection[],
  audioTimeSec: number,
): SharedPerformanceMacroSection | null {
  const time = Math.max(0, finite(audioTimeSec))
  return macroSections.find(section => time + EPSILON_SEC >= section.startSec && time < section.endSec - EPSILON_SEC) ?? null
}

export function resolveSharedPerformanceMacroSectionOccurrence(
  macroSections: readonly SharedPerformanceMacroSection[],
  current: SharedPerformanceMacroSection | null,
): number {
  if (!current) return 0
  const sameType = macroSections.filter(section => section.type === current.type)
  const index = sameType.findIndex(section => section.id === current.id)
  return index >= 0 ? index + 1 : 0
}

export function classifySharedPerformanceBoundary(
  sections: readonly SharedPerformanceResolvedSection[],
  macroSections: readonly SharedPerformanceMacroSection[],
  current: SharedPerformanceResolvedSection | null,
  audioTimeSec: number,
): SharedPerformanceBoundaryClassification {
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
  const previousMacro = resolveSharedPerformanceMacroSectionAtTime(macroSections, Math.max(previous.startSec, previous.endSec - EPSILON_SEC * 2))
  const currentMacro = resolveSharedPerformanceMacroSectionAtTime(macroSections, active.startSec + EPSILON_SEC)
  if (!previousMacro || !currentMacro || previousMacro.id !== currentMacro.id) return 'hardReset'
  const sameLabelFamily = normalizedSectionLabelFamily(previous.label) === normalizedSectionLabelFamily(active.label)
  const intensityChanged = Math.abs(previous.intensity - active.intensity) >= 0.12
  return sameLabelFamily && !intensityChanged ? 'continuation' : 'variation'
}

export function resolveSharedPerformanceSectionOccurrence(
  sections: readonly SharedPerformanceResolvedSection[],
  current: SharedPerformanceResolvedSection | null,
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

export function resolveSharedPerformanceDropOccurrence(
  sections: readonly SharedPerformanceResolvedSection[],
  current: SharedPerformanceResolvedSection | null,
): number {
  return current?.type === 'drop' ? resolveSharedPerformanceSectionOccurrence(sections, current) : 0
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

export function resolveSharedPerformanceGridPosition(
  audioTimeSec: number,
  frame: MusicIntelligenceFrame,
  analysis?: TrackIntelligenceAnalysis | null,
): SharedPerformanceGridPosition {
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

export function didCrossSharedPerformanceBeatBoundary(
  previousBeatIndex: number,
  currentBeatIndex: number,
  discontinuity = false,
): boolean {
  return !discontinuity && currentBeatIndex > previousBeatIndex
}

export function didCrossSharedPerformanceBarBoundary(
  previousBarIndex: number,
  currentBarIndex: number,
  discontinuity = false,
): boolean {
  return !discontinuity && currentBarIndex > previousBarIndex
}

export function didCrossSharedPerformanceEveryNBarsBoundary(
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

export function didCrossSharedPerformanceFourBarBoundary(previousBarIndex: number, currentBarIndex: number, discontinuity = false): boolean {
  return didCrossSharedPerformanceEveryNBarsBoundary(previousBarIndex, currentBarIndex, 4, discontinuity)
}

export function didCrossSharedPerformanceEightBarBoundary(previousBarIndex: number, currentBarIndex: number, discontinuity = false): boolean {
  return didCrossSharedPerformanceEveryNBarsBoundary(previousBarIndex, currentBarIndex, 8, discontinuity)
}

export function didCrossSharedPerformanceSixteenBarBoundary(previousBarIndex: number, currentBarIndex: number, discontinuity = false): boolean {
  return didCrossSharedPerformanceEveryNBarsBoundary(previousBarIndex, currentBarIndex, 16, discontinuity)
}

export function didEnterSharedPerformanceSection(previousSectionId: string | null, currentSectionId: string | null): boolean {
  return currentSectionId !== null && previousSectionId !== currentSectionId
}

export function didExitSharedPerformanceSection(previousSectionId: string | null, currentSectionId: string | null): boolean {
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

export function createSharedPerformanceMusicIntelligenceAdapter(
  sourceFrame: MusicIntelligenceFrame | null | undefined,
  availability: { analysis?: TrackIntelligenceAnalysis | null; hasSections?: boolean } = {},
): SharedPerformanceMusicIntelligenceAdapter {
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

export function buildSharedPerformanceContext(
  input: BuildSharedPerformanceContextInput,
): SharedPerformanceContext {
  const frame = input.frame ?? DEFAULT_MI_FRAME
  const audioTimeSec = Math.max(0, finite(input.audioTimeSec, frame.timeSec))
  const analysis = input.analysis ?? null
  const sections = resolveSharedPerformanceSections(input)
  const sectionIdentity = createSharedPerformanceSectionIdentity(sections)
  const macroSections = resolveSharedPerformanceMacroSections(sections, sectionIdentity)
  const macroSectionIdentity = macroSections.map(section => [
    section.id,
    section.type,
    section.startSec,
    section.endSec,
    section.sectionIds.join(','),
  ].join(':')).join('|')
  const resolvedSection = resolveSharedPerformanceSectionAtTime(sections, audioTimeSec)
  const resolvedMacroSection = resolveSharedPerformanceMacroSectionAtTime(macroSections, audioTimeSec)
  const boundaryClassification = classifySharedPerformanceBoundary(sections, macroSections, resolvedSection, audioTimeSec)
  const grid = resolveSharedPerformanceGridPosition(audioTimeSec, frame, analysis)
  const sectionBarTimeline = resolveAuthoritativeSectionSpans(sections).map(section => ({
    id: section.id,
    type: section.type,
    startBar: resolveSharedPerformanceGridPosition(section.startSec, frame, analysis).absoluteBar,
    endBar: resolveSharedPerformanceGridPosition(section.endSec, frame, analysis).absoluteBar,
  }))
  const sectionStartGrid = resolvedSection
    ? resolveSharedPerformanceGridPosition(resolvedSection.startSec, frame, analysis)
    : null
  const sectionEndGrid = resolvedSection
    ? resolveSharedPerformanceGridPosition(Math.max(resolvedSection.startSec, resolvedSection.endSec - EPSILON_SEC), frame, analysis)
    : null
  const macroSectionStartGrid = resolvedMacroSection
    ? resolveSharedPerformanceGridPosition(resolvedMacroSection.startSec, frame, analysis)
    : null
  const macroSectionEndGrid = resolvedMacroSection
    ? resolveSharedPerformanceGridPosition(Math.max(resolvedMacroSection.startSec, resolvedMacroSection.endSec - EPSILON_SEC), frame, analysis)
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
  const fineSectionOccurrence = resolveSharedPerformanceSectionOccurrence(sections, resolvedSection)
  const macroSectionOccurrence = resolveSharedPerformanceMacroSectionOccurrence(macroSections, resolvedMacroSection)
  const macroDropOccurrence = resolvedMacroSection?.type === 'drop' ? macroSectionOccurrence : 0
  const performanceFourBarBlockIndex = Math.floor(barsSinceMacroSectionStart / 4 + EPSILON_SEC)
  const performanceEightBarBlockIndex = Math.floor(barsSinceMacroSectionStart / 8 + EPSILON_SEC)
  const performanceSixteenBarBlockIndex = Math.floor(barsSinceMacroSectionStart / 16 + EPSILON_SEC)
  const trackIdentity = input.trackIdentity ?? frame.trackId ?? frame.sourceId ?? null
  const analysisIdentity = createSharedPerformanceAnalysisIdentity(analysis)
  const seekIdentity = identityToken(input.seekIdentity, 'seek:0')
  const loopIdentity = identityToken(input.loopIdentity, 'loop:0')
  const trackChangeIdentity = identityToken(input.trackChangeIdentity, `track:${trackIdentity ?? 'none'}`)
  const timingDiscontinuityIdentity = identityToken(input.timingDiscontinuityIdentity, 'timing:0')
  const runtimeIdentity = [trackIdentity ?? 'none', analysisIdentity ?? 'none', sectionIdentity, macroSectionIdentity, seekIdentity, loopIdentity, trackChangeIdentity, timingDiscontinuityIdentity].join('::')
  const previous = input.previous ?? null
  const transportTransition = resolveSharedPerformanceTransportTransition(previous, {
    audioTimeSec,
    trackIdentity,
    seekIdentity,
    loopIdentity,
    trackChangeIdentity,
    runtimeIdentity,
  })
  const timingDiscontinuity = transportTransition.timingDiscontinuity
  const previousSectionId = previous?.resolvedSection?.id ?? null
  const currentSectionId = resolvedSection?.id ?? null
  const previousMacroSectionId = previous?.resolvedMacroSection?.id ?? null
  const currentMacroSectionId = resolvedMacroSection?.id ?? null
  const sectionEntry = didEnterSharedPerformanceSection(previousSectionId, currentSectionId)
  const sectionExit = didExitSharedPerformanceSection(previousSectionId, currentSectionId)
  const macroSectionEntry = didEnterSharedPerformanceSection(previousMacroSectionId, currentMacroSectionId)
  const macroSectionExit = didExitSharedPerformanceSection(previousMacroSectionId, currentMacroSectionId)
  const boundaryForFrame = sectionEntry ? boundaryClassification : 'none'
  const sameMacroClock = Boolean(previous && previousMacroSectionId !== null && previousMacroSectionId === currentMacroSectionId)
  const crossedPerformanceBlock = (previousIndex: number, currentIndex: number) => (
    !timingDiscontinuity && sameMacroClock && currentIndex > previousIndex
  )
  const intelligence = createSharedPerformanceMusicIntelligenceAdapter(frame, { analysis, hasSections: sections.length > 0 })
  const macroSectionDuration = resolvedMacroSection ? resolvedMacroSection.endSec - resolvedMacroSection.startSec : 0
  const macroSectionProgress = resolvedMacroSection && macroSectionDuration > EPSILON_SEC
    ? clamp01((audioTimeSec - resolvedMacroSection.startSec) / macroSectionDuration)
    : 0
  const phrase = resolvePhrasePosition(audioTimeSec, grid.bpm, frame, analysis)
  const upcomingSemanticMoments = resolveUpcomingSemanticMoments(audioTimeSec, frame, analysis)
  const { seekDetected, loopWrapDetected, trackReplacementDetected } = transportTransition
  const gridConfidence = clamp01(frame.gridConfidence?.barGrid ?? analysis?.barGridConfidence ?? frame.confidence.rhythm)
  const downbeatConfidence = clamp01(frame.gridConfidence?.downbeatPhase ?? analysis?.downbeatPhaseConfidence ?? gridConfidence)
  const semanticConfidence = clamp01(Math.max(
    frame.semantics.buildConfidence,
    frame.semantics.dropConfidence,
    frame.semantics.fakeoutConfidence,
    frame.semantics.vocalHookConfidence,
    resolvedSection?.confidence ?? 0,
  ))
  const deterministicVariationSeed = stableSeed(
    trackIdentity,
    frame.analysisRevision ?? analysisIdentity,
    frame.timelineRevision ?? sectionIdentity,
    resolvedMacroSection?.id,
    macroSectionOccurrence,
    performanceFourBarBlockIndex,
  )

  return {
    audioTimeSec,
    trackIdentity,
    analysisIdentity,
    analysisRevision: frame.analysisRevision ?? analysisIdentity,
    timelineRevision: frame.timelineRevision ?? sectionIdentity,
    deterministicVariationSeed,
    sectionIdentity,
    macroSectionIdentity,
    runtimeIdentity,
    seekIdentity,
    loopIdentity,
    trackChangeIdentity,
    timingDiscontinuityIdentity,
    ...grid,
    sections,
    sectionBarTimeline,
    macroSections,
    resolvedSection,
    resolvedMacroSection,
    sectionType: resolvedSection?.type ?? null,
    sectionId: resolvedSection?.id ?? null,
    sectionFamily: resolvedSection?.familyId ?? null,
    sectionPhase: phaseForBars(barsSinceSectionStart, barsUntilSectionEnd, Boolean(resolvedSection)),
    macroSectionType: resolvedMacroSection?.type ?? null,
    macroSectionProgress,
    macroSectionPhase: phaseForBars(barsSinceMacroSectionStart, barsUntilMacroSectionEnd, Boolean(resolvedMacroSection)),
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
    fourBarProgress: (barsSinceMacroSectionStart % 4) / 4,
    eightBarProgress: (barsSinceMacroSectionStart % 8) / 8,
    sixteenBarProgress: (barsSinceMacroSectionStart % 16) / 16,
    phraseIndex: phrase.index,
    phraseLengthBars: phrase.lengthBars,
    phraseProgress: phrase.progress,
    sceneLocalVariationIndex: performanceFourBarBlockIndex % 4,
    kick: frame.rhythm.kickHit,
    kickStrength: clamp01(frame.rhythm.kickStrength),
    snare: frame.rhythm.snareHit,
    snareStrength: clamp01(frame.rhythm.snareStrength),
    hat: frame.rhythm.hatHit,
    hatStrength: clamp01(frame.rhythm.hatStrength),
    transient: clamp01(frame.rhythm.transient),
    transientConfidence: clamp01(frame.rhythm.transientConfidence),
    bass: clamp01(frame.bands.normalizedBass),
    mid: clamp01(frame.bands.normalizedMid),
    high: clamp01(frame.bands.normalizedHigh),
    energy: clamp01(frame.energy.instant),
    trackRelativeEnergy: clamp01(frame.energy.trackCurve ?? frame.energy.percentile),
    energyTrend: finite(frame.energy.delta, frame.energy.shortTerm - frame.energy.longTerm),
    spectralFlux: clamp01(frame.energy.spectralFlux),
    tension: clamp01(frame.energy.tension),
    complexity: clamp01(frame.energy.complexity),
    buildProgress: clamp01(frame.energy.buildProgress),
    dropImpact: clamp01(frame.energy.dropImpact),
    vocalEnergy: clamp01(Math.max(frame.stems.vocalEnergy, frame.lyrics.vocalActivity)),
    upcomingSemanticMoments,
    seekDetected,
    loopWrapDetected,
    trackReplacementDetected,
    capabilities: intelligence.capabilities,
    analysisCapabilities: frame.analysisCapabilities ?? null,
    confidence: {
      overall: clamp01(frame.confidence.overall),
      rhythm: clamp01(frame.confidence.rhythm),
      section: clamp01(frame.confidence.section),
      grid: gridConfidence,
      downbeat: downbeatConfidence,
      phrase: phrase.confidence,
      semantics: semanticConfidence,
    },
    boundaries: {
      beatBoundary: previous ? didCrossSharedPerformanceBeatBoundary(previous.beatIndex, grid.beatIndex, timingDiscontinuity) : false,
      barBoundary: previous ? didCrossSharedPerformanceBarBoundary(previous.barIndex, grid.barIndex, timingDiscontinuity) : false,
      fourBarBoundary: previous ? didCrossSharedPerformanceFourBarBoundary(previous.barIndex, grid.barIndex, timingDiscontinuity) : false,
      eightBarBoundary: previous ? didCrossSharedPerformanceEightBarBoundary(previous.barIndex, grid.barIndex, timingDiscontinuity) : false,
      sixteenBarBoundary: previous ? didCrossSharedPerformanceSixteenBarBoundary(previous.barIndex, grid.barIndex, timingDiscontinuity) : false,
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

export function buildSharedPerformanceContextFromAudioFeatureBus(
  input: Omit<BuildSharedPerformanceContextInput, 'frame'>,
): SharedPerformanceContext {
  return buildSharedPerformanceContext({ ...input, frame: AudioFeatureBus.getFrame() })
}

export function createSharedPerformanceFallbackContext(
  audioTimeSec = 0,
  previous: SharedPerformanceContext | null = null,
): SharedPerformanceContext {
  return buildSharedPerformanceContext({ audioTimeSec, previous })
}
