import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { loadMainframeSourceContract } from './mainframe-source-contract.mjs'

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
  const itemSize = accessor.type === 'VEC3' ? 3 : 1
  return Array.from({ length: accessor.count * itemSize }, (_, id) => binary.readFloatLE(offset + id * 4))
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

test('all 60 central and 356 extended circuit routes have a full, independently animated path', () => {
  const mesh = asset.meshes.find(item => item.name === 'circuitCores')
  assert.ok(mesh)
  const attributes = mesh.primitives[0].attributes
  const routes = floatValues(attributes._MAINFRAME_ROUTE)
  const phases = floatValues(attributes._GLOW_PHASE)
  const banks = floatValues(attributes._MAINFRAME_BANK)
  const regions = floatValues(attributes._MAINFRAME_REGION)
  const groups = new Map()
  for (let index = 0; index < routes.length; index += 1) {
    const id = routes[index]
    assert.ok(Number.isInteger(id) && id >= 0 && id < 416, `Invalid circuit route ${id}`)
    assert.ok(phases[index] >= -0.001 && phases[index] <= 1.001, `Route ${id} has an out-of-bounds arc phase`)
    assert.ok(banks[index] >= 0 && banks[index] <= 3, `Route ${id} has no pattern bank`)
    assert.ok(regions[index] >= 0 && regions[index] <= 7, `Route ${id} has no pattern region`)
    const group = groups.get(id) ?? { min: Infinity, max: -Infinity, bank: banks[index], region: regions[index] }
    assert.equal(group.bank, banks[index], `Route ${id} changes bank mid-path`)
    assert.equal(group.region, regions[index], `Route ${id} changes region mid-path`)
    group.min = Math.min(group.min, phases[index])
    group.max = Math.max(group.max, phases[index])
    groups.set(id, group)
  }
  assert.equal(groups.size, 416)
  for (let id = 0; id < 416; id += 1) {
    const group = groups.get(id)
    assert.ok(group, `Missing ${id < 60 ? 'central' : 'outer'} circuit route ${id}`)
    assert.ok(group.min <= 0.002 && group.max >= 0.998, `Route ${id} cannot carry a pulse end-to-end`)
  }
  const housing = asset.meshes.find(item => item.name === 'circuitHousings')
  const housingRoutes = new Set(floatValues(housing.primitives[0].attributes._MAINFRAME_ROUTE))
  assert.deepEqual(housingRoutes, new Set(groups.keys()), 'Every animated core needs its matching glow housing')
})

test('central and expanded radar rings have individual angular phases and separate physical bands', () => {
  const source = loadMainframeSourceContract()
  const radars = [...source.components.radars, ...source.extension.radars]
  const mesh = asset.meshes.find(item => item.name === 'radarCores')
  const attributes = mesh.primitives[0].attributes
  const positions = floatValues(attributes.POSITION)
  const routes = floatValues(attributes._MAINFRAME_ROUTE)
  const phases = floatValues(attributes._GLOW_PHASE)
  const hardware = asset.meshes.find(item => item.name === 'radarHardware')
  const metalDetails = new Set(floatValues(hardware.primitives[0].attributes._MAINFRAME_ROUTE))
  assert.ok([0, 1, 2, 3].every(id => metalDetails.has(id)), 'Retain separate metal base and rings')
  for (const radar of radars) {
    const cx = (radar.cx - 960) / 150, cy = (540 - radar.cy) / 150
    const radius = (radar.outer_radius ?? radar.radius) / 150
    const rings = [[], []]
    for (let i = 0; i < routes.length; i += 1) {
      if (routes[i] !== 1 && routes[i] !== 2) continue
      const d = Math.hypot(positions[i * 3] - cx, positions[i * 3 + 1] - cy)
      if (d < radius * 0.86 && d > radius * 0.28) rings[routes[i] - 1].push(phases[i])
    }
    for (const [index, phasesForRing] of rings.entries()) {
      assert.ok(phasesForRing.length > 10, `${radar.id} missing ring ${index + 1}`)
      // Authored 10/12-sided outer rings sample the circle in 0.1/0.083 steps;
      // the seam endpoints can fall on either side of the vertex order.
      assert.ok(Math.max(...phasesForRing) - Math.min(...phasesForRing) >= 0.79,
        `${radar.id} ring ${index + 1} has no full 360-degree sweep`)
    }
  }
})

test('chips and embedded indicator geometry retain independently addressable surfaces', () => {
  const chipMesh = asset.meshes.find(item => item.name === 'chipCores')
  const chipAttrs = chipMesh.primitives[0].attributes
  const positions = floatValues(chipAttrs.POSITION)
  const details = floatValues(chipAttrs._MAINFRAME_ROUTE)
  for (const id of [1, 2, 3, 4]) assert.ok(details.includes(id), `Chip detail ${id} not addressable`)
  assert.ok(details.some((id, i) => id === 1 && Math.abs(positions[i * 3]) > 9), 'Expanded chips must have powered faces')
  assert.ok(details.some((id, i) => id === 2 && Math.abs(positions[i * 3]) > 9), 'Expanded chips must have powered pins')
  const housings = asset.meshes.find(item => item.name === 'chipHardware')
  const housingDetails = new Set(floatValues(housings.primitives[0].attributes._MAINFRAME_ROUTE))
  assert.ok([0, 1, 2].every(id => housingDetails.has(id)), 'Existing metal faces and fins need isolated response')
  const indicators = asset.meshes.find(item => item.name === 'indicatorCores')
  const indicatorAttrs = indicators.primitives[0].attributes
  const systems = new Set(floatValues(indicatorAttrs._MAINFRAME_SYSTEM))
  assert.ok(systems.has(2) && systems.has(3), 'Terminal and via systems must remain independent')
  const indicatorDetails = floatValues(indicatorAttrs._MAINFRAME_ROUTE)
  const indicatorPhases = floatValues(indicatorAttrs._GLOW_PHASE)
  assert.ok(indicatorDetails.some((id, i) => id === 1 && indicatorPhases[i] > 0.8), 'Outer regulation rings need sweep phases')
})
