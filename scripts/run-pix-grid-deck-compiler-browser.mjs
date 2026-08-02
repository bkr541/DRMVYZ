import { existsSync } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const output = path.join(root, 'artifacts/pix-grid-deck-compiler-browser')
const playwrightCli = path.join(root, 'node_modules/@playwright/test/cli.js')
const viteCli = path.join(root, 'node_modules/vite/bin/vite.js')
const systemChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync)
const port = 44000 + (process.pid % 1000)
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
    } else if (entry.isFile() && entry.name === name) {
      return absolute
    }
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

let server = null
let status = 1
try {
  requireDependency(playwrightCli, 'Run npm ci before the browser compiler suite.')
  requireDependency(viteCli, 'Run npm ci before the browser compiler suite.')
  const { build } = await import('vite')
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  await build({
    root,
    build: {
      outDir: output,
      emptyOutDir: true,
      rollupOptions: {
        input: path.join(root, 'src/test/browser/pix-grid-deck-compiler.html'),
      },
    },
  })
  const builtHtml = await findFile(output, 'pix-grid-deck-compiler.html')
  if (!builtHtml) throw new Error('Vite did not emit the PixGrid Deck compiler browser page.')
  const pagePath = `/${path.relative(output, builtHtml).split(path.sep).join('/')}`
  const env = {
    ...process.env,
    DRMVYZ_PIX_GRID_DECK_COMPILER_BROWSER: '1',
    DRMVYZ_PIX_GRID_DECK_COMPILER_PAGE: pagePath,
    PLAYWRIGHT_BASE_URL: baseUrl,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {}
      : systemChromium ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: systemChromium } : {}),
  }
  server = spawn(process.execPath, [
    viteCli,
    output,
    '--host', '127.0.0.1',
    '--port', String(port),
    '--strictPort',
  ], { cwd: root, env, stdio: 'inherit' })
  await waitForServer(`${baseUrl}${pagePath}`)
  const result = spawnSync(process.execPath, [
    playwrightCli,
    'test',
    'src/test/e2e/pixGridDeckCompilerWorker.spec.ts',
    '--project=chromium',
  ], { cwd: root, env, stdio: 'inherit' })
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
}

if (status !== 0) process.exit(status)
console.log('PixGrid Deck real bundled worker acceptance passed.')
