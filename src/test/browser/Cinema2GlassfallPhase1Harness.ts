import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { createGlassfallPhase1Registries, GLASSFALL_PHASE1_ID, GLASSFALL_REVIEW_DEPTH_ID, GLASSFALL_REVIEW_OBLIQUE_ID } from '../../components/vyzualz/cinema2/presets/Cinema2GlassfallPhase1Preset'

const canvas = document.querySelector('canvas')!
let runtime: Cinema2Runtime, pending: FrameRequestCallback, time = 0
const tick = (count = 1) => { for (let i = 0; i < count; i++) { time += 100; pending(time) } }
const enter = () => {
  const result = Cinema2Runtime.create(canvas, {
    ...createGlassfallPhase1Registries(), presetId: GLASSFALL_PHASE1_ID,
    renderQuality: 'high', diagnosticsEnabled: true,
    requestAnimationFrame: callback => { pending = callback; return 1 }, cancelAnimationFrame() {},
    transportSource: { getState: () => ({ sourcePresent: false, playing: false, paused: false, analysisActive: false, animationActive: false, trackId: null, timeSec: time / 1000 }) },
  })
  if (!result.runtime) throw new Error(JSON.stringify(result))
  runtime = result.runtime
  runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
  runtime.start(); tick()
}
enter()
const status = () => ({ modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(), resources: runtime.getResourceManagerSnapshot() })
Object.assign(window, { glassfallStudy: {
  tick, status,
  depth(enabled: boolean) { runtime.getParameterState().setPersistentValue(GLASSFALL_REVIEW_DEPTH_ID, enabled); tick(2) },
  oblique(enabled: boolean) { runtime.getParameterState().setPersistentValue(GLASSFALL_REVIEW_OBLIQUE_ID, enabled); tick(2) },
  resize() { runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); tick(2) },
  reenter() { runtime.dispose(); const retired = runtime.getResourceManagerSnapshot(); enter(); return retired },
  dispose() { runtime.dispose(); return runtime.getResourceManagerSnapshot() },
} })
// A live review page redraws as the SVG finishes decoding; output itself is static.
setInterval(() => { if (runtime.getSnapshot().phase !== 'disposed') tick() }, 100)
addEventListener('resize', () => { runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); tick() })
