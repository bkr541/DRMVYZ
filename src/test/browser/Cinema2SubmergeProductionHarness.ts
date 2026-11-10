/** Deterministic review of the real Cinema 2.0 typography preset registry, renderer, modules, effects and audio bridge. */
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_ORBITAL_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2OrbitalPreset'
import { CINEMA2_SUBMERGE_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2SubmergePreset'
import { Cinema2AudioIntelligenceBridge } from '../../components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ParameterId, Cinema2JsonValue } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../support/NightshiftMusicFixture'

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const query = new URLSearchParams(location.search)
const orbital = query.get('preset') === 'orbital'
const slug = orbital ? 'orbital' : 'submerge'
const quality = query.get('quality') === 'low' ? 'low' : query.get('quality') === 'medium' ? 'medium' : 'high'
let timestampMs = 0, publication = 0, nextFrameId = 0
const queuedFrames = new Map<number, FrameRequestCallback>()
let music: Partial<NightshiftFixtureOptions> & { active?: boolean; paused?: boolean; bpm?: number } = {}
let musicAnchor = 0, anchorTimestamp = 0
const musicTime = () => musicAnchor + (music.paused ? 0 : (timestampMs - anchorTimestamp) / 1000)
const bridge = new Cinema2AudioIntelligenceBridge({
  getFrame: () => music.active ? nightshiftMusicFixture({ ...music, frameId: ++publication, timeSec: musicTime(), advanceBeatGrid: true }) : DEFAULT_MI_FRAME,
  getPublicationMeta: () => ({ sequence: publication, publisherId: `${slug}-production-review`, kind: 'frame', publishedAtMs: timestampMs }),
})
const created = Cinema2Runtime.create(canvas, {
  presetId: orbital ? CINEMA2_ORBITAL_PRESET_ID : CINEMA2_SUBMERGE_PRESET_ID, renderQuality: quality, diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: `${slug}-review` }, audioIntelligenceBridge: bridge,
  requestAnimationFrame(callback) {
    const id = ++nextFrameId
    queuedFrames.set(id, callback)
    return id
  },
  cancelAnimationFrame: id => { queuedFrames.delete(id) },
  transportSource: { getState: () => ({ sourcePresent: !!music.active, playing: !!music.active && !music.paused,
    analysisActive: !!music.active, paused: !!music.paused, trackId: music.active ? `${slug}-fixture` : null,
    timeSec: music.active ? musicTime() : 0, bpmSync: true, bpm: music.bpm ?? 120 }) },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime
runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
runtime.start()
const browserFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
async function renderFrame(deltaMs = 0) {
  await browserFrame()
  timestampMs += deltaMs
  const callbacks = [...queuedFrames.values()]
  queuedFrames.clear()
  for (const callback of callbacks) callback(timestampMs)
}
async function settle(count = 3) {
  for (let frame = 0; frame < count; frame += 1) await renderFrame()
}
async function advance(seconds: number) {
  const count = Math.max(1, Math.ceil(seconds * 20))
  for (let frame = 0; frame < count; frame += 1) await renderFrame(seconds * 1000 / count)
}
function status() {
  return { snapshot: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), effects: runtime.getEffectRuntimeSnapshot(),
    performance: runtime.getPerformanceSnapshot(), camera: runtime.getCameraRuntimeSnapshot().camera,
    authored: runtime.getParameterState().serialize(), choreography: runtime.getChoreographyRuntimeSnapshot() }
}
const api = {
  async prepare() {
    for (let attempt = 0; attempt < 600; attempt += 1) {
      await renderFrame()
      const modules = runtime.getModuleRuntimeSnapshot()
      if (modules.failedModuleCount) throw new Error(JSON.stringify(modules))
      if (modules.activeModuleCount && modules.estimatedGpuBytes > 0) { await advance(1); return status() }
    }
    throw new Error(`${slug} did not become GPU-resident: ${JSON.stringify(runtime.getModuleRuntimeSnapshot())}`)
  },
  async setParameters(values: Record<string, Cinema2JsonValue>) {
    const result = runtime.getParameterState().setPersistentValues(Object.fromEntries(Object.entries(values).map(([name, value]) => [`${slug}-${name}` as Cinema2ParameterId, value])))
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    await settle(3); return status()
  },
  async advanceBy(seconds: number) { await advance(seconds); return status() },
  async setMusic(next: typeof music) {
    musicAnchor = musicTime(); anchorTimestamp = timestampMs; music = { ...music, ...next }
    await settle(3); return status()
  },
  async resize(width: number, height: number) { runtime.resize({ width, height, dpr: 1 }); await settle(3); return status() },
  async restoreContext() {
    const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')
    if (!extension) throw new Error('WEBGL_lose_context is unavailable.')
    const generation = runtime.getSnapshot().contextGeneration
    extension.loseContext()
    for (let attempt = 0; attempt < 120 && runtime.getSnapshot().phase !== 'context-lost'; attempt += 1) await browserFrame()
    if (runtime.getSnapshot().phase !== 'context-lost') throw new Error('SUBMERGE did not enter the context-lost phase.')
    await browserFrame()
    extension.restoreContext()
    for (let attempt = 0; attempt < 360; attempt += 1) {
      await renderFrame()
      const snapshot = runtime.getSnapshot()
      const modules = runtime.getModuleRuntimeSnapshot()
      if (snapshot.phase === 'unavailable' || modules.failedModuleCount) throw new Error(JSON.stringify({ snapshot, modules }))
      if (snapshot.phase === 'running' && snapshot.contextGeneration > generation && modules.estimatedGpuBytes > 0) {
        await settle(4)
        return status()
      }
    }
    throw new Error(`SUBMERGE context did not recover: ${JSON.stringify(status())}`)
  },
  status,
}
Object.assign(window, { [orbital ? '__orbital' : '__submerge']: api })
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
