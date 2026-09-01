import { describe, expect, it } from 'vitest'
import {
  cinemaSignedRingArea,
  extrudeCinemaVectorShape,
  normalizeCinemaVectorShape,
  triangulateCinemaVectorRegion,
  type CinemaPolygonTriangulator,
  type CinemaVectorPoint,
  type CinemaVectorShapeInput,
} from '../index'

const fixtureTriangulator: CinemaPolygonTriangulator = {
  triangulate(vertices, holeIndices) {
    const pointCount = vertices.length / 2
    if (holeIndices.length === 0) {
      const indices: number[] = []
      for (let index = 1; index < pointCount - 1; index += 1) indices.push(0, index, index + 1)
      return indices
    }
    if (pointCount === 8 && holeIndices.length === 1 && holeIndices[0] === 4) {
      return [
        0, 1, 7, 0, 7, 4,
        1, 2, 6, 1, 6, 7,
        2, 3, 5, 2, 5, 6,
        3, 0, 4, 3, 4, 5,
      ]
    }
    throw new Error('Fixture triangulator only supports convex rings and the square-annulus fixture')
  },
}

function rectangle(id: string, minX = 0, minY = 0, maxX = 4, maxY = 2) {
  return {
    id,
    points: [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ] satisfies CinemaVectorPoint[],
  }
}

function shapeWithRegion(
  outer = rectangle('outer'),
  holes: CinemaVectorShapeInput['components'][number]['regions'][number]['holes'] = [],
): CinemaVectorShapeInput {
  return {
    fillRule: 'nonzero',
    components: [{
      id: 'component-a',
      regions: [{ id: 'region-a', outer, holes }],
    }],
  }
}

function triangleZ(mesh: ReturnType<typeof requireMesh>, indexOffset: number): number {
  const a = mesh.indices[indexOffset] * 3
  const b = mesh.indices[indexOffset + 1] * 3
  const c = mesh.indices[indexOffset + 2] * 3
  const ax = mesh.positions[a], ay = mesh.positions[a + 1]
  const bx = mesh.positions[b], by = mesh.positions[b + 1]
  const cx = mesh.positions[c], cy = mesh.positions[c + 1]
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

function requireMesh(result: ReturnType<typeof extrudeCinemaVectorShape>) {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

function triangleNormalDotStoredNormal(mesh: ReturnType<typeof requireMesh>, indexOffset: number): number {
  const ai = mesh.indices[indexOffset] * 3
  const bi = mesh.indices[indexOffset + 1] * 3
  const ci = mesh.indices[indexOffset + 2] * 3
  const abx = mesh.positions[bi] - mesh.positions[ai]
  const aby = mesh.positions[bi + 1] - mesh.positions[ai + 1]
  const abz = mesh.positions[bi + 2] - mesh.positions[ai + 2]
  const acx = mesh.positions[ci] - mesh.positions[ai]
  const acy = mesh.positions[ci + 1] - mesh.positions[ai + 1]
  const acz = mesh.positions[ci + 2] - mesh.positions[ai + 2]
  const crossX = aby * acz - abz * acy
  const crossY = abz * acx - abx * acz
  const crossZ = abx * acy - aby * acx
  return crossX * mesh.normals[ai] + crossY * mesh.normals[ai + 1] + crossZ * mesh.normals[ai + 2]
}

describe('Cinema vector contour normalization', () => {
  it('computes signed area and normalizes outer/hole winding while preserving the anchor point', () => {
    expect(cinemaSignedRingArea([[0, 0], [2, 0], [2, 2], [0, 2]])).toBe(4)
    expect(cinemaSignedRingArea([[0, 0], [0, 2], [2, 2], [2, 0]])).toBe(-4)

    const result = normalizeCinemaVectorShape(shapeWithRegion(
      {
        id: 'outer',
        points: [[0, 0], [0, 10], [10, 10], [10, 0]],
      },
      [{ id: 'hole', points: [[2, 2], [8, 2], [8, 8], [2, 8]] }],
    ))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const region = result.value.components[0].regions[0]
    expect(region.outer.winding).toBe('counter-clockwise')
    expect(region.outer.signedArea).toBe(100)
    expect(region.outer.points[0]).toEqual([0, 0])
    expect(region.holes[0].winding).toBe('clockwise')
    expect(region.holes[0].signedArea).toBe(-36)
    expect(region.holes[0].points[0]).toEqual([2, 2])
  })

  it('removes duplicate consecutive points and redundant terminal closure deterministically', () => {
    const input = shapeWithRegion({
      id: 'outer',
      points: [[0, 0], [4, 0], [4, 1e-12], [4, 2], [0, 2], [0, 0]],
    })
    const first = normalizeCinemaVectorShape(input)
    const second = normalizeCinemaVectorShape(input)
    expect(first).toEqual(second)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.value.components[0].regions[0].outer.points).toEqual([[0, 0], [4, 0], [4, 2], [0, 2]])
  })

  it('accepts multiple disjoint holes and preserves explicit topology identity', () => {
    const result = normalizeCinemaVectorShape(shapeWithRegion(
      rectangle('outer', 0, 0, 12, 8),
      [rectangle('hole-a', 1, 1, 3, 3), rectangle('hole-b', 8, 4, 11, 7)],
    ))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ringCount).toBe(3)
    expect(result.value.components[0].regions[0].holes.map(hole => hole.id)).toEqual(['hole-a', 'hole-b'])
  })

  it('rejects malformed coordinates, source bounds, zero-area, self-intersection, and escaped holes', () => {
    const nonFinite = normalizeCinemaVectorShape(shapeWithRegion({
      id: 'outer',
      points: [[0, 0], [4, 0], [4, Number.POSITIVE_INFINITY], [0, 2]],
    }))
    expect(nonFinite).toMatchObject({ ok: false, error: { code: 'malformed-input' } })

    const malformedBounds = normalizeCinemaVectorShape({
      ...shapeWithRegion(),
      sourceBounds: { min: [0, 0], max: [4, 2], size: [5, 2], center: [2, 1] },
    })
    expect(malformedBounds).toMatchObject({ ok: false, error: { code: 'malformed-input' } })

    const collinear = normalizeCinemaVectorShape(shapeWithRegion({
      id: 'outer',
      points: [[0, 0], [1, 0], [2, 0]],
    }))
    expect(collinear).toMatchObject({ ok: false, error: { code: 'degenerate-input' } })

    const bowTie = normalizeCinemaVectorShape(shapeWithRegion({
      id: 'outer',
      points: [[0, 0], [2, 2], [0, 2], [2, 0]],
    }))
    expect(bowTie).toMatchObject({ ok: false, error: { code: 'invalid-topology' } })

    const escapedHole = normalizeCinemaVectorShape(shapeWithRegion(
      rectangle('outer', 0, 0, 4, 4),
      [rectangle('hole', 3, 3, 5, 5)],
    ))
    expect(escapedHole).toMatchObject({ ok: false, error: { code: 'invalid-topology', ringId: 'hole' } })
  })

  it('enforces caller-provided deterministic input budgets without inventing product limits', () => {
    const result = normalizeCinemaVectorShape(shapeWithRegion(), { limits: { maxInputPoints: 3 } })
    expect(result).toMatchObject({ ok: false, error: { code: 'limit-exceeded' } })
  })
})

describe('Cinema vector triangulation and extrusion', () => {
  it('triangulates a polygon with a hole without filling the hole', () => {
    const normalized = normalizeCinemaVectorShape(shapeWithRegion(
      rectangle('outer', 0, 0, 10, 10),
      [rectangle('hole', 3, 3, 7, 7)],
    ))
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return

    const region = normalized.value.components[0].regions[0]
    const triangulated = triangulateCinemaVectorRegion('component-a', region, fixtureTriangulator)
    expect(triangulated.ok).toBe(true)
    if (!triangulated.ok) return

    let area = 0
    for (let index = 0; index < triangulated.value.indices.length; index += 3) {
      const a = triangulated.value.points[triangulated.value.indices[index]]
      const b = triangulated.value.points[triangulated.value.indices[index + 1]]
      const c = triangulated.value.points[triangulated.value.indices[index + 2]]
      area += Math.abs(cinemaSignedRingArea([a, b, c]))
    }
    expect(area).toBe(84)
  })

  it('uses the shared Earcut adapter for production hole-aware triangulation', () => {
    const normalized = normalizeCinemaVectorShape(shapeWithRegion(
      rectangle('outer', 0, 0, 10, 10),
      [rectangle('hole', 3, 3, 7, 7)],
    ))
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return

    const triangulated = triangulateCinemaVectorRegion('component-a', normalized.value.components[0].regions[0])
    expect(triangulated.ok).toBe(true)
    if (!triangulated.ok) return
    expect(triangulated.value.indices.length).toBeGreaterThan(0)
  })

  it('produces deterministic front, back, and four side walls for a rectangle', () => {
    const first = requireMesh(extrudeCinemaVectorShape(shapeWithRegion(), {}, fixtureTriangulator))
    const second = requireMesh(extrudeCinemaVectorShape(shapeWithRegion(), {}, fixtureTriangulator))

    expect(Array.from(first.positions)).toEqual(Array.from(second.positions))
    expect(Array.from(first.normals)).toEqual(Array.from(second.normals))
    expect(Array.from(first.indices)).toEqual(Array.from(second.indices))
    expect(first.surfaces.front.indexCount).toBe(6)
    expect(first.surfaces.back.indexCount).toBe(6)
    expect(first.surfaces.sides.indexCount).toBe(24)
    expect(first.positions.length / 3).toBe(24)
  })

  it('uses correct front/back winding and face normals', () => {
    const mesh = requireMesh(extrudeCinemaVectorShape(shapeWithRegion(), {}, fixtureTriangulator))
    expect(triangleZ(mesh, mesh.surfaces.front.indexStart)).toBeGreaterThan(0)
    expect(triangleZ(mesh, mesh.surfaces.back.indexStart)).toBeLessThan(0)

    const firstFrontVertex = mesh.indices[mesh.surfaces.front.indexStart] * 3
    const firstBackVertex = mesh.indices[mesh.surfaces.back.indexStart] * 3
    expect(Array.from(mesh.normals.slice(firstFrontVertex, firstFrontVertex + 3))).toEqual([0, 0, 1])
    expect(Array.from(mesh.normals.slice(firstBackVertex, firstBackVertex + 3))).toEqual([0, 0, -1])
  })

  it('generates outward side normals for both outer boundaries and hole cavities', () => {
    const mesh = requireMesh(extrudeCinemaVectorShape(shapeWithRegion(
      rectangle('outer', 0, 0, 10, 10),
      [rectangle('hole', 3, 3, 7, 7)],
    ), {}, fixtureTriangulator))

    const sideNormals = new Set<string>()
    for (let index = mesh.surfaces.sides.indexStart; index < mesh.surfaces.sides.indexStart + mesh.surfaces.sides.indexCount; index += 1) {
      const normalOffset = mesh.indices[index] * 3
      sideNormals.add(`${mesh.normals[normalOffset]},${mesh.normals[normalOffset + 1]},${mesh.normals[normalOffset + 2]}`)
    }
    expect(sideNormals).toEqual(new Set(['0,-1,0', '1,0,0', '0,1,0', '-1,0,0']))

    const holeFirstSideVertex = (8 + 8 + 4 * 4) * 3
    expect(Array.from(mesh.positions.slice(holeFirstSideVertex, holeFirstSideVertex + 3))).toEqual([3, 3, 0.5])
    expect(Array.from(mesh.normals.slice(holeFirstSideVertex, holeFirstSideVertex + 3))).toEqual([1, 0, 0])

    for (let index = mesh.surfaces.sides.indexStart; index < mesh.surfaces.sides.indexStart + mesh.surfaces.sides.indexCount; index += 3) {
      expect(triangleNormalDotStoredNormal(mesh, index)).toBeGreaterThan(0)
    }
  })

  it('retains multiple outer regions inside one semantic component', () => {
    const input: CinemaVectorShapeInput = {
      fillRule: 'nonzero',
      components: [{
        id: 'glyph-i',
        regions: [
          { id: 'stem', outer: rectangle('stem-ring', 0, 0, 1, 4) },
          { id: 'dot', outer: rectangle('dot-ring', 0, 5, 1, 6) },
        ],
      }],
    }
    const mesh = requireMesh(extrudeCinemaVectorShape(input, {}, fixtureTriangulator))
    expect(mesh.components).toHaveLength(1)
    expect(mesh.regions.map(region => region.regionId)).toEqual(['stem', 'dot'])
    expect(mesh.components[0].front.indexCount).toBe(12)
    expect(mesh.bounds.min).toEqual([0, 0, -0.5])
    expect(mesh.bounds.max).toEqual([1, 6, 0.5])
  })

  it('retains disconnected component identity and surface subranges in one indexed mesh', () => {
    const input: CinemaVectorShapeInput = {
      fillRule: 'evenodd',
      components: [
        { id: 'glyph-a', regions: [{ id: 'body', outer: rectangle('a', 0, 0, 2, 2) }] },
        { id: 'glyph-b', regions: [{ id: 'body', outer: rectangle('b', 4, 0, 6, 3) }] },
      ],
    }
    const mesh = requireMesh(extrudeCinemaVectorShape(input, {}, fixtureTriangulator))

    expect(mesh.components.map(component => component.componentId)).toEqual(['glyph-a', 'glyph-b'])
    expect(mesh.components.every(component => component.front.indexCount === 6)).toBe(true)
    expect(mesh.components.every(component => component.back.indexCount === 6)).toBe(true)
    expect(mesh.components.every(component => component.sides.indexCount === 24)).toBe(true)
    expect(mesh.regions.map(region => `${region.componentId}/${region.regionId}`)).toEqual(['glyph-a/body', 'glyph-b/body'])
  })

  it('computes unit-depth bounds, pivot, radius, and output-budget failures', () => {
    const mesh = requireMesh(extrudeCinemaVectorShape(shapeWithRegion(rectangle('outer', -2, -1, 6, 3)), {}, fixtureTriangulator))
    expect(mesh.bounds).toEqual({
      min: [-2, -1, -0.5],
      max: [6, 3, 0.5],
      size: [8, 4, 1],
      center: [2, 1, 0],
    })
    expect(mesh.pivot).toEqual([2, 1, 0])
    expect(mesh.boundingRadius).toBeCloseTo(Math.hypot(4, 2, 0.5))

    const limited = extrudeCinemaVectorShape(shapeWithRegion(), { limits: { maxOutputIndices: 12 } }, fixtureTriangulator)
    expect(limited).toMatchObject({ ok: false, error: { code: 'limit-exceeded' } })

    const normalized = normalizeCinemaVectorShape(shapeWithRegion())
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return
    const normalizedLimited = extrudeCinemaVectorShape(normalized.value, { limits: { maxInputPoints: 3 } }, fixtureTriangulator)
    expect(normalizedLimited).toMatchObject({ ok: false, error: { code: 'limit-exceeded' } })
  })

  it('returns a structured triangulation failure instead of partial mesh output', () => {
    const normalized = normalizeCinemaVectorShape(shapeWithRegion())
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return

    const result = triangulateCinemaVectorRegion(
      'component-a',
      normalized.value.components[0].regions[0],
      { triangulate: () => [0, 1, 99] },
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'triangulation-failed', componentId: 'component-a', regionId: 'region-a' },
    })

    const withHole = normalizeCinemaVectorShape(shapeWithRegion(
      rectangle('outer', 0, 0, 10, 10),
      [rectangle('hole', 3, 3, 7, 7)],
    ))
    expect(withHole.ok).toBe(true)
    if (!withHole.ok) return
    const holeFilled = triangulateCinemaVectorRegion(
      'component-a',
      withHole.value.components[0].regions[0],
      { triangulate: () => [0, 1, 2, 0, 2, 3] },
    )
    expect(holeFilled).toMatchObject({ ok: false, error: { code: 'triangulation-failed' } })
  })

  it('is reachable through the production Cinema public boundary without WebGL', () => {
    const result = extrudeCinemaVectorShape(shapeWithRegion(), {}, fixtureTriangulator)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.positions).toBeInstanceOf(Float32Array)
    expect(result.value.normals).toBeInstanceOf(Float32Array)
    expect(result.value.indices).toBeInstanceOf(Uint32Array)
  })
})
