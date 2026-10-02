#!/usr/bin/env node
// Repeatable visual diagnostics for CONDUIT step 1. Writes only to a unique, git-ignored artifacts/ run directory.
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '../..')
const artifactRoot = join(root, 'artifacts/cinema2-conduit-baseline')
const smoke = process.argv.includes('--smoke')
const onlyArgument = process.argv.find(argument => argument.startsWith('--only='))
if (process.argv.some(argument => argument.startsWith('--') && argument !== '--smoke' && argument !== onlyArgument)) throw new Error('Supported options: --smoke or --only=case-label[,case-label].')
if (smoke && onlyArgument) throw new Error('Use --smoke or --only, not both.')

const views = [
  { name: 'reference-16x9', width: 1672, height: 944 },
  { name: 'narrow-stage', width: 1000, height: 1000 },
]
const tiers = ['low', 'medium', 'high']
const states = ['steady', 'peak']
const diagnosticVariants = ['scene-only', 'no-floor', 'no-haze', 'no-bloom', 'no-studio', 'no-led', 'chamber-only', 'tubes-only', 'wordmark-only']
const matrix = smoke
  ? [
      { view: views[0], quality: 'high', state: 'steady', variant: 'baseline' },
      { view: views[0], quality: 'high', state: 'peak', variant: 'baseline' },
      { view: views[0], quality: 'high', state: 'steady', variant: 'no-studio' },
      { view: views[0], quality: 'high', state: 'steady', variant: 'wordmark-only' },
    ]
  : [
      ...views.flatMap(view => tiers.flatMap(quality => states.map(state => ({ view, quality, state, variant: 'baseline' })))),
      ...diagnosticVariants.map(variant => ({ view: views[0], quality: 'high', state: 'steady', variant })),
      { view: views[0], quality: 'high', state: 'idle', variant: 'baseline' },
      { view: views[0], quality: 'high', state: 'steady', variant: 'baseline', color: 'blue' },
      { view: views[0], quality: 'high', state: 'peak', variant: 'baseline', color: 'blue' },
    ]
const labelOf = entry => `${entry.view.name}-${entry.quality}-${entry.state}-${entry.variant}${entry.color ? `-${entry.color}` : ''}`
const selectedLabels = onlyArgument ? new Set(onlyArgument.slice('--only='.length).split(',')) : null
const cases = selectedLabels
  ? matrix.filter(entry => selectedLabels.has(labelOf(entry)))
  : matrix
if (selectedLabels && cases.length !== selectedLabels.size) throw new Error(`Unknown --only case label. Available labels: ${matrix.map(labelOf).join(', ')}`)

/** Coarse spatial diagnostics, not semantic masks or a perceptual match score. */
const regions = {
  frame: [0, 0, 1, 1],
  upperChamber: [0.2, 0.03, 0.8, 0.3],
  wordmarkArea: [0.27, 0.31, 0.73, 0.65],
  floor: [0.05, 0.76, 0.95, 0.98],
}

async function measureScreenshot(page, pngBuffer) {
  return page.evaluate(async ({ png, regions }) => {
    const bytes = Uint8Array.from(atob(png), character => character.charCodeAt(0))
    const bitmap = await globalThis.createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = globalThis.document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('2D pixel analysis is unavailable.')
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data
    const metrics = {}
    for (const [name, [x0, y0, x1, y1]] of Object.entries(regions)) {
      const luminances = []
      let clipped = 0
      let warm = 0
      for (let y = Math.floor(y0 * bitmap.height); y < Math.floor(y1 * bitmap.height); y += 3) {
        for (let x = Math.floor(x0 * bitmap.width); x < Math.floor(x1 * bitmap.width); x += 3) {
          const index = (y * bitmap.width + x) * 4
          const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2]
          luminances.push((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255)
          if (r >= 250 && g >= 250 && b >= 250) clipped += 1
          if (r > 100 && r > g * 1.12 && g > b * 1.18) warm += 1
        }
      }
      luminances.sort((a, b) => a - b)
      const percentile = fraction => Number((luminances[Math.floor((luminances.length - 1) * fraction)] ?? 0).toFixed(4))
      metrics[name] = {
        samples: luminances.length,
        medianSrgbLuma: percentile(0.5),
        p95SrgbLuma: percentile(0.95),
        nearWhiteFraction: Number((clipped / luminances.length).toFixed(4)),
        warmPixelFraction: Number((warm / luminances.length).toFixed(4)),
      }
    }
    bitmap.close()
    return metrics
  }, { png: pngBuffer.toString('base64'), regions })
}

await mkdir(artifactRoot, { recursive: true })
const output = await mkdtemp(join(artifactRoot, 'run-'))
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
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local port.')
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-conduit-baseline.html`
  browser = await chromium.launch({ headless: true })
  context = await browser.newContext({ deviceScaleFactor: 1 })
  const results = []
  for (const entry of cases) {
    const { view, quality, state, variant, color } = entry
    const label = labelOf(entry)
    const page = await context.newPage()
    await page.setViewportSize({ width: view.width, height: view.height })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', quality)
      url.searchParams.set('state', state)
      url.searchParams.set('variant', variant)
      if (color) url.searchParams.set('color', color)
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => {
        const capture = globalThis.__conduitCapture
        if (!capture) return false
        const status = capture.status()
        return status.frameCount >= 45 && status.modules.estimatedGpuBytes > 0
      }, undefined, { timeout: 120_000 })
      // Give the 3D bridge and HDR/effect passes time to complete after the first GPU allocation.
      await page.waitForTimeout(350)
      if (state === 'peak') {
        await page.evaluate(() => globalThis.__conduitCapture.triggerPeak())
        await page.waitForTimeout(180)
      }
      const status = await page.evaluate(() => globalThis.__conduitCapture.status())
      if (errors.length) throw new Error(errors.join('\n'))
      if (status.performance.resolvedQuality !== quality) throw new Error(`Expected ${quality} quality, got ${status.performance.resolvedQuality}.`)
      if (status.modules.failedModuleCount > 0) throw new Error('The 3D module reported a load/render failure.')
      const filename = `${label}.png`
      const screenshot = await page.locator('#conduit-capture').screenshot({ path: join(output, filename), timeout: 120_000 })
      const metrics = await measureScreenshot(page, screenshot)
      results.push({ label, view, quality, state, variant, color: color ?? 'default', filename, status, metrics })
      console.log(`${label}: wordmark median ${metrics.wordmarkArea.medianSrgbLuma}, floor median ${metrics.floor.medianSrgbLuma}`)
    } catch (error) {
      const diagnostics = errors.length ? ` Browser errors: ${errors.join(' | ')}` : ''
      throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}${diagnostics}`, { cause: error })
    } finally {
      await page.close()
    }
  }
  const gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, gitCommit, generatedAt: new Date().toISOString(), smoke, regions, results }, null, 2)}\n`)
  const rows = results.map(result => `| [${result.label}](${result.filename}) | ${result.metrics.wordmarkArea.medianSrgbLuma} | ${result.metrics.floor.medianSrgbLuma} | ${result.metrics.frame.nearWhiteFraction} |`).join('\n')
  await writeFile(join(output, 'index.md'), `# CONDUIT diagnostic captures\n\nGit commit: \`${gitCommit}\`. Mode: ${smoke ? 'smoke' : selectedLabels ? 'selected cases' : 'complete matrix'}. Camera Movement = 0, Zoom on Kick = off, Auto Performance = off, Flicker = 0. Steady uses Pulse with Master Intensity = 0 (fixed 0.35 segment level); idle uses Energy Flow with Master Intensity = 1 and no audio energy; peak uses Pulse with Master Intensity = 1 and a controlled synthetic drop/maximum energy input. Blue cases change only Energy Color. These are diagnostic states, not a measured song.\n\nThe table uses broad image rectangles, not material masks. Values are approximate sRGB luminance fractions (0–1); near-white means all RGB channels are at least 250/255. See [manifest.json](manifest.json) for regions, p95 values, warm-pixel fractions, quality, viewport, and runtime diagnostics. No pass is a pixel-perfect target comparison.\n\n| Capture | Wordmark-area median | Floor median | Frame near-white fraction |\n| --- | ---: | ---: | ---: |\n${rows}\n\nDiagnostic variants preserve the first-party manifest and alter only a temporary capture copy: scene-only bypasses all effects; no-floor/no-haze/no-bloom bypass one effect; no-studio removes the studio environment response and area panels; no-led disables segment emission and energy point lights; asset-only views keep just the chamber, tubes, or wordmark. They are isolation tools, not proposed production settings.\n`)
  console.log(`Capture set: ${relative(root, output)}`)
} finally {
  await context?.close()
  await browser?.close()
  await server.close()
}
