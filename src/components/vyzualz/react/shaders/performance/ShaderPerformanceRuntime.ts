import type { SharedPerformanceContext } from '../../../../../features/performanceCore/context'
import { resolveSharedPerformanceProgram } from '../../../../../features/performanceCore/programRuntime'
import type {
  FloatParamDef,
  IntegerParamDef,
  ShaderDefinition,
  ShaderParamDef,
  ShaderParamValue,
  ShaderParamValues,
} from '../registry/shaderRegistryTypes'
import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'
import type {
  ShaderPerformanceAction,
  ShaderPerformanceFrameResolution,
  ShaderPerformanceRuntimeSnapshot,
} from './ShaderPerformanceProgramTypes'

const MAX_REMEMBERED_EVENT_IDENTITIES = 256

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

function applyNumericAction(
  param: FloatParamDef | IntegerParamDef,
  base: number,
  action: Extract<ShaderPerformanceAction, { type: 'param' }>,
): number {
  const range = param.max - param.min
  let next = base
  switch (action.operation) {
    case 'addNormalized':
      next = base + action.value * range
      break
    case 'multiply':
      next = base * action.value
      break
    case 'replaceNormalized':
      next = param.min + clamp(action.value, 0, 1) * range
      break
  }
  const bounded = clamp(next, param.min, param.max)
  return param.type === 'integer' ? Math.round(bounded) : bounded
}

function applyParamAction(
  param: ShaderParamDef,
  current: ShaderParamValue,
  action: Extract<ShaderPerformanceAction, { type: 'param' }>,
): ShaderParamValue {
  if (param.type === 'float' || param.type === 'integer') {
    const base = typeof current === 'number' ? current : param.default
    return applyNumericAction(param, base, action)
  }
  if (param.type === 'boolean' && action.operation === 'replaceNormalized') {
    return action.value >= 0.5
  }
  return current
}

function countRoutes(routes: readonly ShaderModulationRoute[]) {
  let authoredRouteCount = 0
  let userRouteCount = 0
  let modifiedBuiltInRouteCount = 0
  let disabledRouteCount = 0
  for (const route of routes) {
    if (!route.enabled) disabledRouteCount += 1
    if (route.origin === 'built-in' || route.id.startsWith('builtin:')) {
      authoredRouteCount += 1
      if (route.modified) modifiedBuiltInRouteCount += 1
    } else {
      userRouteCount += 1
    }
  }
  return { authoredRouteCount, userRouteCount, modifiedBuiltInRouteCount, disabledRouteCount }
}

export class ShaderPerformanceRuntime {
  private readonly _seenEventIdentities = new Set<string>()
  private readonly _seenEventOrder: string[] = []

  reset(): void {
    this._seenEventIdentities.clear()
    this._seenEventOrder.length = 0
  }

  resolve(
    def: ShaderDefinition,
    manualValues: ShaderParamValues,
    context: SharedPerformanceContext,
    routes: readonly ShaderModulationRoute[],
    activeRouteCount: number,
    choreographyAction: string | null,
  ): ShaderPerformanceFrameResolution {
    const program = def.performanceProgram
    const transportReconstructed = context.seekDetected
      || context.loopWrapDetected
      || context.trackReplacementDetected
      || context.boundaries.timingDiscontinuity
    if (transportReconstructed) this.reset()

    const routeCounts = countRoutes(routes)
    if (!program) {
      return {
        paramValues: { ...manualValues },
        feedbackResetRequested: false,
        snapshot: {
          active: false,
          programId: null,
          programName: null,
          programVersion: null,
          scenePlanId: null,
          sectionType: context.macroSectionType ?? context.sectionType,
          sectionPhase: context.macroSectionPhase,
          sectionOccurrence: context.sectionOccurrence,
          dropOccurrence: context.dropOccurrence,
          fourBarStage: context.performanceFourBarBlockIndex + 1,
          eightBarStage: context.performanceEightBarBlockIndex + 1,
          sixteenBarStage: context.performanceSixteenBarBlockIndex + 1,
          deterministicIdentity: null,
          activeRouteCount,
          ...routeCounts,
          invalidTargetIds: [],
          choreographyAction,
          transportReconstructed,
        },
      }
    }

    const resolution = resolveSharedPerformanceProgram(program, context)
    const values: ShaderParamValues = { ...manualValues }
    const invalidTargets = new Set<string>()
    let feedbackResetRequested = false

    for (const intent of resolution.intents) {
      const currentAction = intent.action
      if (currentAction.type === 'feedbackReset') {
        if (!this._seenEventIdentities.has(intent.identity)) {
          feedbackResetRequested = true
          this._rememberEvent(intent.identity)
        }
        continue
      }
      const targetIds = [currentAction.targetParamId, ...(currentAction.fallbackTargetParamIds ?? [])]
      const param = targetIds
        .map(targetId => def.params.find(candidate => candidate.id === targetId))
        .find(candidate => candidate?.type === 'float' || candidate?.type === 'integer' || candidate?.type === 'boolean')
      if (!param) {
        invalidTargets.add(targetIds.join(' | '))
        continue
      }
      const current = values[param.id] ?? def.defaults[param.id]
      values[param.id] = applyParamAction(param, current, currentAction)
    }

    const snapshot: ShaderPerformanceRuntimeSnapshot = {
      active: true,
      programId: program.id,
      programName: program.metadata.name,
      programVersion: program.version,
      scenePlanId: resolution.scene?.id ?? null,
      sectionType: context.macroSectionType ?? context.sectionType,
      sectionPhase: resolution.sectionPhase,
      sectionOccurrence: context.sectionOccurrence,
      dropOccurrence: context.dropOccurrence,
      fourBarStage: context.performanceFourBarBlockIndex + 1,
      eightBarStage: context.performanceEightBarBlockIndex + 1,
      sixteenBarStage: context.performanceSixteenBarBlockIndex + 1,
      deterministicIdentity: resolution.deterministicIdentity,
      activeRouteCount,
      ...routeCounts,
      invalidTargetIds: [...invalidTargets],
      choreographyAction,
      transportReconstructed,
    }

    return { paramValues: values, snapshot, feedbackResetRequested }
  }

  private _rememberEvent(identity: string): void {
    this._seenEventIdentities.add(identity)
    this._seenEventOrder.push(identity)
    while (this._seenEventOrder.length > MAX_REMEMBERED_EVENT_IDENTITIES) {
      const oldest = this._seenEventOrder.shift()
      if (oldest) this._seenEventIdentities.delete(oldest)
    }
  }
}
