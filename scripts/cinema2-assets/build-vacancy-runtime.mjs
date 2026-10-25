// VACANCY runtime asset: the brick room and six televisions from the owner-supplied source GLBs in docs/Vacancy, merged into one shipped model.
// Original sources are never modified. Each television becomes a `vacancy.tv.<id>` node normalised to a real-world width, standing on y = 0
// with its pivot at the bottom centre and its front facing +Z. Textures are re-sized per role and quality tier to fit the Cinema 2.0 budgets.
//
//   node scripts/cinema2-assets/build-vacancy-runtime.mjs [--report]
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Document } from '@gltf-transform/core'
import { EXTTextureWebP } from '@gltf-transform/extensions'
import { dedup, getBounds, listTextureSlots, mergeDocuments, prune, unpartition } from '@gltf-transform/functions'
import sharp from 'sharp'
import { readAsset, writeGlb } from './asset-tools/io.mjs'

const root = resolve(import.meta.dirname, '../..')
const sourceDir = resolve(root, 'docs/Vacancy')
const outDir = resolve(root, 'public/cinema2/models')

/**
 * One entry per television. `width` is the real-world width in metres the set is normalised to, `yaw` turns a model whose front is not +Z, and
 * `bodyNodes` (optional) names the meshes that make up the set's body, so antennae and similar do not count when stacking something on top.
 */
export const VACANCY_TVS = [
  { id: 'old-school', file: 'old_school_tv', width: 0.62, yaw: 0, base: 768, data: 512 },
  { id: 'old-two', file: 'old_tv2', width: 0.5, yaw: 0, base: 512, data: 256 },
  { id: 'sony-pvm', file: 'sony_pvm-14l2_crt_tv', width: 0.38, yaw: 0, base: 512, data: 256 },
  { id: 'retro', file: 'tv__old_tv__retro_tv', width: 0.55, yaw: -90, base: 768, data: 512 },
  { id: 'tv-set', file: 'tv_set', width: 0.7, yaw: 0, base: 768, data: 512 },
  { id: 'vintage', file: 'vintage_tv4', width: 0.52, yaw: 0, base: 1024, data: 512, bodyNodes: /^(tv-b_low|tv_low)/ },
]

/** Texture edge multipliers per quality tier, relative to each entry's high-tier edge. */
const TIER_SCALE = { high: 1, medium: 0.75, low: 0.5 }
const ROOM_EDGE = { high: 1024, medium: 1024, low: 768 }
const ROOM_EMISSIVE_EDGE = { high: 512, medium: 512, low: 256 }
const TIER_FILE = { high: 'vacancy-set.glb', medium: 'vacancy-set-medium.glb', low: 'vacancy-set-low.glb' }

const COLOR_SLOTS = new Set(['baseColorTexture', 'emissiveTexture'])
const screens = existsSync(resolve(import.meta.dirname, 'vacancy-screens.json'))
  ? JSON.parse(await readFile(resolve(import.meta.dirname, 'vacancy-screens.json'), 'utf8'))
  : {}

function bounds(node) {
  const { min, max } = getBounds(node)
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] }
}

/** Merge one source document into `target`, returning the merged scene's top-level nodes (removed from any scene). */
function mergeSource(target, source) {
  const before = new Set(target.getRoot().listScenes())
  mergeDocuments(target, source)
  const merged = target.getRoot().listScenes().filter(scene => !before.has(scene))
  const nodes = merged.flatMap(scene => scene.listChildren())
  for (const scene of merged) { for (const child of scene.listChildren()) scene.removeChild(child); scene.dispose() }
  return nodes
}

function textureRole(document, texture) {
  const slots = listTextureSlots(texture)
  return slots.length > 0 && slots.every(slot => COLOR_SLOTS.has(slot)) ? 'color' : 'data'
}

/** Re-encode every texture of `document` as WebP at the edge the callback returns. Returns the estimated decoded GPU bytes. */
async function sizeTextures(document, edgeFor) {
  document.createExtension(EXTTextureWebP).setRequired(true)
  let gpu = 0
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage()
    const size = texture.getSize()
    if (!image || !size) continue
    const role = textureRole(document, texture)
    const edge = edgeFor(texture, role)
    let pipeline = sharp(Buffer.from(image))
    const scale = Math.min(1, edge / Math.max(size[0], size[1]))
    const width = Math.max(1, Math.round(size[0] * scale)), height = Math.max(1, Math.round(size[1] * scale))
    if (scale < 1) pipeline = pipeline.resize({ width, height, fit: 'fill', kernel: 'lanczos3' })
    pipeline = role === 'color' ? pipeline.webp({ quality: 86, alphaQuality: 100 }) : pipeline.webp({ lossless: true })
    texture.setImage(new Uint8Array(await pipeline.toBuffer())).setMimeType('image/webp')
    gpu += width * height * 4 * (4 / 3)
  }
  return gpu
}

async function build(tier) {
  const document = new Document()
  document.createBuffer()
  const scene = document.createScene('VACANCY set')

  // Room: used as authored, but rendered lit so the screens' light reaches the walls and floor. The unlit extension is dropped.
  const room = await readAsset(resolve(sourceDir, 'abandoned_brick_room.glb'))
  const roomNode = document.createNode('vacancy.room')
  scene.addChild(roomNode)
  for (const node of mergeSource(document, room.document)) roomNode.addChild(node)
  for (const material of document.getRoot().listMaterials()) {
    if (material.getExtension('KHR_materials_unlit')) {
      material.setExtension('KHR_materials_unlit', null)
      material.setMetallicFactor(0).setRoughnessFactor(0.92)
    }
  }
  const roomMaterials = new Set(document.getRoot().listMaterials())
  const roomTextures = new Set(document.getRoot().listTextures())

  const report = []
  for (const tv of VACANCY_TVS) {
    const source = await readAsset(resolve(sourceDir, `${tv.file}.glb`))
    const wrapper = document.createNode(`vacancy.tv.${tv.id}`)
    for (const node of mergeSource(document, source.document)) wrapper.addChild(node)
    const yaw = (tv.yaw * Math.PI) / 180
    wrapper.setRotation([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)])
    scene.addChild(wrapper)
    const b = bounds(wrapper)
    const scale = tv.width / b.size[0]
    const centre = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2]
    wrapper.setScale([scale, scale, scale]).setTranslation([-centre[0] * scale, -centre[1] * scale, -centre[2] * scale])
    // Support height (what the next tier rests on) excludes antennae and other protrusions.
    let bodyHeight = b.size[1] * scale
    if (tv.bodyNodes) {
      const bodies = []
      wrapper.traverse(n => { if (n.getMesh() && tv.bodyNodes.test(n.getName())) bodies.push(n) })
      // The wrapper transform is already applied, so these bounds are in normalised world space with the base at y = 0.
      if (bodies.length) bodyHeight = Math.max(...bodies.map(n => getBounds(n).max[1]))
    }
    // Normalised size after the wrapper transform (rotation applied, pivot bottom-centre).
    const size = b.size.map(v => +(v * scale).toFixed(4))
    wrapper.setExtras({ vacancyTv: tv.id, size, bodyHeight: +bodyHeight.toFixed(4), ...(screens[tv.id] ? { screen: screens[tv.id] } : {}) })
    report.push({ id: tv.id, size, bodyHeight: +bodyHeight.toFixed(3), screen: Boolean(screens[tv.id]) })
  }

  const entryFor = new Map()
  for (const tv of VACANCY_TVS) {
    entryFor.set(tv.id, tv)
  }
  // Which television owns each texture (textures are not shared between sources).
  const owner = new Map()
  for (const node of scene.listChildren()) {
    const id = node.getExtras()?.vacancyTv
    if (!id) continue
    node.traverse(n => {
      for (const primitive of n.getMesh()?.listPrimitives() ?? []) {
        const material = primitive.getMaterial()
        if (!material) continue
        for (const texture of [material.getBaseColorTexture(), material.getNormalTexture(), material.getMetallicRoughnessTexture(), material.getEmissiveTexture(), material.getOcclusionTexture()]) if (texture) owner.set(texture, id)
      }
    })
  }
  const gpu = await sizeTextures(document, (texture, role) => {
    const id = owner.get(texture)
    if (!id) return role === 'color' && roomTextures.has(texture) && listTextureSlots(texture).includes('emissiveTexture') ? ROOM_EMISSIVE_EDGE[tier] : ROOM_EDGE[tier]
    const tv = entryFor.get(id)
    return Math.round((role === 'color' ? tv.base : tv.data) * TIER_SCALE[tier])
  })

  await document.transform(dedup(), prune(), unpartition())
  const bytes = await writeGlb(document)
  await mkdir(outDir, { recursive: true })
  await writeFile(resolve(outDir, TIER_FILE[tier]), bytes)
  void roomMaterials
  return { tier, file: TIER_FILE[tier], bytes: bytes.byteLength, gpuMiB: +(gpu / 1048576).toFixed(1), tvs: report }
}

const results = []
for (const tier of ['high', 'medium', 'low']) results.push(await build(tier))
for (const r of results) console.log(`${r.tier.padEnd(6)} ${r.file}  ${(r.bytes / 1048576).toFixed(2)} MiB on disk, ~${r.gpuMiB} MiB decoded textures`)
console.log(JSON.stringify(results[0].tvs, null, 1))
