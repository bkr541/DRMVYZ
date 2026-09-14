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
}

/**
 * Canonical structural facts supplied by Cinema 2.0. This contract deliberately
 * contains no raw audio features and performs no analysis of its own. Stage 5
 * can enrich the explicit intent fields without changing Show Planner ownership.
 */
export interface Cinema2AfterhoursShowPlannerStructure {
  readonly sourceIdentity: string
  readonly absoluteBarIndex: number | null
  readonly phraseIdentity: string | null
  readonly dropIdentity: string | null
  /** Reserved for a caller that has already decided a high-significance cut is appropriate. */
  readonly hardCutIntent: boolean
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
}

const TOPOLOGY_COUNT = CINEMA2_AFTERHOURS_TOPOLOGY_IDS.length

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
 * authored settings, canonical structure, and the engine-owned random service;
 * frame order never advances a private random stream.
 */
export function planCinema2AfterhoursShow(
  settings: Readonly<Cinema2AfterhoursShowPlannerSettings>,
  structure: Readonly<Cinema2AfterhoursShowPlannerStructure>,
  random: Cinema2AfterhoursRandomSource,
): Readonly<Cinema2AfterhoursShowPlan> {
  const authoredBeamCount = clampBeamCount(settings.beamCount)
  const cadenceIdentity = resolveCinema2AfterhoursCadenceIdentity(settings.patternChange, structure)

  if (!settings.autoPerformance) {
    return Object.freeze({
      topologyId: settings.pattern,
      variationKey: `manual:${settings.pattern}:${cadenceIdentity}`,
      cadenceIdentity,
      beamCount: authoredBeamCount,
      symmetry: settings.symmetry,
      sideLasers: settings.sideLasers,
      topLasers: settings.topLasers,
      transitionIntent: 'smooth' as const,
    })
  }

  const topologyIndex = Math.min(
    TOPOLOGY_COUNT - 1,
    Math.floor(sample(random, cadenceIdentity, 'topology-family') * TOPOLOGY_COUNT),
  )
  const topologyId = CINEMA2_AFTERHOURS_TOPOLOGY_IDS[topologyIndex]!

  // Auto Performance may recruit installed banks, but authored toggles are only
  // read as starting authority and are never mutated. High-capacity topologies
  // receive broader bank authority; quieter/sparser topology can stay restrained.
  const sideRecruitment = settings.sideLasers
    || topologyId === 'splitWings'
    || topologyId === 'crossCanopy'
    || topologyId === 'fullRig'
    || sample(random, cadenceIdentity, 'recruit-side') >= 0.46
  const topRecruitment = settings.topLasers
    || topologyId === 'chevronRoof'
    || topologyId === 'radialCrown'
    || topologyId === 'fullRig'
    || sample(random, cadenceIdentity, 'recruit-top') >= 0.58

  // Density is a runtime-resolved choice below the user's Beam Count ceiling.
  // The sparse family keeps its renderer/domain cap; no planner value can raise
  // the authored simultaneous-beam maximum.
  const density = 0.62 + sample(random, cadenceIdentity, 'beam-density') * 0.38
  const beamCount = Math.max(
    CINEMA2_AFTERHOURS_MIN_BEAMS,
    Math.min(authoredBeamCount, Math.round(authoredBeamCount * density)),
  )

  return Object.freeze({
    topologyId,
    variationKey: `auto:${topologyId}:${cadenceIdentity}`,
    cadenceIdentity,
    beamCount,
    symmetry: settings.symmetry,
    sideLasers: sideRecruitment,
    topLasers: topRecruitment,
    transitionIntent: structure.hardCutIntent ? 'hardCut' as const : 'smooth' as const,
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
