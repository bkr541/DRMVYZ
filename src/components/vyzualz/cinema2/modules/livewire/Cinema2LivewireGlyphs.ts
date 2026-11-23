import type { BufferGeometry } from 'three'
import type { Cinema2GlyphMetrics } from '../sayIt/Cinema2SayItTextLayout'
import { measureObject, type Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import { describeCinema2LoadedModel } from '../three/Cinema2ThreeAssetMetadata'
import { livewireGlyphShapes, livewireShapeContains, type LivewireStroke } from './Cinema2LivewireContours'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'

// Original stroke alphabet. Each pair is a grid point. Slashes start a new stroke.
const alphabet: Readonly<Record<string, string>> = {
  A: '00 06 28 68 86 80/04 84', B: '00 08 68 87 85 74 04/74 83 81 60 00',
  C: '86 68 28 06 02 20 60 82', D: '00 08 58 86 82 50 00',
  E: '88 08 00 80/04 64', F: '88 08 00/04 64',
  G: '87 68 28 06 02 20 60 82 84 54', H: '00 08/04 84/80 88',
  I: '28 68/48 40/20 60', J: '28 88 82 60 20 02', K: '00 08/88 04 80',
  L: '08 00 80', M: '00 08 44 88 80', N: '00 08 80 88',
  O: '20 02 06 28 68 86 82 60 20', P: '00 08 68 87 85 64 04',
  Q: '20 02 06 28 68 86 82 60 20/53 81', R: '00 08 68 86 64 04/44 80',
  S: '87 68 28 06 05 24 64 83 82 60 20 01', T: '08 88/48 40',
  U: '08 02 20 60 82 88', V: '08 40 88', W: '08 10 44 70 88', X: '08 80/00 88',
  Y: '08 44 88/44 40', Z: '08 88 00 80',
  0: '20 02 06 28 68 86 82 60 20/23 65', 1: '26 48 40/20 60',
  2: '06 28 68 86 85 03 00 80', 3: '08 88 64 83 81 60 20 01/44 64',
  4: '58 04 84/68 60', 5: '88 08 04 64 83 81 60 20 01',
  6: '86 68 28 06 02 20 60 82 83 64 04', 7: '08 88 40',
  8: '24 05 06 28 68 86 85 64 24 03 02 20 60 82 83 64',
  9: '82 60 20 01/84 24 05 06 28 68 86 82',
  '!': '42 48/40 41', '"': '26 28/66 68', '#': '10 38/50 78/03 83/05 85',
  '$': '87 68 28 06 05 24 64 83 82 60 20 01/40 48',
  '%': '00 88/16 17/71 72', '&': '80 05 06 28 58 66 65 03 02 20 50 83',
  "'": '46 48', '(': '68 36 32 60', ')': '28 56 52 20', '*': '41 47/14 74/22 66/26 62',
  '+': '14 74/41 47', ',': '31 42', '-': '24 64', '.': '40 41', '/': '00 88',
  ':': '42 43/46 47', ';': '31 42/46 47', '<': '67 24 61', '=': '23 63/25 65', '>': '27 64 21',
  '?': '06 28 68 86 85 43/40 41', '@': '80 20 02 06 28 68 86 83 63 65 35 33 63',
  '[': '68 28 20 60', '\\': '08 80', ']': '28 68 60 20', '^': '05 48 85', '_': '00 80',
  '`': '37 48', '{': '68 47 45 24 43 41 60', '|': '40 48', '}': '28 47 45 64 43 41 20', '~': '03 25 63 85',
}
// The static Trace look starts with the strongest silhouette edge of each letter.
const primaryBars: Readonly<Record<string, number>> = {
  A: 1, B: 1, C: 1, D: 1, E: 0, F: 0, G: 5, H: 1, I: 0, J: 1, K: 1, L: 0, M: 3,
  N: 1, O: 3, P: 1, Q: 4, R: 1, S: 1, T: 0, U: 6, V: 1, W: 2, X: 0, Y: 1, Z: 1,
}
const xUnit = 0.205
const yUnit = 0.207
const bodyRadius = 0.236
const faceRadius = 0.195
export const LIVEWIRE_LED_HEIGHT = 8 * yUnit
export const LIVEWIRE_MAX_BARS = 16

type Three = Cinema2ThreeLibrary['THREE']

function chamferedOutline(THREE: Three, length: number, breadth: number, chamfer: number) {
  const x = length / 2
  const y = breadth / 2
  return [[-x + chamfer, -y], [x - chamfer, -y], [x, -y + chamfer], [x, y - chamfer],
    [x - chamfer, y], [-x + chamfer, y], [-x, y - chamfer], [-x, -y + chamfer]]
    .map(([a, b]) => new THREE.Vector2(a, b))
}

function extrude(THREE: Three, shape: InstanceType<Three['Shape']>, depth: number, bevel: number, segments = 2) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: segments, bevelThickness: bevel, bevelSize: bevel })
}

function segments(strokes: string) {
  const output = []
  for (const path of strokes.split('/')) {
    const points = path.split(' ').map(point => [Number(point[0]) * xUnit, Number(point[1]) * yUnit] as const)
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1]!
      const [x1, y1] = points[i]!
      output.push({ start: [x0, y0] as const, end: [x1, y1] as const, x: (x0 + x1) / 2, y: (y0 + y1) / 2, length: Math.hypot(x1 - x0, y1 - y0), angle: Math.atan2(y1 - y0, x1 - x0) })
    }
  }
  return output
}


const shapes = new Map<string, { paths: ReturnType<typeof segments>; centerX: number; centerY: number }>()
const glyphs: Cinema2GlyphMetrics['glyphs'] = {
  32: { mesh: null, advance: 0.74, centerX: 0, centerY: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 },
}
for (let code = 33; code <= 126; code++) {
  const character = String.fromCharCode(code).toUpperCase()
  if (code >= 97 && code <= 122) {
    glyphs[code] = glyphs[character.charCodeAt(0)]!
    continue
  }
  const paths = segments(alphabet[character]!)
  const minX = Math.min(...paths.map(p => p.x - Math.abs(Math.cos(p.angle)) * p.length / 2)) - bodyRadius - 0.036
  const maxX = Math.max(...paths.map(p => p.x + Math.abs(Math.cos(p.angle)) * p.length / 2)) + bodyRadius + 0.036
  const minY = Math.min(...paths.map(p => p.y - Math.abs(Math.sin(p.angle)) * p.length / 2)) - bodyRadius - 0.036
  const maxY = Math.max(...paths.map(p => p.y + Math.abs(Math.sin(p.angle)) * p.length / 2)) + bodyRadius + 0.036
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const mesh = `livewire-${code.toString(16)}`
  const lead = primaryBars[character] ?? 0
  const ordered = paths[lead] && lead !== 0 ? [paths[lead]!, ...paths.filter((_, index) => index !== lead)] : paths
  shapes.set(mesh, { paths: ordered, centerX, centerY })
  glyphs[code] = { mesh, advance: maxX - minX + 0.036, centerX: (maxX - minX) / 2, centerY, minX: 0, minY, maxX: maxX - minX, maxY }
}

export const LIVEWIRE_GLYPH_MESHES: ReadonlySet<string> = new Set(shapes.keys())
export const LIVEWIRE_GLYPH_METRICS: Readonly<Cinema2GlyphMetrics> = {
  version: 1, repertoire: { firstCodePoint: 32, lastCodePoint: 126, fallbackCodePoint: 63 },
  font: { family: 'LIVEWIRE', lineAdvance: 2.65 }, glyphs, kerning: {},
}

function distanceBetweenStrokes(a: LivewireStroke, b: LivewireStroke): number {
  const pointToSegment = ([x, y]: readonly [number, number], { start, end }: LivewireStroke) => {
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const projection = ((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy)
    const t = Math.max(0, Math.min(1, projection))
    return Math.hypot(x - start[0] - dx * t, y - start[1] - dy * t)
  }
  const side = ({ start, end }: LivewireStroke, point: readonly [number, number]) =>
    (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0])
  if (side(a, b.start) * side(a, b.end) < 0 && side(b, a.start) * side(b, a.end) < 0) return 0
  return Math.min(pointToSegment(a.start, b), pointToSegment(a.end, b), pointToSegment(b.start, a), pointToSegment(b.end, a))
}

export async function buildLivewireGlyphAsset(library: Cinema2ThreeLibrary, id: string): Promise<Cinema2ThreeLoadedAsset> {
  const { THREE } = library
  const { mergeGeometries, mergeVertices, toCreasedNormals } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')
  const scene = new THREE.Group()
  const metalMaterial = new THREE.MeshStandardMaterial({ metalness: 0.78, roughness: 0.35 })
  const ledMaterial = new THREE.MeshStandardMaterial({ roughness: 0.32 })
  const addMesh = (name: string, parts: BufferGeometry[], material: typeof metalMaterial) => {
    const merged = mergeGeometries(parts)!
    const creased = toCreasedNormals(merged, Math.PI / 5)
    const geometry = mergeVertices(creased, 1e-5)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    scene.add(mesh)
    merged.dispose()
    if (creased !== merged) creased.dispose()
    parts.forEach(part => part.dispose())
    return geometry
  }
  for (const [name, { paths, centerX, centerY }] of shapes) {
    const metal: BufferGeometry[] = []
    const leds: BufferGeometry[] = []
    const lampStrokes: LivewireStroke[] = []
    const center = (geometry: BufferGeometry) => geometry.translate(-centerX, -centerY, 0)
    const plates = livewireGlyphShapes(THREE, paths, faceRadius)
    for (const { x, y, length, angle } of paths) {
      const insetLength = Math.max(0.055, length - 0.22)
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      const inset = 0.072
      const lampX = x - dy * inset
      const lampY = y + dx * inset
      const half = insetLength / 2
      const lamp: LivewireStroke = {
        start: [lampX - half * dx, lampY - half * dy],
        end: [lampX + half * dx, lampY + half * dy],
      }
      // Leave a solid bridge between the recesses where strokes join or cross.
      if (lampStrokes.some(other => distanceBetweenStrokes(lamp, other) < 0.138)) continue
      const channel = chamferedOutline(THREE, insetLength + 0.044, 0.093, 0.022)
        .map(point => point.rotateAround(new THREE.Vector2(), angle).add(new THREE.Vector2(lampX, lampY)))
      const plate = plates.find(candidate => channel.every(point => livewireShapeContains(candidate, point)))
      if (!plate) continue
      plate.holes.push(new THREE.Path(channel))

      const core = extrude(THREE, new THREE.Shape(chamferedOutline(THREE, insetLength, 0.034, 0.013)), 0.009, 0.004, 1)
      for (let vertex = 0; vertex < core.attributes.uv.count; vertex++) {
        core.attributes.uv.setXY(vertex, lampStrokes.length, lampY / LIVEWIRE_LED_HEIGHT - centerY / LIVEWIRE_LED_HEIGHT + 0.5)
      }
      leds.push(center(core.rotateZ(angle).translate(lampX, lampY, 0.226)))
      lampStrokes.push(lamp)
    }
    for (const hull of livewireGlyphShapes(THREE, paths, bodyRadius)) metal.push(center(extrude(THREE, hull, 0.36, 0.036).translate(0, 0, -0.24)))
    for (const shoulder of livewireGlyphShapes(THREE, paths, bodyRadius - 0.018)) metal.push(center(extrude(THREE, shoulder, 0.09, 0.019).translate(0, 0, 0.10)))
    for (const plate of plates) metal.push(center(extrude(THREE, plate, 0.093, 0.012).translate(0, 0, 0.183)))

    const body = addMesh(name, metal, metalMaterial)
    // Local endpoints feed the metal's reflected LED light and channel detail.
    body.userData.livewireBars = lampStrokes.map(({ start, end }) =>
      [start[0] - centerX, start[1] - centerY, end[0] - centerX, end[1] - centerY])
    if (leds.length === 0) throw new Error(`LIVEWIRE glyph ${name} has no recesses.`)
    addMesh(`${name}-led`, leds, ledMaterial)
  }
  const { bytes, triangles } = measureObject(scene)
  return { id, scene, gpuBytes: bytes, triangleCount: triangles, animations: [], metadata: describeCinema2LoadedModel(scene) }
}
