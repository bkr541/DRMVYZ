/** Development-only, deterministic ATL HOE capture surface. */
import type { Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import {
  CINEMA2_ATL_HOE_PRESET_ID,
} from '../../components/vyzualz/cinema2/presets/Cinema2AtlHoePreset'
import {
  CINEMA2_ATL_HOE_CAPTURE_TIME_SEC,
  CINEMA2_ATL_HOE_RANDOM_SEED,
  createCinema2AtlHoeVisualAcceptanceMetadata,
} from './Cinema2AtlHoeVisualAcceptanceConfig'

interface AtlHoeControlledFrameClock {
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
  setTargetTimestamp(timestampMs: number): void
  getTimestamp(): number
}

interface AtlHoeCaptureApi {
  checkpoint: string
  quality: Cinema2RenderQualityLevel
  prepare(): Promise<unknown>
  status(): unknown
  setReferenceOverlay(source: string | null, opacity?: number): Promise<void>
}

declare global {
  interface Window {
    __cinema2AtlHoeVisualAcceptance?: AtlHoeCaptureApi
  }
}

function createControlledFrameClock(): AtlHoeControlledFrameClock {
  let timestampMs = 0
  let targetTimestampMs = 0
  return {
    requestAnimationFrame(callback) {
      return window.requestAnimationFrame(() => {
        timestampMs = Math.min(targetTimestampMs, timestampMs + 100)
        callback(timestampMs)
      })
    },
    cancelAnimationFrame(id) {
      window.cancelAnimationFrame(id)
    },
    setTargetTimestamp(nextTimestampMs) {
      targetTimestampMs = Math.max(timestampMs, nextTimestampMs)
    },
    getTimestamp() {
      return timestampMs
    },
  }
}

function waitForBrowserFrame(): Promise<void> {
  return new Promise(resolve => window.requestAnimationFrame(() => resolve()))
}

function requireElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector)
  if (!element) throw new Error(`The ATL HOE visual-acceptance surface is missing ${selector}.`)
  return element
}

const query = new URLSearchParams(location.search)
const checkpoint = query.get('checkpoint')?.trim() || 'before-primary-16x9-high'
const requestedQuality = query.get('quality')
const quality: Cinema2RenderQualityLevel = requestedQuality === 'low' || requestedQuality === 'medium'
  ? requestedQuality
  : 'high'
const canvas = requireElement<HTMLCanvasElement>('#atl-hoe-capture')
const referenceOverlay = requireElement<HTMLImageElement>('#atl-hoe-reference-overlay')

const frameClock = createControlledFrameClock()
const created = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_ATL_HOE_PRESET_ID,
  renderQuality: quality,
  requestAnimationFrame: frameClock.requestAnimationFrame,
  cancelAnimationFrame: frameClock.cancelAnimationFrame,
  diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: CINEMA2_ATL_HOE_RANDOM_SEED },
  transportSource: {
    getState: () => ({
      sourcePresent: true,
      playing: true,
      // The visual clock advances only while analysis is active. ATL HOE has
      // no choreography, so this enables fixed-time rendering without adding
      // any audio-driven state to the captured preset.
      analysisActive: true,
      paused: false,
      trackId: 'atl-hoe-visual-acceptance',
      timeSec: CINEMA2_ATL_HOE_CAPTURE_TIME_SEC,
    }),
  },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime
// Development-only: `?params={"<parameter id>": value}` sets Design-tab values before the first frame, so a capture can show a palette
// colour or a pattern without touching the preset's authored defaults.
const requestedParameters = query.get('params')
if (requestedParameters) {
  const parameterState = runtime.getParameterState()
  for (const [parameterId, value] of Object.entries(JSON.parse(requestedParameters) as Record<string, unknown>)) {
    const result = parameterState.setPersistentValue(parameterId as Parameters<typeof parameterState.setPersistentValue>[0], value)
    if (!result.ok) throw new Error(`ATL HOE capture could not set ${parameterId}: ${result.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
  }
}
runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
runtime.start()

let prepared = false
let preparePromise: Promise<unknown> | null = null

function status() {
  const authored = createCinema2AtlHoeVisualAcceptanceMetadata({
    checkpoint,
    viewport: { width: innerWidth, height: innerHeight },
    quality,
  })
  return Object.freeze({
    ...authored,
    prepared,
    runtime: Object.freeze({
      snapshot: runtime.getSnapshot(),
      visualTimeSec: runtime.getVisualElapsedTimeSec(),
      camera: runtime.getCameraRuntimeSnapshot().camera,
      modules: runtime.getModuleRuntimeSnapshot(),
      effects: runtime.getEffectRuntimeSnapshot(),
      performance: runtime.getPerformanceSnapshot(),
      controlledTimestampMs: frameClock.getTimestamp(),
    }),
  })
}

async function prepare(): Promise<unknown> {
  if (preparePromise) return preparePromise
  preparePromise = (async () => {
    // Asset loading is asynchronous. The controlled clock remains at t=0
    // while real browser frames present, so load duration cannot alter the
    // captured effect/camera time or leave WebGL outside the compositor.
    let modelReady = false
    for (let attempt = 0; attempt < 360; attempt += 1) {
      await waitForBrowserFrame()
      const modules = runtime.getModuleRuntimeSnapshot()
      if (modules.failedModuleCount > 0) throw new Error('ATL HOE 3D module failed while preparing the visual baseline.')
      if (modules.activeModuleCount > 0 && modules.estimatedGpuBytes > 0) {
        modelReady = true
        break
      }
    }
    if (!modelReady) throw new Error('ATL HOE model did not become GPU-resident within the capture timeout.')

    // Cinema 2.0 caps deltas at 100 ms; the clock advances by that exact step
    // on presented browser frames, lands at two seconds, and then stays fixed.
    frameClock.setTargetTimestamp(CINEMA2_ATL_HOE_CAPTURE_TIME_SEC * 1000)
    while (runtime.getVisualElapsedTimeSec() < CINEMA2_ATL_HOE_CAPTURE_TIME_SEC - 1e-6) {
      await waitForBrowserFrame()
    }
    const settleUntilFrame = runtime.getSnapshot().frameCount + 24
    while (runtime.getSnapshot().frameCount < settleUntilFrame) await waitForBrowserFrame()

    const performance = runtime.getPerformanceSnapshot()
    if (performance.resolvedQuality !== quality) {
      throw new Error(`ATL HOE capture expected ${quality} quality, received ${performance.resolvedQuality}.`)
    }
    const visualTimeSec = runtime.getVisualElapsedTimeSec()
    if (Math.abs(visualTimeSec - CINEMA2_ATL_HOE_CAPTURE_TIME_SEC) > 1e-6) {
      throw new Error(`ATL HOE capture clock drifted to ${visualTimeSec.toFixed(6)} seconds.`)
    }
    prepared = true
    return status()
  })()
  return preparePromise
}

async function setReferenceOverlay(source: string | null, opacity = 0.5): Promise<void> {
  if (!import.meta.env.DEV) throw new Error('The ATL HOE reference overlay is available only in development.')
  if (!source) {
    referenceOverlay.hidden = true
    referenceOverlay.removeAttribute('src')
    return
  }
  referenceOverlay.style.opacity = String(Math.min(1, Math.max(0, opacity)))
  referenceOverlay.hidden = false
  await new Promise<void>((resolve, reject) => {
    referenceOverlay.onload = () => resolve()
    referenceOverlay.onerror = () => reject(new Error('The supplied ATL HOE reference overlay could not be decoded.'))
    referenceOverlay.src = source
  })
}

window.__cinema2AtlHoeVisualAcceptance = Object.freeze({ checkpoint, quality, prepare, status, setReferenceOverlay })
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
