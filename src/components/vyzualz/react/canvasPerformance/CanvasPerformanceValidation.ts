import {
  validateSharedPerformanceProgramCollection,
  type SharedPerformanceActionValidationAdapter,
  type SharedPerformanceProgramValidationIssue,
} from '../../../../features/performanceCore'
import { CANVAS_COMPOSITION_TEMPLATES } from './CanvasCompositionTemplates'
import { CANVAS_EFFECT_RECIPES } from './CanvasEffectRecipes'
import { CANVAS_PERFORMANCE_SHOWS } from './CanvasPerformanceShows'
import { CANVAS_TRANSITIONS } from './CanvasTransitions'
import {
  CANVAS_MEDIA_ROLES,
  MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
  MAX_CANVAS_EFFECT_CHAIN_DEPTH,
  MAX_CANVAS_FEEDBACK_PASSES,
  MAX_CANVAS_PERFORMANCE_LAYERS,
  type CanvasPerformanceAction,
} from './CanvasPerformanceTypes'

const LAYER_ROLES = new Set(['background', 'hero', 'texture', 'foregroundAccent', 'mask', 'transition', 'feedback'])
const MEDIA_ROLES = new Set(CANVAS_MEDIA_ROLES)

const adapter: SharedPerformanceActionValidationAdapter<CanvasPerformanceAction> = {
  exclusiveTargetKey(action) {
    if (action.type === 'composition') return 'canvas.composition'
    if (action.type === 'effectRecipe') return 'canvas.effectRecipe'
    return null
  },
  validate(action) {
    switch (action.type) {
      case 'composition':
        return CANVAS_COMPOSITION_TEMPLATES[action.templateId] ? [] : [{ severity: 'error', code: 'unknown-composition', message: `Unknown composition “${action.templateId}”.` }]
      case 'effectRecipe':
        return CANVAS_EFFECT_RECIPES[action.recipeId] ? [] : [{ severity: 'error', code: 'unknown-effect-recipe', message: `Unknown effect recipe “${action.recipeId}”.` }]
      case 'transition':
        return action.transitionIds.filter(id => !CANVAS_TRANSITIONS[id]).map(id => ({ severity: 'error' as const, code: 'impossible-transition-reference', message: `Unknown transition “${id}”.` }))
      case 'recruit': {
        const issues = action.roles.filter(role => !LAYER_ROLES.has(role)).map(role => ({ severity: 'error' as const, code: 'unknown-layer-role', message: `Unknown CANVAS layer role “${role}”.` }))
        if (action.roles.length > MAX_CANVAS_PERFORMANCE_LAYERS) issues.push({ severity: 'error', code: 'excessive-layer-recruitment', message: `Recruit action requests ${action.roles.length} roles, above the ${MAX_CANVAS_PERFORMANCE_LAYERS}-layer limit.` })
        return issues
      }
      case 'retire':
      case 'advanceMedia':
        return action.roles.filter(role => !LAYER_ROLES.has(role)).map(role => ({ severity: 'error' as const, code: 'unknown-layer-role', message: `Unknown CANVAS layer role “${role}”.` }))
      case 'layerTreatment':
        return action.treatment.roles.filter(role => !LAYER_ROLES.has(role)).map(role => ({ severity: 'error' as const, code: 'unknown-layer-role', message: `Unknown CANVAS layer role “${role}”.` }))
      case 'effectBoost':
        return Number.isFinite(action.amount) && Math.abs(action.amount) <= 1 ? [] : [{ severity: 'error', code: 'invalid-effect-boost', message: 'Effect boost must be finite and bounded to ±1.' }]
      default:
        return []
    }
  },
  estimateResources(action) {
    if (action.type === 'composition') {
      const template = CANVAS_COMPOSITION_TEMPLATES[action.templateId]
      return template ? { layers: template.maxLayers, decoders: template.maxVideoDecoders, feedbackPasses: template.feedbackPasses } : {}
    }
    if (action.type === 'effectRecipe') return { textures: CANVAS_EFFECT_RECIPES[action.recipeId]?.effects.length ?? 0 }
    if (action.type === 'recruit') return { layers: action.roles.length }
    return {}
  },
}

export function validateCanvasPerformanceShows(): SharedPerformanceProgramValidationIssue[] {
  const issues = validateSharedPerformanceProgramCollection(CANVAS_PERFORMANCE_SHOWS.map(show => ({ ...show.program, fallbackSceneId: show.fallbackSceneId })), {
    adapter,
    requireFallbackScene: true,
  })
  for (const template of Object.values(CANVAS_COMPOSITION_TEMPLATES)) {
    if (template.maxVideoDecoders > MAX_CANVAS_ACTIVE_VIDEO_DECODERS) issues.push({ severity: 'error', code: 'excessive-decoder-demand', message: `${template.label} exceeds the decoder limit.`, programId: 'canvas.templates' })
    if (template.feedbackPasses > MAX_CANVAS_FEEDBACK_PASSES) issues.push({ severity: 'error', code: 'excessive-feedback-passes', message: `${template.label} exceeds the feedback-pass limit.`, programId: 'canvas.templates' })
    if (template.slots.length > MAX_CANVAS_PERFORMANCE_LAYERS) issues.push({ severity: 'error', code: 'excessive-layer-recruitment', message: `${template.label} exceeds the layer limit.`, programId: 'canvas.templates' })
    for (const slot of template.slots) {
      if (!slot.requiredMediaRoles.length) issues.push({ severity: 'error', code: 'missing-media-role', message: `${template.label}/${slot.id} has no required media role.`, programId: 'canvas.templates' })
      if ([...slot.requiredMediaRoles, ...slot.fallbackMediaRoles].some(role => !MEDIA_ROLES.has(role))) issues.push({ severity: 'error', code: 'unknown-media-role', message: `${template.label}/${slot.id} references an unknown media role.`, programId: 'canvas.templates' })
    }
  }
  for (const recipe of Object.values(CANVAS_EFFECT_RECIPES)) {
    if (recipe.effects.length > MAX_CANVAS_EFFECT_CHAIN_DEPTH) issues.push({ severity: 'error', code: 'excessive-effect-depth', message: `${recipe.label} exceeds the effect-chain limit.`, programId: 'canvas.effects' })
    for (const effect of recipe.effects) {
      for (const route of effect.modulationRoutes) {
        if (!Number.isFinite(route.min) || !Number.isFinite(route.max) || route.min > route.max) issues.push({ severity: 'error', code: 'invalid-modulation-range', message: `${recipe.label}/${route.id} has an invalid modulation range.`, programId: 'canvas.effects' })
      }
      for (const binding of effect.eventBindings) {
        const duration = binding.envelope.attackBeats + binding.envelope.holdBeats + binding.envelope.releaseBeats
        if (!Number.isFinite(duration) || duration < 0 || duration > 16) issues.push({ severity: 'error', code: 'unbounded-envelope-duration', message: `${recipe.label}/${binding.id} has an invalid or unbounded envelope.`, programId: 'canvas.effects' })
      }
    }
  }
  for (const transition of Object.values(CANVAS_TRANSITIONS)) {
    if (!CANVAS_TRANSITIONS[transition.fallbackId]) issues.push({ severity: 'error', code: 'impossible-transition-reference', message: `${transition.label} references missing fallback “${transition.fallbackId}”.`, programId: 'canvas.transitions' })
  }
  return issues
}
