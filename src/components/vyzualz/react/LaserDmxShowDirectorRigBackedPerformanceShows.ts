import {
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorBeamTarget,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorState,
} from './ReactTypes'
import {
  createLaserDmxShowDirectorTemplateState,
  getLaserDmxShowDirectorTemplate,
} from './laserDmxShowDirectorTemplates'
import {
  createDubstepDropLasersPerformanceProgram,
  createFestivalFrontBeamsPerformanceProgram,
  createSmallClubPerformanceProgram,
  DUBSTEP_DROP_LASERS_PERFORMANCE_BANKS,
  FESTIVAL_FRONT_BEAMS_PERFORMANCE_BANKS,
  SMALL_CLUB_PERFORMANCE_BANKS,
} from './LaserDmxShowDirectorRigBackedLaserPerformancePrograms'
import {
  createLedBarGridPerformanceProgram,
  createMovingHeadSweepPerformanceProgram,
  LED_BAR_GRID_PERFORMANCE_BANKS,
  MOVING_HEAD_SWEEP_PERFORMANCE_BANKS,
} from './LaserDmxShowDirectorRigBackedLedMovingHeadPerformancePrograms'
import type {
  LaserDmxShowDirectorAuthoredFixtureBankMetadata,
  LaserDmxShowDirectorAuthoredFixtureBankRole,
  LaserDmxShowDirectorBuiltInPerformanceProgramId,
  LaserDmxShowDirectorMixedFixtureAction,
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
} from './LaserDmxShowDirectorPerformanceProgram'

export const LASER_DMX_RIG_BACKED_PERFORMANCE_SHOW_SCHEMA_VERSION = 1

export type LaserDmxShowDirectorRigBackedPerformanceShowId = Exclude<
  LaserDmxShowDirectorBuiltInPerformanceProgramId,
  'prism-cathedral' | 'cardinal-fan-reactor' | 'cyan-mirror-cage'
>

export type LaserDmxShowDirectorSourceRigLayoutId =
  | 'small-club-rig'
  | 'festival-front-beams'
  | 'dubstep-drop-lasers'
  | 'led-bar-grid'
  | 'moving-head-sweep'
  | 'strobe-blinder-hits'
  | 'haze-co2-drops'

export interface LaserDmxShowDirectorPerformanceBudgetMetadata {
  maxBeamDemand?: number
  maxActiveStrobes?: number
  maxActiveBlinders?: number
  maxConcurrentCo2Bursts?: number
  maxHazeAmount?: number
}

export type LaserDmxShowDirectorRigPerformanceEffectCountMode = 'ledGrid' | 'movingHead'

export interface LaserDmxShowDirectorRigPerformanceEffectCountMetadata {
  mode: LaserDmxShowDirectorRigPerformanceEffectCountMode
  countedFixtureKinds: LaserDmxShowDirectorFixtureKind[]
  movementBankKeys?: string[]
  mirroredFixturePairs?: Array<readonly [string, string]>
  maxImpactDurationBeats: number
  presetChipLabel: string
}

export interface LaserDmxShowDirectorVisualValidationMetadata {
  requiredBankRoles: string[]
  negativeSpaceRules: string[]
  acceptanceNotes: string[]
  budgets: LaserDmxShowDirectorPerformanceBudgetMetadata
}

export interface LaserDmxShowDirectorRigBackedPerformanceMigrationMetadata {
  legacyPerformanceShowIds?: string[]
  sourceRigLayoutAliases?: string[]
  minimumSourceRigSchemaVersion?: number
}

export interface LaserDmxShowDirectorRigBackedPerformanceShowDefinition {
  schemaVersion: number
  id: LaserDmxShowDirectorRigBackedPerformanceShowId
  displayName: string
  description: string
  sourceRigLayoutId: LaserDmxShowDirectorSourceRigLayoutId
  performanceProgramId: LaserDmxShowDirectorBuiltInPerformanceProgramId
  supportedFixtureKinds: LaserDmxShowDirectorFixtureKind[]
  fixtureBanks: Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>
  visualValidation: LaserDmxShowDirectorVisualValidationMetadata
  effectCountReporting?: LaserDmxShowDirectorRigPerformanceEffectCountMetadata
  version: number
  migration?: LaserDmxShowDirectorRigBackedPerformanceMigrationMetadata
  status: 'foundation' | 'available'
  createCanonicalRig: (createId?: () => string) => LaserDmxShowDirectorState | null
  createProgram: (() => LaserDmxShowDirectorPerformanceProgram) | null
}

function deterministicFixtureIdFactory(namespace: string): () => string {
  let index = 0
  return () => `${namespace}-fixture-${++index}`
}

export function cloneCanonicalShowDirectorRigLayout(
  sourceRigLayoutId: string,
  createId: () => string = deterministicFixtureIdFactory(`rig-backed-${sourceRigLayoutId}`),
): LaserDmxShowDirectorState | null {
  if (!getLaserDmxShowDirectorTemplate(sourceRigLayoutId)) return null
  const created = createLaserDmxShowDirectorTemplateState(sourceRigLayoutId, createId)
  if (!created) return null
  const used = new Set<string>()
  const fixtures = created.fixtures.map((fixture, index) => {
    const base = fixture.label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `${fixture.kind}-${index + 1}`
    let semanticKey = base.slice(0, 64)
    let suffix = 2
    while (used.has(semanticKey)) {
      const tail = `-${suffix++}`
      semanticKey = `${base.slice(0, Math.max(1, 64 - tail.length))}${tail}`
    }
    used.add(semanticKey)
    return { ...fixture, semanticKey }
  })
  return normalizeLaserDmxShowDirectorState({ ...created, fixtures })
}

export function defineAuthoredFixtureBank(
  role: LaserDmxShowDirectorAuthoredFixtureBankRole | string,
  fixtureSemanticKeys: readonly string[],
  options: { label?: string; description?: string; match?: 'any' | 'all' } = {},
): LaserDmxShowDirectorAuthoredFixtureBankMetadata {
  return {
    role,
    ...(options.label ? { label: options.label } : {}),
    ...(options.description ? { description: options.description } : {}),
    address: {
      fixtureSemanticKeys: Array.from(new Set(fixtureSemanticKeys)),
      ...(options.match ? { match: options.match } : {}),
    },
  }
}

export function selectFixturesByStableIdentifiers(
  rig: LaserDmxShowDirectorState,
  address: LaserDmxShowDirectorPerformanceAddress,
): LaserDmxShowDirectorFixture[] {
  const fixtureKeys = new Set(address.fixtureSemanticKeys ?? [])
  const fixtureIds = new Set(address.fixtureIds ?? [])
  const fixtureKinds = new Set(address.fixtureKinds ?? [])
  const groupKeys = new Set(address.groupSemanticKeys ?? [])
  const checks = (fixture: LaserDmxShowDirectorFixture): boolean[] => {
    const group = rig.groups.find(item => item.id === fixture.groupId)
    return [
      ...(fixtureKeys.size ? [fixtureKeys.has(fixture.semanticKey ?? '')] : []),
      ...(fixtureIds.size ? [fixtureIds.has(fixture.id)] : []),
      ...(fixtureKinds.size ? [fixtureKinds.has(fixture.kind)] : []),
      ...(groupKeys.size ? [groupKeys.has(group?.semanticKey ?? '')] : []),
    ]
  }
  return rig.fixtures.filter(fixture => {
    const values = checks(fixture)
    return values.length === 0 || (address.match === 'all' ? values.every(Boolean) : values.some(Boolean))
  })
}

export function defineSectionScene(scene: LaserDmxShowDirectorPerformanceScene): LaserDmxShowDirectorPerformanceScene {
  return structuredClone(scene)
}

export function defineLocalFanTargets(
  fixtureSemanticKey: string,
  center: { x: number; y: number },
  width: number,
  count: number,
): Record<string, LaserDmxShowDirectorBeamTarget[]> {
  const safeCount = Math.max(1, Math.min(12, Math.round(count)))
  return {
    [fixtureSemanticKey]: Array.from({ length: safeCount }, (_, index) => ({
      id: `${fixtureSemanticKey}-fan-${index + 1}`,
      x: safeCount === 1 ? center.x : center.x - width / 2 + width * index / (safeCount - 1),
      y: center.y,
    })),
  }
}

export function defineMirroredTargets(
  targets: readonly LaserDmxShowDirectorBeamTarget[],
  centerX: number,
  idPrefix = 'mirror',
): LaserDmxShowDirectorBeamTarget[] {
  return targets.map((target, index) => ({
    id: `${idPrefix}-${index + 1}`,
    x: centerX + (centerX - target.x),
    y: target.y,
  }))
}

export function defineBoundedTransientAction(
  id: string,
  address: LaserDmxShowDirectorPerformanceAddress,
  action: LaserDmxShowDirectorMixedFixtureAction,
  durationBeats: number,
): LaserDmxShowDirectorPerformanceMutationBase {
  return {
    id,
    address,
    fixtureActions: [{ ...action, id: action.id || `${id}-fixture-action` }],
    durationBeats: Math.max(0.0625, Math.min(64, durationBeats)),
  }
}

export function definePerformanceBudgets(
  budgets: LaserDmxShowDirectorPerformanceBudgetMetadata,
): LaserDmxShowDirectorPerformanceBudgetMetadata {
  return {
    ...(budgets.maxBeamDemand != null ? { maxBeamDemand: Math.max(0, Math.min(300, Math.round(budgets.maxBeamDemand))) } : {}),
    ...(budgets.maxActiveStrobes != null ? { maxActiveStrobes: Math.max(0, Math.round(budgets.maxActiveStrobes)) } : {}),
    ...(budgets.maxActiveBlinders != null ? { maxActiveBlinders: Math.max(0, Math.round(budgets.maxActiveBlinders)) } : {}),
    ...(budgets.maxConcurrentCo2Bursts != null ? { maxConcurrentCo2Bursts: Math.max(0, Math.round(budgets.maxConcurrentCo2Bursts)) } : {}),
    ...(budgets.maxHazeAmount != null ? { maxHazeAmount: Math.max(0, Math.min(1, budgets.maxHazeAmount)) } : {}),
  }
}

export function applyAuthoredFixtureBanks(
  program: LaserDmxShowDirectorPerformanceProgram,
  fixtureBanks: Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>,
): LaserDmxShowDirectorPerformanceProgram {
  return {
    ...program,
    fixtureBanks: structuredClone(fixtureBanks),
    bankRoles: Object.fromEntries(Object.entries(fixtureBanks).map(([key, bank]) => [key, structuredClone(bank.address)])),
  }
}

const bank = defineAuthoredFixtureBank

type RigBackedPerformanceDefinitionInput = Omit<
  LaserDmxShowDirectorRigBackedPerformanceShowDefinition,
  'schemaVersion' | 'status' | 'createCanonicalRig' | 'createProgram'
> & { createProgram?: () => LaserDmxShowDirectorPerformanceProgram }

function definition(
  input: RigBackedPerformanceDefinitionInput,
): LaserDmxShowDirectorRigBackedPerformanceShowDefinition {
  const createProgram = input.createProgram ?? null
  return Object.freeze({
    ...input,
    schemaVersion: LASER_DMX_RIG_BACKED_PERFORMANCE_SHOW_SCHEMA_VERSION,
    status: createProgram ? 'available' as const : 'foundation' as const,
    createCanonicalRig: (createId?: () => string) => cloneCanonicalShowDirectorRigLayout(
      input.sourceRigLayoutId,
      createId ?? deterministicFixtureIdFactory(input.id),
    ),
    createProgram,
  })
}

export const LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS: Readonly<Record<
  LaserDmxShowDirectorRigBackedPerformanceShowId,
  LaserDmxShowDirectorRigBackedPerformanceShowDefinition
>> = Object.freeze({
  'small-club-rig-performance': definition({
    id: 'small-club-rig-performance', displayName: 'Small Club Performance',
    description: 'Compact authored club choreography with mirrored tunnel walls, lower kick fans, upper snare crowns, bounded impacts, and a protected central aperture.',
    sourceRigLayoutId: 'small-club-rig', performanceProgramId: 'small-club-rig-performance', version: 2,
    supportedFixtureKinds: ['laser', 'movingHead', 'ledBar', 'strobe', 'parWash', 'haze'],
    fixtureBanks: SMALL_CLUB_PERFORMANCE_BANKS,
    createProgram: createSmallClubPerformanceProgram,
    visualValidation: {
      requiredBankRoles: ['lowerKick', 'upperSnare', 'leftCall', 'rightResponse', 'outerHero', 'innerPrimary', 'texture', 'boundedImpact'],
      negativeSpaceRules: ['Protect a narrow center aperture; no ordinary scene may continuously fill the center lane.'],
      acceptanceNotes: ['Local fan origins remain distinguishable.', 'Drop 2 adds upper tunnel depth and diagonal layers rather than brightness alone.'],
      budgets: definePerformanceBudgets({ maxBeamDemand: 160, maxActiveStrobes: 1, maxHazeAmount: 0.65 }),
    },
  }),
  'festival-front-beams-performance': definition({
    id: 'festival-front-beams-performance', displayName: 'Festival Front Beams Performance',
    description: 'Large authored festival fan choreography with outer hero edges, layered inner rays, eight-bar recruitment, clean stage-center framing, and a radial-diagonal second drop.',
    sourceRigLayoutId: 'festival-front-beams', performanceProgramId: 'festival-front-beams-performance', version: 2,
    supportedFixtureKinds: ['laser', 'movingHead', 'parWash'],
    fixtureBanks: FESTIVAL_FRONT_BEAMS_PERFORMANCE_BANKS,
    createProgram: createFestivalFrontBeamsPerformanceProgram,
    visualValidation: {
      requiredBankRoles: ['leftHeroEdge', 'rightHeroEdge', 'innerPrimary', 'lowerKick', 'upperSnare', 'fourBarSubdivision', 'eightBarRecruitment', 'texture', 'boundedImpact'],
      negativeSpaceRules: ['Preserve a clean central audience-facing aperture between the inner fan banks.'],
      acceptanceNotes: ['Outer edges retain hero priority under pressure.', 'Decorative wash and crown detail never overwhelm the primary fan architecture.'],
      budgets: definePerformanceBudgets({ maxBeamDemand: 220 }),
    },
  }),
  'dubstep-drop-lasers-performance': definition({
    id: 'dubstep-drop-lasers-performance', displayName: 'Dubstep Drop Lasers Performance',
    description: 'Aggressive authored dubstep choreography with kick-owned gates, snare-owned crosses and strobes, four-bar motif mutations, eight-bar recruitment, and bounded impact fixtures.',
    sourceRigLayoutId: 'dubstep-drop-lasers', performanceProgramId: 'dubstep-drop-lasers-performance', version: 2,
    supportedFixtureKinds: ['laser', 'strobe', 'blinder', 'co2Jet'],
    fixtureBanks: DUBSTEP_DROP_LASERS_PERFORMANCE_BANKS,
    createProgram: createDubstepDropLasersPerformanceProgram,
    visualValidation: {
      requiredBankRoles: ['kick', 'snare', 'hatTexture', 'downbeatImpact', 'outerHero', 'innerPrimary', 'fourBarMutation', 'eightBarRecruitment', 'boundedImpact'],
      negativeSpaceRules: ['Gate and cross layers must form bounded local geometry instead of an all-over wireframe web.'],
      acceptanceNotes: ['Kick and snare banks remain visually distinct.', 'Strobe, blinder, and simulated CO2 actions remain short-lived and palette accents stay subordinate.'],
      budgets: definePerformanceBudgets({ maxBeamDemand: 220, maxActiveStrobes: 2, maxActiveBlinders: 1, maxConcurrentCo2Bursts: 2 }),
    },
  }),
  'led-bar-grid-performance': definition({
    id: 'led-bar-grid-performance', displayName: 'LED Bar Grid Performance',
    description: 'Rhythmic authored LED architecture with explicit row, column, diagonal, checker, texture, and bounded full-grid impact ownership.',
    sourceRigLayoutId: 'led-bar-grid', performanceProgramId: 'led-bar-grid-performance', version: 2,
    supportedFixtureKinds: ['ledBar', 'ledTube'], fixtureBanks: LED_BAR_GRID_PERFORMANCE_BANKS,
    createProgram: createLedBarGridPerformanceProgram,
    effectCountReporting: {
      mode: 'ledGrid', countedFixtureKinds: ['ledBar', 'ledTube'], maxImpactDurationBeats: 0.25,
      presetChipLabel: 'LED grid metrics',
    },
    visualValidation: {
      requiredBankRoles: ['lowerRowKick', 'upperRowSnare', 'leftColumnResponse', 'rightColumnResponse', 'innerGridPrimary', 'outerGridHero', 'diagonalA', 'diagonalB', 'textureTransient', 'fullGridImpact'],
      negativeSpaceRules: ['Keep row, column, diagonal, and checker ownership readable; full-grid white may appear only as a bounded impact.'],
      acceptanceNotes: ['LED actions are limited to enabled state, brightness, color, and supported chase direction.', 'No LED fixture receives laser targets, fan geometry, or beam-travel actions.'],
      budgets: definePerformanceBudgets({ maxBeamDemand: 0 }),
    },
  }),
  'moving-head-sweep-performance': definition({
    id: 'moving-head-sweep-performance', displayName: 'Moving Head Sweep Performance',
    description: 'Phrase-driven authored moving-head choreography with mirrored sides, controlled compression, broad expansion, and evolved crossing motion.',
    sourceRigLayoutId: 'moving-head-sweep', performanceProgramId: 'moving-head-sweep-performance', version: 2,
    supportedFixtureKinds: ['movingHead', 'parWash'], fixtureBanks: MOVING_HEAD_SWEEP_PERFORMANCE_BANKS,
    createProgram: createMovingHeadSweepPerformanceProgram,
    effectCountReporting: {
      mode: 'movingHead', countedFixtureKinds: ['movingHead'], movementBankKeys: ['leftMovement', 'rightMovement', 'innerPrimary', 'outerHero'],
      mirroredFixturePairs: [['sweep-head-fl', 'sweep-head-fr'], ['sweep-head-bl', 'sweep-head-br']],
      maxImpactDurationBeats: 0.25, presetChipLabel: '≤4 head beams',
    },
    visualValidation: {
      requiredBankRoles: ['leftMovement', 'rightMovement', 'innerPrimary', 'outerHero', 'upperRear', 'kickAccent', 'snareAccent', 'downbeatImpact', 'breakdownIsolation'],
      negativeSpaceRules: ['Left and right paths remain distinguishable; crossings are authored phrase shapes rather than a shared target knot.'],
      acceptanceNotes: ['Beat accents preserve the active path and affect brightness or color only.', 'Moving-head targets, spread, focus, rotation, and movement style remain within existing renderer support.'],
      budgets: definePerformanceBudgets({ maxBeamDemand: 4 }),
    },
  }),
  'strobe-blinder-hits-performance': definition({
    id: 'strobe-blinder-hits-performance', displayName: 'Strobe + Blinder Hits Performance', description: 'Authored full-song conversion foundation for a bounded impact-only fixture layer.', sourceRigLayoutId: 'strobe-blinder-hits', performanceProgramId: 'strobe-blinder-hits-performance', version: 1,
    supportedFixtureKinds: ['strobe', 'blinder'], fixtureBanks: {
      impact: bank('impact', ['transient-strobe-l', 'transient-strobe-r', 'bass-flash-center', 'blinder-l', 'blinder-c', 'blinder-r']), strobe: bank('strobe', ['transient-strobe-l', 'transient-strobe-r', 'bass-flash-center']), blinder: bank('blinder', ['blinder-l', 'blinder-c', 'blinder-r']), snare: bank('snare', ['transient-strobe-l', 'transient-strobe-r']), kick: bank('kick', ['bass-flash-center']), downbeat: bank('downbeat', ['blinder-l', 'blinder-c', 'blinder-r']), left: bank('left', ['transient-strobe-l', 'blinder-l']), right: bank('right', ['transient-strobe-r', 'blinder-r']), center: bank('center', ['bass-flash-center', 'blinder-c']),
    }, visualValidation: { requiredBankRoles: ['impact', 'strobe', 'blinder', 'snare', 'downbeat'], negativeSpaceRules: ['The default body state must remain dark enough that impacts read as events.'], acceptanceNotes: ['No unbounded scene-level strobe or blinder activation.'], budgets: definePerformanceBudgets({ maxBeamDemand: 18, maxActiveStrobes: 3, maxActiveBlinders: 3 }) },
  }),
  'haze-co2-drops-performance': definition({
    id: 'haze-co2-drops-performance', displayName: 'Haze + CO₂ Drops Performance', description: 'Authored full-song conversion foundation for atmosphere and bounded simulated CO₂ accents.', sourceRigLayoutId: 'haze-co2-drops', performanceProgramId: 'haze-co2-drops-performance', version: 1,
    supportedFixtureKinds: ['haze', 'co2Jet'], fixtureBanks: {
      atmosphere: bank('atmosphere', ['haze-base-l', 'haze-base-r']), impact: bank('impact', ['co2-jet-l', 'co2-jet-r', 'phrase-co2-center']), co2Impact: bank('co2Impact', ['co2-jet-l', 'co2-jet-r', 'phrase-co2-center']), left: bank('left', ['haze-base-l', 'co2-jet-l']), right: bank('right', ['haze-base-r', 'co2-jet-r']), center: bank('center', ['phrase-co2-center']), downbeat: bank('downbeat', ['co2-jet-l', 'co2-jet-r']), transient: bank('transient', ['phrase-co2-center']),
    }, visualValidation: { requiredBankRoles: ['atmosphere', 'impact', 'co2Impact'], negativeSpaceRules: ['Atmosphere may reveal other beams but must not become opaque full-frame fog.'], acceptanceNotes: ['CO₂-style effects remain simulated, bounded, and non-physical.'], budgets: definePerformanceBudgets({ maxBeamDemand: 0, maxConcurrentCo2Bursts: 3, maxHazeAmount: 0.72 }) },
  }),
})

export function getRigBackedPerformanceShowDefinition(
  showId: string,
): LaserDmxShowDirectorRigBackedPerformanceShowDefinition | null {
  return LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS[showId as LaserDmxShowDirectorRigBackedPerformanceShowId] ?? null
}

export function createRigBackedPerformanceShowRig(showId: string): LaserDmxShowDirectorState | null {
  return getRigBackedPerformanceShowDefinition(showId)?.createCanonicalRig() ?? null
}
