import { Cinema2PsyloAudio, PSYLO_MUSIC_DEFAULTS, PsyloPatternController, resolvePsyloEvent, resolvePsyloMusic, selectPsyloAudio } from './psylo/Cinema2PsyloAudio'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { readPsyloControls, type PsyloControls } from './psylo/Cinema2PsyloDomain'
import { Cinema2PsyloSceneController } from './psylo/Cinema2PsyloSceneController'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleDiagnostic, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2ThreeAssetCache, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import { cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'

export const CINEMA2_PSYLO_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('psylo-native-render')
const assets = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)
const overrides = { ...CINEMA2_THREE_DEFAULT_OVERRIDES, environmentIntensity: .18 }

/** Native rooted geometry; all timing, camera and parameter authority stays shared. */
export const cinema2PsyloNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = {
  typeId: CINEMA2_PSYLO_MODULE_TYPE_ID,
  version: 1,
  validate: module => module.config?.asset === 'cinema2-psylo-static' ? []
    : [{ code: 'PSYLO_ASSET_REQUIRED', message: 'PSYLO requires its prepared static forest.', path: '$.config.asset' }],
  create(context) {
    let disposed = false, loading = false, failed = false, reportedReady = false
    let held: Cinema2ThreeLoadedAsset | null = null
    let library: Cinema2ThreeLibrary | null = null
    let bridge: Cinema2ThreeSceneBridge | null = null
    const diagnostics: Cinema2ModuleDiagnostic[] = []
    const clock = new Cinema2BeatClock(), delivery = new Cinema2PsyloAudio(), patterns = new PsyloPatternController()
    let music = { ...PSYLO_MUSIC_DEFAULTS } as import('./psylo/Cinema2PsyloAudio').PsyloMusic
    let audioAvailable = false, wasPaused = false
    let sourceIdentity: string | null = null, analysisIdentity: string | null = null, discontinuity = -1
    let controller: Cinema2PsyloSceneController | null = null
    let controls: PsyloControls | null = null
    let lastTimestamp: number | null = null
    let phase = 0, beats = 0, time: number | null = null, track: string | null | undefined, generation = -1
    const fail = (code: string, error: unknown) => {
      failed = true
      diagnostics.push({ code, message: error instanceof Error ? error.message : String(error), path: '$.config.asset' })
    }
    return {
      lifecycle: {
        update({ parameters, frame: incoming, targets }) {
          const selected = selectPsyloAudio(incoming)
          const frame = { ...incoming, audio: selected, director: null }
          controls = readPsyloControls(parameters)
          const resuming = wasPaused && frame.transport?.paused !== true
          const currentTime = frame.transport?.timeSec ?? frame.elapsedTimeSec
          if (track !== frame.transport?.trackId && !selected) { sourceIdentity = null; analysisIdentity = null }
          const revision = selected ? JSON.stringify([selected.upstream.analysisRevision, selected.upstream.timelineRevision]) : analysisIdentity
          const refreshed = analysisIdentity != null && revision !== analysisIdentity
          const source = selected ? JSON.stringify([selected.upstream.trackId, selected.upstream.sourceId, selected.upstream.publisherId]) : sourceIdentity
          const activated = selected != null && sourceIdentity == null
          const returning = selected != null && !audioAvailable && sourceIdentity != null
          const newDiscontinuity = selected?.discontinuity.generation ?? discontinuity
          const sharedReset = selected != null && newDiscontinuity !== discontinuity && ['seek', 'restart'].includes(selected.discontinuity.reason ?? '')
          const reset = sharedReset || (sourceIdentity != null && source !== sourceIdentity) || generation !== frame.contextGeneration || track !== frame.transport?.trackId
            || (time != null && (currentTime < time - .001 || currentTime - time > Math.max(1, frame.deltaTimeSec * 4)))
          if (reset) { clock.reset(); phase = 0; beats = 0 }
          const active = !frame.transport || (!frame.transport.paused && (!frame.transport.sourcePresent || frame.transport.playing))
          const dt = lastTimestamp == null || reset ? 0 : Math.max(0, Math.min(.25, (frame.timestampMs - lastTimestamp) / 1000))
          lastTimestamp = frame.timestampMs
          const governedFrame = { ...frame, elapsedTimeSec: 0, deltaTimeSec: active ? dt : 0,
            ...(frame.transport ? { transport: { ...frame.transport, animationActive: active } } : {}) }
          const eventFrame = frame.transport ? { ...frame, transport: { ...frame.transport, paused: false, playing: true } } : frame
          const trigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(controls.trigger as Cinema2AfterhoursTriggerId) ? controls.trigger as Cinema2AfterhoursTriggerId : 'bar4'
          const event = resolvePsyloEvent(eventFrame, trigger, reset || activated ? null : time)
          music = resolvePsyloMusic(delivery.update(frame, controls.musicResponse, reset || activated ? null : time, reset || activated || refreshed || returning, resuming), parameters, targets)
          controls.pattern = patterns.update(controls.pattern, controls.patternChange, trigger, event, parameters.getEditRevision?.('pattern') ?? 0, reset || activated, !active || refreshed || returning || resuming)
          if (!frame.transport?.paused) audioAvailable = selected != null
          wasPaused = frame.transport?.paused === true
          sourceIdentity = source; analysisIdentity = revision; discontinuity = newDiscontinuity
          const current = clock.update(governedFrame, controls.bpmSync, 100).beats
          if (controls.motion && controls.amount > 0 && active) phase += Math.max(0, current - beats) * controls.speed
          beats = current; time = currentTime; track = frame.transport?.trackId; generation = frame.contextGeneration
        },
        dispose() {
          disposed = true
          if (!bridge && held) { assets.release(held); held = null }
        },
      },
      render: { providers: [{
        id: `${context.module.id}:psylo`, moduleId: context.module.id, intent: 'world',
        execute(execution) {
          if (disposed || failed) return
          if (!loading) {
            loading = true
            void (async () => {
              let asset: Cinema2ThreeLoadedAsset | null = null
              try {
                const lib = await loadCinema2ThreeLibrary()
                if (disposed) return
                asset = await assets.acquire(lib, 'cinema2-psylo-static', execution.lightingEnvironment?.quality ?? 'high')
                if (disposed) { assets.release(asset); return }
                held = asset; library = lib
              } catch (error) {
                if (asset) assets.release(asset)
                if (!disposed) fail('PSYLO_ASSET_LOAD_FAILED', error)
              }
            })()
          }
          if (!bridge && held && library) {
            const asset = held, lib = library
            try {
              controller = new Cinema2PsyloSceneController(lib)
              bridge = context.resources.acquire('psylo:bridge', 'PsyloThreeSceneBridge',
                gl => new Cinema2ThreeSceneBridge(gl, lib, [{ asset, node: null }], {
                  modelController: { attach: root => controller!.attach(root), beforeDraw: () => { if (controls) controller!.apply(controls, phase, music) }, dispose: () => controller?.dispose() },
                }),
                value => { value.dispose(); assets.release(asset) })
            } catch (error) {
              controller?.dispose(); assets.release(asset); held = null; fail('PSYLO_SCENE_BUILD_FAILED', error); return
            }
          }
          if (bridge) {
            bridge.draw(execution, overrides)
            if (!reportedReady && bridge.ready) {
              context.resources.reportGpuBytes(bridge.estimateGpuBytes())
              reportedReady = bridge.ready
            }
          }
        },
      }] },
      getDiagnostics: () => [...diagnostics, ...(bridge?.getDiagnostics().map(d => ({ ...d, path: '$.config.asset' })) ?? [])],
    }
  },
}
