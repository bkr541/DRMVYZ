import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { readAsset } from './asset-tools/io.mjs'
import { inspectDocument } from './asset-tools/inspect.mjs'
import { validateFile } from './asset-tools/validate.mjs'
import { resolveAssetBudgets } from './assets-core.mjs'

const root = resolve(import.meta.dirname, '../..')
const budgets = resolveAssetBudgets(JSON.parse(await readFile(resolve(root, 'assets/cinema2/budgets.json'), 'utf8')))
const sourceDir = resolve(root, 'scripts/cinema2-assets/sources/psylo')
const report = JSON.parse(await readFile(resolve(root, 'docs/PSYLO/PSYLO-asset-report.json'), 'utf8'))

test('archived sources match immutable hashes and preserve attribution', async () => {
  const contract = JSON.parse(await readFile(resolve(sourceDir, 'sources.json'), 'utf8'))
  assert.equal(contract.sources.length, 5)
  for (const source of contract.sources) {
    const bytes = await readFile(resolve(sourceDir, source.file))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256)
    assert.match(source.license, /CC-BY-4.0/)
    assert.ok(source.author && source.source)
  }
})
for (const tier of ['high', 'low']) test(`${tier}: clean glTF, project budgets and usable geometry semantics`, async () => {
  const file = resolve(root, `public/cinema2/models/psylo-static${tier === 'low' ? '-low' : ''}.glb`)
  const source = await readAsset(file)
  const validation = await validateFile(file)
  assert.equal(validation.numErrors, 0); assert.equal(validation.numWarnings, 0)
  const inspection = inspectDocument(source.document, { name: 'psylo', container: 'glb', fileBytes: source.bytes.length, budgets })
  assert.equal(inspection.ok, true)
  assert.ok(source.bytes.length <= budgets.maxFileBytes)
  assert.ok(inspection.memory.totalBytes <= budgets.assetGpuBytes[tier])
  assert.equal(inspection.counts.animations, 0)
  for (const mesh of source.document.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const count = p.getAttribute('POSITION').getCount()
    for (const semantic of ['NORMAL', '_PSYLO_ROOT', '_PSYLO_HEIGHT', '_PSYLO_ID', '_PSYLO_ZONE', '_PSYLO_SPECIES', '_PSYLO_PART']) assert.equal(p.getAttribute(semantic).getCount(), count)
    const ids = p.getAttribute('_PSYLO_ID').getArray(), heights = p.getAttribute('_PSYLO_HEIGHT').getArray()
    for (let i = 0; i < count; i++) { assert.ok(Number.isInteger(ids[i])); assert.ok(heights[i] >= 0 && heights[i] <= 1) }
    assert.equal(p.getMaterial().getExtension('KHR_materials_unlit'), null)
  }
})
test('the population surrounds the grove and preserves the travel/orbit corridors', () => {
  assert.equal(report.instances.length, 167)
  assert.equal(report.sourcePresentationRemoved, true)
  for (const instance of report.instances.slice(7)) {
    const [x, , z] = instance.position
    const r = Math.hypot(x, z + 8)
    assert.ok(Math.abs(r - 15) >= 2.4)
    assert.ok(!(Math.abs(x) < 3 && z > -9))
  }
  assert.ok(report.instances.some(i => i.position[2] < -30))
  assert.ok(report.instances.some(i => i.position[2] > 10))
  assert.ok(report.instances.some(i => i.position[0] < -20))
  assert.ok(report.instances.some(i => i.position[0] > 20))
})
