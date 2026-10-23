// Fixed NIGHTSHIFT outline contours. Anton is vendored under OFL-1.1, as in SAY IT.
// The runtime sweeps circular glass tubes along these outlines, as in Backstreet.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import opentype from 'opentype.js'
import * as THREE from 'three'

const root = resolve(import.meta.dirname, '../..')
const bytes = readFileSync(resolve(root, 'scripts/cinema2-assets/sources/anton/Anton-Regular.ttf'))
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
const text = 'NIGHTSHIFT', glyphs = []
let cursor = 0
for (const character of text) {
  const glyph = font.charToGlyph(character), path = new THREE.ShapePath()
  for (const c of glyph.getPath(cursor, 0, 2).commands) {
    if (c.type === 'M') path.moveTo(c.x, -c.y)
    else if (c.type === 'L') path.lineTo(c.x, -c.y)
    else if (c.type === 'Q') path.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y)
    else if (c.type === 'C') path.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y)
    else if (c.type === 'Z') path.currentPath.closePath()
  }
  const contours = path.subPaths.map(p => {
    const points = p.getSpacedPoints(Math.max(24, Math.ceil(p.getLength() * 40)))
    if (points[0].distanceToSquared(points.at(-1)) < 1e-8) points.pop()
    return points.map(p => [p.x, p.y])
  })
  glyphs.push({ character, contours })
  cursor += glyph.advanceWidth / font.unitsPerEm * 2 + .14
}
const points = glyphs.flatMap(g => g.contours.flat())
const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]))
const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]))
const scale = 9.2 / (maxX - minX)
for (const glyph of glyphs) for (const contour of glyph.contours) for (const p of contour) {
  p[0] = Number(((p[0] - (minX + maxX) / 2) * scale).toFixed(5))
  p[1] = Number(((p[1] - (minY + maxY) / 2) * scale).toFixed(5))
}
writeFileSync(resolve(root, 'src/components/vyzualz/cinema2/modules/nightshift/Cinema2NightshiftSign.generated.json'),
  JSON.stringify({ text, font: 'Anton Regular (OFL-1.1)', width: 9.2, height: (maxY - minY) * scale, glyphs }) + '\n')
