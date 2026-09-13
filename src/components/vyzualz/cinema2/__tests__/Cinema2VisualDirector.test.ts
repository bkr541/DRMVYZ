import { describe, expect, it, vi } from 'vitest'
import type { AudioFeatureBusPublicationMeta } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import {
  Cinema2AudioIntelligenceBridge,
  type Cinema2AudioIntelligenceSource,
} from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'

function frame(overrides: Partial<MusicIntelligenceFrame> = {}): MusicIntelligenceFrame {
  return {
    ...DEFAULT_MI_FRAME,
    ...overrides,
    bands: { ...DEFAULT_MI_FRAME.bands, ...overrides.bands },
    rhythm: { ...DEFAULT_MI_FRAME.rhythm, ...overrides.rhythm },
    energy: { ...DEFAULT_MI_FRAME.energy, ...overrides.energy },
    section: { ...DEFAULT_MI_FRAME.section, ...overrides.section },
    harmonic: { ...DEFAULT_MI_FRAME.harmonic, ...overrides.harmonic },
    stems: { ...DEFAULT_MI_FRAME.stems, ...overrides.stems },
    lyrics: { ...DEFAULT_MI_FRAME.lyrics, ...overrides.lyrics },
    semantics: { ...DEFAULT_MI_FRAME.semantics, ...overrides.semantics },
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, ...overrides.capabilities },
    confidence: { ...DEFAULT_MI_FRAME.confidence, ...overrides.confidence },
  }
}

function source(initialFrame = frame(), initialMeta: Partial<AudioFeatureBusPublicationMeta> = {}) {
  let currentFrame = initialFrame
  let currentMeta: AudioFeatureBusPublicationMeta = {
    sequence: initialMeta.sequence ?? 1,
    publishedAtMs: initialMeta.publishedAtMs ?? 10,
    publisherId: initialMeta.publisherId ?? 'visual-director-test',
    kind: initialMeta.kind ?? 'frame',
  }
  const getFrame = vi.fn(() => currentFrame)
  const getPublicationMeta = vi.fn(() => currentMeta)
  return {
    adapter: { getFrame, getPublicationMeta } satisfies Cinema2AudioIntelligenceSource,
    setFrame(next: MusicIntelligenceFrame) { currentFrame = next },
    setMeta(next: Partial<AudioFeatureBusPublicationMeta>) { currentMeta = { ...currentMeta, ...next } },
  }
}

function captureSequence(frames: readonly MusicIntelligenceFrame[]) {
  const upstream = source(frames[0])
  const bridge = new Cinema2AudioIntelligenceBridge(upstream.adapter)
  const director = new Cinema2VisualDirector()
  return frames.map((next, index) => {
    if (index > 0) {
      upstream.setFrame(next)
      upstream.setMeta({ sequence: index + 1, publishedAtMs: (index + 1) * 10 })
    }
    return director.capture(bridge.capture(index + 1))
  })
}

function structuralFrame(input: {
  frameId: number
  timeSec: number
  sectionType: string
  sectionStartSec: number
  sectionIntensity: number
  overallEnergy: number
  buildProgress: number
  buildConfidence: number
  dropConfidence: number
  transient?: number
  transientHit?: boolean
  semanticMoments?: MusicIntelligenceFrame['semanticMoments']
  phraseMarkers?: MusicIntelligenceFrame['phraseMarkers']
  phrase16Hit?: boolean
}): MusicIntelligenceFrame {
  return frame({
    frameId: input.frameId,
    sourceId: 'director-source',
    trackId: 'director-track',
    timeSec: input.timeSec,
    bands: { ...DEFAULT_MI_FRAME.bands, normalizedBass: input.overallEnergy },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.9,
      bpmSource: 'offline_analysis',
      beatPhase: 0,
      beatIndex: input.frameId * 4,
      beatInBar: 0,
      barIndex: input.frameId,
      transient: input.transient ?? 0,
      transientConfidence: 0.86,
      kickHit: input.transientHit ?? false,
      kickStrength: input.transient ?? 0,
      phrase16Hit: input.phrase16Hit ?? false,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: input.overallEnergy,
      rms: input.overallEnergy * 0.88,
      spectralFlux: input.transient ?? 0.2,
      buildProgress: input.buildProgress,
      tension: Math.max(input.buildProgress, input.transient ?? 0.2),
      trackCurve: input.sectionIntensity,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: input.sectionType as MusicIntelligenceFrame['section']['type'],
      label: input.sectionType,
      startSec: input.sectionStartSec,
      endSec: input.sectionStartSec + 8,
      progress: Math.min(1, Math.max(0, (input.timeSec - input.sectionStartSec) / 8)),
      intensity: input.sectionIntensity,
      confidence: 0.9,
      source: 'analysis',
    },
    semantics: {
      ...DEFAULT_MI_FRAME.semantics,
      buildConfidence: input.buildConfidence,
      dropConfidence: input.dropConfidence,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
    },
    analysisCapabilities: {
      reliableBeatGrid: true,
      reliableDownbeatGrid: true,
      barAwareSections: true,
      selfSimilarityAnalysis: true,
      semanticClassification: true,
      phraseHierarchy: (input.phraseMarkers?.length ?? 0) > 0,
      semanticMoments: (input.semanticMoments?.length ?? 0) > 0,
      legacyFallbackOnly: false,
    },
    analysisSource: 'bar_self_similarity',
    semanticMoments: input.semanticMoments,
    phraseMarkers: input.phraseMarkers,
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.82, rhythm: 0.9, section: 0.9 },
  })
}

describe('Cinema2VisualDirector', () => {
  it('keeps missing significance unavailable instead of manufacturing neutral-looking truth', () => {
    const [directorFrame] = captureSequence([frame()])

    expect(directorFrame.phase).toEqual({ available: false, value: null, confidence: null, evidence: [] })
    expect(directorFrame.continuous.intensity.available).toBe(false)
    expect(directorFrame.continuous.momentum.available).toBe(false)
    expect(directorFrame.context.build.available).toBe(false)
    expect(directorFrame.context.section.available).toBe(false)
    expect(directorFrame.authority.impact).toMatchObject({ available: false, occurred: false, authority: 0 })
    expect(directorFrame.authority.variation).toMatchObject({ available: false, occurred: false, authority: 0 })
    expect(directorFrame.context.transition).toMatchObject({ available: false, occurred: false, kind: null })
    expect(Object.isFrozen(directorFrame)).toBe(true)
    expect(Object.isFrozen(directorFrame.continuous)).toBe(true)
  })

  it('preserves low confidence as low confidence instead of treating weak truth as unavailable', () => {
    const [directorFrame] = captureSequence([frame({
      frameId: 1,
      sourceId: 'low-confidence-source',
      timeSec: 0.5,
      bands: { ...DEFAULT_MI_FRAME.bands, normalizedBass: 0.4 },
      energy: { ...DEFAULT_MI_FRAME.energy, instant: 0.42, rms: 0.36 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.04 },
    })])

    expect(directorFrame.continuous.intensity).toMatchObject({
      available: true,
      confidence: 0.04,
    })
    expect(directorFrame.phase).toMatchObject({
      available: true,
      value: 'steady',
      confidence: 0.04,
    })
    expect(directorFrame.authority.impact.available).toBe(false)
  })

  it('converts build and impact truth into generic phase and authority without choosing a visual action', () => {
    const build = structuralFrame({
      frameId: 1,
      timeSec: 10,
      sectionType: 'build',
      sectionStartSec: 8,
      sectionIntensity: 0.68,
      overallEnergy: 0.56,
      buildProgress: 0.84,
      buildConfidence: 0.92,
      dropConfidence: 0.08,
    })
    const drop = structuralFrame({
      frameId: 2,
      timeSec: 10.5,
      sectionType: 'drop',
      sectionStartSec: 10.5,
      sectionIntensity: 0.96,
      overallEnergy: 0.94,
      buildProgress: 0.08,
      buildConfidence: 0.05,
      dropConfidence: 0.97,
      transient: 0.94,
      transientHit: true,
      semanticMoments: [{ id: 'impact-a', timeSec: 10.5, type: 'drop_impact', confidence: 0.96, source: 'structural_analysis' }],
    })

    const [building, peak] = captureSequence([build, drop])

    expect(building.phase).toMatchObject({ available: true, value: 'building' })
    expect(building.context.build).toMatchObject({ available: true })
    expect(building.context.section.value).toMatchObject({ type: 'build', intensity: 0.68 })
    expect(building.authority.impact.occurred).toBe(false)

    expect(peak.phase).toMatchObject({ available: true, value: 'peak' })
    expect(peak.authority.impact).toMatchObject({ available: true, occurred: true })
    expect(peak.authority.impact.authority).toBeGreaterThan(0.9)
    expect(peak.authority.variation.occurred).toBe(true)
    expect(peak.context.transition).toMatchObject({
      available: true,
      occurred: true,
      kind: 'section-change',
    })
    expect(peak.context.section.value).toMatchObject({ type: 'drop', intensity: 0.96 })
    expect(JSON.stringify(peak)).not.toMatch(/reactor|lightning|strike|ray|core/i)
  })

  it('emits phrase/variation authority only when an authoritative boundary is crossed', () => {
    const marker = { id: 'phrase-a', timeSec: 2, phraseLength: 8 as const, confidence: 0.91, source: 'structural_boundary' as const }
    const before = structuralFrame({
      frameId: 1,
      timeSec: 1.9,
      sectionType: 'verse',
      sectionStartSec: 0,
      sectionIntensity: 0.5,
      overallEnergy: 0.45,
      buildProgress: 0.1,
      buildConfidence: 0.1,
      dropConfidence: 0.05,
      phraseMarkers: [marker],
    })
    const boundary = structuralFrame({
      frameId: 2,
      timeSec: 2,
      sectionType: 'verse',
      sectionStartSec: 0,
      sectionIntensity: 0.5,
      overallEnergy: 0.48,
      buildProgress: 0.12,
      buildConfidence: 0.1,
      dropConfidence: 0.05,
      phraseMarkers: [marker],
      phrase16Hit: true,
    })
    const after = structuralFrame({
      frameId: 3,
      timeSec: 2.1,
      sectionType: 'verse',
      sectionStartSec: 0,
      sectionIntensity: 0.5,
      overallEnergy: 0.47,
      buildProgress: 0.08,
      buildConfidence: 0.1,
      dropConfidence: 0.05,
      phraseMarkers: [marker],
    })

    const [first, second, third] = captureSequence([before, boundary, after])
    expect(first.authority.variation).toMatchObject({ available: true, occurred: false, authority: 0 })
    expect(second.authority.variation).toMatchObject({ available: true, occurred: true })
    expect(second.authority.variation.authority).toBeGreaterThan(0.6)
    expect(second.authority.variation.eventIds.some(id => id.includes('phrase-a'))).toBe(true)
    expect(third.authority.variation).toMatchObject({ available: true, occurred: false, authority: 0 })
  })

  it('resets section and momentum history on an audio discontinuity instead of emitting a false transition', () => {
    const first = structuralFrame({
      frameId: 1,
      timeSec: 1,
      sectionType: 'verse',
      sectionStartSec: 0,
      sectionIntensity: 0.35,
      overallEnergy: 0.35,
      buildProgress: 0.05,
      buildConfidence: 0.05,
      dropConfidence: 0,
    })
    const second = structuralFrame({
      frameId: 2,
      timeSec: 1.1,
      sectionType: 'build',
      sectionStartSec: 1.1,
      sectionIntensity: 0.7,
      overallEnergy: 0.65,
      buildProgress: 0.7,
      buildConfidence: 0.8,
      dropConfidence: 0.1,
    })
    const afterSeek = structuralFrame({
      frameId: 3,
      timeSec: 6,
      sectionType: 'breakdown',
      sectionStartSec: 5,
      sectionIntensity: 0.2,
      overallEnergy: 0.2,
      buildProgress: 0,
      buildConfidence: 0,
      dropConfidence: 0,
    })

    const [a, b, c] = captureSequence([first, second, afterSeek])
    expect(a.context.transition.occurred).toBe(false)
    expect(b.context.transition).toMatchObject({ occurred: true, kind: 'section-change' })
    expect(c.discontinuityGeneration).toBeGreaterThan(b.discontinuityGeneration)
    expect(c.context.transition).toMatchObject({ available: true, occurred: false, kind: null })
    expect(c.phase.value).toBe('low')
  })

  it('is deterministic for the same authoritative input sequence and Director state', () => {
    const frames = [
      structuralFrame({
        frameId: 1,
        timeSec: 4,
        sectionType: 'verse',
        sectionStartSec: 0,
        sectionIntensity: 0.48,
        overallEnergy: 0.42,
        buildProgress: 0.1,
        buildConfidence: 0.12,
        dropConfidence: 0.04,
      }),
      structuralFrame({
        frameId: 2,
        timeSec: 4.25,
        sectionType: 'verse',
        sectionStartSec: 0,
        sectionIntensity: 0.5,
        overallEnergy: 0.58,
        buildProgress: 0.25,
        buildConfidence: 0.3,
        dropConfidence: 0.06,
        transient: 0.35,
      }),
    ]

    expect(captureSequence(frames)).toEqual(captureSequence(frames))
  })
})
