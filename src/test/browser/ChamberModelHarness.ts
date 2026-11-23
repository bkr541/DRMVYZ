import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { Cinema2ModuleRegistry } from '../../components/vyzualz/cinema2/modules/Cinema2ModuleRegistry'
import { createCinema2ThreeSceneModuleDefinition } from '../../components/vyzualz/cinema2/modules/Cinema2ThreeSceneModule'
import { CINEMA2_CHAMBER_MODULE_TYPE_ID, Cinema2ChamberController } from '../../components/vyzualz/cinema2/modules/Cinema2ChamberNativeModule'
import { CINEMA2_CHAMBER_PRESET_ID, chamberParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2ChamberPreset'
import { Cinema2UserModelCache } from '../../components/vyzualz/cinema2/model/Cinema2UserModelCache'
import { Cinema2UserModelResolver } from '../../components/vyzualz/cinema2/model/Cinema2UserModelResolver'
import type { Cinema2JsonValue } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { modelAssetRepository as repo } from '../../features/models/data/modelAssetRepository'
import { createModelArtifact, createDefaultModelRecipe } from '../../features/models/generator/createModelArtifact'

// Review harness for the Chamber's model slot: the real Chamber preset and runtime on a real WebGL canvas, with two generated models standing in for the user's
// library (the model repository is stubbed; nothing touches an account). Time moves only when a check advances it.
const canvas = document.querySelector<HTMLCanvasElement>('#chamber-model')!
const OWNER = 'a0000000-0000-4000-8000-000000000001'
const ids = ['c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003']
// Two generated shapes, and a wide logo-like mark (separate rounded blocks and a triangle, 3.2 : 1): a wide logo is the model the chamber is meant to show.
const WORDMARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100"><path fill="#000" d="M0 0h28a24 50 0 0 1 0 100H0z"/><path fill="#000" d="M60 0h26l22 100H82z"/><path fill="#000" d="M118 0h24l18 70 18-70h24l-30 100h-24z"/><path fill="#000" d="M210 0h26a24 24 0 0 1 0 52h-26z"/><path fill="#000" d="M268 0h52v22h-30v16h30v22h-30v40h-22z"/></svg>'
const fixtures = ['donut.svg', 'islands.svg', 'wordmark']
const fixture = async (name: string) => name === 'wordmark' ? new Blob([WORDMARK], { type: 'image/svg+xml' }) : (await fetch(`/src/features/models/__tests__/fixtures/${name}`)).blob()
const recipe = createDefaultModelRecipe()
const models = await Promise.all(fixtures.map(async name => createModelArtifact({ source: await fixture(name), recipe })))
const urls = models.map(model => URL.createObjectURL(model.glb))
const assets = ids.map((id, index) => ({ id, userId: OWNER, sourceMediaId: null, name: ['Cutout model', 'Wide model', 'Wordmark model'][index]!, description: null, favorite: false, status: 'ready' as const, currentVersion: 1, createdAt: '2026-11-12T00:00:00Z', updatedAt: '2026-11-12T00:00:00Z' }))
repo.get = (async (id: string) => assets.find(asset => asset.id === id)!) as typeof repo.get
repo.getVersion = (async (id: string, version: number) => ({ modelAssetId: id, version, generatorRecipe: models[ids.indexOf(id)]!.recipe, geometryStats: models[ids.indexOf(id)]!.stats })) as unknown as typeof repo.getVersion
repo.signedUrl = (async (id: string, _version: number, kind: string) => ({ url: kind === 'thumbnailPath' ? '' : urls[ids.indexOf(id)]!, expiresAt: Date.now() + 60000 })) as unknown as typeof repo.signedUrl
const cache = new Cinema2UserModelCache(new Cinema2UserModelResolver({ repository: repo, currentUser: async () => OWNER } as never))
const modules = new Cinema2ModuleRegistry()
modules.register(createCinema2ThreeSceneModuleDefinition({
  typeId: CINEMA2_CHAMBER_MODULE_TYPE_ID, resourceKey: 'chamber-native:bridge', createModelController: library => new Cinema2ChamberController(library),
  userModels: cache, subscribeModelAccount: () => () => undefined,
}))

let timestampMs = 0, targetMs = 0
let transport = { present: false, paused: false, bpm: 120 as number | null }
const created = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_CHAMBER_PRESET_ID, moduleRegistry: modules, diagnosticsEnabled: true, renderQuality: 'high',
  requestAnimationFrame: callback => requestAnimationFrame(() => { timestampMs = Math.min(targetMs, timestampMs + 100); callback(timestampMs) }), cancelAnimationFrame: id => cancelAnimationFrame(id),
  transportSource: { getState: () => ({ sourcePresent: transport.present, playing: transport.present && !transport.paused, analysisActive: false, paused: transport.paused, trackId: transport.present ? 'chamber-model' : null, timeSec: timestampMs / 1000, bpmSync: true, bpm: transport.bpm }) },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime
const resize = () => { const bounds = canvas.getBoundingClientRect(); runtime.resize({ width: bounds.width, height: bounds.height, dpr: devicePixelRatio }) }
resize(); addEventListener('resize', resize); runtime.start()
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
async function settle() {
  const target = runtime.getSnapshot().frameCount + 3
  while (runtime.getSnapshot().frameCount < target) {
    if (runtime.getSnapshot().phase === 'unavailable') throw new Error(runtime.getSnapshot().statusMessage ?? 'Chamber runtime unavailable')
    await frame()
  }
}
const status = () => ({ snapshot: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), effects: runtime.getEffectRuntimeSnapshot(), camera: runtime.getCameraRuntimeSnapshot().camera, cache: cache.getSnapshot() })
const api = {
  async prepare() { await settle(); return status() },
  /** A model from the stand-in library by number, or 'default' for none. Waits for it to load. */
  async bind(which: number | 'default') {
    runtime.getParameterState().setPersistentValue(chamberParameterId('model'), which === 'default' ? 'default-model' : `user-model:${ids[which]}:1`)
    for (let i = 0; i < 120; i++) { await settle(); const inspected = JSON.stringify(runtime.getModuleRuntimeSnapshot()); if (which === 'default' || inspected.includes('"modelPlaced":true')) break; await new Promise(resolve => setTimeout(resolve, 100)) }
    await settle(); return status()
  },
  async set(values: Record<string, Cinema2JsonValue>) {
    for (const [key, value] of Object.entries(values)) { const result = runtime.getParameterState().setPersistentValue(chamberParameterId(key), value); if (!result.ok) throw new Error(JSON.stringify(result.diagnostics)) }
    await settle(); return status()
  },
  async advanceBy(seconds: number) {
    targetMs = timestampMs + seconds * 1000
    while (timestampMs < targetMs - 0.001) await frame()
    await settle(); return status()
  },
  async setTransport(values: Partial<typeof transport>) { transport = { ...transport, ...values }; await settle(); return status() },
  status,
  dispose() { runtime.dispose(); return status() },
}
Object.assign(window, { __chamberModel: api })
addEventListener('pagehide', () => runtime.dispose(), { once: true })
