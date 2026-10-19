import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repositoryRoot = process.cwd()
const sourceRoot = path.join(repositoryRoot, 'src')
const legacyRoot = path.join(sourceRoot, 'components', 'vyzualz', 'cinema')

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

if (actualImporters.size > 0 || productionLegacyImporters.size > 0) {
  if (productionLegacyImporters.size > 0) {
    console.error('Production import graph must not reach legacy Cinema code:')
    for (const file of [...productionLegacyImporters].sort()) console.error(`  ! ${file}`)
  }
  if (actualImporters.size > 0) {
    console.error('Source files must not import removed legacy Cinema code:')
    for (const file of [...actualImporters].sort()) console.error(`  ! ${file}`)
  }
  console.error('Remove the import or migrate the caller to Cinema 2.0.')
  process.exitCode = 1
} else {
  console.log('Legacy Cinema removal verified (0 source importers; production graph clean).')
}
