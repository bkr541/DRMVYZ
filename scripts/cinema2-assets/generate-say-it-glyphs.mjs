// Production printable-Basic-Latin glyph package for Cinema 2.0 SAY IT.
// The source font is Anton Regular, vendored with its SIL Open Font License.
// Each non-space code point becomes one centered, bevelled GLB mesh. A separate
// generated metrics file keeps layout, kerning and mesh lookup deterministic.
//
//   node scripts/cinema2-assets/generate-say-it-glyphs.mjs [out.glb] [out.metrics.json]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import * as THREE from 'three'
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : join(root, 'public/cinema2/models/say-it-glyphs-v1.glb')
const metricsPath = process.argv[3]
  ? resolve(process.argv[3])
  : join(root, 'src/components/vyzualz/cinema2/modules/sayIt/Cinema2SayItGlyphMetrics.generated.json')
const fontPath = join(root, 'scripts/cinema2-assets/sources/anton/Anton-Regular.ttf')

const FIRST_CODE_POINT = 0x20
const LAST_CODE_POINT = 0x7e
const FALLBACK_CODE_POINT = 0x3f
const FONT_SIZE = 2
const DEPTH = 0.3
const BEVEL = 0.045
const CREASE_ANGLE = (36 * Math.PI) / 180

const MATERIALS = {
  chrome: { baseColorFactor: [0.78, 0.8, 0.84, 1], metallicFactor: 1, roughnessFactor: 0.17 },
}

const fontBytes = readFileSync(fontPath)
const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength))
const scale = FONT_SIZE / font.unitsPerEm

function meshName(codePoint) {
  return `glyph-u${codePoint.toString(16).padStart(4, '0').toUpperCase()}`
}

function shapePathForGlyph(glyph) {
  const result = new THREE.ShapePath()
  const path = glyph.getPath(0, 0, FONT_SIZE)
  for (const command of path.commands) {
    switch (command.type) {
      case 'M': result.moveTo(command.x, -command.y); break
      case 'L': result.lineTo(command.x, -command.y); break
      case 'Q': result.quadraticCurveTo(command.x1, -command.y1, command.x, -command.y); break
      case 'C': result.bezierCurveTo(command.x1, -command.y1, command.x2, -command.y2, command.x, -command.y); break
      case 'Z': result.currentPath?.closePath(); break
    }
  }
  return result
}

function buildGlyph(codePoint) {
  const glyph = font.charToGlyph(String.fromCodePoint(codePoint))
  const shapes = shapePathForGlyph(glyph).toShapes(false)
  if (shapes.length === 0) throw new Error(`U+${codePoint.toString(16).padStart(4, '0')} has no drawable outline.`)
  let geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: DEPTH - BEVEL * 2,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelOffset: -BEVEL,
    bevelSegments: 2,
    curveSegments: 5,
  })
  geometry.deleteAttribute('uv')
  geometry.translate(0, 0, -DEPTH / 2 + BEVEL)
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (!bounds) throw new Error(`U+${codePoint.toString(16)} did not produce geometry bounds.`)
  const centerX = (bounds.min.x + bounds.max.x) / 2
  const centerY = (bounds.min.y + bounds.max.y) / 2
  const metric = {
    mesh: meshName(codePoint),
    advance: Number(((glyph.advanceWidth ?? font.unitsPerEm) * scale).toFixed(6)),
    centerX: Number(centerX.toFixed(6)),
    centerY: Number(centerY.toFixed(6)),
    minX: Number(bounds.min.x.toFixed(6)),
    minY: Number(bounds.min.y.toFixed(6)),
    maxX: Number(bounds.max.x.toFixed(6)),
    maxY: Number(bounds.max.y.toFixed(6)),
  }
  geometry.translate(-centerX, -centerY, 0)
  geometry = toCreasedNormals(geometry, CREASE_ANGLE)
  geometry = mergeVertices(geometry, 1e-5)
  const positions = new Float32Array(geometry.getAttribute('position').array)
  const normals = new Float32Array(geometry.getAttribute('normal').array)
  const indices = new Uint32Array(geometry.getIndex().array)
  const phases = new Float32Array(positions.length / 3)
  geometry.dispose()
  return {
    metric,
    mesh: { name: metric.mesh, part: 'chrome', positions, normals, indices, phases },
  }
}

const glyphMetrics = {}
const meshes = []
for (let codePoint = FIRST_CODE_POINT; codePoint <= LAST_CODE_POINT; codePoint += 1) {
  const glyph = font.charToGlyph(String.fromCodePoint(codePoint))
  const advance = Number(((glyph.advanceWidth ?? font.unitsPerEm) * scale).toFixed(6))
  if (codePoint === FIRST_CODE_POINT) {
    glyphMetrics[String(codePoint)] = { mesh: null, advance, centerX: 0, centerY: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 }
    continue
  }
  const built = buildGlyph(codePoint)
  glyphMetrics[String(codePoint)] = built.metric
  meshes.push(built.mesh)
}

const kerning = {}
for (let left = FIRST_CODE_POINT; left <= LAST_CODE_POINT; left += 1) {
  const leftGlyph = font.charToGlyph(String.fromCodePoint(left))
  for (let right = FIRST_CODE_POINT; right <= LAST_CODE_POINT; right += 1) {
    const value = font.getKerningValue(leftGlyph, font.charToGlyph(String.fromCodePoint(right))) * scale
    if (Math.abs(value) >= 1e-6) kerning[`${left}:${right}`] = Number(value.toFixed(6))
  }
}

mkdirSync(dirname(outputPath), { recursive: true })
mkdirSync(dirname(metricsPath), { recursive: true })
const result = writeGlb(
  outputPath,
  meshes,
  MATERIALS,
  'DRMVYZ scripts/cinema2-assets/generate-say-it-glyphs.mjs (Anton Regular, OFL-1.1)',
  'say-it-glyphs-v1',
)
const metrics = {
  version: 1,
  repertoire: { firstCodePoint: FIRST_CODE_POINT, lastCodePoint: LAST_CODE_POINT, fallbackCodePoint: FALLBACK_CODE_POINT },
  font: {
    family: 'Anton',
    source: 'scripts/cinema2-assets/sources/anton/Anton-Regular.ttf',
    license: 'OFL-1.1',
    unitsPerEm: font.unitsPerEm,
    fontSize: FONT_SIZE,
    ascender: Number((font.ascender * scale).toFixed(6)),
    descender: Number((font.descender * scale).toFixed(6)),
    lineAdvance: Number(((font.ascender - font.descender) * scale).toFixed(6)),
  },
  glyphs: glyphMetrics,
  kerning,
}
writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`)

console.log(`Wrote ${outputPath}`)
console.log(`Wrote ${metricsPath}`)
console.log(`  ${meshes.length} drawable glyphs + space, ${Object.keys(kerning).length} kerning pairs`)
console.log(`  total ${result.triangles} triangles, ${(result.byteLength / 1024).toFixed(0)} KB`)
