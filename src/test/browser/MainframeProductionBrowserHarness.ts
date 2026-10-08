/** Deterministic capture surface for the real Cinema 2.0 Mainframe production path. */
import type { Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { CINEMA2_MAINFRAME_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2MainframePreset'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'

interface ControlledFrameClock {
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
  setTargetTimestamp(timestampMs: number): void
  getTimestamp(): number
}

interface MainframeProductionApi {
  prepare(): Promise<unknown>
  status(): unknown
}

declare global {
  interface Window {
    __mainframeProduction?: MainframeProductionApi
  }
}

function controlledClock(): ControlledFrameClock {
  let timestampMs = 0
  let targetTimestampMs = 0
  return {
    requestAnimationFrame(callback) {
      return window.requestAnimationFrame(() => {
        timestampMs = Math.min(targetTimestampMs, timestampMs + 100)
        callback(timestampMs)
      })
    },
    cancelAnimationFrame: id => window.cancelAnimationFrame(id),
    setTargetTimestamp: value => { targetTimestampMs = Math.max(timestampMs, value) },
    getTimestamp: () => timestampMs,
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#mainframe-production')
if (!canvas) throw new Error('The Mainframe production canvas is missing.')
const query = new URLSearchParams(location.search)
const requestedQuality = query.get('quality')
const quality: Cinema2RenderQualityLevel = requestedQuality === 'low' || requestedQuality === 'medium' ? requestedQuality : 'high'
const requestedTimeSec = Number(query.get('timeSec') ?? 1)
const captureTimeSec = Number.isFinite(requestedTimeSec) ? Math.max(0, requestedTimeSec) : 1
const clock = controlledClock()
const created = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_MAINFRAME_PRESET_ID,
  renderQuality: quality,
  requestAnimationFrame: clock.requestAnimationFrame,
  cancelAnimationFrame: clock.cancelAnimationFrame,
  diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'mainframe-stage-3' },
  transportSource: {
    getState: () => ({
      sourcePresent: true,
      playing: true,
      analysisActive: true,
      paused: false,
      trackId: 'mainframe-stage-3-static',
      timeSec: clock.getTimestamp() / 1000,
    }),
  },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime

const requestedParameters = query.get('params')
if (requestedParameters) {
  const state = runtime.getParameterState()
  for (const [parameterId, value] of Object.entries(JSON.parse(requestedParameters) as Record<string, unknown>)) {
    const result = state.setPersistentValue(parameterId as Parameters<typeof state.setPersistentValue>[0], value)
    if (!result.ok) throw new Error(`Mainframe capture could not set ${parameterId}: ${result.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
  }
}

runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
runtime.start()

let prepared = false
let pending: Promise<unknown> | null = null
const browserFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

function status() {
  return Object.freeze({
    prepared,
    quality,
    viewport: Object.freeze({ width: innerWidth, height: innerHeight }),
    controlledTimestampMs: clock.getTimestamp(),
    snapshot: runtime.getSnapshot(),
    modules: runtime.getModuleRuntimeSnapshot(),
    effects: runtime.getEffectRuntimeSnapshot(),
    performance: runtime.getPerformanceSnapshot(),
    camera: runtime.getCameraRuntimeSnapshot().camera,
  })
}

async function prepare(): Promise<unknown> {
  if (pending) return pending
  pending = (async () => {
    let resident = false
    for (let attempt = 0; attempt < 360; attempt += 1) {
      await browserFrame()
      const modules = runtime.getModuleRuntimeSnapshot()
      if (modules.failedModuleCount > 0) throw new Error('The Mainframe native module failed during production-path preparation.')
      if (modules.activeModuleCount > 0 && modules.estimatedGpuBytes > 0) { resident = true; break }
    }
    if (!resident) throw new Error('The Mainframe model did not become GPU-resident within the capture timeout.')
    clock.setTargetTimestamp(captureTimeSec * 1000)
    while (runtime.getVisualElapsedTimeSec() < captureTimeSec - 1e-6) await browserFrame()
    const settleFrame = runtime.getSnapshot().frameCount + 30
    while (runtime.getSnapshot().frameCount < settleFrame) await browserFrame()
    if (runtime.getPerformanceSnapshot().resolvedQuality !== quality) throw new Error(`Expected ${quality} quality.`)
    prepared = true
    return status()
  })()
  return pending
}

window.__mainframeProduction = Object.freeze({ prepare, status })
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
