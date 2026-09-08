import type { ReactorChoreographyTrigger } from './reactor'

/**
 * Reactor choreography controller.
 *
 * A canonical-music-only scheduler, modelled on the Electric Storm thunder
 * controller: it owns no FFT, BPM detector, or beat clock. One selectable
 * Trigger drives it; a fired event advances the generative re-roll epoch (the
 * ray field and the procedural core share it) and kicks a one-shot shockwave
 * burst. It coexists with the Shrapnel group's Re-roll Cadence — that clock
 * still drives the deterministic layout re-roll; this rolls fresh events on top.
 *
 * Both render paths feed it a normalized {@link ReactorChoreographyMusicInput}
 * built from whatever canonical data they carry, so the stateful bits
 * (event de-dup, energy arm/rearm hysteresis, burst envelope) live here once.
 */

const RECENT_EVENT_LIMIT = 64
const ENERGY_TRIGGER_THRESHOLD = 0.72
const ENERGY_REARM_THRESHOLD = 0.56

/** Expanding-ring travel time; `burstPhase` reaches 1 here, then drifts to the cap. */
const BURST_EXPAND_SEC = 0.55
/** Brightness fall-off time; `burst` reaches 0 here and the burst goes idle. */
const BURST_DECAY_SEC = 0.82
const BURST_PHASE_CAP = 1.3

export type ReactorChoreographyClockId = 'beat' | 'beat2' | 'beat4' | 'bar' | 'bar4' | 'bar8' | 'phrase'

const CLOCK_BY_TRIGGER: Readonly<Partial<Record<ReactorChoreographyTrigger, ReactorChoreographyClockId>>> = Object.freeze({
  beat: 'beat',
  beat2: 'beat2',
  beat4: 'beat4',
  bar: 'bar',
  bar4: 'bar4',
  bar8: 'bar8',
  phrase: 'phrase',
})

/** One canonical clock this frame. `hit` is the one-frame boundary; `eventId`
 *  de-dups it across render paths, `index` is the fallback identity. */
export interface ReactorChoreographyClockInput {
  hit: boolean
  eventId: string | null
  index: number | null
}

/** One canonical impulse this frame (downbeat / drop start). */
export interface ReactorChoreographyImpulseInput {
  active: boolean
  eventId: string | null
  index: number | null
}

export interface ReactorChoreographyMusicInput {
  /** Seconds since the previous update; clamped internally. */
  deltaSec: number
  /** Transport jumped (seek, track change, restart) — reset before scheduling. */
  timingDiscontinuity: boolean
  isPlaying: boolean
  /** Canonical 0..1 energy, consumed only by the Energy trigger. */
  energy: number
  /** Stable identity scope (track / preset id) for clocks that lack an eventId. */
  scope: string
  /** Monotonic frame ordinal, only used to disambiguate Energy events. */
  frameOrdinal: number
  /** Per-clock snapshot. A render path omits the clocks it cannot resolve;
   *  the matching triggers then simply never fire on that path. */
  clocks: Readonly<Partial<Record<ReactorChoreographyClockId, ReactorChoreographyClockInput>>>
  downbeat: ReactorChoreographyImpulseInput | null
  drop: ReactorChoreographyImpulseInput | null
}

export interface ReactorChoreographyFrame {
  /** A trigger event was consumed this frame. */
  started: boolean
  /** Count of consumed events since the last reset. Fold into `uRayEpoch`. */
  rerollCount: number
  /** Shockwave burst brightness 0..1 (`uReactorBurst`); decays after each event. */
  burst: number
  /** Expanding-ring progress 0..~1.3 since the last event (`uReactorBurstPhase`). */
  burstPhase: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function clampDeltaSec(value: number): number {
  return Math.max(0, Math.min(0.25, Number.isFinite(value) ? value : 0))
}

function impulseEventKey(name: string, impulse: ReactorChoreographyImpulseInput | null, scope: string): string | null {
  if (!impulse || !impulse.active) return null
  if (impulse.eventId) return `${name}:${impulse.eventId}`
  return impulse.index === null ? null : `${name}:${scope}:${impulse.index}`
}

export class ReactorChoreographyController {
  private rerollCount = 0
  private energyArmed = true
  private burstElapsedSec = Number.POSITIVE_INFINITY
  private burstActive = false
  private readonly recentEventKeys = new Set<string>()
  private readonly recentEventOrder: string[] = []

  update(
    input: Readonly<ReactorChoreographyMusicInput>,
    trigger: ReactorChoreographyTrigger,
  ): ReactorChoreographyFrame {
    if (input.timingDiscontinuity) this.reset()

    const deltaSec = clampDeltaSec(input.deltaSec)
    if (this.burstActive) this.burstElapsedSec += deltaSec

    const eventKey = trigger === 'off' || input.isPlaying === false
      ? null
      : this.resolveEventKey(input, trigger)
    const started = eventKey !== null && this.consume(eventKey)
    if (started) {
      this.rerollCount += 1
      this.burstElapsedSec = 0
      this.burstActive = true
    }

    let burst = 0
    let burstPhase = 0
    if (this.burstActive) {
      burstPhase = Math.min(BURST_PHASE_CAP, this.burstElapsedSec / BURST_EXPAND_SEC)
      const decayProgress = Math.min(1, this.burstElapsedSec / BURST_DECAY_SEC)
      burst = decayProgress >= 1 ? 0 : (1 - decayProgress) * (1 - decayProgress)
      if (burst <= 0 && burstPhase >= BURST_PHASE_CAP) this.burstActive = false
    }

    return { started, rerollCount: this.rerollCount, burst, burstPhase }
  }

  reset(): void {
    this.rerollCount = 0
    this.energyArmed = true
    this.burstElapsedSec = Number.POSITIVE_INFINITY
    this.burstActive = false
    this.recentEventKeys.clear()
    this.recentEventOrder.length = 0
  }

  private resolveEventKey(
    input: Readonly<ReactorChoreographyMusicInput>,
    trigger: ReactorChoreographyTrigger,
  ): string | null {
    if (trigger === 'energy') {
      const energy = clamp01(input.energy)
      if (energy <= ENERGY_REARM_THRESHOLD) this.energyArmed = true
      if (!this.energyArmed || energy < ENERGY_TRIGGER_THRESHOLD) return null
      this.energyArmed = false
      return `energy:${input.scope}:${input.frameOrdinal}`
    }
    if (trigger === 'downbeat') return impulseEventKey('downbeat', input.downbeat, input.scope)
    if (trigger === 'drop') return impulseEventKey('drop', input.drop, input.scope)

    const clockId = CLOCK_BY_TRIGGER[trigger]
    if (!clockId) return null
    const clock = input.clocks[clockId]
    if (!clock || !clock.hit) return null
    if (clock.eventId) return `${trigger}:${clock.eventId}`
    return clock.index === null ? null : `${trigger}:${input.scope}:${clock.index}`
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
}
