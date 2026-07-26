import type { LaserDmxShowDirectorWebGLQuality } from '../../ReactTypes'
import type {
  LaserDmxExposureSample,
  LaserDmxScanPath,
  LaserDmxScannerPresentationMode,
} from './LaserDmxScannerDomain'
import type {
  LaserDmxSceneColor,
  LaserDmxSceneFrame,
  LaserDmxSceneVec3,
} from './LaserDmxSceneFrame'

export type LaserDmxScannerExposureGeometry = 'scanExposure' | 'scanStroke' | 'intentionalRay' | 'heldRay'

export interface LaserDmxScannerExposureSegment {
  id: string
  scannerHeadId: string
  fixtureId: string
  pathId: string
  opticalCopyIndex: number
  intendedRaySlotId?: string
  rawSampleCount: number
  origin: LaserDmxSceneVec3
  target: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  exposureContribution: number
  intensity: number
  velocityRatio: number
  accelerationRatio: number
  dwellWeight: number
  historyWeight: number
  pointDwell: boolean
  retrace: boolean
  geometry: LaserDmxScannerExposureGeometry
  segmentLength: number
  sampleTimeStart: number
  sampleTimeEnd: number
  cueFrameId?: string
  cueId?: string
  macroId?: string
  stable: boolean
  animated: boolean
}

export interface LaserDmxScannerWebGLInputValidation {
  authoritativeFixtureIds: string[]
  scannerSampleCount: number
  visibleScannerSampleCount: number
  legacyLaserBeamCount: number
  suppressedLegacyBeamIds: string[]
  duplicateFixtureIds: string[]
  blankedBreakCount: number
  retraceBreakCount: number
  invalidSampleCount: number
  rawExposureSampleCount: number
  aggregatedRayCount: number
  energyBeforeAggregation: number
  energyAfterAggregation: number
  normalizedSegmentEnergy: number
  filledWedgeRiskCount: number
}

export interface LaserDmxScannerExposurePlan {
  segments: LaserDmxScannerExposureSegment[]
  validation: LaserDmxScannerWebGLInputValidation
}

const QUALITY_SEGMENT_LIMITS: Readonly<Record<LaserDmxShowDirectorWebGLQuality, number>> = Object.freeze({
  low: 180,
  medium: 360,
  high: 720,
  ultra: 1120,
  auto: 520,
})

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function distance(a: LaserDmxSceneVec3, b: LaserDmxSceneVec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, (b.z - a.z) * 0.7)
}

function finiteVec3(value: LaserDmxSceneVec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function finiteSample(sample: LaserDmxExposureSample): boolean {
  return finiteVec3(sample.origin)
    && finiteVec3(sample.targetOrDirection)
    && Number.isFinite(sample.sampleTime)
    && Number.isFinite(sample.exposureWeight)
    && Number.isFinite(sample.intensity)
    && Number.isFinite(sample.velocityRatio)
}

function sampleEnergy(sample: LaserDmxExposureSample): number {
  return sample.blanked ? 0 : Math.max(0, sample.exposureWeight) * clamp01(sample.intensity)
}

function pathGroupKey(sample: LaserDmxExposureSample): string {
  return `${sample.scannerHeadId}:${sample.pathId}:${sample.opticalCopyIndex}`
}

function stableSampleSort(a: LaserDmxExposureSample, b: LaserDmxExposureSample): number {
  return a.sampleTime - b.sampleTime
    || (a.scannerFramePhase ?? 0) - (b.scannerFramePhase ?? 0)
    || a.pointIndex - b.pointIndex
    || a.fixtureId.localeCompare(b.fixtureId)
    || a.scannerHeadId.localeCompare(b.scannerHeadId)
    || a.opticalCopyIndex - b.opticalCopyIndex
}

function pathById(frame: LaserDmxSceneFrame): ReadonlyMap<string, LaserDmxScanPath> {
  return new Map(frame.scanPaths.map(path => [path.id, path]))
}

function presentationMode(path: LaserDmxScanPath | undefined): LaserDmxScannerPresentationMode {
  if (path?.presentationMode) return path.presentationMode
  if (path?.conversionKind === 'held') return 'heldRay'
  if (path?.conversionKind === 'fan' || path?.conversionKind === 'burst-diffraction') return 'intentionalRays'
  return 'scannedPath'
}

function weightedColor(
  samples: readonly LaserDmxExposureSample[],
): LaserDmxSceneColor {
  const total = samples.reduce((sum, sample) => sum + Math.max(1e-9, sampleEnergy(sample)), 0)
  if (total <= 1e-9) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: clamp01(samples.reduce((sum, sample) => sum + sample.color.r * sampleEnergy(sample), 0) / total),
    g: clamp01(samples.reduce((sum, sample) => sum + sample.color.g * sampleEnergy(sample), 0) / total),
    b: clamp01(samples.reduce((sum, sample) => sum + sample.color.b * sampleEnergy(sample), 0) / total),
    a: clamp01(samples.reduce((sum, sample) => sum + sample.color.a * sampleEnergy(sample), 0) / total),
  }
}

function segmentMetadata(
  sample: LaserDmxExposureSample,
  path: LaserDmxScanPath | undefined,
): Pick<LaserDmxScannerExposureSegment,
  'cueFrameId' | 'cueId' | 'macroId' | 'stable' | 'animated' | 'historyWeight'> {
  const animated = path?.patternAnimationActive === true || path?.fixtureMovementActive === true
  return {
    cueFrameId: sample.cueFrameId ?? path?.cueFrameId,
    cueId: path?.cueId,
    macroId: path?.macroId,
    stable: !animated,
    animated,
    historyWeight: clamp01(sample.historyWeight ?? (animated ? 0.025 : 0.06)),
  }
}

function normalizeSegmentEnergy(
  segments: LaserDmxScannerExposureSegment[],
  targetEnergy: number,
): LaserDmxScannerExposureSegment[] {
  const currentEnergy = segments.reduce((sum, segment) => sum + segment.exposureContribution, 0)
  if (segments.length === 0 || currentEnergy <= 1e-12 || targetEnergy <= 0) return segments
  const scale = targetEnergy / currentEnergy
  return segments.map(segment => ({
    ...segment,
    exposureContribution: Math.max(0, segment.exposureContribution * scale),
  }))
}

function buildIntentionalRaySegments(
  ordered: readonly LaserDmxExposureSample[],
  path: LaserDmxScanPath | undefined,
  mode: Extract<LaserDmxScannerPresentationMode, 'intentionalRays' | 'heldRay'>,
): { segments: LaserDmxScannerExposureSegment[]; blankedBreakCount: number; retraceBreakCount: number } {
  const visibleBySlot = new Map<string, LaserDmxExposureSample[]>()
  let blankedBreakCount = 0
  let retraceBreakCount = 0
  for (const sample of ordered) {
    if (sample.blanked || sample.intensity <= 0 || sample.exposureWeight <= 0) {
      blankedBreakCount += 1
      if (sample.retrace) retraceBreakCount += 1
      continue
    }
    const key = sample.intendedRaySlotId ?? `${sample.pointIndex}:${sample.targetOrDirection.x.toFixed(5)}:${sample.targetOrDirection.y.toFixed(5)}:${sample.targetOrDirection.z.toFixed(5)}`
    const bucket = visibleBySlot.get(key) ?? []
    bucket.push(sample)
    visibleBySlot.set(key, bucket)
  }

  const segments = [...visibleBySlot.entries()].sort(([a], [b]) => a.localeCompare(b)).map((
    [slot, samples],
    index,
  ): LaserDmxScannerExposureSegment => {
    const first = samples[0]!
    const weights = samples.map(sample => Math.max(1e-9, sampleEnergy(sample)))
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    const mean = (selector: (sample: LaserDmxExposureSample) => number): number =>
      samples.reduce((sum, sample, sampleIndex) => sum + selector(sample) * weights[sampleIndex]!, 0) / totalWeight
    const origin = {
      x: mean(sample => sample.origin.x),
      y: mean(sample => sample.origin.y),
      z: mean(sample => sample.origin.z),
    }
    const target = {
      x: mean(sample => sample.targetOrDirection.x),
      y: mean(sample => sample.targetOrDirection.y),
      z: mean(sample => sample.targetOrDirection.z),
    }
    return {
      id: `${first.scannerHeadId}:${first.pathId}:copy-${first.opticalCopyIndex}:${slot || index}`,
      scannerHeadId: first.scannerHeadId,
      fixtureId: first.fixtureId,
      pathId: first.pathId,
      opticalCopyIndex: first.opticalCopyIndex,
      intendedRaySlotId: first.intendedRaySlotId,
      rawSampleCount: samples.reduce((sum, sample) => sum + Math.max(1, sample.sampleCount ?? 1), 0),
      origin,
      target,
      color: weightedColor(samples),
      exposureContribution: samples.reduce((sum, sample) => sum + sampleEnergy(sample), 0),
      intensity: clamp01(mean(sample => sample.intensity)),
      velocityRatio: clamp01(mean(sample => sample.velocityRatio)),
      accelerationRatio: clamp01(mean(sample => sample.accelerationRatio ?? 0)),
      dwellWeight: mean(sample => sample.dwellWeight ?? 1),
      pointDwell: mode === 'heldRay' || samples.some(sample => sample.eventKind === 'dwell'),
      retrace: false,
      geometry: mode === 'heldRay' ? 'heldRay' : 'intentionalRay',
      segmentLength: distance(origin, target),
      sampleTimeStart: Math.min(...samples.map(sample => sample.sampleTime)),
      sampleTimeEnd: Math.max(...samples.map(sample => sample.sampleTime)),
      ...segmentMetadata(first, path),
    }
  })

  return { segments, blankedBreakCount, retraceBreakCount }
}

function buildScannedPathSegments(
  ordered: readonly LaserDmxExposureSample[],
  path: LaserDmxScanPath | undefined,
): { segments: LaserDmxScannerExposureSegment[]; blankedBreakCount: number; retraceBreakCount: number } {
  const visibleRuns: LaserDmxExposureSample[][] = []
  let currentRun: LaserDmxExposureSample[] = []
  let blankedBreakCount = 0
  let retraceBreakCount = 0

  const flushRun = () => {
    if (currentRun.length) visibleRuns.push(currentRun)
    currentRun = []
  }

  for (const sample of ordered) {
    if (sample.blanked || sample.intensity <= 0 || sample.exposureWeight <= 0 || sample.retrace) {
      blankedBreakCount += 1
      if (sample.retrace) retraceBreakCount += 1
      flushRun()
      continue
    }
    currentRun.push(sample)
  }
  flushRun()

  const segments: LaserDmxScannerExposureSegment[] = []
  let ordinal = 0
  for (const run of visibleRuns) {
    const animated = path?.patternAnimationActive === true || path?.fixtureMovementActive === true
    // A scanned circle or polygon is not a self-illuminated outline in mid-air.
    // Integrate the shutter interval into a small number of aperture-origin
    // exposure lobes. Stable frames retain a little more spatial definition;
    // moving frames collapse further so history cannot build spinning cages.
    const bucketCount = Math.max(1, Math.min(run.length, animated ? 2 : 4))
    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
      const bucketStart = Math.floor(bucketIndex * run.length / bucketCount)
      const bucketEnd = Math.max(bucketStart + 1, Math.floor((bucketIndex + 1) * run.length / bucketCount))
      const samples = run.slice(bucketStart, bucketEnd)
      const first = samples[0]!
      const weights = samples.map(sample => Math.max(1e-9, sampleEnergy(sample)))
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
      const mean = (selector: (sample: LaserDmxExposureSample) => number): number =>
        samples.reduce((sum, sample, index) => sum + selector(sample) * weights[index]!, 0) / totalWeight
      const origin = {
        x: mean(sample => sample.origin.x),
        y: mean(sample => sample.origin.y),
        z: mean(sample => sample.origin.z),
      }
      const target = {
        x: mean(sample => sample.targetOrDirection.x),
        y: mean(sample => sample.targetOrDirection.y),
        z: mean(sample => sample.targetOrDirection.z),
      }
      segments.push({
        id: `${first.scannerHeadId}:${first.pathId}:copy-${first.opticalCopyIndex}:exposure-${ordinal++}`,
        scannerHeadId: first.scannerHeadId,
        fixtureId: first.fixtureId,
        pathId: first.pathId,
        opticalCopyIndex: first.opticalCopyIndex,
        intendedRaySlotId: first.intendedRaySlotId,
        rawSampleCount: samples.reduce((sum, sample) => sum + Math.max(1, sample.sampleCount ?? 1), 0),
        origin,
        target,
        color: weightedColor(samples),
        exposureContribution: samples.reduce((sum, sample) => sum + sampleEnergy(sample), 0),
        intensity: clamp01(mean(sample => sample.intensity)),
        velocityRatio: clamp01(mean(sample => sample.velocityRatio)),
        accelerationRatio: clamp01(mean(sample => sample.accelerationRatio ?? 0)),
        dwellWeight: Math.max(...samples.map(sample => sample.dwellWeight ?? 1)),
        pointDwell: samples.some(sample => sample.eventKind === 'dwell'),
        retrace: false,
        geometry: 'scanExposure',
        segmentLength: distance(origin, target),
        sampleTimeStart: Math.min(...samples.map(sample => sample.sampleTime)),
        sampleTimeEnd: Math.max(...samples.map(sample => sample.sampleTime)),
        ...segmentMetadata(first, path),
      })
    }
  }

  if (segments.length === 0) {
    const firstVisible = ordered.find(sample => !sample.blanked && !sample.retrace && sample.intensity > 0 && sample.exposureWeight > 0)
    if (firstVisible) {
      const fallback = buildIntentionalRaySegments([firstVisible], path, 'heldRay')
      return { segments: fallback.segments, blankedBreakCount, retraceBreakCount }
    }
  }

  const visibleEnergy = ordered.reduce((sum, sample) => sum + sampleEnergy(sample), 0)
  return {
    segments: normalizeSegmentEnergy(segments, visibleEnergy),
    blankedBreakCount,
    retraceBreakCount,
  }
}

function buildCanvas2DScannedPathSegments(
  ordered: readonly LaserDmxExposureSample[],
  path: LaserDmxScanPath | undefined,
): { segments: LaserDmxScannerExposureSegment[]; blankedBreakCount: number; retraceBreakCount: number } {
  const segments: LaserDmxScannerExposureSegment[] = []
  let previous: LaserDmxExposureSample | null = null
  let firstVisible: LaserDmxExposureSample | null = null
  let lastVisible: LaserDmxExposureSample | null = null
  let blankedBreakCount = 0
  let retraceBreakCount = 0
  let sawVisibilityBreak = false
  let ordinal = 0

  const appendStroke = (from: LaserDmxExposureSample, to: LaserDmxExposureSample, closing = false) => {
    const segmentLength = distance(from.targetOrDirection, to.targetOrDirection)
    const contribution = (sampleEnergy(from) + sampleEnergy(to)) * 0.5
    if (segmentLength < 1e-6) {
      const previousSegment = segments[segments.length - 1]
      if (previousSegment) {
        previousSegment.exposureContribution += contribution
        previousSegment.pointDwell = true
        previousSegment.dwellWeight = Math.max(previousSegment.dwellWeight, to.dwellWeight ?? 1)
        previousSegment.sampleTimeEnd = Math.max(previousSegment.sampleTimeEnd, to.sampleTime)
      }
      return
    }
    const metadata = segmentMetadata(to, path)
    segments.push({
      id: `${to.scannerHeadId}:${to.pathId}:copy-${to.opticalCopyIndex}:canvas-stroke-${ordinal++}${closing ? '-close' : ''}`,
      scannerHeadId: to.scannerHeadId,
      fixtureId: to.fixtureId,
      pathId: to.pathId,
      opticalCopyIndex: to.opticalCopyIndex,
      intendedRaySlotId: to.intendedRaySlotId,
      rawSampleCount: Math.max(1, from.sampleCount ?? 1) + Math.max(1, to.sampleCount ?? 1),
      origin: { ...from.targetOrDirection },
      target: { ...to.targetOrDirection },
      color: weightedColor([from, to]),
      exposureContribution: contribution,
      intensity: clamp01((from.intensity + to.intensity) * 0.5),
      velocityRatio: clamp01((from.velocityRatio + to.velocityRatio) * 0.5),
      accelerationRatio: clamp01(((from.accelerationRatio ?? 0) + (to.accelerationRatio ?? 0)) * 0.5),
      dwellWeight: Math.max(from.dwellWeight ?? 1, to.dwellWeight ?? 1),
      pointDwell: from.eventKind === 'dwell' || to.eventKind === 'dwell',
      retrace: false,
      geometry: 'scanStroke',
      segmentLength,
      sampleTimeStart: from.sampleTime,
      sampleTimeEnd: closing ? from.sampleTime : to.sampleTime,
      ...metadata,
      // Canvas2D intentionally keeps its established persistence profile. The
      // WebGL scanner exposure correction must not silently dim or erase the
      // compatibility renderer when both backends consume the same cue state.
      historyWeight: Math.max(metadata.historyWeight, metadata.animated ? 0.08 : 0.16),
    })
  }

  for (const sample of ordered) {
    if (sample.blanked || sample.intensity <= 0 || sample.exposureWeight <= 0 || sample.retrace) {
      blankedBreakCount += 1
      if (sample.retrace) retraceBreakCount += 1
      sawVisibilityBreak = true
      previous = null
      continue
    }
    if (!firstVisible) firstVisible = sample
    if (previous) appendStroke(previous, sample)
    previous = sample
    lastVisible = sample
  }

  if (path?.closed && !sawVisibilityBreak && firstVisible && lastVisible && firstVisible !== lastVisible && previous === lastVisible) {
    appendStroke(lastVisible, firstVisible, true)
  }

  if (segments.length === 0 && firstVisible) {
    const fallback = buildIntentionalRaySegments([firstVisible], path, 'heldRay')
    return {
      segments: fallback.segments.map(segment => ({
        ...segment,
        historyWeight: Math.max(segment.historyWeight, segment.animated ? 0.08 : 0.16),
      })),
      blankedBreakCount,
      retraceBreakCount,
    }
  }

  const visibleEnergy = ordered.reduce((sum, sample) => sum + sampleEnergy(sample), 0)
  return {
    segments: normalizeSegmentEnergy(segments, visibleEnergy),
    blankedBreakCount,
    retraceBreakCount,
  }
}

function buildGroupSegments(
  samples: readonly LaserDmxExposureSample[],
  path: LaserDmxScanPath | undefined,
): { segments: LaserDmxScannerExposureSegment[]; blankedBreakCount: number; retraceBreakCount: number } {
  const ordered = [...samples].sort(stableSampleSort)
  const mode = presentationMode(path)
  return mode === 'scannedPath'
    ? buildScannedPathSegments(ordered, path)
    : buildIntentionalRaySegments(ordered, path, mode)
}

function buildCanvas2DGroupSegments(
  samples: readonly LaserDmxExposureSample[],
  path: LaserDmxScanPath | undefined,
): { segments: LaserDmxScannerExposureSegment[]; blankedBreakCount: number; retraceBreakCount: number } {
  const ordered = [...samples].sort(stableSampleSort)
  const mode = presentationMode(path)
  if (mode === 'scannedPath') return buildCanvas2DScannedPathSegments(ordered, path)
  const built = buildIntentionalRaySegments(ordered, path, mode)
  return {
    ...built,
    segments: built.segments.map(segment => ({
      ...segment,
      historyWeight: Math.max(segment.historyWeight, segment.animated ? 0.08 : 0.16),
    })),
  }
}

function scannerSegmentGroupKey(segment: LaserDmxScannerExposureSegment): string {
  return `${segment.scannerHeadId}:${segment.pathId}:${segment.opticalCopyIndex}:${segment.geometry}`
}

function sameScannerPoint(a: LaserDmxSceneVec3, b: LaserDmxSceneVec3): boolean {
  return distance(a, b) <= 1e-5
}

function mergeScannedStrokeBucket(
  bucket: readonly LaserDmxScannerExposureSegment[],
  bucketIndex: number,
): LaserDmxScannerExposureSegment {
  const first = bucket[0]!
  const last = bucket[bucket.length - 1]!
  const weights = bucket.map(segment => Math.max(1e-12, segment.exposureContribution))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const mean = (selector: (segment: LaserDmxScannerExposureSegment) => number): number =>
    bucket.reduce((sum, segment, index) => sum + selector(segment) * weights[index]!, 0) / totalWeight
  return {
    ...first,
    id: `${first.scannerHeadId}:${first.pathId}:copy-${first.opticalCopyIndex}:stroke-bucket-${bucketIndex}`,
    rawSampleCount: bucket.reduce((sum, segment) => sum + segment.rawSampleCount, 0),
    origin: { ...first.origin },
    target: { ...last.target },
    color: {
      r: clamp01(mean(segment => segment.color.r)),
      g: clamp01(mean(segment => segment.color.g)),
      b: clamp01(mean(segment => segment.color.b)),
      a: clamp01(mean(segment => segment.color.a)),
    },
    exposureContribution: bucket.reduce((sum, segment) => sum + segment.exposureContribution, 0),
    intensity: clamp01(mean(segment => segment.intensity)),
    velocityRatio: clamp01(mean(segment => segment.velocityRatio)),
    accelerationRatio: clamp01(mean(segment => segment.accelerationRatio)),
    dwellWeight: Math.max(...bucket.map(segment => segment.dwellWeight)),
    historyWeight: clamp01(mean(segment => segment.historyWeight)),
    pointDwell: bucket.some(segment => segment.pointDwell),
    retrace: false,
    segmentLength: bucket.reduce((sum, segment) => sum + segment.segmentLength, 0),
    sampleTimeStart: first.sampleTimeStart,
    sampleTimeEnd: last.sampleTimeEnd,
    cueFrameId: last.cueFrameId ?? first.cueFrameId,
    cueId: last.cueId ?? first.cueId,
    macroId: last.macroId ?? first.macroId,
    stable: bucket.every(segment => segment.stable),
    animated: bucket.some(segment => segment.animated),
  }
}

function aggregateScannedStrokeGroup(
  group: readonly LaserDmxScannerExposureSegment[],
  limit: number,
): LaserDmxScannerExposureSegment[] {
  if (group.length <= limit) return [...group]
  if (limit <= 0) return []
  return Array.from({ length: limit }, (_, index) => {
    const start = Math.floor(index * group.length / limit)
    const end = Math.max(start + 1, Math.floor((index + 1) * group.length / limit))
    return mergeScannedStrokeBucket(group.slice(start, end), index)
  })
}

function deterministicThin<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items]
  if (limit <= 0) return []
  return Array.from({ length: limit }, (_, index) => {
    const sourceIndex = Math.min(items.length - 1, Math.round(index * (items.length - 1) / Math.max(1, limit - 1)))
    return items[sourceIndex]!
  })
}

function allocateGroupBudgets(
  groups: readonly LaserDmxScannerExposureSegment[][],
  limit: number,
): number[] {
  const budgets = groups.map(() => 0)
  if (limit <= 0 || groups.length === 0) return budgets
  const ranked = groups.map((group, index) => ({
    index,
    energy: group.reduce((sum, segment) => sum + segment.exposureContribution, 0),
    length: group.length,
  })).sort((a, b) => b.energy - a.energy || b.length - a.length || a.index - b.index)
  let remaining = limit
  for (const entry of ranked) {
    if (remaining <= 0) break
    budgets[entry.index] = 1
    remaining -= 1
  }
  while (remaining > 0) {
    let selected = -1
    let selectedScore = -1
    for (let index = 0; index < groups.length; index += 1) {
      if (budgets[index]! >= groups[index]!.length) continue
      const score = groups[index]!.length / Math.max(1, budgets[index]!)
      if (score > selectedScore) {
        selected = index
        selectedScore = score
      }
    }
    if (selected < 0) break
    budgets[selected]! += 1
    remaining -= 1
  }
  return budgets
}

/**
 * Reduces scanner work deterministically while preserving per-path exposure
 * energy. Quality changes therefore alter smoothness, not choreography or total
 * emitted brightness.
 */
export function aggregateLaserDmxScannerExposureSegments(
  segments: readonly LaserDmxScannerExposureSegment[],
  limit: number,
): LaserDmxScannerExposureSegment[] {
  const boundedLimit = Math.max(0, Math.round(limit))
  if (boundedLimit === 0 || segments.length === 0) return []
  if (segments.length <= boundedLimit) return [...segments]

  const grouped = new Map<string, LaserDmxScannerExposureSegment[]>()
  const runIndexByBaseKey = new Map<string, number>()
  const previousStrokeByBaseKey = new Map<string, LaserDmxScannerExposureSegment>()
  for (const segment of [...segments].sort((a, b) => a.sampleTimeStart - b.sampleTimeStart || a.id.localeCompare(b.id))) {
    const baseKey = scannerSegmentGroupKey(segment)
    let key = baseKey
    if (segment.geometry === 'scanStroke') {
      const previous = previousStrokeByBaseKey.get(baseKey)
      let runIndex = runIndexByBaseKey.get(baseKey) ?? -1
      if (!previous || !sameScannerPoint(previous.target, segment.origin)) runIndex += 1
      runIndexByBaseKey.set(baseKey, runIndex)
      previousStrokeByBaseKey.set(baseKey, segment)
      key = `${baseKey}:visible-run-${runIndex}`
    }
    const group = grouped.get(key) ?? []
    group.push(segment)
    grouped.set(key, group)
  }
  const groups = [...grouped.keys()].sort().map(key => grouped.get(key)!)
  const budgets = allocateGroupBudgets(groups, boundedLimit)
  return groups.flatMap((group, index) => {
    const budget = budgets[index]!
    if (group[0]?.geometry === 'scanStroke') {
      return aggregateScannedStrokeGroup(group, budget)
    }
    const selected = deterministicThin(group, budget)
    const originalEnergy = group.reduce((sum, segment) => sum + segment.exposureContribution, 0)
    const selectedEnergy = selected.reduce((sum, segment) => sum + segment.exposureContribution, 0)
    const scale = selectedEnergy > 1e-12 ? originalEnergy / selectedEnergy : 1
    return selected.map(segment => ({
      ...segment,
      exposureContribution: segment.exposureContribution * scale,
    }))
  }).sort((a, b) => a.sampleTimeStart - b.sampleTimeStart || a.id.localeCompare(b.id))
}

type LaserDmxScannerExposurePlanTarget = 'webgl' | 'canvas2dCompatibility'

/**
 * Converts authoritative ordered scanner exposure into either integrated WebGL
 * exposure or the established Canvas2D compatibility strokes. Blanked and
 * retrace travel never reaches renderer geometry in either backend.
 */
function buildLaserDmxScannerExposurePlanForTarget(
  frame: LaserDmxSceneFrame,
  target: LaserDmxScannerExposurePlanTarget,
): LaserDmxScannerExposurePlan {
  const validHeadIds = new Set(frame.scannerHeads.map(head => head.id))
  const validPaths = frame.scanPaths.filter(path => path.validationErrors.length === 0 && validHeadIds.has(path.scannerHeadId))
  const validPathIds = new Set(validPaths.map(path => path.id))
  const authoritativeFixtureIds = [...new Set(validPaths.map(path => path.fixtureId))].sort()
  const authoritativeFixtures = new Set(authoritativeFixtureIds)
  const invalidSamples = frame.exposureSamples.filter(sample => !finiteSample(sample) || !validPathIds.has(sample.pathId))
  const usableSamples = frame.exposureSamples.filter(sample => finiteSample(sample) && validPathIds.has(sample.pathId))
  const groups = new Map<string, LaserDmxExposureSample[]>()
  for (const sample of usableSamples) {
    const key = pathGroupKey(sample)
    const group = groups.get(key) ?? []
    group.push(sample)
    groups.set(key, group)
  }

  const paths = pathById(frame)
  const allSegments: LaserDmxScannerExposureSegment[] = []
  let blankedBreakCount = 0
  let retraceBreakCount = 0
  for (const key of [...groups.keys()].sort()) {
    const group = groups.get(key)!
    const built = target === 'canvas2dCompatibility'
      ? buildCanvas2DGroupSegments(group, paths.get(group[0]!.pathId))
      : buildGroupSegments(group, paths.get(group[0]!.pathId))
    allSegments.push(...built.segments)
    blankedBreakCount += built.blankedBreakCount
    retraceBreakCount += built.retraceBreakCount
  }
  allSegments.sort((a, b) => a.sampleTimeStart - b.sampleTimeStart || a.id.localeCompare(b.id))
  const segments = aggregateLaserDmxScannerExposureSegments(
    allSegments,
    QUALITY_SEGMENT_LIMITS[frame.quality.qualityTier],
  )
  const legacyLaserBeams = frame.beams.filter(beam => beam.fixtureKind === 'laser')
  const suppressedLegacyBeamIds = legacyLaserBeams
    .filter(beam => authoritativeFixtures.has(beam.fixtureId))
    .map(beam => beam.id)
    .sort()
  const duplicateFixtureIds = [...frame.scannerDiagnostics.duplicateRenderingFixtureIds]
  const filledWedgeRiskCount = segments.filter(segment =>
    segment.geometry !== 'scanStroke'
    && segments.filter(candidate => candidate.scannerHeadId === segment.scannerHeadId && candidate.pathId === segment.pathId).length > 18,
  ).length

  return {
    segments,
    validation: {
      authoritativeFixtureIds,
      scannerSampleCount: frame.exposureSamples.length,
      visibleScannerSampleCount: usableSamples.filter(sample => !sample.blanked && sample.intensity > 0 && sample.exposureWeight > 0).length,
      legacyLaserBeamCount: legacyLaserBeams.length,
      suppressedLegacyBeamIds,
      duplicateFixtureIds,
      blankedBreakCount,
      retraceBreakCount,
      invalidSampleCount: invalidSamples.length,
      rawExposureSampleCount: frame.exposureAggregation.rawSampleCount,
      aggregatedRayCount: frame.exposureAggregation.aggregatedRayCount,
      energyBeforeAggregation: frame.exposureAggregation.energyBeforeAggregation,
      energyAfterAggregation: frame.exposureAggregation.energyAfterAggregation,
      normalizedSegmentEnergy: segments.reduce((sum, segment) => sum + segment.exposureContribution, 0),
      filledWedgeRiskCount,
    },
  }
}

export function buildLaserDmxScannerExposurePlan(frame: LaserDmxSceneFrame): LaserDmxScannerExposurePlan {
  return buildLaserDmxScannerExposurePlanForTarget(frame, 'webgl')
}

export function buildLaserDmxCanvas2DCompatibilityExposurePlan(frame: LaserDmxSceneFrame): LaserDmxScannerExposurePlan {
  return buildLaserDmxScannerExposurePlanForTarget(frame, 'canvas2dCompatibility')
}

export function validateLaserDmxWebGLLaserInputs(frame: LaserDmxSceneFrame): LaserDmxScannerWebGLInputValidation {
  return buildLaserDmxScannerExposurePlan(frame).validation
}

export function resolveLaserDmxScannerExposureDensity(
  _frame: LaserDmxSceneFrame,
  segment: LaserDmxScannerExposureSegment,
): number {
  if (segment.exposureContribution <= 0 || segment.intensity <= 0) return 0
  const velocityResponse = 0.82 + (1 - clamp01(segment.velocityRatio)) * 0.26
  const accelerationResponse = 1 - clamp01(segment.accelerationRatio) * 0.08
  const dwellResponse = segment.pointDwell ? clamp(segment.dwellWeight, 1, 1.7) : 1
  if (segment.geometry === 'scanStroke') {
    const energyPerLength = segment.exposureContribution / Math.max(0.0035, segment.segmentLength)
    return clamp(energyPerLength * 0.045 * velocityResponse * accelerationResponse * dwellResponse, 0, 1.2)
  }
  if (segment.geometry === 'scanExposure') {
    return clamp(segment.exposureContribution * 0.58 * velocityResponse * accelerationResponse * dwellResponse, 0, 0.78)
  }
  return clamp(segment.exposureContribution * velocityResponse * accelerationResponse * dwellResponse, 0, 1.35)
}
