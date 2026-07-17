import { closeSync, openSync, readFileSync } from 'node:fs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const root = process.cwd()
const srcRoot = path.join(root, 'src')
const vitestCli = path.join(root, 'node_modules/vitest/vitest.mjs')
const batchSize = 20
const batchTimeoutMs = 180_000

// These TypeScript tests require jsdom even though their file extension is not
// .tsx. Keep this list aligned with vitest.node.config.ts and
// vitest.dom.config.ts so every source test belongs to exactly one partition.
const DOM_TYPESCRIPT_TESTS = new Set([
  'src/components/vyzualz/hooks/__tests__/useWaveformPeaks.test.ts',
  'src/components/vyzualz/media/generateThumbnail.test.ts',
  'src/components/vyzualz/react/CanvasControlsContract.test.ts',
  'src/components/vyzualz/react/__tests__/ReactPerformanceActions.test.ts',
  'src/components/vyzualz/react/renderers/CanvasParticleAuraRenderer.test.ts',
  'src/features/lyrics/components/AiLyricExtractor.test.ts',
  'src/features/personalization/__tests__/appAccentPersonalization.test.ts',
  'src/features/rekordboxImport/nativeBridge.test.ts',
  'src/stores/mediaManagerWorkflows.test.ts',
])

function normalizePath(value) {
  return value.split(path.sep).join('/')
}

async function collectTestFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectTestFiles(absolute))
      continue
    }
    if (!entry.isFile() || !/\.test\.(?:ts|tsx)$/.test(entry.name)) continue
    const relative = normalizePath(path.relative(root, absolute))
    if (relative.startsWith('src/test/e2e/')) continue
    files.push(relative)
  }
  return files.sort()
}

function partitionTests(files) {
  const node = []
  const dom = []
  for (const file of files) {
    if (file.endsWith('.test.tsx') || DOM_TYPESCRIPT_TESTS.has(file)) dom.push(file)
    else node.push(file)
  }
  return { node, dom }
}

function processGroupAlive(child) {
  if (child?.pid == null || process.platform === 'win32') return child?.exitCode == null
  try {
    process.kill(-child.pid, 0)
    return true
  } catch {
    return false
  }
}

function terminateProcessGroup(child) {
  if (!child || !processGroupAlive(child)) return
  try {
    if (process.platform === 'win32') child.kill('SIGKILL')
    else process.kill(-child.pid, 'SIGKILL')
  } catch {
    // The batch may have exited between inspection and termination.
  }
}


function parseBatchSummary(output) {
  const plain = output
  const files = plain.match(/Test Files\s+(\d+) passed(?:\s+\((\d+)\))?/)
  const tests = plain.match(/Tests\s+(\d+) passed(?:\s+\((\d+)\))?/)
  return {
    passedFiles: files ? Number(files[1]) : 0,
    passedTests: tests ? Number(tests[1]) : 0,
  }
}

async function runBatch(kind, config, files, index, tempDirectory) {
  const logPath = path.join(tempDirectory, `${String(index).padStart(2, '0')}-${kind}.log`)
  const logFd = openSync(logPath, 'w')
  const child = spawn(process.execPath, [
    vitestCli,
    'run',
    '--config',
    config,
    '--maxWorkers=2',
    '--minWorkers=1',
    ...files,
  ], {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    stdio: ['ignore', logFd, logFd],
    detached: process.platform !== 'win32',
  })
  closeSync(logFd)

  const startedAt = performance.now()
  const status = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      terminateProcessGroup(child)
      resolve({ code: 124, signal: 'batch-timeout' })
    }, batchTimeoutMs)
    child.once('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal })
    })
  })
  terminateProcessGroup(child)

  const output = readFileSync(logPath, 'utf8')
  process.stdout.write(output)
  const durationMs = performance.now() - startedAt
  if (status.code !== 0) {
    throw new Error(
      `${kind} Vitest batch ${index} failed with ${status.code ?? status.signal ?? 'unknown'} `
      + `after ${(durationMs / 1000).toFixed(1)}s. Files: ${files.join(', ')}`,
    )
  }
  const summary = parseBatchSummary(output)
  if (summary.passedFiles !== files.length) {
    throw new Error(
      `${kind} Vitest batch ${index} reported ${summary.passedFiles}/${files.length} passed files.`,
    )
  }
  return { ...summary, durationMs }
}

function chunks(files) {
  const result = []
  for (let index = 0; index < files.length; index += batchSize) {
    result.push(files.slice(index, index + batchSize))
  }
  return result
}

const requested = new Set(process.argv.slice(2))
const runNode = requested.size === 0 || requested.has('--node')
const runDom = requested.size === 0 || requested.has('--dom')
if (!runNode && !runDom) {
  throw new Error('Use --node, --dom, or no partition flag.')
}

const allFiles = await collectTestFiles(srcRoot)
const partitions = partitionTests(allFiles)
const selected = [
  ...(runNode ? [{ kind: 'node', config: 'vitest.node.config.ts', files: partitions.node }] : []),
  ...(runDom ? [{ kind: 'dom', config: 'vitest.dom.config.ts', files: partitions.dom }] : []),
]
const selectedFiles = selected.reduce((sum, partition) => sum + partition.files.length, 0)
if (selectedFiles === 0) throw new Error('No Vitest files matched the requested partitions.')
if (runNode && runDom && selectedFiles !== allFiles.length) {
  throw new Error(`Vitest partition coverage mismatch: ${selectedFiles}/${allFiles.length} source tests selected.`)
}

const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'drmvyz-vitest-'))
const startedAt = performance.now()
let batchIndex = 0
let passedFiles = 0
let passedTests = 0

try {
  for (const partition of selected) {
    for (const batch of chunks(partition.files)) {
      batchIndex += 1
      console.log(`\n[Vitest partition] ${partition.kind} batch ${batchIndex}: ${batch.length} files`)
      const summary = await runBatch(partition.kind, partition.config, batch, batchIndex, tempDirectory)
      passedFiles += summary.passedFiles
      passedTests += summary.passedTests
    }
  }
} finally {
  await rm(tempDirectory, { recursive: true, force: true })
}

console.log('\nVitest partitioned suite complete')
console.log(`Test Files  ${passedFiles} passed (${selectedFiles})`)
console.log(`Tests       ${passedTests} passed`)
console.log(`Batches     ${batchIndex} passed`)
console.log(`Duration    ${((performance.now() - startedAt) / 1000).toFixed(2)}s`)
