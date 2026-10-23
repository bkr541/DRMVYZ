// NIGHTSHIFT Step 1: static reference geometry. Original source GLBs are never modified.
// Discards the sources' invalid animation buffers: motion will be owned by Cinema 2.0.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Document } from '@gltf-transform/core'
import { KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions'
import sharp from 'sharp'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { readAsset, writeGlb } from './asset-tools/io.mjs'

const root = resolve(import.meta.dirname, '../..')
const doc = new Document()
const buffer = doc.createBuffer()
const scene = doc.createScene('NIGHTSHIFT static installation')
// Expand the room physically while keeping the floor as the foreground anchor
// under the slightly wider camera. The tile count and animation addresses stay fixed.
const floorGroup = doc.createNode('nightshift.floor').setScale([1.175, 1, 1.175])
scene.addChild(floorGroup)
const strength = doc.createExtension(KHRMaterialsEmissiveStrength)
const srgb = hex => new THREE.Color(hex).toArray()
const palette = ['#ff20d9', '#19edff', '#323bff', '#ffb31c']

function material(name, hex, metalness, roughness, emission = 0) {
  const rgb = srgb(hex)
  const mat = doc.createMaterial(name).setBaseColorFactor([...rgb, 1])
    .setMetallicFactor(metalness).setRoughnessFactor(roughness)
  if (emission > 0) mat.setEmissiveFactor(rgb).setExtension(
    'KHR_materials_emissive_strength', strength.createEmissiveStrength().setEmissiveStrength(emission),
  )
  return mat
}
function accessor(array, type) { return doc.createAccessor().setBuffer(buffer).setType(type).setArray(array) }
function fromThree(geometry, mat, name) {
  const primitive = doc.createPrimitive()
    .setAttribute('POSITION', accessor(Float32Array.from(geometry.attributes.position.array), 'VEC3'))
    .setAttribute('NORMAL', accessor(Float32Array.from(geometry.attributes.normal.array), 'VEC3'))
    .setIndices(accessor(geometry.index ? Uint32Array.from(geometry.index.array)
      : Uint32Array.from({ length: geometry.attributes.position.count }, (_, i) => i), 'SCALAR')).setMaterial(mat)
  if (geometry.attributes.uv) primitive.setAttribute('TEXCOORD_0', accessor(Float32Array.from(geometry.attributes.uv.array), 'VEC2'))
  return doc.createMesh(name).addPrimitive(primitive)
}
function fromSource(node, mat, name, bakeWorld = false) {
  const mesh = doc.createMesh(name)
  for (const p of node.getMesh().listPrimitives()) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(p.getAttribute('POSITION').getArray()), 3))
    g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(p.getAttribute('NORMAL').getArray()), 3))
    g.setIndex(new THREE.BufferAttribute(Uint32Array.from(p.getIndices().getArray()), 1))
    if (bakeWorld) g.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()))
    const copy = fromThree(g, mat, name)
    mesh.addPrimitive(copy.listPrimitives()[0]); copy.dispose(); g.dispose()
  }
  return mesh
}
function place(name, mesh, position, extras = {}) {
  const node = doc.createNode(name).setMesh(mesh).setTranslation(position).setExtras(extras)
  if (name.startsWith('nightshift.floor.')) floorGroup.addChild(node)
  else scene.addChild(node)
  return node
}

// Preserve both source mirror and dark backing meshes, with a clean center pivot.
const ballSource = await readAsset(resolve(root, 'docs/NIGHTSHIFT/pretty_simple_discoball.glb'))
const ball = doc.createNode('nightshift.ball').setTranslation([0, 5.7, -2.3]).setScale([2, 2, 2])
scene.addChild(ball)
for (const source of ballSource.document.getRoot().listNodes().filter(n => n.getMesh())) {
  const mirror = source.getMesh().listPrimitives()[0].getMaterial().getName() === 'disco_mat'
  const mat = material(mirror ? 'ball.mirrors' : 'ball.grout', mirror ? '#dac0d8' : '#0b0416', 1, mirror ? 0.065 : 0.58)
  const name = mirror ? 'nightshift.ball.mirrors' : 'nightshift.ball.grout'
  ball.addChild(doc.createNode(name).setMesh(fromSource(source, mat, name)))
}

// Retain the supplied floor's structural chassis. Its ten animated color groups
// overlap complete layouts, so use addressable inserts rather than playing those clips.
const floorSource = await readAsset(resolve(root, 'docs/NIGHTSHIFT/animated_dance_floor_neon_lights.glb'))
const chassisSource = floorSource.document.getRoot().listNodes().find(n => n.getMesh()?.listPrimitives()[0].getMaterial()?.getName() === 'base')
if (!chassisSource) throw new Error('NIGHTSHIFT floor source is missing its base.')
const housing = material('floor.housing', '#060713', 0.15, 0.4)
place('nightshift.floor.chassis', fromSource(chassisSource, housing, 'floor-source-chassis', true), [0, -0.012, 0])
  .setScale([12.6 / 7.02, 0.12, 12.6 / 7.02])

// A lightly textured luminous glass insert. Narrow dark frames remain geometric.
const pixels = Buffer.alloc(128 * 128 * 3)
for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
  const edge = Math.min(x, y, 127 - x, 127 - y)
  const center = Math.exp(-((x - 64) ** 2 + (y - 64) ** 2) / 3600)
  const value = Math.round((0.38 + center * 0.48 + 0.06 * Math.sin(x * 2.3) * Math.cos(y * 2.3)) * Math.min(1, 0.45 + edge / 5) * 255)
  pixels.fill(value, (y * 128 + x) * 3, (y * 128 + x) * 3 + 3)
}
const texture = doc.createTexture('nightshift-glass-microtexture').setImage(await sharp(pixels, { raw: { width: 128, height: 128, channels: 3 } }).png().toBuffer()).setMimeType('image/png')
const inserts = palette.flatMap((hex, i) => [0.22, 1, 2.2].map((gain, level) =>
  material(`floor.palette.${i}.${level}`, hex, 0.35, 0.2, gain).setBaseColorTexture(texture).setEmissiveTexture(texture)))
const frameMesh = fromThree(new RoundedBoxGeometry(1.238, 0.055, 1.238, 2, 0.018), housing, 'floor-cell-frame')
const panelGeometry = new THREE.BoxGeometry(1.19, 0.016, 1.19)
const faces = inserts.map((mat, i) => fromThree(panelGeometry, mat, `floor-cell-insert-${i}`))
for (let row = 0; row < 10; row++) for (let col = 0; col < 10; col++) {
  const position = [(col - 4.5) * 1.24, 0.02, (row - 4.5) * 1.24]
  let hash = Math.imul(row + 13, 73856093) ^ Math.imul(col + 7, 19349663)
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b); hash ^= hash >>> 16
  const index = (hash >>> 0) % inserts.length
  place(`nightshift.floor.frame.${row}.${col}`, frameMesh, position)
  place(`nightshift.floor.cell.${row}.${col}`, faces[index], [position[0], 0.055, position[2]], { row, column: col, paletteIndex: Math.floor(index / 3), level: index % 3 })
}

// Three physical overhead strips; the rear rail is depth-occluded by the ball.
const cyan = material('ceiling.cyan', '#19edff', 0, 0.7, 1.1).setBaseColorFactor([0.002, 0.015, 0.02, 1])
const ceilingHousing = material('ceiling.housing', '#061528', 0.12, 0.5)
const strip = fromThree(new THREE.BoxGeometry(0.43, 0.065, 16), cyan, 'ceiling-strip')
const casing = fromThree(new THREE.BoxGeometry(0.58, 0.12, 16.12), ceilingHousing, 'ceiling-casing')
for (const x of [-5.2, 5.2]) {
  place(`nightshift.ceiling.housing.${x}`, casing, [x, 6.42, 1])
  place(`nightshift.ceiling.strip.${x}`, strip, [x, 6.35, 1])
}
place('nightshift.ceiling.rear-housing', fromThree(new THREE.BoxGeometry(10.98, 0.12, 0.58), ceilingHousing, 'ceiling-rear-casing'), [0, 6.42, -7])
place('nightshift.ceiling.rear-strip', fromThree(new THREE.BoxGeometry(10.83, 0.065, 0.43), cyan, 'ceiling-rear-strip'), [0, 6.35, -7])

Object.assign(doc.getRoot().getAsset(), { version: '2.0', generator: 'DRMVYZ NIGHTSHIFT static-core builder', extras: {
  license: 'CC-BY-4.0', modification: 'Source ball geometry retained; floor chassis flattened/rescaled; source animations omitted; independently addressed floor inserts and ceiling frame added.',
  sources: [ballSource.document.getRoot().getAsset().extras, floorSource.document.getRoot().getAsset().extras],
} })
await mkdir(resolve(root, 'public/cinema2/models'), { recursive: true })
await writeFile(resolve(root, 'public/cinema2/models/nightshift-static.glb'), await writeGlb(doc))

// Static authored reflection room: hard colored panels and a tiled lower hemisphere.
// This is IBL for mirror facets, not the visible background or a replacement scene.
const width = 512, height = 256
const hdr = Buffer.alloc(width * height * 4)
const boxes = [
  [0.7, 0.23, 0.065, 0.15, [1, 0.15, 0.015], 16],
  [0.3, 0.23, 0.04, 0.2, [0.015, 0.3, 1], 18],
  [0.5, 0.7, 0.5, 0.18, [1, 0.005, 0.5], 3],
  [0.12, 0.45, 0.015, 0.28, [0.01, 0.7, 1], 12],
  [0.87, 0.45, 0.015, 0.28, [0.01, 0.7, 1], 12],
]
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const u = (x + 0.5) / width, v = (y + 0.5) / height
  const rgb = [0.008, 0.003, 0.014]
  for (const [cx, cy, hx, hy, color, gain] of boxes) {
    const dx = Math.min(Math.abs(u - cx), 1 - Math.abs(u - cx)) / hx
    const dy = Math.abs(v - cy) / hy
    const mask = Math.max(0, Math.min(1, (1 - Math.max(dx, dy)) * 12))
    for (let c = 0; c < 3; c++) rgb[c] += color[c] * gain * mask
  }
  if (v > 0.53 && v < 0.92) {
    const ix = Math.floor(u * 38), iy = Math.floor(v * 30)
    const bright = ((ix * 17 + iy * 31) % 13) < 3
    const family = (ix + iy * 3) % 8
    const color = srgb(palette[family < 4 ? family : 0])
    for (let c = 0; c < 3; c++) rgb[c] += color[c] * (bright ? 6 : 0.15)
  }
  const max = Math.max(...rgb), exponent = Math.floor(Math.log2(max)) + 1
  const offset = (y * width + x) * 4
  for (let c = 0; c < 3; c++) hdr[offset + c] = Math.min(255, Math.floor(rgb[c] * 256 / 2 ** exponent))
  hdr[offset + 3] = exponent + 128
}
await mkdir(resolve(root, 'public/cinema2/environments'), { recursive: true })
await writeFile(resolve(root, 'public/cinema2/environments/nightshift-room.hdr'), Buffer.concat([
  Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`), hdr,
]))
console.log('NIGHTSHIFT: wrote static installation and reflection environment; original animations omitted.')
