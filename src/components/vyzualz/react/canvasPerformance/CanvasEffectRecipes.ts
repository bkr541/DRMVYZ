import { curveSharedPerformanceProgress } from '../../../../features/performanceCore'
import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import {
  MAX_CANVAS_EFFECT_CHAIN_DEPTH,
  type CanvasEffectNode,
  type CanvasEffectRecipe,
  type CanvasEffectRecipeId,
  type CanvasEventBinding,
  type CanvasModulationRoute,
} from './CanvasPerformanceTypes'

function route(patch: CanvasModulationRoute): CanvasModulationRoute {
  return patch
}

function event(patch: CanvasEventBinding): CanvasEventBinding {
  return patch
}

function effect(
  id: string,
  node: Omit<CanvasEffectNode, 'id' | 'enabled' | 'params' | 'modulationRoutes' | 'eventBindings'> & {
    params?: Readonly<Record<string, number>>
    modulationRoutes?: readonly CanvasModulationRoute[]
    eventBindings?: readonly CanvasEventBinding[]
  },
): CanvasEffectNode {
  return {
    id,
    effect: node.effect,
    enabled: true,
    amount: node.amount,
    params: node.params ?? {},
    safetyClamp: node.safetyClamp,
    modulationRoutes: node.modulationRoutes ?? [],
    eventBindings: node.eventBindings ?? [],
  }
}

export const CANVAS_EFFECT_RECIPES: Readonly<Record<CanvasEffectRecipeId, CanvasEffectRecipe>> = {
  none: {
    id: 'none',
    label: 'None',
    effects: [],
    sectionFilters: [],
    intensityScale: 0,
  },
  bassImpact: {
    id: 'bassImpact',
    label: 'Bass Impact',
    sectionFilters: ['drop', 'build', 'preDrop'],
    intensityScale: 0.85,
    effects: [
      effect('bass-impact-exposure', {
        effect: 'exposure', amount: 0.45, safetyClamp: [0, 0.72],
        modulationRoutes: [route({ id: 'bass-exposure', source: 'bass', target: 'exposure', min: 0, max: 0.45, amount: 0.8, curve: 'easeOut', safetyClamp: [0, 0.72] })],
        eventBindings: [event({ id: 'kick-exposure', event: 'kick', target: 'exposure', amount: 0.38, envelope: { attackBeats: 0, holdBeats: 0.05, releaseBeats: 0.45, curve: 'easeOut' } })],
      }),
      effect('bass-impact-glow', {
        effect: 'glow', amount: 0.36, safetyClamp: [0, 0.65],
        eventBindings: [event({ id: 'kick-glow', event: 'kick', target: 'amount', amount: 0.32, envelope: { attackBeats: 0, holdBeats: 0.04, releaseBeats: 0.55, curve: 'easeOut' } })],
      }),
      effect('bass-impact-displacement', {
        effect: 'displacement', amount: 0.22, safetyClamp: [0, 0.42],
        modulationRoutes: [route({ id: 'bass-displace', source: 'spectralFlux', target: 'amount', min: 0, max: 0.28, amount: 0.7, safetyClamp: [0, 0.42] })],
      }),
    ],
  },
  dreamBreakdown: {
    id: 'dreamBreakdown',
    label: 'Dream Breakdown',
    sectionFilters: ['intro', 'breakdown', 'bridge', 'outro'],
    intensityScale: 0.7,
    effects: [
      effect('dream-glow', {
        effect: 'glow', amount: 0.32, safetyClamp: [0, 0.58],
        modulationRoutes: [route({ id: 'dream-energy-glow', source: 'trackRelativeEnergy', target: 'amount', min: 0.12, max: 0.42, amount: 0.55, curve: 'easeInOut', smoothing: 0.35, safetyClamp: [0, 0.58] })],
      }),
      effect('dream-saturation', {
        effect: 'saturation', amount: 0.18, params: { saturation: 1.08 }, safetyClamp: [0, 0.35],
      }),
      effect('dream-feedback', {
        effect: 'feedback', amount: 0.18, safetyClamp: [0, 0.28],
        modulationRoutes: [route({ id: 'dream-vocal-feedback', source: 'vocalEnergy', target: 'amount', min: 0.08, max: 0.22, amount: 0.4, smoothing: 0.5, safetyClamp: [0, 0.28] })],
      }),
    ],
  },
  preDropVacuum: {
    id: 'preDropVacuum',
    label: 'Pre-Drop Vacuum',
    sectionFilters: ['preDrop', 'build'],
    intensityScale: 0.82,
    effects: [
      effect('vacuum-contrast', {
        effect: 'contrast', amount: 0.28, params: { contrast: 1.2 }, safetyClamp: [0, 0.45],
        modulationRoutes: [route({ id: 'vacuum-build-contrast', source: 'buildProgress', target: 'amount', min: 0.08, max: 0.38, amount: 0.8, curve: 'easeIn', safetyClamp: [0, 0.45] })],
      }),
      effect('vacuum-saturation', {
        effect: 'saturation', amount: 0.34, params: { saturation: 0.72 }, safetyClamp: [0, 0.5],
      }),
      effect('vacuum-vignette', {
        effect: 'vignette', amount: 0.42, safetyClamp: [0, 0.62],
      }),
      effect('vacuum-slice', {
        effect: 'slice', amount: 0.12, safetyClamp: [0, 0.25],
        eventBindings: [event({ id: 'vacuum-hat-slice', event: 'hat', target: 'amount', amount: 0.12, envelope: { attackBeats: 0, holdBeats: 0, releaseBeats: 0.16, curve: 'step' } })],
      }),
    ],
  },
  dropFracture: {
    id: 'dropFracture',
    label: 'Drop Fracture',
    sectionFilters: ['drop'],
    intensityScale: 0.92,
    effects: [
      effect('fracture-rgb', {
        effect: 'rgbSplit', amount: 0.26, safetyClamp: [0, 0.42],
        eventBindings: [event({ id: 'snare-rgb', event: 'snare', target: 'amount', amount: 0.34, envelope: { attackBeats: 0, holdBeats: 0.02, releaseBeats: 0.34, curve: 'easeOut' } })],
      }),
      effect('fracture-slice', {
        effect: 'slice', amount: 0.2, safetyClamp: [0, 0.42],
        eventBindings: [event({ id: 'snare-slice', event: 'snare', target: 'offsetX', amount: 0.34, envelope: { attackBeats: 0, holdBeats: 0.04, releaseBeats: 0.32, curve: 'easeOut' } })],
      }),
      effect('fracture-posterize', {
        effect: 'posterize', amount: 0.16, safetyClamp: [0, 0.28],
        eventBindings: [event({ id: 'hat-posterize', event: 'hat', target: 'amount', amount: 0.12, envelope: { attackBeats: 0, holdBeats: 0, releaseBeats: 0.12, curve: 'step' } })],
      }),
      effect('fracture-exposure', {
        effect: 'exposure', amount: 0.22, safetyClamp: [0, 0.58],
        eventBindings: [event({ id: 'kick-fracture-exposure', event: 'kick', target: 'exposure', amount: 0.34, envelope: { attackBeats: 0, holdBeats: 0.02, releaseBeats: 0.42, curve: 'easeOut' } })],
      }),
      effect('fracture-scanlines', {
        effect: 'scanlines', amount: 0.12, safetyClamp: [0, 0.24],
      }),
    ],
  },
}

function modulationSourceValue(context: SharedPerformanceContext, source: CanvasModulationRoute['source']): number {
  switch (source) {
    case 'bass': return context.bass
    case 'mid': return context.mid
    case 'high': return context.high
    case 'energy': return context.energy
    case 'trackRelativeEnergy': return context.trackRelativeEnergy
    case 'spectralFlux': return context.spectralFlux
    case 'tension': return context.tension
    case 'complexity': return context.complexity
    case 'buildProgress': return context.buildProgress
    case 'sectionProgress': return context.sectionProgress
    case 'phraseProgress': return context.phraseProgress
    case 'vocalEnergy': return context.vocalEnergy
  }
}

function eventStrength(context: SharedPerformanceContext, eventKind: CanvasEventBinding['event']): number {
  switch (eventKind) {
    case 'kick': return context.kick ? context.kickStrength : 0
    case 'snare': return context.snare ? context.snareStrength : 0
    case 'hat': return context.hat ? context.hatStrength : 0
    case 'downbeat': return context.downbeat ? 1 : 0
    case 'beat': return context.boundaries.beatBoundary ? 1 : 0
  }
}

function clamp(value: number, range: readonly [number, number] | undefined, fallback: readonly [number, number] = [0, 1]): number {
  const [min, max] = range ?? fallback
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

/** Resolve recipes into bounded, frame-ready effect nodes. */
export function resolveCanvasEffectChain(
  recipeId: CanvasEffectRecipeId,
  context: SharedPerformanceContext,
  intensity: number,
): readonly CanvasEffectNode[] {
  const recipe = CANVAS_EFFECT_RECIPES[recipeId] ?? CANVAS_EFFECT_RECIPES.none
  if (recipe.sectionFilters.length > 0 && context.sectionType && !recipe.sectionFilters.includes(context.sectionType)) return []
  const globalIntensity = clamp(intensity * recipe.intensityScale, [0, 1])

  return recipe.effects.slice(0, MAX_CANVAS_EFFECT_CHAIN_DEPTH).map(node => {
    let amount = node.amount * globalIntensity
    for (const modulation of node.modulationRoutes) {
      if (modulation.sectionFilter?.length && context.sectionType && !modulation.sectionFilter.includes(context.sectionType)) continue
      const source = clamp(modulationSourceValue(context, modulation.source), [0, 1])
      const shaped = curveSharedPerformanceProgress(source, modulation.curve ?? 'linear')
      const value = modulation.min + (modulation.max - modulation.min) * shaped
      amount += value * modulation.amount * globalIntensity
    }
    for (const binding of node.eventBindings) {
      amount += eventStrength(context, binding.event) * binding.amount * globalIntensity
    }
    amount = clamp(amount, node.safetyClamp)
    return { ...node, amount }
  })
}

export function resolveCanvasEffectRecipeForSection(context: SharedPerformanceContext): CanvasEffectRecipeId {
  if (context.sectionType === 'preDrop') return 'preDropVacuum'
  if (context.sectionType === 'drop') return context.dropImpact > 0.15 || context.energy >= 0.72 ? 'dropFracture' : 'bassImpact'
  if (context.sectionType === 'build') return context.buildProgress >= 0.72 ? 'preDropVacuum' : 'bassImpact'
  if (context.sectionType === 'breakdown' || context.sectionType === 'bridge' || context.sectionType === 'intro' || context.sectionType === 'outro') return 'dreamBreakdown'
  return 'none'
}

export interface CanvasEffectVisualState {
  filter: string
  opacityBoost: number
  scaleBoost: number
  rotationDeg: number
  offsetX: number
  offsetY: number
  blendMode: GlobalCompositeOperation
  feedbackAmount: number
  scanlineAmount: number
  sliceAmount: number
  rgbSplitAmount: number
}

export function resolveCanvasEffectVisualState(chain: readonly CanvasEffectNode[], motionIntensity: number): CanvasEffectVisualState {
  let brightness = 1
  let contrast = 1
  let saturation = 1
  let blurPx = 0
  let hue = 0
  let opacityBoost = 0
  let scaleBoost = 0
  let rotationDeg = 0
  let offsetX = 0
  let offsetY = 0
  let feedbackAmount = 0
  let scanlineAmount = 0
  let sliceAmount = 0
  let rgbSplitAmount = 0

  for (const node of chain) {
    const amount = Math.max(0, Math.min(1, node.amount))
    switch (node.effect) {
      case 'exposure': brightness += amount * 0.55; opacityBoost += amount * 0.08; break
      case 'contrast': contrast += amount * 0.5; break
      case 'saturation': saturation += (node.params.saturation ?? 1.2) * amount * 0.3; break
      case 'hueRotate': hue += amount * 60; break
      case 'blur': blurPx += amount * 3; break
      case 'sharpen': contrast += amount * 0.18; break
      case 'glow': brightness += amount * 0.18; saturation += amount * 0.12; break
      case 'rgbSplit': rgbSplitAmount = Math.max(rgbSplitAmount, amount); break
      case 'posterize': contrast += amount * 0.22; saturation += amount * 0.08; break
      case 'scanlines': scanlineAmount = Math.max(scanlineAmount, amount); break
      case 'grain': contrast += amount * 0.08; break
      case 'displacement': scaleBoost += amount * 0.04 * motionIntensity; offsetX += amount * 6 * motionIntensity; break
      case 'slice': sliceAmount = Math.max(sliceAmount, amount); offsetX += amount * 4 * motionIntensity; break
      case 'feedback': feedbackAmount = Math.max(feedbackAmount, amount); break
      case 'vignette': brightness -= amount * 0.12; break
    }
  }

  return {
    filter: `brightness(${Math.max(0.75, brightness).toFixed(3)}) contrast(${Math.max(0.75, contrast).toFixed(3)}) saturate(${Math.max(0.5, saturation).toFixed(3)}) blur(${Math.min(3.5, blurPx).toFixed(2)}px) hue-rotate(${hue.toFixed(1)}deg)`,
    opacityBoost,
    scaleBoost,
    rotationDeg,
    offsetX,
    offsetY,
    blendMode: 'source-over',
    feedbackAmount,
    scanlineAmount,
    sliceAmount,
    rgbSplitAmount,
  }
}
