import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ref = process.argv[2] ?? 'HEAD'
const generatedDirectoryNames = new Set([
  'node_modules',
  'dist',
  'dist-ssr',
  'coverage',
  'logs',
  'test-results',
  'playwright-report',
  'blob-report',
  '.cache',
  '.vite',
  '.turbo',
  '.tmp',
  'tmp',
  'temp',
  'artifacts',
])

function isForbiddenTrackedPath(file) {
  const parts = file.split('/')
  if (parts.some((part) => generatedDirectoryNames.has(part))) return true
  if (parts.some((part) => part === '.DS_Store' || part === 'Thumbs.db')) return true
  if (/\.(?:log|tgz|tsbuildinfo)$/i.test(file)) return true
  if (/(?:^|\/)\.env(?:\..+)?$/.test(file) && !file.endsWith('.env.example')) return true
  return false
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  }).trim()
}

try {
  git(['rev-parse', '--show-toplevel'])
} catch {
  console.error('Source packaging requires a Git checkout.')
  process.exit(1)
}

const tracked = git(['ls-tree', '-r', '--name-only', ref])
  .split('\n')
  .filter(Boolean)
const forbiddenTracked = tracked.filter(isForbiddenTrackedPath)

if (forbiddenTracked.length > 0) {
  console.error('Refusing to package generated or machine-specific tracked files:')
  for (const file of forbiddenTracked) console.error(`  ${file}`)
  console.error('\nRemove them from Git tracking before creating a source archive.')
  process.exit(1)
}

const shortSha = git(['rev-parse', '--short=12', ref])
const outputDir = resolve('artifacts')
const outputFile = resolve(outputDir, `drmvyz-source-${shortSha}.zip`)
mkdirSync(outputDir, { recursive: true })

execFileSync('git', ['archive', '--format=zip', `--output=${outputFile}`, ref], {
  cwd: process.cwd(),
  stdio: 'inherit',
})

console.log(outputFile)
