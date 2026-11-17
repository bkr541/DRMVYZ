import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { Cinema2NeonForestAutoPerformance } from './neonForest/Cinema2NeonForestAutoPerformance'
import { Cinema2NeonForestDirector } from './neonForest/Cinema2NeonForestDirector'
import { NeonForestPatternTransition } from './neonForest/Cinema2NeonForestTransition'
import { Cinema2NeonForestAudio, NEON_FOREST_MUSIC_DEFAULTS, NeonForestPatternController, readNeonForestChoreography, resolveNeonForestEvent, resolveNeonForestMusic, selectNeonForestAudio } from './neonForest/Cinema2NeonForestAudio'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { readNeonForestControls, type NeonForestControls } from './neonForest/Cinema2NeonForestDomain'
import { Cinema2NeonForestSceneController } from './neonForest/Cinema2NeonForestSceneController'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleDiagnostic, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2ThreeAssetCache, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import { cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'

export const CINEMA2_NEON_FOREST_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('neon-forest-native-render')
const assets = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)
const overrides = { ...CINEMA2_THREE_DEFAULT_OVERRIDES, environmentIntensity: .18 }

/** Native rooted geometry; all timing, camera and parameter authority stays shared. */
export const cinema2NeonForestNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = {
  typeId: CINEMA2_NEON_FOREST_MODULE_TYPE_ID,
  version: 1,
  validate: module => module.config?.asset === 'cinema2-neon-forest-static' ? []
    : [{ code: 'NEON_FOREST_ASSET_REQUIRED', message: 'NEON_FOREST requires its prepared static forest.', path: '$.config.asset' }],
  create(context) {
    let disposed = false, loading = false, failed = false, reportedReady = false
    let held: Cinema2ThreeLoadedAsset | null = null
    let library: Cinema2ThreeLibrary | null = null
    let bridge: Cinema2ThreeSceneBridge | null = null
    const diagnostics: Cinema2ModuleDiagnostic[] = []
    const patternControls = new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
    const clock = new Cinema2BeatClock(), delivery = new Cinema2NeonForestAudio(), patterns = new NeonForestPatternController(), transition = new NeonForestPatternTransition(), director = new Cinema2NeonForestDirector(), performance = new Cinema2NeonForestAutoPerformance()
    let music = { ...NEON_FOREST_MUSIC_DEFAULTS } as import('./neonForest/Cinema2NeonForestAudio').NeonForestMusic
    let audioAvailable = false, wasPaused = false
    let patternWeights: readonly number[] = [1, 0, 0, 0, 0, 0, 0, 0], patternAuthority = ''
    let sourceIdentity: string | null = null, analysisIdentity: string | null = null, discontinuity = -1
    let controller: Cinema2NeonForestSceneController | null = null
    let controls: NeonForestControls | null = null
    let lastTimestamp: number | null = null
    let phase = 0, beats = 0, time: number | null = null, track: string | null | undefined, generation = -1
    const fail = (code: string, error: unknown) => {
      failed = true
      diagnostics.push({ code, message: error instanceof Error ? error.message : String(error), path: '$.config.asset' })
    }
    return {
      lifecycle: {
        update({ parameters, frame: incoming, targets }) {
          const selected = selectNeonForestAudio(incoming)
          const frame = { ...incoming, audio: selected, director: selected ? incoming.director : null }
          controls = readNeonForestControls(parameters)
          const ambientIdle = frame.transport?.sourcePresent === false
          if (ambientIdle) controls = { ...controls, amount: controls.amount * .35 }
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
          const savedTrigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(controls.trigger as Cinema2AfterhoursTriggerId) ? controls.trigger as Cinema2AfterhoursTriggerId : 'bar4'
          // With Auto Performance on and music playing, Pattern Change and the Trigger are the music's choice (the saved values are never written to).
          // The manual-edit check below keeps reading the saved values, so the music's choice never counts as an edit.
          const control = patternControls.update({ saved: { patternChange: controls.patternChange, trigger: savedTrigger }, mood: frame.mood, autoPerformance: controls.autoPerformance && active && frame.transport?.sourcePresent === true })
          const trigger = control.trigger
          const event = resolveNeonForestEvent(eventFrame, trigger, reset || activated ? null : time)
          const channels = readNeonForestChoreography(parameters)
          const responseReset = reset || activated || refreshed || returning
          const delivered = delivery.update(frame, controls.musicResponse, reset || activated ? null : time, responseReset, resuming, channels)
          music = resolveNeonForestMusic(director.apply(frame, controls.musicResponse, delivered, channels, responseReset, resuming), parameters, targets)
          const authority = JSON.stringify([controls.pattern, parameters.getEditRevision?.('pattern') ?? 0, controls.patternChange, savedTrigger])
          const manual = authority !== patternAuthority
          controls.pattern = patterns.update(controls.pattern, control.patternChange, trigger, event, parameters.getEditRevision?.('pattern') ?? 0, reset || activated, !active || refreshed || returning || resuming)
          const current = clock.update(governedFrame, controls.bpmSync, 100).beats
          const performing = performance.update({ frame, base: controls.pattern, enabled: controls.autoPerformance,
            manual, reset: responseReset, latch: resuming, beats: current, previousTime: time })
          controls.pattern = performing.pattern
          patternWeights = transition.update(controls.pattern, active && controls.motion && controls.amount > 0 && controls.speed > 0 ? dt : 0, reset || activated || manual || performing.immediate)
          patternAuthority = authority
          if (!frame.transport?.paused) audioAvailable = selected != null
          wasPaused = frame.transport?.paused === true
          sourceIdentity = source; analysisIdentity = revision; discontinuity = newDiscontinuity
          if (controls.motion && controls.amount > 0 && active) phase += Math.max(0, current - beats) * controls.speed * (ambientIdle ? .22 : 1)
          beats = current; time = currentTime; track = frame.transport?.trackId; generation = frame.contextGeneration
        },
        dispose() {
          disposed = true
          patternControls.reset()
          if (!bridge && held) { assets.release(held); held = null }
        },
      },
      render: { providers: [{
        id: `${context.module.id}:neonForest`, moduleId: context.module.id, intent: 'world',
        execute(execution) {
          if (disposed || failed) return
          if (!loading) {
            loading = true
            void (async () => {
              let asset: Cinema2ThreeLoadedAsset | null = null
              try {
                const lib = await loadCinema2ThreeLibrary()
                if (disposed) return
                asset = await assets.acquire(lib, 'cinema2-neon-forest-static', execution.lightingEnvironment?.quality ?? 'high')
                if (disposed) { assets.release(asset); return }
                held = asset; library = lib
              } catch (error) {
                if (asset) assets.release(asset)
                if (!disposed) fail('NEON_FOREST_ASSET_LOAD_FAILED', error)
              }
            })()
          }
          if (!bridge && held && library) {
            const asset = held, lib = library
            try {
              controller = new Cinema2NeonForestSceneController(lib)
              bridge = context.resources.acquire('neonForest:bridge', 'NeonForestThreeSceneBridge',
                gl => new Cinema2ThreeSceneBridge(gl, lib, [{ asset, node: null }], {
                  modelController: { attach: root => controller!.attach(root), beforeDraw: () => { if (controls) controller!.apply(controls, phase, music, patternWeights) }, dispose: () => controller?.dispose() },
                }),
                value => { value.dispose(); assets.release(asset) })
            } catch (error) {
              controller?.dispose(); assets.release(asset); held = null; fail('NEON_FOREST_SCENE_BUILD_FAILED', error); return
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
      inspect: () => patternControls.inspect(),
    }
  },
}
