import { describe, expect, it } from 'vitest'
import type { Cinema2AudioIntelligenceFrame } from '../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  CINEMA2_ATL_HOE_ENVELOPES,
  CINEMA2_ATL_HOE_SIGNAL_COMPONENT_MATRIX,
  Cinema2AtlHoeMusicAdapter,
} from '../modules/atlHoe/Cinema2AtlHoeMusicAdapter'

const signal = <T>(value: T | null, available = value != null, confidence = 0.9) => ({ available, value, confidence, source: 'test-analysis', provenance: null })
const event = (kind: 'beat' | 'downbeat' | 'kick' | 'snare' | 'transient', id: string, timeSec: number, strength = 1) => ({
  kind, id, timeSec, strength, confidence: 0.9, source: 'test-analysis', upstreamIdentity: id,
})

function frame(options: {
  timeSec?: number
  energy?: number
  buildProgress?: number
  buildConfidence?: number
  buildIntensity?: number
  section?: { id: string; type: string; confidence: number; intensity?: number; dropConfidence?: number | null } | null
  semanticDrop?: { id: string; timeSec: number; confidence: number } | null
  kick?: string | null
} = {}): Readonly<Cinema2ModuleFrameReadContext> {
  const timeSec = options.timeSec ?? 10
  const section = options.section ?? null
  const audio = {
    upstream: { frameId: Math.round(timeSec * 100), publicationSequence: 1, publicationKind: 'frame', publishedAtMs: timeSec * 1_000,
      publisherId: 'test', sourceId: 'source-a', trackId: 'track-a', timeSec, sampleRate: 48_000, analysisRevision: 'a1', timelineRevision: 't1' },
    discontinuity: { occurred: false, id: null, generation: 1, reason: null },
    bands: { sub: signal(0), bass: signal(0), lowMid: signal(0), mid: signal(0), high: signal(0), air: signal(0) },
    features: { overallEnergy: signal(options.energy ?? 0.25), trackEnergy: signal(0.5), rms: signal(0.2), spectralCentroid: signal(0),
      spectralFlux: signal(0), transientEnergy: signal(0), vocalPresence: signal(0), tension: signal(options.buildIntensity ?? 0), complexity: signal(0),
      buildProgress: signal(options.buildProgress ?? 0) },
    rhythm: { bpm: signal(120), beatPhase: signal(0), beatIndex: signal(20), beatInBar: signal(0), barIndex: signal(5),
      beat: null, downbeat: null, kick: options.kick ? event('kick', options.kick, timeSec) : null, snare: null, transient: null,
      fixedClocks: { 4: { lengthBeats: 4, progress: 0, boundary: null }, 8: { lengthBeats: 8, progress: 0, boundary: null },
        16: { lengthBeats: 16, progress: 0.25, boundary: null }, 32: { lengthBeats: 32, progress: 0, boundary: null } } },
    structure: { analyzedPhrases: signal([], true), section: signal(section ? { ...section, label: section.type, startSec: 0, endSec: 20,
      progress: 0.5, intensity: section.intensity ?? 0.8, source: 'test-analysis', authority: 'analysis', dropConfidence: section.dropConfidence ?? null } : null, !!section, section?.confidence ?? 0),
      semanticMoments: signal(options.semanticDrop ? [{ ...options.semanticDrop, durationSec: null, barIndex: 5, type: 'drop', source: 'test-analysis', relatedSectionId: section?.id ?? null }] : [], true),
      buildConfidence: signal(options.buildConfidence ?? 0), dropConfidence: signal(options.semanticDrop?.confidence ?? 0) },
  } as unknown as Cinema2AudioIntelligenceFrame
  return Object.freeze({ frameId: 1, timestampMs: timeSec * 1_000, deltaTimeSec: 1 / 60, elapsedTimeSec: timeSec,
    viewport: Object.freeze({ width: 1280, height: 720, dpr: 1 }), contextGeneration: 1, audio, director: null,
    transport: Object.freeze({ sourcePresent: true, playing: true, paused: false, analysisActive: true, animationActive: true, trackId: 'track-a', timeSec }) })
}

describe('ATL HOE music interpretation', () => {
  it('documents different component ownership and event envelopes', () => {
    expect(CINEMA2_ATL_HOE_SIGNAL_COMPONENT_MATRIX.sub).toContain('road')
    expect(CINEMA2_ATL_HOE_SIGNAL_COMPONENT_MATRIX.vocal).toContain('sign-letters')
    expect(CINEMA2_ATL_HOE_SIGNAL_COMPONENT_MATRIX.high).not.toEqual(CINEMA2_ATL_HOE_SIGNAL_COMPONENT_MATRIX.bass)
    expect(new Set(Object.values(CINEMA2_ATL_HOE_ENVELOPES).map(envelope => envelope.releaseMs)).size).toBe(9)
  })

  it('gates build progress with confidence and preserves progress, confidence and intensity separately', () => {
    const low = new Cinema2AtlHoeMusicAdapter().update(frame({ buildProgress: 0.9, buildConfidence: 0.2, buildIntensity: 1 }), 9.9, 1 / 60, 'playing')
    expect(low.continuous).toMatchObject({ buildProgress: 0.9, buildConfidence: 0.2, buildIntensity: 1 })
    expect(low.stage).not.toBe('buildup')
    const high = new Cinema2AtlHoeMusicAdapter().update(frame({ buildProgress: 0.9, buildConfidence: 0.95, buildIntensity: 1 }), 9.9, 1 / 60, 'playing')
    expect(high.stage).toBe('buildup')
  })

  it('rejects low-confidence structural changes and coalesces section plus semantic drop evidence', () => {
    const weak = new Cinema2AtlHoeMusicAdapter().update(frame({ section: { id: 'weak-drop', type: 'drop', confidence: 0.2, dropConfidence: 1 } }), 9.9, 1 / 60, 'playing')
    expect(weak.eventIds.section).toBeNull()
    expect(weak.dropEventId).toBeNull()

    const adapter = new Cinema2AtlHoeMusicAdapter()
    const first = adapter.update(frame({ section: { id: 'drop-a', type: 'drop', confidence: 0.96, dropConfidence: 0.95 },
      semanticDrop: { id: 'moment-a', timeSec: 10, confidence: 0.98 } }), 9.9, 1 / 60, 'playing')
    expect(first.events.filter(item => item.kind === 'drop')).toHaveLength(1)
    expect(first.dropEventId).toBe('moment-a')
    expect(first.events.find(item => item.kind === 'drop')).toMatchObject({ trackId: 'track-a', sourceId: 'source-a', analysisRevision: 'a1', timelineRevision: 't1' })
    const repeated = adapter.update(frame({ timeSec: 10.1, section: { id: 'drop-a', type: 'drop', confidence: 0.96, dropConfidence: 0.95 },
      semanticDrop: { id: 'moment-a', timeSec: 10, confidence: 0.98 } }), 10, 0.1, 'playing')
    expect(repeated.dropEventId).toBeNull()
  })

  it('uses separate kick decay, freezes it while paused, and clears it when stopped', () => {
    const adapter = new Cinema2AtlHoeMusicAdapter()
    const hit = adapter.update(frame({ kick: 'kick-a' }), 9.9, 1 / 60, 'playing')
    expect(hit.impulses.kick).toBeGreaterThan(0.8)
    const held = adapter.update(frame({ timeSec: 11 }), 10, 1, 'paused')
    expect(held.impulses.kick).toBe(hit.impulses.kick)
    const stopped = adapter.update(frame({ timeSec: 12 }), 11, 1, 'stopped')
    expect(stopped.impulses.kick).toBe(0)
  })
})
