import type { SharedPerformanceContext } from '../../../../features/performanceCore'

/** Steady tempo used when BPM Sync is off, or when the loaded audio has no BPM. */
export const HEADLINER_FALLBACK_BPM = 120
/** Energy assumed when no analysed audio is playing, so effects keep their authored look. */
export const HEADLINER_NEUTRAL_ENERGY = 0.5

const KICK_DECAY_SEC = 0.18

export interface HeadlinerEffectTiming {
  /** Free-running wall-clock seconds. */
  timeSec: number
  dtSec: number
  /** Continuous beat position: the track's grid when `synced`, otherwise a steady 120 BPM. */
  beat: number
  secondsPerBeat: number
  /** True when the beat comes from the loaded track's BPM and beat grid. */
  synced: boolean
  /** 0..1 musical energy; neutral while nothing analysed is playing. */
  energy: number
  /** 0..1 pulse that jumps on each kick and decays. */
  kick: number
}

export const HEADLINER_IDLE_TIMING: Readonly<HeadlinerEffectTiming> = Object.freeze({
  timeSec: 0,
  dtSec: 1 / 60,
  beat: 0,
  secondsPerBeat: 60 / HEADLINER_FALLBACK_BPM,
  synced: false,
  energy: HEADLINER_NEUTRAL_ENERGY,
  kick: 0,
})

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Turns the shared performance context into the timing every Headliner effect reads. One clock for
 * everything: with BPM Sync on and a known BPM, beats are the track's own grid; otherwise a steady
 * 120 BPM runs off wall time, never a second drifting clock.
 */
export class HeadlinerTimingTracker {
  private lastNowSec: number | null = null
  private kickPulse = 0

  reset(): void {
    this.lastNowSec = null
    this.kickPulse = 0
  }

  /** `transportTimeSec` is the fresh audio time; the shared context itself only refreshes a few times a second. */
  update(
    nowSec: number,
    context: SharedPerformanceContext | null,
    bpmSync: boolean,
    transportTimeSec: number = context?.audioTimeSec ?? 0,
  ): HeadlinerEffectTiming {
    const dtSec = this.lastNowSec === null ? 1 / 60 : Math.min(0.25, Math.max(0, nowSec - this.lastNowSec))
    this.lastNowSec = nowSec

    this.kickPulse *= Math.exp(-dtSec / KICK_DECAY_SEC)
    if (context?.kick) this.kickPulse = Math.max(this.kickPulse, clamp01(context.kickStrength || 1))

    let energy = HEADLINER_NEUTRAL_ENERGY
    if (context) {
      const live = (context.bass + context.mid + context.high) / 3
      const measured = Math.max(context.energy, context.trackRelativeEnergy, live)
      if (measured > 0.001 || context.sectionType != null) energy = clamp01(measured)
    }

    const canonical = bpmSync && context != null && context.bpm > 0 && Number.isFinite(context.absoluteBeat)
    if (canonical && context) {
      const secondsPerBeat = 60 / context.bpm
      const extrapolated = Math.min(0.25, Math.max(0, transportTimeSec - context.audioTimeSec))
      return {
        timeSec: nowSec,
        dtSec,
        beat: context.absoluteBeat + clamp01(context.beatPhase) + extrapolated / secondsPerBeat,
        secondsPerBeat,
        synced: true,
        energy,
        kick: this.kickPulse,
      }
    }

    const secondsPerBeat = 60 / HEADLINER_FALLBACK_BPM
    return {
      timeSec: nowSec,
      dtSec,
      beat: Math.max(0, nowSec) / secondsPerBeat,
      secondsPerBeat,
      synced: false,
      energy,
      kick: this.kickPulse,
    }
  }
}

/** Overall effect strength after Master Intensity and the two reactions. Always >= 0. */
export function headlinerReactiveGain(
  timing: Pick<HeadlinerEffectTiming, 'energy' | 'kick'>,
  musicReactivity: number,
  kickReactivity: number,
): number {
  const energySwell = musicReactivity * (timing.energy - HEADLINER_NEUTRAL_ENERGY) * 1.2
  const kickPunch = kickReactivity * timing.kick * 0.5
  return Math.max(0, 1 + energySwell + kickPunch)
}
