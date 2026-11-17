import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_EVENT_HORIZON_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2EventHorizonPreset'
import type { Cinema2ParameterId, Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { ifritMusicFixture, type IfritFixtureOptions } from '../support/IfritMusicFixture'

const canvas = document.querySelector<HTMLCanvasElement>('#event-horizon')
if (!canvas) throw new Error('Event Horizon review canvas is missing.')
AudioFeatureBus.reset()
let stepMs = 1000 / 60
let timestamp = 0, targetTime = 0, musicTime = 0, source = false, bpm = 120, sequence = 0, dirty = false
let fixture: Partial<IfritFixtureOptions> = {}
const quality = (new URLSearchParams(location.search).get('quality') ?? 'high') as Cinema2RenderQualityLevel
const result = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_EVENT_HORIZON_PRESET_ID, renderQuality: quality, diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'event-horizon-review' },
  requestAnimationFrame: callback => requestAnimationFrame(() => {
    const before = timestamp
    timestamp = Math.min(targetTime, timestamp + stepMs)
    if (source && (before !== timestamp || dirty)) {
      musicTime += (timestamp - before) / 1000
      AudioFeatureBus.setFrame(ifritMusicFixture({ ...fixture, bpm, timeSec: musicTime, frameId: ++sequence }))
      dirty = false
    }
    callback(timestamp)
  }),
  cancelAnimationFrame: id => cancelAnimationFrame(id),
  transportSource: { getState: () => ({ sourcePresent: source, playing: source, analysisActive: source, paused: false, trackId: source ? 'event-horizon-review' : null, timeSec: source ? musicTime : timestamp / 1000, bpm, bpmSync: false }) },
})
if (!result.runtime) throw new Error(result.error ?? 'Event Horizon runtime failed')
const runtime = result.runtime
runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
runtime.start()
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const settle = async () => { for (let i = 0; i < 4; i++) await frame() }
const status = () => ({
  snapshot: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(),
  camera: runtime.getCameraRuntimeSnapshot(), resources: runtime.getResourceManagerSnapshot(), parameters: runtime.getParameterState().getSnapshot(),
  choreography: runtime.getChoreographyRuntimeSnapshot(),
})
const api = {
  status,
  async set(values: Record<string, unknown>) {
    for (const [name, value] of Object.entries(values)) {
      const id = (name.startsWith('event-horizon-') ? name : `event-horizon-${name}`) as Cinema2ParameterId
      const changed = runtime.getParameterState().setPersistentValue(id, value)
      if (!changed.ok) throw new Error(JSON.stringify(changed.diagnostics))
    }
    await settle(); return status()
  },
  /** Frame length in milliseconds; a longer step moves the camera along its flight in fewer frames. */
  setStep(milliseconds: number) { stepMs = milliseconds },
  async reset() { runtime.getParameterState().resetAll(); await settle(); return status() },
  async music(options: Partial<IfritFixtureOptions>, enabled = true) {
    source = enabled
    if (options.timeSec != null) musicTime = options.timeSec
    if (options.bpm != null) bpm = options.bpm
    fixture = { ...options, eventTime: options.eventTime ?? musicTime }
    dirty = true
    if (!enabled) AudioFeatureBus.reset()
    await settle(); return status()
  },
  async advance(seconds: number) {
    targetTime += seconds * 1000
    while (timestamp < targetTime - 0.001) await frame()
    await settle(); return status()
  },
  dispose() { runtime.dispose(); return status() },
}
declare global { interface Window { __eventHorizon?: typeof api } }
window.__eventHorizon = api
addEventListener('resize', () => runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }))
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
