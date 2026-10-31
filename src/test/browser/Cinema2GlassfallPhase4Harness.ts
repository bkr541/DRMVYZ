import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { createGlassfallPhase4Registries, GLASSFALL_PHASE4_ID } from '../../components/vyzualz/cinema2/presets/Cinema2GlassfallPhase4Preset'
import { glassfallParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2GlassfallPhase2Preset'
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
let sequence = 0, lastPublishedTime = -1, dirty = true
let fixture: Partial<IfritFixtureOptions> = { energy: 0, bass: 0, high: 0, vocal: 0 }
let published = ifritMusicFixture({ timeSec: 0, frameId: 0, trackId })
const tick = () => {
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
    ...createGlassfallPhase4Registries(), presetId: GLASSFALL_PHASE4_ID, serializedParameterState,
    renderQuality: 'high', diagnosticsEnabled: true,
    requestAnimationFrame: callback => { pending = callback; return 1 }, cancelAnimationFrame() {},
    transportSource: { getState: () => ({ sourcePresent: true, playing: !paused, paused, analysisActive: true, animationActive: !paused, trackId, timeSec: time, bpm, bpmSync: false }) },
  })
  if (!result.runtime) throw new Error(JSON.stringify(result))
  runtime = result.runtime; runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); runtime.start(); tick(); refresh()
}
enter()
const status = () => ({ modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(), resources: runtime.getResourceManagerSnapshot(), parameters: runtime.getParameterState().getSnapshot(), transport: runtime.getTransportFrameState(), audio: runtime.getAudioIntelligenceFrame(), choreography: runtime.getChoreographyRuntimeSnapshot(), channels: Object.fromEntries(['energy','bass','high','vocal','build','kick','snare','drop'].map(name => {
    const target = runtime.getCompiledPresetPlan().targets.targets.find(t => t.kind === 'module' && t.property === `choreo-${name}`)
    return [name, target ? runtime.getTargetResolver().resolve(target.id).value : null]
  })) })
const settle = async () => { tick(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) }
Object.assign(window, { glassfallChoreography: {
  status,
  async music(options: Partial<IfritFixtureOptions>) {
    time = options.timeSec ?? time; paused = false; bpm = options.bpm ?? bpm
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
  async reenter(preserve = true) {
    const serialized = preserve ? runtime.getParameterState().serialize() : undefined
    runtime.dispose(); const retired = runtime.getResourceManagerSnapshot(); enter(serialized); return retired
  },
  dispose() { runtime.dispose(); return runtime.getResourceManagerSnapshot() },
} })
let previous = performance.now()
setInterval(() => {
  if (runtime.getSnapshot().phase === 'disposed') return
  const now = performance.now(), delta = Math.min(100, now - previous); previous = now
  if (live) { timestamp += delta; if (!paused) time += delta / 1000 }
  tick()
}, 50)
addEventListener('resize', () => { runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 }); tick() })
