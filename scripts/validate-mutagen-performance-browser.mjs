/* global document, Image, window, requestAnimationFrame */
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.MUTAGEN_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = process.env.MUTAGEN_OUTPUT_DIR ?? '/tmp/mutagen-performance-validation'
await mkdir(outputDir, { recursive: true })
const golden = JSON.parse(await readFile(new URL('../src/test/fixtures/audio-intelligence/aint-no-other-man-social-club-remix.chromium.json', import.meta.url), 'utf8'))
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 }, deviceScaleFactor: 1 })
  await page.route('**/__mutagen-performance.html', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles/appearance.css">
    <link rel="stylesheet" href="/src/styles/reactView.css"><link rel="stylesheet" href="/src/styles/typography.css">
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body style="margin:0;background:#172126;color:#fff;font-family:sans-serif"></body></html>` }))
  await page.goto(`${baseUrl}/__mutagen-performance.html`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__)
  const result = await page.evaluate(async analysis => {
    const { MutagenRenderer } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenRenderer.ts')
    const { MutagenPerformanceController } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenPerformanceController.ts')
    const { DEFAULT_CANVAS_MUTAGEN_SETTINGS: defaults } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenSettings.ts')
    const { createSharedPerformanceFallbackContext } = await import('/src/features/performanceCore/index.ts')
    const { mutagenAnalyzedFixtureContext } = await import('/src/test/support/MutagenMusicFixture.ts')
    const { DEFAULT_MI_FRAME } = await import('/src/features/musicIntelligence/constants.ts')
    const assert = (ok, message) => { if (!ok) throw new Error(message) }
    const W = 640, H = 360
    const make = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    const load = url => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url })
    const pixels = canvas => { const c = make(canvas.width, canvas.height), ctx = c.getContext('2d'); ctx.drawImage(canvas, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data }
    const difference = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length }
    const input = make()
    input.getContext('2d').drawImage(await load('/mockups/TheKodyRobinson_Neon_club_hallucination_with_massive_pink_han_52216af9-f4da-477c-97d5-c5e22d9c394d_0.png'), 0, 0, W, H)
    const source = await load(input.toDataURL())
    const canvas = make(), { renderer, error } = MutagenRenderer.create(canvas)
    assert(renderer, error)
    const gl = canvas.getContext('webgl2'), upload = gl.texImage2D.bind(gl)
    let uploads = 0, presentation = 0
    gl.texImage2D = (...args) => { uploads++; return upload(...args) }
    const transform = { scale: 1, positionX: 0, positionY: 0, rotation: 0 }
    const draw = (settings, decision, freezeTime = false) => {
      const performance = { ...decision, motionTimeSec: freezeTime ? 5 : decision.motionTimeSec, transitionTimeSec: presentation += 2 }
      renderer.render({ source, settings, performance, timeSec: 5, fitMode: 'contain', sourceTransform: transform })
      renderer.render({ source, settings, performance: { ...performance, reset: false, transitionTimeSec: presentation + 1 }, timeSec: 5, fitMode: 'contain', sourceTransform: transform })
      assert(gl.getError() === gl.NO_ERROR, 'Performance rendering produced a GL error')
      return { image: canvas.toDataURL(), pixels: pixels(canvas) }
    }
    const context = (time, patch = {}) => {
      const base = createSharedPerformanceFallbackContext(time)
      return { ...base, trackIdentity: 'mutagen-structural-fixture', runtimeIdentity: 'mutagen-structural-fixture',
        capabilities: { ...base.capabilities, liveBands: true, beatGrid: true, sections: true, rhythmEvents: true },
        confidence: { ...base.confidence, overall: 1, rhythm: 1, grid: 1, downbeat: 1, phrase: 1, section: 1, semantics: 1 },
        bpm: 120, absoluteBeat: time * 2, absoluteBar: time / 2,
        boundaries: { ...base.boundaries, timingDiscontinuity: false, beatBoundary: false, barBoundary: false, sectionEntry: false }, ...patch }
    }
    const captures = [], profiles = []
    const profileDecision = (profile, settings) => {
      const controller = new MutagenPerformanceController()
      let decision
      for (let i = 0; i <= 20; i++) {
        const time = 4.5 + i * 0.025, c = context(time)
        if (profile === 'bass') { c.bass = 1; c.intelligence = { ...c.intelligence, bands: { ...c.intelligence.bands, normalized: { ...c.intelligence.bands.normalized, normalizedSub: 1 } } } }
        if (profile === 'mids') c.mid = 1
        if (profile === 'highs') c.high = 1
        if (profile === 'kick' && i === 20) { c.kick = true; c.kickStrength = 1 }
        if (profile === 'snare' && i === 20) { c.snare = true; c.snareStrength = 1 }
        if (profile === 'drop') { c.sectionType = i === 20 ? 'drop' : 'build'; c.dropOccurrence = 1; c.boundaries.sectionEntry = i === 20; c.dropImpact = i === 20 ? 1 : 0 }
        decision = controller.update({ settings, context: c, audioActive: true, paused: false, timeSec: time, deltaSec: 0.025 })
      }
      return decision
    }
    for (const [profile, pattern] of [['bass', 'liquify'], ['kick', 'liquify'], ['snare', 'spectralTear'], ['mids', 'fracture'], ['highs', 'particulate'], ['drop', 'vortex'], ['audio-off', 'liquify']]) {
      const settings = { ...defaults, pattern, mutation: 0.4, audioReactivity: profile === 'audio-off' ? 0 : 1 }
      const quiet = draw(settings, profileDecision('quiet', settings), true)
      const loud = draw(settings, profileDecision(profile === 'audio-off' ? 'bass' : profile, settings), true)
      const delta = difference(quiet.pixels, loud.pixels)
      if (profile === 'audio-off') assert(delta === 0, 'Audio Reactivity 0 is not neutral')
      else if (profile !== 'highs') assert(delta > 0.5, `${profile}: feature changes did not materially change displacement (${delta})`)
      else assert(delta > 0, 'High-frequency detail route is inactive')
      captures.push({ name: `profile-${profile}-quiet`, image: quiet.image }, { name: `profile-${profile}-active`, image: loud.image })
      profiles.push({ profile, pattern, meanPixelDifference: delta })
    }
    assert(uploads === 3, `Unexpected source/resource replacement during profile switching (${uploads})`) // one source + two transition targets

    // Replay the existing browser-analyzed track through the real Performance Core.
    const authored = { ...defaults, autoPerformance: true, bpmSync: true, audioReactivity: 0.85, mutation: 0.55 }
    const serialized = JSON.stringify(authored), controller = new MutagenPerformanceController()
    const wanted = [3, 14, 32, 60, 94, 138], analyzed = []
    let previous = null
    for (let tick = 0; tick <= Math.ceil(analysis.durationMs / 50); tick++) {
      const time = tick / 20, c = mutagenAnalyzedFixtureContext(analysis, time, previous)
      const decision = controller.update({ settings: authored, context: c, audioActive: true, paused: false, timeSec: time, deltaSec: 0.05 })
      if (wanted.includes(time)) {
        const capture = draw(authored, decision)
        const name = `analyzed-${time}-${c.sectionType}-${decision.activePattern}`
        captures.push({ name, image: capture.image })
        analyzed.push({ time, section: c.sectionType, pattern: decision.activePattern, routing: decision.routing, name })
      }
      previous = c
    }
    assert(analyzed.length === wanted.length && new Set(analyzed.map(row => row.pattern)).size > 1, 'Stored analysis did not direct varied runtime looks')
    assert(JSON.stringify(authored) === serialized, 'Auto Performance mutated the authored recipe')

    // Explicit upstream structural publications cover the golden track's absent
    // confident build/drop labels. They are test fixtures, never a new analyzer.
    const arrangement = [], story = new MutagenPerformanceController()
    const sections = [['intro', 0, 0], ['verse', 0, 0], ['build', 0.2, 0], ['build', 0.9, 0], ['preDrop', 0.95, 0], ['drop', 0, 1], ['breakdown', 0, 0], ['drop', 0, 2], ['outro', 0, 0]]
    for (const [index, [sectionType, buildProgress, dropOccurrence]] of sections.entries()) {
      for (let i = 0; i < 32; i++) {
        const time = index * 1.6 + i / 20
        const c = context(time, { sectionType, sectionId: `section-${index}`, sectionProgress: sectionType === 'build' ? buildProgress : i / 32, buildProgress, dropOccurrence, bass: sectionType === 'drop' ? 0.95 : 0.2, mid: 0.5, high: 0.3, dropImpact: sectionType === 'drop' && i < 2 ? 1 : 0 })
        c.boundaries.sectionEntry = i === 0
        if (sectionType === 'preDrop') c.sectionProgress = 0.85
        const decision = story.update({ settings: authored, context: c, audioActive: true, paused: false, timeSec: time, deltaSec: 0.05 })
        if (i === (sectionType === 'drop' ? 2 : 28)) {
          const name = `arrangement-${index}-${sectionType}-${decision.activePattern}`
          captures.push({ name, image: draw(authored, decision).image })
          arrangement.push({ name, sectionType, dropOccurrence, pattern: decision.activePattern, routing: decision.routing })
        }
      }
    }
    const drops = arrangement.filter(row => row.sectionType === 'drop')
    assert(drops[0].pattern !== drops[1].pattern, 'Drop occurrences are not distinguishable')
    assert(drops[1].routing.mutationGain > drops[0].routing.mutationGain, 'Drop 2 has no additional intensity headroom')
    renderer.dispose()

    // Verify the actual CANVAS source/capture and paused snapshot handoff.
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { CanvasEngineSurface } = await import('/src/components/vyzualz/react/ReactCanvasEngineShell.tsx')
    const { MutagenDesignControls } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenDesignControls.tsx')
    const { useReactStore } = await import('/src/stores/reactStore.ts')
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { AudioFeatureBus } = await import('/src/features/musicIntelligence/AudioFeatureBus.ts')
    await useReactStore.persist.rehydrate()
    useReactStore.getState().resetReactView()
    useMediaStore.setState({ items: [{ id: 'mutagen-performance-source', name: 'performance.png', type: 'image', mimeType: 'image/png', url: source.src, metadata: { width: W, height: H }, tags: [], collectionIds: [], revision: 1 }] })
    useReactStore.getState().selectCanvasMediaItem('mutagen-performance-source')
    useReactStore.getState().selectCanvasPreset('canvas-mutagen')
    useReactStore.getState().setCanvasEngineSettings({ opacity: 1, fitMode: 'contain' })
    useReactStore.getState().setCanvasPresetSettings({ mutagen: { ...defaults, mutation: 0.4, audioReactivity: 1 } })
    const frame = { ...DEFAULT_MI_FRAME, frameId: 1, timeSec: 5, capabilities: { ...DEFAULT_MI_FRAME.capabilities, liveBands: true }, confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 1 } }
    AudioFeatureBus.updatePartial(frame)
    const host = document.createElement('div'); host.style.cssText = 'width:640px;height:360px;position:relative'; document.body.append(host)
    let published = null
    const onCanvasReady = c => { published = c }, getAudioTime = () => 5
    const root = createRoot(host)
    const surface = paused => React.createElement(CanvasEngineSurface, { isPlaying: true, isPaused: paused, getAudioTime, onCanvasReady })
    root.render(surface(false))
    const frames = async n => { for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame) }
    for (let i = 0; i < 120 && !host.querySelector('.rv-canvas-mutagen-layer[data-ready="true"]'); i++) await frames(1)
    assert(published?.width === W, 'CANVAS did not publish a usable performance capture')
    await frames(4)
    const image = host.querySelector('img.rv-canvas-live-media'), gpuCanvas = host.querySelector('.rv-canvas-mutagen-layer')
    const quiet = pixels(published)
    AudioFeatureBus.updatePartial({ ...frame, frameId: 2, bands: { ...frame.bands, normalizedBass: 1, normalizedSub: 1, normalizedMid: 0.8, normalizedHigh: 0.5 } })
    await frames(30)
    const shellDifference = difference(quiet, pixels(published))
    assert(shellDifference > 1, `Actual shell capture did not react to bands (${shellDifference})`)
    assert(host.querySelector('img.rv-canvas-live-media') === image && host.querySelector('.rv-canvas-mutagen-layer') === gpuCanvas, 'Audio modulation replaced the source or GL layer')
    assert(useReactStore.getState().activeCanvasMediaId === 'mutagen-performance-source', 'Audio changed the selected media')
    captures.push({ name: 'shell-audio-reactive-capture', image: published.toDataURL() })
    root.render(surface(true)); await frames(4)
    const paused = pixels(published); await frames(20)
    assert(difference(paused, pixels(published)) === 0, 'Pause did not freeze the published snapshot')
    root.render(surface(false)); await frames(4)
    const controls = document.createElement('div'); controls.style.cssText = 'position:absolute;left:660px;top:0;width:360px'; document.body.append(controls)
    const controlsRoot = createRoot(controls); controlsRoot.render(React.createElement(MutagenDesignControls))
    window.__mutagenSettings = () => useReactStore.getState().canvasPresetSettings.mutagen
    window.__mutagenCleanup = () => { root.unmount(); controlsRoot.unmount(); AudioFeatureBus.reset() }

    const sheets = async (name, list) => {
      const sheet = make(960, Math.ceil(list.length / 3) * 202), ctx = sheet.getContext('2d')
      ctx.fillStyle = '#172126'; ctx.fillRect(0, 0, sheet.width, sheet.height)
      for (const [i, item] of list.entries()) {
        const x = i % 3 * 320, y = Math.floor(i / 3) * 202
        ctx.fillStyle = 'white'; ctx.font = '11px sans-serif'; ctx.fillText(item.name.replace(/^arrangement-|^analyzed-|^profile-/, ''), x + 4, y + 15)
        ctx.drawImage(await load(item.image), x, y + 22, 320, 180)
      }
      return { name, image: sheet.toDataURL() }
    }
    for (const prefix of ['profile-', 'analyzed-', 'arrangement-']) captures.push(await sheets(prefix + 'contact-sheet', captures.filter(c => c.name.startsWith(prefix))))
    return { captures, profiles, analyzed, arrangement, shellDifference, pausedDifference: 0 }
  }, golden.payload.trackAnalysis)
  for (const c of result.captures) await writeFile(path.join(outputDir, `${c.name}.png`), Buffer.from(c.image.split(',')[1], 'base64'))
  await page.getByRole('switch', { name: 'Auto Performance', exact: true }).click()
  await page.getByRole('combobox', { name: 'Pattern', exact: true }).click()
  await page.getByRole('option', { name: 'VORTEX', exact: true }).click()
  if (await page.evaluate(() => window.__mutagenSettings().autoPerformance)) throw new Error('Manual Pattern did not disable Auto Performance')
  await page.getByRole('switch', { name: 'Pattern Change', exact: true }).click()
  await page.getByRole('combobox', { name: 'Trigger', exact: true }).click()
  await page.screenshot({ path: path.join(outputDir, 'trigger-dropdown.png'), animations: 'disabled' })
  await page.keyboard.press('Escape')
  await page.screenshot({ path: path.join(outputDir, 'performance-design.png'), animations: 'disabled' })
  await page.evaluate(() => window.__mutagenCleanup())
  const report = { fixture: { source: golden.source, analysisVersion: golden.payload.trackAnalysis.analysisVersion }, profiles: result.profiles, analyzed: result.analyzed, arrangement: result.arrangement, shellDifference: result.shellDifference, pausedDifference: result.pausedDifference }
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ outputDir, ...report }, null, 2))
} finally { await browser.close() }
