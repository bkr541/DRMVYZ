// Proves an optimized model kept everything the original had: node names and hierarchy, local transforms, mesh and material names, custom vertex
// attributes (and their values), animation clips, skins, extras and overall size. Used as the safeguard after every optimize.
const TRANSFORM_EPSILON = 1e-5

function nodePaths(document) {
  const paths = new Map()
  const walk = (node, prefix) => {
    const path = `${prefix}/${node.getName() || '(unnamed)'}`
    // Siblings with the same name get an index so the map stays one-to-one.
    let unique = path
    for (let n = 1; paths.has(unique); n += 1) unique = `${path}#${n}`
    paths.set(unique, node)
    for (const child of node.listChildren()) walk(child, unique)
  }
  for (const scene of document.getRoot().listScenes()) for (const node of scene.listChildren()) walk(node, '')
  return paths
}

function arraysEqual(a, b, epsilon) {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) if (Math.abs(a[index] - b[index]) > epsilon) return false
  return true
}

function primitiveSignature(mesh) {
  return mesh.listPrimitives().map(primitive => ({
    material: primitive.getMaterial()?.getName() ?? '',
    semantics: primitive.listSemantics().sort(),
    triangles: primitive.getIndices() ? primitive.getIndices().getCount() / 3 : (primitive.getAttribute('POSITION')?.getCount() ?? 0) / 3,
  }))
}

/**
 * @param before original document   @param after optimized document (after a write/read round trip)
 * @param options.simplified  geometry was reduced: vertex values and triangle counts are not expected to match
 * @param options.lossyGeometry  geometry went through a lossy codec (Draco): vertex values must match within `tolerance`
 */
export function compareDocuments(before, after, options = {}) {
  const failures = []
  const warnings = []
  const fail = message => failures.push(message)

  // ---- hierarchy and transforms
  const beforePaths = nodePaths(before)
  const afterPaths = nodePaths(after)
  for (const [path, node] of beforePaths) {
    const other = afterPaths.get(path)
    if (!other) { fail(`node "${path}" is missing from the optimized file`); continue }
    if (options.preserveTransforms !== false) {
      if (!arraysEqual(node.getTranslation(), other.getTranslation(), TRANSFORM_EPSILON)) fail(`node "${path}" moved (translation changed)`)
      if (!arraysEqual(node.getRotation(), other.getRotation(), TRANSFORM_EPSILON)) fail(`node "${path}" rotated (rotation changed)`)
      if (!arraysEqual(node.getScale(), other.getScale(), TRANSFORM_EPSILON)) fail(`node "${path}" rescaled (scale changed)`)
    }
    if (JSON.stringify(node.getExtras()) !== JSON.stringify(other.getExtras())) fail(`node "${path}" lost or changed its extras`)
    if ((node.getMesh()?.getName() ?? null) !== (other.getMesh()?.getName() ?? null)) fail(`node "${path}" references a different mesh`)
  }
  for (const path of afterPaths.keys()) if (!beforePaths.has(path)) warnings.push(`node "${path}" is new in the optimized file`)

  // ---- meshes, materials, custom attributes
  const afterMeshes = new Map(after.getRoot().listMeshes().map(mesh => [mesh.getName(), mesh]))
  for (const mesh of before.getRoot().listMeshes()) {
    const other = afterMeshes.get(mesh.getName())
    if (!other) { fail(`mesh "${mesh.getName()}" is missing from the optimized file`); continue }
    const a = primitiveSignature(mesh)
    const b = primitiveSignature(other)
    if (a.length !== b.length) { fail(`mesh "${mesh.getName()}" has ${b.length} primitives, was ${a.length} (parts were merged or split)`); continue }
    for (let index = 0; index < a.length; index += 1) {
      if (a[index].material !== b[index].material) fail(`mesh "${mesh.getName()}" primitive ${index} uses material "${b[index].material}", was "${a[index].material}"`)
      const lostAttributes = a[index].semantics.filter(semantic => !b[index].semantics.includes(semantic))
      if (lostAttributes.length > 0) fail(`mesh "${mesh.getName()}" primitive ${index} lost vertex attributes: ${lostAttributes.join(', ')}`)
      if (!options.simplified && a[index].triangles !== b[index].triangles) fail(`mesh "${mesh.getName()}" primitive ${index} has ${b[index].triangles} triangles, was ${a[index].triangles}`)
      if (options.simplified && b[index].triangles > a[index].triangles) fail(`mesh "${mesh.getName()}" primitive ${index} gained triangles while simplifying`)
    }
    if (!options.simplified) {
      const primitivesBefore = mesh.listPrimitives()
      const primitivesAfter = other.listPrimitives()
      primitivesBefore.forEach((primitive, index) => {
        for (const semantic of primitive.listSemantics()) {
          const x = primitive.getAttribute(semantic)
          const y = primitivesAfter[index].getAttribute(semantic)
          if (!y) continue
          const tolerance = options.lossyGeometry ? (options.tolerance ?? 1e-3) : 0
          // Compare through accessor element reads so quantized integer attributes are compared in their real (de-normalized) values. Draco
          // re-orders vertices, so for a lossy codec each component is compared as a sorted set rather than index by index.
          const elementA = [], elementB = []
          let diff = 0
          if (options.lossyGeometry && x.getCount() === y.getCount()) {
            const size = x.getElementSize()
            for (let k = 0; k < size; k += 1) {
              const column = accessor => {
                const values = new Float64Array(accessor.getCount())
                const element = []
                for (let i = 0; i < values.length; i += 1) { accessor.getElement(i, element); values[i] = element[k] }
                return values.sort()
              }
              const sortedA = column(x), sortedB = column(y)
              for (let i = 0; i < sortedA.length; i += 1) diff = Math.max(diff, Math.abs(sortedA[i] - sortedB[i]))
            }
          } else {
            for (let i = 0; i < x.getCount() && i < y.getCount(); i += 1) {
              x.getElement(i, elementA)
              y.getElement(i, elementB)
              for (let k = 0; k < elementA.length; k += 1) diff = Math.max(diff, Math.abs(elementA[k] - elementB[k]))
            }
          }
          if (x.getCount() !== y.getCount()) fail(`mesh "${mesh.getName()}" primitive ${index} attribute ${semantic} has ${y.getCount()} vertices, was ${x.getCount()}`)
          else if (diff > tolerance) fail(`mesh "${mesh.getName()}" primitive ${index} attribute ${semantic} changed by up to ${diff.toExponential(2)} (allowed ${tolerance})`)
        }
      })
    }
  }

  const afterMaterials = new Map(after.getRoot().listMaterials().map(material => [material.getName(), material]))
  for (const material of before.getRoot().listMaterials()) {
    const other = afterMaterials.get(material.getName())
    if (!other) { fail(`material "${material.getName()}" is missing from the optimized file`); continue }
    if (!arraysEqual(material.getBaseColorFactor(), other.getBaseColorFactor(), TRANSFORM_EPSILON)) fail(`material "${material.getName()}" changed its base color`)
    if (!arraysEqual(material.getEmissiveFactor(), other.getEmissiveFactor(), TRANSFORM_EPSILON)) fail(`material "${material.getName()}" changed its emissive color`)
    if (Math.abs(material.getRoughnessFactor() - other.getRoughnessFactor()) > TRANSFORM_EPSILON || Math.abs(material.getMetallicFactor() - other.getMetallicFactor()) > TRANSFORM_EPSILON) fail(`material "${material.getName()}" changed its roughness/metalness`)
    if (material.getAlphaMode() !== other.getAlphaMode()) fail(`material "${material.getName()}" changed its alpha mode`)
  }

  // ---- animation and skins
  const afterAnimations = new Map(after.getRoot().listAnimations().map(animation => [animation.getName(), animation]))
  for (const animation of before.getRoot().listAnimations()) {
    const other = afterAnimations.get(animation.getName())
    if (!other) { fail(`animation clip "${animation.getName()}" was discarded`); continue }
    if (animation.listChannels().length !== other.listChannels().length) fail(`animation clip "${animation.getName()}" has ${other.listChannels().length} channels, was ${animation.listChannels().length}`)
  }
  if (before.getRoot().listSkins().length !== after.getRoot().listSkins().length) fail('the number of skins changed')
  for (const [index, skin] of before.getRoot().listSkins().entries()) {
    const other = after.getRoot().listSkins()[index]
    if (other && skin.listJoints().length !== other.listJoints().length) fail(`skin ${index} has ${other.listJoints().length} joints, was ${skin.listJoints().length}`)
  }

  // ---- overall size
  const sizeBefore = boundsDiagonal(before)
  const sizeAfter = boundsDiagonal(after)
  if (sizeBefore > 0 && Math.abs(sizeAfter - sizeBefore) / sizeBefore > (options.simplified ? 0.02 : 0.001)) fail(`overall size changed from ${sizeBefore.toFixed(4)} to ${sizeAfter.toFixed(4)}`)

  return { ok: failures.length === 0, failures, warnings }
}

function boundsDiagonal(document) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const m = node.getWorldMatrix()
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      if (!position) continue
      const a = position.getMin([]), b = position.getMax([])
      for (let corner = 0; corner < 8; corner += 1) {
        const x = corner & 1 ? b[0] : a[0], y = corner & 2 ? b[1] : a[1], z = corner & 4 ? b[2] : a[2]
        const w = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
        for (let k = 0; k < 3; k += 1) { min[k] = Math.min(min[k], w[k]); max[k] = Math.max(max[k], w[k]) }
      }
    }
  }
  return Number.isFinite(min[0]) ? Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) : 0
}
