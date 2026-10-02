import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { contoursOfAdaptive, pathData } from './cinema2-svg-relief-kit.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const layout = JSON.parse(readFileSync(join(root, 'scripts/cinema2-assets/conduit-layout.json'), 'utf8'))
const bodyIds = ['left-primary-body', 'central-interlock-body', 'left-inner-body', 'right-primary-body', 'right-interlock-and-sweep', 'left-lower-sweep', 'center-lower-sweep', 'four-point-symbol']

test('the generated geometry is traced from the approved master SVG with bounded curve sampling', () => {
  const source = readFileSync(join(root, 'scripts/cinema2-assets/sources/dvydrm-wordmark-master.svg'), 'utf8')
  assert.equal(createHash('sha256').update(source).digest('hex'), '0ac33e757c07ed5e13b04b72d8c5f90403628531adb4632973729fd05df566f9')
  assert.ok(layout.curveMaxErrorSvg > 0 && layout.curveMaxErrorSvg <= 0.5)
  const ring = contoursOfAdaptive(pathData(source, 'outer-outline-ring'), layout.curveMaxErrorSvg)
  assert.equal(ring.length, 2, 'The SVG outer-outline ring must retain its even-odd hole.')
  const contours = [...ring, ...bodyIds.flatMap(id => contoursOfAdaptive(pathData(source, id), layout.curveMaxErrorSvg))]
  const points = contours.flat()
  for (const [key, value] of Object.entries({
    minX: Math.min(...points.map(point => point[0])), maxX: Math.max(...points.map(point => point[0])),
    minY: Math.min(...points.map(point => point[1])), maxY: Math.max(...points.map(point => point[1])),
  })) assert.ok(Math.abs(layout.sourceBounds[key] - value) < 1e-8, `Stale generated ${key} bound.`)
})

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
    const indexAccessor = gltf.accessors[entry.primitives[0].indices]
    const indexView = gltf.bufferViews[indexAccessor.bufferView]
    const indexStart = binaryOffset + (indexView.byteOffset ?? 0) + (indexAccessor.byteOffset ?? 0)
    const indexBytes = indexAccessor.componentType === 5125 ? 4 : 2
    const phases = Array.from({ length: phaseAccessor.count }, (_, i) => bytes.readFloatLE(phaseStart + i * 4))
    return {
      bounds: accessor,
      positions: Array.from({ length: accessor.count }, (_, i) => [0, 1, 2].map(axis => bytes.readFloatLE(start + (i * 3 + axis) * 4))),
      indices: Array.from({ length: indexAccessor.count }, (_, i) => indexBytes === 4 ? bytes.readUInt32LE(indexStart + i * 4) : bytes.readUInt16LE(indexStart + i * 2)),
      phases,
      peak: Math.max(...phases),
    }
  }
  return { mesh, material: materialName => gltf.materials.find(candidate => candidate.name === materialName) }
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
  const wordmark = model('wordmark')
  const rim = wordmark.mesh('rim')
  assert.ok(rim.bounds.min[0] < -layout.wordmark.width / 2)
  assert.ok(rim.bounds.max[0] > layout.wordmark.width / 2)
  assert.ok(rim.peak > 0.54, 'The perimeter must retain a music-driven emissive edge')
  const unlitColor = wordmark.material('rim').pbrMetallicRoughness.baseColorFactor
  assert.ok(unlitColor.slice(0, 3).every(channel => channel < 0.1), 'The unlit rim must not reflect cream-colored light over its emission')
})

test('every glowing rim triangle stays local to its sampled contour, including the inner hook', () => {
  const rim = model('wordmark').mesh('rim')
  let longest = 0
  for (let i = 0; i < rim.indices.length; i += 3) {
    const corners = rim.indices.slice(i, i + 3).map(index => rim.positions[index])
    for (let j = 0; j < 3; j += 1) {
      const a = corners[j], b = corners[(j + 1) % 3]
      longest = Math.max(longest, Math.hypot(a[0] - b[0], a[1] - b[1]))
    }
  }
  assert.ok(longest < 0.12, `A rim triangle bridges a letter gap (${longest.toFixed(3)} units)`)
})

test('the inner seam glow stays below the stronger outer perimeter glow', () => {
  const rim = model('wordmark').mesh('rim')
  const inner = rim.phases.filter((_, index) => rim.positions[index][2] > -0.072)
  const outer = rim.phases.filter((_, index) => rim.positions[index][2] <= -0.072)
  assert.ok(inner.length > 0 && outer.length > 0, 'The inner and outer rim bands must both exist.')
  assert.ok(Math.max(...inner) <= 0.4, 'The gap emitter must not thicken the white letter contours.')
  assert.ok(Math.max(...outer) > 0.54, 'The outer perimeter must retain its stronger outline glow.')
})
