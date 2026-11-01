// Prepare the owner's complete scene without changing its topology or materials.
// node scripts/cinema2-assets/prepare-war-of-worlds.mjs /path/to/warofworlds.glb
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { cloneDocument, prune } from '@gltf-transform/functions'
import { readAsset } from './asset-tools/io.mjs'
import { optimizeAsset } from './asset-tools/optimize.mjs'

const input = process.argv[2]
if (!input) throw new Error('Pass the source warofworlds.glb path.')
const source = await readAsset(input)
const totals = [0, 0]
const groups = new Map()
source.document.getRoot().listMeshes().forEach((mesh, index) => {
  // The import repeats mesh names. Unique names make round-trip comparisons reliable.
  mesh.setName(`war-worlds-mesh-${index}`)
  const triangles = mesh.listPrimitives().reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0)
  const group = totals[0] <= totals[1] ? 0 : 1
  groups.set(mesh.getName(), group)
  totals[group] += triangles
})
const budgets = JSON.parse(await readFile('assets/cinema2/budgets.json', 'utf8'))
await mkdir('public/cinema2/models', { recursive: true })
for (const [index, part] of ['a', 'b'].entries()) {
  const document = cloneDocument(source.document)
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (mesh && groups.get(mesh.getName()) !== index) node.setMesh(null)
  }
  await document.transform(prune())
  const results = await optimizeAsset({ ...source, document }, {
    tiers: ['high', 'low'], geometry: 'meshopt', textures: 'webp',
    maxTexture: { high: 512, low: 256 }, budgets,
  })
  for (const result of results) {
    if (!result.ok) throw new Error(`${part}/${result.tier}: ${result.failures.join('; ')}`)
    const suffix = result.tier === 'high' ? '' : '-low'
    await writeFile(`public/cinema2/models/war-of-worlds-${part}${suffix}.glb`, result.bytes)
    console.log(`War Of Worlds ${part}/${result.tier}: ${result.inspection.geometry.triangles} triangles, ${result.bytes.length} bytes`)
  }
}
