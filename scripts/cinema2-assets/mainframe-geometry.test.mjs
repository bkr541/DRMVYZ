import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { DEFAULT_BUDGETS } from './assets-core.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const modelPath = join(root, 'public/cinema2/models/mainframe.glb')
const bytes = readFileSync(modelPath)
const jsonLength = bytes.readUInt32LE(12)
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
const binaryOffset = 20 + jsonLength + 8
const meshByName = new Map(gltf.meshes.map(mesh => [mesh.name, mesh]))

const COMPONENT_BYTES = Object.freeze({ 5123: 2, 5125: 4, 5126: 4 })
function accessor(index) {
  const spec = gltf.accessors[index]
  const view = gltf.bufferViews[spec.bufferView]
  const offset = binaryOffset + (view.byteOffset ?? 0) + (spec.byteOffset ?? 0)
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[spec.type]
  const width = COMPONENT_BYTES[spec.componentType]
  const read = spec.componentType === 5126
    ? position => bytes.readFloatLE(position)
    : spec.componentType === 5125
      ? position => bytes.readUInt32LE(position)
      : position => bytes.readUInt16LE(position)
  return {
    spec,
    values: Array.from({ length: spec.count * components }, (_, valueIndex) => read(offset + valueIndex * width)),
  }
}

function mesh(name) {
  const entry = meshByName.get(name)
  assert.ok(entry, `Missing Mainframe mesh ${name}.`)
  const primitive = entry.primitives[0]
  return {
    primitive,
    positions: accessor(primitive.attributes.POSITION),
    normals: accessor(primitive.attributes.NORMAL),
    phases: accessor(primitive.attributes._GLOW_PHASE),
    route: accessor(primitive.attributes._MAINFRAME_ROUTE),
    bank: accessor(primitive.attributes._MAINFRAME_BANK),
    region: accessor(primitive.attributes._MAINFRAME_REGION),
    system: accessor(primitive.attributes._MAINFRAME_SYSTEM),
    indices: accessor(primitive.indices),
  }
}

const unique = values => [...new Set(values)].sort((left, right) => left - right)
const range = count => Array.from({ length: count }, (_, index) => index)

test('Mainframe ships the intended independently addressable hard-surface material families', () => {
  assert.deepEqual([...meshByName.keys()].sort(), [
    'board', 'chipCores', 'chipHardware', 'circuitCores', 'circuitHousings', 'hardware', 'indicatorCores',
    'logoCore', 'logoHousing', 'plates', 'radarCores', 'radarHardware', 'recesses',
  ])
  assert.deepEqual(gltf.materials.map(material => material.name).sort(), [...meshByName.keys()].sort())
})

test('Mainframe stays inside the shared model file and triangle budgets', () => {
  const triangles = [...meshByName.keys()].reduce((sum, name) => sum + mesh(name).indices.spec.count / 3, 0)
  assert.equal(triangles, 149932)
  assert.ok(triangles <= DEFAULT_BUDGETS.maxTrianglesPerAsset)
  assert.ok(bytes.length <= DEFAULT_BUDGETS.maxFileBytes)
})

test('every mesh is finite, indexed, bounded, and carries the Stage 2 custom attributes', () => {
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  for (const name of meshByName.keys()) {
    const value = mesh(name)
    const vertices = value.positions.spec.count
    assert.equal(value.normals.spec.count, vertices, `${name} normals`)
    assert.equal(value.phases.spec.count, vertices, `${name} phases`)
    assert.equal(value.route.spec.count, vertices, `${name} routes`)
    assert.equal(value.bank.spec.count, vertices, `${name} banks`)
    assert.equal(value.region.spec.count, vertices, `${name} regions`)
    assert.equal(value.system.spec.count, vertices, `${name} systems`)
    assert.ok(value.positions.values.every(Number.isFinite), `${name} finite positions`)
    assert.ok(value.normals.values.every(Number.isFinite), `${name} finite normals`)
    assert.ok(value.indices.values.every(index => Number.isInteger(index) && index >= 0 && index < vertices), `${name} valid indices`)
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], value.positions.spec.min[axis])
      bounds.max[axis] = Math.max(bounds.max[axis], value.positions.spec.max[axis])
    }
  }
  assert.ok(bounds.min[0] <= -16.27 && bounds.max[0] >= 16.27, `width ${bounds.min[0]}..${bounds.max[0]}`)
  assert.ok(bounds.min[1] <= -9.39 && bounds.max[1] >= 9.39, `height ${bounds.min[1]}..${bounds.max[1]}`)
  assert.ok(bounds.min[2] <= -0.37 && bounds.max[2] >= 0.66, `depth ${bounds.min[2]}..${bounds.max[2]}`)
})

test('the circuit core retains all central and extended route, bank, region, and centre-out phase identities', () => {
  const core = mesh('circuitCores')
  assert.deepEqual(unique(core.route.values), range(416))
  assert.deepEqual(unique(core.bank.values), range(4))
  assert.deepEqual(unique(core.region.values), range(8))
  assert.deepEqual(unique(core.system.values), [1])
  assert.ok(Math.min(...core.phases.values) <= 0.001)
  assert.ok(Math.max(...core.phases.values) >= 0.999)
})

test('radars, chips, indicators, and all three logo zones keep independent system identities', () => {
  assert.deepEqual(unique(mesh('radarHardware').system.values), [4])
  assert.deepEqual(unique(mesh('radarCores').system.values), [4])
  assert.deepEqual(unique(mesh('chipHardware').system.values), [5])
  assert.deepEqual(unique(mesh('chipCores').system.values), [5])
  assert.deepEqual(unique(mesh('indicatorCores').system.values), [2, 3])
  assert.deepEqual(unique(mesh('logoHousing').system.values), [6, 7, 8])
  assert.deepEqual(unique(mesh('logoCore').system.values), [6, 7, 8])
})
