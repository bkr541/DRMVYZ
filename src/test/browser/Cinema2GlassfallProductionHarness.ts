import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_GLASSFALL_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2GlassfallPreset'
import { CINEMA2_RUNTIME_FOUNDATION_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { MusicIntelligenceAnalyserFramePump } from '../../features/musicIntelligence/MusicIntelligenceAnalyserFramePump'
import { musicIntelligenceEngine } from '../../features/musicIntelligence/MusicIntelligenceEngine'
import { analyzeTrackBuffer } from '../../features/musicIntelligence/offlineTrackAnalyzer'
import type { Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { glassfallParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2GlassfallPhase2Definition'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { ifritMusicFixture, type IfritFixtureOptions } from '../support/IfritMusicFixture'
import '../../styles/typography.css'
import '../../styles.css'
import '../../styles/vyzualz.css'
import '../../styles/reactView.css'
const canvas = document.querySelector('canvas')!
const live = new URLSearchParams(location.search).has('live')
let runtime: Cinema2Runtime, pending: FrameRequestCallback, timestamp = 0, time = 0, paused = !live, bpm = 120, trackId = 'glassfall-manual-review'
AudioFeatureBus.reset()
let sourcePresent = true, quality: Cinema2RenderQualityLevel = 'high'
let realContext: AudioContext | null = null, realSource: AudioBufferSourceNode | null = null, realAnalyser: AnalyserNode | null = null, realPump: MusicIntelligenceAnalyserFramePump | null = null, realStart = 0
let realFrames = 0, realDuration = 0, realAnalysis: Awaited<ReturnType<typeof analyzeTrackBuffer>> | null = null
const realPeaks: Record<string, number> = {}, realEvents = new Set<string>()
const stopAudio = async () => {
  try { realSource?.stop() } catch { /* Already ended. */ }
  realSource?.disconnect(); realPump?.dispose(); realAnalyser?.disconnect()
  await realContext?.close(); realContext = null; realSource = null; realPump = null; realAnalyser = null
}
let sequence = 0, lastPublishedTime = -1, dirty = true
let fixture: Partial<IfritFixtureOptions> = { energy: 0, bass: 0, high: 0, vocal: 0 }
let published = ifritMusicFixture({ timeSec: 0, frameId: 0, trackId })
const tick = () => {
  if (realContext && realAnalyser && realPump) {
    timestamp = performance.now(); time = Math.min(realDuration, realContext.currentTime - realStart)
    realPump.sample({ analyser: realAnalyser, audioTime: time, isPlaying: !paused, trackIdentity: trackId })
    pending(timestamp); realFrames++
    const audio = runtime.getAudioIntelligenceFrame()
    for (const [name, value] of Object.entries({ energy: audio?.features.overallEnergy.value, bass: audio?.bands.bass.value, high: audio?.bands.high.value })) if (typeof value === 'number') realPeaks[name] = Math.max(realPeaks[name] ?? 0, value)
    for (const event of [audio?.rhythm.beat, audio?.rhythm.kick, audio?.rhythm.snare]) if (event) realEvents.add(event.id)
    return
  }
  if (!sourcePresent) { pending(timestamp); return }
  if (dirty || lastPublishedTime !== time) {
    published = ifritMusicFixture({ ...fixture, timeSec: time, frameId: ++sequence, trackId, bpm })
    AudioFeatureBus.setFrame(published); lastPublishedTime = time; dirty = false
  }
  pending(timestamp)
}
const host = document.createElement('aside')
host.style.cssText = `position:fixed;right:0;top:0;bottom:0;width:360px;overflow:auto;background:#16151f;color:white;padding:12px;display:${live ? 'block' : 'none'}`
document.body.append(host)
const inspector = createRoot(host)
const refresh = () => inspector.render(createElement(Cinema2InspectorPanel, { runtime, surface: 'design', sharedAudioAnalysis: false }))
const enter = (serializedParameterState?: string) => {
  const result = Cinema2Runtime.create(canvas, {
    presetId: CINEMA2_GLASSFALL_PRESET_ID, serializedParameterState,
    renderQuality: quality, diagnosticsEnabled: true,
    requestAnimationFrame: callback => { pending = callback; return 1 }, cancelAnimationFrame() {},
    transportSource: { getState: () => ({ sourcePresent, playing: sourcePresent && !paused, paused, analysisActive: sourcePresent, animationActive: !paused, trackId: sourcePresent ? trackId : null, timeSec: time, bpm, bpmSync: false }) },
  })
  if (!result.runtime) throw new Error(JSON.stringify(result))
  runtime = result.runtime; runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); runtime.start(); tick(); refresh()
}
enter()
const status = () => ({ effects: runtime.getEffectRuntimeSnapshot(), performance: runtime.getPerformanceSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(), resources: runtime.getResourceManagerSnapshot(), parameters: runtime.getParameterState().getSnapshot(), transport: runtime.getTransportFrameState(), audio: runtime.getAudioIntelligenceFrame(), director: runtime.getVisualDirectorFrame(), directorChannels: Object.fromEntries(['intensity','momentum','build','impact'].map(name => {
    const target = runtime.getCompiledPresetPlan().targets.targets.find(t => t.kind === 'module' && t.property === `director-${name}`)
    return [name, target ? runtime.getTargetResolver().resolve(target.id).value : null]
  })), choreography: runtime.getChoreographyRuntimeSnapshot(), channels: Object.fromEntries(['energy','bass','high','vocal','build','kick','snare','drop'].map(name => {
    const target = runtime.getCompiledPresetPlan().targets.targets.find(t => t.kind === 'module' && t.property === `choreo-${name}`)
    return [name, target ? runtime.getTargetResolver().resolve(target.id).value : null]
  })) })
const settle = async () => { tick(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) }
Object.assign(window, { glassfallFinal: {
  status,
  audioEvidence() { return { frames: realFrames, duration: realDuration, peaks: realPeaks, eventCount: realEvents.size, analysisBpm: realAnalysis?.bpm, contextState: realContext?.state } },
  async playAudio(encoded: string) {
    await stopAudio(); realFrames = 0; realEvents.clear(); for (const name of Object.keys(realPeaks)) delete realPeaks[name]
    realContext = new AudioContext(); await realContext.resume()
    const buffer = await realContext.decodeAudioData(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)).buffer)
    realDuration = buffer.duration; realAnalysis = await analyzeTrackBuffer(buffer)
    realAnalyser = realContext.createAnalyser(); realAnalyser.fftSize = 2048
    const mute = realContext.createGain(); mute.gain.value = 0
    realSource = realContext.createBufferSource(); realSource.buffer = buffer; realSource.onended = () => { paused = true }
    realSource.connect(realAnalyser); realAnalyser.connect(mute); mute.connect(realContext.destination)
    sourcePresent = true; paused = false; trackId = 'glassfall-reference-soundtrack'
    musicIntelligenceEngine.setSourceId(trackId, trackId); musicIntelligenceEngine.setTrackAnalysis(realAnalysis)
    realPump = new MusicIntelligenceAnalyserFramePump({ publisherId: 'glassfall-real-reference' })
    realStart = realContext.currentTime; realSource.start(); await settle()
  },
  async stopAudio() { await stopAudio(); sourcePresent = false; AudioFeatureBus.reset(); await settle() },
  async source(enabled: boolean) { sourcePresent = enabled; if (!enabled) AudioFeatureBus.reset(); else dirty = true; await settle() },
  async music(options: Partial<IfritFixtureOptions>) {
    sourcePresent = true; time = options.timeSec ?? time; paused = false; bpm = options.bpm ?? bpm
    fixture = { energy: 0, bass: 0, high: 0, vocal: 0, ...options, eventTime: options.eventTime ?? time }
    if (options.trackId) trackId = options.trackId
    dirty = true; await settle()
  },
  async repeatMusic() { AudioFeatureBus.setFrame(published); await settle() },
  async set(values: Record<string, unknown>) {
    for (const [name, value] of Object.entries(values)) {
      const result = runtime.getParameterState().setPersistentValue(glassfallParameterId(name), value)
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    }
    refresh(); await settle()
  },
  async reset() { runtime.getParameterState().resetAll(); await settle(); refresh() },
  async advance(seconds: number) {
    const target = timestamp + seconds * 1000
    while (timestamp < target - .001) {
      const delta = Math.min(50, target - timestamp); timestamp += delta
      if (!paused) time += delta / 1000
      tick()
    }
    await settle()
  },
  async transport(options: { paused?: boolean; bpm?: number; time?: number; trackId?: string }) {
    paused = options.paused ?? paused; bpm = options.bpm ?? bpm; time = options.time ?? time; trackId = options.trackId ?? trackId
    await settle()
  },
  async showInspector(show: boolean) { host.style.display = show ? 'block' : 'none'; refresh(); await settle() },
  async resize() { runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); await settle() },
  async reenter(preserve = true, nextQuality: Cinema2RenderQualityLevel = 'high') {
    const serialized = preserve ? runtime.getParameterState().serialize() : undefined
    runtime.dispose(); const retired = runtime.getResourceManagerSnapshot()
    const other = Cinema2Runtime.create(canvas, { presetId: CINEMA2_RUNTIME_FOUNDATION_PRESET_ID, requestAnimationFrame: () => 1, cancelAnimationFrame() {} })
    if (!other.runtime) throw new Error(JSON.stringify(other))
    other.runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); other.runtime.start(); other.runtime.dispose()
    quality = nextQuality; enter(serialized); return retired
  },
  dispose() { void stopAudio(); runtime.dispose(); return runtime.getResourceManagerSnapshot() },
} })
let previous = performance.now()
setInterval(() => {
  if (runtime.getSnapshot().phase === 'disposed') return
  const now = performance.now(), delta = Math.min(100, now - previous); previous = now
  if (live) { timestamp += delta; if (!paused) time += delta / 1000 }
  tick()
}, 50)
addEventListener('resize', () => { runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); tick() })

const input = document.createElement('input')
input.type = 'file'; input.accept = 'audio/*,video/*'; input.title = 'Play a local reference track'
input.style.cssText = 'position:fixed;left:8px;top:8px;color:white;max-width:260px'
input.hidden = !live
input.onchange = async () => {
  const file = input.files?.[0]; if (!file) return
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''; for (const value of bytes) binary += String.fromCharCode(value)
  await (window as unknown as { glassfallFinal: { playAudio(value: string): Promise<void> } }).glassfallFinal.playAudio(btoa(binary))
}
document.body.append(input)
