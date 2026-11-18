import { buildOpenDecksClub, CLUB_MATERIALS } from './open-decks-club.mjs'
// Generates the illustrated OPEN DECKS CDJ from the owner's supplied artwork.
// Every control is an extruded volume; the screen sits inside a raised housing.
// Front faces use the illustration atlas, with matte ink-colored side walls.
// node scripts/cinema2-assets/generate-open-decks.mjs [out.glb]
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { LatheGeometry, ShapeUtils, Vector2 } from 'three'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const SOURCE_PATH = join(root, 'scripts/cinema2-assets/sources/open-decks-full-illustration.png')
export const DEFAULT_OUTPUT = join(root, 'public/cinema2/models/open-decks.glb')

/** The size of the reference illustration the part measurements were taken on. */
export const PHOTO = Object.freeze({ width: 1086, height: 1448 })

export const OPTIONS = Object.freeze({
  /** Width of the device (its outer chassis) in world units. */
  width: 2.5,
  /** Segments around a round part. */
  circleSegments: 40,
  /** The wall behind the device: size in world units, the gap behind the chassis back plane (the shadow falls across it), and colour. */
  wall: Object.freeze({ width: 16, height: 10, gap: 0.15, color: '#050607' }),
  /** JPEG quality of the embedded illustration. */
  jpegQuality: 90,
  /** The embedded illustration's width in pixels: the asset limit (see illustrationJpeg). */
  textureWidth: 2048,
})

/** Reference GLB bounds are measured in world space, so its import-axis transforms are included. */
export const HEIGHT_REFERENCE = Object.freeze(JSON.parse(readFileSync(new URL('./sources/open-decks-height-reference.json', import.meta.url), 'utf8')))
const chassisLift = OPTIONS.width * HEIGHT_REFERENCE.heightToWidth - .35
/** Retain the existing control rises; put the missing height into the chassis underneath them. */
export const Z = Object.freeze({ plate: .09 + chassisLift, housing: .17 + chassisLift, glass: .158 + chassisLift })


/**
 * Every part, measured off the illustration (x, y in artwork pixels, y down). `bottom` is the height it stands on, `top` its height. The first two are
 * the chassis and the screen housing (the model is centred on them). `hole` cuts a rectangle out of the top (the glass opening of the housing).
 */
const ILLUSTRATED_PARTS = [
  {"name":"chassis","shape":{"kind":"rect","x0":45,"y0":182,"x1":1044,"y1":1414,"radius":26},"bottom":0,"top":0.09},
  {"name":"screen housing","shape":{"kind":"rect","x0":144,"y0":18,"x1":943,"y1":510,"radius":27},"hole":{"kind":"rect","x0":182,"y0":106,"x1":909,"y1":494,"radius":10},"bottom":0,"top":0.17,"holeFloor":0.158},
  {"name":"soft key 1","shape":{"kind":"rect","x0":219.75,"y0":57.75,"x1":312,"y1":94.5,"radius":9},"bottom":0.17,"top":0.21000000000000002},
  {"name":"soft key 2","shape":{"kind":"rect","x0":333,"y0":57.75,"x1":432,"y1":94.5,"radius":9},"bottom":0.17,"top":0.21000000000000002},
  {"name":"soft key 3","shape":{"kind":"rect","x0":445.5,"y0":57.75,"x1":541.5,"y1":94.5,"radius":9},"bottom":0.17,"top":0.21000000000000002},
  {"name":"soft key 4","shape":{"kind":"rect","x0":555.75,"y0":57.75,"x1":649.5,"y1":94.5,"radius":9},"bottom":0.17,"top":0.21000000000000002},
  {"name":"soft key 5","shape":{"kind":"rect","x0":663,"y0":57.75,"x1":762,"y1":94.5,"radius":9},"bottom":0.17,"top":0.21000000000000002},
  {"name":"soft key 6","shape":{"kind":"rect","x0":784.5,"y0":57.75,"x1":877.5,"y1":94.5,"radius":9},"bottom":0.17,"top":0.21000000000000002},
  {"name":"hot cue pad A","shape":{"kind":"rect","x0":216,"y0":524.25,"x1":292.5,"y1":566.25,"radius":9},"bottom":0.09,"top":0.16},
  {"name":"hot cue pad B","shape":{"kind":"rect","x0":301.5,"y0":524.25,"x1":376.5,"y1":566.25,"radius":9},"bottom":0.09,"top":0.16},
  {"name":"hot cue pad C","shape":{"kind":"rect","x0":387,"y0":524.25,"x1":460.5,"y1":566.25,"radius":9},"bottom":0.09,"top":0.16},
  {"name":"hot cue pad D","shape":{"kind":"rect","x0":471,"y0":524.25,"x1":543,"y1":566.25,"radius":9},"bottom":0.09,"top":0.16},
  {"name":"hot cue pad E","shape":{"kind":"rect","x0":553.5,"y0":524.25,"x1":628.5,"y1":566.25,"radius":9},"bottom":0.09,"top":0.16},
  {"name":"hot cue pad F","shape":{"kind":"rect","x0":638.25,"y0":524.25,"x1":712.5,"y1":566.25,"radius":9},"bottom":0.09,"top":0.16},
  {"name":"hot cue pad G","shape":{"kind":"rect","x0":722.25,"y0":524.25,"x1":796.5,"y1":566.25,"radius":9},"bottom":0.09,"top":0.16},
  {"name":"hot cue pad H","shape":{"kind":"rect","x0":807,"y0":524.25,"x1":883.5,"y1":566.25,"radius":9},"bottom":0.09,"top":0.16},
  {"name":"browse cluster","shape":{"kind":"rect","x0":915,"y0":247.5,"x1":1032.75,"y1":477.75,"radius":45},"bottom":0.09,"top":0.11499999999999999},
  {"name":"rotary","shape":{"kind":"circle","cx":970,"cy":359,"radius":61.5},"bottom":0.11499999999999999,"top":0.16},
  {"name":"rotary knob","shape":{"kind":"circle","cx":970,"cy":359,"radius":39},"bottom":0.16,"top":0.33},
  {"name":"rotary knob crown","shape":{"kind":"circle","cx":970,"cy":359,"radius":36.75},"bottom":0.33,"top":0.35},
  {"name":"illustrated knob 1","shape":{"kind":"circle","cx":113.25,"cy":600.75,"radius":26.25},"bottom":0.09,"top":0.21},
  {"name":"illustrated knob 2","shape":{"kind":"circle","cx":186,"cy":600.75,"radius":26.25},"bottom":0.09,"top":0.21},
  {"name":"illustrated knob 3","shape":{"kind":"circle","cx":273.75,"cy":600.75,"radius":26.25},"bottom":0.09,"top":0.21},
  {"name":"illustrated knob 4","shape":{"kind":"circle","cx":113.25,"cy":674.25,"radius":20.25},"bottom":0.09,"top":0.21},
  {"name":"illustrated knob 5","shape":{"kind":"circle","cx":186,"cy":674.25,"radius":20.25},"bottom":0.09,"top":0.21},
  {"name":"illustrated knob 6","shape":{"kind":"circle","cx":708.75,"cy":600.75,"radius":17.25},"bottom":0.09,"top":0.21},
  {"name":"illustrated knob 7","shape":{"kind":"circle","cx":756,"cy":600.75,"radius":17.25},"bottom":0.09,"top":0.21},
  {"name":"illustrated knob 8","shape":{"kind":"circle","cx":807,"cy":600.75,"radius":17.25},"bottom":0.09,"top":0.21},
  {"name":"illustrated knob 9","shape":{"kind":"circle","cx":855,"cy":600.75,"radius":17.25},"bottom":0.09,"top":0.21},
  {"name":"illustrated knob 10","shape":{"kind":"circle","cx":973.5,"cy":537.75,"radius":27.75},"bottom":0.09,"top":0.21},
  {"name":"illustrated knob 11","shape":{"kind":"circle","cx":825,"cy":668.25,"radius":25.5},"bottom":0.09,"top":0.21},
  {"name":"illustrated key 1","shape":{"kind":"rect","x0":78,"y0":224.25,"x1":144.75,"y1":275.25,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"illustrated key 2","shape":{"kind":"rect","x0":78,"y0":354,"x1":143.25,"y1":405,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"illustrated key 3","shape":{"kind":"rect","x0":89.25,"y0":457.5,"x1":137.25,"y1":481.5,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"illustrated key 4","shape":{"kind":"rect","x0":90,"y0":490.5,"x1":135.75,"y1":513.75,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"illustrated key 5","shape":{"kind":"rect","x0":921.75,"y0":588,"x1":973.5,"y1":626.25,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"illustrated key 6","shape":{"kind":"rect","x0":977.25,"y0":588,"x1":1026,"y1":626.25,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"illustrated key 7","shape":{"kind":"rect","x0":923.25,"y0":649.5,"x1":974.25,"y1":688.5,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"illustrated key 8","shape":{"kind":"rect","x0":979.5,"y0":649.5,"x1":1029,"y1":688.5,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"illustrated key 9","shape":{"kind":"rect","x0":937.5,"y0":705,"x1":1018.5,"y1":741,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"illustrated key 10","shape":{"kind":"rect","x0":90,"y0":718.5,"x1":142.5,"y1":762,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"illustrated key 11","shape":{"kind":"rect","x0":153,"y0":718.5,"x1":209.25,"y1":762,"radius":7.5},"bottom":0.09,"top":0.145},
  {"name":"jog wheel rim","shape":{"kind":"circle","cx":529,"cy":936,"radius":344},"bottom":0.09,"top":0.19},
  {"name":"jog platter","shape":{"kind":"circle","cx":529,"cy":936,"radius":269},"bottom":0.19,"top":0.21},
  {"name":"jog center medallion","shape":{"kind":"circle","cx":527,"cy":924,"radius":94},"bottom":0.21,"top":0.25},
  {"name":"direction switch","shape":{"kind":"rect","x0":79,"y0":786,"x1":165,"y1":841,"radius":8},"bottom":0.09,"top":0.15},
  {"name":"lower search knob 1","shape":{"kind":"circle","cx":100,"cy":911,"radius":21},"bottom":0.09,"top":0.17},
  {"name":"lower search knob 2","shape":{"kind":"circle","cx":155,"cy":911,"radius":21},"bottom":0.09,"top":0.17},
  {"name":"lower search knob 3","shape":{"kind":"circle","cx":100,"cy":979,"radius":21},"bottom":0.09,"top":0.17},
  {"name":"lower search knob 4","shape":{"kind":"circle","cx":155,"cy":979,"radius":21},"bottom":0.09,"top":0.17},
  {"name":"search previous","shape":{"kind":"rect","x0":81,"y0":1018,"x1":131,"y1":1061,"radius":8},"bottom":0.09,"top":0.15},
  {"name":"search next","shape":{"kind":"rect","x0":139,"y0":1018,"x1":188,"y1":1061,"radius":8},"bottom":0.09,"top":0.15},
  {"name":"cue transport","shape":{"kind":"circle","cx":137,"cy":1156,"radius":60},"bottom":0.09,"top":0.17},
  {"name":"play pause transport","shape":{"kind":"circle","cx":137,"cy":1296,"radius":61},"bottom":0.09,"top":0.17},
  {"name":"tempo fader well","shape":{"kind":"rect","x0":930,"y0":782,"x1":1017,"y1":1344,"radius":15},"bottom":0.09,"top":0.115},
  {"name":"tempo fader cap","shape":{"kind":"rect","x0":941,"y0":1054,"x1":1005,"y1":1118,"radius":5},"bottom":0.115,"top":0.19},
  {"name":"tempo reset","shape":{"kind":"circle","cx":886,"cy":1106,"radius":26},"bottom":0.09,"top":0.16},
]

export const PARTS = Object.freeze(ILLUSTRATED_PARTS.map(part => ({
  ...part,
  bottom: part.name === 'chassis' || part.name === 'screen housing' ? 0 : part.bottom + chassisLift,
  top: part.top + chassisLift,
  ...(part.holeFloor == null ? {} : { holeFloor: part.holeFloor + chassisLift }),
})))

/** Local +Z becomes world +Y when the deck lies on its table. */
export const TABLE = Object.freeze({ width: 15, length: 4.2, top: 0, thickness: .25, legBottom: -7.2, legWidth: .24, frontClearance: 2.2, planks: 12 })

function buildTable() {
  const wood = new Primitive(false), edges = new Primitive(false), grain = new Primitive(false)
  const quad = (primitive, points) => {
    const start = primitive.positions.length / 3
    for (const point of points) primitive.vertex(...point)
    primitive.indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }
  const box = (x0, y0, z0, x1, y1, z1) => {
    quad(wood, [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]])
    quad(edges, [[x0,y1,z0],[x1,y1,z0],[x1,y0,z0],[x0,y0,z0]])
    quad(edges, [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]])
    quad(edges, [[x1,y1,z0],[x0,y1,z0],[x0,y1,z1],[x1,y1,z1]])
    quad(wood, [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]])
    quad(wood, [[x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1]])
  }
  const { width, length, thickness, legWidth, legBottom, planks } = TABLE
  for (let plank = 0; plank < planks; plank++) {
    const x0 = -width / 2 + plank * width / planks + .004
    const x1 = -width / 2 + (plank + 1) * width / planks - .004
    box(x0, -length / 2, -thickness, x1, length / 2, 0)
    // Shallow ink ribbons give the timber a readable, illustrated grain in real geometry.
    for (let line = 0; line < 16; line++) {
      const center = x0 + .025 + (x1 - x0 - .05) * line / 15
      for (let step = 0; step < 32; step++) {
        const y0 = -length / 2 + .025 + (length - .05) * step / 32
        const y1 = -length / 2 + .025 + (length - .05) * (step + 1) / 32
        const wave = y => center + .009 * Math.sin(y * (3 + line % 3) + plank + line) + .003 * Math.sin(y * 11 + line)
        const w = line % 4 === 0 ? .003 : .0015
        quad(grain, [[wave(y0)-w,y0,.001],[wave(y0)+w,y0,.001],[wave(y1)+w,y1,.001],[wave(y1)-w,y1,.001]])
      }
    }
  }
  const supportX = width / 2 - .25, supportY = length / 2 - .25
  for (const x of [-supportX, supportX]) for (const y of [-supportY, supportY]) {
    box(x-legWidth/2, y-legWidth/2, legBottom, x+legWidth/2, y+legWidth/2, -thickness)
  }
  // Full-height booth fascia and side returns, sized from the countertop like the reference.
  box(-supportX+.12, -length/2+.04, legBottom+TABLE.frontClearance, supportX-.12, -length/2+.24, -thickness)
  for (const x of [-supportX, supportX]) {
    box(x-.12, -length/2+.04, legBottom+.15, x+.12, length/2-.04, -thickness)
  }
  // A rear apron and stretcher brace the long worktop without dividing the equipment space.
  box(-supportX, supportY-.08, -.65, supportX, supportY+.08, -thickness)
  box(-supportX, supportY-.08, legBottom+.4, supportX, supportY+.08, legBottom+.6)
  return { wood, edges, grain }
}

/** Closed studio cyclorama: flat floor, curved wall transitions and ceiling.
 * It is scene geometry, so orbit/elevation changes never expose a viewport-sized backdrop edge. */
export function buildStudioBackdrop() {
  const floor = TABLE.legBottom - .01
  const profile = [new Vector2(0, floor), new Vector2(35, floor)]
  for (let step = 1; step <= 10; step++) {
    const angle = step / 10 * Math.PI / 2
    profile.push(new Vector2(35 + 15 * Math.sin(angle), floor + 15 * (1 - Math.cos(angle))))
  }
  profile.push(new Vector2(50, floor + 40))
  for (let step = 1; step <= 10; step++) {
    const angle = step / 10 * Math.PI / 2
    profile.push(new Vector2(35 + 15 * Math.cos(angle), floor + 40 + 15 * Math.sin(angle)))
  }
  profile.push(new Vector2(0, floor + 55))
  const geometry = new LatheGeometry(profile, 48).rotateX(Math.PI / 2)
  const positions = Float32Array.from(geometry.attributes.position.array)
  const normals = Float32Array.from(geometry.attributes.normal.array, value => -value)
  const source = geometry.index.array, indices = []
  for (let index = 0; index < source.length; index += 3) {
    const a = source[index], b = source[index + 1], c = source[index + 2]
    const ab = [0,1,2].map(k => positions[b*3+k] - positions[a*3+k])
    const ac = [0,1,2].map(k => positions[c*3+k] - positions[a*3+k])
    const area = Math.hypot(ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0])
    if (area > 1e-8) indices.push(a,c,b) // Interior-facing triangles; omit collapsed triangles at the cap centers.
  }
  geometry.dispose()
  return { positions, normals, indices: Uint32Array.from(indices) }
}

// ── Outlines ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A shape as a ring of [x, y] artwork pixels. */
export function outlineOf(shape, circleSegments = OPTIONS.circleSegments) {
  if (shape.kind === 'circle') {
    const ring = Array.from({ length: circleSegments }, (_, i) => { const a = (i / circleSegments) * Math.PI * 2; return [shape.cx + Math.cos(a) * shape.radius, shape.cy + Math.sin(a) * shape.radius] })
    return ring
  }
  const { x0, y0, x1, y1 } = shape
  const radius = Math.min(shape.radius, (x1 - x0) / 2, (y1 - y0) / 2)
  if (radius <= 0) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const corners = [[x1 - radius, y0 + radius, -90], [x1 - radius, y1 - radius, 0], [x0 + radius, y1 - radius, 90], [x0 + radius, y0 + radius, 180]]
  const ring = []
  for (const [cx, cy, start] of corners) for (let step = 0; step <= 4; step += 1) { const a = ((start + step * 22.5) * Math.PI) / 180; ring.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]) }
  return ring
}

const signedArea = ring => ring.reduce((sum, [x0, y0], i) => { const [x1, y1] = ring[(i + 1) % ring.length]; return sum + (x0 * y1 - x1 * y0) }, 0) / 2
/** Orients a ring in world space (y up): counter-clockwise for an outer ring, clockwise for a hole. */
const orient = (ring, counterClockwise) => ((signedArea(ring) > 0) === counterClockwise ? ring : [...ring].reverse())

// ── Building the meshes ────────────────────────────────────────────────────────────────────────────────────────────────────────

class Primitive {
  constructor(textured) { this.textured = textured; this.positions = []; this.uvs = []; this.indices = [] }
  vertex(x, y, z, u = 0, v = 0) { this.positions.push(x, y, z); if (this.textured) this.uvs.push(u, v); return this.positions.length / 3 - 1 }
}

/**
 * Builds the model. Returns { meshes: [{ name, primitives: [{ material, positions, uvs?, indices }] }], stats }.
 * Photo pixels become world units about the device's centre, scaled so the chassis is `options.width` wide.
 */
export function buildModel(options = OPTIONS) {
  const chassis = PARTS[0].shape
  const scale = options.width / (chassis.x1 - chassis.x0)
  const centerX = (chassis.x0 + chassis.x1) / 2
  const centerY = (PARTS[1].shape.y0 + chassis.y1) / 2
  const world = ([x, y]) => [(x - centerX) * scale, (centerY - y) * scale]
  const uv = ([x, y]) => [x / PHOTO.width, y / PHOTO.height]

  const tops = new Primitive(true), sides = new Primitive(false)
  for (const part of PARTS) {
    // Photo y runs down, so a ring that is clockwise in artwork space is counter-clockwise in the world.
    const rings = [orient(outlineOf(part.shape, options.circleSegments), false), ...(part.hole ? [orient(outlineOf(part.hole, options.circleSegments), true)] : [])]
    const worldRings = rings.map(ring => ring.map(world))
    // Top cap: triangulated in world space, each vertex mapped to the illustration.
    const triangles = ShapeUtils.triangulateShape(worldRings[0].map(([x, y]) => new Vector2(x, y)), worldRings.slice(1).map(ring => ring.map(([x, y]) => new Vector2(x, y))))
    const capStart = tops.positions.length / 3
    rings.forEach((ring, r) => ring.forEach((point, i) => { const [x, y] = worldRings[r][i]; const [u, v] = uv(point); tops.vertex(x, y, part.top, u, v) }))
    for (const [a, b, c] of triangles) tops.indices.push(capStart + a, capStart + b, capStart + c)
    // Walls: from the height the part stands on up to its top; the glass opening's walls run from the glass up to the housing front.
    rings.forEach((ring, r) => {
      const bottom = r === 1 ? part.holeFloor : part.bottom
      const base = sides.positions.length / 3
      worldRings[r].forEach(([x, y]) => { sides.vertex(x, y, part.top); sides.vertex(x, y, bottom) })
      for (let i = 0; i < ring.length; i += 1) {
        const j = (i + 1) % ring.length
        const topA = base + 2 * i, footA = topA + 1, topB = base + 2 * j, footB = topB + 1
        sides.indices.push(footA, footB, topB, footA, topB, topA)
      }
    })
  }

  // The glass: a quad at the floor of the opening, mapped to the illustration.
  const glass = PARTS[1].hole
  const glassPrimitive = new Primitive(true)
  for (const point of [[glass.x0, glass.y1], [glass.x1, glass.y1], [glass.x1, glass.y0], [glass.x0, glass.y0]]) { const [x, y] = world(point); const [u, v] = uv(point); glassPrimitive.vertex(x, y, Z.glass, u, v) }
  glassPrimitive.indices.push(0, 1, 2, 0, 2, 3)

  const table = buildTable()
  const wall = buildStudioBackdrop()

  const finish = (primitive, material) => ({ material, positions: Float32Array.from(primitive.positions), ...(primitive.normals ? { normals: Float32Array.from(primitive.normals) } : {}), ...(primitive.textured ? { uvs: Float32Array.from(primitive.uvs) } : {}), indices: Uint32Array.from(primitive.indices) })
  const club = buildOpenDecksClub()
  return {
    meshes: [
      { name: 'cdj', primitives: [finish(tops, 'panel'), finish(sides, 'sides')] },
      { name: 'screen', primitives: [finish(glassPrimitive, 'glass')] },
      { name: 'table', primitives: [finish(table.wood, 'wood'), finish(table.edges, 'wood-edge'), finish(table.grain, 'wood-grain')] },
      { name: 'backdrop', primitives: [finish(wall, 'wall')] },
      ...club,
    ],
    stats: {
      parts: PARTS.length, scale, width: options.width, height: (chassis.y1 - PARTS[1].shape.y0) * scale, depth: Math.max(...PARTS.map(part => part.top)),
      triangles: (tops.indices.length + sides.indices.length + glassPrimitive.indices.length + wall.indices.length + table.wood.indices.length + table.edges.indices.length + table.grain.indices.length) / 3 + club.reduce((sum, mesh) => sum + mesh.primitives.reduce((total, primitive) => total + primitive.indices.length / 3, 0), 0),
    },
  }
}

// ── The illustration ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The reference illustration as JPEG bytes, enlarged to the asset limit (2048 px wide) with a high-quality resample and a light sharpen. The illustration is only
 * 1086 px wide and is shown larger than that, so the graphics card would otherwise stretch each texel with plain bilinear filtering; enlarging it here with a
 * better filter keeps edges and text crisper. It adds no detail the illustration does not have.
 */
export async function illustrationJpeg(options = OPTIONS) {
  const { default: sharp } = await import('sharp')
  const image = sharp(SOURCE_PATH)
  const { width, height } = await image.metadata()
  if (width !== PHOTO.width || height !== PHOTO.height) throw new Error(`The reference illustration must be ${PHOTO.width} x ${PHOTO.height} (the part measurements were taken on it); it is ${width} x ${height}.`)
  const outputWidth = options.textureWidth
  return image
    .resize({ width: outputWidth, height: Math.round(outputWidth * height / width), kernel: 'lanczos3' })
    .sharpen({ sigma: 0.8, m1: 0.6, m2: 1.2 })
    .jpeg({ quality: options.jpegQuality, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer()
}

// ── Writing the GLB ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const srgbToLinear = channel => { const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
export const hexToRgb = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16))
const linearColor = hex => [...hexToRgb(hex).map(srgbToLinear), 1]

/** Matte illustration fronts retain the supplied ink, cream and gold palette. */
export function materialsOf(options = OPTIONS) {
  return {
    ...CLUB_MATERIALS,
    panel: { name: 'open-decks-panel', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, baseColorFactor: [.25, .25, .25, 1], metallicFactor: 0, roughnessFactor: 1 }, emissiveTexture: { index: 0 }, emissiveFactor: [.65, .65, .65], extensions: { KHR_materials_specular: { specularFactor: .015 } } },
    sides: { name: 'open-decks-sides', pbrMetallicRoughness: { baseColorFactor: linearColor('#302719'), metallicFactor: 0, roughnessFactor: 1 } },
    glass: { name: 'open-decks-glass', pbrMetallicRoughness: { baseColorFactor: [0, 0, 0, 1], metallicFactor: 0, roughnessFactor: 1 }, emissiveTexture: { index: 0 }, emissiveFactor: [1, 1, 1], extensions: { KHR_materials_specular: { specularFactor: 0 } } },
    wood: { name: 'open-decks-wood', pbrMetallicRoughness: { baseColorFactor: linearColor('#704222'), metallicFactor: 0, roughnessFactor: 1 } },
    'wood-edge': { name: 'open-decks-wood-edge', pbrMetallicRoughness: { baseColorFactor: linearColor('#3c2313'), metallicFactor: 0, roughnessFactor: 1 } },
    'wood-grain': { name: 'open-decks-wood-grain', pbrMetallicRoughness: { baseColorFactor: linearColor('#462611'), metallicFactor: 0, roughnessFactor: 1 } },
    wall: { name: 'open-decks-wall', pbrMetallicRoughness: { baseColorFactor: linearColor(options.wall.color), metallicFactor: 0, roughnessFactor: 1 } },
  }
}

/**
 * A GLB: each mesh is a node, each primitive uses one named material. Positions are 16-bit normalised against the mesh's bounds
 * (KHR_mesh_quantization) and placed by the node; texture coordinates are 16-bit normalised.
 * @param meshes  [{ name, primitives: [{ material, positions, uvs?, indices }] }]
 * @param jpeg    the illustration, embedded once
 */
export function writeGlb(meshes, jpeg, name = 'open-decks', options = OPTIONS) {
  const materialTable = materialsOf(options)
  const pad = buffer => Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4)])
  const chunks = [], accessors = [], bufferViews = [], nodes = [], gltfMeshes = [], materials = [], materialIndex = new Map()
  let offset = 0
  const add = (buffer, extra = {}) => {
    chunks.push(pad(buffer))
    const view = bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buffer.length, ...extra }) - 1
    offset += pad(buffer).length
    return view
  }
  const imageView = add(jpeg)
  const useMaterial = key => {
    if (!materialIndex.has(key)) { materialIndex.set(key, materials.length); materials.push(materialTable[key]) }
    return materialIndex.get(key)
  }
  meshes.forEach((mesh, meshIndex) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (const { positions } of mesh.primitives) for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k += 1) { min[k] = Math.min(min[k], positions[i + k]); max[k] = Math.max(max[k], positions[i + k]) }
    const center = min.map((v, k) => (v + max[k]) / 2), half = min.map((v, k) => Math.max((max[k] - v) / 2, 1e-6))
    const primitives = mesh.primitives.map(primitive => {
      const count = primitive.positions.length / 3
      const quantised = new Int16Array(count * 4) // x y z + padding so each vertex is 8 bytes
      for (let i = 0; i < count; i += 1) for (let k = 0; k < 3; k += 1) quantised[i * 4 + k] = Math.round(((primitive.positions[i * 3 + k] - center[k]) / half[k]) * 32767)
      const big = count > 65535
      const indexBytes = big ? Buffer.from(primitive.indices.buffer) : Buffer.from(Uint16Array.from(primitive.indices).buffer)
      const indexAccessor = accessors.push({ bufferView: add(indexBytes, { target: 34963 }), componentType: big ? 5125 : 5123, count: primitive.indices.length, type: 'SCALAR' }) - 1
      const attributes = {}
      attributes.POSITION = accessors.push({ bufferView: add(Buffer.from(quantised.buffer), { byteStride: 8, target: 34962 }), componentType: 5122, normalized: true, count, type: 'VEC3', min: [-1, -1, -1], max: [1, 1, 1] }) - 1
      if (primitive.normals) {
        // Positions are dequantized by the node's non-uniform scale. Precondition
        // normals so its inverse-transpose restores the authored smooth directions.
        const normals = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
          const values = [0,1,2].map(k => primitive.normals[i*3+k] * half[k])
          const length = Math.hypot(...values) || 1
          for (let k = 0; k < 3; k++) normals[i*3+k] = values[k] / length
        }
        attributes.NORMAL = accessors.push({ bufferView: add(Buffer.from(normals.buffer), { byteStride: 12, target: 34962 }), componentType: 5126, count, type: 'VEC3' }) - 1
      }
      if (primitive.uvs) {
        const packed = new Uint16Array(count * 2)
        for (let i = 0; i < packed.length; i += 1) packed[i] = Math.round(Math.min(1, Math.max(0, primitive.uvs[i])) * 65535)
        attributes.TEXCOORD_0 = accessors.push({ bufferView: add(Buffer.from(packed.buffer), { byteStride: 4, target: 34962 }), componentType: 5123, normalized: true, count, type: 'VEC2' }) - 1
      }
      return { attributes, indices: indexAccessor, material: useMaterial(primitive.material) }
    })
    gltfMeshes.push({ name: mesh.name, primitives })
    nodes.push({ name: mesh.name, mesh: meshIndex, translation: center, scale: half, ...(mesh.extras ? { extras: mesh.extras } : {}) })
  })
  const json = {
    asset: { version: '2.0', generator: 'DRMVYZ scripts/cinema2-assets/generate-open-decks.mjs' },
    extensionsUsed: ['KHR_mesh_quantization', 'KHR_materials_specular'], extensionsRequired: ['KHR_mesh_quantization'],
    scene: 0, scenes: [{ name, nodes: nodes.map((_, i) => i) }],
    nodes, meshes: gltfMeshes, materials, accessors, bufferViews,
    images: [{ bufferView: imageView, mimeType: 'image/jpeg', name: 'open-decks-illustration' }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    textures: [{ source: 0, sampler: 0 }],
    buffers: [{ byteLength: offset }],
  }
  const jsonBytes = Buffer.from(JSON.stringify(json))
  const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)])
  const binaryChunk = Buffer.concat(chunks)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binaryChunk.length, 8)
  const chunkHeader = (length, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(length, 0); b.writeUInt32LE(type, 4); return b }
  return Buffer.concat([header, chunkHeader(jsonChunk.length, 0x4e4f534a), jsonChunk, chunkHeader(binaryChunk.length, 0x004e4942), binaryChunk])
}

// ── Running ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const output = resolve(process.argv.slice(2).find(argument => !argument.startsWith('--')) ?? DEFAULT_OUTPUT)
  const model = buildModel()
  const raw = writeGlb(model.meshes, await illustrationJpeg())
  // The shared asset tools compress it (meshopt) and check the result against the raw file.
  const { readAsset } = await import('./asset-tools/io.mjs')
  const { optimizeAsset } = await import('./asset-tools/optimize.mjs')
  const scratch = `${output}.raw.glb`
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(scratch, raw)
  const [high] = await optimizeAsset(await readAsset(scratch), { tiers: ['high'], geometry: 'meshopt' })
  rmSync(scratch)
  if (!high.ok) throw new Error(`Optimising failed: ${high.failures.join('; ')}`)
  writeFileSync(output, high.bytes)
  console.log(JSON.stringify({ output, rawBytes: raw.length, bytes: high.bytes.length, ...model.stats }, null, 1))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
