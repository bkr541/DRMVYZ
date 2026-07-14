import {
  createPerformanceDeterministicSeed,
  performanceDeterministicUnit,
  resolveSharedPerformanceProgram,
  selectPerformanceDeterministicIndex,
  type SharedPerformanceContext,
  type SharedPerformanceProgram,
} from '../../../../features/performanceCore'
import type { CanvasMediaItem } from '../ReactTypes'
import { getCanvasCompositionTemplate } from './CanvasCompositionTemplates'
import { resolveCanvasEffectChain, resolveCanvasEffectRecipeForSection } from './CanvasEffectRecipes'
import { canvasMediaSupportsAnyRole, resolveCanvasMediaRoles } from './CanvasMediaRoles'
import { resolveCanvasPlayback } from './CanvasPlayback'
import { resolveCanvasTransition } from './CanvasTransitions'
import {
  CANVAS_PERFORMANCE_PROGRAM_ID,
  MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
  MAX_CANVAS_EFFECT_CHAIN_DEPTH,
  MAX_CANVAS_FEEDBACK_PASSES,
  MAX_CANVAS_MEDIA_HANDLES,
  MAX_CANVAS_PERFORMANCE_LAYERS,
  type CanvasCompositionSlot,
  type CanvasCompositionTemplateId,
  type CanvasEffectRecipeId,
  type CanvasLayerRole,
  type CanvasMediaRole,
  type CanvasOrchestrationSettings,
  type CanvasPerformanceAction,
  type CanvasResolvedLayer,
  type CanvasResolvedPerformanceFrame,
  type CanvasTransitionId,
} from './CanvasPerformanceTypes'

const CANVAS_FOUNDATION_PROGRAM: SharedPerformanceProgram<CanvasPerformanceAction> = {
  id: CANVAS_PERFORMANCE_PROGRAM_ID,
  fallbackOrder: ['verse', 'intro', 'breakdown', 'drop', 'unknown'],
  scenes: [
    {
      id: 'intro-atmosphere',
      sectionTypes: ['intro'],
      actions: [
        { type: 'composition', templateId: 'centerHeroAtmosphericBorder' },
        { type: 'effectRecipe', recipeId: 'dreamBreakdown' },
        { type: 'transition', transitionIds: ['crossfade', 'lumaDissolve', 'alphaDissolve'] },
        { type: 'recruit', roles: ['background', 'hero'] },
      ],
      eightBarRecruitment: [[{ type: 'recruit', roles: ['texture'] }]],
    },
    {
      id: 'verse-composite',
      sectionTypes: ['verse', 'unknown'],
      actions: [
        { type: 'composition', templateId: 'heroPlusTexture' },
        { type: 'effectRecipe', recipeId: 'none' },
        { type: 'transition', transitionIds: ['crossfade', 'slide', 'additiveDissolve'] },
        { type: 'recruit', roles: ['background', 'hero'] },
      ],
      eightBarRecruitment: [[{ type: 'recruit', roles: ['texture'] }]],
    },
    {
      id: 'build-assembly',
      sectionTypes: ['build'],
      actions: [
        { type: 'composition', templateId: 'splitScreen' },
        { type: 'effectRecipe', recipeId: 'bassImpact' },
        { type: 'transition', transitionIds: ['push', 'slide', 'zoomThrough', 'maskExpansion'] },
        { type: 'recruit', roles: ['hero', 'foregroundAccent'] },
      ],
      sixteenBarEvolution: [[{ type: 'composition', templateId: 'maskedHeroReveal' }]],
    },
    {
      id: 'predrop-vacuum',
      sectionTypes: ['preDrop'],
      actions: [
        { type: 'composition', templateId: 'maskedHeroReveal' },
        { type: 'effectRecipe', recipeId: 'preDropVacuum' },
        { type: 'transition', transitionIds: ['frameHoldRelease', 'strobeCut', 'hardCut'] },
        { type: 'frameHold', enabled: true },
        { type: 'recruit', roles: ['hero', 'mask'] },
      ],
    },
    {
      id: 'drop-impact',
      sectionTypes: ['drop'],
      actions: [
        { type: 'composition', templateId: 'videoWall' },
        { type: 'effectRecipe', recipeId: 'dropFracture' },
        { type: 'transition', transitionIds: ['displacementBurst', 'rgbSplit', 'sliceDisplacement', 'strobeCut'] },
        { type: 'recruit', roles: ['background', 'hero', 'foregroundAccent'] },
      ],
      eightBarRecruitment: [[{ type: 'recruit', roles: ['texture'] }]],
      sixteenBarEvolution: [[{ type: 'composition', templateId: 'fourPanelGrid' }]],
    },
    {
      id: 'breakdown-drift',
      sectionTypes: ['breakdown', 'bridge'],
      actions: [
        { type: 'composition', templateId: 'layeredLumaCollage' },
        { type: 'effectRecipe', recipeId: 'dreamBreakdown' },
        { type: 'transition', transitionIds: ['crossfade', 'lumaDissolve', 'zoomThrough'] },
        { type: 'recruit', roles: ['background', 'hero', 'texture'] },
      ],
    },
    {
      id: 'outro-release',
      sectionTypes: ['outro'],
      actions: [
        { type: 'composition', templateId: 'fullScreenHero' },
        { type: 'effectRecipe', recipeId: 'dreamBreakdown' },
        { type: 'transition', transitionIds: ['crossfade', 'dipToBlack'] },
        { type: 'retire', roles: ['texture', 'foregroundAccent', 'feedback'] },
      ],
    },
  ],
}

function uniqueMedia(items: readonly CanvasMediaItem[]): CanvasMediaItem[] {
  const byId = new Map<string, CanvasMediaItem>()
  for (const item of items) if (item.id && item.objectUrl) byId.set(item.id, item)
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function sectionPreferredRoles(context: SharedPerformanceContext): CanvasMediaRole[] {
  switch (context.sectionType) {
    case 'drop': return ['dropAsset', 'hero', 'alternateHero']
    case 'build': return ['buildAsset', 'hero', 'alternateHero']
    case 'preDrop': return ['buildAsset', 'transition', 'hero']
    case 'breakdown':
    case 'bridge': return ['breakdownAsset', 'background', 'hero']
    case 'intro': return ['introAsset', 'background', 'hero']
    case 'outro': return ['outroAsset', 'background', 'hero']
    default: return ['hero', 'background', 'alternateHero']
  }
}

function roleCandidates(
  items: readonly CanvasMediaItem[],
  requiredRoles: readonly CanvasMediaRole[],
  fallbackRoles: readonly CanvasMediaRole[],
  settings: CanvasOrchestrationSettings,
  context: SharedPerformanceContext,
): CanvasMediaItem[] {
  const preferred = [...sectionPreferredRoles(context), ...requiredRoles]
  const primary = items.filter(item => canvasMediaSupportsAnyRole(item, preferred, settings))
  if (primary.length > 0) return primary
  const fallback = items.filter(item => canvasMediaSupportsAnyRole(item, fallbackRoles, settings))
  return fallback.length > 0 ? fallback : [...items]
}

export function resolveCanvasDeterministicMedia({
  items,
  requiredRoles,
  fallbackRoles = ['hero', 'background'],
  settings,
  context,
  layerRole,
  previousMediaId = null,
  lockedMediaId = null,
}: {
  items: readonly CanvasMediaItem[]
  requiredRoles: readonly CanvasMediaRole[]
  fallbackRoles?: readonly CanvasMediaRole[]
  settings: CanvasOrchestrationSettings
  context: SharedPerformanceContext
  layerRole: CanvasLayerRole
  previousMediaId?: string | null
  lockedMediaId?: string | null
}): CanvasMediaItem | null {
  const pool = uniqueMedia(items)
  if (lockedMediaId) {
    const locked = pool.find(item => item.id === lockedMediaId)
    if (locked) return locked
  }
  let candidates = roleCandidates(pool, requiredRoles, fallbackRoles, settings, context)
  if (candidates.length > 1 && previousMediaId) {
    const withoutImmediateRepeat = candidates.filter(item => item.id !== previousMediaId)
    if (withoutImmediateRepeat.length > 0) candidates = withoutImmediateRepeat
  }
  if (candidates.length === 0) return null
  const index = selectPerformanceDeterministicIndex(
    candidates.length,
    context.trackIdentity,
    settings.programId,
    context.sectionFamily,
    context.sectionOccurrence,
    context.performanceFourBarBlockIndex,
    settings.poolRevision,
    layerRole,
  )
  return candidates[index] ?? candidates[0] ?? null
}

function resolveTemplateFromProgram(
  context: SharedPerformanceContext,
  settings: CanvasOrchestrationSettings,
): {
  templateId: CanvasCompositionTemplateId
  effectRecipeId: CanvasEffectRecipeId
  transitionIds: readonly CanvasTransitionId[]
  recruitedRoles: Set<CanvasLayerRole>
  retiredRoles: Set<CanvasLayerRole>
  frameHold: boolean
  sceneId: string
} {
  const resolution = resolveSharedPerformanceProgram(CANVAS_FOUNDATION_PROGRAM, context)
  let templateId: CanvasCompositionTemplateId = 'fullScreenHero'
  let effectRecipeId = resolveCanvasEffectRecipeForSection(context)
  let transitionIds: readonly CanvasTransitionId[] = ['crossfade']
  const recruitedRoles = new Set<CanvasLayerRole>(['hero'])
  const retiredRoles = new Set<CanvasLayerRole>()
  let frameHold = false

  for (const intent of resolution.intents) {
    const action = intent.action
    if (action.type === 'composition') templateId = action.templateId
    else if (action.type === 'effectRecipe') effectRecipeId = action.recipeId
    else if (action.type === 'transition') transitionIds = action.transitionIds
    else if (action.type === 'recruit') action.roles.forEach(role => recruitedRoles.add(role))
    else if (action.type === 'retire') action.roles.forEach(role => retiredRoles.add(role))
    else if (action.type === 'frameHold') frameHold = action.enabled
  }

  if (settings.compositionPreference !== 'auto') templateId = settings.compositionPreference
  return {
    templateId,
    effectRecipeId,
    transitionIds,
    recruitedRoles,
    retiredRoles,
    frameHold,
    sceneId: resolution.scene?.id ?? 'fallback',
  }
}

function desiredLayerBudget(settings: CanvasOrchestrationSettings, context: SharedPerformanceContext, templateLayerCount: number): number {
  const base = 1 + Math.round(Math.max(0, Math.min(1, settings.complexity)) * (templateLayerCount - 1))
  const recruitmentBonus = context.performanceEightBarBlockIndex > 0 ? 1 : 0
  return Math.max(1, Math.min(MAX_CANVAS_PERFORMANCE_LAYERS, templateLayerCount, base + recruitmentBonus))
}

function selectPool(
  mediaItems: readonly CanvasMediaItem[],
  settings: CanvasOrchestrationSettings,
): { items: CanvasMediaItem[]; fallbackUsed: boolean } {
  const all = uniqueMedia(mediaItems)
  if (settings.mediaPoolIds.length === 0) return { items: all, fallbackUsed: true }
  const poolIds = new Set(settings.mediaPoolIds)
  const selected = all.filter(item => poolIds.has(item.id))
  return selected.length > 0 ? { items: selected, fallbackUsed: false } : { items: all, fallbackUsed: true }
}

function preserveReadyPrevious(
  candidate: CanvasMediaItem | null,
  previousLayer: CanvasResolvedLayer | null,
  isMediaReady: ((mediaId: string) => boolean) | undefined,
): { source: CanvasMediaItem | null; pending: string | null; fallback: boolean } {
  if (!candidate || !isMediaReady) return { source: candidate, pending: null, fallback: false }
  if (isMediaReady(candidate.id)) return { source: candidate, pending: null, fallback: false }
  if (previousLayer?.source && isMediaReady(previousLayer.source.id)) {
    return { source: previousLayer.source, pending: candidate.id, fallback: true }
  }
  return { source: candidate, pending: candidate.id, fallback: false }
}

function resolveSlotLayer({
  slot,
  pool,
  settings,
  context,
  previousFrame,
  effectRecipeId,
  isMediaReady,
  frameHold,
}: {
  slot: CanvasCompositionSlot
  pool: readonly CanvasMediaItem[]
  settings: CanvasOrchestrationSettings
  context: SharedPerformanceContext
  previousFrame?: CanvasResolvedPerformanceFrame | null
  effectRecipeId: CanvasEffectRecipeId
  isMediaReady?: (mediaId: string) => boolean
  frameHold: boolean
}): { layer: CanvasResolvedLayer; pendingMediaId: string | null; fallbackUsed: boolean } {
  const previousLayer = previousFrame?.layers.find(layer => layer.role === slot.role || layer.id === slot.id) ?? null
  const layerLocked = settings.layerLocks[slot.role] === true
  const mediaChoiceLocked = settings.globalLocks.media === true || layerLocked
  const lockedMediaId = settings.mediaLocksByLayer[slot.role] ?? null
  const timelineReset = context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected
  const quantizedSelectionBoundary = context.boundaries.sectionEntry
    || context.boundaries.macroSectionEntry
    || context.boundaries.performanceFourBarBoundary
  const previousSourceStillAvailable = Boolean(
    previousLayer?.sourceMediaId && pool.some(item => item.id === previousLayer.sourceMediaId),
  )
  const lockedChoiceChanged = Boolean(lockedMediaId && lockedMediaId !== previousLayer?.sourceMediaId)
  const shouldReselect = !previousLayer?.source
    || !previousSourceStillAvailable
    || lockedChoiceChanged
    || timelineReset
    || quantizedSelectionBoundary

  let chosen: CanvasMediaItem | null
  if (lockedMediaId) {
    chosen = resolveCanvasDeterministicMedia({
      items: pool,
      requiredRoles: slot.requiredMediaRoles,
      fallbackRoles: slot.fallbackMediaRoles,
      settings,
      context,
      layerRole: slot.role,
      lockedMediaId,
    })
  } else if (mediaChoiceLocked && previousLayer?.source) {
    chosen = previousLayer.source
  } else if (!shouldReselect && previousLayer?.source) {
    // Hold the current source between musical decision boundaries. Applying
    // anti-repeat logic on every runtime tick would otherwise cycle clips at
    // the resolver interval instead of at bars and phrases.
    chosen = previousLayer.source
  } else {
    chosen = resolveCanvasDeterministicMedia({
      items: pool,
      requiredRoles: slot.requiredMediaRoles,
      fallbackRoles: slot.fallbackMediaRoles,
      settings,
      context,
      layerRole: slot.role,
      previousMediaId: quantizedSelectionBoundary && !timelineReset ? previousLayer?.sourceMediaId ?? null : null,
    })
  }

  const readiness = preserveReadyPrevious(chosen, previousLayer, isMediaReady)
  const source = readiness.source
  const resolvedPlayback = settings.globalLocks.playback && previousLayer
    ? { ...previousLayer.playback, loopRange: { ...previousLayer.playback.loopRange } }
    : resolveCanvasPlayback(source, context, slot.role, `${settings.programId}|${slot.id}`)
  if (frameHold && !settings.globalLocks.playback) resolvedPlayback.frameHold = true
  const effectChain = layerLocked || settings.globalLocks.effectChain
    ? previousLayer?.effectChain ?? []
    : resolveCanvasEffectChain(effectRecipeId, context, settings.effectIntensity).slice(0, MAX_CANVAS_EFFECT_CHAIN_DEPTH)
  const lockedAppearance = layerLocked ? previousLayer : null

  return {
    layer: {
      id: lockedAppearance?.id ?? slot.id,
      role: slot.role,
      sourceMediaId: source?.id ?? null,
      source,
      enabled: lockedAppearance?.enabled ?? (slot.enabled && Boolean(source)),
      opacity: lockedAppearance?.opacity ?? slot.opacity,
      blendMode: lockedAppearance?.blendMode ?? slot.blendMode,
      x: lockedAppearance?.x ?? slot.x,
      y: lockedAppearance?.y ?? slot.y,
      scaleX: lockedAppearance?.scaleX ?? slot.scaleX,
      scaleY: lockedAppearance?.scaleY ?? slot.scaleY,
      rotation: lockedAppearance?.rotation ?? slot.rotation,
      crop: lockedAppearance?.crop ?? slot.crop,
      aspectBehavior: lockedAppearance?.aspectBehavior ?? slot.aspectBehavior,
      zIndex: lockedAppearance?.zIndex ?? slot.zIndex,
      mirrorX: lockedAppearance?.mirrorX ?? slot.mirrorX ?? false,
      mirrorY: lockedAppearance?.mirrorY ?? slot.mirrorY ?? false,
      maskSourceMediaId: null,
      maskMode: lockedAppearance?.maskMode ?? slot.maskMode,
      playback: resolvedPlayback,
      effectChain,
      modulationRoutes: effectChain.flatMap(effect => effect.modulationRoutes).slice(0, 12),
      userLocked: Boolean(mediaChoiceLocked || lockedMediaId),
    },
    pendingMediaId: readiness.pending,
    fallbackUsed: readiness.fallback,
  }
}

function enforceDecoderBounds(layers: CanvasResolvedLayer[], pool: readonly CanvasMediaItem[]): CanvasResolvedLayer[] {
  const activeVideos = new Set<string>()
  return layers.map(layer => {
    if (!layer.enabled || layer.source?.type !== 'video' || !layer.sourceMediaId) return layer
    if (activeVideos.has(layer.sourceMediaId)) return layer
    if (activeVideos.size < MAX_CANVAS_ACTIVE_VIDEO_DECODERS) {
      activeVideos.add(layer.sourceMediaId)
      return layer
    }
    const imageFallback = pool.find(item => item.type !== 'video' && item.id !== layer.sourceMediaId)
    if (!imageFallback) return { ...layer, enabled: false, source: null, sourceMediaId: null }
    return {
      ...layer,
      source: imageFallback,
      sourceMediaId: imageFallback.id,
      playback: { ...layer.playback, playbackRate: 1, phaseSec: 0, inPointSec: 0, loopRange: { startSec: 0, endSec: 0, bars: null } },
    }
  })
}

function attachMaskSources(layers: CanvasResolvedLayer[]): CanvasResolvedLayer[] {
  const mask = layers.find(layer => layer.role === 'mask' && layer.enabled && layer.sourceMediaId)
  if (!mask) return layers
  return layers.map(layer => layer.maskMode && layer.role !== 'mask'
    ? { ...layer, maskSourceMediaId: mask.sourceMediaId }
    : layer)
}

function frameIdentityFor(
  context: SharedPerformanceContext,
  settings: CanvasOrchestrationSettings,
  templateId: CanvasCompositionTemplateId,
  layers: readonly CanvasResolvedLayer[],
): string {
  const seed = createPerformanceDeterministicSeed(
    context.trackIdentity,
    settings.programId,
    context.sectionFamily,
    context.sectionOccurrence,
    context.performanceFourBarBlockIndex,
    settings.poolRevision,
    templateId,
    ...layers.map(layer => `${layer.role}:${layer.sourceMediaId ?? 'none'}`),
  )
  return `${settings.programId}|${templateId}|${context.sectionIdentity}|${context.performanceFourBarBlockIndex}|${seed}`
}

export function resolveCanvasPerformanceFrame({
  context,
  settings,
  mediaItems,
  previousFrame = null,
  isMediaReady,
}: {
  context: SharedPerformanceContext
  settings: CanvasOrchestrationSettings
  mediaItems: readonly CanvasMediaItem[]
  previousFrame?: CanvasResolvedPerformanceFrame | null
  isMediaReady?: (mediaId: string) => boolean
}): CanvasResolvedPerformanceFrame {
  const selection = selectPool(mediaItems, settings)
  const program = resolveTemplateFromProgram(context, settings)
  const templateId = settings.globalLocks.composition && previousFrame
    ? previousFrame.template.id
    : program.templateId
  const template = getCanvasCompositionTemplate(templateId)
  const budget = desiredLayerBudget(settings, context, template.slots.length)
  const pendingMediaIds = new Set<string>()
  let fallbackUsed = selection.fallbackUsed

  const activeSlots = template.slots
    .filter(slot => program.recruitedRoles.has(slot.role) || slot.role === 'hero' || slot.role === 'background')
    .filter(slot => !program.retiredRoles.has(slot.role))
    .slice(0, budget)

  let layers = activeSlots.map(slot => {
    const result = resolveSlotLayer({
      slot,
      pool: selection.items,
      settings,
      context,
      previousFrame,
      effectRecipeId: program.effectRecipeId,
      isMediaReady,
      frameHold: program.frameHold,
    })
    if (result.pendingMediaId) pendingMediaIds.add(result.pendingMediaId)
    fallbackUsed ||= result.fallbackUsed
    return result.layer
  })

  if (previousFrame) {
    const representedRoles = new Set(layers.map(layer => layer.role))
    const retainedLockedLayers = previousFrame.layers
      .filter(layer => settings.layerLocks[layer.role] === true)
      .filter(layer => !representedRoles.has(layer.role))
      .filter(layer => layer.source && selection.items.some(item => item.id === layer.sourceMediaId))
      .map(layer => ({
        ...layer,
        playback: settings.globalLocks.playback
          ? { ...layer.playback, loopRange: { ...layer.playback.loopRange } }
          : resolveCanvasPlayback(layer.source, context, layer.role, `${settings.programId}|${layer.id}`),
        userLocked: true,
      }))
    layers.push(...retainedLockedLayers)
  }

  layers = enforceDecoderBounds(layers, selection.items)
  layers = attachMaskSources(layers)
  layers = layers.slice(0, MAX_CANVAS_PERFORMANCE_LAYERS)
  const frameIdentity = frameIdentityFor(context, settings, template.id, layers)
  const transition = settings.globalLocks.transition
    ? null
    : resolveCanvasTransition({
        context,
        density: settings.transitionDensity,
        allowedIds: program.transitionIds,
        previous: previousFrame?.transition,
        fromFrameIdentity: previousFrame?.frameIdentity ?? null,
        toFrameIdentity: frameIdentity,
      })
  const readyMediaIds = layers
    .map(layer => layer.sourceMediaId)
    .filter((id): id is string => Boolean(id) && (!isMediaReady || isMediaReady(id!)))
  const decoderCount = new Set(layers.filter(layer => layer.enabled && layer.source?.type === 'video').map(layer => layer.sourceMediaId)).size
  const textureHandleCount = new Set(layers.filter(layer => layer.enabled).map(layer => layer.sourceMediaId).filter(Boolean)).size

  return {
    programId: settings.programId || CANVAS_PERFORMANCE_PROGRAM_ID,
    frameIdentity,
    sceneId: program.sceneId,
    context,
    template,
    layers,
    transition,
    effectRecipeId: program.effectRecipeId,
    fallbackUsed,
    readyMediaIds,
    pendingMediaIds: [...pendingMediaIds],
    decoderCount: Math.min(MAX_CANVAS_ACTIVE_VIDEO_DECODERS, decoderCount),
    textureHandleCount: Math.min(MAX_CANVAS_MEDIA_HANDLES, textureHandleCount),
    feedbackPasses: Math.min(MAX_CANVAS_FEEDBACK_PASSES, template.feedbackPasses),
    orchestrationActive: settings.enabled && layers.some(layer => layer.enabled),
  }
}

export function getCanvasPerformancePreloadCandidates(
  frame: CanvasResolvedPerformanceFrame,
  settings: CanvasOrchestrationSettings,
  mediaItems: readonly CanvasMediaItem[],
): string[] {
  const active = new Set(frame.layers.map(layer => layer.sourceMediaId).filter((id): id is string => Boolean(id)))
  const pool = selectPool(mediaItems, settings).items
  const sectionRoles = sectionPreferredRoles(frame.context)
  const pending = frame.pendingMediaIds.filter(id => !active.has(id))
  const pendingSet = new Set(pending)
  const ranked = pool
    .filter(item => !active.has(item.id) && !pendingSet.has(item.id))
    .map(item => ({
      id: item.id,
      score: resolveCanvasMediaRoles(item, settings).effective.reduce((score, role) => score + (sectionRoles.includes(role) ? 3 : role === 'transition' || role === 'mask' ? 1 : 0), 0)
        + performanceDeterministicUnit(frame.frameIdentity, item.id),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  return [...pending, ...ranked.map(item => item.id)].slice(0, 4)
}
