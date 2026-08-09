import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import type { SharedPerformanceContext } from '../../../../../features/performanceCore/context'
import type { ShaderAudioUniformFrame, ShaderTimingUniformFrame } from '../audio/shaderAudioTypes'
import { ShaderModulationEvaluator } from '../modulation/ShaderModulationEvaluator'
import { ShaderModulationMatrix } from '../modulation/ShaderModulationMatrix'
import type {
  ModulationEvaluationFrame,
  ModulationValidationError,
  ShaderModulationRoute,
} from '../modulation/shaderModulationTypes'
import type {
  ShaderDefinition,
  ShaderParamValue,
  ShaderParamValues,
} from '../registry/shaderRegistryTypes'
import { ShaderSectionChoreography, type ShaderSectionAction } from '../transitions/ShaderSectionChoreography'
import type { ShaderPerformanceFrameResolution } from './ShaderPerformanceProgramTypes'
import { ShaderPerformanceRuntime } from './ShaderPerformanceRuntime'

export interface ShaderPerformanceProgramExecutorInput {
  definition: ShaderDefinition
  sceneId: string
  manualValues: ShaderParamValues
  routes: readonly ShaderModulationRoute[]
  context: SharedPerformanceContext
  audio: ShaderAudioUniformFrame
  timing: ShaderTimingUniformFrame
  musicIntelligence: MusicIntelligenceFrame | null
  deltaTimeSec: number
  reconstruct?: boolean
}

export interface ShaderPerformanceProgramExecutorResult {
  performance: ShaderPerformanceFrameResolution
  modulation: ModulationEvaluationFrame
  effectiveValues: Record<string, ShaderParamValue>
  choreography: ShaderSectionAction | null
  choreographyAction: string | null
  invalidRoutes: Readonly<Record<string, ModulationValidationError>>
}

/**
 * Canonical stateful execution seam shared by standalone Shader Pads and
 * Cinema's Shader adapter. It owns only runtime envelopes/event identities;
 * authored values, routes, and scene definitions remain caller-owned.
 */
export class ShaderPerformanceProgramExecutor {
  private readonly performanceRuntime = new ShaderPerformanceRuntime()
  private readonly modulationEvaluator = new ShaderModulationEvaluator()
  private readonly modulationMatrix = new ShaderModulationMatrix()
  private readonly choreography = new ShaderSectionChoreography()
  private activeDefinition: ShaderDefinition | null = null
  private activeSceneId: string | null = null

  reset(): void {
    this.performanceRuntime.reset()
    this.modulationEvaluator.reset()
    this.choreography.reset()
  }

  setDefinition(definition: ShaderDefinition, sceneId = definition.id): void {
    const changed = this.activeDefinition !== definition || this.activeSceneId !== sceneId
    this.activeDefinition = definition
    this.activeSceneId = sceneId
    this.modulationMatrix.setDefinition(definition)
    this.choreography.enabled = Boolean(definition.performanceProgram)
    this.choreography.setRules([...(definition.performanceProgram?.sectionChoreography ?? [])])
    this.choreography.setCurrentScene(sceneId)
    if (changed) this.reset()
  }

  resolve(input: ShaderPerformanceProgramExecutorInput): ShaderPerformanceProgramExecutorResult {
    if (this.activeDefinition !== input.definition || this.activeSceneId !== input.sceneId) {
      this.setDefinition(input.definition, input.sceneId)
    }

    const reconstructed = input.reconstruct === true
      || input.context.seekDetected
      || input.context.loopWrapDetected
      || input.context.trackReplacementDetected
      || input.context.boundaries.timingDiscontinuity
    const sectionType = input.context.macroSectionType ?? input.context.sectionType
    const choreography = this.choreography.onSection(sectionType, { reconstruct: reconstructed })
    const choreographyAction = choreography
      ? `${sectionType ?? 'unknown'}:${choreography.transition.type}`
      : null

    this.modulationMatrix.fromArray([...input.routes])
    const invalidRoutes = Object.fromEntries(
      Object.entries(this.modulationMatrix.validateAll())
        .filter((entry): entry is [string, ModulationValidationError] => entry[1] !== null),
    )
    const performance = this.performanceRuntime.resolve(
      input.definition,
      input.manualValues,
      input.context,
      input.routes,
      0,
      choreographyAction,
    )
    const modulation = this.modulationEvaluator.evaluate(
      this.modulationMatrix,
      input.definition,
      input.audio,
      input.timing,
      performance.paramValues,
      input.deltaTimeSec,
      input.sceneId,
      input.musicIntelligence,
      input.context,
    )
    const effectiveValues: Record<string, ShaderParamValue> = {}
    for (const [parameterId, result] of Object.entries(modulation.params)) {
      effectiveValues[parameterId] = result.effectiveValue
    }

    return {
      performance: {
        ...performance,
        snapshot: { ...performance.snapshot, activeRouteCount: modulation.activeRouteCount },
      },
      modulation,
      effectiveValues,
      choreography,
      choreographyAction,
      invalidRoutes,
    }
  }
}
