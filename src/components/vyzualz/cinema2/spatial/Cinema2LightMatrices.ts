/**
 * Small column-major 4x4 helpers (GL convention: clip z in [-1, 1]) for building light view/projection matrices in double precision.
 * Plain `number[]` so callers can keep double precision until the final upload.
 */
export type Cinema2Mat4 = number[]

export function identityMatrix(): Cinema2Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

/** `a * b`: applies `b` first. */
export function multiplyMatrices(a: readonly number[], b: readonly number[]): Cinema2Mat4 {
  const out = new Array<number>(16).fill(0)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row]! * b[column * 4 + k]!
      out[column * 4 + row] = sum
    }
  }
  return out
}

export function translationMatrix(x: number, y: number, z: number): Cinema2Mat4 {
  const m = identityMatrix()
  m[12] = x
  m[13] = y
  m[14] = z
  return m
}

export function normalizeVector(v: readonly [number, number, number], fallback: readonly [number, number, number] = [0, 0, -1]): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2])
  return length > 1e-9 ? [v[0] / length, v[1] / length, v[2] / length] : [fallback[0], fallback[1], fallback[2]]
}

export function crossVectors(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
}

export function dotVectors(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
}

/** Orthonormal light basis for a view direction: `right`, `up` (world up unless the light looks almost straight up/down) and `forward`. */
export function lightBasis(direction: readonly [number, number, number]): { right: [number, number, number]; up: [number, number, number]; forward: [number, number, number] } {
  const forward = normalizeVector(direction)
  const worldUp: [number, number, number] = Math.abs(forward[1]) > 0.99 ? [0, 0, -1] : [0, 1, 0]
  const right = normalizeVector(crossVectors(forward, worldUp), [1, 0, 0])
  const up = normalizeVector(crossVectors(right, forward), [0, 1, 0])
  return { right, up, forward }
}

/** View matrix for an eye looking along `forward` with the given basis. */
export function viewMatrixFromBasis(eye: readonly number[], basis: { right: readonly number[]; up: readonly number[]; forward: readonly number[] }): Cinema2Mat4 {
  const { right, up, forward } = basis
  return [
    right[0]!, up[0]!, -forward[0]!, 0,
    right[1]!, up[1]!, -forward[1]!, 0,
    right[2]!, up[2]!, -forward[2]!, 0,
    -dotVectors(right, eye), -dotVectors(up, eye), dotVectors(forward, eye), 1,
  ]
}

export function orthographicMatrix(left: number, right: number, bottom: number, top: number, near: number, far: number): Cinema2Mat4 {
  return [
    2 / (right - left), 0, 0, 0,
    0, 2 / (top - bottom), 0, 0,
    0, 0, -2 / (far - near), 0,
    -(right + left) / (right - left), -(top + bottom) / (top - bottom), -(far + near) / (far - near), 1,
  ]
}

export function perspectiveMatrix(fovYRadians: number, aspect: number, near: number, far: number): Cinema2Mat4 {
  const f = 1 / Math.tan(fovYRadians / 2)
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ]
}
