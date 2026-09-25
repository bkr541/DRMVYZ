import type { Cinema2ModuleFrameReadContext } from './Cinema2ModuleContracts'

/**
 * A musical position in beats, shared by everything that sways with the music (the HUM:N figure, the tempo-aware camera). Locked to the track's
 * beat grid it follows the detected tempo and the grid's phase; free-running it counts at a fixed reference tempo. Toggling between the two only changes how fast and where it drifts (it slides toward the grid, never
 * snaps), so a seek, a track change or a toggle never makes the figure jump. It stands still while playback is paused.
 */
export interface Cinema2BeatState {
  /** Position in beats. */
  readonly beats: number
  /** True when the position follows the track's beat grid. */
  readonly locked: boolean
  readonly bpm: number | null
}

export const CINEMA2_BEAT_CLOCK_REFERENCE_BPM = 120
const GRID_PERIOD_BEATS = 8

/** The tempo of the moment: the analysed BPM when there is one, else the host transport's, else none. */
export function resolveCinema2EffectiveBpm(frame: Readonly<Cinema2ModuleFrameReadContext>): number | null {
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 20 && value <= 400
  const analysed = frame.audio?.rhythm.bpm
  if (analysed?.available && valid(analysed.value)) return analysed.value
  const transport = frame.transport?.bpm
  return valid(transport) ? transport : null
}

export class Cinema2BeatClock {
  private beats = 0
  private initialized = false
  private state: Readonly<Cinema2BeatState> = Object.freeze({ beats: 0, locked: false, bpm: null })

  reset(): void {
    this.beats = 0
    this.initialized = false
    this.state = Object.freeze({ beats: 0, locked: false, bpm: null })
  }

  getState(): Readonly<Cinema2BeatState> {
    return this.state
  }

  update(frame: Readonly<Cinema2ModuleFrameReadContext>, syncEnabled: boolean, referenceBpm: number = CINEMA2_BEAT_CLOCK_REFERENCE_BPM): Readonly<Cinema2BeatState> {
    const dt = Number.isFinite(frame.deltaTimeSec) ? Math.min(Math.max(frame.deltaTimeSec, 0), 0.25) : 0
    const bpm = resolveCinema2EffectiveBpm(frame)
    const locked = syncEnabled && bpm != null
    const paused = frame.transport ? !frame.transport.animationActive || frame.transport.paused : false
    if (!this.initialized) {
      this.initialized = true
      this.beats = (Math.max(0, frame.elapsedTimeSec) * referenceBpm) / 60
    } else if (!paused) {
      this.beats += (dt * (locked ? bpm! : referenceBpm)) / 60
      const index = frame.audio?.rhythm.beatIndex
      const phase = frame.audio?.rhythm.beatPhase
      if (locked && index?.available && typeof index.value === 'number' && Number.isFinite(index.value)) {
        const measured = index.value + (phase?.available && typeof phase.value === 'number' && Number.isFinite(phase.value) ? Math.min(Math.max(phase.value, 0), 0.999) : 0)
        // Align modulo two bars and only ever ease toward the grid, at most 1.5 beats per second of extra speed.
        const delta = ((((measured - this.beats) % GRID_PERIOD_BEATS) + GRID_PERIOD_BEATS + GRID_PERIOD_BEATS / 2) % GRID_PERIOD_BEATS) - GRID_PERIOD_BEATS / 2
        const maxSlide = 1.5 * dt
        this.beats += Math.min(Math.max(delta * (1 - Math.exp(-dt / 0.4)), -maxSlide), maxSlide)
      }
    }
    this.state = Object.freeze({ beats: this.beats, locked, bpm })
    return this.state
  }
}
