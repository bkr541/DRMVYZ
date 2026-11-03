/* global document, Image, window, requestAnimationFrame, MediaRecorder, Blob */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.MUTAGEN_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = process.env.MUTAGEN_OUTPUT_DIR ?? '/tmp/mutagen-p1-validation'
await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  // Isolate the component harness from App/auth startup and saved-project hydration.
  await page.route('**/__mutagen-validation.html', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles/reactView.css"><link rel="stylesheet" href="/src/styles/typography.css">
    <script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script>
    </head><body style="margin:0;background:#172126;color:white"></body></html>` }))
  await page.goto(`${baseUrl}/__mutagen-validation.html`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__)
  const result = await page.evaluate(async () => {
    const { MutagenRenderer } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenRenderer.ts')
    const { DEFAULT_CANVAS_MUTAGEN_SETTINGS: defaults } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenSettings.ts')
    const assert = (condition, message) => { if (!condition) throw new Error(message) }
    const load = url => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url })
    const make = (w = 640, h = 360) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    const pixels = canvas => {
      const copy = make(canvas.width, canvas.height), ctx = copy.getContext('2d')
      ctx.drawImage(canvas, 0, 0)
      return ctx.getImageData(0, 0, copy.width, copy.height).data
    }
    const diff = (a, b) => {
      assert(a.length === b.length, 'Capture dimensions differ')
      let total = 0, large = 0, max = 0
      for (let i = 0; i < a.length; i++) {
        const alpha = (i & 3) === 3
        const d = Math.abs(alpha ? a[i] - b[i] : a[i] * a[(i & ~3) + 3] / 255 - b[i] * b[(i & ~3) + 3] / 255)
        total += d; max = Math.max(max, d); if (d > 8) large++
      }
      return { mean: total / a.length, fractionOver8: large / a.length, max }
    }
    const identity = (a, b, label, fractionTolerance = 0.02) => {
      const d = diff(a, b)
      // Premultiplied RGBA comparison avoids undefined RGB under transparent pixels.
      // Resampled edges allow <2% channels above 8/255 (3% for rotated
      // minification); mean must stay <=1/255 in both cases.
      assert(d.mean <= 1 && d.fractionOver8 < fractionTolerance, `${label}: identity tolerance exceeded ${JSON.stringify(d)}`)
      return d
    }
    const transform = { scale: 1, positionX: 0, positionY: 0, rotation: 0 }
    const logo = make(), lc = logo.getContext('2d')
    lc.drawImage(await load('/src/assets/dvydrm_wordmark_clean_master.svg'), 40, 95, 560, 170)
    lc.fillStyle = '#56ffc0'; lc.globalAlpha = 0.5; lc.fillRect(80, 280, 480, 20); lc.globalAlpha = 1
    const photo = await load('/mockups/TheKodyRobinson_Neon_club_hallucination_with_massive_pink_han_52216af9-f4da-477c-97d5-c5e22d9c394d_0.png')
    const landscape = make(); landscape.getContext('2d').drawImage(photo, 0, 0, 640, 360)
    const portrait = make(240, 600); portrait.getContext('2d').drawImage(photo, 0, 0, 240, 600)
    const fixtures = [
      ['alpha-logo-png', await load(logo.toDataURL('image/png'))],
      ['opaque-jpeg', await load(landscape.toDataURL('image/jpeg', 0.95))],
      ['portrait-webp', await load(portrait.toDataURL('image/webp', 0.95))],
      ['landscape-svg', await load('data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="240"><rect width="900" height="240" fill="#603ca0"/><circle cx="180" cy="120" r="95" fill="#55ffcc"/><path d="M350 35H850V205H350Z" fill="#ff3780"/><text x="400" y="160" font-size="100" fill="white">MUTAGEN</text></svg>'))],
    ]
    const captures = [], metrics = []
    const sheet = make(1280, fixtures.length * 205), sc = sheet.getContext('2d')
    sc.fillStyle = '#172126'; sc.fillRect(0, 0, sheet.width, sheet.height)
    for (let row = 0; row < fixtures.length; row++) {
      const [name, source] = fixtures[row]
      const canvas = make(), { renderer, error } = MutagenRenderer.create(canvas)
      assert(renderer, error)
      const gl = canvas.getContext('webgl2'), counts = { textures: 0, deletedTextures: 0, targets: 0, deletedTargets: 0, uploads: 0 }
      // Source texture already exists. Count all additional allocations and releases.
      for (const [method, key] of [['createTexture', 'textures'], ['deleteTexture', 'deletedTextures'], ['createFramebuffer', 'targets'], ['deleteFramebuffer', 'deletedTargets'], ['texImage2D', 'uploads']]) {
        const fn = gl[method].bind(gl); gl[method] = (...args) => { counts[key]++; return fn(...args) }
      }
      const frame = (settings, timeSec, fitMode = 'contain', sourceTransform = transform) => {
        assert(renderer.render({ source, settings, timeSec, fitMode, sourceTransform }), `${name} did not render`)
        return pixels(canvas)
      }
      const columns = []
      const reference = make(), rc = reference.getContext('2d')
      const baseline = frame({ ...defaults, mutation: 0, feedback: 1, preserveColors: false }, 0)
      const k = Math.min(640 / source.naturalWidth, 360 / source.naturalHeight)
      rc.drawImage(source, (640 - source.naturalWidth * k) / 2, (360 - source.naturalHeight * k) / 2, source.naturalWidth * k, source.naturalHeight * k)
      const clean = identity(baseline, pixels(reference), name)
      columns.push(reference.toDataURL(), canvas.toDataURL())
      const a = frame(defaults, 2); columns.push(canvas.toDataURL())
      const b = frame(defaults, 4); columns.push(canvas.toDataURL())
      const animation = diff(a, b), mutation = diff(b, baseline)
      assert(animation.mean > 0.3 && mutation.mean > 0.5, `${name}: insufficient visible animation`)
      for (const fitMode of ['contain', 'cover', 'stretch']) {
        const t = { scale: 0.73, positionX: 11, positionY: -7, rotation: 23 }
        frame({ ...defaults, mutation: 0 }, 5, fitMode, t)
        rc.clearRect(0, 0, 640, 360); rc.save(); rc.translate(640 * 0.61, 360 * 0.43); rc.rotate(23 * Math.PI / 180); rc.scale(0.73, 0.73)
        const scale = fitMode === 'cover' ? Math.max(640 / source.naturalWidth, 360 / source.naturalHeight) : Math.min(640 / source.naturalWidth, 360 / source.naturalHeight)
        const w = fitMode === 'stretch' ? 640 : source.naturalWidth * scale, h = fitMode === 'stretch' ? 360 : source.naturalHeight * scale
        rc.drawImage(source, -w / 2, -h / 2, w, h); rc.restore()
        identity(pixels(canvas), pixels(reference), `${name}/${fitMode}/transform`, 0.03)
      }
      for (let i = 0; i < 40; i++) frame({ ...defaults, feedback: 1 }, 6 + i / 60)
      assert(counts.targets === 2 && counts.textures === 2, 'Feedback allocated beyond two ping-pong targets')
      assert(counts.uploads === 3, 'Static source was uploaded repeatedly')
      const restored = frame({ ...defaults, mutation: 0, feedback: 1, preserveColors: false }, 8)
      identity(restored, baseline, `${name}/zero-after-feedback`)
      renderer.resize(320, 180)
      assert(counts.deletedTargets === 2, 'Resize did not release feedback')
      renderer.dispose(); renderer.dispose()
      assert(counts.deletedTextures === 3 && counts.deletedTargets === 2, 'Renderer did not dispose all textures/targets exactly once')
      metrics.push({ name, clean, animation, mutation, resources: counts })
      for (let col = 0; col < columns.length; col++) {
        sc.fillStyle = 'white'; sc.font = '12px sans-serif'; sc.fillText(`${name} · ${['original', 'mutation 0', 'LIQUIFY t=2', 'LIQUIFY t=4'][col]}`, col * 320 + 8, row * 205 + 17)
        sc.drawImage(await load(columns[col]), col * 320, row * 205 + 25, 320, 180)
      }
      captures.push({ name, image: columns[3] })
    }

    // Exercise actual direct shell dispatch and its published recorder canvas.
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { CanvasEngineSurface, CanvasEngineFxPanel } = await import('/src/components/vyzualz/react/ReactCanvasEngineShell.tsx')
    const { useReactStore } = await import('/src/stores/reactStore.ts')
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    await useReactStore.persist.rehydrate()
    const wait = async predicate => {
      for (let i = 0; i < 180; i++) { if (predicate()) return; await new Promise(requestAnimationFrame) }
      throw new Error('Timed out waiting for Canvas shell: ' + JSON.stringify({ state: [useReactStore.getState().selectedCanvasPresetId, useReactStore.getState().activeCanvasMediaId, useMediaStore.getState().items.map(i=>i.id)], rendered: host.querySelector('[data-renderer-kind]')?.getAttribute('data-renderer-kind'), hidden: document.hidden, published: published && [published.width, published.height], notice: host.textContent.slice(0,500), canvases: [...host.querySelectorAll('canvas')].map(c => ({ cls:c.className, ready:c.dataset.ready, rect:[c.getBoundingClientRect().width,c.getBoundingClientRect().height] })), image: host.querySelector('img') && [host.querySelector('img').complete,host.querySelector('img').naturalWidth] }))
    }
    useReactStore.getState().resetReactView()
    const src = fixtures[1][1].src
    useMediaStore.setState({ items: [{ id: 'mutagen-browser', name: 'opaque.jpg', type: 'image', mimeType: 'image/jpeg', url: src, metadata: { width: 640, height: 360 }, meta: 'JPEG', mediaRole: 'image', tags: [], collectionIds: [], revision: 1 }] })
    useReactStore.getState().selectCanvasMediaItem('mutagen-browser')
    useReactStore.getState().setCanvasEngineSettings({ opacity: 1, fitMode: 'contain' })
    useReactStore.getState().selectCanvasPreset('canvas-mutagen')
    const host = document.createElement('div'); host.style.cssText = 'width:640px;height:360px;position:relative'; document.body.append(host)
    const root = createRoot(host)
    let published = null
    const onCanvasReady = c => { published = c }
    root.render(React.createElement(CanvasEngineSurface, { isPlaying: false, isPaused: false, onCanvasReady }))
    await wait(() => host.querySelector('.rv-canvas-mutagen-layer[data-ready="true"]') && published?.width === 640)
    const image = host.querySelector('img.rv-canvas-live-media')
    assert(image && image.style.opacity === '0', 'Dry image rendered beneath processed alpha')
    assert(useReactStore.getState().canvasPresetSettings.drySourceMix === 0, 'Fixture must validate Dry Source Mix zero')
    const before = pixels(published)
    for (let i = 0; i < 18; i++) await new Promise(requestAnimationFrame)
    assert(diff(before, pixels(published)).mean > 0.05, 'Published capture is not animated')
    const raw = make(); raw.getContext('2d').drawImage(fixtures[1][1], 0, 0)
    assert(diff(pixels(published), pixels(raw)).mean > 1, 'Capture contains the original instead of LIQUIFY')
    const shellImage = published.toDataURL()
    const recording = await new Promise((resolve, reject) => {
      const stream = published.captureStream(30), chunks = [], recorder = new MediaRecorder(stream)
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      recorder.onerror = reject
      recorder.onstop = () => { const size = new Blob(chunks).size; stream.getTracks().forEach(t => t.stop()); resolve(size) }
      recorder.start(); window.setTimeout(() => recorder.stop(), 350)
    })
    assert(recording > 1000, 'Recorder did not receive usable frames')
    const gpu = host.querySelector('.rv-canvas-mutagen-layer')
    gpu.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()
    await wait(() => image.style.opacity === '1')
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame)
    identity(pixels(published), pixels(raw), 'context-loss capture fallback')
    useReactStore.getState().selectCanvasPreset('canvas-clean-playback')
    await wait(() => !host.querySelector('.rv-canvas-mutagen-layer'))
    assert(host.querySelector('img.rv-canvas-live-media') === image, 'Switching presets replaced the selected image')
    useReactStore.getState().selectCanvasPreset('canvas-mutagen')
    await wait(() => host.querySelector('.rv-canvas-mutagen-layer[data-ready="true"]'))
    const controls = document.createElement('div'); controls.style.cssText = 'position:absolute;left:660px;top:0;width:360px'; document.body.append(controls)
    const controlsRoot = createRoot(controls); controlsRoot.render(React.createElement(CanvasEngineFxPanel))
    await wait(() => controls.textContent.includes('Reset MUTAGEN'))
    window.__mutagenCleanup = () => { root.unmount(); controlsRoot.unmount() }
    return { metrics, recordingBytes: recording, sheet: sheet.toDataURL(), captures, shellImage }
  })
  for (const capture of [...result.captures, { name: 'contact-sheet', image: result.sheet }, { name: 'shell-capture', image: result.shellImage }]) {
    await writeFile(path.join(outputDir, `${capture.name}.png`), Buffer.from(capture.image.split(',')[1], 'base64'))
  }
  await page.screenshot({ path: path.join(outputDir, 'design-and-stage.png') })
  await page.evaluate(() => window.__mutagenCleanup())
  const report = { metrics: result.metrics, recordingBytes: result.recordingBytes }
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ outputDir, ...report }, null, 2))
} finally { await browser.close() }
