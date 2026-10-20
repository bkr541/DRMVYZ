// Quality-tier optimization for imported models. Never touches the source file: every tier is built from a clone of the source document, written
// only to the output folder, and checked against the original (`compare.mjs`) before it is accepted.
//
// What it does, per tier: removes duplicate accessors and textures, prunes only unreferenced accessors and textures (never nodes, meshes, materials
// or vertex attributes, so named parts and custom attributes survive), optionally simplifies geometry (opt-in, welded, border-locked), caps texture
// size, then compresses geometry with Meshopt (lossless here: no quantization) or Draco.
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PropertyType } from '@gltf-transform/core'
import { EXTMeshoptCompression, EXTTextureWebP, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { cloneDocument, dedup, draco, prune, simplify, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { compareDocuments } from './compare.mjs'
import { inspectDocument } from './inspect.mjs'
import { createIo, writeGlb } from './io.mjs'

export const TIERS = Object.freeze(['high', 'medium', 'low'])
/** Longest texture edge each tier allows, and the triangle ratio `--simplify` aims for. */
export const TIER_DEFAULTS = Object.freeze({
  high: Object.freeze({ maxTexture: 2048, simplifyRatio: 1 }),
  medium: Object.freeze({ maxTexture: 1024, simplifyRatio: 0.65 }),
  low: Object.freeze({ maxTexture: 512, simplifyRatio: 0.4 }),
})

/** Texture slots that hold color; only these are ever re-encoded lossy. Data textures (normal, roughness, ...) are resized but keep their format. */
const COLOR_SLOTS = new Set(['baseColorTexture', 'emissiveTexture'])

export function toktxAvailable() {
  const result = spawnSync('toktx', ['--version'], { stdio: 'ignore' })
  return !result.error
}

async function resizeTextures(document, maxEdge, options) {
  const { listTextureSlots } = await import('@gltf-transform/functions')
  let changed = 0
  for (const texture of document.getRoot().listTextures()) {
    const size = texture.getSize()
    const image = texture.getImage()
    if (!size || !image || texture.getMimeType() === 'image/ktx2') continue
    const slots = listTextureSlots(texture)
    const isColor = slots.length > 0 && slots.every(slot => COLOR_SLOTS.has(slot))
    const convertToWebp = options.textures === 'webp' && isColor && texture.getMimeType() !== 'image/webp'
    const tooBig = Math.max(size[0], size[1]) > maxEdge
    if (!tooBig && !convertToWebp) continue
    let pipeline = sharp(Buffer.from(image))
    if (tooBig) pipeline = pipeline.resize({ width: size[0] >= size[1] ? maxEdge : undefined, height: size[1] > size[0] ? maxEdge : undefined, fit: 'inside', kernel: 'lanczos3' })
    if (convertToWebp) pipeline = pipeline.webp({ quality: 90, alphaQuality: 100 })
    else if (texture.getMimeType() === 'image/png') pipeline = pipeline.png({ compressionLevel: 9 })
    else if (texture.getMimeType() === 'image/jpeg') pipeline = pipeline.jpeg({ quality: 92 })
    else if (texture.getMimeType() === 'image/webp') pipeline = pipeline.webp({ lossless: !isColor, quality: 92 })
    const buffer = await pipeline.toBuffer()
    texture.setImage(new Uint8Array(buffer))
    if (convertToWebp) {
      texture.setMimeType('image/webp')
      document.createExtension(EXTTextureWebP).setRequired(true)
    }
    changed += 1
  }
  return changed
}

function dropCompressionExtensions(document) {
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (extension instanceof KHRDracoMeshCompression || extension instanceof EXTMeshoptCompression) extension.dispose()
  }
}

/**
 * @param source       result of `readAsset`
 * @param options      { tiers, geometry: 'meshopt'|'draco'|'none', textures: 'keep'|'webp'|'ktx2', simplify: false | { medium?, low? ratios }, maxTexture?: { tier: edge } }
 * @returns one result per tier: { tier, ok, bytes, failures, warnings, inspection, notes }
 */
export async function optimizeAsset(source, options = {}) {
  const tiers = options.tiers ?? TIERS
  const geometry = options.geometry ?? 'meshopt'
  const textures = options.textures ?? 'keep'
  if (!['meshopt', 'draco', 'none'].includes(geometry)) throw new Error(`geometry must be meshopt, draco or none (got "${geometry}")`)
  if (!['keep', 'webp', 'ktx2'].includes(textures)) throw new Error(`textures must be keep, webp or ktx2 (got "${textures}")`)
  if (textures === 'ktx2' && !toktxAvailable()) {
    throw new Error('--textures ktx2 needs KTX-Software\'s `toktx` on the PATH (https://github.com/KhronosGroup/KTX-Software/releases). Install it, or use --textures keep|webp.')
  }
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready])
  const io = await createIo()
  const original = source.document
  const results = []

  for (const tier of tiers) {
    if (!TIERS.includes(tier)) throw new Error(`unknown tier "${tier}"`)
    const defaults = TIER_DEFAULTS[tier]
    const ratio = options.simplify ? (options.simplify[tier] ?? (tier === 'high' ? 1 : defaults.simplifyRatio)) : 1
    const maxTexture = options.maxTexture?.[tier] ?? defaults.maxTexture
    const notes = []
    const document = cloneDocument(original)
    dropCompressionExtensions(document)

    await document.transform(
      dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }),
      prune({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE], keepAttributes: true, keepLeaves: true, keepExtras: true, keepIndices: true }),
    )
    if (ratio < 1) {
      await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001, lockBorder: true }))
      notes.push(`simplified toward ${Math.round(ratio * 100)}% of the triangles`)
    }
    const resized = await resizeTextures(document, maxTexture, { textures })
    if (resized > 0) notes.push(`${resized} texture(s) resized to at most ${maxTexture}px${textures === 'webp' ? ' / re-encoded as WebP' : ''}`)

    // The `meshopt()` helper also quantizes positions and rewrites node transforms, which would change custom vertex attributes and the model's
    // transforms. The extension is used directly instead: the data is compressed losslessly and nothing else in the file changes.
    if (geometry === 'meshopt') document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
    else if (geometry === 'draco') {
      // Generic attributes (the project's _GLOW_PHASE / _SEGMENT) get 16-bit quantization so they stay accurate to ~1.5e-5 of their range.
      await document.transform(draco({ quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14, quantizeColor: 10, quantizeGeneric: 16 }))
      notes.push('Draco is lossy: positions are quantized to 16 bits')
    }

    let bytes = await writeGlb(document)
    if (textures === 'ktx2') bytes = await ktx2Pass(bytes, notes)

    // Round trip: read the bytes that will actually ship and compare them with the original.
    const reread = await io.readBinary(bytes)
    const comparison = compareDocuments(original, reread, { simplified: ratio < 1, lossyGeometry: geometry === 'draco', tolerance: 2e-4 })
    const inspection = inspectDocument(reread, { name: source.name, container: 'glb', fileBytes: bytes.byteLength, budgets: options.budgets })
    results.push({ tier, ok: comparison.ok && inspection.ok, bytes, failures: [...comparison.failures, ...inspection.issues.filter(entry => entry.severity === 'error').map(entry => entry.message)], warnings: comparison.warnings, inspection, notes, ratio })
  }
  return results
}

/** Re-encodes textures to KTX2 with glTF Transform's CLI (which drives `toktx`): UASTC for data slots, ETC1S for color. */
async function ktx2Pass(bytes, notes) {
  const folder = await mkdtemp(join(tmpdir(), 'cinema2-ktx2-'))
  try {
    const input = join(folder, 'in.glb')
    const step1 = join(folder, 'step1.glb')
    const output = join(folder, 'out.glb')
    await writeFile(input, bytes)
    const cli = join(process.cwd(), 'node_modules/.bin/gltf-transform')
    const color = spawnSync(cli, ['etc1s', input, step1, '--slots', '{baseColorTexture,emissiveTexture}'], { encoding: 'utf8' })
    if (color.status !== 0) throw new Error(`gltf-transform etc1s failed: ${color.stderr || color.stdout}`)
    const data = spawnSync(cli, ['uastc', step1, output, '--slots', '{normalTexture,occlusionTexture,metallicRoughnessTexture}', '--level', '2', '--zstd', '18'], { encoding: 'utf8' })
    if (data.status !== 0) throw new Error(`gltf-transform uastc failed: ${data.stderr || data.stdout}`)
    notes.push('textures re-encoded as KTX2 (ETC1S color, UASTC data)')
    return new Uint8Array(await readFile(output))
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}
