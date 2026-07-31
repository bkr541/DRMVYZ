import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { build } from 'esbuild'

const root = process.cwd()
const output = path.join(root, 'artifacts/pix-grid-marquee-stage3-browser')
const runtime = path.join(output, '.runtime')
const storeShim = path.join(root, 'scripts/pix-grid-marquee-stage3-react-store-shim.ts')
const systemChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync)
const env = {
  ...process.env,
  DRMVYZ_PIX_GRID_MARQUEE_STAGE3_BROWSER: '1',
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? {}
    : systemChromium ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: systemChromium } : {}),
}

let status = 1
try {
  await rm(output, { recursive: true, force: true })
  await mkdir(runtime, { recursive: true })
  await build({
    entryPoints: [path.join(root, 'scripts/pix-grid-marquee-stage3-browser-page.tsx')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    define: { 'import.meta.env': '{}' },
    outfile: path.join(runtime, 'pixGridMarqueeStage3.bundle.js'),
    plugins: [{
      name: 'pix-grid-stage3-store-shim',
      setup(buildApi) {
        buildApi.onResolve({ filter: /stores[\\/]reactStore$/ }, () => ({ path: storeShim }))
      },
    }],
  })

  const result = spawnSync('npx', ['playwright', 'test', 'src/test/e2e/pixGridMarqueeStage3.spec.ts', '--project=chromium'], {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  status = result.status ?? 1
} finally {
  await rm(output, { recursive: true, force: true })
}

if (status !== 0) process.exit(status)
console.log('PixGrid Marquee Stage 3 browser validation passed.')
