import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const output = path.join(root, 'artifacts/show-director-visual-review')
const systemChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync)
const env = {
  ...process.env,
  DRMVYZ_SHOW_DIRECTOR_VISUAL_REVIEW: '1',
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? {}
    : systemChromium ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: systemChromium } : {}),
}

await rm(output, { recursive: true, force: true })
await mkdir(path.join(output, '.runtime'), { recursive: true })

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('npx', ['esbuild', 'scripts/show-director-visual-review-page.ts', '--bundle', '--format=iife', '--platform=browser', '--define:import.meta.env={}', `--outfile=${path.join(output, '.runtime/showDirectorVisualReview.bundle.js')}`])
run('npx', ['playwright', 'test', 'src/test/e2e/showDirectorVisualReview.spec.ts', '--project=chromium'])
await rm(path.join(output, '.runtime'), { recursive: true, force: true })
console.log(`Show Director validation frames: ${output}`)
