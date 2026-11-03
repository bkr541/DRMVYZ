/* global document, Image, window, requestAnimationFrame, MediaRecorder, Blob */
// Node 22 + an existing Vite server. No auth, uploads, network images or audio analyzer.
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
const baseUrl = process.env.MUTAGEN_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = process.env.MUTAGEN_OUTPUT_DIR ?? '/tmp/mutagen-production-validation'
const soakSeconds = Number(process.env.MUTAGEN_SOAK_SECONDS ?? 60)
await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect x="64" y="70" width="512" height="220" rx="44" fill="#fd2d80"/><circle cx="190" cy="180" r="90" fill="#59fbb3"/><path d="M320 90L550 270H320Z" fill="#5449ff"/><text x="105" y="205" fill="white" font-family="sans-serif" font-size="60">MUTAGEN</text></svg>'
  await page.route('**/mutagen-fixture.svg?**', r => {
    const expired = r.request().url().includes('expired')
    return r.fulfill({ status: expired ? 403 : 200, contentType: expired ? 'text/plain' : 'image/svg+xml', body: expired ? 'Signature expired' : svg })
  })
  await page.route('**/__mutagen-production.html', r => r.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles/appearance.css">
    <link rel="stylesheet" href="/src/styles/reactView.css"><link rel="stylesheet" href="/src/styles/typography.css">
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body style="margin:0;background:#172126;color:white;font-family:sans-serif"></body></html>` }))
  const visit = async () => { await page.goto(`${baseUrl}/__mutagen-production.html`); await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__) }
  await visit()
  const result = await page.evaluate(async ({ svg, soakSeconds }) => {
    const { MutagenRenderer, resolveMutagenRenderSize } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenRenderer.ts')
    const { DEFAULT_CANVAS_MUTAGEN_SETTINGS: defaults, MUTAGEN_PATTERNS } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenSettings.ts')
    const { resolveMutagenFramePlan } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenRenderPlan.ts')
    const { MutagenPerformanceController } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenPerformanceController.ts')
    const { createSharedPerformanceFallbackContext } = await import('/src/features/performanceCore/index.ts')
    const { ShaderCompiler } = await import('/src/components/vyzualz/react/shaders/runtime/ShaderCompiler.ts')
    const assert = (ok, message) => { if (!ok) throw new Error(message) }
    const make = (w = 640, h = 360) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    const load = url => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url })
    const pixels = c => { const copy = make(c.width, c.height); const ctx = copy.getContext('2d'); ctx.drawImage(c, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data }
    const diff = (a, b) => { assert(a.length === b.length, 'pixel dimensions'); let sum = 0, large = 0; for (let i = 0; i < a.length; i++) { const base = i & ~3; const d = Math.abs((i % 4 === 3 ? a[i] : a[i] * a[base + 3] / 255) - (i % 4 === 3 ? b[i] : b[i] * b[base + 3] / 255)); sum += d; if (d > 8) large++ } return { mean: sum / a.length, fractionOver8: large / a.length } }
    const identity = (a, b, label) => { const d = diff(a, b); assert(d.mean <= 1 && d.fractionOver8 < 0.03, label + ': ' + JSON.stringify(d)); return d }
    const frames = async n => { for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame) }
    const captures = [], capture = (name, canvas) => captures.push({ name, image: canvas.toDataURL() })
    const transform = { scale: 1, positionX: 0, positionY: 0, rotation: 0 }
    const logo = make(), lc = logo.getContext('2d'); lc.drawImage(await load('data:image/svg+xml,' + encodeURIComponent(svg)), 0, 0)
    lc.globalAlpha = 0.4; lc.fillStyle = '#ffe934'; lc.fillRect(60, 310, 520, 20)
    const opaque = make(), oc = opaque.getContext('2d'), gradient = oc.createLinearGradient(0, 0, 640, 360)
    gradient.addColorStop(0, '#ff6d28'); gradient.addColorStop(0.5, '#32226f'); gradient.addColorStop(1, '#22d9dd'); oc.fillStyle = gradient; oc.fillRect(0, 0, 640, 360)
    for (let i = 0; i < 16; i++) { oc.fillStyle = ['#fff', '#ef3b91', '#76efb3'][i % 3]; oc.fillRect(20 + i * 38, 50 + (i % 4) * 45, 22, 160) }
    const fixtures = [['alpha-logo', await load(logo.toDataURL())], ['opaque-jpeg', await load(opaque.toDataURL('image/jpeg', 0.95))]]
    const canvas = make(), created = MutagenRenderer.create(canvas); assert(created.renderer, created.error)
    const renderer = created.renderer, gl = canvas.getContext('webgl2')
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    const device = { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) }
    let clock = 0
    const render = (source, settings, options = {}) => {
      const frame = { source, settings, fitMode: 'contain', sourceTransform: transform, timeSec: 5, transitionTimeSec: clock += 3, ...options }
      assert(renderer.render(frame), 'render failed'); assert(renderer.render({ ...frame, transitionTimeSec: clock + 2 }), 'render failed')
      assert(gl.getError() === gl.NO_ERROR, 'GL error'); return pixels(canvas)
    }
    const identities = []
    for (const [name, source] of fixtures) {
      const reference = make(); reference.getContext('2d').drawImage(source, 0, 0)
      capture(name + '-original', reference)
      for (const pattern of MUTAGEN_PATTERNS) {
        for (const patch of [{ mutation: 0 }, { sourceMix: 1 }]) identities.push({ name, pattern, ...patch, ...identity(render(source, { ...defaults, pattern, feedback: 1, glow: 1, ...patch }), pixels(reference), name + '/' + pattern) })
        // t=2 also shows MORPH's abstract half; t=5 is its deliberate source-return phase.
        render(source, { ...defaults, pattern, mutation: 0.85, audioReactivity: 0 }, { timeSec: 2 }); capture(name + '-' + pattern, canvas)
      }
      for (const mutation of [0, 0.15, 1]) { render(source, { ...defaults, mutation }); capture(name + '-mutation-' + mutation, canvas) }
    }
    // Aspect extremes and transform order use the same original-sampling branch.
    const aspectChecks = []
    for (const [w, h] of [[120, 1200], [1800, 120]]) {
      const src = make(w, h); src.getContext('2d').drawImage(opaque, 0, 0, w, h); const source = await load(src.toDataURL())
      for (const fitMode of ['contain', 'cover', 'stretch']) {
        const t = { scale: 0.73, positionX: 11, positionY: -7, rotation: 23 }
        const reference = make(), ctx = reference.getContext('2d'); ctx.translate(640 * 0.61, 360 * 0.43); ctx.rotate(23 * Math.PI / 180); ctx.scale(t.scale, t.scale)
        const k = fitMode === 'cover' ? Math.max(640 / w, 360 / h) : Math.min(640 / w, 360 / h)
        const fw = fitMode === 'stretch' ? 640 : w * k, fh = fitMode === 'stretch' ? 360 : h * k; ctx.drawImage(source, -fw / 2, -fh / 2, fw, fh)
        aspectChecks.push({ w, h, fitMode, ...identity(render(source, { ...defaults, mutation: 0 }, { fitMode, sourceTransform: t }), pixels(reference), 'extreme/' + fitMode) })
      }
    }
    // Known deterministic upstream semantic context, with no audio clock/analyzer.
    const story = new MutagenPerformanceController(), arrangement = []
    for (const [index, sectionType] of ['intro', 'build', 'drop', 'breakdown'].entries()) {
      let decision
      for (let i = 0; i < 40; i++) {
        const timeSec = index * 2 + i * 0.05, base = createSharedPerformanceFallbackContext(timeSec)
        const context = { ...base, trackIdentity: 'production-fixture', runtimeIdentity: 'production-fixture', sectionType, sectionId: sectionType, sectionProgress: i / 40, buildProgress: sectionType === 'build' ? i / 40 : 0, dropOccurrence: 1, bass: sectionType === 'drop' ? 1 : 0.25, mid: 0.6, high: 0.4, dropImpact: sectionType === 'drop' && i === 0 ? 1 : 0,
          capabilities: { ...base.capabilities, liveBands: true, sections: true, rhythmEvents: true, beatGrid: true }, confidence: { ...base.confidence, overall: 1, section: 1, semantics: 1, rhythm: 1, grid: 1 }, boundaries: { ...base.boundaries, timingDiscontinuity: false, sectionEntry: i === 0 } }
        decision = story.update({ settings: { ...defaults, autoPerformance: true }, context, audioActive: true, paused: false, timeSec, deltaSec: 0.05 })
        // Advance the real GPU transition alongside the semantic fixture, so the
        // final section capture shows its current look rather than an entry fade.
        assert(renderer.render({ source: fixtures[0][1], settings: { ...defaults, autoPerformance: true }, performance: decision, timeSec, fitMode: 'contain', sourceTransform: transform }), 'arrangement frame failed')
      }
      render(fixtures[0][1], { ...defaults, autoPerformance: true }, { performance: decision }); capture('arrangement-' + sectionType, canvas)
      arrangement.push({ sectionType, pattern: decision.activePattern, routing: decision.routing })
    }
    // Profile actual GPU work. gl.finish is harness-only, never a runtime readback.
    const profiles = []
    for (const [width, height] of [[1280, 720], [1920, 1080], [3840, 2160]]) {
      const settings = { ...defaults, quality: 'auto', feedback: 0.65 }, size = resolveMutagenRenderSize(width, height, 1, 'auto')
      renderer.resize(size.width, size.height); const modes = []
      for (const pattern of MUTAGEN_PATTERNS) {
        const start = performance.now()
        for (let n = 0; n < 3; n++) assert(renderer.render({ source: fixtures[1][1], settings: { ...settings, pattern }, fitMode: 'contain', sourceTransform: transform, timeSec: n / 60, transitionTimeSec: clock += 3, qualityViewport: { width, height } }), 'profile render failed')
        gl.finish(); const measured = (performance.now() - start) / 3
        assert(gl.getError() === gl.NO_ERROR && pixels(canvas).some((v, i) => i % 4 === 3 && v > 0), 'profile output blank/error')
        modes.push({ pattern, meanSubmissionAndFinishMs: measured })
      }
      const diagnostic = renderer.getDiagnostics(), plan = resolveMutagenFramePlan(settings, width, height)
      assert(diagnostic.quality === plan.tier && diagnostic.feedbackTargets <= 2 && diagnostic.transitionTargets <= 2 && diagnostic.programs <= 9, 'inconsistent Auto budget')
      assert(diagnostic.targetBytes <= 4 * 1920 * 1920 * 4 && diagnostic.sourceTextureBytes <= 4096 * 4096 * 4, 'texture budget exceeded')
      profiles.push({ width, height, diagnostic, plan, modes })
    }
    renderer.resize(640, 360)
    const stableSettings = { ...defaults, feedback: 0.6, pattern: 'liquify' }
    // Finish the last profile's transition before measuring steady allocation.
    render(fixtures[1][1], stableSettings)
    let allocations = 0; const upload = gl.texImage2D.bind(gl); gl.texImage2D = (...args) => { allocations++; return upload(...args) }
    const soakStart = performance.now(); let soakFrames = 0, warmAllocations = 0
    while ((performance.now() - soakStart) / 1000 < soakSeconds) {
      renderer.render({ source: fixtures[1][1], settings: stableSettings, fitMode: 'contain', sourceTransform: transform, timeSec: soakFrames / 60, transitionTimeSec: clock += 0.017 }); soakFrames++
      if (soakFrames === 10) warmAllocations = allocations
      await frames(1)
    }
    assert(soakFrames > 10 && allocations === warmAllocations, `soak allocations changed (${warmAllocations} -> ${allocations}; ${soakFrames} frames)`)
    const soak = { elapsedSeconds: (performance.now() - soakStart) / 1000, frames: soakFrames, allocations, diagnostic: renderer.getDiagnostics() }
    renderer.dispose(); assert(renderer.getDiagnostics().targetBytes === 0 && renderer.getDiagnostics().programs === 0, 'renderer resources retained')

    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { CanvasEngineSurface } = await import('/src/components/vyzualz/react/ReactCanvasEngineShell.tsx')
    const { ReactPresetsPanel } = await import('/src/components/vyzualz/react/ReactPresetsPanel.tsx')
    const { useReactStore: store } = await import('/src/stores/reactStore.ts')
    const { useMediaStore: media } = await import('/src/stores/mediaStore.ts')
    const showDomain = await import('/src/components/vyzualz/showManager/CanvasShowManagerDomain.ts')
    await store.persist.rehydrate(); store.getState().resetReactView()
    const asset = { id: 'mutagen-production-source', name: 'alpha-logo.png', type: 'image', mimeType: 'image/png', url: fixtures[0][1].src, metadata: { width: 640, height: 360 }, tags: [], collectionIds: [], revision: 1 }
    media.setState({ items: [asset] }); store.getState().selectCanvasMediaItem(asset.id); store.getState().selectCanvasPreset('canvas-mutagen')
    store.getState().setCanvasEngineSettings({ opacity: 1, fitMode: 'contain' }); store.getState().setCanvasPresetSettings({ mutagen: { ...defaults, flowSpeed: 0, audioReactivity: 0 } })
    const host = document.createElement('div'); host.id = 'mutagen-stage'; host.style.cssText = 'width:640px;height:360px;position:relative'; document.body.append(host)
    const root = createRoot(host); let published = null, capability = null, time = 5
    const ready = c => { published = c }, outputCapability = c => { capability = c }, getAudioTime = () => time
    const mount = (paused = false) => root.render(React.createElement(CanvasEngineSurface, { isPlaying: true, analysisActive: false, isPaused: paused, getAudioTime, onCanvasReady: ready, onOutputCapabilityChange: outputCapability }))
    const wait = async (predicate, label) => { for (let i = 0; i < 240; i++) { if (predicate()) return; await frames(1) } throw new Error(label + ' / ' + host.textContent + ' / ' + JSON.stringify(capability)) }
    const gpuReady = () => host.querySelector('.rv-canvas-mutagen-layer[data-ready="true"]') && published?.width
    mount(); await wait(gpuReady, 'GPU ready'); await frames(4)
    const clean = make(); clean.getContext('2d').drawImage(fixtures[0][1], 0, 0)
    assert(diff(pixels(published), pixels(clean)).mean > 1, 'capture is unmutated')
    assert(host.querySelector('img.rv-canvas-live-media').style.opacity === '0', 'double original')
    capture('direct-capture', published)
    mount(true); await frames(4); const frozen = pixels(published); await frames(12); identity(pixels(published), frozen, 'pause')
    host.style.width = '800px'; await frames(4); assert(published.width === 800, 'paused resize stale'); host.style.width = '640px'; await frames(4)
    store.getState().setCanvasPresetSettings({ mutagen: { ...defaults, flowSpeed: 1, audioReactivity: 0 } }); await frames(4)
    const preSeek = pixels(published); time = 25
    // Context publication is intentionally 50 ms; five 120 Hz RAFs can finish
    // before the next sample. Wait for the observable new frame, not a RAF count.
    await wait(() => published && diff(preSeek, pixels(published)).mean > 0.5, 'paused seek stale')
    const postSeek = pixels(published); await frames(8); identity(postSeek, pixels(published), 'paused seek did not freeze')
    time += 0.125
    await wait(() => published && diff(postSeek, pixels(published)).mean > 0.05, 'paused fine seek stale')
    const fineSeek = pixels(published); await frames(8); identity(fineSeek, pixels(published), 'paused fine seek did not freeze')
    mount(false); await frames(4)
    // Compare a premultiplied processed snapshot with each public opacity contract.
    const alphaChecks = []
    for (const [sourceMixMode, drySourceMix, opacity] of [['dryOnly', 0, 1], ['legacyComposite', 0.25, 0.4]]) {
      store.getState().setCanvasPresetSettings({ sourceMixMode, drySourceMix, mutagen: { ...defaults, flowSpeed: 0, audioReactivity: 0 } }); store.getState().setCanvasEngineSettings({ opacity }); await frames(8)
      const reference = make(), ctx = reference.getContext('2d'), input = make(), temporary = MutagenRenderer.create(input).renderer
      temporary.render({ source: fixtures[0][1], settings: { ...defaults, flowSpeed: 0, audioReactivity: 0 }, fitMode: 'contain', sourceTransform: transform, timeSec: time })
      ctx.globalAlpha = opacity * (sourceMixMode === 'dryOnly' ? 1 : drySourceMix); ctx.drawImage(input, 0, 0)
      alphaChecks.push({ sourceMixMode, drySourceMix, opacity, ...identity(pixels(published), pixels(reference), 'output alpha') }); temporary.dispose()
      capture('alpha-' + sourceMixMode, published)
    }
    const recording = await new Promise((resolve, reject) => {
      const stream = published.captureStream(30), chunks = [], rec = new MediaRecorder(stream); rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }; rec.onerror = reject
      rec.onstop = async () => { const blob = new Blob(chunks); stream.getTracks().forEach(t => t.stop()); resolve({ size: blob.size, bytes: [...new Uint8Array(await blob.arrayBuffer())] }) }; rec.start(); setTimeout(() => rec.stop(), 400)
    }); assert(recording.size > 1000, 'recording empty')
    // One automatic restoration per source; the second loss remains a usable original.
    const loss = host.querySelector('.rv-canvas-mutagen-layer').getContext('webgl2').getExtension('WEBGL_lose_context'); assert(loss, 'loss extension absent')
    loss.loseContext(); await wait(() => host.textContent.includes('lost its WebGL2') && host.querySelector('img').style.opacity !== '0', 'loss fallback'); await frames(4); capture('fallback-context-loss', published)
    loss.restoreContext(); await wait(gpuReady, 'context restore')
    const secondLoss = host.querySelector('.rv-canvas-mutagen-layer').getContext('webgl2').getExtension('WEBGL_lose_context'); secondLoss.loseContext(); await frames(5); secondLoss.restoreContext(); await frames(20)
    assert(!host.querySelector('.rv-canvas-mutagen-layer[data-ready="true"]') && published && capability.status === 'available', 'unbounded retry or missing fallback')
    const reset = async () => { store.getState().selectCanvasPreset('canvas-clean-playback'); await frames(2); store.getState().selectCanvasPreset('canvas-mutagen'); store.getState().setCanvasPresetSettings({ mutagen: { ...defaults, flowSpeed: 0, audioReactivity: 0 } }); store.getState().setCanvasEngineSettings({ opacity: 1 }); await wait(gpuReady, 're-entry') }
    await reset()
    // Unavailable WebGL and actual shader compile failure both keep source/capture.
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : originalGetContext.call(this, type, ...args) }
    store.getState().selectCanvasPreset('canvas-clean-playback'); await frames(2); store.getState().selectCanvasPreset('canvas-mutagen'); await wait(() => host.textContent.includes('WebGL2 unavailable') && published, 'WebGL unavailable'); capture('fallback-unavailable', published)
    HTMLCanvasElement.prototype.getContext = originalGetContext
    const compile = ShaderCompiler.prototype.compile
    ShaderCompiler.prototype.compile = function(type, _source, label) { return compile.call(this, type, '#version 300 es\ninvalid smoke shader;', label) }
    store.getState().selectCanvasPreset('canvas-clean-playback'); await frames(2); store.getState().selectCanvasPreset('canvas-mutagen'); await wait(() => host.textContent.includes('Showing the original source') && published, 'compile fallback'); capture('fallback-compile', published)
    ShaderCompiler.prototype.compile = compile; await reset()
    // Signed URL queries are preserved; expired/deleted source cannot advertise old output.
    const signed = new URL('/mutagen-fixture.svg?signature=a%2Bb&expires=2000000000', location.href).href
    media.setState({ items: [{ ...asset, name: 'signed.svg', mimeType: 'image/svg+xml', url: signed, revision: 2 }] }); await wait(() => host.querySelector('img')?.src === signed && gpuReady(), 'signed replacement')
    media.setState({ items: [{ ...asset, url: signed.replace('signature=a%2Bb', 'signature=expired'), revision: 3 }] }); await wait(() => capability?.status === 'unavailable' && !published, 'expired source output')
    media.setState({ items: [] }); await frames(3); assert(!published, 'deleted source stale capture')
    media.setState({ items: [asset] }); await wait(gpuReady, 'source restore')
    // Existing authored/show composition never receives MUTAGEN as a global effect.
    const settings = store.getState().canvasOrchestrationSettings
    store.setState({ canvasOrchestrationSettings: { ...settings, renderMode: 'layers', authoredLayers: [{ id: 'fixture-layer', mediaId: asset.id, enabled: true, solo: false, ownership: 'manual', pinned: true, order: 0, effects: [] }] } })
    await wait(() => host.querySelector('[aria-label="CANVAS orchestrated media surface"]') && published?.width, 'authored owner'); await frames(8)
    assert(!host.querySelector('.rv-canvas-mutagen-layer'), 'authored global effect'); const authoredPixels = pixels(published); assert(authoredPixels.some((x, i) => i % 4 === 3 && x > 0), 'authored output blank'); capture('authored-unprocessed', published)
    const show = showDomain.createCanvasShowManagerShow('Legacy fixture')
    show.mediaElements = [{ id: 'fixture-element', mediaId: asset.id, layer: 0, showStartSec: 0, showEndSec: 120, sourceInSec: null, sourceOutSec: null, display: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY }, fx: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_FX }, transitions: { in: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION }, out: { ...showDomain.CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION } } }]
    store.setState({ canvasShowManagerShows: [show], canvasShowManagerActiveShowId: show.id }); await frames(12)
    assert(published && !host.querySelector('.rv-canvas-mutagen-layer'), 'Show owner lost'); const showPixels = pixels(published); capture('show-unprocessed', published)
    store.getState().selectCanvasPreset('canvas-clean-playback'); await frames(5); identity(pixels(published), showPixels, 'selected preset affected active Show')
    store.setState({ canvasShowManagerActiveShowId: null, canvasOrchestrationSettings: { ...settings, renderMode: 'single' } }); await reset()
    // Rapid selections reuse source identity and dispose each direct layer.
    const handles = [], factory = MutagenRenderer.create
    MutagenRenderer.create = function(c) { const result = factory.call(this, c); if (result.renderer) handles.push(result.renderer); return result }
    for (let i = 0; i < 6; i++) { store.getState().selectCanvasPreset('canvas-clean-playback'); await frames(1); store.getState().selectCanvasPreset('canvas-mutagen'); await wait(gpuReady, 'rapid re-entry') }
    store.getState().setCanvasAutoSelectEnabled(true); store.getState().selectCanvasMediaItem(asset.id); store.getState().selectCanvasPreset('canvas-mutagen'); store.getState().applyCanvasAutoSelection({ mediaId: 'other-user-media', presetId: 'canvas-fractures' })
    assert(store.getState().activeCanvasMediaId === asset.id && store.getState().selectedCanvasPresetId === 'canvas-mutagen', 'manual lock lost to Auto Select')
    store.getState().setCanvasPresetSettings({ mutagen: { ...defaults, pattern: 'vortex', deterministicSeed: 777, feedback: 0.3 } }); await frames(4)
    const cards = document.createElement('div'); cards.style.cssText = 'position:absolute;left:660px;top:0;width:590px;height:850px;overflow:auto'; document.body.append(cards)
    store.setState({ activeReactEngineId: 'canvas' }); const cardRoot = createRoot(cards); cardRoot.render(React.createElement(ReactPresetsPanel)); await frames(8)
    const card = cards.querySelector('button[data-preset-card-id="canvas-mutagen"]'); assert(card?.getAttribute('aria-pressed') === 'true', 'preset card inactive')
    assert(card.textContent.includes('Modified') || cards.querySelector('[data-preset-card-id="canvas-mutagen"]')?.textContent.includes('Modified'), 'modified badge absent')
    window.__mutagenProduction = { store, media, asset, fixtureUrls: fixtures.map(f => f[1].src), root, cardRoot, host, getPublished: () => published }
    const sheet = make(1280, Math.ceil(captures.length / 4) * 202), ctx = sheet.getContext('2d'); ctx.fillStyle = '#172126'; ctx.fillRect(0, 0, sheet.width, sheet.height)
    for (const [i, c] of captures.entries()) { const x = i % 4 * 320, y = Math.floor(i / 4) * 202; ctx.fillStyle = 'white'; ctx.font = '11px sans-serif'; ctx.fillText(c.name, x + 4, y + 14); ctx.drawImage(await load(c.image), x, y + 22, 320, 180) }
    capture('contact-sheet', sheet)
    // Cleanup remains testable after the external screenshot.
    window.__mutagenProduction.cleanup = () => { root.unmount(); cardRoot.unmount(); MutagenRenderer.create = factory; assert(handles.every(r => r.getDiagnostics().disposed && r.getDiagnostics().programs === 0 && r.getDiagnostics().targetBytes === 0), 'rapid-switch resources retained'); return handles.length }
    return { captures, device, identities, aspectChecks, arrangement, profiles, soak, alphaChecks, recording, persisted: store.getState().canvasPresetSettings.mutagen }
  }, { svg, soakSeconds })
  for (const c of result.captures) await writeFile(path.join(outputDir, c.name + '.png'), Buffer.from(c.image.split(',')[1], 'base64'))
  await writeFile(path.join(outputDir, 'recording.webm'), Buffer.from(result.recording.bytes))
  await page.locator('button[data-preset-card-id="canvas-mutagen"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(outputDir, 'stage-and-preset-card.png') })
  // Freeze the layer, then compare actual browser pixels against the published canvas
  // composited over the same page backdrop. No production GPU readback is added.
  const parity = []
  for (const variant of ['alpha', 'legacy-alpha', 'opaque', 'zero', 'reconstruction']) {
    const image = await page.evaluate(async variant => {
      const { store, media, asset, fixtureUrls, getPublished } = window.__mutagenProduction
      store.getState().setCanvasAutoSelectEnabled(false) // The Media Lock notice is UI, not recorded output.
      media.setState({ items: [{ ...asset, url: fixtureUrls[variant === 'opaque' ? 1 : 0], mimeType: variant === 'opaque' ? 'image/jpeg' : 'image/png', revision: variant === 'opaque' ? 10 : 9 }] })
      store.getState().setCanvasEngineSettings({ opacity: variant === 'legacy-alpha' ? 0.4 : 1 })
      store.getState().setCanvasPresetSettings({ sourceMixMode: variant === 'legacy-alpha' ? 'legacyComposite' : 'dryOnly', drySourceMix: variant === 'legacy-alpha' ? 0.25 : 0, mutagen: { ...store.getState().canvasPresetSettings.mutagen, mutation: variant === 'zero' ? 0 : 0.65, sourceMix: variant === 'reconstruction' ? 1 : 0, flowSpeed: 0, feedback: 0, transitionDuration: 0.1 } })
      for (let i = 0; i < 20; i++) await new Promise(requestAnimationFrame)
      if (variant === 'zero' || variant === 'reconstruction') {
        if (window.__mutagenProduction.host.querySelector('img').style.opacity !== '1' || window.__mutagenProduction.host.querySelector('.rv-canvas-mutagen-layer').style.opacity !== '0') throw new Error('Clean native ownership')
      }
      return { data: getPublished().toDataURL(), width: getPublished().width, height: getPublished().height }
    }, variant)
    const live = await page.locator('#mutagen-stage').screenshot({ path: path.join(outputDir, 'live-preview-' + variant + '.png') })
    const capture = Buffer.from(image.data.split(',')[1], 'base64')
    await writeFile(path.join(outputDir, 'parity-output-' + variant + '.png'), capture)
    const expected = await sharp({ create: { width: image.width, height: image.height, channels: 4, background: '#172126' } }).composite([{ input: capture }]).removeAlpha().raw().toBuffer()
    const actual = await sharp(live).removeAlpha().raw().toBuffer()
    let error = 0; if (expected.length !== actual.length) throw new Error('live/output parity dimensions')
    for (let i = 0; i < actual.length; i++) error += Math.abs(actual[i] - expected[i])
    const mean = error / actual.length; parity.push({ variant, mean })
    if (mean > 1) throw new Error('live/output parity exceeds 1/255 (' + variant + '): ' + mean)
  }
  const disposedRenderers = await page.evaluate(() => window.__mutagenProduction.cleanup())
  const expectedSettings = await page.evaluate(() => window.__mutagenProduction.store.getState().canvasPresetSettings.mutagen)
  await visit()
  const reloaded = await page.evaluate(async () => { const { useReactStore } = await import('/src/stores/reactStore.ts'); await useReactStore.persist.rehydrate(); return { settings: useReactStore.getState().canvasPresetSettings.mutagen, id: useReactStore.getState().activeCanvasMediaId } })
  if (JSON.stringify(reloaded.settings) !== JSON.stringify(expectedSettings) || reloaded.id !== 'mutagen-production-source') throw new Error('reload lost recipe/media identity')
  if (errors.length) throw new Error('Browser errors: ' + errors.join('\n'))
  const { captures, recording, ...report } = result
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ...report, recordingBytes: recording.size, liveOutputMeanError: parity, disposedRenderers, reload: reloaded, scope: 'Headless Chromium component harness; synthetic media/semantic context; no authenticated cloud or Electron-native cast' }, null, 2))
  console.log(JSON.stringify({ outputDir, profiles: report.profiles, soak: report.soak, liveOutputMeanError: parity, disposedRenderers, recordingBytes: recording.size }, null, 2))
} finally { await browser.close() }
