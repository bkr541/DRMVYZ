import type { ElectricStormSettings, ElectricStormThunderTrigger } from '../../../CinematicWorldSettings'
import type {
  CinematicCanonicalClockIdentity,
  CinematicCanonicalEventIdentity,
  CinematicFrameContext,
} from '../../CinematicWorldRenderer'

const RECENT_EVENT_LIMIT = 64
const ENERGY_TRIGGER_THRESHOLD = 0.72
const ENERGY_REARM_THRESHOLD = 0.56

const CLOCK_BY_TRIGGER: Readonly<Partial<Record<ElectricStormThunderTrigger, keyof NonNullable<CinematicFrameContext['canonicalMusic']>['clocks']>>> = Object.freeze({
  beat: 'beat',
  beat2: 'beat2',
  beat4: 'beat4',
  bar: 'bar',
  bar4: 'bar4',
  bar8: 'bar8',
  phrase: 'phrase',
})

export interface ElectricStormThunderFrame {
  illumination: number
  started: boolean
  eventKey: string | null
}

export class ElectricStormThunderController {
  private elapsedSec = Number.POSITIVE_INFINITY
  private active = false
  private energyArmed = true
  private readonly recentEventKeys = new Set<string>()
  private readonly recentEventOrder: string[] = []

  update(frame: Readonly<CinematicFrameContext>, settings: Readonly<ElectricStormSettings>): ElectricStormThunderFrame {
    if (frame.timingDiscontinuity) this.reset()

    const deltaSec = Math.max(0, Math.min(0.25, Number.isFinite(frame.deltaTimeSec) ? frame.deltaTimeSec : 0))
    if (this.active) this.elapsedSec += deltaSec

    const eventKey = frame.isPlaying === false ? null : this.resolveEventKey(frame, settings.thunderTrigger)
    const started = eventKey !== null && this.consume(eventKey)
    if (started) {
      this.active = true
      this.elapsedSec = 0
    }

    const illumination = this.active ? this.envelope(settings) : 0
    if (illumination <= 0) this.active = false
    return { illumination, started, eventKey }
  }

  reset(): void {
    this.elapsedSec = Number.POSITIVE_INFINITY
    this.active = false
    this.energyArmed = true
    this.recentEventKeys.clear()
    this.recentEventOrder.length = 0
  }

  private resolveEventKey(
    frame: Readonly<CinematicFrameContext>,
    trigger: ElectricStormThunderTrigger,
  ): string | null {
    if (trigger === 'energy') return this.resolveEnergyEvent(frame)

    const canonical = frame.canonicalMusic
    if (!canonical) return null
    if (trigger === 'downbeat') return eventIdentityKey('downbeat', canonical.impulses.downbeat, canonical.clocks.bar)
    if (trigger === 'drop') return eventIdentityKey('drop', canonical.impulses.dropStart, undefined, canonical.section.id)

    const clockName = CLOCK_BY_TRIGGER[trigger]
    return clockName ? clockIdentityKey(trigger, canonical.clocks[clockName], frame.musicalAudio?.trackId ?? frame.presetId) : null
  }

  private resolveEnergyEvent(frame: Readonly<CinematicFrameContext>): string | null {
    const energy = clamp01(frame.musicalAudio?.values.overallEnergy ?? frame.audio.smoothed.volume)
    if (energy <= ENERGY_REARM_THRESHOLD) this.energyArmed = true
    if (!this.energyArmed || energy < ENERGY_TRIGGER_THRESHOLD) return null
    this.energyArmed = false
    return `energy:${frame.musicalAudio?.trackId ?? frame.presetId}:${frame.frameIndex}`
  }

  private consume(eventKey: string): boolean {
    if (this.recentEventKeys.has(eventKey)) return false
    this.recentEventKeys.add(eventKey)
    this.recentEventOrder.push(eventKey)
    while (this.recentEventOrder.length > RECENT_EVENT_LIMIT) {
      const retired = this.recentEventOrder.shift()
      if (retired) this.recentEventKeys.delete(retired)
    }
    return true
  }

  private envelope(settings: Readonly<ElectricStormSettings>): number {
    const intensity = clamp01(settings.flashIntensity)
    const holdSec = mix(0.035, 0.28, clamp01(settings.flashDuration))
    const decaySec = mix(0.08, 0.9, clamp01(settings.flashDecay))
    if (this.elapsedSec <= holdSec) return intensity
    const decayProgress = (this.elapsedSec - holdSec) / decaySec
    if (decayProgress >= 1) return 0
    return intensity * Math.pow(1 - Math.max(0, decayProgress), 2)
  }
}

function eventIdentityKey(
  name: string,
  event: Readonly<CinematicCanonicalEventIdentity>,
  fallbackClock?: Readonly<CinematicCanonicalClockIdentity>,
  fallbackId?: string | null,
): string | null {
  if (!event.active) return null
  if (event.eventId) return `${name}:${event.eventId}`
  if (fallbackClock?.index != null) return `${name}:clock:${fallbackClock.index}`
  return fallbackId ? `${name}:section:${fallbackId}` : null
}

function clockIdentityKey(
  name: string,
  clock: Readonly<CinematicCanonicalClockIdentity>,
  scope: string,
): string | null {
  if (!clock.available || !clock.hit) return null
  if (clock.eventId) return `${name}:${clock.eventId}`
  return clock.index == null ? null : `${name}:${scope}:${clock.index}`
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}
