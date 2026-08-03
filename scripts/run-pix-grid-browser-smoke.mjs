import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const playwrightCli = path.join(root, 'node_modules/@playwright/test/cli.js')
const systemChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync)

if (!existsSync(playwrightCli)) {
  throw new Error('node_modules/@playwright/test/cli.js is missing. Run npm ci before the PixGrid browser smoke suite.')
}

const result = spawnSync(process.execPath, [
  playwrightCli,
  'test',
  'src/test/e2e/pixGridGpuPixelReadback.spec.ts',
  '--project=chromium',
], {
  cwd: root,
  env: {
    ...process.env,
    DRMVYZ_PIX_GRID_BROWSER_SMOKE: '1',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {}
      : systemChromium ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: systemChromium } : {}),
  },
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
