import {
  CINEMA2_AFTERHOURS_MAX_LASERS,
  CINEMA2_AFTERHOURS_MIN_LASERS,
  CINEMA2_AFTERHOURS_RANDOM_MODULE_ID,
  type Cinema2AfterhoursRandomSource,
} from './Cinema2AfterhoursDomain'
import type { Cinema2AfterhoursPatternEnergy } from './Cinema2AfterhoursPatternEngine'
import { CINEMA2_AFTERHOURS_PATTERNS, CINEMA2_AFTERHOURS_PATTERN_IDS, getCinema2AfterhoursPattern } from './Cinema2AfterhoursPatternLibrary'

export const CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS = Object.freeze([
  'off', 'bar', 'bar4', 'bar8', 'phrase', 'drop',
] as const)

export type Cinema2AfterhoursPatternChangeId = typeof CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS[number]
export type Cinema2AfterhoursTransitionIntent = 'smooth' | 'hardCut'

export interface Cinema2AfterhoursShowPlannerSettings {
  /** The authored Pattern. */
  readonly pattern: string
  readonly autoPerformance: boolean
  /** Laser Count: most lasers lit at once. */
  readonly laserLimit: number
  readonly symmetry: boolean
  readonly sideLasers: boolean
  readonly topLasers: boolean
  readonly patternChange: Cinema2AfterhoursPatternChangeId
  /**
   * Runtime-owned pattern used while Pattern Change is active and Auto Performance is off. The native module picks a new random pattern
   * only on a real canonical boundary (see pickCinema2AfterhoursNextPattern), so a direct Pattern edit is visible at once and holds until the
   * next requested musical boundary.
   */
  readonly activePattern?: string
}

/**
 * Already-resolved Cinema 2.0 significance/choreography inputs. These are not
 * raw audio features and the Show Planner never analyzes audio independently.
 */
export interface Cinema2AfterhoursPerformanceIntent {
  readonly intensity?: number
  readonly build?: number
  readonly impact?: number
  readonly vocalPresence?: number
  readonly kickAccent?: number
  readonly snareAccent?: number
  readonly downbeatAccent?: number
  readonly phraseAccent?: number
  readonly sectionAccent?: number
  readonly dropAccent?: number
}

/**
 * Canonical structural facts supplied by Cinema 2.0. The optional performance
 * block is populated from Target Runtime / Choreography-resolved signals.
 */
export interface Cinema2AfterhoursShowPlannerStructure {
  readonly sourceIdentity: string
  readonly absoluteBarIndex: number | null
  readonly phraseIdentity: string | null
  readonly sectionIdentity?: string | null
  readonly dropIdentity: string | null
  /** Caller-resolved high-significance structural cut authority. */
  readonly hardCutIntent: boolean
  readonly performance?: Readonly<Cinema2AfterhoursPerformanceIntent>
}

export interface Cinema2AfterhoursShowPlan {
  readonly patternId: string
  readonly cadenceIdentity: string
  readonly laserLimit: number
  readonly symmetry: boolean
  readonly sideLasers: boolean
  readonly topLasers: boolean
  readonly transitionIntent: Cinema2AfterhoursTransitionIntent
  /** Runtime spatial multiplier applied without rebuilding topology every frame. */
  readonly spreadScale: number
  /** Runtime scanner authority multiplier. */
  readonly motionScale: number
  readonly bottomIntensity: number
  readonly sideIntensity: number
  readonly topIntensity: number
  /** Normalized structural blackout intent. User Blackout Amount remains the ceiling. */
  readonly blackout: number
}

const PATTERNS_BY_ENERGY: Readonly<Record<Cinema2AfterhoursPatternEnergy, readonly string[]>> = Object.freeze({
  low: Object.freeze(CINEMA2_AFTERHOURS_PATTERNS.filter(candidate => candidate.energy === 'low').map(candidate => candidate.id)),
  mid: Object.freeze(CINEMA2_AFTERHOURS_PATTERNS.filter(candidate => candidate.energy === 'mid').map(candidate => candidate.id)),
  high: Object.freeze(CINEMA2_AFTERHOURS_PATTERNS.filter(candidate => candidate.energy === 'high').map(candidate => candidate.id)),
  build: Object.freeze(CINEMA2_AFTERHOURS_PATTERNS.filter(candidate => candidate.energy === 'build').map(candidate => candidate.id)),
})

function clamp01(value: number | null | undefined): number {
  return Math.min(1, Math.max(0, typeof value === 'number' && Number.isFinite(value) ? value : 0))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clampLaserLimit(value: number): number {
  const rounded = Math.round(Number.isFinite(value) ? value : CINEMA2_AFTERHOURS_MAX_LASERS)
  return Math.max(CINEMA2_AFTERHOURS_MIN_LASERS, Math.min(CINEMA2_AFTERHOURS_MAX_LASERS, rounded))
}

function safeIdentity(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

/**
 * Turns canonical musical position into a stable decision identity. bar4/bar8
 * are explicitly derived from absolute bars, never Cinema 2.0's beat clocks.
 */
export function resolveCinema2AfterhoursCadenceIdentity(
  cadence: Cinema2AfterhoursPatternChangeId,
  structure: Readonly<Cinema2AfterhoursShowPlannerStructure>,
): string {
  const source = safeIdentity(structure.sourceIdentity, 'source:unknown')
  switch (cadence) {
    case 'bar': {
      const bar = finiteBar(structure.absoluteBarIndex)
      return bar == null ? `${source}:bar:unavailable` : `${source}:bar:${bar}`
    }
    case 'bar4': {
      const bar = finiteBar(structure.absoluteBarIndex)
      return bar == null ? `${source}:bar4:unavailable` : `${source}:bar4:${Math.floor(bar / 4) * 4}`
    }
    case 'bar8': {
      const bar = finiteBar(structure.absoluteBarIndex)
      return bar == null ? `${source}:bar8:unavailable` : `${source}:bar8:${Math.floor(bar / 8) * 8}`
    }
    case 'phrase':
      return `${source}:phrase:${safeIdentity(structure.phraseIdentity, 'unavailable')}`
    case 'drop':
      return `${source}:drop:${safeIdentity(structure.dropIdentity, 'unavailable')}`
    case 'off':
    default:
      return `${source}:off`
  }
}

/**
 * Stateless, event-keyed Show Planner. Its decisions are reconstructable from
 * authored settings, canonical structure, resolved significance, and the
 * engine-owned random service; frame order never advances a private stream.
 */
/**
 * The next pattern when Pattern Change reaches a boundary: a random pattern from the library (or the given pool) that is never the current
 * one. Deterministic for a given boundary identity, so replaying a track picks the same sequence.
 */
export function pickCinema2AfterhoursNextPattern(
  current: string,
  boundaryIdentity: string,
  random: Cinema2AfterhoursRandomSource,
  pool: readonly string[] = CINEMA2_AFTERHOURS_PATTERN_IDS,
): string {
  const candidates = pool.filter(id => id !== current)
  if (candidates.length === 0) return pool[0] ?? current
  const index = Math.min(candidates.length - 1, Math.floor(sample(random, boundaryIdentity, 'pattern-change') * candidates.length))
  return candidates[index]!
}

/**
 * Stateless, event-keyed Show Planner. Its decisions are reconstructable from authored settings, canonical structure, resolved significance,
 * and the engine-owned random service; frame order never advances a private stream.
 */
export function planCinema2AfterhoursShow(
  settings: Readonly<Cinema2AfterhoursShowPlannerSettings>,
  structure: Readonly<Cinema2AfterhoursShowPlannerStructure>,
  random: Cinema2AfterhoursRandomSource,
): Readonly<Cinema2AfterhoursShowPlan> {
  const authoredLimit = clampLaserLimit(settings.laserLimit)
  const cadenceIdentity = resolveCinema2AfterhoursCadenceIdentity(settings.patternChange, structure)
  // Music performance intent is intentionally independent of Auto Performance. Manual mode defines WHAT the laser show is; shared Audio
  // Intelligence and Choreography still describe HOW that authored show performs to the music.
  const performance = normalizedPerformance(structure.performance)
  const peak = Math.max(performance.impact, performance.dropAccent)
  const dropStructure = performance.dropAccent
  const sectionStructure = performance.sectionAccent * 0.82
  const phraseStructure = performance.phraseAccent * 0.58
  const structuralAccent = Math.max(dropStructure, sectionStructure, phraseStructure)

  let patternId = getCinema2AfterhoursPattern(settings.pattern).id
  if (settings.autoPerformance) {
    // Auto Performance picks a pattern whose energy suits the music: high-energy looks on drops, risers in builds, sparse looks under
    // vocals and quiet passages, and the everyday mid-energy looks otherwise.
    const peakIdentity = structure.dropIdentity
      ? `${safeIdentity(structure.sourceIdentity, 'source:unknown')}:drop:${structure.dropIdentity}`
      : cadenceIdentity
    const energy: Cinema2AfterhoursPatternEnergy = peak >= 0.72 && performance.dropAccent >= 0.35
      ? 'high'
      : performance.build >= 0.55
        ? 'build'
        : performance.vocalPresence >= 0.6 || (performance.intensity > 0 && performance.intensity < 0.3)
          ? 'low'
          : sample(random, cadenceIdentity, 'auto-energy') < 0.3 ? 'high' : 'mid'
    const pool = PATTERNS_BY_ENERGY[energy]
    const identity = energy === 'high' ? peakIdentity : cadenceIdentity
    patternId = pool[Math.min(pool.length - 1, Math.floor(sample(random, identity, `auto-pattern:${energy}`) * pool.length))] ?? patternId
  } else if (settings.patternChange !== 'off' && settings.activePattern) {
    patternId = getCinema2AfterhoursPattern(settings.activePattern).id
  }

  // Fixture-bank enables are hard user authority. Auto Performance may decide how an enabled bank performs, but it may never resurrect a
  // bank the user explicitly turned off.
  const sideRecruitment = settings.sideLasers
  const topRecruitment = settings.topLasers

  // Laser Count is the authored ceiling. Vocals thin the rig out to leave space; a quiet/manual state renders the literal authored count.
  const vocalDensity = 1 - performance.vocalPresence * 0.4
  const laserLimit = Math.max(CINEMA2_AFTERHOURS_MIN_LASERS, Math.min(authoredLimit, Math.round(authoredLimit * vocalDensity)))

  const spreadScale = clamp(1 - performance.build * 0.36 + peak * 0.2, 0.56, 1.08)
  const motionScale = clamp(
    1 + performance.intensity * 0.22 + performance.build * 0.18 + peak * 0.24 - performance.vocalPresence * 0.42,
    0.35,
    1.35,
  )

  const blackoutKind = dropStructure >= sectionStructure && dropStructure >= phraseStructure
    ? 'drop' as const
    : sectionStructure >= phraseStructure
      ? 'section' as const
      : 'phrase' as const
  const blackoutIdentity = blackoutKind === 'drop'
    ? structure.dropIdentity ?? cadenceIdentity
    : blackoutKind === 'section'
      ? structure.sectionIdentity ?? cadenceIdentity
      : structure.phraseIdentity ?? cadenceIdentity
  const blackoutGateThreshold = blackoutKind === 'drop' ? 0.76 : blackoutKind === 'section' ? 0.84 : 0.9
  const blackoutGate = structuralAccent >= 0.42
    && sample(random, `blackout:${blackoutKind}:${blackoutIdentity}`, 'structural-blackout') >= blackoutGateThreshold
  const blackout = blackoutGate ? clamp01(structuralAccent * (0.52 + peak * 0.34)) : 0

  return Object.freeze({
    patternId,
    cadenceIdentity,
    laserLimit,
    symmetry: settings.symmetry,
    sideLasers: sideRecruitment,
    topLasers: topRecruitment,
    transitionIntent: settings.autoPerformance && structure.hardCutIntent ? 'hardCut' as const : 'smooth' as const,
    spreadScale,
    motionScale,
    bottomIntensity: clamp(1 + performance.kickAccent * 0.38 + performance.downbeatAccent * 0.14, 0.35, 1.5),
    sideIntensity: clamp(1 + performance.snareAccent * 0.34 + performance.downbeatAccent * 0.16, 0.35, 1.5),
    topIntensity: clamp(1 + performance.snareAccent * 0.3 + performance.downbeatAccent * 0.2, 0.35, 1.5),
    blackout,
  })
}

function normalizedPerformance(
  intent: Readonly<Cinema2AfterhoursPerformanceIntent> | undefined,
): Required<Cinema2AfterhoursPerformanceIntent> {
  return Object.freeze({
    intensity: clamp01(intent?.intensity),
    build: clamp01(intent?.build),
    impact: clamp01(intent?.impact),
    vocalPresence: clamp01(intent?.vocalPresence),
    kickAccent: clamp01(intent?.kickAccent),
    snareAccent: clamp01(intent?.snareAccent),
    downbeatAccent: clamp01(intent?.downbeatAccent),
    phraseAccent: clamp01(intent?.phraseAccent),
    sectionAccent: clamp01(intent?.sectionAccent),
    dropAccent: clamp01(intent?.dropAccent),
  })
}

function finiteBar(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null
}

function sample(
  random: Cinema2AfterhoursRandomSource,
  eventId: string,
  purpose: string,
): number {
  return random.sample({
    moduleId: CINEMA2_AFTERHOURS_RANDOM_MODULE_ID,
    eventId: `show-planner:${eventId}`,
    purpose,
  })
}
