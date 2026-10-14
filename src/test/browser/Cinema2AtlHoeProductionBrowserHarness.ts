/** Production acceptance surface for ATL HOE's real Cinema 2.0 runtime path. */
import type { Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_ATL_HOE_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2AtlHoePreset'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import type { ReactSectionType } from '../../components/vyzualz/react/ReactTypes'

interface ProductionApi {
  prepare(): Promise<unknown>
  profile(sampleFrames?: number): Promise<unknown>
  resize(width: number, height: number): Promise<unknown>
  recoverContext(): Promise<unknown>
  pause(): Promise<unknown>
  resume(): Promise<unknown>
  seek(timeSec: number): Promise<unknown>
  replaceTrack(trackId: string): Promise<unknown>
  status(): unknown
}

declare global { interface Window { __atlHoeProduction?: ProductionApi } }

const clamp = (value: number, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum))
const query = new URLSearchParams(location.search)
const requestedQuality = query.get('quality')
const quality: Cinema2RenderQualityLevel = requestedQuality === 'low' || requestedQuality === 'medium' ? requestedQuality : 'high'
const scenario = query.get('scenario') ?? 'percussion'
const captureTimeSec = Math.max(0, Number(query.get('timeSec') ?? 4) || 0)
const audioUrl = query.get('audioUrl')
interface ScenarioProfile { energy: number; bass: number; high: number; bpm: number; section: ReactSectionType; build: number; drop: number; vocal: number; transient: number }
const scenarioProfiles: Readonly<Record<string, ScenarioProfile>> = Object.freeze({
  quiet: { energy: 0.16, bass: 0.12, high: 0.18, bpm: 92, section: 'breakdown', build: 0.05, drop: 0, vocal: 0.08, transient: 0.1 },
  vocal: { energy: 0.42, bass: 0.28, high: 0.35, bpm: 112, section: 'verse', build: 0.12, drop: 0, vocal: 0.92, transient: 0.25 },
  percussion: { energy: 0.72, bass: 0.62, high: 0.82, bpm: 128, section: 'verse', build: 0.18, drop: 0, vocal: 0.12, transient: 0.9 },
  build: { energy: 0.68, bass: 0.5, high: 0.76, bpm: 128, section: 'build', build: 0.88, drop: 0, vocal: 0.18, transient: 0.64 },
  drop: { energy: 0.94, bass: 0.98, high: 0.78, bpm: 140, section: 'drop', build: 0.1, drop: 0.98, vocal: 0.1, transient: 0.94 },
  'false-drop': { energy: 0.34, bass: 0.18, high: 0.5, bpm: 140, section: 'build', build: 0.74, drop: 0.38, vocal: 0.08, transient: 0.46 },
  'half-time': { energy: 0.78, bass: 0.88, high: 0.48, bpm: 70, section: 'drop', build: 0.08, drop: 0.82, vocal: 0.12, transient: 0.76 },
})
const profile = scenarioProfiles[scenario as keyof typeof scenarioProfiles] ?? scenarioProfiles.percussion

interface DecodedTrack { samples: Float32Array; sampleRate: number; duration: number }
async function decodeTrack(url: string | null): Promise<DecodedTrack | null> {
  if (!url) return null
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Local tuning track request failed (${response.status}).`)
  const context = new AudioContext()
  try {
    const buffer = await context.decodeAudioData(await response.arrayBuffer())
    const samples = new Float32Array(buffer.length)
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const source = buffer.getChannelData(channel)
      for (let index = 0; index < samples.length; index += 1) samples[index] += source[index] / buffer.numberOfChannels
    }
    return { samples, sampleRate: buffer.sampleRate, duration: buffer.duration }
  } finally {
    await context.close()
  }
}

const decodedTrack = await decodeTrack(audioUrl)
function trackMetrics(timeSec: number) {
  if (!decodedTrack) return null
  const center = Math.min(decodedTrack.samples.length - 1, Math.max(0, Math.floor((timeSec % decodedTrack.duration) * decodedTrack.sampleRate)))
  const start = Math.max(0, center - 2048)
  const end = Math.min(decodedTrack.samples.length, center + 2048)
  let square = 0, peak = 0, difference = 0, slow = 0, slowCount = 0
  let previous = decodedTrack.samples[start] ?? 0
  for (let index = start; index < end; index += 1) {
    const sample = decodedTrack.samples[index]
    square += sample * sample
    peak = Math.max(peak, Math.abs(sample))
    difference += Math.abs(sample - previous)
    if ((index - start) % 64 === 0) { slow += Math.abs(sample); slowCount += 1 }
    previous = sample
  }
  const count = Math.max(1, end - start)
  return {
    rms: clamp(Math.sqrt(square / count) * 4.2),
    peak: clamp(peak * 1.8),
    low: clamp((slow / Math.max(1, slowCount)) * 5.4),
    high: clamp((difference / count) * 9),
  }
}

let timestampMs = 0
let targetTimestampMs = 0
let frameId = 0
let previousBeat = -1
let paused = false
let trackId = audioUrl ? 'atl-hoe-local-track' : 'atl-hoe-production-matrix'
const publishAudio = (nextTimestampMs: number) => {
  const timeSec = nextTimestampMs / 1000
  const measured = trackMetrics(timeSec)
  const energy = measured ? clamp(profile.energy * 0.42 + measured.rms * 0.82) : profile.energy
  const bass = measured ? clamp(profile.bass * 0.38 + measured.low * 0.86) : profile.bass
  const high = measured ? clamp(profile.high * 0.38 + measured.high * 0.9) : profile.high
  const beatPosition = timeSec * profile.bpm / 60
  const beatIndex = Math.floor(beatPosition)
  const beatChanged = beatIndex !== previousBeat
  const beatInBar = ((beatIndex % 4) + 4) % 4
  previousBeat = beatIndex
  frameId += 1
  AudioFeatureBus.setFrame({
    ...DEFAULT_MI_FRAME,
    timeSec, frameId, sourceId: trackId, trackId,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: bass * 0.9, bass, lowMid: energy * 0.72, mid: energy * 0.78, high, air: high * 0.72, volume: energy,
      normalizedSub: bass * 0.9, normalizedBass: bass, normalizedLowMid: energy * 0.72,
      normalizedMid: energy * 0.78, normalizedHigh: high, normalizedAir: high * 0.72,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: profile.bpm, bpmConfidence: 0.94, bpmSource: 'offline_analysis', beatPhase: beatPosition - beatIndex,
      beatHit: beatChanged, beatIndex, beatEventId: beatIndex, beatEventTimeSec: beatIndex / (profile.bpm / 60), beatInBar,
      barIndex: Math.floor(beatIndex / 4), downbeatHit: beatChanged && beatInBar === 0,
      kickHit: beatChanged && beatInBar % 2 === 0, kickStrength: beatChanged && beatInBar % 2 === 0 ? bass : 0,
      snareHit: beatChanged && beatInBar % 2 === 1, snareStrength: beatChanged && beatInBar % 2 === 1 ? energy * 0.86 : 0,
      phrase4Progress: ((beatIndex % 4) + beatPosition - beatIndex) / 4,
      phrase8Progress: ((beatIndex % 8) + beatPosition - beatIndex) / 8,
      phrase16Progress: ((beatIndex % 16) + beatPosition - beatIndex) / 16,
      phrase32Progress: ((beatIndex % 32) + beatPosition - beatIndex) / 32,
      phrase4Hit: beatChanged && beatIndex > 0 && beatIndex % 4 === 0,
      phrase8Hit: beatChanged && beatIndex > 0 && beatIndex % 8 === 0,
      phrase16Hit: beatChanged && beatIndex > 0 && beatIndex % 16 === 0,
      phrase32Hit: beatChanged && beatIndex > 0 && beatIndex % 32 === 0,
      transient: beatChanged ? Math.max(profile.transient, measured?.peak ?? 0) : energy * 0.14,
      transientConfidence: 0.9,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: energy, shortTerm: energy * 0.92, longTerm: Math.max(0.05, energy * 0.68), peak: measured?.peak ?? Math.min(1, energy * 1.08), rms: measured?.rms ?? energy * 0.84,
      spectralFlux: beatChanged ? Math.max(profile.transient, high) : high * 0.22,
      buildProgress: profile.build, dropImpact: profile.drop, tension: Math.max(profile.build, energy * 0.58), complexity: clamp(high * 0.78 + energy * 0.2),
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocals: profile.vocal, vocalEnergy: profile.vocal, vocalActivity: profile.vocal, drums: energy, bass },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: profile.section, label: scenario, startSec: 0, endSec: Math.max(8, decodedTrack?.duration ?? 8),
      progress: decodedTrack ? clamp(timeSec / decodedTrack.duration) : clamp(timeSec / 8), intensity: energy, confidence: 0.9, source: 'analysis',
    },
    semantics: { ...DEFAULT_MI_FRAME.semantics, buildConfidence: profile.build, dropConfidence: profile.drop },
    semanticMoments: profile.drop > 0.8 ? [{ id: `${trackId}-drop`, timeSec: Math.max(0, captureTimeSec - 0.1), type: 'drop_impact', confidence: profile.drop, source: 'manual' }] : [],
    capabilities: { liveBands: true, rhythmEvents: true, beatGrid: true, sections: true, trackEnergyCurve: true, stemCurves: true, lyrics: false },
    analysisCapabilities: { ...DEFAULT_MI_FRAME.analysisCapabilities!, semanticClassification: true, semanticMoments: profile.drop > 0.8, legacyFallbackOnly: false },
    analysisSource: decodedTrack ? 'imported' : 'bar_self_similarity',
    analysisRevision: 'atl-hoe-production-v1', timelineRevision: 'atl-hoe-production-timeline-v1',
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.92, rhythm: 0.94, section: 0.9 },
  }, 'atl-hoe-production-harness')
}

AudioFeatureBus.reset()
publishAudio(0)
const requestFrame: typeof requestAnimationFrame = callback => window.requestAnimationFrame(() => {
  if (!paused) timestampMs = Math.min(targetTimestampMs, timestampMs + 100)
  publishAudio(timestampMs)
  callback(timestampMs)
})
const canvas = document.querySelector<HTMLCanvasElement>('#atl-hoe-production')
if (!canvas) throw new Error('The ATL HOE production canvas is missing.')
const productionCanvas: HTMLCanvasElement = canvas
const created = Cinema2Runtime.create(productionCanvas, {
  presetId: CINEMA2_ATL_HOE_PRESET_ID,
  renderQuality: quality,
  requestAnimationFrame: requestFrame,
  cancelAnimationFrame: id => window.cancelAnimationFrame(id),
  diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'atl-hoe-production-v1' },
  transportSource: { getState: () => ({ sourcePresent: true, playing: !paused, analysisActive: !paused, paused, trackId, timeSec: timestampMs / 1000, bpm: profile.bpm }) },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime
const requestedParameters = query.get('params')
if (requestedParameters) {
  const state = runtime.getParameterState()
  for (const [parameterId, value] of Object.entries(JSON.parse(requestedParameters) as Record<string, unknown>)) {
    const result = state.setPersistentValue(parameterId as Parameters<typeof state.setPersistentValue>[0], value)
    if (!result.ok) throw new Error(`ATL HOE production capture could not set ${parameterId}: ${result.diagnostics.map(entry => entry.message).join('; ')}`)
  }
}
runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
runtime.start()

let prepared = false
let pending: Promise<unknown> | null = null
const browserFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
async function settleFrames(count: number) {
  const target = runtime.getSnapshot().frameCount + Math.max(1, Math.round(count))
  while (runtime.getSnapshot().frameCount < target) await browserFrame()
}
function status() {
  return Object.freeze({
    prepared, quality, scenario, audio: Object.freeze({ localTrack: Boolean(decodedTrack), duration: decodedTrack?.duration ?? null, trackId, paused }),
    viewport: Object.freeze({ width: innerWidth, height: innerHeight }), controlledTimestampMs: timestampMs,
    snapshot: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), effects: runtime.getEffectRuntimeSnapshot(),
    performance: runtime.getPerformanceSnapshot(), resources: runtime.getResourceManagerSnapshot(), camera: runtime.getCameraRuntimeSnapshot().camera,
  })
}
async function prepare() {
  if (pending) return pending
  pending = (async () => {
    for (let attempt = 0; attempt < 360; attempt += 1) {
      await browserFrame()
      const modules = runtime.getModuleRuntimeSnapshot()
      if (modules.failedModuleCount > 0) throw new Error(`ATL HOE module failed during preparation: ${modules.modules.flatMap(module => module.diagnostics).map(entry => entry.message).join('; ')}`)
      if (modules.activeModuleCount > 0 && modules.estimatedGpuBytes > 0) {
        targetTimestampMs = captureTimeSec * 1000
        while (runtime.getVisualElapsedTimeSec() < captureTimeSec - 1e-6) await browserFrame()
        await settleFrames(24)
        if (runtime.getPerformanceSnapshot().resolvedQuality !== quality) throw new Error(`Expected ${quality} quality.`)
        prepared = true
        return status()
      }
    }
    throw new Error('ATL HOE did not become GPU-resident within the production timeout.')
  })()
  return pending
}
async function profileFrames(sampleFrames = 120) {
  await prepare()
  const count = Math.min(900, Math.max(30, Math.round(sampleFrames)))
  targetTimestampMs += count * (1000 / 60)
  const started = performance.now()
  await settleFrames(count)
  const elapsedMs = performance.now() - started
  return Object.freeze({ sampleFrames: count, elapsedMs, wallFrameTimeAverageMs: elapsedMs / count, runtime: status() })
}
async function resize(width: number, height: number) {
  await prepare(); runtime.resize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), dpr: 1 }); await settleFrames(24); return status()
}
async function pause() { await prepare(); paused = true; await settleFrames(12); return status() }
async function resume() { await prepare(); paused = false; targetTimestampMs += 800; await settleFrames(16); return status() }
async function seek(timeSec: number) { await prepare(); targetTimestampMs = Math.max(timestampMs, timeSec * 1000); while (timestampMs < targetTimestampMs) await browserFrame(); await settleFrames(12); return status() }
async function replaceTrack(nextTrackId: string) { await prepare(); trackId = nextTrackId || 'atl-hoe-replacement'; previousBeat = -1; publishAudio(timestampMs); await settleFrames(16); return status() }
async function recoverContext() {
  await prepare()
  const extension = productionCanvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')
  if (!extension) throw new Error('WEBGL_lose_context is unavailable.')
  const generation = runtime.getSnapshot().contextGeneration
  extension.loseContext()
  for (let attempt = 0; attempt < 180 && runtime.getSnapshot().phase !== 'context-lost'; attempt += 1) await browserFrame()
  extension.restoreContext()
  for (let attempt = 0; attempt < 360; attempt += 1) {
    await browserFrame()
    const snapshot = runtime.getSnapshot(), modules = runtime.getModuleRuntimeSnapshot()
    if (modules.failedModuleCount > 0) throw new Error('ATL HOE module failed after context restoration.')
    if (snapshot.phase === 'running' && snapshot.contextGeneration > generation && modules.estimatedGpuBytes > 0) { await settleFrames(24); return status() }
  }
  throw new Error('ATL HOE did not recover after WebGL context restoration.')
}

window.__atlHoeProduction = Object.freeze({ prepare, profile: profileFrames, resize, recoverContext, pause, resume, seek, replaceTrack, status })
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
