import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { cinema2NativePresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { CINEMA2_WAR_OF_WORLDS_PRESET_ID, warOfWorldsParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2WarOfWorldsPreset'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
const quality = new URLSearchParams(location.search).get('quality') === 'low' ? 'low' : 'high'
const result = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_WAR_OF_WORLDS_PRESET_ID,
  presetRegistry: cinema2NativePresetRegistry,
  renderQuality: quality,
})
if (!result.runtime) throw new Error(`War Of Worlds could not start: ${result.error}`)
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
  set: (name: string, value: number | readonly number[]) => runtime.getParameterState().setPersistentValue(warOfWorldsParameterId(name), value),
  dispose: () => { runtime.dispose(); return runtime.getResourceManagerSnapshot() },
}
Object.assign(window, { warOfWorldsReview: review })
addEventListener('pagehide', () => runtime.dispose(), { once: true })
