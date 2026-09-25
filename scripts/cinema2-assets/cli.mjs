// `npm run assets:build`  regenerate the TypeScript asset manifest and the attribution list from assets/cinema2/*/asset.json
// `npm run assets:check`  validate assets and fail when a generated file is stale (used by CI and `verify:fast`)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeAssets, generateAttributions, generateManifestSource } from './assets-core.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const assetsDirectory = join(root, 'assets/cinema2')
const manifestPath = join(root, 'src/components/vyzualz/cinema2/assets/Cinema2AssetManifest.generated.ts')
const attributionsPath = join(root, 'public/cinema2/attributions.json')
const mode = process.argv[2] === 'check' ? 'check' : 'build'

function loadRecords() {
  if (!existsSync(assetsDirectory)) return []
  return readdirSync(assetsDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .sort((left, right) => (left.name < right.name ? -1 : 1))
    .map(entry => {
      const file = join(assetsDirectory, entry.name, 'asset.json')
      if (!existsSync(file)) return { directory: entry.name, record: { id: entry.name, __missing: true } }
      try { return { directory: entry.name, record: JSON.parse(readFileSync(file, 'utf8')) } } catch (error) { return { directory: entry.name, record: { id: entry.name, __invalid: error.message } } }
    })
}

const budgetsFile = join(assetsDirectory, 'budgets.json')
const budgets = existsSync(budgetsFile) ? JSON.parse(readFileSync(budgetsFile, 'utf8')) : {}
const loaded = loadRecords()
const structural = loaded.flatMap(({ directory, record }) => record.__missing
  ? [{ id: directory, code: 'ASSET_JSON_MISSING', message: `assets/cinema2/${directory}/ has no asset.json.` }]
  : record.__invalid ? [{ id: directory, code: 'ASSET_JSON_INVALID', message: `asset.json is not valid JSON: ${record.__invalid}` }] : [])
const { assets, issues, totalBytes } = analyzeAssets(
  loaded.filter(({ record }) => !record.__missing && !record.__invalid),
  path => readFileSync(join(root, path)),
  budgets,
)
const allIssues = [...structural, ...issues]

const manifestSource = generateManifestSource(assets)
const attributionsSource = generateAttributions(assets)
const stale = []
if (!existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== manifestSource) stale.push(manifestPath)
if (!existsSync(attributionsPath) || readFileSync(attributionsPath, 'utf8') !== attributionsSource) stale.push(attributionsPath)

if (allIssues.length > 0) {
  for (const issue of allIssues) console.error(`assets: ${issue.id}: ${issue.code}: ${issue.message}`)
  console.error(`assets: ${allIssues.length} problem(s); nothing was written.`)
  process.exit(1)
}
if (mode === 'check') {
  if (stale.length > 0) {
    for (const path of stale) console.error(`assets: ${path.slice(root.length + 1)} is out of date; run \`npm run assets:build\`.`)
    process.exit(1)
  }
} else {
  mkdirSync(dirname(attributionsPath), { recursive: true })
  writeFileSync(manifestPath, manifestSource)
  writeFileSync(attributionsPath, attributionsSource)
}
console.log(`assets: ${assets.length} asset(s), ${(totalBytes / 1024 / 1024).toFixed(2)} MB shipped; ${mode === 'check' ? 'all checks passed' : `wrote ${stale.length} file(s)`}.`)
