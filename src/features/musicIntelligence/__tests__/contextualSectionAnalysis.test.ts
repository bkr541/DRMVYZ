import { describe, expect, it } from 'vitest'
import { classifyContextualSections } from '../contextualSectionAnalysis'
import type { BarMusicalFeatures, StructuralRegion } from '../types'

interface Profile {
  energy: number
  bass: number
  transient: number
  flux?: number
  centroid?: number
  complexity?: number
  silence?: number
  harmonicChange?: number
  highOnset?: number
  midOnset?: number
  lowOnset?: number
}

const VERSE: Profile = {
  energy: 0.46,
  bass: 0.48,
  transient: 0.42,
  flux: 0.32,
  centroid: 0.42,
  complexity: 0.44,
  harmonicChange: 0.16,
}
const HIGH_VERSE: Profile = {
  energy: 0.76,
  bass: 0.62,
  transient: 0.52,
  flux: 0.38,
  centroid: 0.48,
  complexity: 0.52,
  harmonicChange: 0.14,
}
const DROP: Profile = {
  energy: 0.92,
  bass: 0.92,
  transient: 0.88,
  flux: 0.82,
  centroid: 0.62,
  complexity: 0.74,
  harmonicChange: 0.18,
  lowOnset: 0.92,
  midOnset: 0.76,
  highOnset: 0.72,
}
const QUIET: Profile = {
  energy: 0.20,
  bass: 0.18,
  transient: 0.16,
  flux: 0.18,
  centroid: 0.34,
  complexity: 0.28,
  silence: 0.12,
  harmonicChange: 0.20,
}
const AMBIGUOUS: Profile = {
  energy: 0.50,
  bass: 0.36,
  transient: 0.34,
  flux: 0.42,
  centroid: 0.54,
  complexity: 0.48,
  harmonicChange: 0.52,
}

function buildProfile(position: number, length: number): Profile {
  const progress = length <= 1 ? 1 : position / (length - 1)
  return {
    energy: 0.40 + progress * 0.34,
    bass: 0.42 - progress * 0.08,
    transient: 0.38 + progress * 0.42,
    flux: 0.34 + progress * 0.45,
    centroid: 0.38 + progress * 0.34,
    complexity: 0.40 + progress * 0.30,
    harmonicChange: 0.20 + progress * 0.18,
    highOnset: 0.30 + progress * 0.54,
    midOnset: 0.34 + progress * 0.42,
    lowOnset: 0.42 + progress * 0.18,
  }
}

const PRE_DROP: Profile = {
  energy: 0.28,
  bass: 0.08,
  transient: 0.18,
  flux: 0.78,
  centroid: 0.72,
  complexity: 0.58,
  silence: 0.30,
  harmonicChange: 0.42,
  lowOnset: 0.08,
  midOnset: 0.78,
  highOnset: 0.88,
}

function makeBar(index: number, profile: Profile): BarMusicalFeatures {
  const energy = profile.energy
  return {
    barIndex: index,
    startSec: index * 2,
    endSec: (index + 1) * 2,
    source: 'bar_grid',
    gridSource: 'automatic',
    gridConfidence: 0.92,
    meanEnergy: energy,
    peakEnergy: Math.min(1, energy + 0.08),
    energySlope: 0,
    dynamicRange: 0.24,
    bassAverage: profile.bass,
    midAverage: Math.min(1, 0.34 + (profile.complexity ?? 0.4) * 0.25),
    highAverage: Math.min(1, 0.24 + (profile.centroid ?? 0.4) * 0.32),
    spectralFlux: profile.flux ?? profile.transient,
    spectralCentroid: profile.centroid ?? 0.45,
    spectralComplexity: profile.complexity ?? 0.45,
    overallTransientDensity: profile.transient,
    lowFrequencyOnsetDensity: profile.lowOnset ?? profile.transient * 0.82,
    midFrequencyOnsetDensity: profile.midOnset ?? profile.transient * 0.72,
    highFrequencyOnsetDensity: profile.highOnset ?? profile.transient * 0.62,
    silenceRatio: profile.silence ?? 0,
    chromaSummary: [0.38, 0.03, 0.08, 0.03, 0.18, 0.04, 0.05, 0.12, 0.02, 0.05, 0.01, 0.01],
    harmonicChange: profile.harmonicChange ?? 0.2,
  }
}

function append(bars: BarMusicalFeatures[], profile: Profile, count: number): void {
  for (let index = 0; index < count; index++) bars.push(makeBar(bars.length, profile))
}

function appendBuild(bars: BarMusicalFeatures[], count: number): void {
  for (let index = 0; index < count; index++) bars.push(makeBar(bars.length, buildProfile(index, count)))
}

function regionsFromCuts(bars: BarMusicalFeatures[], cuts: number[]): StructuralRegion[] {
  const sorted = [...new Set([0, ...cuts, bars.length])].sort((a, b) => a - b)
  return sorted.slice(0, -1).map((startBar, index) => {
    const endBar = sorted[index + 1]!
    return {
      id: `structural-region-${index}`,
      startSec: startBar === 0 ? 0 : bars[startBar]!.startSec,
      endSec: endBar >= bars.length ? bars.length * 2 : bars[endBar]!.startSec,
      startBar,
      endBar,
      durationBars: endBar - startBar,
      boundaryConfidence: 0.82,
      internalCohesion: 0.78,
      gridConfidence: 0.92,
      relatedRegions: [],
      analysisSource: 'bar_self_similarity',
      diagnostics: {
        meanEnergy: 0.5,
        energySlope: 0,
        transientDensity: 0.5,
        harmonicChange: 0.2,
        repeatAffinity: 0.6,
        phrasePriorScore: 0.8,
      },
    }
  })
}

function analyze(bars: BarMusicalFeatures[], cuts: number[]) {
  return classifyContextualSections({
    barFeatures: bars,
    regions: regionsFromCuts(bars, cuts),
    durationSec: bars.length * 2,
  })
}

function sectionOfType(result: ReturnType<typeof analyze>, type: string, occurrence = 0) {
  return result.sections.filter(section => section.type === type)[occurrence]
}

describe('contextual section classification', () => {
  it('keeps stable Verse bars out of an eight-bar Build', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    appendBuild(bars, 8)
    append(bars, DROP, 8)

    const result = analyze(bars, [4, 16])
    const build = sectionOfType(result, 'build')
    const drop = sectionOfType(result, 'drop')

    expect(build?.interpretation?.startBar).toBe(8)
    expect(build?.interpretation?.durationBars).toBe(8)
    expect(drop?.interpretation?.startBar).toBe(16)
    expect(result.sections.some(section => section.type === 'verse' && section.endSec === 16)).toBe(true)
  })

  it.each([4, 16])('recognizes a musically supported %i-bar Build', buildBars => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    appendBuild(bars, buildBars)
    append(bars, DROP, 8)

    const result = analyze(bars, [4, 8 + buildBars])
    const build = sectionOfType(result, 'build')

    expect(build?.interpretation?.startBar).toBe(8)
    expect(build?.interpretation?.durationBars).toBe(buildBars)
  })

  it('separates an optional two-bar Pre-Drop from the Build', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    appendBuild(bars, 8)
    append(bars, PRE_DROP, 2)
    append(bars, DROP, 8)

    const result = analyze(bars, [4, 18])
    const build = sectionOfType(result, 'build')
    const preDrop = sectionOfType(result, 'preDrop')

    expect(build?.interpretation?.startBar).toBe(8)
    expect(build?.interpretation?.endBar).toBe(16)
    expect(preDrop?.interpretation?.startBar).toBe(16)
    expect(preDrop?.interpretation?.durationBars).toBe(2)
  })

  it('uses the sustained rise onset rather than an early structural boundary', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 12)
    appendBuild(bars, 4)
    append(bars, DROP, 8)

    const result = analyze(bars, [4, 16])
    const build = sectionOfType(result, 'build')

    expect(build?.interpretation?.startBar).toBe(12)
    expect(build?.interpretation?.boundaryRefinementReason).toContain('4-bar evidence')
  })

  it('distinguishes a quiet Intro from a post-Drop Breakdown', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, QUIET, 4)
    append(bars, VERSE, 8)
    appendBuild(bars, 4)
    append(bars, DROP, 8)
    append(bars, QUIET, 8)
    appendBuild(bars, 4)
    append(bars, DROP, 8)
    append(bars, QUIET, 4)

    const result = analyze(bars, [4, 12, 16, 24, 32, 36, 44])

    expect(result.sections[0]?.type).toBe('intro')
    expect(result.sections.some(section => section.type === 'breakdown' && section.interpretation?.startBar === 24)).toBe(true)
  })

  it('does not call a low-energy middle region Breakdown without release context', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    append(bars, QUIET, 4)
    append(bars, VERSE, 8)

    const result = analyze(bars, [8, 12])
    const middle = result.sections.find(section => section.interpretation?.startBar === 8)

    expect(middle?.type).not.toBe('breakdown')
  })

  it('does not label a stable high-energy Verse as Drop from loudness alone', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 4)
    append(bars, HIGH_VERSE, 8)
    appendBuild(bars, 4)
    append(bars, DROP, 8)

    const result = analyze(bars, [4, 12, 16])
    const highVerse = result.sections.find(section => section.interpretation?.startBar === 4)

    expect(highVerse?.type).toBe('verse')
    expect(highVerse?.dropConfidence).toBe(0)
    expect(highVerse?.interpretation?.classificationDiagnostics?.evidence.join(' ')).toContain('loudness alone')
  })

  it('relates Drop 1 and Drop 2 as a deterministic repeated family', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    appendBuild(bars, 8)
    append(bars, DROP, 8)
    append(bars, QUIET, 8)
    appendBuild(bars, 8)
    append(bars, DROP, 8)

    const result = analyze(bars, [8, 16, 24, 32, 40, 48])
    const drops = result.sections.filter(section => section.type === 'drop')

    expect(drops).toHaveLength(2)
    expect(drops[0]?.interpretation?.familyId).toBeTruthy()
    expect(drops[1]?.interpretation?.familyId).toBe(drops[0]?.interpretation?.familyId)
    expect(drops.map(section => section.interpretation?.occurrenceIndex)).toEqual([1, 2])
    expect(drops[1]?.interpretation?.relatedSectionIds).toContain(drops[0]!.id)
  })

  it('stores bounded alternatives when a region is semantically ambiguous', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    append(bars, AMBIGUOUS, 8)
    append(bars, VERSE, 8)

    const result = analyze(bars, [8, 16])
    const middle = result.sections.find(section => section.interpretation?.startBar === 8)
    const alternatives = middle?.interpretation?.alternativeLabels ?? []

    expect(alternatives.length).toBeGreaterThanOrEqual(2)
    expect(alternatives.length).toBeLessThanOrEqual(3)
    expect(alternatives.reduce((sum, alternative) => sum + alternative.confidence, 0)).toBeCloseTo(1, 3)
    expect(middle?.boundaryConfidence).not.toBe(middle?.labelConfidence)
  })

  it('is deterministic and covers the complete track without gaps or overlaps', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    appendBuild(bars, 8)
    append(bars, PRE_DROP, 2)
    append(bars, DROP, 8)
    append(bars, QUIET, 8)

    const first = analyze(bars, [4, 18, 26])
    const second = analyze(bars, [4, 18, 26])

    expect(second).toEqual(first)
    expect(first.sections[0]?.startSec).toBe(0)
    expect(first.sections[first.sections.length - 1]?.endSec).toBe(bars.length * 2)
    for (let index = 1; index < first.sections.length; index++) {
      expect(first.sections[index]?.startSec).toBe(first.sections[index - 1]?.endSec)
    }
  })

  it('does not pull a Build backward across a small production change in stable Verse material', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    append(bars, { ...VERSE, energy: 0.51, transient: 0.46, flux: 0.38 }, 4)
    appendBuild(bars, 8)
    append(bars, DROP, 8)

    const result = analyze(bars, [8, 12, 20])
    const build = sectionOfType(result, 'build')

    expect(build?.interpretation?.startBar).toBe(12)
    expect(build?.interpretation?.durationBars).toBe(8)
  })

  it('accepts a real Drop without inventing a conventional Build', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    append(bars, DROP, 8)

    const result = analyze(bars, [8])
    const drop = sectionOfType(result, 'drop')

    expect(drop?.interpretation?.startBar).toBe(8)
    expect(result.sections.some(section => section.type === 'build')).toBe(false)
  })

  it('keeps a one-bar fakeout distinct from the later stable Drop anchor', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    appendBuild(bars, 4)
    append(bars, { ...DROP, energy: 0.78, bass: 0.72, transient: 0.76 }, 1)
    append(bars, PRE_DROP, 3)
    append(bars, DROP, 8)

    const result = analyze(bars, [8, 12, 13, 16])
    const drops = result.sections.filter(section => section.type === 'drop')

    expect(drops.some(section => section.interpretation?.startBar === 16)).toBe(true)
    expect(drops.some(section => section.interpretation?.startBar === 12)).toBe(false)
  })

  it.each([
    ['melodic dubstep', [QUIET, VERSE], 8, 8, true],
    ['heavy dubstep', [VERSE], 8, 4, true],
    ['hybrid trap', [VERSE], 8, 8, true],
    ['drum and bass', [{ ...VERSE, transient: 0.72, highOnset: 0.78 }], 16, 8, true],
    ['house', [{ ...VERSE, energy: 0.58, transient: 0.62 }], 16, 8, true],
    ['hip-hop', [{ ...VERSE, energy: 0.52, transient: 0.32 }], 24, 0, false],
    ['pop', [{ ...VERSE, harmonicChange: 0.32 }], 16, 4, true],
    ['ambient/free-time intro', [{ ...QUIET, transient: 0.03, silence: 0.24 }], 16, 0, false],
    ['sparse percussion', [{ ...VERSE, transient: 0.08, lowOnset: 0.05, highOnset: 0.04 }], 16, 0, false],
  ] as const)('remains deterministic and gap-free for %s structure', (_genre, openingProfiles, stableBars, buildBars, includeDrop) => {
    const bars: BarMusicalFeatures[] = []
    for (const profile of openingProfiles) append(bars, profile, 4)
    append(bars, openingProfiles[openingProfiles.length - 1]!, stableBars)
    if (buildBars > 0) appendBuild(bars, buildBars)
    if (includeDrop) append(bars, DROP, 8)
    append(bars, QUIET, 8)

    const cuts = [4, openingProfiles.length * 4, openingProfiles.length * 4 + stableBars]
    if (buildBars > 0) cuts.push(openingProfiles.length * 4 + stableBars + buildBars)
    const first = analyze(bars, cuts)
    const second = analyze(bars, cuts)

    expect(second).toEqual(first)
    expect(first.sections[0]?.startSec).toBe(0)
    expect(first.sections[first.sections.length - 1]?.endSec).toBe(bars.length * 2)
    for (let index = 1; index < first.sections.length; index++) {
      expect(first.sections[index]?.startSec).toBe(first.sections[index - 1]?.endSec)
    }
    if (!includeDrop) expect(first.sections.every(section => section.type !== 'drop')).toBe(true)
  })

  it('resolves a long release tail as an Outro rather than extending the Drop indefinitely', () => {
    const bars: BarMusicalFeatures[] = []
    append(bars, VERSE, 8)
    appendBuild(bars, 8)
    append(bars, DROP, 8)
    append(bars, QUIET, 20)

    const result = analyze(bars, [8, 16, 24, 32])

    expect(result.sections[result.sections.length - 1]?.type).toBe('outro')
    expect(result.sections[result.sections.length - 1]?.interpretation?.durationBars).toBeGreaterThanOrEqual(12)
  })

})
