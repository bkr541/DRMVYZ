import {
  CINEMA2_AFTERHOURS_MAX_BEAMS,
  CINEMA2_AFTERHOURS_MIN_BEAMS,
  CINEMA2_AFTERHOURS_RANDOM_MODULE_ID,
  CINEMA2_AFTERHOURS_TOPOLOGY_IDS,
  type Cinema2AfterhoursRandomSource,
  type Cinema2AfterhoursTopologyId,
} from './Cinema2AfterhoursDomain'

export const CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS = Object.freeze([
  'off', 'bar', 'bar4', 'bar8', 'phrase', 'drop',
] as const)

export type Cinema2AfterhoursPatternChangeId = typeof CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS[number]
export type Cinema2AfterhoursTransitionIntent = 'smooth' | 'hardCut'

export interface Cinema2AfterhoursShowPlannerSettings {
  readonly pattern: Cinema2AfterhoursTopologyId
  readonly autoPerformance: boolean
  readonly beamCount: number
  readonly symmetry: boolean
  readonly sideLasers: boolean
  readonly topLasers: boolean
  readonly patternChange: Cinema2AfterhoursPatternChangeId
  /**
   * Runtime-owned cadence step used only when Pattern Change is active while
   * Auto Performance is off. The native module advances this only on a real
   * canonical boundary, so a direct Pattern edit remains visible immediately
   * and is not replaced until the next requested musical boundary.
   */
  readonly patternStep?: number
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
  readonly topologyId: Cinema2AfterhoursTopologyId
  readonly variationKey: string
  readonly cadenceIdentity: string
  readonly beamCount: number
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

const TOPOLOGY_COUNT = CINEMA2_AFTERHOURS_TOPOLOGY_IDS.length
const DENSE_PEAK_TOPOLOGIES = Object.freeze([
  'fullRig', 'radialCrown', 'crossCanopy',
] as const satisfies readonly Cinema2AfterhoursTopologyId[])

function clamp01(value: number | null | undefined): number {
  return Math.min(1, Math.max(0, typeof value === 'number' && Number.isFinite(value) ? value : 0))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clampBeamCount(value: number): number {
  const rounded = Math.round(Number.isFinite(value) ? value : CINEMA2_AFTERHOURS_MIN_BEAMS)
  return Math.max(CINEMA2_AFTERHOURS_MIN_BEAMS, Math.min(CINEMA2_AFTERHOURS_MAX_BEAMS, rounded))
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
export function planCinema2AfterhoursShow(
  settings: Readonly<Cinema2AfterhoursShowPlannerSettings>,
  structure: Readonly<Cinema2AfterhoursShowPlannerStructure>,
  random: Cinema2AfterhoursRandomSource,
): Readonly<Cinema2AfterhoursShowPlan> {
  const authoredBeamCount = clampBeamCount(settings.beamCount)
  const cadenceIdentity = resolveCinema2AfterhoursCadenceIdentity(settings.patternChange, structure)
  // Music performance intent is intentionally independent of Auto Performance.
  // Manual mode defines WHAT the laser show is; shared Audio Intelligence and
  // Choreography still describe HOW that authored show performs to the music.
  const performance = normalizedPerformance(structure.performance)
  const peak = Math.max(performance.impact, performance.dropAccent)
  const dropStructure = performance.dropAccent
  const sectionStructure = performance.sectionAccent * 0.82
  const phraseStructure = performance.phraseAccent * 0.58
  const structuralAccent = Math.max(dropStructure, sectionStructure, phraseStructure)

  let topologyId = settings.pattern
  if (settings.autoPerformance) {
    const peakIdentity = structure.dropIdentity
      ? `${safeIdentity(structure.sourceIdentity, 'source:unknown')}:drop:${structure.dropIdentity}`
      : cadenceIdentity
    if (peak >= 0.72 && performance.dropAccent >= 0.35) {
      const contrast = sample(random, peakIdentity, 'peak-contrast')
      if (contrast < 0.24) topologyId = 'sparseArchitecture'
      else {
        const denseIndex = Math.min(
          DENSE_PEAK_TOPOLOGIES.length - 1,
          Math.floor(sample(random, peakIdentity, 'peak-dense-family') * DENSE_PEAK_TOPOLOGIES.length),
        )
        topologyId = DENSE_PEAK_TOPOLOGIES[denseIndex]!
      }
    } else {
      const topologyIndex = Math.min(
        TOPOLOGY_COUNT - 1,
        Math.floor(sample(random, cadenceIdentity, 'topology-family') * TOPOLOGY_COUNT),
      )
      topologyId = CINEMA2_AFTERHOURS_TOPOLOGY_IDS[topologyIndex]!
    }
  } else if (settings.patternChange !== 'off') {
    topologyId = rotateTopology(settings.pattern, settings.patternStep ?? 0)
  }

  // Fixture-bank enables are hard user authority. Auto Performance may decide
  // how an enabled bank performs, but it may never resurrect a bank the user
  // explicitly turned off.
  const sideRecruitment = settings.sideLasers
  const topRecruitment = settings.topLasers

  // Beam Count is the authored ceiling/base. Music may temporarily reduce
  // density for vocals/build tension, but a quiet/manual state renders the
  // literal authored count instead of applying hidden random thinning.
  const randomDensity = settings.autoPerformance
    ? 0.76 + sample(random, cadenceIdentity, 'beam-density') * 0.24
    : 1
  const vocalDensity = 1 - performance.vocalPresence * 0.46
  const buildDensity = 1 - performance.build * 0.1
  const peakDensity = peak >= 0.72 && topologyId !== 'sparseArchitecture'
    ? Math.max(randomDensity, 0.96)
    : randomDensity
  const beamCount = Math.max(
    CINEMA2_AFTERHOURS_MIN_BEAMS,
    Math.min(authoredBeamCount, Math.round(authoredBeamCount * peakDensity * vocalDensity * buildDensity)),
  )

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
    topologyId,
    variationKey: `${settings.autoPerformance ? 'auto' : 'manual'}:${topologyId}:${cadenceIdentity}:step-${Math.max(0, Math.floor(settings.patternStep ?? 0))}`,
    cadenceIdentity,
    beamCount,
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

function rotateTopology(base: Cinema2AfterhoursTopologyId, rawStep: number): Cinema2AfterhoursTopologyId {
  const start = Math.max(0, CINEMA2_AFTERHOURS_TOPOLOGY_IDS.indexOf(base))
  const step = Math.max(0, Math.floor(Number.isFinite(rawStep) ? rawStep : 0))
  return CINEMA2_AFTERHOURS_TOPOLOGY_IDS[(start + step) % TOPOLOGY_COUNT]!
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
