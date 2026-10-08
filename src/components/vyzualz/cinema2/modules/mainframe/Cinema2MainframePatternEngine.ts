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
export const CINEMA2_MAINFRAME_ROUTE_PULSE_COUNT = 4 as const

export type Cinema2MainframeBeatClockSource = 'analyzed-beat-grid' | 'analyzed-bpm' | 'transport-bpm' | 'visual-fallback-120'
export interface Cinema2MainframeBeatClockFrame {
  readonly beats: number
  readonly bpm: number
  readonly source: Cinema2MainframeBeatClockSource
  /** True only for an explicit shared beat position, never for a tempo-derived estimate. */
  readonly confirmedGrid: boolean
}

export interface Cinema2MainframeRoutePulse {
  readonly front: number
  readonly width: number
  readonly gain: number
  readonly direction: 1 | -1
  /** Stable modulo-eight route group; -1 means the structured major-impact group. */
  readonly routeGroup: number
}

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
  /** Circuit-only continuous energy, musical accents and traveling-pulse excitation (0..1). */
  readonly circuitEnergy: number
  readonly circuitAccent: number
  readonly circuitPulse: number
  readonly bankWeights: readonly [number, number, number, number]
  readonly regionWeights: readonly [number, number, number, number, number, number, number, number]
  /** Four persistent, event-timestamped GPU route pulses. */
  readonly routePulses: readonly [Cinema2MainframeRoutePulse, Cinema2MainframeRoutePulse, Cinema2MainframeRoutePulse, Cinema2MainframeRoutePulse]
  readonly sectionMode: 0 | 1 | 2 | 3 | 4
  readonly sectionProgress: number
  readonly sectionConfidence: number
  readonly phraseProgress: number
  readonly buildCharge: number
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
  readonly routePulses?: Cinema2MainframeLightingFrame['routePulses']
  readonly active?: boolean
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const fract = (value: number) => value - Math.floor(value)
const weights4 = (a = 0, b = 0, c = 0, d = 0) => Object.freeze([a, b, c, d] as const)
const weights8 = (...values: number[]) => Object.freeze(Array.from({ length: 8 }, (_, index) => clamp01(values[index] ?? 0)) as unknown as [number, number, number, number, number, number, number, number])
const EMPTY_ROUTE_PULSE: Readonly<Cinema2MainframeRoutePulse> = Object.freeze({ front: -10, width: 0.08, gain: 0, direction: 1, routeGroup: 0 })
export const CINEMA2_MAINFRAME_EMPTY_ROUTE_PULSES = Object.freeze([
  EMPTY_ROUTE_PULSE, EMPTY_ROUTE_PULSE, EMPTY_ROUTE_PULSE, EMPTY_ROUTE_PULSE,
] as const)

function combineImpulses(...values: readonly number[]): number {
  const sorted = values.map(clamp01).sort((a, b) => b - a)
  return clamp01((sorted[0] ?? 0) + 0.38 * (sorted[1] ?? 0) + 0.16 * (sorted[2] ?? 0))
}

/** Pure deterministic choreography planner. No random or wall-clock state is read here. */
export function evaluateCinema2MainframePattern(input: Readonly<Cinema2MainframePatternInput>): Readonly<Cinema2MainframeLightingFrame> {
  const { signals: s, impulses: e } = input
  const beats = Number.isFinite(input.beats) ? Math.max(0, input.beats) : 0
  const active = input.active !== false
  const sectionMode: Cinema2MainframeLightingFrame['sectionMode'] = s.section === 'verse' ? 1
    : s.section === 'buildup' ? 2 : s.section === 'breakdown' ? 3 : s.section === 'drop' ? 4 : 0
  const sectionConfidence = clamp01(s.sectionConfidence ?? 0)
  const sectionProgress = clamp01(s.sectionProgress ?? 0)
  const phraseProgress = clamp01(s.phraseProgress ?? fract(beats / 16))
  const buildProgress = clamp01(s.buildProgress ?? s.build)
  const buildConfidence = clamp01(s.buildConfidence ?? 0)
  const buildIntensity = clamp01(s.buildIntensity ?? s.overall)
  const buildGate = sectionMode === 2 || buildConfidence >= 0.5
    ? clamp01((buildConfidence - 0.32) / 0.46) : 0
  const buildCharge = clamp01(buildProgress * buildGate * (0.72 + 0.28 * buildIntensity))
  const sectionActivity = sectionMode === 1 ? 0.78 : sectionMode === 3 ? 0.46
    : sectionMode === 2 ? 0.82 + 0.18 * buildCharge : 1
  // Frame-level energy is the primary global intensity signal; the existing bands
  // and Director significance contribute without overriding quieter passages.
  const level = clamp01(0.45 * s.overall + 0.17 * s.bass + 0.13 * s.mid + 0.10 * s.high + 0.09 * s.flux + 0.06 * (s.significance ?? 0))
  // A continuously visible green core must not depend on catching a one-frame
  // event. Events add distinct attacks, while actual energy powers the bus.
  // Keep these values independent of the other eight semantic lighting systems.
  const circuitEnergy = clamp01(sectionActivity * (
    0.42 * s.bass + 0.22 * s.sub + 0.16 * s.overall + 0.10 * s.mid
    + 0.10 * (s.significance ?? 0)
  ))
  const circuitAccent = combineImpulses(
    0.58 * e.kick, 0.32 * e.snare, 0.2 * e.beat, 0.68 * e.downbeat,
    0.5 * e.phrase, 0.36 * e.section, 0.96 * e.drop, 0.26 * e.transient,
  )
  const circuitPulse = combineImpulses(
    0.5 * circuitEnergy, 0.72 * circuitAccent, 0.18 * s.flux, 0.32 * buildCharge,
  )
  const common = [
    0,
    sectionActivity * (0.035 + 0.22 * s.bass + 0.08 * s.high) + 0.1 * e.beat + 0.42 * e.phrase + 0.28 * e.kick,
    sectionActivity * (0.025 + 0.22 * s.bass) + 0.74 * e.kick + 0.25 * e.transient,
    sectionActivity * (0.02 + 0.29 * s.high + 0.46 * s.flux) + 0.58 * e.transient + 0.1 * e.beat,
    sectionActivity * (0.025 + 0.3 * s.mid) + 0.6 * e.fourBeat + 0.38 * e.downbeat + 0.24 * e.section + 0.12 * (s.variation ?? 0),
    sectionActivity * (0.025 + 0.3 * s.mid + 0.12 * s.high) + 0.52 * e.phrase + 0.42 * e.snare + 0.28 * e.section,
    sectionActivity * (0.03 + 0.24 * s.sub) + 0.76 * e.snare + 0.28 * e.downbeat,
    sectionActivity * (0.03 + 0.31 * s.vocal) + 0.56 * e.eightBeat + 0.22 * e.snare,
    sectionActivity * (0.025 + 0.3 * s.flux) + 0.62 * e.downbeat + 0.18 * e.transient,
  ]
  const dropLift = 0.72 * e.drop + 0.18 * (s.impact ?? 0)
  for (let index = 1; index < common.length; index += 1) common[index] = clamp01(common[index]! + dropLift * (index >= 6 ? 1 : 0.72))

  let chaseFront = fract(beats / 4) * 1.18
  let chaseWidth = 0.09
  let chaseGain = (0.62 + 0.35 * e.phrase + 0.2 * e.section) * sectionActivity
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
    flicker += 0.1 * e.beat
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
    // Confidence enables the behavior; actual progress determines the charge.
    // No beat-clock fallback is allowed to manufacture a repeating buildup.
    const charge = buildCharge
    regionWeights = weights8(0.7 * charge, 0.08, 0.12, 0.08, 0.08, 0.12, 0.08, 0.7 * charge)
    chaseFront = charge * 1.08
    chaseWidth = 0.12
    chaseGain = 0.18 + 0.48 * charge + 0.75 * e.drop
    for (let index = 1; index < common.length; index += 1) common[index] = clamp01(common[index]! + 0.2 * charge + 0.28 * e.downbeat)
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
    circuitEnergy,
    circuitAccent,
    circuitPulse,
    bankWeights,
    regionWeights,
    routePulses: input.routePulses ?? CINEMA2_MAINFRAME_EMPTY_ROUTE_PULSES,
    sectionMode,
    sectionProgress,
    sectionConfidence,
    phraseProgress,
    buildCharge,
    systemGains: Object.freeze(common as [number, number, number, number, number, number, number, number, number]),
    signals: s,
    impulses: e,
  })
}

class ImpulseEnvelope {
  private value = 0
  private target = 0
  private holdRemainingSec = 0
  private lastId: string | null = null

  constructor(private readonly attackMs: number, private readonly holdMs: number, private readonly releaseMs: number) {}

  update(deltaSec: number, event: Readonly<{ id: string; strength: number }> | null): number {
    if (event && event.id !== this.lastId) {
      this.lastId = event.id
      this.target = Math.max(this.target, clamp01(event.strength))
      this.holdRemainingSec = this.holdMs / 1000
    }
    if (this.target > this.value + 1e-6) {
      this.value = Math.min(this.target, this.value + deltaSec / Math.max(0.001, this.attackMs / 1000))
    } else if (this.target > 0 && this.holdRemainingSec > 0) {
      this.value = Math.max(this.value, this.target)
      this.holdRemainingSec = Math.max(0, this.holdRemainingSec - deltaSec)
    } else {
      this.target = 0
      this.value = Math.max(0, this.value - deltaSec / Math.max(0.001, this.releaseMs / 1000))
    }
    return clamp01(this.value)
  }

  reset(): void { this.value = 0; this.target = 0; this.holdRemainingSec = 0; this.lastId = null }
}

interface ActiveRoutePulse {
  id: string
  kind: Cinema2MainframeImpulseId
  startTimeSec: number
  strength: number
  travelSec: number
  durationSec: number
  width: number
  direction: 1 | -1
  routeGroup: number
  priority: number
}

const ROUTE_SLOT: Readonly<Record<Cinema2MainframeImpulseId, number>> = Object.freeze({
  drop: 0, downbeat: 0, section: 0,
  kick: 1, beat: 1,
  snare: 2, phrase: 2, eightBeat: 2,
  transient: 3, fourBeat: 3,
})

const ROUTE_PRIORITY: Readonly<Record<Cinema2MainframeImpulseId, number>> = Object.freeze({
  drop: 10, downbeat: 8, section: 7, phrase: 7, kick: 6, snare: 5,
  transient: 4, eightBeat: 4, fourBeat: 3, beat: 2,
})

function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function routePulseProfile(kind: Cinema2MainframeImpulseId): Readonly<{ travel: number; duration: number; width: number; gain: number }> {
  if (kind === 'drop') return { travel: 1.35, duration: 2.05, width: 0.18, gain: 1 }
  if (kind === 'downbeat') return { travel: 0.78, duration: 1.18, width: 0.13, gain: 0.78 }
  if (kind === 'phrase' || kind === 'section') return { travel: 1.08, duration: 1.62, width: 0.14, gain: 0.64 }
  if (kind === 'kick') return { travel: 0.34, duration: 0.48, width: 0.072, gain: 0.88 }
  if (kind === 'snare') return { travel: 0.52, duration: 0.76, width: 0.095, gain: 0.66 }
  if (kind === 'transient') return { travel: 0.22, duration: 0.3, width: 0.05, gain: 0.58 }
  if (kind === 'beat') return { travel: 0.42, duration: 0.56, width: 0.065, gain: 0.28 }
  return { travel: 0.72, duration: 1.02, width: 0.1, gain: 0.46 }
}

/** Bounded persistent route scheduler. Event timestamps, not render-frame arrival,
 * establish phase, and fixed slots intentionally combine simultaneous event families. */
class MainframeRoutePulseScheduler {
  private readonly slots: Array<ActiveRoutePulse | null> = [null, null, null, null]
  private readonly consumed = new Set<string>()
  private readonly consumedOrder: string[] = []

  update(timeSec: number, events: readonly Readonly<Cinema2MainframeMusicalEvent>[]): Cinema2MainframeLightingFrame['routePulses'] {
    for (const event of events) {
      const key = `${event.kind}\u0000${event.id}`
      if (this.consumed.has(key)) continue
      this.consumed.add(key)
      this.consumedOrder.push(key)
      if (this.consumedOrder.length > 512) this.consumed.delete(this.consumedOrder.shift()!)
      const profile = routePulseProfile(event.kind)
      const slot = ROUTE_SLOT[event.kind]
      const hash = hashString(key)
      const existing = this.slots[slot]
      const age = existing ? Math.max(0, timeSec - existing.startTimeSec) : Infinity
      if (existing && age < 0.045 && existing.priority > ROUTE_PRIORITY[event.kind]) continue
      this.slots[slot] = {
        id: key,
        kind: event.kind,
        startTimeSec: event.timeSec,
        strength: clamp01(event.visualStrength ?? event.strength) * profile.gain,
        travelSec: profile.travel,
        durationSec: profile.duration,
        width: profile.width,
        direction: (hash & 1) === 0 ? 1 : -1,
        routeGroup: event.kind === 'drop' ? -1 : hash % 8,
        priority: ROUTE_PRIORITY[event.kind],
      }
    }

    const output: Cinema2MainframeRoutePulse[] = []
    for (let index = 0; index < CINEMA2_MAINFRAME_ROUTE_PULSE_COUNT; index += 1) {
      const pulse = this.slots[index]
      if (!pulse) { output.push(EMPTY_ROUTE_PULSE); continue }
      const age = Math.max(0, timeSec - pulse.startTimeSec)
      if (age > pulse.durationSec) {
        this.slots[index] = null
        output.push(EMPTY_ROUTE_PULSE)
        continue
      }
      const spec = CINEMA2_MAINFRAME_IMPULSES[pulse.kind]
      const attackSec = spec.attackMs / 1000
      const holdEnd = attackSec + spec.holdMs / 1000
      const envelope = age < attackSec ? age / Math.max(0.001, attackSec)
        : age <= holdEnd ? 1
          : clamp01(1 - (age - holdEnd) / Math.max(0.001, pulse.durationSec - holdEnd))
      const gain = pulse.strength * envelope
      output.push({
        front: clamp01(age / pulse.travelSec) * 1.12,
        width: pulse.width,
        gain,
        direction: pulse.direction,
        routeGroup: pulse.routeGroup,
      })
    }
    const totalGain = output.reduce((sum, pulse) => sum + pulse.gain, 0)
    const gainScale = totalGain > 1.8 ? 1.8 / totalGain : 1
    return Object.freeze(output.map(pulse => Object.freeze({ ...pulse, gain: pulse.gain * gainScale })) as [Cinema2MainframeRoutePulse, Cinema2MainframeRoutePulse, Cinema2MainframeRoutePulse, Cinema2MainframeRoutePulse])
  }

  reset(): void {
    this.slots.fill(null)
    this.consumed.clear()
    this.consumedOrder.length = 0
  }
}

export class Cinema2MainframeReactivityEngine {
  private readonly envelopes = Object.fromEntries(CINEMA2_MAINFRAME_IMPULSE_IDS.map(id => {
    const spec = CINEMA2_MAINFRAME_IMPULSES[id]
    return [id, new ImpulseEnvelope(spec.attackMs, spec.holdMs, spec.releaseMs)]
  })) as Record<Cinema2MainframeImpulseId, ImpulseEnvelope>
  private previousTimeSec: number | null = null
  private sourceIdentity: string | null = null
  private transportTrackId: string | null | undefined
  private contextGeneration: number | null = null
  private previousTimestampMs: number | null = null
  private smoothedLevel = 0
  private hasEnergySample = false
  private readonly routePulses = new MainframeRoutePulseScheduler()
  private readonly beatClock = new Cinema2MainframeBeatClockResolver()
  private lastFrame = evaluateCinema2MainframePattern({ pattern: CINEMA2_MAINFRAME_DEFAULT_PATTERN, beats: 0, signals: CINEMA2_MAINFRAME_ZERO_SIGNALS, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES, active: false })

  update(frame: Readonly<Cinema2ModuleFrameReadContext>, pattern: Cinema2MainframePatternId, bpmSync: boolean, patternStartBeat = 0, musicalEvents?: readonly Readonly<Cinema2MainframeMusicalEvent>[], absoluteBeat?: number): Readonly<Cinema2MainframeLightingFrame> {
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
      : Object.fromEntries(musicalEvents.map(event => [event.kind, { id: event.id, strength: event.visualStrength ?? event.strength }])) as Record<Cinema2MainframeImpulseId, Readonly<{ id: string; strength: number }> | null>
    const impulseValues = {} as Record<Cinema2MainframeImpulseId, number>
    for (const id of CINEMA2_MAINFRAME_IMPULSE_IDS) impulseValues[id] = this.envelopes[id].update(deltaSec, events?.[id] ?? null)
    const deliveredEvents = musicalEvents ?? []
    const evaluated = evaluateCinema2MainframePattern({
      pattern,
      beats: Math.max(0, (absoluteBeat ?? this.beatClock.resolve(acceptedFrame, bpmSync).beats) - Math.max(0, patternStartBeat)),
      signals: readCinema2MainframeContinuous(audio, audio ? frame.director : null),
      impulses: Object.freeze(impulseValues),
      routePulses: this.routePulses.update(timeSec, deliveredEvents),
      active: true,
    })
    // Apply Mainframe-only attack/release to the GLOBAL energy bus, not to the
    // individual signals or the kick/phrase/drop envelopes. First frame and
    // transport resets take the fresh source level immediately, never stale light.
    if (!this.hasEnergySample) {
      this.smoothedLevel = evaluated.level
      this.hasEnergySample = true
    } else {
      const timeConstant = evaluated.level > this.smoothedLevel ? 0.09 : 0.48
      this.smoothedLevel += (evaluated.level - this.smoothedLevel) * (1 - Math.exp(-deltaSec / timeConstant))
    }
    this.lastFrame = Object.freeze({ ...evaluated, level: clamp01(this.smoothedLevel) })
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
    this.smoothedLevel = 0
    this.hasEnergySample = false
    this.routePulses.reset()
    this.beatClock.reset()
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

const MIN_VALID_BPM = 20
const MAX_VALID_BPM = 400
const validBpm = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= MIN_VALID_BPM && value <= MAX_VALID_BPM

function resolveRawCinema2MainframeBeatClock(
  frame: Readonly<Cinema2ModuleFrameReadContext>,
  bpmSync: boolean,
): Readonly<Cinema2MainframeBeatClockFrame> {
  const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
  const rhythm = audio?.rhythm
  const analyzedBpm = finiteSignalNumber(rhythm?.bpm)
  if (bpmSync) {
    const phase = finiteSignalNumber(rhythm?.beatPhase)
    if (phase != null) {
      const fraction = Math.min(0.999, Math.max(0, phase))
      const bar = finiteSignalNumber(rhythm?.barIndex)
      const beatInBar = finiteSignalNumber(rhythm?.beatInBar)
      const beat = finiteSignalNumber(rhythm?.beatIndex)
      const position = bar != null && beatInBar != null
        ? Math.floor(bar) * 4 + Math.floor(beatInBar) + fraction
        : beat != null ? Math.floor(beat) + fraction : null
      if (position != null) return Object.freeze({
        beats: Math.max(0, position),
        bpm: validBpm(analyzedBpm) ? analyzedBpm : validBpm(frame.transport?.bpm) ? frame.transport!.bpm! : CINEMA2_MAINFRAME_FREE_RUN_BPM,
        source: 'analyzed-beat-grid' as const,
        confirmedGrid: true,
      })
    }
    const timeSec = resolveCinema2MainframeTimeSec(frame)
    if (validBpm(analyzedBpm)) return Object.freeze({
      beats: Math.max(0, timeSec * analyzedBpm / 60), bpm: analyzedBpm,
      source: 'analyzed-bpm' as const, confirmedGrid: false,
    })
    const transportBpm = frame.transport?.bpm
    if (validBpm(transportBpm)) return Object.freeze({
      beats: Math.max(0, timeSec * transportBpm / 60), bpm: transportBpm,
      source: 'transport-bpm' as const, confirmedGrid: false,
    })
  }
  return Object.freeze({
    beats: Math.max(0, resolveCinema2MainframeTimeSec(frame) * CINEMA2_MAINFRAME_FREE_RUN_BPM / 60),
    bpm: CINEMA2_MAINFRAME_FREE_RUN_BPM, source: 'visual-fallback-120' as const, confirmedGrid: false,
  })
}

/** Stateless snapshot retained for isolated callers and diagnostics. Estimated
 * tempo clocks are explicitly distinguishable from confirmed beat-grid data. */
export function resolveCinema2MainframeBeatClock(frame: Readonly<Cinema2ModuleFrameReadContext>, bpmSync: boolean): number {
  return resolveRawCinema2MainframeBeatClock(frame, bpmSync).beats
}

/** Mainframe-only continuity resolver shared by pattern selection and lighting. */
export class Cinema2MainframeBeatClockResolver {
  private initialized = false
  private beats = 0
  private offset = 0
  private lastTimeSec: number | null = null
  private lastSource: Cinema2MainframeBeatClockSource | null = null
  private lastIdentity: string | null = null
  private lastContextGeneration: number | null = null

  resolve(frame: Readonly<Cinema2ModuleFrameReadContext>, bpmSync: boolean): Readonly<Cinema2MainframeBeatClockFrame> {
    const raw = resolveRawCinema2MainframeBeatClock(frame, bpmSync)
    const timeSec = resolveCinema2MainframeTimeSec(frame)
    const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
    const identity = resolveCinema2MainframeSourceIdentity(frame, audio)
    const reset = !this.initialized
      || (this.lastIdentity != null && identity !== this.lastIdentity)
      || (this.lastContextGeneration != null && frame.contextGeneration !== this.lastContextGeneration)
      || (this.lastTimeSec != null && timeSec < this.lastTimeSec - 1e-6)
      || Boolean(audio?.discontinuity.occurred && audio.discontinuity.reason !== 'activation')
    const playing = resolveCinema2MainframePlaybackState(frame, audio) === 'playing'
    if (reset) {
      this.beats = raw.beats
      this.offset = 0
      this.initialized = true
    } else if (playing) {
      const delta = Math.min(0.25, Math.max(0, timeSec - (this.lastTimeSec ?? timeSec)))
      if (raw.confirmedGrid) {
        if (this.lastSource !== raw.source || Math.abs(raw.beats + this.offset - this.beats) > 0.75) this.offset = this.beats - raw.beats
        const correction = Math.min(Math.abs(this.offset), delta * Math.max(1, raw.bpm / 60))
        this.offset -= Math.sign(this.offset) * correction
        this.beats = Math.max(0, raw.beats + this.offset)
      } else {
        // BPM-only timing is an estimate: advance continuously instead of
        // reprojecting absolute time whenever a tempo estimate changes.
        this.beats = Math.max(0, this.beats + delta * raw.bpm / 60)
      }
    }
    this.lastTimeSec = timeSec
    this.lastSource = raw.source
    this.lastIdentity = identity
    this.lastContextGeneration = frame.contextGeneration
    return Object.freeze({ ...raw, beats: this.beats })
  }

  reset(): void {
    this.initialized = false
    this.beats = 0
    this.offset = 0
    this.lastTimeSec = null
    this.lastSource = null
    this.lastIdentity = null
    this.lastContextGeneration = null
  }
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
