import type { SharedPerformanceProgramMetadata } from '../../../../../features/performanceCore/authoring'
import type { SharedPerformanceSectionPhase } from '../../../../../features/performanceCore/context'
import type { SharedPerformanceProgram } from '../../../../../features/performanceCore/programRuntime'
import type { ReactSectionType } from '../../ReactTypes'
import type { ShaderParamValues } from '../registry/shaderRegistryTypes'
import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'
import type { ShaderSectionRule } from '../transitions/shaderTransitionTypes'

export const SHADER_PERFORMANCE_PROGRAM_SCHEMA_VERSION = 1 as const

export type ShaderPerformanceParamOperation =
  | 'addNormalized'
  | 'multiply'
  | 'replaceNormalized'

export type ShaderPerformanceAction =
  | {
      type: 'param'
      targetParamId: string
      fallbackTargetParamIds?: readonly string[]
      operation: ShaderPerformanceParamOperation
      value: number
    }
  | {
      type: 'feedbackReset'
      reason: 'section' | 'drop' | 'phrase' | 'semantic'
    }

export interface ShaderPerformanceProgram
  extends SharedPerformanceProgram<ShaderPerformanceAction> {
  schemaVersion: typeof SHADER_PERFORMANCE_PROGRAM_SCHEMA_VERSION
  version: number
  metadata: SharedPerformanceProgramMetadata
  /** Stable, preset-owned modulation routes installed on first use and migrated thereafter. */
  authoredRoutes: readonly ShaderModulationRoute[]
  /** Compatibility bridge for the existing ShaderSectionChoreography controller. */
  sectionChoreography: readonly ShaderSectionRule[]
  /** Optional display notes for internal validation and authoring inspection. */
  targetRoles?: Readonly<Record<string, string>>
}

export interface ShaderPerformanceRuntimeSnapshot {
  active: boolean
  programId: string | null
  programName: string | null
  programVersion: number | null
  scenePlanId: string | null
  sectionType: ReactSectionType | null
  sectionPhase: SharedPerformanceSectionPhase
  sectionOccurrence: number
  dropOccurrence: number
  fourBarStage: number
  eightBarStage: number
  sixteenBarStage: number
  deterministicIdentity: string | null
  activeRouteCount: number
  authoredRouteCount: number
  userRouteCount: number
  modifiedBuiltInRouteCount: number
  disabledRouteCount: number
  invalidTargetIds: readonly string[]
  choreographyAction: string | null
  transportReconstructed: boolean
}

export interface ShaderPerformanceFrameResolution {
  paramValues: ShaderParamValues
  snapshot: ShaderPerformanceRuntimeSnapshot
  feedbackResetRequested: boolean
}
