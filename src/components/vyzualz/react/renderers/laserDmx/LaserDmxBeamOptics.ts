import type {
  LaserDmxMatrixBeamVisualRole,
  LaserDmxShowDirectorBeamTargetMode,
  LaserDmxShowDirectorFixtureKind,
} from '../../ReactTypes'
import type { LaserDmxShowDirectorBeamPriorityRole } from '../../LaserDmxShowDirectorPerformanceProgram'

export type LaserDmxBeamStructure =
  | 'single'
  | 'narrowFan'
  | 'wideFan'
  | 'parallelBank'
  | 'mirroredFan'
  | 'crossBank'
  | 'layeredFan'

export type LaserDmxFanSpacingCurve = 'linear' | 'centerWeighted' | 'edgeWeighted'

export interface LaserDmxFanRayParameter {
  index: number
  normalizedIndex: number
  spacingT: number
  offsetDeg: number
}

export interface LaserDmxBeamOpticalProfile {
  width: number
  divergence: number
  scatterEnvelopeWidth: number
  opacity: number
  coreIntensity: number
}

export const LASER_DMX_VISUAL_ROLE_PRIORITY: Readonly<Record<LaserDmxMatrixBeamVisualRole, number>> = Object.freeze({
  hero: 0,
  impact: 0,
  primary: 1,
  secondary: 2,
  texture: 3,
})

export const LASER_DMX_PRIORITY_ROLE_TO_VISUAL_ROLE: Readonly<Record<LaserDmxShowDirectorBeamPriorityRole, LaserDmxMatrixBeamVisualRole>> = Object.freeze({
  heroImpact: 'hero',
  primaryArchitecture: 'primary',
  secondaryFan: 'secondary',
  detailLattice: 'texture',
  decorativeAccent: 'texture',
})

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function curvedSpacing(value: number, curve: LaserDmxFanSpacingCurve): number {
  const sign = value < 0 ? -1 : 1
  const magnitude = Math.abs(value)
  if (curve === 'centerWeighted') return sign * Math.pow(magnitude, 1.28)
  if (curve === 'edgeWeighted') return sign * Math.pow(magnitude, 0.72)
  return value
}

export function createLaserDmxFanRayParameters(
  count: number,
  spreadDeg: number,
  curve: LaserDmxFanSpacingCurve = 'linear',
): LaserDmxFanRayParameter[] {
  const safeCount = Math.max(1, Math.round(Number.isFinite(count) ? count : 1))
  const safeSpread = clamp(spreadDeg, 0, 180)
  return Array.from({ length: safeCount }, (_, index) => {
    const normalizedIndex = safeCount === 1 ? 0.5 : index / (safeCount - 1)
    const linearT = normalizedIndex - 0.5
    const spacingT = curvedSpacing(linearT * 2, curve) * 0.5
    return {
      index,
      normalizedIndex,
      spacingT,
      offsetDeg: spacingT * safeSpread,
    }
  })
}

/**
 * Selects stable ray indices while preserving both fan edges and the center.
 * This is shared by scene generation and the compatibility compiler so a
 * partially allocated fan keeps the same geometry in WebGL and Canvas2D.
 */
export function selectDeterministicLaserDmxRayIndices(totalCount: number, keepCount: number): number[] {
  const total = Math.max(0, Math.round(Number.isFinite(totalCount) ? totalCount : 0))
  const keep = Math.max(0, Math.min(total, Math.round(Number.isFinite(keepCount) ? keepCount : 0)))
  if (keep === 0 || total === 0) return []
  if (keep >= total) return Array.from({ length: total }, (_, index) => index)
  if (keep === 1) return [Math.floor((total - 1) / 2)]

  const selected = new Set<number>()
  for (let index = 0; index < keep; index += 1) {
    selected.add(Math.round((index * (total - 1)) / (keep - 1)))
  }
  // Integer rounding can collide for unusual inputs. Fill the nearest gaps in
  // deterministic center-out order without changing already selected edges.
  if (selected.size < keep) {
    const center = (total - 1) * 0.5
    const candidates = Array.from({ length: total }, (_, index) => index)
      .filter(index => !selected.has(index))
      .sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b)
    for (const candidate of candidates) {
      selected.add(candidate)
      if (selected.size >= keep) break
    }
  }
  return [...selected].sort((a, b) => a - b)
}

export function resolveLaserDmxBeamStructure(input: {
  targetMode: LaserDmxShowDirectorBeamTargetMode
  spreadDeg: number
  rayCount: number
  distinctDepthPlanes?: number
  semanticKey?: string
}): LaserDmxBeamStructure {
  const semantic = (input.semanticKey ?? '').toLowerCase()
  if (input.rayCount <= 1) return 'single'
  if ((input.distinctDepthPlanes ?? 1) > 1 || semantic.includes('layered')) return 'layeredFan'
  if (input.targetMode === 'mirror' || semantic.includes('mirror')) return 'mirroredFan'
  if (input.targetMode === 'cross' || semantic.includes('cross')) return 'crossBank'
  if (semantic.includes('parallel') || input.targetMode === 'fixed') return 'parallelBank'
  if (input.targetMode === 'fan') return input.spreadDeg >= 42 ? 'wideFan' : 'narrowFan'
  return 'parallelBank'
}

export function resolveLaserDmxWhiteHotMix(intensity: number, coreIntensity: number): number {
  const energy = clamp01(intensity) * (0.55 + clamp01(coreIntensity) * 0.45)
  return smoothstep(0.68, 0.96, energy)
}

export function resolveLaserDmxCoreIntensity(intensity: number, focus: number, visualRole: LaserDmxMatrixBeamVisualRole): number {
  const roleLift = visualRole === 'hero' || visualRole === 'impact'
    ? 0.16
    : visualRole === 'primary'
      ? 0.08
      : visualRole === 'texture'
        ? -0.08
        : 0
  return clamp01(clamp01(intensity) * (0.44 + clamp01(focus) * 0.62) + roleLift)
}

export function resolveLaserDmxBeamOpticalProfile(input: {
  fixtureKind: LaserDmxShowDirectorFixtureKind
  intensity: number
  focus: number
  spreadDeg: number
  width?: number
  divergence?: number
  glow?: number
  opacity?: number
  opticalSoftness?: number
  zoom?: number
  iris?: number
  frost?: number
  visualRole: LaserDmxMatrixBeamVisualRole
}): LaserDmxBeamOpticalProfile {
  const isLaser = input.fixtureKind === 'laser'
  const isMovingHead = input.fixtureKind === 'movingHead'
  const isWash = input.fixtureKind === 'parWash'
  const focus = clamp01(input.focus)
  const spread = clamp(input.spreadDeg, 0, 180)
  const authoredWidth = clamp(input.width ?? 1, 0.1, 8)
  const softness = clamp01(input.opticalSoftness ?? (isLaser ? 0.08 : isWash ? 0.72 : 0.34))
  const zoom = clamp01(input.zoom ?? (isMovingHead ? 0.45 : isWash ? 0.78 : 0.2))
  const iris = clamp01(input.iris ?? 1)
  const frost = clamp01(input.frost ?? 0)
  const fixtureDivergence = isLaser
    ? spread / 320
    : isMovingHead
      ? 0.12 + zoom * 0.5
      : isWash
        ? 0.32 + zoom * 0.58
        : spread / 180
  const divergence = clamp01(input.divergence ?? fixtureDivergence)
  const glow = clamp01(input.glow ?? 0.72)
  const roleWidth = input.visualRole === 'hero' || input.visualRole === 'impact'
    ? 1.08
    : input.visualRole === 'texture'
      ? 0.82
      : 1
  const materialWidth = isLaser ? 0.72 : isMovingHead ? 1.85 : isWash ? 3.1 : 1.35
  const apertureShape = clamp(0.24 + iris * 0.76, 0.2, 1)
  const width = clamp(authoredWidth * roleWidth * materialWidth * apertureShape * (1 + frost * 0.42), 0.1, 8)
  const scatterEnvelopeWidth = clamp(
    (isLaser ? 1.85 : isMovingHead ? 3.8 : isWash ? 5.2 : 2.8)
      + glow * 2.4
      + divergence * 3.4
      + softness * 2.8
      + frost * 2.2
      + (1 - focus) * 1.2,
    1.6,
    12,
  )
  return {
    width,
    divergence,
    scatterEnvelopeWidth,
    opacity: clamp01(input.opacity ?? (isWash ? 0.42 + glow * 0.22 : 0.54 + glow * 0.34)),
    coreIntensity: resolveLaserDmxCoreIntensity(
      input.intensity,
      isLaser ? focus : focus * (1 - softness * 0.42),
      input.visualRole,
    ) * (isLaser ? 1 : isWash ? 0.38 : 0.68),
  }
}

export function stableLaserDmxPhase(identity: string): number {
  let hash = 2166136261
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 0xffffffff
}
