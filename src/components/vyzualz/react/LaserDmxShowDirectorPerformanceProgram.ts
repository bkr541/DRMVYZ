import {
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION,
} from './LaserDmxShowDirectorPerformanceConstants'
export {
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION,
} from './LaserDmxShowDirectorPerformanceConstants'

import {
  LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
  type LaserDmxBeamMotion,
  type LaserDmxMatrixBeamAppearance,
  type LaserDmxMatrixBeamVisualRole,
  type LaserDmxShowDirectorBeamConfig,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorFixtureSpecificConfig,
  type LaserDmxShowDirectorMirrorAxis,
  type LaserDmxShowDirectorScannerRuntimeOverrides,
  type LaserDmxShowDirectorTriggerConfig,
  type ReactSectionType,
} from './ReactTypes'
import {
  createCardinalFanReactorProgram,
  createCyanMirrorCageProgram,
  createPrismCathedralProgram,
} from './LaserDmxShowDirectorPerformanceShowcasePresets'
import {
  createDubstepDropLasersPerformanceProgram,
  createFestivalFrontBeamsPerformanceProgram,
  createSmallClubPerformanceProgram,
} from './LaserDmxShowDirectorRigBackedLaserPerformancePrograms'
import {
  createLedBarGridPerformanceProgram,
  createMovingHeadSweepPerformanceProgram,
} from './LaserDmxShowDirectorRigBackedLedMovingHeadPerformancePrograms'
import {
  createHazeCo2PerformanceProgram,
  createStrobeBlinderPerformanceProgram,
} from './LaserDmxShowDirectorRigBackedImpactAtmospherePerformancePrograms'
import {
  createAuroraCanopyDriftProgram,
  createChromaticChapterStageProgram,
  createEmeraldTunnelRelayProgram,
  createVocalEclipseExchangeProgram,
  createWhiteVectorInterlockProgram,
} from './LaserDmxShowDirectorVideoInspiredPerformancePresets'
import { createPrismaticPulseMatrixProgram } from './LaserDmxShowDirectorPrismaticPulseMatrixPerformancePreset'
import {
  createCrimsonApexProtocolProgram,
  createSpectralRibbonSingularityProgram,
} from './LaserDmxShowDirectorDualReferencePerformancePresets'
import {
  createScarletOrigamiLatticeProgram,
  createVioletHourglassOrbitProgram,
} from './LaserDmxShowDirectorFinalReferencePerformancePresets'
import { migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent } from './LaserDmxShowDirectorPhysicalContentMigration'


export type LaserDmxShowDirectorPerformanceSectionType = ReactSectionType
export type LaserDmxShowDirectorPerformanceMutationMode = 'set' | 'add' | 'multiply' | 'toggle'
export type LaserDmxShowDirectorPerformanceTransitionCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step'
export type LaserDmxShowDirectorPerformanceFallbackBehavior = 'authoredRig' | 'basicTiming' | 'programDefault'
export type LaserDmxShowDirectorAuthoredFixtureBankRole =
  | 'hero' | 'primary' | 'secondary' | 'texture' | 'impact'
  | 'kick' | 'snare' | 'hat' | 'transient' | 'downbeat'
  | 'left' | 'right' | 'top' | 'bottom' | 'center' | 'inner' | 'outer'
  | 'atmosphere' | 'movement' | 'strobe' | 'blinder' | 'co2Impact'
export type LaserDmxShowDirectorPerformanceEnergyEnvelopeKey =
  | 'intro'
  | 'verse'
  | 'build'
  | 'preDrop'
  | 'drop1'
  | 'breakdown'
  | 'drop2'
  | 'outro'
export type LaserDmxShowDirectorProgrammedBlackoutKind = 'preDrop' | 'impactCut' | 'fakeout'
export type LaserDmxShowDirectorProgrammedBlackoutAnchor = 'sectionStart' | 'sectionEnd'
export type LaserDmxShowDirectorBeamPriorityRole =
  | 'heroImpact'
  | 'primaryArchitecture'
  | 'secondaryFan'
  | 'detailLattice'
  | 'decorativeAccent'
export type LaserDmxShowDirectorPerformanceConditionOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'eq'
  | 'notEq'
  | 'between'
  | 'truthy'
  | 'falsy'

export interface LaserDmxShowDirectorPerformanceOccurrenceMatch {
  /** One-based occurrence indexes. */
  occurrences?: number[]
  minOccurrence?: number
  maxOccurrence?: number
  every?: number
}

export interface LaserDmxShowDirectorPerformanceSectionMatch {
  types: LaserDmxShowDirectorPerformanceSectionType[]
  sectionIds?: string[]
  occurrence?: LaserDmxShowDirectorPerformanceOccurrenceMatch
  dropOccurrence?: LaserDmxShowDirectorPerformanceOccurrenceMatch
  minConfidence?: number
}

export interface LaserDmxShowDirectorPerformanceAddress {
  fixtureSemanticKeys?: string[]
  groupSemanticKeys?: string[]
  fixtureKinds?: LaserDmxShowDirectorFixtureKind[]
  fixtureIds?: string[]
  /** Stable mirrored-pair or mirrored-group keys, usually backed by linkedPairId/group semantic keys. */
  mirroredGroupKeys?: string[]
  /** Program-authored semantic bank roles resolved through program.bankRoles. */
  bankRoles?: string[]
  match?: 'any' | 'all'
}

export interface LaserDmxShowDirectorAuthoredFixtureBankMetadata {
  role: string
  label?: string
  description?: string
  address: LaserDmxShowDirectorPerformanceAddress
}

interface LaserDmxShowDirectorMixedFixtureActionBase {
  id: string
  enabled?: boolean
  brightness?: number
  color?: string
}

export interface LaserDmxShowDirectorBeamFixtureAction extends LaserDmxShowDirectorMixedFixtureActionBase {
  kind: 'beam'
  targetMode?: LaserDmxShowDirectorBeamConfig['targetMode']
  targetPoints?: LaserDmxShowDirectorBeamConfig['targets']
  targetPosition?: { x: number; y: number; z?: number }
  fanSpread?: number
  focus?: number
  beamVisualRole?: LaserDmxMatrixBeamVisualRole
  beamPriorityRole?: LaserDmxShowDirectorBeamPriorityRole
  beamAppearance?: Partial<LaserDmxMatrixBeamAppearance>
  beamTravel?: Partial<LaserDmxBeamMotion>
}

export interface LaserDmxShowDirectorScannerFixtureAction extends LaserDmxShowDirectorMixedFixtureActionBase, LaserDmxShowDirectorScannerRuntimeOverrides {
  kind: 'scanner'
}

export interface LaserDmxShowDirectorMovingHeadFixtureAction extends LaserDmxShowDirectorMixedFixtureActionBase {
  kind: 'movingHead'
  targetMode?: LaserDmxShowDirectorBeamConfig['targetMode']
  targetPoints?: LaserDmxShowDirectorBeamConfig['targets']
  fanSpread?: number
  focus?: number
  rotation?: number
  movementStyle?: LaserDmxShowDirectorFixtureSpecificConfig['movingHeadPanTiltStyle']
}

export interface LaserDmxShowDirectorLedFixtureAction extends LaserDmxShowDirectorMixedFixtureActionBase {
  kind: 'led'
  direction?: LaserDmxShowDirectorFixtureSpecificConfig['ledDirection']
}

export interface LaserDmxShowDirectorStrobeFixtureAction extends LaserDmxShowDirectorMixedFixtureActionBase {
  kind: 'strobe'
  active?: boolean
  rateHz?: number
  durationMs?: number
}

export interface LaserDmxShowDirectorBlinderFixtureAction extends LaserDmxShowDirectorMixedFixtureActionBase {
  kind: 'blinder'
  active?: boolean
  durationMs?: number
}

export interface LaserDmxShowDirectorWashFixtureAction extends LaserDmxShowDirectorMixedFixtureActionBase {
  kind: 'wash'
  fanSpread?: number
  focus?: number
}

export interface LaserDmxShowDirectorHazeFixtureAction extends LaserDmxShowDirectorMixedFixtureActionBase {
  kind: 'haze'
  amount?: number
}

export interface LaserDmxShowDirectorCo2FixtureAction extends LaserDmxShowDirectorMixedFixtureActionBase {
  kind: 'co2'
  active?: boolean
  burstStrength?: number
  durationMs?: number
}

export type LaserDmxShowDirectorMixedFixtureAction =
  | LaserDmxShowDirectorScannerFixtureAction
  | LaserDmxShowDirectorBeamFixtureAction
  | LaserDmxShowDirectorMovingHeadFixtureAction
  | LaserDmxShowDirectorLedFixtureAction
  | LaserDmxShowDirectorStrobeFixtureAction
  | LaserDmxShowDirectorBlinderFixtureAction
  | LaserDmxShowDirectorWashFixtureAction
  | LaserDmxShowDirectorHazeFixtureAction
  | LaserDmxShowDirectorCo2FixtureAction

export interface LaserDmxShowDirectorMusicIntelligenceCondition {
  source: string
  operator: LaserDmxShowDirectorPerformanceConditionOperator
  value?: number | boolean | string
  maxValue?: number
  minConfidence?: number
  requiredCapability?: string
  invert?: boolean
}

export interface LaserDmxShowDirectorMusicIntelligenceModulationReference {
  source: string
  target: string
  amount: number
  min?: number
  max?: number
  mode?: LaserDmxShowDirectorPerformanceMutationMode
  curve?: LaserDmxShowDirectorPerformanceTransitionCurve
  requiredCapability?: string
  minConfidence?: number
}

export interface LaserDmxShowDirectorFixtureRuntimeOverrides {
  enabled?: boolean
  brightness?: number
  color?: string
  beamAngle?: number
  fanSpread?: number
  focus?: number
  targetMode?: LaserDmxShowDirectorBeamConfig['targetMode']
  targetPoints?: LaserDmxShowDirectorBeamConfig['targets']
  /** Fixture-local authored endpoints keyed by stable fixture semantic key. */
  targetPointsByFixtureSemanticKey?: Record<string, NonNullable<LaserDmxShowDirectorBeamConfig['targets']>>
  targetPosition?: { x: number; y: number; z?: number }
  rotation?: number
  mirrorAxis?: LaserDmxShowDirectorMirrorAxis | null
  trigger?: Partial<LaserDmxShowDirectorTriggerConfig>
  beamAppearance?: Partial<LaserDmxMatrixBeamAppearance>
  beamVisualRole?: LaserDmxMatrixBeamVisualRole
  beamTravel?: Partial<LaserDmxBeamMotion>
  component?: Partial<LaserDmxShowDirectorFixtureSpecificConfig>
  participatingGroupSemanticKeys?: string[]
  beamPriorityRole?: LaserDmxShowDirectorBeamPriorityRole
  scanner?: LaserDmxShowDirectorScannerRuntimeOverrides
}

export interface LaserDmxShowDirectorGroupRuntimeOverrides {
  enabled?: boolean
  participating?: boolean
  dimmer?: number
  color?: string
  muted?: boolean
  soloed?: boolean
}

export interface LaserDmxShowDirectorGlobalOutputOverrides {
  blackout?: boolean
  dimmer?: number
  haze?: number
  backgroundFade?: number
  beamPersistence?: number
  globalBeamWidth?: number
  globalGlow?: number
  globalStrobeRate?: number
}

export interface LaserDmxShowDirectorPerformanceMutationPayload {
  address?: LaserDmxShowDirectorPerformanceAddress
  fixture?: LaserDmxShowDirectorFixtureRuntimeOverrides
  fixtureActions?: LaserDmxShowDirectorMixedFixtureAction[]
  group?: LaserDmxShowDirectorGroupRuntimeOverrides
  global?: LaserDmxShowDirectorGlobalOutputOverrides
  conditions?: LaserDmxShowDirectorMusicIntelligenceCondition[]
  modulations?: LaserDmxShowDirectorMusicIntelligenceModulationReference[]
}

export interface LaserDmxShowDirectorPerformanceMutationBase extends LaserDmxShowDirectorPerformanceMutationPayload {
  id: string
  enabled?: boolean
  probability?: number
  seedOffset?: number
  /** Optional deterministic lifetime for section entry/exit mutations. */
  durationBeats?: number
}

export interface LaserDmxShowDirectorPerformanceBeatResponseEnvelope {
  /** Beat phase through which the action remains at full strength. */
  holdUntil?: number
  /** Beat phase at which the action has deterministically returned to the authored state. */
  releaseUntil?: number
  curve?: LaserDmxShowDirectorPerformanceTransitionCurve
}

export interface LaserDmxShowDirectorPerformanceBeatMutation extends LaserDmxShowDirectorPerformanceMutationBase {
  beatDivision?: number
  beatOffsets?: number[]
  /** Explicit modulo cycle for beatOffsets. Defaults to max(offset) + 1. */
  beatCycleLength?: number
  /** Optional beat-phase envelope. It is reconstructed from transport time and needs no frame accumulator. */
  responseEnvelope?: LaserDmxShowDirectorPerformanceBeatResponseEnvelope
}

export interface LaserDmxShowDirectorPerformanceKickMutation extends LaserDmxShowDirectorPerformanceMutationBase {
  threshold?: number
}

export interface LaserDmxShowDirectorPerformanceSnareMutation extends LaserDmxShowDirectorPerformanceMutationBase {
  threshold?: number
}

export interface LaserDmxShowDirectorPerformanceHatMutation extends LaserDmxShowDirectorPerformanceMutationBase {
  threshold?: number
}

export interface LaserDmxShowDirectorPerformanceTransientMutation extends LaserDmxShowDirectorPerformanceMutationBase {
  threshold?: number
}

export interface LaserDmxShowDirectorPerformanceBarMutation extends LaserDmxShowDirectorPerformanceMutationBase {
  intervalBars?: number
  anchorBar?: number
}

export interface LaserDmxShowDirectorPerformanceFourBarVariation extends LaserDmxShowDirectorPerformanceMutationBase {
  blockOffsets?: number[]
  /** Stable motif identity retained for the whole four-bar block. */
  motifFamily?: string
}

export interface LaserDmxShowDirectorPerformanceEightBarFixtureRecruitmentStage extends LaserDmxShowDirectorPerformanceMutationBase {
  stage: number
  cumulative?: boolean
}

export interface LaserDmxShowDirectorPerformanceBarProgressionStage extends LaserDmxShowDirectorPerformanceMutationBase {
  /** One-based bar within the macro section at which this stage becomes eligible. */
  stageBar: number
  /** Cumulative stages build upward. Non-cumulative stages replace the prior authored stage. */
  cumulative?: boolean
}

export interface LaserDmxShowDirectorPerformanceSixteenBarEvolution extends LaserDmxShowDirectorPerformanceMutationBase {
  phase?: number
  phraseLengthBars?: number
}

export interface LaserDmxShowDirectorPerformanceSceneVariation extends LaserDmxShowDirectorPerformanceMutationPayload {
  id: string
  label?: string
  weight?: number
  everyBars?: number
  barOffsets?: number[]
  conditions?: LaserDmxShowDirectorMusicIntelligenceCondition[]
}

export interface LaserDmxShowDirectorPerformanceSceneTransition {
  durationBars?: number
  durationMs?: number
  curve?: LaserDmxShowDirectorPerformanceTransitionCurve
  blackoutDuringTransition?: boolean
}

export interface LaserDmxShowDirectorProgrammedBlackoutWindow {
  id: string
  kind: LaserDmxShowDirectorProgrammedBlackoutKind
  anchor: LaserDmxShowDirectorProgrammedBlackoutAnchor
  /** Window length in musical beats. The resolver clamps this to the program policy. */
  durationBeats: number
  /** Musical-beat offset from the anchor. Positive values move inward from section end. */
  offsetBeats?: number
  justification?: string
}

export interface LaserDmxShowDirectorPerformanceMetricRange {
  min: number
  max: number
}

export interface LaserDmxShowDirectorSectionEnergyEnvelope {
  activeFixtureGroups: LaserDmxShowDirectorPerformanceMetricRange
  estimatedBeamCount: LaserDmxShowDirectorPerformanceMetricRange
  brightness: LaserDmxShowDirectorPerformanceMetricRange
  fanSpread: LaserDmxShowDirectorPerformanceMetricRange
  movementStrength: LaserDmxShowDirectorPerformanceMetricRange
  glow: LaserDmxShowDirectorPerformanceMetricRange
  density: LaserDmxShowDirectorPerformanceMetricRange
  negativeSpace: LaserDmxShowDirectorPerformanceMetricRange
}

export interface LaserDmxShowDirectorPerformanceBlackoutPolicy {
  maxPreDropBeats: number
  maxImpactCutBeats: number
  maxFakeoutBeats: number
  maximumProgrammedBlackoutRatio: number
  retriggerGuardBeats: number
  breakdownRequiresVisibleOutput: boolean
  minimumVisibleFixtureBrightness: number
}

export interface LaserDmxShowDirectorPerformanceSceneBarMatch {
  startBar?: number
  endBar?: number
  everyBars?: number
  barOffsets?: number[]
}

export interface LaserDmxShowDirectorPerformanceScene extends LaserDmxShowDirectorPerformanceMutationPayload {
  id: string
  label: string
  enabled: boolean
  section: LaserDmxShowDirectorPerformanceSectionMatch
  priority?: number
  barMatch?: LaserDmxShowDirectorPerformanceSceneBarMatch
  transitionIn?: LaserDmxShowDirectorPerformanceSceneTransition
  transitionOut?: LaserDmxShowDirectorPerformanceSceneTransition
  energyEnvelopeKey?: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey
  blackoutWindows?: LaserDmxShowDirectorProgrammedBlackoutWindow[]
  /** Explicit opt-in for an authored zero-beam scene. Safety/user blackout authority remains external. */
  allowZeroBeamOutput?: boolean
  variations?: LaserDmxShowDirectorPerformanceSceneVariation[]
  beatMutations?: LaserDmxShowDirectorPerformanceBeatMutation[]
  kickMutations?: LaserDmxShowDirectorPerformanceKickMutation[]
  snareMutations?: LaserDmxShowDirectorPerformanceSnareMutation[]
  hatMutations?: LaserDmxShowDirectorPerformanceHatMutation[]
  transientMutations?: LaserDmxShowDirectorPerformanceTransientMutation[]
  barMutations?: LaserDmxShowDirectorPerformanceBarMutation[]
  barProgression?: LaserDmxShowDirectorPerformanceBarProgressionStage[]
  fourBarVariations?: LaserDmxShowDirectorPerformanceFourBarVariation[]
  eightBarRecruitment?: LaserDmxShowDirectorPerformanceEightBarFixtureRecruitmentStage[]
  sixteenBarEvolution?: LaserDmxShowDirectorPerformanceSixteenBarEvolution[]
  sectionEntryMutations?: LaserDmxShowDirectorPerformanceMutationBase[]
  sectionBodyMutations?: LaserDmxShowDirectorPerformanceMutationBase[]
  sectionExitMutations?: LaserDmxShowDirectorPerformanceMutationBase[]
}

export interface LaserDmxShowDirectorPerformanceProgramTuning {
  intensity: number
  variation: number
  audioIntelligenceResponse: number
  transitionScale: number
}

export interface LaserDmxShowDirectorPerformanceRuntimeDiagnosticsMetadata {
  authoringVersion?: string
  createdAt?: string
  updatedAt?: string
  notes?: string[]
  expectedFixtureSemanticKeys?: string[]
  expectedGroupSemanticKeys?: string[]
}

export interface LaserDmxShowDirectorPerformanceProgram {
  schemaVersion: number
  id: string
  name: string
  description?: string
  deterministicSeed: number
  scenes: LaserDmxShowDirectorPerformanceScene[]
  /** Reusable semantic bank roles used by payload addresses. */
  bankRoles?: Record<string, LaserDmxShowDirectorPerformanceAddress>
  /** Rich authored bank metadata. bankRoles remains the compact compatibility address map. */
  fixtureBanks?: Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>
  energyEnvelopes?: Partial<Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserDmxShowDirectorSectionEnergyEnvelope>>
  blackoutPolicy?: LaserDmxShowDirectorPerformanceBlackoutPolicy
  fallbackOrder?: LaserDmxShowDirectorPerformanceSectionType[]
  tuning: LaserDmxShowDirectorPerformanceProgramTuning
  diagnostics?: LaserDmxShowDirectorPerformanceRuntimeDiagnosticsMetadata
}

export type LaserDmxShowDirectorBuiltInPerformanceProgramId =
  | 'prism-cathedral'
  | 'cardinal-fan-reactor'
  | 'cyan-mirror-cage'
  | 'small-club-rig-performance'
  | 'festival-front-beams-performance'
  | 'dubstep-drop-lasers-performance'
  | 'led-bar-grid-performance'
  | 'moving-head-sweep-performance'
  | 'strobe-blinder-hits-performance'
  | 'haze-co2-drops-performance'
  | 'vocal-eclipse-exchange'
  | 'emerald-tunnel-relay'
  | 'white-vector-interlock'
  | 'aurora-canopy-drift'
  | 'chromatic-chapter-stage'
  | 'prismatic-pulse-matrix'
  | 'spectral-ribbon-singularity'
  | 'crimson-apex-protocol'
  | 'violet-hourglass-orbit'
  | 'scarlet-origami-lattice'

export interface LaserDmxShowDirectorBuiltInPerformanceRegistryEntry {
  id: LaserDmxShowDirectorBuiltInPerformanceProgramId
  name: string
  status: 'foundation' | 'available'
  program: LaserDmxShowDirectorPerformanceProgram | null
}

export const LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY: Readonly<Record<
  LaserDmxShowDirectorBuiltInPerformanceProgramId,
  LaserDmxShowDirectorBuiltInPerformanceRegistryEntry
>> = Object.freeze({
  'prism-cathedral': Object.freeze({
    id: 'prism-cathedral',
    name: 'Prism Cathedral',
    status: 'available',
    program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('prism-cathedral', createPrismCathedralProgram()),
  }),
  'cardinal-fan-reactor': Object.freeze({
    id: 'cardinal-fan-reactor',
    name: 'Cardinal Fan Reactor',
    status: 'available',
    program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('cardinal-fan-reactor', createCardinalFanReactorProgram()),
  }),
  'cyan-mirror-cage': Object.freeze({
    id: 'cyan-mirror-cage',
    name: 'Cyan Mirror Cage',
    status: 'available',
    program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('cyan-mirror-cage', createCyanMirrorCageProgram()),
  }),
  'small-club-rig-performance': Object.freeze({ id: 'small-club-rig-performance', name: 'Small Club Performance', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('small-club-rig-performance', createSmallClubPerformanceProgram()) }),
  'festival-front-beams-performance': Object.freeze({ id: 'festival-front-beams-performance', name: 'Festival Front Beams Performance', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('festival-front-beams-performance', createFestivalFrontBeamsPerformanceProgram()) }),
  'dubstep-drop-lasers-performance': Object.freeze({ id: 'dubstep-drop-lasers-performance', name: 'Dubstep Drop Lasers Performance', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('dubstep-drop-lasers-performance', createDubstepDropLasersPerformanceProgram()) }),
  'led-bar-grid-performance': Object.freeze({ id: 'led-bar-grid-performance', name: 'LED Bar Grid Performance', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('led-bar-grid-performance', createLedBarGridPerformanceProgram()) }),
  'moving-head-sweep-performance': Object.freeze({ id: 'moving-head-sweep-performance', name: 'Moving Head Sweep Performance', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('moving-head-sweep-performance', createMovingHeadSweepPerformanceProgram()) }),
  'strobe-blinder-hits-performance': Object.freeze({ id: 'strobe-blinder-hits-performance', name: 'Strobe + Blinder Performance', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('strobe-blinder-hits-performance', createStrobeBlinderPerformanceProgram()) }),
  'haze-co2-drops-performance': Object.freeze({ id: 'haze-co2-drops-performance', name: 'Haze + CO2 Performance', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('haze-co2-drops-performance', createHazeCo2PerformanceProgram()) }),
  'vocal-eclipse-exchange': Object.freeze({ id: 'vocal-eclipse-exchange', name: 'Vocal Eclipse Exchange', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('vocal-eclipse-exchange', createVocalEclipseExchangeProgram()) }),
  'emerald-tunnel-relay': Object.freeze({ id: 'emerald-tunnel-relay', name: 'Emerald Tunnel Relay', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('emerald-tunnel-relay', createEmeraldTunnelRelayProgram()) }),
  'white-vector-interlock': Object.freeze({ id: 'white-vector-interlock', name: 'White Vector Interlock', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('white-vector-interlock', createWhiteVectorInterlockProgram()) }),
  'aurora-canopy-drift': Object.freeze({ id: 'aurora-canopy-drift', name: 'Aurora Canopy Drift', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('aurora-canopy-drift', createAuroraCanopyDriftProgram()) }),
  'chromatic-chapter-stage': Object.freeze({ id: 'chromatic-chapter-stage', name: 'Chromatic Chapter Stage', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('chromatic-chapter-stage', createChromaticChapterStageProgram()) }),
  'prismatic-pulse-matrix': Object.freeze({ id: 'prismatic-pulse-matrix', name: 'Prismatic Pulse Matrix', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('prismatic-pulse-matrix', createPrismaticPulseMatrixProgram()) }),
  'spectral-ribbon-singularity': Object.freeze({ id: 'spectral-ribbon-singularity', name: 'Spectral Ribbon Singularity', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('spectral-ribbon-singularity', createSpectralRibbonSingularityProgram()) }),
  'crimson-apex-protocol': Object.freeze({ id: 'crimson-apex-protocol', name: 'Crimson Apex Protocol', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('crimson-apex-protocol', createCrimsonApexProtocolProgram()) }),
  'violet-hourglass-orbit': Object.freeze({ id: 'violet-hourglass-orbit', name: 'Violet Hourglass Orbit', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('violet-hourglass-orbit', createVioletHourglassOrbitProgram()) }),
  'scarlet-origami-lattice': Object.freeze({ id: 'scarlet-origami-lattice', name: 'Scarlet Origami Lattice', status: 'available', program: migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent('scarlet-origami-lattice', createScarletOrigamiLatticeProgram()) }),
})

export interface LaserDmxShowDirectorPerformanceState {
  schemaVersion: number
  activeProgramId: string | null
  activeBuiltInProgramId: LaserDmxShowDirectorBuiltInPerformanceProgramId | null
  activeProgramDefinition: LaserDmxShowDirectorPerformanceProgram | null
  enabled: boolean
  tuning: LaserDmxShowDirectorPerformanceProgramTuning
  audioIntelligenceEnabled: boolean
  deterministicSeed: number
  fallbackBehavior: LaserDmxShowDirectorPerformanceFallbackBehavior
  activePresetId: string | null
  presetDirty: boolean
  runtimeInvalidationId: string
}

const DEFAULT_TUNING: LaserDmxShowDirectorPerformanceProgramTuning = Object.freeze({
  intensity: 1,
  variation: 1,
  audioIntelligenceResponse: 1,
  transitionScale: 1,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: unknown, fallback: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, finite(value, fallback)))
}

function positiveInt(value: unknown, fallback: number, max = 0x7fffffff): number {
  return Math.max(0, Math.min(max, Math.round(finite(value, fallback))))
}

function cleanString(value: unknown, fallback = '', max = 160): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback
}

function cleanStringArray(value: unknown, max = 128): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.map(item => cleanString(item)).filter(Boolean))).slice(0, max)
    : []
}

function isSectionType(value: unknown): value is LaserDmxShowDirectorPerformanceSectionType {
  return value === 'intro'
    || value === 'verse'
    || value === 'build'
    || value === 'preDrop'
    || value === 'drop'
    || value === 'breakdown'
    || value === 'bridge'
    || value === 'outro'
    || value === 'unknown'
}

function isBuiltInId(value: unknown): value is LaserDmxShowDirectorBuiltInPerformanceProgramId {
  return value === 'prism-cathedral'
    || value === 'cardinal-fan-reactor'
    || value === 'cyan-mirror-cage'
    || value === 'small-club-rig-performance'
    || value === 'festival-front-beams-performance'
    || value === 'dubstep-drop-lasers-performance'
    || value === 'led-bar-grid-performance'
    || value === 'moving-head-sweep-performance'
    || value === 'strobe-blinder-hits-performance'
    || value === 'haze-co2-drops-performance'
}

export function normalizeLaserDmxShowDirectorPerformanceTuning(
  raw: unknown,
): LaserDmxShowDirectorPerformanceProgramTuning {
  const value = isRecord(raw) ? raw : {}
  return {
    intensity: clamp(value.intensity, DEFAULT_TUNING.intensity, 0, 2),
    variation: clamp(value.variation, DEFAULT_TUNING.variation, 0, 2),
    audioIntelligenceResponse: clamp(value.audioIntelligenceResponse, DEFAULT_TUNING.audioIntelligenceResponse, 0, 2),
    transitionScale: clamp(value.transitionScale, DEFAULT_TUNING.transitionScale, 0, 4),
  }
}

function normalizeOccurrence(raw: unknown): LaserDmxShowDirectorPerformanceOccurrenceMatch | undefined {
  if (!isRecord(raw)) return undefined
  const occurrences = Array.isArray(raw.occurrences)
    ? Array.from(new Set(raw.occurrences.map(item => positiveInt(item, 0, 1024)).filter(item => item > 0))).sort((a, b) => a - b)
    : undefined
  const minOccurrence = positiveInt(raw.minOccurrence, 0, 1024) || undefined
  const maxOccurrence = positiveInt(raw.maxOccurrence, 0, 1024) || undefined
  const every = positiveInt(raw.every, 0, 1024) || undefined
  if (!occurrences?.length && !minOccurrence && !maxOccurrence && !every) return undefined
  return { occurrences, minOccurrence, maxOccurrence, every }
}

function normalizeSectionMatch(raw: unknown): LaserDmxShowDirectorPerformanceSectionMatch {
  const value = isRecord(raw) ? raw : {}
  const types = Array.isArray(value.types) ? value.types.filter(isSectionType) : []
  return {
    types: types.length > 0 ? Array.from(new Set(types)) : ['unknown'],
    sectionIds: cleanStringArray(value.sectionIds),
    occurrence: normalizeOccurrence(value.occurrence),
    dropOccurrence: normalizeOccurrence(value.dropOccurrence),
    minConfidence: value.minConfidence == null ? undefined : clamp(value.minConfidence, 0, 0, 1),
  }
}

const FIXTURE_KINDS = new Set<LaserDmxShowDirectorFixtureKind>([
  'laser', 'movingHead', 'ledBar', 'ledTube', 'strobe', 'blinder', 'parWash', 'videoWall', 'haze', 'co2Jet',
])
const CONDITION_OPERATORS = new Set<LaserDmxShowDirectorPerformanceConditionOperator>([
  'gt', 'gte', 'lt', 'lte', 'eq', 'notEq', 'between', 'truthy', 'falsy',
])
const MUTATION_MODES = new Set<LaserDmxShowDirectorPerformanceMutationMode>(['set', 'add', 'multiply', 'toggle'])
const TRANSITION_CURVES = new Set<LaserDmxShowDirectorPerformanceTransitionCurve>(['linear', 'easeIn', 'easeOut', 'easeInOut', 'step'])
const ENERGY_ENVELOPE_KEYS = new Set<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey>([
  'intro', 'verse', 'build', 'preDrop', 'drop1', 'breakdown', 'drop2', 'outro',
])
const BLACKOUT_KINDS = new Set<LaserDmxShowDirectorProgrammedBlackoutKind>(['preDrop', 'impactCut', 'fakeout'])
const BLACKOUT_ANCHORS = new Set<LaserDmxShowDirectorProgrammedBlackoutAnchor>(['sectionStart', 'sectionEnd'])
const TARGET_MODES = new Set<LaserDmxShowDirectorBeamConfig['targetMode']>(['fixed', 'fan', 'sweep', 'cross', 'mirror', 'audioReactive'])
const MIRROR_AXES = new Set<LaserDmxShowDirectorMirrorAxis>(['horizontal', 'vertical'])
const PRIORITY_ROLES = new Set<LaserDmxShowDirectorBeamPriorityRole>([
  'heroImpact', 'primaryArchitecture', 'secondaryFan', 'detailLattice', 'decorativeAccent',
])
const VISUAL_ROLES = new Set<LaserDmxMatrixBeamVisualRole>(['hero', 'primary', 'secondary', 'texture', 'impact'])
const TRIGGER_MODES = new Set<LaserDmxShowDirectorTriggerConfig['mode']>([
  'alwaysOn', 'beat', 'bar', 'phrase', 'section', 'cuePoint', 'bassHit', 'snareTransient', 'energy', 'audioBand',
])
const TRIGGER_QUANTIZE = new Set<LaserDmxShowDirectorTriggerConfig['quantize']>(['none', 'beat', 'bar', 'phrase', 'section'])
const TRIGGER_RETRIGGER = new Set<LaserDmxShowDirectorTriggerConfig['retrigger']>(['allow', 'oncePerBeat', 'oncePerBar', 'oncePerPhrase'])
const BEAT_DIVISIONS = new Set<LaserDmxShowDirectorTriggerConfig['beatDivision']>([0.25, 0.5, 1, 2, 4, 8])
const AUDIO_BANDS = new Set<LaserDmxShowDirectorTriggerConfig['audioBand']>(['sub', 'bass', 'lowMid', 'mid', 'highMid', 'high'])
const BEAM_GEOMETRIES = new Set<LaserDmxMatrixBeamAppearance['geometry']>(['line', 'volumetricCone'])
const TRAVEL_MODES = new Set<LaserDmxBeamMotion['mode']>(['static', 'grow', 'projectile', 'scanner', 'pulseTrain'])
const TRAVEL_EASINGS = new Set<LaserDmxBeamMotion['easing']>(['linear', 'easeIn', 'easeOut', 'easeInOut'])
const TRAVEL_RETRIGGER = new Set<LaserDmxBeamMotion['retrigger']>(['restart', 'continue', 'queue'])
const LED_DIRECTIONS = new Set<LaserDmxShowDirectorFixtureSpecificConfig['ledDirection']>(['leftToRight', 'rightToLeft', 'centerOut', 'edgesIn', 'chase'])
const PAN_TILT_STYLES = new Set<LaserDmxShowDirectorFixtureSpecificConfig['movingHeadPanTiltStyle']>(['locked', 'smoothSweep', 'snap', 'figureEight', 'audioReactive'])
const VIDEO_WALL_SOURCES = new Set<LaserDmxShowDirectorFixtureSpecificConfig['videoWallSource']>(['placeholder', 'reactVisual', 'media', 'camera'])

function optionalFinite(value: unknown, min: number, max: number): number | undefined {
  const parsed = finite(value, Number.NaN)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : undefined
}

function optionalInt(value: unknown, min: number, max: number): number | undefined {
  const parsed = optionalFinite(value, min, max)
  return parsed == null ? undefined : Math.round(parsed)
}

function normalizeAddress(raw: unknown): LaserDmxShowDirectorPerformanceAddress | undefined {
  if (!isRecord(raw)) return undefined
  const fixtureSemanticKeys = cleanStringArray(raw.fixtureSemanticKeys)
  const groupSemanticKeys = cleanStringArray(raw.groupSemanticKeys)
  const fixtureIds = cleanStringArray(raw.fixtureIds)
  const mirroredGroupKeys = cleanStringArray(raw.mirroredGroupKeys)
  const bankRoles = cleanStringArray(raw.bankRoles)
  const fixtureKinds = Array.isArray(raw.fixtureKinds)
    ? Array.from(new Set(raw.fixtureKinds.filter((value): value is LaserDmxShowDirectorFixtureKind => FIXTURE_KINDS.has(value as LaserDmxShowDirectorFixtureKind))))
    : []
  const match = raw.match === 'all' ? 'all' : raw.match === 'any' ? 'any' : undefined
  if (!fixtureSemanticKeys.length && !groupSemanticKeys.length && !fixtureIds.length && !fixtureKinds.length && !mirroredGroupKeys.length && !bankRoles.length && !match) return undefined
  return {
    ...(fixtureSemanticKeys.length ? { fixtureSemanticKeys } : {}),
    ...(groupSemanticKeys.length ? { groupSemanticKeys } : {}),
    ...(fixtureKinds.length ? { fixtureKinds } : {}),
    ...(fixtureIds.length ? { fixtureIds } : {}),
    ...(mirroredGroupKeys.length ? { mirroredGroupKeys } : {}),
    ...(bankRoles.length ? { bankRoles } : {}),
    ...(match ? { match } : {}),
  }
}

function normalizeCondition(raw: unknown): LaserDmxShowDirectorMusicIntelligenceCondition | null {
  if (!isRecord(raw)) return null
  const source = cleanString(raw.source, '', 128)
  const operator = CONDITION_OPERATORS.has(raw.operator as LaserDmxShowDirectorPerformanceConditionOperator)
    ? raw.operator as LaserDmxShowDirectorPerformanceConditionOperator
    : null
  if (!source || !operator) return null
  const value = typeof raw.value === 'number' || typeof raw.value === 'boolean' || typeof raw.value === 'string'
    ? raw.value
    : undefined
  return {
    source,
    operator,
    ...(value !== undefined ? { value } : {}),
    ...(optionalFinite(raw.maxValue, -1_000_000, 1_000_000) != null ? { maxValue: optionalFinite(raw.maxValue, -1_000_000, 1_000_000) } : {}),
    ...(optionalFinite(raw.minConfidence, 0, 1) != null ? { minConfidence: optionalFinite(raw.minConfidence, 0, 1) } : {}),
    ...(cleanString(raw.requiredCapability, '', 96) ? { requiredCapability: cleanString(raw.requiredCapability, '', 96) } : {}),
    ...(raw.invert === true ? { invert: true } : {}),
  }
}

function normalizeConditions(raw: unknown): LaserDmxShowDirectorMusicIntelligenceCondition[] {
  return Array.isArray(raw)
    ? raw.map(normalizeCondition).filter((value): value is LaserDmxShowDirectorMusicIntelligenceCondition => value !== null).slice(0, 128)
    : []
}

function normalizeModulation(raw: unknown): LaserDmxShowDirectorMusicIntelligenceModulationReference | null {
  if (!isRecord(raw)) return null
  const source = cleanString(raw.source, '', 128)
  const target = cleanString(raw.target, '', 128)
  const amount = optionalFinite(raw.amount, -1_000_000, 1_000_000)
  if (!source || !target || amount == null) return null
  const mode = MUTATION_MODES.has(raw.mode as LaserDmxShowDirectorPerformanceMutationMode)
    ? raw.mode as LaserDmxShowDirectorPerformanceMutationMode
    : undefined
  const curve = TRANSITION_CURVES.has(raw.curve as LaserDmxShowDirectorPerformanceTransitionCurve)
    ? raw.curve as LaserDmxShowDirectorPerformanceTransitionCurve
    : undefined
  return {
    source,
    target,
    amount,
    ...(optionalFinite(raw.min, -1_000_000, 1_000_000) != null ? { min: optionalFinite(raw.min, -1_000_000, 1_000_000) } : {}),
    ...(optionalFinite(raw.max, -1_000_000, 1_000_000) != null ? { max: optionalFinite(raw.max, -1_000_000, 1_000_000) } : {}),
    ...(mode ? { mode } : {}),
    ...(curve ? { curve } : {}),
    ...(cleanString(raw.requiredCapability, '', 96) ? { requiredCapability: cleanString(raw.requiredCapability, '', 96) } : {}),
    ...(optionalFinite(raw.minConfidence, 0, 1) != null ? { minConfidence: optionalFinite(raw.minConfidence, 0, 1) } : {}),
  }
}

function normalizeTargetPoints(raw: unknown): LaserDmxShowDirectorBeamConfig['targets'] | undefined {
  if (!Array.isArray(raw)) return undefined
  const points = raw.flatMap((item, index) => {
    if (!isRecord(item)) return []
    const x = optionalFinite(item.x, -1024, 1024)
    const y = optionalFinite(item.y, -1024, 1024)
    if (x == null || y == null) return []
    return [{ id: cleanString(item.id, `target-${index + 1}`, 96), x, y }]
  }).slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
  return points.length ? points : undefined
}

function normalizeTargetPointsByFixtureSemanticKey(
  raw: unknown,
): LaserDmxShowDirectorFixtureRuntimeOverrides['targetPointsByFixtureSemanticKey'] | undefined {
  if (!isRecord(raw)) return undefined
  const entries = Object.entries(raw).slice(0, 512).flatMap(([rawKey, rawTargets]) => {
    const key = cleanString(rawKey, '', 128)
    const targets = normalizeTargetPoints(rawTargets)
    return key && targets ? [[key, targets] as const] : []
  })
  return entries.length ? Object.fromEntries(entries) : undefined
}

function normalizeTrigger(raw: unknown): Partial<LaserDmxShowDirectorTriggerConfig> | undefined {
  if (!isRecord(raw)) return undefined
  const trigger: Partial<LaserDmxShowDirectorTriggerConfig> = {}
  if (TRIGGER_MODES.has(raw.mode as LaserDmxShowDirectorTriggerConfig['mode'])) trigger.mode = raw.mode as LaserDmxShowDirectorTriggerConfig['mode']
  if (TRIGGER_QUANTIZE.has(raw.quantize as LaserDmxShowDirectorTriggerConfig['quantize'])) trigger.quantize = raw.quantize as LaserDmxShowDirectorTriggerConfig['quantize']
  if (TRIGGER_RETRIGGER.has(raw.retrigger as LaserDmxShowDirectorTriggerConfig['retrigger'])) trigger.retrigger = raw.retrigger as LaserDmxShowDirectorTriggerConfig['retrigger']
  if (BEAT_DIVISIONS.has(raw.beatDivision as LaserDmxShowDirectorTriggerConfig['beatDivision'])) trigger.beatDivision = raw.beatDivision as LaserDmxShowDirectorTriggerConfig['beatDivision']
  const barInterval = optionalInt(raw.barInterval, 1, 1024); if (barInterval != null) trigger.barInterval = barInterval
  const phraseLengthBars = optionalInt(raw.phraseLengthBars, 1, 1024); if (phraseLengthBars != null) trigger.phraseLengthBars = phraseLengthBars
  const sectionTypes = Array.isArray(raw.sectionTypes) ? Array.from(new Set(raw.sectionTypes.filter(isSectionType))) : []
  if (sectionTypes.length) trigger.sectionTypes = sectionTypes
  const cuePointIds = cleanStringArray(raw.cuePointIds); if (cuePointIds.length) trigger.cuePointIds = cuePointIds
  const energyThreshold = optionalFinite(raw.energyThreshold, 0, 1); if (energyThreshold != null) trigger.energyThreshold = energyThreshold
  if (AUDIO_BANDS.has(raw.audioBand as LaserDmxShowDirectorTriggerConfig['audioBand'])) trigger.audioBand = raw.audioBand as LaserDmxShowDirectorTriggerConfig['audioBand']
  const audioThreshold = optionalFinite(raw.audioThreshold, 0, 1); if (audioThreshold != null) trigger.audioThreshold = audioThreshold
  const fadeInMs = optionalFinite(raw.fadeInMs, 0, 120_000); if (fadeInMs != null) trigger.fadeInMs = fadeInMs
  const fadeOutMs = optionalFinite(raw.fadeOutMs, 0, 120_000); if (fadeOutMs != null) trigger.fadeOutMs = fadeOutMs
  return Object.keys(trigger).length ? trigger : undefined
}

function normalizeBeamAppearance(raw: unknown): Partial<LaserDmxMatrixBeamAppearance> | undefined {
  if (!isRecord(raw)) return undefined
  const appearance: Partial<LaserDmxMatrixBeamAppearance> = {}
  const dimmer = optionalFinite(raw.dimmer, 0, 1); if (dimmer != null) appearance.dimmer = dimmer
  if (typeof raw.shutterOpen === 'boolean') appearance.shutterOpen = raw.shutterOpen
  const width = optionalFinite(raw.width, 0.1, 8); if (width != null) appearance.width = width
  const focus = optionalFinite(raw.focus, 0, 1); if (focus != null) appearance.focus = focus
  const strobeRate = optionalFinite(raw.strobeRate, 0, 1); if (strobeRate != null) appearance.strobeRate = strobeRate
  const flickerAmount = optionalFinite(raw.flickerAmount, 0, 1); if (flickerAmount != null) appearance.flickerAmount = flickerAmount
  const divergence = optionalFinite(raw.divergence, 0, 1); if (divergence != null) appearance.divergence = divergence
  const glow = optionalFinite(raw.glow, 0, 1); if (glow != null) appearance.glow = glow
  if (BEAM_GEOMETRIES.has(raw.geometry as LaserDmxMatrixBeamAppearance['geometry'])) appearance.geometry = raw.geometry as LaserDmxMatrixBeamAppearance['geometry']
  return Object.keys(appearance).length ? appearance : undefined
}

function normalizeBeamTravel(raw: unknown): Partial<LaserDmxBeamMotion> | undefined {
  if (!isRecord(raw)) return undefined
  const travel: Partial<LaserDmxBeamMotion> = {}
  if (raw.mode === 'pingPong') travel.mode = 'grow'
  else if (TRAVEL_MODES.has(raw.mode as LaserDmxBeamMotion['mode'])) travel.mode = raw.mode as LaserDmxBeamMotion['mode']
  const beatsPerTravel = optionalFinite(raw.beatsPerTravel, 0.25, 16); if (beatsPerTravel != null) travel.beatsPerTravel = beatsPerTravel
  const phaseOffset = optionalFinite(raw.phaseOffset, 0, 1); if (phaseOffset != null) travel.phaseOffset = phaseOffset
  if (typeof raw.direction === 'string') travel.direction = 'forward'
  const tailLength = optionalFinite(raw.tailLength, 0, 1); if (tailLength != null) travel.tailLength = tailLength
  const headGlow = optionalFinite(raw.headGlow, 0, 1); if (headGlow != null) travel.headGlow = headGlow
  if (TRAVEL_EASINGS.has(raw.easing as LaserDmxBeamMotion['easing'])) travel.easing = raw.easing as LaserDmxBeamMotion['easing']
  if (TRAVEL_RETRIGGER.has(raw.retrigger as LaserDmxBeamMotion['retrigger'])) travel.retrigger = raw.retrigger as LaserDmxBeamMotion['retrigger']
  return Object.keys(travel).length ? travel : undefined
}

function normalizeComponent(raw: unknown): Partial<LaserDmxShowDirectorFixtureSpecificConfig> | undefined {
  if (!isRecord(raw)) return undefined
  const component: Partial<LaserDmxShowDirectorFixtureSpecificConfig> = {}
  const strobeRate = optionalFinite(raw.strobeRate, 0, 1); if (strobeRate != null) component.strobeRate = strobeRate
  const ledCellCount = optionalInt(raw.ledCellCount, 1, 512); if (ledCellCount != null) component.ledCellCount = ledCellCount
  if (LED_DIRECTIONS.has(raw.ledDirection as LaserDmxShowDirectorFixtureSpecificConfig['ledDirection'])) component.ledDirection = raw.ledDirection as LaserDmxShowDirectorFixtureSpecificConfig['ledDirection']
  if (PAN_TILT_STYLES.has(raw.movingHeadPanTiltStyle as LaserDmxShowDirectorFixtureSpecificConfig['movingHeadPanTiltStyle'])) component.movingHeadPanTiltStyle = raw.movingHeadPanTiltStyle as LaserDmxShowDirectorFixtureSpecificConfig['movingHeadPanTiltStyle']
  const hazeIntensity = optionalFinite(raw.hazeIntensity, 0, 1); if (hazeIntensity != null) component.hazeIntensity = hazeIntensity
  const co2BurstDurationMs = optionalFinite(raw.co2BurstDurationMs, 0, 120_000); if (co2BurstDurationMs != null) component.co2BurstDurationMs = co2BurstDurationMs
  const videoWallBrightness = optionalFinite(raw.videoWallBrightness, 0, 1); if (videoWallBrightness != null) component.videoWallBrightness = videoWallBrightness
  if (VIDEO_WALL_SOURCES.has(raw.videoWallSource as LaserDmxShowDirectorFixtureSpecificConfig['videoWallSource'])) component.videoWallSource = raw.videoWallSource as LaserDmxShowDirectorFixtureSpecificConfig['videoWallSource']
  return Object.keys(component).length ? component : undefined
}

function normalizeScannerOverrides(raw: unknown): LaserDmxShowDirectorScannerRuntimeOverrides | undefined {
  if (!isRecord(raw)) return undefined
  const scanner: LaserDmxShowDirectorScannerRuntimeOverrides = {}
  const patternTypes = new Set(['holdBeam', 'lineSweep', 'fanSweep', 'circle', 'arc', 'triangle', 'polygon', 'wave', 'tunnel', 'mirroredCorridor', 'gridScan', 'customPath', 'diffractionLine', 'diffractionGrid', 'diffractionBurst'])
  const directions = new Set(['forward', 'reverse', 'alternating'])
  const opticalModes = new Set(['normal', 'prism', 'lineDiffraction', 'gridDiffraction', 'burstDiffraction'])
  const boundaries = new Set(['immediate', 'beat', 'bar', 'phrase', 'section'])
  if (patternTypes.has(String(raw.patternType))) scanner.patternType = raw.patternType as LaserDmxShowDirectorScannerRuntimeOverrides['patternType']
  const scanRatePps = optionalFinite(raw.scanRatePps, 10, 100_000); if (scanRatePps != null) scanner.scanRatePps = scanRatePps
  const durationBeats = optionalFinite(raw.durationBeats, 0.0625, 128); if (durationBeats != null) scanner.durationBeats = durationBeats
  if (directions.has(String(raw.direction))) scanner.direction = raw.direction as LaserDmxShowDirectorScannerRuntimeOverrides['direction']
  if (typeof raw.reversePath === 'boolean') scanner.reversePath = raw.reversePath
  const phase = optionalFinite(raw.phase, 0, 1); if (phase != null) scanner.phase = phase
  const fanWidth = optionalFinite(raw.fanWidth, 0, 180); if (fanWidth != null) scanner.fanWidth = fanWidth
  const radius = optionalFinite(raw.radius, 0, 1); if (radius != null) scanner.radius = radius
  const size = optionalFinite(raw.size, 0, 1); if (size != null) scanner.size = size
  if (['auto', 'cameraFacingAir', 'frontAir', 'midAir', 'deepAir', 'upperAir', 'lowerAir'].includes(String(raw.depthLayer))) scanner.depthLayer = raw.depthLayer as LaserDmxShowDirectorScannerRuntimeOverrides['depthLayer']
  if (typeof raw.retraceBlanking === 'boolean') scanner.retraceBlanking = raw.retraceBlanking
  if (opticalModes.has(String(raw.opticalMode))) scanner.opticalMode = raw.opticalMode as LaserDmxShowDirectorScannerRuntimeOverrides['opticalMode']
  const opticalCopyCount = optionalFinite(raw.opticalCopyCount, 1, 25); if (opticalCopyCount != null) scanner.opticalCopyCount = Math.round(opticalCopyCount)
  if (typeof raw.shutterClosed === 'boolean') scanner.shutterClosed = raw.shutterClosed
  if (typeof raw.heldBeam === 'boolean') scanner.heldBeam = raw.heldBeam
  const pathResetToken = optionalFinite(raw.pathResetToken, 0, Number.MAX_SAFE_INTEGER); if (pathResetToken != null) scanner.pathResetToken = Math.round(pathResetToken)
  if (boundaries.has(String(raw.switchBoundary))) scanner.switchBoundary = raw.switchBoundary as LaserDmxShowDirectorScannerRuntimeOverrides['switchBoundary']
  return Object.keys(scanner).length ? scanner : undefined
}

function normalizeMixedFixtureAction(raw: unknown, index: number): LaserDmxShowDirectorMixedFixtureAction | null {
  if (!isRecord(raw)) return null
  const id = cleanString(raw.id, `fixture-action-${index + 1}`, 96)
  const kind = cleanString(raw.kind, '', 32)
  if (!id || !['scanner', 'beam', 'movingHead', 'led', 'strobe', 'blinder', 'wash', 'haze', 'co2'].includes(kind)) return null
  const common = {
    id,
    ...(typeof raw.enabled === 'boolean' ? { enabled: raw.enabled } : {}),
    ...(optionalFinite(raw.brightness, 0, 2) != null ? { brightness: optionalFinite(raw.brightness, 0, 2) } : {}),
    ...(cleanString(raw.color, '', 64) ? { color: cleanString(raw.color, '', 64) } : {}),
  }
  if (kind === 'scanner') {
    return { ...common, kind, ...normalizeScannerOverrides(raw) }
  }
  if (kind === 'beam') {
    return {
      ...common, kind,
      ...(TARGET_MODES.has(raw.targetMode as LaserDmxShowDirectorBeamConfig['targetMode']) ? { targetMode: raw.targetMode as LaserDmxShowDirectorBeamConfig['targetMode'] } : {}),
      ...(normalizeTargetPoints(raw.targetPoints) ? { targetPoints: normalizeTargetPoints(raw.targetPoints) } : {}),
      ...(isRecord(raw.targetPosition) && optionalFinite(raw.targetPosition.x, -1024, 1024) != null && optionalFinite(raw.targetPosition.y, -1024, 1024) != null ? { targetPosition: { x: optionalFinite(raw.targetPosition.x, -1024, 1024)!, y: optionalFinite(raw.targetPosition.y, -1024, 1024)!, ...(optionalFinite(raw.targetPosition.z, -1, 1) != null ? { z: optionalFinite(raw.targetPosition.z, -1, 1) } : {}) } } : {}),
      ...(optionalFinite(raw.fanSpread, 0, 180) != null ? { fanSpread: optionalFinite(raw.fanSpread, 0, 180) } : {}),
      ...(optionalFinite(raw.focus, 0, 1) != null ? { focus: optionalFinite(raw.focus, 0, 1) } : {}),
      ...(VISUAL_ROLES.has(raw.beamVisualRole as LaserDmxMatrixBeamVisualRole) ? { beamVisualRole: raw.beamVisualRole as LaserDmxMatrixBeamVisualRole } : {}),
      ...(PRIORITY_ROLES.has(raw.beamPriorityRole as LaserDmxShowDirectorBeamPriorityRole) ? { beamPriorityRole: raw.beamPriorityRole as LaserDmxShowDirectorBeamPriorityRole } : {}),
      ...(normalizeBeamAppearance(raw.beamAppearance) ? { beamAppearance: normalizeBeamAppearance(raw.beamAppearance) } : {}),
      ...(normalizeBeamTravel(raw.beamTravel) ? { beamTravel: normalizeBeamTravel(raw.beamTravel) } : {}),
    }
  }
  if (kind === 'movingHead') return { ...common, kind, ...(TARGET_MODES.has(raw.targetMode as LaserDmxShowDirectorBeamConfig['targetMode']) ? { targetMode: raw.targetMode as LaserDmxShowDirectorBeamConfig['targetMode'] } : {}), ...(normalizeTargetPoints(raw.targetPoints) ? { targetPoints: normalizeTargetPoints(raw.targetPoints) } : {}), ...(optionalFinite(raw.fanSpread, 0, 180) != null ? { fanSpread: optionalFinite(raw.fanSpread, 0, 180) } : {}), ...(optionalFinite(raw.focus, 0, 1) != null ? { focus: optionalFinite(raw.focus, 0, 1) } : {}), ...(optionalFinite(raw.rotation, -720, 720) != null ? { rotation: optionalFinite(raw.rotation, -720, 720) } : {}), ...(PAN_TILT_STYLES.has(raw.movementStyle as LaserDmxShowDirectorFixtureSpecificConfig['movingHeadPanTiltStyle']) ? { movementStyle: raw.movementStyle as LaserDmxShowDirectorFixtureSpecificConfig['movingHeadPanTiltStyle'] } : {}) }
  if (kind === 'led') return { ...common, kind, ...(LED_DIRECTIONS.has(raw.direction as LaserDmxShowDirectorFixtureSpecificConfig['ledDirection']) ? { direction: raw.direction as LaserDmxShowDirectorFixtureSpecificConfig['ledDirection'] } : {}) }
  if (kind === 'strobe') return { ...common, kind, ...(typeof raw.active === 'boolean' ? { active: raw.active } : {}), ...(optionalFinite(raw.rateHz, 0, 30) != null ? { rateHz: optionalFinite(raw.rateHz, 0, 30) } : {}), ...(optionalFinite(raw.durationMs, 1, 10_000) != null ? { durationMs: optionalFinite(raw.durationMs, 1, 10_000) } : {}) }
  if (kind === 'blinder') return { ...common, kind, ...(typeof raw.active === 'boolean' ? { active: raw.active } : {}), ...(optionalFinite(raw.durationMs, 1, 10_000) != null ? { durationMs: optionalFinite(raw.durationMs, 1, 10_000) } : {}) }
  if (kind === 'wash') return { ...common, kind, ...(optionalFinite(raw.fanSpread, 0, 180) != null ? { fanSpread: optionalFinite(raw.fanSpread, 0, 180) } : {}), ...(optionalFinite(raw.focus, 0, 1) != null ? { focus: optionalFinite(raw.focus, 0, 1) } : {}) }
  if (kind === 'haze') return { ...common, kind, ...(optionalFinite(raw.amount, 0, 1) != null ? { amount: optionalFinite(raw.amount, 0, 1) } : {}) }
  return { ...common, kind: 'co2', ...(typeof raw.active === 'boolean' ? { active: raw.active } : {}), ...(optionalFinite(raw.burstStrength, 0, 1) != null ? { burstStrength: optionalFinite(raw.burstStrength, 0, 1) } : {}), ...(optionalFinite(raw.durationMs, 1, 10_000) != null ? { durationMs: optionalFinite(raw.durationMs, 1, 10_000) } : {}) }
}

function normalizeFixtureOverrides(raw: unknown): LaserDmxShowDirectorFixtureRuntimeOverrides | undefined {
  if (!isRecord(raw)) return undefined
  const fixture: LaserDmxShowDirectorFixtureRuntimeOverrides = {}
  if (typeof raw.enabled === 'boolean') fixture.enabled = raw.enabled
  const brightness = optionalFinite(raw.brightness, 0, 2); if (brightness != null) fixture.brightness = brightness
  const color = cleanString(raw.color, '', 64); if (color) fixture.color = color
  const beamAngle = optionalFinite(raw.beamAngle, -360, 360); if (beamAngle != null) fixture.beamAngle = beamAngle
  const fanSpread = optionalFinite(raw.fanSpread, 0, 180); if (fanSpread != null) fixture.fanSpread = fanSpread
  const focus = optionalFinite(raw.focus, 0, 1); if (focus != null) fixture.focus = focus
  if (TARGET_MODES.has(raw.targetMode as LaserDmxShowDirectorBeamConfig['targetMode'])) fixture.targetMode = raw.targetMode as LaserDmxShowDirectorBeamConfig['targetMode']
  const targetPoints = normalizeTargetPoints(raw.targetPoints); if (targetPoints) fixture.targetPoints = targetPoints
  const targetPointsByFixtureSemanticKey = normalizeTargetPointsByFixtureSemanticKey(raw.targetPointsByFixtureSemanticKey); if (targetPointsByFixtureSemanticKey) fixture.targetPointsByFixtureSemanticKey = targetPointsByFixtureSemanticKey
  if (isRecord(raw.targetPosition)) {
    const x = optionalFinite(raw.targetPosition.x, -1024, 1024)
    const y = optionalFinite(raw.targetPosition.y, -1024, 1024)
    const z = optionalFinite(raw.targetPosition.z, -1, 1)
    if (x != null && y != null) fixture.targetPosition = { x, y, ...(z != null ? { z } : {}) }
  }
  const rotation = optionalFinite(raw.rotation, -720, 720); if (rotation != null) fixture.rotation = rotation
  if (raw.mirrorAxis === null || MIRROR_AXES.has(raw.mirrorAxis as LaserDmxShowDirectorMirrorAxis)) fixture.mirrorAxis = raw.mirrorAxis as LaserDmxShowDirectorMirrorAxis | null
  const trigger = normalizeTrigger(raw.trigger); if (trigger) fixture.trigger = trigger
  const beamAppearance = normalizeBeamAppearance(raw.beamAppearance); if (beamAppearance) fixture.beamAppearance = beamAppearance
  if (VISUAL_ROLES.has(raw.beamVisualRole as LaserDmxMatrixBeamVisualRole)) fixture.beamVisualRole = raw.beamVisualRole as LaserDmxMatrixBeamVisualRole
  const beamTravel = normalizeBeamTravel(raw.beamTravel); if (beamTravel) fixture.beamTravel = beamTravel
  const component = normalizeComponent(raw.component); if (component) fixture.component = component
  const participatingGroupSemanticKeys = cleanStringArray(raw.participatingGroupSemanticKeys)
  if (participatingGroupSemanticKeys.length) fixture.participatingGroupSemanticKeys = participatingGroupSemanticKeys
  if (PRIORITY_ROLES.has(raw.beamPriorityRole as LaserDmxShowDirectorBeamPriorityRole)) fixture.beamPriorityRole = raw.beamPriorityRole as LaserDmxShowDirectorBeamPriorityRole
  const scanner = normalizeScannerOverrides(raw.scanner); if (scanner) fixture.scanner = scanner
  return Object.keys(fixture).length ? fixture : undefined
}

function normalizeGroupOverrides(raw: unknown): LaserDmxShowDirectorGroupRuntimeOverrides | undefined {
  if (!isRecord(raw)) return undefined
  const group: LaserDmxShowDirectorGroupRuntimeOverrides = {}
  if (typeof raw.enabled === 'boolean') group.enabled = raw.enabled
  if (typeof raw.participating === 'boolean') group.participating = raw.participating
  const dimmer = optionalFinite(raw.dimmer, 0, 2); if (dimmer != null) group.dimmer = dimmer
  const color = cleanString(raw.color, '', 64); if (color) group.color = color
  if (typeof raw.muted === 'boolean') group.muted = raw.muted
  if (typeof raw.soloed === 'boolean') group.soloed = raw.soloed
  return Object.keys(group).length ? group : undefined
}

function normalizeGlobalOverrides(raw: unknown): LaserDmxShowDirectorGlobalOutputOverrides | undefined {
  if (!isRecord(raw)) return undefined
  const global: LaserDmxShowDirectorGlobalOutputOverrides = {}
  if (typeof raw.blackout === 'boolean') global.blackout = raw.blackout
  const dimmer = optionalFinite(raw.dimmer, 0, 1); if (dimmer != null) global.dimmer = dimmer
  const haze = optionalFinite(raw.haze, 0, 1); if (haze != null) global.haze = haze
  const backgroundFade = optionalFinite(raw.backgroundFade, 0, 1); if (backgroundFade != null) global.backgroundFade = backgroundFade
  const beamPersistence = optionalFinite(raw.beamPersistence, 0, 1); if (beamPersistence != null) global.beamPersistence = beamPersistence
  const globalBeamWidth = optionalFinite(raw.globalBeamWidth, 0.1, 6); if (globalBeamWidth != null) global.globalBeamWidth = globalBeamWidth
  const globalGlow = optionalFinite(raw.globalGlow, 0, 1); if (globalGlow != null) global.globalGlow = globalGlow
  const globalStrobeRate = optionalFinite(raw.globalStrobeRate, 0, 1); if (globalStrobeRate != null) global.globalStrobeRate = globalStrobeRate
  return Object.keys(global).length ? global : undefined
}

function normalizePayload(raw: unknown): LaserDmxShowDirectorPerformanceMutationPayload {
  if (!isRecord(raw)) return {}
  const address = normalizeAddress(raw.address)
  const fixture = normalizeFixtureOverrides(raw.fixture)
  const fixtureActions = Array.isArray(raw.fixtureActions)
    ? raw.fixtureActions.map(normalizeMixedFixtureAction).filter((value): value is LaserDmxShowDirectorMixedFixtureAction => value !== null).slice(0, 64)
    : []
  const group = normalizeGroupOverrides(raw.group)
  const global = normalizeGlobalOverrides(raw.global)
  const conditions = normalizeConditions(raw.conditions)
  const modulations = Array.isArray(raw.modulations)
    ? raw.modulations.map(normalizeModulation).filter((value): value is LaserDmxShowDirectorMusicIntelligenceModulationReference => value !== null).slice(0, 128)
    : []
  return {
    ...(address ? { address } : {}),
    ...(fixture ? { fixture } : {}),
    ...(fixtureActions.length ? { fixtureActions } : {}),
    ...(group ? { group } : {}),
    ...(global ? { global } : {}),
    ...(conditions.length ? { conditions } : {}),
    ...(modulations.length ? { modulations } : {}),
  }
}

function normalizeMutationBase(raw: unknown, fallbackId: string): LaserDmxShowDirectorPerformanceMutationBase | null {
  if (!isRecord(raw)) return null
  const id = cleanString(raw.id, fallbackId, 96)
  if (!id) return null
  const probability = raw.probability == null ? undefined : optionalFinite(raw.probability, 0, 1)
  const seedOffset = raw.seedOffset == null ? undefined : optionalInt(raw.seedOffset, -0x7fffffff, 0x7fffffff)
  const durationBeats = raw.durationBeats == null ? undefined : optionalFinite(raw.durationBeats, 0.0625, 64)
  return {
    id,
    ...(raw.enabled === false ? { enabled: false } : {}),
    ...(probability != null ? { probability } : {}),
    ...(seedOffset != null ? { seedOffset } : {}),
    ...(durationBeats != null ? { durationBeats } : {}),
    ...normalizePayload(raw),
  }
}

function normalizeMetricRange(raw: unknown, minLimit: number, maxLimit: number): LaserDmxShowDirectorPerformanceMetricRange | null {
  if (!isRecord(raw)) return null
  const min = optionalFinite(raw.min, minLimit, maxLimit)
  const max = optionalFinite(raw.max, minLimit, maxLimit)
  if (min == null || max == null) return null
  return { min: Math.min(min, max), max: Math.max(min, max) }
}

function normalizeEnergyEnvelope(raw: unknown): LaserDmxShowDirectorSectionEnergyEnvelope | null {
  if (!isRecord(raw)) return null
  const activeFixtureGroups = normalizeMetricRange(raw.activeFixtureGroups, 0, 512)
  const estimatedBeamCount = normalizeMetricRange(raw.estimatedBeamCount, 0, 300)
  const brightness = normalizeMetricRange(raw.brightness, 0, 1)
  const fanSpread = normalizeMetricRange(raw.fanSpread, 0, 180)
  const movementStrength = normalizeMetricRange(raw.movementStrength, 0, 1)
  const glow = normalizeMetricRange(raw.glow, 0, 1)
  const density = normalizeMetricRange(raw.density, 0, 1)
  const negativeSpace = normalizeMetricRange(raw.negativeSpace, 0, 1)
  if (!activeFixtureGroups || !estimatedBeamCount || !brightness || !fanSpread || !movementStrength || !glow || !density || !negativeSpace) return null
  return { activeFixtureGroups, estimatedBeamCount, brightness, fanSpread, movementStrength, glow, density, negativeSpace }
}

function normalizeBlackoutWindow(raw: unknown, index: number): LaserDmxShowDirectorProgrammedBlackoutWindow | null {
  if (!isRecord(raw)) return null
  const id = cleanString(raw.id, `blackout-${index + 1}`, 96)
  const kind = BLACKOUT_KINDS.has(raw.kind as LaserDmxShowDirectorProgrammedBlackoutKind)
    ? raw.kind as LaserDmxShowDirectorProgrammedBlackoutKind
    : null
  const anchor = BLACKOUT_ANCHORS.has(raw.anchor as LaserDmxShowDirectorProgrammedBlackoutAnchor)
    ? raw.anchor as LaserDmxShowDirectorProgrammedBlackoutAnchor
    : null
  const durationBeats = optionalFinite(raw.durationBeats, 0.0625, 64)
  if (!id || !kind || !anchor || durationBeats == null) return null
  const offsetBeats = optionalFinite(raw.offsetBeats, 0, 64)
  const justification = cleanString(raw.justification, '', 240)
  return {
    id,
    kind,
    anchor,
    durationBeats,
    ...(offsetBeats != null ? { offsetBeats } : {}),
    ...(justification ? { justification } : {}),
  }
}

function normalizeBlackoutPolicy(raw: unknown): LaserDmxShowDirectorPerformanceBlackoutPolicy | undefined {
  if (!isRecord(raw)) return undefined
  return {
    maxPreDropBeats: clamp(raw.maxPreDropBeats, 1, 0.5, 2),
    maxImpactCutBeats: clamp(raw.maxImpactCutBeats, 0.5, 0.25, 2),
    maxFakeoutBeats: clamp(raw.maxFakeoutBeats, 1, 0.25, 2),
    maximumProgrammedBlackoutRatio: clamp(raw.maximumProgrammedBlackoutRatio, 0.04, 0, 0.25),
    retriggerGuardBeats: clamp(raw.retriggerGuardBeats, 0.25, 0, 2),
    breakdownRequiresVisibleOutput: raw.breakdownRequiresVisibleOutput !== false,
    minimumVisibleFixtureBrightness: clamp(raw.minimumVisibleFixtureBrightness, 0.34, 0.1, 0.8),
  }
}

function normalizeMutationArray<T extends LaserDmxShowDirectorPerformanceMutationBase>(
  raw: unknown,
  prefix: string,
  decorate: (value: Record<string, unknown>, base: LaserDmxShowDirectorPerformanceMutationBase) => T,
): T[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, index) => {
    if (!isRecord(item)) return []
    const base = normalizeMutationBase(item, `${prefix}-${index + 1}`)
    return base ? [decorate(item, base)] : []
  }).slice(0, 256)
}

function normalizeVariation(raw: unknown, index: number): LaserDmxShowDirectorPerformanceSceneVariation | null {
  if (!isRecord(raw)) return null
  const id = cleanString(raw.id, `variation-${index + 1}`, 96)
  if (!id) return null
  const everyBars = raw.everyBars == null ? undefined : optionalInt(raw.everyBars, 1, 1024)
  const weight = raw.weight == null ? undefined : optionalFinite(raw.weight, 0.0001, 1000)
  const barOffsets = Array.isArray(raw.barOffsets)
    ? Array.from(new Set(raw.barOffsets.map(value => positiveInt(value, 0, 1024)))).sort((a, b) => a - b)
    : []
  return {
    id,
    ...(cleanString(raw.label, '', 160) ? { label: cleanString(raw.label, '', 160) } : {}),
    ...(weight != null ? { weight } : {}),
    ...(everyBars != null ? { everyBars } : {}),
    ...(barOffsets.length ? { barOffsets } : {}),
    ...normalizePayload(raw),
  }
}

function normalizeTransition(raw: unknown): LaserDmxShowDirectorPerformanceSceneTransition | undefined {
  if (!isRecord(raw)) return undefined
  const durationBars = raw.durationBars == null ? undefined : optionalFinite(raw.durationBars, 0, 256)
  const durationMs = raw.durationMs == null ? undefined : optionalFinite(raw.durationMs, 0, 120_000)
  const curve = TRANSITION_CURVES.has(raw.curve as LaserDmxShowDirectorPerformanceTransitionCurve)
    ? raw.curve as LaserDmxShowDirectorPerformanceTransitionCurve
    : undefined
  if (durationBars == null && durationMs == null && !curve && typeof raw.blackoutDuringTransition !== 'boolean') return undefined
  return {
    ...(durationBars != null ? { durationBars } : {}),
    ...(durationMs != null ? { durationMs } : {}),
    ...(curve ? { curve } : {}),
    ...(typeof raw.blackoutDuringTransition === 'boolean' ? { blackoutDuringTransition: raw.blackoutDuringTransition } : {}),
  }
}

function normalizeBeatResponseEnvelope(raw: unknown): LaserDmxShowDirectorPerformanceBeatResponseEnvelope | undefined {
  if (!isRecord(raw)) return undefined
  const holdUntil = optionalFinite(raw.holdUntil, 0, 1)
  const releaseUntil = optionalFinite(raw.releaseUntil, 0, 1)
  const curve = TRANSITION_CURVES.has(raw.curve as LaserDmxShowDirectorPerformanceTransitionCurve)
    ? raw.curve as LaserDmxShowDirectorPerformanceTransitionCurve
    : undefined
  if (holdUntil == null && releaseUntil == null && !curve) return undefined
  const normalizedHold = holdUntil ?? 0.18
  return {
    holdUntil: normalizedHold,
    releaseUntil: Math.max(normalizedHold, releaseUntil ?? 0.82),
    ...(curve ? { curve } : {}),
  }
}

function normalizeBarMatch(raw: unknown): LaserDmxShowDirectorPerformanceSceneBarMatch | undefined {
  if (!isRecord(raw)) return undefined
  const startBar = raw.startBar == null ? undefined : optionalInt(raw.startBar, 0, 100_000)
  const endBar = raw.endBar == null ? undefined : optionalInt(raw.endBar, 0, 100_000)
  const everyBars = raw.everyBars == null ? undefined : optionalInt(raw.everyBars, 1, 1024)
  const barOffsets = Array.isArray(raw.barOffsets)
    ? Array.from(new Set(raw.barOffsets.map(value => positiveInt(value, 0, 1024)))).sort((a, b) => a - b)
    : []
  if (startBar == null && endBar == null && everyBars == null && !barOffsets.length) return undefined
  return {
    ...(startBar != null ? { startBar } : {}),
    ...(endBar != null ? { endBar } : {}),
    ...(everyBars != null ? { everyBars } : {}),
    ...(barOffsets.length ? { barOffsets } : {}),
  }
}

function normalizeScene(raw: unknown, index: number): LaserDmxShowDirectorPerformanceScene | null {
  if (!isRecord(raw) || !isRecord(raw.section) || !Array.isArray(raw.section.types)) return null
  const id = cleanString(raw.id, '', 96)
  const label = cleanString(raw.label, '', 160)
  const section = normalizeSectionMatch(raw.section)
  if (!id || !label || !raw.section.types.some(isSectionType)) return null
  return {
    id,
    label,
    enabled: raw.enabled !== false,
    section,
    priority: Math.round(finite(raw.priority, 0)),
    ...normalizePayload(raw),
    ...(normalizeBarMatch(raw.barMatch) ? { barMatch: normalizeBarMatch(raw.barMatch) } : {}),
    ...(normalizeTransition(raw.transitionIn) ? { transitionIn: normalizeTransition(raw.transitionIn) } : {}),
    ...(normalizeTransition(raw.transitionOut) ? { transitionOut: normalizeTransition(raw.transitionOut) } : {}),
    variations: Array.isArray(raw.variations)
      ? raw.variations.map(normalizeVariation).filter((value): value is LaserDmxShowDirectorPerformanceSceneVariation => value !== null)
      : [],
    beatMutations: normalizeMutationArray(raw.beatMutations, `${id}-beat`, (value, base) => ({
      ...base,
      ...(optionalFinite(value.beatDivision, 0.25, 32) != null ? { beatDivision: optionalFinite(value.beatDivision, 0.25, 32) } : {}),
      ...(Array.isArray(value.beatOffsets) ? { beatOffsets: Array.from(new Set(value.beatOffsets.map(offset => positiveInt(offset, 0, 4096)))).sort((a, b) => a - b) } : {}),
      ...(optionalInt(value.beatCycleLength, 1, 4096) != null ? { beatCycleLength: optionalInt(value.beatCycleLength, 1, 4096) } : {}),
      ...(normalizeBeatResponseEnvelope(value.responseEnvelope) ? { responseEnvelope: normalizeBeatResponseEnvelope(value.responseEnvelope) } : {}),
    })),
    kickMutations: normalizeMutationArray(raw.kickMutations, `${id}-kick`, (value, base) => ({ ...base, ...(optionalFinite(value.threshold, 0, 1) != null ? { threshold: optionalFinite(value.threshold, 0, 1) } : {}) })),
    snareMutations: normalizeMutationArray(raw.snareMutations, `${id}-snare`, (value, base) => ({ ...base, ...(optionalFinite(value.threshold, 0, 1) != null ? { threshold: optionalFinite(value.threshold, 0, 1) } : {}) })),
    hatMutations: normalizeMutationArray(raw.hatMutations, `${id}-hat`, (value, base) => ({ ...base, ...(optionalFinite(value.threshold, 0, 1) != null ? { threshold: optionalFinite(value.threshold, 0, 1) } : {}) })),
    transientMutations: normalizeMutationArray(raw.transientMutations, `${id}-transient`, (value, base) => ({ ...base, ...(optionalFinite(value.threshold, 0, 1) != null ? { threshold: optionalFinite(value.threshold, 0, 1) } : {}) })),
    barMutations: normalizeMutationArray(raw.barMutations, `${id}-bar`, (value, base) => ({
      ...base,
      ...(optionalInt(value.intervalBars, 1, 1024) != null ? { intervalBars: optionalInt(value.intervalBars, 1, 1024) } : {}),
      ...(optionalInt(value.anchorBar, 0, 1024) != null ? { anchorBar: optionalInt(value.anchorBar, 0, 1024) } : {}),
    })),
    barProgression: normalizeMutationArray(raw.barProgression, `${id}-bar-progression`, (value, base) => ({
      ...base,
      stageBar: Math.max(1, positiveInt(value.stageBar, 1, 4096)),
      ...(typeof value.cumulative === 'boolean' ? { cumulative: value.cumulative } : {}),
    })),
    fourBarVariations: normalizeMutationArray(raw.fourBarVariations, `${id}-four`, (value, base) => ({
      ...base,
      ...(Array.isArray(value.blockOffsets) ? { blockOffsets: Array.from(new Set(value.blockOffsets.map(offset => positiveInt(offset, 0, 4096)))).sort((a, b) => a - b) } : {}),
      ...(cleanString(value.motifFamily, '', 160) ? { motifFamily: cleanString(value.motifFamily, '', 160) } : {}),
    })),
    eightBarRecruitment: normalizeMutationArray(raw.eightBarRecruitment, `${id}-eight`, (value, base) => ({
      ...base,
      stage: Math.max(1, positiveInt(value.stage, 1, 1024)),
      ...(typeof value.cumulative === 'boolean' ? { cumulative: value.cumulative } : {}),
    })),
    sixteenBarEvolution: normalizeMutationArray(raw.sixteenBarEvolution, `${id}-sixteen`, (value, base) => ({
      ...base,
      ...(optionalInt(value.phase, 0, 1024) != null ? { phase: optionalInt(value.phase, 0, 1024) } : {}),
      ...(optionalInt(value.phraseLengthBars, 1, 1024) != null ? { phraseLengthBars: optionalInt(value.phraseLengthBars, 1, 1024) } : {}),
    })),
    sectionEntryMutations: normalizeMutationArray(raw.sectionEntryMutations, `${id}-entry`, (_value, base) => base),
    sectionBodyMutations: normalizeMutationArray(raw.sectionBodyMutations, `${id}-body`, (_value, base) => base),
    sectionExitMutations: normalizeMutationArray(raw.sectionExitMutations, `${id}-exit`, (_value, base) => base),
    ...(ENERGY_ENVELOPE_KEYS.has(raw.energyEnvelopeKey as LaserDmxShowDirectorPerformanceEnergyEnvelopeKey)
      ? { energyEnvelopeKey: raw.energyEnvelopeKey as LaserDmxShowDirectorPerformanceEnergyEnvelopeKey }
      : {}),
    ...(Array.isArray(raw.blackoutWindows)
      ? { blackoutWindows: raw.blackoutWindows.map(normalizeBlackoutWindow).filter((value): value is LaserDmxShowDirectorProgrammedBlackoutWindow => value !== null).slice(0, 16) }
      : {}),
    ...(typeof raw.allowZeroBeamOutput === 'boolean' ? { allowZeroBeamOutput: raw.allowZeroBeamOutput } : {}),
  }
}
export function normalizeLaserDmxShowDirectorPerformanceProgram(
  raw: unknown,
): LaserDmxShowDirectorPerformanceProgram | null {
  if (!isRecord(raw)) return null
  const id = cleanString(raw.id, '', 96)
  const name = cleanString(raw.name, '', 160)
  if (!id || !name || !Array.isArray(raw.scenes)) return null
  const scenes = raw.scenes.map(normalizeScene).filter((scene): scene is LaserDmxShowDirectorPerformanceScene => scene !== null)
  if (scenes.length === 0) return null
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
    id,
    name,
    description: cleanString(raw.description, '', 1000) || undefined,
    deterministicSeed: positiveInt(raw.deterministicSeed, 0),
    scenes,
    bankRoles: isRecord(raw.bankRoles)
      ? Object.fromEntries(Object.entries(raw.bankRoles).flatMap(([role, value]) => {
        const normalizedRole = cleanString(role, '', 96)
        const address = normalizeAddress(value)
        return normalizedRole && address ? [[normalizedRole, address]] : []
      }).slice(0, 128))
      : undefined,
    fixtureBanks: isRecord(raw.fixtureBanks)
      ? Object.fromEntries(Object.entries(raw.fixtureBanks).flatMap(([key, value]) => {
        if (!isRecord(value)) return []
        const role = cleanString(value.role ?? key, '', 96)
        const address = normalizeAddress(value.address)
        if (!role || !address) return []
        return [[cleanString(key, role, 96), { role, ...(cleanString(value.label, '', 160) ? { label: cleanString(value.label, '', 160) } : {}), ...(cleanString(value.description, '', 320) ? { description: cleanString(value.description, '', 320) } : {}), address }]]
      }).slice(0, 128))
      : undefined,
    energyEnvelopes: isRecord(raw.energyEnvelopes)
      ? Object.fromEntries(Object.entries(raw.energyEnvelopes).flatMap(([key, value]) => {
        if (!ENERGY_ENVELOPE_KEYS.has(key as LaserDmxShowDirectorPerformanceEnergyEnvelopeKey)) return []
        const envelope = normalizeEnergyEnvelope(value)
        return envelope ? [[key, envelope]] : []
      })) as Partial<Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserDmxShowDirectorSectionEnergyEnvelope>>
      : undefined,
    blackoutPolicy: normalizeBlackoutPolicy(raw.blackoutPolicy),
    fallbackOrder: Array.isArray(raw.fallbackOrder)
      ? Array.from(new Set(raw.fallbackOrder.filter(isSectionType)))
      : undefined,
    tuning: normalizeLaserDmxShowDirectorPerformanceTuning(raw.tuning),
    diagnostics: isRecord(raw.diagnostics) ? {
      ...(cleanString(raw.diagnostics.authoringVersion, '', 96) ? { authoringVersion: cleanString(raw.diagnostics.authoringVersion, '', 96) } : {}),
      ...(cleanString(raw.diagnostics.createdAt, '', 96) ? { createdAt: cleanString(raw.diagnostics.createdAt, '', 96) } : {}),
      ...(cleanString(raw.diagnostics.updatedAt, '', 96) ? { updatedAt: cleanString(raw.diagnostics.updatedAt, '', 96) } : {}),
      ...(cleanStringArray(raw.diagnostics.notes, 256).length ? { notes: cleanStringArray(raw.diagnostics.notes, 256) } : {}),
      ...(cleanStringArray(raw.diagnostics.expectedFixtureSemanticKeys, 512).length ? { expectedFixtureSemanticKeys: cleanStringArray(raw.diagnostics.expectedFixtureSemanticKeys, 512) } : {}),
      ...(cleanStringArray(raw.diagnostics.expectedGroupSemanticKeys, 512).length ? { expectedGroupSemanticKeys: cleanStringArray(raw.diagnostics.expectedGroupSemanticKeys, 512) } : {}),
    } : undefined,
  }
}

export function cloneLaserDmxShowDirectorPerformanceProgram(
  program: LaserDmxShowDirectorPerformanceProgram,
): LaserDmxShowDirectorPerformanceProgram {
  return normalizeLaserDmxShowDirectorPerformanceProgram(JSON.parse(JSON.stringify(program))) as LaserDmxShowDirectorPerformanceProgram
}

export function createDefaultLaserDmxShowDirectorPerformanceState(): LaserDmxShowDirectorPerformanceState {
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION,
    activeProgramId: null,
    activeBuiltInProgramId: null,
    activeProgramDefinition: null,
    enabled: false,
    tuning: { ...DEFAULT_TUNING },
    audioIntelligenceEnabled: true,
    deterministicSeed: 0,
    fallbackBehavior: 'basicTiming',
    activePresetId: null,
    presetDirty: false,
    runtimeInvalidationId: 'show-director-performance:none:0',
  }
}

export function normalizeLaserDmxShowDirectorPerformanceState(
  raw: unknown,
): LaserDmxShowDirectorPerformanceState {
  const fallback = createDefaultLaserDmxShowDirectorPerformanceState()
  if (!isRecord(raw)) return fallback
  const persistedDefinition = normalizeLaserDmxShowDirectorPerformanceProgram(raw.activeProgramDefinition)
  const requestedBuiltInId = isBuiltInId(raw.activeBuiltInProgramId)
    ? raw.activeBuiltInProgramId
    : isBuiltInId(raw.activeProgramId)
      ? raw.activeProgramId
      : persistedDefinition && isBuiltInId(persistedDefinition.id)
        ? persistedDefinition.id
        : null
  const registryProgram = requestedBuiltInId ? LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY[requestedBuiltInId]?.program ?? null : null
  const definition = persistedDefinition ?? (registryProgram ? cloneLaserDmxShowDirectorPerformanceProgram(registryProgram) : null)
  const activeProgramId = definition?.id ?? null
  const builtInId = definition && isBuiltInId(definition.id) ? definition.id : null
  const enabled = raw.enabled === true && definition !== null
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION,
    activeProgramId,
    activeBuiltInProgramId: builtInId,
    activeProgramDefinition: definition,
    enabled,
    tuning: normalizeLaserDmxShowDirectorPerformanceTuning(raw.tuning),
    audioIntelligenceEnabled: raw.audioIntelligenceEnabled !== false,
    deterministicSeed: positiveInt(raw.deterministicSeed, definition?.deterministicSeed ?? 0),
    fallbackBehavior: raw.fallbackBehavior === 'authoredRig' || raw.fallbackBehavior === 'programDefault'
      ? raw.fallbackBehavior
      : 'basicTiming',
    activePresetId: cleanString(raw.activePresetId, '', 96) || null,
    presetDirty: raw.presetDirty === true,
    runtimeInvalidationId: cleanString(
      raw.runtimeInvalidationId,
      `show-director-performance:${activeProgramId ?? 'none'}:0`,
      192,
    ),
  }
}

export function nextLaserDmxShowDirectorPerformanceInvalidationId(
  current: string,
  programId: string | null,
): string {
  const match = /:(\d+)$/.exec(current)
  const revision = Math.max(0, Number(match?.[1] ?? 0)) + 1
  return `show-director-performance:${programId ?? 'none'}:${revision}`
}

export function applyLaserDmxShowDirectorPerformanceProgramState(
  current: LaserDmxShowDirectorPerformanceState,
  program: LaserDmxShowDirectorPerformanceProgram,
): LaserDmxShowDirectorPerformanceState {
  const normalized = normalizeLaserDmxShowDirectorPerformanceProgram(program)
  if (!normalized) return normalizeLaserDmxShowDirectorPerformanceState(current)
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION,
    activeProgramId: normalized.id,
    activeBuiltInProgramId: isBuiltInId(normalized.id) ? normalized.id : null,
    activeProgramDefinition: cloneLaserDmxShowDirectorPerformanceProgram(normalized),
    enabled: true,
    tuning: { ...normalized.tuning },
    audioIntelligenceEnabled: current.audioIntelligenceEnabled,
    deterministicSeed: normalized.deterministicSeed,
    fallbackBehavior: current.fallbackBehavior,
    activePresetId: null,
    presetDirty: false,
    runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(current.runtimeInvalidationId, normalized.id),
  }
}

export function clearLaserDmxShowDirectorPerformanceProgramState(
  current: LaserDmxShowDirectorPerformanceState,
): LaserDmxShowDirectorPerformanceState {
  return {
    ...createDefaultLaserDmxShowDirectorPerformanceState(),
    audioIntelligenceEnabled: current.audioIntelligenceEnabled,
    fallbackBehavior: current.fallbackBehavior,
    runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(current.runtimeInvalidationId, null),
  }
}
