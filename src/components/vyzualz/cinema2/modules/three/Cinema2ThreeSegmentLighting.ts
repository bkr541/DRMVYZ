import type { Cinema2AudioIntelligenceFrame } from '../../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2BeatClock } from '../Cinema2BeatClock'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'

/**
 * Per-segment LED lighting for `three-scene` parts (`config.segments`), used by CONDUIT: each glowing strip, window or rim band of a model knows
 * which ring, rib or tube it belongs to and where it sits (the `_SEGMENT` vertex attribute: group, along, side, random) and how far along the
 * energy's path it is (`_GLOW_PHASE`), and a pattern lights every segment on the GPU from a handful of per-frame values computed here.
 *
 * Roles (per part): `feed` - the tubes, whose energy runs from the wall (phase 0) into the logo (phase 1); `core` - the logo rim, which flares
 * when energy arrives; `field` - the back wall, whose phase runs from the centre (0) to the outer edge (1).
 *
 * Patterns:
 * - `energyFlow`: on every beat a pulse runs through the tubes into the logo (first half beat), the rim flares, and a ring of light ripples
 *   outward across the wall (second half beat). Downbeats are stronger.
 * - `ringChase`: comets chase round each ring, neighbouring rings in opposite directions, and out along the ribs and down the tubes; they speed
 *   up with the music's energy and through a build.
 * - `split`: the left and right halves trade on every beat (every bar when the music is calm); a drop lights both.
 * - `pulse`: everything breathes with the beat and the bass; quiet or vocal passages dim the wall to leave just the tubes and logo; a drop lights
 *   everything.
 * Flicker (0-1) makes segments drop out and stutter at random, each on its own.
 *
 * Everything here is a pure function of the beat clock and the audio, so the GPU shader below and `evaluateCinema2SegmentBrightness` (its
 * TypeScript twin, for tests) give the same answer.
 */
export const CINEMA2_THREE_SEGMENT_PATTERNS = Object.freeze(['energyFlow', 'ringChase', 'split', 'pulse'] as const)
export type Cinema2ThreeSegmentPattern = typeof CINEMA2_THREE_SEGMENT_PATTERNS[number]
export const CINEMA2_THREE_SEGMENT_ROLES = Object.freeze(['feed', 'core', 'field'] as const)
export type Cinema2ThreeSegmentRole = typeof CINEMA2_THREE_SEGMENT_ROLES[number]
export const CINEMA2_THREE_SEGMENT_WAVE_COUNT = 4

export interface Cinema2ThreeSegmentInputs {
  readonly pattern: Cinema2ThreeSegmentPattern
  readonly sync: boolean
  /** 0-1: how often segments drop out and stutter. */
  readonly flicker: number
  /** 0-1: how strongly the lighting follows the music (0 holds a steady glow). */
  readonly reactivity: number
}

/** The per-frame values the shader reads. */
export interface Cinema2ThreeSegmentFrame {
  readonly beats: number
  /** Smoothed bass and energy, 0-1. */
  readonly level: number
  /** Drop envelope, 1 on a drop then decaying. */
  readonly drop: number
  /** 0-1: how far a quiet or vocal passage has dimmed the wall. */
  readonly quiet: number
  /** Accumulated chase position in turns (integrated, so a speed change never makes the comets jump). */
  readonly chase: number
  /** -1 (left lit) or 1 (right lit). */
  readonly splitSide: number
  readonly flicker: number
  readonly reactivity: number
  /** Crossfade weights of energyFlow, ringChase, split, pulse. */
  readonly weights: readonly [number, number, number, number]
  /** Energy Flow pulses: the front runs 0 -> 1 through the tubes, then 1 -> 2 across the wall. Below 0 or above ~2.4 means inactive. */
  readonly fronts: readonly number[]
  readonly gains: readonly number[]
}

export interface Cinema2ThreeSegmentVertex {
  readonly group: number
  readonly along: number
  readonly side: number
  readonly random: number
  readonly phase: number
}

const INACTIVE = -10
const CROSSFADE_SEC = 0.35
/** A drop is a full-rig hit: it holds at full for this long, then decays. */
const DROP_HOLD_SEC = 0.6
const DROP_DECAY_SEC = 1.6

const signal = (value: { available: boolean; value: number | null } | undefined): number =>
  value?.available && typeof value.value === 'number' && Number.isFinite(value.value) ? Math.min(1, Math.max(0, value.value)) : 0
const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const fract = (value: number) => value - Math.floor(value)

export function readCinema2ThreeSegmentPattern(value: unknown): Cinema2ThreeSegmentPattern {
  return CINEMA2_THREE_SEGMENT_PATTERNS.includes(value as Cinema2ThreeSegmentPattern) ? value as Cinema2ThreeSegmentPattern : 'energyFlow'
}

export class Cinema2ThreeSegmentLighting {
  private readonly clock = new Cinema2BeatClock()
  private lastBeats: number | null = null
  private level = 0
  private quiet = 0
  private drop = 0
  private dropHeld = 0
  private chase = 0
  private sectionId: string | null = null
  private lastTimeSec: number | null = null
  private weights: [number, number, number, number] = [1, 0, 0, 0]
  private readonly waves: { start: number; gain: number }[] = []

  reset(): void {
    this.clock.reset()
    this.lastBeats = null
    this.level = 0
    this.quiet = 0
    this.drop = 0
    this.dropHeld = 0
    this.chase = 0
    this.sectionId = null
    this.lastTimeSec = null
    this.waves.length = 0
  }

  update(frame: Readonly<Cinema2ModuleFrameReadContext>, inputs: Readonly<Cinema2ThreeSegmentInputs>): Readonly<Cinema2ThreeSegmentFrame> {
    const beats = this.clock.update(frame, inputs.sync).beats
    const audio: Readonly<Cinema2AudioIntelligenceFrame> | null = frame.audio
    const dt = Math.min(Math.max(Number.isFinite(frame.deltaTimeSec) ? frame.deltaTimeSec : 0, 0), 0.25)
    const ease = (current: number, target: number, rise: number, fall: number) => current + (target - current) * (1 - Math.exp(-dt / (target > current ? rise : fall)))

    const bass = Math.max(signal(audio?.bands.bass), signal(audio?.bands.sub))
    const energy = signal(audio?.features.overallEnergy)
    const build = signal(audio?.features.buildProgress)
    const vocal = signal(audio?.features.vocalPresence)
    this.level = ease(this.level, Math.min(1, 0.55 * bass + 0.45 * energy), 0.08, 0.45)
    const quietTarget = audio ? (energy < 0.2 || (vocal > 0.55 && energy < 0.5) ? 1 : 0) : 0
    this.quiet = ease(this.quiet, quietTarget, 0.6, 0.25)

    // A drop: entering a drop section, or crossing a drop moment.
    const section = audio?.structure.section.available ? audio.structure.section.value : null
    const timeSec = audio?.upstream.timeSec ?? null
    let dropped = false
    if (section && section.id !== this.sectionId) {
      if (this.sectionId !== null && typeof section.type === 'string' && section.type.toLowerCase().includes('drop')) dropped = true
      this.sectionId = section.id
    }
    const moments = audio?.structure.semanticMoments.available ? audio.structure.semanticMoments.value ?? [] : []
    if (timeSec != null && this.lastTimeSec != null && timeSec > this.lastTimeSec) {
      for (const moment of moments) {
        if ((moment.type === 'drop' || moment.type === 'drop_impact') && moment.timeSec > this.lastTimeSec && moment.timeSec <= timeSec) dropped = true
      }
    }
    this.lastTimeSec = timeSec
    if (dropped) { this.drop = 1; this.dropHeld = 0 }
    else if (this.drop > 0) {
      this.dropHeld += dt
      if (this.dropHeld > DROP_HOLD_SEC) this.drop *= Math.exp(-dt / DROP_DECAY_SEC)
    }

    // Crossfade toward the active pattern.
    const active = CINEMA2_THREE_SEGMENT_PATTERNS.indexOf(inputs.pattern)
    const blend = 1 - Math.exp(-dt / CROSSFADE_SEC)
    this.weights = this.weights.map((weight, index) => weight + ((index === active ? 1 : 0) - weight) * (dt > 0 ? blend : 0)) as [number, number, number, number]
    if (this.lastBeats === null) this.weights = this.weights.map((_, index) => (index === active ? 1 : 0)) as [number, number, number, number]

    // Chase speed: an eighth of a turn a beat at rest, up to half a turn in a loud section or a build.
    const beatDelta = this.lastBeats == null ? 0 : Math.max(0, beats - this.lastBeats)
    this.chase = fract(this.chase + beatDelta * (0.125 + 0.3 * this.level + 0.1 * build))

    // Energy Flow pulses, one a beat.
    const beat = Math.floor(beats)
    if (this.lastBeats != null && beats < this.lastBeats) this.waves.length = 0
    if (this.lastBeats != null && beat > Math.floor(this.lastBeats)) {
      const downbeat = ((beat % 4) + 4) % 4 === 0
      this.waves.push({ start: beat, gain: (downbeat ? 1.25 : 0.7) * (0.55 + 0.7 * Math.max(bass, this.level)) })
      if (this.waves.length > CINEMA2_THREE_SEGMENT_WAVE_COUNT) this.waves.shift()
    }
    this.lastBeats = beats
    const fronts: number[] = [], gains: number[] = []
    for (let index = 0; index < CINEMA2_THREE_SEGMENT_WAVE_COUNT; index += 1) {
      const wave = this.waves[index]
      const front = wave ? (beats - wave.start) * 2 : INACTIVE
      const alive = wave && front <= 2.4
      fronts.push(alive ? front : INACTIVE)
      gains.push(alive ? wave.gain * Math.min(1, Math.max(0, (2.4 - front) / 0.4)) : 0)
    }

    // Split: trade every beat when the music is moving, every bar when it is calm.
    const splitUnit = this.level > 0.45 ? Math.floor(beats) : Math.floor(beats / 4)
    const splitSide = splitUnit % 2 === 0 ? -1 : 1

    return Object.freeze({
      beats,
      level: this.level,
      drop: this.drop,
      quiet: this.quiet,
      chase: this.chase,
      splitSide,
      flicker: clamp01(inputs.flicker),
      reactivity: clamp01(inputs.reactivity),
      weights: Object.freeze([...this.weights]) as unknown as readonly [number, number, number, number],
      fronts: Object.freeze(fronts),
      gains: Object.freeze(gains),
    })
  }
}

// ── The brightness function: GLSL and its TypeScript twin ───────────────────────────────────────────────────────────────────────────────
// Keep the two in step. Role codes: 0 feed, 1 core, 2 field.

const ROLE_CODE: Readonly<Record<Cinema2ThreeSegmentRole, number>> = Object.freeze({ feed: 0, core: 1, field: 2 })
export const cinema2ThreeSegmentRoleCode = (role: Cinema2ThreeSegmentRole) => ROLE_CODE[role]

const hash = (value: number) => fract(Math.sin(value) * 43758.5453)
/** A trailing comet: 1 just behind the head, fading backward; `u` is the fractional position relative to the head. */
const comet = (u: number) => u * u * u * u

export function evaluateCinema2SegmentBrightness(role: Cinema2ThreeSegmentRole, vertex: Readonly<Cinema2ThreeSegmentVertex>, frame: Readonly<Cinema2ThreeSegmentFrame>): number {
  const code = ROLE_CODE[role]
  const beatEnvelope = Math.exp(-fract(frame.beats) * 4)
  const group = Math.floor(vertex.group * 7 + 0.5)

  // Energy Flow.
  let flow = code === 0 ? 0.12 : code === 1 ? 0.3 + 0.3 * frame.level : 0.06
  for (let index = 0; index < CINEMA2_THREE_SEGMENT_WAVE_COUNT; index += 1) {
    const front = frame.fronts[index] ?? INACTIVE
    const gain = frame.gains[index] ?? 0
    if (code === 0) { const d = (vertex.phase - front) / 0.12; flow += gain * Math.exp(-d * d) }
    else if (code === 1) { const d = (front - 1) / 0.3; flow += gain * 0.9 * Math.exp(-d * d) }
    else { const d = (vertex.phase - (front - 1)) / 0.1; flow += gain * Math.exp(-d * d) }
  }

  // Ring Chase.
  const direction = group % 2 === 0 ? 1 : -1
  const chase = code === 0
    ? 0.1 + 0.9 * comet(fract(vertex.phase * 3 - frame.chase * 6))
    : code === 1
      ? 0.35 + 0.45 * beatEnvelope * (0.4 + 0.6 * frame.level)
      : 0.05 + 0.95 * comet(fract((vertex.along - direction * frame.chase) * 3))

  // Split.
  const lit = vertex.side * frame.splitSide > 0.2 ? 1 : Math.abs(vertex.side) <= 0.2 ? 0.5 : 0
  const splitBase = code === 1 ? 0.4 + 0.5 * beatEnvelope : 0.05 + lit * (0.35 + 0.65 * beatEnvelope)
  const split = splitBase + (1 - splitBase) * frame.drop

  // Pulse.
  let pulse = 0.12 + frame.level * (0.35 + 0.65 * beatEnvelope)
  if (code === 2) pulse *= 1 - frame.quiet
  pulse += (1 - pulse) * frame.drop

  const [wFlow, wChase, wSplit, wPulse] = frame.weights
  let brightness = wFlow * flow + wChase * chase + wSplit * split + wPulse * pulse
  brightness = 0.35 + (brightness - 0.35) * frame.reactivity

  // Flicker: each segment drops out on its own random 16ths, and flutters at high settings.
  const n = hash(vertex.random * 113.1 + Math.floor(frame.beats * 4) * 7.3)
  if (n < frame.flicker * 0.5) brightness *= 0.06
  brightness *= 1 - frame.flicker * 0.35 * (fract(frame.beats * 8 + vertex.random * 9) > 0.5 ? 1 : 0)
  return Math.max(0, brightness)
}

/** GLSL twin of evaluateCinema2SegmentBrightness. Expects the uniforms below and `float role`, `vec4 segment`, `float phase`. */
export const CINEMA2_THREE_SEGMENT_GLSL = `
uniform vec4 uCinema2Seg0; // beats, level, drop, quiet
uniform vec4 uCinema2Seg1; // chase, splitSide, flicker, reactivity
uniform vec4 uCinema2SegWeights;
uniform vec4 uCinema2SegFront;
uniform vec4 uCinema2SegGain;
float cinema2SegHash( float value ) { return fract( sin( value ) * 43758.5453 ); }
float cinema2SegComet( float u ) { return u * u * u * u; }
float cinema2SegmentBrightness( float role, vec4 segment, float phase ) {
  float beats = uCinema2Seg0.x;
  float level = uCinema2Seg0.y;
  float drop = uCinema2Seg0.z;
  float quiet = uCinema2Seg0.w;
  float beatEnvelope = exp( - fract( beats ) * 4.0 );
  float group = floor( segment.x * 7.0 + 0.5 );

  float flow = role < 0.5 ? 0.12 : ( role < 1.5 ? 0.3 + 0.3 * level : 0.06 );
  for ( int i = 0; i < ${CINEMA2_THREE_SEGMENT_WAVE_COUNT}; i ++ ) {
    float front = uCinema2SegFront[ i ];
    float gain = uCinema2SegGain[ i ];
    if ( role < 0.5 ) { float d = ( phase - front ) / 0.12; flow += gain * exp( - d * d ); }
    else if ( role < 1.5 ) { float d = ( front - 1.0 ) / 0.3; flow += gain * 0.9 * exp( - d * d ); }
    else { float d = ( phase - ( front - 1.0 ) ) / 0.1; flow += gain * exp( - d * d ); }
  }

  float direction = mod( group, 2.0 ) < 0.5 ? 1.0 : -1.0;
  float chase = role < 0.5
    ? 0.1 + 0.9 * cinema2SegComet( fract( phase * 3.0 - uCinema2Seg1.x * 6.0 ) )
    : ( role < 1.5
      ? 0.35 + 0.45 * beatEnvelope * ( 0.4 + 0.6 * level )
      : 0.05 + 0.95 * cinema2SegComet( fract( ( segment.y - direction * uCinema2Seg1.x ) * 3.0 ) ) );

  float lit = segment.z * uCinema2Seg1.y > 0.2 ? 1.0 : ( abs( segment.z ) <= 0.2 ? 0.5 : 0.0 );
  float splitBase = role > 0.5 && role < 1.5 ? 0.4 + 0.5 * beatEnvelope : 0.05 + lit * ( 0.35 + 0.65 * beatEnvelope );
  float split = splitBase + ( 1.0 - splitBase ) * drop;

  float pulse = 0.12 + level * ( 0.35 + 0.65 * beatEnvelope );
  if ( role > 1.5 ) pulse *= 1.0 - quiet;
  pulse += ( 1.0 - pulse ) * drop;

  float brightness = dot( uCinema2SegWeights, vec4( flow, chase, split, pulse ) );
  brightness = 0.35 + ( brightness - 0.35 ) * uCinema2Seg1.w;

  float n = cinema2SegHash( segment.w * 113.1 + floor( beats * 4.0 ) * 7.3 );
  if ( n < uCinema2Seg1.z * 0.5 ) brightness *= 0.06;
  brightness *= 1.0 - uCinema2Seg1.z * 0.35 * ( fract( beats * 8.0 + segment.w * 9.0 ) > 0.5 ? 1.0 : 0.0 );
  return max( brightness, 0.0 );
}
`
