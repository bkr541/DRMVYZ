#!/usr/bin/env node
// Browser acceptance for the Cinema 2.0 rendering upgrade (ambient occlusion, anti-aliasing, shadows, environments, compressed assets, LOD, instancing,
// animation, diagnostics, context recovery) on the developer-only validation scene. It is a real GPU run in Chrome, with image measurements.
//
//   npm run visual:render-upgrade [-- --tiers high,medium,low] [-- --quick]
//
// Output goes to artifacts/cinema2-render-validation/run-*/ (git-ignored): PNG captures, report.json and contact-sheet.html.
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const artifactRoot = join(root, 'artifacts/cinema2-render-validation')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')

const argument = name => { const index = process.argv.indexOf(`--${name}`); return index >= 0 ? process.argv[index + 1] : null }
const tiers = (argument('tiers') ?? 'high,medium,low').split(',')
const quick = process.argv.includes('--quick')
const VIEWPORT = { width: 1600, height: 900 }

// ---------------------------------------------------------------- measurements

const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

async function crop(buffer, rect) {
  const meta = await sharp(buffer).metadata()
  const left = Math.max(0, Math.min(meta.width - 1, Math.floor(rect.x)))
  const top = Math.max(0, Math.min(meta.height - 1, Math.floor(rect.y)))
  const width = Math.max(1, Math.min(meta.width - left, Math.floor(rect.width)))
  const height = Math.max(1, Math.min(meta.height - top, Math.floor(rect.height)))
  const { data, info } = await sharp(buffer).extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

async function stats(buffer, rect) {
  const { data, width, height } = await crop(buffer, rect ?? { x: 0, y: 0, width: 99999, height: 99999 })
  const values = new Float64Array(width * height)
  let sum = 0
  let max = 0
  let min = 1
  for (let pixel = 0; pixel < values.length; pixel += 1) {
    const value = luma(data[pixel * 3], data[pixel * 3 + 1], data[pixel * 3 + 2])
    values[pixel] = value
    sum += value
    max = Math.max(max, value)
    min = Math.min(min, value)
  }
  const sorted = Float64Array.from(values).sort()
  const lo = sorted[Math.floor(sorted.length * 0.02)]
  const hi = sorted[Math.floor(sorted.length * 0.98)]
  let mid = 0
  let absoluteMid = 0
  let bright = 0
  for (const value of values) {
    if (value > lo + 0.15 * (hi - lo) && value < lo + 0.85 * (hi - lo)) mid += 1
    if (value > 0.14 && value < 0.86) absoluteMid += 1
    if (value >= 0.9) bright += 1
  }
  // Variance of a Laplacian: how much fine detail the region still has (blur lowers it).
  let laplacian = 0
  let count = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = values[y * width + x]
      const l = values[y * width + x - 1] + values[y * width + x + 1] + values[(y - 1) * width + x] + values[(y + 1) * width + x] - 4 * center
      laplacian += l * l
      count += 1
    }
  }
  return { mean: sum / values.length, max, min, midFraction: mid / values.length, edgeRatio: absoluteMid / (bright + 1), detail: count ? laplacian / count : 0, width, height }
}

async function meanAbsDifference(a, b, rect) {
  const first = await crop(a, rect ?? { x: 0, y: 0, width: 99999, height: 99999 })
  const second = await crop(b, rect ?? { x: 0, y: 0, width: 99999, height: 99999 })
  if (first.width !== second.width || first.height !== second.height) return Infinity
  let total = 0
  for (let index = 0; index < first.data.length; index += 1) total += Math.abs(first.data[index] - second.data[index])
  return total / first.data.length
}

/** Exact 2x2 box average of a PNG (the supersampling resolve), returned as a PNG of half the size. */
async function boxDownsample2x(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const width = info.width >> 1
  const height = info.height >> 1
  const out = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        const at = (yy, xx) => data[((y * 2 + yy) * info.width + (x * 2 + xx)) * 3 + channel]
        out[(y * width + x) * 3 + channel] = Math.round((at(0, 0) + at(0, 1) + at(1, 0) + at(1, 1)) / 4)
      }
    }
  }
  return sharp(out, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

/** Mean absolute error (0..255) against `reference`, over the pixels of `rect` where any of `candidates` is more than `threshold` away from it. */
async function edgeError(reference, candidates, rect, threshold = 12) {
  const ref = await crop(reference, rect)
  const crops = await Promise.all(candidates.map(candidate => crop(candidate, rect)))
  const sums = candidates.map(() => 0)
  let count = 0
  for (let pixel = 0; pixel < ref.width * ref.height; pixel += 1) {
    const deltas = crops.map(candidate => Math.max(Math.abs(candidate.data[pixel * 3] - ref.data[pixel * 3]), Math.abs(candidate.data[pixel * 3 + 1] - ref.data[pixel * 3 + 1]), Math.abs(candidate.data[pixel * 3 + 2] - ref.data[pixel * 3 + 2])))
    if (Math.max(...deltas) <= threshold) continue
    count += 1
    deltas.forEach((delta, index) => { sums[index] += delta })
  }
  return { pixels: count, errors: sums.map(sum => (count ? sum / count : 0)) }
}

/** How many pixels in `rect` are darker in `b` than in `a` by more than `delta` (0..1 luma). */
async function countDarker(a, b, rect, delta) {
  const first = await crop(a, rect)
  const second = await crop(b, rect)
  let count = 0
  for (let pixel = 0; pixel < first.width * first.height; pixel += 1) {
    if (luma(first.data[pixel * 3], first.data[pixel * 3 + 1], first.data[pixel * 3 + 2]) - luma(second.data[pixel * 3], second.data[pixel * 3 + 1], second.data[pixel * 3 + 2]) > delta) count += 1
  }
  return count
}

// ---------------------------------------------------------------- run

const results = []
const failures = []
function check(tier, name, ok, detail = '') {
  results.push({ tier, name, ok, detail })
  if (!ok) failures.push(`${tier}: ${name}${detail ? ` (${detail})` : ''}`)
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${tier}] ${name}${detail ? `  ${detail}` : ''}`)
}
const fixed = value => (typeof value === 'number' ? Number(value.toFixed(4)) : value)

await mkdir(artifactRoot, { recursive: true })
const output = await mkdtemp(join(artifactRoot, 'run-'))
const vite = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false, watch: null, hmr: false }, clearScreen: false })
let browser
const captures = []
const report = { generatedAt: new Date().toISOString(), tiers: {}, viewport: VIEWPORT }

try {
  await vite.listen()
  const address = vite.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local port.')
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-render-validation.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] })

  for (const tier of tiers) {
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 })
    page.setDefaultTimeout(240_000)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    const missing = []
    page.on('response', response => { if (response.status() === 404 && !response.url().endsWith('/favicon.ico')) missing.push(response.url()) })
    page.on('console', message => { if (message.type() === 'error' && !/status of 404/.test(message.text())) pageErrors.push(message.text()) })
    const url = new URL(baseUrl)
    url.searchParams.set('quality', tier)
    await page.goto(url.href, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => Boolean(globalThis.__cinema2RenderValidation), undefined, { timeout: 60_000 })
    const api = (method, ...args) => page.evaluate(([name, params]) => globalThis.__cinema2RenderValidation[name](...params), [method, args])
    const shoot = async name => {
      const bytes = await page.locator('#cinema2-render-validation').screenshot({ timeout: 120_000 })
      await writeFile(join(output, `${tier}-${name}.png`), bytes)
      captures.push({ tier, name, file: `${tier}-${name}.png` })
      return bytes
    }
    const rect = async name => api('screenRect', name)
    const tierReport = (report.tiers[tier] = { measurements: {} })

    const initial = await api('prepare')
    check(tier, 'scene prepares without page errors or missing files', pageErrors.length === 0 && initial.errors.length === 0 && missing.length === 0, pageErrors.concat(missing).slice(0, 2).join(' | '))
    check(tier, 'all four model encodings load (uncompressed, Meshopt, Draco, KTX2) and the animated model keeps its clips', ['plain', 'meshopt', 'draco', 'ktx2', 'animated'].every(key => initial.assets[key]?.triangles > 0)
      && JSON.stringify(initial.assets.animated.clips.sort()) === JSON.stringify(['bend', 'breathe', 'spin']), JSON.stringify(Object.fromEntries(Object.entries(initial.assets).map(([key, asset]) => [key, asset.triangles]))))
    check(tier, 'Draco and Basis decoders were created lazily by the models that need them', initial.decoders.created.draco >= 1 && initial.decoders.created.ktx2 >= 1, JSON.stringify(initial.decoders.created))
    check(tier, 'custom vertex attributes survive every geometry encoding', ['plain', 'meshopt', 'draco', 'ktx2'].every(key => initial.assets[key].customAttributes.includes('_glow_phase')))
    check(tier, 'skinned strip and nodes are preserved', initial.assets.animated.skins === 1 && ['gear', 'blob', 'strip'].every(node => initial.assets.animated.nodes.includes(node)))

    // ---- baseline
    await api('setFeatures', { ambientOcclusion: false, antiAliasing: 'off', shadows: false, environment: 'studio', model: 'plain', occlusionOnly: false })
    const baseline = await shoot('baseline')
    const baselineStatus = await api('renderFrames', 30)
    const blockRect = await rect('recessedBlock')
    const panelRect = await rect('diagonalPanel')
    const chromeRect = await rect('chromeSphere')
    const modelRect = await rect('texturedModelSlot')
    const floorRect = await rect('shadowFloor')
    const skyRect = { x: 0, y: 0, width: VIEWPORT.width, height: Math.floor(VIEWPORT.height * 0.06) }
    tierReport.rects = { blockRect, panelRect, chromeRect, modelRect, floorRect }
    tierReport.baseline = { draws: baselineStatus.diagnostics.draw, resources: baselineStatus.diagnostics.resources.estimatedGpuBytes, shaders: baselineStatus.diagnostics.shaders }
    check(tier, 'baseline renders with diagnostics (draw calls, triangles, GPU memory, frame time)', baselineStatus.diagnostics.draw.drawCalls > 5 && baselineStatus.diagnostics.draw.triangles > 20000
      && baselineStatus.diagnostics.resources.estimatedGpuBytes > 1_000_000 && baselineStatus.diagnostics.frame.averageMs > 0, `${baselineStatus.diagnostics.draw.drawCalls} draws, ${baselineStatus.diagnostics.draw.triangles} tris, ${(baselineStatus.diagnostics.resources.estimatedGpuBytes / 1048576).toFixed(1)} MB, ${baselineStatus.diagnostics.frame.averageMs.toFixed(1)} ms`)
    const baseDraws = baselineStatus.diagnostics.draw.drawCalls

    // ---- ambient occlusion
    const linkedBeforeAo = (await api('status')).diagnostics.shaders.linkedTotal
    await api('setFeatures', { ambientOcclusion: true })
    const ao = await shoot('ao')
    const aoStats = { block: await stats(ao, blockRect), blockBase: await stats(baseline, blockRect), sky: await meanAbsDifference(ao, baseline, skyRect), panelMax: (await stats(ao, panelRect)).max, panelBaseMax: (await stats(baseline, panelRect)).max }
    const aoDraws = (await api('renderFrames', 2)).diagnostics.draw.drawCalls
    tierReport.measurements.ambientOcclusion = { ...aoStats, draws: aoDraws, baseDraws }
    if (tier === 'low') {
      const linked = (await api('status')).diagnostics.shaders.linkedTotal - linkedBeforeAo
      check(tier, 'ambient occlusion is disabled on the low tier: image identical to baseline, a one-pass pass-through copy, and only that one copy shader is compiled', await meanAbsDifference(ao, baseline) === 0 && aoDraws === baseDraws + 1 && linked === 1, `extra draws ${aoDraws - baseDraws}, shaders linked ${linked}`)
    } else {
      check(tier, 'ambient occlusion darkens the crevices of the recessed block', aoStats.block.mean < aoStats.blockBase.mean * 0.985, `${aoStats.blockBase.mean.toFixed(4)} -> ${aoStats.block.mean.toFixed(4)}`)
      check(tier, 'ambient occlusion leaves the empty background untouched', aoStats.sky === 0, `sky delta ${aoStats.sky.toFixed(4)}`)
      check(tier, 'ambient occlusion keeps bright emissive lines at full brightness', aoStats.panelMax >= aoStats.panelBaseMax * 0.97, `${aoStats.panelBaseMax.toFixed(3)} -> ${aoStats.panelMax.toFixed(3)}`)
      check(tier, 'ambient occlusion costs exactly three extra passes (occlusion, blur, composite) and compiles exactly its three shaders', aoDraws === baseDraws + 3 && (await api('status')).diagnostics.shaders.linkedTotal - linkedBeforeAo === 3, `${baseDraws} -> ${aoDraws} draws, shaders linked ${(await api('status')).diagnostics.shaders.linkedTotal - linkedBeforeAo}`)
      await api('setFeatures', { occlusionOnly: true })
      const occlusion = await shoot('ao-buffer')
      const occlusionBlock = await stats(occlusion, blockRect)
      const occlusionSky = await stats(occlusion, skyRect)
      check(tier, 'the occlusion buffer is darker in the crevices and exactly white on the background (no halos)', occlusionBlock.min < 0.8 && occlusionSky.min > 0.99, `block min ${occlusionBlock.min.toFixed(3)}, sky min ${occlusionSky.min.toFixed(3)}`)
      await api('setFeatures', { occlusionOnly: false })
    }

    // ---- anti-aliasing
    // Ground truth for anti-aliasing: the same frame rendered at 2x2 supersampling and averaged down by the browser's own compositor scaling.
    await api('setFeatures', { ambientOcclusion: false, antiAliasing: 'off' })
    await page.setViewportSize({ width: VIEWPORT.width * 2, height: VIEWPORT.height * 2 })
    await api('resize', VIEWPORT.width * 2, VIEWPORT.height * 2)
    const reference = await boxDownsample2x(await page.locator('#cinema2-render-validation').screenshot({ timeout: 120_000 }))
    await writeFile(join(output, `${tier}-aa-reference-2x.png`), reference)
    captures.push({ tier, name: 'aa-reference-2x', file: `${tier}-aa-reference-2x.png` })
    await page.setViewportSize(VIEWPORT)
    await api('resize', VIEWPORT.width, VIEWPORT.height)
    // The anti-aliasing shaders are fetched with a dynamic import the first time the effect renders; until they arrive it passes the image through,
    // so give the (dev-server transformed) modules time to land before measuring.
    await api('setFeatures', { ambientOcclusion: false, antiAliasing: 'fxaa' })
    await page.waitForTimeout(4000)
    await api('renderFrames', 2)
    const fxaaStatus = await api('renderFrames', 3)
    const fxaa = await shoot('fxaa')
    await api('setFeatures', { antiAliasing: 'smaa' })
    await page.waitForTimeout(1500)
    await api('renderFrames', 2)
    const smaaStatus = await api('renderFrames', 3)
    const smaa = await shoot('smaa')
    const off = baseline
    const panel = { off: await stats(off, panelRect), fxaa: await stats(fxaa, panelRect), smaa: await stats(smaa, panelRect) }
    const textured = { off: await stats(off, modelRect), smaa: await stats(smaa, modelRect), fxaa: await stats(fxaa, modelRect) }
    tierReport.measurements.antiAliasing = { panel, textured, draws: { off: baseDraws, fxaa: fxaaStatus.diagnostics.draw.drawCalls, smaa: smaaStatus.diagnostics.draw.drawCalls } }
    check(tier, 'FXAA and SMAA both change the image (the effects are really running)', (await meanAbsDifference(fxaa, baseline)) > 0.01 && (await meanAbsDifference(smaa, baseline)) > 0.01 && (await meanAbsDifference(fxaa, smaa)) > 0.005, `fxaa ${(await meanAbsDifference(fxaa, baseline)).toFixed(3)}, smaa ${(await meanAbsDifference(smaa, baseline)).toFixed(3)}`)
    // Judge anti-aliasing on solid silhouette edges (the bottom edge of the panel, below the bar tips): a line thinner than a pixel cannot be
    // recovered by any post-process and is only reported.
    const silhouetteRect = { x: panelRect.x, y: panelRect.y + panelRect.height * 0.86, width: panelRect.width, height: panelRect.height * 0.14 }
    const thinLines = await edgeError(reference, [off, fxaa, smaa], { x: panelRect.x, y: panelRect.y, width: panelRect.width, height: panelRect.height * 0.6 })
    tierReport.measurements.antiAliasing.thinLineError = { off: thinLines.errors[0], fxaa: thinLines.errors[1], smaa: thinLines.errors[2], pixels: thinLines.pixels }
    const edge = await edgeError(reference, [off, fxaa, smaa], silhouetteRect, 8)
    const referenceError = { off: edge.errors[0], fxaa: edge.errors[1], smaa: edge.errors[2], edgePixels: edge.pixels }
    tierReport.measurements.antiAliasing.referenceError = referenceError
    check(tier, 'FXAA brings the silhouette edges closer to the 2x supersampled reference', referenceError.fxaa < referenceError.off * 0.85, `edge error ${referenceError.off.toFixed(2)} -> ${referenceError.fxaa.toFixed(2)} over ${edge.pixels} pixels`)
    check(tier, 'SMAA brings the silhouette edges closer to the 2x supersampled reference', referenceError.smaa < referenceError.off * 0.85, `edge error ${referenceError.off.toFixed(2)} -> ${referenceError.smaa.toFixed(2)} over ${edge.pixels} pixels`)
    check(tier, 'anti-aliasing keeps bright emissive edges (peak brightness preserved)', panel.fxaa.max >= panel.off.max * 0.9 && panel.smaa.max >= panel.off.max * 0.9, `off ${panel.off.max.toFixed(3)}, fxaa ${panel.fxaa.max.toFixed(3)}, smaa ${panel.smaa.max.toFixed(3)}`)
    check(tier, 'anti-aliasing keeps most of the fine detail of a textured surface (SMAA at least 50%, FXAA at least 30%: FXAA is known to be the softer of the two)', textured.smaa.detail >= textured.off.detail * 0.5 && textured.fxaa.detail >= textured.off.detail * 0.3, `detail off ${textured.off.detail.toExponential(2)}, smaa ${textured.smaa.detail.toExponential(2)}, fxaa ${textured.fxaa.detail.toExponential(2)}`)
    check(tier, 'anti-aliasing leaves the empty background untouched', (await meanAbsDifference(smaa, baseline, skyRect)) === 0 && (await meanAbsDifference(fxaa, baseline, skyRect)) === 0)
    check(tier, 'FXAA replaces the final copy (no extra draw); SMAA adds two passes', fxaaStatus.diagnostics.draw.drawCalls === baseDraws && smaaStatus.diagnostics.draw.drawCalls === baseDraws + 2, `${baseDraws} / ${fxaaStatus.diagnostics.draw.drawCalls} / ${smaaStatus.diagnostics.draw.drawCalls}`)
    const auto = await api('setFeatures', { antiAliasing: 'auto' })
    check(tier, 'auto anti-aliasing follows the tier (FXAA on low, SMAA above)', auto.resolved.antiAliasing === (tier === 'low' ? 'fxaa' : 'smaa'), auto.resolved.antiAliasing)

    // ---- shadows
    await api('setFeatures', { antiAliasing: 'off', shadows: false })
    const unshadowed = await shoot('shadows-off')
    const shadowStatus = await api('setFeatures', { shadows: true })
    await api('renderFrames', 3)
    const shadowed = await shoot('shadows-on')
    const floorOff = await stats(unshadowed, floorRect)
    const floorOn = await stats(shadowed, floorRect)
    const expectedMap = { low: 512, medium: 1024, high: 2048 }[tier]
    tierReport.measurements.shadows = { floorOff: floorOff.mean, floorOn: floorOn.mean, mapSize: shadowStatus.shadow.mapSize }
    const shadowPixels = await countDarker(unshadowed, shadowed, floorRect, 0.04)
    tierReport.measurements.shadows.shadowPixels = shadowPixels
    check(tier, 'shadows add soft shadow pixels on the floor under and beside the objects', shadowPixels > 2000 && floorOn.mean < floorOff.mean, `${shadowPixels} pixels darker by more than 0.04; mean ${floorOff.mean.toFixed(4)} -> ${floorOn.mean.toFixed(4)}`)
    check(tier, `shadow map resolution follows the tier (${expectedMap})`, shadowStatus.shadow.mapSize === expectedMap, String(shadowStatus.shadow.mapSize))

    // ---- environments
    await api('setFeatures', { shadows: false, environment: 'none' })
    const noEnv = await shoot('env-none')
    await api('setFeatures', { environment: 'studio' })
    const studioEnv = await shoot('env-studio')
    await api('setFeatures', { environment: 'exr' })
    const exrEnv = await shoot('env-exr')
    const chrome3 = { none: await stats(noEnv, chromeRect), studio: await stats(studioEnv, chromeRect), exr: await stats(exrEnv, chromeRect) }
    tierReport.measurements.environment = chrome3
    check(tier, 'the chrome sphere reflects the HDR studio environment and the EXR environment, and both differ from no environment', chrome3.studio.mean > chrome3.none.mean * 1.3 && Math.abs(chrome3.exr.mean - chrome3.studio.mean) > 0.01, `none ${chrome3.none.mean.toFixed(3)}, studio ${chrome3.studio.mean.toFixed(3)}, exr ${chrome3.exr.mean.toFixed(3)}`)
    check(tier, 'the EXR sun (HDR value 40) shows as a hot highlight on the chrome sphere', chrome3.exr.max > 0.85, `max ${chrome3.exr.max.toFixed(3)}`)
    await api('setFeatures', { environment: 'studio' })

    // ---- model encodings render alike
    const encodings = {}
    for (const model of ['plain', 'meshopt', 'draco', 'ktx2']) {
      const status = await api('setFeatures', { model })
      encodings[model] = { bytes: await shoot(`model-${model}`), textures: status.scene.textures }
    }
    const modelDiff = {
      meshopt: await meanAbsDifference(encodings.plain.bytes, encodings.meshopt.bytes, modelRect),
      draco: await meanAbsDifference(encodings.plain.bytes, encodings.draco.bytes, modelRect),
      ktx2: await meanAbsDifference(encodings.plain.bytes, encodings.ktx2.bytes, modelRect),
    }
    tierReport.measurements.modelEncodings = { diff: modelDiff, ktx2Textures: encodings.ktx2.textures }
    check(tier, 'the Meshopt model renders identically to the uncompressed model', modelDiff.meshopt < 0.5, modelDiff.meshopt.toFixed(3))
    check(tier, 'the Draco model renders almost identically (quantization only)', modelDiff.draco < 3, modelDiff.draco.toFixed(3))
    check(tier, 'the KTX2 model renders with the right colors and keeps its normal and metallic-roughness maps', modelDiff.ktx2 < 18 && encodings.ktx2.textures.length >= 3 && encodings.ktx2.textures.every(texture => (texture.slot === 'map' ? texture.colorSpace === 'srgb' : ['', 'srgb-linear'].includes(texture.colorSpace))), `${modelDiff.ktx2.toFixed(2)}; ${JSON.stringify(encodings.ktx2.textures.map(texture => ({ slot: texture.slot, compressed: texture.compressed, cs: texture.colorSpace })))}`)
    await api('setFeatures', { model: 'plain' })

    // ---- instancing, LOD, animation
    const sceneStats = (await api('status')).scene
    check(tier, 'ninety-six instanced bolts cost one draw call', sceneStats.instanced.count === 96 && sceneStats.instanced.drawCalls === 1, JSON.stringify(sceneStats.instanced))
    const near = await api('lodLevelAt', 4)
    const far = await api('lodLevelAt', 120)
    check(tier, 'the LOD shows a finer level near the camera than far away', near < far, `${near} -> ${far}`)
    // The clips are symmetric about t = 1 (the morph weight and the bend go 0 -> 1 -> 0), so compare t = 0.25 with t = 1.0.
    const gear = await rect('blob')
    await api('renderFrames', 1, 0.25)
    const poseA = await shoot('anim-a')
    await api('renderFrames', 1, 1.0)
    const poseB = await shoot('anim-b')
    await api('renderFrames', 1, 0.25)
    const poseAgain = await shoot('anim-a-again')
    check(tier, 'the animated model changes with the timeline and returns to the same pose at the same time', (await meanAbsDifference(poseA, poseB, gear)) > 0.05 && (await meanAbsDifference(poseA, poseAgain, gear)) === 0, `moved ${(await meanAbsDifference(poseA, poseB, gear)).toFixed(3)}, repeat ${(await meanAbsDifference(poseA, poseAgain, gear)).toFixed(3)}`)

    // ---- everything on: stability, diagnostics, resize, leaks
    await api('setFeatures', { ambientOcclusion: tier !== 'low', antiAliasing: 'auto', shadows: true, environment: 'studio' })
    await api('renderFrames', 30)
    const early = await api('renderFrames', 30)
    await shoot('everything')
    const late = await api('renderFrames', quick ? 120 : 300)
    const growth = {
      textures: late.diagnostics.resources.textures.count - early.diagnostics.resources.textures.count,
      framebuffers: late.diagnostics.resources.framebuffers.count - early.diagnostics.resources.framebuffers.count,
      buffers: late.diagnostics.resources.buffers.count - early.diagnostics.resources.buffers.count,
      renderbuffers: late.diagnostics.resources.renderbuffers.count - early.diagnostics.resources.renderbuffers.count,
      poolAllocations: late.pool.totalAllocations - early.pool.totalAllocations,
      bytes: late.diagnostics.resources.estimatedGpuBytes - early.diagnostics.resources.estimatedGpuBytes,
    }
    tierReport.measurements.everythingOn = {
      frameAverageMs: late.diagnostics.frame.averageMs, frameP95Ms: late.diagnostics.frame.p95Ms, fps: late.diagnostics.frame.fps, draw: late.diagnostics.draw,
      gpuBytes: late.diagnostics.resources.estimatedGpuBytes, textures: late.diagnostics.resources.textures, pool: late.pool, shaders: late.diagnostics.shaders, passes: late.diagnostics.passes, growth,
      three: late.diagnostics.three, gpuTimer: late.diagnostics.gpu,
    }
    check(tier, 'no GPU resource leaks across 300 frames with every feature on (textures, framebuffers, buffers, render targets, memory)', Object.values(growth).every(value => value === 0), JSON.stringify(growth))
    check(tier, 'no page errors or GL errors with every feature on', late.errors.length === 0 && late.glError === 0 && pageErrors.length === 0 && missing.length === 0, `${late.errors.concat(pageErrors, missing).slice(0, 2).join(' | ')} glError ${late.glError}`)
    check(tier, 'the diagnostics report the active post-processing passes', late.diagnostics.passes.length >= (tier === 'low' ? 1 : 2), late.diagnostics.passes.join(', '))

    // ---- resize
    for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1000, height: 1000 }]) {
      const resized = await api('resize', size.width, size.height)
      check(tier, `resizing to ${size.width}x${size.height} keeps rendering cleanly`, resized.errors.length === 0 && resized.glError === 0 && resized.size.width === size.width, `glError ${resized.glError}`)
    }
    await api('resize', VIEWPORT.width, VIEWPORT.height)
    await api('renderFrames', 10)

    // ---- idle render-target trimming
    await api('setFeatures', { ambientOcclusion: false, antiAliasing: 'off' })
    await page.waitForTimeout(4600)
    const trimmed = await api('renderFrames', 1)
    check(tier, 'pooled render targets are released after the idle window', trimmed.pool.idleCount === 0 && trimmed.pool.liveCount === 0, JSON.stringify({ idle: trimmed.pool.idleCount, live: trimmed.pool.liveCount }))

    // ---- WebGL context loss and restoration
    await api('setFeatures', { ambientOcclusion: tier !== 'low', antiAliasing: 'auto', shadows: true })
    const beforeLoss = await shoot('before-context-loss')
    const recovered = await api('recoverContext')
    const afterLoss = await shoot('after-context-loss')
    const lossDiff = await meanAbsDifference(beforeLoss, afterLoss)
    tierReport.measurements.contextLoss = { difference: lossDiff, loss: recovered.loss }
    check(tier, 'the context was really lost and restored, and rendering resumed with no errors', recovered.duringLoss === true && recovered.loss.restored && recovered.recoveries === 1 && recovered.errors.length === 0 && recovered.glError === 0, JSON.stringify(recovered.loss))
    check(tier, 'the image after context restoration matches the image before (the new capabilities recover completely)', lossDiff < 2, `mean difference ${lossDiff.toFixed(3)}`)
    const afterFrames = await api('renderFrames', 30)
    check(tier, 'rendering stays stable after restoration', afterFrames.errors.length === 0 && afterFrames.glError === 0 && !afterFrames.contextLost)

    report.tiers[tier].final = { pageErrors, status: afterFrames }
    await page.close()
  }
} finally {
  await browser?.close()
  await vite.close()
}

const cards = captures.map(capture => `<figure><img src="${capture.file}" alt="${capture.tier} ${capture.name}"><figcaption>${capture.tier} · ${capture.name}</figcaption></figure>`).join('\n')
await writeFile(join(output, 'contact-sheet.html'), `<!doctype html><meta charset="utf-8"><title>Cinema 2.0 render validation</title><style>body{margin:0;background:#090d14;color:#d9f3ff;font:13px system-ui}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:10px}figure{margin:0;background:#111925;padding:6px}img{display:block;width:100%;height:auto}figcaption{padding-top:6px}</style><main>${cards}</main>`)
await writeFile(join(output, 'report.json'), `${JSON.stringify({ ...report, results, failures }, (key, value) => fixed(value), 2)}\n`)
console.log(`\nRender validation: ${results.filter(entry => entry.ok).length}/${results.length} checks passed. Artifacts: ${output}`)
if (failures.length > 0) {
  console.error(`\nFailed:\n${failures.map(entry => `  - ${entry}`).join('\n')}`)
  process.exit(1)
}
