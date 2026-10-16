import type { PixGridDeckTransitionMode } from './PixGridDeckDomain'
import {
  PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
  PIX_GRID_DECK_TRANSITION_ALGORITHM_VERSION,
  type PixGridDeckConcreteTransitionMode,
  type PixGridDeckTransitionCompileSettings,
  type PixGridDeckTransitionDiagnostics,
  type PixGridDeckTransitionPlan,
  type PixGridDeckTransportStrategy,
  type PixGridPreparedFrame,
  type PixGridPreparedFrameMetrics,
} from './PixGridDeckCompilerContracts'

export const PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE = 48
export const PIX_GRID_DECK_TRANSITION_MAX_TRANSPORT_FOREGROUND = 40_000

interface ComponentEvidence {
  id: number
  count: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  centroidX: number
  centroidY: number
  averageRed: number
  averageGreen: number
  averageBlue: number
}

interface FrameEvidence {
  foregroundIndices: Uint32Array
  componentCount: number
  colorEntropy: number
  centroidX: number
  centroidY: number
  componentLabels: Int32Array
  components: readonly ComponentEvidence[]
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
    input.settings.preferredStrategy ?? 'automatic',
    input.settings.motionProfileSignature ?? 'engine-default',
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

function connectedComponents(mask: Uint8Array, pixels: Uint8Array, width: number, height: number): {
  labels: Int32Array
  components: ComponentEvidence[]
} {
  const visited = new Uint8Array(mask.length)
  const labels = new Int32Array(mask.length).fill(-1)
  const queue = new Uint32Array(mask.length)
  const components: ComponentEvidence[] = []
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || visited[start]) continue
    const id = components.length
    let read = 0
    let write = 0
    let xSum = 0
    let ySum = 0
    let redSum = 0
    let greenSum = 0
    let blueSum = 0
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    queue[write++] = start
    visited[start] = 1
    while (read < write) {
      const cell = queue[read++]!
      const x = cell % width
      const y = Math.floor(cell / width)
      const offset = cell * 4
      labels[cell] = id
      xSum += x
      ySum += y
      redSum += pixels[offset]!
      greenSum += pixels[offset + 1]!
      blueSum += pixels[offset + 2]!
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
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
    components.push({
      id,
      count: write,
      minX,
      minY,
      maxX,
      maxY,
      centroidX: xSum / write,
      centroidY: ySum / write,
      averageRed: redSum / write,
      averageGreen: greenSum / write,
      averageBlue: blueSum / write,
    })
  }
  return { labels, components }
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
  const componentAnalysis = connectedComponents(frame.foreground, frame.pixels, frame.width, frame.height)
  let xSum = 0
  let ySum = 0
  for (const cell of indices) {
    xSum += cell % frame.width
    ySum += Math.floor(cell / frame.width)
  }
  return {
    foregroundIndices: indices,
    componentCount: componentAnalysis.components.length,
    colorEntropy: normalizedColorEntropy(frame.pixels, indices),
    centroidX: indices.length > 0 ? xSum / indices.length / Math.max(1, frame.width - 1) : 0.5,
    centroidY: indices.length > 0 ? ySum / indices.length / Math.max(1, frame.height - 1) : 0.5,
    componentLabels: componentAnalysis.labels,
    components: componentAnalysis.components,
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
  if (sourceCount > PIX_GRID_DECK_TRANSITION_MAX_TRANSPORT_FOREGROUND
    || targetCount > PIX_GRID_DECK_TRANSITION_MAX_TRANSPORT_FOREGROUND) {
    return { suitable: false, reason: 'foreground-budget' }
  }
  if (sourceCount === 0) return { suitable: true, reason: 'procedural-assembly' }
  if (targetCount === 0) return { suitable: true, reason: 'procedural-dispersal' }
  const density = Math.max(
    sourceCount / Math.max(1, source.metrics.cellCount),
    targetCount / Math.max(1, target.metrics.cellCount),
  )
  if (density > 0.58) return { suitable: true, reason: 'bounded-region-transport' }
  if (ratioCompatibility(sourceCount, targetCount) < 0.35) return { suitable: true, reason: 'transport-with-births-deaths' }
  if (ratioCompatibility(sourceEvidence.componentCount, targetEvidence.componentCount) < 0.35) {
    return { suitable: true, reason: 'hierarchical-component-transport' }
  }
  return { suitable: true, reason: 'coherent-pixel-transport' }
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
  const suitability = transportSuitability(input.source, input.target, sourceEvidence, targetEvidence)
  if (suitability.suitable) {
    return { mode: 'pixelTransport', reason: suitability.reason, sourceEvidence, targetEvidence }
  }
  return { mode: 'pixelDissolve', reason: suitability.reason, sourceEvidence, targetEvidence }
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

function componentCorrespondence(
  source: TransitionPlannerFrameInput,
  target: TransitionPlannerFrameInput,
  sourceEvidence: FrameEvidence,
  targetEvidence: FrameEvidence,
): Int32Array {
  const result = new Int32Array(sourceEvidence.components.length).fill(-1)
  if (targetEvidence.components.length === 0) return result
  const usedTargets = new Set<number>()
  for (const sourceComponent of sourceEvidence.components) {
    let bestId = targetEvidence.components[0]!.id
    let bestScore = Number.POSITIVE_INFINITY
    for (const targetComponent of targetEvidence.components) {
      if (sourceEvidence.components.length <= targetEvidence.components.length && usedTargets.has(targetComponent.id)) continue
      const sourceX = sourceComponent.centroidX / Math.max(1, source.width - 1)
      const sourceY = sourceComponent.centroidY / Math.max(1, source.height - 1)
      const targetX = targetComponent.centroidX / Math.max(1, target.width - 1)
      const targetY = targetComponent.centroidY / Math.max(1, target.height - 1)
      const geometry = Math.hypot(sourceX - targetX, sourceY - targetY)
      const scale = Math.abs(Math.log((sourceComponent.count + 1) / (targetComponent.count + 1)))
      const color = (
        Math.abs(sourceComponent.averageRed - targetComponent.averageRed)
        + Math.abs(sourceComponent.averageGreen - targetComponent.averageGreen)
        + Math.abs(sourceComponent.averageBlue - targetComponent.averageBlue)
      ) / 765
      const score = geometry * 5 + scale * 1.5 + color + targetComponent.id * 1e-6
      if (score < bestScore) {
        bestScore = score
        bestId = targetComponent.id
      }
    }
    result[sourceComponent.id] = bestId
    usedTargets.add(bestId)
  }
  return result
}

function selectTransportStrategy(
  source: TransitionPlannerFrameInput,
  target: TransitionPlannerFrameInput,
  sourceEvidence: FrameEvidence,
  targetEvidence: FrameEvidence,
): { strategy: PixGridDeckTransportStrategy; reason: string } {
  const sourceCount = sourceEvidence.foregroundIndices.length
  const targetCount = targetEvidence.foregroundIndices.length
  if (sourceCount === 0) return { strategy: 'assemble', reason: 'empty-source-assembly' }
  if (targetCount === 0) return { strategy: 'disperse', reason: 'empty-target-dispersal' }
  const density = Math.max(sourceCount, targetCount) / Math.max(1, source.width * source.height)
  const countRatio = ratioCompatibility(sourceCount, targetCount)
  const componentRatio = ratioCompatibility(sourceEvidence.componentCount, targetEvidence.componentCount)
  if (density >= 0.58) return { strategy: 'clusteredMorph', reason: 'dense-region-groups' }
  if (countRatio < 0.4
    || componentRatio < 0.4
    || sourceEvidence.componentCount !== targetEvidence.componentCount) {
    return { strategy: 'disperseReconstruct', reason: 'large-structural-difference' }
  }
  const deltaX = targetEvidence.centroidX - sourceEvidence.centroidX
  const deltaY = targetEvidence.centroidY - sourceEvidence.centroidY
  if (Math.hypot(deltaX, deltaY) >= 0.16) return { strategy: 'directionalFlow', reason: 'centroid-directed-flow' }
  if (ratioCompatibility(boundsArea(source.metrics), boundsArea(target.metrics)) < 0.5) {
    return { strategy: 'implodeExpand', reason: 'large-scale-change' }
  }
  return { strategy: 'directMorph', reason: 'component-aligned-morph' }
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
  const componentTargets = componentCorrespondence(source, target, sourceEvidence, targetEvidence)
  const mappedTargetBySource = new Int32Array(source.width * source.height).fill(-1)
  const sourceBounds = componentBounds(source.metrics, source.width, source.height)
  const targetBounds = componentBounds(target.metrics, target.width, target.height)
  const sourceSpanX = Math.max(1, sourceBounds.maxX - sourceBounds.minX)
  const sourceSpanY = Math.max(1, sourceBounds.maxY - sourceBounds.minY)
  const targetSpanX = Math.max(1, targetBounds.maxX - targetBounds.minX)
  const targetSpanY = Math.max(1, targetBounds.maxY - targetBounds.minY)
  const maxBinRadius = Math.max(2, Math.ceil(Math.max(target.width, target.height) / binSize / 5))
  const dense = Math.max(sourceIndices.length, targetIndices.length) / Math.max(1, source.width * source.height) > 0.58
  const maxCandidates = dense ? 24 : PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE

  for (const sourceCell of sourceIndices) {
    const sourceX = sourceCell % source.width
    const sourceY = Math.floor(sourceCell / source.width)
    const normalizedX = (sourceX - sourceBounds.minX) / sourceSpanX
    const normalizedY = (sourceY - sourceBounds.minY) / sourceSpanY
    const desiredX = clamp(Math.round(targetBounds.minX + normalizedX * targetSpanX), 0, target.width - 1)
    const desiredY = clamp(Math.round(targetBounds.minY + normalizedY * targetSpanY), 0, target.height - 1)
    const centerBinX = Math.floor(desiredX / binSize)
    const centerBinY = Math.floor(desiredY / binSize)
    const sourceComponent = sourceEvidence.componentLabels[sourceCell]!
    const desiredComponent = sourceComponent >= 0 ? componentTargets[sourceComponent]! : -1
    let bestTarget = -1
    let bestScore = Number.POSITIVE_INFINITY
    let compared = 0

    for (let radius = 0; radius <= maxBinRadius && compared < maxCandidates; radius += 1) {
      for (let by = centerBinY - radius; by <= centerBinY + radius && compared < maxCandidates; by += 1) {
        if (by < 0 || by >= Math.ceil(target.height / binSize)) continue
        for (let bx = centerBinX - radius; bx <= centerBinX + radius && compared < maxCandidates; bx += 1) {
          if (bx < 0 || bx >= binsWide) continue
          if (radius > 0 && bx > centerBinX - radius && bx < centerBinX + radius
            && by > centerBinY - radius && by < centerBinY + radius) continue
          const bucket = bins.get(by * binsWide + bx)
          if (!bucket) continue
          for (const targetCell of bucket) {
            if (claimed[targetCell]) continue
            if (desiredComponent >= 0 && targetEvidence.componentLabels[targetCell] !== desiredComponent) continue
            compared += 1
            candidateComparisons += 1
            const targetX = targetCell % target.width
            const targetY = Math.floor(targetCell / target.width)
            const distance = Math.abs(targetX - desiredX) + Math.abs(targetY - desiredY)
            let neighborPenalty = 0
            const leftTarget = sourceX > 0 ? mappedTargetBySource[sourceCell - 1]! : -1
            const upTarget = sourceY > 0 ? mappedTargetBySource[sourceCell - source.width]! : -1
            if (leftTarget >= 0) neighborPenalty += Math.abs(targetX - (leftTarget % target.width + 1)) + Math.abs(targetY - Math.floor(leftTarget / target.width))
            if (upTarget >= 0) neighborPenalty += Math.abs(targetX - (upTarget % target.width)) + Math.abs(targetY - (Math.floor(upTarget / target.width) + 1))
            const score = distance * 1024
              + neighborPenalty * 320
              + colorDistance(source.pixels, sourceCell, target.pixels, targetCell) * 2
              + targetCell / Math.max(1, target.width * target.height)
            if (score < bestScore) {
              bestScore = score
              bestTarget = targetCell
            }
            if (compared >= maxCandidates) break
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
    mappedTargetBySource[sourceCell] = bestTarget
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

function clampCell(x: number, y: number, width: number, height: number): number {
  const safeX = clamp(Math.round(x), 0, width - 1)
  const safeY = clamp(Math.round(y), 0, height - 1)
  return safeY * width + safeX
}

function stableUnit(seed: number): number {
  let value = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff
}

function compileMotionData(input: {
  source: TransitionPlannerFrameInput
  target: TransitionPlannerFrameInput
  sourceEvidence: FrameEvidence
  targetEvidence: FrameEvidence
  mapping: ReturnType<typeof compileTransportMapping>
  strategy: PixGridDeckTransportStrategy
}) {
  const { source, target, sourceEvidence, targetEvidence, mapping, strategy } = input
  const count = mapping.matchedSourceIndices.length
  const controlX = new Int16Array(count)
  const controlY = new Int16Array(count)
  const stagger = new Uint8Array(count)
  const groupIds = new Uint16Array(count)
  const centerX = (sourceEvidence.centroidX + targetEvidence.centroidX) * 0.5 * Math.max(1, source.width - 1)
  const centerY = (sourceEvidence.centroidY + targetEvidence.centroidY) * 0.5 * Math.max(1, source.height - 1)
  for (let index = 0; index < count; index += 1) {
    const sourceCell = mapping.matchedSourceIndices[index]!
    const targetCell = mapping.matchedTargetIndices[index]!
    const sx = sourceCell % source.width
    const sy = Math.floor(sourceCell / source.width)
    const tx = targetCell % target.width
    const ty = Math.floor(targetCell / target.width)
    const component = Math.max(0, sourceEvidence.componentLabels[sourceCell]!)
    const group = (component * 257 + Math.floor(sx / 4) * 17 + Math.floor(sy / 4)) & 0xffff
    groupIds[index] = group
    stagger[index] = Math.round(stableUnit(group * 65537) * 72)
    let cx = (sx + tx) * 0.5
    let cy = (sy + ty) * 0.5
    if (strategy === 'directionalFlow') {
      const sign = stableUnit(group) < 0.5 ? -1 : 1
      cx += (ty - sy) * 0.16 * sign
      cy -= (tx - sx) * 0.16 * sign
    } else if (strategy === 'disperseReconstruct') {
      const dx = sx - centerX
      const dy = sy - centerY
      const length = Math.max(1, Math.hypot(dx, dy))
      cx += dx / length * Math.min(source.width, source.height) * 0.12
      cy += dy / length * Math.min(source.width, source.height) * 0.12
    } else if (strategy === 'implodeExpand') {
      cx = centerX
      cy = centerY
    } else if (strategy === 'clusteredMorph') {
      const groupCenterX = Math.floor(sx / 4) * 4 + 1.5
      const groupCenterY = Math.floor(sy / 4) * 4 + 1.5
      cx = cx * 0.65 + groupCenterX * 0.35
      cy = cy * 0.65 + groupCenterY * 0.35
    }
    controlX[index] = Math.round(clamp(cx, -32_768, 32_767))
    controlY[index] = Math.round(clamp(cy, -32_768, 32_767))
  }

  const sourceCenterCell = clampCell(
    sourceEvidence.centroidX * Math.max(1, source.width - 1),
    sourceEvidence.centroidY * Math.max(1, source.height - 1),
    source.width,
    source.height,
  )
  const targetCenterCell = clampCell(
    targetEvidence.centroidX * Math.max(1, target.width - 1),
    targetEvidence.centroidY * Math.max(1, target.height - 1),
    target.width,
    target.height,
  )
  const deathTargetIndices = Uint32Array.from(mapping.deathSourceIndices, cell => {
    const x = cell % source.width
    const y = Math.floor(cell / source.width)
    if (strategy === 'disperse' || strategy === 'disperseReconstruct') {
      return clampCell(centerX + (x - centerX) * 1.6, centerY + (y - centerY) * 1.6, source.width, source.height)
    }
    return targetCenterCell
  })
  const birthSourceIndices = Uint32Array.from(mapping.birthTargetIndices, cell => {
    const x = cell % target.width
    const y = Math.floor(cell / target.width)
    if (strategy === 'assemble' || strategy === 'disperseReconstruct') {
      return clampCell(centerX + (x - centerX) * 0.25, centerY + (y - centerY) * 0.25, target.width, target.height)
    }
    return sourceCenterCell
  })
  return { controlX, controlY, stagger, groupIds, deathTargetIndices, birthSourceIndices }
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
    mode = 'pixelDissolve'
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
  const selectedStrategy = mode === 'pixelTransport'
    ? input.settings.preferredStrategy && input.settings.preferredStrategy !== 'automatic'
      ? { strategy: input.settings.preferredStrategy, reason: 'declarative-motion-profile' }
      : selectTransportStrategy(input.source, input.target, automatic.sourceEvidence, automatic.targetEvidence)
    : null
  const motion = selectedStrategy
    ? compileMotionData({
        source: input.source,
        target: input.target,
        sourceEvidence: automatic.sourceEvidence,
        targetEvidence: automatic.targetEvidence,
        mapping,
        strategy: selectedStrategy.strategy,
      })
    : {
        controlX: new Int16Array(),
        controlY: new Int16Array(),
        stagger: new Uint8Array(),
        groupIds: new Uint16Array(),
        deathTargetIndices: new Uint32Array(),
        birthSourceIndices: new Uint32Array(),
      }

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
    strategy: selectedStrategy?.strategy ?? null,
    strategyReason: selectedStrategy?.reason ?? null,
    sourceRegionCount: automatic.sourceEvidence.components.length,
    targetRegionCount: automatic.targetEvidence.components.length,
  }
  const approximateBytes = mapping.matchedSourceIndices.byteLength
    + mapping.matchedTargetIndices.byteLength
    + mapping.deathSourceIndices.byteLength
    + mapping.birthTargetIndices.byteLength
    + motion.controlX.byteLength
    + motion.controlY.byteLength
    + motion.stagger.byteLength
    + motion.groupIds.byteLength
    + motion.deathTargetIndices.byteLength
    + motion.birthSourceIndices.byteLength
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
    matchedControlX: motion.controlX,
    matchedControlY: motion.controlY,
    matchedStagger: motion.stagger,
    matchedGroupIds: motion.groupIds,
    deathTargetIndices: motion.deathTargetIndices,
    birthSourceIndices: motion.birthSourceIndices,
    strategy: selectedStrategy?.strategy ?? null,
    strategyReason: selectedStrategy?.reason ?? null,
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
