import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const fontPath = join(root, 'scripts/cinema2-assets/sources/anton/Anton-Regular.ttf')
const licensePath = join(root, 'scripts/cinema2-assets/sources/anton/OFL.txt')
const shippedLicensePath = join(root, 'public/cinema2/licenses/Anton-OFL-1.1.txt')
const glbPath = join(root, 'public/cinema2/models/say-it-glyphs-v1.glb')
const metricsPath = join(root, 'src/components/vyzualz/cinema2/modules/sayIt/Cinema2SayItGlyphMetrics.generated.json')

test('SAY IT production package covers printable Basic Latin with pinned licensed source', () => {
  const font = readFileSync(fontPath)
  assert.equal(createHash('sha256').update(font).digest('hex'), 'a4ba3a92350ebb031da0cb47630ac49eb265082ca1bc0450442f4a83ab947cab')
  const license = readFileSync(licensePath, 'utf8')
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/)
  assert.equal(readFileSync(shippedLicensePath, 'utf8'), license)

  const metrics = JSON.parse(readFileSync(metricsPath, 'utf8'))
  assert.deepEqual(metrics.repertoire, { firstCodePoint: 32, lastCodePoint: 126, fallbackCodePoint: 63 })
  assert.equal(Object.keys(metrics.glyphs).length, 95)
  assert.equal(metrics.glyphs['32'].mesh, null)

  const glb = readFileSync(glbPath)
  assert.equal(glb.readUInt32LE(0), 0x46546c67)
  const jsonLength = glb.readUInt32LE(12)
  const manifest = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8').trimEnd())
  const nodeNames = new Set(manifest.nodes.map(node => node.name))
  assert.equal(nodeNames.size, 94)
  let triangles = 0
  for (let codePoint = 33; codePoint <= 126; codePoint += 1) {
    const name = `glyph-u${codePoint.toString(16).padStart(4, '0').toUpperCase()}`
    assert.ok(nodeNames.has(name), `missing ${name}`)
  }
  for (const mesh of manifest.meshes) {
    for (const primitive of mesh.primitives) triangles += manifest.accessors[primitive.indices].count / 3
  }
  assert.equal(triangles, 57482)
})
