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

function definition(
  input: Omit<LaserDmxShowDirectorRigBackedPerformanceShowDefinition, 'schemaVersion' | 'status' | 'createCanonicalRig' | 'createProgram'>,
): LaserDmxShowDirectorRigBackedPerformanceShowDefinition {
  return Object.freeze({
    ...input,
    schemaVersion: LASER_DMX_RIG_BACKED_PERFORMANCE_SHOW_SCHEMA_VERSION,
    status: 'foundation' as const,
    createCanonicalRig: (createId?: () => string) => cloneCanonicalShowDirectorRigLayout(
      input.sourceRigLayoutId,
      createId ?? deterministicFixtureIdFactory(input.id),
    ),
    createProgram: null,
  })
}

export const LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS: Readonly<Record<
  LaserDmxShowDirectorRigBackedPerformanceShowId,
  LaserDmxShowDirectorRigBackedPerformanceShowDefinition
>> = Object.freeze({
  'small-club-rig-performance': definition({
    id: 'small-club-rig-performance', displayName: 'Small Club Rig Performance',
    description: 'Authored full-song conversion foundation for the balanced Small Club Rig.',
    sourceRigLayoutId: 'small-club-rig', performanceProgramId: 'small-club-rig-performance', version: 1,
    supportedFixtureKinds: ['laser', 'movingHead', 'ledBar', 'strobe', 'parWash', 'haze'],
    fixtureBanks: {
      hero: bank('hero', ['club-laser-l', 'club-laser-r']), primary: bank('primary', ['front-led-bar-l', 'front-led-bar-r']),
      movement: bank('movement', ['moving-head-l', 'moving-head-r']), impact: bank('impact', ['center-strobe']),
      strobe: bank('strobe', ['center-strobe']), atmosphere: bank('atmosphere', ['soft-haze', 'back-wash']),
      left: bank('left', ['front-led-bar-l', 'club-laser-l', 'moving-head-l']), right: bank('right', ['front-led-bar-r', 'club-laser-r', 'moving-head-r']),
      center: bank('center', ['center-strobe', 'back-wash']), snare: bank('snare', ['center-strobe']), kick: bank('kick', ['club-laser-l', 'club-laser-r']),
    },
    visualValidation: { requiredBankRoles: ['hero', 'primary', 'movement', 'impact', 'atmosphere'], negativeSpaceRules: ['Protect a readable center lane between the paired club lasers.'], acceptanceNotes: ['Lasers, LEDs, movement, wash, strobe, and haze must remain visually distinct.'], budgets: definePerformanceBudgets({ maxBeamDemand: 72, maxActiveStrobes: 1, maxHazeAmount: 0.65 }) },
  }),
  'festival-front-beams-performance': definition({
    id: 'festival-front-beams-performance', displayName: 'Festival Front Beams Performance', description: 'Authored full-song conversion foundation for the symmetrical festival front line.', sourceRigLayoutId: 'festival-front-beams', performanceProgramId: 'festival-front-beams-performance', version: 1,
    supportedFixtureKinds: ['laser', 'movingHead', 'parWash'], fixtureBanks: {
      hero: bank('hero', ['front-beam-1', 'front-beam-4']), primary: bank('primary', ['front-beam-2', 'front-beam-3']), movement: bank('movement', ['sweep-head-1', 'sweep-head-2']), atmosphere: bank('atmosphere', ['festival-wash-l', 'festival-wash-r']), left: bank('left', ['front-beam-1', 'front-beam-2', 'sweep-head-1', 'festival-wash-l']), right: bank('right', ['front-beam-3', 'front-beam-4', 'sweep-head-2', 'festival-wash-r']), outer: bank('outer', ['front-beam-1', 'front-beam-4']), inner: bank('inner', ['front-beam-2', 'front-beam-3']), kick: bank('kick', ['front-beam-2', 'front-beam-3']), downbeat: bank('downbeat', ['front-beam-1', 'front-beam-4']),
    }, visualValidation: { requiredBankRoles: ['hero', 'primary', 'movement', 'left', 'right'], negativeSpaceRules: ['Preserve a central audience-facing aperture between inner beams.'], acceptanceNotes: ['Front-line symmetry must remain legible under beam-budget pressure.'], budgets: definePerformanceBudgets({ maxBeamDemand: 112 }) },
  }),
  'dubstep-drop-lasers-performance': definition({
    id: 'dubstep-drop-lasers-performance', displayName: 'Dubstep Drop Lasers Performance', description: 'Authored full-song conversion foundation for quarter-beat gates and bounded impact fixtures.', sourceRigLayoutId: 'dubstep-drop-lasers', performanceProgramId: 'dubstep-drop-lasers-performance', version: 1,
    supportedFixtureKinds: ['laser', 'strobe', 'blinder', 'co2Jet'], fixtureBanks: {
      hero: bank('hero', ['drop-gate-l', 'drop-gate-r']), primary: bank('primary', ['drop-cross-l', 'drop-cross-r']), impact: bank('impact', ['snare-strobe-l', 'snare-strobe-r', 'downbeat-blinder', 'co2-drop-l', 'co2-drop-r']), kick: bank('kick', ['drop-gate-l', 'drop-gate-r']), snare: bank('snare', ['snare-strobe-l', 'snare-strobe-r']), downbeat: bank('downbeat', ['downbeat-blinder']), strobe: bank('strobe', ['snare-strobe-l', 'snare-strobe-r']), blinder: bank('blinder', ['downbeat-blinder']), co2Impact: bank('co2Impact', ['co2-drop-l', 'co2-drop-r']), left: bank('left', ['drop-gate-l', 'drop-cross-l', 'snare-strobe-l', 'co2-drop-l']), right: bank('right', ['drop-gate-r', 'drop-cross-r', 'snare-strobe-r', 'co2-drop-r']),
    }, visualValidation: { requiredBankRoles: ['hero', 'primary', 'kick', 'snare', 'blinder', 'co2Impact'], negativeSpaceRules: ['Impact layers must punctuate the gate architecture rather than white-out the full frame.'], acceptanceNotes: ['Strobe, blinder, and CO₂ actions must remain bounded.'], budgets: definePerformanceBudgets({ maxBeamDemand: 96, maxActiveStrobes: 2, maxActiveBlinders: 1, maxConcurrentCo2Bursts: 2 }) },
  }),
  'led-bar-grid-performance': definition({
    id: 'led-bar-grid-performance', displayName: 'LED Bar Grid Performance', description: 'Authored full-song conversion foundation for the LED bar and tube grid.', sourceRigLayoutId: 'led-bar-grid', performanceProgramId: 'led-bar-grid-performance', version: 1,
    supportedFixtureKinds: ['ledBar', 'ledTube'], fixtureBanks: {
      hero: bank('hero', ['top-bar-2', 'mid-bar-2']), primary: bank('primary', ['top-bar-1', 'top-bar-3', 'mid-bar-1', 'mid-bar-3']), texture: bank('texture', ['tube-l-1', 'tube-l-2', 'tube-r-1', 'tube-r-2']), top: bank('top', ['top-bar-1', 'top-bar-2', 'top-bar-3']), center: bank('center', ['mid-bar-1', 'mid-bar-2', 'mid-bar-3']), left: bank('left', ['top-bar-1', 'mid-bar-1', 'tube-l-1', 'tube-l-2']), right: bank('right', ['top-bar-3', 'mid-bar-3', 'tube-r-1', 'tube-r-2']), outer: bank('outer', ['tube-l-1', 'tube-l-2', 'tube-r-1', 'tube-r-2']), kick: bank('kick', ['mid-bar-1', 'mid-bar-3']), hat: bank('hat', ['top-bar-1', 'top-bar-3']), downbeat: bank('downbeat', ['top-bar-2', 'mid-bar-2']),
    }, visualValidation: { requiredBankRoles: ['hero', 'primary', 'texture', 'top', 'center'], negativeSpaceRules: ['Keep cell-chase patterns readable as discrete horizontal and vertical structures.'], acceptanceNotes: ['LED direction changes must not be represented as laser fan geometry.'], budgets: definePerformanceBudgets({ maxBeamDemand: 0 }) },
  }),
  'moving-head-sweep-performance': definition({
    id: 'moving-head-sweep-performance', displayName: 'Moving Head Sweep Performance', description: 'Authored full-song conversion foundation for mirrored moving-head motion and wash support.', sourceRigLayoutId: 'moving-head-sweep', performanceProgramId: 'moving-head-sweep-performance', version: 1,
    supportedFixtureKinds: ['movingHead', 'parWash'], fixtureBanks: {
      hero: bank('hero', ['sweep-head-fl', 'sweep-head-fr']), primary: bank('primary', ['sweep-head-bl', 'sweep-head-br']), movement: bank('movement', ['sweep-head-fl', 'sweep-head-fr', 'sweep-head-bl', 'sweep-head-br']), atmosphere: bank('atmosphere', ['sweep-wash']), left: bank('left', ['sweep-head-fl', 'sweep-head-bl']), right: bank('right', ['sweep-head-fr', 'sweep-head-br']), top: bank('top', ['sweep-head-bl', 'sweep-head-br']), bottom: bank('bottom', ['sweep-head-fl', 'sweep-head-fr']), kick: bank('kick', ['sweep-head-fl', 'sweep-head-fr']), downbeat: bank('downbeat', ['sweep-head-bl', 'sweep-head-br']),
    }, visualValidation: { requiredBankRoles: ['hero', 'primary', 'movement', 'left', 'right'], negativeSpaceRules: ['Mirrored sweeps must cross deliberately without collapsing into one shared target knot.'], acceptanceNotes: ['Movement style remains moving-head behavior, not laser-only targeting.'], budgets: definePerformanceBudgets({ maxBeamDemand: 56 }) },
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
