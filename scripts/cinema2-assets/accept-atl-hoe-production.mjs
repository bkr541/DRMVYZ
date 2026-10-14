#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { basename, extname, join, relative, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer as createViteServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const artifactRoot = join(root, 'artifacts/cinema2-atl-hoe-acceptance')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')

function parseArguments(tokens) {
  const result = { audio: [], matrix: null, sampleFrames: 360 }
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index], value = tokens[index + 1]
    if (token === '--audio' && value) { result.audio.push(resolve(value)); index += 1 }
    else if (token === '--matrix' && value) { result.matrix = resolve(value); index += 1 }
    else if (token === '--sample-frames' && value) { result.sampleFrames = Math.max(120, Math.min(1800, Number(value) || 360)); index += 1 }
    else if (token === '--help') {
      console.log('Usage: npm run visual:atl-hoe:production -- [--audio /path/track.wav]... [--matrix /path/matrix.json] [--sample-frames 360]')
      process.exit(0)
    } else throw new Error(`Unknown argument: ${token}`)
  }
  for (const path of result.audio) if (!existsSync(path)) throw new Error(`Local audio track does not exist: ${path}`)
  if (result.matrix && !existsSync(result.matrix)) throw new Error(`Tuning matrix does not exist: ${result.matrix}`)
  return result
}

const args = parseArguments(process.argv.slice(2))
const patterns = Object.freeze(['city-pulse', 'waffle-marquee', 'interstate-flow', 'skyline-rise', 'neon-brownout', 'storm-takeover'])
const scenarios = Object.freeze(['quiet', 'vocal', 'percussion', 'build', 'drop', 'false-drop', 'half-time'])
const viewports = Object.freeze([
  Object.freeze({ id: '16x9', width: 1920, height: 1080 }),
  Object.freeze({ id: 'embedded-stage', width: 2048, height: 1041 }),
])
const defaultMatrix = patterns.map((pattern, index) => ({ pattern, scenario: scenarios[index % scenarios.length], timeSec: 2 + index * 0.75 }))
const externalMatrix = args.matrix ? JSON.parse(await (await import('node:fs/promises')).readFile(args.matrix, 'utf8')) : null
const matrix = Array.isArray(externalMatrix) ? externalMatrix : defaultMatrix
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const mimeType = path => ({ '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.flac': 'audio/flac' })[extname(path).toLowerCase()] ?? 'application/octet-stream'

async function startAudioServer(paths) {
  if (!paths.length) return null
  const server = createHttpServer(async (request, response) => {
    const match = /^\/audio\/(\d+)$/.exec(request.url ?? '')
    const path = match ? paths[Number(match[1])] : null
    if (!path) { response.writeHead(404); response.end(); return }
    const info = await stat(path)
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': mimeType(path), 'Content-Length': info.size, 'Cache-Control': 'no-store' })
    createReadStream(path).pipe(response)
  })
  await new Promise(resolvePromise => server.listen(0, '127.0.0.1', resolvePromise))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Local audio server did not expose a port.')
  return { server, urls: paths.map((_, index) => `http://127.0.0.1:${address.port}/audio/${index}`) }
}

function assertHealthy(status, label) {
  if (status?.snapshot?.phase !== 'running' || status.snapshot.frameCount < 1 || status.snapshot.statusMessage != null) throw new Error(`${label}: runtime did not complete cleanly.`)
  if (status?.modules?.failedModuleCount !== 0 || status?.modules?.degradedModuleCount !== 0) throw new Error(`${label}: module reported a failure or degradation.`)
  if (status?.effects?.failedEffectCount !== 0) throw new Error(`${label}: render effect failed.`)
}

function contactSheet(captures) {
  const cards = captures.map(capture => `<figure><img src="${capture.filename}" alt="${capture.name}"><figcaption>${capture.name}</figcaption></figure>`).join('\n')
  return `<!doctype html><meta charset="utf-8"><title>ATL HOE production contact sheet</title><style>body{margin:0;background:#090d14;color:#d9f3ff;font:14px system-ui}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:12px}figure{margin:0;background:#111925;padding:8px}img{display:block;width:100%;height:auto}figcaption{padding-top:7px}</style><main>${cards}</main>`
}

await mkdir(artifactRoot, { recursive: true })
const output = await mkdtemp(join(artifactRoot, 'run-'))
const audioServer = await startAudioServer(args.audio)
const vite = await createViteServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false })
let browser
try {
  await vite.listen()
  const address = vite.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local ATL HOE acceptance port.')
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-atl-hoe-production.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required'] })
  const captures = []
  const captureCases = viewports.flatMap(viewport => matrix.map((entry, index) => ({
    ...viewport, pattern: entry.pattern ?? patterns[index % patterns.length], scenario: entry.scenario ?? scenarios[index % scenarios.length],
    timeSec: Number(entry.timeSec ?? 2 + index * 0.75), trackIndex: Number(entry.trackIndex ?? 0), quality: 'high', name: `${viewport.id}-${entry.pattern ?? patterns[index % patterns.length]}`,
  })))
  captureCases.push(
    { ...viewports[0], pattern: 'city-pulse', scenario: 'quiet', timeSec: 1.5, quality: 'high', emissionOff: true, name: '16x9-emission-off' },
    { ...viewports[0], pattern: 'interstate-flow', scenario: 'percussion', timeSec: 3, quality: 'medium', name: '16x9-medium' },
    { ...viewports[0], pattern: 'skyline-rise', scenario: 'build', timeSec: 4, quality: 'low', name: '16x9-low' },
  )

  for (const entry of captureCases) {
    const page = await browser.newPage({ viewport: { width: entry.width, height: entry.height }, deviceScaleFactor: 1 })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', entry.quality)
      url.searchParams.set('scenario', entry.scenario)
      url.searchParams.set('timeSec', String(entry.timeSec))
      url.searchParams.set('params', JSON.stringify({
        'atl-hoe-auto-performance': false,
        'atl-hoe-sign-pattern': entry.pattern,
        ...(entry.emissionOff ? { 'atl-hoe-master-intensity': 0 } : {}),
      }))
      if (audioServer?.urls.length) url.searchParams.set('audioUrl', audioServer.urls[Math.min(audioServer.urls.length - 1, Math.max(0, entry.trackIndex ?? 0))])
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(globalThis.__atlHoeProduction), undefined, { timeout: 30_000 })
      const status = await page.evaluate(() => globalThis.__atlHoeProduction?.prepare())
      if (pageErrors.length) throw new Error(pageErrors.join('\n'))
      assertHealthy(status, entry.name)
      const filename = `${entry.name}.png`
      const bytes = await page.locator('#atl-hoe-production').screenshot({ path: join(output, filename), timeout: 120_000 })
      captures.push({ ...entry, filename, sha256: sha256(bytes), status })
      console.log(`${entry.name}: ${sha256(bytes).slice(0, 12)}`)
    } finally { await page.close() }
  }

  for (const viewport of viewports) {
    const hashes = captures.filter(capture => capture.id === viewport.id && capture.quality === 'high' && !capture.emissionOff).map(capture => capture.sha256)
    if (hashes.length !== matrix.length || new Set(hashes).size !== hashes.length) throw new Error(`${viewport.id}: program captures were not spatially distinct.`)
  }

  const validationPage = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  const validationUrl = new URL(baseUrl)
  validationUrl.searchParams.set('scenario', 'drop')
  validationUrl.searchParams.set('timeSec', '3')
  validationUrl.searchParams.set('params', JSON.stringify({ 'atl-hoe-auto-performance': true }))
  if (audioServer?.urls[0]) validationUrl.searchParams.set('audioUrl', audioServer.urls[0])
  await validationPage.goto(validationUrl.href, { waitUntil: 'domcontentloaded' })
  await validationPage.waitForFunction(() => Boolean(globalThis.__atlHoeProduction), undefined, { timeout: 30_000 })
  const prepared = await validationPage.evaluate(() => globalThis.__atlHoeProduction?.prepare())
  assertHealthy(prepared, 'production warmup')
  const longRun = await validationPage.evaluate(frames => globalThis.__atlHoeProduction?.profile(frames), args.sampleFrames)
  assertHealthy(longRun.runtime, 'sustained playback')
  const paused = await validationPage.evaluate(() => globalThis.__atlHoeProduction?.pause()); assertHealthy(paused, 'pause')
  const resumed = await validationPage.evaluate(() => globalThis.__atlHoeProduction?.resume()); assertHealthy(resumed, 'resume')
  const sought = await validationPage.evaluate(() => globalThis.__atlHoeProduction?.seek(18)); assertHealthy(sought, 'seek')
  const replaced = await validationPage.evaluate(() => globalThis.__atlHoeProduction?.replaceTrack('atl-hoe-production-replacement')); assertHealthy(replaced, 'track replacement')
  await validationPage.setViewportSize({ width: 2048, height: 1041 })
  const resized = await validationPage.evaluate(() => globalThis.__atlHoeProduction?.resize(globalThis.innerWidth, globalThis.innerHeight)); assertHealthy(resized, 'resize')
  const recovered = await validationPage.evaluate(() => globalThis.__atlHoeProduction?.recoverContext()); assertHealthy(recovered, 'context recovery')
  if (recovered.snapshot.contextGeneration < 2) throw new Error('Context generation did not advance.')
  await validationPage.close()

  const failurePage = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  await failurePage.route('**/cinema2/models/atl-hoe*.glb', route => route.fulfill({ status: 404, body: '' }))
  await failurePage.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await failurePage.waitForFunction(() => Boolean(globalThis.__atlHoeProduction), undefined, { timeout: 30_000 })
  const assetFailure = await failurePage.evaluate(async () => {
    let rejected = false
    try { await globalThis.__atlHoeProduction?.prepare() } catch { rejected = true }
    return { rejected, status: globalThis.__atlHoeProduction?.status() }
  })
  await failurePage.close()
  // A missing model is reported by the shared Three module as a degraded module carrying CINEMA2_THREE_ASSET_LOAD_FAILED (the module stays
  // resident and diagnosable rather than crashing the runtime); a hard module failure is also acceptable.
  const assetDiagnostics = assetFailure.status?.modules?.modules?.flatMap(module => module.diagnostics?.map(entry => entry.code) ?? []) ?? []
  const modulesReported = (assetFailure.status?.modules?.failedModuleCount ?? 0) + (assetFailure.status?.modules?.degradedModuleCount ?? 0)
  if (!assetFailure.rejected || modulesReported < 1 || !assetDiagnostics.includes('CINEMA2_THREE_ASSET_LOAD_FAILED')) {
    throw new Error('Missing ATL HOE model did not produce an asset-load diagnostic on its module.')
  }

  await writeFile(join(output, 'contact-sheet.html'), contactSheet(captures))
  const manifest = {
    schemaVersion: 1,
    preset: 'drmvyz.cinema2.atl-hoe',
    source: args.audio.length ? { mode: 'local-audio', tracks: args.audio.map(path => basename(path)) } : { mode: 'deterministic-tuning-matrix' },
    ownerApprovalRequired: true,
    acceptance: { viewports, matrix, captures, sustainedPlayback: longRun, lifecycle: { paused, resumed, sought, replaced, resized, recovered }, assetFailure: { rejected: assetFailure.rejected, diagnostics: assetDiagnostics } },
  }
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`ATL HOE production acceptance: ${relative(root, output)}`)
  if (!args.audio.length) console.log('Real-track owner approval remains open: rerun with one or more --audio paths and review contact-sheet.html.')
} finally {
  await browser?.close()
  await vite.close()
  if (audioServer) await new Promise(resolvePromise => audioServer.server.close(resolvePromise))
}
