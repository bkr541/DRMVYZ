import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { AudioFeatureBusPublicationMeta } from '../../../../features/musicIntelligence/AudioFeatureBus'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import {
  Cinema2AudioIntelligenceBridge,
  type Cinema2AudioIntelligenceSource,
} from '../audio/Cinema2AudioIntelligenceBridge'

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
    publisherId: initialMeta.publisherId ?? 'music-engine',
    kind: initialMeta.kind ?? 'frame',
  }
  const getFrame = vi.fn(() => currentFrame)
  const getPublicationMeta = vi.fn(() => currentMeta)
  return {
    adapter: { getFrame, getPublicationMeta } satisfies Cinema2AudioIntelligenceSource,
    getFrame,
    getPublicationMeta,
    setFrame(next: MusicIntelligenceFrame) { currentFrame = next },
    setMeta(next: Partial<AudioFeatureBusPublicationMeta>) { currentMeta = { ...currentMeta, ...next } },
  }
}

describe('Cinema2AudioIntelligenceBridge', () => {
  it('keeps unavailable, authoritative zero, and low-confidence values distinct', () => {
    const upstream = source(frame())
    const bridge = new Cinema2AudioIntelligenceBridge(upstream.adapter)

    const missing = bridge.capture(1)
    expect(missing.bands.bass).toEqual({
      available: false,
      value: null,
      confidence: null,
      source: null,
      provenance: null,
    })
    expect(missing.features.spectralCentroid.available).toBe(false)

    upstream.setFrame(frame({
      frameId: 4,
      sourceId: 'track-audio',
      bands: { ...DEFAULT_MI_FRAME.bands, normalizedBass: 0 },
      rhythm: { ...DEFAULT_MI_FRAME.rhythm, transientConfidence: 0.05 },
      energy: { ...DEFAULT_MI_FRAME.energy, spectralFlux: 0 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.05 },
    }))
    upstream.setMeta({ sequence: 2 })

    const presentZero = bridge.capture(2)
    expect(presentZero.bands.bass.available).toBe(true)
    expect(presentZero.bands.bass.value).toBe(0)
    expect(presentZero.bands.bass.confidence).toBe(0.05)
    expect(presentZero.features.spectralFlux).toMatchObject({ available: true, value: 0, confidence: 0.05 })
    // Upstream has no Meyda capability bit, so an all-zero tuple is not claimed as authoritative.
    expect(presentZero.features.spectralCentroid.available).toBe(false)
  })

  it('preserves source/provenance and stable event identity across Cinema render frames', () => {
    const upstream = source(frame({
      frameId: 18,
      sourceId: 'source-a',
      trackId: 'track-a',
      timeSec: 8.25,
      rhythm: {
        ...DEFAULT_MI_FRAME.rhythm,
        bpm: 128,
        bpmConfidence: 0.31,
        bpmSource: 'rekordbox',
        beatPhase: 0,
        beatHit: true,
        beatIndex: 32,
        beatEventId: 771,
        beatEventTimeSec: 8.25,
        beatInBar: 0,
        barIndex: 8,
        downbeatHit: true,
        kickHit: true,
        kickStrength: 0.7,
        transient: 0.7,
        transientConfidence: 0.24,
      },
      capabilities: {
        ...DEFAULT_MI_FRAME.capabilities!,
        liveBands: true,
        rhythmEvents: true,
        beatGrid: true,
      },
      analysisSources: {
        bpm: 'rekordbox',
        beatGrid: 'rekordbox',
        key: 'drmvyz',
        trackSections: 'rekordbox',
      },
      trackProvenance: { trackOrigin: 'rekordbox' },
      confidence: { ...DEFAULT_MI_FRAME.confidence, rhythm: 0.31 },
    }), { sequence: 91, publisherId: 'authoritative-publisher' })
    const bridge = new Cinema2AudioIntelligenceBridge(upstream.adapter)

    const first = bridge.capture(1)
    const second = bridge.capture(2)
    const secondAgain = bridge.capture(2)

    expect(first.rhythm.beat?.id).toBe(second.rhythm.beat?.id)
    expect(first.rhythm.kick?.id).toBe(second.rhythm.kick?.id)
    expect(first.rhythm.beat?.upstreamIdentity).toContain('beat-event:771')
    expect(first.rhythm.bpm).toMatchObject({ available: true, value: 128, confidence: 0.31, source: 'rekordbox' })
    expect(first.rhythm.bpm.provenance).toMatchObject({
      featureSource: 'rekordbox',
      trackOrigin: 'rekordbox',
      publisherId: 'authoritative-publisher',
    })
    expect(secondAgain).toBe(second)
    expect(upstream.getFrame).toHaveBeenCalledTimes(2)
    expect(upstream.getPublicationMeta).toHaveBeenCalledTimes(2)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.rhythm)).toBe(true)
  })

  it('carries reset/seek/restart discontinuity identity without inheriting smoothing state', () => {
    const upstream = source(frame({ frameId: 1, sourceId: 'source-a', timeSec: 0.1 }), { sequence: 1 })
    const bridge = new Cinema2AudioIntelligenceBridge(upstream.adapter)

    const activation = bridge.capture(1)
    expect(activation.discontinuity).toMatchObject({ occurred: true, generation: 1, reason: 'activation' })
    expect(activation.smoothingOwnership).toBe('upstream-music-intelligence')

    upstream.setFrame(frame({ frameId: 2, sourceId: 'source-a', timeSec: 0.2 }))
    upstream.setMeta({ sequence: 2 })
    expect(bridge.capture(2).discontinuity).toMatchObject({ occurred: false, generation: 1, reason: null })

    upstream.setFrame(frame({ frameId: 3, sourceId: 'source-a', timeSec: 4 }))
    upstream.setMeta({ sequence: 3 })
    const seek = bridge.capture(3)
    expect(seek.discontinuity).toMatchObject({ occurred: true, generation: 2, reason: 'seek' })
    expect(seek.discontinuity.id).toContain(':seek')

    upstream.setFrame(frame({ frameId: 4, sourceId: 'source-a', timeSec: 0 }))
    upstream.setMeta({ sequence: 4 })
    const restart = bridge.capture(4)
    expect(restart.discontinuity).toMatchObject({ occurred: true, generation: 3, reason: 'restart' })
    expect(restart.discontinuity.id).toContain(':restart')

    upstream.setMeta({ sequence: 5, kind: 'reset' })
    const reset = bridge.capture(5)
    expect(reset.discontinuity).toMatchObject({ occurred: true, generation: 4, reason: 'bus-reset' })
  })

  it('keeps optional stems absent until upstream capability truth says they exist', () => {
    const upstream = source(frame({ frameId: 1, capabilities: { ...DEFAULT_MI_FRAME.capabilities!, stemCurves: false } }))
    const bridge = new Cinema2AudioIntelligenceBridge(upstream.adapter)
    expect(bridge.capture(1).stems.available).toBe(false)

    upstream.setFrame(frame({
      frameId: 2,
      timeSec: 0.1,
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, stemCurves: true },
      stems: { ...DEFAULT_MI_FRAME.stems, vocals: 0, drums: 0.2, vocalActivity: 0 },
    }))
    upstream.setMeta({ sequence: 2 })
    const present = bridge.capture(2).stems
    expect(present.available).toBe(true)
    expect(present.value).toMatchObject({ vocals: 0, drums: 0.2, vocalActivity: 0 })
  })

  it('keeps lyrics and structured harmonics optional instead of manufacturing neutral values', () => {
    const upstream = source(frame({ frameId: 1, sourceId: 'optional-data' }))
    const bridge = new Cinema2AudioIntelligenceBridge(upstream.adapter)
    const absent = bridge.capture(1)
    expect(absent.lyrics.available).toBe(false)
    expect(absent.harmonic.available).toBe(false)

    upstream.setFrame(frame({
      frameId: 2,
      sourceId: 'optional-data',
      timeSec: 0.1,
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, lyrics: true },
      lyrics: {
        ...DEFAULT_MI_FRAME.lyrics,
        activeLine: null,
        activeLineId: null,
        vocalActivity: 0,
        phraseConfidence: 0.2,
        isGap: true,
      },
      harmonic: {
        ...DEFAULT_MI_FRAME.harmonic,
        key: 'C',
        mode: 'minor',
        keyConfidence: 0,
      },
      confidence: { ...DEFAULT_MI_FRAME.confidence, harmonic: 0 },
    }))
    upstream.setMeta({ sequence: 2 })
    const present = bridge.capture(2)

    expect(present.lyrics).toMatchObject({
      available: true,
      value: { activeLine: null, vocalActivity: 0, isGap: true },
      confidence: 0.2,
    })
    expect(present.harmonic).toMatchObject({
      available: true,
      value: { key: 'C', mode: 'minor', keyConfidence: 0 },
      confidence: 0,
      source: 'music-intelligence-harmonic',
    })
  })

  it('keeps analyzed phrase markers distinct from deterministic fixed beat clocks', () => {
    const upstream = source(frame({
      frameId: 7,
      trackId: 'track-phrases',
      timeSec: 12,
      rhythm: {
        ...DEFAULT_MI_FRAME.rhythm,
        bpm: 120,
        beatIndex: 24,
        beatInBar: 0,
        barIndex: 6,
        phrase8Progress: 0.5,
        phrase8Hit: false,
      },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, beatGrid: true },
      analysisCapabilities: { ...DEFAULT_MI_FRAME.analysisCapabilities!, phraseHierarchy: true },
      phraseMarkers: [{
        id: 'analysis-phrase-a',
        timeSec: 8,
        phraseLength: 8,
        lengthBars: 8,
        barIndex: 4,
        confidence: 0.93,
        source: 'structural_boundary',
        structurallyDetected: true,
      }],
    }))
    const snapshot = new Cinema2AudioIntelligenceBridge(upstream.adapter).capture(1)

    expect(snapshot.rhythm.fixedClocks[8]).toMatchObject({ lengthBeats: 8, progress: 0.5 })
    expect(snapshot.structure.analyzedPhrases.available).toBe(true)
    expect(snapshot.structure.analyzedPhrases.value?.[0]).toMatchObject({
      lengthBars: 8,
      confidence: 0.93,
      source: 'structural_boundary',
      structurallyDetected: true,
    })
    expect(snapshot.structure.analyzedPhrases.value?.[0]?.id).toContain('analysis-phrase-a')
  })
})
