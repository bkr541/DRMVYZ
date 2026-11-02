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
import { CINEMA2_PSYLO_PRESET_ID, psyloParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2PsyloPreset'
import { createCinema2DesignParentGroupModel } from '../../components/vyzualz/cinema2/parameters/Cinema2InspectorModel'
import type { Cinema2JsonValue } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'

const canvas = document.querySelector<HTMLCanvasElement>('#psylo-production')!
const quality = new URLSearchParams(location.search).get('quality') === 'low' ? 'low' : 'high'
AudioFeatureBus.reset()
let fixture: Partial<PsyloFixtureOptions> = {}, fixtureEnabled = false, sequence = 1, trackId = 'psylo-host-timing-fixture'
let fixtureDirty = false, lastPublication = psyloMusicFixture({ timeSec: 0, frameId: 1 })
const publish = () => { lastPublication = psyloMusicFixture({ ...fixture, trackId, timeSec: trackTime, frameId: ++sequence }); AudioFeatureBus.setFrame(lastPublication); fixtureDirty = false }
let timestamp = 0, target = 0, trackTime = 0, paused = false, bpm = 100, sourcePresent = false
const create = (serializedParameterState?: string) => Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_PSYLO_PRESET_ID, renderQuality: quality, diagnosticsEnabled: true, serializedParameterState,
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
const status = () => ({ runtime: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(),
  camera: runtime.getCameraRuntimeSnapshot().camera, resources: runtime.getResourceManagerSnapshot(), parameters: runtime.getParameterState().getSnapshot(),
  audio: runtime.getAudioIntelligenceFrame(), transport: runtime.getTransportFrameState(),
  groups: createCinema2DesignParentGroupModel(runtime.getCompiledPresetPlan(), runtime.getParameterState().getSnapshot()) })
function resize() { runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); return status() }
resize(); runtime.start(); refresh()
const api = {
  status, resize,
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
