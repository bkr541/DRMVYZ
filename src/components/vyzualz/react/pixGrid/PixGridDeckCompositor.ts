import {
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  type PixGridDeckGeneratedMaskName,
  type PixGridPreparedFrameMasks,
} from './PixGridDeckCompilerContracts'
import type { PixGridDeckRuntimeFrameSource } from './PixGridDeckRuntime'
import { pixGridCellTransitionMix } from './PixGridCellTransitions'
import type { PixGridMotionEasing } from './PixGridMotionProfiles'

export interface PixGridDeckCompositorScratch {
  width: number
  height: number
  pixels: Uint8Array
  masks: Record<PixGridDeckGeneratedMaskName, Uint8Array>
  collisionWeights: Float32Array
}

export interface PixGridComposedDeckFrame {
  width: number
  height: number
  pixels: Uint8Array
  masks: Readonly<Record<PixGridDeckGeneratedMaskName, Uint8Array>>
}

function createMasks(cellCount: number): Record<PixGridDeckGeneratedMaskName, Uint8Array> {
  return Object.fromEntries(
    PIX_GRID_DECK_GENERATED_MASK_NAMES.map(name => [name, new Uint8Array(cellCount)]),
  ) as Record<PixGridDeckGeneratedMaskName, Uint8Array>
}

export function createPixGridDeckCompositorScratch(): PixGridDeckCompositorScratch {
  return { width: 0, height: 0, pixels: new Uint8Array(0), masks: createMasks(0), collisionWeights: new Float32Array(0) }
}

function ensureScratch(
  scratch: PixGridDeckCompositorScratch,
  width: number,
  height: number,
): PixGridDeckCompositorScratch {
  const cellCount = width * height
  if (scratch.width !== width || scratch.height !== height || scratch.pixels.length !== cellCount * 4) {
    scratch.width = width
    scratch.height = height
    scratch.pixels = new Uint8Array(cellCount * 4)
    scratch.masks = createMasks(cellCount)
    scratch.collisionWeights = new Float32Array(cellCount)
  }
  scratch.pixels.fill(0)
  scratch.collisionWeights.fill(0)
  for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) scratch.masks[name].fill(0)
  return scratch
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function stableSeed(source: PixGridDeckRuntimeFrameSource): number {
  const value = `${source.deckId}:${source.frameEpoch}:${source.boundaryIdentity ?? 'none'}`
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function copyFrame(
  pixels: Uint8Array,
  masks: Record<PixGridDeckGeneratedMaskName, Uint8Array>,
  framePixels: Uint8Array,
  frameMasks: PixGridPreparedFrameMasks,
): void {
  pixels.set(framePixels)
  for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) masks[name].set(frameMasks[name])
}

function mixBytes(source: number, target: number, mix: number): number {
  return Math.round(source + (target - source) * mix)
}

function composeCellTransition(
  source: PixGridDeckRuntimeFrameSource,
  outputPixels: Uint8Array,
  outputMasks: Record<PixGridDeckGeneratedMaskName, Uint8Array>,
): void {
  const progress = clamp01(source.transitionProgress)
  const sourcePixels = source.sourceFrame.pixels
  const targetPixels = source.targetFrame.pixels
  const seed = stableSeed(source)
  const mode = source.transitionMode
  const transitionType = mode === 'hardCut'
    ? 'cut'
    : mode === 'pixelTransport'
      ? 'pixelDissolve'
      : mode
  const interpolates = mode === 'crossfade'
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const cell = y * source.width + x
      const offset = cell * 4
      const mix = pixGridCellTransitionMix(transitionType, x, y, source.width, source.height, progress, seed)
      if (interpolates || (mix > 0 && mix < 1)) {
        for (let channel = 0; channel < 4; channel += 1) {
          outputPixels[offset + channel] = mixBytes(sourcePixels[offset + channel], targetPixels[offset + channel], mix)
        }
        for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) {
          const sourceWeight = Math.round(source.sourceFrame.masks[name][cell] * (1 - mix))
          const targetWeight = Math.round(source.targetFrame.masks[name][cell] * mix)
          outputMasks[name][cell] = Math.max(sourceWeight, targetWeight)
        }
      } else {
        const frame = mix >= 0.5 ? source.targetFrame : source.sourceFrame
        outputPixels.set(frame.pixels.subarray(offset, offset + 4), offset)
        for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) outputMasks[name][cell] = frame.masks[name][cell]
      }
    }
  }
}

function hasVisiblePixel(pixels: Uint8Array): boolean {
  for (let offset = 3; offset < pixels.length; offset += 4) {
    if (pixels[offset] > 0) return true
  }
  return false
}

function blendRawPixel(
  pixels: Uint8Array,
  weights: Float32Array,
  cell: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): void {
  const offset = cell * 4
  const sourceAlpha = alpha / 255
  if (sourceAlpha <= 0) return
  const previousWeight = weights[cell]!
  const nextWeight = previousWeight + sourceAlpha
  const denominator = Math.max(0.0001, nextWeight)
  pixels[offset] = Math.round((pixels[offset]! * previousWeight + red * sourceAlpha) / denominator)
  pixels[offset + 1] = Math.round((pixels[offset + 1]! * previousWeight + green * sourceAlpha) / denominator)
  pixels[offset + 2] = Math.round((pixels[offset + 2]! * previousWeight + blue * sourceAlpha) / denominator)
  pixels[offset + 3] = Math.max(pixels[offset + 3]!, alpha)
  weights[cell] = nextWeight
}

function blendWeightedFramePixel(
  pixels: Uint8Array,
  weights: Float32Array,
  targetCell: number,
  framePixels: Uint8Array,
  sourceCell: number,
  weight: number,
): void {
  const offset = sourceCell * 4
  blendRawPixel(
    pixels,
    weights,
    targetCell,
    framePixels[offset]!,
    framePixels[offset + 1]!,
    framePixels[offset + 2]!,
    Math.round(framePixels[offset + 3]! * clamp01(weight)),
  )
}

function interpolateIndex(sourceIndex: number, targetIndex: number, width: number, progress: number): number {
  const sourceX = sourceIndex % width
  const sourceY = Math.floor(sourceIndex / width)
  const targetX = targetIndex % width
  const targetY = Math.floor(targetIndex / width)
  const x = Math.round(sourceX + (targetX - sourceX) * progress)
  const y = Math.round(sourceY + (targetY - sourceY) * progress)
  return y * width + x
}

function quadraticIndex(
  sourceIndex: number,
  targetIndex: number,
  controlX: number,
  controlY: number,
  width: number,
  height: number,
  progress: number,
): number {
  const sourceX = sourceIndex % width
  const sourceY = Math.floor(sourceIndex / width)
  const targetX = targetIndex % width
  const targetY = Math.floor(targetIndex / width)
  const inverse = 1 - progress
  const x = Math.round(inverse * inverse * sourceX + 2 * inverse * progress * controlX + progress * progress * targetX)
  const y = Math.round(inverse * inverse * sourceY + 2 * inverse * progress * controlY + progress * progress * targetY)
  return Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))
}

function easeInOut(progress: number): number {
  const p = clamp01(progress)
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
}

function motionEase(progress: number, easing: PixGridMotionEasing): number {
  const p = clamp01(progress)
  if (easing === 'linear') return p
  if (easing === 'easeIn') return p * p
  if (easing === 'easeOut') return 1 - (1 - p) * (1 - p)
  return easeInOut(p)
}

function motionColor(sourceValue: number, targetValue: number, progress: number, mode: 'rgb' | 'sourceHold' | 'targetReveal'): number {
  if (mode === 'sourceHold') return progress < 0.72 ? sourceValue : mixBytes(sourceValue, targetValue, (progress - 0.72) / 0.28)
  if (mode === 'targetReveal') return mixBytes(sourceValue, targetValue, Math.sqrt(progress))
  return mixBytes(sourceValue, targetValue, progress)
}

function shiftedByte(value: number, shift: number, progress: number): number {
  if (shift === 0) return value
  const envelope = Math.sin(Math.PI * clamp01(progress))
  return Math.max(0, Math.min(255, Math.round(value * (1 + shift * envelope))))
}

function setWeightedMask(
  target: Uint8Array,
  cell: number,
  sourceValue: number,
  targetValue: number,
  progress: number,
): void {
  target[cell] = Math.max(
    target[cell],
    Math.round(sourceValue * (1 - progress)),
    Math.round(targetValue * progress),
  )
}

function composePixelTransport(
  source: PixGridDeckRuntimeFrameSource,
  outputPixels: Uint8Array,
  outputMasks: Record<PixGridDeckGeneratedMaskName, Uint8Array>,
  collisionWeights: Float32Array,
): void {
  const baseProgress = clamp01(source.transitionProgress)
  const dynamics = source.transitionDynamics
  const progress = clamp01(
    baseProgress + Math.sin(Math.PI * baseProgress) * (
      ((dynamics?.movementSpeed ?? 1) - 1) * 0.08
      +
      (dynamics?.acceleration ?? 0) * 0.1
      + (dynamics?.completionEmphasis ?? 0) * 0.06
    ),
  )
  const plan = source.transitionPlan
  if (!plan || plan.mode !== 'pixelTransport') {
    composeCellTransition({ ...source, transitionMode: 'pixelDissolve' }, outputPixels, outputMasks)
    return
  }
  const sourceFrame = source.sourceFrame
  const targetFrame = source.targetFrame
  const sourceForeground = sourceFrame.masks.foreground
  const targetForeground = targetFrame.masks.foreground
  const cellCount = source.width * source.height

  // Background and transparent content remain anchored while foreground cells travel.
  for (let cell = 0; cell < cellCount; cell += 1) {
    const sourceWeight = sourceForeground[cell] > 0 ? 0 : 1 - progress
    const targetWeight = targetForeground[cell] > 0 ? 0 : progress
    if (sourceWeight > 0) blendWeightedFramePixel(outputPixels, collisionWeights, cell, sourceFrame.pixels, cell, sourceWeight)
    if (targetWeight > 0) blendWeightedFramePixel(outputPixels, collisionWeights, cell, targetFrame.pixels, cell, targetWeight)
    for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) {
      if (name === 'foreground') continue
      const sourceValue = sourceForeground[cell] > 0 ? 0 : sourceFrame.masks[name][cell]
      const targetValue = targetForeground[cell] > 0 ? 0 : targetFrame.masks[name][cell]
      setWeightedMask(outputMasks[name], cell, sourceValue, targetValue, progress)
    }
  }
  // Background composition is an underlay. Collision weights only arbitrate
  // transported foreground particles so opaque artwork does not dilute them.
  collisionWeights.fill(0)

  for (let index = 0; index < plan.matchedSourceIndices.length; index += 1) {
    const sourceCell = plan.matchedSourceIndices[index]
    const targetCell = plan.matchedTargetIndices[index]
    const groupPulse = ((plan.matchedGroupIds[index]! & 3) / 3)
      * (dynamics?.regionPulse ?? 0)
      * (0.04 + (dynamics?.regionalGrouping ?? 0.5) * 0.08)
    const maxDelay = 0.22 * (dynamics?.pixelStagger ?? 0.5) * 2 * (1 - (dynamics?.reconstruction ?? 0) * 0.45)
    const delay = plan.matchedStagger[index]! / 255 * maxDelay
    const localProgress = motionEase(clamp01((progress + groupPulse - delay) / Math.max(0.001, 1 - delay)), dynamics?.easing ?? 'easeInOut')
    const midpointX = ((sourceCell % source.width) + (targetCell % source.width)) * 0.5
    const midpointY = (Math.floor(sourceCell / source.width) + Math.floor(targetCell / source.width)) * 0.5
    const pathStrength = (0.45 + (dynamics?.motionIntensity ?? 0.5) * 0.55) * (dynamics?.pathCurvature ?? 1)
    const controlX = midpointX + (plan.matchedControlX[index]! - midpointX) * pathStrength
    const controlY = midpointY + (plan.matchedControlY[index]! - midpointY) * pathStrength
    const outputCell = quadraticIndex(sourceCell, targetCell, controlX, controlY, source.width, source.height, localProgress)
    const sourceOffset = sourceCell * 4
    const targetOffset = targetCell * 4
    blendRawPixel(
      outputPixels,
      collisionWeights,
      outputCell,
      shiftedByte(motionColor(sourceFrame.pixels[sourceOffset]!, targetFrame.pixels[targetOffset]!, localProgress, dynamics?.colorInterpolation ?? 'rgb'), dynamics?.brightnessShift ?? 0, localProgress),
      shiftedByte(motionColor(sourceFrame.pixels[sourceOffset + 1]!, targetFrame.pixels[targetOffset + 1]!, localProgress, dynamics?.colorInterpolation ?? 'rgb'), dynamics?.brightnessShift ?? 0, localProgress),
      shiftedByte(motionColor(sourceFrame.pixels[sourceOffset + 2]!, targetFrame.pixels[targetOffset + 2]!, localProgress, dynamics?.colorInterpolation ?? 'rgb'), dynamics?.brightnessShift ?? 0, localProgress),
      mixBytes(sourceFrame.pixels[sourceOffset + 3]!, targetFrame.pixels[targetOffset + 3]!, localProgress),
    )
    for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) {
      setWeightedMask(outputMasks[name], outputCell, sourceFrame.masks[name][sourceCell], targetFrame.masks[name][targetCell], localProgress)
    }
  }

  for (let index = 0; index < plan.deathSourceIndices.length; index += 1) {
    const sourceCell = plan.deathSourceIndices[index]!
    const targetCell = plan.deathTargetIndices[index] ?? sourceCell
    const localProgress = easeInOut(clamp01(progress * (1 + (dynamics?.dispersal ?? 0) * 0.12)))
    const outputCell = interpolateIndex(sourceCell, targetCell, source.width, localProgress)
    blendWeightedFramePixel(outputPixels, collisionWeights, outputCell, sourceFrame.pixels, sourceCell, 1 - localProgress)
    for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) {
      outputMasks[name][outputCell] = Math.max(
        outputMasks[name][outputCell],
        Math.round(sourceFrame.masks[name][sourceCell] * (1 - localProgress)),
      )
    }
  }
  for (let index = 0; index < plan.birthTargetIndices.length; index += 1) {
    const targetCell = plan.birthTargetIndices[index]!
    const sourceCell = plan.birthSourceIndices[index] ?? targetCell
    const localProgress = easeInOut(clamp01(progress * (0.92 + (dynamics?.reconstruction ?? 0) * 0.08)))
    const outputCell = interpolateIndex(sourceCell, targetCell, source.width, localProgress)
    blendWeightedFramePixel(outputPixels, collisionWeights, outputCell, targetFrame.pixels, targetCell, localProgress)
    for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) {
      outputMasks[name][outputCell] = Math.max(
        outputMasks[name][outputCell],
        Math.round(targetFrame.masks[name][targetCell] * localProgress),
      )
    }
  }
}

export function composePixGridDeckRuntimeFrame(
  source: PixGridDeckRuntimeFrameSource,
  providedScratch?: PixGridDeckCompositorScratch,
): PixGridComposedDeckFrame {
  const scratch = ensureScratch(providedScratch ?? createPixGridDeckCompositorScratch(), source.width, source.height)
  const progress = clamp01(source.transitionProgress)
  if (source.sourceFrame.cacheKey === source.targetFrame.cacheKey || progress >= 1) {
    copyFrame(scratch.pixels, scratch.masks, source.targetFrame.pixels, source.targetFrame.masks)
  } else if (progress <= 0) {
    copyFrame(scratch.pixels, scratch.masks, source.sourceFrame.pixels, source.sourceFrame.masks)
  } else if (source.transitionMode === 'hardCut') {
    copyFrame(scratch.pixels, scratch.masks, source.sourceFrame.pixels, source.sourceFrame.masks)
  } else if (source.transitionMode === 'pixelTransport') {
    composePixelTransport(source, scratch.pixels, scratch.masks, scratch.collisionWeights)
  } else {
    composeCellTransition(source, scratch.pixels, scratch.masks)
    // A spatial wipe between two sparse, disjoint silhouettes can otherwise
    // select only transparent cells from both frames at an intermediate step.
    // Preserve visual continuity with the deterministic crossfade grammar.
    if (!hasVisiblePixel(scratch.pixels)
      && (hasVisiblePixel(source.sourceFrame.pixels) || hasVisiblePixel(source.targetFrame.pixels))) {
      composeCellTransition({ ...source, transitionMode: 'crossfade' }, scratch.pixels, scratch.masks)
    }
  }
  return { width: source.width, height: source.height, pixels: scratch.pixels, masks: scratch.masks }
}
