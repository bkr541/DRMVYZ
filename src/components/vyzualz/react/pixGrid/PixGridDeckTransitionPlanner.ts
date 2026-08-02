import type { PixGridDeckTransitionMode } from './PixGridDeckDomain'
import {
  PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
  PIX_GRID_DECK_TRANSITION_ALGORITHM_VERSION,
  type PixGridDeckConcreteTransitionMode,
  type PixGridDeckTransitionCompileSettings,
  type PixGridDeckTransitionDiagnostics,
  type PixGridDeckTransitionPlan,
  type PixGridPreparedFrame,
  type PixGridPreparedFrameMetrics,
} from './PixGridDeckCompilerContracts'

export const PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE = 64
export const PIX_GRID_DECK_TRANSITION_MAX_TRANSPORT_FOREGROUND = 12_000

interface FrameEvidence {
  foregroundIndices: Uint32Array
  componentCount: number
  colorEntropy: number
  centroidX: number
  centroidY: number
}

interface TransitionPlannerFrameInput {
  cacheKey: string
  width: number
  height: number
  pixels: Uint8Array
  foreground: Uint8Array
  metrics: PixGridPreparedFrameMetrics
}

export interface PixGridDeckTransitionPlannerInput {
  cacheKey: string
  source: TransitionPlannerFrameInput
  target: TransitionPlannerFrameInput
  settings: PixGridDeckTransitionCompileSettings
}

export interface PixGridDeckAutomaticTransitionSelection {
  mode: PixGridDeckConcreteTransitionMode
  reason: string
  sourceEvidence: FrameEvidence
  targetEvidence: FrameEvidence
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function stableNumber(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : '0'
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function createPixGridDeckTransitionCacheKey(input: {
  sourceFrameCacheKey: string
  targetFrameCacheKey: string
  settings: PixGridDeckTransitionCompileSettings
}): string {
  const signature = [
    `pix-grid-deck-transition-v${PIX_GRID_DECK_TRANSITION_ALGORITHM_VERSION}`,
    input.sourceFrameCacheKey,
    input.targetFrameCacheKey,
    input.settings.sourceItemId,
    input.settings.targetItemId,
    input.settings.requestedMode,
    stableNumber(clamp(input.settings.durationFraction, 0, 0.75)),
  ].join('|')
  return `pix-grid-deck-transition:${fnv1a(signature)}:${signature}`
}

export function quantizePixGridDeckTransitionDuration(input: {
  itemDurationBeats: number
  durationFraction: number
  beatGridBeats?: number
  mode: PixGridDeckTransitionMode
}): number {
  if (input.mode === 'hardCut') return 0
  const itemDuration = Math.max(0, Number.isFinite(input.itemDurationBeats) ? input.itemDurationBeats : 0)
  const fraction = Number.isFinite(input.durationFraction)
    ? clamp(input.durationFraction, 0, 0.75)
    : 0.25
  if (itemDuration <= 0 || fraction <= 0) return 0
  const grid = Math.max(1 / 64, Number.isFinite(input.beatGridBeats) ? input.beatGridBeats! : 0.25)
  const maximumQuantized = Math.floor((itemDuration * 0.75 + Number.EPSILON) / grid) * grid
  if (maximumQuantized < grid) return 0
  const quantized = Math.round((itemDuration * fraction) / grid) * grid
  return Math.min(maximumQuantized, Math.max(grid, quantized))
}

function foregroundIndices(mask: Uint8Array): Uint32Array {
  let count = 0
  for (const value of mask) if (value > 0) count += 1
  const result = new Uint32Array(count)
  let cursor = 0
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] > 0) result[cursor++] = index
  }
  return result
}

function connectedComponentCount(mask: Uint8Array, width: number, height: number): number {
  const visited = new Uint8Array(mask.length)
  const queue = new Uint32Array(mask.length)
  let components = 0
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || visited[start]) continue
    components += 1
    let read = 0
    let write = 0
    queue[write++] = start
    visited[start] = 1
    while (read < write) {
      const cell = queue[read++]!
      const x = cell % width
      const y = Math.floor(cell / width)
      const neighbors = [
        x > 0 ? cell - 1 : -1,
        x + 1 < width ? cell + 1 : -1,
        y > 0 ? cell - width : -1,
        y + 1 < height ? cell + width : -1,
      ]
      for (const neighbor of neighbors) {
        if (neighbor < 0 || mask[neighbor] === 0 || visited[neighbor]) continue
        visited[neighbor] = 1
        queue[write++] = neighbor
      }
    }
  }
  return components
}

function normalizedColorEntropy(pixels: Uint8Array, indices: Uint32Array): number {
  if (indices.length <= 1) return 0
  const bins = new Uint32Array(64)
  for (const cell of indices) {
    const offset = cell * 4
    const bin = ((pixels[offset]! >>> 6) << 4) | ((pixels[offset + 1]! >>> 6) << 2) | (pixels[offset + 2]! >>> 6)
    bins[bin] += 1
  }
  let entropy = 0
  for (const count of bins) {
    if (count === 0) continue
    const probability = count / indices.length
    entropy -= probability * Math.log2(probability)
  }
  return entropy / 6
}

function frameEvidence(frame: TransitionPlannerFrameInput): FrameEvidence {
  const indices = foregroundIndices(frame.foreground)
  let xSum = 0
  let ySum = 0
  for (const cell of indices) {
    xSum += cell % frame.width
    ySum += Math.floor(cell / frame.width)
  }
  return {
    foregroundIndices: indices,
    componentCount: connectedComponentCount(frame.foreground, frame.width, frame.height),
    colorEntropy: normalizedColorEntropy(frame.pixels, indices),
    centroidX: indices.length > 0 ? xSum / indices.length / Math.max(1, frame.width - 1) : 0.5,
    centroidY: indices.length > 0 ? ySum / indices.length / Math.max(1, frame.height - 1) : 0.5,
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false
  return true
}

function ratioCompatibility(left: number, right: number): number {
  if (left === 0 && right === 0) return 1
  return Math.min(left, right) / Math.max(1, left, right)
}

function boundsArea(metrics: PixGridPreparedFrameMetrics): number {
  const bounds = metrics.bounds
  if (!bounds) return 0
  return Math.max(1, bounds.maxX - bounds.minX + 1) * Math.max(1, bounds.maxY - bounds.minY + 1)
}

function transportSuitability(
  source: TransitionPlannerFrameInput,
  target: TransitionPlannerFrameInput,
  sourceEvidence: FrameEvidence,
  targetEvidence: FrameEvidence,
): { suitable: boolean; reason: string } {
  const sourceCount = sourceEvidence.foregroundIndices.length
  const targetCount = targetEvidence.foregroundIndices.length
  if (sourceCount === 0 || targetCount === 0) return { suitable: false, reason: 'empty-foreground' }
  if (sourceCount > PIX_GRID_DECK_TRANSITION_MAX_TRANSPORT_FOREGROUND
    || targetCount > PIX_GRID_DECK_TRANSITION_MAX_TRANSPORT_FOREGROUND) {
    return { suitable: false, reason: 'foreground-budget' }
  }
  const sourceDensity = sourceCount / Math.max(1, source.metrics.cellCount)
  const targetDensity = targetCount / Math.max(1, target.metrics.cellCount)
  if (Math.max(sourceDensity, targetDensity) > 0.58) return { suitable: false, reason: 'dense-content' }
  if (ratioCompatibility(sourceCount, targetCount) < 0.2) return { suitable: false, reason: 'foreground-count-mismatch' }
  if (ratioCompatibility(sourceEvidence.componentCount, targetEvidence.componentCount) < 0.2) {
    return { suitable: false, reason: 'component-mismatch' }
  }
  if (Math.max(sourceEvidence.colorEntropy, targetEvidence.colorEntropy) > 0.84) {
    return { suitable: false, reason: 'high-color-entropy' }
  }
  return { suitable: true, reason: 'sparse-compatible-foreground' }
}

export function selectAutomaticPixGridDeckTransition(input: {
  source: TransitionPlannerFrameInput
  target: TransitionPlannerFrameInput
}): PixGridDeckAutomaticTransitionSelection {
  const sourceEvidence = frameEvidence(input.source)
  const targetEvidence = frameEvidence(input.target)
  const sourceCount = sourceEvidence.foregroundIndices.length
  const targetCount = targetEvidence.foregroundIndices.length
  if (bytesEqual(input.source.pixels, input.target.pixels)) {
    return { mode: 'hardCut', reason: 'identical-frames', sourceEvidence, targetEvidence }
  }
  if (sourceCount === 0 && targetCount === 0) {
    return { mode: 'hardCut', reason: 'both-frames-empty', sourceEvidence, targetEvidence }
  }
  if (sourceCount === 0 || targetCount === 0) {
    return { mode: 'crossfade', reason: 'one-frame-empty', sourceEvidence, targetEvidence }
  }
  const suitability = transportSuitability(input.source, input.target, sourceEvidence, targetEvidence)
  if (suitability.suitable) {
    return { mode: 'pixelTransport', reason: suitability.reason, sourceEvidence, targetEvidence }
  }

  const maxDensity = Math.max(
    sourceCount / Math.max(1, input.source.metrics.cellCount),
    targetCount / Math.max(1, input.target.metrics.cellCount),
  )
  const maxEntropy = Math.max(sourceEvidence.colorEntropy, targetEvidence.colorEntropy)
  if (maxDensity >= 0.72 && maxEntropy >= 0.45) {
    return { mode: 'crossfade', reason: 'dense-high-entropy-content', sourceEvidence, targetEvidence }
  }
  if (maxDensity >= 0.62) {
    return { mode: 'pixelDissolve', reason: 'dense-content', sourceEvidence, targetEvidence }
  }

  const deltaX = targetEvidence.centroidX - sourceEvidence.centroidX
  const deltaY = targetEvidence.centroidY - sourceEvidence.centroidY
  if (Math.abs(deltaX) >= 0.18 && Math.abs(deltaX) >= Math.abs(deltaY)) {
    return { mode: 'columnWipe', reason: 'horizontal-centroid-shift', sourceEvidence, targetEvidence }
  }
  if (Math.abs(deltaY) >= 0.18) {
    return { mode: 'rowWipe', reason: 'vertical-centroid-shift', sourceEvidence, targetEvidence }
  }
  if (ratioCompatibility(sourceEvidence.componentCount, targetEvidence.componentCount) < 0.35) {
    return { mode: 'checkerWipe', reason: 'component-structure-mismatch', sourceEvidence, targetEvidence }
  }
  if (ratioCompatibility(boundsArea(input.source.metrics), boundsArea(input.target.metrics)) < 0.45) {
    return { mode: 'radialReveal', reason: 'foreground-scale-mismatch', sourceEvidence, targetEvidence }
  }
  return { mode: 'pixelDissolve', reason: 'moderate-structural-difference', sourceEvidence, targetEvidence }
}

function componentBounds(metrics: PixGridPreparedFrameMetrics, width: number, height: number) {
  return metrics.bounds ?? { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 }
}

function colorDistance(sourcePixels: Uint8Array, sourceCell: number, targetPixels: Uint8Array, targetCell: number): number {
  const sourceOffset = sourceCell * 4
  const targetOffset = targetCell * 4
  return Math.abs(sourcePixels[sourceOffset]! - targetPixels[targetOffset]!)
    + Math.abs(sourcePixels[sourceOffset + 1]! - targetPixels[targetOffset + 1]!)
    + Math.abs(sourcePixels[sourceOffset + 2]! - targetPixels[targetOffset + 2]!)
    + Math.abs(sourcePixels[sourceOffset + 3]! - targetPixels[targetOffset + 3]!)
}

function compileTransportMapping(input: {
  source: TransitionPlannerFrameInput
  target: TransitionPlannerFrameInput
  sourceEvidence: FrameEvidence
  targetEvidence: FrameEvidence
}): {
  matchedSourceIndices: Uint32Array
  matchedTargetIndices: Uint32Array
  deathSourceIndices: Uint32Array
  birthTargetIndices: Uint32Array
  candidateComparisons: number
} {
  const { source, target, sourceEvidence, targetEvidence } = input
  const sourceIndices = sourceEvidence.foregroundIndices
  const targetIndices = targetEvidence.foregroundIndices
  if (sourceIndices.length === 0 || targetIndices.length === 0) {
    return {
      matchedSourceIndices: new Uint32Array(),
      matchedTargetIndices: new Uint32Array(),
      deathSourceIndices: sourceIndices.slice(),
      birthTargetIndices: targetIndices.slice(),
      candidateComparisons: 0,
    }
  }

  const binSize = Math.max(2, Math.ceil(Math.max(source.width, source.height) / 40))
  const binsWide = Math.ceil(target.width / binSize)
  const bins = new Map<number, number[]>()
  for (const cell of targetIndices) {
    const x = cell % target.width
    const y = Math.floor(cell / target.width)
    const key = Math.floor(y / binSize) * binsWide + Math.floor(x / binSize)
    const bucket = bins.get(key) ?? []
    bucket.push(cell)
    bins.set(key, bucket)
  }
  const claimed = new Uint8Array(target.width * target.height)
  const matchedSource: number[] = []
  const matchedTarget: number[] = []
  const deaths: number[] = []
  let candidateComparisons = 0
  const sourceBounds = componentBounds(source.metrics, source.width, source.height)
  const targetBounds = componentBounds(target.metrics, target.width, target.height)
  const sourceSpanX = Math.max(1, sourceBounds.maxX - sourceBounds.minX)
  const sourceSpanY = Math.max(1, sourceBounds.maxY - sourceBounds.minY)
  const targetSpanX = Math.max(1, targetBounds.maxX - targetBounds.minX)
  const targetSpanY = Math.max(1, targetBounds.maxY - targetBounds.minY)
  const maxBinRadius = Math.max(2, Math.ceil(Math.max(target.width, target.height) / binSize / 5))

  for (const sourceCell of sourceIndices) {
    const sourceX = sourceCell % source.width
    const sourceY = Math.floor(sourceCell / source.width)
    const normalizedX = (sourceX - sourceBounds.minX) / sourceSpanX
    const normalizedY = (sourceY - sourceBounds.minY) / sourceSpanY
    const desiredX = clamp(Math.round(targetBounds.minX + normalizedX * targetSpanX), 0, target.width - 1)
    const desiredY = clamp(Math.round(targetBounds.minY + normalizedY * targetSpanY), 0, target.height - 1)
    const centerBinX = Math.floor(desiredX / binSize)
    const centerBinY = Math.floor(desiredY / binSize)
    let bestTarget = -1
    let bestScore = Number.POSITIVE_INFINITY
    let compared = 0

    for (let radius = 0; radius <= maxBinRadius && compared < PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE; radius += 1) {
      for (let by = centerBinY - radius; by <= centerBinY + radius && compared < PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE; by += 1) {
        if (by < 0 || by >= Math.ceil(target.height / binSize)) continue
        for (let bx = centerBinX - radius; bx <= centerBinX + radius && compared < PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE; bx += 1) {
          if (bx < 0 || bx >= binsWide) continue
          if (radius > 0 && bx > centerBinX - radius && bx < centerBinX + radius
            && by > centerBinY - radius && by < centerBinY + radius) continue
          const bucket = bins.get(by * binsWide + bx)
          if (!bucket) continue
          for (const targetCell of bucket) {
            if (claimed[targetCell]) continue
            compared += 1
            candidateComparisons += 1
            const targetX = targetCell % target.width
            const targetY = Math.floor(targetCell / target.width)
            const distance = Math.abs(targetX - desiredX) + Math.abs(targetY - desiredY)
            const score = distance * 1024 + colorDistance(source.pixels, sourceCell, target.pixels, targetCell) * 2 + targetCell / Math.max(1, target.width * target.height)
            if (score < bestScore) {
              bestScore = score
              bestTarget = targetCell
            }
            if (compared >= PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE) break
          }
        }
      }
      if (bestTarget >= 0 && radius >= 1) break
    }

    if (bestTarget < 0) {
      deaths.push(sourceCell)
      continue
    }
    claimed[bestTarget] = 1
    matchedSource.push(sourceCell)
    matchedTarget.push(bestTarget)
  }

  const births: number[] = []
  for (const targetCell of targetIndices) if (!claimed[targetCell]) births.push(targetCell)
  return {
    matchedSourceIndices: Uint32Array.from(matchedSource),
    matchedTargetIndices: Uint32Array.from(matchedTarget),
    deathSourceIndices: Uint32Array.from(deaths),
    birthTargetIndices: Uint32Array.from(births),
    candidateComparisons,
  }
}

function emptyMapping(sourceEvidence: FrameEvidence, targetEvidence: FrameEvidence) {
  return {
    matchedSourceIndices: new Uint32Array(),
    matchedTargetIndices: new Uint32Array(),
    deathSourceIndices: sourceEvidence.foregroundIndices.slice(),
    birthTargetIndices: targetEvidence.foregroundIndices.slice(),
    candidateComparisons: 0,
  }
}

export function compilePixGridDeckTransitionPlan(input: PixGridDeckTransitionPlannerInput): PixGridDeckTransitionPlan {
  if (input.source.width !== input.target.width || input.source.height !== input.target.height) {
    throw new Error('PixGrid Deck transition frames must share one logical matrix size.')
  }
  const expectedCells = input.source.width * input.source.height
  if (
    input.source.pixels.length !== expectedCells * 4
    || input.target.pixels.length !== expectedCells * 4
    || input.source.foreground.length !== expectedCells
    || input.target.foreground.length !== expectedCells
  ) throw new Error('PixGrid Deck transition compiler received an invalid frame shape.')

  const automatic = selectAutomaticPixGridDeckTransition({ source: input.source, target: input.target })
  const requestedMode = input.settings.requestedMode
  let mode: PixGridDeckConcreteTransitionMode = requestedMode === 'auto' ? automatic.mode : requestedMode
  let fallbackReason: string | null = null
  const suitability = transportSuitability(input.source, input.target, automatic.sourceEvidence, automatic.targetEvidence)
  if (mode === 'pixelTransport' && !suitability.suitable) {
    mode = automatic.mode === 'pixelTransport' ? 'pixelDissolve' : automatic.mode
    fallbackReason = suitability.reason
  }

  const mapping = mode === 'pixelTransport'
    ? compileTransportMapping({
        source: input.source,
        target: input.target,
        sourceEvidence: automatic.sourceEvidence,
        targetEvidence: automatic.targetEvidence,
      })
    : emptyMapping(automatic.sourceEvidence, automatic.targetEvidence)

  const diagnostics: PixGridDeckTransitionDiagnostics = {
    sourceForegroundCount: automatic.sourceEvidence.foregroundIndices.length,
    targetForegroundCount: automatic.targetEvidence.foregroundIndices.length,
    matchedCount: mapping.matchedSourceIndices.length,
    birthCount: mapping.birthTargetIndices.length,
    deathCount: mapping.deathSourceIndices.length,
    sourceComponentCount: automatic.sourceEvidence.componentCount,
    targetComponentCount: automatic.targetEvidence.componentCount,
    sourceColorEntropy: automatic.sourceEvidence.colorEntropy,
    targetColorEntropy: automatic.targetEvidence.colorEntropy,
    candidateComparisons: mapping.candidateComparisons,
    maxCandidatesPerSource: PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE,
  }
  const approximateBytes = mapping.matchedSourceIndices.byteLength
    + mapping.matchedTargetIndices.byteLength
    + mapping.deathSourceIndices.byteLength
    + mapping.birthTargetIndices.byteLength
    + 512
  return {
    schemaVersion: PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
    algorithmVersion: PIX_GRID_DECK_TRANSITION_ALGORITHM_VERSION,
    cacheKey: input.cacheKey,
    requestedMode,
    mode,
    automaticReason: requestedMode === 'auto' ? automatic.reason : null,
    fallbackReason,
    sourceFrameCacheKey: input.source.cacheKey,
    targetFrameCacheKey: input.target.cacheKey,
    width: input.source.width,
    height: input.source.height,
    matchedSourceIndices: mapping.matchedSourceIndices,
    matchedTargetIndices: mapping.matchedTargetIndices,
    deathSourceIndices: mapping.deathSourceIndices,
    birthTargetIndices: mapping.birthTargetIndices,
    diagnostics,
    approximateBytes,
  }
}

export function compilePixGridDeckPreparedFrameTransition(input: {
  cacheKey: string
  source: PixGridPreparedFrame
  target: PixGridPreparedFrame
  settings: PixGridDeckTransitionCompileSettings
}): PixGridDeckTransitionPlan {
  return compilePixGridDeckTransitionPlan({
    cacheKey: input.cacheKey,
    source: {
      cacheKey: input.source.cacheKey,
      width: input.source.width,
      height: input.source.height,
      pixels: input.source.pixels,
      foreground: input.source.masks.foreground,
      metrics: input.source.metrics,
    },
    target: {
      cacheKey: input.target.cacheKey,
      width: input.target.width,
      height: input.target.height,
      pixels: input.target.pixels,
      foreground: input.target.masks.foreground,
      metrics: input.target.metrics,
    },
    settings: input.settings,
  })
}

function endpointPartitionIsValid(
  matched: Uint32Array,
  unmatched: Uint32Array,
  expectedCount: number,
  cellCount: number,
): boolean {
  if (matched.length + unmatched.length !== expectedCount) return false
  const seen = new Set<number>()
  for (const index of matched) {
    if (index >= cellCount || seen.has(index)) return false
    seen.add(index)
  }
  for (const index of unmatched) {
    if (index >= cellCount || seen.has(index)) return false
    seen.add(index)
  }
  return true
}

/** Endpoint-only verification helper. Live interpolation intentionally belongs to Stage 6. */
export function reconstructPixGridDeckTransitionEndpoint(
  plan: PixGridDeckTransitionPlan,
  sourcePixels: Uint8Array,
  targetPixels: Uint8Array,
  progress: 0 | 1,
): Uint8Array {
  const cellCount = plan.width * plan.height
  const expectedBytes = cellCount * 4
  if (sourcePixels.length !== expectedBytes || targetPixels.length !== expectedBytes) {
    throw new Error('PixGrid Deck transition endpoint reconstruction received an invalid frame shape.')
  }
  const valid = plan.matchedSourceIndices.length === plan.matchedTargetIndices.length
    && endpointPartitionIsValid(
      plan.matchedSourceIndices,
      plan.deathSourceIndices,
      plan.diagnostics.sourceForegroundCount,
      cellCount,
    )
    && endpointPartitionIsValid(
      plan.matchedTargetIndices,
      plan.birthTargetIndices,
      plan.diagnostics.targetForegroundCount,
      cellCount,
    )
  if (!valid) throw new Error('PixGrid Deck transition endpoint reconstruction received an invalid plan mapping.')
  return (progress === 0 ? sourcePixels : targetPixels).slice()
}
