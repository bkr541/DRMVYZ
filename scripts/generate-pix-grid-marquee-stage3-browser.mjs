import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { build } from 'esbuild'

const root = process.cwd()
const output = path.join(root, 'artifacts/pix-grid-marquee-real-browser')
const runtime = path.join(output, '.runtime')
const bundlePath = path.join(runtime, 'pixGridMarqueeRealBrowser.bundle.js')
const stylePath = path.join(runtime, 'pixGridMarqueeRealBrowser.bundle.css')
const playwrightCli = path.join(root, 'node_modules/@playwright/test/cli.js')
const viteCli = path.join(root, 'node_modules/vite/bin/vite.js')
const systemChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync)
const port = 43000 + (process.pid % 1000)
const baseUrl = `http://127.0.0.1:${port}`
const env = {
  ...process.env,
  DRMVYZ_PIX_GRID_MARQUEE_REAL_BROWSER: '1',
  PLAYWRIGHT_BASE_URL: baseUrl,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? {}
    : systemChromium ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: systemChromium } : {}),
}

function requireDependency(file, installHint) {
  if (!existsSync(file)) {
    throw new Error(`${path.relative(root, file)} is missing. ${installHint}`)
  }
}

async function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

let server = null
let status = 1
try {
  requireDependency(playwrightCli, 'Run npm ci before the browser acceptance suite.')
  requireDependency(viteCli, 'Run npm ci before the browser acceptance suite.')

  await rm(output, { recursive: true, force: true })
  await mkdir(runtime, { recursive: true })
  await build({
    entryPoints: [path.join(root, 'scripts/pix-grid-marquee-stage3-browser-page.tsx')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome120'],
    define: { 'import.meta.env': '{}' },
    outfile: bundlePath,
    logLevel: 'info',
  })

  const stylesheet = existsSync(stylePath)
    ? '<link rel="stylesheet" href="/.runtime/pixGridMarqueeRealBrowser.bundle.css">'
    : ''
  await writeFile(path.join(output, 'index.html'), `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DRMVYZ PixGrid Marquee Real Runtime Acceptance</title>
  ${stylesheet}
</head>
<body>
  <div id="root"></div>
  <script src="/.runtime/pixGridMarqueeRealBrowser.bundle.js"></script>
</body>
</html>`, 'utf8')

  server = spawn(process.execPath, [
    viteCli,
    output,
    '--host', '127.0.0.1',
    '--port', String(port),
    '--strictPort',
  ], {
    cwd: root,
    env,
    stdio: 'inherit',
  })
  await waitForServer(baseUrl)

  const result = spawnSync(process.execPath, [
    playwrightCli,
    'test',
    'src/test/e2e/pixGridMarqueeRealRuntime.spec.ts',
    '--project=chromium',
  ], {
    cwd: root,
    env,
    stdio: 'inherit',
  })
  status = result.status ?? 1
} finally {
  if (server && server.exitCode == null) {
    server.kill('SIGTERM')
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 1_000)
      server.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
    if (server.exitCode == null) server.kill('SIGKILL')
  }
  await rm(runtime, { recursive: true, force: true })
  await rm(path.join(output, 'index.html'), { force: true })
}

if (status !== 0) process.exit(status)
console.log('PixGrid Marquee real production browser acceptance passed.')
