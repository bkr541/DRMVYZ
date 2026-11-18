import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { cinema2NativePresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { CINEMA2_OPEN_DECKS_PRESET_ID, openDecksParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2OpenDecksPreset'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
const quality = new URLSearchParams(location.search).get('quality') === 'low' ? 'low' : 'high'
const result = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_OPEN_DECKS_PRESET_ID,
  presetRegistry: cinema2NativePresetRegistry,
  renderQuality: quality,
})
if (!result.runtime) throw new Error(`Open Decks could not start: ${result.error}`)
const runtime = result.runtime
function resize() { runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }) }
resize()
addEventListener('resize', resize)
runtime.start()
const review = {
  snapshot: () => ({
    runtime: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(),
    render: runtime.getRenderGraphExecutorSnapshot(), effects: runtime.getEffectRuntimeSnapshot(),
  }),
  set: (name: string, value: number | readonly number[]) => runtime.getParameterState().setPersistentValue(openDecksParameterId(name), value),
  dispose: () => { runtime.dispose(); return runtime.getResourceManagerSnapshot() },
}
Object.assign(window, { openDecksReview: review })
addEventListener('pagehide', () => runtime.dispose(), { once: true })
