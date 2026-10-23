/** Real native runtime; optional deterministic publications enter the shared bus. */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import { Cinema2Runtime, getCinema2RuntimeDiagnostics } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_NIGHTSHIFT_PRESET_ID, CINEMA2_NIGHTSHIFT_PARAMETER_IDS } from '../../components/vyzualz/cinema2/presets/Cinema2NightshiftPreset'
import type { Cinema2ParameterId, Cinema2PresetId, Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { CINEMA2_STARTERS_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2StartersPreset'
import { createCinema2DesignParentGroupModel } from '../../components/vyzualz/cinema2/parameters/Cinema2InspectorModel'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../support/NightshiftMusicFixture'
import { NIGHTSHIFT_CHOREOGRAPHY_ROUTES } from '../../components/vyzualz/cinema2/presets/Cinema2NightshiftChoreography'

const canvas = document.querySelector<HTMLCanvasElement>('#nightshift-production')
if (!canvas) throw new Error('NIGHTSHIFT canvas is missing.')
AudioFeatureBus.reset()
let timestamp = 0, targetTimestamp = 0, bpm = 120, paused = false
const step2 = new URLSearchParams(location.search).get('step2') === '1'
const step3 = new URLSearchParams(location.search).get('step3') === '1'
let musicTime = 0, musicSequence = 1, fixtureEnabled = step3
let fixture: Partial<NightshiftFixtureOptions> = {}, fixtureFrame = nightshiftMusicFixture({ timeSec: 0, frameId: 1 })
let fixtureDirty = step3
const frameFaults: Record<string, unknown>[] = []
let observedPassFailures = 0
const publishMusic = () => {
  fixtureFrame = nightshiftMusicFixture({ ...fixture, timeSec: musicTime, frameId: ++musicSequence })
  AudioFeatureBus.setFrame(fixtureFrame)
  fixtureDirty = false
}
let quality: Cinema2RenderQualityLevel | 'auto' = 'high'
const createRuntime = (presetId: Cinema2PresetId = CINEMA2_NIGHTSHIFT_PRESET_ID, serializedParameterState?: string) => Cinema2Runtime.create(canvas, {
  presetId, renderQuality: quality === 'auto' ? undefined : quality, serializedParameterState, diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'nightshift-static-core' },
  requestAnimationFrame: callback => requestAnimationFrame(() => {
    const before = timestamp
    timestamp = Math.min(targetTimestamp, timestamp + 100)
    if (fixtureEnabled) {
      if (!paused) musicTime += (timestamp - before) / 1000
      if (timestamp !== before || fixtureDirty) publishMusic()
    }
    callback(timestamp)
    const graph = runtime.getRenderGraphExecutorSnapshot()
    if (runtime.getSnapshot().frameCount <= 1) observedPassFailures = 0
    if (graph.failedPassCount > observedPassFailures) frameFaults.push({ frame: runtime.getSnapshot().frameCount, diagnostics: graph.diagnostics,
      parameters: runtime.getParameterState().getSnapshot().persistentValues, transport: runtime.getTransportFrameState() })
    observedPassFailures = graph.failedPassCount
  }),
  cancelAnimationFrame: id => cancelAnimationFrame(id),
  transportSource: { getState: () => ({ sourcePresent: step2 || fixtureEnabled, playing: (step2 || fixtureEnabled) && !paused, analysisActive: step2 || fixtureEnabled,
    paused, trackId: fixtureEnabled ? fixtureFrame.trackId : step2 ? 'nightshift-host-clock-test' : null, timeSec: fixtureEnabled ? musicTime : timestamp / 1000, bpm, bpmSync: false }) },
})
const created = createRuntime()
if (!created.runtime) throw new Error(created.error)
let runtime = created.runtime
const inspectorHost = document.createElement('aside')
inspectorHost.id = 'nightshift-inspector'
inspectorHost.style.cssText = 'position:fixed;right:0;top:0;bottom:0;width:360px;overflow:auto;background:#16151f;color:white;padding:10px;display:none'
document.body.append(inspectorHost)
const inspector = createRoot(inspectorHost)
const refreshInspector = () => inspector.render(createElement(Cinema2InspectorPanel, { runtime, surface: 'design' }))
refreshInspector()
function resize() { runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }) }
resize()
runtime.start()
const resources = () => ({ snapshot: runtime.getSnapshot(), resources: runtime.getResourceManagerSnapshot(),
  history: runtime.getHistoryServiceSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(),
  effects: runtime.getEffectRuntimeSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), diagnostics: getCinema2RuntimeDiagnostics(), frameFaults })
let retired: ReturnType<typeof resources>[] = []
const status = () => ({ snapshot: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), camera: runtime.getCameraRuntimeSnapshot().camera,
  resources: runtime.getResourceManagerSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(), diagnostics: getCinema2RuntimeDiagnostics(), retired, frameFaults,
  director: runtime.getVisualDirectorFrame(), effects: runtime.getEffectRuntimeSnapshot(), history: runtime.getHistoryServiceSnapshot(),
  choreography: runtime.getChoreographyRuntimeSnapshot(), channels: Object.fromEntries(NIGHTSHIFT_CHOREOGRAPHY_ROUTES.map(([property]) => {
    const target = runtime.getCompiledPresetPlan().targets.targets.find(t => t.kind === 'module' && t.property === property)!
    return [property, runtime.getTargetResolver().resolve(target.id).value]
  })),
  parameters: runtime.getParameterState().getSnapshot(), audio: runtime.getAudioIntelligenceFrame(), transport: runtime.getTransportFrameState(),
  groups: createCinema2DesignParentGroupModel(runtime.getCompiledPresetPlan(), runtime.getParameterState().getSnapshot()) })
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const api = {
  status,
  ids: CINEMA2_NIGHTSHIFT_PARAMETER_IDS,
  async music(options: Partial<NightshiftFixtureOptions>, enabled = true) {
    fixtureEnabled = enabled
    if (options.timeSec != null) musicTime = options.timeSec
    fixture = { ...options, eventTime: options.eventTime ?? musicTime }
    fixtureDirty = true
    if (!enabled) AudioFeatureBus.reset()
    for (let i = 0; i < 3; i++) await nextFrame()
    return status()
  },
  async repeatMusic() {
    AudioFeatureBus.setFrame(fixtureFrame)
    for (let i = 0; i < 3; i++) await nextFrame()
    return status()
  },
  async reenter(options: { quality?: Cinema2RenderQualityLevel | 'auto'; preserve?: boolean; viaOtherPreset?: boolean } = {}) {
    const saved = options.preserve ? runtime.getParameterState().serialize() : undefined
    runtime.dispose()
    retired = [resources()]
    if (options.quality) quality = options.quality
    if (options.viaOtherPreset) {
      const other = createRuntime(CINEMA2_STARTERS_PRESET_ID)
      if (!other.runtime) throw new Error(other.error)
      runtime = other.runtime; resize(); runtime.start()
      for (let i = 0; i < 12; i++) await nextFrame()
      runtime.dispose(); retired.push(resources())
    }
    const next = createRuntime(CINEMA2_NIGHTSHIFT_PRESET_ID, saved)
    if (!next.runtime) throw new Error(next.error)
    runtime = next.runtime; resize(); runtime.start(); refreshInspector()
    return api.prepare()
  },
  async set(values: Record<string, unknown>) {
    for (const [id, value] of Object.entries(values)) {
      const result = runtime.getParameterState().setPersistentValue(id as Cinema2ParameterId, value)
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    }
    refreshInspector()
    for (let i = 0; i < 3; i++) await nextFrame()
    return status()
  },
  async reset() {
    runtime.getParameterState().resetAll(); refreshInspector()
    for (let i = 0; i < 3; i++) await nextFrame()
  },
  dispose() { runtime.dispose(); return resources() },
  showInspector(show: boolean) { inspectorHost.style.display = show ? 'block' : 'none'; refreshInspector() },
  async advance(seconds: number, hostBpm = bpm, hostPaused = false) {
    bpm = hostBpm; paused = hostPaused
    targetTimestamp += seconds * 1000
    while (timestamp < targetTimestamp - .001) await nextFrame()
    for (let i = 0; i < 3; i++) await nextFrame()
    return status()
  },
  async prepare() {
    // Memory is reported during warmup; wait beyond residency for shader compile/output.
    for (let attempt = 0; attempt < 600; attempt++) {
      await nextFrame()
      const s = status()
      if (s.modules.failedModuleCount || s.modules.modules.some(m => m.diagnostics.length)) throw new Error(JSON.stringify(s.modules))
      if (s.effects.failedEffectCount || s.effects.effects.some(e => e.diagnostics.length)) throw new Error(JSON.stringify(s.effects))
      if (s.modules.estimatedGpuBytes > 0 && s.snapshot.frameCount > 90) {
        for (let i = 0; i < 30; i++) await nextFrame()
        return status()
      }
    }
    throw new Error('NIGHTSHIFT static scene did not prepare.')
  },
  async resize() { resize(); for (let i = 0; i < 12; i++) await nextFrame(); return status() },
}
declare global { interface Window { __nightshiftProduction?: typeof api } }
window.__nightshiftProduction = api
addEventListener('resize', resize)
addEventListener('beforeunload', () => { inspector.unmount(); runtime.dispose() }, { once: true })
