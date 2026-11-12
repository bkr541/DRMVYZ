import { Box3, BufferGeometry, ExtrudeGeometry, Group, Mesh, Vector3 } from 'three'
import { parseModelGeometryStats, parseModelRecipe, type ModelGeneratorRecipe, type ModelGeometryStats } from '../domain/modelAssetTypes'
import { createModelMaterials } from '../materials/modelMaterials'
import { extractModelContours } from './extractContours'
import { checkAbort, MODEL_QUALITY, ModelGenerationError, type ModelDiagnostic, type ModelQuality } from './modelQualityBudget'
export interface GeneratedModel { group: Group; recipe: ModelGeneratorRecipe; stats: ModelGeometryStats; materialCount: number; dimensions: [number, number, number]; warnings: ModelDiagnostic[]; dispose(): void }
export function disposeModelGroup(group: Group): void {
  const geometries = new Set<BufferGeometry>(), materials = new Set<import('three').Material>()
  group.traverse(object => {
    if (object instanceof Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)) }
  })
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); group.clear()
}
export function createExtrudedModel(svg: string, input: ModelGeneratorRecipe, quality: ModelQuality = input.quality ?? 'normal', signal?: AbortSignal): GeneratedModel {
  checkAbort(signal)
  const recipe = parseModelRecipe(input), budget = MODEL_QUALITY[quality], warnings: ModelDiagnostic[] = []
  if (!budget) throw new ModelGenerationError('quality', 'Unknown model quality.')
  recipe.quality = quality
  recipe.geometry.curveSegments = Math.min(recipe.geometry.curveSegments, budget.curveSegments)
  recipe.geometry.bevelSegments = Math.min(recipe.geometry.bevelSegments, budget.bevelSegments)
  const contours = extractModelContours(svg, recipe.geometry.curveSegments, recipe.trace.smoothing)
  const safeBevel = Math.max(0, Math.min(contours.minimumDetail * 0.2, recipe.geometry.depth * 0.25))
  if (recipe.geometry.bevelEnabled && (recipe.geometry.bevelSize > safeBevel || recipe.geometry.bevelThickness > safeBevel)) {
    warnings.push({ code: 'bevel_clamped', message: 'Bevel was reduced to protect thin silhouette details.' })
    recipe.geometry.bevelSize = Math.min(recipe.geometry.bevelSize, safeBevel)
    recipe.geometry.bevelThickness = Math.min(recipe.geometry.bevelThickness, safeBevel)
  }
  if (!recipe.geometry.bevelSegments || !recipe.geometry.bevelSize || !recipe.geometry.bevelThickness) recipe.geometry.bevelEnabled = false
  if (contours.pointCount * (6 + 4 * (recipe.geometry.bevelEnabled ? recipe.geometry.bevelSegments : 0)) > budget.triangles) {
    recipe.geometry.bevelEnabled = false
    warnings.push({ code: 'sharp_edge_fallback', message: 'Bevel was disabled to stay within the selected triangle budget.' })
  }
  if (contours.pointCount * 6 > budget.triangles) throw new ModelGenerationError('geometry_budget', 'Model exceeds this quality tier; simplify the source or select a higher tier.')
  const group = new Group(); group.name = 'UserModel'
  const materials = createModelMaterials(recipe)
  try {
    for (const shape of contours.shapes) {
      checkAbort(signal)
      const geometry = new ExtrudeGeometry(shape, { depth: recipe.geometry.depth, bevelEnabled: recipe.geometry.bevelEnabled,
        bevelThickness: recipe.geometry.bevelThickness, bevelSize: recipe.geometry.bevelSize, bevelSegments: recipe.geometry.bevelSegments,
        curveSegments: 1, steps: 1 })
      const mesh = new Mesh(geometry, materials); mesh.name = `ModelPart${group.children.length + 1}`; group.add(mesh)
    }
    const bounds = new Box3().setFromObject(group), center = bounds.getCenter(new Vector3())
    const offset = new Vector3(-center.x, recipe.transform.pivot === 'bottom' ? -bounds.min.y : -center.y, -center.z)
    group.children.forEach(child => { if (child instanceof Mesh) child.geometry.translate(offset.x, offset.y, offset.z) })
    group.position.fromArray(recipe.transform.position); group.rotation.fromArray([...recipe.transform.rotation, 'XYZ']); group.scale.fromArray(recipe.transform.scale)
    group.updateMatrixWorld(true)
    const finalBounds = new Box3().setFromObject(group)
    let triangles = 0, vertices = 0
    group.traverse(object => { if (object instanceof Mesh) { vertices += object.geometry.attributes.position.count; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 } })
    if (triangles > budget.triangles) throw new ModelGenerationError('geometry_budget', 'Generated model exceeds the selected triangle budget.')
    const stats = parseModelGeometryStats({ triangles, vertices, meshes: group.children.length, bounds: { min: finalBounds.min.toArray(), max: finalBounds.max.toArray() } })
    return { group, recipe, stats, materialCount: materials.length, dimensions: finalBounds.getSize(new Vector3()).toArray(), warnings, dispose: () => disposeModelGroup(group) }
  } catch (error) {
    const attached = group.children.length > 0
    disposeModelGroup(group); if (!attached) materials.forEach(m => m.dispose()); throw error
  }
}
