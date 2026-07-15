import type { LaserDmxShowDirectorWebGLQuality } from '../../ReactTypes'
import {
  LASER_DMX_VISUAL_ROLE_PRIORITY,
  resolveLaserDmxWhiteHotMix,
} from './LaserDmxBeamOptics'
import type {
  LaserDmxSceneBeam,
  LaserDmxSceneColor,
  LaserDmxSceneFrame,
  LaserDmxSceneVec3,
} from './LaserDmxSceneFrame'
import { laserDmxDepthSegmentVisible, projectLaserDmxScenePoint } from './LaserDmxSpatialModel'

export interface LaserDmxWebGLViewport {
  backingWidth: number
  backingHeight: number
  cssWidth: number
  cssHeight: number
}

export interface LaserDmxWebGLBeamInstance {
  id: string
  sourceId: string
  origin: LaserDmxSceneVec3
  target: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  intensity: number
  coreIntensity: number
  whiteHotMix: number
  opacity: number
  bodyStartWidthCssPx: number
  bodyEndWidthCssPx: number
  envelopeStartWidthCssPx: number
  envelopeEndWidthCssPx: number
  envelopeAlpha: number
  phase: number
  sortDepth: number
}

export interface LaserDmxWebGLApertureInstance {
  id: string
  position: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  intensity: number
  totalActiveEnergy: number
  coreRadiusCssPx: number
  ringRadiusCssPx: number
  haloRadiusCssPx: number
  glareDirection: { x: number; y: number }
  sortDepth: number
}

export interface LaserDmxWebGLBeamRenderPlan {
  beams: LaserDmxWebGLBeamInstance[]
  apertures: LaserDmxWebGLApertureInstance[]
  envelopeComplexity: number
  requestedBeamCount: number
  renderedBeamCount: number
  degraded: boolean
}

interface LaserDmxWebGLQualityPolicy {
  maxBeamInstances: number
  envelopeComplexity: number
}

const QUALITY_POLICIES: Readonly<Record<LaserDmxShowDirectorWebGLQuality, LaserDmxWebGLQualityPolicy>> = Object.freeze({
  low: { maxBeamInstances: 220, envelopeComplexity: 0.46 },
  medium: { maxBeamInstances: 260, envelopeComplexity: 0.68 },
  high: { maxBeamInstances: 300, envelopeComplexity: 0.9 },
  ultra: { maxBeamInstances: 300, envelopeComplexity: 1 },
  auto: { maxBeamInstances: 280, envelopeComplexity: 0.82 },
})

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function stableBeamSort(a: LaserDmxSceneBeam, b: LaserDmxSceneBeam): number {
  return (a.priority - b.priority)
    || (LASER_DMX_VISUAL_ROLE_PRIORITY[a.visualRole] - LASER_DMX_VISUAL_ROLE_PRIORITY[b.visualRole])
    || (a.sortDepth - b.sortDepth)
    || a.sourceId.localeCompare(b.sourceId)
    || (a.pattern.rayIndex - b.pattern.rayIndex)
    || a.id.localeCompare(b.id)
}

/**
 * Quality degradation keeps hero/primary geometry and at least one ray from
 * every represented source before thinning secondary/texture support rays.
 */
export function selectLaserDmxBeamsForQuality(
  beams: readonly LaserDmxSceneBeam[],
  quality: LaserDmxShowDirectorWebGLQuality,
  maxOverride?: number,
): LaserDmxSceneBeam[] {
  const limit = Math.max(0, Math.min(300, Math.round(maxOverride ?? QUALITY_POLICIES[quality].maxBeamInstances)))
  const ordered = [...beams].sort(stableBeamSort)
  if (ordered.length <= limit) return ordered
  if (limit === 0) return []

  const selected = new Map<string, LaserDmxSceneBeam>()
  const firstBySource = new Map<string, LaserDmxSceneBeam>()
  for (const beam of ordered) {
    if (!firstBySource.has(beam.sourceId)) firstBySource.set(beam.sourceId, beam)
  }
  for (const beam of [...firstBySource.values()].sort(stableBeamSort)) {
    if (selected.size >= limit) break
    selected.set(beam.id, beam)
  }
  for (const beam of ordered) {
    if (selected.size >= limit) break
    selected.set(beam.id, beam)
  }
  return [...selected.values()].sort(stableBeamSort)
}

function projectedDirection(direction: LaserDmxSceneVec3, viewport: LaserDmxWebGLViewport): { x: number; y: number } {
  const x = direction.x * Math.max(1, viewport.backingWidth)
  const y = direction.y * Math.max(1, viewport.backingHeight)
  const length = Math.hypot(x, y)
  return length > 1e-5 ? { x: x / length, y: y / length } : { x: 1, y: 0 }
}

export function buildLaserDmxWebGLBeamRenderPlan(
  frame: LaserDmxSceneFrame,
  viewport: LaserDmxWebGLViewport,
  maxBeamOverride?: number,
): LaserDmxWebGLBeamRenderPlan {
  const policy = QUALITY_POLICIES[frame.quality.qualityTier]
  const visible = frame.beams.filter(beam => (
    beam.enabled
    && beam.intensity > 0.001
    && laserDmxDepthSegmentVisible(frame.camera, beam.depthRange.minZ, beam.depthRange.maxZ)
  ))
  const selected = selectLaserDmxBeamsForQuality(visible, frame.quality.qualityTier, maxBeamOverride)
  const atmosphere = frame.atmosphere.enabled
    ? clamp01(frame.atmosphere.opacity * 0.48 + frame.atmosphere.beamScatter * 0.52)
    : 0
  const globalWidth = clamp(frame.output.globalBeamWidth, 0.1, 6)
  const glow = clamp01(frame.output.globalGlow)

  const beams = selected.map((beam): LaserDmxWebGLBeamInstance => {
    const origin = projectLaserDmxScenePoint(frame.camera, beam.origin)
    const target = projectLaserDmxScenePoint(frame.camera, beam.target)
    const distanceFactor = clamp01(beam.length / 1.35)
    const focusTightening = 0.82 + clamp01(beam.focus) * 0.18
    const baseWidth = clamp((0.42 + beam.width * 0.58) * globalWidth * focusTightening, 0.35, 9)
    const bodyStartWidthCssPx = baseWidth
    const bodyEndWidthCssPx = clamp(
      baseWidth * (1 + beam.divergence * 0.2 + distanceFactor * 0.07),
      baseWidth,
      baseWidth * 1.38,
    )
    const scatterBase = baseWidth * beam.scatterEnvelopeWidth
    const envelopeStartWidthCssPx = clamp(scatterBase * (0.42 + atmosphere * 0.12), baseWidth * 1.45, 32)
    const envelopeEndWidthCssPx = clamp(
      scatterBase * (0.66 + beam.divergence * 0.72 + distanceFactor * 0.28 + atmosphere * 0.24),
      envelopeStartWidthCssPx,
      48,
    )
    const intensity = clamp(beam.intensity * (0.72 + glow * 0.62), 0, 2.4)
    return {
      id: beam.id,
      sourceId: beam.sourceId,
      origin: { x: origin.x, y: origin.y, z: origin.clipDepth },
      target: { x: target.x, y: target.y, z: target.clipDepth },
      color: beam.color,
      intensity,
      coreIntensity: beam.coreIntensity,
      whiteHotMix: resolveLaserDmxWhiteHotMix(beam.intensity, beam.coreIntensity),
      opacity: beam.opacity,
      bodyStartWidthCssPx,
      bodyEndWidthCssPx,
      envelopeStartWidthCssPx,
      envelopeEndWidthCssPx,
      envelopeAlpha: clamp(
        (0.055 + atmosphere * 0.17 + glow * 0.08) * beam.opacity * policy.envelopeComplexity,
        0.015,
        0.32,
      ),
      phase: beam.pattern.phase,
      sortDepth: beam.sortDepth,
    }
  })

  const activeSourceIds = new Set(beams.map(beam => beam.sourceId))
  const apertures = frame.emitters
    .filter(emitter => emitter.activeRayCount > 0 && emitter.intensity > 0.001 && activeSourceIds.has(emitter.id))
    .sort((a, b) => a.sortDepth - b.sortDepth || a.id.localeCompare(b.id))
    .map((emitter): LaserDmxWebGLApertureInstance => {
      const projected = projectLaserDmxScenePoint(frame.camera, emitter.position)
      const energyRoot = Math.sqrt(Math.max(0, emitter.totalActiveEnergy))
      const coreRadiusCssPx = clamp(1.1 + emitter.apertureSize * 0.82 + emitter.peakRayIntensity * 1.15, 1.25, 6.5)
      const ringRadiusCssPx = clamp(coreRadiusCssPx * (1.9 + Math.min(0.35, energyRoot * 0.08)), 2.5, 14)
      const haloRadiusCssPx = clamp(ringRadiusCssPx * (1.42 + Math.min(0.85, energyRoot * 0.16)), 4, 34)
      return {
        id: emitter.id,
        position: { x: projected.x, y: projected.y, z: projected.clipDepth },
        color: emitter.color,
        intensity: clamp(emitter.intensity * (0.88 + glow * 0.46), 0, 2.8),
        totalActiveEnergy: emitter.totalActiveEnergy,
        coreRadiusCssPx,
        ringRadiusCssPx,
        haloRadiusCssPx,
        glareDirection: projectedDirection(emitter.glareDirection, viewport),
        sortDepth: emitter.sortDepth,
      }
    })

  return {
    beams,
    apertures,
    envelopeComplexity: policy.envelopeComplexity,
    requestedBeamCount: visible.length,
    renderedBeamCount: beams.length,
    degraded: beams.length < visible.length || policy.envelopeComplexity < 0.99,
  }
}
