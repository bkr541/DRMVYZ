import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const output = path.join(root, 'artifacts/pix-grid-deck-preset-manager-browser')
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

// A temporary shipped Deck, written before the build and always removed afterwards, so the gate exercises the real built-in path
// (manifest + bundled images) without committing a test preset.
const sampleSlug = 'e2e-sample'
const sampleImages = [['opaque.png', 'image/png', '01.png'], ['transparent.png', 'image/png', '02.png'], ['photo.jpg', 'image/jpeg', '03.jpg']]
const sampleManifestPath = path.join(root, 'src/components/vyzualz/react/pixGrid/shippedDecks', `${sampleSlug}.json`)
const sampleImageDirectory = path.join(root, 'public/pixgrid-decks', sampleSlug)

async function writeShippedSample() {
  await mkdir(sampleImageDirectory, { recursive: true })
  const sources = []
  for (const [index, [fixture, mimeType, target]] of sampleImages.entries()) {
    const from = path.join(root, 'src/test/fixtures/pixGridDeck', fixture)
    await copyFile(from, path.join(sampleImageDirectory, target))
    const fingerprint = `sha256:${createHash('sha256').update(await readFile(from)).digest('hex')}`
    sources.push({ id: `source-0${index + 1}`, path: `pixgrid-decks/${sampleSlug}/${target}`, mimeType, fileName: fixture, width: 2, height: 2, hasAlpha: fixture === 'transparent.png', fingerprint })
  }
  await writeFile(sampleManifestPath, `${JSON.stringify({
    schemaVersion: 1, slug: sampleSlug, name: 'E2E Shipped Sample', description: 'Temporary gate deck.', revision: 1, sources,
    items: sources.map((source, index) => ({ id: `e2e-${index + 1}`, sourceId: source.id })),
    configuration: { playbackOrder: 'forward', loop: true, defaultItemDurationBeats: 4, reactionProfileId: 'balanced', preDropBehavior: 'hold', motionProfileId: 'balanced', transitionPolicy: { mode: 'auto' } },
  }, null, 2)}\n`)
}

async function removeShippedSample() {
  await rm(sampleManifestPath, { force: true })
  await rm(path.join(root, 'public/pixgrid-decks', sampleSlug), { recursive: true, force: true })
  await rm(path.join(root, 'public/pixgrid-decks'), { recursive: false, force: true }).catch(() => undefined)
}

let server = null
let status
try {
  requireDependency(playwrightCli, 'Run npm ci before the PixGrid Deck release browser suite.')
  requireDependency(viteCli, 'Run npm ci before the PixGrid Deck release browser suite.')
  await writeShippedSample()
  const { build } = await import('vite')
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  await build({
    root,
    build: {
      outDir: output,
      emptyOutDir: true,
      rollupOptions: {
        input: path.join(root, 'src/test/browser/pix-grid-deck-show-manager.html'),
      },
    },
  })
  const builtHtml = await findFile(output, 'pix-grid-deck-show-manager.html')
  if (!builtHtml) throw new Error('Vite did not emit the PixGrid Deck browser page.')
  // The app is built with a relative base, so a bundled image resolves against the page's own folder. The real app serves index.html from the
  // root, but this harness page is nested, so put the bundled images beside it as well.
  if (existsSync(path.join(output, 'pixgrid-decks'))) await cp(path.join(output, 'pixgrid-decks'), path.join(path.dirname(builtHtml), 'pixgrid-decks'), { recursive: true })
  const pagePath = `/${path.relative(output, builtHtml).split(path.sep).join('/')}?view=presetManager`
  const env = {
    ...process.env,
    DRMVYZ_PIX_GRID_DECK_PRESET_MANAGER_BROWSER: '1',
    DRMVYZ_PIX_GRID_SHIPPED_SAMPLE_SLUG: sampleSlug,
    DRMVYZ_PIX_GRID_DECK_PRESET_MANAGER_PAGE: pagePath,
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
  await waitForServer(`${baseUrl}${pagePath.split('?')[0]}`)
  const result = spawnSync(process.execPath, [
    playwrightCli,
    'test',
    'src/test/e2e/pixGridDeckPresetManager.spec.ts',
    '--project=chromium',
  ], { cwd: root, env, stdio: 'inherit' })
  status = result.status ?? 1
} finally {
  await removeShippedSample()
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

if (status !== 0) process.exit(status ?? 1)
console.log('PixGrid Deck Preset Manager acceptance passed.')
