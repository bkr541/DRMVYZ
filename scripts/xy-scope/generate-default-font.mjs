// Bakes the default Sound Drawing (XY Scope) font into a checked-in outline table.
// Anton Regular is vendored under the SIL Open Font License 1.1 (see public/cinema2/licenses/Anton-OFL-1.1.txt),
// the same source SAY IT and NIGHTSHIFT already use. The runtime never fetches or parses a font for the
// default: it flattens these path commands, exactly as it flattens a user font's outlines.
//
//   node scripts/xy-scope/generate-default-font.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import opentype from 'opentype.js'

const root = resolve(import.meta.dirname, '../..')
const bytes = readFileSync(resolve(root, 'scripts/cinema2-assets/sources/anton/Anton-Regular.ttf'))
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))

const SIZE = 1000 // outline units per em
const round = (value) => Math.round(value)
const glyphs = {}

for (let code = 0x20; code <= 0x7e; code += 1) {
  const character = String.fromCharCode(code)
  const glyph = font.charToGlyph(character)
  if (!glyph || (glyph.index === 0 && character !== ' ')) continue
  const ops = []
  const pts = []
  for (const command of glyph.getPath(0, 0, SIZE).commands) {
    ops.push(command.type)
    if (command.type === 'M' || command.type === 'L') pts.push(round(command.x), round(command.y))
    else if (command.type === 'Q') pts.push(round(command.x1), round(command.y1), round(command.x), round(command.y))
    else if (command.type === 'C') pts.push(round(command.x1), round(command.y1), round(command.x2), round(command.y2), round(command.x), round(command.y))
  }
  glyphs[character] = { adv: round(glyph.advanceWidth * SIZE / font.unitsPerEm), ops: ops.join(''), pts }
}

const capBox = font.charToGlyph('H').getPath(0, 0, SIZE).getBoundingBox()
const output = {
  font: 'Anton Regular (OFL-1.1)',
  source: 'scripts/cinema2-assets/sources/anton/Anton-Regular.ttf',
  generator: 'scripts/xy-scope/generate-default-font.mjs',
  unitsPerEm: SIZE,
  capHeight: round(capBox.y2 - capBox.y1),
  glyphs,
}
const target = resolve(root, 'src/components/vyzualz/react/xyScope/XyScopeDefaultFont.generated.json')
writeFileSync(target, JSON.stringify(output) + '\n')
console.log(`Wrote ${Object.keys(glyphs).length} glyphs, cap height ${output.capHeight}, ${(JSON.stringify(output).length / 1024).toFixed(1)} KB -> ${target}`)
