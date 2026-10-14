/** Deterministic static capture surface for the real Cinema 2.0 Hypnotize production path. */
import type { Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { CINEMA2_HYPNOTIZE_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2HypnotizePreset'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'

interface HypnotizeProductionApi {
  prepare(): Promise<unknown>
  status(): unknown
}

declare global {
  interface Window { __hypnotizeProduction?: HypnotizeProductionApi }
}

const canvasElement = document.querySelector<HTMLCanvasElement>('#hypnotize-production')
if (!canvasElement) throw new Error('The Hypnotize production canvas is missing.')
const canvas: HTMLCanvasElement = canvasElement
const query = new URLSearchParams(location.search)
const requestedQuality = query.get('quality')
const quality: Cinema2RenderQualityLevel = requestedQuality === 'low' || requestedQuality === 'medium' ? requestedQuality : 'high'
const energy = clamp(Number(query.get('energy') ?? 0.56), 0, 1)
const bass = clamp(Number(query.get('bass') ?? 0.65), 0, 1)
const captureTimeSec = Math.max(0, Number(query.get('timeSec') ?? 2.4) || 0)
const scenario = query.get('scenario') ?? 'steady'
const sourcePresent = scenario !== 'idle'
const isBuild = scenario === 'build'
const isDrop = scenario === 'drop'
const isVocal = scenario === 'vocal'

AudioFeatureBus.reset()
let timestampMs = 0
let targetTimestampMs = 0
let frameId = 0
let previousBeat = -1
const publishAudio = (nextTimestampMs: number) => {
  if (!sourcePresent) return
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
    sourceId: 'hypnotize-phase-c-fixture',
    trackId: 'hypnotize-phase-c-fixture',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: bass * 0.86, bass, lowMid: energy * 0.72, mid: energy * 0.82, high: energy * 0.68, air: energy * 0.54, volume: energy,
      normalizedSub: bass * 0.86, normalizedBass: bass, normalizedLowMid: energy * 0.72,
      normalizedMid: energy * 0.82, normalizedHigh: energy * 0.68, normalizedAir: energy * 0.54,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120, bpmConfidence: 0.96, bpmSource: 'offline_analysis', beatPhase: beatPosition - beatIndex,
      beatHit: beatChanged, beatIndex, beatEventId: beatIndex, beatEventTimeSec: beatIndex / 2,
      beatInBar, barIndex: Math.floor(beatIndex / 4), downbeatHit: beatChanged && beatInBar === 0,
      kickHit: beatChanged && beatInBar % 2 === 0, kickStrength: beatChanged && beatInBar % 2 === 0 ? bass : 0,
      snareHit: beatChanged && beatInBar % 2 === 1, snareStrength: beatChanged && beatInBar % 2 === 1 ? energy * 0.9 : 0,
      phrase4Progress: ((beatIndex % 4) + beatPosition - beatIndex) / 4,
      phrase8Progress: ((beatIndex % 8) + beatPosition - beatIndex) / 8,
      phrase16Progress: ((beatIndex % 16) + beatPosition - beatIndex) / 16,
      phrase32Progress: ((beatIndex % 32) + beatPosition - beatIndex) / 32,
      phrase4Hit: beatChanged && beatIndex > 0 && beatIndex % 4 === 0,
      phrase8Hit: beatChanged && beatIndex > 0 && beatIndex % 8 === 0,
      phrase16Hit: beatChanged && beatIndex > 0 && beatIndex % 16 === 0,
      phrase32Hit: beatChanged && beatIndex > 0 && beatIndex % 32 === 0,
      transient: beatChanged ? energy : energy * 0.16,
      transientConfidence: 0.9,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: energy, shortTerm: energy * 0.94, longTerm: Math.max(0.06, energy * 0.72), peak: Math.min(1, energy * 1.1), rms: energy * 0.88,
      spectralFlux: beatChanged ? energy * 0.92 : energy * 0.24,
      buildProgress: isBuild ? Math.min(1, 0.76 + timeSec * 0.045) : energy * 0.24,
      dropImpact: isDrop ? 0.96 : 0,
      tension: isBuild ? 0.92 : energy * 0.68,
      complexity: energy * 0.62,
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocals: isVocal ? 0.94 : energy * 0.24, vocalEnergy: isVocal ? 0.9 : energy * 0.28, vocalActivity: isVocal ? 0.92 : energy * 0.18, drums: energy, bass },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: isDrop ? 'drop' : isBuild ? 'build' : 'verse',
      label: isDrop ? 'Drop' : isBuild ? 'Build' : isVocal ? 'Vocal' : 'Steady',
      startSec: 0,
      endSec: 8,
      progress: Math.min(1, timeSec / 8),
      intensity: energy,
      confidence: 0.9,
      source: 'analysis',
    },
    semantics: { ...DEFAULT_MI_FRAME.semantics, buildConfidence: isBuild ? 0.96 : 0.08, dropConfidence: isDrop ? 0.98 : 0.03 },
    semanticMoments: isDrop ? [{ id: 'hypnotize-drop-impact', timeSec: Math.max(0, captureTimeSec - 0.1), type: 'drop_impact', confidence: 0.98, source: 'manual' }] : [],
    capabilities: { liveBands: true, rhythmEvents: true, beatGrid: true, sections: true, trackEnergyCurve: true, stemCurves: true, lyrics: false },
    analysisCapabilities: { ...DEFAULT_MI_FRAME.analysisCapabilities!, semanticClassification: true, semanticMoments: isDrop, legacyFallbackOnly: false },
    analysisSource: 'bar_self_similarity',
    analysisRevision: 'hypnotize-phase-d-fixture-v1',
    timelineRevision: 'hypnotize-phase-d-timeline-v1',
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.92, rhythm: 0.96, section: 0.9 },
  }, 'hypnotize-production-harness')
}
if (sourcePresent) publishAudio(0)
const controlledRequestAnimationFrame: typeof requestAnimationFrame = callback => window.requestAnimationFrame(() => {
  timestampMs = Math.min(targetTimestampMs, timestampMs + 100)
  if (sourcePresent) publishAudio(timestampMs)
  callback(timestampMs)
})

const created = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_HYPNOTIZE_PRESET_ID,
  renderQuality: quality,
  requestAnimationFrame: controlledRequestAnimationFrame,
  cancelAnimationFrame: id => window.cancelAnimationFrame(id),
  diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'hypnotize-phase-b-static' },
  transportSource: {
    getState: () => ({ sourcePresent, playing: sourcePresent, analysisActive: sourcePresent, paused: !sourcePresent, trackId: sourcePresent ? 'hypnotize-phase-d-fixture' : null, timeSec: timestampMs / 1000, bpm: sourcePresent ? 120 : null }),
  },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime

const requestedParameters = query.get('params')
if (requestedParameters) {
  const state = runtime.getParameterState()
  for (const [parameterId, value] of Object.entries(JSON.parse(requestedParameters) as Record<string, unknown>)) {
    const result = state.setPersistentValue(parameterId as Parameters<typeof state.setPersistentValue>[0], value)
    if (!result.ok) throw new Error(`Hypnotize capture could not set ${parameterId}: ${result.diagnostics.map(entry => entry.message).join('; ')}`)
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
      if (modules.failedModuleCount > 0) {
        const diagnostics = modules.modules
          .flatMap(module => module.diagnostics)
          .map(diagnostic => diagnostic.message)
          .join('; ')
        throw new Error(`Hypnotize failed during production-path preparation: ${diagnostics || 'unknown module failure'}`)
      }
      if (modules.activeModuleCount > 0 && modules.estimatedGpuBytes > 0 && runtime.getSnapshot().frameCount > 3) {
        targetTimestampMs = captureTimeSec * 1000
        while (runtime.getVisualElapsedTimeSec() < captureTimeSec - 1e-6) await browserFrame()
        for (let settle = 0; settle < 18; settle += 1) await browserFrame()
        prepared = true
        return status()
      }
    }
    throw new Error('Hypnotize did not become GPU-resident within the capture timeout.')
  })()
  return pending
}

window.__hypnotizeProduction = Object.freeze({ prepare, status })
addEventListener('beforeunload', () => runtime.dispose(), { once: true })

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}
