export const CINEMA2_ATL_HOE_PATTERN_IDS = Object.freeze([
  'city-pulse',
  'waffle-marquee',
  'interstate-flow',
  'skyline-rise',
  'neon-brownout',
  'storm-takeover',
] as const)
export type Cinema2AtlHoePatternId = typeof CINEMA2_ATL_HOE_PATTERN_IDS[number]
export const CINEMA2_ATL_HOE_DEFAULT_PATTERN: Cinema2AtlHoePatternId = 'city-pulse'

export const CINEMA2_ATL_HOE_PATTERN_LABELS: Readonly<Record<Cinema2AtlHoePatternId, string>> = Object.freeze({
  'city-pulse': 'City Pulse',
  'waffle-marquee': 'Waffle Marquee',
  'interstate-flow': 'Interstate Flow',
  'skyline-rise': 'Skyline Rise',
  'neon-brownout': 'Neon Brownout',
  'storm-takeover': 'Storm Takeover',
})

export type Cinema2AtlHoePerformanceStage = 'rest' | 'active' | 'buildup' | 'drop' | 'recovery'
export type Cinema2AtlHoeRoleGains = readonly [number, number, number, number, number, number, number, number, number, number]
export type Cinema2AtlHoeZoneWeights = readonly [number, number, number, number, number, number, number]
export type Cinema2AtlHoePacked4 = readonly [number, number, number, number]

export interface Cinema2AtlHoePatternSignals {
  readonly energy: number
  readonly sub: number
  readonly bass: number
  readonly mid: number
  readonly high: number
  readonly flux: number
  readonly kick: number
  readonly snare: number
  readonly transient: number
  readonly downbeat: number
  readonly phrase: number
  readonly build: number
  readonly drop: number
}

export interface Cinema2AtlHoePatternTransitionInput {
  readonly outgoingPattern: Cinema2AtlHoePatternId
  readonly progress: number
}

export interface Cinema2AtlHoePatternInput {
  readonly pattern: Cinema2AtlHoePatternId
  readonly beats: number
  readonly stage: Cinema2AtlHoePerformanceStage
  readonly signals: Readonly<Cinema2AtlHoePatternSignals>
  readonly transition?: Readonly<Cinema2AtlHoePatternTransitionInput> | null
}

export interface Cinema2AtlHoePatternFrame {
  readonly pattern: Cinema2AtlHoePatternId
  readonly stage: Cinema2AtlHoePerformanceStage
  readonly beats: number
  readonly routeFronts: Cinema2AtlHoePacked4
  readonly routeWidths: Cinema2AtlHoePacked4
  /** sign, windows, crown, spire, streetlight, road, star, lightning, foliage accent, atmosphere. */
  readonly roleGains: Cinema2AtlHoeRoleGains
  /** far-left through far-right. */
  readonly zoneWeights: Cinema2AtlHoeZoneWeights
  readonly buildingLevel: number
  readonly signCellSelection: number
  readonly outageMasks: Cinema2AtlHoePacked4
  readonly recoveryMasks: Cinema2AtlHoePacked4
  readonly skyGain: number
  readonly lightningGain: number
  readonly atmosphereGain: number
  readonly practicalLightGain: number
  readonly transition: Readonly<{
    outgoingPattern: Cinema2AtlHoePatternId | null
    incomingPattern: Cinema2AtlHoePatternId
    outgoingWeight: number
    incomingWeight: number
  }>
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const fract = (value: number) => value - Math.floor(value)
const pulse = (phase: number) => 1 - Math.abs(fract(phase) * 2 - 1)
const hash = (value: number) => fract(Math.sin(value * 91.917 + 17.131) * 43758.5453)
const freeze4 = (values: readonly number[]): Cinema2AtlHoePacked4 => Object.freeze(values.map(clamp01).slice(0, 4) as unknown as Cinema2AtlHoePacked4)
const freeze7 = (values: readonly number[]): Cinema2AtlHoeZoneWeights => Object.freeze(values.map(clamp01).slice(0, 7) as unknown as Cinema2AtlHoeZoneWeights)
const freeze10 = (values: readonly number[]): Cinema2AtlHoeRoleGains => Object.freeze(values.map(clamp01).slice(0, 10) as unknown as Cinema2AtlHoeRoleGains)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mixTuple = <T extends readonly number[]>(a: T, b: T, t: number): T => Object.freeze(a.map((value, index) => mix(value, b[index] ?? value, t))) as T

interface ProgramState {
  routeFronts: Cinema2AtlHoePacked4
  routeWidths: Cinema2AtlHoePacked4
  roleGains: Cinema2AtlHoeRoleGains
  zoneWeights: Cinema2AtlHoeZoneWeights
  buildingLevel: number
  signCellSelection: number
  outageMasks: Cinema2AtlHoePacked4
  recoveryMasks: Cinema2AtlHoePacked4
  skyGain: number
  lightningGain: number
  atmosphereGain: number
  practicalLightGain: number
}

function programState(pattern: Cinema2AtlHoePatternId, beats: number, stage: Cinema2AtlHoePerformanceStage, s: Readonly<Cinema2AtlHoePatternSignals>): ProgramState {
  const active = stage === 'rest' ? 0 : stage === 'active' ? 0.45 : stage === 'buildup' ? 0.55 + 0.45 * s.build : stage === 'drop' ? 1 : 0.28 + 0.38 * s.drop
  const phase = fract(beats / 8)
  const routeFronts = freeze4([fract(phase + 0.00), fract(phase + 0.25), fract(phase + 0.50), fract(phase + 0.75)])
  let routeWidths = freeze4([0.10, 0.10, 0.10, 0.10])
  let roleGains: Cinema2AtlHoeRoleGains
  let zoneWeights: Cinema2AtlHoeZoneWeights
  let buildingLevel = 0
  let signCellSelection = -1
  let outageMasks = freeze4([0, 0, 0, 0])
  let recoveryMasks = freeze4([1, 1, 1, 1])
  let skyGain = 0.25
  let lightningGain = 0
  let atmosphereGain = 0.25
  let practicalLightGain = 0.5

  if (pattern === 'waffle-marquee') {
    const cell = fract(beats / 5.5)
    signCellSelection = cell
    roleGains = freeze10([
      0.48 + 0.5 * active + 0.35 * s.kick, 0.2 + 0.38 * s.mid + 0.28 * s.phrase,
      0.18 + 0.5 * s.downbeat, 0.12 + 0.38 * s.high, 0.3 + 0.62 * pulse(beats / 4),
      0.2 + 0.35 * phase, 0.12 + 0.24 * s.high, 0.02, 0.08 + 0.18 * s.transient, 0.18,
    ])
    zoneWeights = freeze7([0.12, 0.34, 0.78, 1, 0.72, 0.3, 0.1])
    routeWidths = freeze4([0.065, 0.09, 0.065, 0.09])
    practicalLightGain = 0.65 + 0.3 * active
  } else if (pattern === 'interstate-flow') {
    roleGains = freeze10([
      0.16 + 0.24 * s.kick, 0.28 + 0.5 * Math.max(s.mid, active * phase), 0.28 + 0.5 * s.downbeat,
      0.2 + 0.42 * s.build, 0.55 + 0.44 * active + 0.24 * s.kick, 0.62 + 0.38 * active + 0.3 * s.bass,
      0.08 + 0.18 * s.high, 0.02, 0.1 + 0.18 * s.transient, 0.16,
    ])
    zoneWeights = freeze7([1, 0.72, 0.42, 0.18, 0.35, 0.68, 0.96])
    routeWidths = freeze4([0.055, 0.07, 0.055, 0.07])
    buildingLevel = clamp01(phase * 1.28 - 0.18)
    practicalLightGain = 0.82 + 0.18 * active
  } else if (pattern === 'skyline-rise') {
    buildingLevel = fract(beats / 4)
    roleGains = freeze10([
      0.14 + 0.32 * s.phrase, 0.48 + 0.5 * active + 0.3 * s.mid, 0.45 + 0.5 * Math.max(s.high, s.downbeat),
      0.4 + 0.56 * Math.max(s.build, s.downbeat), 0.18 + 0.24 * s.kick, 0.16 + 0.2 * s.bass,
      0.2 + 0.3 * s.high, 0.02, 0.12 + 0.2 * s.transient, 0.22 + 0.18 * s.build,
    ])
    zoneWeights = freeze7([0.18, 0.5, 0.88, 0.3, 1, 0.55, 0.2])
    routeWidths = freeze4([0.12, 0.08, 0.12, 0.08])
    skyGain = 0.32 + 0.25 * s.high
    practicalLightGain = 0.38
  } else if (pattern === 'neon-brownout') {
    const step = Math.floor(beats * 2)
    outageMasks = freeze4([hash(step + 11), hash(step + 29), hash(step + 47), hash(step + 71)])
    const recovery = stage === 'recovery' ? 0.35 + 0.65 * (1 - s.drop) : 0.12 + 0.3 * (1 - active)
    recoveryMasks = freeze4([recovery, recovery * 0.72, recovery * 0.48, recovery * 0.86])
    roleGains = freeze10([
      0.5 + 0.32 * s.kick, 0.38 + 0.34 * s.mid, 0.34 + 0.3 * s.downbeat, 0.22 + 0.28 * s.high,
      0.36 + 0.32 * s.kick, 0.28 + 0.25 * s.bass, 0.08, 0.02, 0.12 + 0.3 * s.transient, 0.16,
    ])
    zoneWeights = freeze7([0.65, 0.12, 0.78, 0.28, 0.9, 0.16, 0.58])
    routeWidths = freeze4([0.16, 0.11, 0.18, 0.1])
    practicalLightGain = 0.42
  } else if (pattern === 'storm-takeover') {
    const strike = clamp01(Math.max(s.transient * 0.65, s.downbeat * 0.5, s.drop))
    roleGains = freeze10([
      0.18 + 0.26 * s.kick, 0.2 + 0.38 * s.mid + 0.35 * strike, 0.28 + 0.5 * strike,
      0.22 + 0.56 * strike, 0.18 + 0.34 * s.kick, 0.2 + 0.34 * s.bass,
      0.05 + 0.18 * s.high, 0.18 + 0.82 * strike, 0.08 + 0.3 * strike, 0.58 + 0.35 * active,
    ])
    zoneWeights = freeze7([0.35, 0.9, 0.22, 0.5, 1, 0.18, 0.68])
    routeWidths = freeze4([0.045, 0.08, 0.045, 0.08])
    skyGain = 0.08 + 0.16 * (1 - active) + 0.58 * strike
    lightningGain = strike
    atmosphereGain = 0.62 + 0.35 * active
    practicalLightGain = 0.2 + 0.5 * strike
  } else {
    // City Pulse: low-frequency weight stays in the foreground while mids and highs articulate the skyline.
    roleGains = freeze10([
      0.42 + 0.4 * s.bass + 0.4 * s.kick, 0.3 + 0.46 * s.mid + 0.18 * active,
      0.28 + 0.46 * s.high + 0.36 * s.downbeat, 0.2 + 0.38 * s.build,
      0.32 + 0.48 * s.kick, 0.38 + 0.42 * s.sub, 0.12 + 0.3 * s.high,
      0.02 + 0.15 * s.drop, 0.1 + 0.22 * s.transient, 0.22 + 0.2 * s.energy,
    ])
    zoneWeights = freeze7([0.2, 0.58, 0.9, 0.36, 1, 0.52, 0.18])
    routeWidths = freeze4([0.14, 0.1, 0.14, 0.1])
    practicalLightGain = 0.58 + 0.28 * s.bass
  }

  if (stage === 'buildup') {
    buildingLevel = Math.max(buildingLevel, clamp01(s.build))
    atmosphereGain = clamp01(atmosphereGain + 0.22 * s.build)
  } else if (stage === 'drop') {
    // A staged lift: focal roles rise, but the per-program zone mask and dark roles remain intact.
    roleGains = freeze10(roleGains.map((value, index) => value + s.drop * (index === 0 || index === 2 || index === 5 || index === 7 ? 0.3 : 0.12)))
    practicalLightGain = clamp01(practicalLightGain + 0.28 * s.drop)
  }

  return { routeFronts, routeWidths, roleGains, zoneWeights, buildingLevel, signCellSelection,
    outageMasks, recoveryMasks, skyGain: clamp01(skyGain), lightningGain: clamp01(lightningGain),
    atmosphereGain: clamp01(atmosphereGain), practicalLightGain: clamp01(practicalLightGain) }
}

/** Pure deterministic planner. It never reads wall-clock time or randomness. */
export function evaluateCinema2AtlHoePattern(input: Readonly<Cinema2AtlHoePatternInput>): Readonly<Cinema2AtlHoePatternFrame> {
  const beats = Number.isFinite(input.beats) ? Math.max(0, input.beats) : 0
  const incoming = programState(input.pattern, beats, input.stage, input.signals)
  const progress = input.transition ? clamp01(input.transition.progress) : 1
  const outgoingPattern = input.transition && input.transition.outgoingPattern !== input.pattern ? input.transition.outgoingPattern : null
  const outgoing = outgoingPattern ? programState(outgoingPattern, beats, input.stage, input.signals) : incoming
  const blend = <T extends readonly number[]>(key: keyof Pick<ProgramState, 'routeFronts' | 'routeWidths' | 'roleGains' | 'zoneWeights' | 'outageMasks' | 'recoveryMasks'>) =>
    mixTuple(outgoing[key] as unknown as T, incoming[key] as unknown as T, progress)
  const scalar = (key: keyof Omit<ProgramState, 'routeFronts' | 'routeWidths' | 'roleGains' | 'zoneWeights' | 'outageMasks' | 'recoveryMasks'>) =>
    mix(outgoing[key] as number, incoming[key] as number, progress)
  return Object.freeze({
    pattern: input.pattern, stage: input.stage, beats,
    routeFronts: blend<Cinema2AtlHoePacked4>('routeFronts'),
    routeWidths: blend<Cinema2AtlHoePacked4>('routeWidths'),
    roleGains: blend<Cinema2AtlHoeRoleGains>('roleGains'),
    zoneWeights: blend<Cinema2AtlHoeZoneWeights>('zoneWeights'),
    buildingLevel: scalar('buildingLevel'), signCellSelection: scalar('signCellSelection'),
    outageMasks: blend<Cinema2AtlHoePacked4>('outageMasks'), recoveryMasks: blend<Cinema2AtlHoePacked4>('recoveryMasks'),
    skyGain: scalar('skyGain'), lightningGain: scalar('lightningGain'), atmosphereGain: scalar('atmosphereGain'),
    practicalLightGain: scalar('practicalLightGain'),
    transition: Object.freeze({ outgoingPattern, incomingPattern: input.pattern, outgoingWeight: 1 - progress, incomingWeight: progress }),
  })
}
