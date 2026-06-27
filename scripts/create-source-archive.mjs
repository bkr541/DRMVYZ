import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  git,
  hasGitCheckout,
  isForbiddenRepositoryPath,
} from './repository-hygiene.mjs'

const ref = process.argv[2] ?? 'HEAD'

if (!hasGitCheckout()) {
  console.error('Source packaging requires a Git checkout.')
  process.exit(1)
}

const tracked = git(['ls-tree', '-r', '--name-only', ref])
  .split('\n')
  .filter(Boolean)
const forbiddenTracked = tracked.filter(isForbiddenRepositoryPath)

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
