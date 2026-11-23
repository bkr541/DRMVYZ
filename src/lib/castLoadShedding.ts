/**
 * Turns a cast stream's measured frame rate into a pressure level. A stream that cannot keep up (it was 49 fps, then 32, then 2 just before one GPU process
 * failure in the logs) is a sign the GPU is overloaded by rendering + copying + encoding at once; the cure is to render less, and to copy and encode fewer
 * frames. The level goes up quickly and comes down slowly, and it is judged against the rate the relay is currently asked for, so halving the relay's rate at
 * level 2 does not itself read as a failure.
 */
import { getPerformancePressure, subscribePerformancePressure, type PerformancePressureLevel } from './performancePressure'

export const CAST_FULL_FPS = 60
export const CAST_SHED_FPS = 30

export interface CastLoadSample {
  /** The stream's measured outbound frame rate; null/0 until it is known. */
  fps: number | null | undefined
  connected: boolean
  /** A hidden window throttles its frames for reasons that are not load. */
  visible: boolean
}

export interface CastLoadState {
  level: 0 | 1 | 2
  /** The frame rate the relay should be asked to produce at this level. */
  targetFps: number
  changed: boolean
}

const POOR_RATIO = 0.75
const SEVERE_RATIO = 0.4
const HEALTHY_RATIO = 0.9
/** Samples arrive about every two seconds: 2 bad ones to step up, 4 good ones to step down. */
const STEP_UP_SAMPLES = 2
const STEP_DOWN_SAMPLES = 4

export class CastLoadShedder {
  private level: 0 | 1 | 2 = 0
  private poorStreak = 0
  private severeStreak = 0
  private healthyStreak = 0

  constructor(private readonly fullFps: number = CAST_FULL_FPS, private readonly shedFps: number = CAST_SHED_FPS) {}

  get targetFps(): number { return this.level >= 2 ? this.shedFps : this.fullFps }

  reset(): CastLoadState {
    const changed = this.level !== 0
    this.level = 0
    this.poorStreak = this.severeStreak = this.healthyStreak = 0
    return { level: 0, targetFps: this.fullFps, changed }
  }

  observe(sample: CastLoadSample): CastLoadState {
    const fps = sample.fps
    // No cast, a hidden window, or no reading yet: say nothing about load, and hold the current level.
    if (!sample.connected) return this.reset()
    if (!sample.visible || typeof fps !== 'number' || !Number.isFinite(fps) || fps <= 0) return { level: this.level, targetFps: this.targetFps, changed: false }

    const before = this.level
    const ratio = fps / this.targetFps
    if (ratio < SEVERE_RATIO) { this.severeStreak += 1; this.poorStreak += 1; this.healthyStreak = 0 }
    else if (ratio < POOR_RATIO) { this.severeStreak = 0; this.poorStreak += 1; this.healthyStreak = 0 }
    else if (ratio >= HEALTHY_RATIO) { this.healthyStreak += 1; this.poorStreak = 0; this.severeStreak = 0 }
    else { this.poorStreak = 0; this.severeStreak = 0; this.healthyStreak = 0 }

    if (this.severeStreak >= STEP_UP_SAMPLES && this.level < 2) { this.level = 2; this.clearStreaks() }
    else if (this.poorStreak >= STEP_UP_SAMPLES && this.level < 2) { this.level = (this.level + 1) as 1 | 2; this.clearStreaks() }
    else if (this.healthyStreak >= STEP_DOWN_SAMPLES && this.level > 0) { this.level = (this.level - 1) as 0 | 1; this.clearStreaks() }

    return { level: this.level, targetFps: this.targetFps, changed: this.level !== before }
  }

  private clearStreaks(): void {
    this.poorStreak = this.severeStreak = this.healthyStreak = 0
  }
}

/**
 * Keeps a relay's frame cadence in step with the shared pressure: at severe pressure (level 2, from any source) the relay copies and encodes at most
 * CAST_SHED_FPS frames a second, and it goes back to `baseFps` when the pressure ends. Returns the unsubscribe; call it when the relay stops.
 */
export function bindCadenceToPressure(cadence: { setFps(fps: number): void }, baseFps: number): () => void {
  const apply = (level: PerformancePressureLevel) => cadence.setFps(level >= 2 ? Math.min(baseFps, CAST_SHED_FPS) : baseFps)
  apply(getPerformancePressure())
  return subscribePerformancePressure(apply)
}
