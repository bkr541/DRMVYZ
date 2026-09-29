import type { Cinema2AudioIntelligenceFrame } from '../../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2BeatClock } from '../Cinema2BeatClock'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'

/**
 * Audio-driven glow for `three-scene` parts (`config.glow`): how brightly the glowing parts of a model (golden roots, vines, veins) light up
 * this frame. Two motions, chosen by the `glowMode` parameter:
 * - `breathing`: the whole glow swells and settles on a two-beat breath, its depth following the bass and the track's energy, lifted through
 *   a build.
 * - `energy`: on every beat a pulse of light starts at the root tips and climbs the model (along its per-vertex glow phase, 0 at the root tips,
 *   1 at the top) in about a beat; the downbeat's pulse is the strongest.
 * - `both`: the two layered.
 * Timing comes from the shared beat clock: locked to the track's beat grid while `glowSync` is on, a steady 120 BPM while it is off (paused
 * playback stands still). The audio scales how strong each breath and pulse is, so a quiet passage glows softly and a drop blazes.
 */
export type Cinema2ThreeGlowMode = 'energy' | 'breathing' | 'both'

export const CINEMA2_THREE_GLOW_WAVE_COUNT = 4

export interface Cinema2ThreeGlowFrame {
  /** Glow everywhere on the glowing parts (the resting glow plus the breath). */
  breath: number
  /** Front of each climbing pulse along the glow phase (below 0 or above ~1.3 means inactive). */
  fronts: readonly number[]
  /** Strength of each climbing pulse. */
  gains: readonly number[]
  /** The glow clock's position in beats (locked to the beat grid with sync on), for per-tree variation in the shader. */
  beats: number
}

export interface Cinema2ThreeGlowInputs {
  mode: Cinema2ThreeGlowMode
  sync: boolean
  /** How strongly the glow reacts (0: it rests at `rest`; 1: full reaction). */
  reactivity: number
}

/** The glow the structure keeps with no music at all, so it never goes fully dark. */
const REST = 0.18
/** Beats a pulse takes to climb from the root tips to the top. */
const CLIMB_BEATS = 1.1
const INACTIVE = -10

const signal = (value: { available: boolean; value: number | null } | undefined): number =>
  value?.available && typeof value.value === 'number' && Number.isFinite(value.value) ? Math.min(1, Math.max(0, value.value)) : 0

export function readCinema2ThreeGlowMode(value: unknown): Cinema2ThreeGlowMode {
  return value === 'energy' || value === 'breathing' ? value : 'both'
}

export class Cinema2ThreeAudioGlow {
  private readonly clock = new Cinema2BeatClock()
  private lastBeat: number | null = null
  private level = 0
  private readonly waves: { start: number; gain: number }[] = []

  reset(): void {
    this.clock.reset()
    this.lastBeat = null
    this.level = 0
    this.waves.length = 0
  }

  update(frame: Readonly<Cinema2ModuleFrameReadContext>, inputs: Readonly<Cinema2ThreeGlowInputs>): Readonly<Cinema2ThreeGlowFrame> {
    const beats = this.clock.update(frame, inputs.sync).beats
    const audio: Readonly<Cinema2AudioIntelligenceFrame> | null = frame.audio
    const reactivity = Math.min(1, Math.max(0, inputs.reactivity))
    const bass = Math.max(signal(audio?.bands.bass), signal(audio?.bands.sub))
    const energy = signal(audio?.features.overallEnergy)
    const build = signal(audio?.features.buildProgress)
    // Rise quickly, settle slowly, so a bass swell reads as a breath rather than flicker.
    const target = Math.min(1, 0.55 * bass + 0.45 * energy)
    const dt = Math.min(Math.max(frame.deltaTimeSec, 0), 0.25)
    this.level += (target - this.level) * (1 - Math.exp(-dt / (target > this.level ? 0.08 : 0.45)))

    let breath = REST
    if (inputs.mode !== 'energy') {
      const swell = 0.5 - 0.5 * Math.cos((beats / 2) * Math.PI * 2) // one breath every two beats, peaking on the odd beat
      breath += reactivity * (0.25 + 0.95 * this.level) * (0.35 + 0.65 * swell) + reactivity * 0.35 * build
    }

    const beat = Math.floor(beats)
    if (this.lastBeat != null && beat < this.lastBeat) this.waves.length = 0 // the clock went backwards (seek or reset)
    if (inputs.mode !== 'breathing' && this.lastBeat != null && beat > this.lastBeat) {
      const downbeat = ((beat % 4) + 4) % 4 === 0
      this.waves.push({ start: beat, gain: reactivity * (downbeat ? 1.25 : 0.55) * (0.45 + 0.9 * Math.max(bass, this.level)) })
      if (this.waves.length > CINEMA2_THREE_GLOW_WAVE_COUNT) this.waves.shift()
    }
    if (inputs.mode === 'breathing') this.waves.length = 0
    this.lastBeat = beat

    const fronts: number[] = [], gains: number[] = []
    for (let index = 0; index < CINEMA2_THREE_GLOW_WAVE_COUNT; index += 1) {
      const wave = this.waves[index]
      const front = wave ? (beats - wave.start) / CLIMB_BEATS : INACTIVE
      const alive = wave && front <= 1.35
      fronts.push(alive ? front : INACTIVE)
      // Fade as it reaches the top so the pulse does not stop dead.
      gains.push(alive ? wave.gain * Math.min(1, Math.max(0, (1.35 - front) / 0.35)) : 0)
    }
    return Object.freeze({ breath, fronts: Object.freeze(fronts), gains: Object.freeze(gains), beats })
  }
}
