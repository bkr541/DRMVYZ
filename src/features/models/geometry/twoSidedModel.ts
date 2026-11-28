import { Box3, BufferGeometry, FrontSide, Float32BufferAttribute, Group, Matrix4, Mesh, Vector3, type BufferAttribute, type InterleavedBufferAttribute, type Material, type Side, type SkinnedMesh } from 'three'

/**
 * "Readable from both sides". A solid extrusion shows its own mirror image from behind, so a wordmark reads backwards when the model turns. This keeps the
 * front half of the model (everything on the +Z side of its middle plane, which is where glTF and the generator put the face) and adds a copy of it turned
 * half a turn about the vertical axis through the model's centre as the back half. Seen from the front you see the original face; seen from behind you see the
 * same face, now the right way round. The halves are open at the middle plane and their materials draw front faces only, so each side shows only its own half.
 */
export const TWO_SIDED_NAME = 'TwoSidedModel'

type Attribute = BufferAttribute | InterleavedBufferAttribute

export type TwoSidedSupport = { ok: true } | { ok: false; reason: string }

/** Skinned, morphing and instanced meshes cannot be cut and turned like this. */
export function twoSidedSupport(group: Group): TwoSidedSupport {
  let meshes = 0
  let reason: string | null = null
  group.traverse(object => {
    if (!(object as Mesh).isMesh || (object.userData as { twoSided?: boolean }).twoSided) return
    meshes += 1
    const mesh = object as Mesh
    if ((mesh as unknown as SkinnedMesh).isSkinnedMesh) reason = 'Animated (skinned) models cannot be made two-sided.'
    else if ((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) reason = 'Instanced models cannot be made two-sided.'
    else if (Object.keys(mesh.geometry.morphAttributes).length) reason = 'Models with morph targets cannot be made two-sided.'
  })
  if (!meshes) return { ok: false, reason: 'This model has no geometry.' }
  return reason ? { ok: false, reason } : { ok: true }
}

interface Piece { geometry: BufferGeometry; material: Material | Material[]; name: string; componentId?: string }

/** Keeps the part of a geometry on the +Z side of the plane, cutting the triangles that cross it and interpolating every attribute. Returns null when nothing is left. */
export function clipGeometryToFront(source: BufferGeometry, planeZ: number): BufferGeometry | null {
  const position = source.getAttribute('position')
  if (!position) return null
  const names = Object.keys(source.attributes)
  const attributes = names.map(name => source.getAttribute(name) as Attribute)
  const index = source.getIndex()
  const vertexCount = index ? index.count : position.count
  const groups = source.groups.length ? source.groups : [{ start: 0, count: vertexCount, materialIndex: 0 }]
  const out: number[][] = attributes.map(() => [])
  const outGroups: { start: number; count: number; materialIndex: number }[] = []
  const hasGroups = source.groups.length > 0
  const sizes = attributes.map(attribute => attribute.itemSize)
  const read = (corner: number) => {
    const at = index ? index.getX(corner) : corner
    return attributes.map((attribute, a) => Array.from({ length: sizes[a]! }, (_, c) => [attribute.getX, attribute.getY, attribute.getZ, attribute.getW][c]!.call(attribute, at) as number))
  }
  const positionSlot = names.indexOf('position')
  const normalSlot = names.indexOf('normal')
  const lerp = (a: number[][], b: number[][], t: number) => a.map((values, slot) => {
    const mixed = values.map((value, c) => value + (b[slot]![c]! - value) * t)
    if (slot === normalSlot) { const length = Math.hypot(mixed[0]!, mixed[1]!, mixed[2]!) || 1; return mixed.map(value => value / length) }
    return mixed
  })
  let written = 0
  for (const group of groups) {
    const groupStart = written
    for (let corner = group.start; corner + 2 < group.start + group.count; corner += 3) {
      const triangle = [read(corner), read(corner + 1), read(corner + 2)]
      const distance = triangle.map(vertex => vertex[positionSlot]![2]! - planeZ)
      const polygon: number[][][] = []
      for (let i = 0; i < 3; i += 1) {
        const j = (i + 1) % 3
        if (distance[i]! >= 0) polygon.push(triangle[i]!)
        if ((distance[i]! >= 0) !== (distance[j]! >= 0)) polygon.push(lerp(triangle[i]!, triangle[j]!, distance[i]! / (distance[i]! - distance[j]!)))
      }
      for (let k = 1; k + 1 < polygon.length; k += 1) {
        for (const vertex of [polygon[0]!, polygon[k]!, polygon[k + 1]!]) vertex.forEach((values, slot) => out[slot]!.push(...values))
        written += 3
      }
    }
    if (written > groupStart) outGroups.push({ start: groupStart, count: written - groupStart, materialIndex: group.materialIndex ?? 0 })
  }
  if (!written) return null
  const geometry = new BufferGeometry()
  names.forEach((name, slot) => geometry.setAttribute(name, new Float32BufferAttribute(out[slot]!, sizes[slot]!)))
  if (hasGroups) outGroups.forEach(group => geometry.addGroup(group.start, group.count, group.materialIndex))
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

export interface TwoSidedResult { pieces: Mesh[]; triangles: number; vertices: number }

/**
 * Builds the front and back halves for every mesh in the group, in the group's own space. The new meshes share the originals' materials. Returns null when
 * the model is unsupported or empty. Nothing in the group is changed.
 */
export function buildTwoSidedMeshes(group: Group): TwoSidedResult | null {
  if (!twoSidedSupport(group).ok) return null
  group.updateMatrixWorld(true)
  const inverse = group.matrixWorld.clone().invert()
  const flat: Piece[] = []
  const bounds = new Box3()
  group.traverse(object => {
    const mesh = object as Mesh
    if (!mesh.isMesh || (mesh.userData as { twoSided?: boolean }).twoSided) return
    const geometry = mesh.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld))
    geometry.computeBoundingBox()
    bounds.union(geometry.boundingBox!)
    flat.push({ geometry, material: mesh.material, name: mesh.name || 'Mesh', componentId: mesh.userData.modelComponentId })
  })
  if (!flat.length || bounds.isEmpty()) return null
  const centre = bounds.getCenter(new Vector3())
  // Half a turn about the vertical axis through the centre: x and z mirror about it, y is unchanged, and it stays a rotation so triangle winding is kept.
  const turn = new Matrix4().makeTranslation(centre.x, 0, centre.z).multiply(new Matrix4().makeRotationY(Math.PI)).multiply(new Matrix4().makeTranslation(-centre.x, 0, -centre.z))
  const pieces: Mesh[] = []
  let triangles = 0, vertices = 0
  for (const piece of flat) {
    const front = clipGeometryToFront(piece.geometry, centre.z)
    piece.geometry.dispose()
    if (!front) continue
    const back = front.clone().applyMatrix4(turn)
    back.computeBoundingBox(); back.computeBoundingSphere()
    for (const [side, geometry] of [['front', front], ['back', back]] as const) {
      const mesh = new Mesh(geometry, piece.material)
      mesh.name = `${piece.name}-${side}`
      mesh.userData.twoSided = true
      if (piece.componentId) mesh.userData.modelComponentId = piece.componentId
      pieces.push(mesh)
      triangles += geometry.getAttribute('position').count / 3
      vertices += geometry.getAttribute('position').count
    }
  }
  return pieces.length ? { pieces, triangles, vertices } : null
}

const materialsOf = (mesh: Mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material]

/** Switches the materials the pieces use to draw front faces only (the open middle plane must not show its inside), remembering what to restore. */
function frontFaceOnly(pieces: readonly Mesh[]): () => void {
  const previous = new Map<Material, Side>()
  for (const piece of pieces) for (const material of materialsOf(piece)) if (!previous.has(material)) previous.set(material, material.side)
  for (const material of previous.keys()) material.side = FrontSide
  return () => { for (const [material, side] of previous) { material.side = side; material.needsUpdate = true } }
}

export interface TwoSidedOverlay {
  triangles: number
  vertices: number
  meshes: number
  /** Removes the halves, shows the original meshes again and restores the materials. */
  remove(): void
}

/**
 * Non-destructive form for the live editor: the original meshes are hidden and the two halves are added beside them, so the model can be switched back.
 * (The exporter writes visible meshes only, so a save bakes whichever is showing.)
 */
export function applyTwoSidedOverlay(group: Group): TwoSidedOverlay | null {
  const built = buildTwoSidedMeshes(group)
  if (!built) return null
  const originals: Mesh[] = []
  group.traverse(object => { if ((object as Mesh).isMesh) originals.push(object as Mesh) })
  const container = new Group()
  container.name = TWO_SIDED_NAME
  container.userData.twoSided = true
  built.pieces.forEach(piece => container.add(piece))
  const hidden = originals.map(mesh => [mesh, mesh.visible] as const)
  hidden.forEach(([mesh]) => { mesh.visible = false })
  group.add(container)
  group.updateMatrixWorld(true)
  const restoreMaterials = frontFaceOnly(built.pieces)
  return {
    triangles: built.triangles, vertices: built.vertices, meshes: built.pieces.length,
    remove() {
      restoreMaterials()
      for (const piece of built.pieces) piece.geometry.dispose()
      container.removeFromParent(); container.clear()
      hidden.forEach(([mesh, visible]) => { mesh.visible = visible })
    },
  }
}

/** Destructive form for generated models: replaces the group's meshes with the two halves. Returns false (and changes nothing) when unsupported. */
export function bakeTwoSided(group: Group): boolean {
  const built = buildTwoSidedMeshes(group)
  if (!built) return false
  const originals: Mesh[] = []
  group.traverse(object => { if ((object as Mesh).isMesh) originals.push(object as Mesh) })
  for (const mesh of originals) { mesh.geometry.dispose(); mesh.removeFromParent() }
  built.pieces.forEach(piece => group.add(piece))
  frontFaceOnly(built.pieces)
  group.updateMatrixWorld(true)
  return true
}
