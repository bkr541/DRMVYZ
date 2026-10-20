// Inspects a model for the Cinema 2.0 pipeline: geometry and texture cost, compression, extensions, animation, custom vertex attributes and the
// problems that would make `npm run assets:check` or the runtime loader complain. Pure over a glTF Transform document.
import { getTextureColorSpace, listTextureSlots } from '@gltf-transform/functions'
import { SUPPORTED_GLTF_EXTENSIONS, resolveAssetBudgets } from '../assets-core.mjs'

const MIP = 4 / 3

/** Thresholds above which a model is flagged as heavy for real-time use. They are advisory: the hard limits are the asset budgets. */
export const EXCESS_LIMITS = Object.freeze({ materials: 24, meshes: 128, primitives: 256, textures: 32, nodes: 1024 })

const EXTENSION_FEATURES = Object.freeze({
  KHR_draco_mesh_compression: 'Draco geometry compression',
  EXT_meshopt_compression: 'Meshopt geometry compression',
  KHR_meshopt_compression: 'Meshopt geometry compression',
  KHR_texture_basisu: 'KTX2 / Basis Universal textures',
  EXT_texture_webp: 'WebP textures',
  EXT_texture_avif: 'AVIF textures',
  KHR_mesh_quantization: 'Quantized vertex attributes',
  EXT_mesh_gpu_instancing: 'GPU instancing',
})

function primitiveTriangles(primitive) {
  const mode = primitive.getMode()
  const indices = primitive.getIndices()
  const position = primitive.getAttribute('POSITION')
  const count = indices ? indices.getCount() : position ? position.getCount() : 0
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function accessorBytes(accessor) {
  return accessor?.getArray()?.byteLength ?? 0
}

/** Scans POSITION data and indices for non-finite values, out-of-range indices and zero-area triangles. */
function checkGeometry(primitive) {
  const problems = { nonFinite: 0, badIndices: 0, degenerate: 0, triangles: 0 }
  const position = primitive.getAttribute('POSITION')
  if (!position) return problems
  const array = position.getArray()
  for (let index = 0; index < array.length; index += 1) if (!Number.isFinite(array[index])) problems.nonFinite += 1
  const vertexCount = position.getCount()
  const indices = primitive.getIndices()?.getArray()
  const mode = primitive.getMode()
  if (indices) {
    for (let index = 0; index < indices.length; index += 1) if (indices[index] >= vertexCount) problems.badIndices += 1
  }
  if (mode === 4) {
    const count = indices ? indices.length : vertexCount
    const get = i => (indices ? indices[i] : i)
    const element = position.getElementSize()
    const point = (i, out) => { for (let k = 0; k < 3; k += 1) out[k] = array[get(i) * element + k] }
    const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0]
    for (let t = 0; t + 2 < count; t += 3) {
      problems.triangles += 1
      if (get(t) >= vertexCount || get(t + 1) >= vertexCount || get(t + 2) >= vertexCount) continue
      point(t, a); point(t + 1, b); point(t + 2, c)
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx
      if (cx * cx + cy * cy + cz * cz < 1e-24) problems.degenerate += 1
    }
  }
  return problems
}

export function inspectDocument(document, options = {}) {
  const root = document.getRoot()
  const budgets = resolveAssetBudgets(options.budgets)
  const issues = []
  const issue = (severity, code, message) => issues.push({ severity, code, message })

  const extensionsUsed = root.listExtensionsUsed().map(extension => extension.extensionName)
  const extensionsRequired = root.listExtensionsRequired().map(extension => extension.extensionName)
  for (const name of extensionsRequired) {
    if (!SUPPORTED_GLTF_EXTENSIONS.includes(name)) issue('error', 'UNSUPPORTED_REQUIRED_EXTENSION', `The model requires ${name}, which the Cinema 2.0 loader does not support. Re-export without it or bake it into plain PBR materials.`)
  }
  for (const name of extensionsUsed) {
    if (!extensionsRequired.includes(name) && !SUPPORTED_GLTF_EXTENSIONS.includes(name)) issue('warning', 'UNSUPPORTED_USED_EXTENSION', `The model uses ${name}, which the Cinema 2.0 loader ignores; the model still loads but without that feature.`)
  }

  // ---- geometry
  const meshes = []
  const geometryAccessors = new Set()
  const customAttributes = new Set()
  let triangles = 0
  let vertices = 0
  let primitiveCount = 0
  let missingNormals = 0
  let missingUvs = 0
  const compressedGeometry = extensionsUsed.some(name => name === 'KHR_draco_mesh_compression' || name === 'EXT_meshopt_compression' || name === 'KHR_meshopt_compression')
  const nonTriangle = new Set()
  for (const mesh of root.listMeshes()) {
    const info = { name: mesh.getName(), primitives: 0, triangles: 0, vertices: 0, materials: new Set(), customAttributes: new Set(), morphTargets: 0, hasNormals: true }
    for (const primitive of mesh.listPrimitives()) {
      primitiveCount += 1
      info.primitives += 1
      const count = primitiveTriangles(primitive)
      triangles += count
      info.triangles += count
      const position = primitive.getAttribute('POSITION')
      const vertexCount = position?.getCount() ?? 0
      vertices += vertexCount
      info.vertices += vertexCount
      const material = primitive.getMaterial()
      if (material) info.materials.add(material.getName())
      if (primitive.getMode() !== 4) nonTriangle.add(primitive.getMode())
      for (const semantic of primitive.listSemantics()) {
        geometryAccessors.add(primitive.getAttribute(semantic))
        if (semantic.startsWith('_')) { customAttributes.add(semantic); info.customAttributes.add(semantic) }
      }
      if (primitive.getIndices()) geometryAccessors.add(primitive.getIndices())
      if (primitive.getMode() === 4 && !primitive.getAttribute('NORMAL')) { missingNormals += 1; info.hasNormals = false }
      const textured = material && listTextureSlotsOfMaterial(material).length > 0
      if (textured && !primitive.getAttribute('TEXCOORD_0')) missingUvs += 1
      const targets = primitive.listTargets()
      info.morphTargets = Math.max(info.morphTargets, targets.length)
      for (const target of targets) for (const semantic of target.listSemantics()) geometryAccessors.add(target.getAttribute(semantic))
      if (!compressedGeometry || options.checkCompressedGeometry) {
        const problems = checkGeometry(primitive)
        if (problems.nonFinite > 0) issue('error', 'INVALID_GEOMETRY', `Mesh "${mesh.getName()}" has ${problems.nonFinite} non-finite position values.`)
        if (problems.badIndices > 0) issue('error', 'INVALID_GEOMETRY', `Mesh "${mesh.getName()}" has ${problems.badIndices} indices beyond its vertex count.`)
        if (problems.triangles > 0 && problems.degenerate / problems.triangles > 0.01) issue('warning', 'DEGENERATE_TRIANGLES', `Mesh "${mesh.getName()}" has ${problems.degenerate} zero-area triangles (${(100 * problems.degenerate / problems.triangles).toFixed(1)}%).`)
      }
    }
    meshes.push({ ...info, materials: [...info.materials], customAttributes: [...info.customAttributes] })
  }
  if (missingNormals > 0) issue('warning', 'MISSING_NORMALS', `${missingNormals} triangle primitive(s) have no NORMAL attribute; Three.js will shade them flat. Export normals or run \`gltf-transform normals\`.`)
  if (missingUvs > 0) issue('warning', 'MISSING_UVS', `${missingUvs} primitive(s) use textured materials but have no TEXCOORD_0.`)
  if (nonTriangle.size > 0) issue('info', 'NON_TRIANGLE_PRIMITIVES', `Primitive modes other than triangles are present (${[...nonTriangle].join(', ')}); they are not counted in triangle totals.`)
  let geometryBytes = 0
  for (const accessor of geometryAccessors) geometryBytes += accessorBytes(accessor)

  // ---- materials and textures
  const materials = root.listMaterials().map(material => ({
    name: material.getName(),
    alphaMode: material.getAlphaMode(),
    doubleSided: material.getDoubleSided(),
    metallic: material.getMetallicFactor(),
    roughness: material.getRoughnessFactor(),
    emissive: material.getEmissiveFactor().some(value => value > 0),
    textureSlots: listTextureSlotsOfMaterial(material),
    extensions: material.listExtensions().map(extension => extension.extensionName),
  }))
  const textures = root.listTextures().map(texture => {
    const size = texture.getSize()
    const mime = texture.getMimeType()
    const bytes = texture.getImage()?.byteLength ?? 0
    const slots = listTextureSlots(texture)
    const gpuBytes = size ? Math.round(size[0] * size[1] * (mime === 'image/ktx2' ? 1 : 4) * MIP) : 0
    return { name: texture.getName() || texture.getURI() || '(unnamed)', mime, width: size?.[0] ?? null, height: size?.[1] ?? null, fileBytes: bytes, gpuBytes, slots, colorSpace: getTextureColorSpace(texture) }
  })
  const textureGpuBytes = textures.reduce((sum, texture) => sum + texture.gpuBytes, 0)
  for (const texture of textures) {
    if (texture.width && Math.max(texture.width, texture.height) > budgets.maxTextureDimension) issue('warning', 'TEXTURE_TOO_LARGE', `Texture "${texture.name}" is ${texture.width}x${texture.height}, above the ${budgets.maxTextureDimension}px asset limit.`)
  }

  // ---- animation, skeletons, scene
  const animations = root.listAnimations().map(animation => ({
    name: animation.getName(),
    channels: animation.listChannels().length,
    samplers: animation.listSamplers().length,
    duration: Math.max(0, ...animation.listSamplers().map(sampler => sampler.getInput()?.getMax([])?.[0] ?? 0)),
    targets: [...new Set(animation.listChannels().map(channel => channel.getTargetNode()?.getName() ?? '(none)'))],
    paths: [...new Set(animation.listChannels().map(channel => channel.getTargetPath()))],
  }))
  const skins = root.listSkins().map(skin => ({ name: skin.getName(), joints: skin.listJoints().length }))
  const nodes = root.listNodes()
  const unnamedNodes = nodes.filter(node => !node.getName()).length
  if (unnamedNodes > 0) issue('info', 'UNNAMED_NODES', `${unnamedNodes} of ${nodes.length} nodes have no name; presets address parts by name, so name anything that needs to be controlled.`)
  const duplicateNames = findDuplicates(nodes.map(node => node.getName()).filter(Boolean))
  if (duplicateNames.length > 0) issue('warning', 'DUPLICATE_NODE_NAMES', `Duplicate node names: ${duplicateNames.slice(0, 8).join(', ')}${duplicateNames.length > 8 ? ', ...' : ''}. Presets that look a part up by name get the first match.`)

  // ---- budgets
  const gpuBytes = geometryBytes + textureGpuBytes
  if (triangles > budgets.maxTrianglesPerAsset) issue('error', 'OVER_TRIANGLE_BUDGET', `${triangles} triangles is above the ${budgets.maxTrianglesPerAsset} per-asset limit.`)
  for (const tier of ['low', 'medium', 'high']) {
    if (gpuBytes > budgets.assetGpuBytes[tier]) issue('warning', 'OVER_GPU_BUDGET', `Estimated ${(gpuBytes / 1048576).toFixed(1)} MB of GPU memory exceeds the ${(budgets.assetGpuBytes[tier] / 1048576).toFixed(1)} MB ${tier}-tier asset budget (a tier variant should be smaller).`)
  }
  const excess = []
  if (materials.length > EXCESS_LIMITS.materials) excess.push(`${materials.length} materials (> ${EXCESS_LIMITS.materials})`)
  if (meshes.length > EXCESS_LIMITS.meshes) excess.push(`${meshes.length} meshes (> ${EXCESS_LIMITS.meshes})`)
  if (primitiveCount > EXCESS_LIMITS.primitives) excess.push(`${primitiveCount} primitives = draw calls (> ${EXCESS_LIMITS.primitives})`)
  if (textures.length > EXCESS_LIMITS.textures) excess.push(`${textures.length} textures (> ${EXCESS_LIMITS.textures})`)
  if (nodes.length > EXCESS_LIMITS.nodes) excess.push(`${nodes.length} nodes (> ${EXCESS_LIMITS.nodes})`)
  if (excess.length > 0) issue('warning', 'EXCESSIVE_COMPLEXITY', `Heavy for real-time use: ${excess.join('; ')}. Merge static parts that never move independently, or instance repeated parts.`)

  const geometryCompression = extensionsUsed.includes('KHR_draco_mesh_compression') ? 'draco' : (extensionsUsed.includes('EXT_meshopt_compression') || extensionsUsed.includes('KHR_meshopt_compression')) ? 'meshopt' : 'none'
  const textureFormats = [...new Set(textures.map(texture => texture.mime).filter(Boolean))]
  const bounds = sceneBounds(root)
  return {
    name: options.name ?? null,
    container: options.container ?? null,
    fileBytes: options.fileBytes ?? null,
    generator: root.getAsset().generator ?? null,
    counts: { scenes: root.listScenes().length, nodes: nodes.length, meshes: meshes.length, primitives: primitiveCount, materials: materials.length, textures: textures.length, animations: animations.length, skins: skins.length, cameras: root.listCameras().length },
    geometry: { triangles, vertices, bytes: geometryBytes, compression: geometryCompression, customAttributes: [...customAttributes].sort() },
    textures: { count: textures.length, gpuBytes: textureGpuBytes, formats: textureFormats, items: textures },
    memory: { geometryBytes, textureBytes: textureGpuBytes, totalBytes: gpuBytes },
    extensions: { used: extensionsUsed, required: extensionsRequired, features: extensionsUsed.map(name => EXTENSION_FEATURES[name]).filter(Boolean) },
    materials,
    meshes,
    animations,
    skins,
    bounds,
    budgets,
    issues,
    ok: !issues.some(entry => entry.severity === 'error'),
  }
}

function listTextureSlotsOfMaterial(material) {
  const slots = []
  const pairs = [
    ['baseColorTexture', material.getBaseColorTexture()], ['metallicRoughnessTexture', material.getMetallicRoughnessTexture()],
    ['normalTexture', material.getNormalTexture()], ['occlusionTexture', material.getOcclusionTexture()], ['emissiveTexture', material.getEmissiveTexture()],
  ]
  for (const [slot, texture] of pairs) if (texture) slots.push(slot)
  return slots
}

function findDuplicates(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) (seen.has(value) ? duplicates : seen).add(value)
  return [...duplicates]
}

/** World-space bounding box of every scene's meshes. Returns null for an empty model. */
function sceneBounds(root) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const matrix = node.getWorldMatrix()
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      if (!position) continue
      const elementMin = position.getMin([]), elementMax = position.getMax([])
      for (let corner = 0; corner < 8; corner += 1) {
        const x = corner & 1 ? elementMax[0] : elementMin[0]
        const y = corner & 2 ? elementMax[1] : elementMin[1]
        const z = corner & 4 ? elementMax[2] : elementMin[2]
        const wx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]
        const wy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]
        const wz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
        min[0] = Math.min(min[0], wx); min[1] = Math.min(min[1], wy); min[2] = Math.min(min[2], wz)
        max[0] = Math.max(max[0], wx); max[1] = Math.max(max[1], wy); max[2] = Math.max(max[2], wz)
      }
    }
  }
  return Number.isFinite(min[0]) ? { min, max } : null
}
