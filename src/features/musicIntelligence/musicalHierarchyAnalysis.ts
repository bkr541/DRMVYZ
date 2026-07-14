import type {
  BarMarkerMI,
  BarMusicalFeatures,
  BeatMarkerMI,
  BoundaryAlternative,
  MusicalGridInfo,
  MusicalHierarchyAnalysis,
  MusicalHierarchyUnit,
  PhraseMarker,
  PhraseMarkerSource,
  SectionFamilyNode,
  SectionOccurrenceNode,
  StructuralBoundaryCandidate,
  StructuralSegmentationAnalysis,
  TrackSectionMI,
} from './types'

const PHRASE_LENGTHS = [4, 8, 16, 32] as const
const MAX_PHRASES = 192
const MAX_ALTERNATIVES = 24
const MAX_HIERARCHY_UNITS = 1536

export interface MusicalHierarchyInput {
  durationSec: number
  beatGrid?: BeatMarkerMI[]
  barMarkers?: BarMarkerMI[]
  barFeatures?: BarMusicalFeatures[]
  musicalGrid?: MusicalGridInfo
  sections: TrackSectionMI[]
  structuralSegmentation?: StructuralSegmentationAnalysis
  importedPhrases?: PhraseMarker[]
}

export interface MusicalHierarchyResult {
  phrases: PhraseMarker[]
  phraseHierarchy: MusicalHierarchyAnalysis
  boundaryAlternatives: BoundaryAlternative[]
  sections: TrackSectionMI[]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function rounded(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000
}

function closestPhraseLength(value: number): 4 | 8 | 16 | 32 {
  return PHRASE_LENGTHS.reduce((best, candidate) => (
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
  ), 8 as 4 | 8 | 16 | 32)
}

function candidateSignals(candidate: StructuralBoundaryCandidate): string[] {
  const signals: Array<[string, number]> = [
    ['self-similarity novelty', candidate.selfSimilarityNovelty],
    ['acoustic novelty', candidate.acousticNovelty],
    ['rhythmic novelty', candidate.rhythmicNovelty],
    ['harmonic novelty', candidate.harmonicNovelty],
    ['energy transition', candidate.energyTransitionEvidence],
    ['silence or impact', candidate.silenceOrImpactEvidence],
  ]
  return signals
    .filter(([, value]) => value >= 0.28)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label]) => label)
}

function candidateReason(candidate: StructuralBoundaryCandidate): string {
  const signals = candidateSignals(candidate)
  const alignment = candidate.offGrid ? 'Off-grid' : 'Bar-aligned'
  return signals.length > 0
    ? `${alignment} boundary supported by ${signals.join(', ')}.`
    : `${alignment} structural boundary candidate.`
}

export function buildBoundaryAlternatives(
  structuralSegmentation: StructuralSegmentationAnalysis | undefined,
): BoundaryAlternative[] {
  if (!structuralSegmentation) return []
  return structuralSegmentation.alternativeBoundaryCandidates
    .filter(candidate => Number.isFinite(candidate.timeSec) && candidate.timeSec >= 0)
    .sort((a, b) => b.candidateConfidence - a.candidateConfidence || b.totalScore - a.totalScore || a.timeSec - b.timeSec)
    .slice(0, MAX_ALTERNATIVES)
    .map((candidate, index) => ({
      id: candidate.id ?? `boundary-alt-${candidate.barIndex ?? 'free'}-${Math.round(candidate.timeSec * 1000)}`,
      timeSec: candidate.timeSec,
      barIndex: candidate.barIndex,
      confidence: rounded(candidate.candidateConfidence),
      rank: index + 1,
      reason: candidate.reason ?? candidateReason(candidate),
      supportingSignals: (candidate.supportingSignals ?? candidateSignals(candidate)).slice(0, 6),
      source: structuralSegmentation.source,
    }))
    .sort((a, b) => a.timeSec - b.timeSec || a.rank - b.rank)
}

function nearestBarIndex(bars: BarMarkerMI[], timeSec: number): number | null {
  if (bars.length === 0) return null
  let nearest = bars[0]!
  let distance = Math.abs(nearest.startSec - timeSec)
  for (const bar of bars) {
    if (timeSec >= bar.startSec - 0.01 && timeSec < bar.endSec - 0.01) return bar.barIndex
    const candidateDistance = Math.abs(bar.startSec - timeSec)
    if (candidateDistance < distance) {
      nearest = bar
      distance = candidateDistance
    }
  }
  return nearest.barIndex
}

function candidateNear(
  candidates: StructuralBoundaryCandidate[],
  timeSec: number,
  toleranceSec: number,
): StructuralBoundaryCandidate | null {
  let nearest: StructuralBoundaryCandidate | null = null
  let distance = toleranceSec
  for (const candidate of candidates) {
    const nextDistance = Math.abs(candidate.timeSec - timeSec)
    if (nextDistance <= distance) {
      nearest = candidate
      distance = nextDistance
    }
  }
  return nearest
}

export function attachSectionAnalysisMetadata(
  sections: TrackSectionMI[],
  structuralSegmentation: StructuralSegmentationAnalysis | undefined,
  musicalGrid: MusicalGridInfo | undefined,
  bars: BarMarkerMI[],
): TrackSectionMI[] {
  const candidates = structuralSegmentation?.boundaryCandidates ?? []
  const averageBarSec = bars.length > 0
    ? bars.reduce((sum, bar) => sum + Math.max(0, bar.endSec - bar.startSec), 0) / bars.length
    : 0.5
  const toleranceSec = Math.max(0.08, averageBarSec * 0.18)
  const analysisSource = structuralSegmentation?.source ?? 'time_domain_fallback'
  const fallbackStatus = analysisSource === 'time_domain_fallback'
    ? 'time_domain_fallback' as const
    : musicalGrid?.authoritative
      ? 'none' as const
      : 'grid_derived' as const

  return sections.map(section => {
    if (section.source === 'manual' || section.source === 'rekordbox' || section.locked) return section
    const startCandidate = candidateNear(candidates, section.startSec, toleranceSec)
    const endCandidate = candidateNear(candidates, section.endSec, toleranceSec)
    return {
      ...section,
      interpretation: {
        ...section.interpretation,
        analysisSource,
        gridSource: musicalGrid?.source ?? 'legacy_fallback',
        fallbackStatus,
        startBoundaryReason: startCandidate
          ? candidateReason(startCandidate)
          : section.startSec <= toleranceSec
            ? 'Track start.'
            : 'Contextual section refinement selected this bar-aligned boundary.',
        endBoundaryReason: endCandidate
          ? candidateReason(endCandidate)
          : section.endSec >= (bars[bars.length - 1]?.endSec ?? section.endSec) - toleranceSec
            ? 'Track end.'
            : 'Contextual section refinement selected this bar-aligned boundary.',
      },
    }
  })
}

interface PhraseAnchor {
  barIndex: number
  timeSec: number
  confidence: number
  source: PhraseMarkerSource
  reason: string
  relatedSectionId: string | null
  supportingSignals: string[]
  structurallyDetected: boolean
}

function sectionAtBar(sections: TrackSectionMI[], barIndex: number): TrackSectionMI | null {
  return sections.find(section => {
    const startBar = section.interpretation?.startBar
    const endBar = section.interpretation?.endBar
    return startBar != null && endBar != null && barIndex >= startBar && barIndex < endBar
  }) ?? null
}

function addAnchor(map: Map<number, PhraseAnchor>, anchor: PhraseAnchor): void {
  const existing = map.get(anchor.barIndex)
  if (!existing || anchor.confidence > existing.confidence || (anchor.structurallyDetected && !existing.structurallyDetected)) {
    map.set(anchor.barIndex, anchor)
  }
}

function buildPhraseAnchors(input: MusicalHierarchyInput, bars: BarMarkerMI[], sections: TrackSectionMI[]): PhraseAnchor[] {
  const anchors = new Map<number, PhraseAnchor>()
  const gridConfidence = clamp01(input.musicalGrid?.confidence.barGrid ?? bars[0]?.gridConfidence ?? 0)

  for (const section of sections) {
    const barIndex = section.interpretation?.startBar ?? nearestBarIndex(bars, section.startSec)
    if (barIndex == null) continue
    const boundaryConfidence = section.boundaryConfidence ?? section.confidence
    addAnchor(anchors, {
      barIndex,
      timeSec: section.startSec,
      confidence: rounded(boundaryConfidence * 0.78 + gridConfidence * 0.22),
      source: 'section_boundary',
      reason: `${section.label} begins here; contextual section evidence supports a phrase boundary.`,
      relatedSectionId: section.id,
      supportingSignals: ['section entry', section.type === 'drop' ? 'drop anchor' : 'contextual role'],
      structurallyDetected: boundaryConfidence >= 0.52,
    })
  }

  for (const candidate of input.structuralSegmentation?.boundaryCandidates ?? []) {
    if (!candidate.selected || candidate.barIndex == null) continue
    addAnchor(anchors, {
      barIndex: candidate.barIndex,
      timeSec: candidate.timeSec,
      confidence: rounded(candidate.candidateConfidence * 0.86 + candidate.gridConfidence * 0.14),
      source: candidate.selfSimilarityNovelty >= Math.max(candidate.acousticNovelty, candidate.energyTransitionEvidence)
        ? 'self_similarity'
        : 'structural_boundary',
      reason: candidate.reason ?? candidateReason(candidate),
      relatedSectionId: sectionAtBar(sections, candidate.barIndex)?.id ?? null,
      supportingSignals: candidate.supportingSignals ?? candidateSignals(candidate),
      structurallyDetected: true,
    })
  }

  for (const region of input.structuralSegmentation?.regions ?? []) {
    if (region.startBar == null || !region.relatedRegions.some(relation => relation.similarity >= 0.62)) continue
    const bar = bars.find(candidate => candidate.barIndex === region.startBar)
    if (!bar) continue
    addAnchor(anchors, {
      barIndex: region.startBar,
      timeSec: bar.startSec,
      confidence: rounded(Math.max(region.boundaryConfidence, region.diagnostics.repeatAffinity) * 0.82 + gridConfidence * 0.18),
      source: 'repeated_material',
      reason: 'Repeated musical material begins here and relates to another structural region.',
      relatedSectionId: sectionAtBar(sections, region.startBar)?.id ?? null,
      supportingSignals: ['repeated material', 'self-similarity relation'],
      structurallyDetected: true,
    })
  }

  const features = [...(input.barFeatures ?? [])].sort((a, b) => a.barIndex - b.barIndex)
  for (let index = 1; index < features.length; index++) {
    const previous = features[index - 1]!
    const current = features[index]!
    const energyDelta = Math.abs(current.meanEnergy - previous.meanEnergy)
    const transientDelta = Math.abs(current.overallTransientDensity - previous.overallTransientDensity)
    const harmonicDelta = Math.max(current.harmonicChange, previous.harmonicChange)
    const evidence = Math.max(energyDelta, transientDelta * 0.85, harmonicDelta * 0.75)
    if (evidence < 0.34) continue
    addAnchor(anchors, {
      barIndex: current.barIndex,
      timeSec: current.startSec,
      confidence: rounded(evidence * 0.72 + current.gridConfidence * 0.28),
      source: 'energy_transition',
      reason: 'A sustained bar-level energy, rhythm, or harmonic transition supports this phrase boundary.',
      relatedSectionId: sectionAtBar(sections, current.barIndex)?.id ?? null,
      supportingSignals: [
        energyDelta >= 0.34 ? 'energy transition' : '',
        transientDelta >= 0.34 ? 'rhythmic density change' : '',
        harmonicDelta >= 0.34 ? 'harmonic change' : '',
      ].filter(Boolean),
      structurallyDetected: true,
    })
  }

  for (const phrase of input.importedPhrases ?? []) {
    const barIndex = phrase.barIndex ?? nearestBarIndex(bars, phrase.timeSec)
    if (barIndex == null) continue
    addAnchor(anchors, {
      barIndex,
      timeSec: phrase.timeSec,
      confidence: phrase.confidence,
      source: phrase.source ?? 'imported',
      reason: phrase.reason ?? 'Imported phrase marker.',
      relatedSectionId: phrase.relatedSectionId ?? sectionAtBar(sections, barIndex)?.id ?? null,
      supportingSignals: phrase.supportingSignals ?? ['imported phrase metadata'],
      structurallyDetected: phrase.structurallyDetected ?? phrase.source !== 'grid_derived',
    })
  }

  // Grid-derived anchors provide honest coverage without masquerading as acoustic detections.
  // They fill long unsupported spans and remain visibly lower-confidence metadata.
  for (let barIndex = 0; barIndex < bars.length; barIndex += 8) {
    if ([...anchors.keys()].some(existing => Math.abs(existing - barIndex) <= 2)) continue
    const bar = bars.find(candidate => candidate.barIndex === barIndex) ?? bars[barIndex]
    if (!bar) continue
    addAnchor(anchors, {
      barIndex,
      timeSec: bar.startSec,
      confidence: rounded(Math.max(0.22, gridConfidence * 0.58)),
      source: 'grid_derived',
      reason: 'No strong acoustic boundary was detected nearby; this marker is derived from the reliable bar grid.',
      relatedSectionId: sectionAtBar(sections, barIndex)?.id ?? null,
      supportingSignals: ['eight-bar grid organization'],
      structurallyDetected: false,
    })
  }

  if (!anchors.has(0) && bars[0]) {
    addAnchor(anchors, {
      barIndex: 0,
      timeSec: bars[0].startSec,
      confidence: rounded(Math.max(0.35, gridConfidence)),
      source: 'grid_derived',
      reason: 'Track start on the resolved bar grid.',
      relatedSectionId: sections[0]?.id ?? null,
      supportingSignals: ['track start', 'bar grid'],
      structurallyDetected: false,
    })
  }

  return [...anchors.values()].sort((a, b) => a.barIndex - b.barIndex || a.timeSec - b.timeSec)
}

function buildPhrases(anchors: PhraseAnchor[], bars: BarMarkerMI[]): PhraseMarker[] {
  return anchors.slice(0, MAX_PHRASES).map((anchor, index) => {
    const nextBarIndex = anchors[index + 1]?.barIndex ?? bars.length
    const lengthBars = closestPhraseLength(Math.max(1, nextBarIndex - anchor.barIndex))
    return {
      id: `phrase-${anchor.barIndex}-${Math.round(anchor.timeSec * 1000)}`,
      timeSec: anchor.timeSec,
      barIndex: anchor.barIndex,
      phraseLength: lengthBars,
      lengthBars,
      confidence: rounded(anchor.confidence),
      source: anchor.source,
      reason: anchor.reason,
      relatedSectionId: anchor.relatedSectionId,
      structurallyDetected: anchor.structurallyDetected,
      supportingSignals: anchor.supportingSignals.slice(0, 6),
    }
  })
}

function parentSectionId(sections: TrackSectionMI[], startSec: number, endSec: number): string | null {
  return sections.find(section => startSec >= section.startSec - 0.01 && endSec <= section.endSec + 0.01)?.id ?? null
}

function buildHierarchy(
  input: MusicalHierarchyInput,
  bars: BarMarkerMI[],
  sections: TrackSectionMI[],
): MusicalHierarchyAnalysis {
  const units: MusicalHierarchyUnit[] = []
  const barByIndex = new Map(bars.map(bar => [bar.barIndex, bar]))
  const add = (unit: MusicalHierarchyUnit) => {
    if (units.length < MAX_HIERARCHY_UNITS) units.push(unit)
  }

  // Keep the bounded hierarchy musically useful on long tracks by retaining
  // sections and phrase-scale units before the high-cardinality beat layer.
  for (const section of sections) {
    add({
      id: `section-${section.id}`,
      level: 'section',
      startSec: section.startSec,
      endSec: section.endSec,
      startBar: section.interpretation?.startBar ?? nearestBarIndex(bars, section.startSec),
      endBar: section.interpretation?.endBar ?? nearestBarIndex(bars, section.endSec),
      confidence: rounded(section.analysisConfidence ?? section.confidence),
      parentId: null,
      relatedSectionId: section.id,
      source: 'section',
    })
  }

  const levels: Array<{ size: 4 | 8 | 16 | 32; level: MusicalHierarchyUnit['level']; parentSize: 8 | 16 | 32 | null }> = [
    { size: 32, level: 'thirty_two_bar', parentSize: null },
    { size: 16, level: 'sixteen_bar', parentSize: 32 },
    { size: 8, level: 'eight_bar', parentSize: 16 },
    { size: 4, level: 'four_bar', parentSize: 8 },
  ]
  for (const { size, level, parentSize } of levels) {
    for (let startBar = 0; startBar < bars.length; startBar += size) {
      const first = barByIndex.get(startBar) ?? bars[startBar]
      const final = barByIndex.get(Math.min(bars.length - 1, startBar + size - 1)) ?? bars[Math.min(bars.length - 1, startBar + size - 1)]
      if (!first || !final) continue
      const relatedSectionId = parentSectionId(sections, first.startSec, final.endSec)
      add({
        id: `${size}-bar-${startBar}`,
        level,
        startSec: first.startSec,
        endSec: final.endSec,
        startBar,
        endBar: Math.min(bars.length, startBar + size),
        confidence: rounded(input.musicalGrid?.confidence.barGrid ?? first.gridConfidence),
        parentId: relatedSectionId
          ? `section-${relatedSectionId}`
          : parentSize
            ? `${parentSize}-bar-${Math.floor(startBar / parentSize) * parentSize}`
            : null,
        relatedSectionId,
        source: 'grid_derived',
      })
    }
  }

  for (const bar of bars) {
    add({
      id: `bar-${bar.barIndex}`,
      level: 'bar',
      startSec: bar.startSec,
      endSec: bar.endSec,
      startBar: bar.barIndex,
      endBar: bar.barIndex + 1,
      confidence: rounded(bar.gridConfidence),
      parentId: `4-bar-${Math.floor(bar.barIndex / 4) * 4}`,
      relatedSectionId: sectionAtBar(sections, bar.barIndex)?.id ?? null,
      source: 'grid_derived',
    })
  }

  const beatGrid = input.beatGrid ?? []
  for (let beatPosition = 0; beatPosition < beatGrid.length; beatPosition++) {
    if (units.length >= MAX_HIERARCHY_UNITS) break
    const beat = beatGrid[beatPosition]!
    const barIndex = beat.barIndex ?? null
    const nextBeat = beatGrid[beatPosition + 1]
    add({
      id: `beat-${beat.beatIndex ?? Math.round(beat.timeSec * 1000)}`,
      level: 'beat',
      startSec: beat.timeSec,
      endSec: nextBeat?.timeSec ?? Math.min(input.durationSec, beat.timeSec + (input.musicalGrid?.beatPeriodSec ?? 0.5)),
      startBar: barIndex,
      endBar: barIndex,
      confidence: rounded(beat.gridConfidence ?? input.musicalGrid?.confidence.beatPhase ?? 0),
      parentId: barIndex == null ? null : `bar-${barIndex}`,
      relatedSectionId: barIndex == null ? null : sectionAtBar(sections, barIndex)?.id ?? null,
      source: 'grid_derived',
    })
  }

  const sectionOccurrences: SectionOccurrenceNode[] = sections.map((section, index) => ({
    sectionId: section.id,
    familyId: section.interpretation?.familyId ?? `family-${section.type}-${section.id}`,
    occurrenceIndex: section.interpretation?.occurrenceIndex ?? 1,
    startSec: section.startSec,
    endSec: section.endSec,
    startBar: section.interpretation?.startBar ?? nearestBarIndex(bars, section.startSec),
    endBar: section.interpretation?.endBar ?? nearestBarIndex(bars, section.endSec),
    confidence: rounded(section.interpretation?.familySimilarity ?? section.labelConfidence ?? section.confidence),
    isVariation: section.interpretation?.isVariation ?? (index > 0 && section.interpretation?.familyId != null),
  }))

  const familyMap = new Map<string, SectionOccurrenceNode[]>()
  for (const occurrence of sectionOccurrences) {
    const family = familyMap.get(occurrence.familyId) ?? []
    family.push(occurrence)
    familyMap.set(occurrence.familyId, family)
  }
  const sectionFamilies: SectionFamilyNode[] = [...familyMap.entries()].map(([familyId, occurrences]) => {
    const section = sections.find(candidate => candidate.id === occurrences[0]!.sectionId)!
    return {
      familyId,
      sectionType: section.type,
      occurrenceSectionIds: occurrences.map(occurrence => occurrence.sectionId),
      confidence: rounded(occurrences.reduce((sum, occurrence) => sum + occurrence.confidence, 0) / occurrences.length),
    }
  })

  return { units, sectionFamilies, sectionOccurrences }
}

export function generateMusicalHierarchy(input: MusicalHierarchyInput): MusicalHierarchyResult {
  const bars = [...(input.barMarkers ?? [])].sort((a, b) => a.barIndex - b.barIndex)
  const sections = attachSectionAnalysisMetadata(input.sections, input.structuralSegmentation, input.musicalGrid, bars)
  const anchors = buildPhraseAnchors(input, bars, sections)
  return {
    phrases: buildPhrases(anchors, bars),
    phraseHierarchy: buildHierarchy(input, bars, sections),
    boundaryAlternatives: buildBoundaryAlternatives(input.structuralSegmentation),
    sections,
  }
}
