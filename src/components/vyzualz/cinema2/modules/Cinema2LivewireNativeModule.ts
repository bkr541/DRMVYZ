import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleParameterReadFacet, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { createCinema2SayItNativeModuleDefinition } from './Cinema2SayItNativeModule'
import { Cinema2LivewireBridge, LIVEWIRE_PATTERNS, type LivewirePerformance } from './livewire/Cinema2LivewireBridge'
import { buildLivewireGlyphAsset, LIVEWIRE_GLYPH_METRICS } from './livewire/Cinema2LivewireGlyphs'
import { CINEMA2_SAY_IT_PATTERN_IDS } from './sayIt/Cinema2SayItPatternController'
import { disposeObject } from './three/Cinema2ThreeAssetCache'

export const CINEMA2_LIVEWIRE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('livewire-native')
type TypographyOptions = NonNullable<Parameters<typeof createCinema2SayItNativeModuleDefinition>[0]>

export function createCinema2LivewireNativeModuleDefinition(options: TypographyOptions = {}): Readonly<Cinema2ModuleTypeDefinition> {
  return {
    typeId: CINEMA2_LIVEWIRE_MODULE_TYPE_ID,
    version: 1,
    create(context) {
      let state: LivewirePerformance = {
        coverage: 0.45, intensity: 1, period: 4, motion: 0.8, playing: false,
        energy: 0, vocal: 0, kick: 0, snare: 0, transient: 0, build: 0, drop: 0, silence: 0,
      }
      const adapt = (parameters: Cinema2ModuleParameterReadFacet, hostSync = true): Cinema2ModuleParameterReadFacet => ({
        ...parameters,
        get(name) {
          if (name === 'motionAmount') return 0
          if (name === 'bpmSync') return hostSync && parameters.get(name) !== false
          if (name === 'pattern') {
            const value = parameters.get(name)
            const index = LIVEWIRE_PATTERNS.findIndex(pattern => pattern.value === value)
            return CINEMA2_SAY_IT_PATTERN_IDS[Math.max(0, index)]
          }
          return parameters.get(name)
        },
      })
      const core = createCinema2SayItNativeModuleDefinition({
        glyphAssetId: 'cinema2-livewire-glyphs',
        glyphMetrics: LIVEWIRE_GLYPH_METRICS,
        defaultText: 'LIVEWIRE',
        displayName: 'LIVEWIRE',
        assets: { acquire: buildLivewireGlyphAsset, release: asset => disposeObject(asset.scene) },
        createBridge: (gl, library, asset) => new Cinema2LivewireBridge(gl, library, asset, () => state),
        ...options,
      }).create({ ...context, parameters: adapt(context.parameters) })

      return {
        ...core,
        lifecycle: {
          update(update: Cinema2ModuleUpdateContext) {
            const { parameters, frame } = update
            const number = (key: string, fallback: number, min: number, max: number) => {
              const value = parameters.get(key)
              return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
            }
            const active = frame.transport?.sourcePresent === true
            const enabled = active && parameters.get('autoPerformance') === true
            const playing = active && (frame.transport?.playing === true || frame.transport?.paused === true)
            const signal = (key: string) => enabled ? number(key, 0, 0, 1) : 0
            state = {
              coverage: number('coverage', 0.45, 0.08, 1),
              intensity: number('intensity', 1, 0, 1.6),
              period: number('cycleSeconds', 4, 2, 12),
              motion: number('motionAmount', 0.8, 0, 1),
              playing,
              energy: 0.72 * signal('energy') + 0.28 * signal('bass'),
              vocal: signal('vocal'),
              kick: signal('ledKick'),
              snare: signal('ledSnare'),
              transient: Math.max(signal('ledTransient'), signal('highs') * 0.38),
              build: signal('buildAmount'),
              drop: signal('dropAccent'),
              silence: active ? frame.mood?.silence ?? 0 : 0,
            }
            core.lifecycle.update({ ...update, parameters: adapt(parameters, frame.transport?.bpmSync !== false) })
          },
          dispose: () => core.lifecycle.dispose(),
        },
      }
    },
  }
}

export const cinema2LivewireNativeModuleDefinition = createCinema2LivewireNativeModuleDefinition()
