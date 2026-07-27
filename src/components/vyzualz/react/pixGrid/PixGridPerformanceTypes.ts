import type {
  SharedPerformanceActionReason,
  SharedPerformanceEnvelopeCurve,
  SharedPerformanceProgramMetadata,
  SharedPerformanceSectionPhase,
} from '../../../../features/performanceCore'
import type { ReactSectionType } from '../ReactTypes'
import type { PixGridGroupFrameEffect } from './PixGridFrameEffects'
import type { PixGridResolvedTransition, PixGridCueTransition } from './PixGridActionCues'
import type {
  PixGridAnimationMode,
  PixGridPaletteRole,
  PixGridPerformanceProgramId,
  PixGridReactionBlend,
  PixGridReactionCapabilityFallback,
  PixGridReactionCurve,
  PixGridReactionDecayCurve,
  PixGridReactionPolarity,
  PixGridReactionQuantization,
  PixGridReactionRetrigger,
  PixGridReactionSource,
  PixGridReactionTarget,
  PixGridReactionTargetScope,
  PixGridState,
} from './PixGridTypes'

export const PIX_GRID_PERFORMANCE_PROGRAM_SCHEMA_VERSION = 2 as const

export type PixGridPerformanceTransition = PixGridCueTransition | 'fade' | 'wipeRows' | 'wipeColumns' | 'dissolve'
export type PixGridPerformanceBackgroundState = 'preset' | 'black' | 'dim' | 'lifted'
export type PixGridPerformanceLayerOpacityMode = 'set' | 'blend'

/** PixGrid-only action intent. Renderer objects and LaserDMX fixture state are deliberately excluded. */
export type PixGridPerformanceAction =
  | { type: 'setScene'; sceneId: string }
  | { type: 'setLayerActive'; layerId: string; active: boolean }
  | { type: 'setGroupActive'; groupId: string; active: boolean }
  | { type: 'setLayerOpacity'; layerId: string; opacity: number; mode?: PixGridPerformanceLayerOpacityMode }
  | { type: 'setGroupBrightness'; groupId: string; brightness: number }
  | { type: 'setPaletteRole'; target: 'all' | { layerId: string } | { groupId: string }; from?: PixGridPaletteRole; role: PixGridPaletteRole }
  | { type: 'flashGroup'; groupId: string; amount: number; paletteRole?: PixGridPaletteRole }
  | { type: 'revealRows'; target: 'all' | { layerId: string } | { groupId: string }; progress: number; from?: 'top' | 'bottom' | 'center' }
  | { type: 'revealColumns'; target: 'all' | { layerId: string } | { groupId: string }; progress: number; from?: 'left' | 'right' | 'center' }
  | { type: 'dissolveGroup'; groupId: string; amount: number }
  | { type: 'shiftGroup'; groupId: string; x?: number; y?: number }
  | { type: 'recruitLayer'; layerId: string; opacity?: number }
  | { type: 'changeAnimation'; layerId: string; animation: PixGridAnimationMode; speed?: number; amount?: number }
  | { type: 'changeAnimationSpeed'; target: 'all' | { layerId: string } | { groupId: string }; multiplier: number }
  | { type: 'reverseDirection'; target: 'all' | { layerId: string } | { groupId: string } }
  | { type: 'triggerFrame'; target: 'all' | { layerId: string } | { groupId: string }; step?: number }
  | { type: 'freeze'; active: boolean }
  | { type: 'clear' }
  | { type: 'restore' }
  | { type: 'setTransition'; transition: PixGridPerformanceTransition; durationBeats?: number }
  | { type: 'setDensity'; density: number }
  | { type: 'setBackgroundState'; state: PixGridPerformanceBackgroundState; brightness?: number }

export type PixGridVisualRole =
  | 'hero'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'outline'
  | 'background'
  | 'atmosphere'
  | 'impact'
  | 'percussion'
  | 'bass'
  | 'vocalFocus'
  | 'sparkle'
  | 'transition'
  | 'typography'
  | 'character'
  | 'environment'

export type PixGridProgramTargetKind = 'scene' | 'layer' | 'group'
export interface PixGridProgramTargetReference {
  kind: PixGridProgramTargetKind
  id: string
}

export interface PixGridProgramRoleBinding {
  id: string
  target: PixGridProgramTargetReference
  roles: readonly PixGridVisualRole[]
  fallback?: PixGridProgramTargetReference
}

export interface PixGridProgramBank {
  id: string
  label?: string
  roles?: readonly PixGridVisualRole[]
  members: readonly PixGridProgramTargetReference[]
  fallbackMembers?: readonly PixGridProgramTargetReference[]
}

export type PixGridProgramRouteTarget =
  | { role: PixGridVisualRole }
  | { bankId: string }
  | { target: PixGridProgramTargetReference }
  | { scope: Extract<PixGridReactionTargetScope, 'output' | 'background' | 'transition' | 'palette'> }

export interface PixGridProgramRouteConditions {
  sectionTypes?: readonly ReactSectionType[]
  excludeSectionTypes?: readonly ReactSectionType[]
  sectionPhases?: readonly Exclude<SharedPerformanceSectionPhase, 'none'>[]
  sectionOccurrences?: readonly number[]
  dropOccurrences?: readonly number[]
  minimumEnergy?: number
  maximumEnergy?: number
}

export interface PixGridContinuousRoutePlan {
  id: string
  target: PixGridProgramRouteTarget
  source: PixGridReactionSource
  operation: PixGridReactionTarget
  amount: number
  inputRange?: readonly [number, number]
  outputRange?: readonly [number, number]
  curve?: PixGridReactionCurve
  polarity?: PixGridReactionPolarity
  threshold?: number
  hysteresis?: number
  attack?: number
  hold?: number
  release?: number
  cooldown?: number
  bassReactivityEnabled?: boolean
  smoothing?: number
  blend?: PixGridReactionBlend
  intensityScale?: number
  minimumConfidence?: number
  capabilityFallback?: PixGridReactionCapabilityFallback
  clamp?: readonly [number, number]
  conditions?: PixGridProgramRouteConditions
  occurrenceVariation?: { every?: number; amountScale?: number; seedOffset?: number; maxOccurrences?: number }
  priority?: number
  paletteRole?: PixGridPaletteRole
  color?: string
}

export interface PixGridEventEnvelopePlan {
  attack: number
  hold: number
  release: number
  curve?: PixGridReactionDecayCurve | SharedPerformanceEnvelopeCurve
}

export interface PixGridEventRoutePlan {
  id: string
  target: PixGridProgramRouteTarget
  event: PixGridReactionSource
  operation: PixGridReactionTarget
  envelope: PixGridEventEnvelopePlan
  amount: number
  inputRange?: readonly [number, number]
  outputRange?: readonly [number, number]
  threshold?: number
  hysteresis?: number
  smoothing?: number
  quantization?: PixGridReactionQuantization
  retrigger?: PixGridReactionRetrigger
  maximumStacking?: number
  cooldown?: number
  bassReactivityEnabled?: boolean
  intensityScale?: number
  priority?: number
  conditions?: PixGridProgramRouteConditions
  capabilityFallback?: PixGridReactionCapabilityFallback
  minimumConfidence?: number
  blend?: PixGridReactionBlend
  clamp?: readonly [number, number]
  paletteRole?: PixGridPaletteRole
  color?: string
}

export interface PixGridTransitionPlan {
  type: PixGridCueTransition
  durationBeats?: number
  interruptible?: boolean
}

export interface PixGridSectionMotionState {
  amount: number
  direction?: 'forward' | 'reverse' | 'alternate'
  grammar?: string
}

export interface PixGridSectionPaletteState {
  intensity: number
  primaryRole?: PixGridPaletteRole
  accentRole?: PixGridPaletteRole
}

export interface PixGridSectionDensityState {
  value: number
  minimum?: number
  maximum?: number
}

export interface PixGridSectionVariationPolicy {
  deterministic: true
  preserveIdentity: true
  seedOffset?: number
  occurrenceMode?: 'stable' | 'develop' | 'alternate'
}

export type PixGridSectionRecruitmentStage = 'entry' | 'body' | 'eightBar1' | 'eightBar2' | 'eightBar3' | 'eightBar4'

export interface PixGridLayerRecruitmentPlan {
  layerId: string
  fallbackLayerId?: string
  opacity?: number
  stage?: PixGridSectionRecruitmentStage
}

export interface PixGridGroupRecruitmentPlan {
  groupId: string
  fallbackGroupId?: string
  active?: boolean
  brightness?: number
  stage?: PixGridSectionRecruitmentStage
}

export interface PixGridSectionPlan {
  id: string
  sectionTypes: readonly ReactSectionType[]
  sectionFamilies?: readonly string[]
  occurrence?: { occurrences?: readonly number[]; minOccurrence?: number; maxOccurrence?: number; every?: number }
  dropOccurrence?: { occurrences?: readonly number[]; minOccurrence?: number; maxOccurrence?: number; every?: number }
  minConfidence?: number
  priority?: number
  sectionPhases?: readonly SharedPerformanceSectionPhase[]
  scenePreference?: readonly string[]
  actions?: readonly PixGridPerformanceAction[]
  entryActions?: readonly PixGridPerformanceAction[]
  bodyActions?: readonly PixGridPerformanceAction[]
  exitActions?: readonly PixGridPerformanceAction[]
  layerRecruitment?: readonly PixGridLayerRecruitmentPlan[]
  groupRecruitment?: readonly PixGridGroupRecruitmentPlan[]
  fourBarActions?: readonly (readonly PixGridPerformanceAction[])[]
  eightBarRecruitment?: readonly (readonly PixGridPerformanceAction[])[]
  sixteenBarEvolution?: readonly (readonly PixGridPerformanceAction[])[]
  eventActions?: Partial<Record<'beat' | 'downbeat' | 'kick' | 'snare' | 'hat' | 'transient' | 'semanticMoment', readonly PixGridPerformanceAction[]>>
  variations?: readonly { id: string; weight?: number; actions: readonly PixGridPerformanceAction[] }[]
  continuousRouteIds?: readonly string[]
  eventRouteIds?: readonly string[]
  motionState?: PixGridSectionMotionState
  paletteState?: PixGridSectionPaletteState
  densityState?: PixGridSectionDensityState
  backgroundState?: { state: PixGridPerformanceBackgroundState; brightness?: number }
  transitionIn?: PixGridTransitionPlan
  transitionOut?: PixGridTransitionPlan
  negativeSpaceTarget?: number
  intensityRange?: readonly [number, number]
  variationPolicy?: PixGridSectionVariationPolicy
}

export type PixGridMusicalArcKind =
  | 'density'
  | 'paletteIntensity'
  | 'motion'
  | 'contrast'
  | 'negativeSpace'
  | 'recruitment'
  | 'impactStrength'
  | 'sparkleDetail'
  | 'backgroundActivity'

export interface PixGridMusicalArc {
  id: string
  kind: PixGridMusicalArcKind
  sectionValues: Partial<Record<ReactSectionType, number>>
  defaultValue: number
  occurrenceDelta?: number
  clamp?: readonly [number, number]
}

export interface PixGridPerformanceProgram {
  schemaVersion: typeof PIX_GRID_PERFORMANCE_PROGRAM_SCHEMA_VERSION
  id: PixGridPerformanceProgramId
  metadata: SharedPerformanceProgramMetadata
  visualRoles: readonly PixGridVisualRole[]
  bindings: readonly PixGridProgramRoleBinding[]
  banks: readonly PixGridProgramBank[]
  continuousRoutes: readonly PixGridContinuousRoutePlan[]
  eventRoutes: readonly PixGridEventRoutePlan[]
  sectionPlans: readonly PixGridSectionPlan[]
  musicalArcs: readonly PixGridMusicalArc[]
  fallbackOrder?: readonly ReactSectionType[]
  fallbackSectionPlanId?: string
}

export interface PixGridPerformanceArcState {
  density: number
  paletteIntensity: number
  motion: number
  contrast: number
  negativeSpace: number
  recruitment: number
  impactStrength: number
  sparkleDetail: number
  backgroundActivity: number
}

export interface PixGridPerformanceRuntimeSnapshot {
  active: boolean
  programId: PixGridPerformanceProgramId | null
  programName: string | null
  sceneId: string | null
  activeSectionPlanId: string | null
  variationId: string | null
  section: string
  sectionPhase: string
  sectionOccurrence: number
  dropOccurrence: number
  fourBarStage: number
  eightBarStage: number
  sixteenBarStage: number
  currentFourBarMotif: string | null
  currentEightBarRecruitment: string | null
  currentSixteenBarEvolution: string | null
  activeVisualRoles: readonly PixGridVisualRole[]
  resolvedBanks: readonly string[]
  activeContinuousRoutes: readonly string[]
  activeEventRoutes: readonly string[]
  arcState: PixGridPerformanceArcState
  recentActionReasons: readonly SharedPerformanceActionReason[]
  recentActionTypes: readonly PixGridPerformanceAction['type'][]
  manualOverrideRoutes: readonly string[]
  manualOverridePrecedence: string
  missingBindings: readonly string[]
  degradedBindings: readonly string[]
  fallbackState: string | null
  transition: PixGridPerformanceTransition | null
  activeEventEnvelopes: readonly string[]
  activeGroupEffects: readonly string[]
  deterministicIdentity: string
}

export interface PixGridResolvedPerformanceFrame {
  state: PixGridState
  snapshot: PixGridPerformanceRuntimeSnapshot
  appliedActions: readonly PixGridPerformanceAction[]
  groupEffects: readonly PixGridGroupFrameEffect[]
  transition: PixGridResolvedTransition | null
  actionLimitDecisions: readonly string[]
}
