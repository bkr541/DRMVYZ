import type { ElectricStormSettings } from '../../../CinematicWorldSettings'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'
import type { ElectricStormStrikeIntent } from './ElectricStormStrikeGenerator'

export interface ElectricStormAudioChoreographyResult {
  strikeRate: number
  audioDetail: number
  intents: readonly ElectricStormStrikeIntent[]
}

export interface ElectricStormAudioChoreographerOptions {
  /** Internal deterministic input for tests. Runtime callers should omit it. */
  sessionSeed?: number
}

const runtimeEntropy = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0
let runtimeSessionOrdinal = 0

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}

function hash32(value: number): number {
  let x = value >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function random01(seed: number): number {
  return hash32(seed) / 0x100000000
}

function freshSessionSeed(): number {
  runtimeSessionOrdinal = (runtimeSessionOrdinal + 1) >>> 0
  return hash32(runtimeEntropy ^ Math.imul(runtimeSessionOrdinal, 0x9e3779b1))
}

type ElectricStormDiscreteEvent = 'kick' | 'dropStart' | 'transient'

function continuousBucket(timeSec: number, intervalSec: number): number {
  return Math.floor(Math.max(0, timeSec) / Math.max(0.08, intervalSec))
}

/**
 * Electric Storm consumes host-prepared musical intelligence only. This class
 * schedules bounded strike intents from that canonical data; it never owns an
 * FFT, BPM detector, onset detector, or beat clock.
 */
export class ElectricStormAudioChoreographer {
  private readonly sessionSeed: number
  private consumedEvents = new Set<string>()
  private consumedEventOrder: string[] = []
  private mediumBucket = Number.NaN
  private microBucket = Number.NaN
  private transientActive = false
  private readonly fallbackEventOrdinals: Record<ElectricStormDiscreteEvent, number> = { kick: 0, dropStart: 0, transient: 0 }
  private readonly fallbackEventActive: Record<ElectricStormDiscreteEvent, boolean> = { kick: false, dropStart: false, transient: false }

  constructor(options: ElectricStormAudioChoreographerOptions = {}) {
    this.sessionSeed = options.sessionSeed === undefined ? freshSessionSeed() : options.sessionSeed >>> 0
  }

  update(frame: CinematicFrameContext, settings: ElectricStormSettings): ElectricStormAudioChoreographyResult {
    const audio = frame.musicalAudio
    if (!audio || !audio.isPlaying) {
      this.transientActive = false
      this.fallbackEventActive.kick = false
      this.fallbackEventActive.dropStart = false
      this.fallbackEventActive.transient = false
      return { strikeRate: settings.strikeRate, audioDetail: 0, intents: [] }
    }

    const bass = clamp01(audio.values.bass)
    const mids = clamp01(audio.values.mid)
    const highs = clamp01(audio.values.highs)
    const transient = clamp01(audio.values.transientIntensity)
    const build = clamp01(audio.values.buildProgress)
    const energy = clamp01(audio.values.overallEnergy)
    const dropState = clamp01(audio.values.dropState)
    const authority = clamp01(settings.masterIntensity * 0.42 + settings.strikeRate * 0.58)
    const strikeRate = clamp01(settings.strikeRate * (0.72 + energy * 0.22 + build * 0.3))
    const audioDetail = clamp01(highs * 0.48 + build * 0.38 + energy * 0.14)
    // Every automatic foreground-strike path below is additionally gated by
    // this factor so Strike Rate 0% suppresses audio-reactive strikes too
    // (each path previously kept a non-zero probability floor of its own),
    // while a full-rate slider leaves each path's existing probability
    // unchanged (multiplying by 1 is a no-op).
    const rateGate = clamp01(settings.strikeRate)
    const intents: ElectricStormStrikeIntent[] = []

    const kickActive = audio.events.kick || frame.canonicalMusic?.impulses.kick.active === true
    const kickKey = this.resolveEventKey(frame, 'kick', kickActive)
    if (kickKey && this.consumeEvent(kickKey)) {
      const probability = clamp01((0.12 + settings.strikeRate * 0.42 + settings.masterIntensity * 0.18 + energy * 0.18) * mix(0.45, 1, authority)) * rateGate
      const gate = random01(this.sessionSeed ^ hashString(kickKey) ^ 0x63d83595)
      if (gate < probability) {
        intents.push({
          tier: 'strong',
          power: clamp01(0.28 + bass * 0.58 + energy * 0.14),
          detail: clamp01(0.35 + highs * 0.35 + build * 0.3),
        })
      }
    }

    const dropActive = audio.events.dropEntry || frame.canonicalMusic?.impulses.dropStart.active === true
    const dropKey = this.resolveEventKey(frame, 'dropStart', dropActive)
    if (dropKey && this.consumeEvent(dropKey)) {
      const dropGate = random01(this.sessionSeed ^ hashString(dropKey) ^ 0x2545f491)
      if (dropGate < rateGate) {
        const count = authority > 0.72 && (energy > 0.68 || build > 0.76) ? 3 : authority > 0.34 ? 2 : 1
        intents.push({
          tier: 'hero',
          power: clamp01(0.5 + bass * 0.3 + Math.max(dropState, energy) * 0.2),
          detail: clamp01(0.58 + highs * 0.2 + build * 0.22),
          count,
        })
      }
    }

    const transientNow = frame.canonicalMusic?.impulses.transient.active === true || transient > 0.72
    const transientKey = this.resolveEventKey(frame, 'transient', transientNow)
    if (transientNow && !this.transientActive && transientKey && authority > 0.08) {
      if (this.consumeEvent(transientKey)) {
        const transientGate = random01(this.sessionSeed ^ hashString(transientKey) ^ 0x9e3779b1)
        if (transientGate < rateGate) {
          intents.push({
            tier: transient > 0.9 && mids > 0.62 ? 'medium' : 'micro',
            power: clamp01(0.28 + transient * 0.52 + highs * 0.2),
            detail: clamp01(0.5 + highs * 0.5),
            durationScale: 0.58,
          })
        }
      }
    }
    this.transientActive = transientNow

    if (mids > 0.46 && authority > 0.08) {
      const interval = mix(1.15, 0.36, clamp01(mids * 0.55 + build * 0.45))
      const bucket = continuousBucket(frame.transportTimeSec, interval)
      if (bucket !== this.mediumBucket) {
        this.mediumBucket = bucket
        const gate = random01(this.sessionSeed ^ hash32(bucket + 0x51ed270b))
        const probability = clamp01((mids - 0.36) * (0.42 + settings.strikeRate * 0.45 + build * 0.28)) * rateGate
        if (gate < probability) {
          intents.push({
            tier: 'medium',
            power: clamp01(0.3 + mids * 0.34 + bass * 0.2 + energy * 0.16),
            detail: clamp01(0.3 + highs * 0.25 + build * 0.45),
          })
        }
      }
    }

    if (highs > 0.5 && authority > 0.08) {
      const interval = mix(0.72, 0.2, clamp01(highs * 0.62 + build * 0.38))
      const bucket = continuousBucket(frame.transportTimeSec, interval)
      if (bucket !== this.microBucket) {
        this.microBucket = bucket
        const gate = random01(this.sessionSeed ^ hash32(bucket + 0x94d049bb))
        const probability = clamp01((highs - 0.4) * (0.55 + settings.strikeRate * 0.35 + build * 0.4)) * rateGate
        if (gate < probability) {
          intents.push({
            tier: 'micro',
            power: clamp01(0.25 + highs * 0.45 + transient * 0.18 + build * 0.12),
            detail: clamp01(0.46 + highs * 0.38 + build * 0.16),
            durationScale: mix(0.72, 0.5, transient),
          })
        }
      }
    }

    return { strikeRate, audioDetail, intents }
  }

  reset(): void {
    this.consumedEvents.clear()
    this.consumedEventOrder = []
    this.mediumBucket = Number.NaN
    this.microBucket = Number.NaN
    this.transientActive = false
    this.fallbackEventOrdinals.kick = 0
    this.fallbackEventOrdinals.dropStart = 0
    this.fallbackEventOrdinals.transient = 0
    this.fallbackEventActive.kick = false
    this.fallbackEventActive.dropStart = false
    this.fallbackEventActive.transient = false
  }

  private resolveEventKey(
    frame: CinematicFrameContext,
    event: ElectricStormDiscreteEvent,
    active: boolean,
  ): string | null {
    const canonical = frame.canonicalMusic?.impulses[event]
    if (!active) {
      this.fallbackEventActive[event] = false
      return null
    }
    if (canonical?.eventId) {
      this.fallbackEventActive[event] = true
      return `${event}:${canonical.eventId}`
    }
    if (!this.fallbackEventActive[event]) this.fallbackEventOrdinals[event] += 1
    this.fallbackEventActive[event] = true
    const track = frame.musicalAudio?.trackId ?? frame.presetId
    return `${event}:${track}:pulse:${this.fallbackEventOrdinals[event]}`
  }

  private consumeEvent(key: string): boolean {
    if (this.consumedEvents.has(key)) return false
    this.consumedEvents.add(key)
    this.consumedEventOrder.push(key)
    if (this.consumedEventOrder.length > 64) {
      const expired = this.consumedEventOrder.shift()
      if (expired) this.consumedEvents.delete(expired)
    }
    return true
  }
}
