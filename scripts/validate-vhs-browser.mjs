import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base = process.env.VHS_BASE_URL ?? 'http://127.0.0.1:5173'
const output = process.env.VHS_OUTPUT_DIR ?? '/tmp/vhs-validation'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 })
  await page.route('**/__vhs.html', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles/reactView.css">
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body style="margin:0;background:#172126"></body></html>` }))
  await page.goto(`${base}/__vhs.html`)
  await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__)
  const result = await page.evaluate(async () => {
    const { VhsRenderer } = await import('/src/components/vyzualz/react/renderers/vhs/VhsRenderer.ts')
    const { VhsPerformance } = await import('/src/components/vyzualz/react/renderers/vhs/VhsPerformance.ts')
    const { DEFAULT_CANVAS_VHS_SETTINGS: defaults, VHS_TREATMENTS, VHS_HISTORY_WARMUP_FRAMES } = await import('/src/components/vyzualz/react/renderers/vhs/VhsSettings.ts')
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
    const chart = make(), o = chart.getContext('2d')
    o.fillStyle = '#111323'; o.fillRect(0, 0, W, H)
    const colors = ['#dddbe0', '#eac35a', '#50cbcd', '#75ce72', '#b76cca', '#cf5367', '#5c69dc']
    colors.forEach((color, i) => {
      o.fillStyle = color; o.fillRect(24 + i * 85, 24, 85, 218)
      o.fillStyle = colors[(6 - i + 7) % 7]; o.fillRect(24 + i * 85, 242, 85, 21)
    })
    o.fillStyle = '#111323'; o.fillRect(69, 113, 502, 87)
    o.fillStyle = '#f0e5dc'; o.font = 'bold 56px monospace'; o.textAlign = 'center'; o.fillText('DRMVYZ / VHS', 320, 174)
    o.textAlign = 'left'; o.font = '17px monospace'; o.fillText('SP   PLAY  ►', 24, 306); o.fillText('00:07:21', 523, 306)
    const jpeg = await load(chart.toDataURL('image/jpeg', 0.96))
    const logo = make(), l = logo.getContext('2d')
    l.fillStyle = '#5fda96'; l.font = '900 109px sans-serif'; l.textAlign = 'center'; l.fillText('ANALOG', 320, 213)
    l.strokeStyle = '#eef7cc'; l.lineWidth = 3; l.strokeText('ANALOG', 320, 213)
    l.fillStyle = '#f08489'; l.fillRect(82, 241, 472, 13)
    const png = await load(logo.toDataURL())
    const gpu = make(), renderer = VhsRenderer.create(gpu), gl = gpu.getContext('webgl2')
    const transform = { scale: 1, positionX: 0, positionY: 0, rotation: 0 }
    const draw = (input, patch = {}, time = 1.13, performance = {}, viewport = chart, fitMode = 'stretch') => {
      const settings = { ...defaults, ...patch }
      const frame = new VhsPerformance().update(settings, null, time, 1 / 60, false, false)
      assert(renderer.render({ source: input, settings, frame: { ...frame, ...performance }, fitMode, transform, viewport, dpr: 1 }), 'GPU draw')
      return pixels(gpu)
    }
    const captures = { original: jpeg.src, 'alpha original': png.src }
    const baseline = draw(jpeg, { amount: 0 }), alpha = pixels(logo)
    const treatments = []
    for (const treatment of VHS_TREATMENTS) {
      const pixels = draw(jpeg, { treatment })
      assert(difference(baseline, pixels) > 3, treatment + ' too close to original')
      for (const [index, prior] of treatments.entries()) {
        const delta = difference(prior, pixels)
        assert(delta > 2, treatment + ' indistinct from ' + VHS_TREATMENTS[index] + ' (' + delta + ')')
      }
      treatments.push(pixels)
      captures[treatment] = gpu.toDataURL()
      const transparent = draw(png, { treatment })
      for (let i = 3; i < transparent.length; i += 4) assert(Math.abs(transparent[i] - alpha[i]) <= 1, 'treatment changed source coverage')
      captures[treatment + ' alpha'] = gpu.toDataURL()
    }
    draw(jpeg, { amount: 0.25 })
    captures['low signal'] = gpu.toDataURL()
    const damaged = { amount: 1, tracking: 0.55, damage: 0.8, dropout: 0.47, roll: 0.36, bleed: 0.46, persistence: 0 }
    const first = draw(jpeg, damaged, 2.12)
    captures['damaged hybrid'] = gpu.toDataURL()
    assert(difference(first, draw(jpeg, damaged, 2.85)) > 3, 'seeded tape damage did not move')
    assert(difference(first, draw(jpeg, damaged, 2.12)) === 0, 'seeded tape did not reconstruct at the same position')
    assert(difference(baseline, draw(jpeg, { ...damaged, sourceMix: 1 })) === 0, 'full reconstruction changed original')
    assert(difference(baseline, draw(jpeg, { ...damaged, amount: 0 })) === 0, 'zero amount changed original')

    const phosphor = make(), phosphorCtx = phosphor.getContext('2d')
    const steady = { treatment: 'crt', amount: 1, tracking: 0, dropout: 0, bleed: 0, persistence: 0.83, speed: 0, grain: 0, scanlines: 0, phosphor: 0, roll: 0, curvature: 0, misalignment: 0 }
    const fill = color => { phosphorCtx.fillStyle = color; phosphorCtx.fillRect(0, 0, W, H) }
    fill('#ff4675')
    draw(phosphor, steady)
    fill('#101321')
    const warm = draw(phosphor, steady, 1.2, { resetHistory: false })
    assert(warm[(180 * W + 320) * 4] < 20, 'warmup read old history')
    fill('#ff4675')
    for (let i = 0; i < VHS_HISTORY_WARMUP_FRAMES; i++) draw(phosphor, steady, 1.4 + i / 60, { resetHistory: false })
    fill('#101321')
    const trail = draw(phosphor, steady, 1.7, { resetHistory: false })
    assert(difference(warm, trail) > 30, 'phosphor did not retain prior brightness')
    captures['phosphor afterglow'] = gpu.toDataURL()
    const seek = draw(phosphor, steady, 9.2, { paused: true })
    assert(difference(warm, seek) === 0, 'seek leaked phosphor history')
    assert(difference(warm, draw(phosphor, { ...steady, treatment: 'tape' })) === 0, 'tape read inactive CRT history')

    const driver = new VhsPerformance()
    const rhythm = (time, patch = {}) => {
      const base = createSharedPerformanceFallbackContext(time)
      return { ...base, capabilities: { ...base.capabilities, rhythmEvents: true, liveBands: true },
        confidence: { ...base.confidence, overall: 1, rhythm: 1 }, boundaries: { ...base.boundaries, timingDiscontinuity: false }, ...patch }
    }
    const reactive = { ...defaults, ...damaged, audioReactivity: 1 }
    driver.update(reactive, rhythm(0), 0, 0.05, false, true)
    const hit = driver.update(reactive, rhythm(0.05, { kick: true, kickStrength: 1, bass: 1 }), 0.05, 0.05, false, true)
    assert(difference(first, draw(jpeg, damaged, 2.12, { ...hit, phase: 2.12 })) > 1, 'kick did not alter signal')
    captures['kick accent'] = gpu.toDataURL()
    const profile = []
    for (const [width, height] of [[1280, 720], [1920, 1080], [3840, 2160], [240, 900]]) {
      draw(jpeg, {}, 0, {}, { width, height }, 'contain')
      profile.push({ stage: [width, height], output: [gpu.width, gpu.height], historyBytes: gpu.width * gpu.height * 8 })
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
    const asset = { id: 'vhs-fixture', name: 'chart.jpg', type: 'image', mimeType: 'image/jpeg', url: jpeg.src,
      metadata: { width: W, height: H }, tags: [], collectionIds: [], revision: 1 }
    media.setState({ items: [asset] })
    store.getState().selectCanvasMediaItem(asset.id)
    store.getState().selectCanvasPreset('canvas-vhs')
    store.getState().setCanvasEngineSettings({ opacity: 1 })
    store.getState().setCanvasPresetSettings({ vhs: { ...defaults, ...damaged, persistence: 0.32 } })
    const host = document.createElement('div'); host.style.cssText = 'width:640px;height:360px;position:relative'; document.body.append(host)
    const controls = document.createElement('div'); document.body.append(controls)
    const root = createRoot(host), controlsRoot = createRoot(controls)
    let published = null, time = 2
    const onCanvasReady = canvas => { published = canvas }
    const getAudioTime = () => time
    const mount = (paused = false, playing = false) => root.render(React.createElement(CanvasEngineSurface,
      { isPlaying: playing, isPaused: paused, getAudioTime, onCanvasReady }))
    const layer = () => host.querySelector('.rv-canvas-vhs-layer')
    const ready = () => Boolean(published?.width && layer()?.dataset.ready === 'true')
    const wait = async (predicate, label) => {
      for (let i = 0; i < 180; i++) { if (predicate()) return; await frames(1) }
      throw new Error(label + ': ' + host.textContent)
    }
    mount(); controlsRoot.render(React.createElement(CanvasEngineFxPanel))
    await wait(ready, 'VHS live output')
    await wait(() => controls.textContent.includes('Signal Amount'), 'VHS Design')
    const changeTreatment = treatment => store.getState().setCanvasPresetSettings({ vhs: { ...defaults, treatment } })
    changeTreatment('tape')
    await wait(() => controls.textContent.includes('Tracking Error') && !controls.textContent.includes('Scanline Strength'), 'Tape controls')
    changeTreatment('crt')
    await wait(() => controls.textContent.includes('Scanline Strength') && !controls.textContent.includes('Tracking Error'), 'CRT controls')
    controls.querySelector('[aria-label="Reset VHS settings"]').click()
    await wait(() => controls.textContent.includes('Tracking Error') && controls.textContent.includes('Scanline Strength'), 'Reset restores Hybrid controls')
    assert(store.getState().activeCanvasMediaId === asset.id, 'Reset replaced media')
    await frames(3)
    const publishedFirst = pixels(published)
    await frames(22)
    assert(difference(publishedFirst, pixels(published)) > 0.4, 'CANVAS capture did not animate')
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
    store.getState().setCanvasPresetSettings({ vhs: { ...defaults, speed: 0 } })
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
      { id: 'vhs-source', mediaId: asset.id, order: 0, enabled: true, solo: false, pinned: true, ownership: 'manual', effects: [] },
    ] } })
    await wait(() => !layer() && published && host.querySelector('[aria-label="CANVAS orchestrated media surface"]'), 'authored takeover')
    const show = showDomain.createCanvasShowManagerShow('VHS ownership fixture')
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
    store.getState().selectCanvasPreset('canvas-vhs')
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
    return { sheet: sheet.toDataURL(), capture: captures['CANVAS output'], profile, device,
      recording: Array.from(new Uint8Array(await recording.arrayBuffer())) }
  })
  for (const name of ['sheet', 'capture']) {
    await writeFile(path.join(output, `${name}.png`), Buffer.from(result[name].split(',')[1], 'base64'))
  }
  await writeFile(path.join(output, 'vhs.webm'), Buffer.from(result.recording))
  console.log(JSON.stringify({ gpu: result.device, autoSizes: result.profile, recordedBytes: result.recording.length, output }))
} finally {
  await browser.close()
}
