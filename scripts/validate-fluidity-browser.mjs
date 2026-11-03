import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base = process.env.FLUIDITY_BASE_URL ?? 'http://127.0.0.1:5173'
const output = process.env.FLUIDITY_OUTPUT_DIR ?? '/tmp/fluidity-validation'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 })
  await page.route('**/__fluidity.html', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles/reactView.css">
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body style="margin:0;background:#172126"></body></html>` }))
  await page.goto(`${base}/__fluidity.html`)
  await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__)
  const result = await page.evaluate(async () => {
    const { FluidityRenderer } = await import('/src/components/vyzualz/react/renderers/fluidity/FluidityRenderer.ts')
    const { FluidityPerformance } = await import('/src/components/vyzualz/react/renderers/fluidity/FluidityPerformance.ts')
    const { DEFAULT_CANVAS_FLUIDITY_SETTINGS: defaults, FLUIDITY_SURFACES } = await import('/src/components/vyzualz/react/renderers/fluidity/FluiditySettings.ts')
    const { createSharedPerformanceFallbackContext } = await import('/src/features/performanceCore/index.ts')
    const W = 640, H = 360
    const make = (width = W, height = H) => Object.assign(document.createElement('canvas'), { width, height })
    const assert = (ok, message) => { if (!ok) throw new Error(message) }
    const load = url => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url })
    const pixels = canvas => {
      const { width, height } = canvas, ctx = make(width, height).getContext('2d')
      ctx.drawImage(canvas, 0, 0)
      return ctx.getImageData(0, 0, width, height).data
    }
    const difference = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length
    const frames = async count => { for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame) }
    const logo = make(), ctx = logo.getContext('2d')
    const fill = ctx.createLinearGradient(32, 26, 605, 310)
    fill.addColorStop(0, '#16306a'); fill.addColorStop(0.55, '#5851cf'); fill.addColorStop(1, '#f68862')
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(36, 26, 568, 308, 38); ctx.fill()
    ctx.save(); ctx.clip()
    ctx.strokeStyle = '#b8d9ef'; ctx.lineWidth = 2
    for (let i = 0; i < W; i += 23) { ctx.beginPath(); ctx.moveTo(i, 26); ctx.lineTo(i + 88, 334); ctx.stroke() }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 96px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DRMVYZ', 320, 209)
    ctx.restore()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); ctx.arc(552, 76, 17, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    const source = await load(logo.toDataURL()), gpu = make(), glRenderer = FluidityRenderer.create(gpu)
    const fixture = make()
    fixture.getContext('2d').drawImage(await load('/mockups/TheKodyRobinson_Neon_club_hallucination_with_massive_pink_han_52216af9-f4da-477c-97d5-c5e22d9c394d_0.png'), 0, 0, W, H)
    const opaque = await load(fixture.toDataURL('image/jpeg', 0.92))
    const transform = { scale: 1, positionX: 0, positionY: 0, rotation: 0 }
    const draw = (patch = {}, time = 1.4, input = source, performance = {}, viewport = logo, fitMode = 'stretch') => {
      const settings = { ...defaults, ...patch }
      const frame = new FluidityPerformance().update(settings, null, time, 0, false, false)
      assert(glRenderer.render({ source: input, settings, frame: { ...frame, ...performance }, fitMode, transform, viewport, dpr: 1 }), 'GPU draw')
      return pixels(gpu)
    }
    const captures = { original: logo.toDataURL() }, baseline = pixels(logo)
    const surfacePixels = []
    for (const surface of FLUIDITY_SURFACES) {
      const image = draw({ surface })
      assert(difference(baseline, image) > 2, surface + ' too close to the original at defaults')
      for (const prior of surfacePixels) assert(difference(prior, image) > 2, surface + ' too close to another surface')
      for (let i = 3; i < image.length; i += 4) assert(Math.abs(baseline[i] - image[i]) <= 1, surface + ' changed alpha')
      surfacePixels.push(image)
      captures[surface] = gpu.toDataURL()
      draw({ surface }, 1.4, opaque)
      captures[surface + '-jpeg'] = gpu.toDataURL()
    }
    assert(difference(surfacePixels[1], draw({}, 2.4)) > 4, 'default glass motion was too subtle')
    captures['low-amount'] = (draw({ amount: 0.25 }), gpu.toDataURL())
    captures['frosted-ribs'] = (draw({ surface: 'ribs', amount: 1, frost: 0.82, bevel: 0.8 }, 1.4, opaque), gpu.toDataURL())
    assert(difference(baseline, draw({ amount: 0, frost: 1, highlight: 1 })) < 0.15, 'zero amount changed the source')
    assert(difference(baseline, draw({ sourceMix: 1, frost: 1, highlight: 1 })) < 0.15, 'full reconstruction changed the source')
    const neutral = draw({ amount: 1, refraction: 0.95, dispersion: 0, preserveColors: true })
    assert(difference(neutral, draw({ amount: 1, refraction: 0.95, dispersion: 1, preserveColors: true })) === 0, 'preserve colors allowed dispersion')
    assert(difference(neutral, draw({ amount: 1, refraction: 0.95, dispersion: 1, preserveColors: false })) > 2, 'dispersion invisible')
    const audio = (time, patch = {}) => {
      const base = createSharedPerformanceFallbackContext(time)
      return { ...base, capabilities: { ...base.capabilities, rhythmEvents: true, liveBands: true },
        confidence: { ...base.confidence, overall: 1, rhythm: 1 }, boundaries: { ...base.boundaries, timingDiscontinuity: false }, ...patch }
    }
    const driver = new FluidityPerformance(), audioSettings = { ...defaults, audioReactivity: 1 }
    driver.update(audioSettings, audio(0), 0, 0.05, false, true)
    driver.update(audioSettings, audio(0.05, { kick: true, kickStrength: 1 }), 0.05, 0.05, false, true)
    const pressure = driver.update(audioSettings, audio(0.25, { bass: 1 }), 0.25, 0.1, false, true)
    assert(difference(draw({}, 1.4), draw({}, 1.4, source, { ...pressure, motion: 1.4 * defaults.flowSpeed })) > 0.65, 'audio did not change refraction')
    captures['audio-pressure'] = gpu.toDataURL()
    const profile = []
    for (const [width, height] of [[1280, 720], [1920, 1080], [3840, 2160], [216, 960]]) {
      draw({ frost: 0.8 }, 1.4, opaque, {}, { width, height }, 'contain')
      profile.push({ stage: [width, height], output: [gpu.width, gpu.height] })
    }
    const gl = gpu.getContext('webgl2'), rendererInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const device = rendererInfo ? gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    assert(gl.getError() === gl.NO_ERROR, 'GPU error')
    glRenderer.dispose()

    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { CanvasEngineSurface, CanvasEngineFxPanel } = await import('/src/components/vyzualz/react/ReactCanvasEngineShell.tsx')
    const { useReactStore: store } = await import('/src/stores/reactStore.ts')
    const { useMediaStore: media } = await import('/src/stores/mediaStore.ts')
    const showDomain = await import('/src/components/vyzualz/showManager/CanvasShowManagerDomain.ts')
    await store.persist.rehydrate()
    store.getState().resetReactView()
    const asset = { id: 'fluidity-fixture', name: 'logo.png', type: 'image', mimeType: 'image/png', url: source.src,
      metadata: { width: W, height: H, hasAlpha: true }, tags: [], collectionIds: [], revision: 1 }
    media.setState({ items: [asset] })
    store.getState().selectCanvasMediaItem(asset.id)
    store.getState().selectCanvasPreset('canvas-fluidity')
    store.getState().setCanvasEngineSettings({ opacity: 1 })
    const host = document.createElement('div'); host.style.cssText = 'width:640px;height:360px;position:relative'; document.body.append(host)
    const controls = document.createElement('div'); document.body.append(controls)
    const root = createRoot(host), controlsRoot = createRoot(controls)
    let published = null, time = 2
    const onCanvasReady = canvas => { published = canvas }
    const getAudioTime = () => time
    const mount = (paused = false, playing = false) => root.render(React.createElement(CanvasEngineSurface,
      { isPlaying: playing, isPaused: paused, getAudioTime, onCanvasReady }))
    const layer = () => host.querySelector('.rv-canvas-fluidity-layer')
    const ready = () => Boolean(published?.width && layer()?.dataset.ready === 'true')
    const wait = async (predicate, label) => {
      for (let i = 0; i < 240; i++) { if (predicate()) return; await frames(1) }
      throw new Error(label + ': ' + host.textContent)
    }
    mount(); controlsRoot.render(React.createElement(CanvasEngineFxPanel))
    await wait(ready, 'Fluidity live output')
    await wait(() => controls.textContent.includes('Glass Amount'), 'Fluidity Design controls')
    await frames(3)
    const first = pixels(published)
    await frames(30)
    assert(difference(first, pixels(published)) > 2, 'CANVAS published output did not animate')
    captures['canvas-preview'] = published.toDataURL()
    const stream = published.captureStream(30), recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = []
    recorder.ondataavailable = event => chunks.push(event.data)
    const encoded = new Promise(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })) })
    recorder.start()
    await frames(36)
    recorder.stop()
    const recording = await encoded
    stream.getTracks().forEach(track => track.stop())
    assert(recording.size > 1200, 'processed output recording was empty')
    const videoUrl = URL.createObjectURL(recording)

    mount(true, true)
    await frames(4)
    const paused = published.toDataURL()
    await frames(4)
    assert(published.toDataURL() === paused, 'paused image advanced')
    time = 6.25
    await wait(() => published?.toDataURL() !== paused, 'paused transport seek')
    host.style.width = '720px'
    await wait(() => published?.width === 720, 'paused resize')
    host.style.width = '640px'
    await wait(() => published?.width === 640, 'restore size')

    const lose = layer().getContext('webgl2').getExtension('WEBGL_lose_context')
    assert(lose, 'context loss extension unavailable')
    lose.loseContext()
    await wait(() => published && host.textContent.includes('Showing the original source'), 'native context-loss fallback')
    captures['fallback'] = published.toDataURL()
    lose.restoreContext()
    await wait(ready, 'WebGL context recovery')
    store.getState().setCanvasPresetSettings({ fluidity: { ...defaults, sourceMix: 1 } })
    await wait(() => layer()?.style.opacity === '0', 'native reconstruction ownership')

    media.setState({ items: [{ ...asset, name: 'recorded.webm', type: 'video', mimeType: 'video/webm', url: videoUrl, revision: 2 }] })
    store.getState().setCanvasPresetSettings({ fluidity: { ...defaults, flowSpeed: 0 } })
    mount(false, true)
    await wait(() => ready() && host.querySelector('video')?.currentTime > 0.1, 'decoded video input')
    const videoStart = published.toDataURL()
    await wait(() => published?.toDataURL() !== videoStart, 'video changed the published optical frame')
    assert(host.querySelectorAll('video').length === 1, 'duplicate video decoder')
    captures['video'] = published.toDataURL()

    media.setState({ items: [asset] }); mount()
    await wait(ready, 'return to logo')
    const authored = store.getState().canvasOrchestrationSettings
    store.setState({ canvasOrchestrationSettings: { ...authored, renderMode: 'layers', authoredLayers: [
      { id: 'fluidity-source-layer', mediaId: asset.id, order: 0, enabled: true, solo: false, pinned: true, ownership: 'manual', effects: [] },
    ] } })
    await wait(() => !layer() && published && host.querySelector('[aria-label="CANVAS orchestrated media surface"]'), 'authored takeover')
    const show = showDomain.createCanvasShowManagerShow('Fluidity ownership fixture')
    show.mediaElements = [{ id: 'source-element', mediaId: asset.id, layer: 0, showStartSec: 0, showEndSec: 120, sourceInSec: null, sourceOutSec: null,
      display: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY }, fx: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_FX },
      transitions: { in: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION }, out: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION } } }]
    store.setState({ canvasShowManagerShows: [show], canvasShowManagerActiveShowId: show.id })
    await frames(12)
    assert(published && !layer(), 'Show output was obscured')
    const shown = published.toDataURL()
    store.getState().selectCanvasPreset('canvas-terminal')
    await frames(6)
    assert(published?.toDataURL() === shown, 'changing direct preset changed Show output')
    store.setState({ canvasShowManagerActiveShowId: null, canvasOrchestrationSettings: { ...authored, renderMode: 'single' } })
    await wait(() => published && host.querySelector('.rv-canvas-terminal-layer[data-ready="true"]'), 'Terminal lifecycle reuse')
    store.getState().selectCanvasPreset('canvas-fluidity')
    await wait(ready, 'restore direct Fluidity')
    assert(store.getState().activeCanvasMediaId === asset.id, 'preset switching changed the media')
    root.unmount(); controlsRoot.unmount(); URL.revokeObjectURL(videoUrl)

    const sheet = make(1280, 764), sheetCtx = sheet.getContext('2d')
    sheetCtx.fillStyle = '#172126'; sheetCtx.fillRect(0, 0, sheet.width, sheet.height)
    for (const [index, [name, url]] of Object.entries(captures).entries()) {
      const x = index % 4 * 320, y = Math.floor(index / 4) * 191
      sheetCtx.fillStyle = '#fff'; sheetCtx.font = '11px sans-serif'; sheetCtx.fillText(name, x + 5, y + 10)
      sheetCtx.drawImage(await load(url), x, y + 11, 320, 180)
    }
    return { sheet: sheet.toDataURL(), capture: captures['canvas-preview'], profile, device, recording: Array.from(new Uint8Array(await recording.arrayBuffer())) }
  })
  for (const name of ['sheet', 'capture']) {
    await writeFile(path.join(output, `${name}.png`), Buffer.from(result[name].split(',')[1], 'base64'))
  }
  await writeFile(path.join(output, 'fluidity.webm'), Buffer.from(result.recording))
  console.log(JSON.stringify({ gpu: result.device, autoSizes: result.profile, recordedBytes: result.recording.length, output }))
} finally {
  await browser.close()
}
