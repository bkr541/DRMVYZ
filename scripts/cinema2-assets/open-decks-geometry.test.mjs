import { CLUB, CLUB_MATERIALS, buildOpenDecksClub } from './open-decks-club.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { OPTIONS, TABLE, HEIGHT_REFERENCE, PARTS, PHOTO, SOURCE_PATH, Z, buildModel, buildStudioBackdrop, materialsOf, outlineOf, illustrationJpeg, writeGlb } from './generate-open-decks.mjs'

const glbJson = glb => JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString())

test('the completed illustration atlas is the measured source, at the size the parts were measured on', async () => {
  assert.equal(createHash('sha256').update(readFileSync(SOURCE_PATH)).digest('hex'), '39a92cf6b6095e926fbb6017a22c92bdff8e232ad3b913a415fe60cbd3eed431')
  const jpeg = await illustrationJpeg()
  assert.equal(jpeg[0], 0xff); assert.equal(jpeg[1], 0xd8)
  const { default: sharp } = await import('sharp')
  const meta = await sharp(jpeg).metadata()
  // The embedded copy is the illustration enlarged to the asset's texture width, with the same proportions (so every texture coordinate still lands where it was measured).
  assert.equal(meta.width, OPTIONS.textureWidth)
  assert.equal(meta.height, Math.round(OPTIONS.textureWidth * PHOTO.height / PHOTO.width))
})

test('every part lies on the illustration and stands on something', () => {
  for (const part of PARTS) {
    const { shape } = part
    for (const [x,y] of outlineOf(shape)) assert.ok(x >= 0 && y >= 0 && x <= PHOTO.width && y <= PHOTO.height, `${part.name} is off the illustration`)
    assert.ok(part.top > part.bottom, `${part.name} has no height`)
  }
  assert.equal(PARTS.length, 57)
  assert.ok(PARTS.every(part => !part.name.includes('burst')))
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

test('the model has the illustrated device, recessed glass, wooden table and stage floor', () => {
  const model = buildModel()
  assert.deepEqual(model.meshes.slice(0,4).map(mesh => mesh.name), ['cdj', 'screen', 'table', 'backdrop'])
  assert.deepEqual(model.meshes[0].primitives.map(primitive => primitive.material), ['panel', 'sides'])
  assert.ok(model.meshes[0].primitives[0].uvs, 'The tops are mapped to the illustration.')
  assert.equal(model.meshes[0].primitives[1].uvs, undefined, 'The sides are matte ink.')
  assert.ok(model.stats.triangles > 1000 && model.stats.triangles < 100_000, `Triangle count ${model.stats.triangles}`)
  assert.equal(model.stats.width, OPTIONS.width)
})

test('texture coordinates stay on the illustration, and a part maps to where it sits in it', () => {
  const [tops] = buildModel().meshes[0].primitives
  for (const value of tops.uvs) assert.ok(value >= 0 && value <= 1)
  // Bounds follow the chassis and screen housing, excluding decorative bursts.
  const us = [], vs = []
  for (let i = 0; i < tops.uvs.length; i += 2) { us.push(tops.uvs[i]); vs.push(tops.uvs[i + 1]) }
  assert.ok(Math.min(...us) <= 45 / PHOTO.width + 1e-6 && Math.max(...us) >= 1044 / PHOTO.width - 1e-6)
  assert.ok(Math.min(...vs) <= 18 / PHOTO.height + 1e-6 && Math.max(...vs) >= 1414 / PHOTO.height - 1e-6)
})

test('the glass is recessed and the stage floor sits beneath the table feet', () => {
  const { meshes } = buildModel()
  const glass = meshes[1].primitives[0]
  assert.equal(glass.indices.length, 6)
  for (let i = 2; i < glass.positions.length; i += 3) assert.ok(Math.abs(glass.positions[i] - Z.glass) < 1e-6)
  const wall = meshes[3].primitives[0]
  const heights = Array.from(wall.positions).filter((_, index) => index % 3 === 2)
  assert.ok(Math.abs(Math.min(...heights) - (TABLE.legBottom-.01)) < 1e-6)
  assert.ok(Math.max(...heights) > 40)
  assert.ok(wall.normals, 'Curved studio surfaces carry smooth normals')
})

test('every index refers to a vertex', () => {
  for (const mesh of buildModel().meshes) for (const primitive of mesh.primitives) {
    const count = primitive.positions.length / 3
    for (const index of primitive.indices) assert.ok(index < count)
  }
})

test('the GLB embeds the illustration once and carries one named material per primitive kind', async () => {
  const glb = writeGlb(buildModel().meshes, await illustrationJpeg())
  assert.equal(glb.readUInt32LE(0), 0x46546c67)
  assert.equal(glb.readUInt32LE(8), glb.length)
  const json = glbJson(glb)
  assert.deepEqual(json.extensionsRequired, ['KHR_mesh_quantization'])
  assert.equal(json.images.length, 1)
  assert.equal(json.images[0].mimeType, 'image/jpeg')
  assert.deepEqual(json.meshes.slice(0,4).map(mesh => mesh.name), ['cdj', 'screen', 'table', 'backdrop'])
  assert.deepEqual(json.materials.map(material => material.name).sort(), ['open-decks-glass', 'open-decks-panel', 'open-decks-sides', 'open-decks-wall', 'open-decks-wood', 'open-decks-wood-edge', 'open-decks-wood-grain', ...Object.values(CLUB_MATERIALS).map(material => material.name)].sort())
  const materials = materialsOf()
  assert.ok(materials.panel.pbrMetallicRoughness.baseColorTexture && materials.panel.emissiveTexture, 'The tops carry the illustration.')
  assert.ok(materials.glass.emissiveTexture, 'The glass lights itself with the illustration.')
  assert.equal(materials.sides.pbrMetallicRoughness.baseColorTexture, undefined)
})

test('the illustration uses matte materials and the visible jog wheel is raised geometry', () => {
  const materials = materialsOf()
  for (const material of Object.values(materials)) {
    assert.equal(material.pbrMetallicRoughness.metallicFactor, 0)
    assert.equal(material.pbrMetallicRoughness.roughnessFactor, 1)
  }
  for (const name of ['jog wheel rim', 'jog platter']) {
    const part = PARTS.find(part => part.name === name)
    assert.ok(part.top > Z.plate)
    assert.ok(outlineOf(part.shape).length > 6)
  }
})

test('the browse knob stands above the screen housing and buttons have substantial side walls', () => {
  const knob = PARTS.find(part => part.name === 'rotary knob')
  const crown = PARTS.find(part => part.name === 'rotary knob crown')
  assert.ok(knob.top - knob.bottom >= .16)
  assert.ok(knob.top > Z.housing + .15)
  assert.equal(crown.bottom, knob.top)
  assert.ok(crown.shape.radius < knob.shape.radius)
  for (const part of PARTS.filter(part => /soft key|hot cue pad|illustrated key|illustrated knob/.test(part.name))) {
    assert.ok(part.top - part.bottom >= .039, `${part.name} needs visible side walls`)
  }
})

test('the whole wheel and lower controls fit within a full-height chassis', () => {
  const chassis = PARTS[0].shape
  const wheel = PARTS.find(part => part.name === 'jog wheel rim').shape
  assert.equal(wheel.clipY, undefined)
  assert.equal(outlineOf(wheel).length, OPTIONS.circleSegments)
  assert.ok(wheel.cy + wheel.radius < chassis.y1)
  assert.ok(wheel.cy - wheel.radius > PARTS[1].shape.y1)
  assert.ok(buildModel().stats.height > 3.4)
  for (const name of ['jog center medallion', 'direction switch', 'search previous', 'search next', 'cue transport', 'play pause transport', 'tempo fader well', 'tempo fader cap', 'tempo reset']) {
    const part = PARTS.find(part => part.name === name)
    assert.ok(part && part.top > part.bottom, `${name} must be 3D geometry`)
  }
  const well = PARTS.find(part => part.name === 'tempo fader well')
  const cap = PARTS.find(part => part.name === 'tempo fader cap')
  assert.equal(cap.bottom, well.top)
})

test('the wooden tabletop supports the CDJ and has full-height legs and grain geometry', () => {
  const { meshes } = buildModel()
  const table = meshes.find(mesh => mesh.name === 'table')
  assert.ok(TABLE.width > OPTIONS.width && TABLE.length > buildModel().stats.height)
  // Reference proportions: a long booth for several devices, not a square single-deck stand.
  assert.ok(TABLE.width / OPTIONS.width >= 5)
  assert.ok(TABLE.width / TABLE.length > 3)
  assert.ok(-TABLE.legBottom / OPTIONS.width > 2.5)
  assert.ok(TABLE.frontClearance / -TABLE.legBottom > .25)
  assert.equal(TABLE.top, 0)
  assert.deepEqual(table.primitives.map(primitive => primitive.material), ['wood', 'wood-edge', 'wood-grain'])
  const heights = table.primitives.flatMap(primitive => Array.from(primitive.positions).filter((_, index) => index % 3 === 2))
  assert.ok(Math.abs(Math.min(...heights) - TABLE.legBottom) < 1e-6)
  assert.ok(Math.abs(Math.max(...heights) - .001) < 1e-6)
  assert.ok(table.primitives[2].indices.length > 100, 'Visible wood grain is modeled on the top planks')
})

test('the CDJ matches the supplied GLB height-to-width ratio without scaling its controls or table', () => {
  const model = buildModel()
  const vertices = model.meshes.filter(mesh => ['cdj', 'screen'].includes(mesh.name)).flatMap(mesh => mesh.primitives.flatMap(primitive => Array.from(primitive.positions)))
  const xs = vertices.filter((_, index) => index % 3 === 0)
  const zs = vertices.filter((_, index) => index % 3 === 2)
  const actualWidth = Math.max(...xs) - Math.min(...xs)
  const actualHeight = Math.max(...zs) - Math.min(...zs)
  assert.ok(Math.abs(actualHeight / actualWidth - HEIGHT_REFERENCE.heightToWidth) < 1e-6)
  assert.ok(model.stats.depth > .7 && model.stats.depth < .72)
  assert.ok(Z.plate > .44 && Z.plate < .46)
  assert.equal(PARTS[0].bottom, 0)
  assert.ok(Math.abs(PARTS.find(part => part.name === 'rotary knob').top - PARTS.find(part => part.name === 'rotary knob').bottom - .17) < 1e-9)
  assert.equal(TABLE.top, 0)
  assert.equal(TABLE.width, 15)
})

test('the studio backdrop is closed and faces inward, with a smooth floor and no exposed edge', () => {
  const backdrop = buildStudioBackdrop()
  const key = index => Array.from(backdrop.positions.slice(index*3,index*3+3)).map(value => value.toFixed(4)).join(',').replaceAll('-0.0000','0.0000')
  const edges = new Map()
  for (let i = 0; i < backdrop.indices.length; i += 3) {
    const triangle = Array.from(backdrop.indices.slice(i,i+3)).map(key)
    for (let side = 0; side < 3; side++) {
      const edge = [triangle[side], triangle[(side+1)%3]].sort().join('|')
      edges.set(edge, (edges.get(edge) ?? 0) + 1)
    }
  }
  assert.ok([...edges.values()].every(count => count === 2), 'No open boundary can show the scene clear color')
  for (let i = 0; i < backdrop.normals.length; i += 3) {
    assert.ok(Math.abs(Math.hypot(...backdrop.normals.slice(i,i+3)) - 1) < 1e-5)
  }
  const center = Array.from(backdrop.positions).findIndex((value,index) => index % 3 === 2 && Math.abs(value-(TABLE.legBottom-.01)) < 1e-6)
  assert.ok(backdrop.normals[center] > .99, 'Floor normals point into the room')
})

test('the club is volumetric geometry beyond the booth, with articulated dancers and light fixtures', () => {
  const club = buildOpenDecksClub()
  const bodies = club.filter(mesh => mesh.extras.clubRole === 'body')
  const arms = club.filter(mesh => ['left','right'].includes(mesh.extras.clubRole))
  assert.equal(bodies.length, CLUB.rows * CLUB.columns)
  assert.equal(arms.length, bodies.length * 2)
  assert.equal(club.filter(mesh => mesh.extras.clubBeam).length, 2)
  for (const body of bodies) {
    assert.ok(body.extras.clubPivot[1] > TABLE.length / 2 + 4, 'Audience stays beyond the far edge of the booth')
    for (const primitive of body.primitives) assert.ok(primitive.positions.length > 30 && primitive.normals)
  }
  const glb = glbJson(writeGlb(buildModel().meshes, Buffer.from([255,216,255,217])))
  assert.equal(glb.nodes.filter(node => node.extras?.clubRole === 'body').length, bodies.length)
})
