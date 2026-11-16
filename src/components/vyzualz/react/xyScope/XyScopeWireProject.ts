// Sound Drawing XY › WIREFRAME: placement and projection. The chain is the guide's §14: rotate with quaternions (no gimbal lock), move into
// camera space, project to 2D with a clip against the near plane first, then decide which edges are hidden. Perspective is a creative
// control, not a switch: 0 is orthographic (no foreshortening, as scope art often wants), 1 is a full pinhole camera.

export type Quat = readonly [x: number, y: number, z: number, w: number]
export const IDENTITY_QUAT: Quat = [0, 0, 0, 1]

export function quatFromAxisAngle(x: number, y: number, z: number, angle: number): Quat {
  const length = Math.hypot(x, y, z) || 1, half = angle / 2, s = Math.sin(half) / length
  return [x * s, y * s, z * s, Math.cos(half)]
}

/** Hamilton product: the rotation `b` followed by `a`. */
export function quatMul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}

export function quatNormalize(q: Quat): Quat {
  const length = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length]
}

/** Rotates (x, y, z) by a unit quaternion and writes the result into `out` at `offset`. */
export function quatRotate(q: Quat, x: number, y: number, z: number, out: Float32Array | Float64Array, offset = 0): void {
  const [qx, qy, qz, qw] = q
  // t = 2 · (q.xyz × v); v' = v + w·t + q.xyz × t
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x)
  out[offset] = x + qw * tx + (qy * tz - qz * ty)
  out[offset + 1] = y + qw * ty + (qz * tx - qx * tz)
  out[offset + 2] = z + qw * tz + (qx * ty - qy * tx)
}

export interface WireCamera {
  /** 0 is orthographic; 1 is a full pinhole camera. */
  perspective: number
  /** Distance from the camera to the figure's centre along the view axis. */
  distance: number
  /** Points closer than this to the camera are not drawn (the division by depth would blow up). */
  near: number
}
export const DEFAULT_WIRE_CAMERA: WireCamera = Object.freeze({ perspective: .45, distance: 9, near: 1 })

/** Depth in front of the camera for a world point (the camera sits on +z looking down −z). */
export function depthOf(z: number, camera: WireCamera): number {
  return camera.distance - z
}

/**
 * Projects a camera-space point (+x right, +y up, +z toward the viewer). Writes screen x, y (y up) into `out` and returns false when the
 * point is nearer than the near plane, in which case the depth is clamped to the plane so the result is still finite.
 */
export function projectPoint(x: number, y: number, z: number, camera: WireCamera, out: Float32Array | Float64Array, offset = 0): boolean {
  const depth = depthOf(z, camera), visible = depth >= camera.near
  const safe = Math.max(depth, camera.near)
  const scale = 1 + (camera.distance / safe - 1) * camera.perspective
  out[offset] = x * scale
  out[offset + 1] = y * scale
  return visible
}

/** Twice the signed area of a projected polygon (positive when its corners run counter-clockwise on screen). */
export function signedArea(xy: Float32Array | Float64Array, corners: ArrayLike<number>, base: number, count = 4): number {
  let sum = 0
  for (let i = 0; i < count; i++) {
    const a = corners[base + i] * 2, b = corners[base + (i + 1) % count] * 2
    sum += xy[a] * xy[b + 1] - xy[b] * xy[a + 1]
  }
  return sum
}

/**
 * Which edges are hidden behind the figure: an edge is hidden when every face that borders it faces away from the camera. A face faces
 * away when its projected outline runs clockwise. Edges that border no face are never hidden. Writes 1 for hidden edges into `hidden`.
 */
export function findHiddenEdges(faces: ArrayLike<number>, edgeFaces: ArrayLike<number>, projected: Float32Array | Float64Array, edgeStart: number, edgeCount: number, hidden: Uint8Array): void {
  for (let e = edgeStart; e < edgeStart + edgeCount; e++) {
    let bordering = 0, away = 0
    for (let slot = 0; slot < 2; slot++) {
      const face = edgeFaces[e * 2 + slot]
      if (face < 0) continue
      bordering++
      if (signedArea(projected, faces, face * 4) <= 0) away++
    }
    hidden[e] = bordering > 0 && away === bordering ? 1 : 0
  }
}
