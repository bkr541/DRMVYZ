/** Deterministic capture surface for the real Cinema 2.0 Sixfold production path. */
import type { Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { CINEMA2_SIXFOLD_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2SixfoldPreset'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'

interface SixfoldProductionApi {
  prepare(): Promise<unknown>
  status(): unknown
}

declare global {
  interface Window { __sixfoldProduction?: SixfoldProductionApi }
}

const canvasElement = document.querySelector<HTMLCanvasElement>('#sixfold-production')
if (!canvasElement) throw new Error('The Sixfold production canvas is missing.')
const canvas: HTMLCanvasElement = canvasElement
const query = new URLSearchParams(location.search)
const requestedQuality = query.get('quality')
const quality: Cinema2RenderQualityLevel = requestedQuality === 'low' || requestedQuality === 'medium' ? requestedQuality : 'high'
const captureTimeSec = Math.max(0, Number(query.get('timeSec') ?? 1.65) || 0)

let timestampMs = 0
let targetTimestampMs = 0
let frameId = 0
let previousBeat = -1
const publishAudio = (nextTimestampMs: number) => {
  const timeSec = nextTimestampMs / 1000
  const beatPosition = timeSec * 2
  const beatIndex = Math.floor(beatPosition)
  const beatChanged = beatIndex !== previousBeat
  const beatInBar = ((beatIndex % 4) + 4) % 4
  previousBeat = beatIndex
  frameId += 1
  AudioFeatureBus.setFrame({
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId,
    sourceId: 'sixfold-phase-c-fixture',
    trackId: 'sixfold-phase-c-fixture',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.58, bass: 0.72, lowMid: 0.54, mid: 0.66, high: 0.62, air: 0.48, volume: 0.68,
      normalizedSub: 0.58, normalizedBass: 0.72, normalizedLowMid: 0.54,
      normalizedMid: 0.66, normalizedHigh: 0.62, normalizedAir: 0.48,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120, bpmConfidence: 0.96, bpmSource: 'offline_analysis', beatPhase: beatPosition - beatIndex,
      beatHit: beatChanged, beatIndex, beatEventId: beatIndex, beatEventTimeSec: beatIndex / 2,
      beatInBar, barIndex: Math.floor(beatIndex / 4), downbeatHit: beatChanged && beatInBar === 0,
      kickHit: beatChanged && beatInBar % 2 === 0, kickStrength: beatChanged && beatInBar % 2 === 0 ? 0.92 : 0,
      snareHit: beatChanged && beatInBar % 2 === 1, snareStrength: beatChanged && beatInBar % 2 === 1 ? 0.82 : 0,
      phrase4Progress: ((beatIndex % 4) + beatPosition - beatIndex) / 4,
      phrase8Progress: ((beatIndex % 8) + beatPosition - beatIndex) / 8,
      phrase16Progress: ((beatIndex % 16) + beatPosition - beatIndex) / 16,
      phrase32Progress: ((beatIndex % 32) + beatPosition - beatIndex) / 32,
      phrase4Hit: beatChanged && beatIndex > 0 && beatIndex % 4 === 0,
      phrase8Hit: beatChanged && beatIndex > 0 && beatIndex % 8 === 0,
      phrase16Hit: beatChanged && beatIndex > 0 && beatIndex % 16 === 0,
      phrase32Hit: beatChanged && beatIndex > 0 && beatIndex % 32 === 0,
      transient: beatChanged ? 0.76 : 0.14, transientConfidence: 0.92,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.7, shortTerm: 0.66, longTerm: 0.58, peak: 0.9, rms: 0.64,
      spectralFlux: beatChanged ? 0.78 : 0.2, buildProgress: 0.58, tension: 0.62, complexity: 0.56,
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocals: 0.38, vocalEnergy: 0.42, vocalActivity: 0.34, drums: 0.78, bass: 0.72 },
    section: { ...DEFAULT_MI_FRAME.section, type: 'build', label: 'Build', startSec: 0, endSec: 8, progress: Math.min(1, timeSec / 8), intensity: 0.72, confidence: 0.9, source: 'analysis' },
    semantics: { ...DEFAULT_MI_FRAME.semantics, buildConfidence: 0.9 },
    capabilities: { liveBands: true, rhythmEvents: true, beatGrid: true, sections: true, trackEnergyCurve: true, stemCurves: true, lyrics: false },
    analysisSource: 'bar_self_similarity',
    analysisRevision: 'sixfold-phase-c-fixture-v1',
    timelineRevision: 'sixfold-phase-c-timeline-v1',
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.92, rhythm: 0.96, section: 0.9 },
  }, 'sixfold-production-harness')
}

AudioFeatureBus.reset()
publishAudio(0)
const controlledRequestAnimationFrame: typeof requestAnimationFrame = callback => window.requestAnimationFrame(() => {
  timestampMs = Math.min(targetTimestampMs, timestampMs + 100)
  publishAudio(timestampMs)
  callback(timestampMs)
})

const created = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_SIXFOLD_PRESET_ID,
  renderQuality: quality,
  requestAnimationFrame: controlledRequestAnimationFrame,
  cancelAnimationFrame: id => window.cancelAnimationFrame(id),
  diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'sixfold-phase-b-static' },
  transportSource: {
    getState: () => ({
      sourcePresent: true,
      playing: true,
      analysisActive: true,
      paused: false,
      trackId: 'sixfold-phase-c-fixture',
      timeSec: timestampMs / 1000,
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
    if (!result.ok) throw new Error(`Sixfold capture could not set ${parameterId}: ${result.diagnostics.map(entry => entry.message).join('; ')}`)
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
    for (let attempt = 0; attempt < 360; attempt += 1) {
      await browserFrame()
      const modules = runtime.getModuleRuntimeSnapshot()
      if (modules.failedModuleCount > 0) throw new Error('Sixfold failed during production-path preparation.')
      if (modules.activeModuleCount > 0 && modules.estimatedGpuBytes > 0 && runtime.getSnapshot().frameCount > 3) {
        targetTimestampMs = captureTimeSec * 1000
        while (runtime.getVisualElapsedTimeSec() < captureTimeSec - 1e-6) await browserFrame()
        for (let settle = 0; settle < 24; settle += 1) await browserFrame()
        prepared = true
        return status()
      }
    }
    throw new Error('Sixfold did not become GPU-resident within the capture timeout.')
  })()
  return pending
}

window.__sixfoldProduction = Object.freeze({ prepare, status })
addEventListener('beforeunload', () => runtime.dispose(), { once: true })

