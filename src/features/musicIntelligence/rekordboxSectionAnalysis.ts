import { classifyContextualSections } from './contextualSectionAnalysis'
import type {
  BarMusicalFeatures,
  ContextualSectionAnalysisDiagnostics,
  StructuralRegion,
  TrackSectionMI,
} from './types'
import type { RekordboxPhrase, RekordboxPssiIntegrity } from '../rekordboxImport/sourceTypes'
import type { ReactSectionType } from '../../components/vyzualz/react/ReactTypes'

const EPS = 1e-6
const JOIN_TOLERANCE_SEC = 0.15

export interface ValidatedRekordboxPhraseRegion {
  phrase: RekordboxPhrase
  startSec: number
  endSec: number
}

export interface RekordboxPhraseValidationResult {
  valid: boolean
  regions: ValidatedRekordboxPhraseRegion[]
  reason: string | null
  normalizationNotes: string[]
}

export interface RekordboxSectionBuildResult {
  valid: boolean
  sections: TrackSectionMI[]
  reason: string | null
  normalizationNotes: string[]
  contextualDiagnostics?: ContextualSectionAnalysisDiagnostics
}

interface PhraseAudioEvidence {
  meanEnergy: number
  energyPercentile: number
  energySlope: number
  transientDensity: number
  bassEnergy: number
  spectralChange: number
  harmonicChange: number
  entryImpact: number
  exitRelease: number
}

interface ContextScores {
  primaryType: ReactSectionType
  scores: Partial<Record<ReactSectionType, number>>
  dropConfidence: number
  evidence: string[]
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function rounded(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0.5
  let below = 0
  let equal = 0
  for (const candidate of values) {
    if (candidate < value - EPS) below++
    else if (Math.abs(candidate - value) <= EPS) equal++
  }
  return clamp01((below + equal * 0.5) / values.length)
}

function pssiIntegrityReason(integrity: RekordboxPssiIntegrity | null | undefined): string | null {
  if (!integrity) return 'PSSI integrity metadata is unavailable; a fresh complete parse is required before Rekordbox Track Section authority can be trusted.'
  if (!integrity.detected) return 'No Rekordbox PSSI tag was detected.'
  if (!integrity.supported) {
    const parserReason = integrity.warnings.find(warning => warning.trim().length > 0)
    return parserReason
      ? `PSSI parser rejected source: ${parserReason}`
      : integrity.version != null
        ? `PSSI version ${integrity.version} or its encoding is unsupported.`
        : 'PSSI encoding could not be interpreted safely.'
  }
  if (integrity.masked == null) return 'PSSI plaintext/masked decoding could not be resolved safely.'
  if (!integrity.complete || integrity.declaredEntryCount !== integrity.readableEntryCount) {
    return `PSSI is incomplete: ${integrity.readableEntryCount} readable phrase entries were recovered from ${integrity.declaredEntryCount} declared entries.`
  }
  return null
}

/**
 * Validates PSSI as a complete, ordered timing map before it is allowed to own
 * Track Section boundaries. Track-edge silence is permitted by the PSSI format;
 * only internal structural discontinuities or impossible track-range timings
 * invalidate an otherwise complete source map.
 */
export function validateRekordboxPssi(
  phrases: readonly RekordboxPhrase[] | null | undefined,
  durationSec: number,
  integrity?: RekordboxPssiIntegrity | null,
): RekordboxPhraseValidationResult {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { valid: false, regions: [], reason: 'Track duration is unavailable or invalid.', normalizationNotes: [] }
  }

  if (!phrases?.length) {
    const detectedIntegrityReason = integrity?.detected ? pssiIntegrityReason(integrity) : null
    return {
      valid: false,
      regions: [],
      reason: detectedIntegrityReason ?? 'No Rekordbox PSSI phrases are available.',
      normalizationNotes: [],
    }
  }
  const integrityReason = pssiIntegrityReason(integrity)
  if (integrityReason) {
    return { valid: false, regions: [], reason: integrityReason, normalizationNotes: [] }
  }
  if (integrity!.readableEntryCount !== phrases.length) {
    return {
      valid: false,
      regions: [],
      reason: `PSSI integrity reports ${integrity!.readableEntryCount} readable entries but ${phrases.length} phrase records reached Track Intelligence.`,
      normalizationNotes: [],
    }
  }

  const normalizationNotes: string[] = []
  // phraseIndex is the source parse order. Explicit tie-breakers keep malformed
  // duplicate indices deterministic without hiding impossible timing order.
  const sorted = [...phrases].sort((a, b) => (
    a.phraseIndex - b.phraseIndex
    || (a.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (b.sourceIndex ?? Number.MAX_SAFE_INTEGER)
    || a.startBeat - b.startBeat
    || a.sourceKind - b.sourceKind
  ))
  const regions: ValidatedRekordboxPhraseRegion[] = []

  for (let index = 0; index < sorted.length; index++) {
    const phrase = sorted[index]!
    const next = sorted[index + 1]
    if (!Number.isInteger(phrase.startBeat) || phrase.startBeat < 1) {
      return { valid: false, regions: [], reason: `PSSI phrase ${phrase.sourceIndex ?? phrase.phraseIndex + 1} has an impossible start beat.`, normalizationNotes }
    }
    if (!Number.isInteger(phrase.endBeat) || phrase.endBeat == null || phrase.endBeat <= phrase.startBeat) {
      return { valid: false, regions: [], reason: `PSSI phrase ${phrase.sourceIndex ?? phrase.phraseIndex + 1} has an impossible or missing end beat.`, normalizationNotes }
    }
    if (next) {
      if (!Number.isInteger(next.startBeat) || next.startBeat < 1) {
        return { valid: false, regions: [], reason: `PSSI phrase ${next.sourceIndex ?? next.phraseIndex + 1} has an impossible start beat.`, normalizationNotes }
      }
      if (phrase.endBeat !== next.startBeat) {
        const delta = next.startBeat - phrase.endBeat
        return {
          valid: false,
          regions: [],
          reason: delta > 0
            ? `PSSI phrases contain an internal ${delta}-beat structural gap.`
            : `PSSI phrases contain an internal ${Math.abs(delta)}-beat overlap/backwards boundary.`,
          normalizationNotes,
        }
      }
    }

    const rawStart = phrase.startTimeSec
    const rawEnd = phrase.endTimeSec
    if (rawStart == null || rawEnd == null || !Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
      return {
        valid: false,
        regions: [],
        reason: `PSSI phrase ${phrase.sourceIndex ?? phrase.phraseIndex + 1} has unresolved/non-finite timing.`,
        normalizationNotes,
      }
    }
    if (rawStart < -JOIN_TOLERANCE_SEC || rawEnd < -JOIN_TOLERANCE_SEC) {
      return {
        valid: false,
        regions: [],
        reason: `PSSI phrase ${phrase.sourceIndex ?? phrase.phraseIndex + 1} has negative timing outside safe normalization tolerance.`,
        normalizationNotes,
      }
    }
    if (rawStart > durationSec + JOIN_TOLERANCE_SEC || rawEnd > durationSec + JOIN_TOLERANCE_SEC) {
      return {
        valid: false,
        regions: [],
        reason: `PSSI phrase ${phrase.sourceIndex ?? phrase.phraseIndex + 1} lies outside the track duration.`,
        normalizationNotes,
      }
    }

    let startSec = rawStart < 0 ? 0 : rawStart
    let endSec = rawEnd > durationSec ? durationSec : rawEnd
    if (rawStart < 0) normalizationNotes.push(`Clamped phrase ${phrase.phraseIndex} start from ${rawStart.toFixed(3)}s to 0s.`)
    if (rawEnd > durationSec) normalizationNotes.push(`Clamped phrase ${phrase.phraseIndex} end to track duration.`)

    if (next?.startTimeSec != null && Number.isFinite(next.startTimeSec)) {
      const joinDelta = rawEnd - next.startTimeSec
      if (Math.abs(joinDelta) <= JOIN_TOLERANCE_SEC) {
        if (Math.abs(joinDelta) > EPS) {
          normalizationNotes.push(`Normalized phrase ${phrase.phraseIndex} end to the next Rekordbox phrase start.`)
        }
        endSec = Math.max(0, Math.min(durationSec, next.startTimeSec))
      } else {
        return {
          valid: false,
          regions: [],
          reason: joinDelta > 0
            ? `PSSI phrases overlap by ${joinDelta.toFixed(3)}s and cannot be normalized safely.`
            : `PSSI phrases contain a ${Math.abs(joinDelta).toFixed(3)}s structural gap and cannot be normalized safely.`,
          normalizationNotes,
        }
      }
    }

    if (endSec - startSec <= EPS) {
      return {
        valid: false,
        regions: [],
        reason: `PSSI phrase ${phrase.sourceIndex ?? phrase.phraseIndex + 1} has zero/negative duration.`,
        normalizationNotes,
      }
    }
    if (regions.length > 0 && startSec < regions[regions.length - 1]!.startSec - EPS) {
      return { valid: false, regions: [], reason: 'PSSI phrase ordering is impossible.', normalizationNotes }
    }
    regions.push({ phrase, startSec, endSec })
  }

  const first = regions[0]!
  const last = regions[regions.length - 1]!
  if (last.endSec - first.startSec <= EPS) {
    return { valid: false, regions: [], reason: 'PSSI structural map has zero length.', normalizationNotes }
  }

  // PSSI explicitly permits non-phrase material at either physical track edge.
  // Preserve those source boundaries instead of fabricating Rekordbox sections
  // or stretching the first/final phrase across silence.
  return { valid: true, regions, reason: null, normalizationNotes }
}

function barsForRegion(barFeatures: BarMusicalFeatures[], startSec: number, endSec: number): BarMusicalFeatures[] {
  return barFeatures.filter(bar => bar.startSec < endSec - EPS && bar.endSec > startSec + EPS)
}

function barRange(barFeatures: BarMusicalFeatures[], startSec: number, endSec: number): { startBar: number | null; endBar: number | null } {
  if (barFeatures.length === 0) return { startBar: null, endBar: null }
  const overlapping = barsForRegion(barFeatures, startSec, endSec)
  if (!overlapping.length) {
    const nearest = barFeatures.reduce((best, bar) => (
      Math.abs(bar.startSec - startSec) < Math.abs(best.startSec - startSec) ? bar : best
    ), barFeatures[0]!)
    return { startBar: nearest.barIndex, endBar: nearest.barIndex + 1 }
  }
  const first = overlapping[0]!
  const last = overlapping[overlapping.length - 1]!
  return { startBar: first.barIndex, endBar: Math.max(first.barIndex + 1, last.barIndex + 1) }
}

function phraseEvidence(
  regions: ValidatedRekordboxPhraseRegion[],
  barFeatures: BarMusicalFeatures[],
): PhraseAudioEvidence[] {
  const means = regions.map(region => average(barsForRegion(barFeatures, region.startSec, region.endSec).map(bar => bar.meanEnergy)))
  return regions.map((region, index) => {
    const bars = barsForRegion(barFeatures, region.startSec, region.endSec)
    const first = bars[0]
    const last = bars[bars.length - 1]
    const previous = first ? barFeatures.find(bar => bar.barIndex === first.barIndex - 1) : undefined
    const next = last ? barFeatures.find(bar => bar.barIndex === last.barIndex + 1) : undefined
    const meanEnergy = means[index] ?? 0
    const entryImpact = first && previous
      ? clamp01(
          Math.max(0, first.meanEnergy - previous.meanEnergy) * 0.42 * 2.2 +
          Math.max(0, first.bassAverage - previous.bassAverage) * 0.28 * 2 +
          Math.max(0, first.overallTransientDensity - previous.overallTransientDensity) * 0.30 * 2,
        )
      : 0
    const exitRelease = last && next
      ? clamp01(
          Math.max(0, last.meanEnergy - next.meanEnergy) * 0.55 * 2 +
          Math.max(0, last.overallTransientDensity - next.overallTransientDensity) * 0.45 * 1.7,
        )
      : 0
    return {
      meanEnergy,
      energyPercentile: percentileRank(means, meanEnergy),
      energySlope: average(bars.map(bar => bar.energySlope)),
      transientDensity: average(bars.map(bar => bar.overallTransientDensity)),
      bassEnergy: average(bars.map(bar => bar.bassAverage)),
      spectralChange: average(bars.map(bar => bar.spectralFlux)),
      harmonicChange: average(bars.map(bar => bar.harmonicChange)),
      entryImpact,
      exitRelease,
    }
  })
}

function structuralRegions(
  regions: ValidatedRekordboxPhraseRegion[],
  barFeatures: BarMusicalFeatures[],
  evidence: PhraseAudioEvidence[],
): StructuralRegion[] {
  return regions.map((region, index) => {
    const range = barRange(barFeatures, region.startSec, region.endSec)
    const bars = barsForRegion(barFeatures, region.startSec, region.endSec)
    const item = evidence[index]!
    return {
      id: `rekordbox-phrase-region-${region.phrase.phraseIndex}`,
      startSec: region.startSec,
      endSec: region.endSec,
      startBar: range.startBar,
      endBar: range.endBar,
      durationBars: range.startBar != null && range.endBar != null ? Math.max(1, range.endBar - range.startBar) : null,
      boundaryConfidence: 0.99,
      internalCohesion: rounded(1 - Math.min(0.8, Math.abs(item.energySlope) * 0.5 + item.spectralChange * 0.25)),
      gridConfidence: rounded(average(bars.map(bar => bar.gridConfidence))),
      relatedRegions: [],
      // This value is only an input adapter for the existing contextual classifier;
      // it never represents the source of the authoritative PSSI boundaries.
      analysisSource: 'bar_self_similarity',
      diagnostics: {
        meanEnergy: rounded(item.meanEnergy),
        energySlope: Math.max(-1, Math.min(1, item.energySlope)),
        transientDensity: rounded(item.transientDensity),
        harmonicChange: rounded(average(bars.map(bar => bar.harmonicChange))),
        repeatAffinity: 0,
        phrasePriorScore: 1,
      },
    }
  })
}

function overlapDuration(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

function contextualScoresForRegion(
  startSec: number,
  endSec: number,
  contextualSections: readonly TrackSectionMI[],
): ContextScores {
  const scores: Partial<Record<ReactSectionType, number>> = {}
  const evidence = new Set<string>()
  let dropConfidence = 0
  let bestPrimary: TrackSectionMI | null = null
  let bestOverlap = 0
  const duration = Math.max(EPS, endSec - startSec)

  for (const section of contextualSections) {
    const overlap = overlapDuration(startSec, endSec, section.startSec, section.endSec)
    if (overlap <= EPS) continue
    const weight = overlap / duration
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      bestPrimary = section
    }
    const diagnostics = section.interpretation?.classificationDiagnostics
    if (diagnostics) {
      for (const [type, value] of Object.entries(diagnostics.scores) as Array<[ReactSectionType, number]>) {
        scores[type] = (scores[type] ?? 0) + value * weight
      }
      diagnostics.evidence.forEach(item => evidence.add(item))
    }
    scores[section.type] = (scores[section.type] ?? 0) + (section.labelConfidence ?? section.confidence) * weight * 0.35
    dropConfidence = Math.max(dropConfidence, (section.dropConfidence ?? 0) * weight)
  }

  return {
    primaryType: bestPrimary?.type ?? 'unknown',
    scores,
    dropConfidence: rounded(dropConfidence),
    evidence: [...evidence].slice(0, 8),
  }
}

function normalizedKind(phrase: RekordboxPhrase): string {
  return (phrase.normalizedLabel ?? phrase.rekordboxKind ?? phrase.sourceLabel ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function directMapping(kind: string): ReactSectionType | null {
  if (kind === 'intro') return 'intro'
  if (kind === 'verse' || kind.startsWith('verse_')) return 'verse'
  if (kind === 'up' || kind === 'build') return 'build'
  if (kind === 'outro') return 'outro'
  return null
}

function score(scores: Partial<Record<ReactSectionType, number>>, type: ReactSectionType): number {
  return clamp01(scores[type] ?? 0)
}

function resolveAmbiguousType(
  kind: string,
  context: ContextScores,
  evidence: PhraseAudioEvidence,
  previousKind: string | null,
): { type: ReactSectionType; explanation: string } {
  const previousWasBuild = previousKind === 'up' || previousKind === 'build'
  const dropScore = clamp01(
    Math.max(score(context.scores, 'drop'), context.dropConfidence) * 0.58 +
    evidence.entryImpact * 0.22 +
    evidence.energyPercentile * 0.12 +
    evidence.bassEnergy * 0.08 +
    (previousWasBuild ? 0.08 : 0),
  )
  const breakdownScore = clamp01(
    score(context.scores, 'breakdown') * 0.48 +
    (1 - evidence.energyPercentile) * 0.24 +
    evidence.exitRelease * 0.08 +
    Math.max(0, -evidence.energySlope) * 0.10 +
    (1 - evidence.transientDensity) * 0.10,
  )

  if (kind === 'down') {
    const type: ReactSectionType = dropScore >= breakdownScore + 0.04 && dropScore >= 0.46 ? 'drop' : 'breakdown'
    return {
      type,
      explanation: type === 'drop'
        ? `Rekordbox Down classified as Drop from contextual drop evidence (${dropScore.toFixed(2)}) over breakdown evidence (${breakdownScore.toFixed(2)}), including entry impact ${evidence.entryImpact.toFixed(2)}${previousWasBuild ? ' after an Up/Build phrase' : ''}.`
        : `Rekordbox Down classified as Breakdown because release/low-energy evidence (${breakdownScore.toFixed(2)}) met or exceeded Drop evidence (${dropScore.toFixed(2)}).`,
    }
  }

  if (kind === 'chorus') {
    if (dropScore >= 0.58 && dropScore >= breakdownScore + 0.08) {
      return { type: 'drop', explanation: `Rekordbox Chorus classified as Drop only after strong contextual Drop evidence (${dropScore.toFixed(2)}).` }
    }
    const nonDropCandidates: ReactSectionType[] = ['verse', 'bridge', 'breakdown', 'build', 'outro', 'intro', 'unknown']
    const best = nonDropCandidates
      .map(type => ({ type, value: score(context.scores, type) + (type === context.primaryType ? 0.08 : 0) }))
      .sort((a, b) => b.value - a.value)[0]
    const type = best && best.value >= 0.18 ? best.type : 'unknown'
    return {
      type,
      explanation: `Rekordbox Chorus was not blindly promoted to Drop; contextual analysis favored ${type} while Drop evidence was ${dropScore.toFixed(2)}.`,
    }
  }

  if (kind === 'bridge') {
    const bridgeScore = score(context.scores, 'bridge')
    if (breakdownScore >= 0.52 && breakdownScore > bridgeScore + 0.06) {
      return { type: 'breakdown', explanation: `Rekordbox Bridge classified as Breakdown from stronger low-energy/release context (${breakdownScore.toFixed(2)} vs bridge ${bridgeScore.toFixed(2)}).` }
    }
    return { type: 'bridge', explanation: `Rekordbox Bridge retained as Bridge; contextual breakdown evidence was not strong enough to override the source role.` }
  }

  const contextualType = context.primaryType === 'preDrop' ? 'build' : context.primaryType
  return {
    type: contextualType,
    explanation: `Unrecognized Rekordbox phrase kind was interpreted from DRMVYZ contextual Audio Intelligence without changing its boundaries.`,
  }
}

function displayLabel(type: ReactSectionType): string {
  const labels: Record<ReactSectionType, string> = {
    intro: 'Intro',
    verse: 'Verse',
    build: 'Build',
    preDrop: 'Pre-Drop',
    drop: 'Drop',
    breakdown: 'Breakdown',
    bridge: 'Bridge',
    outro: 'Outro',
    unknown: 'Section',
  }
  return labels[type]
}

function applyOccurrenceLabels(sections: TrackSectionMI[]): void {
  const counts = new Map<ReactSectionType, number>()
  for (const section of sections) {
    const occurrence = (counts.get(section.type) ?? 0) + 1
    counts.set(section.type, occurrence)
    section.label = `${displayLabel(section.type)} ${occurrence}`
    if (section.interpretation) section.interpretation.occurrenceIndex = occurrence
  }
}

/**
 * Builds authoritative Track Sections from validated PSSI boundaries, while
 * using DRMVYZ's contextual classifier only to enrich/classify each fixed region.
 */
export function buildRekordboxAuthoritativeSections(input: {
  phrases: readonly RekordboxPhrase[] | null | undefined
  durationSec: number
  barFeatures: BarMusicalFeatures[]
  pssiIntegrity?: RekordboxPssiIntegrity | null
}): RekordboxSectionBuildResult {
  const validation = validateRekordboxPssi(input.phrases, input.durationSec, input.pssiIntegrity)
  if (!validation.valid) {
    return { valid: false, sections: [], reason: validation.reason, normalizationNotes: validation.normalizationNotes }
  }
  const evidence = phraseEvidence(validation.regions, input.barFeatures)
  const regions = input.barFeatures.length > 0
    ? structuralRegions(validation.regions, input.barFeatures, evidence)
    : []
  const contextual = input.barFeatures.length > 0
    ? classifyContextualSections({
        regions,
        barFeatures: input.barFeatures,
        durationSec: input.durationSec,
        boundaryCandidates: [],
      })
    : null
  const contextualSections = contextual?.sections ?? []

  const sections = validation.regions.map((region, index): TrackSectionMI => {
    const phrase = region.phrase
    const kind = normalizedKind(phrase)
    const direct = directMapping(kind)
    const context = contextualScoresForRegion(region.startSec, region.endSec, contextualSections)
    const audio = evidence[index]!
    const previousKind = index > 0 ? normalizedKind(validation.regions[index - 1]!.phrase) : null
    const resolved = direct
      ? {
          type: direct,
          explanation: `Direct high-confidence Rekordbox mapping: ${(phrase.sourceLabel ?? phrase.rekordboxKind ?? kind) || 'phrase'} → ${displayLabel(direct)}.`,
        }
      : resolveAmbiguousType(kind, context, audio, previousKind)

    const range = barRange(input.barFeatures, region.startSec, region.endSec)
    const contextualScore = Math.max(score(context.scores, resolved.type), context.primaryType === resolved.type ? 0.65 : 0)
    const labelConfidence = direct
      ? 0.96
      : resolved.type === 'unknown'
        ? rounded(0.18 + contextualScore * 0.24)
        : rounded(0.56 + contextualScore * 0.34)
    const gridConfidence = rounded(average(barsForRegion(input.barFeatures, region.startSec, region.endSec).map(bar => bar.gridConfidence)))
    const analysisConfidence = rounded(0.99 * 0.34 + labelConfidence * 0.46 + gridConfidence * 0.20)
    const preDropEvidence = contextualSections
      .filter(section => section.type === 'preDrop' && overlapDuration(region.startSec, region.endSec, section.startSec, section.endSec) > EPS)
      .map(section => `Pre-Drop evidence inside fixed Rekordbox phrase at ${section.startSec.toFixed(3)}s; boundary retained as PSSI.`)

    return {
      id: `rekordbox-pssi-section-${phrase.phraseIndex}`,
      label: '',
      type: resolved.type,
      startSec: region.startSec,
      endSec: region.endSec,
      intensity: rounded(audio.energyPercentile * 0.58 + audio.transientDensity * 0.24 + audio.bassEnergy * 0.18),
      confidence: analysisConfidence,
      boundaryConfidence: 0.99,
      labelConfidence,
      gridConfidence,
      analysisConfidence,
      dropConfidence: resolved.type === 'drop'
        ? rounded(Math.max(context.dropConfidence, score(context.scores, 'drop'), audio.entryImpact))
        : rounded(Math.min(0.35, Math.max(context.dropConfidence, score(context.scores, 'drop')))),
      source: 'rekordbox',
      locked: true,
      interpretation: {
        startBar: range.startBar,
        endBar: range.endBar,
        durationBars: range.startBar != null && range.endBar != null ? Math.max(1, range.endBar - range.startBar) : null,
        energyShape: audio.energySlope > 0.12 ? 'rising' : audio.energySlope < -0.12 ? 'falling' : 'stable',
        densityCategory: audio.transientDensity < 0.33 ? 'sparse' : audio.transientDensity > 0.67 ? 'dense' : 'moderate',
        rhythmicCharacter: audio.transientDensity < 0.30 ? 'sparse' : audio.transientDensity > 0.68 ? 'driving' : 'steady',
        harmonicCharacter: input.barFeatures.length === 0
          ? 'unavailable'
          : audio.harmonicChange < 0.22
            ? 'stable'
            : audio.harmonicChange > 0.58
              ? 'changing'
              : 'evolving',
        entryImpact: rounded(audio.entryImpact),
        exitTransition: audio.exitRelease > 0.45 ? 'release' : audio.entryImpact > 0.5 ? 'impact' : 'continuous',
        alternativeLabels: Object.entries(context.scores)
          .map(([type, value]) => ({ type: type as ReactSectionType, confidence: rounded(value ?? 0) }))
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 3),
        boundaryRefinementReason: 'Rekordbox PSSI owns this region boundary; DRMVYZ semantic analysis is enrichment-only.',
        classificationDiagnostics: {
          scores: context.scores,
          evidence: [resolved.explanation, ...context.evidence, ...preDropEvidence].slice(0, 12),
          sourceRegionIds: [regions[index]?.id ?? `rekordbox-phrase-region-${phrase.phraseIndex}`],
        },
        rekordboxPhrase: {
          phraseIndex: phrase.phraseIndex,
          sourceIndex: phrase.sourceIndex ?? null,
          originalKind: phrase.rekordboxKind,
          normalizedLabel: phrase.normalizedLabel,
          sourceKind: phrase.sourceKind,
          mood: phrase.mood,
          sourceMood: phrase.sourceMood,
          bank: phrase.bank,
          sourceBank: phrase.sourceBank,
          sourceStartBeat: phrase.startBeat,
          sourceEndBeat: phrase.endBeat,
          sourceStartTimeSec: phrase.startTimeSec,
          sourceEndTimeSec: phrase.endTimeSec,
          classificationExplanation: resolved.explanation,
        },
      },
    }
  })

  applyOccurrenceLabels(sections)
  return {
    valid: true,
    sections,
    reason: null,
    normalizationNotes: validation.normalizationNotes,
    contextualDiagnostics: contextual?.diagnostics,
  }
}
