import { Cinema2AudioIntelligenceBridge } from '../../components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge'
import { nightshiftMusicFixture } from '../support/NightshiftMusicFixture'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { cinema2NativePresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { CINEMA2_OPEN_DECKS_PRESET_ID, openDecksParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2OpenDecksPreset'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
const quality = new URLSearchParams(location.search).get('quality') === 'low' ? 'low' : 'high'
let timeMs = 0, publication = 0, dropTime: number | null = null
let musicActive = false
const bridge = new Cinema2AudioIntelligenceBridge({
  getFrame: () => musicActive ? nightshiftMusicFixture({ timeSec: timeMs / 1000, frameId: ++publication, energy: .75, advanceBeatGrid: true, event: dropTime == null ? null : 'drop', eventTime: dropTime ?? 0, eventId: 1 }) : DEFAULT_MI_FRAME,
  getPublicationMeta: () => ({ sequence: publication, publishedAtMs: timeMs, publisherId: 'open-decks-review', kind: 'frame' }),
})
const audioReview = new URLSearchParams(location.search).has('audio')
const result = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_OPEN_DECKS_PRESET_ID,
  presetRegistry: cinema2NativePresetRegistry,
  renderQuality: quality,
  ...(audioReview ? {
    audioIntelligenceBridge: bridge,
    requestAnimationFrame: (callback: FrameRequestCallback) => requestAnimationFrame(() => { timeMs += 1000 / 30; callback(timeMs) }),
    transportSource: { getState: () => ({ sourcePresent: musicActive, playing: musicActive, analysisActive: musicActive, paused: false, trackId: musicActive ? 'nightshift-audio-fixture' : null, timeSec: timeMs / 1000, bpmSync: true, bpm: 120 }) },
  } : {}),
})
if (!result.runtime) throw new Error(`Open Decks could not start: ${result.error}`)
const runtime = result.runtime
function resize() { runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }) }
resize()
addEventListener('resize', resize)
runtime.start()
const review = {
  snapshot: () => ({
    audio: runtime.getAudioIntelligenceFrame(), choreography: runtime.getChoreographyRuntimeSnapshot(),
    camera: runtime.getCameraRuntimeSnapshot().camera,
    runtime: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(),
    render: runtime.getRenderGraphExecutorSnapshot(), effects: runtime.getEffectRuntimeSnapshot(),
  }),
  set: (name: string, value: boolean | number | readonly number[]) => runtime.getParameterState().setPersistentValue(openDecksParameterId(name), value),
  music: () => { musicActive = true },
  drop: () => { dropTime = (timeMs + 100) / 1000 },
  dispose: () => { runtime.dispose(); return runtime.getResourceManagerSnapshot() },
}
Object.assign(window, { openDecksReview: review })
addEventListener('pagehide', () => runtime.dispose(), { once: true })
