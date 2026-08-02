import {
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  type PixGridDeckGeneratedMaskName,
  type PixGridPreparedFrameMasks,
} from './PixGridDeckCompilerContracts'
import type { PixGridDeckRuntimeFrameSource } from './PixGridDeckRuntime'
import { pixGridCellTransitionMix } from './PixGridCellTransitions'

export interface PixGridDeckCompositorScratch {
  width: number
  height: number
  pixels: Uint8Array
  masks: Record<PixGridDeckGeneratedMaskName, Uint8Array>
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
  return { width: 0, height: 0, pixels: new Uint8Array(0), masks: createMasks(0) }
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
  }
  scratch.pixels.fill(0)
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

function blendRawPixel(
  pixels: Uint8Array,
  cell: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): void {
  const offset = cell * 4
  const sourceAlpha = alpha / 255
  if (sourceAlpha <= 0) return
  const targetAlpha = pixels[offset + 3] / 255
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha)
  const denominator = Math.max(0.0001, outputAlpha)
  pixels[offset] = Math.round((red * sourceAlpha + pixels[offset] * targetAlpha * (1 - sourceAlpha)) / denominator)
  pixels[offset + 1] = Math.round((green * sourceAlpha + pixels[offset + 1] * targetAlpha * (1 - sourceAlpha)) / denominator)
  pixels[offset + 2] = Math.round((blue * sourceAlpha + pixels[offset + 2] * targetAlpha * (1 - sourceAlpha)) / denominator)
  pixels[offset + 3] = Math.round(outputAlpha * 255)
}

function blendWeightedFramePixel(
  pixels: Uint8Array,
  targetCell: number,
  framePixels: Uint8Array,
  sourceCell: number,
  weight: number,
): void {
  const offset = sourceCell * 4
  blendRawPixel(
    pixels,
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
): void {
  const progress = clamp01(source.transitionProgress)
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
    if (sourceWeight > 0) blendWeightedFramePixel(outputPixels, cell, sourceFrame.pixels, cell, sourceWeight)
    if (targetWeight > 0) blendWeightedFramePixel(outputPixels, cell, targetFrame.pixels, cell, targetWeight)
    for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) {
      if (name === 'foreground') continue
      const sourceValue = sourceForeground[cell] > 0 ? 0 : sourceFrame.masks[name][cell]
      const targetValue = targetForeground[cell] > 0 ? 0 : targetFrame.masks[name][cell]
      setWeightedMask(outputMasks[name], cell, sourceValue, targetValue, progress)
    }
  }

  for (let index = 0; index < plan.matchedSourceIndices.length; index += 1) {
    const sourceCell = plan.matchedSourceIndices[index]
    const targetCell = plan.matchedTargetIndices[index]
    const outputCell = interpolateIndex(sourceCell, targetCell, source.width, progress)
    const sourceOffset = sourceCell * 4
    const targetOffset = targetCell * 4
    blendRawPixel(
      outputPixels,
      outputCell,
      mixBytes(sourceFrame.pixels[sourceOffset]!, targetFrame.pixels[targetOffset]!, progress),
      mixBytes(sourceFrame.pixels[sourceOffset + 1]!, targetFrame.pixels[targetOffset + 1]!, progress),
      mixBytes(sourceFrame.pixels[sourceOffset + 2]!, targetFrame.pixels[targetOffset + 2]!, progress),
      mixBytes(sourceFrame.pixels[sourceOffset + 3]!, targetFrame.pixels[targetOffset + 3]!, progress),
    )
    for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) {
      setWeightedMask(outputMasks[name], outputCell, sourceFrame.masks[name][sourceCell], targetFrame.masks[name][targetCell], progress)
    }
  }

  for (const sourceCell of plan.deathSourceIndices) {
    blendWeightedFramePixel(outputPixels, sourceCell, sourceFrame.pixels, sourceCell, 1 - progress)
    for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) {
      outputMasks[name][sourceCell] = Math.max(
        outputMasks[name][sourceCell],
        Math.round(sourceFrame.masks[name][sourceCell] * (1 - progress)),
      )
    }
  }
  for (const targetCell of plan.birthTargetIndices) {
    blendWeightedFramePixel(outputPixels, targetCell, targetFrame.pixels, targetCell, progress)
    for (const name of PIX_GRID_DECK_GENERATED_MASK_NAMES) {
      outputMasks[name][targetCell] = Math.max(
        outputMasks[name][targetCell],
        Math.round(targetFrame.masks[name][targetCell] * progress),
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
    composePixelTransport(source, scratch.pixels, scratch.masks)
  } else {
    composeCellTransition(source, scratch.pixels, scratch.masks)
  }
  return { width: source.width, height: source.height, pixels: scratch.pixels, masks: scratch.masks }
}
