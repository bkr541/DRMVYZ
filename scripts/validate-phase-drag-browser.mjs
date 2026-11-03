import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base = process.env.PHASE_DRAG_BASE_URL ?? 'http://127.0.0.1:5173'
const output = process.env.PHASE_DRAG_OUTPUT_DIR ?? '/tmp/phase-drag-validation'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 })
  await page.route('**/__phase-drag.html', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles/reactView.css">
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body style="margin:0;background:#172126"></body></html>` }))
  await page.goto(`${base}/__phase-drag.html`)
  await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__)
  const result = await page.evaluate(async () => {
    const { PhaseDragRenderer } = await import('/src/components/vyzualz/react/renderers/phaseDrag/PhaseDragRenderer.ts')
    const { DEFAULT_CANVAS_PHASE_DRAG_SETTINGS: defaults } = await import('/src/components/vyzualz/react/renderers/phaseDrag/PhaseDragSettings.ts')
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { CanvasEngineSurface, CanvasEngineFxPanel } = await import('/src/components/vyzualz/react/ReactCanvasEngineShell.tsx')
    const { useReactStore: store } = await import('/src/stores/reactStore.ts')
    const { useMediaStore: media } = await import('/src/stores/mediaStore.ts')

    const width = 320, height = 180
    const make = () => Object.assign(document.createElement('canvas'), { width, height })
    const assert = (pass, label) => { if (!pass) throw new Error(label) }
    const tick = () => new Promise(requestAnimationFrame)
    const wait = async (predicate, label) => {
      for (let i = 0; i < 180; i++) { if (predicate()) return; await tick() }
      throw new Error(label)
    }
    const read = (canvas, x, y) => {
      const copy = make(), ctx = copy.getContext('2d')
      ctx.drawImage(canvas, 0, 0, width, height)
      return ctx.getImageData(x, y, 1, 1).data
    }
    const source = make(), sourceContext = source.getContext('2d'), gpu = make()
    const { renderer, error } = PhaseDragRenderer.create(gpu)
    assert(renderer, error)
    const settings = { ...defaults, amount: 1, timeCurve: 'linear', scanSpeed: 0, stillMovement: 0.001, historySamples: 8 }
    const performance = { reset: false, positionReset: false, phase: 0, direction: 'forward', depth: 1, slitWidth: 0.01, ripple: 0, reconstruction: 0 }
    const render = (timeSec, patch = {}) => {
      assert(renderer.render({ source, settings, timeSec, fitMode: 'stretch', viewport: gpu,
        sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 }, performance, ...patch }), 'GPU render')
    }
    for (let i = 0; i < 8; i++) {
      sourceContext.fillStyle = `rgb(${20 + 30 * i},45,100)`
      sourceContext.fillRect(0, 0, width, height)
      render(i * 0.15)
    }
    const near = read(gpu, 48, 90)[0], far = read(gpu, 272, 90)[0]
    assert(near > 190 && far < 85 && near - far > 120, `different source times: ${near}, ${far}`)
    const temporal = gpu.toDataURL()
    const captures = {}
    for (const scanMode of ['vertical', 'horizontal', 'radial', 'map']) {
      render(1.05, { settings: { ...settings, scanMode } })
      captures[scanMode] = gpu.toDataURL()
    }
    assert(new Set(Object.values(captures)).size === 4, 'different scan fields')
    renderer.resetHistory()
    render(2)
    assert(read(gpu, 272, 90)[0] === 230, 'history reset exposed old pixels')
    render(2, { settings: { ...settings, sourceMix: 1 } })
    assert(read(gpu, 48, 90)[0] === 230, 'original reconstruction')
    assert(gpu.getContext('webgl2').getError() === 0, 'WebGL error')
    renderer.dispose()

    sourceContext.clearRect(0, 0, width, height)
    sourceContext.fillStyle = '#f92d83'; sourceContext.fillRect(45, 22, 230, 136)
    sourceContext.fillStyle = '#5ffad1'; sourceContext.fillRect(66, 45, 36, 90)
    sourceContext.fillStyle = 'white'; sourceContext.font = '28px sans-serif'; sourceContext.fillText('PHASE DRAG', 106, 100)
    const logo = source.toDataURL()
    await store.persist.rehydrate()
    store.getState().resetReactView()
    const asset = { id: 'phase-drag-fixture', name: 'fixture.png', type: 'image', mimeType: 'image/png', url: logo, metadata: { width, height }, tags: [], collectionIds: [], revision: 1 }
    media.setState({ items: [asset] })
    store.getState().selectCanvasMediaItem(asset.id)
    store.getState().selectCanvasPreset('canvas-phase-drag')
    store.getState().setCanvasEngineSettings({ opacity: 1 })
    const host = document.createElement('div'); host.style.cssText = 'width:640px;height:360px;position:relative'; document.body.append(host)
    const root = createRoot(host)
    let published = null
    const onCanvasReady = canvas => { published = canvas }
    root.render(React.createElement(CanvasEngineSurface, { isPlaying: false, isPaused: false, onCanvasReady }))
    const snapshotReady = () => published?.width && host.querySelector('.rv-canvas-phase-drag-layer[data-ready="true"]')
    await wait(snapshotReady, 'still output')
    const start = published.toDataURL()
    for (let i = 0; i < 50; i++) await tick()
    assert(published.toDataURL() !== start, 'still does not move')
    const stillAlpha = {
      background: host.querySelector('[data-background-mode]')?.getAttribute('data-background-mode'),
      source: sourceContext.getImageData(0, 0, 1, 1).data[3],
      preview: read(host.querySelector('.rv-canvas-phase-drag-layer'), 0, 0)[3],
      capture: read(published, 0, 0)[3],
    }
    assert(stillAlpha.source === 0 && stillAlpha.preview === 0 &&
      stillAlpha.capture === (stillAlpha.background === 'transparent' ? 0 : 255),
    'still alpha and capture background: ' + JSON.stringify(stillAlpha))
    const still = published.toDataURL()
    const controls = document.createElement('div'); document.body.append(controls)
    const controlsRoot = createRoot(controls)
    controlsRoot.render(React.createElement(CanvasEngineFxPanel))
    await wait(() => controls.textContent.includes('Animated Still Movement'), 'Animated Still controls')
    store.getState().setCanvasPresetSettings({ phaseDrag: { ...defaults, stillMovement: 0 } })
    await wait(() => host.querySelector('.rv-canvas-phase-drag-layer')?.style.opacity === '0', 'native still ownership')
    assert(store.getState().activeCanvasMediaId === asset.id, 'preset replaced media')

    // Encode a moving source locally and let CANVAS reuse its ordinary video element.
    const videoCanvas = make(), vctx = videoCanvas.getContext('2d'), stream = videoCanvas.captureStream(25)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = []
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    const recorded = new Promise(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })) })
    recorder.start()
    for (let i = 0; i < 26; i++) {
      vctx.fillStyle = i < 12 ? '#db287c' : '#2824a3'; vctx.fillRect(0, 0, width, height)
      vctx.fillStyle = '#53ffd8'; vctx.fillRect(i * 10, 10, 42, 160)
      vctx.fillStyle = 'white'; vctx.font = '20px monospace'; vctx.fillText(String(i), 12, 30)
      await new Promise(resolve => setTimeout(resolve, 40))
    }
    recorder.stop()
    const url = URL.createObjectURL(await recorded)
    stream.getTracks().forEach(track => track.stop())
    media.setState({ items: [{ ...asset, name: 'fixture.webm', type: 'video', mimeType: 'video/webm', url, revision: 2 }] })
    store.getState().setCanvasPresetSettings({ phaseDrag: { ...defaults, amount: 1 } })
    root.render(React.createElement(CanvasEngineSurface, { isPlaying: true, isPaused: false, onCanvasReady }))
    await wait(() => snapshotReady() && host.querySelector('video')?.readyState >= 2, 'video output')
    const video = host.querySelector('video')
    await wait(() => video.currentTime > 0.6, 'video playback')
    const videoOutput = published.toDataURL()
    store.getState().setCanvasPresetSettings({ phaseDrag: { ...defaults, freezeHistory: true } })
    await tick(); await tick()
    const frozen = published.toDataURL()
    for (let i = 0; i < 6; i++) await tick()
    assert(published.toDataURL() === frozen, 'freeze did not hold capture')
    root.render(React.createElement(CanvasEngineSurface, { isPlaying: true, isPaused: true, onCanvasReady }))
    await tick(); await tick()
    video.currentTime = 0.2
    await wait(() => snapshotReady() && !video.seeking && published.toDataURL() !== frozen && read(published, 160, 90)[3] === 255, 'frozen video seek')
    await tick(); await tick()
    const sought = published.toDataURL()
    await tick(); await tick()
    assert(published.toDataURL() === sought, 'frozen seek did not settle')
    controlsRoot.unmount(); root.unmount(); URL.revokeObjectURL(url)
    return { near, far, temporal, still, stillAlpha, videoOutput, captures }
  })
  for (const [name, data] of Object.entries({ temporal: result.temporal, still: result.still, video: result.videoOutput, ...result.captures })) {
    await writeFile(path.join(output, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'))
  }
  console.log(JSON.stringify({ nearRed: result.near, farRed: result.far, stillAlpha: result.stillAlpha, output }))
} finally {
  await browser.close()
}
