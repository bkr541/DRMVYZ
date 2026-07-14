import type { ReactSectionType } from '../musicIntelligence/types'
import type { SharedPerformanceContext, SharedPerformanceSectionPhase } from './context'
import { selectSharedPerformanceWeightedVariation } from './runtime'
import { resolveSharedPerformanceCadence, sharedPerformanceOccurrenceMatches } from './runtime'
import { resolveSharedPerformanceSignals, type SharedPerformanceSignalFrame } from './signals'

export type SharedPerformanceActionReason =
  | 'scene'
  | 'sectionEntry'
  | 'sectionBody'
  | 'sectionExit'
  | 'barStage'
  | 'fourBarMotif'
  | 'eightBarRecruitment'
  | 'sixteenBarEvolution'
  | 'beat'
  | 'downbeat'
  | 'kick'
  | 'snare'
  | 'hat'
  | 'transient'
  | 'semanticMoment'

export interface SharedPerformanceActionIntent<TAction> {
  reason: SharedPerformanceActionReason
  action: TAction
  identity: string
}

export interface SharedPerformanceProgramVariation<TAction> {
  id: string
  weight?: number
  actions: readonly TAction[]
}

export interface SharedPerformanceProgramScene<TAction> {
  id: string
  sectionTypes: readonly ReactSectionType[]
  occurrence?: { occurrences?: readonly number[]; minOccurrence?: number; maxOccurrence?: number; every?: number }
  dropOccurrence?: { occurrences?: readonly number[]; minOccurrence?: number; maxOccurrence?: number; every?: number }
  minConfidence?: number
  priority?: number
  actions?: readonly TAction[]
  entryActions?: readonly TAction[]
  bodyActions?: readonly TAction[]
  exitActions?: readonly TAction[]
  fourBarActions?: readonly (readonly TAction[])[]
  eightBarRecruitment?: readonly (readonly TAction[])[]
  sixteenBarEvolution?: readonly (readonly TAction[])[]
  eventActions?: Partial<Record<'beat' | 'downbeat' | 'kick' | 'snare' | 'hat' | 'transient' | 'semanticMoment', readonly TAction[]>>
  variations?: readonly SharedPerformanceProgramVariation<TAction>[]
}

export interface SharedPerformanceProgram<TAction> {
  id: string
  scenes: readonly SharedPerformanceProgramScene<TAction>[]
  fallbackOrder?: readonly ReactSectionType[]
}

export interface SharedPerformanceProgramResolution<TAction> {
  scene: SharedPerformanceProgramScene<TAction> | null
  variation: SharedPerformanceProgramVariation<TAction> | null
  sectionPhase: SharedPerformanceSectionPhase
  signals: SharedPerformanceSignalFrame
  intents: readonly SharedPerformanceActionIntent<TAction>[]
  deterministicIdentity: string
}

function pushActions<TAction>(
  target: SharedPerformanceActionIntent<TAction>[],
  actions: readonly TAction[] | undefined,
  reason: SharedPerformanceActionReason,
  identity: string,
): void {
  if (!actions?.length) return
  for (let index = 0; index < actions.length; index += 1) {
    target.push({ reason, action: actions[index], identity: `${identity}|${reason}|${index}` })
  }
}

function sceneMatches<TAction>(scene: SharedPerformanceProgramScene<TAction>, context: SharedPerformanceContext, type: ReactSectionType): boolean {
  if (!scene.sectionTypes.includes(type)) return false
  if (!sharedPerformanceOccurrenceMatches(context.sectionOccurrence, scene.occurrence)) return false
  if (!sharedPerformanceOccurrenceMatches(context.dropOccurrence, scene.dropOccurrence)) return false
  return scene.minConfidence == null || context.sectionConfidence >= scene.minConfidence
}

/**
 * Engine-neutral program resolver. It emits intent and reason, never renderer
 * objects. Engine adapters decide how each action mutates their own state.
 */
export function resolveSharedPerformanceProgram<TAction>(
  program: SharedPerformanceProgram<TAction>,
  context: SharedPerformanceContext,
): SharedPerformanceProgramResolution<TAction> {
  const sectionType = context.macroSectionType ?? context.sectionType ?? 'unknown'
  let candidates = program.scenes.filter(scene => sceneMatches(scene, context, sectionType))
  if (!candidates.length) {
    for (const fallbackType of program.fallbackOrder ?? []) {
      candidates = program.scenes.filter(scene => sceneMatches(scene, context, fallbackType))
      if (candidates.length) break
    }
  }
  const scene = candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id))[0] ?? null
  const signals = resolveSharedPerformanceSignals(context)
  if (!scene) {
    return {
      scene: null,
      variation: null,
      sectionPhase: context.macroSectionPhase,
      signals,
      intents: [],
      deterministicIdentity: `${program.id}|none|${context.runtimeIdentity}`,
    }
  }

  const variation = selectSharedPerformanceWeightedVariation(scene.variations ?? [], [
    context.deterministicVariationSeed,
    program.id,
    scene.id,
    context.sectionOccurrence,
    context.performanceFourBarBlockIndex,
  ])
  const cadence = resolveSharedPerformanceCadence(context)
  const identity = `${program.id}|${scene.id}|${context.timelineRevision}|${context.sectionOccurrence}|${cadence.fourBarBlockIndex}`
  const intents: SharedPerformanceActionIntent<TAction>[] = []
  pushActions(intents, scene.actions, 'scene', identity)
  if (cadence.sectionPhase === 'entry') pushActions(intents, scene.entryActions, 'sectionEntry', identity)
  else if (cadence.sectionPhase === 'exit') pushActions(intents, scene.exitActions, 'sectionExit', identity)
  else pushActions(intents, scene.bodyActions, 'sectionBody', identity)
  pushActions(intents, variation?.actions, 'fourBarMotif', `${identity}|variation:${variation?.id ?? 'none'}`)
  pushActions(intents, scene.fourBarActions?.[cadence.fourBarBlockIndex % Math.max(1, scene.fourBarActions?.length ?? 1)], 'fourBarMotif', identity)
  pushActions(intents, scene.eightBarRecruitment?.[Math.min(scene.eightBarRecruitment.length - 1, cadence.eightBarRecruitmentStage - 1)], 'eightBarRecruitment', identity)
  pushActions(intents, scene.sixteenBarEvolution?.[Math.min(scene.sixteenBarEvolution.length - 1, cadence.sixteenBarEvolutionStage - 1)], 'sixteenBarEvolution', identity)

  const eventMap = scene.eventActions
  if (signals.discrete.beat.active) pushActions(intents, eventMap?.beat, 'beat', identity)
  if (signals.discrete.downbeat.active) pushActions(intents, eventMap?.downbeat, 'downbeat', identity)
  if (signals.discrete.kick.active) pushActions(intents, eventMap?.kick, 'kick', identity)
  if (signals.discrete.snare.active) pushActions(intents, eventMap?.snare, 'snare', identity)
  if (signals.discrete.hat.active) pushActions(intents, eventMap?.hat, 'hat', identity)
  if (signals.discrete.transient.active) pushActions(intents, eventMap?.transient, 'transient', identity)
  if (signals.discrete.semanticMoment.active) pushActions(intents, eventMap?.semanticMoment, 'semanticMoment', identity)

  return {
    scene,
    variation,
    sectionPhase: cadence.sectionPhase,
    signals,
    intents,
    deterministicIdentity: `${identity}|${variation?.id ?? 'none'}|${context.beatIndex}`,
  }
}
