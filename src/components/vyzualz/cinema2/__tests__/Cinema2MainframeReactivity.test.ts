import { describe, expect, it } from 'vitest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  CINEMA2_MAINFRAME_DEFAULT_PATTERN,
  CINEMA2_MAINFRAME_PATTERN_IDS,
  Cinema2MainframeReactivityEngine,
  evaluateCinema2MainframePattern,
  resolveCinema2MainframeBeatClock,
} from '../modules/mainframe/Cinema2MainframePatternEngine'
import {
  CINEMA2_MAINFRAME_BANKS,
  CINEMA2_MAINFRAME_IMPULSES,
  CINEMA2_MAINFRAME_REGIONS,
  CINEMA2_MAINFRAME_SIGNAL_IDS,
  CINEMA2_MAINFRAME_SYSTEMS,
  CINEMA2_MAINFRAME_ZERO_IMPULSES,
  CINEMA2_MAINFRAME_ZERO_SIGNALS,
} from '../modules/mainframe/Cinema2MainframeReactivity'

const available = (value: number) => ({ available: true, value, confidence: 1, source: 'test', provenance: null })
const unavailable = () => ({ available: false, value: null, confidence: null, source: null, provenance: null })

function frame(options: {
  time?: number
  delta?: number
  paused?: boolean
  beatIndex?: number
  beatPhase?: number
  event?: { kind: 'beat' | 'kick' | 'snare' | 'downbeat'; id: string }
  semanticMoments?: readonly { id: string; timeSec: number; type: 'drop' }[]
  discontinuity?: boolean
} = {}): Readonly<Cinema2ModuleFrameReadContext> {
  const time = options.time ?? 0
  const event = options.event
  const audioEvent = (kind: string) => event?.kind === kind ? { id: event.id, kind, timeSec: time, strength: 1, confidence: 1, source: 'test', upstreamIdentity: event.id } : null
  const fixed = (lengthBeats: 4 | 8 | 16 | 32) => ({ lengthBeats, progress: 0, boundary: null })
  return {
    frameId: Math.round(time * 1000), timestampMs: time * 1000, deltaTimeSec: options.delta ?? 1 / 60, elapsedTimeSec: time,
    viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: 1,
    transport: { sourcePresent: true, playing: !options.paused, paused: options.paused ?? false, analysisActive: true, animationActive: !options.paused, trackId: 'track', timeSec: time, bpmSync: true, bpm: 120 },
    director: null,
    audio: {
      version: 1, visualFrameId: 1, smoothingOwnership: 'upstream-music-intelligence',
      upstream: { frameId: 1, publicationSequence: 1, publicationKind: 'live', publishedAtMs: 0, publisherId: 'test', sourceId: 'test', trackId: 'track', timeSec: time, sampleRate: 48000, analysisRevision: null, timelineRevision: null },
      capabilities: {},
      discontinuity: { occurred: options.discontinuity ?? false, id: options.discontinuity ? 'seek' : null, generation: options.discontinuity ? 2 : 1, reason: options.discontinuity ? 'seek' : null },
      bands: { sub: available(0.4), bass: available(0.6), lowMid: available(0.35), mid: available(0.5), high: available(0.45), air: available(0.25) },
      features: { overallEnergy: available(0.55), rms: available(0.5), spectralCentroid: unavailable(), spectralFlux: available(0.4), transientEnergy: available(0.3), vocalPresence: available(0.45), tension: unavailable(), complexity: unavailable(), buildProgress: available(0.35), trackEnergy: available(0.5) },
      rhythm: {
        bpm: available(128), beatPhase: available(options.beatPhase ?? 0.25), beatIndex: available(options.beatIndex ?? 0), beatInBar: available((options.beatIndex ?? 0) % 4), barIndex: available(Math.floor((options.beatIndex ?? 0) / 4)),
        beat: audioEvent('beat'), kick: audioEvent('kick'), snare: audioEvent('snare'), downbeat: audioEvent('downbeat'), transient: null,
        fixedClocks: { 4: fixed(4), 8: fixed(8), 16: fixed(16), 32: fixed(32) },
      },
      structure: { analyzedPhrases: unavailable(), section: unavailable(), semanticMoments: { ...unavailable(), available: true, value: options.semanticMoments ?? [] }, buildConfidence: available(0.3), dropConfidence: available(0) },
      stems: unavailable(), lyrics: unavailable(), harmonic: unavailable(),
    } as never,
  }
}

describe('Mainframe Stage 4 reactivity', () => {
  it('preserves the typed Pass 3 systems, banks, regions and authored envelope timing', () => {
    expect(CINEMA2_MAINFRAME_SYSTEMS).toHaveLength(9)
    expect(CINEMA2_MAINFRAME_BANKS).toEqual(['A', 'B', 'C', 'D'])
    expect(CINEMA2_MAINFRAME_REGIONS).toEqual(['bottom-center', 'left-branch', 'left-major', 'left-minor', 'right-branch', 'right-major', 'right-minor', 'top-center'])
    expect(CINEMA2_MAINFRAME_SIGNAL_IDS).toHaveLength(7)
    expect(CINEMA2_MAINFRAME_IMPULSES.kick).toMatchObject({ attackMs: 18, releaseMs: 130, targets: ['terminals'] })
    expect(CINEMA2_MAINFRAME_IMPULSES.drop).toMatchObject({ attackMs: 10, releaseMs: 850 })
  })

  it('produces six deterministic and materially distinct lighting programs', () => {
    const signals = { sub: 0.4, bass: 0.6, mid: 0.5, high: 0.45, flux: 0.35, vocal: 0.5, build: 0.3, overall: 0.55 }
    const impulses = { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, beat: 0.8, snare: 0.4, fourBeat: 0.6 }
    const frames = CINEMA2_MAINFRAME_PATTERN_IDS.map(pattern => evaluateCinema2MainframePattern({ pattern, beats: 5.25, signals, impulses }))
    expect(new Set(frames.map(value => JSON.stringify([value.chaseDirection, value.chaseGain, value.bankWeights, value.regionWeights, value.systemGains]))).size).toBe(6)
    expect(evaluateCinema2MainframePattern({ pattern: 'outward-bus', beats: 1, signals, impulses }).chaseDirection).toBe(1)
    expect(evaluateCinema2MainframePattern({ pattern: 'inward-boot', beats: 1, signals, impulses }).chaseDirection).toBe(-1)
    const outwardAcrossTwoBars = Array.from({ length: 9 }, (_, beat) => evaluateCinema2MainframePattern({ pattern: 'outward-bus', beats: beat, signals, impulses }))
    expect(outwardAcrossTwoBars[0]?.chaseFront).toBe(outwardAcrossTwoBars[4]?.chaseFront)
    expect(outwardAcrossTwoBars[4]?.chaseFront).toBe(outwardAcrossTwoBars[8]?.chaseFront)
    expect(outwardAcrossTwoBars[3]?.chaseFront).toBeGreaterThan(outwardAcrossTwoBars[1]?.chaseFront as number)
  })

  it('routes continuous bands and every authored impulse across all reactive systems', () => {
    const oneSignals = Object.fromEntries(Object.keys(CINEMA2_MAINFRAME_ZERO_SIGNALS).map(key => [key, 1])) as never
    const oneImpulses = Object.fromEntries(Object.keys(CINEMA2_MAINFRAME_ZERO_IMPULSES).map(key => [key, 1])) as never
    const result = evaluateCinema2MainframePattern({ pattern: 'system-surge', beats: 7.5, signals: oneSignals, impulses: oneImpulses })
    expect(result.systemGains.slice(1).every(value => value > 0)).toBe(true)
    expect(result.regionWeights[0]).toBeGreaterThan(0)
    expect(result.regionWeights[7]).toBeGreaterThan(0)
  })

  it('uses canonical beat position with BPM Sync and a stable 120 BPM clock otherwise', () => {
    expect(resolveCinema2MainframeBeatClock(frame({ time: 10, beatIndex: 9, beatPhase: 0.5 }), true)).toBe(9.5)
    expect(resolveCinema2MainframeBeatClock(frame({ time: 10, beatIndex: 9, beatPhase: 0.5 }), false)).toBe(20)
  })

  it('restarts choreography phase from a deterministic pattern-change boundary', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    const result = engine.update(frame({ time: 10, beatIndex: 9, beatPhase: 0.5 }), 'radar-sweep', true, 8)
    expect(result.pattern).toBe('radar-sweep')
    expect(result.beats).toBe(1.5)
  })

  it('deduplicates event identities, holds while paused and clears stale envelopes on seek', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    engine.update(frame({ time: 0 }), CINEMA2_MAINFRAME_DEFAULT_PATTERN, true)
    const hit = engine.update(frame({ time: 0.02, delta: 0.02, event: { kind: 'kick', id: 'kick-1' } }), CINEMA2_MAINFRAME_DEFAULT_PATTERN, true)
    const duplicate = engine.update(frame({ time: 0.04, delta: 0.02, event: { kind: 'kick', id: 'kick-1' } }), CINEMA2_MAINFRAME_DEFAULT_PATTERN, true)
    const held = engine.update(frame({ time: 0.04, delta: 1, paused: true }), CINEMA2_MAINFRAME_DEFAULT_PATTERN, true)
    expect(hit.impulses.kick).toBeGreaterThan(0)
    expect(duplicate.impulses.kick).toBeLessThanOrEqual(1)
    expect(held).toBe(duplicate)
    const reset = engine.update(frame({ time: 8, discontinuity: true }), CINEMA2_MAINFRAME_DEFAULT_PATTERN, true)
    expect(reset.impulses.kick).toBe(0)
  })

  it('crosses published drop structure once and gives the logo-priority systems bounded lift', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    engine.update(frame({ time: 0 }), CINEMA2_MAINFRAME_DEFAULT_PATTERN, true)
    const impact = engine.update(frame({ time: 1, delta: 0.02, semanticMoments: [{ id: 'drop-1', timeSec: 0.5, type: 'drop' }] }), CINEMA2_MAINFRAME_DEFAULT_PATTERN, true)
    expect(impact.impulses.drop).toBe(1)
    expect(impact.systemGains[6]).toBeGreaterThan(impact.systemGains[1])
  })
})
