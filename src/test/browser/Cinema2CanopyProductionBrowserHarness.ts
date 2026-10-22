/** Deterministic capture surface for the real Cinema 2.0 CANOPY production path: the real runtime, registry, module, effects and Audio Feature Bus. */
import type { Cinema2ParameterId, Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { CINEMA2_CANOPY_PRESET_ID, CINEMA2_CANOPY_PRESET_MANIFEST } from '../../components/vyzualz/cinema2/presets/Cinema2CanopyPreset'
import { Cinema2PresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'

type Scenario = 'none' | 'steady' | 'bass' | 'vocal' | 'build' | 'drop'

interface CanopyProbe { latest: unknown }
interface CanopyProductionApi {
  prepare(): Promise<unknown>
  advanceTo(timeSec: number): Promise<unknown>
  advanceBy(seconds: number): Promise<unknown>
  setParameters(values: Record<string, unknown>): Promise<unknown>
  setTransport(patch: Record<string, unknown>): void
  setScenario(scenario: Scenario): void
  profile(sampleFrames?: number): Promise<unknown>
  recoverContext(): Promise<unknown>
  resize(width: number, height: number): Promise<unknown>
  probe(): unknown
  status(): unknown
}
declare global {
  interface Window { __canopyProduction?: CanopyProductionApi }
  // eslint-disable-next-line no-var
  var __CINEMA2_CANOPY_PROBE__: CanopyProbe | undefined
}

const canvasElement = document.querySelector<HTMLCanvasElement>('#canopy-production')
if (!canvasElement) throw new Error('The CANOPY production canvas is missing.')
const canvas: HTMLCanvasElement = canvasElement
const query = new URLSearchParams(location.search)
const requestedQuality = query.get('quality')
const quality: Cinema2RenderQualityLevel = requestedQuality === 'low' || requestedQuality === 'medium' ? requestedQuality : 'high'
const captureTimeSec = Math.max(0, Number(query.get('timeSec') ?? 1) || 0)
const bpm = Math.max(40, Number(query.get('bpm') ?? 120) || 120)
const dropAtSec = Number(query.get('dropAt') ?? 12)
let scenario: Scenario = (['none', 'steady', 'bass', 'vocal', 'build', 'drop'] as const).find(name => name === query.get('scenario')) ?? 'steady'
const transport = { paused: false, trackId: 'canopy-fixture-a' as string | null, timeOffsetSec: 0 }
/** The playhead a paused player holds, so a pause never lets the transport time drift away from the frozen audio frame. */
let heldTimeSec = 0
const playheadSec = () => (transport.paused ? heldTimeSec : clock.getTimestamp() / 1000 + transport.timeOffsetSec)
globalThis.__CINEMA2_CANOPY_PROBE__ = { latest: null }

let frameId = 0
let lastBeat = -1
function publish(timestampMs: number): void {
  if (scenario === 'none') return
  const timeSec = Math.max(0, timestampMs / 1000) + transport.timeOffsetSec
  const beatPosition = timeSec * bpm / 60
  const beatIndex = Math.floor(beatPosition)
  const beatInBar = beatIndex % 4
  const beatChanged = beatIndex !== lastBeat && !transport.paused
  lastBeat = beatIndex
  frameId += 1
  const bass = scenario === 'bass' ? 0.95 : 0.7
  const build = scenario === 'build' ? Math.min(1, timeSec / 10) : scenario === 'drop' ? (timeSec < dropAtSec ? Math.min(1, timeSec / dropAtSec) : 0) : 0
  const dropped = scenario === 'drop' && timeSec >= dropAtSec
  AudioFeatureBus.setFrame({
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId,
    sourceId: transport.trackId ?? 'none',
    trackId: transport.trackId,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: scenario === 'bass' ? 0.9 : 0.5, bass, lowMid: 0.4, mid: scenario === 'bass' ? 0.25 : 0.55, high: scenario === 'bass' ? 0.2 : 0.5, air: 0.3, volume: 0.65,
      normalizedSub: scenario === 'bass' ? 0.9 : 0.5, normalizedBass: bass, normalizedLowMid: 0.4, normalizedMid: scenario === 'bass' ? 0.25 : 0.55, normalizedHigh: scenario === 'bass' ? 0.2 : 0.5, normalizedAir: 0.3,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm, bpmConfidence: 0.96, bpmSource: 'offline_analysis',
      beatPhase: beatPosition - beatIndex, beatHit: beatChanged, beatIndex, beatEventId: beatIndex, beatEventTimeSec: beatIndex * 60 / bpm,
      beatInBar, barIndex: Math.floor(beatIndex / 4), downbeatHit: beatChanged && beatInBar === 0,
      phrase4Progress: (beatIndex % 4 + beatPosition - beatIndex) / 4, phrase8Progress: (beatIndex % 8 + beatPosition - beatIndex) / 8,
      phrase16Progress: (beatIndex % 16 + beatPosition - beatIndex) / 16, phrase32Progress: (beatIndex % 32 + beatPosition - beatIndex) / 32,
      phrase4Hit: beatChanged && beatIndex > 0 && beatIndex % 4 === 0, phrase8Hit: beatChanged && beatIndex > 0 && beatIndex % 8 === 0,
      phrase16Hit: beatChanged && beatIndex > 0 && beatIndex % 16 === 0, phrase32Hit: beatChanged && beatIndex > 0 && beatIndex % 32 === 0,
      kickHit: beatChanged && beatInBar % 2 === 0, kickStrength: beatChanged && beatInBar % 2 === 0 ? 0.94 : 0,
      snareHit: beatChanged && beatInBar % 2 === 1, snareStrength: beatChanged && beatInBar % 2 === 1 ? 0.82 : 0,
      transient: beatChanged ? 0.7 : 0.1, transientConfidence: 0.9,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: scenario === 'bass' ? 0.85 : 0.6, shortTerm: 0.62, longTerm: 0.58, peak: 0.9, rms: 0.62, spectralFlux: beatChanged ? 0.7 : 0.15,
      buildProgress: build, tension: build * 0.8, complexity: 0.5, dropImpact: dropped && timeSec < dropAtSec + 0.4 ? 1 : 0,
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocals: scenario === 'vocal' ? 0.9 : 0, vocalEnergy: scenario === 'vocal' ? 0.9 : 0, vocalActivity: scenario === 'vocal' ? 0.9 : 0 },
    lyrics: { ...DEFAULT_MI_FRAME.lyrics, vocalActivity: scenario === 'vocal' ? 0.9 : 0 },
    section: { ...DEFAULT_MI_FRAME.section, type: build > 0.05 ? 'build' : null, label: build > 0.05 ? 'Build' : '', startSec: 0, endSec: dropAtSec, progress: build, intensity: 0.7, confidence: 0.9, source: 'analysis' },
    semantics: { ...DEFAULT_MI_FRAME.semantics, buildConfidence: build > 0.05 ? 0.9 : 0.1, dropConfidence: dropped ? 0.95 : 0 },
    semanticMoments: scenario === 'drop' ? [{ id: 'canopy-fixture-drop', timeSec: dropAtSec, type: 'drop', confidence: 0.95, source: 'structural_analysis' }] : [],
    capabilities: { liveBands: true, rhythmEvents: true, beatGrid: true, sections: true, trackEnergyCurve: true, stemCurves: scenario === 'vocal', lyrics: false },
    analysisCapabilities: { reliableBeatGrid: true, reliableDownbeatGrid: true, barAwareSections: true, selfSimilarityAnalysis: false, semanticClassification: false, phraseHierarchy: false, semanticMoments: scenario === 'drop', legacyFallbackOnly: false },
    analysisSource: 'bar_self_similarity',
    analysisRevision: 'canopy-browser-v1',
    timelineRevision: 'canopy-browser-timeline-v1',
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.92, rhythm: 0.96, section: 0.9 },
  }, 'canopy-production-harness')
}

interface ControlledFrameClock {
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
  setTargetTimestamp(timestampMs: number): void
  getTimestamp(): number
}
function controlledClock(beforeFrame: (timestampMs: number) => void): ControlledFrameClock {
  let timestampMs = 0
  let targetTimestampMs = 0
  return {
    requestAnimationFrame(callback) {
      return window.requestAnimationFrame(() => {
        // The visual clock advances by at most one sixtieth per frame, so every capture is the same frame count whatever the machine's speed.
        timestampMs = Math.min(targetTimestampMs, timestampMs + 1000 / 60)
        beforeFrame(timestampMs)
        callback(timestampMs)
      })
    },
    cancelAnimationFrame: id => window.cancelAnimationFrame(id),
    setTargetTimestamp: value => { targetTimestampMs = Math.max(timestampMs, value) },
    getTimestamp: () => timestampMs,
  }
}

AudioFeatureBus.reset()
publish(0)
const clock = controlledClock(timestampMs => { if (!transport.paused) publish(timestampMs) })
// Development-only framing study: `cam=px,py,pz,tx,ty,tz,fov[,minAspect]` replaces the authored camera in a copy of the production manifest.
let presetRegistry: Cinema2PresetRegistry | undefined
const cam = import.meta.env.DEV ? query.get('cam')?.split(',').map(Number) : undefined
if (cam && cam.length >= 7 && cam.every(Number.isFinite)) {
  presetRegistry = new Cinema2PresetRegistry()
  const [px, py, pz, tx, ty, tz, fov, minAspect] = cam as [number, number, number, number, number, number, number, number | undefined]
  const source = CINEMA2_CANOPY_PRESET_MANIFEST
  const registered = presetRegistry.register({
    ...source,
    cameras: source.cameras!.map(camera => ({ ...camera, fovDegrees: fov, ...(minAspect ? { minAspect } : {}), transform: { position: [px, py, pz] as const }, target: [tx, ty, tz] as const })),
  })
  if (!registered.ok) throw new Error(`CANOPY camera study manifest was rejected: ${registered.diagnostics.map(item => item.message).join('; ')}`)
}
const created = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_CANOPY_PRESET_ID,
  ...(presetRegistry ? { presetRegistry } : {}),
  renderQuality: quality,
  requestAnimationFrame: clock.requestAnimationFrame,
  cancelAnimationFrame: clock.cancelAnimationFrame,
  diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'canopy-production' },
  transportSource: {
    getState: () => ({
      sourcePresent: scenario !== 'none',
      playing: scenario !== 'none' && !transport.paused,
      analysisActive: scenario !== 'none' && !transport.paused,
      paused: transport.paused,
      trackId: scenario === 'none' ? null : transport.trackId,
      timeSec: playheadSec(),
      bpmSync: true,
      bpm,
    }),
  },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime

function applyParameters(values: Record<string, unknown>): void {
  const state = runtime.getParameterState()
  for (const [parameterId, value] of Object.entries(values)) {
    const result = state.setPersistentValue(parameterId as Cinema2ParameterId, value as never)
    if (!result.ok) throw new Error(`CANOPY capture could not set ${parameterId}: ${result.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
  }
}
const requestedParameters = query.get('params')
if (requestedParameters) applyParameters(JSON.parse(requestedParameters) as Record<string, unknown>)

runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
runtime.start()

let prepared = false
let pending: Promise<unknown> | null = null
const browserFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
async function settleFrames(count: number): Promise<void> {
  const target = runtime.getSnapshot().frameCount + Math.max(1, Math.round(count))
  while (runtime.getSnapshot().frameCount < target) await browserFrame()
}

function status() {
  return Object.freeze({
    prepared, quality, scenario, bpm,
    viewport: Object.freeze({ width: innerWidth, height: innerHeight }),
    controlledTimestampMs: clock.getTimestamp(),
    visualElapsedTimeSec: runtime.getVisualElapsedTimeSec(),
    snapshot: runtime.getSnapshot(),
    modules: runtime.getModuleRuntimeSnapshot(),
    effects: runtime.getEffectRuntimeSnapshot(),
    performance: runtime.getPerformanceSnapshot(),
    camera: runtime.getCameraRuntimeSnapshot().camera,
  })
}

/**
 * Runs the controlled clock forward by `seconds` of frames (60 per second). The runtime's visual clock only runs while audio does, so the
 * controlled timestamp and visual time diverge across a pause or with no track; every wait is therefore relative, never an absolute timestamp.
 */
async function runFor(seconds: number): Promise<void> {
  if (seconds <= 0) return
  clock.setTargetTimestamp(clock.getTimestamp() + seconds * 1000)
  await settleFrames(Math.max(1, Math.round(seconds * 60)))
}

async function runUntil(timeSec: number): Promise<void> {
  const visual = () => runtime.getVisualElapsedTimeSec()
  if (scenario === 'none' || transport.paused) { await runFor(scenario === 'none' ? timeSec : timeSec - visual()); return }
  clock.setTargetTimestamp(clock.getTimestamp() + Math.max(0, timeSec - visual()) * 1000)
  while (visual() < timeSec - 1e-6) await browserFrame()
}

async function advanceBy(seconds: number): Promise<unknown> {
  await runFor(seconds)
  return status()
}

async function advanceTo(timeSec: number): Promise<unknown> {
  await runUntil(timeSec)
  await settleFrames(2)
  return status()
}

async function prepare(): Promise<unknown> {
  if (pending) return pending
  pending = (async () => {
    let resident = false
    for (let attempt = 0; attempt < 360; attempt += 1) {
      await browserFrame()
      const modules = runtime.getModuleRuntimeSnapshot()
      if (modules.failedModuleCount > 0) throw new Error(`The CANOPY native module failed during preparation: ${JSON.stringify(modules)}`)
      if (modules.activeModuleCount > 0 && modules.estimatedGpuBytes > 0) { resident = true; break }
    }
    if (!resident) throw new Error('CANOPY did not become GPU-resident within the capture timeout.')
    await runUntil(captureTimeSec)
    await settleFrames(4)
    prepared = true
    return status()
  })()
  return pending
}

const api: CanopyProductionApi = {
  prepare,
  advanceTo,
  advanceBy,
  async setParameters(values) { applyParameters(values); await settleFrames(3); return status() },
  setTransport(patch) {
    const wasPaused = transport.paused
    if (patch.paused === true && !wasPaused) heldTimeSec = playheadSec()
    Object.assign(transport, patch)
    // Resuming continues from the held playhead, however long the pause lasted.
    if (wasPaused && patch.paused === false) transport.timeOffsetSec = heldTimeSec - clock.getTimestamp() / 1000
  },
  setScenario(next) { scenario = next },
  async profile(sampleFrames = 120) {
    await prepare()
    const count = Math.min(600, Math.max(30, Math.round(sampleFrames)))
    const started = performance.now()
    await settleFrames(count)
    const elapsedMs = performance.now() - started
    return Object.freeze({ sampleFrames: count, elapsedMs, wallFrameTimeAverageMs: elapsedMs / count, runtime: status() })
  },
  async resize(width, height) {
    await prepare()
    runtime.resize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), dpr: 1 })
    await settleFrames(12)
    return status()
  },
  async recoverContext() {
    await prepare()
    const gl = canvas.getContext('webgl2')
    const extension = gl?.getExtension('WEBGL_lose_context')
    if (!extension) throw new Error('WEBGL_lose_context is unavailable; CANOPY recovery was not exercised.')
    const generation = runtime.getSnapshot().contextGeneration
    extension.loseContext()
    for (let attempt = 0; attempt < 180 && runtime.getSnapshot().phase !== 'context-lost'; attempt += 1) await browserFrame()
    extension.restoreContext()
    for (let attempt = 0; attempt < 360; attempt += 1) {
      await browserFrame()
      const snapshot = runtime.getSnapshot()
      const modules = runtime.getModuleRuntimeSnapshot()
      if (modules.failedModuleCount > 0) throw new Error('CANOPY module failed after WebGL context recovery.')
      if (snapshot.phase === 'running' && snapshot.contextGeneration > generation && modules.estimatedGpuBytes > 0) { await settleFrames(12); return status() }
    }
    throw new Error('CANOPY did not recover its GPU resources after WebGL context restoration.')
  },
  probe: () => globalThis.__CINEMA2_CANOPY_PROBE__?.latest ?? null,
  status,
}
window.__canopyProduction = Object.freeze(api)
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
