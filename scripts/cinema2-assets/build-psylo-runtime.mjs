// PSYLO Phase 1: reproducible static world, derived from immutable attributed sources.
// No animation, music, fog, bloom or automatic camera behavior is baked into this asset.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Document } from '@gltf-transform/core'
import { cloneDocument, copyToDocument, dedup, listTextureSlots, prune, quantize, simplify, weld } from '@gltf-transform/functions'
import { EXTMeshoptCompression, EXTTextureWebP, KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions'
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer'
import * as T from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import sharp from 'sharp'
import { readAsset, writeGlb } from './asset-tools/io.mjs'
import { inspectDocument } from './asset-tools/inspect.mjs'
import { resolveAssetBudgets } from './assets-core.mjs'

const root = resolve(import.meta.dirname, '../..')
const sourceDir = resolve(root, 'scripts/cinema2-assets/sources/psylo')
const reportDir = resolve(root, 'docs/PSYLO')
const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('PSYLO static forest')
const emission = doc.createExtension(KHRMaterialsEmissiveStrength)
const batches = new Map(), species = [], sources = [], instances = []
const budgets = resolveAssetBudgets(JSON.parse(await readFile(resolve(root, 'assets/cinema2/budgets.json'), 'utf8')))
const files = ['stylized_mushrooms.glb', 'stylized_mushrooms_-_low_poly.glb', 'mushrooms (1).glb', 'mushrooms.glb', 'mushroom_magic.glb']
const sourceContractPath = resolve(sourceDir, 'sources.json')
let sourceContract
try { sourceContract = JSON.parse(await readFile(sourceContractPath, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready])

function worldGeometry(node, p) {
  const g = new T.BufferGeometry()
  for (const [semantic, attribute] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv']]) {
    const a = p.getAttribute(semantic)
    if (a) g.setAttribute(attribute, new T.BufferAttribute(Float32Array.from(a.getArray()), a.getElementSize()))
  }
  if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  if (p.getIndices()) g.setIndex(new T.BufferAttribute(Uint32Array.from(p.getIndices().getArray()), 1))
  else g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i))
  g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()))
  if (!g.attributes.normal) g.computeVertexNormals()
  return g
}
for (let index = 0; index < files.length; index++) {
  const file = files[index], bytes = await readFile(resolve(sourceDir, file))
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (sourceContract && sourceContract.sources.find(s => s.file === file)?.sha256 !== hash) throw new Error(`Immutable source changed: ${file}`)
  const { document: source } = await readAsset(resolve(sourceDir, file))
  const metadata = source.getRoot().getAsset().extras
  sources.push({ file, sha256: hash, bytes: bytes.length, ...metadata })
  // Discard source presentation surfaces/cards before simplification and copying.
  for (const node of source.getRoot().listNodes()) {
    if (!node.getMesh()) continue
    const mat = node.getMesh().listPrimitives()[0].getMaterial().getName()
    if ((index === 0 && !node.getName().startsWith('Circle')) || (index === 4 && ['material_3', 'material_7'].includes(mat))) node.setMesh(null)
  }
  for (const extension of source.getRoot().listExtensionsUsed()) if (extension.extensionName === 'KHR_materials_unlit') extension.dispose()
  await source.transform(prune())
  if (index === 4) await source.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: .12, error: .008, lockBorder: false }), prune())
  for (const extension of source.getRoot().listExtensionsUsed()) doc.createExtension(extension.constructor)
  const materials = source.getRoot().listMaterials()
  const map = copyToDocument(doc, source, materials)
  for (const material of materials) {
    const m = map.get(material)
    m.setName(`psylo.source.${index}.${material.getName()}`).setMetallicFactor(.02).setRoughnessFactor(.68).setDoubleSided(true)
    const ext = m.getExtension('KHR_materials_emissive_strength')
    if (ext) ext.setEmissiveStrength(index === 4 ? Math.min(1.2, ext.getEmissiveStrength() * .15) : .48)
    // Preserve hand-painted artwork while restoring real surface-light response.
    if (index === 0) m.setEmissiveFactor([.34, .34, .34])
  }
  const nodes = source.getRoot().listNodes().filter(n => n.getMesh())
  const groups = index === 0 || index === 1 || index === 2 ? nodes.map(n => [n]) : [nodes]
  const entries = []
  for (const group of groups) {
    const parts = group.flatMap(n => n.getMesh().listPrimitives().map(p => ({ geometry: worldGeometry(n, p), material: map.get(p.getMaterial()) })))
    const box = new T.Box3()
    for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox) }
    const height = box.max.y - box.min.y
    // Ground at the stem contact, not the center of a cap's overhang.
    const foot = new T.Vector3(), v = new T.Vector3(); let feet = 0
    for (const { geometry } of parts) for (let i = 0; i < geometry.attributes.position.count; i++) {
      v.fromBufferAttribute(geometry.attributes.position, i)
      if (v.y <= box.min.y + height * .04) { foot.add(v); feet++ }
    }
    foot.divideScalar(feet || 1); foot.y = box.min.y
    for (const p of parts) p.geometry.translate(-foot.x, -foot.y, -foot.z).scale(1 / height, 1 / height, 1 / height)
    const entry = { id: species.length, source: file, sourceNodes: group.map(n => n.getName()), parts }
    species.push(entry); entries.push(entry)
  }
  sources.at(-1).speciesIds = entries.map(s => s.id)
}
if (!sourceContract) await writeFile(sourceContractPath, JSON.stringify({ version: 1, sources: sources.map(({ file, sha256, bytes, author, license, source, title }) => ({ file, sha256, bytes, author, license, source, title })) }, null, 2) + '\n')

let seed = 97031
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
function ground(x, z) {
  const r = Math.hypot(x, z + 8)
  const corridor = Math.exp(-(x * x) / 10) * Math.exp(-((z - 5) ** 2) / 380)
  const ring = Math.exp(-((r - 15) ** 2) / 3)
  return (1 - Math.max(corridor, ring) * .85) * (.25 * Math.sin(x * .18) * Math.cos(z * .16) + .12 * Math.sin(x * .39 + z * .22))
}
function addGeometry(geometry, material, id, rootPosition, zone, speciesId, height = 1, dynamic = true) {
  const n = geometry.attributes.position.count
  const roots = new Float32Array(n * 3), heights = new Float32Array(n), ids = new Float32Array(n), zones = new Float32Array(n), types = new Float32Array(n), parts = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    roots.set(rootPosition, i * 3); heights[i] = dynamic ? T.MathUtils.clamp((geometry.attributes.position.getY(i) - rootPosition[1]) / height, 0, 1) : 0
    ids[i] = id; zones[i] = zone; types[i] = speciesId; parts[i] = dynamic && heights[i] > .6 ? 1 : 0
  }
  for (const [name, array, size] of [['_PSYLO_ROOT', roots, 3], ['_PSYLO_HEIGHT', heights, 1], ['_PSYLO_ID', ids, 1], ['_PSYLO_ZONE', zones, 1], ['_PSYLO_SPECIES', types, 1], ['_PSYLO_PART', parts, 1]]) geometry.setAttribute(name, new T.BufferAttribute(array, size))
  if (!geometry.attributes.uv) geometry.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2))
  // Uniform attribute layouts allow one draw per material, not one draw per plant.
  if (!geometry.attributes.color) geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3).fill(1), 3))
  if (!geometry.index) geometry.setIndex(Array.from({ length: n }, (_, i) => i))
  const list = batches.get(material) ?? []; list.push(geometry); batches.set(material, list)
}
function plant(s, x, z, height, heading = random() * Math.PI * 2, zone = 0) {
  const position = [x, ground(x, z), z], id = instances.length
  const matrix = new T.Matrix4().compose(new T.Vector3(...position), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), heading), new T.Vector3(height, height, height))
  instances.push({ id, species: s.id, source: s.source, position, height, heading, zone })
  for (const part of s.parts) addGeometry(part.geometry.clone().applyMatrix4(matrix), part.material, id, position, zone, s.id, height)
}
const bySource = file => species.filter(s => s.source === file)
const painted = bySource(files[0]), lowpoly = bySource(files[1]), varied = bySource(files[2])
plant(painted[0], 0, -8, 9.2, -.35, 0)
plant(lowpoly[1], -9.5, -13, 7, .4, 1)
plant(lowpoly[2], 8.5, -17, 6.2, 2.1, 2)
plant(bySource(files[4])[0], 11, -2, 5.8, -.8, 2)
// Smaller source species become believable giant forest growth after normalization.
plant(painted[1], -5.7, -7, 3.5, .7, 0)
plant(painted[2], 5.1, -10, 2.8, -.3, 0)
plant(bySource(files[3])[0], -10, 1, 2.5, .3, 1)
let medium = 0, small = 0
for (let attempt = 0; attempt < 4000 && medium < 48; attempt++) {
  const x = (random() - .5) * 65, z = random() * 65 - 43, r = Math.hypot(x, z + 8)
  if (r < 8 || Math.abs(r - 15) < 3.4 || (Math.abs(x) < 4 && z > -9)) continue
  const zone = x < -4 ? 1 : x > 4 ? 2 : 3
  plant(lowpoly[medium % 3], x, z, 3.2 + random() * 4.3, random() * Math.PI * 2, zone); medium++
}
for (let attempt = 0; attempt < 4000 && small < 112; attempt++) {
  const x = (random() - .5) * 58, z = random() * 58 - 38, r = Math.hypot(x, z + 8)
  if (r < 4.3 || Math.abs(r - 15) < 2.4 || (Math.abs(x) < 3 && z > -9)) continue
  const s = small % 9 === 0 ? varied[small % varied.length] : lowpoly[small % 3]
  plant(s, x, z, .35 + random() * 1.45, random() * Math.PI * 2, x < 0 ? 1 : 2); small++
}
function mat(name, hex, glow = 0) {
  const rgb = new T.Color(hex).toArray()
  const m = doc.createMaterial(name).setBaseColorFactor([...rgb, 1]).setRoughnessFactor(.9).setMetallicFactor(0)
  if (glow) m.setEmissiveFactor(rgb).setExtension('KHR_materials_emissive_strength', emission.createEmissiveStrength().setEmissiveStrength(glow))
  return m
}
const terrain = new T.PlaneGeometry(150, 150, 100, 100).rotateX(-Math.PI / 2)
const colorArray = new Float32Array(terrain.attributes.position.count * 3)
const dark = new T.Color('#20372f'), pathColor = new T.Color('#395046'), temp = new T.Color()
for (let i = 0; i < terrain.attributes.position.count; i++) {
  const x = terrain.attributes.position.getX(i), z = terrain.attributes.position.getZ(i), r = Math.hypot(x, z + 8)
  terrain.attributes.position.setY(i, ground(x, z) - .035)
  const path = Math.max(Math.exp(-(x * x) / 5) * Math.exp(-((z - 5) ** 2) / 330), Math.exp(-((r - 15) ** 2) / 1.4))
  temp.copy(dark).lerp(pathColor, path).multiplyScalar(.8 + .2 * Math.sin(x * 1.3 + z * 2.2)); temp.toArray(colorArray, i * 3)
}
terrain.setAttribute('color', new T.BufferAttribute(colorArray, 3)); terrain.computeVertexNormals()
addGeometry(terrain, mat('psylo.terrain', '#ffffff'), -1, [0, 0, 0], -1, -1, 1, false)
const rootMats = [mat('psylo.mycelium.teal', '#41baa3', .45), mat('psylo.mycelium.amber', '#b58942', .3)]
for (let line = 0; line < 28; line++) {
  const angle = line * Math.PI * 2 / 28, length = 5 + random() * 22
  const points = Array.from({ length: 20 }, (_, i) => {
    const t = i / 19, r = 2.7 + t * length, a = angle + Math.sin(t * 6 + line) * .06
    const x = Math.sin(a) * r, z = -8 + Math.cos(a) * r
    return new T.Vector3(x, ground(x, z) + .025, z)
  })
  const g = new T.TubeGeometry(new T.CatmullRomCurve3(points), 38, .014 + random() * .018, 4, false)
  addGeometry(g, rootMats[line % 2], -2, [0, 0, -8], line % 3, -1, 1, false)
}
const grassMat = mat('psylo.groundcover', '#347d69'), stoneMat = mat('psylo.stone', '#343649')
for (let i = 0; i < 340; i++) {
  const x = (random() - .5) * 58, z = random() * 58 - 38, r = Math.hypot(x, z + 8)
  if (Math.abs(r - 15) < 2 || (Math.abs(x) < 3 && z > -9)) continue
  const h = .25 + random() * .5
  for (let blade = 0; blade < 3; blade++) {
    const g = new T.ConeGeometry(.045, h, 3, 1).translate(0, h / 2, 0).rotateZ((random() - .5) * .6).rotateY(random() * 6.28).translate(x, ground(x, z), z)
    addGeometry(g, grassMat, -3, [x, ground(x, z), z], -1, -1, 1, false)
  }
}
for (let i = 0; i < 38; i++) {
  const x = (random() - .5) * 64, z = random() * 64 - 42, r = Math.hypot(x, z + 8)
  if (r < 7 || Math.abs(r - 15) < 2.8 || (Math.abs(x) < 4 && z > -9)) continue
  const g = new T.IcosahedronGeometry(1, 0).scale(.4 + random(), .25 + random() * .5, .4 + random()).rotateY(random() * 6.28).translate(x, ground(x, z) + .1, z)
  addGeometry(g, stoneMat, -4, [x, ground(x, z), z], -1, -1, 1, false)
}
function accessor(array, type) { return doc.createAccessor().setBuffer(buffer).setType(type).setArray(array) }
for (const [material, geometries] of batches) {
  const g = mergeGeometries(geometries)
  if (!g) throw new Error(`Could not batch ${material.getName()}`)
  if (material.getNormalTexture()) g.computeTangents()
  const p = doc.createPrimitive().setMaterial(material).setIndices(accessor(Uint32Array.from(g.index.array), 'SCALAR'))
  for (const [name, a] of Object.entries(g.attributes)) {
    const semantic = { position: 'POSITION', normal: 'NORMAL', tangent: 'TANGENT', uv: 'TEXCOORD_0', color: 'COLOR_0' }[name] ?? name
    p.setAttribute(semantic, accessor(Float32Array.from(a.array), a.itemSize === 1 ? 'SCALAR' : `VEC${a.itemSize}`))
  }
  scene.addChild(doc.createNode(material.getName()).setMesh(doc.createMesh(material.getName()).addPrimitive(p)))
  geometries.forEach(g => g.dispose()); g.dispose()
}
// All dependency textures are local and bounded; data maps stay lossless PNG.
for (const texture of doc.getRoot().listTextures()) {
  const slots = listTextureSlots(texture)
  const color = slots.length > 0 && slots.every(slot => ['baseColorTexture', 'emissiveTexture'].includes(slot))
  const pipeline = sharp(Buffer.from(texture.getImage())).resize({ width: 384, height: 384, fit: 'inside', withoutEnlargement: true })
  const image = await (color ? pipeline.webp({ quality: 90, alphaQuality: 100 }) : pipeline.png({ compressionLevel: 9 })).toBuffer()
  texture.setImage(image).setMimeType(color ? 'image/webp' : 'image/png')
  if (color) doc.createExtension(EXTTextureWebP).setRequired(true)
}
const extras = { phase: 1, generator: 'DRMVYZ PSYLO static-core builder', modification: 'Selected source geometry normalized and grounded; source presentation bases/cards removed; unlit materials adapted to PBR; Mushroom Magic simplified; source textures capped at 384px with WebP color maps; 16-bit position quantization; continuous terrain, groundcover, rocks and mycelium added; semantic root/height/ID/zone/species/part attributes added; material batches merged.', sources: sources.map(({ file, sha256, author, license, source }) => ({ file, sha256, author, license, source })), instances }
Object.assign(doc.getRoot().getAsset(), { generator: 'DRMVYZ PSYLO Phase 1', extras })
await doc.transform(dedup(), prune({ keepAttributes: true }), quantize({ pattern: /^(POSITION|NORMAL|TANGENT|TEXCOORD_0|COLOR_0)$/, quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14, quantizeColor: 8 }))
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
const bytes = await writeGlb(doc)
const inspection = inspectDocument(doc, { name: 'psylo-static', container: 'glb', fileBytes: bytes.length, budgets })
if (!inspection.ok || bytes.length > budgets.maxFileBytes) throw new Error(JSON.stringify(inspection.issues))
await mkdir(resolve(root, 'public/cinema2/models'), { recursive: true })
await writeFile(resolve(root, 'public/cinema2/models/psylo-static.glb'), bytes)
const low = cloneDocument(doc)
for (const texture of low.getRoot().listTextures()) {
  const pipeline = sharp(Buffer.from(texture.getImage())).resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
  texture.setImage(await (texture.getMimeType() === 'image/webp' ? pipeline.webp({ quality: 88, alphaQuality: 100 }) : pipeline.png({ compressionLevel: 9 })).toBuffer())
}
const lowBytes = await writeGlb(low)
const lowInspection = inspectDocument(low, { name: 'psylo-static-low', container: 'glb', fileBytes: lowBytes.length, budgets })
if (!lowInspection.ok || lowInspection.memory.totalBytes > budgets.assetGpuBytes.low) throw new Error('PSYLO low tier exceeds budget: ' + JSON.stringify(lowInspection.issues))
await writeFile(resolve(root, 'public/cinema2/models/psylo-static-low.glb'), lowBytes)
await writeFile(resolve(reportDir, 'PSYLO-asset-report.json'), JSON.stringify({ phase: 1, sources, inspection, lowInspection, instances, species: species.map(({ id, source, sourceNodes }) => ({ id, source, sourceNodes })), sourcePresentationRemoved: true, sourceAnimations: 0 }, null, 2) + '\n')
console.log(JSON.stringify({ file: 'psylo-static.glb', bytes: bytes.length, triangles: inspection.geometry.triangles, materials: inspection.counts.materials, gpuMiB: inspection.memory.totalBytes / 1048576, instances: instances.length, lowBytes: lowBytes.length, lowGpuMiB: lowInspection.memory.totalBytes / 1048576, issues: inspection.issues }))
