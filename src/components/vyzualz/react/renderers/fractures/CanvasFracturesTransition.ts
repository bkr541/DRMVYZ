import type { CanvasFractureTransitionMode } from '../../ReactTypes'
import { clampFracturesUnit, roundFractures } from './CanvasFracturesTransforms'
import { stableCanvasFracturesHash } from './CanvasFracturesPlan'
import type {
  CanvasFractureFragment,
  CanvasFractureTransform,
  CanvasFracturesPlan,
  CanvasFracturesTransitionState,
} from './CanvasFracturesTypes'

export interface CanvasFracturesTransitionInput {
  previousPlan: CanvasFracturesPlan | null
  targetPlan: CanvasFracturesPlan
  transitionIdentity: string
  mode: CanvasFractureTransitionMode
  source: CanvasFracturesTransitionState['source']
  startSec: number
  positionSec: number
  transitionSpeed: number
  staggerAmount: number
  zoomAmount: number
  forceComplete?: boolean
}

function easeOutCubic(value: number): number {
  const t = clampFracturesUnit(value)
  return 1 - (1 - t) ** 3
}

function easeInOutCubic(value: number): number {
  const t = clampFracturesUnit(value)
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
}

function lerp(left: number, right: number, progress: number): number {
  const value = left + (right - left) * progress
  return Number.isFinite(value) ? value : right
}

function lerpTransform(
  previous: CanvasFractureTransform,
  target: CanvasFractureTransform,
  progress: number,
): CanvasFractureTransform {
  return {
    centerX: roundFractures(lerp(previous.centerX, target.centerX, progress)),
    centerY: roundFractures(lerp(previous.centerY, target.centerY, progress)),
    scale: roundFractures(Math.max(0.05, lerp(previous.scale, target.scale, progress))),
    rotationDeg: roundFractures(lerp(previous.rotationDeg, target.rotationDeg, progress)),
  }
}

export function resolveCanvasFracturesTransitionDuration(
  mode: CanvasFractureTransitionMode,
  transitionSpeed: number,
): number {
  const speed = clampFracturesUnit(transitionSpeed)
  if (mode === 'hardGlitchCut') return roundFractures(0.018 + (1 - speed) * 0.055, 6)
  if (mode === 'staggeredAssembly') return roundFractures(0.36 + (1 - speed) * 1.04, 6)
  return roundFractures(0.3 + (1 - speed) * 0.9, 6)
}

export function resolveCanvasFracturesFragmentDelay(
  fragment: CanvasFractureFragment,
  transitionIdentity: string,
  staggerAmount: number,
  fragmentCount: number,
): number {
  const stagger = clampFracturesUnit(staggerAmount)
  if (stagger <= 0 || fragmentCount <= 1) return 0
  const area = fragment.crop.width * fragment.crop.height
  const sizeLead = 1 - Math.min(1, area / 0.24)
  const stableNoise = (stableCanvasFracturesHash(`${transitionIdentity}:${fragment.id}:delay`) % 10000) / 10000
  const order = Math.min(1, sizeLead * 0.72 + stableNoise * 0.28)
  return roundFractures(order * stagger * 0.64, 6)
}

function entryTransform(
  fragment: CanvasFractureFragment,
  transitionIdentity: string,
): CanvasFractureTransform {
  const hash = stableCanvasFracturesHash(`${transitionIdentity}:${fragment.id}:entry`)
  const angle = (hash % 3600) / 3600 * Math.PI * 2
  const distance = 0.08 + ((hash >>> 8) % 1000) / 1000 * 0.18
  return {
    centerX: roundFractures(fragment.homeTransform.centerX + Math.cos(angle) * distance),
    centerY: roundFractures(fragment.homeTransform.centerY + Math.sin(angle) * distance),
    scale: roundFractures(Math.max(0.35, fragment.targetTransform.scale * 0.68)),
    rotationDeg: roundFractures(fragment.targetTransform.rotationDeg + (((hash >>> 16) % 2001) / 2000 - 0.5) * 18),
  }
}

function zoomTransform(
  fragment: CanvasFractureFragment,
  zoomAmount: number,
  direction: 'in' | 'out',
): CanvasFractureTransform {
  const amount = 0.12 + clampFracturesUnit(zoomAmount) * 0.82
  const dx = fragment.targetTransform.centerX - fragment.homeTransform.centerX
  const dy = fragment.targetTransform.centerY - fragment.homeTransform.centerY
  const multiplier = direction === 'in' ? 1 + amount : Math.max(0.08, 1 - amount * 0.72)
  return {
    centerX: roundFractures(fragment.homeTransform.centerX + dx * multiplier),
    centerY: roundFractures(fragment.homeTransform.centerY + dy * multiplier),
    scale: roundFractures(Math.max(0.05, fragment.targetTransform.scale * (direction === 'in' ? 1 + amount : 1 - amount * 0.68))),
    rotationDeg: fragment.targetTransform.rotationDeg,
  }
}

function transitionDirection(identity: string): 'in' | 'out' {
  return (stableCanvasFracturesHash(`${identity}:zoom-direction`) & 1) === 0 ? 'in' : 'out'
}

export function evaluateCanvasFracturesTransition(input: CanvasFracturesTransitionInput): CanvasFracturesPlan {
  const durationSec = resolveCanvasFracturesTransitionDuration(input.mode, input.transitionSpeed)
  const rawProgress = input.forceComplete
    ? 1
    : clampFracturesUnit((Math.max(0, input.positionSec) - Math.max(0, input.startSec)) / Math.max(1e-4, durationSec))
  const previousById = new Map(input.previousPlan?.fragments.map(fragment => [fragment.id, fragment]) ?? [])
  const zoomDirection = transitionDirection(input.transitionIdentity)
  const fragmentCount = input.targetPlan.fragments.length

  const fragments = input.targetPlan.fragments.map(target => {
    const previous = previousById.get(target.id)
    let fragmentProgress = rawProgress
    let startTransform = previous?.currentTransform ?? target.homeTransform
    let opacityStart = previous?.opacity ?? 1

    if (input.mode === 'hardGlitchCut') {
      const sliceDelay = (stableCanvasFracturesHash(`${input.transitionIdentity}:${target.id}:glitch`) % 4) / 4 * 0.24
      fragmentProgress = rawProgress >= sliceDelay ? 1 : 0
      startTransform = previous?.currentTransform ?? entryTransform(target, input.transitionIdentity)
      opacityStart = previous ? previous.opacity : 0
    } else if (input.mode === 'staggeredAssembly') {
      const delay = resolveCanvasFracturesFragmentDelay(target, input.transitionIdentity, input.staggerAmount, fragmentCount)
      const localSpan = Math.max(0.12, 1 - delay)
      fragmentProgress = easeOutCubic((rawProgress - delay) / localSpan)
      startTransform = previous?.currentTransform ?? entryTransform(target, input.transitionIdentity)
      opacityStart = previous ? previous.opacity : 0
    } else {
      fragmentProgress = easeInOutCubic(rawProgress)
      startTransform = previous?.currentTransform ?? zoomTransform(target, input.zoomAmount, zoomDirection)
      if (previous) {
        const zoom = zoomTransform(previous, input.zoomAmount, zoomDirection)
        startTransform = {
          centerX: roundFractures(lerp(previous.currentTransform.centerX, zoom.centerX, 0.35)),
          centerY: roundFractures(lerp(previous.currentTransform.centerY, zoom.centerY, 0.35)),
          scale: roundFractures(lerp(previous.currentTransform.scale, zoom.scale, 0.35)),
          rotationDeg: previous.currentTransform.rotationDeg,
        }
      }
      opacityStart = previous ? previous.opacity : 0.25
    }

    return {
      ...target,
      currentTransform: lerpTransform(startTransform, target.targetTransform, fragmentProgress),
      opacity: roundFractures(lerp(opacityStart, target.opacity, fragmentProgress)),
      mirrorX: fragmentProgress < 0.5 && previous ? previous.mirrorX : target.mirrorX,
      mirrorY: fragmentProgress < 0.5 && previous ? previous.mirrorY : target.mirrorY,
      depth: fragmentProgress < 0.5 && previous ? previous.depth : target.depth,
    }
  })

  const state: CanvasFracturesTransitionState = {
    identity: input.transitionIdentity,
    mode: input.mode,
    previousLayoutIdentity: input.previousPlan?.layoutIdentity ?? 'fractures-layout:none',
    targetLayoutIdentity: input.targetPlan.layoutIdentity,
    startSec: roundFractures(Math.max(0, input.startSec), 6),
    durationSec,
    progress: roundFractures(rawProgress, 6),
    zoomDirection,
    source: input.source,
  }

  return {
    ...input.targetPlan,
    id: `${input.targetPlan.id}|transition:${stableCanvasFracturesHash(`${state.identity}:${state.progress}`).toString(16)}`,
    fragments,
    transition: state,
  }
}
