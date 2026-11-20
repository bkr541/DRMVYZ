import type * as Three from 'three'

type ThreeLib = typeof Three

/** Triangle centroids are in the mesh's own (source) coordinates. */
export type CellAssigner = (centroid: Three.Vector3, triangle: number, positions: Three.BufferAttribute) => number

/**
 * Splits a mesh's triangles into separate geometries, one per cell id the assigner returns. Attributes are copied (the source geometry is shared with the
 * asset cache and is never modified), so each cell can be lit on its own.
 */
export function splitGeometryByCell(THREE: ThreeLib, geometry: Three.BufferGeometry, cells: number, assign: CellAssigner): Three.BufferGeometry[] {
  const positions = geometry.getAttribute('position') as Three.BufferAttribute
  const index = geometry.index
  const triangleCount = (index ? index.count : positions.count) / 3
  const vertex = (triangle: number, corner: number) => index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner
  const buckets: number[][] = Array.from({ length: cells }, () => [])
  const centroid = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  for (let triangle = 0; triangle < triangleCount; triangle++) {
    a.fromBufferAttribute(positions, vertex(triangle, 0)); b.fromBufferAttribute(positions, vertex(triangle, 1)); c.fromBufferAttribute(positions, vertex(triangle, 2))
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3)
    const cell = assign(centroid, triangle, positions)
    if (cell >= 0 && cell < cells) buckets[cell]!.push(triangle)
  }
  return buckets.map(triangles => {
    const result = new THREE.BufferGeometry()
    for (const [name, source] of Object.entries(geometry.attributes)) {
      const attribute = source as Three.BufferAttribute
      if ((attribute as unknown as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute) continue
      const size = attribute.itemSize, array = new (attribute.array.constructor as new (length: number) => Three.TypedArray)(triangles.length * 3 * size)
      let at = 0
      for (const triangle of triangles) for (let corner = 0; corner < 3; corner++) {
        const from = vertex(triangle, corner)
        for (let k = 0; k < size; k++) array[at++] = attribute.array[from * size + k]!
      }
      result.setAttribute(name, new THREE.BufferAttribute(array, size, attribute.normalized))
    }
    return result
  })
}

/** Groups triangles that share a vertex position into connected pieces; returns each triangle's piece number and the piece count. */
export function connectedPieces(geometry: Three.BufferGeometry): { piece: Int32Array; count: number } {
  const positions = geometry.getAttribute('position') as Three.BufferAttribute
  const index = geometry.index
  const triangleCount = (index ? index.count : positions.count) / 3
  const parent = new Map<string, string>()
  const key = (vertex: number) => `${Math.round(positions.getX(vertex) * 100)},${Math.round(positions.getY(vertex) * 100)},${Math.round(positions.getZ(vertex) * 100)}`
  const find = (value: string): string => { let root = value; while (parent.get(root) !== root) root = parent.get(root)!; let node = value; while (node !== root) { const next = parent.get(node)!; parent.set(node, root); node = next } return root }
  const keys: [string, string, string][] = []
  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const k = [0, 1, 2].map(corner => key(index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner)) as [string, string, string]
    keys.push(k)
    for (const value of k) if (!parent.has(value)) parent.set(value, value)
    parent.set(find(k[1]), find(k[0])); parent.set(find(k[2]), find(k[0]))
  }
  const numbers = new Map<string, number>(), piece = new Int32Array(triangleCount)
  keys.forEach((k, triangle) => { const root = find(k[0]); if (!numbers.has(root)) numbers.set(root, numbers.size); piece[triangle] = numbers.get(root)! })
  return { piece, count: numbers.size }
}
