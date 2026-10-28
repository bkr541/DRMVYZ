// Render the real Elevhate camera/module/effects through two loop boundaries.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-elevhate-loop')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false,
  plugins: [{ name: 'elevhate-loop-harness', configureServer(server) {
    server.middlewares.use('/__elevhate-loop', (_req, res) => {
      res.setHeader('Content-Type', 'text/html')
      res.end('<html><body style="margin:0;background:black"><div id="inspector" style="display:none;position:fixed;inset:0 0 0 auto;width:400px;background:#101014;overflow:auto"></div><canvas id="stage" width="640" height="640"></canvas></body></html>')
    })
  } }],
})
const errors = [], samples = [], controls = []
const musicOnly = process.argv.includes('--music')
const lifecycleOnly = process.argv.includes('--lifecycle')
const previewOnly = process.argv.includes('--preview')
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL/.test(m.text())) errors.push(m.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__elevhate-loop`)
  await page.evaluate(async () => {
    const { Cinema2Runtime } = await import('/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts')
    const { CINEMA2_ELEVHATE_PRESET_ID, elevhateParameter } = await import('/src/components/vyzualz/cinema2/presets/Cinema2ElevhatePreset.ts')
    const { AudioFeatureBus } = await import('/src/features/musicIntelligence/AudioFeatureBus.ts')
    const { nightshiftMusicFixture } = await import('/src/test/support/NightshiftMusicFixture.ts')
    const Refresh = (await import('/@react-refresh')).default
    Refresh.injectIntoGlobalHook(globalThis); globalThis.$RefreshReg$ = () => {}; globalThis.$RefreshSig$ = () => type => type; globalThis.__vite_plugin_react_preamble_installed__ = true
    await import('/src/styles.css'); await import('/src/styles/appearance.css'); await import('/src/styles/groupSpacing.css'); await import('/src/styles/reactView.css'); await import('/src/styles/typography.css')
    const ReactModule = await import('/node_modules/.vite/deps/react.js'), React = ReactModule.default ?? ReactModule
    const ClientModule = await import('/node_modules/.vite/deps/react-dom_client.js'), Client = ClientModule.default ?? ClientModule
    const { Cinema2InspectorPanel } = await import('/src/components/vyzualz/react/Cinema2InspectorPanel.tsx')
    let pending, time = 0, paused = false, enabled = false, sequence = 0, fixture = {}, bpm = 120, track = 'seam-check'
    const tick = (count = 1, repeat = false) => { for (let i = 0; i < count; i++) { time += 100; if (enabled && !repeat) {
      let frame = nightshiftMusicFixture({ energy: 0, ...fixture, timeSec: time/1000, frameId: ++sequence, trackId: track })
      frame = { ...frame, rhythm: { ...frame.rhythm, bpm } }; AudioFeatureBus.setFrame(frame)
    } pending(time) } }
    const options = {
      presetId: CINEMA2_ELEVHATE_PRESET_ID, renderQuality: 'high', diagnosticsEnabled: true,
      requestAnimationFrame: cb => { pending = cb; return 1 }, cancelAnimationFrame: () => {},
      transportSource: { getState: () => ({ sourcePresent: true, playing: !paused, analysisActive: true, paused, animationActive: !paused, trackId: track, timeSec: time / 1000, bpm, bpmSync: true }) },
    }
    const created = Cinema2Runtime.create(globalThis.document.querySelector('canvas'), options)
    if (!created.runtime) throw new Error(created.error)
    let runtime = created.runtime
    runtime.resize({ width: 640, height: 640, dpr: 1 }); runtime.start(); pending(0)
    const inspector = Client.createRoot(globalThis.document.querySelector('#inspector'))
    const refresh = () => inspector.render(React.createElement(Cinema2InspectorPanel, { runtime, surface: 'design', sharedAudioAnalysis: false }))
    globalThis.__elevhateLoop = {
      tick,
      previewFrame() { time+=1000/24;pending(time) },
      async reenter() {
        const saved = runtime.serializeParameterState()
        runtime.dispose()
        const retired = runtime.getResourceManagerSnapshot()
        const { CINEMA2_CATHEDRAL_PRESET_ID } = await import('/src/components/vyzualz/cinema2/presets/Cinema2CathedralPreset.ts')
        const other = Cinema2Runtime.create(globalThis.document.querySelector('canvas'), { ...options, presetId: CINEMA2_CATHEDRAL_PRESET_ID })
        if (!other.runtime) throw new Error(other.error)
        other.runtime.resize({ width:640,height:640,dpr:1 }); other.runtime.start(); tick(3); other.runtime.dispose()
        AudioFeatureBus.reset(); enabled=false; time=0; track='reentry'; paused=false
        const next = Cinema2Runtime.create(globalThis.document.querySelector('canvas'),options)
        if (!next.runtime) throw new Error(next.error)
        runtime=next.runtime; runtime.getParameterState().restore(saved); runtime.resize({width:640,height:640,dpr:1});runtime.start();tick(8);refresh()
        return { retired, state: runtime.getParameterState().getSnapshot() }
      },
      quality(value) { runtime.getParameterState().setPersistentValue('quality-mode',value);tick(8) },
      music(options = {}, repeat = false) { enabled = true; fixture = options; tick(1,repeat); fixture = { ...options, event: null } },
      async inspector() { globalThis.document.querySelector('#inspector').style.display = 'block'; refresh(); for(let i=0;i<4;i++) await new Promise(globalThis.requestAnimationFrame) },
      camera: () => runtime.getCameraRuntimeSnapshot().camera,
      pause(value) { paused = value; tick(5) },
      tempo(value) { bpm = value },
      resize(width,height) { runtime.resize({ width,height,dpr:1 }); tick(8) },
      seek(value, nextTrack = track) { time = value * 1000; track = nextTrack; tick(8) },
      status: () => ({ render: runtime.getRenderGraphExecutorSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), effects: runtime.getEffectRuntimeSnapshot(), resources: runtime.getResourceManagerSnapshot() }),
      advanceTo(seconds) {
        while (time < Math.round(seconds * 1000)) { time += 100; pending(time) }
        return { camera: runtime.getCameraRuntimeSnapshot().camera, render: runtime.getRenderGraphExecutorSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), effects: runtime.getEffectRuntimeSnapshot() }
      }, set(values) { for (const [name, value] of Object.entries(values)) runtime.getParameterState().setPersistentValue(elevhateParameter(name), value); tick(8); refresh() },
      dispose: () => { inspector.unmount(); runtime.dispose(); return runtime.getResourceManagerSnapshot() },
    }
  })
  if(previewOnly){
    await page.evaluate(()=>globalThis.__elevhateLoop.quality('quality'))
    const encoder=spawn('/opt/homebrew/bin/ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','24','-i','pipe:0','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-movflags','+faststart',resolve(out,'elevhate-journey.mp4')],{stdio:['pipe','inherit','inherit']})
    const completion=once(encoder,'close')
    for(let i=0;i<40*24;i++){
      await page.evaluate(()=>globalThis.__elevhateLoop.previewFrame())
      const bytes=await page.locator('canvas').screenshot({type:'jpeg',quality:85})
      if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain')
    }
    encoder.stdin.end();const [code]=await completion;if(code!==0)throw new Error('Preview encoding failed')
    await page.evaluate(()=>globalThis.__elevhateLoop.dispose());console.log('Full 40-second production journey recorded.')
  } else {
  if (!musicOnly && !lifecycleOnly) for (const seconds of [0, 2, 4, 4.5, 5, 6, 8, 12, 20, 28, 39.9, 40.2, 79.9, 80.2]) {
    const state = await page.evaluate(t => globalThis.__elevhateLoop.advanceTo(t), seconds)
    const image = await page.locator('canvas').screenshot({ path: resolve(out, `flight-${seconds}.png`) })
    const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let lit = 0
    for (let i = 0; i < data.length; i += info.channels) if (Math.max(data[i], data[i + 1], data[i + 2]) > 40) lit++
    const litFraction = lit / (info.width * info.height)
    if (litFraction < .005) throw new Error(`Dark gap at ${seconds}s: ${litFraction}`)
    if (state.render.failedPassCount || state.modules.failedModuleCount || state.effects.failedEffectCount) throw new Error(`Render failure at ${seconds}s`)
    samples.push({ seconds, camera: state.camera.position, litFraction })
  }
  const set = values => page.evaluate(v => globalThis.__elevhateLoop.set(v), values)
  const shot = async name => sharp(await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })).removeAlpha().raw().toBuffer()
  const diff = (a,b) => a.reduce((n,v,i) => n + Math.abs(v-b[i]),0) / a.length
  await set({ speed: 0, sway: 0, bloom: 0, haze: 0 })
  let baseline
  if (!musicOnly && !lifecycleOnly) {
  baseline = await shot('manual-base')
  for (const pattern of ['nested-bays','crossroads','terraced-stacks','offset-blocks','split-frames']) {
    await set({ pattern }); const pixels = await shot(pattern); const difference = diff(baseline,pixels)
    if (difference < .1) throw new Error(`Inert pattern ${pattern}: ${difference}`)
    controls.push({ pattern, difference })
  }
  await set({ pattern: 'nested-bays' }); baseline = await shot('controls-base')
  for (const [name, values] of Object.entries({ opening: [3,4,6], width: [.6,1.15,3], master: [0,1,1.5], haze: [0,.004,.05], bloom: [0,.2,1] })) {
    const pixels = []
    for (const value of values) { await set({ [name]: value }); pixels.push(await shot(`${name}-${value}`)) }
    const differences = [diff(pixels[0],pixels[1]),diff(pixels[1],pixels[2])]
    if (differences.some(v => v < .03)) throw new Error(`Inert control ${name}: ${differences}`)
    controls.push({ name, differences }); await set({ [name]: values[1] })
  }
  for (const name of ['void','body','primary','junction','secondary']) {
    baseline = await shot(`${name}-before`)
    await set({ [name]: [.7,.02,.04,1] }); const difference = diff(baseline,await shot(`${name}-red`))
    if (difference < .01) throw new Error(`Inert palette ${name}: ${difference}`)
    controls.push({ color: name, difference })
  }
  }
  await set({ void: [.001,.001,.001,1], body: [.002,.002,.002,1], primary: [1,1,1,1], junction: [1,1,1,1], secondary: [.8,.8,.8,1], bloom: 0, haze: 0, master: 1, pattern: 'nested-bays' })
  if (!lifecycleOnly) {
  const music = (options,repeat=false) => page.evaluate(v => globalThis.__elevhateLoop.music(v.options,v.repeat),{options,repeat})
  const tick = count => page.evaluate(n => globalThis.__elevhateLoop.tick(n),count)
  await music({ energy: 0 }); await tick(8); const quiet = await shot('music-quiet')
  await music({ energy: 1, bass: 1, high: 1 }); await tick(8); const energetic = await shot('music-energetic')
  controls.push({ music: 'energy-pressure-glints', difference: diff(quiet,energetic) })
  if(diff(quiet,energetic)<.1)throw new Error('Music response is visually inert')
  await set({ response: 0 }); const zero = await shot('response-zero')
  await music({ energy: 0 }); await tick(8); if(diff(zero,await shot('response-zero-quiet'))>.02)throw new Error('Music Response zero leaks')
  await set({ response: 1, patternChange: false }); await tick(8)
  await music({ event: 'kick', eventId: 1001 }); await tick(1); const kick = await shot('kick')
  await tick(10); const released = await shot('kick-released')
  if(diff(kick,released)<.1)throw new Error('Rhythmic pulse is inert')
  let triggerIndex = 0
  for(const trigger of ['beat','kick','snare','downbeat','beat2','beat4','bar','bar4','bar8','phrase','drop']) {
    await set({ pattern: 'crossgrid', patternChange: true, trigger }); await music({ energy: 0 }); await tick(15)
    const before = await shot(`trigger-${trigger}-before`)
    const event = trigger.startsWith('bar') ? 'bar' : trigger === 'beat2' || trigger === 'beat4' ? 'beat' : trigger
    await music({ energy: 0, event, beatIndex: 32 * (++triggerIndex), eventId: 2000 + triggerIndex }); await tick(15)
    const after = await shot(`trigger-${trigger}-after`), difference = diff(before,after)
    if(difference<.1)throw new Error(`Production Trigger ${trigger} is inert`)
    await tick(8); if(diff(after,await shot(`trigger-${trigger}-held`))>.03)throw new Error(`Production Trigger ${trigger} repeated`)
    controls.push({ trigger, difference })
  }
  await set({ pattern: 'crossgrid', patternChange: false, autoPerformance: true }); await music({ build: 1 }); await tick(12)
  const build = await shot('auto-build')
  await set({ pattern: 'offset-blocks' }); const manual = await shot('auto-manual-takeover')
  await tick(10); if(diff(manual,await shot('auto-manual-held'))>.03)throw new Error('Auto Performance clobbered manual pattern')
  if(diff(build,manual)<.1)throw new Error('Auto build has no structural response')
  await music({ build: 0 }); await tick(15); await music({ event: 'drop', eventId: 9001 }); await tick(3)
  const drop = await shot('auto-drop'); if(diff(drop,manual)<.1)throw new Error('Auto drop is inert')
  await tick(30); if(diff(manual,await shot('auto-restored'))>.1)throw new Error('Auto override did not restore user base')
  await set({ autoPerformance: false, pattern: 'crossgrid', speed: 1, sway: 0, response: 0 })
  await page.evaluate(()=>globalThis.__elevhateLoop.seek(0)); await page.evaluate(()=>globalThis.__elevhateLoop.tempo(60)); await set({ bpmSync: true }); await tick(30)
  const sync = await page.evaluate(()=>globalThis.__elevhateLoop.camera())
  await page.evaluate(()=>globalThis.__elevhateLoop.seek(0,'free-clock')); await set({ bpmSync: false }); await tick(30)
  const free = await page.evaluate(()=>globalThis.__elevhateLoop.camera())
  if(Math.abs(sync.position[2]-free.position[2])<3)throw new Error('BPM Sync has no camera effect')
  controls.push({ timing: '60bpm-sync-versus-free', sync: sync.position, free: free.position })
  await set({ speed: 0, sway: .2 }); await tick(15); const held = await page.evaluate(()=>globalThis.__elevhateLoop.camera())
  await tick(10); const heldAgain = await page.evaluate(()=>globalThis.__elevhateLoop.camera())
  if(Math.hypot(...held.position.map((v,i)=>v-heldAgain.position[i]))>.001)throw new Error('Travel Speed zero does not hold camera')
  await set({ speed: 1 }); await page.evaluate(()=>globalThis.__elevhateLoop.pause(true)); const paused = await shot('paused')
  await tick(10); if(diff(paused,await shot('paused-held'))>.03)throw new Error('Paused camera moves')
  await page.evaluate(()=>globalThis.__elevhateLoop.pause(false))
  await set({ speed: 0, sway: 0 })
  for(const [width,height] of [[960,540],[540,960],[640,640]]){
    await page.setViewportSize({width,height}); await page.evaluate(v=>globalThis.__elevhateLoop.resize(...v),[width,height]); await shot(`aspect-${width}-${height}`)
    const status=await page.evaluate(()=>globalThis.__elevhateLoop.status())
    if(status.render.failedPassCount||status.modules.failedModuleCount||status.effects.failedEffectCount)throw new Error('Resize render failed')
  }
  }
  await set({ speed: 0, sway: 0, pattern: 'crossgrid', response: 0, autoPerformance: false, patternChange: false, master: 1 })
  await page.evaluate(()=>globalThis.__elevhateLoop.seek(0,'reentry'))
  const beforeReentry=await shot('before-reentry')
  const reentry=await page.evaluate(()=>globalThis.__elevhateLoop.reenter())
  const afterReentry=await shot('after-reentry')
  if(diff(beforeReentry,afterReentry)>.1)throw new Error('Re-entry changed restored authored output')
  if(reentry.retired.activeLeaseCount!==0||reentry.retired.estimatedGpuMemoryBytes!==0)throw new Error('Re-entry leaked retired resources')
  controls.push({ lifecycle: 'reentry', retired: reentry.retired })
  for(const quality of ['performance','balanced','quality']){
    await page.evaluate(v=>globalThis.__elevhateLoop.quality(v),quality); await shot(`quality-${quality}`)
    const status=await page.evaluate(()=>globalThis.__elevhateLoop.status())
    if(status.render.failedPassCount||status.modules.failedModuleCount||status.effects.failedEffectCount)throw new Error(`Quality ${quality} failed`)
  }
  for(const sway of [0,.025,.2]){
    await set({speed:1,sway,bpmSync:false});await page.evaluate(()=>globalThis.__elevhateLoop.seek(0,'sway-check'));await page.evaluate(()=>globalThis.__elevhateLoop.tick(20))
    controls.push({sway,camera:await page.evaluate(()=>globalThis.__elevhateLoop.camera())});await shot(`sway-${sway}`)
  }
  await set({speed:0,sway:0})
  await page.evaluate(()=>globalThis.__elevhateLoop.inspector())
  if(await page.locator('[data-cinema2-parent-group]').count()!==4)throw new Error('Inspector canonical groups missing')
  await set({ patternChange: true })
  await page.locator('[data-cinema2-control-id="elevhate-trigger"]').getByRole('combobox').click()
  if(await page.getByRole('option').count()!==11)throw new Error('Inspector must offer exactly 11 triggers')
  const sizes=await page.getByRole('option').evaluateAll(options=>options.map(option=>globalThis.getComputedStyle(option.querySelector('.drm-dropdown__option-label')).fontSize))
  if(sizes.some(size=>size!=='11px'))throw new Error('Shared dropdown typography differs')
  await page.screenshot({path:resolve(out,'inspector-trigger.png')});await page.keyboard.press('Escape')
  if (errors.length) throw new Error(errors.join('\n'))
  const disposed = await page.evaluate(() => globalThis.__elevhateLoop.dispose())
  if(disposed.activeLeaseCount!==0||disposed.estimatedGpuMemoryBytes!==0)throw new Error('Disposal leaked resources')
  controls.push({ lifecycle: 'disposed', resources: disposed })
  await writeFile(resolve(out, lifecycleOnly ? 'lifecycle-report.json' : musicOnly ? 'music-report.json' : 'report.json'), JSON.stringify({ samples, controls, errors }, null, 2))
  console.log(JSON.stringify({ samples, controls, errors }, null, 2))
  }
} finally { await browser?.close(); await server.close() }
