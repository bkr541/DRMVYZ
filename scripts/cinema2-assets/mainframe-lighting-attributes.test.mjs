import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const glbPath = fileURLToPath(new URL('../../public/cinema2/models/mainframe.glb', import.meta.url))
const binary = readFileSync(glbPath)
assert.equal(binary.toString('ascii', 0, 4), 'glTF')
const jsonLength = binary.readUInt32LE(12)
const asset = JSON.parse(binary.subarray(20, 20 + jsonLength).toString('utf8'))
const binaryOffset = 20 + jsonLength + 8
const required = ['_GLOW_PHASE', '_MAINFRAME_ROUTE', '_MAINFRAME_BANK', '_MAINFRAME_REGION', '_MAINFRAME_SYSTEM']
const familyParts = { circuitCores: [1], indicatorCores: [2, 3], radarCores: [4], chipCores: [5], logoCore: [6, 7, 8] }

function floatValues(index) {
  const accessor = asset.accessors[index]
  const view = asset.bufferViews[accessor.bufferView]
  const offset = binaryOffset + view.byteOffset + (accessor.byteOffset ?? 0)
  return Array.from({ length: accessor.count }, (_, id) => binary.readFloatLE(offset + id * 4))
}

test('shipped Mainframe GLB has complete float metadata for all five emissive meshes', () => {
  for (const [part, ids] of Object.entries(familyParts)) {
    const mesh = asset.meshes.find(item => item.name === part)
    assert.ok(mesh, `Missing ${part} mesh`)
    const attributes = mesh.primitives[0].attributes
    const count = asset.accessors[attributes.POSITION].count
    for (const name of required) {
      const accessor = asset.accessors[attributes[name]]
      assert.ok(accessor, `${part} missing ${name}`)
      assert.equal(accessor.componentType, 5126, `${part}.${name} must be FLOAT`)
      assert.equal(accessor.type, 'SCALAR', `${part}.${name} must be scalar`)
      assert.equal(accessor.count, count, `${part}.${name} count mismatch`)
    }
    const systems = new Set(floatValues(attributes._MAINFRAME_SYSTEM))
    for (const id of ids) assert.ok(systems.has(id), `${part} is missing system ${id}`)
    assert.deepEqual([...systems].sort((a, b) => a - b), [...ids].sort((a, b) => a - b), `${part} has unexpected systems`)
  }
})

test('Mainframe semantic route and phase attributes retain finite values', () => {
  for (const mesh of asset.meshes.filter(item => Object.hasOwn(familyParts, item.name))) {
    const attributes = mesh.primitives[0].attributes
    for (const name of required) {
      const values = floatValues(attributes[name])
      assert.ok(values.every(Number.isFinite), `${mesh.name}.${name} contains invalid float values`)
    }
  }
})
