import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { Document, Extension } from '@gltf-transform/core'
import { analyzeAssets } from '../assets-core.mjs'
import { compareDocuments } from './compare.mjs'
import { inspectDocument } from './inspect.mjs'
import { createIo, readAsset } from './io.mjs'
import { optimizeAsset } from './optimize.mjs'
import { validateBytes } from './validate.mjs'

const root = resolve(fileURLToPath(import.meta.url), '../../../..')
const cli = join(root, 'scripts/cinema2-assets/asset-tools/cli.mjs')

/** Two named meshes, a custom vertex attribute, a nested transform, an animation clip and a skinless hierarchy: everything an optimizer must keep. */
function fixtureDocument({ withNormals = true, flat = false } = {}) {
  const document = new Document()
  const buffer = document.createBuffer()
  const grid = 24
  const positions = [], normals = [], phases = [], indices = []
  for (let y = 0; y <= grid; y += 1) {
    for (let x = 0; x <= grid; x += 1) {
      positions.push(x / grid - 0.5, y / grid - 0.5, flat ? 0 : Math.sin(x * 0.4) * Math.cos(y * 0.4) * 0.1)
      normals.push(0, 0, 1)
      phases.push((x + y) / (2 * grid))
    }
  }
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const a = y * (grid + 1) + x, b = a + 1, c = a + grid + 1, d = c + 1
      indices.push(a, b, c, b, d, c)
    }
  }
  const accessor = (type, array) => document.createAccessor().setType(type).setArray(array).setBuffer(buffer)
  const makePrimitive = materialName => {
    const primitive = document.createPrimitive()
      .setAttribute('POSITION', accessor('VEC3', new Float32Array(positions)))
      .setAttribute('_GLOW_PHASE', accessor('SCALAR', new Float32Array(phases)))
      .setIndices(accessor('SCALAR', new Uint16Array(indices)))
      .setMaterial(document.createMaterial(materialName).setBaseColorFactor([0.2, 0.4, 0.8, 1]).setEmissiveFactor([0.1, 0.0, 0.0]).setRoughnessFactor(0.35))
    if (withNormals) primitive.setAttribute('NORMAL', accessor('VEC3', new Float32Array(normals)))
    return primitive
  }
  const meshA = document.createMesh('panelMesh').addPrimitive(makePrimitive('panelMaterial'))
  const meshB = document.createMesh('plateMesh').addPrimitive(makePrimitive('plateMaterial'))
  const rig = document.createNode('rig').setTranslation([1, 2, 3]).setScale([2, 2, 2]).setExtras({ role: 'root' })
  const panel = document.createNode('panel').setMesh(meshA).setTranslation([0.5, 0, 0])
  const plate = document.createNode('plate').setMesh(meshB).setRotation([0, 0.3826834, 0, 0.9238795])
  rig.addChild(panel).addChild(plate)
  document.createScene('scene').addChild(rig)
  const times = accessor('SCALAR', new Float32Array([0, 1, 2]))
  const values = accessor('VEC3', new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 0]))
  const sampler = document.createAnimationSampler().setInput(times).setOutput(values).setInterpolation('LINEAR')
  document.createAnimation('bob').addSampler(sampler).addChannel(document.createAnimationChannel().setTargetNode(panel).setTargetPath('translation').setSampler(sampler))
  return document
}

async function writeFixture(folder, options) {
  const io = await createIo()
  const path = join(folder, 'fixture.glb')
  writeFileSync(path, await io.writeBinary(fixtureDocument(options)))
  return path
}

const scratch = () => mkdtempSync(join(tmpdir(), 'cinema2-asset-tools-'))
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex')

test('inspect reports counts, custom attributes, animation and memory', async () => {
  const folder = scratch()
  try {
    const source = await readAsset(await writeFixture(folder))
    const report = inspectDocument(source.document, { name: 'fixture' })
    assert.equal(report.counts.meshes, 2)
    assert.equal(report.counts.animations, 1)
    assert.equal(report.geometry.triangles, 2 * 24 * 24 * 2)
    assert.deepEqual(report.geometry.customAttributes, ['_GLOW_PHASE'])
    assert.equal(report.animations[0].name, 'bob')
    assert.ok(report.memory.geometryBytes > 0)
    assert.ok(report.ok)
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('inspect flags missing normals and an unsupported required extension', async () => {
  const folder = scratch()
  try {
    const source = await readAsset(await writeFixture(folder, { withNormals: false }))
    class Made extends Extension { extensionName = 'KHR_made_up_required'; static EXTENSION_NAME = 'KHR_made_up_required' }
    source.document.createExtension(Made).setRequired(true)
    const report = inspectDocument(source.document, {})
    assert.ok(report.issues.some(issue => issue.code === 'MISSING_NORMALS'))
    const unsupported = report.issues.find(issue => issue.code === 'UNSUPPORTED_REQUIRED_EXTENSION')
    assert.equal(unsupported?.severity, 'error')
    assert.equal(report.ok, false)
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('inspect merges project budget overrides instead of requiring global default changes', () => {
  const document = fixtureDocument()
  const relaxed = inspectDocument(document, { budgets: { maxTrianglesPerAsset: 3000 } })
  const restricted = inspectDocument(document, { budgets: { maxTrianglesPerAsset: 2000 } })
  assert.ok(relaxed.ok)
  assert.ok(restricted.issues.some(issue => issue.code === 'OVER_TRIANGLE_BUDGET'))
})

test('the Khronos validator accepts the fixture', async () => {
  const folder = scratch()
  try {
    const path = await writeFixture(folder)
    const result = await validateBytes(new Uint8Array(readFileSync(path)), 'fixture.glb')
    assert.equal(result.numErrors, 0, JSON.stringify(result.issues.filter(issue => issue.severity === 'error')))
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('lossless Meshopt optimize keeps names, transforms, custom attributes, clips and values exactly', async () => {
  const folder = scratch()
  try {
    const source = await readAsset(await writeFixture(folder))
    const [high] = await optimizeAsset(source, { tiers: ['high'], geometry: 'meshopt' })
    assert.deepEqual(high.failures, [])
    assert.ok(high.ok)
    assert.ok(high.inspection.extensions.used.includes('EXT_meshopt_compression'))
    assert.ok(!high.inspection.extensions.used.includes('KHR_mesh_quantization'), 'no quantization: transforms and custom attributes are untouched')
    const reread = await (await createIo()).readBinary(high.bytes)
    assert.deepEqual(compareDocuments(source.document, reread, {}).failures, [])
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('Draco optimize passes within its quantization tolerance and keeps the custom attribute', async () => {
  const folder = scratch()
  try {
    const source = await readAsset(await writeFixture(folder))
    const [high] = await optimizeAsset(source, { tiers: ['high'], geometry: 'draco' })
    assert.deepEqual(high.failures, [])
    assert.equal(high.inspection.geometry.compression, 'draco')
    assert.deepEqual(high.inspection.geometry.customAttributes, ['_GLOW_PHASE'])
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('simplified tiers keep every named part and have fewer triangles', async () => {
  const folder = scratch()
  try {
    const source = await readAsset(await writeFixture(folder, { flat: true }))
    const results = await optimizeAsset(source, { tiers: ['high', 'low'], geometry: 'meshopt', simplify: { low: 0.4 } })
    const [high, low] = results
    assert.ok(high.ok && low.ok, JSON.stringify(results.map(result => result.failures)))
    assert.ok(low.inspection.geometry.triangles < high.inspection.geometry.triangles)
    assert.deepEqual(low.inspection.meshes.map(mesh => mesh.name).sort(), ['panelMesh', 'plateMesh'])
    assert.deepEqual(low.inspection.geometry.customAttributes, ['_GLOW_PHASE'])
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('the safeguards catch a renamed node, a dropped custom attribute, a moved node and a discarded clip', async () => {
  const folder = scratch()
  try {
    const original = (await readAsset(await writeFixture(folder))).document

    const renamed = fixtureDocument()
    renamed.getRoot().listNodes().find(node => node.getName() === 'panel').setName('panel2')
    assert.ok(compareDocuments(original, renamed, {}).failures.some(message => message.includes('"/rig/panel" is missing')))

    const noAttribute = fixtureDocument()
    for (const mesh of noAttribute.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) primitive.setAttribute('_GLOW_PHASE', null)
    assert.ok(compareDocuments(original, noAttribute, {}).failures.some(message => message.includes('lost vertex attributes: _GLOW_PHASE')))

    const moved = fixtureDocument()
    moved.getRoot().listNodes().find(node => node.getName() === 'rig').setScale([3, 3, 3])
    assert.ok(compareDocuments(original, moved, {}).failures.some(message => message.includes('rescaled')))

    const noClip = fixtureDocument()
    noClip.getRoot().listAnimations()[0].dispose()
    assert.ok(compareDocuments(original, noClip, {}).failures.some(message => message.includes('animation clip "bob" was discarded')))
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('the CLI optimizes into a scratch folder, never touches the source, and its output passes the asset registry checks', async () => {
  const folder = scratch()
  try {
    const source = await writeFixture(folder)
    const before = sha(source)
    const out = join(folder, 'out')
    const run = spawnSync(process.execPath, [cli, 'optimize', source, '--out', out, '--id', 'fixture-model', '--tiers', 'high,low', '--simplify'], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stdout + run.stderr)
    assert.equal(sha(source), before, 'the source file is byte-identical')
    for (const file of ['fixture-model.glb', 'fixture-model-low.glb', 'report.md', 'report.json', 'asset.draft.json']) assert.ok(existsSync(join(out, file)), file)
    assert.match(readFileSync(join(out, 'report.md'), 'utf8'), /kept everything/)

    // The draft record is deliberately incomplete (license, origin): the registry check refuses it until a person fills those in.
    const draft = JSON.parse(readFileSync(join(out, 'asset.draft.json'), 'utf8'))
    const files = { 'public/cinema2/models/fixture-model.glb': readFileSync(join(out, 'fixture-model.glb')), 'public/cinema2/models/fixture-model-low.glb': readFileSync(join(out, 'fixture-model-low.glb')) }
    const read = path => { if (!(path in files)) throw new Error('ENOENT'); return files[path] }
    const incomplete = analyzeAssets([{ directory: 'fixture-model', record: draft }], read)
    assert.ok(incomplete.issues.some(issue => issue.code === 'ASSET_LICENSE_NOT_ALLOWED'))
    const completed = analyzeAssets([{ directory: 'fixture-model', record: { ...draft, license: 'CC0', origin: 'test fixture' } }], read)
    assert.deepEqual(completed.issues, [])
    assert.equal(completed.assets[0].compression, 'meshopt')
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('the CLI refuses to write into public/ or assets/, to replace outputs without --force, and to run without --out', async () => {
  const folder = scratch()
  try {
    const source = await writeFixture(folder)
    const run = (...args) => spawnSync(process.execPath, [cli, 'optimize', source, ...args], { encoding: 'utf8' })
    assert.equal(run('--out', join(root, 'public/cinema2/models/should-not-exist')).status, 2)
    assert.equal(run('--out', join(root, 'assets/cinema2/should-not-exist')).status, 2)
    assert.equal(run().status, 2)
    const out = join(folder, 'out')
    assert.equal(run('--out', out, '--id', 'again', '--tiers', 'high').status, 0)
    const again = run('--out', out, '--id', 'again', '--tiers', 'high')
    assert.equal(again.status, 2)
    assert.match(again.stderr, /--force/)
    assert.equal(run('--out', out, '--id', 'again', '--tiers', 'high', '--force').status, 0)
    assert.ok(!existsSync(join(root, 'public/cinema2/models/should-not-exist')))
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('inspect and validate commands exit with a status that reflects the model', async () => {
  const folder = scratch()
  try {
    const source = await writeFixture(folder)
    assert.equal(spawnSync(process.execPath, [cli, 'inspect', source], { encoding: 'utf8' }).status, 0)
    assert.equal(spawnSync(process.execPath, [cli, 'validate', source], { encoding: 'utf8' }).status, 0)
    const broken = join(folder, 'broken.glb')
    writeFileSync(broken, Buffer.from('not a glb'))
    assert.notEqual(spawnSync(process.execPath, [cli, 'validate', broken], { encoding: 'utf8' }).status, 0)
  } finally { rmSync(folder, { recursive: true, force: true }) }
})
