import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base = process.env.CELLULAR_BASE_URL ?? 'http://127.0.0.1:5173'
const output = process.env.CELLULAR_OUTPUT_DIR ?? '/tmp/cellular-validation'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 })
  await page.route('**/__cellular.html', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles/reactView.css">
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body style="margin:0;background:#172126"></body></html>` }))
  await page.goto(`${base}/__cellular.html`)
  await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__)
  const result = await page.evaluate(async () => {
    const { CellularRenderer } = await import('/src/components/vyzualz/react/renderers/cellular/CellularRenderer.ts')
    const { DEFAULT_CANVAS_CELLULAR_SETTINGS: defaults, reseedCellular } = await import('/src/components/vyzualz/react/renderers/cellular/CellularSettings.ts')
    const width = 320, height = 180
    const make = () => Object.assign(document.createElement('canvas'), { width, height })
    const assert = (pass, label) => { if (!pass) throw new Error(label) }
    const pixels = canvas => {
      const copy = make(), ctx = copy.getContext('2d')
      ctx.drawImage(canvas, 0, 0, width, height)
      return ctx.getImageData(0, 0, width, height).data
    }
    const difference = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length
    const source = make(), ctx = source.getContext('2d')
    ctx.fillStyle = '#ffd65b'; ctx.fillRect(37, 27, 246, 126)
    ctx.fillStyle = '#ff8d9e'; ctx.font = 'bold 38px sans-serif'; ctx.fillText('CELLULAR', 48, 107)
    const gpu = make(), { renderer, error } = CellularRenderer.create(gpu)
    assert(renderer, error)
    const settings = { ...defaults, amount: 1, colorMode: 'duotone' }
    const draw = (i, patch = {}, performance = {}) => {
      const recipe = { ...settings, ...patch }
      assert(renderer.render({ source, settings: recipe, timeSec: i / 60, fitMode: 'stretch', viewport: gpu,
        sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
        performance: { reset: false, positionReset: false, amount: recipe.amount, step: 1, pulse: 0,
          edge: recipe.edge, reconstruction: recipe.sourceMix, ...performance } }), 'GPU draw')
    }
    draw(0)
    const initial = pixels(gpu)
    for (let i = 1; i <= 110; i++) draw(i)
    const evolved = pixels(gpu), growth = gpu.toDataURL()
    const evolution = difference(initial, evolved)
    assert(evolution > 3, 'simulation did not evolve: ' + evolution)
    const baseline = pixels(source)
    let escaped = 0
    for (let i = 3; i < evolved.length; i += 4) if (baseline[i] === 0 && evolved[i] > 0) escaped++
    assert(escaped === 0, 'default field escaped source alpha')
    renderer.resetHistory(); draw(0)
    assert(difference(initial, pixels(gpu)) === 0, 'seed replay differed')
    renderer.resetHistory()
    for (let i = 0; i <= 110; i++) draw(i, { feed: 0.022, kill: 0.051 })
    const reactionDifference = difference(evolved, pixels(gpu))
    assert(reactionDifference > 3, 'reaction settings did not produce a distinct field')
    renderer.resetHistory()
    for (let i = 0; i <= 110; i++) draw(i, { feed: 0.022, kill: 0.051, expandAlpha: true })
    const variant = pixels(gpu), alternate = gpu.toDataURL()
    let expanded = 0
    for (let i = 3; i < variant.length; i += 4) if (baseline[i] === 0 && variant[i] > 0) expanded++
    assert(expanded > 0, 'expanded field did not diffuse beyond alpha')
    draw(111, { sourceMix: 1 })
    assert(difference(baseline, pixels(gpu)) < 0.2, 'native reconstruction')
    assert(gpu.getContext('webgl2').getError() === 0, 'GPU error')
    renderer.dispose()

    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { CanvasEngineSurface, CanvasEngineFxPanel } = await import('/src/components/vyzualz/react/ReactCanvasEngineShell.tsx')
    const { useReactStore: store } = await import('/src/stores/reactStore.ts')
    const { useMediaStore: media } = await import('/src/stores/mediaStore.ts')
    await store.persist.rehydrate()
    store.getState().resetReactView()
    const asset = { id: 'cellular-fixture', name: 'fixture.png', type: 'image', mimeType: 'image/png', url: source.toDataURL(), metadata: { width, height }, tags: [], collectionIds: [], revision: 1 }
    media.setState({ items: [asset] })
    store.getState().selectCanvasMediaItem(asset.id)
    store.getState().selectCanvasPreset('canvas-cellular')
    store.getState().setCanvasEngineSettings({ opacity: 1 })
    const host = document.createElement('div'); host.style.cssText = 'width:640px;height:360px;position:relative'; document.body.append(host)
    const controls = document.createElement('div'); document.body.append(controls)
    const root = createRoot(host), controlsRoot = createRoot(controls)
    let published = null
    const onCanvasReady = canvas => { published = canvas }
    const tick = () => new Promise(requestAnimationFrame)
    const wait = async (predicate, label) => {
      for (let i = 0; i < 180; i++) { if (predicate()) return; await tick() }
      throw new Error(label + ': ' + host.textContent)
    }
    const surface = paused => React.createElement(CanvasEngineSurface, { isPlaying: false, isPaused: paused, onCanvasReady })
    root.render(surface(false))
    controlsRoot.render(React.createElement(CanvasEngineFxPanel))
    await wait(() => published?.width && host.querySelector('.rv-canvas-cellular-layer[data-ready="true"]'), 'live output')
    await wait(() => controls.textContent.includes('Growth Amount'), 'Cellular Design controls')
    const before = published.toDataURL()
    for (let i = 0; i < 55; i++) await tick()
    const capture = published.toDataURL()
    assert(before !== capture, 'CANVAS capture did not evolve')
    root.render(surface(true))
    await tick(); await tick()
    const paused = published.toDataURL()
    await tick(); await tick()
    assert(published.toDataURL() === paused, 'paused field advanced')
    reseedCellular()
    await wait(() => published?.toDataURL() !== paused, 'paused reseed')
    store.getState().setCanvasPresetSettings({ cellular: { ...defaults, amount: 0 } })
    await wait(() => host.querySelector('.rv-canvas-cellular-layer')?.style.opacity === '0', 'clean source ownership')
    assert(store.getState().activeCanvasMediaId === asset.id, 'preset replaced media')
    controlsRoot.unmount(); root.unmount()
    return { growth, alternate, capture, evolution, reactionDifference, expanded }
  })
  for (const name of ['growth', 'alternate', 'capture']) {
    await writeFile(path.join(output, `${name}.png`), Buffer.from(result[name].split(',')[1], 'base64'))
  }
  console.log(JSON.stringify({ evolution: result.evolution, reactionDifference: result.reactionDifference, expandedPixels: result.expanded, output }))
} finally {
  await browser.close()
}
