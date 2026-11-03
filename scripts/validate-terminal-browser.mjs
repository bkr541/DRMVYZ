import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base = process.env.TERMINAL_BASE_URL ?? 'http://127.0.0.1:5173'
const output = process.env.TERMINAL_OUTPUT_DIR ?? '/tmp/terminal-validation'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 })
  await page.route('**/__terminal.html', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles/reactView.css">
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body style="margin:0;background:#172126"></body></html>` }))
  await page.goto(`${base}/__terminal.html`)
  await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__)
  const result = await page.evaluate(async () => {
    const { TerminalRenderer } = await import('/src/components/vyzualz/react/renderers/terminal/TerminalRenderer.ts')
    const { TerminalPerformance } = await import('/src/components/vyzualz/react/renderers/terminal/TerminalPerformance.ts')
    const { DEFAULT_CANVAS_TERMINAL_SETTINGS: defaults } = await import('/src/components/vyzualz/react/renderers/terminal/TerminalSettings.ts')
    const width = 384, height = 216
    const make = () => Object.assign(document.createElement('canvas'), { width, height })
    const assert = (pass, label) => { if (!pass) throw new Error(label) }
    const pixels = canvas => {
      const copy = make(), ctx = copy.getContext('2d')
      ctx.drawImage(canvas, 0, 0, width, height)
      return ctx.getImageData(0, 0, width, height).data
    }
    const difference = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length
    const source = make(), ctx = source.getContext('2d')
    const gradient = ctx.createLinearGradient(22, 0, width - 22, 0)
    gradient.addColorStop(0, '#181820'); gradient.addColorStop(1, '#fff086')
    ctx.fillStyle = gradient; ctx.fillRect(22, 22, width - 44, height - 44)
    ctx.fillStyle = '#4ae6cf'; ctx.font = 'bold 64px sans-serif'; ctx.fillText('DRMVYZ', 38, 132)
    const gpu = make(), renderer = TerminalRenderer.create(gpu), controller = new TerminalPerformance()
    const draw = (patch = {}, time = 0, fitMode = 'stretch', viewport = source, transform = {}) => {
      const settings = { ...defaults, ...patch }
      assert(renderer.render({ source, settings, frame: controller.update(settings, null, time, 0, false, false),
        fitMode, viewport, transform: { scale: 1, positionX: 0, positionY: 0, rotation: 0, ...transform }, dpr: 1 }), 'GPU draw')
    }
    const original = pixels(source)
    draw({ edge: 0, changeRate: 0 })
    const ascii = pixels(gpu), still = gpu.toDataURL()
    const coverage = (a, b) => {
      let ink = 0
      for (let y = 32; y < 58; y++) for (let x = a; x < b; x++) ink += ascii[(y * width + x) * 4 + 3]
      return ink
    }
    assert(coverage(294, 348) > 2 * coverage(30, 84), 'brighter cells did not select denser glyphs')
    for (let i = 3; i < ascii.length; i += 4) assert(ascii[i] <= original[i], 'glyph escaped source alpha')
    draw({ family: 'numbers', edge: 0, changeRate: 0 })
    assert(difference(ascii, pixels(gpu)) > 1, 'numbers did not change silhouettes')
    const numbers = gpu.toDataURL()
    draw({ family: 'symbols', colorMode: 'monochrome', glow: 0.5 })
    const symbols = gpu.toDataURL()
    draw({}, 4)
    const variant = pixels(gpu)
    draw({}, 0); draw({}, 4)
    assert(difference(variant, pixels(gpu)) === 0, 'seeded reconstruction changed on return')
    draw({ sourceMix: 1, glow: 1 })
    assert(difference(original, pixels(gpu)) < 0.2, 'clean endpoint changed the source')
    draw({ background: 1 }, 0, 'contain', { width: 216, height: 384 })
    const gl = gpu.getContext('webgl2'), pixel = new Uint8Array(4)
    gl.readPixels(108, 12, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    assert(pixel[3] === 0, 'contain fit drew in the letterbox')
    gl.readPixels(108, 192, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    assert(pixel[3] === 255, 'contain fit lost source center')
    assert(gl.getError() === gl.NO_ERROR, 'GPU error')
    renderer.dispose()

    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { CanvasEngineSurface, CanvasEngineFxPanel } = await import('/src/components/vyzualz/react/ReactCanvasEngineShell.tsx')
    const { useReactStore: store } = await import('/src/stores/reactStore.ts')
    const { useMediaStore: media } = await import('/src/stores/mediaStore.ts')
    await store.persist.rehydrate()
    store.getState().resetReactView()
    const asset = { id: 'terminal-fixture', name: 'fixture.png', type: 'image', mimeType: 'image/png', url: source.toDataURL(),
      metadata: { width, height }, tags: [], collectionIds: [], revision: 1 }
    media.setState({ items: [asset] })
    store.getState().selectCanvasMediaItem(asset.id)
    store.getState().selectCanvasPreset('canvas-terminal')
    store.getState().setCanvasEngineSettings({ opacity: 1 })
    const host = document.createElement('div'); host.style.cssText = 'width:640px;height:360px;position:relative'; document.body.append(host)
    const controls = document.createElement('div'); document.body.append(controls)
    const root = createRoot(host), controlsRoot = createRoot(controls)
    let published = null
    const onCanvasReady = canvas => { published = canvas }
    const tick = () => new Promise(requestAnimationFrame)
    const layer = () => host.querySelector('.rv-canvas-terminal-layer')
    const ready = () => Boolean(published?.width && layer()?.dataset.ready === 'true')
    const wait = async (predicate, label) => {
      for (let i = 0; i < 210; i++) { if (predicate()) return; await tick() }
      throw new Error(label + ': ' + host.textContent)
    }
    const surface = (paused, playing = false) => React.createElement(CanvasEngineSurface, { isPlaying: playing, isPaused: paused, onCanvasReady })
    root.render(surface(false))
    controlsRoot.render(React.createElement(CanvasEngineFxPanel))
    await wait(ready, 'processed live output')
    await wait(() => controls.textContent.includes('Glyph Amount'), 'Terminal Design')
    const capture = published.toDataURL()
    const lost = layer().getContext('webgl2').getExtension('WEBGL_lose_context')
    assert(lost, 'context loss extension unavailable')
    lost.loseContext()
    await wait(() => layer().dataset.ready === 'false' && host.textContent.includes('Showing the original source'), 'native fallback')
    lost.restoreContext()
    await wait(ready, 'context recovery')
    store.getState().setCanvasPresetSettings({ terminal: { ...defaults, sourceMix: 1 } })
    await wait(() => layer()?.style.opacity === '0', 'native source ownership')
    assert(store.getState().activeCanvasMediaId === asset.id, 'preset replaced media')

    const stream = source.captureStream(20)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = []
    recorder.ondataavailable = event => chunks.push(event.data)
    const encoded = new Promise(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })) })
    recorder.start()
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = i < 12 ? '#fdd546' : '#2bb5ef'; ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#172126'; ctx.fillRect(80 + i * 6, 48, 88, 120)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    recorder.stop()
    const url = URL.createObjectURL(await encoded)
    stream.getTracks().forEach(track => track.stop())
    media.setState({ items: [{ ...asset, name: 'fixture.webm', type: 'video', mimeType: 'video/webm', url, revision: 2 }] })
    store.getState().setCanvasPresetSettings({ terminal: { ...defaults, changeRate: 0 } })
    root.render(surface(false, true))
    await wait(() => ready() && host.querySelector('video')?.currentTime > 0.2, 'video output')
    const first = published.toDataURL()
    await wait(() => host.querySelector('video')?.currentTime > 0.75 && published.toDataURL() !== first, 'decoded video updated glyphs')
    root.render(surface(true, true))
    await wait(() => host.querySelector('video')?.paused, 'video pause')
    await tick(); await tick()
    const videoCapture = published.toDataURL()
    await tick(); await tick()
    assert(published.toDataURL() === videoCapture, 'paused capture advanced')
    const video = host.querySelector('video')
    video.currentTime = 0.15
    await wait(() => ready() && !video.seeking && published.toDataURL() !== videoCapture, 'paused video seek updates glyphs')
    root.unmount(); controlsRoot.unmount(); URL.revokeObjectURL(url)
    return { still, numbers, symbols, capture, video: videoCapture }
  })
  for (const [name, data] of Object.entries(result)) {
    await writeFile(path.join(output, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'))
  }
  console.log(`Terminal GPU, CANVAS capture, context recovery and video smoke passed. Captures saved to ${output}`)
} finally {
  await browser.close()
}
