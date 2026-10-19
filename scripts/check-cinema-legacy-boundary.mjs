import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repositoryRoot = process.cwd()
const sourceRoot = path.join(repositoryRoot, 'src')
const legacyRoot = path.join(sourceRoot, 'components', 'vyzualz', 'cinema')
const cinema2Root = path.join(sourceRoot, 'components', 'vyzualz', 'cinema2')

// Frozen compatibility files retained until Phase 6. Live application modules
// are intentionally absent and are checked transitively below.
const allowedExternalImporters = new Set([
  'src/components/vyzualz/react/CinemaAdvancedGraphEditor.tsx',
  'src/components/vyzualz/react/CinemaCanvas.tsx',
  'src/components/vyzualz/react/CinemaComposerPanel.tsx',
  'src/components/vyzualz/react/CinemaComposerStage19Panel.tsx',
  'src/components/vyzualz/react/CinemaInspectorPanel.tsx',
  'src/components/vyzualz/react/CinemaLiveOverrides.ts',
  'src/components/vyzualz/react/CinemaMediaLibraryBridge.ts',
  'src/components/vyzualz/react/CinemaWorkspace.tsx',
  'src/components/vyzualz/react/CinemaWorkspaceFrameBridge.ts',
  'src/components/vyzualz/react/CinemaWorkspacePanels.tsx',
  'src/components/vyzualz/react/CinemaWorkspaceRuntimeFrameSource.ts',
  'src/components/vyzualz/react/__tests__/CinemaLiveOverrides.test.ts',
  'src/components/vyzualz/react/useCinemaLegacyRetirement.ts',
  'src/test/browser/AfterhoursVisualAcceptanceBrowserHarness.ts',
  'src/test/browser/CinemaRuntimeBrowserHarness.ts',
])

const productionEntries = [path.join(sourceRoot, 'main.tsx')]

function sourceFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(absolutePath))
    else if (/\.tsx?$/.test(entry.name)) files.push(absolutePath)
  }
  return files
}

function importSpecifiers(source) {
  const specifiers = []
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1])
  }
  return specifiers
}

function targetsLegacyCinema(importer, specifier) {
  if (!specifier.startsWith('.')) return false
  const resolved = path.resolve(path.dirname(importer), specifier)
  return resolved === legacyRoot || resolved.startsWith(`${legacyRoot}${path.sep}`)
}

function resolveSourceImport(importer, specifier) {
  if (!specifier.startsWith('.')) return null
  const candidate = path.resolve(path.dirname(importer), specifier)
  for (const resolved of [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    `${candidate}.js`,
    `${candidate}.jsx`,
    path.join(candidate, 'index.ts'),
    path.join(candidate, 'index.tsx'),
    path.join(candidate, 'index.js'),
    path.join(candidate, 'index.jsx'),
  ]) {
    if (existsSync(resolved) && statSync(resolved).isFile()) return resolved
  }
  return null
}

const productionLegacyImporters = new Set()
const visitedProductionFiles = new Set()
const pendingProductionFiles = [...productionEntries]
while (pendingProductionFiles.length > 0) {
  const file = pendingProductionFiles.pop()
  if (!file || visitedProductionFiles.has(file) || !existsSync(file)) continue
  visitedProductionFiles.add(file)
  const source = readFileSync(file, 'utf8')
  for (const specifier of importSpecifiers(source)) {
    const resolved = resolveSourceImport(file, specifier)
    if (!resolved) continue
    if (resolved === legacyRoot || resolved.startsWith(`${legacyRoot}${path.sep}`)) {
      productionLegacyImporters.add(path.relative(repositoryRoot, file).split(path.sep).join('/'))
      continue
    }
    if (resolved.startsWith(`${sourceRoot}${path.sep}`)) pendingProductionFiles.push(resolved)
  }
}

const actualImporters = new Set()
for (const file of sourceFiles(sourceRoot)) {
  if (file === legacyRoot || file.startsWith(`${legacyRoot}${path.sep}`)) continue
  const source = readFileSync(file, 'utf8')
  if (importSpecifiers(source).some(specifier => targetsLegacyCinema(file, specifier))) {
    actualImporters.add(path.relative(repositoryRoot, file).split(path.sep).join('/'))
  }
}

const unexpected = [...actualImporters].filter(file => !allowedExternalImporters.has(file)).sort()
const stale = [...allowedExternalImporters].filter(file => !actualImporters.has(file)).sort()
const cinema2Importers = [...actualImporters].filter(file => {
  const absolutePath = path.join(repositoryRoot, file)
  return absolutePath === cinema2Root || absolutePath.startsWith(`${cinema2Root}${path.sep}`)
}).sort()

if (unexpected.length > 0 || stale.length > 0 || cinema2Importers.length > 0 || productionLegacyImporters.size > 0) {
  if (productionLegacyImporters.size > 0) {
    console.error('Production import graph must not reach legacy Cinema code:')
    for (const file of [...productionLegacyImporters].sort()) console.error(`  ! ${file}`)
  }
  if (cinema2Importers.length > 0) {
    console.error('Cinema 2.0 must not import legacy Cinema code:')
    for (const file of cinema2Importers) console.error(`  ! ${file}`)
  }
  if (unexpected.length > 0) {
    console.error('Unexpected imports of frozen legacy Cinema code:')
    for (const file of unexpected) console.error(`  + ${file}`)
  }
  if (stale.length > 0) {
    console.error('Stale legacy Cinema importer allowlist entries:')
    for (const file of stale) console.error(`  - ${file}`)
  }
  console.error('Update the implementation and the Phase 1 inventory together.')
  process.exitCode = 1
} else {
  console.log(`Legacy Cinema boundary verified (${actualImporters.size} isolated compatibility importers; production graph clean).`)
}
