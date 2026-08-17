import { describe, expect, it } from 'vitest'
import {
  buildRekordboxAuthoritativeSections as buildRekordboxAuthoritativeSectionsImpl,
  validateRekordboxPssi as validateRekordboxPssiImpl,
} from '../rekordboxSectionAnalysis'
import type { BarMusicalFeatures } from '../types'
import type { RekordboxPhrase, RekordboxPhraseMood, RekordboxPssiIntegrity } from '../../rekordboxImport/sourceTypes'

function makePhrase(
  phraseIndex: number,
  kind: string,
  startSec: number,
  endSec: number,
  mood: RekordboxPhraseMood = 'mid_energy',
): RekordboxPhrase {
  const normalizedLabel = kind.startsWith('verse_') ? 'verse' : kind
  return {
    phraseIndex,
    sourceIndex: phraseIndex + 1,
    sourceMood: mood === 'high_energy' ? 1 : mood === 'mid_energy' ? 2 : 3,
    mood,
    sourceKind: phraseIndex + 1,
    rekordboxKind: kind,
    sourceBank: 7,
    bank: 'club_1',
    sourceLabel: kind.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
    normalizedLabel,
    startBeat: phraseIndex * 8 + 1,
    endBeat: (phraseIndex + 1) * 8 + 1,
    startTimeSec: startSec,
    endTimeSec: endSec,
    fillStartBeat: null,
    fillStartTimeSec: null,
    sourceFlags: { fill: false },
    sourcePayload: { kind, phraseIndex },
  }
}

function completePssiIntegrity(count: number, overrides: Partial<RekordboxPssiIntegrity> = {}): RekordboxPssiIntegrity {
  return {
    detected: true,
    version: 0,
    entrySize: 24,
    declaredEntryCount: count,
    readableEntryCount: count,
    complete: true,
    masked: false,
    supported: true,
    warnings: [],
    ...overrides,
  }
}

function validateRekordboxPssi(phrases: readonly RekordboxPhrase[] | null | undefined, durationSec: number) {
  return validateRekordboxPssiImpl(phrases, durationSec, completePssiIntegrity(phrases?.length ?? 0))
}

function buildRekordboxAuthoritativeSections(input: Parameters<typeof buildRekordboxAuthoritativeSectionsImpl>[0]) {
  return buildRekordboxAuthoritativeSectionsImpl({
    ...input,
    pssiIntegrity: input.pssiIntegrity ?? completePssiIntegrity(input.phrases?.length ?? 0),
  })
}

function makeBar(
  barIndex: number,
  energy: number,
  options: Partial<Pick<
    BarMusicalFeatures,
    'energySlope' | 'bassAverage' | 'overallTransientDensity' | 'spectralFlux' | 'harmonicChange' | 'silenceRatio'
  >> = {},
): BarMusicalFeatures {
  const bass = options.bassAverage ?? Math.max(0.05, energy * 0.65)
  const transient = options.overallTransientDensity ?? Math.max(0.05, energy * 0.7)
  return {
    barIndex,
    startSec: barIndex,
    endSec: barIndex + 1,
    source: 'bar_grid',
    gridSource: 'imported',
    gridConfidence: 0.98,
    meanEnergy: energy,
    peakEnergy: Math.min(1, energy + 0.08),
    energySlope: options.energySlope ?? 0,
    dynamicRange: 0.22,
    bassAverage: bass,
    midAverage: Math.max(0.05, energy * 0.5),
    highAverage: Math.max(0.05, energy * 0.4),
    spectralFlux: options.spectralFlux ?? transient * 0.8,
    spectralCentroid: 0.5,
    spectralComplexity: 0.5,
    overallTransientDensity: transient,
    lowFrequencyOnsetDensity: transient,
    midFrequencyOnsetDensity: transient * 0.8,
    highFrequencyOnsetDensity: transient * 0.7,
    silenceRatio: options.silenceRatio ?? 0.03,
    chromaSummary: new Array(12).fill(1 / 12),
    harmonicChange: options.harmonicChange ?? 0.2,
  }
}

function barsFromEnergies(energies: number[]): BarMusicalFeatures[] {
  return energies.map((energy, index) => makeBar(index, energy))
}

describe('Rekordbox PSSI Track Section authority', () => {
  it('validates ordered PSSI and rejects corrupt structural maps', () => {
    expect(validateRekordboxPssi([
      makePhrase(0, 'intro', 0, 4),
      makePhrase(1, 'verse_1', 4, 8),
    ], 8).valid).toBe(true)

    const overlap = validateRekordboxPssi([
      makePhrase(0, 'intro', 0, 5),
      makePhrase(1, 'verse_1', 4, 8),
    ], 8)
    expect(overlap.valid).toBe(false)
    expect(overlap.reason).toContain('overlap')

    expect(validateRekordboxPssi([], 8).valid).toBe(false)
    expect(validateRekordboxPssi([makePhrase(0, 'intro', Number.NaN, 8)], 8).valid).toBe(false)
    expect(validateRekordboxPssi([makePhrase(0, 'intro', -2, 8)], 8).valid).toBe(false)
    expect(validateRekordboxPssi([makePhrase(0, 'intro', 0, 12)], 8).valid).toBe(false)
    expect(validateRekordboxPssi([makePhrase(0, 'intro', 0, 0)], 8).valid).toBe(false)
    expect(validateRekordboxPssi([makePhrase(0, 'intro', 3, 8)], 8).valid).toBe(true)

    const impossibleOrdering = validateRekordboxPssi([
      makePhrase(0, 'intro', 4, 8),
      makePhrase(1, 'verse_1', 0, 4),
    ], 8)
    expect(impossibleOrdering.valid).toBe(false)
  })

  it('preserves legitimate leading/trailing edge silence while normalizing only safe internal join drift', () => {
    const phrases = [
      makePhrase(0, 'intro', 0.5, 3.98),
      makePhrase(1, 'verse_1', 4.02, 7.0),
    ]
    const result = validateRekordboxPssi(phrases, 8)

    expect(result.valid).toBe(true)
    expect(result.regions.map(region => [region.startSec, region.endSec])).toEqual([[0.5, 4.02], [4.02, 7]])
    expect(result.normalizationNotes.some(note => note.includes('next Rekordbox phrase start'))).toBe(true)
  })

  it('accepts a very short track with a single complete PSSI phrase', () => {
    const result = validateRekordboxPssi([makePhrase(0, 'intro', 0, 0.75)], 0.75)

    expect(result.valid).toBe(true)
    expect(result.regions).toHaveLength(1)
    expect(result.regions[0]).toMatchObject({ startSec: 0, endSec: 0.75 })
  })

  it('does not fabricate a physical-track end boundary when the final PSSI boundary is missing', () => {
    const phrases = [
      makePhrase(0, 'intro', 0, 4),
      { ...makePhrase(1, 'outro', 4, 8), endTimeSec: null, endBeat: null },
    ]
    const result = validateRekordboxPssi(phrases, 8)

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('end beat')
  })

  it('keeps repeated phrase kinds and malformed optional fill metadata out of boundary decisions', () => {
    const first = makePhrase(0, 'verse_1', 0, 4)
    const second = {
      ...makePhrase(1, 'verse_1', 4, 8),
      fillStartBeat: 999_999,
      fillStartTimeSec: Number.NaN,
      sourceFlags: { fill: true, fill_unknown: 999 },
    }
    const result = validateRekordboxPssi([first, second], 8)

    expect(result.valid).toBe(true)
    expect(result.regions.map(region => [region.startSec, region.endSec])).toEqual([[0, 4], [4, 8]])
  })

  it('maps Intro, Verse variants, Up, and Outro directly while preserving exact source boundaries', () => {
    const phrases = [
      makePhrase(0, 'intro', 0, 2),
      makePhrase(1, 'verse_2', 2, 4),
      makePhrase(2, 'up', 4, 6),
      makePhrase(3, 'outro', 6, 8),
    ]
    const result = buildRekordboxAuthoritativeSections({
      phrases,
      durationSec: 8,
      barFeatures: barsFromEnergies([0.25, 0.30, 0.42, 0.45, 0.48, 0.62, 0.35, 0.20]),
    })

    expect(result.valid).toBe(true)
    expect(result.sections.map(section => section.type)).toEqual(['intro', 'verse', 'build', 'outro'])
    expect(result.sections.map(section => [section.startSec, section.endSec])).toEqual([
      [0, 2], [2, 4], [4, 6], [6, 8],
    ])
    expect(result.sections.every(section => section.source === 'rekordbox' && section.locked)).toBe(true)
  })

  it('classifies Down as Drop when Audio Intelligence supports a strong post-Build impact', () => {
    const phrases = [
      makePhrase(0, 'verse_1', 0, 4),
      makePhrase(1, 'up', 4, 8),
      makePhrase(2, 'down', 8, 12, 'high_energy'),
    ]
    const bars = barsFromEnergies([
      0.30, 0.32, 0.35, 0.36,
      0.38, 0.45, 0.55, 0.62,
      0.96, 0.92, 0.90, 0.88,
    ])
    for (let index = 8; index < 12; index++) {
      bars[index] = makeBar(index, bars[index]!.meanEnergy, {
        bassAverage: 0.92,
        overallTransientDensity: 0.90,
        spectralFlux: 0.88,
      })
    }

    const result = buildRekordboxAuthoritativeSections({ phrases, durationSec: 12, barFeatures: bars })
    expect(result.valid).toBe(true)
    expect(result.sections[2]?.type).toBe('drop')
    expect(result.sections[2]?.interpretation?.rekordboxPhrase?.classificationExplanation).toContain('classified as Drop')
  })

  it('classifies Down as Breakdown when the region is a low-energy release', () => {
    const phrases = [
      makePhrase(0, 'verse_1', 0, 4),
      makePhrase(1, 'up', 4, 8),
      makePhrase(2, 'down', 8, 12, 'low_energy'),
    ]
    const bars = barsFromEnergies([
      0.56, 0.58, 0.60, 0.62,
      0.52, 0.58, 0.64, 0.70,
      0.18, 0.16, 0.15, 0.14,
    ])
    for (let index = 8; index < 12; index++) {
      bars[index] = makeBar(index, bars[index]!.meanEnergy, {
        bassAverage: 0.10,
        overallTransientDensity: 0.08,
        spectralFlux: 0.10,
        silenceRatio: 0.18,
      })
    }

    const result = buildRekordboxAuthoritativeSections({ phrases, durationSec: 12, barFeatures: bars })
    expect(result.valid).toBe(true)
    expect(result.sections[2]?.type).toBe('breakdown')
    expect(result.sections[2]?.interpretation?.rekordboxPhrase?.classificationExplanation).toContain('classified as Breakdown')
  })

  it('does not blindly map Chorus to Drop', () => {
    const phrases = [
      makePhrase(0, 'verse_1', 0, 4),
      makePhrase(1, 'chorus', 4, 8, 'low_energy'),
    ]
    const bars = barsFromEnergies([0.45, 0.48, 0.50, 0.47, 0.30, 0.28, 0.31, 0.29])
    const result = buildRekordboxAuthoritativeSections({ phrases, durationSec: 8, barFeatures: bars })

    expect(result.valid).toBe(true)
    expect(result.sections[1]?.type).not.toBe('drop')
    expect(result.sections[1]?.interpretation?.rekordboxPhrase?.classificationExplanation).toContain('not blindly promoted to Drop')
  })

  it('retains source-faithful phrase metadata and an enrichment explanation per section', () => {
    const phrase = makePhrase(0, 'verse_2', 0, 4)
    phrase.sourceKind = 3
    phrase.sourceBank = 8
    phrase.bank = 'club_2'
    const result = buildRekordboxAuthoritativeSections({
      phrases: [phrase],
      durationSec: 4,
      barFeatures: barsFromEnergies([0.35, 0.40, 0.42, 0.38]),
    })

    expect(result.sections[0]?.interpretation?.rekordboxPhrase).toMatchObject({
      phraseIndex: 0,
      sourceIndex: 1,
      originalKind: 'verse_2',
      normalizedLabel: 'verse',
      sourceKind: 3,
      mood: 'mid_energy',
      bank: 'club_2',
      sourceBank: 8,
      sourceStartBeat: 1,
      sourceEndBeat: 9,
      sourceStartTimeSec: 0,
      sourceEndTimeSec: 4,
    })
    expect(result.sections[0]?.interpretation?.classificationDiagnostics?.evidence[0]).toContain('Direct high-confidence Rekordbox mapping')
  })

  it('rejects missing or partial parser integrity even when surviving phrases look contiguous', () => {
    const phrases = [makePhrase(0, 'intro', 0, 4), makePhrase(1, 'verse_1', 4, 8)]
    const missing = validateRekordboxPssiImpl(phrases, 8)
    expect(missing.valid).toBe(false)
    expect(missing.reason).toContain('integrity metadata is unavailable')

    const partial = validateRekordboxPssiImpl(phrases, 8, completePssiIntegrity(3, {
      readableEntryCount: 2,
      complete: false,
      warnings: ['truncated'],
    }))
    expect(partial.valid).toBe(false)
    expect(partial.reason).toContain('2 readable phrase entries')
  })

  it('rejects internal beat-map corruption but accepts a final phrase ending before physical audio end', () => {
    const edgeSilence = [makePhrase(0, 'intro', 0.5, 4), makePhrase(1, 'outro', 4, 7)]
    expect(validateRekordboxPssi(edgeSilence, 10).valid).toBe(true)

    const internalGap = [
      makePhrase(0, 'intro', 0, 4),
      { ...makePhrase(1, 'outro', 4, 8), startBeat: 11 },
    ]
    const result = validateRekordboxPssi(internalGap, 8)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('structural gap')
  })

  it('keeps genuinely unclassifiable Rekordbox phrases Unknown instead of manufacturing Verse', () => {
    const unknown = makePhrase(0, '', 0, 4)
    unknown.rekordboxKind = null
    unknown.normalizedLabel = null
    unknown.sourceLabel = null
    unknown.sourceKind = 99
    const result = buildRekordboxAuthoritativeSections({ phrases: [unknown], durationSec: 4, barFeatures: [] })

    expect(result.valid).toBe(true)
    expect(result.sections[0]?.type).toBe('unknown')
    expect(result.sections[0]?.labelConfidence).toBeLessThan(0.5)
  })

})
