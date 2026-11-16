// Sound Drawing XY: the shared BPM Sync clock. This is what the BPM Sync toggle means everywhere in Sound Drawing XY:
//
//   On, with a beat grid   the engine's musical timing runs in the track's own beats: its slow motion advances by the beats that actually
//                          played (so it stays in step with the bar, follows a tempo change, falls into place after a seek, and holds
//                          still when the music stops), and the time constants that are meant to feel musical (envelope attack and release,
//                          scene timers) are scaled by the tempo, so a fast track reacts faster and a slow one more slowly.
//   Off, or with no grid   the engine runs at a steady tempo (100 BPM) whatever the track. A tempo that is only a guess is never followed.
//
// The clock reports its result in "reference seconds": `motionDt` is how long the beats that just played would last at the reference tempo, so
// an engine written in seconds at the reference tempo (all of them were) can simply be fed `motionDt` where it used `dt` for motion, and
// `tempoScale` where it used a fixed time constant. With BPM Sync off `motionDt` is `dt` and `tempoScale` is 1, so nothing changes.

export const REFERENCE_BPM = 100

export interface BeatClockInput {
  playing: boolean
  /** The BPM Sync toggle. */
  sync: boolean
  /** The track's tempo, only when a beat grid backs it (null otherwise). */
  bpm: number | null
  /** The track's position in beats, only when a beat grid backs it. */
  absoluteBeat: number | null
}

export interface BeatClockFrame {
  /** Seconds of motion at the reference tempo that this frame advances (dt when not locked; the beats played when locked). */
  motionDt: number
  /** Multiply a musical time constant by this: below 1 for a track faster than the reference tempo, above 1 for a slower one; 1 when not locked. */
  tempoScale: number
  /** True when this frame is running on the track's beat grid. */
  locked: boolean
  /** The beats that played this frame (0 unless locked). */
  beats: number
}

const FREE: BeatClockFrame = Object.freeze({ motionDt: 0, tempoScale: 1, locked: false, beats: 0 })

export class BeatClock {
  private position = -1
  private lastGrid: number | null = null

  reset(): void { this.position = -1; this.lastGrid = null }

  step(dt: number, input: BeatClockInput): BeatClockFrame {
    const locked = input.sync && input.bpm != null && input.bpm > 0 && input.absoluteBeat != null && Number.isFinite(input.absoluteBeat)
    if (!locked) { this.reset(); return { ...FREE, motionDt: dt } }
    const bpm = input.bpm!
    const tempoScale = REFERENCE_BPM / bpm
    // Paused: nothing moves (the beats do not advance), and the clock is ready to pick the grid up again where it is.
    if (!input.playing) { this.position = -1; this.lastGrid = null; return { motionDt: 0, tempoScale, locked: true, beats: 0 } }
    const before = this.position
    let pos = before < 0 ? input.absoluteBeat! : before + dt * bpm / 60
    // The grid updates in steps; between them the clock runs on the tempo, and a new grid position pulls it into step (a jump of more than
    // two beats, a seek, snaps).
    if (input.absoluteBeat !== this.lastGrid) {
      const error = input.absoluteBeat! - pos
      pos = Math.abs(error) > 2 ? input.absoluteBeat! : pos + error * .35
      this.lastGrid = input.absoluteBeat
    }
    this.position = pos
    const beats = before < 0 ? 0 : Math.max(0, pos - before)
    return { motionDt: beats * 60 / REFERENCE_BPM, tempoScale, locked: true, beats }
  }
}
