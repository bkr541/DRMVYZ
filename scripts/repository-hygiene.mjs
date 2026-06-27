import { execFileSync } from 'node:child_process'

export const GENERATED_DIRECTORY_NAMES = new Set([
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

export function isForbiddenRepositoryPath(file) {
  const parts = file.split('/')
  if (parts.some((part) => GENERATED_DIRECTORY_NAMES.has(part))) return true
  if (parts.some((part) => part === '.DS_Store' || part === 'Thumbs.db')) return true
  if (/\.(?:log|tgz|tsbuildinfo)$/i.test(file)) return true
  if (/(?:^|\/)\.env(?:\..+)?$/.test(file) && !file.endsWith('.env.example')) return true
  return false
}

export function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  }).trim()
}

export function hasGitCheckout() {
  try {
    git(['rev-parse', '--show-toplevel'], { stdio: ['ignore', 'pipe', 'ignore'] })
    return true
  } catch {
    return false
  }
}
