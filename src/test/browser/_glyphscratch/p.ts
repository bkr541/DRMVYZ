import { Cinema2Runtime } from '../../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { cinema2NativePresetRegistry } from '../../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { CINEMA2_PARALLAX_CIPHER_TEXT_ID, CINEMA2_PARALLAX_CIPHER_LINE_TWO_TEXT_ID, parallaxCipherParameterId } from '../../../components/vyzualz/cinema2/presets/Cinema2ParallaxCipherPreset'
const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
let ts = 0, frozen = false
const r = Cinema2Runtime.create(canvas, { presetId: 'drmvyz.cinema2.crate-paradox-weave' as never, presetRegistry: cinema2NativePresetRegistry, renderQuality: 'medium',
  requestAnimationFrame: cb => requestAnimationFrame(() => { if (!frozen) ts += 33.4; cb(ts) }),
  transportSource: { getState: () => ({ sourcePresent: false, playing: false, analysisActive: false, paused: false, trackId: null }) } } as never)
if (!r.runtime) throw new Error(String(r.error))
r.runtime.resize({ width: 1280, height: 720, dpr: 1 }); r.runtime.start()
const ps = () => r.runtime!.getParameterState()
;(window as any).g = {
  set: (id: unknown, v: unknown) => ps().setPersistentValue(id as never, v as never),
  ids: { l1: CINEMA2_PARALLAX_CIPHER_TEXT_ID, l2: CINEMA2_PARALLAX_CIPHER_LINE_TWO_TEXT_ID, p: (n: string) => parallaxCipherParameterId(n) },
  ts: () => ts, freeze: (v: boolean) => { frozen = v }, errors: () => r.runtime!.getSnapshot(),
}
