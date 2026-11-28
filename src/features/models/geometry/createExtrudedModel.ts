import { Box3, BufferGeometry, ExtrudeGeometry, Group, Mesh, Vector3 } from 'three'
import { parseModelGeometryStats, parseModelRecipe, type ModelGeneratorRecipe, type ModelGeometryStats } from '../domain/modelAssetTypes'
import { createModelMaterials } from '../materials/modelMaterials'
import { createContourPreview, extractModelContours } from './extractContours'
import { catalogModelComponents, resolveComponentCleanup, type ModelComponentCatalog } from './modelComponentCleanup'
import { bakeTwoSided } from './twoSidedModel'
import { checkAbort, MODEL_QUALITY, ModelGenerationError, type ModelDiagnostic, type ModelQuality } from './modelQualityBudget'
export interface GeneratedModel { components: ModelComponentCatalog; group: Group; contourPreview: Blob; recipe: ModelGeneratorRecipe; stats: ModelGeometryStats; materialCount: number; dimensions: [number, number, number]; warnings: ModelDiagnostic[]; dispose(): void }
/** Releases everything the group owns: geometry, materials, and the textures those materials hold (an imported GLB carries multi-megapixel images). */
export function disposeModelGroup(group: Group): void {
  const geometries = new Set<BufferGeometry>(), materials = new Set<import('three').Material>()
  group.traverse(object => {
    if (object instanceof Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)) }
  })
  const textures = new Set<import('three').Texture>()
  materials.forEach(material => {
    for (const value of Object.values(material)) if (value && (value as import('three').Texture).isTexture) textures.add(value as import('three').Texture)
  })
  textures.forEach(texture => {
    // A decoded GLB image is an ImageBitmap that holds its pixels until it is closed.
    const image = texture.image as { close?: () => void } | null
    texture.dispose(); image?.close?.()
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
  const original = extractModelContours(svg, recipe.geometry.curveSegments, recipe.trace.smoothing)
  const components = catalogModelComponents(original)
  const { excluded, changed } = resolveComponentCleanup(components, recipe.cleanup)
  if (changed) warnings.push({ code: 'cleanup_reconciled', message: 'Source contours changed. Only exactly matching removed elements remain excluded; review restored elements before saving.' })
  if (excluded.size) recipe.cleanup = { version: 1, sourceTraceFingerprint: components.fingerprint, excludedComponentIds: [...excluded].sort() }
  else delete recipe.cleanup
  const retained = original.shapes.map((shape, index) => ({ shape, component: components.components[index] })).filter(({ component }) => !excluded.has(component.id))
  // Retain conservative clearance/point estimates from the original outline; the actual stats and preview use retained geometry only.
  const contours = { ...original, shapes: retained.map(part => part.shape), pointCount: retained.reduce((n, { shape }) => n + shape.getPoints(1).length + shape.holes.reduce((sum, hole) => sum + hole.getPoints(1).length, 0), 0) }
  const geometry = recipe.geometry
  if (geometry.bevelEnabled) {
    // XY clearance protects holes; Z thickness is independently bounded by depth.
    const safeWidth = Math.max(0, Math.min(contours.minimumDetail * 0.2, geometry.depth * 0.25))
    const safeThickness = geometry.depth * 0.25
    if (geometry.bevelSize > safeWidth || geometry.bevelThickness > safeThickness) {
      warnings.push({ code: 'bevel_clamped', message: 'Bevel was reduced to protect thin silhouette details. Width may be very small on intricate logos.' })
      geometry.bevelSize = Math.min(geometry.bevelSize, safeWidth)
      geometry.bevelThickness = Math.min(geometry.bevelThickness, safeThickness)
    }
    const requestedSegments = geometry.bevelSegments
    // A simpler bevel is preferable to silently removing it entirely.
    while (geometry.bevelSegments > 1 && contours.pointCount * (6 + 4 * geometry.bevelSegments) > budget.triangles) geometry.bevelSegments--
    if (geometry.bevelSegments < requestedSegments) warnings.push({ code: 'bevel_segments_reduced', message: 'Bevel segments were reduced to fit the selected quality budget.' })
    if (!geometry.bevelSegments || geometry.bevelSize < 1e-7 || !geometry.bevelThickness) {
      geometry.bevelEnabled = false
      warnings.push({ code: 'bevel_unavailable', message: 'Bevel could not be applied safely. Increase bevel width/thickness or simplify the source to preserve its cutouts.' })
    } else if (contours.pointCount * (6 + 4 * geometry.bevelSegments) > budget.triangles) {
      geometry.bevelEnabled = false
      warnings.push({ code: 'sharp_edge_fallback', message: 'Bevel could not fit the triangle budget. Select a higher quality or simplify the source.' })
    }
  }
  if (contours.pointCount * 6 > budget.triangles) throw new ModelGenerationError('geometry_budget', 'Model exceeds this quality tier; simplify the source or select a higher tier.')
  const group = new Group(); group.name = 'UserModel'
  const materials = createModelMaterials(recipe)
  try {
    for (const { shape, component } of retained) {
      checkAbort(signal)
      const geometry = new ExtrudeGeometry(shape, { depth: recipe.geometry.depth, bevelEnabled: recipe.geometry.bevelEnabled,
        bevelThickness: recipe.geometry.bevelThickness, bevelSize: recipe.geometry.bevelSize, bevelSegments: recipe.geometry.bevelSegments,
        curveSegments: 1, steps: 1 })
      const mesh = new Mesh(geometry, materials); mesh.name = `ModelPart${group.children.length + 1}`; mesh.userData.modelComponentId = component.id; group.add(mesh)
    }
    const bounds = new Box3().setFromObject(group), center = bounds.getCenter(new Vector3())
    const offset = new Vector3(-center.x, recipe.transform.pivot === 'bottom' ? -bounds.min.y : -center.y, -center.z)
    group.children.forEach(child => { if (child instanceof Mesh) child.geometry.translate(offset.x, offset.y, offset.z) })
    // Readable from both sides: keep the front half and add a turned copy as the back (see twoSidedModel).
    if (recipe.twoSided && !bakeTwoSided(group)) warnings.push({ code: 'two_sided_unavailable', message: 'This model could not be made two-sided.' })
    group.position.fromArray(recipe.transform.position); group.rotation.fromArray([...recipe.transform.rotation, 'XYZ']); group.scale.fromArray(recipe.transform.scale)
    group.updateMatrixWorld(true)
    const finalBounds = new Box3().setFromObject(group)
    let triangles = 0, vertices = 0
    group.traverse(object => { if (object instanceof Mesh) { vertices += object.geometry.attributes.position.count; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 } })
    if (triangles > budget.triangles) throw new ModelGenerationError('geometry_budget', 'Generated model exceeds the selected triangle budget.')
    const stats = parseModelGeometryStats({ triangles, vertices, meshes: group.children.length, bounds: { min: finalBounds.min.toArray(), max: finalBounds.max.toArray() } })
    return { group, components, contourPreview: createContourPreview(contours), recipe, stats, materialCount: materials.length, dimensions: finalBounds.getSize(new Vector3()).toArray(), warnings, dispose: () => disposeModelGroup(group) }
  } catch (error) {
    const attached = group.children.length > 0
    disposeModelGroup(group); if (!attached) materials.forEach(m => m.dispose()); throw error
  }
}
