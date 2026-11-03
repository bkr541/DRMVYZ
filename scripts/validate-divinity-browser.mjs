import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base = process.env.DIVINITY_BASE_URL ?? 'http://127.0.0.1:5173'
const output = process.env.DIVINITY_OUTPUT_DIR ?? '/tmp/divinity-validation'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 })
  await page.route('**/__divinity.html', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles/reactView.css">
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body style="margin:0;background:#172126"></body></html>` }))
  await page.goto(`${base}/__divinity.html`)
  await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__)
  const result = await page.evaluate(async () => {
    const { DivinityRenderer } = await import('/src/components/vyzualz/react/renderers/divinity/DivinityRenderer.ts')
    const { DivinityPerformance } = await import('/src/components/vyzualz/react/renderers/divinity/DivinityPerformance.ts')
    const { DEFAULT_CANVAS_DIVINITY_SETTINGS: defaults } = await import('/src/components/vyzualz/react/renderers/divinity/DivinitySettings.ts')
    const { createSharedPerformanceFallbackContext } = await import('/src/features/performanceCore/index.ts')
    const W = 640, H = 360
    const make = (width = W, height = H) => Object.assign(document.createElement('canvas'), { width, height })
    const assert = (ok, message) => { if (!ok) throw new Error(message) }
    const load = url => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url })
    const pixels = canvas => {
      const ctx = make(canvas.width, canvas.height).getContext('2d')
      ctx.drawImage(canvas, 0, 0)
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data
    }
    const difference = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length
    const frames = async count => { for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame) }
    const opaque = make(), o = opaque.getContext('2d')
    const gradient = o.createLinearGradient(0, 0, 0, H)
    gradient.addColorStop(0, '#101924'); gradient.addColorStop(1, '#080e1b')
    o.fillStyle = gradient; o.fillRect(0, 0, W, H)
    for (const [x, hue] of [[218, '#8bd9f2'], [320, '#fff1b5'], [422, '#eaaa6d']]) {
      o.save(); o.translate(x, 119); o.beginPath()
      o.moveTo(-28, 52); o.lineTo(-28, 0); o.quadraticCurveTo(-28, -26, 0, -49)
      o.quadraticCurveTo(28, -26, 28, 0); o.lineTo(28, 52); o.closePath()
      o.strokeStyle = '#303b50'; o.lineWidth = 8; o.stroke(); o.clip()
      const pane = o.createLinearGradient(0, -49, 0, 52)
      pane.addColorStop(0, '#fffdee'); pane.addColorStop(1, hue)
      o.fillStyle = pane; o.fillRect(-28, -49, 56, 101)
      o.fillStyle = '#172133'; o.fillRect(-2, -49, 4, 101); o.fillRect(-28, 9, 56, 4); o.restore()
    }
    o.strokeStyle = '#283448'; o.lineWidth = 2
    for (const x of [98, 145, 495, 542]) { o.beginPath(); o.moveTo(x, 10); o.lineTo(x, 265); o.stroke() }
    const jpeg = await load(opaque.toDataURL('image/jpeg', 0.94))
    const logo = make(), l = logo.getContext('2d')
    l.fillStyle = '#30243f'; l.font = '900 95px sans-serif'; l.textAlign = 'center'; l.fillText('DIVINITY', 320, 179)
    l.strokeStyle = '#9471a4'; l.lineWidth = 1.4; l.strokeText('DIVINITY', 320, 179)
    l.fillStyle = '#e8d6fe'; l.fillRect(196, 195, 248, 3)
    const png = await load(logo.toDataURL())
    const gpu = make(), renderer = DivinityRenderer.create(gpu), gl = gpu.getContext('webgl2')
    const transform = { scale: 1, positionX: 0, positionY: 0, rotation: 0 }
    const draw = (input, patch = {}, time = 0, audioFrame = {}, viewport = logo, fitMode = 'stretch') => {
      const settings = { ...defaults, ...patch }
      const frame = new DivinityPerformance().update(settings, null, time, 0, false, false)
      assert(renderer.render({ source: input, settings, frame: { ...frame, ...audioFrame }, fitMode, transform, viewport, dpr: 1 }), 'GPU draw')
      return pixels(gpu)
    }
    const captures = { 'opaque original': jpeg.src, 'alpha original': png.src }
    const logoPixels = pixels(logo)
    const alpha = { mask: 'alpha', originY: 0.23 }
    const rays = draw(png, alpha)
    captures['alpha shafts'] = gpu.toDataURL()
    let expanded = 0, unlit = 0
    for (let i = 3; i < rays.length; i += 4) {
      if (logoPixels[i] === 0 && rays[i] > 5) expanded++
      if (rays[i] === 0) unlit++
    }
    assert(expanded > 3000 && unlit > 3000, 'alpha rays missing or blanketed the stage')
    const clipped = draw(png, { ...alpha, clipToAlpha: true })
    for (let i = 3; i < clipped.length; i += 4) assert(Math.abs(logoPixels[i] - clipped[i]) <= 1, 'clipped emission changed source alpha')
    captures['clipped rays'] = gpu.toDataURL()
    assert(difference(logoPixels, draw(png, { ...alpha, amount: 0 })) < 0.15, 'zero amount altered the original')
    assert(difference(logoPixels, draw(png, { ...alpha, sourceMix: 1 })) < 0.15, 'reconstruction altered the original')
    assert(difference(rays, draw(png, { ...alpha, colorMode: 'manual', color: '#fb8aa8' })) > 2, 'manual tint had no effect')
    captures['manual rose'] = gpu.toDataURL()

    const baseline = draw(jpeg, { amount: 0 })
    const windows = { originX: 0.5, originY: 0.15 }
    const lit = draw(jpeg, windows)
    assert(difference(baseline, lit) > 2, 'default ray settings too subtle on highlights')
    captures['luminance shafts'] = gpu.toDataURL()
    assert(difference(lit, draw(jpeg, { ...windows, originX: 0.76, originY: 0.12 })) > 2, 'changing the origin did not redirect rays')
    captures['off-axis light'] = gpu.toDataURL()
    assert(difference(baseline, draw(jpeg, { ...windows, threshold: 1 })) < difference(baseline, lit), 'threshold did not suppress luminance rays')
    draw(jpeg, { ...windows, amount: 0.28 })
    captures['low ray amount'] = gpu.toDataURL()
    draw(jpeg, { ...windows, amount: 0.85, density: 0.67, spread: 0.30 })
    captures['high ray amount'] = gpu.toDataURL()
    const driver = new DivinityPerformance()
    const rhythm = (time, patch = {}) => {
      const base = createSharedPerformanceFallbackContext(time)
      return { ...base, capabilities: { ...base.capabilities, rhythmEvents: true, liveBands: true },
        confidence: { ...base.confidence, overall: 1, rhythm: 1 }, boundaries: { ...base.boundaries, timingDiscontinuity: false }, ...patch }
    }
    const reactive = { ...defaults, ...windows, audioReactivity: 1 }
    driver.update(reactive, rhythm(0), 0, 0.05, false, true)
    const hit = driver.update(reactive, rhythm(0.05, { kick: true, kickStrength: 1, bass: 1 }), 0.05, 0.05, false, true)
    assert(difference(lit, draw(jpeg, windows, 0, hit)) > 1, 'audio did not change the published light treatment')
    captures['kick accent'] = gpu.toDataURL()
    const profile = []
    for (const [width, height] of [[1280, 720], [1920, 1080], [3840, 2160], [240, 900]]) {
      draw(jpeg, windows, 0, {}, { width, height }, 'contain')
      profile.push({ stage: [width, height], output: [gpu.width, gpu.height] })
    }
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const device = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    assert(gl.getError() === gl.NO_ERROR, 'GPU error')
    renderer.dispose()

    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { CanvasEngineSurface, CanvasEngineFxPanel } = await import('/src/components/vyzualz/react/ReactCanvasEngineShell.tsx')
    const { useReactStore: store } = await import('/src/stores/reactStore.ts')
    const { useMediaStore: media } = await import('/src/stores/mediaStore.ts')
    const showDomain = await import('/src/components/vyzualz/showManager/CanvasShowManagerDomain.ts')
    await store.persist.rehydrate()
    store.getState().resetReactView()
    const asset = { id: 'divinity-fixture', name: 'window.jpg', type: 'image', mimeType: 'image/jpeg', url: jpeg.src,
      metadata: { width: W, height: H }, tags: [], collectionIds: [], revision: 1 }
    media.setState({ items: [asset] })
    store.getState().selectCanvasMediaItem(asset.id)
    store.getState().selectCanvasPreset('canvas-divinity')
    store.getState().setCanvasEngineSettings({ opacity: 1 })
    store.getState().setCanvasPresetSettings({ divinity: { ...defaults, ...windows } })
    const host = document.createElement('div'); host.style.cssText = 'width:640px;height:360px;position:relative'; document.body.append(host)
    const controls = document.createElement('div'); document.body.append(controls)
    const root = createRoot(host), controlsRoot = createRoot(controls)
    let published = null, time = 2
    const onCanvasReady = canvas => { published = canvas }
    const getAudioTime = () => time
    const mount = (paused = false, playing = false) => root.render(React.createElement(CanvasEngineSurface,
      { isPlaying: playing, isPaused: paused, getAudioTime, onCanvasReady }))
    const layer = () => host.querySelector('.rv-canvas-divinity-layer')
    const ready = () => Boolean(published?.width && layer()?.dataset.ready === 'true')
    const wait = async (predicate, label) => {
      for (let i = 0; i < 180; i++) { if (predicate()) return; await frames(1) }
      throw new Error(label + ': ' + host.textContent)
    }
    mount(); controlsRoot.render(React.createElement(CanvasEngineFxPanel))
    await wait(ready, 'Divinity live output')
    await wait(() => controls.textContent.includes('Ray Amount'), 'Divinity Design')
    await frames(3)
    const first = pixels(published)
    await frames(22)
    assert(difference(first, pixels(published)) > 0.4, 'CANVAS capture did not animate')
    captures['CANVAS output'] = published.toDataURL()
    const stream = published.captureStream(30), recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = []
    recorder.ondataavailable = event => chunks.push(event.data)
    const encoded = new Promise(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })) })
    recorder.start()
    await frames(35)
    recorder.stop()
    const recording = await encoded
    stream.getTracks().forEach(track => track.stop())
    assert(recording.size > 1500, 'processed recording was empty')
    const videoUrl = URL.createObjectURL(recording)

    mount(true, true)
    await frames(5)
    const held = published.toDataURL()
    await frames(4)
    assert(published.toDataURL() === held, 'paused capture advanced')
    time = 8.2
    await wait(() => published?.toDataURL() !== held, 'paused transport seek')
    host.style.width = '720px'
    await wait(() => published?.width === 720, 'paused resize')
    host.style.width = '640px'
    await wait(() => published?.width === 640, 'restore size')
    const lose = layer().getContext('webgl2').getExtension('WEBGL_lose_context')
    assert(lose, 'context loss extension unavailable')
    lose.loseContext()
    await wait(() => published && host.textContent.includes('Showing the original source'), 'context-loss fallback')
    captures['source fallback'] = published.toDataURL()
    lose.restoreContext()
    await wait(ready, 'context recovery')

    media.setState({ items: [{ ...asset, name: 'recorded.webm', type: 'video', mimeType: 'video/webm', url: videoUrl, revision: 2 }] })
    store.getState().setCanvasPresetSettings({ divinity: { ...defaults, ...windows, motionSpeed: 0 } })
    mount(false, true)
    await wait(() => ready() && host.querySelector('video')?.currentTime > 0.1, 'decoded video')
    const decoded = published.toDataURL()
    await wait(() => published?.toDataURL() !== decoded, 'video did not update the mask')
    assert(host.querySelectorAll('video').length === 1, 'duplicate decoder')
    captures['video input'] = published.toDataURL()
    media.setState({ items: [asset] }); mount()
    await wait(ready, 'return to still image')
    const authored = store.getState().canvasOrchestrationSettings
    store.setState({ canvasOrchestrationSettings: { ...authored, renderMode: 'layers', authoredLayers: [
      { id: 'divinity-source', mediaId: asset.id, order: 0, enabled: true, solo: false, pinned: true, ownership: 'manual', effects: [] },
    ] } })
    await wait(() => !layer() && published && host.querySelector('[aria-label="CANVAS orchestrated media surface"]'), 'authored takeover')
    const show = showDomain.createCanvasShowManagerShow('Divinity ownership fixture')
    show.mediaElements = [{ id: 'source', mediaId: asset.id, layer: 0, showStartSec: 0, showEndSec: 120, sourceInSec: null, sourceOutSec: null,
      display: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY }, fx: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_FX },
      transitions: { in: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION }, out: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION } } }]
    store.setState({ canvasShowManagerShows: [show], canvasShowManagerActiveShowId: show.id })
    await frames(12)
    assert(published && !layer(), 'Show output lost ownership')
    const shown = published.toDataURL()
    store.getState().selectCanvasPreset('canvas-clean-playback')
    await frames(6)
    assert(published?.toDataURL() === shown, 'changing direct preset changed the Show')
    store.getState().selectCanvasPreset('canvas-divinity')
    store.setState({ canvasShowManagerActiveShowId: null, canvasOrchestrationSettings: { ...authored, renderMode: 'single' } })
    await wait(ready, 'restore direct preset')
    assert(store.getState().activeCanvasMediaId === asset.id, 'preset switch changed media')
    root.unmount(); controlsRoot.unmount(); URL.revokeObjectURL(videoUrl)

    const sheet = make(1280, Math.ceil(Object.keys(captures).length / 4) * 192), ctx = sheet.getContext('2d')
    ctx.fillStyle = '#172126'; ctx.fillRect(0, 0, sheet.width, sheet.height)
    for (const [index, [name, url]] of Object.entries(captures).entries()) {
      const x = index % 4 * 320, y = Math.floor(index / 4) * 192
      ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(name, x + 5, y + 10)
      ctx.drawImage(await load(url), x, y + 12, 320, 180)
    }
    return { sheet: sheet.toDataURL(), capture: captures['CANVAS output'], profile, device, expanded,
      recording: Array.from(new Uint8Array(await recording.arrayBuffer())) }
  })
  for (const name of ['sheet', 'capture']) {
    await writeFile(path.join(output, `${name}.png`), Buffer.from(result[name].split(',')[1], 'base64'))
  }
  await writeFile(path.join(output, 'divinity.webm'), Buffer.from(result.recording))
  console.log(JSON.stringify({ gpu: result.device, autoSizes: result.profile, expandedPixels: result.expanded, recordedBytes: result.recording.length, output }))
} finally {
  await browser.close()
}
