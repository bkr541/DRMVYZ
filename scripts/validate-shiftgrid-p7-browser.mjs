/* global document, Image */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.SHIFTGRID_P7_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = path.resolve(process.env.SHIFTGRID_P7_OUTPUT_DIR ?? '/tmp/shiftgrid-p7-validation')
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 })
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
await page.setContent('<!doctype html><html><body style="margin:0;background:transparent"></body></html>')

const browserResult = await page.evaluate(async () => {
  const root = '/src/components/vyzualz/react/renderers/shiftgrid/'
  const [settingsModule, geometryModule, choreographyModule, mosaicModule, renderPlanModule, effectsModule, webglModule, canvas2dModule, atlasModule] = await Promise.all([
    import(`${root}ShiftgridSettings.ts`),
    import(`${root}ShiftgridTileGeometry.ts`),
    import(`${root}ShiftgridChoreography.ts`),
    import(`${root}ShiftgridMosaic.ts`),
    import(`${root}ShiftgridRenderPlan.ts`),
    import(`${root}ShiftgridEffects.ts`),
    import(`${root}ShiftgridWebGLRenderer.ts`),
    import(`${root}ShiftgridCanvas2DRenderer.ts`),
    import(`${root}ShiftgridTextureAtlas.ts`),
  ])
  const W = 640; const H = 360
  const appendCanvas = (id) => {
    const canvas = document.createElement('canvas')
    canvas.id = id; canvas.width = W; canvas.height = H
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; canvas.style.display = 'block'
    document.body.appendChild(canvas)
    return canvas
  }
  const makeCanvas = (width = W, height = H) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    return canvas
  }
  const loadImage = (url) => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url
  })
  const drawFixture = async (kind, width = W, height = H) => {
    const canvas = makeCanvas(width, height); const context = canvas.getContext('2d')
    context.clearRect(0, 0, width, height)
    if (kind === 'graffiti') {
      context.fillStyle = '#fff'; context.fillRect(0, 0, width, height)
      context.fillStyle = '#050505'; context.font = `900 ${Math.round(height * 0.42)}px Impact, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'
      context.fillText('SHIFT GRID', width / 2, height / 2)
      context.lineWidth = 6; context.strokeStyle = '#050505'; context.strokeRect(18, 18, width - 36, height - 36)
    } else if (kind === 'glitch') {
      const colors = ['#ff1744', '#00e5ff', '#7c4dff', '#ffea00', '#00e676']
      colors.forEach((color, index) => { context.fillStyle = color; context.fillRect(0, index * height / colors.length, width, height / colors.length + 1) })
      context.globalCompositeOperation = 'difference'; context.fillStyle = '#fff'
      for (let x = 0; x < width; x += 37) context.fillRect(x, (x * 7) % height, 19, height / 3)
      context.globalCompositeOperation = 'source-over'
    } else if (kind === 'chrome') {
      const gradient = context.createLinearGradient(0, 0, 0, height)
      ;[['0', '#111'], ['0.18', '#f7fbff'], ['0.35', '#45505a'], ['0.52', '#fff'], ['0.72', '#15191e'], ['1', '#aeb8c2']].forEach(([stop, color]) => gradient.addColorStop(Number(stop), color))
      context.fillStyle = gradient; context.fillRect(0, 0, width, height)
      context.strokeStyle = '#fff'; context.lineWidth = 10; context.strokeRect(width * 0.12, height * 0.2, width * 0.76, height * 0.6)
    } else if (kind === 'neon') {
      context.font = `700 ${Math.round(height * 0.3)}px sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'
      context.shadowColor = '#ff2bd6'; context.shadowBlur = 28; context.strokeStyle = '#ff2bd6'; context.lineWidth = 8; context.strokeText('NEON', width / 2, height / 2)
      context.shadowColor = '#40e9ff'; context.shadowBlur = 14; context.strokeStyle = '#d9fbff'; context.lineWidth = 2; context.strokeText('NEON', width / 2, height / 2)
    } else if (kind === 'transparent-svg') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="M40 ${height - 45} L${width / 2} 35 L${width - 40} ${height - 45} Z" fill="none" stroke="#52ffd2" stroke-width="20"/><circle cx="${width / 2}" cy="${height / 2}" r="70" fill="#ff3d9a" fill-opacity=".65"/></svg>`
      const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`); context.drawImage(image, 0, 0)
    } else if (kind === 'low-contrast') {
      context.fillStyle = '#34373b'; context.fillRect(0, 0, width, height); context.fillStyle = '#40444a'
      for (let x = 0; x < width; x += 48) context.fillRect(x, 0, 24, height)
      context.fillStyle = '#4b5056'; context.font = `700 ${Math.round(height * 0.24)}px sans-serif`; context.textAlign = 'center'; context.fillText('LOW SIGNAL', width / 2, height / 2)
    } else if (kind === 'reference-wordmark') {
      const image = await loadImage('/src/assets/dvydrm_wordmark_clean_master.svg'); context.drawImage(image, 0, 0, width, height)
    } else if (kind === 'reference-neon') {
      const image = await loadImage('/mockups/TheKodyRobinson_Neon_club_hallucination_with_massive_pink_han_52216af9-f4da-477c-97d5-c5e22d9c394d_0.png'); context.drawImage(image, 0, 0, width, height)
    }
    return canvas
  }
  const fixtureSpecs = [
    ['graffiti', W, H], ['glitch', W, H], ['chrome', W, H], ['neon', W, H], ['transparent-svg', W, H],
    ['low-contrast', W, H], ['wide', 900, 240], ['portrait', 240, 900], ['reference-wordmark', W, H], ['reference-neon', W, H],
  ]
  const fixtures = []
  for (const [kind, width, height] of fixtureSpecs) fixtures.push({ kind, canvas: await drawFixture(kind === 'wide' || kind === 'portrait' ? 'glitch' : kind, width, height) })
  const baseSettings = { ...settingsModule.DEFAULT_CANVAS_SHIFTGRID_SETTINGS, gridMode: 'fixed', gridPreset: '5x5', gridColumns: 5, gridRows: 5, tileShape: 'rectangular', fitMode: 'contain' }
  const makeRuntime = (columns, rows, pattern = 'rowRunner', progress = 0) => {
    const geometry = geometryModule.createShiftgridTileGeometry({ gridColumns: columns, gridRows: rows, tileShape: 'rectangular' }, W, H)
    const config = { ...baseSettings, gridColumns: columns, gridRows: rows, choreographyPattern: pattern, movementAmount: 1, scrambleComplexity: 0.8 }
    const plan = choreographyModule.createShiftgridChoreographyPlan({ columns, rows, settings: config })
    const runtime = new choreographyModule.ShiftgridChoreographyPlayback(geometry, plan, `browser:${pattern}:${columns}x${rows}`)
    runtime.seek(plan.durationMs * progress)
    return { geometry, config, plan, runtime }
  }
  const renderPlan = (fixture, state, extras = {}) => renderPlanModule.createShiftgridRenderPlan({ geometry: state.geometry, runtime: state.runtime,
    width: W, height: H, sourceWidth: fixture.canvas.width, sourceHeight: fixture.canvas.height,
    sources: extras.sources, sourceRuntime: extras.sourceRuntime, fitMode: state.config.fitMode, easing: state.config.easing,
    effects: extras.effects })

  const captures = []
  for (const fixture of fixtures) {
    const expected = appendCanvas(`expected-${fixture.kind}`); const expectedContext = expected.getContext('2d')
    const state = makeRuntime(5, 5, 'rowRunner', 0)
    const expectedPlan = renderPlan(fixture, state)
    const draw = expectedPlan.sourceDraw; const bounds = expectedPlan.compositionBounds
    expectedContext.save(); expectedContext.beginPath(); expectedContext.rect(bounds.x, bounds.y, bounds.width, bounds.height); expectedContext.clip()
    expectedContext.drawImage(fixture.canvas, draw.x, draw.y, draw.width, draw.height); expectedContext.restore()
    const output = appendCanvas(`webgl-${fixture.kind}`)
    const renderer = new webglModule.ShiftgridWebGLRenderer(output); renderer.resize(W, H, 1)
    renderer.setSources([{ id: fixture.kind, element: fixture.canvas }], { preferredCellSize: 768 }); renderer.render(expectedPlan)
    captures.push({ kind: fixture.kind, expectedDataUrl: expected.toDataURL('image/png'), actualDataUrl: output.toDataURL('image/png') })
    renderer.dispose()
  }

  const patternCaptures = []
  const patternSource = fixtures.find(fixture => fixture.kind === 'glitch').canvas
  for (const option of settingsModule.CANVAS_SHIFTGRID_PATTERN_OPTIONS) {
    const state = makeRuntime(10, 6, option.value, 0.47)
    const output = appendCanvas(`pattern-${option.value}`); const renderer = new webglModule.ShiftgridWebGLRenderer(output)
    renderer.resize(W, H, 1); renderer.setSources([{ id: 'glitch', element: patternSource }]); renderer.render(renderPlan({ canvas: patternSource }, state))
    patternCaptures.push({ id: output.id, pattern: option.value, topology: state.plan.steps.map(step => step.topology), dataUrl: output.toDataURL('image/png') })
    renderer.dispose()
  }

  const poolSources = fixtures.slice(0, 10).map((fixture, index) => ({ id: `pool-${index}`, element: fixture.canvas }))
  const mosaicCaptures = []
  for (const option of settingsModule.CANVAS_SHIFTGRID_MULTI_MOSAIC_TYPE_OPTIONS) {
    const state = makeRuntime(5, 5, 'waveRelay', 0)
    const mosaicSettings = { ...state.config, mosaicType: option.value, primaryTargetMediaId: poolSources[1].id }
    const mosaicPlan = mosaicModule.createShiftgridMosaicPlan({ columns: 5, rows: 5, sourceIds: poolSources.slice(0, 6).map(source => source.id), settings: mosaicSettings, sequenceIndex: 2 })
    const mosaic = new mosaicModule.ShiftgridMosaicPlayback(mosaicPlan); mosaic.seek(mosaicPlan.durationMs * 0.55)
    const output = appendCanvas(`mosaic-${option.value}`); const renderer = new webglModule.ShiftgridWebGLRenderer(output)
    renderer.resize(W, H, 1); renderer.setSources(poolSources.slice(0, 6))
    renderer.render(renderPlan({ canvas: poolSources[0].element }, state, { sourceRuntime: mosaic,
      sources: poolSources.slice(0, 6).map(source => ({ id: source.id, width: source.element.width, height: source.element.height })) }))
    mosaicCaptures.push({ id: output.id, mosaic: option.value, resolved: mosaicPlan.resolvedType, topology: mosaicPlan.steps.map(step => step.topology), dataUrl: output.toDataURL('image/png') })
    renderer.dispose()
  }

  const effectsState = makeRuntime(10, 6, 'dominoChain', 0.86)
  const effectSettings = { ...effectsState.config, enhancedEffects: true, tileEdgeGlowEnabled: true, edgeGlow: 0.65,
    lightTrailsEnabled: true, lightTrails: 0.55, motionBlurEnabled: true, motionBlur: 0.45,
    rgbSeparationEnabled: true, chromaticSplit: 0.35, beatPulseEnabled: true, beatPulse: 0.4,
    snapFlashEnabled: true, snapFlash: 0.6, tileGapEnabled: true, tileGap: 0.04 }
  const effects = effectsModule.resolveShiftgridEffectPlan(effectSettings, { edgeShimmer: 0.7, gridPulse: 0.8, snapAccent: 0.6 })
  const effectsCanvas = appendCanvas('enhanced-effects'); const effectsRenderer = new webglModule.ShiftgridWebGLRenderer(effectsCanvas)
  effectsRenderer.resize(W, H, 1); effectsRenderer.setSources([{ id: 'glitch', element: patternSource }]); effectsRenderer.render(renderPlan({ canvas: patternSource }, effectsState, { effects }))
  const effectsDataUrl = effectsCanvas.toDataURL('image/png'); effectsRenderer.dispose()

  const fallbackCanvas = appendCanvas('canvas2d-clean'); const fallback = new canvas2dModule.ShiftgridCanvas2DRenderer(fallbackCanvas)
  const cleanState = makeRuntime(5, 5, 'rowRunner', 0); fallback.resize(W, H, 1); fallback.setSources([{ id: 'glitch', element: patternSource }]); fallback.render(renderPlan({ canvas: patternSource }, cleanState))

  const profileCanvas = makeCanvas(W, H); const profileRenderer = new webglModule.ShiftgridWebGLRenderer(profileCanvas); profileRenderer.resize(W, H, 1)
  const gl = profileCanvas.getContext('webgl2')
  const scenarios = [
    { id: 'one-4x4', sources: 1, columns: 4, rows: 4, enhanced: false },
    { id: 'one-10x6', sources: 1, columns: 10, rows: 6, enhanced: false },
    { id: 'one-16x9', sources: 1, columns: 16, rows: 9, enhanced: false },
    { id: 'six-5x5', sources: 6, columns: 5, rows: 5, enhanced: false },
    { id: 'ten-10x6', sources: 10, columns: 10, rows: 6, enhanced: false },
    { id: 'ten-10x6-effects', sources: 10, columns: 10, rows: 6, enhanced: true },
  ]
  const profiles = []
  for (const scenario of scenarios) {
    profileRenderer.setSources(poolSources.slice(0, scenario.sources), { preferredCellSize: 512 })
    const state = makeRuntime(scenario.columns, scenario.rows, 'checkerShift', 0.5)
    const plan = renderPlan({ canvas: poolSources[0].element }, state, { effects: scenario.enhanced ? effects : undefined })
    for (let warmup = 0; warmup < 10; warmup += 1) profileRenderer.render(plan)
    gl.finish(); const samples = []
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const started = performance.now(); profileRenderer.render(plan); gl.finish(); samples.push(performance.now() - started)
    }
    const sorted = [...samples].sort((a, b) => a - b)
    profiles.push({ ...scenario, averageMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
      p95Ms: sorted[Math.floor(sorted.length * 0.95)], atlas: atlasModule.resolveShiftgridAtlasLayout(scenario.sources, 512, gl.getParameter(gl.MAX_TEXTURE_SIZE)) })
  }
  profileRenderer.dispose()
  const fallbackDataUrl = fallbackCanvas.toDataURL('image/png'); fallback.dispose()
  return { captures, patternCaptures, mosaicCaptures, effectsDataUrl, fallbackDataUrl,
    profiles, webgl: { renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR), maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) } }
})

const dataUrlBuffer = dataUrl => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
for (const capture of browserResult.captures) {
  await writeFile(path.join(outputDir, `${capture.kind}-expected.png`), dataUrlBuffer(capture.expectedDataUrl))
  await writeFile(path.join(outputDir, `${capture.kind}-webgl.png`), dataUrlBuffer(capture.actualDataUrl))
  delete capture.expectedDataUrl; delete capture.actualDataUrl
}
for (const capture of browserResult.patternCaptures) {
  await writeFile(path.join(outputDir, `${capture.id}.png`), dataUrlBuffer(capture.dataUrl)); delete capture.dataUrl
}
for (const capture of browserResult.mosaicCaptures) {
  await writeFile(path.join(outputDir, `${capture.id}.png`), dataUrlBuffer(capture.dataUrl)); delete capture.dataUrl
}
await writeFile(path.join(outputDir, 'enhanced-effects.png'), dataUrlBuffer(browserResult.effectsDataUrl))
await writeFile(path.join(outputDir, 'canvas2d-clean.png'), dataUrlBuffer(browserResult.fallbackDataUrl))
delete browserResult.effectsDataUrl; delete browserResult.fallbackDataUrl

async function pixelDiff(expectedPath, actualPath) {
  const expected = await sharp(expectedPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const actual = await sharp(actualPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (expected.info.width !== actual.info.width || expected.info.height !== actual.info.height) throw new Error('SHIFTGRID comparison dimensions differ')
  let changedPixels = 0; let totalError = 0; let maxError = 0
  for (let index = 0; index < expected.data.length; index += 4) {
    let pixelError = 0
    for (let channel = 0; channel < 4; channel += 1) pixelError = Math.max(pixelError, Math.abs(expected.data[index + channel] - actual.data[index + channel]))
    if (pixelError > 3) changedPixels += 1
    totalError += pixelError; maxError = Math.max(maxError, pixelError)
  }
  const pixels = expected.info.width * expected.info.height
  return { pixels, changedPixels, changedRatio: changedPixels / pixels, meanMaxChannelError: totalError / pixels, maxError }
}

const comparisons = {}
for (const capture of browserResult.captures) comparisons[capture.kind] = await pixelDiff(
  path.join(outputDir, `${capture.kind}-expected.png`), path.join(outputDir, `${capture.kind}-webgl.png`))

const unacceptableComparisons = Object.entries(comparisons).filter(([, comparison]) =>
  comparison.changedRatio > 0.5 || comparison.meanMaxChannelError > 45)
if (unacceptableComparisons.length > 0) {
  throw new Error(`SHIFTGRID clean-render comparison exceeded tolerance: ${unacceptableComparisons.map(([kind]) => kind).join(', ')}`)
}

const patternOpacity = {}
for (const capture of browserResult.patternCaptures) {
  const stats = await sharp(path.join(outputDir, `${capture.id}.png`)).stats()
  patternOpacity[capture.pattern] = stats.isOpaque
}
const nonOpaquePatterns = Object.entries(patternOpacity).filter(([, opaque]) => !opaque).map(([pattern]) => pattern)
if (nonOpaquePatterns.length > 0) throw new Error(`SHIFTGRID moving patterns exposed transparent holes: ${nonOpaquePatterns.join(', ')}`)

async function contactSheet(names, outputName, columns = 4) {
  const thumbWidth = 320; const thumbHeight = 180; const rows = Math.ceil(names.length / columns)
  const composites = []
  for (let index = 0; index < names.length; index += 1) {
    const input = await sharp(path.join(outputDir, names[index])).resize(thumbWidth, thumbHeight, { fit: 'fill' }).png().toBuffer()
    composites.push({ input, left: (index % columns) * thumbWidth, top: Math.floor(index / columns) * thumbHeight })
  }
  await sharp({ create: { width: columns * thumbWidth, height: rows * thumbHeight, channels: 4, background: { r: 12, g: 14, b: 18, alpha: 1 } } })
    .composite(composites).png().toFile(path.join(outputDir, outputName))
}
await contactSheet(browserResult.patternCaptures.map(capture => `${capture.id}.png`), 'patterns-contact-sheet.png')
await contactSheet(browserResult.mosaicCaptures.map(capture => `${capture.id}.png`), 'mosaics-contact-sheet.png', 3)

const report = { generatedAt: new Date().toISOString(), baseUrl, outputDir, ...browserResult, comparisons, patternOpacity,
  availableWorkspaceReferences: ['src/assets/dvydrm_wordmark_clean_master.svg', 'public/mockups/TheKodyRobinson_Neon_club_hallucination_with_massive_pink_han_52216af9-f4da-477c-97d5-c5e22d9c394d_0.png'] }
await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
await browser.close()
console.log(JSON.stringify(report, null, 2))
