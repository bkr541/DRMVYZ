import { createCinema2WorkspaceMediaPoolSource } from '../../components/vyzualz/react/Cinema2WorkspaceMediaPoolSource'
/** Deterministic review of the real Cinema 2.0 typography preset registry, renderer, modules, effects and audio bridge. */
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_ORBITAL_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2OrbitalPreset'
import { CINEMA2_SUBMERGE_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2SubmergePreset'
import { CINEMA2_LIVEWIRE_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2LivewirePreset'
import { CINEMA2_CORRIDOR_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2CorridorPreset'
import { CINEMA2_EVERYWHERE_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2EverywherePreset'
import { setAutoPerformanceUserDefault } from '../../lib/autoPerformanceDefault'
import { Cinema2AudioIntelligenceBridge } from '../../components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ParameterId, Cinema2JsonValue } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../support/NightshiftMusicFixture'

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const query = new URLSearchParams(location.search)
const presets = { orbital: CINEMA2_ORBITAL_PRESET_ID, submerge: CINEMA2_SUBMERGE_PRESET_ID, livewire: CINEMA2_LIVEWIRE_PRESET_ID, corridor: CINEMA2_CORRIDOR_PRESET_ID, everywhere: CINEMA2_EVERYWHERE_PRESET_ID }
const requested = query.get('preset')
const slug = requested === 'livewire' || requested === 'orbital' || requested === 'corridor' || requested === 'everywhere' ? requested : 'submerge'
if (slug === 'livewire' || slug === 'corridor' || slug === 'everywhere') setAutoPerformanceUserDefault(query.get('auto') === 'on')
const quality = query.get('quality') === 'low' ? 'low' : query.get('quality') === 'medium' ? 'medium' : 'high'
let timestampMs = 0, publication = 0, nextFrameId = 0
const queuedFrames = new Map<number, FrameRequestCallback>()
let music: Partial<NightshiftFixtureOptions> & { active?: boolean; paused?: boolean } = {}
let musicAnchor = 0, anchorTimestamp = 0
const musicTime = () => musicAnchor + (music.paused ? 0 : (timestampMs - anchorTimestamp) / 1000)
const bridge = new Cinema2AudioIntelligenceBridge({
  getFrame: () => {
    publication += 1
    return music.active
      ? nightshiftMusicFixture({ ...music, frameId: music.frameId ?? publication, timeSec: musicTime(), advanceBeatGrid: true })
      : DEFAULT_MI_FRAME
  },
  getPublicationMeta: () => ({ sequence: publication, publisherId: `${slug}-production-review`, kind: 'frame', publishedAtMs: timestampMs }),
})
const created = Cinema2Runtime.create(canvas, {
  mediaPoolSource: slug === 'everywhere' ? createCinema2WorkspaceMediaPoolSource(CINEMA2_EVERYWHERE_PRESET_ID) : undefined,
  presetId: presets[slug], renderQuality: quality, diagnosticsEnabled: true,
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
    authored: runtime.getParameterState().serialize(), choreography: runtime.getChoreographyRuntimeSnapshot(),
    media: runtime.getMediaSlotRuntime().getSnapshot() }
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
  async setMusic(next: typeof music, eventDelaySec?: number) {
    musicAnchor = musicTime(); anchorTimestamp = timestampMs; music = { ...music, frameId: undefined, ...next }
    if (eventDelaySec !== undefined) music.eventTime = musicAnchor + eventDelaySec
    await settle(3); return status()
  },
  async seek(seconds: number) {
    musicAnchor = seconds
    anchorTimestamp = timestampMs
    await settle(3)
    return status()
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
Object.assign(window, { [`__${slug}`]: api })
if ((slug === 'corridor' || slug === 'everywhere') && query.has('inspector')) {
  void Promise.all([
    import('react'), import('react-dom/client'), import('../../components/vyzualz/react/Cinema2InspectorPanel'),
    import('../../styles/typography.css'), import('../../styles/reactView.css'),
  ]).then(([{ createElement }, { createRoot }, { Cinema2InspectorPanel }]) => {
    const element = document.createElement('aside')
    element.id = `${slug}-inspector`
    element.style.cssText = 'position:fixed;z-index:10;right:0;top:0;bottom:0;width:365px;overflow:auto;background:#14191f;color:#fff;padding:10px'
    document.body.append(element)
    const root = createRoot(element)
    root.render(createElement(Cinema2InspectorPanel, { runtime, surface: 'design', sharedAudioAnalysis: false }))
    addEventListener('beforeunload', () => root.unmount(), { once: true })
  })
}
if (slug === 'everywhere' && query.has('source')) {
  void Promise.all([
    import('react'), import('react-dom/client'), import('../../components/vyzualz/react/Cinema2MediaSourcePanel'),
    import('../../context/AudioEngineContext'), import('../../stores/mediaStore'),
    import('../../styles/typography.css'), import('../../styles/reactView.css'),
  ]).then(([{ createElement }, { createRoot }, { Cinema2MediaSourcePanel }, { AudioEngineProvider }, { useMediaStore }]) => {
    const testImage = document.createElement('canvas')
    testImage.width = 160
    testImage.height = 120
    const drawing = testImage.getContext('2d')!
    drawing.fillStyle = '#050609'
    drawing.fillRect(0, 0, 160, 120)
    drawing.fillStyle = '#f4faff'
    drawing.font = 'bold 22px sans-serif'
    drawing.textAlign = 'center'
    drawing.fillText('WORDMARK', 80, 68, 148)
    const url = testImage.toDataURL()
    drawing.fillStyle = '#eb25d7'
    drawing.fillRect(0, 0, 160, 120)
    drawing.fillStyle = '#ffbd25'
    drawing.fillRect(80, 60, 80, 60)
    const secondUrl = testImage.toDataURL()
    useMediaStore.setState({
      queryItemIds: ['crt-test-image', 'crt-pool-image'],
      items: [{
        id: 'crt-test-image', name: 'CRT test image', type: 'image', url, thumbnailUrl: url,
        mimeType: 'image/png', mediaRole: 'other', favorite: false, tags: [], collectionIds: [],
        meta: 'PNG · 160×120', metadata: { width: 160, height: 120 },
      }, {
        id: 'crt-pool-image', name: 'CRT pool image', type: 'image', url: secondUrl, thumbnailUrl: secondUrl,
        mimeType: 'image/png', mediaRole: 'other', favorite: false, tags: [], collectionIds: [],
        meta: 'PNG · 160×120', metadata: { width: 160, height: 120 },
      }],
      setLibraryQuery: () => {},
      ensureLibraryLoaded: async () => {},
      ensureMediaSigned: async () => {},
    })
    const element = document.createElement('aside')
    element.id = 'everywhere-source'
    element.style.cssText = 'position:fixed;z-index:10;left:0;top:0;bottom:0;width:315px;overflow:auto;background:#14191f;color:#fff;padding:10px'
    document.body.append(element)
    const root = createRoot(element)
    root.render(createElement(AudioEngineProvider, null, createElement(Cinema2MediaSourcePanel, { runtime,
      onOpenMediaManager: () => { element.dataset.mediaManagerOpened = 'true' },
    })))
    addEventListener('beforeunload', () => root.unmount(), { once: true })
  })
}
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
