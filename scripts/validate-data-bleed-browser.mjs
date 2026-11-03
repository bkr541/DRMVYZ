/* Browser globals live inside the isolated Vite component harness. */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
const baseUrl = process.env.DATA_BLEED_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = process.env.DATA_BLEED_OUTPUT_DIR ?? '/tmp/data-bleed-validation'
const soakSeconds = Number(process.env.DATA_BLEED_SOAK_SECONDS ?? 60)
await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 }, deviceScaleFactor: 1 })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  page.on('console', message => { if (message.type() === 'error' || message.text().includes('GL_INVALID')) console.error(message.text()) })
  if (process.env.DATA_BLEED_DEBUG === '1') page.on('console', message => console.log(message.text()))
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect x="60" y="60" width="520" height="240" rx="24" fill="#fc367c"/><circle cx="170" cy="180" r="90" fill="#50f6c2"/><path d="M330 80L560 280H330Z" fill="#5549ed"/><text x="90" y="205" font-family="sans-serif" font-size="68" fill="white">DATA BLEED</text></svg>'
  await page.route('**/data-bleed-fixture.svg?**', route => { const expired = route.request().url().includes('expired'); return route.fulfill({ status: expired ? 403 : 200, contentType: expired ? 'text/plain' : 'image/svg+xml', body: expired ? 'Signature expired' : svg }) })
  await page.route('**/__data-bleed.html', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles/appearance.css"><link rel="stylesheet" href="/src/styles/reactView.css"><link rel="stylesheet" href="/src/styles/typography.css">
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body style="margin:0;background:#172126;color:white;font-family:sans-serif"></body></html>` }))
  const visit = async () => { await page.goto(`${baseUrl}/__data-bleed.html`); await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__) }
  await visit()
  const result = await page.evaluate(async ({ svg, soakSeconds }) => {
    const { DataBleedRenderer } = await import('/src/components/vyzualz/react/renderers/dataBleed/DataBleedRenderer.ts')
    const { DEFAULT_CANVAS_DATA_BLEED_SETTINGS: defaults, clearDataBleedHistory } = await import('/src/components/vyzualz/react/renderers/dataBleed/DataBleedSettings.ts')
    const { resolveDataBleedPlan } = await import('/src/components/vyzualz/react/renderers/dataBleed/DataBleedRenderPlan.ts')
    const { DataBleedPerformanceController } = await import('/src/components/vyzualz/react/renderers/dataBleed/DataBleedPerformanceController.ts')
    const { createSharedPerformanceFallbackContext } = await import('/src/features/performanceCore/index.ts')
    const assert = (value, label) => { if (!value) throw new Error(label) }
    const frames = async n => { for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame) }
    const make = (w = 640, h = 360) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    const load = url => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url })
    const pixels = c => { const copy = make(c.width, c.height), ctx = copy.getContext('2d'); ctx.drawImage(c, 0, 0); return ctx.getImageData(0, 0, copy.width, copy.height).data }
    const diff = (a, b) => { assert(a.length === b.length, 'dimensions'); let sum = 0, large = 0; for (let i = 0; i < a.length; i++) { const offset = (i & ~3) + 3, x = i % 4 === 3 ? a[i] : a[i] * a[offset] / 255, y = i % 4 === 3 ? b[i] : b[i] * b[offset] / 255; const d = Math.abs(x - y); sum += d; if (d > 8) large++ } return { mean: sum / a.length, fractionOver8: large / a.length } }
    const identity = (a, b, label) => { const d = diff(a, b); assert(d.mean <= 1 && d.fractionOver8 < 0.03, label + JSON.stringify(d)); return d }
    const captures = [], capture = (name, c) => captures.push({ name, image: c.toDataURL() })
    window.__dataBleedPartial = { captures }
    const source = await load('data:image/svg+xml,' + encodeURIComponent(svg))
    const logoCanvas = make(); logoCanvas.getContext('2d').drawImage(source, 0, 0)
    const logo = await load(logoCanvas.toDataURL())
    const opaque = make(), oc = opaque.getContext('2d'), gradient = oc.createLinearGradient(0, 0, 640, 360)
    gradient.addColorStop(0, '#f78826'); gradient.addColorStop(0.5, '#3a287f'); gradient.addColorStop(1, '#16b8be'); oc.fillStyle = gradient; oc.fillRect(0, 0, 640, 360); oc.drawImage(logo, 0, 0)
    const jpeg = await load(opaque.toDataURL('image/jpeg', 0.95))
    const fixtureMetrics = [], t = { scale: 1, positionX: 0, positionY: 0, rotation: 0 }
    const draw = (r, image, settings, time, options = {}) => r.render({ source: image, settings, timeSec: time, deltaSec: 1 / 60, fitMode: 'contain', sourceTransform: t, ...options })
    for (const [name, image] of [['alpha-logo', logo], ['opaque-jpeg', jpeg], ['svg', source]]) {
      const c = make(), { renderer, error } = DataBleedRenderer.create(c); assert(renderer, error)
      const gl = c.getContext('webgl2'), reference = make(); reference.getContext('2d').drawImage(image, 0, 0)
      capture(name + '-original', reference)
      draw(renderer, image, { ...defaults, amount: 0 }, 0)
      const clean = identity(pixels(c), pixels(reference), name + '/zero')
      const stills = []
      for (const amount of [0.15, 0.65, 1]) {
        renderer.resetHistory()
        for (let i = 0; i < 36; i++) assert(draw(renderer, image, { ...defaults, amount }, 2 + i / 60), 'still render')
        const final = pixels(c); capture(name + '-amount-' + amount, c); stills.push(diff(final, pixels(reference)).mean)
      }
      assert(stills[2] > 1, 'still bleed not visible')
      const moving = pixels(c); for (let i = 0; i < 24; i++) draw(renderer, image, defaults, 2.6 + i / 60)
      assert(diff(moving, pixels(c)).mean > 0.1, 'still not animated')
      draw(renderer, image, { ...defaults, sourceMix: 1 }, 3.2); identity(pixels(c), pixels(reference), name + '/reconstruction')
      assert(renderer.getDiagnostics().sourceUploads === 1, 'still source reuploaded')
      assert(gl.getError() === gl.NO_ERROR, 'still GL error')
      fixtureMetrics.push({ name, clean, strengthDifference: stills, diagnostics: renderer.getDiagnostics() }); renderer.dispose()
    }
    const aspectChecks = [], aspectCanvas = make(), aspectRenderer = DataBleedRenderer.create(aspectCanvas).renderer
    for (const [width, height] of [[120, 1200], [1800, 120]]) {
      const input = make(width, height); input.getContext('2d').drawImage(jpeg, 0, 0, width, height); const image = await load(input.toDataURL())
      for (const fitMode of ['contain', 'cover', 'stretch']) {
        const transform = { scale: 0.73, positionX: 11, positionY: -7, rotation: 23 }
        const reference = make(), ctx = reference.getContext('2d'); ctx.translate(640 * 0.61, 360 * 0.43); ctx.rotate(23 * Math.PI / 180); ctx.scale(0.73, 0.73)
        const k = fitMode === 'cover' ? Math.max(640 / width, 360 / height) : Math.min(640 / width, 360 / height), w = fitMode === 'stretch' ? 640 : width * k, h = fitMode === 'stretch' ? 360 : height * k
        ctx.drawImage(image, -w / 2, -h / 2, w, h)
        draw(aspectRenderer, image, { ...defaults, amount: 0 }, 0, { fitMode, sourceTransform: transform })
        aspectChecks.push({ width, height, fitMode, ...identity(pixels(aspectCanvas), pixels(reference), 'aspect/transform') })
      }
    }
    aspectRenderer.dispose()
    // Actual encoded deterministic moving-source fixture: no camera, external assets or analyzer.
    const videoCanvas = make(320, 180), vc = videoCanvas.getContext('2d'), stream = videoCanvas.captureStream(0), track = stream.getVideoTracks()[0]
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const chunks = [], recorder = new MediaRecorder(stream, { mimeType })
    const completed = new Promise(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType })) }); recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }; recorder.start()
    for (let i = 0; i < 60; i++) {
      vc.fillStyle = '#13202b'; vc.fillRect(0, 0, 320, 180)
      const offset = i * 2 % 320; vc.drawImage(jpeg, offset, 0, 320, 180); vc.drawImage(jpeg, offset - 320, 0, 320, 180)
      vc.fillStyle = '#fff'; vc.font = '16px monospace'; vc.fillText(String(i).padStart(2, '0'), 8, 22)
      track.requestFrame(); await new Promise(resolve => setTimeout(resolve, 1000 / 30))
    }
    recorder.stop(); const videoBlob = await completed; stream.getTracks().forEach(tr => tr.stop())
    const videoUrl = URL.createObjectURL(videoBlob), video = document.createElement('video'); video.src = videoUrl; video.muted = true; video.loop = true; video.playsInline = true
    await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject }); await video.play()
    const c = make(), { renderer, error } = DataBleedRenderer.create(c); assert(renderer, error)
    const gl = c.getContext('webgl2'), videoMetrics = [], motionSensitivity = []
    for (const mode of ['motion', 'procedural', 'mixed']) {
      renderer.resetHistory(); let first = null
      for (let i = 0; i < 45; i++) { assert(draw(renderer, video, { ...defaults, flowMode: mode }, i / 60), 'video frame'); if (i === 15) first = pixels(c); await frames(1) }
      capture('video-' + mode, c); const d = diff(first, pixels(c)); assert(d.mean > 0.5, mode + ' video static'); assert(renderer.getDiagnostics().motionPairReady, 'no original video pair')
      videoMetrics.push({ mode, difference: d, diagnostics: renderer.getDiagnostics() })
    }
    const frozenSettings = { ...defaults, freezeHistory: true }, before = renderer.getDiagnostics().feedbackUpdates
    draw(renderer, video, frozenSettings, 0.74); const frozen = pixels(c); await frames(5); draw(renderer, video, frozenSettings, 0.75)
    identity(frozen, pixels(c), 'GPU freeze'); assert(renderer.getDiagnostics().feedbackUpdates === before, 'frozen history advanced')
    video.pause()
    // Replay identical decoded positions to isolate motion estimation from mere
    // source playback; sensitivity must materially change the same final frame.
    for (const sensitivity of [0, 1]) {
      renderer.resetHistory()
      for (let i = 0; i < 20; i++) {
        const position = 0.1 + i / 30
        await new Promise(resolve => { video.onseeked = resolve; video.currentTime = position })
        assert(draw(renderer, video, { ...defaults, flowMode: 'motion', amount: 1, motionSensitivity: sensitivity }, position, { deltaSec: 1 / 30 }), 'motion replay')
      }
      motionSensitivity.push(pixels(c)); capture('video-sensitivity-' + sensitivity, c)
    }
    const motionSensitivityDifference = diff(motionSensitivity[0], motionSensitivity[1])
    assert(motionSensitivityDifference.mean > 0.1, 'motion sensitivity did not change displacement')
    renderer.dispose()

    // Performance Core feature/section fixture, renderer and immutable source together.
    const storyCanvas = make(), storyRenderer = DataBleedRenderer.create(storyCanvas).renderer, controller = new DataBleedPerformanceController(), arrangement = []
    for (const [index, sectionType] of ['intro', 'build', 'drop', 'breakdown'].entries()) {
      let decision
      for (let i = 0; i < 40; i++) {
        const timeSec = index * 2 + i / 20, base = createSharedPerformanceFallbackContext(timeSec)
        const context = { ...base, trackIdentity: 'data-bleed-fixture', runtimeIdentity: 'data-bleed-fixture', sectionType, sectionId: sectionType, sectionProgress: i / 40, buildProgress: sectionType === 'build' ? i / 40 : 0, dropOccurrence: 1, bass: sectionType === 'drop' ? 1 : 0.2, mid: 0.6, high: 0.3, kick: i === 10, kickStrength: 1, snare: i === 20, snareStrength: 1, dropImpact: sectionType === 'drop' && i === 0 ? 1 : 0,
          capabilities: { ...base.capabilities, liveBands: true, rhythmEvents: true, sections: true }, confidence: { ...base.confidence, overall: 1, rhythm: 1, section: 1, semantics: 1 }, boundaries: { ...base.boundaries, timingDiscontinuity: false, sectionEntry: i === 0 } }
        decision = controller.update({ settings: { ...defaults, autoPerformance: true }, context, timeSec, deltaSec: 0.05, audioActive: true, paused: false })
        draw(storyRenderer, logo, defaults, timeSec, { performance: decision })
      }
      capture('arrangement-' + sectionType, storyCanvas); arrangement.push({ sectionType, amount: decision.settings.amount, reconstruction: decision.settings.sourceMix, routing: decision.routing })
    }
    assert(arrangement[1].amount > arrangement[0].amount && arrangement[3].reconstruction > arrangement[2].reconstruction, 'musical arrangement inactive')
    storyRenderer.dispose()
    const audioCanvas = make(), audioRenderer = DataBleedRenderer.create(audioCanvas).renderer, audioProfiles = []
    let quiet = null
    for (const feature of ['quiet', 'bass', 'kick', 'snare']) {
      audioRenderer.resetHistory(); const performanceController = new DataBleedPerformanceController()
      for (let i = 0; i < 24; i++) {
        const timeSec = 4 + i / 30, base = createSharedPerformanceFallbackContext(timeSec)
        const context = { ...base, trackIdentity: 'audio-displacement', runtimeIdentity: 'audio-displacement', bass: feature === 'bass' ? 1 : 0, kick: feature === 'kick' && i === 20, kickStrength: 1, snare: feature === 'snare' && i === 20, snareStrength: 1,
          capabilities: { ...base.capabilities, liveBands: true, rhythmEvents: true }, confidence: { ...base.confidence, overall: 1, rhythm: 1 }, boundaries: { ...base.boundaries, timingDiscontinuity: false } }
        const decision = performanceController.update({ settings: { ...defaults, audioReactivity: 1 }, context, timeSec, deltaSec: 1 / 30, paused: false, audioActive: true })
        assert(draw(audioRenderer, logo, defaults, timeSec, { performance: decision, deltaSec: 1 / 30 }), 'audio render')
      }
      const output = pixels(audioCanvas); if (feature === 'quiet') quiet = output
      const difference = diff(quiet, output); if (feature !== 'quiet') assert(difference.mean > 0.5, feature + ' did not materially change GPU displacement')
      audioProfiles.push({ feature, difference }); capture('audio-' + feature, audioCanvas)
    }
    assert(audioRenderer.getDiagnostics().sourceUploads === 1, 'audio replaced the immutable source'); audioRenderer.dispose()
    // Shared logical viewport controls output, history and motion budgets.
    const large = make(1920, 1080); large.getContext('2d').drawImage(jpeg, 0, 0, 1920, 1080); const largeSource = await load(large.toDataURL())
    const profileCanvas = make(), profileRenderer = DataBleedRenderer.create(profileCanvas).renderer, profileGL = profileCanvas.getContext('webgl2'), profiles = []
    const debug = profileGL.getExtension('WEBGL_debug_renderer_info'), device = debug ? profileGL.getParameter(debug.UNMASKED_RENDERER_WEBGL) : profileGL.getParameter(profileGL.RENDERER)
    for (const [width, height] of [[1280, 720], [1920, 1080], [3840, 2160]]) {
      const plan = resolveDataBleedPlan(defaults, width, height), start = performance.now(); profileRenderer.resize(plan.output.width, plan.output.height)
      for (let i = 0; i < 12; i++) assert(draw(profileRenderer, largeSource, defaults, i / 60, { viewport: { width, height } }), 'profile render')
      profileGL.finish(); const elapsed = performance.now() - start, diagnostic = profileRenderer.getDiagnostics()
      assert(diagnostic.quality === plan.tier && diagnostic.targets === 4 && diagnostic.transientBytes <= 64 * 1024 * 1024 && diagnostic.drawPasses <= 3, 'GPU budget')
      assert(pixels(profileCanvas).some((v, i) => i % 4 === 3 && v > 0), 'profile blank')
      profiles.push({ width, height, plan, diagnostic, meanSubmissionAndFinishMs: elapsed / 12 })
    }
    profileRenderer.resize(640, 360); draw(profileRenderer, logo, defaults, 0)
    const start = performance.now(), allocated = profileRenderer.getDiagnostics().allocations; let soakFrames = 0
    while ((performance.now() - start) / 1000 < soakSeconds) { assert(draw(profileRenderer, logo, defaults, soakFrames / 60), 'soak render'); soakFrames++; await frames(1) }
    assert(profileRenderer.getDiagnostics().allocations === allocated, 'steady allocations grew')
    const soak = { seconds: (performance.now() - start) / 1000, frames: soakFrames, diagnostic: profileRenderer.getDiagnostics() }; profileRenderer.dispose()

    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { CanvasEngineSurface, CanvasEngineFxPanel } = await import('/src/components/vyzualz/react/ReactCanvasEngineShell.tsx')
    const { useReactStore: store } = await import('/src/stores/reactStore.ts')
    const { useMediaStore: media } = await import('/src/stores/mediaStore.ts')
    const { ShaderCompiler } = await import('/src/components/vyzualz/react/shaders/runtime/ShaderCompiler.ts')
    const showDomain = await import('/src/components/vyzualz/showManager/CanvasShowManagerDomain.ts')
    await store.persist.rehydrate(); store.getState().resetReactView()
    const asset = { id: 'data-bleed-source', name: 'logo.png', type: 'image', mimeType: 'image/png', url: logo.src, metadata: { width: 640, height: 360 }, tags: [], collectionIds: [], revision: 1 }
    media.setState({ items: [asset] }); store.getState().selectCanvasMediaItem(asset.id); store.getState().selectCanvasPreset('canvas-data-bleed'); store.getState().setCanvasEngineSettings({ opacity: 1 })
    const handles = [], factory = DataBleedRenderer.create
    DataBleedRenderer.create = function(canvas) { const result = factory.call(this, canvas); if (result.renderer) handles.push({ canvas, renderer: result.renderer }); return result }
    const host = document.createElement('div'); host.id = 'data-bleed-stage'; host.style.cssText = 'width:640px;height:360px;position:relative'; document.body.append(host)
    const root = createRoot(host); let published = null, capability = null, time = 5
    const onReady = c => { published = c }, onCapability = c => { capability = c }, getAudioTime = () => time
    const mount = (paused = false, playing = false) => root.render(React.createElement(CanvasEngineSurface, { isPlaying: playing, analysisActive: false, isPaused: paused, getAudioTime, onCanvasReady: onReady, onOutputCapabilityChange: onCapability }))
    const wait = async (predicate, label) => { for (let i = 0; i < 240; i++) { if (predicate()) return; await frames(1) } throw new Error(label + ' / ' + host.textContent + ' / ' + JSON.stringify(capability)) }
    const ready = () => host.querySelector('.rv-canvas-data-bleed-layer[data-ready="true"]') && published?.width
    mount(); await wait(ready, 'shell ready'); await frames(15)
    const first = pixels(published); await frames(60); assert(diff(first, pixels(published)).mean > 0.3, 'capture unanimated / ' + host.textContent); capture('shell-still', published)
    store.getState().setCanvasPresetSettings({ dataBleed: { ...defaults, freezeHistory: true } }); await frames(3)
    const held = pixels(published); await frames(15); identity(held, pixels(published), 'shell freeze')
    clearDataBleedHistory(); await frames(5); assert(diff(held, pixels(published)).mean > 0.1, 'Clear History ignored during freeze')
    store.getState().setCanvasPresetSettings({ dataBleed: defaults }); mount(false, true); await frames(4); mount(true, true); await frames(4)
    const paused = pixels(published); await frames(10); identity(paused, pixels(published), 'shell pause')
    time = 25.125; await wait(() => diff(paused, pixels(published)).mean > 0.1, 'paused seek'); const sought = pixels(published); await frames(8); identity(sought, pixels(published), 'seek freeze')
    host.style.width = '800px'; await wait(() => published?.width === 800, 'paused resize'); host.style.width = '640px'; await wait(() => published?.width === 640, 'resize back'); mount(false)
    const recorded = await new Promise((resolve, reject) => { const stream = published.captureStream(30), chunks = [], r = new MediaRecorder(stream); r.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }; r.onerror = reject; r.onstop = async () => { const blob = new Blob(chunks); stream.getTracks().forEach(t => t.stop()); resolve([...new Uint8Array(await blob.arrayBuffer())]) }; r.start(); setTimeout(() => r.stop(), 450) }); assert(recorded.length > 1000, 'recording empty')
    // Real shell video, reusing the one selected media element/decoder.
    media.setState({ items: [{ ...asset, name: 'moving.webm', type: 'video', mimeType: 'video/webm', url: videoUrl, metadata: { width: 320, height: 180 }, revision: 2 }] }); mount(false, true)
    await wait(() => ready() && host.querySelector('video')?.readyState >= 2, 'shell video'); await frames(20)
    const videoElement = host.querySelector('video'), v0 = pixels(published); await frames(25); assert(diff(v0, pixels(published)).mean > 1, 'video capture stale'); assert(host.querySelectorAll('video').length === 1, 'duplicate decoder')
    capture('shell-video', published)
    mount(true, true); store.getState().setCanvasPresetSettings({ dataBleed: { ...defaults, freezeHistory: true } }); await frames(5)
    const beforeSourceSeek = pixels(published)
    await new Promise(resolve => { videoElement.onseeked = resolve; videoElement.currentTime = 0.2 })
    await wait(() => published && diff(beforeSourceSeek, pixels(published)).mean > 0.5, 'native video seek while frozen')
    const afterSourceSeek = pixels(published); await frames(8); identity(afterSourceSeek, pixels(published), 'native seek freeze')
    capture('shell-video-frozen-seek', published)
    store.getState().setCanvasPresetSettings({ dataBleed: defaults })
    media.setState({ items: [asset] }); mount(); await wait(ready, 'restore image')
    // Loss/recovery and failed initialization publish the visible original.
    const current = handles.at(-1).canvas, lose = current.getContext('webgl2').getExtension('WEBGL_lose_context'); assert(lose, 'no context loss extension'); lose.loseContext()
    await wait(() => host.textContent.includes('lost its WebGL2') && published, 'loss fallback'); await frames(3); capture('fallback-context-loss', published)
    lose.restoreContext(); await wait(ready, 'context recovery')
    const enter = async () => { store.getState().selectCanvasPreset('canvas-clean-playback'); await frames(3); store.getState().selectCanvasPreset('canvas-data-bleed'); await frames(4) }
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : getContext.call(this, type, ...args) }
    await enter(); await wait(() => host.textContent.includes('WebGL2 unavailable') && published, 'unavailable fallback'); capture('fallback-unavailable', published); HTMLCanvasElement.prototype.getContext = getContext
    const compile = ShaderCompiler.prototype.compile; ShaderCompiler.prototype.compile = function(type, _src, label) { return compile.call(this, type, '#version 300 es\ninvalid shader;', label) }
    await enter(); await wait(() => host.textContent.includes('Showing the original source') && published, 'compile fallback'); capture('fallback-shader', published); ShaderCompiler.prototype.compile = compile; await enter(); await wait(ready, 'GPU reentry')
    const signed = new URL('/data-bleed-fixture.svg?signature=a%2Bb', location.href).href
    media.setState({ items: [{ ...asset, mimeType: 'image/svg+xml', url: signed, revision: 3 }] }); await wait(() => host.querySelector('img')?.src === signed && ready(), 'signed URL')
    media.setState({ items: [{ ...asset, url: new URL('/data-bleed-fixture.svg?signature=expired', location.href).href, revision: 4 }] }); await wait(() => !published && capability?.status === 'unavailable', 'expired stale output')
    media.setState({ items: [] }); await frames(3); assert(!published, 'deleted source output')
    media.setState({ items: [asset] }); await wait(ready, 'image restore')
    // Direct-only effects yield to authored and Show owners with no mutation.
    const authored = store.getState().canvasOrchestrationSettings
    store.setState({ canvasOrchestrationSettings: { ...authored, renderMode: 'layers', authoredLayers: [{ id: 'source-layer', mediaId: asset.id, order: 0, enabled: true, solo: false, pinned: true, ownership: 'manual', effects: [] }] } })
    await wait(() => host.querySelector('[aria-label="CANVAS orchestrated media surface"]') && published, 'authored owner'); await frames(6)
    assert(!host.querySelector('.rv-canvas-data-bleed-layer'), 'authored postprocessed'); capture('authored-unprocessed', published)
    const show = showDomain.createCanvasShowManagerShow('Data Bleed ownership fixture')
    show.mediaElements = [{ id: 'source-element', mediaId: asset.id, layer: 0, showStartSec: 0, showEndSec: 120, sourceInSec: null, sourceOutSec: null, display: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY }, fx: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_FX }, transitions: { in: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION }, out: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION } } }]
    store.setState({ canvasShowManagerShows: [show], canvasShowManagerActiveShowId: show.id }); await frames(12)
    assert(published && !host.querySelector('.rv-canvas-data-bleed-layer'), 'Show owner lost'); capture('show-unprocessed', published); const showPixels = pixels(published)
    store.getState().selectCanvasPreset('canvas-clean-playback'); await frames(6); identity(showPixels, pixels(published), 'selected preset changed Show')
    store.setState({ canvasShowManagerActiveShowId: null, canvasOrchestrationSettings: { ...authored, renderMode: 'single' } }); await enter(); await wait(ready, 'show exit')
    for (let i = 0; i < 4; i++) { store.getState().selectCanvasPreset('canvas-mutagen'); await frames(3); await enter(); await wait(ready, 'rapid switch') }
    store.getState().setCanvasAutoSelectEnabled(true); store.getState().selectCanvasMediaItem(asset.id); store.getState().selectCanvasPreset('canvas-data-bleed'); store.getState().applyCanvasAutoSelection({ mediaId: 'other', presetId: 'canvas-fractures' })
    assert(store.getState().activeCanvasMediaId === asset.id && store.getState().selectedCanvasPresetId === 'canvas-data-bleed', 'manual lock lost')
    store.getState().setCanvasAutoSelectEnabled(false)
    const controls = document.createElement('div'); controls.style.cssText = 'position:absolute;left:660px;top:0;width:360px'; document.body.append(controls); const controlRoot = createRoot(controls); controlRoot.render(React.createElement(CanvasEngineFxPanel)); await frames(6)
    window.__dataBleed = { store, media, asset, jpeg: jpeg.src, root, controlRoot, getPublished: () => published, cleanup: () => { root.unmount(); controlRoot.unmount(); URL.revokeObjectURL(videoUrl); DataBleedRenderer.create = factory; assert(handles.every(h => h.renderer.getDiagnostics().disposed && h.renderer.getDiagnostics().transientBytes === 0), 'resource leak'); return handles.length } }
    const sheet = make(1280, Math.ceil(captures.length / 4) * 202), ctx = sheet.getContext('2d'); ctx.fillStyle = '#172126'; ctx.fillRect(0, 0, sheet.width, sheet.height)
    for (const [i, item] of captures.entries()) { const x = i % 4 * 320, y = Math.floor(i / 4) * 202; ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(item.name, x + 4, y + 14); ctx.drawImage(await load(item.image), x, y + 22, 320, 180) }
    capture('contact-sheet', sheet)
    return { captures, fixtureMetrics, aspectChecks, videoMetrics, motionSensitivityDifference, audioProfiles, arrangement, profiles, device, soak, recorded }
  }, { svg, soakSeconds })
  for (const c of result.captures) await writeFile(path.join(outputDir, c.name + '.png'), Buffer.from(c.image.split(',')[1], 'base64'))
  await writeFile(path.join(outputDir, 'recording.webm'), Buffer.from(result.recorded))
  await page.getByRole('switch', { name: 'Auto Performance', exact: true }).click()
  await page.getByRole('combobox', { name: 'Flow Mode', exact: true }).click(); await page.getByRole('option', { name: 'Procedural', exact: true }).click()
  if (await page.evaluate(() => window.__dataBleed.store.getState().canvasPresetSettings.dataBleed.autoPerformance)) throw new Error('Manual Flow Mode did not disable Auto')
  await page.screenshot({ path: path.join(outputDir, 'design-and-stage.png'), fullPage: true })
  await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { ReactPresetsPanel } = await import('/src/components/vyzualz/react/ReactPresetsPanel.tsx')
    window.__dataBleed.store.setState({ activeReactEngineId: 'canvas' })
    const host = document.createElement('div'); host.style.cssText = 'width:1040px;margin-top:800px'; document.body.append(host)
    const root = createRoot(host); root.render(React.createElement(ReactPresetsPanel)); window.__dataBleed.cardRoot = root
    for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame)
    const card = host.querySelector('button[data-preset-card-id="canvas-data-bleed"]')
    if (card?.getAttribute('aria-pressed') !== 'true' || !card.textContent.includes('Modified')) throw new Error('Active/modified Data Bleed card')
  })
  await page.locator('button[data-preset-card-id="canvas-data-bleed"]').screenshot({ path: path.join(outputDir, 'preset-card.png') })
  const parity = []
  for (const variant of ['alpha', 'legacy', 'opaque', 'zero', 'reconstruction']) {
    const image = await page.evaluate(async variant => {
      const { store, media, asset, jpeg, getPublished } = window.__dataBleed
      media.setState({ items: [{ ...asset, url: variant === 'opaque' ? jpeg : asset.url, mimeType: variant === 'opaque' ? 'image/jpeg' : 'image/png', revision: variant === 'opaque' ? 11 : 10 }] })
      store.getState().setCanvasEngineSettings({ opacity: variant === 'legacy' ? 0.4 : 1 })
      store.getState().setCanvasPresetSettings({ sourceMixMode: variant === 'legacy' ? 'legacyComposite' : 'dryOnly', drySourceMix: variant === 'legacy' ? 0.25 : 0, dataBleed: { ...store.getState().canvasPresetSettings.dataBleed, amount: variant === 'zero' ? 0 : 0.65, sourceMix: variant === 'reconstruction' ? 1 : 0, freezeHistory: true, deterministicSeed: 777 } })
      for (let i = 0; i < 15; i++) await new Promise(requestAnimationFrame)
      return { image: getPublished().toDataURL(), width: getPublished().width, height: getPublished().height }
    }, variant)
    const live = await page.locator('#data-bleed-stage').screenshot({ path: path.join(outputDir, 'preview-' + variant + '.png') }), output = Buffer.from(image.image.split(',')[1], 'base64')
    await writeFile(path.join(outputDir, 'output-' + variant + '.png'), output)
    const expected = await sharp({ create: { width: image.width, height: image.height, channels: 4, background: '#172126' } }).composite([{ input: output }]).removeAlpha().raw().toBuffer(), actual = await sharp(live).removeAlpha().raw().toBuffer()
    let sum = 0; if (expected.length !== actual.length) throw new Error('parity dimensions'); for (let i = 0; i < actual.length; i++) sum += Math.abs(expected[i] - actual[i]); const mean = sum / actual.length
    if (mean > 1) throw new Error(variant + ': preview/output mismatch ' + mean)
    parity.push({ variant, mean })
  }
  const persisted = await page.evaluate(() => ({ settings: window.__dataBleed.store.getState().canvasPresetSettings.dataBleed, source: window.__dataBleed.store.getState().activeCanvasMediaId })), disposed = await page.evaluate(() => { window.__dataBleed.cardRoot.unmount(); return window.__dataBleed.cleanup() })
  await visit()
  const reloaded = await page.evaluate(async () => { const { useReactStore } = await import('/src/stores/reactStore.ts'); await useReactStore.persist.rehydrate(); return { settings: useReactStore.getState().canvasPresetSettings.dataBleed, source: useReactStore.getState().activeCanvasMediaId } })
  if (JSON.stringify(reloaded) !== JSON.stringify(persisted)) throw new Error('reload lost recipe/source identity')
  if (errors.length) throw new Error(errors.join('\n'))
  const { captures, recorded, ...report } = result
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ...report, parity, disposed, recordingBytes: recorded.length, reload: reloaded, scope: 'Chromium WebGL2 component harness; generated images/video and deterministic Core context; native Electron device/cloud flows not exercised.' }, null, 2))
  console.log(JSON.stringify({ outputDir, device: report.device, profiles: report.profiles, soak: report.soak, parity, disposed, recordingBytes: recorded.length }, null, 2))
} catch (error) {
  for (const page of browser.contexts().flatMap(c => c.pages())) {
    await page.screenshot({ path: path.join(outputDir, 'failure.png') }).catch(() => {})
    const partial = await page.evaluate(() => window.__dataBleedPartial?.captures ?? []).catch(() => [])
    for (const c of partial) await writeFile(path.join(outputDir, c.name + '.png'), Buffer.from(c.image.split(',')[1], 'base64'))
  }
  throw error
} finally { await browser.close() }
