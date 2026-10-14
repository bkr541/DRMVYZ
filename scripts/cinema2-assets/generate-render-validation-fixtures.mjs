// Generates the small GLB models the Cinema 2.0 rendering validation scene and its tests load: the same PBR sphere uncompressed, Meshopt-compressed,
// Draco-compressed and with KTX2 (Basis Universal) textures, plus an animated model (rotating part, morph target, skinned strip).
// Output goes to src/test/fixtures/render-validation/ (never public/, so none of it ships). Deterministic: the same inputs give the same bytes.
//
//   node scripts/cinema2-assets/generate-render-validation-fixtures.mjs [--ktx2-encoder <path to ktx2-encoder/dist/node/index.js>]
//
// KTX2 encoding needs the Basis Universal encoder, which is not a project dependency. To regenerate the KTX2 fixture, install it somewhere
// outside the repo (`npm install ktx2-encoder` in a scratch folder) and pass the path of its `dist/node/index.js`. Without the flag the existing
// committed fixture-ktx2.glb is left as it is.
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { Document } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMaterialsClearcoat, KHRTextureBasisu } from '@gltf-transform/extensions'
import { cloneDocument, draco } from '@gltf-transform/functions'
import sharp from 'sharp'
import * as THREE from 'three'
import { EXRExporter } from 'three/examples/jsm/exporters/EXRExporter.js'
import { createIo, writeGlb } from './asset-tools/io.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outDirectory = join(root, 'src/test/fixtures/render-validation')
const flagIndex = process.argv.indexOf('--ktx2-encoder')
const encoderPath = flagIndex >= 0 ? process.argv[flagIndex + 1] : null

async function png(size, pixel) {
  const data = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) data.set(pixel(x, y), (y * size + x) * 4)
  return new Uint8Array(await sharp(data, { raw: { width: size, height: size, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer())
}

const checker = (x, y) => (((x >> 5) + (y >> 5)) & 1 ? [214, 168, 70, 255] : [38, 52, 104, 255])
// Tangent-space normal map: a field of round bumps. Encodes (n * 0.5 + 0.5).
function bumpNormal(x, y) {
  const period = 64
  const dx = ((x % period) - period / 2) / (period / 2)
  const dy = ((y % period) - period / 2) / (period / 2)
  const r2 = dx * dx + dy * dy
  const slope = r2 < 1 ? 0.9 * Math.sqrt(r2) : 0
  const angle = Math.atan2(dy, dx)
  const nx = -Math.cos(angle) * slope, ny = -Math.sin(angle) * slope, nz = 1
  const length = Math.hypot(nx, ny, nz)
  return [Math.round((nx / length * 0.5 + 0.5) * 255), Math.round((ny / length * 0.5 + 0.5) * 255), Math.round((nz / length * 0.5 + 0.5) * 255), 255]
}
// glTF metallicRoughness texture: G = roughness, B = metalness.
const metalRough = (x, y) => [0, (((x >> 6) + (y >> 6)) & 1) ? 230 : 40, 255, 255]

function uvSphere(radius, widthSegments, heightSegments) {
  const positions = [], normals = [], uvs = [], phases = [], indices = []
  for (let y = 0; y <= heightSegments; y += 1) {
    const v = y / heightSegments
    const theta = v * Math.PI
    for (let x = 0; x <= widthSegments; x += 1) {
      const u = x / widthSegments
      const phi = u * Math.PI * 2
      const nx = -Math.cos(phi) * Math.sin(theta), ny = Math.cos(theta), nz = Math.sin(phi) * Math.sin(theta)
      positions.push(nx * radius, ny * radius, nz * radius)
      normals.push(nx, ny, nz)
      uvs.push(u * 2, v)
      phases.push(u)
    }
  }
  for (let y = 0; y < heightSegments; y += 1) {
    for (let x = 0; x < widthSegments; x += 1) {
      const a = y * (widthSegments + 1) + x, b = a + 1, c = a + widthSegments + 1, d = c + 1
      if (y !== 0) indices.push(a, c, b)
      if (y !== heightSegments - 1) indices.push(b, c, d)
    }
  }
  return { positions, normals, uvs, phases, indices }
}

function accessorFactory(document) {
  const buffer = document.getRoot().listBuffers()[0] ?? document.createBuffer()
  return (type, array) => document.createAccessor().setType(type).setArray(array).setBuffer(buffer)
}

async function pbrDocument() {
  const document = new Document()
  document.createBuffer()
  document.getRoot().getAsset().generator = 'cinema2 render-validation fixtures'
  const accessor = accessorFactory(document)
  const albedo = document.createTexture('albedo').setImage(await png(256, checker)).setMimeType('image/png')
  const normal = document.createTexture('normal').setImage(await png(256, bumpNormal)).setMimeType('image/png')
  const orm = document.createTexture('metalRough').setImage(await png(256, metalRough)).setMimeType('image/png')
  const clearcoat = document.createExtension(KHRMaterialsClearcoat).createClearcoat().setClearcoatFactor(0.8).setClearcoatRoughnessFactor(0.05)
  const material = document.createMaterial('texturedPbr')
    .setBaseColorTexture(albedo).setNormalTexture(normal).setNormalScale(1.2).setMetallicRoughnessTexture(orm)
    .setMetallicFactor(1).setRoughnessFactor(1).setExtension('KHR_materials_clearcoat', clearcoat)
  const sphere = uvSphere(0.5, 48, 24)
  const mesh = document.createMesh('texturedSphere').addPrimitive(document.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(sphere.positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(sphere.normals)))
    .setAttribute('TEXCOORD_0', accessor('VEC2', new Float32Array(sphere.uvs)))
    .setAttribute('_GLOW_PHASE', accessor('SCALAR', new Float32Array(sphere.phases)))
    .setIndices(accessor('SCALAR', new Uint16Array(sphere.indices)))
    .setMaterial(material))
  const plain = uvSphere(0.25, 24, 12)
  const small = document.createMesh('plainSphere').addPrimitive(document.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(plain.positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(plain.normals)))
    .setAttribute('_GLOW_PHASE', accessor('SCALAR', new Float32Array(plain.phases)))
    .setIndices(accessor('SCALAR', new Uint16Array(plain.indices)))
    .setMaterial(document.createMaterial('plainRed').setBaseColorFactor([0.8, 0.1, 0.1, 1]).setMetallicFactor(0).setRoughnessFactor(0.4)))
  const group = document.createNode('fixtureGroup').setTranslation([0, 0.5, 0])
  group.addChild(document.createNode('texturedSphereNode').setMesh(mesh))
  group.addChild(document.createNode('plainSphereNode').setMesh(small).setTranslation([0.9, -0.25, 0]).setExtras({ role: 'satellite' }))
  document.createScene('fixtureScene').addChild(group)
  return document
}

function animatedDocument() {
  const document = new Document()
  document.createBuffer()
  document.getRoot().getAsset().generator = 'cinema2 render-validation fixtures'
  const accessor = accessorFactory(document)
  const material = document.createMaterial('animatedMetal').setBaseColorFactor([0.7, 0.72, 0.78, 1]).setMetallicFactor(1).setRoughnessFactor(0.3)

  // A rotating part: a ring of boxes approximated by a low-poly sphere, spun by a quaternion clip.
  const part = uvSphere(0.3, 12, 6)
  const gearMesh = document.createMesh('gearMesh').addPrimitive(document.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(part.positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(part.normals)))
    .setIndices(accessor('SCALAR', new Uint16Array(part.indices))).setMaterial(material))
  const gear = document.createNode('gear').setMesh(gearMesh).setTranslation([-0.9, 0.4, 0])
  const spinSampler = document.createAnimationSampler()
    .setInput(accessor('SCALAR', new Float32Array([0, 1, 2, 3, 4])))
    .setOutput(accessor('VEC4', new Float32Array([0, 0, 0, 1, 0, 0.7071068, 0, 0.7071068, 0, 1, 0, 0, 0, 0.7071068, 0, -0.7071068, 0, 0, 0, 1])))
  document.createAnimation('spin').addSampler(spinSampler).addChannel(document.createAnimationChannel().setTargetNode(gear).setTargetPath('rotation').setSampler(spinSampler))

  // A morph target: the sphere inflates, driven by a weights clip.
  const blob = uvSphere(0.3, 16, 8)
  const target = document.createPrimitiveTarget('inflate').setAttribute('POSITION', accessor('VEC3', new Float32Array(blob.positions.map((value, index) => (index % 3 === 1 ? value * 0.6 : value * 0.5)))))
  const blobMesh = document.createMesh('blobMesh').setWeights([0])
  blobMesh.addPrimitive(document.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(blob.positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(blob.normals)))
    .setIndices(accessor('SCALAR', new Uint16Array(blob.indices))).setMaterial(material).addTarget(target))
  const blobNode = document.createNode('blob').setMesh(blobMesh).setTranslation([0, 0.4, 0])
  const breatheSampler = document.createAnimationSampler().setInput(accessor('SCALAR', new Float32Array([0, 1, 2]))).setOutput(accessor('SCALAR', new Float32Array([0, 1, 0])))
  document.createAnimation('breathe').addSampler(breatheSampler).addChannel(document.createAnimationChannel().setTargetNode(blobNode).setTargetPath('weights').setSampler(breatheSampler))

  // A skinned strip bent by its second joint.
  const rows = 9
  const positions = [], normals = [], joints = [], weights = [], indices = []
  for (let row = 0; row < rows; row += 1) {
    const y = row / (rows - 1)
    const upper = y > 0.5 ? Math.min(1, (y - 0.5) * 2) : 0
    for (const x of [-0.1, 0.1]) {
      positions.push(x, y, 0)
      normals.push(0, 0, 1)
      joints.push(upper > 0 ? 1 : 0, 0, 0, 0)
      weights.push(1, 0, 0, 0)
    }
    if (row < rows - 1) {
      const a = row * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const rootJoint = document.createNode('jointBase')
  const bendJoint = document.createNode('jointBend').setTranslation([0, 0.5, 0])
  rootJoint.addChild(bendJoint)
  const inverse = (offset) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -offset, 0, 1])
  const skin = document.createSkin('stripSkin').addJoint(rootJoint).addJoint(bendJoint)
    .setInverseBindMatrices(accessor('MAT4', new Float32Array([...inverse(0), ...inverse(0.5)])))
  const stripMesh = document.createMesh('stripMesh').addPrimitive(document.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(normals)))
    .setAttribute('JOINTS_0', accessor('VEC4', new Uint8Array(joints)))
    .setAttribute('WEIGHTS_0', accessor('VEC4', new Float32Array(weights)))
    .setIndices(accessor('SCALAR', new Uint16Array(indices))).setMaterial(material))
  const strip = document.createNode('strip').setMesh(stripMesh).setSkin(skin).setTranslation([0.9, -0.1, 0])
  const bendSampler = document.createAnimationSampler()
    .setInput(accessor('SCALAR', new Float32Array([0, 1, 2])))
    .setOutput(accessor('VEC4', new Float32Array([0, 0, 0, 1, 0, 0, 0.3826834, 0.9238795, 0, 0, 0, 1])))
  document.createAnimation('bend').addSampler(bendSampler).addChannel(document.createAnimationChannel().setTargetNode(bendJoint).setTargetPath('rotation').setSampler(bendSampler))

  const scene = document.createScene('animatedScene')
  strip.addChild(rootJoint)
  scene.addChild(gear).addChild(blobNode).addChild(strip)
  return document
}

async function writeFixture(name, document) {
  await writeFile(join(outDirectory, name), await writeGlb(document))
  console.log(`wrote ${name}`)
}

await mkdir(outDirectory, { recursive: true })
await createIo()
const plain = await pbrDocument()
await writeFixture('fixture-plain.glb', plain)

const meshoptDocument = cloneDocument(plain)
meshoptDocument.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
await writeFixture('fixture-meshopt.glb', meshoptDocument)

const dracoDocument = cloneDocument(plain)
await dracoDocument.transform(draco({ quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14, quantizeGeneric: 16 }))
await writeFixture('fixture-draco.glb', dracoDocument)

await writeFixture('fixture-animated.glb', animatedDocument())

// A tiny equirectangular OpenEXR environment: a cool sky gradient, a warm ground and one very bright "sun" (HDR value 40) so a reflective
// sphere visibly picks it up. Written with Three's own exporter so the EXR loader is tested against a standard-conformant file.
{
  const width = 128, height = 64
  const data = new Uint16Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = y / (height - 1), u = x / (width - 1)
      let r = 0.05 + 0.25 * (1 - v), g = 0.08 + 0.35 * (1 - v), b = 0.14 + 0.6 * (1 - v)
      if (v > 0.5) { r = 0.16 * (v - 0.4); g = 0.12 * (v - 0.4); b = 0.1 * (v - 0.4) }
      const du = Math.min(Math.abs(u - 0.3), 1 - Math.abs(u - 0.3)) * 2 * Math.PI, dv = (v - 0.3) * Math.PI
      if (du * du + dv * dv < 0.05) { r = 40; g = 36; b = 28 }
      data.set([THREE.DataUtils.toHalfFloat(r), THREE.DataUtils.toHalfFloat(g), THREE.DataUtils.toHalfFloat(b), THREE.DataUtils.toHalfFloat(1)], (y * width + x) * 4)
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType)
  const bytes = await new EXRExporter().parse(texture, { type: THREE.HalfFloatType, compression: EXRExporter.ZIP_COMPRESSION })
  await writeFile(join(outDirectory, 'fixture-env.exr'), bytes)
  console.log('wrote fixture-env.exr')
}

if (encoderPath) {
  const { encodeToKTX2 } = await import(pathToFileURL(resolve(encoderPath)).href)
  const imageDecoder = async buffer => {
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    return { data: new Uint8Array(data), width: info.width, height: info.height }
  }
  const ktxDocument = cloneDocument(plain)
  ktxDocument.createExtension(KHRTextureBasisu).setRequired(true)
  for (const texture of ktxDocument.getRoot().listTextures()) {
    const isColor = texture.getName() === 'albedo'
    const isNormal = texture.getName() === 'normal'
    // ETC1S (small, lossy) for color; UASTC (larger, high quality) for the normal map; only color is flagged sRGB.
    const encoded = await encodeToKTX2(texture.getImage(), { isUASTC: !isColor, generateMipmap: true, isSetKTX2SRGBTransferFunc: isColor, isNormalMap: isNormal, imageDecoder, enableDebug: false })
    texture.setImage(encoded).setMimeType('image/ktx2')
  }
  await writeFixture('fixture-ktx2.glb', ktxDocument)
} else if (!existsSync(join(outDirectory, 'fixture-ktx2.glb'))) {
  console.warn('fixture-ktx2.glb is not present; pass --ktx2-encoder to generate it (see the header of this file).')
}
