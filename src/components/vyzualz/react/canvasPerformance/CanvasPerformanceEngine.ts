import {
  createPerformanceDeterministicSeed,
  performanceDeterministicUnit,
  resolveSharedPerformanceProgram,
  type SharedPerformanceContext,
} from '../../../../features/performanceCore'
import type { CanvasMediaItem } from '../ReactTypes'
import { getCanvasCompositionTemplate } from './CanvasCompositionTemplates'
import { resolveCanvasEffectChain, resolveCanvasEffectRecipeForSection } from './CanvasEffectRecipes'
import { resolveCanvasMediaRoles } from './CanvasMediaRoles'
import { resolveCanvasPlayback } from './CanvasPlayback'
import { resolveCanvasContextualTransitionIds, resolveCanvasTransition } from './CanvasTransitions'
import { getCanvasPerformanceShow } from './CanvasPerformanceShows'
import {
  resolveCanvasCompositionRichnessTier,
  resolveCanvasCutOpportunityProbability,
  resolveCanvasMotionResponse,
} from './CanvasOrchestrationResponse'
import {
  makeCanvasFracturesProcessorIdentity,
  resolveCanvasFracturesShowOverrides,
} from './CanvasFracturesPerformance'
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
  type CanvasFracturesOverrideProfile,
  type CanvasLayerRole,
  type CanvasLayerTreatment,
  type CanvasMediaRole,
  type CanvasOrchestrationSettings,
  type CanvasResolvedLayer,
  type CanvasResolvedPerformanceFrame,
  type CanvasTransitionId,
} from './CanvasPerformanceTypes'

type CanvasAnticipatoryStage = CanvasResolvedPerformanceFrame['anticipatoryStage']

interface CanvasResolvedProgramState {
  templateId: CanvasCompositionTemplateId
  effectRecipeId: CanvasEffectRecipeId
  transitionIds: readonly CanvasTransitionId[]
  recruitedRoles: Set<CanvasLayerRole>
  retiredRoles: Set<CanvasLayerRole>
  treatments: CanvasLayerTreatment[]
  advanceRoles: Set<CanvasLayerRole>
  selectionIdentity: string
  effectBoost: number
  frameHold: boolean
  sceneId: string
  showLabel: string
  lowConfidenceFallback: boolean
  nextSectionType: string | null
  anticipatoryStage: CanvasAnticipatoryStage
  diagnostics: string[]
  fracturesProfile: CanvasFracturesOverrideProfile | null
}

function nextSectionForContext(context: SharedPerformanceContext) {
  const currentEnd = context.resolvedSection?.endSec ?? context.audioTimeSec
  return context.sections
    .filter(section => section.startSec >= currentEnd - 1e-4 && section.id !== context.sectionId)
    .sort((a, b) => a.startSec - b.startSec || a.id.localeCompare(b.id))[0] ?? null
}

function resolveAnticipatoryStage(context: SharedPerformanceContext, nextType: string | null): CanvasAnticipatoryStage {
  if (!nextType) return context.upcomingSemanticMoments.length > 0 && context.phraseProgress >= 0.82 ? 'phraseQueue' : 'none'
  if (nextType === 'drop' && context.barsUntilSectionEnd <= 1.05) return 'finalHold'
  if (nextType === 'preDrop' && context.barsUntilSectionEnd <= 2.05) return 'contraction'
  if ((nextType === 'breakdown' || nextType === 'bridge') && context.barsUntilSectionEnd <= 2.05) return 'breakdownMigration'
  if (context.barsUntilSectionEnd <= 4.05) return 'preload'
  if (context.upcomingSemanticMoments.length > 0 && context.phraseProgress >= 0.82) return 'phraseQueue'
  return 'none'
}

function treatmentForRole(treatments: readonly CanvasLayerTreatment[], role: CanvasLayerRole): CanvasLayerTreatment | null {
  const applicable = treatments.filter(treatment => treatment.roles.includes(role))
  if (!applicable.length) return null
  return applicable.reduce<CanvasLayerTreatment>((combined, treatment) => ({
    roles: [role],
    opacityMultiplier: (combined.opacityMultiplier ?? 1) * (treatment.opacityMultiplier ?? 1),
    scaleMultiplier: (combined.scaleMultiplier ?? 1) * (treatment.scaleMultiplier ?? 1),
    rotationOffset: (combined.rotationOffset ?? 0) + (treatment.rotationOffset ?? 0),
    offsetX: (combined.offsetX ?? 0) + (treatment.offsetX ?? 0),
    offsetY: (combined.offsetY ?? 0) + (treatment.offsetY ?? 0),
    cropInset: Math.min(0.18, (combined.cropInset ?? 0) + (treatment.cropInset ?? 0)),
  }), { roles: [role] })
}

function scaledAuthoredMotionTreatment(
  treatment: CanvasLayerTreatment | null,
  motion: number,
): CanvasLayerTreatment | null {
  if (!treatment) return null
  return {
    roles: treatment.roles,
    // Opacity is authored appearance, not physical motion, so it is intentionally
    // not coupled to the Motion Intensity control.
    opacityMultiplier: treatment.opacityMultiplier,
    scaleMultiplier: treatment.scaleMultiplier == null ? undefined : 1 + (treatment.scaleMultiplier - 1) * motion,
    rotationOffset: (treatment.rotationOffset ?? 0) * motion,
    offsetX: (treatment.offsetX ?? 0) * motion,
    offsetY: (treatment.offsetY ?? 0) * motion,
    cropInset: (treatment.cropInset ?? 0) * motion,
  }
}

function continuousTreatmentForRole(
  role: CanvasLayerRole,
  context: SharedPerformanceContext,
  settings: CanvasOrchestrationSettings,
): CanvasLayerTreatment | null {
  if (settings.globalLocks.motion) return null
  const confidenceScale = context.sectionConfidence < 0.36 ? 0.35 : 1
  const motion = resolveCanvasMotionResponse(settings.motionIntensity) * confidenceScale
  if (motion <= 0) return null

  const bass = Math.max(0, Math.min(1, context.bass))
  const phrase = Math.max(0, Math.min(1, context.phraseProgress))
  const flux = Math.max(0, Math.min(1, context.spectralFlux))
  const tension = Math.max(0, Math.min(1, context.tension))
  const vocal = Math.max(0, Math.min(1, context.vocalEnergy))
  const phaseOffset = performanceDeterministicUnit(
    context.trackIdentity,
    settings.programId,
    context.sectionIdentity,
    role,
    'canvas-motion-phase',
  ) * Math.PI * 2
  const slowOscillator = Math.sin(context.audioTimeSec * 1.15 + phaseOffset)
  const fastOscillator = Math.sin(context.audioTimeSec * 2.4 + phaseOffset * 0.73)

  if (role === 'hero') {
    const tensionCrop = context.sectionType === 'build' || context.sectionType === 'preDrop'
      ? tension * (0.035 + context.buildProgress * 0.065) * motion
      : 0
    return {
      roles: [role],
      scaleMultiplier: 1 + (bass * 0.055 + (slowOscillator + 1) * 0.008) * motion,
      // Preserve musical phrase travel while retaining the stronger deterministic
      // drift introduced by Stage 1. Sampling the same clock phase with different
      // phrase progress must still produce different hero positions.
      offsetX: Math.max(-0.055, Math.min(0.055, slowOscillator * 0.04 + (phrase - 0.5) * 0.03)) * motion,
      offsetY: fastOscillator * 0.025 * motion,
      rotationOffset: fastOscillator * 1.2 * motion,
      cropInset: Math.min(0.11, tensionCrop),
    }
  }
  if (role === 'texture') {
    return {
      roles: [role],
      scaleMultiplier: 1 + (0.018 + flux * 0.025) * motion,
      offsetX: fastOscillator * 0.045 * motion,
      // Spectral flux shifts the texture's center of travel while the oscillator
      // supplies continuous motion, all within the same bounded Stage 1 range.
      offsetY: Math.max(-0.065, Math.min(0.065, slowOscillator * 0.05 + (flux - 0.5) * 0.03)) * motion,
      rotationOffset: slowOscillator * 3.2 * motion,
    }
  }
  if (role === 'foregroundAccent') {
    return {
      roles: [role],
      scaleMultiplier: 1 + (0.02 + vocal * 0.035) * motion,
      offsetX: slowOscillator * (0.045 + vocal * 0.025) * motion,
      offsetY: fastOscillator * 0.04 * motion,
      rotationOffset: fastOscillator * 2.1 * motion,
    }
  }
  if (role === 'background') {
    return {
      roles: [role],
      scaleMultiplier: 1 + (0.018 + bass * 0.025) * motion,
      offsetX: slowOscillator * 0.025 * motion,
      offsetY: fastOscillator * 0.018 * motion,
    }
  }
  if (role === 'feedback' || role === 'transition') {
    return {
      roles: [role],
      scaleMultiplier: 1 + (0.025 + flux * 0.035) * motion,
      rotationOffset: slowOscillator * 2.6 * motion,
      offsetX: fastOscillator * 0.035 * motion,
      offsetY: slowOscillator * 0.035 * motion,
    }
  }
  if (role === 'mask') {
    return {
      roles: [role],
      scaleMultiplier: 1 + 0.025 * motion,
      rotationOffset: slowOscillator * 1.4 * motion,
    }
  }
  return null
}

function continuousAppearanceTreatmentForRole(
  role: CanvasLayerRole,
  context: SharedPerformanceContext,
): CanvasLayerTreatment | null {
  const energy = Math.max(0, Math.min(1, context.trackRelativeEnergy))
  const vocal = Math.max(0, Math.min(1, context.vocalEnergy))

  if (role === 'texture') {
    return { roles: [role], opacityMultiplier: 0.82 + energy * 0.18 }
  }
  if (role === 'foregroundAccent') {
    return { roles: [role], opacityMultiplier: 0.8 + vocal * 0.2 }
  }
  if (role === 'background') {
    return { roles: [role], opacityMultiplier: 0.9 + energy * 0.1 }
  }
  return null
}

function resolvedTreatmentForRole(
  authored: readonly CanvasLayerTreatment[],
  role: CanvasLayerRole,
  context: SharedPerformanceContext,
  settings: CanvasOrchestrationSettings,
): CanvasLayerTreatment | null {
  const motion = settings.globalLocks.motion ? 0 : resolveCanvasMotionResponse(settings.motionIntensity)
  const authoredTreatment = scaledAuthoredMotionTreatment(treatmentForRole(authored, role), motion)
  const continuous = continuousTreatmentForRole(role, context, settings)
  const appearance = continuousAppearanceTreatmentForRole(role, context)
  const combined = [authoredTreatment, continuous, appearance].filter((value): value is CanvasLayerTreatment => value !== null)
  return treatmentForRole(combined, role)
}

function shouldApplyAdvanceIntent(
  context: SharedPerformanceContext,
  settings: CanvasOrchestrationSettings,
  intent: { reason: string; identity: string },
): boolean {
  // Cadence actions remain present for the duration of their cadence stage. Only
  // treat the actual crossed boundary as an edit opportunity, otherwise a 100%
  // Cut Density value would reselect media on every orchestration tick.
  if (intent.reason === 'sectionEntry' && !context.boundaries.sectionEntry && !context.boundaries.macroSectionEntry) return false
  if (intent.reason === 'fourBarMotif' && !context.boundaries.performanceFourBarBoundary) return false
  if (intent.reason === 'eightBarRecruitment' && !context.boundaries.performanceEightBarBoundary) return false
  if (intent.reason === 'sixteenBarEvolution' && !context.boundaries.performanceSixteenBarBoundary) return false

  const opportunityWeight = intent.reason === 'sectionEntry' || intent.reason === 'sixteenBarEvolution'
    ? 1
    : intent.reason === 'eightBarRecruitment'
      ? 0.96
      : intent.reason === 'fourBarMotif' || intent.reason === 'downbeat'
        ? 0.9
        : intent.reason === 'semanticMoment'
          ? 0.82
          : intent.reason === 'snare' || intent.reason === 'kick'
            ? 0.68
            : 0.55
  const chance = resolveCanvasCutOpportunityProbability(settings.cutDensity, opportunityWeight)
  if (chance <= 0) return false
  if (chance >= 1) return true
  return performanceDeterministicUnit(
    context.trackIdentity,
    settings.programId,
    context.sectionIdentity,
    context.beatIndex,
    intent.identity,
    'canvas-authored-cut-density',
  ) < chance
}

function uniqueMedia(items: readonly CanvasMediaItem[]): CanvasMediaItem[] {
  const byId = new Map<string, CanvasMediaItem>()
  for (const item of items) if (item.id && item.objectUrl) byId.set(item.id, item)
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function sectionPreferredRolesForType(sectionType: string | null | undefined): CanvasMediaRole[] {
  switch (sectionType) {
    case 'drop': return ['dropAsset', 'hero', 'alternateHero', 'foregroundAccent']
    case 'build': return ['buildAsset', 'transition', 'alternateHero', 'hero']
    case 'preDrop': return ['buildAsset', 'transition', 'mask', 'hero']
    case 'breakdown':
    case 'bridge': return ['breakdownAsset', 'background', 'texture', 'hero']
    case 'intro': return ['introAsset', 'background', 'hero', 'texture']
    case 'outro': return ['outroAsset', 'background', 'hero']
    default: return ['hero', 'alternateHero', 'background']
  }
}

function sectionPreferredRoles(context: SharedPerformanceContext): CanvasMediaRole[] {
  return sectionPreferredRolesForType(context.sectionType)
}

type CanvasMediaSuitabilityTier = 0 | 1 | 2 | 3

interface CanvasMediaCandidateScore {
  item: CanvasMediaItem
  tier: CanvasMediaSuitabilityTier
  score: number
}

function mediaSuitabilityTier(
  effectiveRoles: readonly CanvasMediaRole[],
  requiredRoles: readonly CanvasMediaRole[],
  fallbackRoles: readonly CanvasMediaRole[],
  sectionRoles: readonly CanvasMediaRole[],
): CanvasMediaSuitabilityTier {
  if (requiredRoles.some(role => effectiveRoles.includes(role))) return 3
  if (fallbackRoles.some(role => effectiveRoles.includes(role))) return 2
  if (sectionRoles.some(role => effectiveRoles.includes(role))) return 1
  return 0
}

function orderedRolePreferenceScore(
  effectiveRoles: readonly CanvasMediaRole[],
  preferences: readonly CanvasMediaRole[],
  scale: number,
): number {
  const index = preferences.findIndex(role => effectiveRoles.includes(role))
  return index < 0 ? 0 : (preferences.length - index) * scale
}

function scoreCanvasMediaCandidate({
  item,
  requiredRoles,
  fallbackRoles,
  settings,
  context,
  layerRole,
  assignedMediaIds,
  allowIntentionalDuplication,
  selectionIdentity,
}: {
  item: CanvasMediaItem
  requiredRoles: readonly CanvasMediaRole[]
  fallbackRoles: readonly CanvasMediaRole[]
  settings: CanvasOrchestrationSettings
  context: SharedPerformanceContext
  layerRole: CanvasLayerRole
  assignedMediaIds: ReadonlySet<string>
  allowIntentionalDuplication: boolean
  selectionIdentity: string
}): CanvasMediaCandidateScore {
  const show = getCanvasPerformanceShow(settings.programId)
  const strategy = show.mediaStrategy
  const roles = resolveCanvasMediaRoles(item, settings)
  const sectionRoles = sectionPreferredRoles(context)
  const tier = mediaSuitabilityTier(roles.effective, requiredRoles, fallbackRoles, sectionRoles)
  const explicitMatch = roles.explicit.some(role => requiredRoles.includes(role)) ? 1.25 : 0
  const requiredPreference = orderedRolePreferenceScore(roles.effective, requiredRoles, 0.85)
  const sectionPreference = orderedRolePreferenceScore(roles.effective, sectionRoles, 0.34)
  const showLayerPreference = orderedRolePreferenceScore(
    roles.effective,
    strategy.layerRolePreferences[layerRole] ?? [],
    1.1,
  )
  const showRolePreference = roles.effective.reduce(
    (best, role) => Math.max(best, strategy.roleWeights[role] ?? 0),
    0,
  )
  const sourceTypePreference = strategy.sourceTypeWeights[layerRole]?.[item.type] ?? 0
  const duplicatePenalty = !allowIntentionalDuplication && assignedMediaIds.has(item.id)
    ? strategy.diversityWeight * 12
    : 0
  const stableVariation = performanceDeterministicUnit(
    context.trackIdentity,
    settings.programId,
    context.sectionIdentity,
    context.sectionOccurrence,
    context.performanceFourBarBlockIndex,
    settings.poolRevision,
    layerRole,
    item.id,
    selectionIdentity,
    'canvas-stage2-media-score',
  ) * 0.45

  return {
    item,
    tier,
    score: explicitMatch
      + requiredPreference
      + sectionPreference
      + showLayerPreference
      + showRolePreference
      + sourceTypePreference
      + stableVariation
      - duplicatePenalty,
  }
}

/**
 * Deterministic media intelligence for a single composition role. Role suitability
 * is a hard tier: diversity and show personality can decide among equally suitable
 * sources, but they cannot make an unrelated source beat a genuinely suitable one.
 */
export function resolveCanvasDeterministicMedia({
  items,
  requiredRoles,
  fallbackRoles = ['hero', 'background'],
  settings,
  context,
  layerRole,
  previousMediaId = null,
  lockedMediaId = null,
  selectionIdentity = '',
  assignedMediaIds = [],
  allowIntentionalDuplication = false,
}: {
  items: readonly CanvasMediaItem[]
  requiredRoles: readonly CanvasMediaRole[]
  fallbackRoles?: readonly CanvasMediaRole[]
  settings: CanvasOrchestrationSettings
  context: SharedPerformanceContext
  layerRole: CanvasLayerRole
  previousMediaId?: string | null
  lockedMediaId?: string | null
  selectionIdentity?: string
  assignedMediaIds?: readonly string[]
  allowIntentionalDuplication?: boolean
}): CanvasMediaItem | null {
  const pool = uniqueMedia(items)
  if (lockedMediaId) {
    const locked = pool.find(item => item.id === lockedMediaId)
    if (locked) return locked
  }
  if (pool.length === 0) return null

  const assigned = new Set(assignedMediaIds)
  let scored = pool.map(item => scoreCanvasMediaCandidate({
    item,
    requiredRoles,
    fallbackRoles,
    settings,
    context,
    layerRole,
    assignedMediaIds: assigned,
    allowIntentionalDuplication,
    selectionIdentity,
  }))
  const bestTier = scored.reduce<CanvasMediaSuitabilityTier>((best, candidate) => Math.max(best, candidate.tier) as CanvasMediaSuitabilityTier, 0)
  scored = scored.filter(candidate => candidate.tier === bestTier)

  // An authored advance is an edit opportunity, so avoid the immediately previous
  // source when another equally suitable source exists. A one-source pool still reuses safely.
  if (previousMediaId && scored.length > 1) {
    const withoutImmediateRepeat = scored.filter(candidate => candidate.item.id !== previousMediaId)
    if (withoutImmediateRepeat.length > 0) scored = withoutImmediateRepeat
  }

  scored.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
  return scored[0]?.item ?? null
}

function slotAllowsIntentionalDuplication(
  templateId: CanvasCompositionTemplateId,
  slot: CanvasCompositionSlot,
  settings: CanvasOrchestrationSettings,
): boolean {
  if (slot.role === 'feedback') return true
  if (templateId === 'mirroredDualClip' && slot.id === 'hero-right') return true
  return getCanvasPerformanceShow(settings.programId).mediaStrategy.duplicationPolicy === 'fracture'
}

export function resolveCanvasAuthoredProgramState(
  context: SharedPerformanceContext,
  settings: CanvasOrchestrationSettings,
): CanvasResolvedProgramState {
  const show = getCanvasPerformanceShow(settings.programId)
  const lowConfidenceFallback = !context.capabilities.sections || context.sectionConfidence < 0.36
  const resolutionContext = lowConfidenceFallback
    ? { ...context, sectionType: 'unknown' as const, macroSectionType: 'unknown' as const, sectionFamily: null }
    : context
  const resolution = resolveSharedPerformanceProgram(show.program, resolutionContext)
  let templateId: CanvasCompositionTemplateId = 'fullScreenHero'
  let effectRecipeId = resolveCanvasEffectRecipeForSection(context)
  let transitionIds: readonly CanvasTransitionId[] = ['crossfade']
  const recruitedRoles = new Set<CanvasLayerRole>(['hero'])
  const retiredRoles = new Set<CanvasLayerRole>()
  const treatments: CanvasLayerTreatment[] = []
  const advanceRoles = new Set<CanvasLayerRole>()
  const selectionIdentities: string[] = []
  let effectBoost = 0
  let frameHold = false
  let fracturesProfile: CanvasFracturesOverrideProfile | null = null

  for (const intent of resolution.intents) {
    const action = intent.action
    if (action.type === 'composition') templateId = action.templateId
    else if (action.type === 'effectRecipe') effectRecipeId = action.recipeId
    else if (action.type === 'transition') transitionIds = action.transitionIds
    else if (action.type === 'recruit') action.roles.forEach(role => recruitedRoles.add(role))
    else if (action.type === 'retire') action.roles.forEach(role => retiredRoles.add(role))
    else if (action.type === 'frameHold') frameHold = action.enabled
    else if (action.type === 'layerTreatment') treatments.push(action.treatment)
    else if (action.type === 'effectBoost') effectBoost += action.amount
    else if (action.type === 'specializedRenderer' && action.kind === 'fractures') fracturesProfile = action.profile
    else if (action.type === 'advanceMedia' && shouldApplyAdvanceIntent(context, settings, intent)) {
      action.roles.forEach(role => advanceRoles.add(role))
      selectionIdentities.push(intent.identity)
    }
  }

  const nextSection = nextSectionForContext(context)
  const nextSectionType = nextSection?.type ?? null
  const anticipatoryStage = resolveAnticipatoryStage(context, nextSectionType)
  if (anticipatoryStage === 'contraction') {
    // Keep the resolved show's authored composition. Stage 1's shared contraction
    // recipe used to force every show into Masked Hero Reveal here,
    // flattening show identity immediately before the most visible boundary.
    effectRecipeId = 'preDropVacuum'
    transitionIds = ['feedbackSmear', 'maskExpansion', 'frameHoldRelease']
    retiredRoles.add('texture')
    retiredRoles.add('foregroundAccent')
    treatments.push({ roles: ['hero'], scaleMultiplier: 0.88, cropInset: 0.07 })
  } else if (anticipatoryStage === 'finalHold') {
    effectRecipeId = 'preDropVacuum'
    transitionIds = ['frameHoldRelease', 'hardCut']
    frameHold = true
    retiredRoles.add('texture')
    retiredRoles.add('foregroundAccent')
    treatments.push({ roles: ['hero'], scaleMultiplier: 0.84, cropInset: 0.1 })
  } else if (anticipatoryStage === 'breakdownMigration') {
    effectRecipeId = 'dreamBreakdown'
    transitionIds = ['lumaDissolve', 'additiveDissolve', 'crossfade']
    treatments.push({ roles: ['hero'], scaleMultiplier: 0.96 })
  } else if (anticipatoryStage === 'phraseQueue') {
    transitionIds = resolveCanvasContextualTransitionIds(context, transitionIds)
  }

  if (context.sectionType === 'drop' && context.dropImpact > 0.1) frameHold = false
  if (settings.compositionPreference !== 'auto') templateId = settings.compositionPreference
  transitionIds = resolveCanvasContextualTransitionIds(context, transitionIds)

  const diagnostics: string[] = []
  if (lowConfidenceFallback) diagnostics.push('low-confidence-safe-choreography')
  if (anticipatoryStage !== 'none') diagnostics.push(`anticipatory:${anticipatoryStage}`)

  return {
    templateId,
    effectRecipeId,
    transitionIds,
    recruitedRoles,
    retiredRoles,
    treatments,
    advanceRoles,
    selectionIdentity: selectionIdentities.sort().join('|'),
    effectBoost: Math.max(0, Math.min(0.4, effectBoost)),
    frameHold,
    sceneId: resolution.scene?.id ?? show.fallbackSceneId,
    showLabel: show.label,
    lowConfidenceFallback,
    nextSectionType,
    anticipatoryStage,
    diagnostics,
    fracturesProfile,
  }
}

function activeSlotsForComplexity(
  template: ReturnType<typeof getCanvasCompositionTemplate>,
  settings: CanvasOrchestrationSettings,
  retiredRoles: ReadonlySet<CanvasLayerRole>,
): readonly CanvasCompositionSlot[] {
  const richnessTier = Math.min(template.maxRichnessTier, resolveCanvasCompositionRichnessTier(settings.complexity))
  return template.slots
    .filter(slot => slot.richnessTier <= richnessTier)
    // Core slots are structural identity and cannot be removed by scene retirement.
    .filter(slot => slot.richnessTier === 0 || !retiredRoles.has(slot.role))
    .slice(0, MAX_CANVAS_PERFORMANCE_LAYERS)
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
  treatment,
  forceAdvance,
  selectionIdentity,
  effectBoost,
  assignedMediaIds,
  allowIntentionalDuplication,
}: {
  slot: CanvasCompositionSlot
  pool: readonly CanvasMediaItem[]
  settings: CanvasOrchestrationSettings
  context: SharedPerformanceContext
  previousFrame?: CanvasResolvedPerformanceFrame | null
  effectRecipeId: CanvasEffectRecipeId
  isMediaReady?: (mediaId: string) => boolean
  frameHold: boolean
  treatment: CanvasLayerTreatment | null
  forceAdvance: boolean
  selectionIdentity: string
  effectBoost: number
  assignedMediaIds: readonly string[]
  allowIntentionalDuplication: boolean
}): { layer: CanvasResolvedLayer; pendingMediaId: string | null; fallbackUsed: boolean } {
  const previousLayer = previousFrame?.layers.find(layer => layer.role === slot.role || layer.id === slot.id) ?? null
  const layerLocked = settings.layerLocks[slot.role] === true
  const mediaChoiceLocked = settings.globalLocks.media === true || layerLocked
  const lockedMediaId = settings.mediaLocksByLayer[slot.role] ?? null
  const timelineReset = context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected
  const previousSourceStillAvailable = Boolean(
    previousLayer?.sourceMediaId && pool.some(item => item.id === previousLayer.sourceMediaId),
  )
  const lockedChoiceChanged = Boolean(lockedMediaId && lockedMediaId !== previousLayer?.sourceMediaId)
  const programChanged = Boolean(previousFrame && previousFrame.programId !== settings.programId)
  const shouldReselect = forceAdvance
    || programChanged
    || !previousLayer?.source
    || !previousSourceStillAvailable
    || lockedChoiceChanged
    || timelineReset

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
      previousMediaId: forceAdvance && !timelineReset ? previousLayer?.sourceMediaId ?? null : null,
      selectionIdentity: forceAdvance ? selectionIdentity : '',
      assignedMediaIds,
      allowIntentionalDuplication,
    })
  }

  const readiness = preserveReadyPrevious(chosen, previousLayer, isMediaReady)
  const source = readiness.source
  const resolvedPlayback = settings.globalLocks.playback && previousLayer
    ? { ...previousLayer.playback, loopRange: { ...previousLayer.playback.loopRange } }
    : resolveCanvasPlayback(source, context, slot.role, `${settings.programId}|${slot.id}`)
  if (frameHold && !settings.globalLocks.playback) resolvedPlayback.frameHold = true
  const effectiveEffectIntensity = settings.effectIntensity <= 0
    ? 0
    : Math.min(1, settings.effectIntensity * (1 + effectBoost))
  const effectChain = layerLocked || settings.globalLocks.effectChain
    ? previousLayer?.effectChain ?? []
    : resolveCanvasEffectChain(effectRecipeId, context, effectiveEffectIntensity).slice(0, MAX_CANVAS_EFFECT_CHAIN_DEPTH)
  const lockedAppearance = layerLocked ? previousLayer : null
  const treatmentEnabled = !lockedAppearance && !settings.globalLocks.motion && treatment !== null
  const opacityMultiplier = treatmentEnabled ? treatment?.opacityMultiplier ?? 1 : 1
  const scaleMultiplier = treatmentEnabled ? treatment?.scaleMultiplier ?? 1 : 1
  const cropInset = treatmentEnabled ? Math.max(0, Math.min(0.22, treatment?.cropInset ?? 0)) : 0
  const treatedCrop = cropInset > 0
    ? {
        x: Math.min(0.48, slot.crop.x + cropInset),
        y: Math.min(0.48, slot.crop.y + cropInset),
        width: Math.max(0.04, slot.crop.width - cropInset * 2),
        height: Math.max(0.04, slot.crop.height - cropInset * 2),
      }
    : slot.crop

  return {
    layer: {
      id: lockedAppearance?.id ?? slot.id,
      role: slot.role,
      sourceMediaId: source?.id ?? null,
      source,
      enabled: lockedAppearance?.enabled ?? (slot.enabled && Boolean(source)),
      opacity: lockedAppearance?.opacity ?? Math.max(0, Math.min(1, slot.opacity * opacityMultiplier)),
      blendMode: lockedAppearance?.blendMode ?? slot.blendMode,
      x: lockedAppearance?.x ?? slot.x + (treatmentEnabled ? treatment?.offsetX ?? 0 : 0),
      y: lockedAppearance?.y ?? slot.y + (treatmentEnabled ? treatment?.offsetY ?? 0 : 0),
      scaleX: lockedAppearance?.scaleX ?? slot.scaleX * scaleMultiplier,
      scaleY: lockedAppearance?.scaleY ?? slot.scaleY * scaleMultiplier,
      rotation: lockedAppearance?.rotation ?? slot.rotation + (treatmentEnabled ? treatment?.rotationOffset ?? 0 : 0),
      crop: lockedAppearance?.crop ?? treatedCrop,
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
  const activeSources = new Set<string>()
  return layers.map(layer => {
    if (!layer.enabled || !layer.sourceMediaId) return layer
    if (layer.source?.type !== 'video') {
      activeSources.add(layer.sourceMediaId)
      return layer
    }
    if (activeVideos.has(layer.sourceMediaId)) {
      activeSources.add(layer.sourceMediaId)
      return layer
    }
    if (activeVideos.size < MAX_CANVAS_ACTIVE_VIDEO_DECODERS) {
      activeVideos.add(layer.sourceMediaId)
      activeSources.add(layer.sourceMediaId)
      return layer
    }
    const imageFallbacks = pool.filter(item => item.type !== 'video' && item.id !== layer.sourceMediaId)
    const imageFallback = imageFallbacks.find(item => !activeSources.has(item.id)) ?? imageFallbacks[0]
    if (!imageFallback) return { ...layer, enabled: false, source: null, sourceMediaId: null }
    activeSources.add(imageFallback.id)
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

function resolveCanvasFracturesPerformanceFrame({
  context,
  settings,
  selection,
  program,
  previousFrame,
  isMediaReady,
}: {
  context: SharedPerformanceContext
  settings: CanvasOrchestrationSettings
  selection: { items: CanvasMediaItem[]; fallbackUsed: boolean }
  program: CanvasResolvedProgramState
  previousFrame: CanvasResolvedPerformanceFrame | null
  isMediaReady?: (mediaId: string) => boolean
}): CanvasResolvedPerformanceFrame {
  const template = getCanvasCompositionTemplate('fullScreenHero')
  const heroSlot = template.slots.find(slot => slot.role === 'hero') ?? template.slots[0]
  const result = resolveSlotLayer({
    slot: heroSlot,
    pool: selection.items,
    settings,
    context,
    previousFrame,
    effectRecipeId: 'none',
    isMediaReady,
    frameHold: false,
    treatment: null,
    forceAdvance: program.advanceRoles.has('hero'),
    selectionIdentity: program.selectionIdentity || program.sceneId,
    effectBoost: 0,
    assignedMediaIds: [],
    allowIntentionalDuplication: true,
  })
  const overrides = resolveCanvasFracturesShowOverrides({
    authoredProfile: program.fracturesProfile!,
    persistedProfile: settings.fracturesShowOverrides,
    orchestrationSettings: settings,
    context,
  })
  const processorIdentity = makeCanvasFracturesProcessorIdentity({
    programId: settings.programId,
    sceneId: program.sceneId,
    context,
    overrides,
  })
  const layer: CanvasResolvedLayer = {
    ...result.layer,
    id: 'canvas-fractures-logical-layer',
    role: 'hero',
    effectChain: [],
    modulationRoutes: [],
    processor: {
      kind: 'fractures',
      presetId: 'canvas-fractures',
      identity: processorIdentity,
      overrides,
    },
  }
  const frameIdentity = frameIdentityFor(context, settings, template.id, program.effectRecipeId, [layer]) + `|${processorIdentity}`
  const sourceMediaId = layer.sourceMediaId
  const readyMediaIds = sourceMediaId && (!isMediaReady || isMediaReady(sourceMediaId)) ? [sourceMediaId] : []
  const pendingMediaIds = result.pendingMediaId ? [result.pendingMediaId] : []
  const diagnostics = [...program.diagnostics, 'specialized:fractures', 'fractures-one-logical-layer']
  if (selection.fallbackUsed) diagnostics.push('media-pool-fallback')
  if (selection.items.length === 0) diagnostics.push('no-media-available')
  else if (selection.items.length === 1) diagnostics.push('single-media-safe-mode')
  if (selection.items.length > 0 && selection.items.every(item => item.type !== 'video')) diagnostics.push('image-only-safe-mode')
  if (pendingMediaIds.length > 0) diagnostics.push('late-media-current-clip-retained')

  return {
    programId: settings.programId || CANVAS_PERFORMANCE_PROGRAM_ID,
    frameIdentity,
    sceneId: program.sceneId,
    showLabel: program.showLabel,
    context,
    template,
    layers: [layer],
    transition: null,
    effectRecipeId: 'none',
    fallbackUsed: selection.fallbackUsed || result.fallbackUsed,
    readyMediaIds,
    pendingMediaIds,
    decoderCount: layer.enabled && layer.source?.type === 'video' ? 1 : 0,
    textureHandleCount: layer.enabled && layer.sourceMediaId ? 1 : 0,
    feedbackPasses: 0,
    orchestrationActive: settings.enabled && layer.enabled,
    nextSectionType: program.nextSectionType,
    anticipatoryStage: program.anticipatoryStage,
    diagnostics: [...new Set(diagnostics)],
  }
}

function frameIdentityFor(
  context: SharedPerformanceContext,
  settings: CanvasOrchestrationSettings,
  templateId: CanvasCompositionTemplateId,
  effectRecipeId: CanvasEffectRecipeId,
  layers: readonly CanvasResolvedLayer[],
): string {
  // Transition identity represents discrete visual state, not the passage of a cadence block.
  // Musical boundaries still gate transition opportunities in CanvasTransitions.
  const seed = createPerformanceDeterministicSeed(
    context.trackIdentity,
    settings.programId,
    context.sectionFamily,
    context.sectionOccurrence,
    settings.poolRevision,
    templateId,
    effectRecipeId,
    ...layers.map(layer => `${layer.id}:${layer.role}:${layer.sourceMediaId ?? 'none'}`),
  )
  return `${settings.programId}|${templateId}|${context.sectionIdentity}|${effectRecipeId}|${seed}`
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
  const program = resolveCanvasAuthoredProgramState(context, settings)
  if (program.fracturesProfile) {
    return resolveCanvasFracturesPerformanceFrame({
      context,
      settings,
      selection,
      program,
      previousFrame,
      isMediaReady,
    })
  }
  const templateId = settings.globalLocks.composition && previousFrame
    ? previousFrame.template.id
    : program.templateId
  const template = getCanvasCompositionTemplate(templateId)
  const pendingMediaIds = new Set<string>()
  let fallbackUsed = selection.fallbackUsed

  const activeSlots = activeSlotsForComplexity(template, settings, program.retiredRoles)

  let layers: CanvasResolvedLayer[] = []
  for (const slot of activeSlots) {
    const allowIntentionalDuplication = slotAllowsIntentionalDuplication(template.id, slot, settings)
    const result = resolveSlotLayer({
      slot,
      pool: selection.items,
      settings,
      context,
      previousFrame,
      effectRecipeId: program.effectRecipeId,
      isMediaReady,
      frameHold: program.frameHold,
      treatment: resolvedTreatmentForRole(program.treatments, slot.role, context, settings),
      forceAdvance: program.advanceRoles.has(slot.role),
      selectionIdentity: program.selectionIdentity,
      effectBoost: program.effectBoost,
      assignedMediaIds: allowIntentionalDuplication
        ? []
        : layers.map(layer => layer.sourceMediaId).filter((id): id is string => Boolean(id)),
      allowIntentionalDuplication,
    })
    if (result.pendingMediaId) pendingMediaIds.add(result.pendingMediaId)
    fallbackUsed ||= result.fallbackUsed
    layers.push(result.layer)
  }

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

  const requestedVideoCount = new Set(
    layers.filter(layer => layer.enabled && layer.source?.type === 'video').map(layer => layer.sourceMediaId),
  ).size
  layers = enforceDecoderBounds(layers, selection.items)
  layers = attachMaskSources(layers)
  const requestedLayerCount = layers.length
  layers = layers.slice(0, MAX_CANVAS_PERFORMANCE_LAYERS)
  const frameIdentity = frameIdentityFor(context, settings, template.id, program.effectRecipeId, layers)
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

  const diagnostics = [...program.diagnostics]
  if (selection.fallbackUsed) diagnostics.push('media-pool-fallback')
  if (selection.items.length === 0) diagnostics.push('no-media-available')
  else if (selection.items.length === 1) diagnostics.push('single-media-safe-mode')
  if (selection.items.length > 0 && selection.items.every(item => item.type !== 'video')) diagnostics.push('image-only-safe-mode')
  if (requestedVideoCount > MAX_CANVAS_ACTIVE_VIDEO_DECODERS) diagnostics.push('video-decoder-limit-applied')
  if (requestedLayerCount > MAX_CANVAS_PERFORMANCE_LAYERS) diagnostics.push('layer-limit-applied')
  if (template.slots.some(slot => slot.role === 'mask') && !layers.some(layer => layer.role === 'mask' && layer.enabled)) diagnostics.push('mask-fallback-compositing')
  if (pendingMediaIds.size > 0) diagnostics.push('late-media-current-clip-retained')

  return {
    programId: settings.programId || CANVAS_PERFORMANCE_PROGRAM_ID,
    frameIdentity,
    sceneId: program.sceneId,
    showLabel: program.showLabel,
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
    nextSectionType: program.nextSectionType,
    anticipatoryStage: program.anticipatoryStage,
    diagnostics: [...new Set(diagnostics)],
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
  const upcomingRoles = sectionPreferredRolesForType(frame.nextSectionType)
  const pending = frame.pendingMediaIds.filter(id => !active.has(id))
  const pendingSet = new Set(pending)
  const strategy = getCanvasPerformanceShow(settings.programId).mediaStrategy
  const ranked = pool
    .filter(item => !active.has(item.id) && !pendingSet.has(item.id))
    .map(item => {
      const roles = resolveCanvasMediaRoles(item, settings).effective
      return {
        id: item.id,
        score: roles.reduce((score, role) => score
          + (sectionRoles.includes(role) ? 3 : upcomingRoles.includes(role) ? 4 : role === 'transition' || role === 'mask' ? 1 : 0)
          + (strategy.roleWeights[role] ?? 0), 0)
          + performanceDeterministicUnit(frame.frameIdentity, item.id),
      }
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  return [...pending, ...ranked.map(item => item.id)].slice(0, 4)
}
