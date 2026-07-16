import {
  resolveSharedPerformanceProgram,
  type SharedPerformanceActionIntent,
  type SharedPerformanceActionReason,
  type SharedPerformanceContext,
} from '../../../../features/performanceCore'
import { clonePixGridLayer } from './PixGridDefaults'
import { normalizePixGridState } from './PixGridValidation'
import {
  PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID,
  PIX_GRID_PERFORMANCE_PROGRAM_BY_ID,
} from './PixGridPerformancePrograms'
import type {
  PixGridPerformanceAction,
  PixGridPerformanceRuntimeSnapshot,
  PixGridResolvedPerformanceFrame,
} from './PixGridPerformanceTypes'
import type {
  PixGridGroup,
  PixGridLayer,
  PixGridPaletteRole,
  PixGridPerformanceProgramId,
  PixGridState,
} from './PixGridTypes'

export const MAX_PIX_GRID_PERFORMANCE_ACTIONS = 96

export function limitPixGridPerformanceIntents(
  intents: readonly SharedPerformanceActionIntent<PixGridPerformanceAction>[],
): {
  intents: readonly SharedPerformanceActionIntent<PixGridPerformanceAction>[]
  decisions: readonly string[]
} {
  const capped = intents.slice(0, MAX_PIX_GRID_PERFORMANCE_ACTIONS)
  return {
    intents: capped,
    decisions: intents.length > capped.length
      ? [`PixGrid action intents clamped ${intents.length} → ${capped.length}`]
      : [],
  }
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function cloneState(state: PixGridState): PixGridState {
  return {
    ...state,
    editor: { ...state.editor, selection: state.editor.selection ? { ...state.editor.selection } : null },
    scenes: state.scenes.map(scene => ({ ...scene, layerIds: [...scene.layerIds], pixelOverrides: [...scene.pixelOverrides] })),
    layers: state.layers.map(clonePixGridLayer),
    groups: state.groups.map(group => ({
      ...group,
      cellRuns: [...group.cellRuns],
      layerScope: group.layerScope ? [...group.layerScope] : null,
      mask: group.mask.kind === 'runs' ? { kind: 'runs', runs: [...group.mask.runs] } : { ...group.mask },
      reactions: group.reactions.map(reaction => ({ ...reaction, clamp: [...reaction.clamp] as [number, number] })),
    })),
    pixelOverrides: [...state.pixelOverrides],
    performance: { ...state.performance, lockedRoutes: [...state.performance.lockedRoutes] },
    conversion: { ...state.conversion },
    diagnostics: { ...state.diagnostics },
  }
}

function groupFor(state: PixGridState, groupId: string): PixGridGroup | null {
  return state.groups.find(group => group.id === groupId) ?? null
}

function targetLayerIds(state: PixGridState, target: 'all' | { layerId: string } | { groupId: string }): string[] {
  if (target === 'all') return state.layers.map(layer => layer.id)
  if ('layerId' in target) return [target.layerId]
  const group = groupFor(state, target.groupId)
  if (!group) return []
  return group.layerScope?.length ? [...group.layerScope] : group.layerId ? [group.layerId] : []
}

function actionRoute(action: PixGridPerformanceAction): string {
  switch (action.type) {
    case 'setScene': return 'scene'
    case 'setLayerActive':
    case 'setLayerOpacity':
    case 'recruitLayer':
    case 'changeAnimation': return `layer:${action.layerId}`
    case 'setGroupActive':
    case 'setGroupBrightness':
    case 'flashGroup':
    case 'dissolveGroup':
    case 'shiftGroup': return `group:${action.groupId}`
    case 'setPaletteRole':
    case 'revealRows':
    case 'revealColumns':
    case 'changeAnimationSpeed':
    case 'reverseDirection':
    case 'triggerFrame': return action.target === 'all'
      ? action.type
      : 'layerId' in action.target ? `layer:${action.target.layerId}` : `group:${action.target.groupId}`
    case 'freeze': return 'freeze'
    case 'clear':
    case 'restore': return 'clear'
    case 'setTransition': return 'transition'
    case 'setDensity': return 'density'
    case 'setBackgroundState': return 'background'
  }
}

function isLocked(state: PixGridState, action: PixGridPerformanceAction): boolean {
  const route = actionRoute(action)
  if (state.performance.lockedRoutes.includes(route) || state.performance.lockedRoutes.includes(action.type)) return true
  if (route.startsWith('layer:')) {
    const layerId = route.slice('layer:'.length)
    return state.layers.find(layer => layer.id === layerId)?.locked === true
  }
  return false
}

function manualOverrideRoutes(state: PixGridState): string[] {
  return [...new Set([
    ...state.performance.lockedRoutes,
    ...state.layers.filter(layer => layer.locked).map(layer => `layer:${layer.id}`),
  ])]
}

function updateLayers(state: PixGridState, layerIds: readonly string[], updater: (layer: PixGridLayer) => PixGridLayer): PixGridState {
  if (!layerIds.length) return state
  const ids = new Set(layerIds)
  return { ...state, layers: state.layers.map(layer => ids.has(layer.id) ? updater(layer) : layer) }
}

function applyPalette(layer: PixGridLayer, from: PixGridPaletteRole | undefined, role: PixGridPaletteRole): PixGridLayer {
  if (from) return { ...layer, paletteMap: { ...layer.paletteMap, [from]: role } }
  return {
    ...layer,
    paletteMap: {
      primary: role,
      secondary: role,
      accent: role,
      highlight: role,
      background: layer.paletteMap.background ?? 'background',
    },
  }
}

function revealLayer(layer: PixGridLayer, axis: 'x' | 'y', progress: number, from: string): PixGridLayer {
  const safe = clamp(progress, 0.02, 1)
  const position = { ...layer.position }
  const scale = { ...layer.scale }
  if (axis === 'x') {
    scale.x *= safe
    if (from === 'left') position.x -= layer.scale.x * (1 - safe) * 0.5
    else if (from === 'right') position.x += layer.scale.x * (1 - safe) * 0.5
  } else {
    scale.y *= safe
    if (from === 'top') position.y -= layer.scale.y * (1 - safe) * 0.5
    else if (from === 'bottom') position.y += layer.scale.y * (1 - safe) * 0.5
  }
  return { ...layer, scale, position, opacity: layer.opacity * safe }
}

function scaleTowardAuthored(value: number, neutral: number, intensity: number): number {
  return neutral + (value - neutral) * intensity
}

function applyAction(
  current: PixGridState,
  base: PixGridState,
  action: PixGridPerformanceAction,
  reason: SharedPerformanceActionReason,
  intensity: number,
): { state: PixGridState; transition?: PixGridPerformanceRuntimeSnapshot['transition'] } {
  if (isLocked(current, action)) return { state: current }
  const strength = clamp(intensity)
  switch (action.type) {
    case 'setScene':
      return current.scenes.some(scene => scene.id === action.sceneId)
        ? { state: { ...current, selectedSceneId: action.sceneId } }
        : { state: current }
    case 'setLayerActive':
      return { state: updateLayers(current, [action.layerId], layer => ({ ...layer, visible: action.active })) }
    case 'setGroupActive': {
      const group = groupFor(current, action.groupId)
      const layerIds = group ? targetLayerIds(current, { groupId: group.id }) : []
      const withGroup = { ...current, groups: current.groups.map(item => item.id === action.groupId ? { ...item, enabled: action.active } : item) }
      return { state: updateLayers(withGroup, layerIds, layer => ({ ...layer, visible: action.active })) }
    }
    case 'setLayerOpacity': {
      const opacity = clamp(action.opacity)
      return { state: updateLayers(current, [action.layerId], layer => ({
        ...layer,
        opacity: action.mode === 'blend'
          ? clamp(layer.opacity + (opacity - layer.opacity) * strength)
          : clamp(scaleTowardAuthored(opacity, layer.opacity, strength)),
      })) }
    }
    case 'setGroupBrightness': {
      const ids = targetLayerIds(current, { groupId: action.groupId })
      const brightness = clamp(scaleTowardAuthored(action.brightness, 1, strength), 0, 2)
      return { state: updateLayers(current, ids, layer => ({ ...layer, opacity: clamp(layer.opacity * brightness) })) }
    }
    case 'setPaletteRole':
      return { state: updateLayers(current, targetLayerIds(current, action.target), layer => applyPalette(layer, action.from, action.role)) }
    case 'flashGroup': {
      const ids = targetLayerIds(current, { groupId: action.groupId })
      const eventScale = reason === 'kick' || reason === 'snare' || reason === 'semanticMoment' ? 1 : 0.72
      const amount = clamp(action.amount * strength * eventScale, 0, 1.5)
      let state = updateLayers(current, ids, layer => ({
        ...layer,
        opacity: clamp(layer.opacity + amount * 0.38),
        paletteMap: action.paletteRole ? { ...layer.paletteMap, highlight: action.paletteRole } : layer.paletteMap,
      }))
      state = { ...state, glowAmount: clamp(state.glowAmount + amount * 0.16), globalIntensity: clamp(state.globalIntensity + amount * 0.08) }
      return { state }
    }
    case 'revealRows':
      return { state: updateLayers(current, targetLayerIds(current, action.target), layer => revealLayer(layer, 'y', scaleTowardAuthored(action.progress, 1, strength), action.from ?? 'center')) }
    case 'revealColumns':
      return { state: updateLayers(current, targetLayerIds(current, action.target), layer => revealLayer(layer, 'x', scaleTowardAuthored(action.progress, 1, strength), action.from ?? 'center')) }
    case 'dissolveGroup': {
      const ids = targetLayerIds(current, { groupId: action.groupId })
      const remaining = 1 - clamp(action.amount) * strength
      return { state: updateLayers(current, ids, layer => ({ ...layer, opacity: clamp(layer.opacity * remaining) })) }
    }
    case 'shiftGroup': {
      const ids = targetLayerIds(current, { groupId: action.groupId })
      return { state: updateLayers(current, ids, layer => ({
        ...layer,
        position: {
          x: clamp(layer.position.x + (action.x ?? 0) * strength, -1, 2),
          y: clamp(layer.position.y + (action.y ?? 0) * strength, -1, 2),
        },
      })) }
    }
    case 'recruitLayer':
      return { state: updateLayers(current, [action.layerId], layer => ({ ...layer, visible: true, opacity: action.opacity == null ? layer.opacity : clamp(scaleTowardAuthored(action.opacity, layer.opacity, strength)) })) }
    case 'changeAnimation':
      return { state: updateLayers(current, [action.layerId], layer => ({
        ...layer,
        animations: [{
          mode: action.animation,
          speed: action.speed ?? layer.animations[0]?.speed ?? 1,
          amount: action.amount ?? layer.animations[0]?.amount ?? 1,
          phase: layer.animations[0]?.phase ?? 0,
          boundary: layer.animations[0]?.boundary ?? 'wrap',
        }, ...layer.animations.slice(1)],
      })) }
    case 'changeAnimationSpeed': {
      const multiplier = Math.max(0, scaleTowardAuthored(action.multiplier, 1, strength))
      return { state: updateLayers(current, targetLayerIds(current, action.target), layer => ({
        ...layer,
        animations: layer.animations.map(animation => ({ ...animation, speed: animation.speed * multiplier })),
      })) }
    }
    case 'reverseDirection':
      return { state: updateLayers(current, targetLayerIds(current, action.target), layer => ({
        ...layer,
        animations: layer.animations.map(animation => ({ ...animation, speed: -animation.speed, amount: -animation.amount })),
      })) }
    case 'triggerFrame': {
      const step = (action.step ?? 0.1) * strength
      return { state: updateLayers(current, targetLayerIds(current, action.target), layer => ({
        ...layer,
        animations: layer.animations.map(animation => ({ ...animation, phase: animation.phase + step })),
      })) }
    }
    case 'freeze':
      return { state: action.active ? updateLayers(current, current.layers.map(layer => layer.id), layer => ({
        ...layer,
        animations: layer.animations.map(animation => ({ ...animation, speed: 0 })),
      })) : current }
    case 'clear':
      return { state: { ...current, layers: current.layers.map(layer => ({ ...layer, visible: false })), backgroundMode: 'black', backgroundBrightness: 0 } }
    case 'restore':
      return { state: cloneState(base) }
    case 'setTransition':
      return { state: current, transition: action.transition }
    case 'setDensity': {
      const density = clamp(scaleTowardAuthored(action.density, 1, strength))
      return { state: { ...current, layers: current.layers.map(layer => ({ ...layer, visible: layer.visible && layer.densityRank <= density })) } }
    }
    case 'setBackgroundState': {
      const brightness = action.brightness ?? (action.state === 'black' ? 0 : action.state === 'dim' ? 0.06 : action.state === 'lifted' ? 0.2 : current.backgroundBrightness)
      return { state: {
        ...current,
        backgroundMode: action.state === 'black' ? 'black' : current.backgroundMode,
        backgroundBrightness: clamp(scaleTowardAuthored(brightness, current.backgroundBrightness, strength)),
      } }
    }
  }
}

function inactiveSnapshot(state: PixGridState, context: SharedPerformanceContext, fallbackState: string | null): PixGridPerformanceRuntimeSnapshot {
  return {
    active: false,
    programId: state.performance.sharedPerformanceProgramId,
    programName: null,
    sceneId: null,
    variationId: null,
    section: context.macroSectionType ?? context.sectionType ?? 'unknown',
    sectionPhase: context.macroSectionPhase,
    sectionOccurrence: context.sectionOccurrence,
    dropOccurrence: context.dropOccurrence,
    fourBarStage: context.performanceFourBarBlockIndex + 1,
    eightBarStage: context.performanceEightBarBlockIndex + 1,
    sixteenBarStage: context.performanceSixteenBarBlockIndex + 1,
    recentActionReasons: [],
    recentActionTypes: [],
    manualOverrideRoutes: manualOverrideRoutes(state),
    fallbackState,
    transition: null,
    deterministicIdentity: `${context.runtimeIdentity}:pix-grid-inactive`,
  }
}

export function resolvePixGridPerformanceFrame(
  rawState: PixGridState,
  context: SharedPerformanceContext,
  presetId: string | null | undefined,
): PixGridResolvedPerformanceFrame {
  const base = normalizePixGridState(rawState)
  const attachedProgramId = presetId ? PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID[presetId] : null
  const configuredId = attachedProgramId ?? base.performance.sharedPerformanceProgramId
  const program = configuredId ? PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.get(configuredId) : null
  if (!base.performance.enabled || !program) {
    return {
      state: base,
      snapshot: inactiveSnapshot(base, context, program ? null : 'No PixGrid performance program is selected.'),
      appliedActions: [],
      actionLimitDecisions: [],
    }
  }

  const shouldUseSafeFallback = !context.capabilities.sections || context.sectionConfidence < 0.35
  const resolutionContext: SharedPerformanceContext = shouldUseSafeFallback
    ? {
        ...context,
        sectionType: 'unknown',
        macroSectionType: 'unknown',
        sectionFamily: null,
        deterministicVariationSeed: context.deterministicVariationSeed ^ base.performance.seed,
      }
    : {
        ...context,
        deterministicVariationSeed: context.deterministicVariationSeed ^ base.performance.seed,
      }
  const resolution = resolveSharedPerformanceProgram(program, resolutionContext)
  const limited = limitPixGridPerformanceIntents(resolution.intents)
  let state = cloneState(base)
  let transition: PixGridPerformanceRuntimeSnapshot['transition'] = null
  const appliedActions: PixGridPerformanceAction[] = []
  for (const intent of limited.intents) {
    if (isLocked(state, intent.action)) continue
    const result = applyAction(state, base, intent.action, intent.reason, base.performance.intensity)
    state = result.state
    if (result.transition) transition = result.transition
    appliedActions.push(intent.action)
  }
  state = normalizePixGridState(state)

  const fallbackState = !context.capabilities.sections
    ? 'Section analysis unavailable; Shared Performance BPM/grid fallback is active.'
    : context.sectionConfidence < 0.35
      ? 'Low-confidence section analysis; safe PixGrid fallback choreography is active.'
      : resolution.scene == null
        ? 'No authored scene matched; the program fallback scene is active.'
        : null
  const programId = program.id as PixGridPerformanceProgramId
  return {
    state,
    appliedActions,
    actionLimitDecisions: limited.decisions,
    snapshot: {
      active: resolution.scene != null,
      programId,
      programName: program.metadata?.name ?? program.id,
      sceneId: resolution.scene?.id ?? null,
      variationId: resolution.variation?.id ?? null,
      section: context.macroSectionType ?? context.sectionType ?? 'unknown',
      sectionPhase: resolution.sectionPhase,
      sectionOccurrence: context.sectionOccurrence,
      dropOccurrence: context.dropOccurrence,
      fourBarStage: context.performanceFourBarBlockIndex + 1,
      eightBarStage: context.performanceEightBarBlockIndex + 1,
      sixteenBarStage: context.performanceSixteenBarBlockIndex + 1,
      recentActionReasons: limited.intents.map(intent => intent.reason).slice(-12),
      recentActionTypes: appliedActions.map(action => action.type).slice(-12),
      manualOverrideRoutes: manualOverrideRoutes(base),
      fallbackState,
      transition,
      deterministicIdentity: resolution.deterministicIdentity,
    },
  }
}
