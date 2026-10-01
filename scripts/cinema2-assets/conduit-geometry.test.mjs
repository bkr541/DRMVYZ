import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const layout = JSON.parse(readFileSync(join(root, 'scripts/cinema2-assets/conduit-layout.json'), 'utf8'))

function model(name) {
  const bytes = readFileSync(join(root, `public/cinema2/models/conduit-${name}.glb`))
  const jsonLength = bytes.readUInt32LE(12)
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
  const binaryOffset = 20 + jsonLength + 8
  const mesh = meshName => {
    const entry = gltf.meshes.find(candidate => candidate.name === meshName)
    assert.ok(entry, `Missing ${meshName} in ${name}`)
    const accessor = gltf.accessors[entry.primitives[0].attributes.POSITION]
    const view = gltf.bufferViews[accessor.bufferView]
    const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const phaseAccessor = gltf.accessors[entry.primitives[0].attributes._GLOW_PHASE]
    const phaseView = gltf.bufferViews[phaseAccessor.bufferView]
    const phaseStart = binaryOffset + (phaseView.byteOffset ?? 0) + (phaseAccessor.byteOffset ?? 0)
    return {
      bounds: accessor,
      positions: Array.from({ length: accessor.count }, (_, i) => [0, 1, 2].map(axis => bytes.readFloatLE(start + (i * 3 + axis) * 4))),
      peak: Math.max(...Array.from({ length: phaseAccessor.count }, (_, i) => bytes.readFloatLE(phaseStart + i * 4))),
    }
  }
  return { mesh }
}

test('the four narrow sockets reach the outer lip while broad collars remain behind the raised frame', () => {
  const tubes = model('tubes')
  for (const side of ['left', 'right']) for (const end of ['upper', 'lower']) {
    const coupler = tubes.mesh(`coupler-${side}-${end}`)
    const sign = side === 'left' ? 1 : -1
    const attachment = layout.attachments[end]
    const normal = layout.normals[end]
    const lip = [
      sign * (attachment[0] + normal[0] * layout.wordmark.lipOutset),
      attachment[1] + normal[1] * layout.wordmark.lipOutset,
      -0.16,
    ]
    const distance = Math.min(...coupler.positions.map(point => Math.hypot(point[0] - lip[0], point[1] - lip[1], point[2] - lip[2])))
    assert.ok(distance < 0.12, `${side} ${end} socket misses the outline by ${distance.toFixed(3)} units`)
    assert.ok(coupler.bounds.max[2] < 0.045, `${side} ${end} collar projects in front of the wordmark frame`)
  }
})

test('the outer glow extends beyond the nominal wordmark silhouette', () => {
  const rim = model('wordmark').mesh('rim')
  assert.ok(rim.bounds.min[0] < -layout.wordmark.width / 2)
  assert.ok(rim.bounds.max[0] > layout.wordmark.width / 2)
  assert.ok(rim.peak > 1, 'The perimeter must be brighter than the restrained interior seams')
})
