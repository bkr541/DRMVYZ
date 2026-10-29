import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_INERTIA_PRESET_ID, CINEMA2_INERTIA_PRESET_MANIFEST, inertiaParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2InertiaPreset'
import { Cinema2PresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { CINEMA2_RUNTIME_FOUNDATION_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import type { Cinema2JsonValue, Cinema2PresetId } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { INERTIA_AUDIO_CHANNELS } from '../../components/vyzualz/cinema2/presets/Cinema2InertiaAudioRoutes'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { MusicIntelligenceAnalyserFramePump } from '../../features/musicIntelligence/MusicIntelligenceAnalyserFramePump'
import { musicIntelligenceEngine } from '../../features/musicIntelligence/MusicIntelligenceEngine'
import { inertiaMusicFixture, type InertiaFixtureOptions } from '../support/InertiaMusicFixture'

const canvas = document.querySelector<HTMLCanvasElement>('#inertia-audio')!
const query = new URLSearchParams(location.search)
const requestedQuality = query.get('quality')
const quality = requestedQuality === 'low' || requestedQuality === 'high' ? requestedQuality : 'medium'
const noDirector = query.has('no-director')
const isolatedRegistry = noDirector ? new Cinema2PresetRegistry() : undefined
if (isolatedRegistry) {
  const registered = isolatedRegistry.register({ ...CINEMA2_INERTIA_PRESET_MANIFEST,
    choreography: { rules: CINEMA2_INERTIA_PRESET_MANIFEST.choreography!.rules.filter(rule => !rule.source.path?.startsWith('director.')) } })
  if (!registered.ok) throw new Error(JSON.stringify(registered.diagnostics))
}
let timestamp = 0, target = 0, musicTime = 0, source = false, paused = false, track = 'inertia-audio-proof'
let stepMs = new URLSearchParams(location.search).has('fine') ? 5 : 100
let fixture: InertiaFixtureOptions = {}, frameId = 0, heldFrame: number | null = null, dirty = false
let published = inertiaMusicFixture({}, 0, 0, track)
let audioContext: AudioContext | null = null, analyser: AnalyserNode | null = null, realSource: AudioBufferSourceNode | null = null
let pump: MusicIntelligenceAnalyserFramePump | null = null, realOffset = 0, realStart = 0
let refresh: (() => void) | null = null
AudioFeatureBus.reset()
const tick = (callback: FrameRequestCallback) => requestAnimationFrame(() => {
  if (audioContext && analyser && pump) {
    timestamp = performance.now()
    musicTime = realOffset + audioContext.currentTime - realStart
    pump.sample({ analyser, audioTime: musicTime, isPlaying: true, trackIdentity: track })
  } else {
    const previous = timestamp
    timestamp = Math.min(target, timestamp + stepMs)
    if (source && !paused) musicTime += (timestamp - previous) / 1000
    if (source && (dirty || (!paused && timestamp !== previous))) {
      const holding = fixture.holdEvent && musicTime >= (fixture.eventTime ?? 0) - 0.0001
      if (holding && heldFrame == null) heldFrame = ++frameId
      published = inertiaMusicFixture(fixture, musicTime, holding ? heldFrame! : ++frameId, track)
      AudioFeatureBus.setFrame(published, 'inertia-fixture')
      dirty = false
    }
  }
  callback(timestamp)
})
function create(presetId: Cinema2PresetId = CINEMA2_INERTIA_PRESET_ID, serializedParameterState?: string): Cinema2Runtime {
  const result = Cinema2Runtime.create(canvas, {
    presetId, serializedParameterState, diagnosticsEnabled: true, renderQuality: quality,
    ...(isolatedRegistry && presetId === CINEMA2_INERTIA_PRESET_ID ? { presetRegistry: isolatedRegistry } : {}),
    randomness: { mode: 'deterministic', seed: 'inertia-audio-proof' },
    requestAnimationFrame: tick, cancelAnimationFrame: id => cancelAnimationFrame(id),
    transportSource: { getState: () => ({ sourcePresent: source, playing: source && !paused, analysisActive: source,
      paused, trackId: source ? track : null, timeSec: musicTime, bpm: 120, bpmSync: false }) },
  })
  if (!result.runtime) throw new Error(result.error)
  return result.runtime
}
let runtime = create()
const resize = () => runtime.resize({ width: canvas.clientWidth, height: canvas.clientHeight, dpr: devicePixelRatio })
resize(); runtime.start()
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
async function settle() { for (let i = 0; i < 4; i++) await frame() }
function status() {
  return {
    snapshot: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), effects: runtime.getEffectRuntimeSnapshot(),
    camera: runtime.getCameraRuntimeSnapshot().camera, transport: runtime.getTransportFrameState(), audio: runtime.getAudioIntelligenceFrame(),
    authored: runtime.getParameterState().serialize(), choreography: runtime.getChoreographyRuntimeSnapshot(),
    director: runtime.getVisualDirectorFrame(), history: runtime.getHistoryServiceSnapshot(),
    performance: runtime.getPerformanceSnapshot(), resources: runtime.getResourceManagerSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(),
    channels: Object.fromEntries(Object.keys(INERTIA_AUDIO_CHANNELS).map(name => {
      const channel = runtime.getCompiledPresetPlan().targets.targets.find(t => t.kind === 'module' && t.property === name)
      return [name, channel ? runtime.getTargetResolver().resolve(channel.id).value : null]
    })),
    pump: pump?.diagnostics ?? null,
  }
}
const api = {
  async prepare() { await settle(); return status() },
  status,
  precision(ms: number) { stepMs = Math.max(5, Math.min(100, ms)); return status() },
  async resize() { resize(); await settle(); return status() },
  async set(values: Record<string, Cinema2JsonValue>) {
    for (const [key, value] of Object.entries(values)) {
      const result = runtime.getParameterState().setPersistentValue(inertiaParameterId(key), value)
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    }
    refresh?.(); await settle(); return status()
  },
  async music(options: InertiaFixtureOptions & { timeSec?: number; track?: string; paused?: boolean; source?: boolean }) {
    if (options.timeSec != null) musicTime = options.timeSec
    if (options.track != null) track = options.track
    source = options.source !== false; paused = options.paused ?? false
    fixture = { ...options, eventTime: options.event || options.transient ? options.eventTime ?? musicTime + 0.1 : undefined }
    heldFrame = null; dirty = true
    if (!source) AudioFeatureBus.reset()
    await settle(); return status()
  },
  async advance(seconds: number) {
    target = timestamp + seconds * 1000
    while (timestamp < target - 0.001) await frame()
    await settle(); return status()
  },
  async repeat() { AudioFeatureBus.setFrame(published, 'inertia-fixture'); await settle(); return status() },
  async pause(value: boolean) { paused = value; await settle(); return status() },
  async reenter() {
    const saved = runtime.getParameterState().serialize()
    runtime.dispose(); const retired = runtime.getSnapshot()
    const other = create(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
    other.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); other.start(); await settle(); other.dispose()
    runtime = create(CINEMA2_INERTIA_PRESET_ID, saved); resize(); runtime.start(); refresh?.(); await settle()
    return { retired, current: status() }
  },
  async inspector() {
    const host = document.createElement('aside')
    host.style.cssText = 'position:fixed;right:0;top:0;width:380px;height:100%;overflow:auto;background:#141419'
    document.body.append(host); canvas.style.width = 'calc(100% - 380px)'
    const { mountInertiaInspector } = await import('./Cinema2InertiaInspectorFixture')
    refresh = mountInertiaInspector(host, runtime); resize(); await settle(); return status()
  },
  async playAudio(encoded: string, offset = 5) {
    audioContext = new AudioContext(); await audioContext.resume()
    const data = Uint8Array.from(atob(encoded), c => c.charCodeAt(0)).buffer
    const buffer = await audioContext.decodeAudioData(data)
    realOffset = Math.min(offset, buffer.duration / 2); realStart = audioContext.currentTime
    analyser = audioContext.createAnalyser(); analyser.fftSize = 2048
    const mute = audioContext.createGain(); mute.gain.value = 0
    realSource = audioContext.createBufferSource(); realSource.buffer = buffer
    realSource.connect(analyser); analyser.connect(mute); mute.connect(audioContext.destination)
    track = 'inertia-reference-soundtrack'; source = true; paused = false
    musicIntelligenceEngine.setSourceId(track, track)
    pump = new MusicIntelligenceAnalyserFramePump({ publisherId: 'inertia-real-audio' })
    realSource.start(0, realOffset); await settle(); return status()
  },
  async stopAudio() {
    realSource?.stop(); realSource?.disconnect(); realSource = null
    pump?.dispose(); pump = null; analyser?.disconnect(); analyser = null
    await audioContext?.close(); audioContext = null; target = timestamp
    source = false; AudioFeatureBus.reset(); await settle(); return status()
  },
}
Object.assign(window, { __inertiaAudio: api })
addEventListener('resize', resize)
addEventListener('pagehide', () => { runtime.dispose(); pump?.dispose(); void audioContext?.close() }, { once: true })
