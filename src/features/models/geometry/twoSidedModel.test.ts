// @vitest-environment jsdom
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Box3, DoubleSide, ExtrudeGeometry, FrontSide, Group, Mesh, MeshStandardMaterial, Raycaster, Shape, Vector3 } from 'three'
import { bakeTwoSided, buildTwoSidedMeshes, clipGeometryToFront, twoSidedSupport } from './twoSidedModel'
import { createBuiltinModelEdit } from './builtinModelEdits'
import { exportModelGlb } from '../export/exportGlb'
import { importGlbModel, inspectGlbFile } from '../import/glbImport'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createExtrudedModel } from './createExtrudedModel'
import { createDefaultModelRecipe } from '../generator/createModelArtifact'
import { parseModelRecipe, type ModelGeometryStats } from '../domain/modelAssetTypes'

/** An "F": it is not mirror-symmetric, so a mirrored back shows up as a different set of covered points. Bar x 0..1, top arm to x 3, middle arm to x 2; depth 1 (z 0..1). */
function letterF() {
  const shape = new Shape()
  const points: [number, number][] = [[0, 0], [1, 0], [1, 1.5], [2, 1.5], [2, 2.5], [1, 2.5], [1, 3], [3, 3], [3, 4], [0, 4]]
  points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y))
  const geometry = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 })
  const front = new MeshStandardMaterial({ color: 0xffffff, side: DoubleSide }), side = new MeshStandardMaterial({ color: 0x888888, side: DoubleSide })
  const group = new Group()
  group.add(new Mesh(geometry, [front, side]))
  return { group, front, side }
}
const stats = (group: Group): ModelGeometryStats => {
  const box = new Box3().setFromObject(group)
  return { triangles: 0, vertices: 0, meshes: 1, bounds: { min: box.min.toArray(), max: box.max.toArray() } } as ModelGeometryStats
}
const hit = (group: Group, x: number, y: number, fromFront: boolean) => new Raycaster(new Vector3(x, y, fromFront ? 10 : -10), new Vector3(0, 0, fromFront ? -1 : 1)).intersectObject(group, true).length > 0

describe('clipGeometryToFront', () => {
  it('keeps only the +Z side of the plane, cuts crossing triangles, and keeps the material groups', () => {
    const { group } = letterF()
    const geometry = (group.children[0] as Mesh).geometry
    const clipped = clipGeometryToFront(geometry, .5)!
    const z = clipped.getAttribute('position')
    for (let i = 0; i < z.count; i += 1) expect(z.getZ(i)).toBeGreaterThanOrEqual(.5 - 1e-6)
    expect(clipped.groups.map(g => g.materialIndex).sort()).toEqual([0, 1])
    // The side walls spanned the whole depth, so cutting them must have created vertices exactly on the plane.
    let onPlane = 0
    for (let i = 0; i < z.count; i += 1) if (Math.abs(z.getZ(i) - .5) < 1e-6) onPlane += 1
    expect(onPlane).toBeGreaterThan(0)
    const normals = clipped.getAttribute('normal')
    for (let i = 0; i < normals.count; i += 1) expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 4)
  })
  it('returns null when everything is behind the plane', () => {
    const { group } = letterF()
    expect(clipGeometryToFront((group.children[0] as Mesh).geometry, 5)).toBeNull()
  })
})

describe('buildTwoSidedMeshes and bakeTwoSided', () => {
  it('puts the front half in front, a half-turned copy behind, and shares the materials', () => {
    const { group, front, side } = letterF()
    const built = buildTwoSidedMeshes(group)!
    expect(built.pieces).toHaveLength(2)
    const [frontPiece, backPiece] = built.pieces
    expect(frontPiece!.geometry.boundingBox!.min.z).toBeGreaterThanOrEqual(.5 - 1e-6)
    expect(backPiece!.geometry.boundingBox!.max.z).toBeLessThanOrEqual(.5 + 1e-6)
    expect(frontPiece!.material).toEqual([front, side])
    expect(backPiece!.material).toBe(frontPiece!.material)
    expect(built.triangles).toBeGreaterThan(0)
  })

  it('reads correctly from both sides: the back is the same face turned, not a mirror, and neither side shows the other\'s half', () => {
    const { group } = letterF()
    expect(bakeTwoSided(group)).toBe(true)
    // From the front it is the F: the bar at the left, the top arm reaching right.
    expect(hit(group, .5, .5, true)).toBe(true)
    expect(hit(group, 2.5, 3.5, true)).toBe(true)
    expect(hit(group, 2.5, .5, true), 'the back half must not show through from the front').toBe(false)
    // From behind it is the same F seen from the other side: the bar is now on the right in world space, the arm reaches left.
    expect(hit(group, 2.5, .5, false)).toBe(true)
    expect(hit(group, .5, 3.5, false)).toBe(true)
    expect(hit(group, .5, .5, false), 'the front half must not show through from behind').toBe(false)
  })

  it('keeps the overall size, and applying it again to a baked model changes nothing', () => {
    const { group } = letterF()
    const before = new Box3().setFromObject(group)
    bakeTwoSided(group)
    const once = new Box3().setFromObject(group)
    once.min.toArray().forEach((value, i) => expect(value).toBeCloseTo(before.min.toArray()[i]!, 6))
    once.max.toArray().forEach((value, i) => expect(value).toBeCloseTo(before.max.toArray()[i]!, 6))
    const triangles = () => { let count = 0; group.traverse(o => { if ((o as Mesh).isMesh) count += (o as Mesh).geometry.getAttribute('position').count / 3 }); return count }
    const first = triangles()
    bakeTwoSided(group)
    expect(triangles()).toBe(first)
    new Box3().setFromObject(group).max.toArray().forEach((value, i) => expect(value).toBeCloseTo(once.max.toArray()[i]!, 6))
  })

  it('works in the group\'s own space whatever transform the group or its meshes carry', () => {
    const { group } = letterF()
    group.scale.setScalar(2); group.rotation.y = .7
    group.children[0]!.position.set(3, 1, -2)
    group.updateMatrixWorld(true)
    bakeTwoSided(group)
    // The model's face still points along the group's own +Z: a ray along the group's -Z axis from the front hits the (shifted) bar.
    const origin = new Vector3(3.5, 1.5, 10).applyMatrix4(group.matrixWorld), target = new Vector3(3.5, 1.5, 0).applyMatrix4(group.matrixWorld)
    expect(new Raycaster(origin, target.sub(origin).normalize()).intersectObject(group, true).length).toBeGreaterThan(0)
  })

  it('cannot be applied to models with morph targets, and reports why', () => {
    const { group } = letterF()
    const mesh = group.children[0] as Mesh
    mesh.geometry.morphAttributes.position = [mesh.geometry.getAttribute('position')]
    expect(twoSidedSupport(group)).toMatchObject({ ok: false, reason: expect.stringContaining('morph') })
    expect(bakeTwoSided(group)).toBe(false)
  })
})

describe('the live Edit-tab option for existing models', () => {
  it('shows the two halves, hides the originals, draws front faces only, and puts everything back when turned off', () => {
    const { group, front } = letterF()
    const edit = createBuiltinModelEdit(group, stats(group))
    expect(edit.original.twoSided).toBe(false)
    expect(edit.twoSidedAvailable.ok).toBe(true)
    const original = group.children[0] as Mesh
    const on = edit.apply({ ...edit.original, twoSided: true })
    expect(original.visible).toBe(false)
    expect(group.getObjectByName('TwoSidedModel')!.children).toHaveLength(2)
    expect(front.side).toBe(FrontSide)
    expect(on.triangles).toBeGreaterThan(0)
    expect(hit(group, .5, 3.5, false)).toBe(true)
    // The same edit keeps working with the option on (a slider move must not rebuild it).
    const container = group.getObjectByName('TwoSidedModel')
    edit.apply({ ...edit.original, twoSided: true, scale: 1.5 })
    expect(group.getObjectByName('TwoSidedModel')).toBe(container)
    edit.apply({ ...edit.original, twoSided: false })
    expect(original.visible).toBe(true)
    expect(group.getObjectByName('TwoSidedModel')).toBeUndefined()
    expect(front.side).toBe(DoubleSide)
  })

  it('ignores the option for a model that cannot be made two-sided', () => {
    const { group } = letterF()
    const mesh = group.children[0] as Mesh
    mesh.geometry.morphAttributes.position = [mesh.geometry.getAttribute('position')]
    const edit = createBuiltinModelEdit(group, stats(group))
    expect(edit.twoSidedAvailable.ok).toBe(false)
    edit.apply({ ...edit.original, twoSided: true })
    expect(mesh.visible).toBe(true)
    expect(group.getObjectByName('TwoSidedModel')).toBeUndefined()
  })
})

describe('saving', () => {
  it('writes the visible halves to the GLB, so a saved model keeps both sides and loads back single-sided', async () => {
    const { group } = letterF()
    const edit = createBuiltinModelEdit(group, stats(group))
    edit.apply({ ...edit.original, twoSided: true })
    const blob = await exportModelGlb(group)
    const loaded = (await new GLTFLoader().parseAsync(await blob.arrayBuffer(), '')).scene
    const meshes: Mesh[] = []
    loaded.traverse(object => { if ((object as Mesh).isMesh) meshes.push(object as Mesh) })
    // Two halves of two materials each (the hidden original is not written, which would make six).
    expect(meshes).toHaveLength(4)
    expect(meshes.every(mesh => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).every(m => m.side === FrontSide))).toBe(true)
    loaded.updateMatrixWorld(true)
    expect(hit(loaded, .5, 3.5, false)).toBe(true)
    expect(hit(loaded, .5, .5, false)).toBe(false)
    expect(hit(loaded, .5, .5, true)).toBe(true)
  })
})

describe('saving as a separate model', () => {
  it('stores the two-sided result as a new imported model and never touches the original', async () => {
    const { group } = letterF()
    const edit = createBuiltinModelEdit(group, stats(group))
    edit.apply({ ...edit.original, twoSided: true })
    const blob = await exportModelGlb(group)
    // The file the Save As New Model path inspects and stores must pass the same checks as any import.
    const inspection = await inspectGlbFile(new File([blob], 'wordmark.glb', { type: 'model/gltf-binary' }), new AbortController().signal)
    expect(inspection.stats.triangles).toBeGreaterThan(0)
    const calls: string[] = []
    const repository = {
      createDraft: async (draft: { name: string; kind: string }) => { calls.push(`draft:${draft.name}:${draft.kind}`); return { id: 'new-model' } },
      saveVersion: async (input: { modelAssetId: string; expectedVersion: number; generatorRecipe: unknown }) => { calls.push(`version:${input.modelAssetId}:${input.expectedVersion}:${input.generatorRecipe}`); return { version: 1 } },
      updateMetadata: async (id: string, version: number) => { calls.push(`metadata:${id}:${version}`); return { id, currentVersion: version } },
      delete: async () => { calls.push('delete') },
    }
    const created = await importGlbModel(inspection, { name: 'DVYDRM (two-sided)' }, { repository: repository as never })
    expect(created).toMatchObject({ id: 'new-model', currentVersion: 1 })
    expect(calls).toEqual(['draft:DVYDRM (two-sided):imported', 'version:new-model:0:null', 'metadata:new-model:1'])
  })
})

describe('generated models', () => {
  it('stores the option in the recipe, bakes it when generating, and leaves it off by default', async () => {
    const svg = (await readFile(resolve('src/features/models/__tests__/fixtures', 'donut.svg'))).toString('utf8')
    const recipe = createDefaultModelRecipe()
    expect(parseModelRecipe(recipe).twoSided).toBeUndefined()
    const plain = createExtrudedModel(svg, recipe)
    expect(plain.group.children.every(child => !child.name.endsWith('-back'))).toBe(true)
    const sided = createExtrudedModel(svg, { ...recipe, twoSided: true })
    expect(sided.recipe.twoSided).toBe(true)
    expect(parseModelRecipe(JSON.parse(JSON.stringify(sided.recipe))).twoSided).toBe(true)
    expect(sided.group.children.map(child => child.name.replace(/\d+/, '')).filter(name => name.endsWith('-back')).length).toBeGreaterThan(0)
    // The ring is hit from both sides and the cutout stays open from both.
    expect(hit(sided.group, .8, 0, true)).toBe(true)
    expect(hit(sided.group, .8, 0, false)).toBe(true)
    expect(hit(sided.group, 0, 0, true)).toBe(false)
    expect(hit(sided.group, 0, 0, false)).toBe(false)
    expect(sided.stats.triangles).toBeGreaterThan(0)
    plain.dispose(); sided.dispose()
  })
})
