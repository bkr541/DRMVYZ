import {
  validateSharedPerformanceProgramCollection,
  type SharedPerformanceActionValidationAdapter,
  type SharedPerformanceProgramValidationIssue,
} from '../../../../features/performanceCore'
import { SOUND_DRAWING_PERFORMANCE_SHOWS } from './SoundDrawingPerformanceShows'
import {
  MAX_SOUND_DRAWING_PERFORMANCE_ENVELOPES,
  MAX_SOUND_DRAWING_PERFORMANCE_LAYERS,
  MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES,
  MAX_SOUND_DRAWING_PERFORMANCE_TRACES,
  SOUND_DRAWING_GENERATOR_FAMILIES,
  type SoundDrawingPerformanceAction,
  type SoundDrawingPerformanceLayerBlueprint,
} from './SoundDrawingPerformanceTypes'

const ROLES = new Set(['primaryMotif', 'harmonicLayer', 'rhythmAccent', 'echoLayer', 'atmosphereLayer', 'transitionLayer'])
const GENERATORS = new Set(SOUND_DRAWING_GENERATOR_FAMILIES)
const TARGET_RANGES: Record<string, readonly [number, number]> = {
  opacity: [0, 1], strokeWidth: [0.25, 3], traceCount: [1, MAX_SOUND_DRAWING_PERFORMANCE_TRACES], symmetry: [1, 8],
  scale: [0.1, 2], rotation: [-360, 360], trailPersistence: [0, 1], feedbackAmount: [0, 1], glow: [0, 1], audioDisplacement: [0, 0.25], jitter: [0, 0.25], topologyVariant: [0, 7],
}

function validateLayer(layer: SoundDrawingPerformanceLayerBlueprint): Omit<SharedPerformanceProgramValidationIssue, 'programId' | 'sceneId' | 'actionPath'>[] {
  const issues: Omit<SharedPerformanceProgramValidationIssue, 'programId' | 'sceneId' | 'actionPath'>[] = []
  if (!ROLES.has(layer.role)) issues.push({ severity: 'error', code: 'unknown-layer-role', message: `Unknown Sound Drawing layer role “${layer.role}”.` })
  if (!GENERATORS.has(layer.generator)) issues.push({ severity: 'error', code: 'unknown-generator', message: `Unknown Sound Drawing generator “${layer.generator}”.` })
  for (const route of layer.modulationRoutes ?? []) {
    if (!Number.isFinite(route.min) || !Number.isFinite(route.max) || route.min > route.max) issues.push({ severity: 'error', code: 'invalid-modulation-range', message: `Route “${route.id}” has an invalid range.` })
    const range = TARGET_RANGES[route.target]
    if (route.clamp && route.clamp[0] > route.clamp[1]) issues.push({ severity: 'error', code: 'invalid-modulation-clamp', message: `Route “${route.id}” has an inverted clamp.` })
    if (!range) issues.push({ severity: 'error', code: 'unsupported-target', message: `Route “${route.id}” targets unsupported parameter “${route.target}”.` })
  }
  for (const binding of layer.eventBindings ?? []) {
    const beats = [binding.envelope.attack, binding.envelope.hold, binding.envelope.release]
    if (beats.some(value => !value)) issues.push({ severity: 'error', code: 'unbounded-envelope', message: `Binding “${binding.id}” has an invalid musical envelope.` })
  }
  return issues
}

const adapter: SharedPerformanceActionValidationAdapter<SoundDrawingPerformanceAction> = {
  exclusiveTargetKey(action) {
    return action.type === 'scene' ? 'soundDrawing.sceneState' : null
  },
  validate(action) {
    if (action.type === 'scene') return action.layers.flatMap(validateLayer)
    if (action.type === 'recruitLayer') return validateLayer(action.layer)
    if ('role' in action && action.role && !ROLES.has(action.role)) return [{ severity: 'error', code: 'unknown-layer-role', message: `Unknown Sound Drawing layer role “${action.role}”.` }]
    if (action.type === 'pulse' && !TARGET_RANGES[action.target]) return [{ severity: 'error', code: 'unsupported-target', message: `Pulse targets unsupported parameter “${action.target}”.` }]
    return []
  },
  estimateResources(action) {
    if (action.type === 'scene') return {
      layers: action.layers.length,
      traces: action.layers.reduce((sum, layer) => sum + (layer.traceCount ?? 1), 0),
      particles: action.layers.reduce((sum, layer) => sum + (layer.particleCount ?? 0), 0),
      envelopes: action.layers.reduce((sum, layer) => sum + (layer.eventBindings?.length ?? 0), 0),
      feedbackPasses: action.layers.some(layer => (layer.feedbackAmount ?? 0) > 0) ? 1 : 0,
    }
    if (action.type === 'recruitLayer') return { layers: 1, traces: action.layer.traceCount ?? 1, particles: action.layer.particleCount ?? 0, envelopes: action.layer.eventBindings?.length ?? 0 }
    if (action.type === 'pulse') return { envelopes: 1 }
    return {}
  },
}

export function validateSoundDrawingPerformanceShows(): SharedPerformanceProgramValidationIssue[] {
  return validateSharedPerformanceProgramCollection(SOUND_DRAWING_PERFORMANCE_SHOWS.map(show => show.program), {
    adapter,
    requireFallbackScene: true,
    resourceLimits: {
      layers: MAX_SOUND_DRAWING_PERFORMANCE_LAYERS,
      traces: MAX_SOUND_DRAWING_PERFORMANCE_LAYERS * MAX_SOUND_DRAWING_PERFORMANCE_TRACES,
      particles: MAX_SOUND_DRAWING_PERFORMANCE_LAYERS * MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES,
      envelopes: MAX_SOUND_DRAWING_PERFORMANCE_ENVELOPES,
      feedbackPasses: 1,
    },
  })
}
