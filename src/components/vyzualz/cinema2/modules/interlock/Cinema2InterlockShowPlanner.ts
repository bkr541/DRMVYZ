import {
  CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID,
  CINEMA2_INTERLOCK_HERO_PATTERN_ID,
  type Cinema2InterlockPatternId,
} from './Cinema2InterlockDomain'
import {
  CINEMA2_INTERLOCK_DEFAULT_SEGMENT_PROGRAM_ID,
  type Cinema2InterlockSegmentProgramId,
} from './Cinema2InterlockSegments'

export const CINEMA2_INTERLOCK_PATTERN_CHANGE_IDS = Object.freeze([
  'off', '8beats', '16beats', '32beats', 'phrase', 'section',
] as const)
export type Cinema2InterlockPatternChangeId = typeof CINEMA2_INTERLOCK_PATTERN_CHANGE_IDS[number]

export const CINEMA2_INTERLOCK_TRIGGER_IDS = Object.freeze([
  'auto', 'beat', 'kick', 'snare', 'downbeat', 'bar', 'phrase',
] as const)
export type Cinema2InterlockTriggerId = typeof CINEMA2_INTERLOCK_TRIGGER_IDS[number]

export type Cinema2InterlockDirectorPhase = 'low' | 'steady' | 'rising' | 'building' | 'peak' | 'release'

export interface Cinema2InterlockShowPlannerSettings {
  readonly pattern: Cinema2InterlockPatternId
  readonly segmentPattern: Cinema2InterlockSegmentProgramId
  readonly autoPerformance: boolean
  readonly patternChange: Cinema2InterlockPatternChangeId
}

export interface Cinema2InterlockPerformanceIntent {
  readonly intensity?: number
  readonly momentum?: number
  readonly build?: number
  readonly impact?: number
  readonly variation?: number
  readonly bass?: number
  readonly energy?: number
  readonly flux?: number
  readonly highAir?: number
  readonly vocalPresence?: number
  readonly kickAccent?: number
  readonly snareAccent?: number
  readonly downbeatAccent?: number
  readonly barAccent?: number
  readonly phraseAccent?: number
  readonly sectionAccent?: number
  readonly dropAccent?: number
}

export interface Cinema2InterlockShowPlannerStructure {
  readonly sourceIdentity: string
  readonly absoluteBeatIndex: number | null
  readonly phraseIdentity: string | null
  readonly sectionIdentity: string | null
  readonly dropIdentity: string | null
  readonly phase: Cinema2InterlockDirectorPhase
  readonly performance?: Readonly<Cinema2InterlockPerformanceIntent>
}

export interface Cinema2InterlockShowPlan {
  readonly layoutId: Cinema2InterlockPatternId
  readonly segmentProgram: Cinema2InterlockSegmentProgramId
  readonly segmentDirectionBias: number
  readonly bankStagger: number
  readonly densityScale: number
  readonly backgroundEnergy: number
  readonly trailIntent: number
  readonly transitionBeats: number
  readonly resetHistory: boolean
  readonly cadenceIdentity: string
  readonly variationKey: string
  readonly dropHeroShown: boolean
  readonly lastDropIdentity: string | null
}

export interface Cinema2InterlockRandomSource {
  sample(purpose: string, eventId: string, index?: number): number
}

const PHASE_LAYOUTS: Readonly<Record<Cinema2InterlockDirectorPhase, readonly Cinema2InterlockPatternId[]>> = Object.freeze({
  low: Object.freeze(['diamondTunnel'] as const),
  steady: Object.freeze(['diamondTunnel', 'doubleWing'] as const),
  rising: Object.freeze(['mechanicalIris', 'doubleWing'] as const),
  building: Object.freeze(['mechanicalIris', 'bassPortal'] as const),
  peak: Object.freeze(['fourWayVortex', 'bassPortal', 'mechanicalIris'] as const),
  release: Object.freeze(['doubleWing', 'diamondTunnel'] as const),
})

export function resolveCinema2InterlockCadenceIdentity(
  cadence: Cinema2InterlockPatternChangeId,
  structure: Readonly<Cinema2InterlockShowPlannerStructure>,
): string {
  const source = safeIdentity(structure.sourceIdentity, 'source:unknown')
  const beat = finiteIndex(structure.absoluteBeatIndex)
  switch (cadence) {
    case '8beats': return beat == null ? `${source}:8beats:unavailable` : `${source}:8beats:${Math.floor(beat / 8) * 8}`
    case '16beats': return beat == null ? `${source}:16beats:unavailable` : `${source}:16beats:${Math.floor(beat / 16) * 16}`
    case '32beats': return beat == null ? `${source}:32beats:unavailable` : `${source}:32beats:${Math.floor(beat / 32) * 32}`
    case 'phrase':
      return structure.phraseIdentity
        ? `${source}:phrase:${structure.phraseIdentity}`
        : beat == null ? `${source}:phrase:fallback:unavailable` : `${source}:phrase:fallback16:${Math.floor(beat / 16) * 16}`
    case 'section':
      return structure.sectionIdentity
        ? `${source}:section:${structure.sectionIdentity}`
        : beat == null ? `${source}:section:fallback:unavailable` : `${source}:section:fallback32:${Math.floor(beat / 32) * 32}`
    case 'off':
    default: return `${source}:off`
  }
}

export function planCinema2InterlockShow(
  settings: Readonly<Cinema2InterlockShowPlannerSettings>,
  structure: Readonly<Cinema2InterlockShowPlannerStructure>,
  random: Cinema2InterlockRandomSource,
  previous: Readonly<Cinema2InterlockShowPlan> | null = null,
): Readonly<Cinema2InterlockShowPlan> {
  const cadenceIdentity = resolveCinema2InterlockCadenceIdentity(settings.patternChange, structure)
  if (!settings.autoPerformance) {
    return freezePlan({
      layoutId: settings.pattern,
      segmentProgram: settings.segmentPattern,
      segmentDirectionBias: 0,
      bankStagger: 0,
      densityScale: 1,
      backgroundEnergy: 0,
      trailIntent: 0,
      transitionBeats: 2,
      resetHistory: false,
      cadenceIdentity,
      variationKey: `manual:${settings.pattern}:${settings.segmentPattern}`,
      dropHeroShown: false,
      lastDropIdentity: null,
    })
  }

  const performance = normalizePerformance(structure.performance)
  const dropEvent = structure.dropIdentity != null && structure.dropIdentity !== previous?.lastDropIdentity
  const firstDropHero = dropEvent && previous?.dropHeroShown !== true
  const cadenceChanged = previous == null || cadenceIdentity !== previous.cadenceIdentity
  const structuralEvent = dropEvent || (settings.patternChange !== 'off' && (performance.sectionAccent >= 0.5 || performance.phraseAccent >= 0.5))
  const mayChoose = previous == null || dropEvent || (settings.patternChange !== 'off' && cadenceChanged) || structuralEvent

  if (!mayChoose && previous) {
    return freezePlan({
      ...previous,
      resetHistory: false,
      lastDropIdentity: structure.dropIdentity ?? previous.lastDropIdentity,
    })
  }

  let layoutId: Cinema2InterlockPatternId
  if (firstDropHero) {
    layoutId = CINEMA2_INTERLOCK_HERO_PATTERN_ID
  } else {
    layoutId = chooseLayout(structure.phase, cadenceIdentity, previous?.layoutId ?? null, random)
  }

  const segmentProgram = segmentForLayout(layoutId, performance, cadenceIdentity, random)
  const vocalSpace = 1 - performance.vocalPresence * 0.42
  const densityScale = clamp(0.58 + performance.intensity * 0.28 + performance.energy * 0.22 - performance.build * 0.08, 0.42, 1) * vocalSpace
  const backgroundEnergy = clamp(0.18 + performance.intensity * 0.38 + performance.flux * 0.2 + performance.build * 0.14 - performance.vocalPresence * 0.18, 0, 0.78)
  const trailIntent = clamp(performance.build * 0.45 + performance.impact * 0.22 - performance.vocalPresence * 0.28, 0, 0.65)
  const transitionBeats = clamp(2.3 - performance.momentum * 1.25 - performance.impact * 0.35, 0.65, 2.3)
  const bankStagger = clamp(0.08 + performance.momentum * 0.38 + performance.variation * 0.18, 0, 0.62)
  const segmentDirectionBias = layoutId === 'doubleWing'
    ? (random.sample('double-wing-direction', cadenceIdentity) < 0.5 ? -0.72 : 0.72)
    : layoutId === 'fourWayVortex'
      ? (random.sample('vortex-direction', cadenceIdentity) < 0.5 ? -0.5 : 0.5)
      : 0
  const resetHistory = dropEvent || performance.sectionAccent >= 0.62

  return freezePlan({
    layoutId,
    segmentProgram,
    segmentDirectionBias,
    bankStagger,
    densityScale: clamp(densityScale, 0.38, 1),
    backgroundEnergy,
    trailIntent,
    transitionBeats,
    resetHistory,
    cadenceIdentity,
    variationKey: `auto:${structure.phase}:${layoutId}:${segmentProgram}:${cadenceIdentity}`,
    dropHeroShown: firstDropHero || previous?.dropHeroShown === true,
    lastDropIdentity: structure.dropIdentity ?? previous?.lastDropIdentity ?? null,
  })
}

function chooseLayout(
  phase: Cinema2InterlockDirectorPhase,
  eventId: string,
  previous: Cinema2InterlockPatternId | null,
  random: Cinema2InterlockRandomSource,
): Cinema2InterlockPatternId {
  const pool = PHASE_LAYOUTS[phase] ?? PHASE_LAYOUTS.steady
  const candidates = pool.length > 1 && previous ? pool.filter(value => value !== previous) : pool
  const usable = candidates.length > 0 ? candidates : pool
  const index = Math.min(usable.length - 1, Math.floor(random.sample('layout', eventId) * usable.length))
  return usable[index] ?? CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID
}

function segmentForLayout(
  layout: Cinema2InterlockPatternId,
  performance: ReturnType<typeof normalizePerformance>,
  eventId: string,
  random: Cinema2InterlockRandomSource,
): Cinema2InterlockSegmentProgramId {
  switch (layout) {
    case 'diamondTunnel': return random.sample('diamond-segment', eventId) < 0.22 ? 'solid' : 'centerOut'
    case 'mechanicalIris': return performance.snareAccent >= 0.55 ? 'alternating' : 'edgeIn'
    case 'doubleWing': return random.sample('wing-segment', eventId) < 0.5 ? 'forwardChase' : 'reverseChase'
    case 'bassPortal': return 'audioMeterFill'
    case 'fourWayVortex': return performance.dropAccent >= 0.65 || performance.impact >= 0.82 ? 'impactBurst' : 'bankRipple'
    default: return CINEMA2_INTERLOCK_DEFAULT_SEGMENT_PROGRAM_ID
  }
}

function normalizePerformance(value: Readonly<Cinema2InterlockPerformanceIntent> | undefined) {
  return Object.freeze({
    intensity: clamp01(value?.intensity), momentum: clamp01(value?.momentum), build: clamp01(value?.build),
    impact: clamp01(value?.impact), variation: clamp01(value?.variation), bass: clamp01(value?.bass),
    energy: clamp01(value?.energy), flux: clamp01(value?.flux), highAir: clamp01(value?.highAir),
    vocalPresence: clamp01(value?.vocalPresence), kickAccent: clamp01(value?.kickAccent), snareAccent: clamp01(value?.snareAccent),
    downbeatAccent: clamp01(value?.downbeatAccent), barAccent: clamp01(value?.barAccent), phraseAccent: clamp01(value?.phraseAccent),
    sectionAccent: clamp01(value?.sectionAccent), dropAccent: clamp01(value?.dropAccent),
  })
}

function freezePlan(value: Cinema2InterlockShowPlan): Readonly<Cinema2InterlockShowPlan> { return Object.freeze(value) }
function safeIdentity(value: string | null | undefined, fallback: string): string { return value?.trim() || fallback }
function finiteIndex(value: number | null | undefined): number | null { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null }
function clamp01(value: number | null | undefined): number { return clamp(typeof value === 'number' ? value : 0, 0, 1) }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)) }
