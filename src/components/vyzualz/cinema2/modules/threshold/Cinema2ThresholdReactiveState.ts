import type { Cinema2AudioEvent, Cinema2AudioSignal } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import { Cinema2SyncedMotionClockResolver } from '../Cinema2SyncedMotionClock'

/**
 * Music-reactive state for Threshold. Each musical signal drives a DIFFERENT visual dimension:
 *
 *   kick            -> support (accent) screens pulse
 *   snare           -> alternate rows of primary screens flash
 *   beat            -> rows alternate every two beats (row parity vs. beat-pair parity)
 *   downbeat        -> a light sweep runs down the corridor (and the preset leans the camera / swells shafts)
 *   phrase          -> the leading side swaps
 *   build / energy  -> how many primary screens are open (dark -> full) and their level
 *   drop            -> everything flashes, then releases
 *   bass            -> support-screen weight and fog swell
 *   highs           -> LED grid shimmer
 *   vocal presence  -> support screens step back to leave room
 *
 * BPM Sync governs the tempo-locked time domains: the idle breathing, the LED shimmer clock and the sweep speed.
 * Everything audio-derived is scaled by Master Reactivity; at 0 the panels collapse to their authored idle look.
 */
export interface ThresholdReactiveFrame {
  /** Tempo-scaled clock in seconds (real time when BPM Sync is off). */
  timeSec: number
  bpm: number | null
  syncEnabled: boolean
  /** True while an authoritative audio frame is driving the visuals. */
  audioActive: boolean
  kick: number
  snare: number
  beat: number
  /** 0/1: which row parity is "on" for the current beat pair. */
  beatParity: number
  /** Distance ahead of the camera of the downbeat sweep front, and its remaining strength. */
  sweepFront: number
  sweepStrength: number
  drop: number
  energy: number
  bass: number
  highs: number
  vocal: number
  /** 0..1: fraction of primary screens open. */
  arc: number
  /** 0/1: which side leads this phrase. */
  phraseSide: number
  /** Slow idle breathing 0..1, present with or without music. */
  breathing: number
}

const IDLE_ARC = 0.72
const SWEEP_SPEED = 46
const SWEEP_LENGTH = 140
const REFERENCE_BPM = 120

const TAU = Object.freeze({ kick: 0.2, snare: 0.24, beat: 0.28, drop: 1.1, smooth: 0.18, arc: 0.8 })

export class ThresholdReactiveState {
  private readonly clock = new Cinema2SyncedMotionClockResolver()
  private kickId: string | null = null
  private snareId: string | null = null
  private beatId: string | null = null
  private downbeatId: string | null = null
  private phraseId: string | null = null
  private discontinuityGeneration: number | null = null
  private previousDrop = 0
  private frame: ThresholdReactiveFrame = idleFrame(0, null, false)
  private kick = 0
  private snare = 0
  private beat = 0
  private drop = 0
  private energy = 0
  private bass = 0
  private highs = 0
  private vocal = 0
  private arc = IDLE_ARC
  private sweepFront = SWEEP_LENGTH
  private sweepActive = false
  private phraseSide = 0

  reset(): void {
    this.kickId = this.snareId = this.beatId = this.downbeatId = this.phraseId = null
    this.previousDrop = 0
    this.kick = this.snare = this.beat = this.drop = this.energy = this.bass = this.highs = this.vocal = 0
    this.arc = IDLE_ARC
    this.sweepFront = SWEEP_LENGTH
    this.sweepActive = false
    this.phraseSide = 0
  }

  getFrame(): Readonly<ThresholdReactiveFrame> {
    return this.frame
  }

  update(frame: Readonly<Cinema2ModuleFrameReadContext>, reactivity: number, bpmSync: boolean): Readonly<ThresholdReactiveFrame> {
    const clock = this.clock.resolve(frame, bpmSync)
    const audio = frame.audio
    const gate = clamp01(reactivity)
    const dt = Number.isFinite(frame.deltaTimeSec) ? clamp(frame.deltaTimeSec, 0, 0.25) : 0
    const hasSource = frame.transport ? frame.transport.sourcePresent : audio != null
    const paused = frame.transport ? !frame.transport.animationActive || frame.transport.paused : false

    if (audio?.discontinuity.occurred && audio.discontinuity.reason !== 'activation' && audio.discontinuity.generation !== this.discontinuityGeneration) {
      this.reset()
      this.discontinuityGeneration = audio.discontinuity.generation
    }
    const breathing = 0.5 + 0.5 * Math.sin(clock.syncedTimeSec * Math.PI * (REFERENCE_BPM / 60) / 2)

    if (!hasSource || !audio) {
      // No track: relax to the authored idle look, keeping only the slow breathing.
      this.decayAll(dt)
      this.frame = { ...idleFrame(clock.syncedTimeSec, clock.bpm, clock.syncEnabled), breathing, arc: this.arc, phraseSide: this.phraseSide }
      return this.frame
    }
    if (paused) {
      this.frame = { ...this.frame, timeSec: clock.syncedTimeSec, bpm: clock.bpm, syncEnabled: clock.syncEnabled, breathing }
      return this.frame
    }

    // Decay and advance first, then take new events, so a fresh hit is drawn at full strength and a new sweep starts at zero.
    this.decayAll(dt)
    const rate = clock.syncEnabled && clock.bpm != null ? clock.bpm / REFERENCE_BPM : 1
    if (this.sweepActive) {
      this.sweepFront += SWEEP_SPEED * rate * dt
      if (this.sweepFront > SWEEP_LENGTH) this.sweepActive = false
    }

    // Events: each is acted on once, by id, so a held frame never re-triggers it.
    const impact = frame.director?.authority.impact.available ? clamp01(frame.director.authority.impact.authority) : 0
    const eventStrength = (event: Readonly<Cinema2AudioEvent>) => clamp01(event.strength) * gate
    const kick = audio.rhythm.kick
    if (kick && kick.id !== this.kickId) { this.kickId = kick.id; this.kick = Math.max(this.kick, eventStrength(kick)) }
    const snare = audio.rhythm.snare
    if (snare && snare.id !== this.snareId) { this.snareId = snare.id; this.snare = Math.max(this.snare, eventStrength(snare)) }
    const beat = audio.rhythm.beat
    if (beat && beat.id !== this.beatId) { this.beatId = beat.id; this.beat = Math.max(this.beat, eventStrength(beat)) }
    const downbeat = audio.rhythm.downbeat
    if (downbeat && downbeat.id !== this.downbeatId) {
      this.downbeatId = downbeat.id
      this.sweepFront = 0
      // The Visual Director's impact gates how strong a downbeat's sweep is, so it does not fire at full strength on every bar.
      this.sweepActive = gate > 0
      this.sweepStrength = gate * (0.55 + 0.45 * Math.max(impact, clamp01(directorValue(frame.director?.continuous.intensity))))
    }
    const phrase = audio.rhythm.fixedClocks[16].boundary
    if (phrase && phrase.id !== this.phraseId) { this.phraseId = phrase.id; this.phraseSide = this.phraseSide === 0 ? 1 : 0 }

    // Drop: rising edge of the drop confidence.
    const dropConfidence = signal(audio.structure.dropConfidence) ?? 0
    if (dropConfidence >= 0.6 && this.previousDrop < 0.6) this.drop = Math.max(this.drop, gate)
    this.previousDrop = dropConfidence

    // Continuous signals, lightly smoothed.
    const follow = (current: number, target: number, tau: number) => current + (target - current) * (1 - Math.exp(-dt / tau))
    this.energy = follow(this.energy, (signal(audio.features.overallEnergy) ?? signal(audio.features.trackEnergy) ?? 0) * gate, TAU.smooth)
    this.bass = follow(this.bass, (signal(audio.bands.bass) ?? 0) * gate, TAU.smooth)
    this.highs = follow(this.highs, (signal(audio.bands.high) ?? 0) * gate, TAU.smooth)
    this.vocal = follow(this.vocal, (signal(audio.features.vocalPresence) ?? 0) * gate, 0.4)
    const build = clamp01(signal(audio.features.buildProgress) ?? directorValue(frame.director?.context.build) ?? 0)
    const arcTarget = 0.3 + 0.7 * Math.max(build, this.energy * 0.6)
    this.arc = follow(this.arc, IDLE_ARC + (arcTarget - IDLE_ARC) * gate, TAU.arc)

    const beatIndex = signal(audio.rhythm.beatIndex)
    const beatParity = beatIndex == null ? 0 : Math.floor(Math.floor(beatIndex) / 2) % 2

    this.frame = {
      timeSec: clock.syncedTimeSec,
      bpm: clock.bpm,
      syncEnabled: clock.syncEnabled,
      audioActive: true,
      kick: this.kick,
      snare: this.snare,
      beat: this.beat,
      beatParity,
      sweepFront: this.sweepFront,
      sweepStrength: this.sweepActive ? this.sweepStrength * (1 - this.sweepFront / SWEEP_LENGTH) : 0,
      drop: this.drop,
      energy: this.energy,
      bass: this.bass,
      highs: this.highs,
      vocal: this.vocal,
      arc: this.arc,
      phraseSide: this.phraseSide,
      breathing,
    }
    return this.frame
  }

  private sweepStrength = 0

  private decayAll(dt: number): void {
    const decay = (value: number, tau: number) => value * Math.exp(-dt / tau)
    this.kick = decay(this.kick, TAU.kick)
    this.snare = decay(this.snare, TAU.snare)
    this.beat = decay(this.beat, TAU.beat)
    this.drop = decay(this.drop, TAU.drop)
    if (!this.frame.audioActive) {
      this.energy = decay(this.energy, 0.4)
      this.bass = decay(this.bass, 0.4)
      this.highs = decay(this.highs, 0.4)
      this.vocal = decay(this.vocal, 0.4)
      this.arc += (IDLE_ARC - this.arc) * (1 - Math.exp(-dt / TAU.arc))
    }
  }
}

function idleFrame(timeSec: number, bpm: number | null, syncEnabled: boolean): ThresholdReactiveFrame {
  return {
    timeSec, bpm, syncEnabled, audioActive: false,
    kick: 0, snare: 0, beat: 0, beatParity: 0, sweepFront: SWEEP_LENGTH, sweepStrength: 0, drop: 0,
    energy: 0, bass: 0, highs: 0, vocal: 0, arc: IDLE_ARC, phraseSide: 0, breathing: 0.5,
  }
}

function signal(value: Readonly<Cinema2AudioSignal<number>> | null | undefined): number | null {
  return value?.available && typeof value.value === 'number' && Number.isFinite(value.value) ? value.value : null
}

function directorValue(value: Readonly<{ available: boolean; value: number | null }> | null | undefined): number {
  return value?.available && typeof value.value === 'number' && Number.isFinite(value.value) ? value.value : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clamp01(value: number): number {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1)
}
