/** Deterministic capture surface for the real Cinema 2.0 Mainframe production path. */
import type { Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { CINEMA2_MAINFRAME_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2MainframePreset'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'

interface ControlledFrameClock {
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
  setTargetTimestamp(timestampMs: number): void
  getTimestamp(): number
}

interface MainframeProductionApi {
  prepare(): Promise<unknown>
  profile(sampleFrames?: number): Promise<unknown>
  recoverContext(): Promise<unknown>
  resize(width: number, height: number): Promise<unknown>
  status(): unknown
}

declare global {
  interface Window {
    __mainframeProduction?: MainframeProductionApi
  }
}

function controlledClock(beforeFrame?: (timestampMs: number) => void): ControlledFrameClock {
  let timestampMs = 0
  let targetTimestampMs = 0
  return {
    requestAnimationFrame(callback) {
      return window.requestAnimationFrame(() => {
        timestampMs = Math.min(targetTimestampMs, timestampMs + 100)
        beforeFrame?.(timestampMs)
        callback(timestampMs)
      })
    },
    cancelAnimationFrame: id => window.cancelAnimationFrame(id),
    setTargetTimestamp: value => { targetTimestampMs = Math.max(timestampMs, value) },
    getTimestamp: () => timestampMs,
  }
}

const canvasElement = document.querySelector<HTMLCanvasElement>('#mainframe-production')
if (!canvasElement) throw new Error('The Mainframe production canvas is missing.')
const canvas: HTMLCanvasElement = canvasElement
const query = new URLSearchParams(location.search)
const requestedQuality = query.get('quality')
const quality: Cinema2RenderQualityLevel = requestedQuality === 'low' || requestedQuality === 'medium' ? requestedQuality : 'high'
const requestedTimeSec = Number(query.get('timeSec') ?? 1)
const captureTimeSec = Number.isFinite(requestedTimeSec) ? Math.max(0, requestedTimeSec) : 1
// Diagnostic capture deliberately runs with no track and no audio analysis.
const noAudio = import.meta.env.DEV && query.get('mainframeNoAudio') === '1'
let publishedAudioFrameId = 0
let publishedBeatIndex = -1
const publishMainframeAudioFrame = (timestampMs: number) => {
  const timeSec = Math.max(0, timestampMs / 1000)
  const beatPosition = timeSec * 2
  const beatIndex = Math.floor(beatPosition)
  const beatInBar = beatIndex % 4
  const beatChanged = beatIndex !== publishedBeatIndex
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * Math.PI * 4)
  publishedBeatIndex = beatIndex
  publishedAudioFrameId += 1
  AudioFeatureBus.setFrame({
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: publishedAudioFrameId,
    sourceId: 'mainframe-stage-3-static',
    trackId: 'mainframe-stage-3-static',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.56, bass: 0.72, lowMid: 0.48, mid: 0.6, high: 0.52, air: 0.38, volume: 0.68,
      normalizedSub: 0.56, normalizedBass: 0.72, normalizedLowMid: 0.48,
      normalizedMid: 0.6, normalizedHigh: 0.52, normalizedAir: 0.38,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.96,
      bpmSource: 'offline_analysis',
      beatPhase: beatPosition - beatIndex,
      beatHit: beatChanged,
      beatIndex,
      beatEventId: beatIndex,
      beatEventTimeSec: beatIndex / 2,
      beatInBar,
      barIndex: Math.floor(beatIndex / 4),
      downbeatHit: beatChanged && beatInBar === 0,
      phrase4Progress: (beatIndex % 4 + beatPosition - beatIndex) / 4,
      phrase8Progress: (beatIndex % 8 + beatPosition - beatIndex) / 8,
      phrase16Progress: (beatIndex % 16 + beatPosition - beatIndex) / 16,
      phrase32Progress: (beatIndex % 32 + beatPosition - beatIndex) / 32,
      phrase4Hit: beatChanged && beatIndex > 0 && beatIndex % 4 === 0,
      phrase8Hit: beatChanged && beatIndex > 0 && beatIndex % 8 === 0,
      phrase16Hit: beatChanged && beatIndex > 0 && beatIndex % 16 === 0,
      phrase32Hit: beatChanged && beatIndex > 0 && beatIndex % 32 === 0,
      kickHit: beatChanged && beatInBar % 2 === 0,
      kickStrength: beatChanged && beatInBar % 2 === 0 ? 0.94 : 0,
      snareHit: beatChanged && beatInBar % 2 === 1,
      snareStrength: beatChanged && beatInBar % 2 === 1 ? 0.82 : 0,
      transient: beatChanged ? 0.76 : 0.12 * pulse,
      transientConfidence: 0.91,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.62 + 0.2 * pulse,
      shortTerm: 0.66,
      longTerm: 0.58,
      peak: 0.9,
      rms: 0.64,
      spectralFlux: beatChanged ? 0.78 : 0.18,
      buildProgress: 0.68,
      tension: 0.62,
      complexity: 0.56,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: 'buildup',
      label: 'Buildup',
      startSec: 0,
      endSec: 8,
      progress: Math.min(1, timeSec / 8),
      intensity: 0.72,
      confidence: 0.9,
      source: 'analysis',
    },
    semantics: { ...DEFAULT_MI_FRAME.semantics, buildConfidence: 0.9 },
    capabilities: {
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: false,
      lyrics: false,
    },
    analysisSource: 'bar_self_similarity',
    analysisRevision: 'mainframe-browser-reactivity-v1',
    timelineRevision: 'mainframe-browser-timeline-v1',
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.92, rhythm: 0.96, section: 0.9 },
  }, 'mainframe-production-harness')
}
AudioFeatureBus.reset()
if (!noAudio) publishMainframeAudioFrame(0)
const clock = controlledClock(timestampMs => {
  if (!noAudio) publishMainframeAudioFrame(timestampMs)
})
const created = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_MAINFRAME_PRESET_ID,
  renderQuality: quality,
  requestAnimationFrame: clock.requestAnimationFrame,
  cancelAnimationFrame: clock.cancelAnimationFrame,
  diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'mainframe-stage-3' },
  transportSource: {
    getState: () => ({
      sourcePresent: !noAudio,
      playing: !noAudio,
      analysisActive: !noAudio,
      paused: false,
      trackId: noAudio ? null : 'mainframe-stage-3-static',
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

async function settleFrames(count: number): Promise<void> {
  const target = runtime.getSnapshot().frameCount + Math.max(1, Math.round(count))
  while (runtime.getSnapshot().frameCount < target) await browserFrame()
}

function assetFailureMessage(): string | null {
  const diagnostic = runtime.getModuleRuntimeSnapshot().modules
    .flatMap(module => module.diagnostics)
    .find(entry => entry.code === 'CINEMA2_MAINFRAME_ASSET_LOAD_FAILED')
  return diagnostic?.message ?? null
}

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
      const assetFailure = assetFailureMessage()
      if (assetFailure) throw new Error(assetFailure)
      if (modules.activeModuleCount > 0 && modules.estimatedGpuBytes > 0) { resident = true; break }
    }
    if (!resident) throw new Error('The Mainframe model did not become GPU-resident within the capture timeout.')
    clock.setTargetTimestamp(captureTimeSec * 1000)
    while (runtime.getVisualElapsedTimeSec() < captureTimeSec - 1e-6) await browserFrame()
    await settleFrames(30)
    if (runtime.getPerformanceSnapshot().resolvedQuality !== quality) throw new Error(`Expected ${quality} quality.`)
    prepared = true
    return status()
  })()
  return pending
}

async function profile(sampleFrames = 120): Promise<unknown> {
  await prepare()
  const count = Math.min(600, Math.max(30, Math.round(sampleFrames)))
  const started = performance.now()
  await settleFrames(count)
  const elapsedMs = performance.now() - started
  return Object.freeze({
    sampleFrames: count,
    elapsedMs,
    wallFrameTimeAverageMs: elapsedMs / count,
    runtime: status(),
  })
}

async function resize(width: number, height: number): Promise<unknown> {
  await prepare()
  runtime.resize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), dpr: 1 })
  await settleFrames(24)
  const snapshot = runtime.getSnapshot()
  if (snapshot.phase !== 'running' || runtime.getModuleRuntimeSnapshot().failedModuleCount > 0) throw new Error('Mainframe failed to render after resize.')
  return status()
}

async function recoverContext(): Promise<unknown> {
  await prepare()
  const gl = canvas.getContext('webgl2')
  const extension = gl?.getExtension('WEBGL_lose_context')
  if (!extension) throw new Error('WEBGL_lose_context is unavailable; Mainframe recovery was not exercised.')
  const generation = runtime.getSnapshot().contextGeneration
  extension.loseContext()
  for (let attempt = 0; attempt < 180 && runtime.getSnapshot().phase !== 'context-lost'; attempt += 1) await browserFrame()
  if (runtime.getSnapshot().phase !== 'context-lost') throw new Error('Mainframe did not enter the context-lost phase.')
  extension.restoreContext()
  for (let attempt = 0; attempt < 360; attempt += 1) {
    await browserFrame()
    const snapshot = runtime.getSnapshot()
    const modules = runtime.getModuleRuntimeSnapshot()
    const assetFailure = assetFailureMessage()
    if (assetFailure) throw new Error(assetFailure)
    if (modules.failedModuleCount > 0) throw new Error('Mainframe module failed after WebGL context recovery.')
    if (snapshot.phase === 'running' && snapshot.contextGeneration > generation && modules.estimatedGpuBytes > 0) {
      await settleFrames(30)
      if (runtime.getSnapshot().phase !== 'running') throw new Error('Mainframe did not present a frame after WebGL context recovery.')
      return status()
    }
  }
  throw new Error('Mainframe did not recover its GPU resources after WebGL context restoration.')
}

window.__mainframeProduction = Object.freeze({ prepare, profile, recoverContext, resize, status })
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
