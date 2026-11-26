import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { Cinema2AudioIntelligenceBridge } from '../../components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2PresetId, Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { trippyBroMusicFixture } from '../support/TrippyBroMusicFixture'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../features/musicIntelligence/types'

// Test-only controlled upstream publications; production runtime owns all response and timing.
type Stage = 'reference' | 'idle' | 'build' | 'drop' | 'breakdown'
const canvas = document.querySelector<HTMLCanvasElement>('#review')!
const query = new URLSearchParams(location.search)
const presetId = query.get('preset') as Cinema2PresetId
const quality = (query.get('quality') ?? 'high') as Cinema2RenderQualityLevel
let callback: FrameRequestCallback | null = null
let index = 0, source = false, stage: Stage = 'reference', stageFrame = 0, musicTime = 0
let lastGlError = 0
let published: MusicIntelligenceFrame = DEFAULT_MI_FRAME
const bridge = new Cinema2AudioIntelligenceBridge({
  getFrame: () => published,
  getPublicationMeta: () => ({ sequence: index, publishedAtMs: index * 1000 / 30, publisherId: 'sys04-review-v1', kind: 'frame' }),
})
const created = Cinema2Runtime.create(canvas, {
  presetId, renderQuality: quality, diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'sys04-review-v1' },
  audioIntelligenceBridge: bridge,
  transportSource: { getState: () => ({ sourcePresent: source, playing: source, analysisActive: source, paused: false,
    trackId: source ? published.trackId : null, timeSec: musicTime, bpm: 120, bpmSync: true }) },
  requestAnimationFrame: next => { callback = next; return 1 },
  cancelAnimationFrame: () => { callback = null },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime
const manifest = runtime.getCompiledPresetPlan().manifest
const auto = manifest.parameters.find(p => p.label === 'Auto Performance')
const mode = query.get('mode') ?? 'authored'
if (mode !== 'authored') {
  if (!auto) throw new Error('Auto Performance control not present')
  const result = runtime.getParameterState().setPersistentValue(auto.id, mode === 'auto')
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
}
const initial = runtime.serializeParameterState()
runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
runtime.start()
function tick() {
  index++
  if (source) {
    musicTime += 1 / 30
    const energy = stage === 'build' ? .35 + Math.min(stageFrame / 60, 1) * .55 : stage === 'drop' ? .95 : .16
    const hit = stageFrame === 0 && stage === 'drop' ? 'drop' : stageFrame % 30 === 0 ? 'downbeat' : stageFrame % 15 === 0 ? 'kick' : stageFrame % 15 === 7 ? 'snare' : null
    const upstream = trippyBroMusicFixture({ timeSec: musicTime, frameId: index, energy, bass: energy, high: energy * .7,
      build: stage === 'build' ? Math.min(stageFrame / 60, 1) : 0, advanceBeatGrid: true, event: hit, eventId: index })
    published = { ...upstream, section: { ...upstream.section, type: stage === 'build' ? 'build' : stage === 'drop' ? 'drop' : 'breakdown',
      startSec: musicTime - stageFrame / 30, endSec: musicTime - stageFrame / 30 + 2, intensity: energy, progress: Math.min(stageFrame / 60, 1) } }
    stageFrame++
  }
  const next = callback as FrameRequestCallback | null
  if (!next) throw new Error('Production frame was not scheduled')
  callback = null
  const start = performance.now()
  next(index * 1000 / 30)
  const glError = canvas.getContext('webgl2')?.getError() ?? -1
  if (glError !== 0) lastGlError = glError
  return performance.now() - start
}
function diagnostics() {
  return { glError: lastGlError, runtime: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(),
    camera: runtime.getCameraRuntimeSnapshot(), director: runtime.getVisualDirectorFrame(), transport: runtime.getTransportFrameState() }
}
const api = {
  inventory() { return { id: manifest.id, revision: manifest.revision, metadata: manifest.metadata,
    patterns: manifest.parameters.find(p => p.label === 'Pattern')?.options ?? [], cameras: manifest.cameras,
    mediaSlots: manifest.mediaSlots ?? [], parameters: initial } },
  async prepare() {
    // Give asset imports time to resolve. Readiness is reported, never assumed from elapsed time alone.
    for (let i = 0; i < 60; i++) { await new Promise(resolve => setTimeout(resolve, 25)); tick() }
    return diagnostics()
  },
  async capture(nextStage: Stage, frames: number) {
    if (stage !== nextStage) { stage = nextStage; stageFrame = 0 }
    source = stage !== 'reference' && stage !== 'idle'
    const timings = []
    for (let i = 0; i < frames; i++) { timings.push(tick()); if (i === frames - 1) break; await new Promise(resolve => setTimeout(resolve, 0)) }
    // Read before the WebGL drawing buffer is retired.
    const png = canvas.toDataURL('image/png')
    return { png, timings, frame: index, stageFrame, musicTime, diagnostics: diagnostics(), parametersUnchanged: initial === runtime.serializeParameterState() }
  },
  dispose() { runtime.dispose(); return runtime.getSnapshot() },
}
declare global { interface Window { __cinema2QualityReview?: typeof api } }
window.__cinema2QualityReview = api
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
