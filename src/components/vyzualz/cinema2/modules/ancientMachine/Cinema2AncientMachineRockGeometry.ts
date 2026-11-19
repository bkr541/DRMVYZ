type Vector = readonly [number, number, number]

// Closed 20-face shell. Each profile reshapes the crown, shoulder, and foot independently.
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2
const CORNERS: readonly Vector[] = [
  [-1, GOLDEN_RATIO, 0], [1, GOLDEN_RATIO, 0], [-1, -GOLDEN_RATIO, 0], [1, -GOLDEN_RATIO, 0],
  [0, -1, GOLDEN_RATIO], [0, 1, GOLDEN_RATIO], [0, -1, -GOLDEN_RATIO], [0, 1, -GOLDEN_RATIO],
  [GOLDEN_RATIO, 0, -1], [GOLDEN_RATIO, 0, 1], [-GOLDEN_RATIO, 0, -1], [-GOLDEN_RATIO, 0, 1],
]
const FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
] as const

const PROFILES = [
  { length: .84, crown: .40, shear: .14, taper: .16 },
  { length: .72, crown: .47, shear: -.17, taper: -.18 },
  { length: .98, crown: .33, shear: .06, taper: .23 },
] as const
export const ANCIENT_MACHINE_ROCK_VARIANT_COUNT = PROFILES.length

/** Facet-local UVs and tangents project the existing stone material over the new silhouettes. */
export function buildCinema2AncientMachineRockGeometry(variant: number): { vertices: Float32Array; indices: Uint16Array } {
  const profile = PROFILES[variant]!
  const corners = CORNERS.map(([x, y, z], index): Vector => {
    const chip = .92 + .12 * Math.sin(index * 3.73 + variant * 2.18)
    const height = y / GOLDEN_RATIO
    const width = (1 - height * profile.taper) * chip
    return [
      Math.max(-.5, Math.min(.5, x * .30 * width + height * profile.shear)) * profile.length,
      Math.max(-.46, Math.min(profile.crown, y * .32 * chip + z * .055)),
      Math.max(-.5, Math.min(.5, (z * .32 + x * .047) * width)),
    ]
  })
  const vertices: number[] = []
  for (const [a, b, c] of FACES) {
    const points = [corners[a]!, corners[b]!, corners[c]!] as const
    const normal = unit(cross(subtract(points[1], points[0]), subtract(points[2], points[0])))
    const tangent = unit(cross(Math.abs(normal[1]) < .85 ? [0, 1, 0] : [0, 0, 1], normal))
    const bitangent = cross(normal, tangent)
    for (const point of points) {
      const u = .5 + dot(point, tangent) * .65
      const v = .5 + dot(point, bitangent) * .65
      vertices.push(...point, ...normal, u, v, ...tangent)
    }
  }
  return { vertices: new Float32Array(vertices), indices: Uint16Array.from({ length: FACES.length * 3 }, (_, index) => index) }
}

function dot(a: Vector, b: Vector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: Vector, b: Vector): Vector {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function subtract(a: Vector, b: Vector): Vector {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function unit(a: Vector): Vector {
  const length = Math.hypot(...a)
  return [a[0] / length, a[1] / length, a[2] / length]
}
