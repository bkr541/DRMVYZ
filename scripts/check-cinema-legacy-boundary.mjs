import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repositoryRoot = process.cwd()
const sourceRoot = path.join(repositoryRoot, 'src')
const legacyRoot = path.join(sourceRoot, 'components', 'vyzualz', 'cinema')
const cinema2Root = path.join(sourceRoot, 'components', 'vyzualz', 'cinema2')

// Phase 1 baseline. Removing an importer requires updating this list in the same
// change; adding an importer fails the check because legacy Cinema is frozen.
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
  'src/components/vyzualz/react/ReactEnginePanel.tsx',
  'src/components/vyzualz/react/ReactInspectorPanel.tsx',
  'src/components/vyzualz/react/ReactPerformancePads.tsx',
  'src/components/vyzualz/react/ReactView.tsx',
  'src/components/vyzualz/react/__tests__/CinemaLiveOverrides.test.ts',
  'src/components/vyzualz/react/__tests__/finalReactEngineIntegrity.test.ts',
  'src/components/vyzualz/react/activeEnginePresetName.ts',
  'src/components/vyzualz/react/panels/ReactWorkspacePanels.tsx',
  'src/components/vyzualz/react/useCinemaLegacyRetirement.ts',
  'src/components/vyzualz/react/useReactPresetAutomation.ts',
  'src/stores/reactStore.ts',
  'src/test/browser/AfterhoursVisualAcceptanceBrowserHarness.ts',
  'src/test/browser/CinemaRuntimeBrowserHarness.ts',
])

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

if (unexpected.length > 0 || stale.length > 0 || cinema2Importers.length > 0) {
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
  console.log(`Legacy Cinema boundary verified (${actualImporters.size} external importers, no additions).`)
}
