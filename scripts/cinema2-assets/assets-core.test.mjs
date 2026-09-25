import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_BUDGETS, analyzeAssets, estimateTextureGpuBytes, generateAttributions, generateManifestSource, inspectGlb, readImageSize } from './assets-core.mjs'

// ---- fixtures: header-only images and a tiny GLB, built in memory

function png(width, height, padding = 0) {
  const b = Buffer.alloc(33 + padding)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'ascii')
  b.writeUInt32BE(width, 16)
  b.writeUInt32BE(height, 20)
  return b
}
function webpLossless(width, height) {
  const b = Buffer.alloc(30)
  b.write('RIFF', 0, 'ascii')
  b.write('WEBP', 8, 'ascii')
  b.write('VP8L', 12, 'ascii')
  b[20] = 0x2f
  b.writeUInt32LE((width - 1) | ((height - 1) << 14), 21)
  return b
}
function glb({ triangles = 12, images = [], extra = {} } = {}) {
  const vertexCount = triangles * 3
  const bin = Buffer.concat([Buffer.alloc(vertexCount * 12), ...images])
  let offset = vertexCount * 12
  const bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: vertexCount * 12 }]
  for (const image of images) { bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: image.length }); offset += image.length }
  const json = Buffer.from(JSON.stringify({
    asset: { version: '2.0' },
    accessors: [{ bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    bufferViews,
    buffers: [{ byteLength: bin.length }],
    images: images.map((_, index) => ({ bufferView: index + 1, mimeType: 'image/png' })),
    ...extra,
  }))
  const pad = (buffer, fill) => Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4, fill)])
  const jsonChunk = pad(json, 0x20)
  const binChunk = pad(bin, 0)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
  const chunkHeader = (length, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(length, 0); h.writeUInt32LE(type, 4); return h }
  return Buffer.concat([header, chunkHeader(jsonChunk.length, 0x4e4f534a), jsonChunk, chunkHeader(binChunk.length, 0x004e4942), binChunk])
}

const files = {
  'public/cinema2/textures/ok-1024.webp': webpLossless(1024, 1024),
  'public/cinema2/textures/ok-512.webp': webpLossless(512, 512),
  'public/cinema2/textures/huge.png': png(4096, 4096),
  'public/cinema2/textures/not-an-image.webp': Buffer.from('<html></html>'),
  'public/cinema2/models/ok.glb': glb({ triangles: 1000 }),
  'public/cinema2/models/dense.glb': glb({ triangles: 200000 }),
  'public/cinema2/models/textured.glb': glb({ triangles: 10, images: [png(2048, 2048), png(2048, 2048), png(2048, 2048), png(2048, 2048)] }),
  'public/cinema2/models/broken.glb': Buffer.from('not a glb at all, just text'),
}
const read = path => { if (!(path in files)) throw new Error('ENOENT'); return files[path] }

const texture = (overrides = {}) => ({ id: 'ok-texture', kind: 'texture', layout: 'surface-normal-crack-roughness', license: 'generated-in-house', origin: 'script', files: { high: 'public/cinema2/textures/ok-1024.webp', low: 'public/cinema2/textures/ok-512.webp' }, ...overrides })
const model = (overrides = {}) => ({ id: 'ok-model', kind: 'model', compression: 'meshopt', license: 'CC0', origin: 'https://example.com/model', files: { high: 'public/cinema2/models/ok.glb' }, ...overrides })
const analyze = (record, budgets) => analyzeAssets([{ directory: record.id, record }], read, budgets)
const codes = result => result.issues.map(issue => issue.code)

test('reads image sizes from PNG and lossless WebP headers, and rejects other bytes', () => {
  assert.deepEqual(readImageSize(png(640, 480)), { format: 'png', width: 640, height: 480 })
  assert.deepEqual(readImageSize(webpLossless(1024, 512)), { format: 'webp', width: 1024, height: 512 })
  assert.equal(readImageSize(Buffer.from('<html></html>')), null)
})

test('inspects a GLB: triangle count, decoded geometry bytes and embedded texture sizes', () => {
  const info = inspectGlb(glb({ triangles: 10, images: [png(256, 128)] }))
  assert.equal(info.triangles, 10)
  assert.equal(info.geometryBytes, 30 * 12)
  assert.deepEqual(info.textures.map(({ width, height }) => [width, height]), [[256, 128]])
  assert.throws(() => inspectGlb(Buffer.from('nope, definitely not a glb')), /magic/)
})

test('accepts valid assets and computes per-tier GPU cost with tier fallback', () => {
  const result = analyzeAssets([{ directory: 'ok-texture', record: texture() }, { directory: 'ok-model', record: model() }], read)
  assert.deepEqual(result.issues, [])
  const tex = result.assets.find(asset => asset.id === 'ok-texture')
  assert.equal(tex.gpuBytes.high, estimateTextureGpuBytes(1024, 1024))
  assert.equal(tex.gpuBytes.medium, tex.gpuBytes.high)
  assert.equal(tex.gpuBytes.low, estimateTextureGpuBytes(512, 512))
  assert.equal(result.assets.find(asset => asset.id === 'ok-model').files.high.triangles, 1000)
  assert.equal(result.totalBytes, files['public/cinema2/textures/ok-1024.webp'].length + files['public/cinema2/textures/ok-512.webp'].length + files['public/cinema2/models/ok.glb'].length)
})

test('fails on a missing or non-allowlisted license and on missing attribution or origin', () => {
  assert.deepEqual(codes(analyze(texture({ license: undefined }))), ['ASSET_LICENSE_MISSING'])
  assert.deepEqual(codes(analyze(texture({ license: 'All-Rights-Reserved' }))), ['ASSET_LICENSE_NOT_ALLOWED'])
  assert.deepEqual(codes(analyze(model({ license: 'CC-BY-4.0' }))), ['ASSET_ATTRIBUTION_MISSING'])
  assert.deepEqual(codes(analyze(model({ license: 'CC-BY-4.0', attribution: '  ' }))), ['ASSET_ATTRIBUTION_MISSING'])
  assert.deepEqual(analyze(model({ license: 'CC-BY-4.0', attribution: '"Rock" by Someone (CC BY 4.0), example.com/rock' })).issues, [])
  assert.deepEqual(codes(analyze(model({ origin: '' }))), ['ASSET_ORIGIN_MISSING'])
})

test('fails on bad ids, mismatched folders, duplicate ids and bad kinds or layouts', () => {
  assert.deepEqual(codes(analyze(model({ id: 'Bad Id' }))), ['ASSET_ID_INVALID'])
  assert.deepEqual(codes(analyzeAssets([{ directory: 'somewhere-else', record: model() }], read)), ['ASSET_DIRECTORY_MISMATCH'])
  assert.deepEqual(codes(analyzeAssets([{ directory: 'ok-model', record: model() }, { directory: 'ok-model', record: model() }], read)), ['ASSET_ID_DUPLICATE'])
  assert.deepEqual(codes(analyze(model({ kind: 'video' }))), ['ASSET_KIND_INVALID'])
  assert.deepEqual(codes(analyze(texture({ layout: 'mystery' }))), ['ASSET_LAYOUT_INVALID'])
  assert.deepEqual(codes(analyze(model({ compression: 'draco' }))), ['ASSET_COMPRESSION_INVALID'])
})

test('fails on missing, out-of-tree, shared, non-image and corrupt files', () => {
  assert.deepEqual(codes(analyze(texture({ files: { high: 'public/cinema2/textures/nope.webp' } }))), ['ASSET_FILE_MISSING'])
  assert.deepEqual(codes(analyze(texture({ files: { high: '../secrets.webp' } }))), ['ASSET_PATH_INVALID'])
  assert.deepEqual(codes(analyze(texture({ files: { high: 'public/other/ok.webp' } }))), ['ASSET_PATH_INVALID'])
  assert.deepEqual(codes(analyze(texture({ files: { low: 'public/cinema2/textures/ok-512.webp' } }))), ['ASSET_FILES_INVALID'])
  assert.deepEqual(codes(analyze(texture({ files: { high: 'public/cinema2/textures/ok-1024.webp', ultra: 'public/cinema2/textures/ok-512.webp' } }))), ['ASSET_TIER_INVALID'])
  assert.deepEqual(codes(analyze(texture({ files: { high: 'public/cinema2/textures/not-an-image.webp' } }))), ['ASSET_FILE_INVALID'])
  assert.deepEqual(codes(analyze(model({ files: { high: 'public/cinema2/models/broken.glb' } }))), ['ASSET_FILE_INVALID'])
  const shared = analyzeAssets([
    { directory: 'ok-texture', record: texture() },
    { directory: 'other', record: texture({ id: 'other' }) },
  ], read)
  assert.ok(codes(shared).includes('ASSET_FILE_SHARED'))
})

test('fails when a file, texture or model is over its size budget', () => {
  assert.deepEqual(codes(analyze(texture(), { maxFileBytes: 10 })).filter(code => code === 'ASSET_FILE_TOO_LARGE').length, 2)
  assert.ok(codes(analyze(texture({ files: { high: 'public/cinema2/textures/huge.png' } }))).includes('ASSET_TEXTURE_TOO_LARGE'))
  assert.ok(codes(analyze(model({ files: { high: 'public/cinema2/models/dense.glb' } }))).includes('ASSET_TRIANGLES_OVER_BUDGET'))
  const heavy = analyze(model({ files: { high: 'public/cinema2/models/textured.glb' } }))
  assert.ok(codes(heavy).includes('ASSET_GPU_OVER_BUDGET'), 'four embedded 2k textures (~90 MB) exceed every tier budget')
})

test('fails per tier when a single asset is over that tier GPU budget', () => {
  const result = analyze(texture(), { assetGpuBytes: { high: 1024 * 1024, medium: 1024 * 1024, low: 1024 * 1024 * 64 } })
  assert.deepEqual(result.issues.map(issue => issue.message.match(/on (\w+),/)?.[1]), ['medium', 'high'])
})

test('fails when all shipped assets exceed the installer budget', () => {
  const result = analyzeAssets([{ directory: 'ok-texture', record: texture() }, { directory: 'ok-model', record: model() }], read, { installerBytes: 1000 })
  assert.deepEqual(codes(result), ['ASSETS_INSTALLER_OVER_BUDGET'])
})

test('generates a deterministic manifest source and an attribution list', () => {
  const { assets } = analyzeAssets([{ directory: 'ok-model', record: model({ license: 'CC-BY-4.0', attribution: '"Rock" by Someone' }) }, { directory: 'ok-texture', record: texture() }], read)
  const source = generateManifestSource(assets)
  assert.equal(source, generateManifestSource(assets))
  assert.match(source, /GENERATED by `npm run assets:build`/)
  assert.match(source, /export type Cinema2AssetId = /)
  assert.ok(source.indexOf('"ok-model"') < source.indexOf('"ok-texture"'), 'sorted by id')
  const attributions = JSON.parse(generateAttributions(assets))
  assert.deepEqual(attributions.assets.map(asset => [asset.id, asset.attribution]), [['ok-model', '"Rock" by Someone'], ['ok-texture', null]])
  assert.ok(DEFAULT_BUDGETS.installerBytes === 50 * 1024 * 1024)
})
