#!/usr/bin/env node
// Cinema 2.0 model tooling.
//   npm run cinema2:asset:inspect  -- model.glb [--json]
//   npm run cinema2:asset:validate -- model.glb [--strict] [--json]
//   npm run cinema2:asset:optimize -- model.glb --out <folder> [--id <asset-id>] [--tiers high,medium,low] [--geometry meshopt|draco|none]
//                                      [--textures keep|webp|ktx2] [--simplify[=medium=0.65,low=0.4]] [--max-texture medium=1024,low=512]
//                                      [--force] [--keep-failed]
//   npm run cinema2:asset:report   -- model.glb [--out report.md] [--optimized <folder>]
// The source file is never modified, and output may not go into public/ or assets/ (copy results in by hand after reviewing the report).
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectDocument } from './inspect.mjs'
import { readAsset } from './io.mjs'
import { TIERS, optimizeAsset } from './optimize.mjs'
import { renderAssetReport } from './report.mjs'
import { validateFile } from './validate.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function parseArgs(argv) {
  const positional = []
  const flags = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) { positional.push(argument); continue }
    const [name, inline] = argument.slice(2).split(/=(.*)/s, 2)
    if (inline !== undefined) { flags.set(name, inline); continue }
    const next = argv[index + 1]
    if (next !== undefined && !next.startsWith('--') && !['json', 'strict', 'force', 'keep-failed', 'simplify'].includes(name)) { flags.set(name, next); index += 1 } else flags.set(name, true)
  }
  return { positional, flags }
}

function parseTierMap(text) {
  if (typeof text !== 'string' || text === '') return {}
  return Object.fromEntries(text.split(',').map(entry => { const [tier, value] = entry.split('='); return [tier.trim(), Number(value)] }))
}

/** True when `child` is `parent` or anywhere beneath it. */
function isInside(parent, child) {
  const relation = relative(parent, child)
  return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))
}

const fileMb = bytes => `${(bytes / 1048576).toFixed(2)} MB`

async function inspectPath(path) {
  const source = await readAsset(path)
  const fileBytes = (await stat(path)).size
  return { source, inspection: inspectDocument(source.document, { name: source.name, container: source.container, fileBytes }) }
}

function printInspection(inspection) {
  console.log(`${inspection.name} (${inspection.container}, ${fileMb(inspection.fileBytes)})`)
  console.log(`  triangles ${inspection.geometry.triangles.toLocaleString('en-US')} · vertices ${inspection.geometry.vertices.toLocaleString('en-US')} · primitives ${inspection.counts.primitives} · materials ${inspection.counts.materials} · textures ${inspection.counts.textures}`)
  console.log(`  animations ${inspection.counts.animations} · skins ${inspection.counts.skins} · geometry compression ${inspection.geometry.compression} · textures ${inspection.textures.formats.join(', ') || 'none'}`)
  console.log(`  custom attributes: ${inspection.geometry.customAttributes.join(', ') || 'none'}`)
  console.log(`  estimated GPU memory ${fileMb(inspection.memory.totalBytes)} (geometry ${fileMb(inspection.memory.geometryBytes)}, textures ${fileMb(inspection.memory.textureBytes)})`)
  console.log(`  extensions: ${inspection.extensions.used.join(', ') || 'none'}`)
  for (const issue of inspection.issues) console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`)
}

function requireFile(positional, command) {
  const path = positional[0]
  if (!path) { console.error(`usage: cinema2:asset:${command} -- <model.glb> [options]`); process.exit(2) }
  const absolute = resolve(process.cwd(), path)
  if (!existsSync(absolute)) { console.error(`cinema2:asset:${command}: "${path}" does not exist.`); process.exit(2) }
  return absolute
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const { positional, flags } = parseArgs(rest)

  if (command === 'inspect') {
    const { inspection } = await inspectPath(requireFile(positional, 'inspect'))
    if (flags.get('json')) console.log(JSON.stringify(inspection, null, 2)); else printInspection(inspection)
    process.exit(inspection.ok ? 0 : 1)
  }

  if (command === 'validate') {
    const path = requireFile(positional, 'validate')
    const validation = await validateFile(path)
    const { inspection } = await inspectPath(path)
    const strict = Boolean(flags.get('strict'))
    const engineErrors = inspection.issues.filter(issue => issue.severity === 'error' || (strict && issue.severity === 'warning'))
    const validatorFailed = validation.numErrors > 0 || (strict && validation.numWarnings > 0)
    if (flags.get('json')) console.log(JSON.stringify({ validation, engine: inspection.issues }, null, 2))
    else {
      console.log(`glTF Validator ${validation.validatorVersion}: ${validation.numErrors} error(s), ${validation.numWarnings} warning(s), ${validation.numInfos} info, ${validation.numHints} hint(s)`)
      for (const issue of validation.issues.filter(entry => entry.severity === 'error' || entry.severity === 'warning')) console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}${issue.pointer ? ` (${issue.pointer})` : ''}`)
      for (const issue of inspection.issues) console.log(`  [engine ${issue.severity}] ${issue.code}: ${issue.message}`)
      console.log(validatorFailed || engineErrors.length > 0 ? 'FAILED' : 'PASSED')
    }
    process.exit(validatorFailed || engineErrors.length > 0 ? 1 : 0)
  }

  if (command === 'optimize') {
    const path = requireFile(positional, 'optimize')
    const outArgument = flags.get('out')
    if (typeof outArgument !== 'string') { console.error('cinema2:asset:optimize needs --out <folder>. The source is never modified; results are written only there.'); process.exit(2) }
    const out = resolve(process.cwd(), outArgument)
    for (const protectedFolder of ['public', 'assets']) {
      if (isInside(join(root, protectedFolder), out)) {
        console.error(`cinema2:asset:optimize will not write into ${protectedFolder}/. Write to a scratch folder, review the report, then copy results in by hand.`)
        process.exit(2)
      }
    }
    const id = typeof flags.get('id') === 'string' ? flags.get('id') : basename(path).replace(/\.(glb|gltf)$/i, '')
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) { console.error(`--id must be lowercase letters, digits and dashes (got "${id}").`); process.exit(2) }
    const tiers = typeof flags.get('tiers') === 'string' ? flags.get('tiers').split(',') : [...TIERS]
    const geometry = typeof flags.get('geometry') === 'string' ? flags.get('geometry') : 'meshopt'
    const textures = typeof flags.get('textures') === 'string' ? flags.get('textures') : 'keep'
    const simplifyFlag = flags.get('simplify')
    const simplify = simplifyFlag === undefined ? false : simplifyFlag === true ? {} : parseTierMap(simplifyFlag)
    const maxTexture = parseTierMap(flags.get('max-texture'))
    const fileName = tier => (tier === 'high' ? `${id}.glb` : `${id}-${tier}.glb`)
    const targets = tiers.map(tier => join(out, fileName(tier)))
    if (targets.includes(path)) { console.error('The output would overwrite the source file.'); process.exit(2) }
    if (!flags.get('force')) {
      const existing = targets.filter(target => existsSync(target))
      if (existing.length > 0) { console.error(`These outputs already exist (use --force to replace them): ${existing.map(target => relative(process.cwd(), target)).join(', ')}`); process.exit(2) }
    }

    const source = await readAsset(path)
    const sourceBytes = (await stat(path)).size
    const original = inspectDocument(source.document, { name: source.name, container: source.container, fileBytes: sourceBytes })
    if (!original.ok) {
      console.error('The source model has errors; fix them before optimizing:')
      for (const issue of original.issues.filter(entry => entry.severity === 'error')) console.error(`  ${issue.code}: ${issue.message}`)
      process.exit(1)
    }
    const results = await optimizeAsset(source, { tiers, geometry, textures, simplify, maxTexture })
    await mkdir(out, { recursive: true })
    const summary = { geometry, textures, simplify: Boolean(simplify), tiers: [] }
    let failed = false
    for (const result of results) {
      const file = fileName(result.tier)
      const write = result.ok || flags.get('keep-failed')
      if (write) await writeFile(join(out, file), result.bytes)
      if (!result.ok) failed = true
      summary.tiers.push({
        tier: result.tier, ok: result.ok, file: write ? file : null, fileBytes: result.bytes.byteLength, triangles: result.inspection.geometry.triangles,
        gpuBytes: result.inspection.memory.totalBytes, notes: result.notes, failures: result.failures,
      })
      console.log(`${result.tier.padEnd(6)} ${result.ok ? 'ok    ' : 'FAILED'} ${write ? file : '(not written)'} · ${fileMb(result.bytes.byteLength)} · ${result.inspection.geometry.triangles.toLocaleString('en-US')} triangles`)
      for (const failure of result.failures) console.log(`         ${failure}`)
    }
    const validation = await validateFile(path)
    const report = renderAssetReport({ inspection: original, validation, optimization: summary })
    await writeFile(join(out, 'report.md'), report)
    await writeFile(join(out, 'report.json'), `${JSON.stringify({ source: basename(path), original, validation: { numErrors: validation.numErrors, numWarnings: validation.numWarnings }, optimization: summary }, null, 2)}\n`)
    await writeFile(join(out, 'asset.draft.json'), `${JSON.stringify({
      id,
      kind: 'model',
      compression: geometry,
      ...(textures === 'ktx2' ? { textureCompression: 'ktx2' } : {}),
      license: 'TODO: choose one of CC0, CC-BY-4.0, CC-BY-3.0, MIT, Apache-2.0, OFL-1.1, generated-in-house',
      origin: `TODO: where ${basename(path)} came from (URL, or the author/tool)`,
      files: Object.fromEntries(summary.tiers.filter(tier => tier.file).map(tier => [tier.tier, `public/cinema2/models/${tier.file}`])),
    }, null, 2)}\n`)
    console.log(`Wrote ${relative(process.cwd(), out)}/report.md, report.json and asset.draft.json (source untouched).`)
    process.exit(failed ? 1 : 0)
  }

  if (command === 'report') {
    const path = requireFile(positional, 'report')
    const { inspection } = await inspectPath(path)
    const validation = await validateFile(path)
    let optimization
    const optimizedFolder = flags.get('optimized')
    if (typeof optimizedFolder === 'string') optimization = JSON.parse(await readFile(join(resolve(process.cwd(), optimizedFolder), 'report.json'), 'utf8')).optimization
    const report = renderAssetReport({ inspection, validation, optimization })
    if (typeof flags.get('out') === 'string') { await writeFile(resolve(process.cwd(), flags.get('out')), report); console.log(`Wrote ${flags.get('out')}`) } else process.stdout.write(report)
    process.exit(inspection.ok && validation.numErrors === 0 ? 0 : 1)
  }

  console.error('usage: cli.mjs inspect|validate|optimize|report <model.glb> [options]')
  process.exit(2)
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1) })
