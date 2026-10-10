import type { Cinema2AudioIntelligenceFrame } from '../../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2BeatClock, resolveCinema2EffectiveBpm } from '../Cinema2BeatClock'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import type { Cinema2DepthLightProgram } from './Cinema2DepthLightPrograms'

export const CINEMA2_DEPTH_TRIGGER_IDS = Object.freeze([
  'beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop',
] as const)

export type Cinema2DepthTriggerId = typeof CINEMA2_DEPTH_TRIGGER_IDS[number]
export type Cinema2DepthCueKind = 'kick' | 'snare' | 'transient' | 'beat' | 'downbeat' | 'bar' | 'phrase' | 'section' | 'drop'

export interface Cinema2DepthOrchestrationInputs {
  readonly pattern: Cinema2DepthLightProgram
  readonly auto: boolean
  readonly patternChange: boolean
  readonly trigger: Cinema2DepthTriggerId
  readonly sync: boolean
  readonly routeDensity: number
  readonly pulseWidth: number
  readonly dropIntensity: number
}

export interface Cinema2DepthOrchestrationFrame {
  readonly pattern: Cinema2DepthLightProgram
  readonly weights: readonly number[]
  readonly beats: number
  readonly level: number
  readonly quiet: number
  readonly build: number
  /** Four through one during the final build beats; zero outside the countdown. */
  readonly countdown: number
  readonly dropElapsed: number
  readonly dropDischarge: number
  readonly dropAfterglow: number
  /** kick, snare, transient, downbeat. */
  readonly accents: readonly [number, number, number, number]
  readonly relayGroup: number
  readonly routeDensity: number
  readonly pulseWidth: number
  readonly dropIntensity: number
  /** Signed multiple of the authored clockwise rotation speed. */
  readonly rotationMultiplier: number
}

const CROSSFADE_SECONDS = 0.32
const DROP_BLACKOUT_SECONDS = 0.09
const DROP_DISCHARGE_SECONDS = 1.45
const DROP_AFTERGLOW_SECONDS = 3.4

export class Cinema2DepthOrchestration {
  private readonly clock = new Cinema2BeatClock()
  private readonly queuedCues: { kind: Cinema2DepthCueKind; id: string }[] = []
  private readonly seenCueIds = new Set<string>()
  private canonicalDeliveryActive = false
  private lastBeats: number | null = null
  private lastAudioTime: number | null = null
  private activePattern: Cinema2DepthLightProgram | null = null
  private authoredPattern: Cinema2DepthLightProgram | null = null
  private lastPatternTriggerId: string | null = null
  private relayGroup = 0
  private dropElapsed = Number.POSITIVE_INFINITY
  private fallbackCountdownStartBeat: number | null = null
  private level = 0
  private quiet = 0
  private rotationMultiplier = 1
  private weights = new Array<number>(8).fill(0)
  private readonly cueEnvelopes: Record<'kick' | 'snare' | 'transient' | 'downbeat', number> = {
    kick: 0,
    snare: 0,
    transient: 0,
    downbeat: 0,
  }

  reset(): void {
    this.clock.reset()
    this.queuedCues.length = 0
    this.seenCueIds.clear()
    this.canonicalDeliveryActive = false
    this.lastBeats = null
    this.lastAudioTime = null
    this.activePattern = null
    this.authoredPattern = null
    this.lastPatternTriggerId = null
    this.relayGroup = 0
    this.dropElapsed = Number.POSITIVE_INFINITY
    this.fallbackCountdownStartBeat = null
    this.level = 0
    this.quiet = 0
    this.rotationMultiplier = 1
    this.weights.fill(0)
    this.cueEnvelopes.kick = 0
    this.cueEnvelopes.snare = 0
    this.cueEnvelopes.transient = 0
    this.cueEnvelopes.downbeat = 0
  }

  enqueueCue(kind: Cinema2DepthCueKind, eventId: string): void {
    this.canonicalDeliveryActive = true
    this.queueCue(kind, eventId)
  }

  update(
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    inputs: Readonly<Cinema2DepthOrchestrationInputs>,
    patterns: readonly Cinema2DepthLightProgram[],
  ): Readonly<Cinema2DepthOrchestrationFrame> {
    if (frame.audio?.discontinuity?.occurred && frame.audio.discontinuity.reason !== 'activation') this.reset()
    const beatState = this.clock.update(frame, inputs.sync)
    const beats = beatState.beats
    const dt = frame.transport && (!frame.transport.animationActive || frame.transport.paused)
      ? 0
      : clamp(finite(frame.deltaTimeSec, 0), 0, 0.25)
    const audio = frame.audio
    if (!this.canonicalDeliveryActive) this.collectSharedAudioFallback(audio)
    const delivered = this.queuedCues.splice(0)
    const cue = (kind: Cinema2DepthCueKind) => delivered.find(event => event.kind === kind) ?? null

    const releases = { kick: 0.17, snare: 0.3, transient: 0.11, downbeat: 0.52 } as const
    for (const kind of ['kick', 'snare', 'transient', 'downbeat'] as const) {
      if (cue(kind)) this.cueEnvelopes[kind] = 1
      else this.cueEnvelopes[kind] *= Math.exp(-dt / releases[kind])
    }

    const bass = Math.max(signal(audio?.bands.bass), signal(audio?.bands.sub))
    const energy = signal(audio?.features.overallEnergy)
    const vocal = signal(audio?.features.vocalPresence)
    const build = Math.max(signal(audio?.features.buildProgress), signal(frame.director?.context.build))
    this.level = ease(this.level, clamp(bass * 0.54 + energy * 0.46, 0, 1), dt, 0.08, 0.42)
    const sectionType = audio?.structure.section.available ? audio.structure.section.value?.type?.toLowerCase() ?? '' : ''
    const quietTarget = audio && ((energy < 0.2 && bass < 0.18) || (vocal > 0.58 && energy < 0.5) || sectionType.includes('break')) ? 1 : 0
    this.quiet = ease(this.quiet, quietTarget, dt, 0.5, 0.28)
    let countdown = resolveAnalyzedCountdown(audio, resolveCinema2EffectiveBpm(frame))
    if (build < 0.82) this.fallbackCountdownStartBeat = null
    else if (countdown === 0 && this.fallbackCountdownStartBeat === null) this.fallbackCountdownStartBeat = Math.floor(beats)
    if (countdown === 0 && this.fallbackCountdownStartBeat !== null) {
      const elapsedBuildBeats = Math.floor(beats) - this.fallbackCountdownStartBeat
      if (elapsedBuildBeats >= 0 && elapsedBuildBeats < 4) countdown = 4 - elapsedBuildBeats
    }

    const dropped = cue('drop') != null
    if (dropped) this.dropElapsed = 0
    else if (Number.isFinite(this.dropElapsed)) this.dropElapsed += dt
    const dropDischarge = this.dropElapsed < DROP_BLACKOUT_SECONDS
      ? 0
      : clamp((this.dropElapsed - DROP_BLACKOUT_SECONDS) / DROP_DISCHARGE_SECONDS, 0, 1)
    const dropAfterglow = this.dropElapsed < DROP_BLACKOUT_SECONDS + DROP_DISCHARGE_SECONDS
      ? 0
      : 1 - clamp((this.dropElapsed - DROP_BLACKOUT_SECONDS - DROP_DISCHARGE_SECONDS) / DROP_AFTERGLOW_SECONDS, 0, 1)

    if (this.authoredPattern !== inputs.pattern) {
      this.authoredPattern = inputs.pattern
      this.activePattern = inputs.pattern
      this.lastPatternTriggerId = null
    }
    if (inputs.auto) {
      this.activePattern = autoPattern(patterns, beats, build, this.quiet, this.level, countdown > 0, dropped || this.dropElapsed < 2.2)
    } else if (inputs.patternChange) {
      const triggerEvent = resolveTriggerEvent(inputs.trigger, delivered, beats, this.lastBeats)
      if (triggerEvent && triggerEvent !== this.lastPatternTriggerId) {
        const current = Math.max(0, patterns.indexOf(this.activePattern ?? inputs.pattern))
        this.activePattern = patterns[(current + 1) % patterns.length]!
        this.lastPatternTriggerId = triggerEvent
      }
    } else {
      this.activePattern = inputs.pattern
      this.lastPatternTriggerId = null
    }

    const pattern = this.activePattern ?? inputs.pattern
    const activeIndex = Math.max(0, patterns.indexOf(pattern))
    const blend = dt > 0 ? 1 - Math.exp(-dt / CROSSFADE_SECONDS) : 1
    if (this.lastBeats === null) this.weights = this.weights.map((_, index) => index === activeIndex ? 1 : 0)
    else this.weights = this.weights.map((weight, index) => weight + ((index === activeIndex ? 1 : 0) - weight) * blend)

    const relayBank = Math.floor(beats / 4) % 2 === 0 ? 0 : 4
    if (cue('kick')) this.relayGroup = relayBank
    else if (cue('snare')) this.relayGroup = relayBank + 1
    else if (cue('transient')) this.relayGroup = relayBank + 2
    else if (cue('downbeat')) this.relayGroup = relayBank + 3
    else if (cue('beat')) this.relayGroup = (this.relayGroup + 1) % 8

    const rotationTarget = dropped || this.dropElapsed < 2.25
      ? -1.2
      : build > 0.12
        ? 1 + build * 1.45
        : this.quiet > 0.5
          ? 0.35
          : 0.82 + this.level * 0.36
    this.rotationMultiplier = ease(this.rotationMultiplier, rotationTarget, dt, rotationTarget < 0 ? 0.34 : 0.65, 0.72)
    this.lastBeats = beats
    this.lastAudioTime = audio?.upstream.timeSec ?? this.lastAudioTime

    return Object.freeze({
      pattern,
      weights: Object.freeze([...this.weights]),
      beats,
      level: this.level,
      quiet: this.quiet,
      build,
      countdown,
      dropElapsed: this.dropElapsed,
      dropDischarge,
      dropAfterglow,
      accents: Object.freeze([
        this.cueEnvelopes.kick,
        this.cueEnvelopes.snare,
        this.cueEnvelopes.transient,
        this.cueEnvelopes.downbeat,
      ]) as readonly [number, number, number, number],
      relayGroup: this.relayGroup,
      routeDensity: clamp(inputs.routeDensity, 0, 1),
      pulseWidth: clamp(inputs.pulseWidth, 0, 1),
      dropIntensity: clamp(inputs.dropIntensity, 0, 1),
      rotationMultiplier: this.rotationMultiplier,
    })
  }

  private collectSharedAudioFallback(audio: Readonly<Cinema2AudioIntelligenceFrame> | null): void {
    if (!audio) return
    for (const kind of ['kick', 'snare', 'transient', 'beat', 'downbeat'] as const) {
      const event = audio.rhythm[kind]
      if (event) this.queueCue(kind, event.id)
    }
    const time = audio.upstream.timeSec
    if (this.lastAudioTime != null && time >= this.lastAudioTime && audio.structure.semanticMoments.available) {
      for (const moment of audio.structure.semanticMoments.value ?? []) {
        if ((moment.type === 'drop' || moment.type === 'drop_impact') && moment.timeSec > this.lastAudioTime && moment.timeSec <= time) {
          this.queueCue('drop', moment.id)
        }
      }
    }
  }

  private queueCue(kind: Cinema2DepthCueKind, eventId: string): void {
    if (!eventId) return
    const key = `${kind}\u0000${eventId}`
    if (this.seenCueIds.has(key)) return
    this.seenCueIds.add(key)
    if (this.seenCueIds.size > 512) this.seenCueIds.clear()
    this.queuedCues.push({ kind, id: eventId })
    if (this.queuedCues.length > 128) this.queuedCues.shift()
  }
}

function autoPattern(
  patterns: readonly Cinema2DepthLightProgram[],
  beats: number,
  build: number,
  quiet: number,
  level: number,
  countdown: boolean,
  dropping: boolean,
): Cinema2DepthLightProgram {
  if (dropping || countdown || build > 0.22) return 'depthDischarge'
  if (quiet > 0.5) return 'fullPulse'
  if (level > 0.68) return 'portalRelay'
  const rotation: readonly Cinema2DepthLightProgram[] = ['architecturalSparse', 'depthChase', 'sideOrbit', 'gatePulse', 'alternatingFrames', 'portalRelay']
  return rotation[((Math.floor(beats / 16) % rotation.length) + rotation.length) % rotation.length] ?? patterns[0] ?? 'architecturalSparse'
}

function resolveTriggerEvent(
  trigger: Cinema2DepthTriggerId,
  delivered: readonly { kind: Cinema2DepthCueKind; id: string }[],
  beats: number,
  lastBeats: number | null,
): string | null {
  const cueKind = trigger === 'kick' || trigger === 'snare' || trigger === 'downbeat' || trigger === 'phrase' || trigger === 'drop' || trigger === 'beat'
    ? trigger
    : null
  const cue = cueKind ? delivered.find(event => event.kind === cueKind) : null
  if (cue) return cue.id
  const interval = trigger === 'beat2' ? 2 : trigger === 'beat4' || trigger === 'bar' ? 4
    : trigger === 'bar4' ? 16 : trigger === 'bar8' ? 32 : null
  if (interval != null && lastBeats != null && Math.floor(beats / interval) > Math.floor(lastBeats / interval)) {
    return `clock:${trigger}:${Math.floor(beats / interval)}`
  }
  return null
}

function resolveAnalyzedCountdown(
  audio: Readonly<Cinema2AudioIntelligenceFrame> | null,
  bpm: number | null,
): number {
  const time = audio?.upstream.timeSec
  if (time != null && audio?.structure.semanticMoments.available) {
    const nextDrop = (audio.structure.semanticMoments.value ?? [])
      .filter(moment => (moment.type === 'drop' || moment.type === 'drop_impact') && moment.timeSec > time)
      .sort((a, b) => a.timeSec - b.timeSec)[0]
    if (nextDrop) {
      const beatsUntil = (nextDrop.timeSec - time) * (bpm ?? 120) / 60
      if (beatsUntil > 0 && beatsUntil <= 4.05) return clamp(Math.ceil(beatsUntil), 1, 4)
    }
  }
  return 0
}

function signal(value: { available: boolean; value: number | null } | undefined): number {
  return value?.available && typeof value.value === 'number' && Number.isFinite(value.value) ? clamp(value.value, 0, 1) : 0
}

function ease(current: number, target: number, dt: number, rise: number, fall: number): number {
  const tau = target > current ? rise : fall
  return current + (target - current) * (1 - Math.exp(-dt / Math.max(0.001, tau)))
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
