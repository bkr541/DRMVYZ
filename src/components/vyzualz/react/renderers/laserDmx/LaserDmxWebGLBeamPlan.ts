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
import {
  laserDmxDepthSegmentVisible,
  projectLaserDmxScenePoint,
  type LaserDmxProjectedPoint,
} from './LaserDmxSpatialModel'
import { resolveLaserDmxBeamInstability } from './LaserDmxTemporalOptics'

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
  materialMode: 0 | 1 | 2
  softness: number
  goboAmount: number
  prismAmount: number
  co2Occlusion: number
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
  shapeMode: 0 | 1 | 2 | 3 | 4 | 5 | 6
  aspect: number
  segments: number
  chase: number
  softness: number
  phase: number
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

function pointToSegmentDistance(
  point: LaserDmxSceneVec3,
  start: LaserDmxSceneVec3,
  end: LaserDmxSceneVec3,
): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dz = (end.z - start.z) * 0.45
  const px = point.x - start.x
  const py = point.y - start.y
  const pz = (point.z - start.z) * 0.45
  const lengthSquared = dx * dx + dy * dy + dz * dz
  const t = lengthSquared > 1e-8 ? clamp((px * dx + py * dy + pz * dz) / lengthSquared, 0, 1) : 0
  return Math.hypot(
    point.x - (start.x + dx * t),
    point.y - (start.y + dy * t),
    (point.z - (start.z + (end.z - start.z) * t)) * 0.45,
  )
}

function resolveCo2BeamOcclusion(
  beam: LaserDmxSceneBeam,
  co2Sources: readonly LaserDmxSceneFrame['atmosphereSources'][number][],
): number {
  return co2Sources.reduce((maximum, source) => {
    if (!source.enabled || source.density <= 0.001) return maximum
    const radius = Math.max(0.035, source.spread * 1.35)
    const proximity = 1 - clamp(pointToSegmentDistance(source.position, beam.origin, beam.target) / radius, 0, 1)
    return Math.max(maximum, proximity * clamp01(source.density) * 0.44)
  }, 0)
}

function rotateProjectedTarget(
  origin: LaserDmxProjectedPoint,
  target: LaserDmxProjectedPoint,
  angleRad: number,
): LaserDmxProjectedPoint {
  if (Math.abs(angleRad) < 1e-8) return target
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const cosine = Math.cos(angleRad)
  const sine = Math.sin(angleRad)
  return {
    x: origin.x + dx * cosine - dy * sine,
    y: origin.y + dx * sine + dy * cosine,
    clipDepth: target.clipDepth,
    visible: target.visible,
  }
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
    && (beam.fixtureKind === 'laser' || beam.fixtureKind === 'movingHead' || beam.fixtureKind === 'parWash')
    && laserDmxDepthSegmentVisible(frame.camera, beam.depthRange.minZ, beam.depthRange.maxZ)
  ))
  const selected = selectLaserDmxBeamsForQuality(visible, frame.quality.qualityTier, maxBeamOverride)
  const atmosphere = frame.atmosphere.enabled
    ? clamp01(frame.atmosphere.opacity * 0.48 + frame.atmosphere.beamScatter * 0.52)
    : 0
  const globalWidth = clamp(frame.output.globalBeamWidth, 0.1, 6)
  const glow = clamp01(frame.output.globalGlow)
  const fixtureById = new Map(frame.fixtures.map(fixture => [fixture.id, fixture]))
  const co2Sources = frame.atmosphereSources.filter(source => fixtureById.get(source.fixtureId)?.kind === 'co2Jet')
  const fixtureSemanticKeyById = new Map(frame.fixtures.map(fixture => [fixture.id, fixture.semanticKey]))
  const sourceInstability = new Map<string, ReturnType<typeof resolveLaserDmxBeamInstability>>()

  const beams = selected.map((beam): LaserDmxWebGLBeamInstance => {
    const origin = projectLaserDmxScenePoint(frame.camera, beam.origin)
    const instability = resolveLaserDmxBeamInstability(
      frame,
      beam,
      fixtureSemanticKeyById.get(beam.fixtureId) ?? beam.fixtureId,
    )
    if (!sourceInstability.has(beam.sourceId)) sourceInstability.set(beam.sourceId, instability)
    const authoredTarget = projectLaserDmxScenePoint(frame.camera, beam.target)
    const target = rotateProjectedTarget(origin, authoredTarget, instability.angularOffsetRad)
    const distanceFactor = clamp01(beam.length / 1.35)
    const focusTightening = 0.82 + clamp01(beam.focus) * 0.18
    const baseWidth = clamp(
      (0.42 + beam.width * 0.58)
        * globalWidth
        * focusTightening
        * instability.widthMultiplier,
      0.35,
      9,
    )
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
    const intensity = clamp(
      beam.intensity * (0.72 + glow * 0.62) * instability.intensityMultiplier,
      0,
      2.4,
    )
    const fixture = fixtureById.get(beam.fixtureId)
    const materialMode = beam.fixtureKind === 'laser' ? 0 : beam.fixtureKind === 'movingHead' ? 1 : 2
    const co2Occlusion = resolveCo2BeamOcclusion(beam, co2Sources)
    const transmission = 1 - co2Occlusion
    return {
      id: beam.id,
      sourceId: beam.sourceId,
      origin: { x: origin.x, y: origin.y, z: origin.clipDepth },
      target: { x: target.x, y: target.y, z: target.clipDepth },
      color: beam.color,
      intensity,
      coreIntensity: clamp01(beam.coreIntensity * instability.intensityMultiplier),
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
      phase: beam.pattern.phase + instability.phaseOffset,
      materialMode,
      softness: fixture?.optics.opticalSoftness ?? (materialMode === 0 ? 0.08 : materialMode === 1 ? 0.34 : 0.72),
      goboAmount: materialMode === 1 ? fixture?.optics.goboAmount ?? 0 : 0,
      prismAmount: Math.max(0, ((fixture?.optics.prismFacets ?? 1) - 1) / 4),
      co2Occlusion,
      sortDepth: beam.sortDepth,
    }
  })

  const activeSourceIds = new Set(beams.map(beam => beam.sourceId))
  const strobeActive = frame.transientEvents.some(event => event.kind === 'strobe' && event.strength > 0.001)
  const apertures = frame.emitters
    .filter(emitter => {
      const fixture = fixtureById.get(emitter.fixtureId)
      if (!fixture?.enabled || fixture.intensity <= 0.001) return false
      if (fixture.kind === 'laser' || fixture.kind === 'movingHead' || fixture.kind === 'parWash') {
        return emitter.activeRayCount > 0 && emitter.intensity > 0.001 && activeSourceIds.has(emitter.id)
      }
      if (fixture.kind === 'strobe') return strobeActive
      return fixture.kind !== 'haze'
    })
    .sort((a, b) => a.sortDepth - b.sortDepth || a.id.localeCompare(b.id))
    .map((emitter): LaserDmxWebGLApertureInstance => {
      const projected = projectLaserDmxScenePoint(frame.camera, emitter.position)
      const energyRoot = Math.sqrt(Math.max(0, emitter.totalActiveEnergy))
      const instability = sourceInstability.get(emitter.id)
      const apertureMultiplier = instability?.apertureMultiplier ?? 1
      const fixture = fixtureById.get(emitter.fixtureId)!
      const shapeMode: LaserDmxWebGLApertureInstance['shapeMode'] = fixture.kind === 'ledBar'
        ? 1
        : fixture.kind === 'ledTube'
          ? 2
          : fixture.kind === 'strobe'
            ? 3
            : fixture.kind === 'blinder'
              ? 4
              : fixture.kind === 'videoWall'
                ? 5
                : fixture.kind === 'co2Jet'
                  ? 6
                  : 0
      const coreRadiusCssPx = shapeMode === 0
        ? clamp((1.1 + emitter.apertureSize * 0.82 + emitter.peakRayIntensity * 1.15) * apertureMultiplier, 1.25, 6.5)
        : shapeMode === 3 ? 7 : shapeMode === 4 ? 8 : shapeMode === 5 ? 10 : 3.4
      const ringRadiusCssPx = shapeMode === 0
        ? clamp(coreRadiusCssPx * (1.9 + Math.min(0.35, energyRoot * 0.08)), 2.5, 14)
        : coreRadiusCssPx * 1.35
      const haloRadiusCssPx = shapeMode === 0
        ? clamp(ringRadiusCssPx * (1.42 + Math.min(0.85, energyRoot * 0.16)), 4, 34)
        : shapeMode === 5 ? 26 : shapeMode === 4 ? 22 : shapeMode === 3 ? 18 : shapeMode === 1 || shapeMode === 2 ? 10 : 9
      const directionPhase = frame.timestamp * (fixture.component.ledDirection === 'rightToLeft' ? -1 : 1)
      return {
        id: emitter.id,
        position: { x: projected.x, y: projected.y, z: projected.clipDepth },
        color: emitter.color,
        intensity: clamp(
          (shapeMode === 0 ? emitter.intensity : fixture.intensity)
            * fixture.optics.sourceIntensity
            * (0.88 + glow * 0.46)
            * apertureMultiplier,
          0,
          shapeMode === 4 ? 4.2 : shapeMode === 3 ? 3.6 : 2.8,
        ),
        totalActiveEnergy: emitter.totalActiveEnergy,
        coreRadiusCssPx,
        ringRadiusCssPx,
        haloRadiusCssPx,
        glareDirection: projectedDirection(emitter.glareDirection, viewport),
        shapeMode,
        aspect: shapeMode === 1 ? 5.5 : shapeMode === 2 ? 4.4 : shapeMode === 3 ? 2.8 : shapeMode === 5 ? 1.78 : 1,
        segments: shapeMode === 1 || shapeMode === 2 ? fixture.component.ledCellCount : 1,
        chase: shapeMode === 1 || shapeMode === 2 ? 1 : 0,
        softness: fixture.optics.opticalSoftness,
        phase: directionPhase + fixture.rotationDeg / 360,
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
