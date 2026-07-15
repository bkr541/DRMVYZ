import type { LaserDmxShowDirectorWebGLQuality } from '../../ReactTypes'
import type {
  LaserDmxSceneAtmosphereSource,
  LaserDmxSceneBeam,
  LaserDmxSceneColor,
  LaserDmxSceneFrame,
  LaserDmxSceneVec3,
} from './LaserDmxSceneFrame'
import { laserDmxDepthSegmentVisible, projectLaserDmxScenePoint } from './LaserDmxSpatialModel'
import type { LaserDmxWebGLViewport } from './LaserDmxWebGLBeamPlan'

export interface LaserDmxWebGLAtmosphereQualityPolicy {
  resolutionScale: number
  sampleCount: number
  noiseOctaves: number
  maxBeamInstances: number
  maxHazeSources: number
  foregroundStrength: number
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
  rearVeilWeight: number
  phase: number
}

export interface LaserDmxWebGLAtmosphereSourceInstance {
  id: string
  position: LaserDmxSceneVec3
  direction: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  density: number
  spread: number
  dissipation: number
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
  beams: LaserDmxWebGLAtmosphereBeamInstance[]
  sources: LaserDmxWebGLAtmosphereSourceInstance[]
  requestedBeamCount: number
  degraded: boolean
  geometryMode: 'beamVolumesOnly'
  createsVenueGeometry: false
}

const QUALITY_POLICIES: Readonly<Record<LaserDmxShowDirectorWebGLQuality, LaserDmxWebGLAtmosphereQualityPolicy>> = Object.freeze({
  low: {
    resolutionScale: 0.25,
    sampleCount: 2,
    noiseOctaves: 2,
    maxBeamInstances: 96,
    maxHazeSources: 4,
    foregroundStrength: 0.08,
  },
  medium: {
    resolutionScale: 0.5,
    sampleCount: 3,
    noiseOctaves: 3,
    maxBeamInstances: 160,
    maxHazeSources: 6,
    foregroundStrength: 0.14,
  },
  high: {
    resolutionScale: 0.68,
    sampleCount: 5,
    noiseOctaves: 4,
    maxBeamInstances: 240,
    maxHazeSources: 8,
    foregroundStrength: 0.2,
  },
  ultra: {
    resolutionScale: 0.78,
    sampleCount: 6,
    noiseOctaves: 4,
    maxBeamInstances: 300,
    maxHazeSources: 8,
    foregroundStrength: 0.24,
  },
  auto: {
    resolutionScale: 0.5,
    sampleCount: 4,
    noiseOctaves: 3,
    maxBeamInstances: 192,
    maxHazeSources: 6,
    foregroundStrength: 0.16,
  },
})

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
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

/**
 * Atmospheric motion is sampled from canonical transport time, never from a
 * frame accumulator. Seeking to the same point therefore recreates the same
 * density field and pausing freezes it without special temporal state.
 */
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

function depthScatterWeight(sortDepth: number): number {
  // Mid-air carries the most obvious volume. Near-camera rays remain dominant
  // through their sharp pass, while deep rays receive a softer atmospheric lift.
  const midLift = 1 - Math.min(1, Math.abs(sortDepth) / 0.95)
  const rearLift = clamp01((-sortDepth + 0.15) / 1.15)
  const frontReduction = clamp01((sortDepth - 0.2) / 0.8)
  return clamp(0.58 + midLift * 0.42 + rearLift * 0.12 - frontReduction * 0.18, 0.42, 1.12)
}

function rearVeilWeight(sortDepth: number): number {
  return clamp01((0.3 - sortDepth) / 1.15)
}

function projectAtmosphereSource(
  frame: LaserDmxSceneFrame,
  source: LaserDmxSceneAtmosphereSource,
): LaserDmxWebGLAtmosphereSourceInstance {
  const projected = projectLaserDmxScenePoint(frame.camera, source.position)
  return {
    id: source.id,
    position: { x: projected.x, y: projected.y, z: projected.clipDepth },
    direction: source.direction,
    color: source.color,
    density: clamp01(source.density),
    spread: clamp(source.spread, 0.02, 1.5),
    dissipation: clamp01(source.dissipation),
  }
}

export function buildLaserDmxWebGLAtmosphereRenderPlan(
  frame: LaserDmxSceneFrame,
  viewport: LaserDmxWebGLViewport,
): LaserDmxWebGLAtmosphereRenderPlan {
  const quality = frame.atmosphere.qualityTier
  const policy = resolveLaserDmxAtmosphereQualityPolicy(quality)
  const target = resolveLaserDmxAtmosphereTargetSize(viewport.backingWidth, viewport.backingHeight, quality)
  const visible = frame.beams.filter(beam => (
    beam.enabled
    && beam.intensity > 0.001
    && laserDmxDepthSegmentVisible(frame.camera, beam.depthRange.minZ, beam.depthRange.maxZ)
  ))
  const selected = selectAtmosphereBeams(visible, policy.maxBeamInstances)
  const beams = selected.map((beam): LaserDmxWebGLAtmosphereBeamInstance => {
    const origin = projectLaserDmxScenePoint(frame.camera, beam.origin)
    const targetPoint = projectLaserDmxScenePoint(frame.camera, beam.target)
    const globalWidth = clamp(frame.output.globalBeamWidth, 0.1, 6)
    const base = clamp((1.2 + beam.width * 1.8) * globalWidth, 1.5, 18)
    const atmosphereWidth = clamp(
      base * (1.6 + beam.scatterEnvelopeWidth * 1.2 + frame.atmosphere.diffusion * 1.4),
      5,
      92,
    )
    return {
      id: beam.id,
      sourceId: beam.sourceId,
      origin: { x: origin.x, y: origin.y, z: origin.clipDepth },
      target: { x: targetPoint.x, y: targetPoint.y, z: targetPoint.clipDepth },
      color: beam.color,
      intensity: clamp(
        beam.intensity
          * beam.opacity
          * frame.atmosphere.beamScatter
          * depthScatterWeight(beam.sortDepth),
        0,
        2.5,
      ),
      startWidthCssPx: atmosphereWidth * (0.52 + frame.atmosphere.turbulence * 0.12),
      endWidthCssPx: atmosphereWidth * (0.88 + beam.divergence * 0.7),
      depthWeight: depthScatterWeight(beam.sortDepth),
      rearVeilWeight: rearVeilWeight(beam.sortDepth),
      phase: beam.pattern.phase,
    }
  })

  const sources = frame.atmosphereSources
    .filter(source => source.enabled && source.density > 0.001)
    .sort((a, b) => b.density - a.density || a.id.localeCompare(b.id))
    .slice(0, policy.maxHazeSources)
    .map(source => projectAtmosphereSource(frame, source))

  const hasIllumination = beams.some(beam => beam.intensity > 0.001)
  const enabled = !frame.output.blackout
    && hasIllumination
    && (frame.atmosphere.enabled || frame.atmosphere.baselineDensity > 0.001 || sources.length > 0)

  return {
    enabled,
    quality,
    targetWidth: target.width,
    targetHeight: target.height,
    sampleCount: policy.sampleCount,
    noiseOctaves: policy.noiseOctaves,
    deterministicTimeSec: resolveLaserDmxDeterministicAtmosphereTime(frame),
    deterministicSeed: frame.atmosphere.deterministicSeed,
    baselineDensity: clamp(frame.atmosphere.baselineDensity, 0, 0.35),
    opacity: clamp01(frame.atmosphere.opacity),
    beamScatter: clamp01(frame.atmosphere.beamScatter),
    turbulence: clamp01(frame.atmosphere.turbulence),
    noiseScale: clamp(frame.atmosphere.noiseScale, 0.1, 4),
    driftSpeed: clamp01(frame.atmosphere.driftSpeed),
    driftDirection: clamp01(frame.atmosphere.driftDirection),
    diffusion: clamp01(frame.atmosphere.diffusion),
    dissipation: clamp01(frame.atmosphere.dissipation),
    colorAbsorption: clamp01(frame.atmosphere.colorAbsorption),
    foregroundStrength: clamp01(
      policy.foregroundStrength
        * frame.atmosphere.foregroundVeil
        * (0.38 + frame.atmosphere.opacity * 0.62),
    ),
    beams,
    sources,
    requestedBeamCount: visible.length,
    degraded: selected.length < visible.length,
    geometryMode: 'beamVolumesOnly',
    createsVenueGeometry: false,
  }
}
