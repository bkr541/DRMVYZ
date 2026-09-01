import type { CinemaVector3 } from './CinemaDomain'
import { createCinemaObjectModelMatrix, type CinemaObject3DMaterial } from './CinemaObject3DRenderer'
import type { Cinema3DObjectDefinition } from './Cinema3DObjectState'
import type { CinemaBounds3D } from './CinemaVectorGeometry'

export type CinemaWorld3DObjectNormalization =
  | Readonly<{ mode: 'none' }>
  | Readonly<{ mode: 'fit-max-dimension'; size: number }>

export interface CinemaWorld3DObjectAnchor {
  id: string
  visible?: boolean
  transform?: Readonly<{
    position?: CinemaVector3
    rotation?: CinemaVector3
    scale?: CinemaVector3
  }>
  normalization?: CinemaWorld3DObjectNormalization
  materialDefaults?: Readonly<CinemaObject3DMaterial>
  /** Anchor-local point used for camera focus. Bounds center is used when omitted. */
  focusAnchor?: CinemaVector3
  framingPadding?: number
}

export interface CinemaWorld3DObjectPlacement {
  modelMatrix: Float32Array
  worldBounds: Readonly<CinemaBounds3D>
  focusAnchor: CinemaVector3
  framingPadding: number
}

export interface CinemaWorld3DObjectCameraFocus {
  target: CinemaVector3
  boundingRadius: number
  framingDistance: number
  suggestedNear: number
  suggestedFar: number
}

const ZERO: CinemaVector3 = Object.freeze([0, 0, 0])
const ONE: CinemaVector3 = Object.freeze([1, 1, 1])

export function resolveCinemaWorld3DObjectPlacement(
  definition: Readonly<Cinema3DObjectDefinition>,
  localBounds: Readonly<CinemaBounds3D>,
  anchor: Readonly<CinemaWorld3DObjectAnchor>,
): Readonly<CinemaWorld3DObjectPlacement> {
  const objectScale = definition.transform.scale
  const objectModel = createCinemaObjectModelMatrix({
    position: definition.transform.position,
    rotation: definition.transform.rotation,
    scale: [objectScale[0], objectScale[1], objectScale[2] * definition.geometry.extrusionDepth],
    pivot: definition.geometry.pivotPolicy === 'center' ? localBounds.center : ZERO,
  })
  const normalizationScale = resolveNormalizationScale(localBounds, anchor.normalization)
  const anchorScale = anchor.transform?.scale ?? ONE
  const anchorModel = createCinemaObjectModelMatrix({
    position: anchor.transform?.position ?? ZERO,
    rotation: anchor.transform?.rotation ?? ZERO,
    scale: [
      anchorScale[0] * normalizationScale,
      anchorScale[1] * normalizationScale,
      anchorScale[2] * normalizationScale,
    ],
    pivot: ZERO,
  })
  const modelMatrix = multiplyCinemaMat4(anchorModel, objectModel)
  const worldBounds = transformCinemaBounds(localBounds, modelMatrix)
  const focusAnchor = anchor.focusAnchor
    ? transformCinemaPoint(anchorModel, anchor.focusAnchor)
    : worldBounds.center
  return Object.freeze({
    modelMatrix,
    worldBounds,
    focusAnchor: Object.freeze([...focusAnchor]) as CinemaVector3,
    framingPadding: Math.max(1, finiteOr(anchor.framingPadding, 1.2)),
  })
}

export function resolveCinemaWorld3DObjectCameraFocus(
  bounds: Readonly<CinemaBounds3D>,
  fovDegrees: number,
  padding = 1.2,
  target: CinemaVector3 = bounds.center,
): Readonly<CinemaWorld3DObjectCameraFocus> {
  const halfX = Math.abs(bounds.size[0]) * 0.5
  const halfY = Math.abs(bounds.size[1]) * 0.5
  const halfZ = Math.abs(bounds.size[2]) * 0.5
  const boundingRadius = Math.max(0.001, Math.hypot(halfX, halfY, halfZ))
  const safeFovDegrees = clamp(finiteOr(fovDegrees, 58), 1, 179)
  const halfFov = safeFovDegrees * Math.PI / 360
  const framingDistance = Math.max(boundingRadius, boundingRadius / Math.tan(halfFov)) * Math.max(1, finiteOr(padding, 1.2))
  const suggestedNear = Math.max(0.001, framingDistance - boundingRadius * 2.5)
  const suggestedFar = Math.max(suggestedNear + 0.001, framingDistance + boundingRadius * 4)
  return Object.freeze({
    target: Object.freeze([...target]) as CinemaVector3,
    boundingRadius,
    framingDistance,
    suggestedNear,
    suggestedFar,
  })
}

export function transformCinemaBounds(
  bounds: Readonly<CinemaBounds3D>,
  matrix: ArrayLike<number>,
): Readonly<CinemaBounds3D> {
  const points: CinemaVector3[] = []
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) points.push(transformCinemaPoint(matrix, [x, y, z]))
    }
  }
  const min: CinemaVector3 = [
    Math.min(...points.map(point => point[0])),
    Math.min(...points.map(point => point[1])),
    Math.min(...points.map(point => point[2])),
  ]
  const max: CinemaVector3 = [
    Math.max(...points.map(point => point[0])),
    Math.max(...points.map(point => point[1])),
    Math.max(...points.map(point => point[2])),
  ]
  return freezeBounds({
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    center: [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5],
  })
}

export function multiplyCinemaMat4(left: ArrayLike<number>, right: ArrayLike<number>): Float32Array {
  const out = new Float32Array(16)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        left[row] * right[column * 4]
        + left[4 + row] * right[column * 4 + 1]
        + left[8 + row] * right[column * 4 + 2]
        + left[12 + row] * right[column * 4 + 3]
    }
  }
  return out
}

export function transformCinemaPoint(matrix: ArrayLike<number>, point: CinemaVector3): CinemaVector3 {
  return [
    matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
    matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
    matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
  ]
}

function resolveNormalizationScale(
  bounds: Readonly<CinemaBounds3D>,
  normalization: CinemaWorld3DObjectNormalization | undefined,
): number {
  if (!normalization || normalization.mode === 'none') return 1
  const maximumDimension = Math.max(Math.abs(bounds.size[0]), Math.abs(bounds.size[1]), Math.abs(bounds.size[2]), 0.000001)
  return Math.max(0.000001, finiteOr(normalization.size, 1)) / maximumDimension
}

function freezeBounds(bounds: CinemaBounds3D): Readonly<CinemaBounds3D> {
  return Object.freeze({
    min: Object.freeze([...bounds.min]) as CinemaVector3,
    max: Object.freeze([...bounds.max]) as CinemaVector3,
    size: Object.freeze([...bounds.size]) as CinemaVector3,
    center: Object.freeze([...bounds.center]) as CinemaVector3,
  })
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value as number : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
