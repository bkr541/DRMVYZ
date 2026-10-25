// Static audit: every text-like field element in src/ must receive the shared field-value typography role.
// An element is covered by (a) carrying a class from the role's selector list in src/styles/typography.css, or
// (b) the role's native-element safety net (any non-exempt <input>/<textarea>/<select>). The only way out is an
// explicit .type-exempt class, and each exemption must be on the allow-list below.
// Run: node scripts/audit-text-inputs.mjs   (add --json to print the rendered-audit fixture list)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const root = new URL('../', import.meta.url).pathname
const NON_TEXT_TYPES = new Set(['checkbox', 'radio', 'range', 'file', 'color', 'hidden', 'button', 'submit', 'reset', 'image'])

const css = readFileSync(join(root, 'src/styles/typography.css'), 'utf8')
const roleBlock = css.match(/:root body \[class\]:is\(\s*([\s\S]*?)\) \{\s*font: var\(--type-field-value\)/)?.[1] ?? ''
const roleClasses = new Set([...roleBlock.matchAll(/\.([\w-]+)/g)].map(match => match[1]))
if (roleClasses.size < 5) throw new Error('Could not read the field-value role selectors from typography.css')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { if (name !== 'node_modules') walk(path, out) } else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(path)
  }
  return out
}

function classText(attr) {
  if (!attr?.initializer) return ''
  const init = attr.initializer
  if (ts.isStringLiteral(init)) return init.text
  let text = ''
  const visit = node => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text += ` ${node.text}`
    ts.forEachChild(node, visit)
  }
  visit(init)
  return text
}

const EXEMPT_ALLOWED = new Map([
  ['src/components/vyzualz/react/shaders/editor/ShaderCodeEditor.tsx', 'code editor (monospace code face)'],
  ['src/components/vyzualz/shared/VyzualzAudioDock.tsx', 'BPM readout editor (edits the large display value in place)'],
])
const netRule = /:root body :is\(input, textarea, select\):not\([^)]*\.type-exempt\s*\)\s*\{\s*font: var\(--type-field-value\) !important;/
const safetyNet = netRule.test(css)

const findings = []
const rows = []
let total = 0
for (const file of walk(join(root, 'src'))) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(source)
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        const attrs = new Map(node.attributes.properties.filter(ts.isJsxAttribute).map(attr => [attr.name.getText(source), attr]))
        const type = attrs.get('type')?.initializer && ts.isStringLiteral(attrs.get('type').initializer) ? attrs.get('type').initializer.text : null
        if (!(tag === 'input' && type && NON_TEXT_TYPES.has(type))) {
          total += 1
          const classes = classText(attrs.get('className')).split(/\s+/).filter(Boolean)
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
          const where = `${relative(root, file)}:${line}`
          const exempt = classes.includes('type-exempt')
          const via = exempt ? 'exempt' : classes.some(name => roleClasses.has(name)) ? 'role class' : safetyNet ? 'safety net' : 'UNCOVERED'
          rows.push({ where, tag, type: type ?? (attrs.has('type') ? '(dynamic)' : 'text'), classes: classes.join(' ') || '(none)', via })
          if (via === 'UNCOVERED') findings.push({ where, reason: 'no role class and the typography.css safety net is missing' })
          if (exempt && !EXEMPT_ALLOWED.has(relative(root, file))) findings.push({ where, reason: 'type-exempt is not on the allow-list' })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

if (process.argv.includes('--json')) {
  const fixtures = new Map()
  for (const row of rows) if (row.via !== 'exempt') fixtures.set(`${row.tag}|${row.type}|${row.classes === '(none)' ? '' : row.classes}`, { tag: row.tag, type: row.type, className: row.classes === '(none)' ? '' : row.classes })
  console.log(JSON.stringify([...fixtures.values()]))
  process.exit(0)
}

const byVia = rows.reduce((counts, row) => ({ ...counts, [row.via]: (counts[row.via] ?? 0) + 1 }), {})
console.log(`Field-value role classes: ${[...roleClasses].join(', ')}`)
console.log(`Audited ${total} native text-like <input>/<textarea>/<select> elements (reusable components render the role classes themselves): ${Object.entries(byVia).map(([via, count]) => `${count} via ${via}`).join(', ')}.`)
for (const row of rows.filter(row => row.via !== 'role class')) console.log(`  ${row.via.padEnd(10)} ${row.where}  <${row.tag} type=${row.type}>  class="${row.classes}"`)
for (const [file, reason] of EXEMPT_ALLOWED) console.log(`  exemption  ${file}: ${reason}`)
for (const finding of findings) console.error(`FAIL ${finding.where}: ${finding.reason}`)
process.exitCode = findings.length === 0 ? 0 : 1
