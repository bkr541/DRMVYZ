import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleTypeDefinition, Cinema2ModuleDiagnostic } from './Cinema2ModuleContracts'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { Cinema2ThreeAssetCache, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import { cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { cinema2ThreeEnvironmentRegistry } from './three/Cinema2ThreeEnvironmentRegistry'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'
import { Cinema2NightshiftSceneController, type NightshiftSceneFrame } from './nightshift/Cinema2NightshiftSceneController'
import { readNightshiftControls, NightshiftPatternController, NightshiftPatternTransition } from './nightshift/Cinema2NightshiftDomain'
import { Cinema2NightshiftAudio, selectNightshiftAudio, resolveNightshiftMusic, resolveNightshiftPatternEvent, readNightshiftAudioChannels } from './nightshift/Cinema2NightshiftAudio'
import { Cinema2NightshiftDirector } from './nightshift/Cinema2NightshiftDirector'
import { Cinema2NightshiftAutoPerformance } from './nightshift/Cinema2NightshiftAutoPerformance'

export const CINEMA2_NIGHTSHIFT_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('nightshift-native-render')
const assets = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)
const overrides = { ...CINEMA2_THREE_DEFAULT_OVERRIDES, environmentIntensity: .48 }

export const cinema2NightshiftNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = {
  typeId: CINEMA2_NIGHTSHIFT_MODULE_TYPE_ID, version: 1,
  validate: module => module.config?.asset === 'cinema2-nightshift-static' ? []
    : [{ code: 'NIGHTSHIFT_ASSET_REQUIRED', message: 'NIGHTSHIFT requires its addressed installation model.', path: '$.config.asset' }],
  create(context) {
    let disposed = false, loading = false, failed = false
    let held: Cinema2ThreeLoadedAsset | null = null, library: Cinema2ThreeLibrary | null = null
    let bridge: Cinema2ThreeSceneBridge | null = null, controller: Cinema2NightshiftSceneController | null = null
    let sceneFrame: NightshiftSceneFrame | null = null
    const diagnostics: Cinema2ModuleDiagnostic[] = []
    const clock = new Cinema2BeatClock(), patterns = new NightshiftPatternController()
    const musicDelivery = new Cinema2NightshiftAudio()
    const directorDelivery = new Cinema2NightshiftDirector()
    const transition = new NightshiftPatternTransition()
    const performance = new Cinema2NightshiftAutoPerformance()
    let lastPatternEdit = -1, lastAuthoredPattern = ''
    let lastPatternChange: boolean | undefined
    let lastTimestamp: number | null = null, lastTime: number | null = null
    let track: string | null | undefined, generation = -1, discontinuity = -1
    let beats = 0, phase = 0, angle = 0, glintPhase = 0, visualTime = 0, reportedReady = false
    let sourceIdentity: string | undefined
    const report = (code: string, error: unknown) => {
      failed = true
      diagnostics.push({ code, message: error instanceof Error ? error.message : String(error), path: '$.config.asset' })
    }
    return {
      lifecycle: {
        update({ parameters, frame: inputFrame, targets }) {
          const selected = selectNightshiftAudio(inputFrame)
          const frame = selected === inputFrame.audio ? inputFrame : { ...inputFrame, audio: selected, director: selected ? inputFrame.director : null }
          const c = readNightshiftControls(parameters)
          const time = frame.transport?.timeSec ?? frame.audio?.upstream.timeSec ?? 0
          const newGeneration = frame.audio?.discontinuity.generation ?? discontinuity
          const source = frame.audio ? JSON.stringify([frame.audio.upstream.trackId, frame.audio.upstream.sourceId, frame.audio.upstream.publisherId]) : sourceIdentity
          const reset = generation !== frame.contextGeneration || track !== frame.transport?.trackId
            || (lastTime != null && (time < lastTime - .05 || time > lastTime + 1))
            || (newGeneration !== discontinuity && newGeneration !== -1)
            || (sourceIdentity !== undefined && source !== sourceIdentity)
          if (reset) { clock.reset(); phase = 0; angle = 0; beats = 0; glintPhase = 0; visualTime = 0 }
          const channels = readNightshiftAudioChannels(parameters)
          const audioMusic = musicDelivery.update(frame, c.musicResponse, lastTime, reset, channels)
          const music = resolveNightshiftMusic(directorDelivery.apply(frame, c.musicResponse, audioMusic, channels, reset), parameters, targets)
          // Playing and no-track idle keep moving even during analysis gaps.
          // Explicit pause/stop still holds the shared clock and transitions.
          const idle = frame.transport != null && !frame.transport.paused
            && (frame.transport.sourcePresent === false || frame.transport.playing)
          const dt = lastTimestamp == null || reset ? 0 : Math.max(0, Math.min(.1, (frame.timestampMs - lastTimestamp) / 1000))
          const clockFrame = { ...frame, elapsedTimeSec: 0,
            ...(frame.transport ? { deltaTimeSec: idle ? dt : 0, transport: { ...frame.transport, animationActive: idle } } : {}),
          }
          const current = clock.update(clockFrame, c.bpmSync, 100).beats
          if (!clockFrame.transport?.paused && clockFrame.transport?.animationActive !== false) visualTime += clockFrame.deltaTimeSec
          const delta = reset ? 0 : Math.max(0, current - beats)
          const motion = c.motion / .35
          phase += delta * motion * music.musicMotion
          if (c.rotation) angle = (angle + delta * motion * music.musicRotation * Math.PI * 2 / 128) % (Math.PI * 2)
          glintPhase += delta * motion * music.musicGlintRate * .06
          const trigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(c.trigger as Cinema2AfterhoursTriggerId) ? c.trigger as Cinema2AfterhoursTriggerId : 'bar4'
          const hold = frame.transport?.paused === true || frame.transport?.playing === false
          // Consume held rhythm identities without cycling, so resume cannot replay them.
          const eventFrame = hold && frame.transport ? { ...frame, transport: { ...frame.transport, paused: false, playing: true } } : frame
          const event = resolveNightshiftPatternEvent(eventFrame, trigger, reset ? null : lastTime)
          const patternEdit = parameters.getEditRevision?.('pattern') ?? 0
          const basePattern = patterns.update(c.pattern, c.patternChange, trigger, event, patternEdit, reset, hold)
          const manual = patternEdit !== lastPatternEdit || c.pattern !== lastAuthoredPattern
          const performing = performance.update({ frame, base: basePattern, enabled: c.autoPerformance, manual, reset, beats: current, previousTime: lastTime })
          const pattern = performing.pattern
          const immediate = performing.immediate || (lastPatternChange !== c.patternChange && !c.patternChange && !performing.kind)
          const blend = transition.update(pattern, visualTime, immediate, reset)
          sceneFrame = { controls: c, phase, angle, pattern, music, glintPhase, ...blend }
          lastPatternEdit = patternEdit; lastAuthoredPattern = c.pattern
          lastPatternChange = c.patternChange
          lastTimestamp = frame.timestampMs; lastTime = time; track = frame.transport?.trackId
          generation = frame.contextGeneration; discontinuity = newGeneration; beats = current; sourceIdentity = source
        },
        dispose() {
          disposed = true
          if (!bridge && held) { assets.release(held); held = null }
        },
      },
      render: { providers: [{
        id: `${context.module.id}:nightshift`, moduleId: context.module.id, intent: 'world',
        execute(execution) {
          if (failed || disposed) return
          if (!loading) {
            loading = true
            void (async () => {
              let asset: Cinema2ThreeLoadedAsset | null = null
              try {
                const lib = await loadCinema2ThreeLibrary()
                if (disposed) return
                asset = await assets.acquire(lib, 'cinema2-nightshift-static', execution.lightingEnvironment?.quality ?? 'high')
                if (disposed) { assets.release(asset); return }
                library = lib; held = asset
              } catch (error) { if (asset) assets.release(asset); if (!disposed) report('NIGHTSHIFT_ASSET_LOAD_FAILED', error) }
            })()
          }
          if (!bridge && library && held) {
            const asset = held, lib = library
            try {
              controller = new Cinema2NightshiftSceneController(lib)
              bridge = context.resources.acquire('nightshift:bridge', 'NightshiftThreeSceneBridge', gl => new Cinema2ThreeSceneBridge(gl, lib, [{ asset, node: null }], {
                environmentUrl: quality => cinema2ThreeEnvironmentRegistry.resolveUrl('cinema2-nightshift-room', quality),
                modelController: {
                  attach: root => controller!.attach(root),
                  beforeDraw: () => { if (sceneFrame) controller!.apply(sceneFrame) },
                  dispose: () => controller?.dispose(),
                },
              }), value => { value.dispose(); assets.release(asset) })
            } catch (error) { controller?.dispose(); assets.release(asset); held = null; report('NIGHTSHIFT_SCENE_BUILD_FAILED', error); return }
          }
          if (bridge && sceneFrame) {
            bridge.draw(execution, overrides)
            // Measure during warmup and once at ready, not on every steady frame.
            if (!reportedReady) {
              context.resources.reportGpuBytes(bridge.estimateGpuBytes())
              reportedReady = bridge.ready
            }
          }
        },
      }] },
      getDiagnostics: () => [...diagnostics, ...(bridge?.getDiagnostics().map(d => ({ ...d, path: '$.config.environment' })) ?? [])],
    }
  },
}
