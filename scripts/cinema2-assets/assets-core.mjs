// Build-time Cinema 2.0 asset pipeline core (roadmap #7b). Pure functions: the CLI (`cli.mjs`) does the file IO.
// Shipped assets are described by `assets/cinema2/<id>/asset.json`; this module validates them against the license allowlist and the
// size / GPU budgets, and generates the TypeScript manifest and the attribution list the app ships with.
import { createHash } from 'node:crypto'

/** Licenses a shipped asset may carry. `attribution: true` means the record must also carry attribution text. */
export const LICENSE_ALLOWLIST = Object.freeze({
  CC0: Object.freeze({ attribution: false }),
  'CC-BY-4.0': Object.freeze({ attribution: true }),
  'CC-BY-3.0': Object.freeze({ attribution: true }),
  MIT: Object.freeze({ attribution: true }),
  'Apache-2.0': Object.freeze({ attribution: true }),
  'generated-in-house': Object.freeze({ attribution: false }),
})

export const ASSET_KINDS = Object.freeze(['model', 'texture'])
export const TEXTURE_LAYOUTS = Object.freeze(['surface-normal-crack-roughness', 'color', 'noise-volume-rgba'])
export const MODEL_COMPRESSIONS = Object.freeze(['none', 'meshopt'])
export const QUALITY_TIERS = Object.freeze(['low', 'medium', 'high'])

/** Owner-adjustable defaults; `assets/cinema2/budgets.json` overrides any of them. */
export const DEFAULT_BUDGETS = Object.freeze({
  /** Upper bound for every shipped Cinema 2.0 asset file together (the roadmap's proposed first-wave budget). */
  installerBytes: 50 * 1024 * 1024,
  maxFileBytes: 8 * 1024 * 1024,
  maxTextureDimension: 2048,
  /** Edge length limit for volume textures (`noise-volume-rgba`); a 128^3 RGBA volume is already ~11 MB of GPU memory. */
  maxVolumeDimension: 128,
  maxTrianglesPerAsset: 150000,
  /** GPU bytes shipped assets may take per quality tier: 20% of the engine's 96 / 160 / 256 MB tier budgets. */
  assetGpuBytes: Object.freeze({ low: 20132659, medium: 33554432, high: 53687091 }),
})

const MIP_CHAIN_FACTOR = 4 / 3
const GLB_MAGIC = 0x46546c67
const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const COMPONENT_COUNTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }

// ---------------------------------------------------------------- image / GLB inspection

/** Pixel size of a PNG, JPEG, WebP or KTX2 file, read from its header. Returns null for anything else. */
export function readImageSize(bytes) {
  const b = Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length)
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { format: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < b.length) {
      if (b[offset] !== 0xff) { offset += 1; continue }
      const marker = b[offset + 1]
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { format: 'jpeg', height: b.readUInt16BE(offset + 5), width: b.readUInt16BE(offset + 7) }
      offset += 2 + b.readUInt16BE(offset + 2)
    }
    return null
  }
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const fourcc = b.toString('ascii', 12, 16)
    if (fourcc === 'VP8X') return { format: 'webp', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) }
    if (fourcc === 'VP8L' && b[20] === 0x2f) {
      const bits = b.readUInt32LE(21)
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    if (fourcc === 'VP8 ') return { format: 'webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
    return null
  }
  if (b.length >= 28 && b.toString('latin1', 1, 7) === 'KTX 20') return { format: 'ktx2', width: b.readUInt32LE(20), height: b.readUInt32LE(24) }
  return null
}

/** GPU bytes of one uploaded texture including its mip chain. KTX2 is assumed to be a block-compressed ~1 byte per pixel format. */
export function estimateTextureGpuBytes(width, height, format = 'rgba8') {
  const bytesPerPixel = format === 'ktx2' ? 1 : 4
  return Math.round(width * height * bytesPerPixel * MIP_CHAIN_FACTOR)
}

/**
 * Reads a binary glTF: triangle count, the decoded vertex/index bytes the GPU will hold, and embedded texture sizes.
 * Meshopt/Draco keep their accessor counts and types in the JSON, so the numbers are the decoded ones.
 */
export function inspectGlb(bytes) {
  const b = Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length)
  if (b.length < 20 || b.readUInt32LE(0) !== GLB_MAGIC) throw new Error('not a binary glTF (missing "glTF" magic)')
  let json = null
  let bin = null
  for (let offset = 12; offset + 8 <= b.length;) {
    const length = b.readUInt32LE(offset)
    const type = b.readUInt32LE(offset + 4)
    const data = b.subarray(offset + 8, offset + 8 + length)
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'))
    else if (type === 0x004e4942 && !bin) bin = data
    offset += 8 + length + ((4 - (length % 4)) % 4)
  }
  if (!json) throw new Error('glTF has no JSON chunk')
  const accessors = json.accessors ?? []
  const used = new Set()
  let triangles = 0
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const mode = primitive.mode ?? 4
      const positionAccessor = accessors[primitive.attributes?.POSITION]
      const indexAccessor = primitive.indices == null ? null : accessors[primitive.indices]
      const count = (indexAccessor ?? positionAccessor)?.count ?? 0
      triangles += mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0
      for (const index of Object.values(primitive.attributes ?? {})) used.add(index)
      if (primitive.indices != null) used.add(primitive.indices)
    }
  }
  let geometryBytes = 0
  for (const index of used) {
    const accessor = accessors[index]
    if (accessor) geometryBytes += accessor.count * COMPONENT_COUNTS[accessor.type] * COMPONENT_BYTES[accessor.componentType]
  }
  const textures = []
  for (const [index, image] of (json.images ?? []).entries()) {
    if (image.bufferView == null) throw new Error(`image ${index} is not embedded in the GLB (external image URIs are not shipped)`)
    const view = json.bufferViews[image.bufferView]
    if (!bin) throw new Error('glTF references embedded images but has no BIN chunk')
    const size = readImageSize(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength))
    if (!size) throw new Error(`image ${index} has an unrecognised format`)
    textures.push(size)
  }
  return { triangles, geometryBytes, textures, extensionsRequired: json.extensionsRequired ?? [] }
}

// ---------------------------------------------------------------- record analysis and validation

/**
 * Validates every `asset.json` record against the allowlist and budgets and measures its shipped files.
 * `readFileBytes(path)` returns a Buffer or throws when the file is missing; `records` are `{ directory, record }`.
 * Returns `{ assets, issues, totalBytes }`; `issues` is empty when the assets may ship.
 */
export function analyzeAssets(records, readFileBytes, budgetOverrides = {}) {
  const budgets = { ...DEFAULT_BUDGETS, ...budgetOverrides, assetGpuBytes: { ...DEFAULT_BUDGETS.assetGpuBytes, ...(budgetOverrides.assetGpuBytes ?? {}) } }
  const issues = []
  const assets = []
  const seenIds = new Set()
  const fail = (id, code, message) => issues.push({ id, code, message })
  const seenFiles = new Map()
  let totalBytes = 0

  for (const { directory, record } of records) {
    const id = typeof record?.id === 'string' ? record.id : `(${directory})`
    if (typeof record?.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(record.id)) { fail(id, 'ASSET_ID_INVALID', 'id must be lowercase letters, digits and dashes.'); continue }
    if (seenIds.has(id)) { fail(id, 'ASSET_ID_DUPLICATE', `id "${id}" is used by more than one asset.json.`); continue }
    seenIds.add(id)
    if (directory && directory !== id) fail(id, 'ASSET_DIRECTORY_MISMATCH', `asset.json lives in "${directory}" but declares id "${id}".`)

    const license = record.license
    const licenseRule = typeof license === 'string' ? LICENSE_ALLOWLIST[license] : undefined
    if (!license) fail(id, 'ASSET_LICENSE_MISSING', 'asset.json needs a license record.')
    else if (!licenseRule) fail(id, 'ASSET_LICENSE_NOT_ALLOWED', `license "${license}" is not on the allowlist (${Object.keys(LICENSE_ALLOWLIST).join(', ')}).`)
    else if (licenseRule.attribution && !(typeof record.attribution === 'string' && record.attribution.trim())) {
      fail(id, 'ASSET_ATTRIBUTION_MISSING', `license "${license}" requires attribution text (author, title, source).`)
    }
    if (!(typeof record.origin === 'string' && record.origin.trim())) fail(id, 'ASSET_ORIGIN_MISSING', 'asset.json needs an origin (source URL, or the generator script for in-house assets).')
    if (!ASSET_KINDS.includes(record.kind)) { fail(id, 'ASSET_KIND_INVALID', `kind must be one of ${ASSET_KINDS.join(', ')}.`); continue }
    if (record.kind === 'texture' && !TEXTURE_LAYOUTS.includes(record.layout)) fail(id, 'ASSET_LAYOUT_INVALID', `texture layout must be one of ${TEXTURE_LAYOUTS.join(', ')}.`)
    if (record.kind === 'model' && !MODEL_COMPRESSIONS.includes(record.compression)) fail(id, 'ASSET_COMPRESSION_INVALID', `model compression must be one of ${MODEL_COMPRESSIONS.join(', ')}.`)
    if (!record.files || typeof record.files !== 'object' || typeof record.files.high !== 'string') { fail(id, 'ASSET_FILES_INVALID', 'files must map at least "high" to a path.'); continue }

    const files = {}
    const gpu = {}
    for (const [tier, path] of Object.entries(record.files)) {
      if (!QUALITY_TIERS.includes(tier)) { fail(id, 'ASSET_TIER_INVALID', `files tier "${tier}" is not one of ${QUALITY_TIERS.join(', ')}.`); continue }
      if (!/^public\/cinema2\/[A-Za-z0-9._/-]+$/.test(path) || path.includes('..')) { fail(id, 'ASSET_PATH_INVALID', `"${path}" must be a path under public/cinema2/.`); continue }
      let bytes
      try { bytes = readFileBytes(path) } catch { fail(id, 'ASSET_FILE_MISSING', `file "${path}" does not exist.`); continue }
      const previous = seenFiles.get(path)
      if (previous && previous !== id) fail(id, 'ASSET_FILE_SHARED', `file "${path}" is already used by "${previous}".`)
      seenFiles.set(path, id)
      if (bytes.length > budgets.maxFileBytes) fail(id, 'ASSET_FILE_TOO_LARGE', `"${path}" is ${formatMegabytes(bytes.length)}, above the ${formatMegabytes(budgets.maxFileBytes)} per-file budget.`)
      const entry = { path, url: `/${path.slice('public/'.length)}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex').slice(0, 16) }
      try {
        if (record.kind === 'texture') {
          const size = readImageSize(bytes)
          if (!size) throw new Error('unrecognised image format (PNG, JPEG, WebP or KTX2 expected)')
          if (record.layout === 'noise-volume-rgba') {
            // A volume is stored as one tall image: `depth` square slices of `width` x `width`, stacked top to bottom.
            if (size.height % size.width !== 0) throw new Error(`a volume image must be ${size.width} wide and a whole multiple of that tall (got ${size.width}x${size.height})`)
            const depth = size.height / size.width
            if (Math.max(size.width, depth) > budgets.maxVolumeDimension) fail(id, 'ASSET_TEXTURE_TOO_LARGE', `"${path}" is a ${size.width}x${size.width}x${depth} volume, above the ${budgets.maxVolumeDimension} texel edge limit.`)
            Object.assign(entry, { width: size.width, height: size.width, depth, format: size.format })
            gpu[tier] = Math.round(size.width * size.width * depth * 4 * MIP_CHAIN_FACTOR)
          } else {
            if (Math.max(size.width, size.height) > budgets.maxTextureDimension) fail(id, 'ASSET_TEXTURE_TOO_LARGE', `"${path}" is ${size.width}x${size.height}, above the ${budgets.maxTextureDimension}px limit.`)
            Object.assign(entry, { width: size.width, height: size.height, format: size.format })
            gpu[tier] = estimateTextureGpuBytes(size.width, size.height, size.format)
          }
        } else {
          const glb = inspectGlb(bytes)
          if (glb.triangles > budgets.maxTrianglesPerAsset) fail(id, 'ASSET_TRIANGLES_OVER_BUDGET', `"${path}" has ${glb.triangles} triangles, above the ${budgets.maxTrianglesPerAsset} limit.`)
          for (const size of glb.textures) if (Math.max(size.width, size.height) > budgets.maxTextureDimension) fail(id, 'ASSET_TEXTURE_TOO_LARGE', `an embedded texture in "${path}" is ${size.width}x${size.height}, above the ${budgets.maxTextureDimension}px limit.`)
          Object.assign(entry, { triangles: glb.triangles })
          gpu[tier] = glb.geometryBytes + glb.textures.reduce((sum, size) => sum + estimateTextureGpuBytes(size.width, size.height, size.format), 0)
        }
      } catch (error) {
        fail(id, 'ASSET_FILE_INVALID', `"${path}": ${error.message}`)
        continue
      }
      files[tier] = entry
      totalBytes += bytes.length
    }
    if (!files.high) continue
    // A tier without its own file uses the next better one, exactly like the runtime registry does.
    const tierGpu = {
      high: gpu.high ?? 0,
      medium: gpu.medium ?? gpu.high ?? 0,
      low: gpu.low ?? gpu.medium ?? gpu.high ?? 0,
    }
    for (const tier of QUALITY_TIERS) {
      if (tierGpu[tier] > budgets.assetGpuBytes[tier]) fail(id, 'ASSET_GPU_OVER_BUDGET', `needs ${formatMegabytes(tierGpu[tier])} of GPU memory on ${tier}, above the ${formatMegabytes(budgets.assetGpuBytes[tier])} asset budget for that tier.`)
    }
    assets.push({
      id,
      kind: record.kind,
      ...(record.kind === 'texture' ? { layout: record.layout } : { compression: record.compression }),
      license,
      attribution: typeof record.attribution === 'string' && record.attribution.trim() ? record.attribution.trim() : null,
      origin: record.origin,
      files,
      gpuBytes: tierGpu,
    })
  }
  if (totalBytes > budgets.installerBytes) fail('*', 'ASSETS_INSTALLER_OVER_BUDGET', `shipped Cinema 2.0 assets total ${formatMegabytes(totalBytes)}, above the ${formatMegabytes(budgets.installerBytes)} installer budget.`)
  assets.sort((left, right) => (left.id < right.id ? -1 : 1))
  return { assets, issues, totalBytes, budgets }
}

// ---------------------------------------------------------------- generated outputs

export const GENERATED_MANIFEST_HEADER = '// GENERATED by `npm run assets:build` from assets/cinema2/*/asset.json. Do not edit by hand.'

export function generateManifestSource(assets) {
  const records = assets.map(asset => {
    const files = Object.fromEntries(Object.entries(asset.files).map(([tier, file]) => [tier, {
      url: file.url,
      bytes: file.bytes,
      ...(file.width ? { width: file.width, height: file.height } : {}),
      ...(file.depth ? { depth: file.depth } : {}),
      ...(file.triangles != null ? { triangles: file.triangles } : {}),
    }]))
    return {
      id: asset.id,
      kind: asset.kind,
      ...(asset.layout ? { layout: asset.layout } : {}),
      ...(asset.compression ? { compression: asset.compression } : {}),
      license: asset.license,
      attribution: asset.attribution,
      files,
      gpuBytes: asset.gpuBytes,
    }
  })
  return `${GENERATED_MANIFEST_HEADER}
import type { Cinema2GeneratedAssetRecord } from './Cinema2GeneratedAssetTypes'

export const CINEMA2_ASSET_RECORDS = ${JSON.stringify(records, null, 2)} as const satisfies readonly Cinema2GeneratedAssetRecord[]

export type Cinema2AssetId = (typeof CINEMA2_ASSET_RECORDS)[number]['id']
`
}

/** The list the app ships so attribution obligations are met: every asset, its license and its attribution text. */
export function generateAttributions(assets) {
  return `${JSON.stringify({
    generatedBy: 'npm run assets:build',
    assets: assets.map(asset => ({ id: asset.id, kind: asset.kind, license: asset.license, attribution: asset.attribution, origin: asset.origin })),
  }, null, 2)}\n`
}

function formatMegabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
