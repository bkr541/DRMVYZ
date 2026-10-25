import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleTypeDefinition, Cinema2ModuleDiagnostic } from './Cinema2ModuleContracts'
import { Cinema2ThreeAssetCache, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import { cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { cinema2ThreeEnvironmentRegistry } from './three/Cinema2ThreeEnvironmentRegistry'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'
import { Cinema2VacancySceneController, type VacancySceneFrame } from './vacancy/Cinema2VacancySceneController'
import { Cinema2VacancyPerformance } from './vacancy/Cinema2VacancyPerformance'
import { VACANCY_ASSET_ID, readVacancyControls } from './vacancy/Cinema2VacancyDomain'

export const CINEMA2_VACANCY_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('vacancy-native-render')
const assets = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)
/** The room is dark: the environment only keeps faint glints on the television glass. */
const overrides = { ...CINEMA2_THREE_DEFAULT_OVERRIDES, environmentIntensity: 0.05 }

export const cinema2VacancyNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = {
  typeId: CINEMA2_VACANCY_MODULE_TYPE_ID, version: 1,
  validate: module => module.config?.asset === VACANCY_ASSET_ID ? []
    : [{ code: 'VACANCY_ASSET_REQUIRED', message: 'VACANCY requires its addressed room and television set.', path: '$.config.asset' }],
  create(context) {
    let disposed = false, loading = false, failed = false
    let held: Cinema2ThreeLoadedAsset | null = null, library: Cinema2ThreeLibrary | null = null
    let bridge: Cinema2ThreeSceneBridge | null = null, controller: Cinema2VacancySceneController | null = null
    let sceneFrame: VacancySceneFrame | null = null
    const performance = new Cinema2VacancyPerformance()
    let reportedReady = false
    const diagnostics: Cinema2ModuleDiagnostic[] = []
    const report = (code: string, error: unknown) => {
      failed = true
      diagnostics.push({ code, message: error instanceof Error ? error.message : String(error), path: '$.config.asset' })
    }
    return {
      lifecycle: {
        update({ parameters, frame }) {
          const controls = readVacancyControls(parameters), state = performance.update(frame, controls, parameters)
          sceneFrame = { controls, timeSec: state.timeSec, performance: state, quality: sceneFrame?.quality ?? 'high' }
        },
        dispose() {
          disposed = true
          if (!bridge && held) { assets.release(held); held = null }
        },
      },
      render: { providers: [{
        id: `${context.module.id}:vacancy`, moduleId: context.module.id, intent: 'world',
        execute(execution) {
          if (failed || disposed) return
          if (sceneFrame) { sceneFrame.quality = execution.lightingEnvironment?.quality ?? 'high'; sceneFrame.media = context.media.get('screenMedia') }
          if (!loading) {
            loading = true
            void (async () => {
              let asset: Cinema2ThreeLoadedAsset | null = null
              try {
                const lib = await loadCinema2ThreeLibrary()
                if (disposed) return
                asset = await assets.acquire(lib, VACANCY_ASSET_ID, execution.lightingEnvironment?.quality ?? 'high')
                if (disposed) { assets.release(asset); return }
                library = lib; held = asset
              } catch (error) { if (asset) assets.release(asset); if (!disposed) report('VACANCY_ASSET_LOAD_FAILED', error) }
            })()
          }
          if (!bridge && library && held) {
            const asset = held, lib = library
            try {
              controller = new Cinema2VacancySceneController(lib)
              bridge = context.resources.acquire('vacancy:bridge', 'VacancyThreeSceneBridge', gl => new Cinema2ThreeSceneBridge(gl, lib, [{ asset, node: null }], {
                environmentUrl: quality => cinema2ThreeEnvironmentRegistry.resolveUrl('cinema2-studio-environment-neutral', quality),
                modelController: {
                  attach: root => controller!.attach(root),
                  beforeDraw: () => { if (sceneFrame) controller!.apply(sceneFrame) },
                  dispose: () => controller?.dispose(),
                },
              }), value => { value.dispose(); assets.release(asset) })
            } catch (error) { controller?.dispose(); assets.release(asset); held = null; report('VACANCY_SCENE_BUILD_FAILED', error); return }
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
