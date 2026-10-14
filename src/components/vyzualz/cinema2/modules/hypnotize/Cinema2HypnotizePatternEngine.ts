import type { Cinema2AudioIntelligenceFrame } from '../../audio/Cinema2AudioIntelligenceBridge'
export const CINEMA2_HYPNOTIZE_PATTERNS = Object.freeze([
  'mesmericOrbit',
  'blackIris',
  'turbineBloom',
  'chromaticRelay',
  'infiniteDraw',
  'radiantCollapse',
] as const)
export type Cinema2HypnotizePattern = typeof CINEMA2_HYPNOTIZE_PATTERNS[number]

export interface Cinema2HypnotizePatternProfile {
  readonly turbineRate: number
  readonly conductorRate: number
  readonly membraneRate: number
  readonly collarRate: number
  readonly vaneWave: number
  readonly coreBias: number
  readonly depthWave: number
  readonly haloGain: number
  readonly exteriorGain: number
  readonly warmBias: number
  readonly roll: number
  readonly ledBase: number
  readonly ledContrast: number
  readonly ledTempo: number
  readonly ledBloom: number
}

export interface Cinema2HypnotizeLedAddress {
  readonly family: 'collar' | 'exterior'
  readonly layer: number
  readonly sector: number
  readonly segment: number
}

export interface Cinema2HypnotizeLedSignals {
  readonly overallEnergy: number
  readonly bassPressure: number
  readonly highsAmount: number
  readonly fluxAmount: number
  readonly kickAccent: number
  readonly snareAccent: number
  readonly downbeatAccent: number
  readonly phraseAccent: number
  readonly dropAccent: number
}

export interface Cinema2HypnotizePatternInput {
  readonly authoredPattern: Cinema2HypnotizePattern
  readonly patternChange: boolean
  readonly autoPerformance: boolean
  readonly trigger: string
  readonly triggerEventId: string | null
  readonly triggerPulse: number
  readonly deltaTimeSec: number
  readonly animationActive: boolean
  readonly bpmSync: boolean
  readonly bpm: number
  readonly discontinuityGeneration: number
  readonly overallEnergy: number
  readonly vocalPresence: number
  readonly directorIntensity: number
  readonly directorMomentum: number
  readonly buildAmount: number
  readonly dropAccent: number
}

export interface Cinema2HypnotizePatternFrame {
  readonly pattern: Cinema2HypnotizePattern
  readonly previousPattern: Cinema2HypnotizePattern
  readonly transition: number
  readonly beats: number
  readonly profile: Readonly<Cinema2HypnotizePatternProfile>
}

export const CINEMA2_HYPNOTIZE_PATTERN_PROFILES: Readonly<Record<Cinema2HypnotizePattern, Readonly<Cinema2HypnotizePatternProfile>>> = Object.freeze({
  mesmericOrbit: profile(0.22, -0.31, 0.08, -0.045, 0.18, 1, 0.12, 0.72, 0.78, 0.28, 0.16, 0.34, 0.82, 0.5, 1.05),
  blackIris: profile(0.06, -0.24, 0.18, 0.025, 0.08, 0.72, 0.06, 0.34, 0.42, 0.1, 0.04, 0.16, 0.94, 0.25, 0.9),
  turbineBloom: profile(0.42, -0.18, 0.12, 0.08, 0.72, 1.12, 0.22, 0.88, 0.9, 0.34, 0.24, 0.28, 1, 0.75, 1.18),
  chromaticRelay: profile(0.28, -0.52, -0.16, 0.3, 0.38, 0.96, 0.46, 1, 1.12, 0.82, 0.18, 0.22, 1.08, 1, 1.26),
  infiniteDraw: profile(0.1, -0.12, 0.05, 0.56, 0.12, 0.84, 1, 0.46, 0.58, 0.24, 0.08, 0.2, 0.92, 0.375, 1.08),
  radiantCollapse: profile(-0.34, 0.44, 0.24, -0.48, 0.62, 0.64, 0.82, 1.22, 1.28, 0.66, 0.32, 0.3, 1.18, 0.625, 1.42),
})

/** Returns the authored per-segment LED drive. Each pattern uses a different spatial topology. */
export function resolveCinema2HypnotizeLedDrive(
  frame: Readonly<Cinema2HypnotizePatternFrame>,
  address: Readonly<Cinema2HypnotizeLedAddress>,
  signals: Readonly<Cinema2HypnotizeLedSignals>,
): number {
  const current = resolveLedDriveForPattern(frame.pattern, frame.beats, frame.profile, address, signals)
  if (frame.previousPattern === frame.pattern || frame.transition >= 1) return current
  const previous = resolveLedDriveForPattern(frame.previousPattern, frame.beats, frame.profile, address, signals)
  const transition = smoothstep(clamp(frame.transition, 0, 1))
  return previous + (current - previous) * transition
}

function resolveLedDriveForPattern(
  pattern: Cinema2HypnotizePattern,
  beats: number,
  profile: Readonly<Cinema2HypnotizePatternProfile>,
  address: Readonly<Cinema2HypnotizeLedAddress>,
  signals: Readonly<Cinema2HypnotizeLedSignals>,
): number {
  const beatPhase = beats * profile.ledTempo
  const sectorCount = address.family === 'exterior' ? 16 : 12
  const angular = wrap01((address.sector + address.segment / Math.max(3, address.family === 'exterior' ? 12 : 4)) / sectorCount)
  const radial = address.family === 'exterior' ? 1 : clamp(address.layer / 8, 0, 1)
  const segmentPhase = address.segment / (address.family === 'exterior' ? 12 : 4)
  const musicalLift = signals.overallEnergy * 0.18 + signals.highsAmount * 0.12 + signals.fluxAmount * 0.1
  let choreography = 0

  if (pattern === 'mesmericOrbit') {
    const clockwise = circularPulse(wrap01(angular - beatPhase * 0.16), 0.12)
    const counter = circularPulse(wrap01(1 - angular - beatPhase * 0.09 + radial * 0.18), 0.2)
    choreography = Math.max(clockwise, counter * 0.62) + signals.snareAccent * (address.segment % 2 === 0 ? 0.32 : 0.12)
  } else if (pattern === 'blackIris') {
    const opposingBank = 0.5 + 0.5 * Math.cos((angular * 6 + Math.floor(beatPhase)) * Math.PI * 2)
    const shutter = Math.pow(0.5 + 0.5 * Math.cos((segmentPhase - beatPhase * 0.22) * Math.PI * 2), 5)
    choreography = opposingBank * (0.18 + shutter * 0.82) + signals.kickAccent * (1 - radial) * 0.52
  } else if (pattern === 'turbineBloom') {
    const bloomFront = circularPulse(wrap01(radial - beatPhase * 0.24 - segmentPhase * 0.08), 0.19)
    const petal = 0.55 + 0.45 * Math.cos((angular * 6 - beatPhase * 0.08) * Math.PI * 2)
    choreography = bloomFront * petal + signals.kickAccent * (0.3 + radial * 0.58)
  } else if (pattern === 'chromaticRelay') {
    const relayHead = wrap01(beatPhase * 0.28)
    const bankChase = circularPulse(wrap01(angular - relayHead), 0.075)
    const segmentStep = Math.floor(beats * 4) % (address.family === 'exterior' ? 12 : 3)
    const segmentRelay = address.segment % (address.family === 'exterior' ? 12 : 3) === segmentStep ? 1 : 0.08
    choreography = Math.max(bankChase, segmentRelay * (0.42 + bankChase * 0.58)) + signals.snareAccent * 0.38
  } else if (pattern === 'infiniteDraw') {
    const helix = wrap01(angular + radial * 0.47 + segmentPhase * 0.14)
    const drawHead = wrap01(beatPhase * 0.13)
    choreography = circularPulse(wrap01(helix - drawHead), 0.095) + circularPulse(wrap01(helix - drawHead + 0.18), 0.22) * 0.34
    choreography += signals.phraseAccent * (1 - Math.abs(radial - 0.5) * 1.4) * 0.48
  } else {
    const collapseCycle = triangle01(wrap01(beatPhase * 0.19))
    const collapseFront = circularPulse(wrap01(radial - collapseCycle), 0.14)
    const discharge = Math.max(signals.dropAccent, signals.downbeatAccent * 0.74)
    choreography = collapseFront * (0.72 + radial * 0.28) + discharge * (0.55 + radial * 0.65)
  }

  const transient = signals.kickAccent * 0.14 + signals.downbeatAccent * 0.18 + signals.dropAccent * 0.24
  return clamp(profile.ledBase + choreography * profile.ledContrast + musicalLift + transient, 0, 1.65)
}

const TRANSITION_BEATS = 0.85

/** Deterministic, reset-safe authored program selector and phase clock. */
export class Cinema2HypnotizePatternEngine {
  private active: Cinema2HypnotizePattern = 'mesmericOrbit'
  private previous: Cinema2HypnotizePattern = 'mesmericOrbit'
  private transitionStartBeat = 0
  private beats = 0
  private initialized = false
  private discontinuityGeneration = -1
  private lastTriggerEventId: string | null = null
  private triggerLatched = false
  private lastAuthored: Cinema2HypnotizePattern = 'mesmericOrbit'

  update(input: Readonly<Cinema2HypnotizePatternInput>): Readonly<Cinema2HypnotizePatternFrame> {
    const dt = clamp(input.deltaTimeSec, 0, 0.25)
    const reset = !this.initialized || input.discontinuityGeneration !== this.discontinuityGeneration
    if (reset) {
      this.initialized = true
      this.discontinuityGeneration = input.discontinuityGeneration
      this.beats = 0
      this.active = input.authoredPattern
      this.previous = input.authoredPattern
      this.transitionStartBeat = 0
      this.lastTriggerEventId = null
      this.triggerLatched = false
      this.lastAuthored = input.authoredPattern
    } else if (input.animationActive) {
      const beatsPerSecond = input.bpmSync ? clamp(input.bpm, 40, 240) / 60 : 2
      this.beats += dt * beatsPerSecond
    }

    const triggerRise = input.triggerPulse > 0.35 && !this.triggerLatched
    this.triggerLatched = input.triggerPulse > 0.12
    const eventChanged = input.triggerEventId != null && input.triggerEventId !== this.lastTriggerEventId
    if (input.triggerEventId != null) this.lastTriggerEventId = input.triggerEventId

    let requested = input.authoredPattern
    if (input.patternChange) {
      if (eventChanged || triggerRise) requested = nextPattern(this.active)
      else requested = this.active
    } else if (input.autoPerformance) {
      requested = selectAutomaticPattern(input)
    } else if (input.authoredPattern !== this.lastAuthored) {
      requested = input.authoredPattern
    }
    this.lastAuthored = input.authoredPattern

    if (requested !== this.active) {
      this.previous = this.active
      this.active = requested
      this.transitionStartBeat = this.beats
    }

    const transition = smoothstep(clamp((this.beats - this.transitionStartBeat) / TRANSITION_BEATS, 0, 1))
    const blended = blendProfile(CINEMA2_HYPNOTIZE_PATTERN_PROFILES[this.previous], CINEMA2_HYPNOTIZE_PATTERN_PROFILES[this.active], transition)
    if (transition >= 1) this.previous = this.active
    return Object.freeze({
      pattern: this.active,
      previousPattern: this.previous,
      transition,
      beats: this.beats,
      profile: blended,
    })
  }

  reset(): void {
    this.initialized = false
    this.discontinuityGeneration = -1
    this.lastTriggerEventId = null
    this.triggerLatched = false
  }
}

export function resolveCinema2HypnotizeTriggerEventId(
  audio: Readonly<Cinema2AudioIntelligenceFrame> | null,
  trigger: string,
): string | null {
  if (!audio) return null
  const beatIndex = audio.rhythm.beatIndex.available ? Math.floor(audio.rhythm.beatIndex.value ?? -1) : -1
  if (trigger === 'beat') return audio.rhythm.beat?.id ?? null
  if (trigger === 'kick') return audio.rhythm.kick?.id ?? null
  if (trigger === 'snare') return audio.rhythm.snare?.id ?? null
  if (trigger === 'downbeat' || trigger === 'bar') return audio.rhythm.downbeat?.id ?? null
  if (trigger === 'beat2') return beatIndex >= 0 && beatIndex % 2 === 0 ? audio.rhythm.beat?.id ?? null : null
  if (trigger === 'beat4') return audio.rhythm.fixedClocks[4].boundary?.id ?? null
  if (trigger === 'bar4') return audio.rhythm.fixedClocks[16].boundary?.id ?? null
  if (trigger === 'bar8') return audio.rhythm.fixedClocks[32].boundary?.id ?? null
  return null
}

function selectAutomaticPattern(input: Readonly<Cinema2HypnotizePatternInput>): Cinema2HypnotizePattern {
  if (input.dropAccent > 0.08 || input.buildAmount > 0.72) return 'radiantCollapse'
  if (input.vocalPresence > 0.58) return 'blackIris'
  if (input.directorIntensity > 0.76 || input.overallEnergy > 0.82) return 'turbineBloom'
  if (input.directorMomentum > 0.58 || input.overallEnergy > 0.6) return 'chromaticRelay'
  if (input.directorIntensity < 0.25 && input.overallEnergy < 0.3) return 'infiniteDraw'
  return 'mesmericOrbit'
}

function nextPattern(patternId: Cinema2HypnotizePattern): Cinema2HypnotizePattern {
  const index = CINEMA2_HYPNOTIZE_PATTERNS.indexOf(patternId)
  return CINEMA2_HYPNOTIZE_PATTERNS[(Math.max(0, index) + 1) % CINEMA2_HYPNOTIZE_PATTERNS.length]!
}

function profile(
  turbineRate: number,
  conductorRate: number,
  membraneRate: number,
  collarRate: number,
  vaneWave: number,
  coreBias: number,
  depthWave: number,
  haloGain: number,
  exteriorGain: number,
  warmBias: number,
  roll: number,
  ledBase: number,
  ledContrast: number,
  ledTempo: number,
  ledBloom: number,
): Readonly<Cinema2HypnotizePatternProfile> {
  return Object.freeze({ turbineRate, conductorRate, membraneRate, collarRate, vaneWave, coreBias, depthWave, haloGain, exteriorGain, warmBias, roll, ledBase, ledContrast, ledTempo, ledBloom })
}

function blendProfile(
  from: Readonly<Cinema2HypnotizePatternProfile>,
  to: Readonly<Cinema2HypnotizePatternProfile>,
  amount: number,
): Readonly<Cinema2HypnotizePatternProfile> {
  const mix = (a: number, b: number) => a + (b - a) * amount
  return Object.freeze({
    turbineRate: mix(from.turbineRate, to.turbineRate),
    conductorRate: mix(from.conductorRate, to.conductorRate),
    membraneRate: mix(from.membraneRate, to.membraneRate),
    collarRate: mix(from.collarRate, to.collarRate),
    vaneWave: mix(from.vaneWave, to.vaneWave),
    coreBias: mix(from.coreBias, to.coreBias),
    depthWave: mix(from.depthWave, to.depthWave),
    haloGain: mix(from.haloGain, to.haloGain),
    exteriorGain: mix(from.exteriorGain, to.exteriorGain),
    warmBias: mix(from.warmBias, to.warmBias),
    roll: mix(from.roll, to.roll),
    ledBase: mix(from.ledBase, to.ledBase),
    ledContrast: mix(from.ledContrast, to.ledContrast),
    ledTempo: mix(from.ledTempo, to.ledTempo),
    ledBloom: mix(from.ledBloom, to.ledBloom),
  })
}

function circularPulse(value: number, width: number): number {
  const distance = Math.min(value, 1 - value)
  const normalized = clamp(1 - distance / Math.max(0.001, width), 0, 1)
  return normalized * normalized * (3 - 2 * normalized)
}

function triangle01(value: number): number { return 1 - Math.abs(value * 2 - 1) }
function wrap01(value: number): number { return ((value % 1) + 1) % 1 }

function smoothstep(value: number): number { return value * value * (3 - 2 * value) }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)) }
