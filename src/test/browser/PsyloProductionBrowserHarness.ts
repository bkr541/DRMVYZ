import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { psyloMusicFixture, type PsyloFixtureOptions } from '../support/PsyloMusicFixture'
import '../../styles.css'
import '../../styles/vyzualz.css'
import '../../styles/appearance.css'
import '../../styles/tabRows.css'
import '../../styles/groupSpacing.css'
import '../../styles/reactView.css'
import '../../styles/typography.css'
import { bootstrapAppearanceTheme } from '../../features/appearance/appearanceStore'
bootstrapAppearanceTheme()
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_PSYLO_PRESET_ID, CINEMA2_PSYLO_PRESET_MANIFEST, psyloParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2PsyloPreset'
import { CINEMA2_QUALITY_MODE_PARAMETER_ID } from '../../components/vyzualz/cinema2/parameters/Cinema2PerformanceParameters'
import { Cinema2PresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { createCinema2DesignParentGroupModel } from '../../components/vyzualz/cinema2/parameters/Cinema2InspectorModel'
import type { Cinema2JsonValue } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'

const canvas = document.querySelector<HTMLCanvasElement>('#psylo-production')!
const query = new URLSearchParams(location.search)
const quality = query.get('quality') === 'low' ? 'low' : query.get('quality') === 'medium' ? 'medium' : 'high'
const benchmark = query.get('preset')
const presetId = (['mainframe', 'nightshift', 'cathedral'].includes(benchmark ?? '') ? `drmvyz.cinema2.${benchmark}` : CINEMA2_PSYLO_PRESET_ID) as typeof CINEMA2_PSYLO_PRESET_ID
const directorEnabled = new URLSearchParams(location.search).get('director') !== 'off'
const baselineRegistry = new Cinema2PresetRegistry()
if (!directorEnabled) {
  const baseline = { ...CINEMA2_PSYLO_PRESET_MANIFEST, choreography: { rules: CINEMA2_PSYLO_PRESET_MANIFEST.choreography!.rules.filter(rule => !rule.source.path?.startsWith('director.') && rule.source.signal !== 'section-change') } }
  const registration = baselineRegistry.register(baseline)
  if (!registration.ok) throw new Error(JSON.stringify(registration.diagnostics))
}
AudioFeatureBus.reset()
let fixture: Partial<PsyloFixtureOptions> = {}, fixtureEnabled = false, sequence = 1, trackId = 'psylo-host-timing-fixture'
let fixtureDirty = false, lastPublication = psyloMusicFixture({ timeSec: 0, frameId: 1 })
const publish = () => { lastPublication = psyloMusicFixture({ ...fixture, trackId, timeSec: trackTime, frameId: ++sequence }); AudioFeatureBus.setFrame(lastPublication); fixtureDirty = false }
let timestamp = 0, target = 0, trackTime = 0, paused = false, bpm = 100, sourcePresent = false
const create = (serializedParameterState?: string) => Cinema2Runtime.create(canvas, {
  presetId, presetRegistry: directorEnabled ? undefined : baselineRegistry, renderQuality: query.has('quality') ? quality : undefined, diagnosticsEnabled: true, serializedParameterState,
  requestAnimationFrame: callback => requestAnimationFrame(() => {
    const before = timestamp
    const next = Math.min(target, timestamp + 100)
    if (!paused) trackTime += (next - timestamp) / 1000
    timestamp = next; if (fixtureEnabled && (next !== before || fixtureDirty)) publish(); callback(timestamp)
  }),
  cancelAnimationFrame: id => cancelAnimationFrame(id),
  transportSource: { getState: () => ({ sourcePresent, playing: !paused, paused, analysisActive: fixtureEnabled && !paused,
    trackId: sourcePresent ? trackId : null, timeSec: trackTime, bpm, bpmSync: false }) },
})
const created = create()
if (!created.runtime) throw new Error(`PSYLO could not start: ${created.error}`)
let runtime = created.runtime
const host = document.createElement('aside'); host.id = 'psylo-inspector'
host.style.cssText = 'position:fixed;right:0;top:0;bottom:0;width:370px;overflow:auto;background:#171820;color:white;display:none'
document.body.append(host)
const inspector = createRoot(host)
const refresh = () => inspector.render(createElement(Cinema2InspectorPanel, { runtime, surface: 'design', sharedAudioAnalysis: false }))
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const status = () => ({ effects: runtime.getEffectRuntimeSnapshot(), lighting: runtime.getLightingEnvironmentRuntimeSnapshot(), runtime: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(),
  camera: runtime.getCameraRuntimeSnapshot().camera, resources: runtime.getResourceManagerSnapshot(), parameters: runtime.getParameterState().getSnapshot(),
  directorEnabled, director: runtime.getVisualDirectorFrame(), choreography: runtime.getChoreographyRuntimeSnapshot(), audio: runtime.getAudioIntelligenceFrame(), transport: runtime.getTransportFrameState(),
  groups: createCinema2DesignParentGroupModel(runtime.getCompiledPresetPlan(), runtime.getParameterState().getSnapshot()) })
function resize() { runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); return status() }
resize(); runtime.start(); refresh()
const api = {
  status, resize,
  async quality(value: Cinema2JsonValue) { const result = runtime.getParameterState().setPersistentValue(CINEMA2_QUALITY_MODE_PARAMETER_ID, value); if (!result.ok) throw new Error(JSON.stringify(result.diagnostics)); refresh(); await nextFrame(); return status() },
  async settle(frames = 12) { for (let i = 0; i < frames; i++) await nextFrame(); return status() },
  async profile(frames = 45) {
    const samples: number[] = []
    for (let i = 0; i < frames; i++) { const start = performance.now(); target += 1000 / 60; while (timestamp < target) await nextFrame(); samples.push(performance.now() - start) }
    return { samples, status: status() }
  },
  async recoverContext() {
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')
    if (!extension) throw new Error('WEBGL_lose_context unavailable')
    const generation = runtime.getSnapshot().contextGeneration
    extension.loseContext()
    for (let i = 0; i < 180 && runtime.getSnapshot().phase !== 'context-lost'; i++) await nextFrame()
    if (runtime.getSnapshot().phase !== 'context-lost') throw new Error('Context loss was not delivered')
    // Browser restoration becomes legal on a later event-loop turn.
    await nextFrame(); await nextFrame(); extension.restoreContext()
    for (let i = 0; i < 360; i++) {
      await nextFrame()
      if (runtime.getSnapshot().phase === 'running' && runtime.getSnapshot().contextGeneration > generation && runtime.getModuleRuntimeSnapshot().estimatedGpuBytes > 0) {
        for (let j = 0; j < 12; j++) await nextFrame()
        return status()
      }
    }
    throw new Error('Context resources did not recover within 360 frames')
  },
  async music(options: Partial<PsyloFixtureOptions> = {}, enabled = true) {
    if (options.timeSec != null) trackTime = options.timeSec
    if (options.trackId) trackId = options.trackId
    fixture = { ...options, eventTime: options.eventTime ?? trackTime }; fixtureEnabled = enabled; fixtureDirty = enabled; sourcePresent = true
    if (enabled) publish(); else AudioFeatureBus.reset()
    for (let i = 0; i < 3; i++) await nextFrame(); return status()
  },
  async repeatMusic() { AudioFeatureBus.setFrame(lastPublication); for (let i = 0; i < 3; i++) await nextFrame(); return status() },
  async seek(timeSec: number) {
    trackTime = timeSec; if (fixtureEnabled) publish()
    for (let i = 0; i < 3; i++) await nextFrame(); return status()
  },
  async set(values: Record<string, Cinema2JsonValue>) {
    for (const [key, value] of Object.entries(values)) {
      const result = runtime.getParameterState().setPersistentValue(psyloParameterId(key), value)
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    }
    refresh(); for (let i = 0; i < 3; i++) await nextFrame(); return status()
  },
  async advance(seconds: number, fixtureBpm = bpm, fixturePaused = false, fixtureSource = sourcePresent) {
    bpm = fixtureBpm; paused = fixturePaused; sourcePresent = fixtureSource
    target += seconds * 1000
    while (timestamp < target) await nextFrame()
    await nextFrame(); return status()
  },
  async reenter(preserve = false) {
    const saved = preserve ? runtime.getParameterState().serialize() : undefined
    runtime.dispose(); AudioFeatureBus.reset(); fixtureEnabled = false; fixture = {}; trackId = 'psylo-host-timing-fixture'; timestamp = 0; target = 0; trackTime = 0; paused = false; sourcePresent = false; bpm = 100
    const next = create(saved); if (!next.runtime) throw new Error(String(next.error))
    runtime = next.runtime; resize(); runtime.start(); refresh(); await nextFrame(); return status()
  },
  async inspector(show: boolean) { host.style.display = show ? 'block' : 'none'; refresh(); for (let i = 0; i < 3; i++) await nextFrame(); return status() },
  dispose() { runtime.dispose(); inspector.unmount(); return status() },
}
Object.assign(window, { __psyloProduction: api })
addEventListener('resize', resize)
addEventListener('pagehide', () => runtime.dispose(), { once: true })
