import { cinema2UserModelCache } from '../../components/vyzualz/cinema2/model/Cinema2UserModelCache'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { Cinema2AudioIntelligenceBridge } from '../../components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2MediaKind, Cinema2ParameterId, Cinema2PresetId, Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { trippyBroMusicFixture } from '../support/TrippyBroMusicFixture'
import { createCinema2MainframePatternCycle, nextCinema2MainframePattern } from '../../components/vyzualz/cinema2/modules/mainframe/Cinema2MainframePatternController'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import { cinema2SlotSupportsPool } from '../../components/vyzualz/cinema2/media/Cinema2SourceCapabilities'
import type { Cinema2MediaPoolSource } from '../../components/vyzualz/cinema2/media/Cinema2MediaPoolSource'
import { ReleaseMediaProbe, releaseMediaFixture, type MediaVariant } from './Cinema2ReleaseMediaFixture'
import type { MusicIntelligenceFrame } from '../../features/musicIntelligence/types'

// Test-only controlled upstream publications; production runtime owns all response and timing.
type Stage = 'reference' | 'idle' | 'build' | 'drop' | 'breakdown'
type ControlledEvent = 'none' | 'fresh' | 'stale' | 'duplicate' | 'staged'
let controlled: ControlledEvent | null = null
let lastDrop: { id: number; time: number } | null = null
const canvas = document.querySelector<HTMLCanvasElement>('#review')!
const query = new URLSearchParams(location.search)
let presetId = query.get('preset') as Cinema2PresetId
let quality = (query.get('quality') ?? 'high') as Cinema2RenderQualityLevel
let callback: FrameRequestCallback | null = null
let index = 0, source = false, stage: Stage = 'reference', stageFrame = 0, musicTime = 0
let lastGlError = 0, paused = false
let glErrors: number[] = []
let publicationSequence = 0, publicationTime = 0
let bpmSync = true
let published: MusicIntelligenceFrame = DEFAULT_MI_FRAME
let mediaProbe = new ReleaseMediaProbe()
let poolSelection: ReturnType<Cinema2MediaPoolSource['getSelection']> = null
const poolListeners = new Set<() => void>()
let poolRequests: string[] = []
const poolVariants = ['chart','alpha','tall','chart'] as const
const poolSource: Cinema2MediaPoolSource = {
  getSelection:()=>poolSelection,
  subscribe(listener){poolListeners.add(listener);return ()=>{poolListeners.delete(listener)}},
  async resolve(id){const i=Number(id.split('-').at(-1));const variant=poolVariants[i];if(!variant)return null;poolRequests.push(id);return {...releaseMediaFixture(variant).source,id}},
}
function selectPool(enabled:boolean){poolSelection=enabled?{id:'qa05-pool',mediaIds:poolVariants.map((_,i)=>`qa05-pool-${i}`)}:null;for(const listener of poolListeners)listener()}
function createRuntime(serializedParameterState?: string) {
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => published,
    getPublicationMeta: () => ({ sequence: query.has('release') ? publicationSequence : index, publishedAtMs: query.has('release') ? publicationTime : index * 1000 / 30, publisherId: 'sys04-review-v1', kind: 'frame' }),
  })
  const created = Cinema2Runtime.create(canvas, {
    presetId, serializedParameterState, renderQuality: quality, diagnosticsEnabled: true,
    ...(query.has('release') ? { mediaLoader: mediaProbe.loader, mediaPoolSource: poolSource } : {}),
    randomness: { mode: 'deterministic', seed: 'sys04-review-v1' },
    audioIntelligenceBridge: bridge,
    transportSource: { getState: () => ({ sourcePresent: source, playing: source && !paused, analysisActive: source, paused,
      trackId: source ? published.trackId : null, timeSec: musicTime, bpm: 120, bpmSync }) },
    requestAnimationFrame: next => { callback = next; return 1 },
    cancelAnimationFrame: () => { callback = null },
  })
  if (!created.runtime) throw new Error(created.error)
  return created.runtime
}
let runtime = createRuntime()
let manifest = runtime.getCompiledPresetPlan().manifest
const mode = query.get('mode') ?? 'authored'
function applyMode() {
  const auto = (manifest.parameters ?? []).find(p => p.label === 'Auto Performance')
  if (mode !== 'authored') {
    if (!auto) throw new Error('Auto Performance control not present')
    const result = runtime.getParameterState().setPersistentValue(auto.id, mode === 'auto')
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  }
}
applyMode()
function syncTransportSetting() {
  const control = (manifest.parameters ?? []).find(p => p.label === 'BPM Sync')
  bpmSync = control ? runtime.getParameterState().getValue(control.id) === true : true
}
syncTransportSetting()
let initial = runtime.serializeParameterState()
runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
runtime.start()
function tick() {
  index++
  if (source && !paused) {
    musicTime += 1 / 30
    const controlledOverride = controlled !== null && controlled !== 'staged'
    const energy = controlledOverride ? .75 : stage === 'build' ? .35 + Math.min(stageFrame / 60, 1) * .55 : stage === 'drop' ? .95 : .16
    const hit = controlledOverride ? (controlled === 'none' ? null : 'drop') : stageFrame === 0 && stage === 'drop' ? 'drop' : stageFrame % 30 === 0 ? 'downbeat' : stageFrame % 15 === 0 ? 'kick' : stageFrame % 15 === 7 ? 'snare' : null
    if (controlled === 'fresh') lastDrop = { id: index, time: musicTime }
    const event = controlled === 'stale' ? { id: -1, time: Math.max(0, musicTime - .5) } : controlled === 'duplicate' ? lastDrop : null
    if (controlled === 'duplicate' && !event) throw Error('No fresh event to repeat')
    const upstream = trippyBroMusicFixture({ timeSec: musicTime, frameId: index, energy, bass: energy, high: energy * .7,
      build: !controlledOverride && stage === 'build' ? Math.min(stageFrame / 60, 1) : 0, advanceBeatGrid: true, event: hit, eventId: event?.id ?? index, eventTime: event?.time ?? musicTime })
    published = { ...upstream, section: { ...upstream.section, type: stage === 'build' ? 'build' : stage === 'drop' ? 'drop' : 'breakdown',
      startSec: controlledOverride ? 0 : musicTime - stageFrame / 30, endSec: controlledOverride ? 1000 : musicTime - stageFrame / 30 + 2, intensity: energy, progress: controlledOverride ? .5 : Math.min(stageFrame / 60, 1) } }
    publicationSequence++; publicationTime = index * 1000 / 30
    stageFrame++
  }
  const next = callback as FrameRequestCallback | null
  if (!next) throw new Error('Production frame was not scheduled')
  callback = null
  const start = performance.now()
  next(index * 1000 / 30)
  const gl = canvas.getContext('webgl2')
  // Drain a bounded queue so a later successful frame cannot hide an earlier error.
  for (let i = 0; i < 16; i++) {
    const error = gl?.getError() ?? -1
    if (error === 0) break
    lastGlError = error; glErrors.push(error)
    if (error === gl?.CONTEXT_LOST_WEBGL || error === -1) break
  }
  return performance.now() - start
}
function diagnostics() {
  return { glError: lastGlError, glErrors: [...glErrors], resources: runtime.getResourceManagerSnapshot(), media: runtime.getMediaSlotRuntimeSnapshot(), visualTime: runtime.getVisualElapsedTimeSec(), choreography: runtime.getChoreographyRuntimeSnapshot(), runtime: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(),
    camera: runtime.getCameraRuntimeSnapshot(), director: runtime.getVisualDirectorFrame(), transport: runtime.getTransportFrameState() }
}
const api = {
  inventory() { return { id: manifest.id, revision: manifest.revision, metadata: manifest.metadata,
    patterns: (manifest.parameters ?? []).find(p => p.label === 'Pattern')?.options ?? [], cameras: manifest.cameras,
    mediaSlots: manifest.mediaSlots ?? [], poolSlots: (manifest.mediaSlots ?? []).filter(slot=>cinema2SlotSupportsPool(slot.id)).map(slot=>slot.id), modules: manifest.modules ?? [], controls: manifest.parameters ?? [], parameters: initial } },
  async prepare() {
    // Give asset imports time to resolve. Readiness is reported, never assumed from elapsed time alone.
    for (let i = 0; i < 60; i++) { await new Promise(resolve => setTimeout(resolve, 25)); tick() }
    return diagnostics()
  },
  async capture(nextStage: Stage, frames: number, fixture: ControlledEvent | null = null) {
    if (!Number.isSafeInteger(frames) || frames < 1) throw Error('Invalid capture sample count')
    controlled = fixture
    if (stage !== nextStage) { stage = nextStage; stageFrame = 0 }
    source = stage !== 'reference' && stage !== 'idle'
    const saved = runtime.serializeParameterState()
    const timings = []
    for (let i = 0; i < frames; i++) { timings.push(tick()); if (i === frames - 1) break; await new Promise(resolve => setTimeout(resolve, 0)) }
    // Read before the WebGL drawing buffer is retired.
    const png = canvas.toDataURL('image/png')
    return { png, timings, frame: index, stageFrame, musicTime, stage, quality, fixture, event: fixture === null ? null : { mode: fixture, semanticMoments: published.semanticMoments, publicationSequence, publicationTime }, diagnostics: diagnostics(), parametersUnchanged: (query.get('release') ? saved : initial) === runtime.serializeParameterState() }
  },
  // Release-only controls, using the same runtime, scheduler and native media service.
  set(id: Cinema2ParameterId, value: unknown) {
    const result = runtime.getParameterState().setPersistentValue(id, value)
    if (!result.ok) throw Error(JSON.stringify(result.diagnostics))
    syncTransportSetting()
    return runtime.getParameterState().getValue(id)
  },
  expectedNextPattern(current: string) {
    const patterns = (manifest.parameters ?? []).find(p => p.label === 'Pattern')?.options?.map(p => p.value) ?? []
    if (!patterns.every(p => typeof p === 'string')) return null
    const ids = patterns.map(String)
    const key = String(presetId).split('.').at(-1)
    if (['honey','hud','purity','allstar','crate-wireframe-portal','chamber'].includes(key ?? '')) return nextCinema2MainframePattern(ids, current)
    const purpose = key === 'corridor' ? 'corridor-pattern-cycle' : ['spectrum','fracture','refraction','mosaic','overdrive','colossus','exoskeleton','monument','everywhere'].includes(key ?? '') ? `${key}-pattern-order` : null
    const modules = manifest.modules ?? []
    if (!purpose || modules.length !== 1) return null
    const moduleId = modules[0]!.id
    return nextCinema2MainframePattern(createCinema2MainframePatternCycle(i => runtime.getRandomService().sample({ moduleId, purpose }, i), ids), current)
  },
  saved() { return runtime.serializeParameterState() },
  reset() { runtime.getParameterState().resetAll(); syncTransportSetting(); return runtime.serializeParameterState() },
  pause(value: boolean) { paused = value },
  seek(time: number) { musicTime = time; stageFrame = 0; paused = false },
  resize(width: number, height: number) { runtime.resize({ width, height, dpr: 1 }); if (canvas.width !== width || canvas.height !== height) throw Error('Resize failed') },
  async mediaFixture(remove = false, kind: Cinema2MediaKind = 'image', variant: MediaVariant = kind === 'image' ? 'chart' : kind) {
    const slots = (manifest.mediaSlots ?? []).filter(slot => slot.accepts.includes(kind))
    if (!slots.length) throw Error(`No ${kind} slots`)
    if (remove) { for (const slot of slots) runtime.getMediaSlotRuntime().remove(slot.id); mediaProbe.unpin() }
    else {
      const {source} = releaseMediaFixture(variant)
      if(source.kind!==kind)throw Error('Fixture format mismatch')
      for (const slot of slots) {
        const status = await runtime.getMediaSlotRuntime().replace(slot.id, source, { fit: 'contain' })
        if (status.status !== 'ready') throw Error(`Media ${slot.id}: ${status.status} ${status.error}`)
      }
      if(kind==='video')await mediaProbe.pin(.2)
    }
    return runtime.getMediaSlotRuntimeSnapshot()
  },
  mediaTime(time: number) { return mediaProbe.pin(time) },
  mediaDecode(variant: MediaVariant,time=0) { return mediaProbe.inspect(variant,time) },
  mediaPool(enabled: boolean){ selectPool(enabled) },
  mediaPoolRequests(){return [...poolRequests]},
  async mediaPlayback() {
    // Pin near the end, then let the actual transport pause/resume callbacks
    // control the native decoder. Poll boundedly for progress and wrap.
    await mediaProbe.pin(1.55)
    mediaProbe.unpin(); paused=true; tick()
    const before=mediaProbe.inspect('video',1.55).playback
    await new Promise(resolve=>setTimeout(resolve,150));tick()
    const held=mediaProbe.inspect('video',1.55).playback
    paused=false;tick()
    let previous=held?.currentTimeSec??0, advanced=false, wrapped=false
    for(let i=0;i<100;i++){
      await new Promise(resolve=>setTimeout(resolve,30));tick()
      const now=mediaProbe.inspect('video',0).playback
      if(!now)break
      if(now.currentTimeSec>previous+.015)advanced=true
      if(now.currentTimeSec<previous-.2)wrapped=true
      previous=now.currentTimeSec
      if(advanced&&wrapped)break
    }
    return {before,held,advanced,wrapped,after:mediaProbe.inspect('video',0).playback}
  },
  async modelFixture(remove = false, variant: import('./Cinema2ReleaseModelFixture').ReleaseModelVariant = 'primary') {
    const parameter = (manifest.parameters ?? []).find(p => p.metadata?.editor === 'user-model-selector')
    if (!parameter) throw Error('Model selector absent')
    const fixture = await import('./Cinema2ReleaseModelFixture')
    const value = remove ? 'default-model' : await fixture.installReleaseModelFixture(variant)
    const result = runtime.getParameterState().setPersistentValue(parameter.id, value)
    if (!result.ok) throw Error(JSON.stringify(result.diagnostics))
    return runtime.getParameterState().getValue(parameter.id)
  },
  modelCache() { return cinema2UserModelCache.getSnapshot() },
  async modelEditorReference(variant: Exclude<import('./Cinema2ReleaseModelFixture').ReleaseModelVariant, 'missing'>) {
    return (await import('./Cinema2ReleaseModelFixture')).captureReleaseModelEditor(variant)
  },
  switchPreset(id: Cinema2PresetId, nextQuality: Cinema2RenderQualityLevel, saved?: string) {
    runtime.dispose()
    const retired = diagnostics()
    presetId = id; quality = nextQuality; callback = null; index = 0; source = false; paused = false
    stage = 'reference'; stageFrame = 0; musicTime = 0; controlled = null; lastDrop = null; published = DEFAULT_MI_FRAME; publicationSequence = 0; publicationTime = 0; lastGlError = 0; glErrors = []
    // A fresh bridge is constructed by createRuntime; restore only the canonical saved state.
    selectPool(false); poolRequests=[]; mediaProbe = new ReleaseMediaProbe(); runtime = createRuntime(saved); manifest = runtime.getCompiledPresetPlan().manifest
    if (!saved) applyMode()
    syncTransportSetting()
    initial = runtime.serializeParameterState(); runtime.resize({width: innerWidth, height: innerHeight, dpr: 1}); runtime.start()
    return retired
  },
  async recoverContext() {
    const gl = canvas.getContext('webgl2')
    const extension = gl?.getExtension('WEBGL_lose_context')
    if (!extension) return { supported: false }
    const generation = runtime.getSnapshot().contextGeneration
    const wait = async (predicate: () => boolean) => {
      for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 25)) }
      throw Error('Context lifecycle event timed out')
    }
    extension.loseContext(); await wait(() => runtime.getSnapshot().phase === 'context-lost')
    const lost = diagnostics()
    extension.restoreContext(); await wait(() => runtime.getSnapshot().contextGeneration > generation && runtime.getSnapshot().phase === 'running')
    return { supported: true, generation, restored: runtime.getSnapshot().contextGeneration, lost, restoredSnapshot: diagnostics() }
  },
  diagnostics,
  dispose() { runtime.dispose(); return runtime.getSnapshot() },
}
declare global { interface Window { __cinema2QualityReview?: typeof api } }
window.__cinema2QualityReview = api
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
