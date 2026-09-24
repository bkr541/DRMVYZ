import { existsSync } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const output = path.join(root, 'artifacts/cinema2-humn-browser')
const playwrightCli = path.join(root, 'node_modules/@playwright/test/cli.js')
const viteCli = path.join(root, 'node_modules/vite/bin/vite.js')
const systemChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync)
const port = 48000 + (process.pid % 1000)
const baseUrl = `http://127.0.0.1:${port}`

function requireDependency(file, installHint) {
  if (!existsSync(file)) throw new Error(`${path.relative(root, file)} is missing. ${installHint}`)
}

async function findFile(directory, name) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      const found = await findFile(absolute, name)
      if (found) return found
    } else if (entry.isFile() && entry.name === name) return absolute
  }
  return null
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

// Optional narrowing for local iteration: DRMVYZ_CINEMA2_HUMN_SPECS=src/test/e2e/a.spec.ts,src/test/e2e/b.spec.ts
const specs = process.env.DRMVYZ_CINEMA2_HUMN_SPECS
  ? process.env.DRMVYZ_CINEMA2_HUMN_SPECS.split(',').filter(Boolean)
  : ['src/test/e2e/cinema2HumNReactivityVisualAcceptance.spec.ts', 'src/test/e2e/cinema2HumNFinishingAcceptance.spec.ts']

let server = null
let status = 1
try {
  requireDependency(playwrightCli, 'Run npm ci before the Cinema 2.0 HUM:N browser suite.')
  requireDependency(viteCli, 'Run npm ci before the Cinema 2.0 HUM:N browser suite.')
  const { build } = await import('vite')
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  await build({
    root,
    build: {
      outDir: output,
      emptyOutDir: true,
      rollupOptions: { input: path.join(root, 'src/test/browser/cinema2-humn-reactivity.html') },
    },
  })
  const builtHtml = await findFile(output, 'cinema2-humn-reactivity.html')
  if (!builtHtml) throw new Error('Vite did not emit the Cinema 2.0 HUM:N acceptance page.')
  const pagePath = `/${path.relative(output, builtHtml).split(path.sep).join('/')}`
  const env = {
    ...process.env,
    DRMVYZ_CINEMA2_HUMN_BROWSER: '1',
    DRMVYZ_CINEMA2_HUMN_PAGE: pagePath,
    PLAYWRIGHT_BASE_URL: baseUrl,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {}
      : systemChromium ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: systemChromium } : {}),
  }
  server = spawn(process.execPath, [viteCli, output, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env, stdio: 'inherit' })
  await waitForServer(`${baseUrl}${pagePath}`)
  const result = spawnSync(process.execPath, [playwrightCli, 'test', ...specs, '--project=chromium'], { cwd: root, env, stdio: 'inherit' })
  status = result.status ?? 1
} finally {
  if (server && server.exitCode == null) {
    server.kill('SIGTERM')
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 1_000)
      server.once('exit', () => { clearTimeout(timer); resolve() })
    })
    if (server.exitCode == null) server.kill('SIGKILL')
  }
}

if (status !== 0) process.exit(status)
console.log('Cinema 2.0 HUM:N reactivity real-browser acceptance passed.')
