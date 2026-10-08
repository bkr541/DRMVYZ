import type { Cinema2AudioIntelligenceFrame, Cinema2AudioSignal } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2VisualDirectorFrame } from '../../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import { resolveCinema2MainframePlaybackState, resolveCinema2MainframeSourceIdentity, selectCinema2MainframeAudio } from './Cinema2MainframeAudioDelivery'
import { readCinema2MainframeContinuous, type Cinema2MainframeMusicalEvent } from './Cinema2MainframeMusicAdapter'
import {
  CINEMA2_MAINFRAME_IMPULSES,
  CINEMA2_MAINFRAME_IMPULSE_IDS,
  CINEMA2_MAINFRAME_ZERO_IMPULSES,
  CINEMA2_MAINFRAME_ZERO_SIGNALS,
  type Cinema2MainframeImpulseId,
  type Cinema2MainframeImpulses,
  type Cinema2MainframeSignals,
} from './Cinema2MainframeReactivity'

export const CINEMA2_MAINFRAME_PATTERN_IDS = Object.freeze([
  'outward-bus', 'inward-boot', 'bank-alternator', 'quadrant-relay', 'radar-sweep', 'system-surge',
] as const)
export type Cinema2MainframePatternId = typeof CINEMA2_MAINFRAME_PATTERN_IDS[number]
export const CINEMA2_MAINFRAME_DEFAULT_PATTERN: Cinema2MainframePatternId = 'outward-bus'
export const CINEMA2_MAINFRAME_FREE_RUN_BPM = 120

export interface Cinema2MainframeLightingFrame {
  readonly active: boolean
  readonly pattern: Cinema2MainframePatternId
  readonly beats: number
  readonly level: number
  readonly chaseFront: number
  readonly chaseWidth: number
  readonly chaseGain: number
  readonly chaseDirection: 1 | -1
  readonly flicker: number
  readonly bankWeights: readonly [number, number, number, number]
  readonly regionWeights: readonly [number, number, number, number, number, number, number, number]
  /** board, circuits, terminals, vias, radar, chip, logo outer, logo body, logo star. */
  readonly systemGains: readonly [number, number, number, number, number, number, number, number, number]
  readonly signals: Readonly<Cinema2MainframeSignals>
  readonly impulses: Cinema2MainframeImpulses
  /** Canonical choreography deliveries including upstream time, confidence and provenance. */
  readonly musicalEvents?: readonly Readonly<Cinema2MainframeMusicalEvent>[]
  /** Unmodified shared context, including confidence/evidence/section metadata. */
  readonly audioIntelligence?: Readonly<Cinema2AudioIntelligenceFrame> | null
  readonly visualDirector?: Readonly<Cinema2VisualDirectorFrame> | null
}

export interface Cinema2MainframePatternInput {
  readonly pattern: Cinema2MainframePatternId
  readonly beats: number
  readonly signals: Readonly<Cinema2MainframeSignals>
  readonly impulses: Cinema2MainframeImpulses
  readonly active?: boolean
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const fract = (value: number) => value - Math.floor(value)
const weights4 = (a = 0, b = 0, c = 0, d = 0) => Object.freeze([a, b, c, d] as const)
const weights8 = (...values: number[]) => Object.freeze(Array.from({ length: 8 }, (_, index) => clamp01(values[index] ?? 0)) as unknown as [number, number, number, number, number, number, number, number])

/** Pure deterministic choreography planner. No random or wall-clock state is read here. */
export function evaluateCinema2MainframePattern(input: Readonly<Cinema2MainframePatternInput>): Readonly<Cinema2MainframeLightingFrame> {
  const { signals: s, impulses: e } = input
  const beats = Number.isFinite(input.beats) ? Math.max(0, input.beats) : 0
  const active = input.active !== false
  const level = clamp01(0.23 * s.overall + 0.23 * s.bass + 0.18 * s.mid + 0.14 * s.high + 0.13 * s.flux + 0.09 * (s.significance ?? 0))
  const common = [
    0,
    0.05 + 0.2 * s.bass + 0.1 * s.high + 0.2 * e.beat + 0.38 * e.phrase,
    0.04 + 0.2 * s.bass + 0.68 * e.kick,
    0.03 + 0.25 * s.high + 0.55 * s.flux + 0.4 * e.transient,
    0.04 + 0.28 * s.mid + 0.62 * e.fourBeat + 0.3 * e.section + 0.12 * (s.variation ?? 0),
    0.04 + 0.25 * s.mid + 0.16 * s.high + 0.62 * e.phrase + 0.35 * e.section,
    0.05 + 0.25 * s.sub + 0.72 * e.snare,
    0.05 + 0.32 * s.vocal + 0.65 * e.eightBeat,
    0.04 + 0.34 * s.flux + 0.5 * e.downbeat,
  ]
  const dropLift = 0.72 * e.drop + 0.18 * (s.impact ?? 0)
  for (let index = 1; index < common.length; index += 1) common[index] = clamp01(common[index]! + dropLift * (index >= 6 ? 1 : 0.72))

  let chaseFront = fract(beats / 4) * 1.18
  let chaseWidth = 0.09
  let chaseGain = 0.68 + 0.35 * e.phrase + 0.2 * e.section
  let chaseDirection: 1 | -1 = 1
  let flicker = 0.08 * s.high + 0.2 * s.flux + 0.12 * e.transient + 0.08 * (s.momentum ?? 0)
  let bankWeights: readonly [number, number, number, number] = weights4()
  let regionWeights: readonly [number, number, number, number, number, number, number, number] = weights8()

  if (input.pattern === 'inward-boot') {
    chaseDirection = -1
    chaseFront = fract(beats / 4) * 1.18
    chaseGain = 0.75 + 0.3 * e.downbeat
    common[5] = clamp01(common[5]! + 0.22 * (1 - fract(beats / 4)))
    common[7] = clamp01(common[7]! + 0.45 * e.downbeat)
  } else if (input.pattern === 'bank-alternator') {
    const even = Math.floor(beats) % 2 === 0
    bankWeights = weights4(even ? 1 : 0.08, even ? 0.08 : 1, 0.28 + 0.5 * (1 - Math.abs(fract(beats) - 0.5) * 2), 0.2 + 0.75 * e.snare)
    chaseGain = 0.16
    chaseWidth = 0.13
    flicker += 0.15 * e.beat
  } else if (input.pattern === 'quadrant-relay') {
    const step = Math.floor(beats) % 4
    // Region encoding: bottom, left-branch, left-major, left-minor, right-branch, right-major, right-minor, top.
    const sequence = [2, 7, 5, 0]
    const next = sequence[(step + 1) % sequence.length]!
    const regions = Array(8).fill(0.05)
    regions[sequence[step]!] = 1
    regions[next] = 0.28
    regions[step < 2 ? 1 : 4] = 0.48
    regionWeights = weights8(...regions)
    chaseGain = 0.24 + 0.45 * e.downbeat
    chaseWidth = 0.16
  } else if (input.pattern === 'radar-sweep') {
    chaseFront = fract(beats / 4) * 1.12
    chaseWidth = 0.065
    chaseGain = 0.44 + 0.5 * e.fourBeat
    common[4] = clamp01(common[4]! + 0.42 + 0.35 * e.fourBeat)
    common[3] = clamp01(common[3]! + 0.18 * s.high)
    flicker += 0.2 * s.flux
  } else if (input.pattern === 'system-surge') {
    const charge = clamp01(Math.max(s.build, fract(beats / 8)))
    regionWeights = weights8(0.7 * charge, 0.08, 0.12, 0.08, 0.08, 0.12, 0.08, 0.7 * charge)
    chaseFront = charge * 1.08
    chaseWidth = 0.12
    chaseGain = 0.32 + 0.75 * e.drop
    for (let index = 1; index < common.length; index += 1) common[index] = clamp01(common[index]! + 0.22 * charge + 0.35 * e.downbeat)
  } else {
    // Outward Bus: logo ignition leads the route front and component systems resolve the phrase.
    common[8] = clamp01(common[8]! + 0.35 * (1 - Math.min(1, chaseFront * 2)))
    common[4] = clamp01(common[4]! + 0.3 * Math.max(0, chaseFront - 0.72))
    common[5] = clamp01(common[5]! + 0.3 * Math.max(0, chaseFront - 0.84))
  }

  return Object.freeze({
    active,
    pattern: input.pattern,
    beats,
    level,
    chaseFront,
    chaseWidth,
    chaseGain,
    chaseDirection,
    flicker: clamp01(flicker),
    bankWeights,
    regionWeights,
    systemGains: Object.freeze(common as [number, number, number, number, number, number, number, number, number]),
    signals: s,
    impulses: e,
  })
}

class ImpulseEnvelope {
  private value = 0
  private target = 0
  private lastId: string | null = null

  constructor(private readonly attackMs: number, private readonly releaseMs: number) {}

  update(deltaSec: number, event: Readonly<{ id: string; strength: number }> | null): number {
    if (event && event.id !== this.lastId) {
      this.lastId = event.id
      this.target = Math.max(this.target, clamp01(event.strength))
    }
    if (this.target > this.value) {
      this.value = Math.min(this.target, this.value + deltaSec / Math.max(0.001, this.attackMs / 1000))
      if (this.value >= this.target - 1e-6) this.target = 0
    } else {
      this.value = Math.max(0, this.value - deltaSec / Math.max(0.001, this.releaseMs / 1000))
    }
    return clamp01(this.value)
  }

  reset(): void { this.value = 0; this.target = 0; this.lastId = null }
}

export class Cinema2MainframeReactivityEngine {
  private readonly envelopes = Object.fromEntries(CINEMA2_MAINFRAME_IMPULSE_IDS.map(id => {
    const spec = CINEMA2_MAINFRAME_IMPULSES[id]
    return [id, new ImpulseEnvelope(spec.attackMs, spec.releaseMs)]
  })) as Record<Cinema2MainframeImpulseId, ImpulseEnvelope>
  private previousTimeSec: number | null = null
  private sourceIdentity: string | null = null
  private transportTrackId: string | null | undefined
  private contextGeneration: number | null = null
  private previousTimestampMs: number | null = null
  private lastFrame = evaluateCinema2MainframePattern({ pattern: CINEMA2_MAINFRAME_DEFAULT_PATTERN, beats: 0, signals: CINEMA2_MAINFRAME_ZERO_SIGNALS, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES, active: false })

  update(frame: Readonly<Cinema2ModuleFrameReadContext>, pattern: Cinema2MainframePatternId, bpmSync: boolean, patternStartBeat = 0, musicalEvents?: readonly Readonly<Cinema2MainframeMusicalEvent>[]): Readonly<Cinema2MainframeLightingFrame> {
    const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
    const playback = resolveCinema2MainframePlaybackState(frame, audio)
    const acceptedFrame = audio === frame.audio ? frame : { ...frame, audio }
    const timeSec = resolveCinema2MainframeTimeSec(acceptedFrame)
    // Pausing may disable analysis publication. Keep the held visual state unless
    // the actual transport identity changed while paused.
    const identity = playback === 'paused' && !audio && this.sourceIdentity != null
      && frame.transport?.trackId === this.transportTrackId
      ? this.sourceIdentity : resolveCinema2MainframeSourceIdentity(frame, audio)
    const reset = Boolean(audio?.discontinuity.occurred && audio.discontinuity.reason !== 'activation')
      || (this.previousTimeSec != null && timeSec < this.previousTimeSec - 1e-6)
      || (this.sourceIdentity != null && identity !== this.sourceIdentity)
      || (this.contextGeneration != null && frame.contextGeneration !== this.contextGeneration)
    if (reset) this.reset()

    if (playback === 'paused') {
      this.remember(frame, timeSec, identity)
      return this.lastFrame
    }
    if (playback !== 'playing') {
      this.reset() // Stopping must discard impulses even if the same track is loaded again.
      this.lastFrame = evaluateCinema2MainframePattern({ pattern, beats: 0, signals: CINEMA2_MAINFRAME_ZERO_SIGNALS, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES, active: false })
      this.remember(frame, timeSec, identity)
      return this.lastFrame
    }

    // The host can freeze visual delta while analysisActive is false even if audio and
    // transport are actually playing. Only Mainframe's real audio envelopes use this fallback.
    const timestampDelta = this.previousTimestampMs == null || !Number.isFinite(frame.timestampMs)
      ? 0 : (frame.timestampMs - this.previousTimestampMs) / 1000
    const transportDelta = this.previousTimeSec == null ? 0 : timeSec - this.previousTimeSec
    const deltaSec = Math.min(0.1, Math.max(0, frame.deltaTimeSec > 0 && Number.isFinite(frame.deltaTimeSec)
      ? frame.deltaTimeSec : timestampDelta > 0 ? timestampDelta : transportDelta))
    // Production supplies choreography-delivered events. Omitted events retain
    // the legacy isolated-engine test/host compatibility path only.
    const events = reset ? null : musicalEvents === undefined
      ? resolveEvents(audio, this.previousTimeSec, timeSec)
      : Object.fromEntries(musicalEvents.map(event => [event.kind, { id: event.id, strength: event.strength }])) as Record<Cinema2MainframeImpulseId, Readonly<{ id: string; strength: number }> | null>
    const impulseValues = {} as Record<Cinema2MainframeImpulseId, number>
    for (const id of CINEMA2_MAINFRAME_IMPULSE_IDS) impulseValues[id] = this.envelopes[id].update(deltaSec, events?.[id] ?? null)
    this.lastFrame = evaluateCinema2MainframePattern({
      pattern,
      beats: Math.max(0, resolveCinema2MainframeBeatClock(acceptedFrame, bpmSync) - Math.max(0, patternStartBeat)),
      signals: readCinema2MainframeContinuous(audio, audio ? frame.director : null),
      impulses: Object.freeze(impulseValues),
      active: true,
    })
    if (musicalEvents) this.lastFrame = Object.freeze({
      ...this.lastFrame,
      musicalEvents: Object.freeze([...musicalEvents]),
      audioIntelligence: audio,
      visualDirector: audio ? frame.director : null,
    })
    this.remember(frame, timeSec, identity)
    return this.lastFrame
  }

  reset(): void {
    for (const envelope of Object.values(this.envelopes)) envelope.reset()
    this.previousTimeSec = null
    this.previousTimestampMs = null
    this.sourceIdentity = null
    this.transportTrackId = undefined
    this.contextGeneration = null
    this.lastFrame = evaluateCinema2MainframePattern({ pattern: CINEMA2_MAINFRAME_DEFAULT_PATTERN, beats: 0, signals: CINEMA2_MAINFRAME_ZERO_SIGNALS, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES, active: false })
  }

  private remember(frame: Readonly<Cinema2ModuleFrameReadContext>, timeSec: number, identity: string): void {
    this.previousTimeSec = timeSec
    this.previousTimestampMs = Number.isFinite(frame.timestampMs) ? frame.timestampMs : null
    this.sourceIdentity = identity
    this.transportTrackId = frame.transport?.trackId
    this.contextGeneration = frame.contextGeneration
  }
}

export function resolveCinema2MainframeBeatClock(frame: Readonly<Cinema2ModuleFrameReadContext>, bpmSync: boolean): number {
  if (bpmSync) {
    const rhythm = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)?.rhythm
    const phase = finiteSignalNumber(rhythm?.beatPhase)
    if (phase != null) {
      const fraction = Math.min(0.999, phase)
      const bar = finiteSignalNumber(rhythm?.barIndex)
      const beatInBar = finiteSignalNumber(rhythm?.beatInBar)
      if (bar != null && beatInBar != null) return Math.max(0, Math.floor(bar) * 4 + Math.floor(beatInBar) + fraction)
      const beat = finiteSignalNumber(rhythm?.beatIndex)
      if (beat != null) return Math.max(0, Math.floor(beat) + fraction)
    }
  }
  return Math.max(0, resolveCinema2MainframeTimeSec(frame) * CINEMA2_MAINFRAME_FREE_RUN_BPM / 60)
}

function resolveEvents(audio: Readonly<Cinema2AudioIntelligenceFrame> | null, previousTimeSec: number | null, timeSec: number): Record<Cinema2MainframeImpulseId, Readonly<{ id: string; strength: number }> | null> {
  const rhythm = audio?.rhythm
  const event = (value: Readonly<{ id: string; strength: number }> | null | undefined) => value ? { id: value.id, strength: value.strength } : null
  const phrase = crossed(audio?.structure.analyzedPhrases.available ? audio.structure.analyzedPhrases.value ?? [] : [], previousTimeSec, timeSec)
  const drop = crossed((audio?.structure.semanticMoments.available ? audio.structure.semanticMoments.value ?? [] : []).filter(item => item.type === 'drop' || item.type === 'drop_impact'), previousTimeSec, timeSec)
  return {
    kick: event(rhythm?.kick),
    snare: event(rhythm?.snare),
    beat: event(rhythm?.beat),
    downbeat: event(rhythm?.downbeat),
    transient: event(rhythm?.transient),
    section: null,
    fourBeat: event(rhythm?.fixedClocks?.[4]?.boundary),
    eightBeat: event(rhythm?.fixedClocks?.[8]?.boundary),
    phrase: phrase ? { id: phrase, strength: 1 } : event(rhythm?.fixedClocks?.[16]?.boundary),
    drop: drop ? { id: drop, strength: 1 } : null,
  }
}

function crossed(items: readonly Readonly<{ id: string; timeSec: number }>[], previousTimeSec: number | null, currentTimeSec: number): string | null {
  if (previousTimeSec == null || currentTimeSec <= previousTimeSec) return null
  let latest: Readonly<{ id: string; timeSec: number }> | null = null
  for (const item of items) if (Number.isFinite(item.timeSec) && item.timeSec > previousTimeSec && item.timeSec <= currentTimeSec + 1e-6 && (!latest || item.timeSec > latest.timeSec)) latest = item
  return latest?.id ?? null
}

function finiteSignalNumber(signal: Readonly<Cinema2AudioSignal<number>> | undefined): number | null {
  return signal?.available && typeof signal.value === 'number' && Number.isFinite(signal.value) ? signal.value : null
}

export function resolveCinema2MainframeTimeSec(frame: Readonly<Cinema2ModuleFrameReadContext>): number {
  const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
  const audioTime = audio?.upstream.timeSec
  const transportTime = frame.transport?.timeSec
  // A missing/zero upstream timestamp must not pin a moving real transport at zero.
  if (typeof audioTime === 'number' && Number.isFinite(audioTime) && audioTime >= 0
    && (audioTime > 0 || !Number.isFinite(transportTime) || transportTime === 0)
    && (!Number.isFinite(transportTime) || Math.abs(audioTime - transportTime!) <= 0.75)) return audioTime
  if (typeof transportTime === 'number' && Number.isFinite(transportTime)) return Math.max(0, transportTime)
  return typeof audioTime === 'number' && Number.isFinite(audioTime) ? Math.max(0, audioTime)
    : Number.isFinite(frame.elapsedTimeSec) ? Math.max(0, frame.elapsedTimeSec) : 0
}
