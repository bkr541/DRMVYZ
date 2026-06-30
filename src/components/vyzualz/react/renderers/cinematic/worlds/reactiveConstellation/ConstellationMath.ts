export interface ConstellationVec3 {
  x: number
  y: number
  z: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function hashSeed(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return value >>> 0
}

export function seededUnit(seed: number): number {
  let value = seed >>> 0
  value += 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function length3(value: ConstellationVec3): number {
  return Math.hypot(value.x, value.y, value.z)
}

export function normalize3(value: ConstellationVec3): ConstellationVec3 {
  const length = length3(value) || 1
  return { x: value.x / length, y: value.y / length, z: value.z / length }
}

export function subtract3(a: ConstellationVec3, b: ConstellationVec3): ConstellationVec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function distanceSquared3(a: ConstellationVec3, b: ConstellationVec3): number {
  const x = a.x - b.x
  const y = a.y - b.y
  const z = a.z - b.z
  return x * x + y * y + z * z
}

export function perspectiveMatrix(fieldOfViewDegrees: number, aspect: number, near = 0.05, far = 40): Float32Array {
  const f = 1 / Math.tan((fieldOfViewDegrees * Math.PI / 180) / 2)
  const rangeInv = 1 / (near - far)
  return new Float32Array([
    f / Math.max(0.01, aspect), 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * 2 * rangeInv, 0,
  ])
}

export function multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3]
    }
  }
  return out
}

function identityMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])
}

function translationMatrix(x: number, y: number, z: number): Float32Array {
  const out = identityMatrix()
  out[12] = x
  out[13] = y
  out[14] = z
  return out
}

function rotationXMatrix(angle: number): Float32Array {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ])
}

function rotationYMatrix(angle: number): Float32Array {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ])
}

function rotationZMatrix(angle: number): Float32Array {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return new Float32Array([
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])
}

export function cameraViewProjectionMatrix(input: {
  position: ConstellationVec3
  rotation: ConstellationVec3
  fieldOfView: number
  aspect: number
}): Float32Array {
  const translation = translationMatrix(-input.position.x, -input.position.y, -input.position.z)
  const inverseRotation = multiplyMatrices(
    rotationZMatrix(-input.rotation.z),
    multiplyMatrices(rotationYMatrix(-input.rotation.y), rotationXMatrix(-input.rotation.x)),
  )
  const view = multiplyMatrices(inverseRotation, translation)
  return multiplyMatrices(perspectiveMatrix(input.fieldOfView, input.aspect), view)
}
