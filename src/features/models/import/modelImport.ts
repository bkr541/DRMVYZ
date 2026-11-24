import { Group, LoadingManager, Mesh, Line, Points, MeshStandardMaterial, type Material, type BufferGeometry, type Object3D } from 'three'
import { MODEL_MAX_FILE_BYTES, MODEL_MAX_TRIANGLES } from '../domain/modelAssetTypes'
import { disposeModelGroup } from '../geometry/createExtrudedModel'
import { checkAbort } from '../geometry/modelQualityBudget'
import { inspectGlbFile, type GlbInspection } from './glbImport'
import { modelImportFormat } from './modelImportFormats'
import { packGltf } from './packGltf'

/** Static interchange only. All persisted artifacts still pass through the existing GLB inspector. */
export async function inspectModelFile(file: File, signal: AbortSignal, companions: readonly File[] = []): Promise<GlbInspection> {
  const format = modelImportFormat(file)
  if (!format) throw new Error('Unsupported model format. Select GLB, glTF, FBX, OBJ, STL or PLY.')
  if (!file.size || file.size + companions.reduce((sum, f) => sum + f.size, 0) > MODEL_MAX_FILE_BYTES) throw new Error('Model is empty or exceeds the 64 MB import budget.')
  checkAbort(signal)
  if (format === 'glb') return inspectGlbFile(file, signal)
  const warnings: string[] = []
  let bytes: ArrayBuffer
  if (format === 'gltf') {
    bytes = await packGltf(await file.text(), companions, signal)
  } else {
    const group = new Group()
    // FBX's texture loader can otherwise fetch absolute or relative URLs. No textured FBX is accepted until a bounded local texture adapter exists.
    const manager = new LoadingManager().setURLModifier(() => { throw new Error('FBX textures are not supported by this importer. Export a self-contained GLB or glTF to preserve textures.') })
    const originalMaterials = new Set<Material>()
    const replacementMaterials = new Set<Material>()
    try {
      const input = await file.arrayBuffer(); checkAbort(signal)
      const addGeometry = (geometry: BufferGeometry) => { group.add(new Mesh(geometry, new MeshStandardMaterial({ vertexColors: geometry.hasAttribute('color') }))); if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals() }
      if (format === 'stl') {
        if (input.byteLength >= 84) { const count = new DataView(input).getUint32(80,true); if (84 + count * 50 === input.byteLength && count > MODEL_MAX_TRIANGLES) throw new Error('STL exceeds the triangle budget.') }
        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js'); addGeometry(new STLLoader(manager).parse(input)) }
      if (format === 'ply') {
        const header = new TextDecoder().decode(input.slice(0, 65536)).split('end_header')[0] ?? ''
        const faces = Number(/^element face (\d+)\s*$/m.exec(header)?.[1] ?? 0), points = Number(/^element vertex (\d+)\s*$/m.exec(header)?.[1] ?? 0)
        if (!faces || !points) throw new Error('PLY must contain triangle faces, not a point cloud.')
        if (faces > MODEL_MAX_TRIANGLES || points > 1_000_000) throw new Error('PLY exceeds the geometry budget.')
        const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js'); addGeometry(new PLYLoader(manager).parse(input)) }
      if (format === 'obj') {
        const text = new TextDecoder().decode(input)
        if (/^\s*mtllib\s+/mi.test(text)) throw new Error('OBJ material libraries are not supported. Export as GLB/glTF to preserve materials and textures, or export a geometry-only OBJ.')
        const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js'); group.add(new OBJLoader(manager).parse(text))
      }
      if (format === 'fbx') { const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js'); group.add(new FBXLoader(manager).parse(input, '')) }
      let triangles = 0, vertices = 0, meshes = 0
      const converted = new Map<Material, MeshStandardMaterial>()
      group.traverse(object => {
        if ((object as Object3D & { isSkinnedMesh?: boolean }).isSkinnedMesh) throw new Error('Rigged models are not supported in Cinema 2.0. Export a static mesh.')
        if (object.animations.length) warnings.push('Embedded animation is not retained in this static conversion.')
        if (!(object instanceof Mesh)) {
          if ((object as Object3D & { isLine?: boolean; isPoints?: boolean }).isLine || (object as Object3D & { isPoints?: boolean }).isPoints) throw new Error('Line and point-cloud models are not supported. Export triangle meshes.')
          return
        }
        const geometry = object.geometry, pos = geometry.getAttribute('position'), count = geometry.index?.count ?? pos?.count ?? 0
        if (!pos || count < 3 || count % 3 || geometry.morphAttributes.position?.length) throw new Error('Only static triangle meshes are supported.')
        if (geometry.index) for (let i = 0; i < geometry.index.count; i++) { const idx = geometry.index.getX(i); if (!Number.isInteger(idx) || idx < 0 || idx >= pos.count) throw new Error('Model has an invalid triangle index.') }
        for (let i = 0; i < pos.count; i++) if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) throw new Error('Model contains invalid positions.')
        triangles += count / 3; vertices += pos.count; meshes++
        if (triangles > MODEL_MAX_TRIANGLES || vertices > 1_000_000 || meshes > 1024) throw new Error('Model exceeds the geometry budget (250,000 triangles, 1,000,000 vertices or 1,024 meshes).')
        const convert = (material: Material) => {
          if (material instanceof MeshStandardMaterial) return material
          let replacement = converted.get(material)
          if (!replacement) {
            const source = material as Material & { color?: import('three').Color; emissive?: import('three').Color; map?: unknown }
            if (source.map) throw new Error('Texture conversion is unsupported for this material. Export GLB/glTF instead.')
            replacement = new MeshStandardMaterial({ color: source.color, emissive: source.emissive, opacity: source.opacity, transparent: source.transparent, side: source.side, vertexColors: source.vertexColors })
            originalMaterials.add(material); replacementMaterials.add(replacement); converted.set(material, replacement)
          }
          return replacement
        }
        object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material)
      })
      if (!triangles) throw new Error('Model has no triangle geometry.')
      if (converted.size) warnings.push('Compatible material colors and opacity were converted to PBR; source-specific shaders are not retained.')
      const { exportModelGlb } = await import('../export/exportGlb'); bytes = await (await exportModelGlb(group, signal)).arrayBuffer()
    } finally {
      // A conversion error may occur before a replacement is installed on the mesh.
      group.traverse(object => { if (object instanceof Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) { originalMaterials.delete(material); replacementMaterials.delete(material) } })
      const extraGeometry = new Set<BufferGeometry>(), extraMaterial = new Set<Material>()
      group.traverse(object => { if (object instanceof Line || object instanceof Points) { extraGeometry.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) extraMaterial.add(material) } })
      extraGeometry.forEach(geometry => geometry.dispose()); extraMaterial.forEach(material => material.dispose())
      disposeModelGroup(group); originalMaterials.forEach(material => material.dispose()); replacementMaterials.forEach(material => material.dispose())
    }
  }
  checkAbort(signal)
  const checked = await inspectGlbFile(new File([bytes], `${file.name}.glb`, { type: 'model/gltf-binary' }), signal)
  const allWarnings = [...new Set([...warnings, ...checked.warnings])]
  return { ...checked, fileName: file.name, stats: { ...checked.stats, imported: { ...checked.stats.imported!, fileName: file.name.slice(0, 300), ...(allWarnings.length ? { warnings: allWarnings } : {}) } }, warnings: allWarnings }
}
