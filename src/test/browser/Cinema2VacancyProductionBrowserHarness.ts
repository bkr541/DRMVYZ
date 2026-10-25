/** Deterministic capture surface for the real Cinema 2.0 VACANCY production path: the real runtime, registry, module and effects. */
import type { Cinema2ParameterId, Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { CINEMA2_VACANCY_MEDIA_ID, CINEMA2_VACANCY_PRESET_ID, CINEMA2_VACANCY_PRESET_MANIFEST } from '../../components/vyzualz/cinema2/presets/Cinema2VacancyPreset'
import { Cinema2PresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { Cinema2AudioIntelligenceBridge } from '../../components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../support/NightshiftMusicFixture'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import type { Cinema2MediaSource } from '../../components/vyzualz/cinema2/media/Cinema2MediaSlotRuntime'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'

interface VacancyProductionApi {
  prepare(): Promise<unknown>
  advanceTo(timeSec: number): Promise<unknown>
  advanceBy(seconds: number): Promise<unknown>
  setParameters(values: Record<string, unknown>): Promise<unknown>
  resize(width: number, height: number): Promise<unknown>
  setMusic(values: Partial<NightshiftFixtureOptions> & { active?: boolean; paused?: boolean; seek?: number; bpm?: number }): Promise<unknown>
  setMedia(source: Cinema2MediaSource | null): Promise<unknown>
  status(): unknown
}
declare global { interface Window { __vacancyProduction?: VacancyProductionApi } }

const canvasElement = document.querySelector<HTMLCanvasElement>('#vacancy-production')
if (!canvasElement) throw new Error('The VACANCY production canvas is missing.')
const canvas: HTMLCanvasElement = canvasElement
const query = new URLSearchParams(location.search)
const requestedQuality = query.get('quality')
const quality: Cinema2RenderQualityLevel = requestedQuality === 'low' || requestedQuality === 'medium' ? requestedQuality : 'high'
const captureTimeSec = Math.max(0, Number(query.get('timeSec') ?? 1) || 0)

/** The visual clock advances by at most one sixtieth per frame, so every capture is the same frame count whatever the machine's speed. */
let timestampMs = 0
let targetTimestampMs = 0
const clock = {
  requestAnimationFrame: (callback: FrameRequestCallback) => window.requestAnimationFrame(() => {
    timestampMs = Math.min(targetTimestampMs, timestampMs + 1000 / 60)
    callback(timestampMs)
  }),
  cancelAnimationFrame: (id: number) => window.cancelAnimationFrame(id),
}

// Development-only framing study: `cam=px,py,pz,tx,ty,tz,fov` replaces the authored camera in a copy of the production manifest.
let presetRegistry: Cinema2PresetRegistry | undefined
const cam = import.meta.env.DEV ? query.get('cam')?.split(',').map(Number) : undefined
if (cam && cam.length >= 7 && cam.every(Number.isFinite)) {
  presetRegistry = new Cinema2PresetRegistry()
  const [px, py, pz, tx, ty, tz, fov] = cam as [number, number, number, number, number, number, number]
  const source = CINEMA2_VACANCY_PRESET_MANIFEST
  const registered = presetRegistry.register({
    ...source,
    cameras: source.cameras!.map(camera => ({ ...camera, fovDegrees: fov, transform: { position: [px, py, pz] as const }, target: [tx, ty, tz] as const })),
  })
  if (!registered.ok) throw new Error(`VACANCY camera study manifest was rejected: ${registered.diagnostics.map(item => item.message).join('; ')}`)
}
let music: Partial<NightshiftFixtureOptions> & { active?: boolean; paused?: boolean; bpm?: number } = {}
let musicAnchor = 0, anchorTimestamp = 0, publication = 0, musicRevision = 0
let cachedMusicKey = '', cachedMusic: ReturnType<typeof nightshiftMusicFixture> | null = null
const musicTime = () => musicAnchor + (music.paused ? 0 : (timestampMs - anchorTimestamp) / 1000)
const audioBridge = new Cinema2AudioIntelligenceBridge({
  getFrame: () => {
    if (!music.active) return DEFAULT_MI_FRAME
    const key = `${musicRevision}:${musicTime().toFixed(9)}`
    if (cachedMusic && key === cachedMusicKey) return cachedMusic
    const source = nightshiftMusicFixture({ timeSec: musicTime(), frameId: ++publication, advanceBeatGrid: true, ...music })
    if (music.bpm) source.rhythm = { ...source.rhythm, bpm: music.bpm, beatIndex: Math.floor(musicTime() * music.bpm / 60), beatPhase: (musicTime() * music.bpm / 60) % 1 }
    cachedMusicKey = key; cachedMusic = source
    return source
  },
  getPublicationMeta: () => ({ sequence: publication, publisherId: 'vacancy-production-fixture', kind: 'frame', publishedAtMs: 0 }),
})
const created = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_VACANCY_PRESET_ID,
  ...(presetRegistry ? { presetRegistry } : {}),
  renderQuality: quality,
  requestAnimationFrame: clock.requestAnimationFrame,
  cancelAnimationFrame: clock.cancelAnimationFrame,
  diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'vacancy-production' },
  audioIntelligenceBridge: audioBridge,
  transportSource: { getState: () => ({ sourcePresent: !!music.active, playing: !!music.active && !music.paused, analysisActive: !!music.active, paused: !!music.paused, trackId: music.active ? music.trackId ?? 'nightshift-audio-fixture' : null, timeSec: music.active ? musicTime() : 0, bpmSync: true, bpm: music.bpm ?? 120 }) },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime

function applyParameters(values: Record<string, unknown>): void {
  const state = runtime.getParameterState()
  for (const [parameterId, value] of Object.entries(values)) {
    const result = state.setPersistentValue(parameterId as Cinema2ParameterId, value as never)
    if (!result.ok) throw new Error(`VACANCY capture could not set ${parameterId}: ${result.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
  }
}
const requestedParameters = query.get('params')
if (requestedParameters) applyParameters(JSON.parse(requestedParameters) as Record<string, unknown>)

runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
runtime.start()

let prepared = false
let pending: Promise<unknown> | null = null
const browserFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
async function settleFrames(count: number): Promise<void> {
  const target = runtime.getSnapshot().frameCount + Math.max(1, Math.round(count))
  while (runtime.getSnapshot().frameCount < target) await browserFrame()
}
async function runFor(seconds: number): Promise<void> {
  if (seconds <= 0) return
  targetTimestampMs = timestampMs + seconds * 1000
  await settleFrames(Math.max(1, Math.round(seconds * 60)))
}
function status() {
  return Object.freeze({
    prepared, quality,
    viewport: Object.freeze({ width: innerWidth, height: innerHeight }),
    controlledTimestampMs: timestampMs,
    snapshot: runtime.getSnapshot(),
    modules: runtime.getModuleRuntimeSnapshot(),
    effects: runtime.getEffectRuntimeSnapshot(),
    performance: runtime.getPerformanceSnapshot(),
    camera: runtime.getCameraRuntimeSnapshot().camera,
    authored: runtime.getParameterState().serialize(),
    media: runtime.getMediaSlotRuntimeSnapshot(),
    transport: runtime.getTransportFrameState(),
    audio: runtime.getAudioIntelligenceFrame(),
    choreography: runtime.getChoreographyRuntimeSnapshot(),
    response: Object.fromEntries(['audioEnergy', 'bassPressure', 'highSparkle', 'musicResponse', 'pattern'].map(name => [name,
      runtime.getTargetResolver().resolve(`${CINEMA2_VACANCY_PRESET_ID}/target/module/vacancy-core/property/${name}` as never).value])),
  })
}
async function prepare(): Promise<unknown> {
  if (pending) return pending
  pending = (async () => {
    let resident = false
    for (let attempt = 0; attempt < 600; attempt += 1) {
      await browserFrame()
      const modules = runtime.getModuleRuntimeSnapshot()
      if (modules.failedModuleCount > 0) throw new Error(`The VACANCY native module failed during preparation: ${JSON.stringify(modules)}`)
      if (modules.activeModuleCount > 0 && modules.estimatedGpuBytes > 0) { resident = true; break }
    }
    if (!resident) throw new Error('VACANCY did not become GPU-resident within the capture timeout.')
    await runFor(captureTimeSec)
    await settleFrames(4)
    prepared = true
    return status()
  })()
  return pending
}

const api: VacancyProductionApi = {
  prepare,
  async advanceBy(seconds) { await runFor(seconds); return status() },
  async advanceTo(timeSec) { await runFor(Math.max(0, timeSec - timestampMs / 1000)); await settleFrames(2); return status() },
  async setParameters(values) { applyParameters(values); await settleFrames(3); return status() },
  async resize(width, height) {
    await prepare()
    runtime.resize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), dpr: 1 })
    await settleFrames(12)
    return status()
  },
  async setMusic(values) {
    const oldTime = musicTime()
    musicAnchor = values.seek ?? oldTime; anchorTimestamp = timestampMs
    musicRevision += 1
    music = { ...values, eventTime: values.event ? values.eventTime ?? musicAnchor + (values.event === 'drop' || values.event === 'phrase' ? 1 / 60 : 0) : undefined }
    await settleFrames(3); return status()
  },
  async setMedia(source) {
    const slots = runtime.getMediaSlotRuntime()
    if (source) await slots.replace(CINEMA2_VACANCY_MEDIA_ID, source, { fit: 'cover' })
    else slots.remove(CINEMA2_VACANCY_MEDIA_ID)
    await settleFrames(3); return status()
  },
  status,
}
window.__vacancyProduction = Object.freeze(api)
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
