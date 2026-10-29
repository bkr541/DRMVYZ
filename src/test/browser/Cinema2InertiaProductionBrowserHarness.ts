import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_INERTIA_PRESET_ID, inertiaParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2InertiaPreset'
import type { Cinema2JsonValue } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { buildCinema2InertiaGeometry, INERTIA_PROOF_POSES, type InertiaProofPose } from '../../components/vyzualz/cinema2/modules/inertia/Cinema2InertiaGeometry'
import { createCinema2DesignParentGroupModel } from '../../components/vyzualz/cinema2/parameters/Cinema2InspectorModel'

const canvas = document.querySelector<HTMLCanvasElement>('#inertia-production')!
const requested = new URLSearchParams(location.search).get('pose')
const pose: InertiaProofPose = INERTIA_PROOF_POSES.includes(requested as InertiaProofPose) ? requested as InertiaProofPose : 'coherent'
let timestampMs = 0, targetMs = 0, seek = 0
let refreshInspector: (() => void) | null = null
let transport = { present: false, paused: false, bpm: 120 as number | null, hostSync: true, track: 'inertia-motion-proof' }
const quality = new URLSearchParams(location.search).get('quality')
const created = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_INERTIA_PRESET_ID, diagnosticsEnabled: true, renderQuality: quality === 'low' || quality === 'high' ? quality : 'medium',
  requestAnimationFrame: callback => requestAnimationFrame(() => { timestampMs = Math.min(targetMs, timestampMs + 100); callback(timestampMs) }),
  cancelAnimationFrame: id => cancelAnimationFrame(id),
  transportSource: { getState: () => ({ sourcePresent: transport.present, playing: transport.present && !transport.paused, analysisActive: false,
    paused: transport.paused, trackId: transport.present ? transport.track : null, timeSec: timestampMs / 1000 + seek, bpmSync: transport.hostSync, bpm: transport.bpm }) },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime
runtime.getParameterState().setPersistentValue(inertiaParameterId('proof-pose'), pose)
function resize() { const bounds = canvas.getBoundingClientRect(); runtime.resize({ width: bounds.width, height: bounds.height, dpr: devicePixelRatio }) }
resize(); addEventListener('resize', resize)
runtime.start()
async function settle() {
  const target = runtime.getSnapshot().frameCount + 3
  while (runtime.getSnapshot().frameCount < target) {
    if (runtime.getSnapshot().phase === 'unavailable') throw new Error(runtime.getSnapshot().statusMessage ?? 'Inertia runtime unavailable')
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
}
function status() {
  return {
    snapshot: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), effects: runtime.getEffectRuntimeSnapshot(),
    camera: runtime.getCameraRuntimeSnapshot().camera, performance: runtime.getPerformanceSnapshot(),
    authored: runtime.getParameterState().serialize(), transport: runtime.getTransportFrameState(),
    groups: createCinema2DesignParentGroupModel(runtime.getCompiledPresetPlan(), runtime.getParameterState().getSnapshot()),
    geometry: buildCinema2InertiaGeometry(runtime.getParameterState().getValue(inertiaParameterId('proof-pose')) as InertiaProofPose, 'medium').counts,
  }
}
const api = {
  async prepare() { await settle(); return status() },
  async set(values: Record<string, Cinema2JsonValue>) {
    for (const [key, value] of Object.entries(values)) {
      const result = runtime.getParameterState().setPersistentValue(inertiaParameterId(key), value)
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    }
    refreshInspector?.(); await settle(); return status()
  },
  async advanceBy(seconds: number) {
    targetMs = timestampMs + seconds * 1000
    while (timestampMs < targetMs - 0.001) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await settle(); return status()
  },
  async setTransport(values: Partial<typeof transport> & { seek?: number }) {
    if (values.seek != null) seek = values.seek - timestampMs / 1000
    transport = { ...transport, ...values }; await settle(); return status()
  },
  async resize() { resize(); await settle(); return status() },
  async dispose() { runtime.dispose(); return status() },
  status,
}
Object.assign(window, { __inertiaProduction: api })
if (new URLSearchParams(location.search).has('inspector')) {
  const panel = document.createElement('aside')
  panel.style.cssText = 'position:fixed;right:0;top:0;width:380px;height:100%;overflow:auto;background:#141419;'
  canvas.style.width = 'calc(100% - 380px)'
  document.body.append(panel)
  void import('./Cinema2InertiaInspectorFixture').then(({ mountInertiaInspector }) => {
    refreshInspector = mountInertiaInspector(panel, runtime); resize()
  })
}
addEventListener('pagehide', () => runtime.dispose(), { once: true })
