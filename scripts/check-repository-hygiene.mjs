import {
  git,
  hasGitCheckout,
  isForbiddenRepositoryPath,
} from './repository-hygiene.mjs'

if (!hasGitCheckout()) {
  console.log('Repository hygiene: Git metadata unavailable; tracked-file check skipped.')
  process.exit(0)
}

const tracked = git(['ls-files'])
  .split('\n')
  .filter(Boolean)
const forbiddenTracked = tracked.filter(isForbiddenRepositoryPath)

if (forbiddenTracked.length > 0) {
  console.error('Generated or machine-specific files are tracked by Git:')
  for (const file of forbiddenTracked) console.error(`  ${file}`)
  console.error('\nRemove them from tracking before verification or source packaging.')
  process.exit(1)
}

console.log(`Repository hygiene: ${tracked.length} tracked files checked; no forbidden paths found.`)
