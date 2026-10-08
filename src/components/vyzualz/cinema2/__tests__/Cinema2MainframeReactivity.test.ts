import { describe, expect, it } from 'vitest'
import { selectCinema2MainframeAudio } from '../modules/mainframe/Cinema2MainframeAudioDelivery'
import {
  Cinema2MainframeDropCoordinator,
  readCinema2MainframeContinuous,
  resolveCinema2MainframeEventVisualStrength,
  type Cinema2MainframeMusicalEvent,
} from '../modules/mainframe/Cinema2MainframeMusicAdapter'
import { resolveCinema2MainframeComponentLighting } from '../modules/mainframe/Cinema2MainframeHardwareLighting'
import { resolveCinema2MainframeTriggerEventIdentity } from '../modules/mainframe/Cinema2MainframePatternController'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  CINEMA2_MAINFRAME_DEFAULT_PATTERN,
  CINEMA2_MAINFRAME_PATTERN_IDS,
  Cinema2MainframeBeatClockResolver,
  Cinema2MainframeReactivityEngine,
  evaluateCinema2MainframePattern,
  resolveCinema2MainframeBeatClock,
  resolveCinema2MainframeTimeSec,
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
    expect(CINEMA2_MAINFRAME_IMPULSES.kick).toMatchObject({ attackMs: 12, holdMs: 24, releaseMs: 145, targets: ['circuits', 'terminals'] })
    expect(CINEMA2_MAINFRAME_IMPULSES.drop).toMatchObject({ attackMs: 9, holdMs: 140, releaseMs: 1050 })
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

  it('powers circuits from real music, accents distinct hits and stays quiet without audio energy', () => {
    const quiet = evaluateCinema2MainframePattern({
      pattern: 'outward-bus', beats: 1.5,
      signals: CINEMA2_MAINFRAME_ZERO_SIGNALS, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES,
    })
    expect(quiet).toMatchObject({ circuitEnergy: 0, circuitAccent: 0, circuitPulse: 0 })
    const signals = { ...CINEMA2_MAINFRAME_ZERO_SIGNALS, bass: 0.7, sub: 0.55, overall: 0.5 }
    const powered = evaluateCinema2MainframePattern({
      pattern: 'outward-bus', beats: 1.5, signals, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES,
    })
    expect(powered.circuitEnergy).toBeGreaterThan(0.4)
    expect(powered.circuitPulse).toBeGreaterThan(0)
    for (const kind of ['kick', 'snare', 'beat', 'downbeat', 'phrase', 'drop'] as const) {
      const hit = evaluateCinema2MainframePattern({
        pattern: 'outward-bus', beats: 1.5, signals,
        impulses: { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, [kind]: 1 },
      })
      expect(hit.circuitAccent, `${kind} accent`).toBeGreaterThan(powered.circuitAccent)
      expect(hit.circuitPulse, `${kind} pulse`).toBeGreaterThan(powered.circuitPulse)
    }
    for (const pattern of CINEMA2_MAINFRAME_PATTERN_IDS) {
      const value = evaluateCinema2MainframePattern({
        pattern, beats: 1.5, signals,
        impulses: { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, drop: 1 },
      })
      expect(value.circuitPulse).toBeGreaterThan(powered.circuitPulse)
      expect(value.pattern).toBe(pattern)
      expect(value.chaseWidth).toBeGreaterThan(0)
    }
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


describe('P0-02 Mainframe audio delivery and transport transitions', () => {
  const altered = (base: Readonly<Cinema2ModuleFrameReadContext>, changes: {
    transport?: Partial<NonNullable<Cinema2ModuleFrameReadContext['transport']>>
    audio?: Cinema2ModuleFrameReadContext['audio']
    timestampMs?: number
    deltaTimeSec?: number
    contextGeneration?: number
  }): Readonly<Cinema2ModuleFrameReadContext> => ({
    ...base,
    ...(changes.transport ? { transport: { ...base.transport!, ...changes.transport } } : {}),
    ...('audio' in changes ? { audio: changes.audio ?? null } : {}),
    ...('timestampMs' in changes ? { timestampMs: changes.timestampMs! } : {}),
    ...('deltaTimeSec' in changes ? { deltaTimeSec: changes.deltaTimeSec! } : {}),
    ...('contextGeneration' in changes ? { contextGeneration: changes.contextGeneration! } : {}),
  })

  it('accepts real bands/events when source-present, analysis-active and animation-active hints are false', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    const transport = { sourcePresent: false, analysisActive: false, animationActive: false, playing: true }
    const first = altered(frame({ time: 1 }), { transport, deltaTimeSec: 0 })
    const second = altered(frame({ time: 1.02, event: { kind: 'kick', id: 'actual-kick' } }), { transport, deltaTimeSec: 0 })
    expect(engine.update(first, 'outward-bus', true).active).toBe(true)
    const hit = engine.update(second, 'outward-bus', true)
    expect(hit.signals).toMatchObject({ sub: 0.4, bass: 0.6, mid: 0.5, high: 0.45, flux: 0.4, vocal: 0.45, build: 0.35 })
    expect(hit.impulses.kick).toBeGreaterThan(0)
    expect(resolveCinema2MainframeTriggerEventIdentity(second, 'kick', 1)).toBe('actual-kick')
    const louder = altered(frame({ time: 1.04 }), {
      transport, deltaTimeSec: 0,
      audio: { ...frame({ time: 1.04 }).audio!, bands: { ...frame({ time: 1.04 }).audio!.bands, bass: available(0.95) } },
    })
    expect(engine.update(louder, 'outward-bus', true).signals.bass).toBe(0.95)
  })

  it('rejects truly missing/reset analysis without inventing beats or lighting', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    const playing = altered(frame({ time: 1 }), { audio: null })
    expect(engine.update(playing, 'radar-sweep', true)).toMatchObject({ active: false, level: 0, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES })
    expect(resolveCinema2MainframeTriggerEventIdentity(playing, 'beat', 0)).toBeNull()
    const resetFrame = altered(frame({ time: 2, event: { kind: 'beat', id: 'reset-beat' } }), {
      audio: { ...frame({ time: 2 }).audio!, upstream: { ...frame({ time: 2 }).audio!.upstream, publicationKind: 'reset' } },
    })
    expect(selectCinema2MainframeAudio(resetFrame.audio, 'track')).toBeNull()
    expect(engine.update(resetFrame, 'radar-sweep', true).active).toBe(false)
    const unavailable = altered(frame({ time: 3 }), {
      audio: { ...frame({ time: 3 }).audio!, bands: {} as never, features: {} as never, rhythm: {} as never, structure: {} as never },
    })
    expect(engine.update(unavailable, 'radar-sweep', true).active).toBe(false)
    const truncated = altered(frame({ time: 3.1 }), { audio: { ...frame({ time: 3.1 }).audio!, rhythm: {} as never } })
    expect(engine.update(truncated, 'radar-sweep', true).active).toBe(false)
  })

  it('holds during pause, responds to newly published music after resume, and clears on stop', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    engine.update(frame({ time: 1 }), 'outward-bus', true)
    const hit = engine.update(frame({ time: 1.02, event: { kind: 'kick', id: 'kick-a' } }), 'outward-bus', true)
    const pause = altered(frame({ time: 1.02 }), { transport: { playing: false, paused: true, animationActive: false } })
    expect(engine.update(pause, 'outward-bus', true)).toBe(hit)
    expect(engine.update(pause, 'outward-bus', true)).toBe(hit)
    const resumed = engine.update(frame({ time: 1.04, event: { kind: 'snare', id: 'snare-b' } }), 'outward-bus', true)
    expect(resumed.active).toBe(true)
    expect(resumed.impulses.snare).toBeGreaterThan(0)
    const stopped = engine.update(altered(frame({ time: 1.05 }), {
      transport: { sourcePresent: false, playing: false, paused: false, analysisActive: false, animationActive: false, trackId: null }, audio: null,
    }), 'outward-bus', true)
    expect(stopped).toMatchObject({ active: false, level: 0, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES })
    const reloaded = engine.update(frame({ time: 0.1, event: { kind: 'kick', id: 'kick-a' } }), 'outward-bus', true)
    expect(reloaded.impulses.kick).toBe(0) // no event from the first restored frame
    expect(engine.update(frame({ time: 0.12, event: { kind: 'kick', id: 'kick-new' } }), 'outward-bus', true).impulses.kick).toBeGreaterThan(0)
  })

  it('does not reuse a previous track/source hit while the new analysis is pending, including when paused', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    engine.update(frame({ time: 2 }), 'outward-bus', true)
    const hit = engine.update(frame({ time: 2.02, event: { kind: 'kick', id: 'old' } }), 'outward-bus', true)
    expect(hit.impulses.kick).toBeGreaterThan(0)
    const stale = altered(frame({ time: 0.2, event: { kind: 'kick', id: 'old' } }), {
      transport: { trackId: 'new-track' },
    })
    expect(selectCinema2MainframeAudio(stale.audio, 'new-track')).toBeNull()
    expect(engine.update(stale, 'outward-bus', true).active).toBe(false)
    expect(engine.update(altered(stale, { transport: { trackId: 'new-track', playing: false, paused: true } }), 'outward-bus', true).active).toBe(false)
    const fresh = altered(frame({ time: 0.3, event: { kind: 'kick', id: 'old' } }), {
      transport: { trackId: 'new-track' },
      audio: { ...frame({ time: 0.3, event: { kind: 'kick', id: 'old' } }).audio!, upstream: { ...frame({ time: 0.3 }).audio!.upstream, trackId: 'new-track', sourceId: 'new-source' } },
    })
    expect(engine.update(fresh, 'outward-bus', true).impulses.kick).toBe(0)
    const followup = altered(fresh, {
      audio: { ...fresh.audio!, rhythm: { ...fresh.audio!.rhythm, kick: { ...fresh.audio!.rhythm.kick!, id: 'genuine-new-kick' } } },
    })
    expect(engine.update(followup, 'outward-bus', true).impulses.kick).toBeGreaterThan(0)
  })

  it('handles seeking and missing upstream timestamps without replaying a historical drop', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    engine.update(frame({ time: 1 }), 'outward-bus', true)
    const moment = [{ id: 'drop', timeSec: 1.1, type: 'drop' as const }]
    expect(engine.update(frame({ time: 1.2, semanticMoments: moment }), 'outward-bus', true).impulses.drop).toBe(1)
    const seek = frame({ time: 12, discontinuity: true, semanticMoments: moment, event: { kind: 'beat', id: 'stale-beat' } })
    expect(engine.update(seek, 'outward-bus', true).impulses).toEqual(CINEMA2_MAINFRAME_ZERO_IMPULSES)
    const missingTimestamp = altered(frame({ time: 13 }), {
      audio: { ...frame({ time: 13 }).audio!, upstream: { ...frame({ time: 13 }).audio!.upstream, timeSec: 0 } },
    })
    expect(resolveCinema2MainframeTimeSec(missingTimestamp)).toBe(13)
    expect(engine.update(missingTimestamp, 'outward-bus', false).active).toBe(true)
  })

  it('keeps the last lit frame if analysis publication disappears only while paused', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    engine.update(frame({ time: 4 }), 'outward-bus', true)
    const lit = engine.update(frame({ time: 4.02, event: { kind: 'beat', id: 'pause-beat' } }), 'outward-bus', true)
    const pausedWithoutAnalysis = altered(frame({ time: 4.02 }), {
      audio: null, transport: { paused: true, playing: false, analysisActive: false, animationActive: false },
    })
    expect(engine.update(pausedWithoutAnalysis, 'outward-bus', true)).toBe(lit)
    expect(engine.update(frame({ time: 4.04 }), 'outward-bus', true).active).toBe(true)
  })

  it('resets even if a new upstream source reuses the same track ID and event ID', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    engine.update(frame({ time: 5 }), 'outward-bus', true)
    expect(engine.update(frame({ time: 5.02, event: { kind: 'beat', id: 'beat-reused' } }), 'outward-bus', true).impulses.beat).toBeGreaterThan(0)
    const switched = frame({ time: 0.2, event: { kind: 'beat', id: 'beat-reused' } })
    const changedSource = altered(switched, {
      audio: { ...switched.audio!, upstream: { ...switched.audio!.upstream, sourceId: 'rekordbox-usb' } },
    })
    expect(engine.update(changedSource, 'outward-bus', true).impulses.beat).toBe(0)
    const next = altered(frame({ time: 0.22, event: { kind: 'beat', id: 'fresh-beat' } }), {
      audio: { ...frame({ time: 0.22, event: { kind: 'beat', id: 'fresh-beat' } }).audio!, upstream: { ...frame({ time: 0.22 }).audio!.upstream, sourceId: 'rekordbox-usb' } },
    })
    expect(engine.update(next, 'outward-bus', true).impulses.beat).toBeGreaterThan(0)
  })
})


describe('P0-07 Mainframe overall energy reactivity', () => {
  const withEnergy = (time: number, energy: number, trackEnergy = 0.9): Readonly<Cinema2ModuleFrameReadContext> => {
    const base = frame({ time, delta: 0.02 })
    return {
      ...base,
      audio: {
        ...base.audio!,
        // Isolate overallEnergy: component-specific channels remain unchanged.
        bands: Object.fromEntries(Object.keys(base.audio!.bands).map(band => [band, available(0)])) as never,
        features: {
          ...base.audio!.features, overallEnergy: available(energy), trackEnergy: available(trackEnergy),
          spectralFlux: available(0), transientEnergy: available(0),
        },
      },
    }
  }

  it('prefers the live shared energy over the broader offline track energy, including silence', () => {
    const silent = withEnergy(0, 0, 1)
    const loud = withEnergy(0, 1, 1)
    const fromSilence = readCinema2MainframeContinuous(silent.audio, null)
    const fromLoud = readCinema2MainframeContinuous(loud.audio, null)
    expect(fromSilence.overall).toBe(0)
    expect(fromLoud.overall).toBe(1)
    const quietLighting = evaluateCinema2MainframePattern({ pattern: 'outward-bus', beats: 3, signals: fromSilence, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES })
    const loudLighting = evaluateCinema2MainframePattern({ pattern: 'outward-bus', beats: 3, signals: fromLoud, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES })
    expect(loudLighting.level - quietLighting.level).toBeGreaterThan(0.4)
    // The global bus does not replace the individual authored component events.
    expect(loudLighting.systemGains).toEqual(quietLighting.systemGains)
    expect(loudLighting.impulses).toEqual(quietLighting.impulses)
  })

  it('attacks quickly, releases gradually, holds on pause and resets on stop or seek', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    const quiet = engine.update(withEnergy(0, 0.04), 'outward-bus', true)
    const firstAttack = engine.update(withEnergy(0.02, 0.95), 'outward-bus', true)
    expect(firstAttack.level).toBeGreaterThan(quiet.level)
    expect(firstAttack.level).toBeLessThan(0.45 * 0.95)
    let sustained = firstAttack
    for (let i = 2; i <= 22; i++) sustained = engine.update(withEnergy(i * 0.02, 0.95), 'outward-bus', true)
    expect(sustained.level).toBeGreaterThan(firstAttack.level)
    expect(sustained.level).toBeLessThanOrEqual(1)

    const firstRelease = engine.update(withEnergy(0.46, 0.04), 'outward-bus', true)
    expect(firstRelease.level).toBeLessThan(sustained.level)
    expect(firstRelease.level).toBeGreaterThan(quiet.level)
    const paused = withEnergy(0.46, 0.04)
    const held = engine.update({ ...paused, transport: { ...paused.transport!, playing: false, paused: true } }, 'outward-bus', true)
    expect(held).toBe(firstRelease)
    const stopped = withEnergy(0.5, 0.04)
    expect(engine.update({ ...stopped, audio: null, transport: { ...stopped.transport!, playing: false, paused: false, sourcePresent: false } }, 'outward-bus', true).level).toBe(0)
    expect(engine.update(withEnergy(0.02, 0.04), 'outward-bus', true).level).toBeCloseTo(quiet.level)
    expect(engine.update({ ...withEnergy(12, 0.95), audio: {
      ...withEnergy(12, 0.95).audio!,
      discontinuity: { occurred: true, id: 'seek', reason: 'seek', generation: 2 },
    } }, 'outward-bus', true).level).toBeCloseTo(0.45 * 0.95)
  })

  it('keeps a major drop above sustained loudness in its independent component and circuit channels', () => {
    const signals = readCinema2MainframeContinuous(withEnergy(2, 0.95).audio, null)
    const withoutDrop = evaluateCinema2MainframePattern({ pattern: 'system-surge', beats: 8, signals, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES })
    const withDrop = evaluateCinema2MainframePattern({ pattern: 'system-surge', beats: 8, signals, impulses: { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, drop: 1 } })
    expect(withDrop.level).toBe(withoutDrop.level)
    expect(withDrop.circuitPulse).toBeGreaterThan(withoutDrop.circuitPulse)
    expect(withDrop.systemGains[6]).toBeGreaterThan(withoutDrop.systemGains[6])
    expect(withDrop.systemGains[8]).toBeGreaterThan(withoutDrop.systemGains[8])
  })
})

describe('P1 Mainframe musical intelligence and component choreography', () => {
  const musicalEvent = (
    kind: Cinema2MainframeMusicalEvent['kind'],
    id: string,
    timeSec: number,
    strength = 1,
    confidence: number | null = 0.95,
  ): Cinema2MainframeMusicalEvent => ({
    kind, id, timeSec, strength,
    visualStrength: resolveCinema2MainframeEventVisualStrength(kind, strength, confidence, 'shared-test'),
    confidence, source: 'shared-test', upstreamIdentity: id,
    trackId: 'track', sourceId: 'test', analysisRevision: null, timelineRevision: null,
  })

  it('keeps buildup occurrence, confidence, progress and intensity separate', () => {
    const base = frame({ time: 4 })
    const buildFrame = {
      ...base,
      audio: {
        ...base.audio!,
        features: { ...base.audio!.features, buildProgress: available(0.12), overallEnergy: available(0.7), tension: available(0.82) },
        structure: {
          ...base.audio!.structure,
          buildConfidence: available(0.98),
          section: {
            available: true, confidence: 0.94, source: 'test', provenance: null,
            value: { id: 'build-a', label: 'Build', type: 'build', startSec: 0, endSec: 16, progress: 0.12, intensity: 0.82, confidence: 0.94, source: 'test', authority: 'analysis', dropConfidence: 0.2 },
          },
        },
      },
    } as unknown as Cinema2ModuleFrameReadContext
    const early = readCinema2MainframeContinuous(buildFrame.audio, null)
    expect(early).toMatchObject({ section: 'buildup', buildProgress: 0.12, buildConfidence: 0.98, build: 0.12 })
    expect(early.buildIntensity).toBeGreaterThan(0.8)
    const earlyLighting = evaluateCinema2MainframePattern({ pattern: 'system-surge', beats: 8, signals: early, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES })
    const lateSignals = { ...early, buildProgress: 0.9, build: 0.9, sectionProgress: 0.9 }
    const lateLighting = evaluateCinema2MainframePattern({ pattern: 'system-surge', beats: 8, signals: lateSignals, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES })
    expect(earlyLighting.buildCharge).toBeLessThan(0.2)
    expect(lateLighting.buildCharge).toBeGreaterThan(0.7)
    expect(lateLighting.chaseFront).toBeGreaterThan(earlyLighting.chaseFront)
    const falseBuild = evaluateCinema2MainframePattern({
      pattern: 'system-surge', beats: 15.9,
      signals: { ...CINEMA2_MAINFRAME_ZERO_SIGNALS, buildProgress: 0, buildConfidence: 1, buildIntensity: 1, build: 0 },
      impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES,
    })
    expect(falseBuild.buildCharge).toBe(0)
    expect(falseBuild.chaseFront).toBe(0)
  })

  it('gives verse, buildup, breakdown and drop distinct pattern-complementary behavior', () => {
    const base = { ...CINEMA2_MAINFRAME_ZERO_SIGNALS, overall: 0.65, bass: 0.62, mid: 0.5, high: 0.4, sectionConfidence: 0.95 }
    const render = (section: 'verse' | 'buildup' | 'breakdown' | 'drop') => evaluateCinema2MainframePattern({
      pattern: 'quadrant-relay', beats: 6.25,
      signals: { ...base, section, sectionProgress: 0.65, phraseProgress: 0.4, buildProgress: section === 'buildup' ? 0.65 : 0, buildConfidence: 0.95, buildIntensity: 0.8, build: section === 'buildup' ? 0.65 : 0 },
      impulses: section === 'drop' ? { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, drop: 0.9 } : CINEMA2_MAINFRAME_ZERO_IMPULSES,
    })
    const verse = render('verse'), buildup = render('buildup'), breakdown = render('breakdown'), drop = render('drop')
    expect([verse.sectionMode, buildup.sectionMode, breakdown.sectionMode, drop.sectionMode]).toEqual([1, 2, 3, 4])
    expect(breakdown.circuitEnergy).toBeLessThan(verse.circuitEnergy)
    expect(buildup.buildCharge).toBeGreaterThan(0.5)
    expect(drop.circuitAccent).toBeGreaterThan(buildup.circuitAccent)
    expect([verse, buildup, breakdown, drop].every(value => value.pattern === 'quadrant-relay')).toBe(true)
  })

  it('maps kick, snare, transient and downbeat to distinguishable hardware families', () => {
    const render = (kind: keyof typeof CINEMA2_MAINFRAME_ZERO_IMPULSES) => resolveCinema2MainframeComponentLighting(
      evaluateCinema2MainframePattern({
        pattern: 'outward-bus', beats: 2,
        signals: CINEMA2_MAINFRAME_ZERO_SIGNALS,
        impulses: { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, [kind]: 1 },
      }),
    )
    const kick = render('kick'), snare = render('snare'), transient = render('transient'), downbeat = render('downbeat')
    expect(kick.terminals).toBeGreaterThan(kick.indicators)
    expect(snare.chipPins).toBeGreaterThan(snare.terminals)
    expect(snare.logoDetails).toBeGreaterThan(0.5)
    expect(transient.indicators).toBeGreaterThan(transient.radarRings)
    expect(downbeat.radarNodes).toBeGreaterThan(0.4)
    expect(new Set([kick.terminals, snare.terminals, transient.terminals, downbeat.terminals]).size).toBeGreaterThan(2)
  })

  it('runs four bounded timestamp-synchronized route pulses and preserves them across section changes', () => {
    const engine = new Cinema2MainframeReactivityEngine()
    engine.update(frame({ time: 1 }), 'outward-bus', true, 0, [])
    const events = [
      musicalEvent('downbeat', 'down-1', 1.02),
      musicalEvent('kick', 'kick-1', 1.02),
      musicalEvent('snare', 'snare-1', 1.02),
      musicalEvent('transient', 'transient-1', 1.02),
    ]
    const impact = engine.update(frame({ time: 1.04, delta: 0.02 }), 'outward-bus', true, 0, events)
    expect(impact.routePulses.filter(pulse => pulse.gain > 0)).toHaveLength(4)
    expect(impact.routePulses.reduce((sum, pulse) => sum + pulse.gain, 0)).toBeLessThanOrEqual(1.800001)
    expect(new Set(impact.routePulses.map(pulse => pulse.routeGroup)).size).toBeGreaterThan(1)
    const laterBase = frame({ time: 1.12, delta: 0.08 })
    const later = engine.update({
      ...laterBase,
      audio: { ...laterBase.audio!, structure: { ...laterBase.audio!.structure, section: {
        available: true, confidence: 0.9, source: 'test', provenance: null,
        value: { id: 'verse-b', label: 'Verse', type: 'verse', startSec: 1.1, endSec: 20, progress: 0.01, intensity: 0.5, source: 'test', authority: 'analysis', dropConfidence: 0 },
      } } },
    } as never, 'outward-bus', true, 0, [])
    expect(later.routePulses[1].front).toBeGreaterThan(impact.routePulses[1].front)
    expect(later.routePulses.some(pulse => pulse.gain > 0)).toBe(true)
  })

  it('suppresses uncertain structural impacts while retaining scaled authoritative rhythm hits', () => {
    expect(resolveCinema2MainframeEventVisualStrength('drop', 1, 0.2, 'analysis')).toBe(0)
    expect(resolveCinema2MainframeEventVisualStrength('section', 1, 0.4, 'analysis')).toBe(0)
    expect(resolveCinema2MainframeEventVisualStrength('phrase', 1, 0.2, 'analysis')).toBe(0)
    expect(resolveCinema2MainframeEventVisualStrength('drop', 1, 0.96, 'analysis')).toBeGreaterThan(0.9)
    expect(resolveCinema2MainframeEventVisualStrength('kick', 1, 0.25, 'live')).toBeGreaterThan(0.5)
    const coordinator = new Cinema2MainframeDropCoordinator()
    expect(coordinator.update({ audio: null } as Cinema2ModuleFrameReadContext, [musicalEvent('drop', 'uncertain', 2, 1, 0.2)]).dropEventId).toBeNull()
  })

  it('uses grid, analyzed BPM, transport BPM and explicit fallback without phase jumps', () => {
    const resolver = new Cinema2MainframeBeatClockResolver()
    const withoutGrid = (time: number, bpm: number | null, transportBpm: number | null, paused = false, discontinuity = false) => {
      const base = frame({ time, paused, discontinuity })
      return {
        ...base,
        transport: { ...base.transport!, bpm: transportBpm },
        audio: { ...base.audio!, rhythm: {
          ...base.audio!.rhythm,
          bpm: bpm == null ? unavailable() : available(bpm),
          beatPhase: unavailable(), beatIndex: unavailable(), beatInBar: unavailable(), barIndex: unavailable(),
        } },
      } as unknown as Cinema2ModuleFrameReadContext
    }
    const analyzed = resolver.resolve(withoutGrid(2, 150, 90), true)
    expect(analyzed).toMatchObject({ source: 'analyzed-bpm', bpm: 150, confirmedGrid: false, beats: 5 })
    expect(resolver.resolve(withoutGrid(2.2, 150, 90), true).beats).toBeCloseTo(5.5)
    const tempoChange = resolver.resolve(withoutGrid(2.4, 180, 90), true)
    expect(tempoChange.beats).toBeCloseTo(6.1)
    const held = resolver.resolve(withoutGrid(3, 180, 90, true), true)
    expect(held.beats).toBeCloseTo(tempoChange.beats)
    resolver.reset()
    expect(resolver.resolve(withoutGrid(2, null, 90), true)).toMatchObject({ source: 'transport-bpm', bpm: 90, beats: 3 })
    resolver.reset()
    expect(resolver.resolve(withoutGrid(2, null, null), true)).toMatchObject({ source: 'visual-fallback-120', bpm: 120, beats: 4, confirmedGrid: false })
    expect(resolveCinema2MainframeTriggerEventIdentity(withoutGrid(2.1, null, 120), 'bar', 2, null, {
      previousBeat: 3.9,
      current: { beats: 4.2, bpm: 120, source: 'transport-bpm', confirmedGrid: false },
    })).toBe('mainframe-timing:transport-bpm:4:1')
    expect(resolveCinema2MainframeTriggerEventIdentity(withoutGrid(2.1, null, 120), 'kick', 2, null, {
      previousBeat: 3.9,
      current: { beats: 4.2, bpm: 120, source: 'transport-bpm', confirmedGrid: false },
    })).toBeNull()
    resolver.reset()
    expect(resolver.resolve(frame({ time: 10, beatIndex: 9, beatPhase: 0.5 }), true)).toMatchObject({ source: 'analyzed-beat-grid', beats: 9.5, confirmedGrid: true })
  })
})
