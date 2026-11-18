import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { OPTIONS, PARTS, PHOTO, SOURCE_PATH, Z, buildModel, materialsOf, outlineOf, photographJpeg, writeGlb } from './generate-open-decks.mjs'

const glbJson = glb => JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString())

test('the reference photograph is the supplied one, at the size the parts were measured on', async () => {
  assert.equal(createHash('sha256').update(readFileSync(SOURCE_PATH)).digest('hex'), '75da1732679026af65b660cf290769f996e73300638e6ff99bc3fa1e3ec82e10')
  const jpeg = await photographJpeg()
  assert.equal(jpeg[0], 0xff); assert.equal(jpeg[1], 0xd8)
  const { default: sharp } = await import('sharp')
  const meta = await sharp(jpeg).metadata()
  assert.deepEqual([meta.width, meta.height], [PHOTO.width, PHOTO.height])
})

test('every part lies on the photograph and stands on something', () => {
  for (const part of PARTS) {
    const { shape } = part
    const [x0, y0, x1, y1] = shape.kind === 'circle' ? [shape.cx - shape.radius, shape.cy - shape.radius, shape.cx + shape.radius, shape.cy + shape.radius] : [shape.x0, shape.y0, shape.x1, shape.y1]
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= PHOTO.width && y1 <= PHOTO.height, `${part.name} is off the photograph`)
    assert.ok(part.top > part.bottom, `${part.name} has no height`)
  }
  assert.equal(PARTS[0].name, 'chassis')
  assert.equal(PARTS[1].name, 'screen housing')
  assert.ok(PARTS[1].hole && PARTS[1].holeFloor < PARTS[1].top, 'The housing has the glass set back in it.')
  assert.ok(Z.glass < Z.housing && Z.plate < Z.housing)
})

test('outlines: rectangles keep their size, round corners add points, circles have the requested segments', () => {
  assert.equal(outlineOf({ kind: 'rect', x0: 0, y0: 0, x1: 10, y1: 10, radius: 0 }).length, 4)
  assert.ok(outlineOf({ kind: 'rect', x0: 0, y0: 0, x1: 10, y1: 10, radius: 3 }).length > 4)
  assert.equal(outlineOf({ kind: 'circle', cx: 5, cy: 5, radius: 2 }, 24).length, 24)
})

test('the model is three named meshes: the photographed device in two primitives, the glass, and the wall', () => {
  const model = buildModel()
  assert.deepEqual(model.meshes.map(mesh => mesh.name), ['cdj', 'screen', 'backdrop'])
  assert.deepEqual(model.meshes[0].primitives.map(primitive => primitive.material), ['panel', 'sides'])
  assert.ok(model.meshes[0].primitives[0].uvs, 'The tops are mapped to the photograph.')
  assert.equal(model.meshes[0].primitives[1].uvs, undefined, 'The sides are plain metal.')
  assert.ok(model.stats.triangles > 1000 && model.stats.triangles < 20_000, `Triangle count ${model.stats.triangles}`)
  assert.equal(model.stats.width, OPTIONS.width)
})

test('texture coordinates stay on the photograph, and a part maps to where it sits in it', () => {
  const [tops] = buildModel().meshes[0].primitives
  for (const value of tops.uvs) assert.ok(value >= 0 && value <= 1)
  // The chassis spans x 33..1047 of 1080 and y 155..732 of 800.
  const us = [], vs = []
  for (let i = 0; i < tops.uvs.length; i += 2) { us.push(tops.uvs[i]); vs.push(tops.uvs[i + 1]) }
  assert.ok(Math.min(...us) <= 33 / PHOTO.width + 1e-6 && Math.max(...us) >= 1047 / PHOTO.width - 1e-6)
  assert.ok(Math.min(...vs) <= 59 / PHOTO.height + 1e-6 && Math.max(...vs) >= 732 / PHOTO.height - 1e-6)
})

test('the glass is a quad at the floor of the housing opening; the wall is a quad behind the chassis and wider than any view of it', () => {
  const { meshes } = buildModel()
  const glass = meshes[1].primitives[0]
  assert.equal(glass.indices.length, 6)
  for (let i = 2; i < glass.positions.length; i += 3) assert.equal(Number(glass.positions[i].toFixed(6)), Z.glass)
  const wall = meshes[2].primitives[0]
  const zs = new Set(); for (let i = 2; i < wall.positions.length; i += 3) zs.add(wall.positions[i])
  assert.deepEqual([...zs], [Math.fround(-OPTIONS.wall.gap)])
  assert.ok(wall.positions[3] - wall.positions[0] > OPTIONS.width * 4)
})

test('every index refers to a vertex', () => {
  for (const mesh of buildModel().meshes) for (const primitive of mesh.primitives) {
    const count = primitive.positions.length / 3
    for (const index of primitive.indices) assert.ok(index < count)
  }
})

test('the GLB embeds the photograph once and carries one named material per primitive kind', async () => {
  const glb = writeGlb(buildModel().meshes, await photographJpeg())
  assert.equal(glb.readUInt32LE(0), 0x46546c67)
  assert.equal(glb.readUInt32LE(8), glb.length)
  const json = glbJson(glb)
  assert.deepEqual(json.extensionsRequired, ['KHR_mesh_quantization'])
  assert.equal(json.images.length, 1)
  assert.equal(json.images[0].mimeType, 'image/jpeg')
  assert.deepEqual(json.meshes.map(mesh => mesh.name), ['cdj', 'screen', 'backdrop'])
  assert.deepEqual(json.materials.map(material => material.name).sort(), ['open-decks-glass', 'open-decks-panel', 'open-decks-sides', 'open-decks-wall'])
  const materials = materialsOf()
  assert.ok(materials.panel.pbrMetallicRoughness.baseColorTexture && materials.panel.emissiveTexture, 'The tops carry the photograph.')
  assert.ok(materials.glass.emissiveTexture, 'The glass lights itself with the photograph.')
  assert.equal(materials.sides.pbrMetallicRoughness.baseColorTexture, undefined)
})
