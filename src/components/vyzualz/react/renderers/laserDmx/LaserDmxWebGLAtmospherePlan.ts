import type { LaserDmxShowDirectorWebGLQuality } from '../../ReactTypes'
import type {
  LaserDmxSceneAtmosphereSource,
  LaserDmxSceneBeam,
  LaserDmxSceneColor,
  LaserDmxSceneFrame,
  LaserDmxSceneVec3,
} from './LaserDmxSceneFrame'
import {
  resolveLaserDmxDepthQualityPolicy,
  resolveLaserDmxDepthSliceIndex,
  splitLaserDmxDepthInterval,
  type LaserDmxDepthMode,
  type LaserDmxDepthQualityPolicy,
} from './LaserDmxDepthCompositing'
import { clipLaserDmxSceneSegment, projectLaserDmxScenePoint } from './LaserDmxSpatialModel'
import { resolveLaserDmxAtmosphereFlutter } from './LaserDmxTemporalOptics'
import type { LaserDmxWebGLViewport } from './LaserDmxWebGLBeamPlan'
import { wavelengthScatterResponse } from './LaserDmxColorScience'
import {
  aggregateLaserDmxScannerExposureSegments,
  buildLaserDmxScannerExposurePlan,
  resolveLaserDmxScannerExposureDensity,
} from './LaserDmxScannerWebGLPlan'

export interface LaserDmxWebGLAtmosphereQualityPolicy {
  resolutionScale: number
  sampleCount: number
  noiseOctaves: number
  maxBeamInstances: number
  maxRenderedSegments: number
  maxHazeSources: number
  foregroundStrength: number
  extinction: number
}

export interface LaserDmxWebGLAtmosphereBeamInstance {
  id: string
  sourceId: string
  origin: LaserDmxSceneVec3
  target: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  intensity: number
  startWidthCssPx: number
  endWidthCssPx: number
  depthWeight: number
  extinctionWeight: number
  phase: number
  depthSlice: number
  segmentT0: number
  segmentT1: number
  viewPhase: number
  wavelengthResponse: number
}

export interface LaserDmxWebGLAtmosphereSourceInstance {
  id: string
  kind: 'haze' | 'co2'
  position: LaserDmxSceneVec3
  direction: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  density: number
  spread: number
  dissipation: number
  ageSec: number
  lifetimeSec: number
  expansion: number
  turbulence: number
  depthSlice: number
}

export interface LaserDmxWebGLAtmosphereRenderPlan {
  enabled: boolean
  quality: LaserDmxShowDirectorWebGLQuality
  targetWidth: number
  targetHeight: number
  sampleCount: number
  noiseOctaves: number
  deterministicTimeSec: number
  deterministicSeed: number
  baselineDensity: number
  opacity: number
  beamScatter: number
  turbulence: number
  noiseScale: number
  driftSpeed: number
  driftDirection: number
  diffusion: number
  dissipation: number
  colorAbsorption: number
  foregroundStrength: number
  extinction: number
  depthMode: LaserDmxDepthMode
  depthPolicy: LaserDmxDepthQualityPolicy
  sliceCount: number
  sliceCenters: number[]
  beams: LaserDmxWebGLAtmosphereBeamInstance[]
  sources: LaserDmxWebGLAtmosphereSourceInstance[]
  requestedBeamCount: number
  renderedSegmentCount: number
  degraded: boolean
  geometryMode: 'depthSlicedBeamVolumes'
  createsVenueGeometry: false
}

const QUALITY_POLICIES: Readonly<Record<LaserDmxShowDirectorWebGLQuality, LaserDmxWebGLAtmosphereQualityPolicy>> = Object.freeze({
  low: {
    resolutionScale: 0.25,
    sampleCount: 2,
    noiseOctaves: 2,
    maxBeamInstances: 96,
    maxRenderedSegments: 180,
    maxHazeSources: 4,
    foregroundStrength: 0.08,
    extinction: 0.68,
  },
  medium: {
    resolutionScale: 0.5,
    sampleCount: 3,
    noiseOctaves: 3,
    maxBeamInstances: 160,
    maxRenderedSegments: 420,
    maxHazeSources: 6,
    foregroundStrength: 0.14,
    extinction: 0.92,
  },
  high: {
    resolutionScale: 0.68,
    sampleCount: 5,
    noiseOctaves: 4,
    maxBeamInstances: 240,
    maxRenderedSegments: 760,
    maxHazeSources: 8,
    foregroundStrength: 0.2,
    extinction: 1.12,
  },
  ultra: {
    resolutionScale: 0.78,
    sampleCount: 6,
    noiseOctaves: 4,
    maxBeamInstances: 300,
    maxRenderedSegments: 1080,
    maxHazeSources: 8,
    foregroundStrength: 0.24,
    extinction: 1.28,
  },
  auto: {
    resolutionScale: 0.5,
    sampleCount: 4,
    noiseOctaves: 3,
    maxBeamInstances: 192,
    maxRenderedSegments: 480,
    maxHazeSources: 6,
    foregroundStrength: 0.16,
    extinction: 0.98,
  },
})

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function resolveLaserDmxAtmosphereQualityPolicy(
  quality: LaserDmxShowDirectorWebGLQuality,
): LaserDmxWebGLAtmosphereQualityPolicy {
  return QUALITY_POLICIES[quality]
}

export function resolveLaserDmxAtmosphereTargetSize(
  backingWidth: number,
  backingHeight: number,
  quality: LaserDmxShowDirectorWebGLQuality,
): { width: number; height: number } {
  const policy = resolveLaserDmxAtmosphereQualityPolicy(quality)
  return {
    width: Math.max(32, Math.round(Math.max(1, backingWidth) * policy.resolutionScale)),
    height: Math.max(18, Math.round(Math.max(1, backingHeight) * policy.resolutionScale)),
  }
}

/** Atmospheric motion is sampled from canonical transport time. */
export function resolveLaserDmxDeterministicAtmosphereTime(frame: Pick<LaserDmxSceneFrame, 'transport'>): number {
  return Math.max(0, Number.isFinite(frame.transport.audioTimeSec) ? frame.transport.audioTimeSec : 0)
}

function stableBeamSort(a: LaserDmxSceneBeam, b: LaserDmxSceneBeam): number {
  return (a.priority - b.priority)
    || (b.intensity - a.intensity)
    || Math.abs(a.sortDepth) - Math.abs(b.sortDepth)
    || a.sourceId.localeCompare(b.sourceId)
    || a.id.localeCompare(b.id)
}

function selectAtmosphereBeams(
  beams: readonly LaserDmxSceneBeam[],
  limit: number,
): LaserDmxSceneBeam[] {
  const ordered = [...beams].sort(stableBeamSort)
  if (ordered.length <= limit) return ordered
  const selected: LaserDmxSceneBeam[] = []
  const selectedIds = new Set<string>()
  const representedSources = new Set<string>()
  for (const beam of ordered) {
    if (representedSources.has(beam.sourceId)) continue
    selected.push(beam)
    selectedIds.add(beam.id)
    representedSources.add(beam.sourceId)
    if (selected.length >= limit) return selected.sort(stableBeamSort)
  }
  for (const beam of ordered) {
    if (selected.length >= limit) break
    if (selectedIds.has(beam.id)) continue
    selected.push(beam)
    selectedIds.add(beam.id)
  }
  return selected.sort(stableBeamSort)
}


function normalizeVector(value: LaserDmxSceneVec3): LaserDmxSceneVec3 {
  const length = Math.hypot(value.x, value.y, value.z)
  return length > 1e-8 ? { x: value.x / length, y: value.y / length, z: value.z / length } : { x: 0, y: 0, z: 1 }
}

/** Bounded Henyey-Greenstein approximation normalized for concert haze. */
export function resolveLaserDmxViewSensitiveScatter(
  beamOrigin: LaserDmxSceneVec3,
  beamTarget: LaserDmxSceneVec3,
  cameraPosition: LaserDmxSceneVec3,
  anisotropy = 0.58,
): number {
  const direction = normalizeVector({
    x: beamTarget.x - beamOrigin.x,
    y: beamTarget.y - beamOrigin.y,
    z: beamTarget.z - beamOrigin.z,
  })
  const midpoint = {
    x: (beamOrigin.x + beamTarget.x) * 0.5,
    y: (beamOrigin.y + beamTarget.y) * 0.5,
    z: (beamOrigin.z + beamTarget.z) * 0.5,
  }
  const toCamera = normalizeVector({
    x: cameraPosition.x - midpoint.x,
    y: cameraPosition.y - midpoint.y,
    z: cameraPosition.z - midpoint.z,
  })
  const cosine = clamp(direction.x * toCamera.x + direction.y * toCamera.y + direction.z * toCamera.z, -1, 1)
  const g = clamp(anisotropy, 0, 0.82)
  const denominator = Math.pow(Math.max(0.06, 1 + g * g - 2 * g * cosine), 1.5)
  const phase = (1 - g * g) / denominator
  return clamp(phase * 0.34, 0.34, 2.35)
}

function localAtmosphereDensity(frame: LaserDmxSceneFrame, midpoint: LaserDmxSceneVec3): number {
  let density = frame.atmosphere.baselineDensity
  for (const source of frame.atmosphereSources) {
    if (!source.enabled || source.density <= 0.001) continue
    const distance = Math.hypot(
      midpoint.x - source.position.x,
      midpoint.y - source.position.y,
      midpoint.z - source.position.z,
    )
    const radius = Math.max(0.04, source.spread * (source.kind === 'co2' ? 0.7 + source.expansion : 1))
    density += source.density * Math.exp(-(distance * distance) / (radius * radius))
  }
  return clamp(density, 0, 1.6)
}

function depthScatterWeight(depth: number): number {
  const midLift = 1 - Math.min(1, Math.abs(depth) / 0.95)
  const rearLift = clamp01((-depth + 0.15) / 1.15)
  const frontReduction = clamp01((depth - 0.2) / 0.8)
  return clamp(0.58 + midLift * 0.42 + rearLift * 0.12 - frontReduction * 0.18, 0.42, 1.12)
}

function projectAtmosphereSource(
  frame: LaserDmxSceneFrame,
  source: LaserDmxSceneAtmosphereSource,
  aspectRatio: number,
  depthPolicy: LaserDmxDepthQualityPolicy,
): LaserDmxWebGLAtmosphereSourceInstance | null {
  const projected = projectLaserDmxScenePoint(frame.camera, source.position, aspectRatio)
  if (!projected.visible) return null
  const projectedDirectionPoint = projectLaserDmxScenePoint(frame.camera, {
    x: source.position.x + source.direction.x * 0.08,
    y: source.position.y + source.direction.y * 0.08,
    z: source.position.z + source.direction.z * 0.08,
  }, aspectRatio)
  const projectedDirectionLength = Math.hypot(
    projectedDirectionPoint.x - projected.x,
    projectedDirectionPoint.y - projected.y,
  )
  const projectedDirection = projectedDirectionLength > 1e-6
    ? {
        x: (projectedDirectionPoint.x - projected.x) / projectedDirectionLength,
        y: (projectedDirectionPoint.y - projected.y) / projectedDirectionLength,
        z: source.direction.z,
      }
    : { x: 0, y: -1, z: source.direction.z }
  return {
    id: source.id,
    kind: source.kind,
    position: { x: projected.x, y: projected.y, z: projected.clipDepth },
    direction: projectedDirection,
    color: source.color,
    density: clamp01(source.density),
    spread: clamp(source.spread, 0.02, 1.5),
    dissipation: clamp01(source.dissipation),
    ageSec: Math.max(0, source.ageSec),
    lifetimeSec: Number.isFinite(source.lifetimeSec) ? Math.max(0.001, source.lifetimeSec) : 1_000_000,
    expansion: clamp01(source.expansion),
    turbulence: clamp01(source.turbulence),
    depthSlice: resolveLaserDmxDepthSliceIndex(projected.clipDepth, depthPolicy.sliceCount),
  }
}

export function buildLaserDmxWebGLAtmosphereRenderPlan(
  frame: LaserDmxSceneFrame,
  viewport: LaserDmxWebGLViewport,
  continuousDepthAvailable = true,
): LaserDmxWebGLAtmosphereRenderPlan {
  const quality = frame.atmosphere.qualityTier
  const scannerPlan = buildLaserDmxScannerExposurePlan(frame)
  const scannerFixtureIds = new Set(scannerPlan.validation.authoritativeFixtureIds)
  const policy = resolveLaserDmxAtmosphereQualityPolicy(quality)
  const depthPolicy = resolveLaserDmxDepthQualityPolicy(quality, continuousDepthAvailable)
  const flutter = resolveLaserDmxAtmosphereFlutter(frame)
  const target = resolveLaserDmxAtmosphereTargetSize(viewport.backingWidth, viewport.backingHeight, quality)
  const aspect = Math.max(0.5, viewport.backingWidth / Math.max(1, viewport.backingHeight))
  const clippedByBeamId = new Map<string, ReturnType<typeof clipLaserDmxSceneSegment>>()
  const visible = frame.beams.filter(beam => {
    if (!beam.enabled || beam.intensity <= 0.001 || beam.fixtureKind !== 'laser') return false
    if (scannerFixtureIds.has(beam.fixtureId)) return false
    const clipped = clipLaserDmxSceneSegment(frame.camera, beam.origin, beam.target)
    if (!clipped) return false
    clippedByBeamId.set(beam.id, clipped)
    return true
  })
  const selected = selectAtmosphereBeams(visible, policy.maxBeamInstances)
  const atmosphereResponseByFixtureId = new Map(frame.fixtures.map(fixture => [fixture.id, fixture.optics.atmosphereResponse] as const))
  const beams: LaserDmxWebGLAtmosphereBeamInstance[] = []

  outer: for (const beam of selected) {
    const clipped = clippedByBeamId.get(beam.id)!
    const origin = projectLaserDmxScenePoint(frame.camera, clipped.origin, aspect)
    const targetPoint = projectLaserDmxScenePoint(frame.camera, clipped.target, aspect)
    const globalWidth = clamp(frame.output.globalBeamWidth, 0.1, 6)
    const base = clamp((1.2 + beam.width * 1.8) * globalWidth, 1.5, 18)
    const depthScale = clamp((origin.perspectiveScale + targetPoint.perspectiveScale) * 0.5, 0.82, 1.22)
    const atmosphereWidth = clamp(
      base * depthScale * (1.6 + beam.scatterEnvelopeWidth * 1.2 + frame.atmosphere.diffusion * 1.4),
      5,
      92,
    )
    const startWidth = atmosphereWidth * (0.52 + frame.atmosphere.turbulence * 0.12)
    const endWidth = atmosphereWidth * (0.88 + beam.divergence * 0.7)
    const segments = splitLaserDmxDepthInterval(origin.clipDepth, targetPoint.clipDepth, depthPolicy)
    for (let index = 0; index < segments.length; index += 1) {
      if (beams.length >= policy.maxRenderedSegments) break outer
      const segment = segments[index]!
      const seam = 0.0012
      const t0 = clamp(segment.t0 - (index > 0 ? seam : 0), 0, 1)
      const t1 = clamp(segment.t1 + (index < segments.length - 1 ? seam : 0), 0, 1)
      const depthWeight = depthScatterWeight(segment.centerDepth)
      const worldMidpoint = {
        x: lerp(clipped.origin.x, clipped.target.x, (t0 + t1) * 0.5),
        y: lerp(clipped.origin.y, clipped.target.y, (t0 + t1) * 0.5),
        z: lerp(clipped.origin.z, clipped.target.z, (t0 + t1) * 0.5),
      }
      const viewPhase = resolveLaserDmxViewSensitiveScatter(clipped.origin, clipped.target, frame.camera.position)
      const densityResponse = 0.35 + localAtmosphereDensity(frame, worldMidpoint) * 0.65
      beams.push({
        id: `${beam.id}-atmosphere-d${index + 1}`,
        sourceId: beam.sourceId,
        origin: { x: lerp(origin.x, targetPoint.x, t0), y: lerp(origin.y, targetPoint.y, t0), z: lerp(origin.clipDepth, targetPoint.clipDepth, t0) },
        target: { x: lerp(origin.x, targetPoint.x, t1), y: lerp(origin.y, targetPoint.y, t1), z: lerp(origin.clipDepth, targetPoint.clipDepth, t1) },
        color: beam.color,
        intensity: clamp(
          beam.intensity
            * beam.opacity
            * frame.atmosphere.beamScatter
            * (0.2 + (atmosphereResponseByFixtureId.get(beam.fixtureId) ?? 0.78) * 0.8)
            * flutter.intensityMultiplier
            * depthWeight
            * viewPhase
            * densityResponse
            * wavelengthScatterResponse(beam.color),
          0,
          2.5,
        ),
        startWidthCssPx: lerp(startWidth, endWidth, t0),
        endWidthCssPx: lerp(startWidth, endWidth, t1),
        depthWeight,
        extinctionWeight: clamp01(0.36 + (1 - segment.centerDepth) * 0.32),
        phase: beam.pattern.phase,
        depthSlice: segment.sliceIndex,
        segmentT0: segment.t0,
        segmentT1: segment.t1,
        viewPhase,
        wavelengthResponse: wavelengthScatterResponse(beam.color),
      })
    }
  }

  const scannerAtmosphereLimit = Math.max(0, policy.maxBeamInstances - selected.length)
  const selectedScannerSegments = aggregateLaserDmxScannerExposureSegments(
    scannerPlan.segments,
    scannerAtmosphereLimit,
  )
  scannerAtmosphere: for (const scannerSegment of selectedScannerSegments) {
    const fixture = frame.fixtures.find(candidate => candidate.id === scannerSegment.fixtureId)
    if (!fixture?.enabled || fixture.intensity <= 0.001) continue
    const clipped = clipLaserDmxSceneSegment(frame.camera, scannerSegment.origin, scannerSegment.target)
    if (!clipped) continue
    const origin = projectLaserDmxScenePoint(frame.camera, clipped.origin, aspect)
    const targetPoint = projectLaserDmxScenePoint(frame.camera, clipped.target, aspect)
    if (!origin.visible && !targetPoint.visible) continue
    const globalWidth = clamp(frame.output.globalBeamWidth, 0.1, 6)
    const depthScale = clamp((origin.perspectiveScale + targetPoint.perspectiveScale) * 0.5, 0.82, 1.22)
    const geometryWidthResponse = scannerSegment.geometry === 'scanExposure' ? 1.55 : scannerSegment.geometry === 'scanStroke' ? 0.72 : 1
    const motionWidthResponse = scannerSegment.animated
      ? 0.82 + (1 - scannerSegment.velocityRatio) * 0.12
      : 0.94
    const atmosphereWidth = clamp(
      (3.2 + globalWidth * 1.4 + frame.atmosphere.diffusion * 4.8)
        * depthScale
        * geometryWidthResponse
        * motionWidthResponse,
      3,
      34,
    )
    const exposureDensity = resolveLaserDmxScannerExposureDensity(frame, scannerSegment)
    const motionVisibility = scannerSegment.geometry === 'scanExposure'
      ? scannerSegment.animated
        ? 0.48 + (1 - scannerSegment.velocityRatio) * 0.16
        : 0.66
      : scannerSegment.animated
        ? 0.72 + (1 - scannerSegment.velocityRatio) * 0.2
        : 0.94
    const scannerIntensity = clamp(
      exposureDensity
        * fixture.optics.sourceIntensity
        * frame.atmosphere.beamScatter
        * (0.16 + fixture.optics.atmosphereResponse * 0.5)
        * flutter.intensityMultiplier
        * motionVisibility,
      0,
      1.25,
    )
    const depthSegments = splitLaserDmxDepthInterval(origin.clipDepth, targetPoint.clipDepth, depthPolicy)
    for (let index = 0; index < depthSegments.length; index += 1) {
      if (beams.length >= policy.maxRenderedSegments) break scannerAtmosphere
      const segment = depthSegments[index]!
      const seam = 0.0012
      const t0 = clamp(segment.t0 - (index > 0 ? seam : 0), 0, 1)
      const t1 = clamp(segment.t1 + (index < depthSegments.length - 1 ? seam : 0), 0, 1)
      const depthWeight = depthScatterWeight(segment.centerDepth)
      const worldMidpoint = {
        x: lerp(clipped.origin.x, clipped.target.x, (t0 + t1) * 0.5),
        y: lerp(clipped.origin.y, clipped.target.y, (t0 + t1) * 0.5),
        z: lerp(clipped.origin.z, clipped.target.z, (t0 + t1) * 0.5),
      }
      const viewPhase = resolveLaserDmxViewSensitiveScatter(clipped.origin, clipped.target, frame.camera.position)
      const densityResponse = 0.35 + localAtmosphereDensity(frame, worldMidpoint) * 0.65
      beams.push({
        id: `${scannerSegment.id}-atmosphere-d${index + 1}`,
        sourceId: `${scannerSegment.fixtureId}:scanner:${scannerSegment.scannerHeadId}:copy-${scannerSegment.opticalCopyIndex}`,
        origin: {
          x: lerp(origin.x, targetPoint.x, t0),
          y: lerp(origin.y, targetPoint.y, t0),
          z: lerp(origin.clipDepth, targetPoint.clipDepth, t0),
        },
        target: {
          x: lerp(origin.x, targetPoint.x, t1),
          y: lerp(origin.y, targetPoint.y, t1),
          z: lerp(origin.clipDepth, targetPoint.clipDepth, t1),
        },
        color: scannerSegment.color,
        intensity: scannerIntensity * depthWeight * viewPhase * densityResponse * wavelengthScatterResponse(scannerSegment.color),
        startWidthCssPx: atmosphereWidth,
        endWidthCssPx: atmosphereWidth * 1.08,
        depthWeight,
        extinctionWeight: clamp01(0.3 + (1 - segment.centerDepth) * 0.26),
        phase: scannerSegment.opticalCopyIndex * 0.13,
        depthSlice: segment.sliceIndex,
        segmentT0: segment.t0,
        segmentT1: segment.t1,
        viewPhase,
        wavelengthResponse: wavelengthScatterResponse(scannerSegment.color),
      })
    }
  }

  const sources = frame.atmosphereSources
    .filter(source => source.enabled && source.density > 0.001)
    .sort((a, b) => b.density - a.density || a.id.localeCompare(b.id))
    .slice(0, policy.maxHazeSources)
    .map(source => projectAtmosphereSource(frame, source, aspect, depthPolicy))
    .filter((source): source is LaserDmxWebGLAtmosphereSourceInstance => source != null)

  const hasIllumination = beams.some(beam => beam.intensity > 0.001)
    || frame.fixtures.some(fixture => fixture.enabled && fixture.intensity > 0.001 && fixture.kind !== 'haze')
  const enabled = !frame.output.blackout
    && hasIllumination
    && (frame.atmosphere.enabled || frame.atmosphere.baselineDensity > 0.001 || sources.length > 0)
  const sliceCenters = Array.from({ length: depthPolicy.sliceCount }, (_, index) => -1 + (index + 0.5) * (2 / depthPolicy.sliceCount))

  return {
    enabled,
    quality,
    targetWidth: target.width,
    targetHeight: target.height,
    sampleCount: policy.sampleCount,
    noiseOctaves: policy.noiseOctaves,
    deterministicTimeSec: resolveLaserDmxDeterministicAtmosphereTime(frame),
    deterministicSeed: frame.atmosphere.deterministicSeed,
    baselineDensity: clamp(frame.atmosphere.baselineDensity * flutter.densityMultiplier, 0, 0.35),
    opacity: clamp01(frame.atmosphere.opacity),
    beamScatter: clamp01(frame.atmosphere.beamScatter),
    turbulence: clamp01(frame.atmosphere.turbulence),
    noiseScale: clamp(frame.atmosphere.noiseScale, 0.1, 4),
    driftSpeed: clamp01(frame.atmosphere.driftSpeed * flutter.driftMultiplier),
    driftDirection: clamp01(frame.atmosphere.driftDirection),
    diffusion: clamp01(frame.atmosphere.diffusion),
    dissipation: clamp01(frame.atmosphere.dissipation),
    colorAbsorption: clamp01(frame.atmosphere.colorAbsorption),
    foregroundStrength: clamp01(
      policy.foregroundStrength
        * frame.atmosphere.foregroundVeil
        * (0.38 + frame.atmosphere.opacity * 0.62),
    ),
    extinction: policy.extinction,
    depthMode: depthPolicy.mode,
    depthPolicy,
    sliceCount: depthPolicy.sliceCount,
    sliceCenters,
    beams,
    sources,
    requestedBeamCount: visible.length + scannerPlan.segments.length,
    renderedSegmentCount: beams.length,
    degraded: selected.length < visible.length
      || selectedScannerSegments.length < scannerPlan.segments.length
      || beams.length >= policy.maxRenderedSegments,
    geometryMode: 'depthSlicedBeamVolumes',
    createsVenueGeometry: false,
  }
}
