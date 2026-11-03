/* global document, Image, window, requestAnimationFrame */
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.MUTAGEN_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = process.env.MUTAGEN_OUTPUT_DIR ?? '/tmp/mutagen-pattern-validation'
const uiOnly = process.env.MUTAGEN_UI_ONLY === '1'
await mkdir(outputDir, { recursive: true })
// Real photographic fixture; optional local input supports offline validation.
const photoUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Fronalpstock_big.jpg/960px-Fronalpstock_big.jpg'
const photoBytes = process.env.MUTAGEN_PHOTO_PATH
  ? await readFile(process.env.MUTAGEN_PHOTO_PATH)
  : await (async () => { const response = await fetch(photoUrl); if (!response.ok) throw new Error(`Photograph fetch: ${response.status}`); return Buffer.from(await response.arrayBuffer()) })()
await writeFile(path.join(outputDir, 'photograph-source.jpg'), photoBytes)
await writeFile(path.join(outputDir, 'ATTRIBUTION.md'), 'Photograph: Fronalpstock, Switzerland, by Hannes Röst. https://commons.wikimedia.org/wiki/File:Fronalpstock_big.jpg — CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0/ . Photograph captures are resized and transformed by MUTAGEN; those adaptations are shared under the same license. Generated logo fixtures are original test graphics.\n')

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 1 })
  await page.route('**/__mutagen-patterns.html', route => route.fulfill({ contentType: 'text/html', body: `<html><head>
    <link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles/appearance.css">
    <link rel="stylesheet" href="/src/styles/reactView.css"><link rel="stylesheet" href="/src/styles/typography.css">
    <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body style="margin:0;background:#172126;color:#fff;font-family:sans-serif"></body></html>` }))
  await page.goto(`${baseUrl}/__mutagen-patterns.html`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__)
  const result = await page.evaluate(async ({ photoData, uiOnly }) => {
    const { MutagenRenderer } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenRenderer.ts')
    const { DEFAULT_CANVAS_MUTAGEN_SETTINGS: defaults, MUTAGEN_PATTERNS: patterns } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenSettings.ts')
    const assert = (ok, message) => { if (!ok) throw new Error(message) }
    const W = 480, H = 300
    const make = (w = W, h = H) => { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; return canvas }
    const load = url => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url })
    // Pixel reads occur only in this acceptance harness, never in the live renderer.
    const pixels = canvas => { const c = make(canvas.width, canvas.height), ctx = c.getContext('2d'); ctx.drawImage(canvas, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data }
    const premul = p => Float32Array.from(p, (v, i) => (i & 3) === 3 ? v : v * p[(i & ~3) + 3] / 255)
    const error = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length }
    const captures = [], reports = []
    const logo = transparent => {
      const c = make(), ctx = c.getContext('2d')
      if (!transparent) { ctx.fillStyle = '#13202b'; ctx.fillRect(0, 0, W, H) }
      ctx.fillStyle = '#ff387d'; ctx.beginPath(); ctx.arc(120, 110, 66, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#43e8d8'; ctx.fillRect(210, 44, 200, 58)
      ctx.fillStyle = '#f8cd45'; ctx.beginPath(); ctx.moveTo(210, 125); ctx.lineTo(410, 125); ctx.lineTo(330, 190); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = 'bold 50px sans-serif'; ctx.fillText('MUTAGEN', 47, 253)
      if (transparent) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#43e8d8'; ctx.fillRect(45, 275, 370, 10) }
      return c
    }
    const photograph = make(), pc = photograph.getContext('2d')
    pc.drawImage(await load(photoData), 0, 0, W, H)
    const fixtures = [['colored-logo', logo(false)], ['photograph', photograph], ['transparent-png', logo(true)]]
    const transform = { scale: 1, positionX: 0, positionY: 0, rotation: 0 }
    for (const [fixtureName, input] of uiOnly ? [] : fixtures) {
      const source = await load(input.toDataURL('image/png'))
      const canvas = make(), { renderer, error: initError } = MutagenRenderer.create(canvas)
      assert(renderer, initError)
      const gl = canvas.getContext('webgl2'), counts = { targets: 0, deletedTargets: 0, textures: 0, deletedTextures: 0, programs: 0, deletedPrograms: 0 }
      for (const [method, key] of [['createTexture', 'textures'], ['deleteTexture', 'deletedTextures'], ['createFramebuffer', 'targets'], ['deleteFramebuffer', 'deletedTargets'], ['createProgram', 'programs'], ['deleteProgram', 'deletedPrograms']]) {
        const original = gl[method].bind(gl); gl[method] = (...args) => { counts[key]++; return original(...args) }
      }
      const frame = (settings, clock, time = 1.6) => {
        assert(renderer.render({ source, settings, fitMode: 'contain', sourceTransform: transform, timeSec: time, transitionTimeSec: clock }), `${fixtureName}/${settings.pattern}: render failed`)
        assert(gl.getError() === gl.NO_ERROR, `${fixtureName}/${settings.pattern}: GL error`)
        return premul(pixels(canvas))
      }
      const baseline = premul(pixels(input)), outputs = [], metrics = []
      const sheet = make(960, 3 * 222), ctx = sheet.getContext('2d')
      ctx.fillStyle = '#172126'; ctx.fillRect(0, 0, sheet.width, sheet.height)
      const tile = async (index, name, url) => {
        const x = (index % 3) * 320, y = Math.floor(index / 3) * 222
        ctx.fillStyle = 'white'; ctx.font = '13px sans-serif'; ctx.fillText(`${fixtureName} · ${name}`, x + 8, y + 18)
        ctx.drawImage(await load(url), x, y + 22, 320, 200)
      }
      await tile(0, 'ORIGINAL', input.toDataURL())
      for (const [index, pattern] of patterns.entries()) {
        const settings = { ...defaults, pattern, transitionDuration: 0.2 }
        const clock = index * 3
        frame(settings, clock)
        const output = frame(settings, clock + 0.3)
        outputs.push(output)
        const url = canvas.toDataURL()
        captures.push({ name: `${fixtureName}-${pattern}`, image: url })
        await tile(index + 1, pattern, url)
        const motion = error(output, frame(settings, clock + 0.4, 1.9))
        assert(motion > 0.03, `${fixtureName}/${pattern}: motion is not visible`)
        const zero = error(baseline, frame({ ...settings, mutation: 0, feedback: 1, glow: 1, preserveColors: false }, clock + 0.5))
        const reconstruction = error(baseline, frame({ ...settings, sourceMix: 1, feedback: 1, glow: 1 }, clock + 0.6))
        assert(zero <= 1 && reconstruction <= 1, `${fixtureName}/${pattern}: clean reconstruction failed ${zero}/${reconstruction}`)
        const transparent = Array.from({ length: W * H }, (_, i) => output[i * 4 + 3]).filter(a => a === 0).length / (W * H)
        if (fixtureName === 'transparent-png') assert(transparent > 0.15, `${pattern}: source alpha was filled`)
        metrics.push({ pattern, motionMean: motion, zeroMean: zero, reconstructionMean: reconstruction, transparentFraction: transparent })
      }
      let minPairDifference = Infinity
      for (let a = 0; a < outputs.length; a++) for (let b = a + 1; b < outputs.length; b++) {
        const delta = error(outputs[a], outputs[b]); minPairDifference = Math.min(minPairDifference, delta)
        assert(delta > 0.7, `${fixtureName}: ${patterns[a]} and ${patterns[b]} are visually indistinguishable (${delta})`)
      }
      // Freeze musical motion to test the crossfade itself, independent of flow.
      const frozen = { ...defaults, pattern: 'liquify', flowSpeed: 0, transitionDuration: 1 }
      frame(frozen, 30); const from = frame(frozen, 32)
      const start = frame({ ...frozen, pattern: 'vortex' }, 33)
      assert(error(from, start) <= 1, 'Pattern switch snapped at its first frame')
      const middle = frame({ ...frozen, pattern: 'vortex' }, 33.5)
      const end = frame({ ...frozen, pattern: 'vortex' }, 34)
      const expected = Float32Array.from(from, (v, i) => (v + end[i]) / 2)
      assert(error(middle, expected) <= 1, 'Mid-transition is not the alpha-correct crossfade of two live outputs')
      assert(error(from, end) > 1, 'Transition fixture has no visible change')
      // Stress switching with history/glow; the finite four-target pool is reused.
      for (let i = 0; i < 24; i++) frame({ ...defaults, pattern: patterns[i % 8], feedback: 0.8, glow: 0.4 }, 40 + i * 0.7)
      frame({ ...defaults, pattern: 'morph', feedback: 0.8, glow: 0.4 }, 58)
      frame({ ...defaults, pattern: 'morph', feedback: 0.8, glow: 0.4 }, 59)
      for (const quality of ['auto', 'low', 'balanced', 'high']) for (const pattern of patterns) frame({ ...defaults, pattern, quality }, 60 + patterns.indexOf(pattern) * 3)
      assert(counts.targets <= 4, `Exceeded four targets: ${JSON.stringify(counts)}`)
      renderer.resize(240, 150); renderer.dispose(); renderer.dispose()
      assert(counts.deletedTargets === counts.targets && counts.deletedTextures === counts.textures + 1 && counts.deletedPrograms === counts.programs + 1, 'GPU cleanup did not balance allocations')
      captures.push({ name: `${fixtureName}-contact-sheet`, image: sheet.toDataURL() })
      reports.push({ fixtureName, minPairDifference, metrics, resources: counts, crossfadeMeanError: error(middle, expected) })
    }

    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { MutagenDesignControls } = await import('/src/components/vyzualz/react/renderers/mutagen/MutagenDesignControls.tsx')
    const { useReactStore } = await import('/src/stores/reactStore.ts')
    await useReactStore.persist.rehydrate()
    useReactStore.getState().selectCanvasPreset('canvas-mutagen')
    useReactStore.getState().setCanvasPresetSettings({ mutagen: { ...defaults, pattern: 'terraform' } })
    const host = document.createElement('div'); host.className = 'rv-workspace-panel rv-inspector'; host.style.cssText = 'width:360px;margin:20px'; document.body.append(host)
    const root = createRoot(host); root.render(React.createElement(MutagenDesignControls))
    window.__mutagenCleanup = () => root.unmount()
    return { captures, reports }
  }, { photoData: `data:image/jpeg;base64,${photoBytes.toString('base64')}`, uiOnly })
  for (const capture of result.captures) await writeFile(path.join(outputDir, `${capture.name}.png`), Buffer.from(capture.image.split(',')[1], 'base64'))
  await page.getByRole('combobox', { name: 'Pattern', exact: true }).click()
  await page.screenshot({ path: path.join(outputDir, 'pattern-dropdown.png'), animations: 'disabled' })
  await page.keyboard.press('Escape')
  await page.screenshot({ path: path.join(outputDir, 'terraform-design.png'), animations: 'disabled' })
  await page.evaluate(() => window.__mutagenCleanup())
  if (!uiOnly) await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(result.reports, null, 2))
  console.log(JSON.stringify({ outputDir, reports: result.reports }, null, 2))
} finally { await browser.close() }
