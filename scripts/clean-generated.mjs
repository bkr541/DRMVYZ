import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const includeDependencies = process.argv.includes('--dependencies')
const directories = [
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
]

if (includeDependencies) directories.unshift('node_modules')

for (const directory of directories) {
  rmSync(resolve(directory), { recursive: true, force: true })
}

console.log(`Removed generated directories${includeDependencies ? ' and node_modules' : ''}.`)
