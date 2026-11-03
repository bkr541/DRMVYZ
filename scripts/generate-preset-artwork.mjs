/* global document, Image, XMLSerializer, requestAnimationFrame */
// Run against the Vite dev server. System artwork uses the production renderers;
// no camera, user media, transport, or production output is accessed.
import { access, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const baseUrl = process.env.DRMVYZ_ARTWORK_BASE_URL ?? 'http://127.0.0.1:5173'
const output = new URL('../public/preset-artwork/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } })
  // An empty same-origin page permits Vite imports without starting the app.
  await page.route('**/preset-artwork-generator', route => route.fulfill({
    contentType: 'text/html', body: '<html><body style="margin:0"><div id="root"></div></body></html>',
  }))
  await page.goto(`${baseUrl}/preset-artwork-generator`)
  const catalog = await page.evaluate(async () => {
    const { default: refresh } = await import('/@react-refresh')
    refresh.injectIntoGlobalHook(globalThis)
    globalThis.$RefreshReg$ = () => {}
    globalThis.$RefreshSig$ = () => type => type
    globalThis.__vite_plugin_react_preamble_installed__ = true
    const cinema = await import('/src/components/vyzualz/cinema2/index.ts')
    const headliner = await import('/src/components/vyzualz/react/headliner/HeadlinerEffectCatalog.ts')
    const types = await import('/src/components/vyzualz/react/ReactTypes.ts')
    const beams = await import('/src/components/vyzualz/react/laserDmxBeamMatrixPresets.ts')
    const shows = await import('/src/components/vyzualz/react/LaserDmxShowDirectorPerformancePresets.ts')
    const rigs = await import('/src/components/vyzualz/react/laserDmxShowDirectorTemplates.ts')
    return [
      ...cinema.cinema2NativePresetRegistry.list().filter(p => !p.metadata.tags?.includes('internal')).map(p => ({ id: p.id, kind: 'cinema' })),
      ...headliner.HEADLINER_PRESETS.map(p => ({ id: p.id, kind: 'headliner' })),
      ...types.CANVAS_VISIBLE_PRESETS.map(p => ({ id: p.id, kind: 'canvas' })),
      ...beams.LASER_DMX_BEAM_MATRIX_PRESETS.map(p => ({ id: p.id, kind: 'beam' })),
      ...shows.LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.map(p => ({ id: p.id, kind: 'show' })),
      ...rigs.LASER_DMX_SHOW_DIRECTOR_TEMPLATES.map(p => ({ id: p.id, kind: 'rig' })),
    ]
  })
  const missingOnly = process.argv.includes('--missing')
  const requested = new Set(process.argv.slice(2).filter(arg => arg !== '--missing'))
  for (const item of catalog.filter(item => !requested.size || requested.has(item.id))) {
    if (missingOnly) {
      try { await access(new URL(`${encodeURIComponent(item.id)}.webp`, output)); continue } catch { /* Generate missing entries. */ }
    }
    const result = await page.evaluate(async ({ id, kind }) => {
      const width = 480, height = 270
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
      if (kind === 'cinema') {
        const { Cinema2Runtime, Cinema2AudioIntelligenceBridge } = await import('/src/components/vyzualz/cinema2/index.ts')
        const { DEFAULT_MI_FRAME } = await import('/src/features/musicIntelligence/constants.ts')
        let index = 0
        const frame = structuredClone(DEFAULT_MI_FRAME)
        frame.sourceId = 'preset-artwork-fixture'; frame.trackId = 'preset-artwork-fixture'
        frame.capabilities = { ...frame.capabilities, liveBands: true, rhythmEvents: true, beatGrid: true, sections: true }
        frame.bands = Object.fromEntries(Object.keys(frame.bands).map(key => [key, .6]))
        frame.energy = { ...frame.energy, instant: .65, shortTerm: .65, rms: .6, peak: .8, percentile: .7 }
        frame.section = { ...frame.section, type: 'drop', confidence: 1, intensity: .8 }
        frame.rhythm = { ...frame.rhythm, bpm: 120, bpmConfidence: 1, bpmSource: 'manual' }
        const bridge = new Cinema2AudioIntelligenceBridge({
          getFrame: () => ({ ...frame, frameId: index, timeSec: 30 + index / 30,
            rhythm: { ...frame.rhythm, beatIndex: Math.floor(index / 15), beatPhase: (index % 15) / 15, beatHit: index % 15 === 0, kickHit: index % 15 === 0, kickStrength: .8, transient: .7 },
          }),
          getPublicationMeta: () => ({ sequence: index, publishedAtMs: index * 1000 / 30, publisherId: 'artwork-fixture', kind: 'frame' }),
        })
        const scene = document.createElement('canvas')
        scene.width = width; scene.height = height
        let callback = null
        const { runtime, error } = Cinema2Runtime.create(scene, {
          presetId: id, renderQuality: 'low', audioIntelligenceBridge: bridge, randomness: { mode: 'deterministic', seed: 42 },
          requestAnimationFrame: next => { callback = next; return 1 },
          cancelAnimationFrame: () => { callback = null },
        })
        if (!runtime) throw new Error(`${id}: ${error}`)
        try {
          runtime.resize({ width, height, dpr: 1 })
          runtime.start()
          // Give lazy model/texture imports time to resolve, then warm history.
          const probe = document.createElement('canvas'); probe.width = 48; probe.height = 27
          const probeContext = probe.getContext('2d')
          let bestScore = -1
          for (let frame = 0; frame < 80; frame++) {
            index = frame + 1
            await delay(20)
            const next = callback; callback = null
            next?.(frame * 1000 / 30)
            probeContext.drawImage(scene, 0, 0, 48, 27)
            const sample = probeContext.getImageData(0, 0, 48, 27).data
            const score = sample.reduce((sum, value, channel) => sum + (channel % 4 !== 3 ? value : 0), 0)
            if (frame > 8 && score > bestScore) { bestScore = score; ctx.drawImage(scene, 0, 0) }
          }
          const snapshot = runtime.getSnapshot()
          if (snapshot.phase === 'unavailable') throw new Error(snapshot.statusMessage)
        } finally { runtime.dispose() }
      } else if (kind === 'headliner' || kind === 'canvas') {
        // A neutral moving performer fixture makes camera/media effects legible.
        const source = document.createElement('canvas')
        source.width = width; source.height = height
        const picture = source.getContext('2d')
        const drawSource = frame => {
          picture.fillStyle = '#071016'; picture.fillRect(0, 0, width, height)
          picture.strokeStyle = '#23434d'; picture.lineWidth = 2
          for (let x = 0; x < width; x += 40) { picture.beginPath(); picture.moveTo(x, 0); picture.lineTo(x, height); picture.stroke() }
          for (let y = 0; y < height; y += 40) { picture.beginPath(); picture.moveTo(0, y); picture.lineTo(width, y); picture.stroke() }
          const x = width / 2 + Math.sin(frame / 12) * 35
          picture.fillStyle = '#b4cbd0'; picture.strokeStyle = '#f0fafc'
          picture.beginPath(); picture.ellipse(x, 74, 27, 34, 0, 0, Math.PI * 2); picture.fill(); picture.stroke()
          picture.beginPath(); picture.moveTo(x - 29, 112); picture.lineTo(x + 29, 112); picture.lineTo(x + 77, 257); picture.lineTo(x - 77, 257); picture.closePath(); picture.fill(); picture.stroke()
          picture.strokeStyle = '#143541'; picture.lineWidth = 4
          picture.beginPath(); picture.moveTo(x, 114); picture.lineTo(x, 255); picture.moveTo(x - 42, 178); picture.lineTo(x + 42, 178); picture.stroke()
        }
        drawSource(0)
        if (kind === 'headliner') {
          const { createHeadlinerEffectProcessor } = await import('/src/components/vyzualz/react/headliner/HeadlinerEffects.ts')
          const { resolveHeadlinerParameters } = await import('/src/components/vyzualz/react/headliner/HeadlinerEffectCatalog.ts')
          const { HEADLINER_IDLE_TIMING } = await import('/src/components/vyzualz/react/headliner/HeadlinerTiming.ts')
          const processor = createHeadlinerEffectProcessor(id)
          try {
            for (let frame = 0; frame < 36; frame++) {
              drawSource(frame)
              processor.render({ context: ctx, canvas, video: source,
                sourceRect: { sx: 0, sy: 0, sw: width, sh: height }, parameters: resolveHeadlinerParameters(id),
                timing: { ...HEADLINER_IDLE_TIMING, timeSec: frame / 30, dtSec: 1 / 30, beat: frame / 15, kick: .65, kickHit: frame % 15 === 0 },
              })
            }
          } finally { processor.dispose() }
        } else {
          const { default: React } = await import('/node_modules/.vite/deps/react.js')
          const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
          await import('/src/styles/reactView.css')
          const { CanvasEngineSurface } = await import('/src/components/vyzualz/react/ReactCanvasEngineShell.tsx')
          const { useReactStore } = await import('/src/stores/reactStore.ts')
          const host = document.getElementById('root')
          host.style.cssText = 'width:480px;height:270px;position:relative'
          useReactStore.getState().addCanvasMediaItems([{ id: 'artwork-fixture', name: 'Preview', type: 'image', objectUrl: source.toDataURL(), createdAt: '2026-01-01', width, height }])
          useReactStore.setState(state => ({ activeCanvasMediaId: 'artwork-fixture', canvasOrchestrationSettings: {
            ...state.canvasOrchestrationSettings, renderMode: 'single',
            mediaPools: [{ id: 'artwork-pool', name: 'Preview', mediaIds: ['artwork-fixture'], textItems: [{ id: 'artwork-text', text: 'PREVIEW' }] }],
            activeMediaPoolId: 'artwork-pool', mediaPoolIds: ['artwork-fixture'],
          } }))
          useReactStore.getState().selectCanvasPreset(id)
          let rendered = null
          const root = createRoot(host)
          try {
            root.render(React.createElement(CanvasEngineSurface, { isPlaying: true, isPaused: false, analysisActive: false, showRuntimeStatus: false, onCanvasReady: next => { rendered = next } }))
            await delay(1100)
            // Fractures intentionally exposes its preview surface rather than a recording output.
            rendered ??= host.querySelector('canvas.rv-canvas-fractures-renderer-layer')
            if (!rendered) throw new Error(`${id}: no CANVAS preview`)
            await new Promise(resolve => requestAnimationFrame(() => { ctx.drawImage(rendered, 0, 0, width, height); resolve() }))
          } finally { root.unmount() }
        }
      } else {
        const { default: React } = await import('/node_modules/.vite/deps/react.js')
        const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
        const art = await import('/src/components/vyzualz/react/LaserDmxPresetThumbnail.tsx')
        const host = document.getElementById('root')
        const root = createRoot(host)
        const { LASER_DMX_BEAM_MATRIX_PRESETS: beams } = await import('/src/components/vyzualz/react/laserDmxBeamMatrixPresets.ts')
        const { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS: shows } = await import('/src/components/vyzualz/react/LaserDmxShowDirectorPerformancePresets.ts')
        const { LASER_DMX_SHOW_DIRECTOR_TEMPLATES: rigs } = await import('/src/components/vyzualz/react/laserDmxShowDirectorTemplates.ts')
        try {
          root.render(kind === 'beam' ? React.createElement(art.BeamMatrixPresetThumbnail, { preset: beams.find(p => p.id === id) })
            : kind === 'show' ? React.createElement(art.ShowDirectorPerformanceThumbnail, { preset: shows.find(p => p.id === id) })
              : React.createElement(art.ShowDirectorTemplateThumbnail, { template: rigs.find(p => p.id === id) }))
          await delay(20)
          const svg = host.querySelector('svg').cloneNode(true)
          svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
          const image = new Image()
          image.src = `data:image/svg+xml;base64,${btoa(new XMLSerializer().serializeToString(svg))}`
          await image.decode()
          ctx.drawImage(image, 0, 0, width, height)
        } finally { root.unmount() }
      }
      const pixels = ctx.getImageData(0, 0, width, height).data
      const lit = pixels.reduce((sum, value, index) => sum + (index % 4 !== 3 && value > 40 ? 1 : 0), 0)
      if (lit < 100) throw new Error(`${id}: empty artwork`)
      return canvas.toDataURL('image/png').split(',')[1]
    }, item)
    await writeFile(new URL(`${encodeURIComponent(item.id)}.webp`, output), await sharp(Buffer.from(result, 'base64')).webp({ quality: 86 }).toBuffer())
    console.log(`${item.kind}: ${item.id}`)
  }
} finally { await browser.close() }
