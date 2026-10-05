#!/usr/bin/env node
// Deterministic Phase 0 visual checkpoints for ATL HOE. Output is git-ignored.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const artifactRoot = join(root, 'artifacts/cinema2-atl-hoe-visual-acceptance')
const referenceArgument = process.argv.find(argument => argument.startsWith('--reference='))
const opacityArgument = process.argv.find(argument => argument.startsWith('--reference-opacity='))
const onlyArgument = process.argv.find(argument => argument.startsWith('--only='))
const supported = new Set([referenceArgument, opacityArgument, onlyArgument].filter(Boolean))
const unsupported = process.argv.slice(2).filter(argument => !supported.has(argument))
if (unsupported.length) throw new Error('Supported options: --only=checkpoint[,checkpoint], --reference=/path/image, --reference-opacity=0..1.')

const referencePath = referenceArgument ? resolve(root, referenceArgument.slice('--reference='.length)) : null
const referenceOpacity = opacityArgument ? Number(opacityArgument.slice('--reference-opacity='.length)) : 0.5
if (!Number.isFinite(referenceOpacity) || referenceOpacity < 0 || referenceOpacity > 1) {
  throw new Error('--reference-opacity must be a number between 0 and 1.')
}

const checkpoints = [
  { checkpoint: 'before-primary-16x9-high', width: 1920, height: 1080, quality: 'high', purpose: 'Primary authored composition' },
  { checkpoint: 'before-embedded-stage-tall-high', width: 1000, height: 1200, quality: 'high', purpose: 'Embedded Stage tall/narrow framing' },
  { checkpoint: 'before-primary-16x9-medium', width: 1920, height: 1080, quality: 'medium', purpose: 'Lower-quality degradation review' },
]
const selected = onlyArgument ? new Set(onlyArgument.slice('--only='.length).split(',').filter(Boolean)) : null
const cases = selected ? checkpoints.filter(entry => selected.has(entry.checkpoint)) : checkpoints
if (selected && cases.length !== selected.size) {
  throw new Error(`Unknown --only checkpoint. Available checkpoints: ${checkpoints.map(entry => entry.checkpoint).join(', ')}`)
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function mimeFor(path) {
  const extension = extname(path).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  return 'image/png'
}

async function measureScreenshot(page, pngBuffer) {
  return page.evaluate(async png => {
    const bytes = Uint8Array.from(atob(png), character => character.charCodeAt(0))
    const bitmap = await globalThis.createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const analysisCanvas = globalThis.document.createElement('canvas')
    analysisCanvas.width = bitmap.width
    analysisCanvas.height = bitmap.height
    const context2d = analysisCanvas.getContext('2d', { willReadFrequently: true })
    if (!context2d) throw new Error('ATL HOE screenshot pixel analysis is unavailable.')
    context2d.drawImage(bitmap, 0, 0)
    const pixels = context2d.getImageData(0, 0, bitmap.width, bitmap.height).data
    const luminances = []
    let visiblyLit = 0
    for (let pixel = 0; pixel < pixels.length; pixel += 16) {
      const luminance = (0.2126 * pixels[pixel] + 0.7152 * pixels[pixel + 1] + 0.0722 * pixels[pixel + 2]) / 255
      luminances.push(luminance)
      if (luminance >= 0.04) visiblyLit += 1
    }
    luminances.sort((a, b) => a - b)
    const percentile = fraction => luminances[Math.floor((luminances.length - 1) * fraction)] ?? 0
    const metrics = {
      sampleCount: luminances.length,
      medianSrgbLuma: Number(percentile(0.5).toFixed(4)),
      p95SrgbLuma: Number(percentile(0.95).toFixed(4)),
      p99SrgbLuma: Number(percentile(0.99).toFixed(4)),
      maximumSrgbLuma: Number((luminances.at(-1) ?? 0).toFixed(4)),
      visiblyLitFraction: Number((visiblyLit / luminances.length).toFixed(4)),
    }
    bitmap.close()
    return metrics
  }, pngBuffer.toString('base64'))
}

await mkdir(artifactRoot, { recursive: true })
const output = await mkdtemp(join(artifactRoot, 'run-'))
const referenceDataUrl = referencePath
  ? `data:${mimeFor(referencePath)};base64,${(await readFile(referencePath)).toString('base64')}`
  : null
const assetBytes = await readFile(join(root, 'public/cinema2/models/atl-hoe.glb'))
const assetRevision = Object.freeze({
  path: 'public/cinema2/models/atl-hoe.glb',
  bytes: assetBytes.byteLength,
  sha256: sha256(assetBytes),
})
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  clearScreen: false,
})
let browser
let context
try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local ATL HOE capture port.')
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-atl-hoe-visual-acceptance.html`
  browser = await chromium.launch({ headless: true })
  context = await browser.newContext({ deviceScaleFactor: 1 })
  const results = []

  for (const entry of cases) {
    const page = await context.newPage()
    await page.setViewportSize({ width: entry.width, height: entry.height })
    const browserErrors = []
    page.on('pageerror', error => browserErrors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()) })
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('checkpoint', entry.checkpoint)
      url.searchParams.set('quality', entry.quality)
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(globalThis.__cinema2AtlHoeVisualAcceptance), undefined, { timeout: 30_000 })
      const status = await page.evaluate(() => globalThis.__cinema2AtlHoeVisualAcceptance.prepare())
      if (browserErrors.length) throw new Error(browserErrors.join('\n'))

      const filename = `${entry.checkpoint}.png`
      const canvas = page.locator('#atl-hoe-capture')
      const first = await canvas.screenshot({ path: join(output, filename), timeout: 120_000 })
      const second = await canvas.screenshot({ timeout: 120_000 })
      const firstHash = sha256(first)
      const secondHash = sha256(second)
      if (firstHash !== secondHash) throw new Error('Fixed-time duplicate captures did not produce the same image hash.')
      const imageMetrics = await measureScreenshot(page, first)
      if (imageMetrics.p99SrgbLuma < 0.04 || imageMetrics.maximumSrgbLuma < 0.12) {
        throw new Error(`Captured frame has no credible visible scene (p99=${imageMetrics.p99SrgbLuma}, max=${imageMetrics.maximumSrgbLuma}).`)
      }

      let overlayFilename = null
      if (referenceDataUrl) {
        await page.evaluate(
          ({ source, opacity }) => globalThis.__cinema2AtlHoeVisualAcceptance.setReferenceOverlay(source, opacity),
          { source: referenceDataUrl, opacity: referenceOpacity },
        )
        overlayFilename = `${entry.checkpoint}-reference-overlay.png`
        await page.locator('#atl-hoe-capture-frame').screenshot({ path: join(output, overlayFilename), timeout: 120_000 })
      }

      results.push({
        ...entry,
        filename,
        overlayFilename,
        imageSha256: firstHash,
        duplicateCaptureSha256: secondHash,
        reproducible: true,
        imageMetrics,
        assetRevision,
        status,
      })
      console.log(`${entry.checkpoint}: ${firstHash.slice(0, 12)} (${entry.width}x${entry.height}, ${entry.quality})`)
    } catch (error) {
      const diagnostics = browserErrors.length ? ` Browser errors: ${browserErrors.join(' | ')}` : ''
      throw new Error(`${entry.checkpoint}: ${error instanceof Error ? error.message : String(error)}${diagnostics}`, { cause: error })
    } finally {
      await page.close()
    }
  }

  const gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const gitStatus = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    gitCommit,
    workingTreeDirty: gitStatus.length > 0,
    assetRevision,
    referenceOverlay: referencePath ? { sourceFilename: basename(referencePath), opacity: referenceOpacity, persistedInRepository: false } : null,
    results,
  }
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const rows = results.map(result => (
    `| [${result.checkpoint}](${result.filename}) | ${result.width}×${result.height} | ${result.quality} | ${result.status.runtime.visualTimeSec.toFixed(1)} s | \`${result.imageSha256.slice(0, 12)}\` | yes |`
  )).join('\n')
  await writeFile(join(output, 'index.md'), `# ATL HOE Phase 0 visual baseline\n\nThis is the explicit **before** baseline for preset revision ${results[0]?.status.preset.revision ?? 'unknown'}. Captures use DPR 1, a deterministic random seed, a static camera, fixed quality, and a controlled Cinema 2.0 clock stopped at the capture time. Each canvas was captured twice without advancing the clock; matching SHA-256 hashes are required.\n\nAsset revision: \`${assetRevision.sha256}\` (${assetRevision.bytes} bytes). Git commit: \`${gitCommit}\`${gitStatus.length ? ' with uncommitted Phase 0/prototype work' : ''}.\n\n| Checkpoint | Viewport | Quality | Visual time | Image hash | Duplicate stable |\n| --- | ---: | --- | ---: | --- | --- |\n${rows}\n\nSee [manifest.json](manifest.json) for authored and resolved camera data, FOV/aspect policy, exposure/environment, effect settings, module state, renderer quality, asset revision, pixel-content diagnostics, and full image hashes.${referencePath ? ' Development-only overlay images are included in this run; the source reference was not copied into the repository.' : ''}\n`)
  console.log(`ATL HOE capture set: ${relative(root, output)}`)
} finally {
  await context?.close()
  await browser?.close()
  await server.close()
}
