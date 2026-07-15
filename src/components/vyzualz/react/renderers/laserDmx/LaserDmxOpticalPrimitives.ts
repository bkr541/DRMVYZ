import type {
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorOpticalPrimitiveType,
  LaserDmxShowDirectorDepthLayer,
} from '../../ReactTypes'
import { LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS } from '../../ReactTypes'
import { createLaserDmxFanRayParameters, type LaserDmxFanSpacingCurve } from './LaserDmxBeamOptics'

export interface LaserDmxPrimitivePoint {
  x: number
  y: number
  z: number
  depthLayer?: LaserDmxShowDirectorDepthLayer
}

export interface LaserDmxPrimitiveRay {
  index: number
  count: number
  spacingT: number
  spacingCurve: LaserDmxFanSpacingCurve
  target: LaserDmxPrimitivePoint
}

export interface LaserDmxPrimitivePlan {
  primitiveType: Exclude<LaserDmxShowDirectorOpticalPrimitiveType, 'auto'>
  rays: LaserDmxPrimitiveRay[]
  coherent: true
  depthPlaneCount: number
  sourceCount: number
}

export interface BuildLaserDmxPrimitivePlanInput {
  fixture: LaserDmxShowDirectorFixture
  origin: LaserDmxPrimitivePoint
  allocatedRayCount: number
  audioTimeSec: number
  beatIndex: number
  phraseIndex: number
  occurrenceSeed: number
}

const DEPTH_BY_LAYER: Readonly<Record<Exclude<LaserDmxShowDirectorDepthLayer, 'auto'>, number>> = Object.freeze({
  cameraFacingAir: 0.78,
  frontAir: 0.48,
  midAir: 0,
  deepAir: -0.52,
  upperAir: -0.28,
  lowerAir: 0.26,
})

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function semanticText(fixture: LaserDmxShowDirectorFixture): string {
  return `${fixture.semanticKey ?? ''} ${fixture.label}`.toLowerCase()
}

export function resolveLaserDmxOpticalPrimitiveType(
  fixture: LaserDmxShowDirectorFixture,
): Exclude<LaserDmxShowDirectorOpticalPrimitiveType, 'auto'> {
  if (fixture.optics.primitiveType !== 'auto') return fixture.optics.primitiveType
  const semantic = semanticText(fixture)
  if (semantic.includes('corridor') || semantic.includes('mirror cage')) return 'mirroredCorridor'
  if (semantic.includes('tunnel')) return 'tunnel'
  if (semantic.includes('canopy') || semantic.includes('ceiling')) return 'canopy'
  if (semantic.includes('rake') || semantic.includes('audience')) return 'audienceRake'
  if (semantic.includes('diamond')) return 'diamondPlane'
  if (semantic.includes('lattice')) return 'rotatingLattice'
  if (semantic.includes('sheet') || semantic.includes('wall')) return 'sheet'
  if (semantic.includes('parallel')) return 'parallelBank'
  if (semantic.includes('cross')) return 'crossBank'
  if (semantic.includes('layered') || semantic.includes('depth')) return 'layeredFan'
  if (semantic.includes('scanner') || fixture.beam.targetMode === 'sweep') return 'scannerWave'
  if (semantic.includes('burst')) return 'apertureBurst'
  if (fixture.kind === 'movingHead' || fixture.kind === 'parWash') return 'washCone'
  if (fixture.kind === 'blinder') return 'blinderBank'
  if (fixture.kind === 'strobe') return 'strobeField'
  if (fixture.kind === 'co2Jet') return 'co2Burst'
  if (fixture.beam.targetMode === 'cross') return 'crossBank'
  if (fixture.beam.targetMode === 'mirror') return 'mirroredCorridor'
  if (fixture.beam.targetMode === 'fixed') return 'parallelBank'
  return 'fan'
}

function visibleRayEnd(origin: LaserDmxPrimitivePoint, angleDeg: number, length: number, z: number): LaserDmxPrimitivePoint {
  const radians = angleDeg * Math.PI / 180
  const dx = Math.cos(radians) * length
  const dy = Math.sin(radians) * length
  let scale = 1
  if (dx > 0) scale = Math.min(scale, (1 - origin.x) / dx)
  if (dx < 0) scale = Math.min(scale, (0 - origin.x) / dx)
  if (dy > 0) scale = Math.min(scale, (1 - origin.y) / dy)
  if (dy < 0) scale = Math.min(scale, (0 - origin.y) / dy)
  return {
    x: clamp01(origin.x + dx * clamp(scale, 0, 1)),
    y: clamp01(origin.y + dy * clamp(scale, 0, 1)),
    z: clamp(z, -0.92, 0.92),
  }
}

function makeRays(points: readonly LaserDmxPrimitivePoint[], curve: LaserDmxFanSpacingCurve = 'linear'): LaserDmxPrimitiveRay[] {
  const count = points.length
  return points.map((target, index) => ({
    index,
    count,
    spacingT: count <= 1 ? 0 : index / (count - 1) - 0.5,
    spacingCurve: curve,
    target,
  }))
}

function depthSequence(originZ: number): readonly number[] {
  if (originZ > 0.3) return [DEPTH_BY_LAYER.frontAir, DEPTH_BY_LAYER.midAir, DEPTH_BY_LAYER.deepAir]
  if (originZ < -0.3) return [DEPTH_BY_LAYER.deepAir, DEPTH_BY_LAYER.midAir, DEPTH_BY_LAYER.frontAir]
  return [DEPTH_BY_LAYER.midAir, DEPTH_BY_LAYER.frontAir, DEPTH_BY_LAYER.deepAir]
}

const QUALITY_SCALABLE_PROFESSIONAL_PRIMITIVES = new Set<LaserDmxShowDirectorOpticalPrimitiveType>([
  'fan', 'layeredFan', 'parallelBank', 'sheet', 'tunnel', 'mirroredCorridor',
  'canopy', 'audienceRake', 'apertureBurst',
])

function rayCount(input: BuildLaserDmxPrimitivePlanInput, minimum = 1): number {
  // The role-aware scene budget is authoritative for scalable professional
  // structures. Authored rayCount remains the baseline request, while High and
  // Ultra may allocate additional coherent samples without changing fan width.
  const qualityScalable = QUALITY_SCALABLE_PROFESSIONAL_PRIMITIVES.has(input.fixture.optics.primitiveType)
  const requested = input.fixture.optics.primitiveType === 'auto' || qualityScalable
    ? input.allocatedRayCount
    : Math.min(input.allocatedRayCount, input.fixture.optics.rayCount)
  return Math.max(minimum, Math.min(LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS, Math.round(requested)))
}

function fanPoints(input: BuildLaserDmxPrimitivePlanInput, layered: boolean): LaserDmxPrimitivePoint[] {
  const count = rayCount(input, 1)
  const width = clamp(input.fixture.optics.fanWidth || input.fixture.beam.beamSpread, 0, 180)
  const angle = input.fixture.rotation + input.fixture.beam.beamAngle
  const curve: LaserDmxFanSpacingCurve = count >= 7 ? 'centerWeighted' : 'linear'
  const depths = depthSequence(input.origin.z)
  const expandedLayer = layered && count > Math.max(1, Math.round(input.fixture.optics.rayCount))
  return createLaserDmxFanRayParameters(count, width, curve).map(ray => {
    // Quality-expanded layered fans use a center-symmetric depth cadence. A
    // mirrored source therefore receives the same front/mid/rear sequence when
    // its angular ordering reverses, preserving left/right bank balance.
    const depthIndex = expandedLayer
      ? Math.min(ray.index, count - 1 - ray.index) % depths.length
      : ray.index % depths.length
    return visibleRayEnd(
      input.origin,
      angle + ray.offsetDeg,
      0.78,
      layered ? depths[depthIndex] : input.origin.z,
    )
  })
}

function parallelBankPoints(input: BuildLaserDmxPrimitivePlanInput): LaserDmxPrimitivePoint[] {
  const count = rayCount(input, 1)
  const angle = input.fixture.rotation + input.fixture.beam.beamAngle
  const normal = (angle + 90) * Math.PI / 180
  const spacing = clamp(input.fixture.optics.fanWidth / 180, 0.04, 0.32)
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1) - 0.5
    const shifted = {
      x: clamp01(input.origin.x + Math.cos(normal) * t * spacing),
      y: clamp01(input.origin.y + Math.sin(normal) * t * spacing),
      z: input.origin.z,
    }
    return visibleRayEnd(shifted, angle, 0.76, input.origin.z)
  })
}

function sheetPoints(input: BuildLaserDmxPrimitivePlanInput): LaserDmxPrimitivePoint[] {
  const count = rayCount(input, 3)
  const width = clamp(input.fixture.optics.fanWidth / 180, 0.18, 0.88)
  const horizontal = Math.abs(Math.cos((input.fixture.rotation + input.fixture.beam.beamAngle) * Math.PI / 180)) > 0.55
  const fixed = horizontal ? clamp01(input.origin.y + 0.52) : clamp01(input.origin.x + 0.52)
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0.5 : index / (count - 1)
    const span = 0.5 + (t - 0.5) * width
    return horizontal
      ? { x: clamp01(span), y: fixed, z: input.origin.z }
      : { x: fixed, y: clamp01(span), z: input.origin.z }
  })
}

function tunnelPoints(input: BuildLaserDmxPrimitivePlanInput, mirrored: boolean): LaserDmxPrimitivePoint[] {
  const count = rayCount(input, 4)
  const depths = depthSequence(input.origin.z)
  const half = Math.max(2, Math.ceil(count / 2))
  const points: LaserDmxPrimitivePoint[] = []
  for (let index = 0; index < count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const tier = Math.floor(index / 2)
    const progress = half <= 1 ? 0 : tier / (half - 1)
    const inset = 0.06 + progress * 0.2
    const y = 0.72 - progress * 0.5
    points.push({
      x: mirrored ? 0.5 + side * (0.44 - inset) : clamp01(input.origin.x + side * (0.18 + progress * 0.18)),
      y: clamp01(y),
      z: depths[tier % depths.length],
    })
  }
  return points
}

function canopyPoints(input: BuildLaserDmxPrimitivePlanInput, audienceRake = false): LaserDmxPrimitivePoint[] {
  const count = rayCount(input, 3)
  const z = audienceRake ? DEPTH_BY_LAYER.cameraFacingAir : DEPTH_BY_LAYER.upperAir
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0.5 : index / (count - 1)
    return {
      x: clamp01(0.08 + t * 0.84),
      y: audienceRake ? clamp01(0.62 + Math.abs(t - 0.5) * 0.24) : clamp01(0.14 + Math.abs(t - 0.5) * 0.12),
      z,
      depthLayer: audienceRake ? 'cameraFacingAir' : 'upperAir',
    }
  })
}

function diamondPoints(input: BuildLaserDmxPrimitivePlanInput): LaserDmxPrimitivePoint[] {
  const points = [
    { x: 0.5, y: 0.16, z: DEPTH_BY_LAYER.deepAir },
    { x: 0.78, y: 0.5, z: DEPTH_BY_LAYER.midAir },
    { x: 0.5, y: 0.82, z: DEPTH_BY_LAYER.frontAir },
    { x: 0.22, y: 0.5, z: DEPTH_BY_LAYER.midAir },
  ]
  return points.slice(0, rayCount(input, 4))
}

function rotatingLatticePoints(input: BuildLaserDmxPrimitivePlanInput): LaserDmxPrimitivePoint[] {
  const count = rayCount(input, 4)
  const stablePhase = (stableHash(`${input.fixture.semanticKey}:${input.occurrenceSeed}`) % 360) * Math.PI / 180
  const phraseRotation = input.phraseIndex * Math.PI / 8
  const timeRotation = input.audioTimeSec * 0.12
  const radius = clamp(input.fixture.optics.fanWidth / 240, 0.18, 0.42)
  return Array.from({ length: count }, (_, index) => {
    const angle = stablePhase + phraseRotation + timeRotation + index / count * Math.PI * 2
    return {
      x: clamp01(0.5 + Math.cos(angle) * radius),
      y: clamp01(0.5 + Math.sin(angle) * radius * 0.72),
      z: depthSequence(input.origin.z)[index % 3],
    }
  })
}

function scannerWavePoints(input: BuildLaserDmxPrimitivePlanInput): LaserDmxPrimitivePoint[] {
  const count = rayCount(input, 3)
  const phraseDirection = input.phraseIndex % 2 === 0 ? 1 : -1
  const phase = input.audioTimeSec * 0.55 * phraseDirection + input.beatIndex * 0.03
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0.5 : index / (count - 1)
    return {
      x: clamp01(0.08 + t * 0.84),
      y: clamp01(0.5 + Math.sin((t + phase) * Math.PI * 2) * 0.28),
      z: depthSequence(input.origin.z)[index % 3],
    }
  })
}

function burstPoints(input: BuildLaserDmxPrimitivePlanInput): LaserDmxPrimitivePoint[] {
  const count = rayCount(input, 5)
  const phase = (stableHash(input.fixture.id) % 360) * Math.PI / 180
  return Array.from({ length: count }, (_, index) => {
    const angle = phase + index / count * Math.PI * 2
    return visibleRayEnd(input.origin, angle * 180 / Math.PI, 0.62, input.origin.z)
  })
}

export function buildLaserDmxOpticalPrimitivePlan(input: BuildLaserDmxPrimitivePlanInput): LaserDmxPrimitivePlan {
  const primitiveType = resolveLaserDmxOpticalPrimitiveType(input.fixture)
  let points: LaserDmxPrimitivePoint[]
  let curve: LaserDmxFanSpacingCurve = 'linear'

  switch (primitiveType) {
    case 'layeredFan': points = fanPoints(input, true); curve = 'centerWeighted'; break
    case 'parallelBank': points = parallelBankPoints(input); break
    case 'crossBank': {
      const count = rayCount(input, 2)
      const angle = input.fixture.rotation + input.fixture.beam.beamAngle
      const spread = clamp(input.fixture.optics.fanWidth, 12, 120)
      points = Array.from({ length: count }, (_, index) => {
        const side = index % 2 === 0 ? -1 : 1
        const tier = Math.floor(index / 2)
        return visibleRayEnd(input.origin, angle + side * spread * (0.35 + tier * 0.12), 0.78, depthSequence(input.origin.z)[tier % 3])
      })
      break
    }
    case 'sheet': points = sheetPoints(input); break
    case 'tunnel': points = tunnelPoints(input, false); break
    case 'mirroredCorridor': points = tunnelPoints(input, true); break
    case 'canopy': points = canopyPoints(input); break
    case 'audienceRake': points = canopyPoints(input, true); break
    case 'diamondPlane': points = diamondPoints(input); break
    case 'rotatingLattice': points = rotatingLatticePoints(input); break
    case 'apertureBurst': points = burstPoints(input); curve = 'edgeWeighted'; break
    case 'scannerWave': points = scannerWavePoints(input); break
    case 'washCone': points = fanPoints({ ...input, allocatedRayCount: Math.min(input.allocatedRayCount, Math.max(3, input.fixture.optics.rayCount)) }, false); curve = 'centerWeighted'; break
    case 'blinderBank': points = burstPoints({ ...input, allocatedRayCount: Math.min(input.allocatedRayCount, 4) }); break
    case 'strobeField': points = burstPoints({ ...input, allocatedRayCount: Math.min(input.allocatedRayCount, 4) }); break
    case 'co2Burst': points = [visibleRayEnd(input.origin, -90, 0.42, DEPTH_BY_LAYER.lowerAir)]; break
    case 'fan':
    default: points = fanPoints(input, false); curve = 'centerWeighted'; break
  }

  const rays = makeRays(points.slice(0, Math.max(0, input.allocatedRayCount)), curve)
  return {
    primitiveType,
    rays,
    coherent: true,
    depthPlaneCount: new Set(rays.map(ray => ray.target.z.toFixed(3))).size,
    sourceCount: 1,
  }
}
