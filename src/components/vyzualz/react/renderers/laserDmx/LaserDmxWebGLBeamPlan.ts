import type { LaserDmxShowDirectorWebGLQuality } from '../../ReactTypes'
import {
  LASER_DMX_VISUAL_ROLE_PRIORITY,
  resolveLaserDmxWhiteHotMix,
  selectDeterministicLaserDmxRayIndices,
} from './LaserDmxBeamOptics'
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
  resolveLaserDmxPartialPlumeAttenuation,
  splitLaserDmxDepthInterval,
  type LaserDmxDepthQualityPolicy,
} from './LaserDmxDepthCompositing'
import {
  clipLaserDmxSceneSegment,
  projectLaserDmxScenePoint,
  type LaserDmxProjectedPoint,
} from './LaserDmxSpatialModel'
import { resolveLaserDmxBeamInstability } from './LaserDmxTemporalOptics'
import {
  buildLaserDmxScannerExposurePlan,
  resolveLaserDmxScannerExposureDensity,
  type LaserDmxScannerWebGLInputValidation,
} from './LaserDmxScannerWebGLPlan'

export interface LaserDmxWebGLViewport {
  backingWidth: number
  backingHeight: number
  cssWidth: number
  cssHeight: number
}

export interface LaserDmxWebGLBeamInstance {
  id: string
  sourceId: string
  fixtureKind: LaserDmxSceneBeam['fixtureKind']
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
  goboPattern: number
  goboRotationRad: number
  iris: number
  frost: number
  prismAmount: number
  prismFacetCount: number
  prismRotationRad: number
  co2Occlusion: number
  sortDepth: number
  depthSlice: number
  segmentT0: number
  segmentT1: number
  historyEligible: boolean
}

export interface LaserDmxWebGLApertureInstance {
  id: string
  fixtureId: string
  fixtureKind: 'laser'
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
  rotationRad: number
  behaviorMode: 0 | 1 | 2 | 3
  sourceVariant: 0 | 1 | 2 | 3
  sortDepth: number
  depthSlice: number
}

export interface LaserDmxWebGLBeamRenderPlan {
  beams: LaserDmxWebGLBeamInstance[]
  apertures: LaserDmxWebGLApertureInstance[]
  envelopeComplexity: number
  requestedBeamCount: number
  renderedBeamCount: number
  renderedSegmentCount: number
  laserHistoryBeamCount: number
  depthPolicy: LaserDmxDepthQualityPolicy
  degraded: boolean
  laserInputMode: 'scanner-samples' | 'legacy-only' | 'mixed'
  scannerSegmentCount: number
  scannerInputValidation: LaserDmxScannerWebGLInputValidation
}

interface LaserDmxWebGLQualityPolicy {
  maxBeamInstances: number
  maxRenderedSegments: number
  envelopeComplexity: number
  maxPrismCopies: number
}

const QUALITY_POLICIES: Readonly<
  Record<LaserDmxShowDirectorWebGLQuality, LaserDmxWebGLQualityPolicy>
> = Object.freeze({
  low: {
    maxBeamInstances: 220,
    maxRenderedSegments: 360,
    envelopeComplexity: 0.46,
    maxPrismCopies: 3,
  },
  medium: {
    maxBeamInstances: 260,
    maxRenderedSegments: 620,
    envelopeComplexity: 0.68,
    maxPrismCopies: 3,
  },
  high: {
    maxBeamInstances: 300,
    maxRenderedSegments: 920,
    envelopeComplexity: 0.9,
    maxPrismCopies: 5,
  },
  ultra: {
    maxBeamInstances: 300,
    maxRenderedSegments: 1200,
    envelopeComplexity: 1,
    maxPrismCopies: 5,
  },
  auto: {
    maxBeamInstances: 280,
    maxRenderedSegments: 680,
    envelopeComplexity: 0.82,
    maxPrismCopies: 3,
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

function lerpVec3(
  a: LaserDmxSceneVec3,
  b: LaserDmxSceneVec3,
  t: number,
): LaserDmxSceneVec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }
}

function stableBeamSort(a: LaserDmxSceneBeam, b: LaserDmxSceneBeam): number {
  return (
    a.priority - b.priority ||
    LASER_DMX_VISUAL_ROLE_PRIORITY[a.visualRole] -
      LASER_DMX_VISUAL_ROLE_PRIORITY[b.visualRole] ||
    a.sortDepth - b.sortDepth ||
    a.sourceId.localeCompare(b.sourceId) ||
    a.pattern.rayIndex - b.pattern.rayIndex ||
    a.id.localeCompare(b.id)
  )
}

interface LaserDmxSourceDensityLimits {
  hero: number
  primary: number
  impact: number
  secondary: number
  texture: number
}

const SOURCE_DENSITY_LIMITS: Readonly<
  Record<LaserDmxShowDirectorWebGLQuality, LaserDmxSourceDensityLimits>
> = Object.freeze({
  low: { hero: 8, primary: 8, impact: 6, secondary: 6, texture: 4 },
  medium: { hero: 12, primary: 12, impact: 8, secondary: 8, texture: 6 },
  high: { hero: 16, primary: 16, impact: 10, secondary: 10, texture: 8 },
  ultra: { hero: 24, primary: 20, impact: 12, secondary: 12, texture: 10 },
  auto: { hero: 16, primary: 16, impact: 10, secondary: 10, texture: 8 },
})

function sourceDensityLimit(
  beam: LaserDmxSceneBeam,
  quality: LaserDmxShowDirectorWebGLQuality,
): number {
  return SOURCE_DENSITY_LIMITS[quality][beam.visualRole]
}

function stableSourceGroups(
  beams: readonly LaserDmxSceneBeam[],
): LaserDmxSceneBeam[][] {
  const grouped = new Map<string, LaserDmxSceneBeam[]>()
  for (const beam of beams) {
    const group = grouped.get(beam.sourceId) ?? []
    group.push(beam)
    grouped.set(beam.sourceId, group)
  }
  return [...grouped.values()]
    .map((group) =>
      group.sort(
        (a, b) =>
          a.pattern.rayIndex - b.pattern.rayIndex || stableBeamSort(a, b),
      ),
    )
    .sort((a, b) =>
      stableBeamSort(
        [...a].sort(stableBeamSort)[0]!,
        [...b].sort(stableBeamSort)[0]!,
      ),
    )
}

function thinSourceForQuality(
  source: readonly LaserDmxSceneBeam[],
  quality: LaserDmxShowDirectorWebGLQuality,
): LaserDmxSceneBeam[] {
  if (source.length === 0) return []
  const limit = Math.min(source.length, sourceDensityLimit(source[0]!, quality))
  if (source.length <= limit) return [...source].sort(stableBeamSort)
  const selectedIndices = new Set(
    selectDeterministicLaserDmxRayIndices(source.length, limit),
  )
  return source
    .filter((_, index) => selectedIndices.has(index))
    .sort(stableBeamSort)
}

/**
 * Quality degradation first thins each source deterministically, preserving fan
 * edges and center. The global budget is then filled round-robin within stable
 * priority order so mirrored banks remain balanced. Texture and support density
 * fall before hero/primary structure, and no ray flickers randomly frame to frame.
 */
export function selectLaserDmxBeamsForQuality(
  beams: readonly LaserDmxSceneBeam[],
  quality: LaserDmxShowDirectorWebGLQuality,
  maxOverride?: number,
): LaserDmxSceneBeam[] {
  const limit = Math.max(
    0,
    Math.min(
      300,
      Math.round(maxOverride ?? QUALITY_POLICIES[quality].maxBeamInstances),
    ),
  )
  if (limit === 0) return []
  const sources = stableSourceGroups(beams).map((source) =>
    thinSourceForQuality(source, quality),
  )
  const densityBoundedCount = sources.reduce(
    (sum, source) => sum + source.length,
    0,
  )
  if (densityBoundedCount <= limit) return sources.flat().sort(stableBeamSort)

  const sourcePriority = (source: readonly LaserDmxSceneBeam[]) => {
    const representative = [...source].sort(stableBeamSort)[0]!
    return {
      priority: representative.priority,
      role: LASER_DMX_VISUAL_ROLE_PRIORITY[representative.visualRole],
    }
  }
  const priorityGroups = new Map<string, LaserDmxSceneBeam[][]>()
  for (const source of sources) {
    const priority = sourcePriority(source)
    const key = `${priority.priority}:${priority.role}`
    const group = priorityGroups.get(key) ?? []
    group.push(source)
    priorityGroups.set(key, group)
  }
  const orderedGroups = [...priorityGroups.entries()]
    .sort(([a], [b]) => {
      const [ap, ar] = a.split(':').map(Number)
      const [bp, br] = b.split(':').map(Number)
      return ap - bp || ar - br
    })
    .map(([, group]) => group)

  const selected: LaserDmxSceneBeam[] = []
  for (const group of orderedGroups) {
    let depth = 0
    let progress = true
    while (selected.length < limit && progress) {
      progress = false
      for (const source of group) {
        const beam = source[depth]
        if (!beam) continue
        selected.push(beam)
        progress = true
        if (selected.length >= limit) break
      }
      depth += 1
    }
    if (selected.length >= limit) break
  }
  return selected.sort(stableBeamSort)
}

function projectedDirection(
  frame: LaserDmxSceneFrame,
  position: LaserDmxSceneVec3,
  direction: LaserDmxSceneVec3,
  viewport: LaserDmxWebGLViewport,
): { x: number; y: number } {
  const aspect = Math.max(
    0.5,
    viewport.backingWidth / Math.max(1, viewport.backingHeight),
  )
  const origin = projectLaserDmxScenePoint(frame.camera, position, aspect)
  const target = projectLaserDmxScenePoint(
    frame.camera,
    {
      x: position.x + direction.x * 0.08,
      y: position.y + direction.y * 0.08,
      z: position.z + direction.z * 0.08,
    },
    aspect,
  )
  const x = (target.x - origin.x) * Math.max(1, viewport.backingWidth)
  const y = (target.y - origin.y) * Math.max(1, viewport.backingHeight)
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
  const t =
    lengthSquared > 1e-8
      ? clamp((px * dx + py * dy + pz * dz) / lengthSquared, 0, 1)
      : 0
  return Math.hypot(
    point.x - (start.x + dx * t),
    point.y - (start.y + dy * t),
    (point.z - (start.z + (end.z - start.z) * t)) * 0.45,
  )
}

function resolveCo2SegmentOcclusion(input: {
  segmentOrigin: LaserDmxSceneVec3
  segmentTarget: LaserDmxSceneVec3
  segmentDepth: number
  co2Sources: readonly LaserDmxSceneAtmosphereSource[]
  frame: LaserDmxSceneFrame
  aspect: number
  depthPolicy: LaserDmxDepthQualityPolicy
}): number {
  const midpoint = lerpVec3(input.segmentOrigin, input.segmentTarget, 0.5)
  return input.co2Sources.reduce((maximum, source) => {
    if (!source.enabled || source.kind !== 'co2' || source.density <= 0.001)
      return maximum
    const plumeLength = 0.08 + source.expansion * 0.46
    const plumeTarget = {
      x: source.position.x + source.direction.x * plumeLength,
      y: source.position.y + source.direction.y * plumeLength,
      z: source.position.z + source.direction.z * plumeLength,
    }
    const radius = Math.max(
      0.035,
      source.spread * (0.72 + source.expansion * 0.8),
    )
    const radialProximity =
      1 -
      clamp(
        pointToSegmentDistance(midpoint, source.position, plumeTarget) / radius,
        0,
        1,
      )
    const projectedSource = projectLaserDmxScenePoint(
      input.frame.camera,
      source.position,
      input.aspect,
    )
    const attenuation = resolveLaserDmxPartialPlumeAttenuation({
      segmentDepth: input.segmentDepth,
      plumeDepth: projectedSource.clipDepth,
      radialProximity,
      plumeDensity: source.density,
      precision: input.depthPolicy.plumePrecision,
    })
    return Math.max(maximum, attenuation)
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
    cameraDepth: target.cameraDepth,
    perspectiveScale: target.perspectiveScale,
    visible: target.visible,
  }
}

export function buildLaserDmxWebGLBeamRenderPlan(
  frame: LaserDmxSceneFrame,
  viewport: LaserDmxWebGLViewport,
  maxBeamOverride?: number,
  continuousDepthAvailable = true,
): LaserDmxWebGLBeamRenderPlan {
  const policy = QUALITY_POLICIES[frame.quality.qualityTier]
  const scannerPlan = buildLaserDmxScannerExposurePlan(frame)
  const scannerFixtureIds = new Set(
    scannerPlan.validation.authoritativeFixtureIds,
  )
  const depthPolicy = resolveLaserDmxDepthQualityPolicy(
    frame.quality.qualityTier,
    continuousDepthAvailable,
  )
  const aspect = Math.max(
    0.5,
    viewport.backingWidth / Math.max(1, viewport.backingHeight),
  )
  const clippedByBeamId = new Map<
    string,
    ReturnType<typeof clipLaserDmxSceneSegment>
  >()
  const visible = frame.beams.filter((beam) => {
    if (!beam.enabled || beam.intensity <= 0.001 || beam.fixtureKind !== 'laser') return false
    if (beam.fixtureKind === 'laser' && scannerFixtureIds.has(beam.fixtureId))
      return false
    const clipped = clipLaserDmxSceneSegment(
      frame.camera,
      beam.origin,
      beam.target,
    )
    if (!clipped) return false
    clippedByBeamId.set(beam.id, clipped)
    return true
  })
  const selected = selectLaserDmxBeamsForQuality(
    visible,
    frame.quality.qualityTier,
    maxBeamOverride,
  )
  const atmosphere = frame.atmosphere.enabled
    ? clamp01(
        frame.atmosphere.opacity * 0.48 + frame.atmosphere.beamScatter * 0.52,
      )
    : 0
  const globalWidth = clamp(frame.output.globalBeamWidth, 0.1, 6)
  const glow = clamp01(frame.output.globalGlow)
  const fixtureById = new Map(
    frame.fixtures.map((fixture) => [fixture.id, fixture]),
  )
  const co2Sources = frame.atmosphereSources.filter(
    (source) => source.kind === 'co2',
  )
  const fixtureSemanticKeyById = new Map(
    frame.fixtures.map((fixture) => [fixture.id, fixture.semanticKey]),
  )
  const sourceInstability = new Map<
    string,
    ReturnType<typeof resolveLaserDmxBeamInstability>
  >()
  const beams: LaserDmxWebGLBeamInstance[] = []

  outer: for (const beam of selected) {
    const clipped = clippedByBeamId.get(beam.id)!
    const projectedOrigin = projectLaserDmxScenePoint(
      frame.camera,
      clipped.origin,
      aspect,
    )
    const instability = resolveLaserDmxBeamInstability(
      frame,
      beam,
      fixtureSemanticKeyById.get(beam.fixtureId) ?? beam.fixtureId,
    )
    if (!sourceInstability.has(beam.sourceId))
      sourceInstability.set(beam.sourceId, instability)
    const authoredTarget = projectLaserDmxScenePoint(
      frame.camera,
      clipped.target,
      aspect,
    )
    const unstableTarget = rotateProjectedTarget(
      projectedOrigin,
      authoredTarget,
      instability.angularOffsetRad,
    )
    const distanceFactor = clamp01(beam.length / 1.35)
    const focusTightening = 0.82 + clamp01(beam.focus) * 0.18
    const depthScale = clamp(
      (projectedOrigin.perspectiveScale + authoredTarget.perspectiveScale) *
        0.5,
      0.82,
      1.22,
    )
    const fixture = fixtureById.get(beam.fixtureId)
    const materialMode: 0 = 0
    const iris = fixture?.optics.iris ?? 1
    const frost = fixture?.optics.frost ?? 0
    const baseWidth = clamp(
      (0.42 + beam.width * 0.58) *
        globalWidth *
        focusTightening *
        instability.widthMultiplier *
        depthScale,
      0.35,
      9,
    )
    const bodyStartWidth = baseWidth
    const bodyEndWidth = clamp(
      baseWidth * (1 + beam.divergence * 0.2 + distanceFactor * 0.07),
      bodyStartWidth,
      baseWidth * 1.38,
    )
    const scatterBase = baseWidth * beam.scatterEnvelopeWidth
    const envelopeStartWidth = clamp(
      scatterBase * (0.42 + atmosphere * 0.12 + frost * 0.3),
      baseWidth * 1.45,
      64,
    )
    const envelopeEndWidth = clamp(
      scatterBase *
        (0.66 +
          beam.divergence * 0.72 +
          distanceFactor * 0.28 +
          atmosphere * 0.24 +
          frost * 0.7),
      envelopeStartWidth,
      72,
    )
    const authoredIntensity = clamp(
      beam.intensity * (0.72 + glow * 0.62) * instability.intensityMultiplier,
      0,
      2.4,
    )
    // Prism, diffraction, spectral separation, and multi-aperture copies are
    // explicit scanner-domain rays. The sharp pass never invents screen-space copies.
    const offsets = [0]
    const goboRotationRad = 0
    const prismRotationRad = 0
    const prismFacets = 1

    for (let copyIndex = 0; copyIndex < offsets.length; copyIndex += 1) {
      const copyTarget = rotateProjectedTarget(
        projectedOrigin,
        unstableTarget,
        offsets[copyIndex]!,
      )
      const copyEnergy = 1
      const segments = splitLaserDmxDepthInterval(
        projectedOrigin.clipDepth,
        copyTarget.clipDepth,
        depthPolicy,
      )
      for (
        let segmentIndex = 0;
        segmentIndex < segments.length;
        segmentIndex += 1
      ) {
        if (beams.length >= policy.maxRenderedSegments) break outer
        const segment = segments[segmentIndex]!
        const seam = 0.0008
        const t0 = clamp(segment.t0 - (segmentIndex > 0 ? seam : 0), 0, 1)
        const t1 = clamp(
          segment.t1 + (segmentIndex < segments.length - 1 ? seam : 0),
          0,
          1,
        )
        const worldOrigin = lerpVec3(clipped.origin, clipped.target, t0)
        const worldTarget = lerpVec3(clipped.origin, clipped.target, t1)
        const co2Occlusion = resolveCo2SegmentOcclusion({
          segmentOrigin: worldOrigin,
          segmentTarget: worldTarget,
          segmentDepth: segment.centerDepth,
          co2Sources,
          frame,
          aspect,
          depthPolicy,
        })
        const transmission = 1 - co2Occlusion
        const segmentOrigin = {
          x: lerp(projectedOrigin.x, copyTarget.x, t0),
          y: lerp(projectedOrigin.y, copyTarget.y, t0),
          z: lerp(projectedOrigin.clipDepth, copyTarget.clipDepth, t0),
        }
        const segmentTarget = {
          x: lerp(projectedOrigin.x, copyTarget.x, t1),
          y: lerp(projectedOrigin.y, copyTarget.y, t1),
          z: lerp(projectedOrigin.clipDepth, copyTarget.clipDepth, t1),
        }
        beams.push({
          id: `${beam.id}-p${copyIndex + 1}-d${segmentIndex + 1}`,
          sourceId: beam.sourceId,
          fixtureKind: beam.fixtureKind,
          origin: segmentOrigin,
          target: segmentTarget,
          color: beam.color,
          intensity: authoredIntensity * copyEnergy * transmission,
          coreIntensity: clamp01(
            beam.coreIntensity * instability.intensityMultiplier * transmission,
          ),
          whiteHotMix: resolveLaserDmxWhiteHotMix(
            beam.intensity,
            beam.coreIntensity,
          ),
          opacity: beam.opacity,
          bodyStartWidthCssPx: lerp(bodyStartWidth, bodyEndWidth, t0),
          bodyEndWidthCssPx: lerp(bodyStartWidth, bodyEndWidth, t1),
          envelopeStartWidthCssPx: lerp(
            envelopeStartWidth,
            envelopeEndWidth,
            t0,
          ),
          envelopeEndWidthCssPx: lerp(envelopeStartWidth, envelopeEndWidth, t1),
          envelopeAlpha: clamp(
            (0.055 + atmosphere * 0.17 + glow * 0.08 + frost * 0.08) *
              beam.opacity *
              policy.envelopeComplexity,
            0.015,
            0.38,
          ),
          phase: beam.pattern.phase + instability.phaseOffset,
          materialMode,
          softness: fixture?.optics.opticalSoftness ?? 0.08,
          goboAmount: 0,
          goboPattern: 0,
          goboRotationRad,
          iris,
          frost,
          prismAmount: Math.max(0, (prismFacets - 1) / 4),
          prismFacetCount: offsets.length,
          prismRotationRad,
          co2Occlusion,
          sortDepth: segment.centerDepth,
          depthSlice: segment.sliceIndex,
          segmentT0: segment.t0,
          segmentT1: segment.t1,
          historyEligible: beam.fixtureKind === 'laser',
        })
      }
    }
  }

  const templateBeamByFixtureId = new Map<string, LaserDmxSceneBeam>()
  for (const beam of frame.beams) {
    if (beam.fixtureKind !== 'laser') continue
    const current = templateBeamByFixtureId.get(beam.fixtureId)
    if (
      !current ||
      beam.intensity > current.intensity ||
      (beam.intensity === current.intensity &&
        beam.id.localeCompare(current.id) < 0)
    ) {
      templateBeamByFixtureId.set(beam.fixtureId, beam)
    }
  }
  const emitterByFixtureId = new Map(
    frame.emitters.map((emitter) => [emitter.fixtureId, emitter]),
  )
  scannerSegments: for (const scannerSegment of scannerPlan.segments) {
    if (beams.length >= policy.maxRenderedSegments) break
    const fixture = fixtureById.get(scannerSegment.fixtureId)
    if (
      !fixture?.enabled ||
      fixture.kind !== 'laser' ||
      fixture.intensity <= 0.001
    )
      continue
    const clipped = clipLaserDmxSceneSegment(
      frame.camera,
      scannerSegment.origin,
      scannerSegment.target,
    )
    if (!clipped) continue
    const projectedOrigin = projectLaserDmxScenePoint(
      frame.camera,
      clipped.origin,
      aspect,
    )
    const projectedTarget = projectLaserDmxScenePoint(
      frame.camera,
      clipped.target,
      aspect,
    )
    if (!projectedOrigin.visible && !projectedTarget.visible) continue
    const template = templateBeamByFixtureId.get(scannerSegment.fixtureId)
    const sourceId =
      emitterByFixtureId.get(scannerSegment.fixtureId)?.id ??
      template?.sourceId ??
      `${scannerSegment.fixtureId}-emitter`
    // The ordered scanner plan is already the resolved finite-cue output.
    // Renderer-local instability must not rotate, oscillate, or phase-advance it.
    const instability = {
      intensityMultiplier: 1,
      widthMultiplier: 1,
      angularOffsetRad: 0,
      phaseOffset: 0,
      apertureMultiplier: 1,
    }
    if (!sourceInstability.has(sourceId))
      sourceInstability.set(sourceId, instability)
    const exposureDensity = resolveLaserDmxScannerExposureDensity(
      frame,
      scannerSegment,
    )
    const opticalPower = clamp(fixture.optics.sourceIntensity, 0, 2)
    const integratedScan = scannerSegment.geometry === 'scanExposure'
    const scannedStroke = scannerSegment.geometry === 'scanStroke'
    const authoredIntensity = clamp(
      exposureDensity *
        opticalPower *
        (0.72 + glow * 0.32) *
        (integratedScan ? 0.74 : 1),
      0,
      integratedScan ? 1.15 : 1.8,
    )
    const scannerCoreIntensity = clamp01(
      integratedScan
        ? 0.06 + Math.sqrt(Math.max(0, authoredIntensity)) * 0.18
        : (scannedStroke ? 0.22 : 0.38)
          + Math.sqrt(Math.max(0, authoredIntensity)) * (scannedStroke ? 0.42 : 0.4),
    )
    if (authoredIntensity <= 0.0005) continue
    const depthScale = clamp(
      (projectedOrigin.perspectiveScale + projectedTarget.perspectiveScale) *
        0.5,
      0.82,
      1.22,
    )
    const focus = template?.focus ?? 0.92
    const templateWidth = template?.width ?? 0.72
    const geometryWidth = integratedScan ? 1.28 : scannedStroke ? 0.76 : 1
    const speedTightening = scannedStroke
      ? 0.82 + (1 - scannerSegment.velocityRatio) * 0.12
      : 1
    const baseWidth = clamp(
      (0.28 + templateWidth * 0.36) *
        globalWidth *
        (0.84 + focus * 0.16) *
        depthScale *
        geometryWidth *
        speedTightening,
      0.24,
      integratedScan ? 3.2 : scannedStroke ? 1.65 : 2.35,
    )
    const bodyStartWidth = baseWidth
    const bodyEndWidth = clamp(
      baseWidth * (1 + (template?.divergence ?? 0.08) * 0.12),
      baseWidth,
      baseWidth * 1.18,
    )
    const atmosphereEnvelope = clamp(
      baseWidth * (
        (integratedScan ? 4.6 : scannedStroke ? 2.35 : 2.9)
        + atmosphere * 1.65
        + (template?.scatterEnvelopeWidth ?? 1.8) * 0.24
      ),
      baseWidth * 1.9,
      integratedScan ? 18 : scannedStroke ? 9 : 13,
    )
    const segments = splitLaserDmxDepthInterval(
      projectedOrigin.clipDepth,
      projectedTarget.clipDepth,
      depthPolicy,
    )
    for (
      let segmentIndex = 0;
      segmentIndex < segments.length;
      segmentIndex += 1
    ) {
      if (beams.length >= policy.maxRenderedSegments) break scannerSegments
      const segment = segments[segmentIndex]!
      const seam = 0.0008
      const t0 = clamp(segment.t0 - (segmentIndex > 0 ? seam : 0), 0, 1)
      const t1 = clamp(
        segment.t1 + (segmentIndex < segments.length - 1 ? seam : 0),
        0,
        1,
      )
      const worldOrigin = lerpVec3(clipped.origin, clipped.target, t0)
      const worldTarget = lerpVec3(clipped.origin, clipped.target, t1)
      const co2Occlusion = resolveCo2SegmentOcclusion({
        segmentOrigin: worldOrigin,
        segmentTarget: worldTarget,
        segmentDepth: segment.centerDepth,
        co2Sources,
        frame,
        aspect,
        depthPolicy,
      })
      const transmission = 1 - co2Occlusion
      beams.push({
        id: `${scannerSegment.id}-d${segmentIndex + 1}`,
        sourceId,
        fixtureKind: 'laser',
        origin: {
          x: lerp(projectedOrigin.x, projectedTarget.x, t0),
          y: lerp(projectedOrigin.y, projectedTarget.y, t0),
          z: lerp(projectedOrigin.clipDepth, projectedTarget.clipDepth, t0),
        },
        target: {
          x: lerp(projectedOrigin.x, projectedTarget.x, t1),
          y: lerp(projectedOrigin.y, projectedTarget.y, t1),
          z: lerp(projectedOrigin.clipDepth, projectedTarget.clipDepth, t1),
        },
        color: scannerSegment.color,
        intensity: authoredIntensity * transmission,
        coreIntensity: scannerCoreIntensity * transmission,
        whiteHotMix: resolveLaserDmxWhiteHotMix(authoredIntensity, scannerCoreIntensity)
          * (integratedScan ? 0.28 : scannedStroke ? 0.72 : 0.88),
        opacity: clamp01(scannerSegment.color.a),
        bodyStartWidthCssPx: lerp(bodyStartWidth, bodyEndWidth, t0),
        bodyEndWidthCssPx: lerp(bodyStartWidth, bodyEndWidth, t1),
        envelopeStartWidthCssPx: atmosphereEnvelope,
        envelopeEndWidthCssPx: atmosphereEnvelope * 1.04,
        envelopeAlpha: clamp(
          (0.012 + atmosphere * 0.052 + glow * 0.018) *
            policy.envelopeComplexity *
            (scannerSegment.pointDwell ? 0.82 : 1) *
            (integratedScan ? 0.55 : scannedStroke ? 0.78 : 1),
          0.004,
          0.11,
        ),
        phase: 0,
        materialMode: 0,
        softness: clamp(fixture.optics.opticalSoftness, 0, 0.42),
        goboAmount: 0,
        goboPattern: 0,
        goboRotationRad: 0,
        iris: 1,
        frost: 0,
        prismAmount: scannerSegment.opticalCopyIndex > 0 ? 1 : 0,
        prismFacetCount: scannerSegment.opticalCopyIndex > 0 ? 2 : 1,
        prismRotationRad: 0,
        co2Occlusion,
        sortDepth: segment.centerDepth,
        depthSlice: segment.sliceIndex,
        segmentT0: segment.t0,
        segmentT1: segment.t1,
        historyEligible: scannerSegment.historyWeight > 0.015,
      })
    }
  }

  const activeSourceIds = new Set(beams.map((beam) => beam.sourceId))
  const scannerExposureEnergyByFixtureId = new Map<string, number>()
  for (const sample of frame.exposureSamples) {
    if (sample.blanked || sample.intensity <= 0 || sample.exposureWeight <= 0)
      continue
    scannerExposureEnergyByFixtureId.set(
      sample.fixtureId,
      (scannerExposureEnergyByFixtureId.get(sample.fixtureId) ?? 0) +
        sample.exposureWeight * sample.intensity,
    )
  }
  const scannerHeadCountByFixtureId = new Map<string, number>()
  for (const head of frame.scannerHeads)
    scannerHeadCountByFixtureId.set(
      head.fixtureId,
      (scannerHeadCountByFixtureId.get(head.fixtureId) ?? 0) + 1,
    )
  const strobeActive = frame.transientEvents.some(
    (event) => event.kind === 'strobe' && event.strength > 0.001,
  )
  const renderedLegacyLaserFixtureIds = new Set(
    selected
      .filter((beam) => beam.fixtureKind === 'laser')
      .map((beam) => beam.fixtureId),
  )
  const duplicateFixtureIds = scannerPlan.validation.authoritativeFixtureIds
    .filter((fixtureId) => renderedLegacyLaserFixtureIds.has(fixtureId))
    .sort()
  const scannerInputValidation: LaserDmxScannerWebGLInputValidation = {
    ...scannerPlan.validation,
    duplicateFixtureIds,
  }
  const scannerSegmentIds = new Set(
    scannerPlan.segments.map((segment) => segment.id),
  )
  const renderedScannerSegmentIds = new Set(
    beams
      .map((beam) => beam.id.replace(/-d\d+$/, ''))
      .filter((id) => scannerSegmentIds.has(id)),
  )

  const apertures = frame.emitters
    .filter((emitter) => {
      const fixture = fixtureById.get(emitter.fixtureId)
      if (!fixture?.enabled || fixture.intensity <= 0.001 || fixture.kind !== 'laser') return false
      const scannerEnergy = scannerExposureEnergyByFixtureId.get(emitter.fixtureId) ?? 0
      return (scannerEnergy > 0.001 || emitter.activeRayCount > 0)
        && emitter.intensity > 0.001
        && activeSourceIds.has(emitter.id)
    })
    .sort((a, b) => a.sortDepth - b.sortDepth || a.id.localeCompare(b.id))
    .flatMap((emitter): LaserDmxWebGLApertureInstance[] => {
      const projected = projectLaserDmxScenePoint(frame.camera, emitter.position, aspect)
      if (!projected.visible) return []
      const scannerEnergy = scannerExposureEnergyByFixtureId.get(emitter.fixtureId)
      const physicalApertures = Math.max(1, scannerHeadCountByFixtureId.get(emitter.fixtureId) ?? 1)
      const fixture = fixtureById.get(emitter.fixtureId)!
      const visibleApertureEnergy = scannerEnergy == null
        ? emitter.totalActiveEnergy
        : clamp(
            scannerEnergy * fixture.optics.sourceIntensity,
            0,
            Math.max(2.8, physicalApertures * 2.8),
          )
      const energyRoot = Math.sqrt(Math.max(0, visibleApertureEnergy))
      const instability = sourceInstability.get(emitter.id)
      const apertureMultiplier = instability?.apertureMultiplier ?? 1
      const depthScale = clamp(projected.perspectiveScale, 0.82, 1.22)
      const coreRadiusCssPx = clamp(
        (1.1 + emitter.apertureSize * 0.82 + emitter.peakRayIntensity * 1.15)
          * apertureMultiplier
          * depthScale,
        1.25,
        7.5,
      )
      const ringRadiusCssPx = clamp(
        coreRadiusCssPx * (1.9 + Math.min(0.35, energyRoot * 0.08)),
        2.5,
        14,
      )
      const haloRadiusCssPx = clamp(
        ringRadiusCssPx * (1.42 + Math.min(0.85, energyRoot * 0.16)),
        4,
        34,
      )
      return [{
        id: emitter.id,
        fixtureId: emitter.fixtureId,
        fixtureKind: 'laser',
        position: { x: projected.x, y: projected.y, z: projected.clipDepth },
        color: emitter.color,
        intensity: clamp(
          emitter.intensity
            * (scannerEnergy == null ? 1 : clamp(0.4 + scannerEnergy * 0.6, 0.35, 1.15))
            * fixture.optics.sourceIntensity
            * (0.88 + glow * 0.46)
            * apertureMultiplier,
          0,
          2.8,
        ),
        totalActiveEnergy: visibleApertureEnergy,
        coreRadiusCssPx,
        ringRadiusCssPx,
        haloRadiusCssPx,
        glareDirection: projectedDirection(frame, emitter.position, emitter.glareDirection, viewport),
        shapeMode: 0,
        aspect: 1,
        segments: 1,
        chase: 0,
        softness: fixture.optics.opticalSoftness,
        phase: fixture.rotationDeg / 360,
        rotationRad: fixture.rotationDeg * Math.PI / 180,
        behaviorMode: 0,
        sourceVariant: 0,
        sortDepth: projected.clipDepth,
        depthSlice: resolveLaserDmxDepthSliceIndex(projected.clipDepth, depthPolicy.sliceCount),
      }]
    })

  return {
    beams,
    apertures,
    envelopeComplexity: policy.envelopeComplexity,
    requestedBeamCount: visible.length + scannerPlan.segments.length,
    renderedBeamCount: selected.length + renderedScannerSegmentIds.size,
    renderedSegmentCount: beams.length,
    laserHistoryBeamCount: beams.filter((beam) => beam.historyEligible).length,
    depthPolicy,
    degraded:
      selected.length < visible.length ||
      scannerPlan.segments.length > renderedScannerSegmentIds.size ||
      beams.length >= policy.maxRenderedSegments ||
      policy.envelopeComplexity < 0.99,
    laserInputMode:
      scannerPlan.validation.authoritativeFixtureIds.length === 0
        ? 'legacy-only'
        : visible.some((beam) => beam.fixtureKind === 'laser')
          ? 'mixed'
          : 'scanner-samples',
    scannerSegmentCount: scannerPlan.segments.length,
    scannerInputValidation,
  }
}
