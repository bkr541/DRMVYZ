import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleParameterReadFacet, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { createCinema2SayItNativeModuleDefinition } from './Cinema2SayItNativeModule'
import { Cinema2OrbitalBridge, type OrbitalDrawSettings } from './orbital/Cinema2OrbitalBridge'
import { orbitalControllerPattern } from './orbital/Cinema2OrbitalMotion'

export const CINEMA2_ORBITAL_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('orbital-native')
const SPHERE_ASSET_ID = 'cinema2-orbital-gyroscope'
const defaults: Readonly<OrbitalDrawSettings> = Object.freeze({
  amount: .7, ringTravel: 1, period: 8, size: 1, depth: 1, planet: .8, debris: .55,
  material: 'artifact', bass: 0, mids: 0, highs: 0, beat: 0,
})
type GlyphModuleOptions = NonNullable<Parameters<typeof createCinema2SayItNativeModuleDefinition>[0]>

function orbitalParameters(parameters: Cinema2ModuleParameterReadFacet): Cinema2ModuleParameterReadFacet {
  return {
    ...parameters,
    get(name) {
      if (name === 'motionAmount') return 0 // ORBITAL applies its own transforms to the assembled glyph layout.
      const value = parameters.get(name)
      if (name === 'pattern') return orbitalControllerPattern(value)
      if (name === 'materialStyle') return 'chrome'
      if (name === 'line1Text' && !(typeof value === 'string' && value.trim())) {
        const secondLine = parameters.get('line2Text')
        if (parameters.get('lineMode') === 'one' || !(typeof secondLine === 'string' && secondLine.trim())) return 'ORBITAL'
      }
      return value
    },
  }
}

/** Uses the existing text layout, asset leases and standard pattern-change authority. */
export function createCinema2OrbitalNativeModuleDefinition(options: Pick<GlyphModuleOptions, 'assets' | 'loadLibrary' | 'createBridge' | 'now'> = {}): Readonly<Cinema2ModuleTypeDefinition> {
  return {
    typeId: CINEMA2_ORBITAL_MODULE_TYPE_ID,
    version: 1,
    create(context) {
      let settings = defaults
      const typography = createCinema2SayItNativeModuleDefinition({
        ...options,
        displayName: 'ORBITAL',
        companionAssetId: SPHERE_ASSET_ID,
        createBridge: options.createBridge ?? ((gl, library, glyphs, companion) => {
          if (!companion) throw new Error('The ORBITAL metal sphere asset is missing.')
          return new Cinema2OrbitalBridge(gl, library, glyphs, companion.asset, companion.scene,
            () => settings, index => context.randomness.sample('orbital-environment', index))
        }),
      }).create({ ...context, parameters: orbitalParameters(context.parameters) })

      return {
        ...typography,
        lifecycle: {
          update(update) {
            const { frame, parameters } = update
            const read = (key: string, fallback: number, min = 0, max = 1) => {
              const value = parameters.get(key)
              return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
            }
            const safety = parameters.get('motionSafety')
            const gain = safety === 'lockoff' ? 0 : safety === 'reduced' ? .28 : 1
            const material = parameters.get('materialStyle')
            const auto = parameters.get('autoPerformance') !== false
            const paused = frame.transport?.paused || frame.transport?.animationActive === false
            settings = {
              amount: read('motionAmount', defaults.amount) * gain,
              ringTravel: read('ring-travel', defaults.ringTravel, 0, 1.4),
              period: read('cycleSeconds', defaults.period, 2, 20),
              size: read('gyroscope-size', defaults.size, .55, 1.35),
              depth: read('letter-depth', defaults.depth, .4, 2),
              planet: read('planet', defaults.planet),
              debris: read('debris', defaults.debris),
              material: material === 'polished' || material === 'amethyst' ? material : 'artifact',
              bass: auto ? paused ? settings.bass : Math.min(1, read('bass', 0) + read('ledKick', 0) * .35) : 0,
              mids: auto ? paused ? settings.mids : read('mids', 0) : 0,
              highs: auto ? paused ? settings.highs : Math.min(1, read('highs', 0) + read('ledTransient', 0) * .35) : 0,
              beat: auto ? paused ? settings.beat : Math.max(read('beatAccent', 0), read('downbeatAccent', 0)) : 0,
            }
            typography.lifecycle.update({ ...update, parameters: orbitalParameters(parameters) })
          },
          dispose: () => typography.lifecycle.dispose(),
        },
        getDiagnostics: () => typography.getDiagnostics?.().map(diagnostic => ({ ...diagnostic, code: diagnostic.code.replace('SAY_IT', 'ORBITAL') })) ?? [],
      }
    },
  }
}

export const cinema2OrbitalNativeModuleDefinition = createCinema2OrbitalNativeModuleDefinition()
