import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleParameterReadFacet, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { createCinema2SayItNativeModuleDefinition } from './Cinema2SayItNativeModule'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { Cinema2SubmergeBridge } from './submerge/Cinema2SubmergeBridge'
import { DEFAULT_SUBMERGE_STATE, submergePatternToController, type Cinema2SubmergeState } from './submerge/Cinema2SubmergeMotion'

export const CINEMA2_SUBMERGE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('submerge-native')
type GlyphModuleOptions = NonNullable<Parameters<typeof createCinema2SayItNativeModuleDefinition>[0]>

/** Shared text/loading/prewarm/trigger authority with a dedicated underwater scene implementation. */
export function createCinema2SubmergeNativeModuleDefinition(options: GlyphModuleOptions = {}): Readonly<Cinema2ModuleTypeDefinition> {
  return {
    typeId: CINEMA2_SUBMERGE_MODULE_TYPE_ID, version: 1,
    create(context) {
      let state: Readonly<Cinema2SubmergeState> = DEFAULT_SUBMERGE_STATE
      const clock = new Cinema2BeatClock()
      let source = ''
      let generation = -1
      let previousTime: number | null = null
      const adapt = (parameters: Cinema2ModuleParameterReadFacet): Cinema2ModuleParameterReadFacet => ({
        ...parameters,
        get: name => {
          // The common controller owns musical selection; SUBMERGE owns all glyph geometry.
          if (name === 'motionAmount') return 0
          if (name === 'pattern') return submergePatternToController(parameters.get(name))
          if (name === 'materialStyle') return parameters.get(name) === 'metal' ? 'chrome' : 'pearl'
          const value = parameters.get(name)
          if (name === 'line1Text' && !(typeof value === 'string' && value.trim())) {
            const secondLine = parameters.get('line2Text')
            if (parameters.get('lineMode') === 'one' || !(typeof secondLine === 'string' && secondLine.trim())) return 'SUBMERGE'
          }
          return value
        },
      })
      const definition = createCinema2SayItNativeModuleDefinition({
        ...options,
        displayName: 'SUBMERGE',
        createBridge: options.createBridge ?? ((gl, library, asset) => new Cinema2SubmergeBridge(gl, library, asset, () => state)),
      })
      const core = definition.create({ ...context, parameters: adapt(context.parameters) })
      return {
        ...core,
        lifecycle: {
          update(update: Cinema2ModuleUpdateContext) {
            const { frame, parameters } = update
            const identity = `${frame.transport?.trackId ?? frame.audio?.upstream.trackId ?? ''}:${frame.audio?.upstream.sourceId ?? ''}:${frame.audio?.upstream.publisherId ?? ''}`
            const time = frame.audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
            if (identity !== source || generation !== frame.contextGeneration || (previousTime != null && (time < previousTime - 0.05 || time - previousTime > Math.max(1, frame.deltaTimeSec * 6)))) clock.reset()
            source = identity
            generation = frame.contextGeneration
            previousTime = time
            const beat = clock.update(frame, parameters.get('bpmSync') !== false)
            const number = (key: string, fallback: number, min: number, max: number) => {
              const value = parameters.get(key)
              return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
            }
            const audioEnabled = parameters.get('autoPerformance') !== false
            const paused = frame.transport?.paused || frame.transport?.animationActive === false
            const signal = (key: 'bass' | 'mids' | 'highs' | 'energy') => {
              return audioEnabled ? number(key, 0, 0, 1) : 0
            }
            const color = (key: string, fallback: readonly [number, number, number]): readonly [number, number, number] => {
              const value = parameters.get(key)
              return Array.isArray(value) && value.length >= 3 && value.slice(0,3).every(v => typeof v === 'number' && Number.isFinite(v)) ? [value[0], value[1], value[2]] : fallback
            }
            const water = parameters.get('waterColor')
            const material = parameters.get('materialStyle')
            const safety = parameters.get('motionSafety')
            state = {
              beats: beat.beats, amount: number('motionAmount', 0.65, 0, 1),
              safety: safety === 'reduced' || safety === 'lockoff' ? safety : 'full',
              reach: number('spread', 1, 0, 1.5), period: number('cycleSeconds', 8, 2, 20),
              buoyancy: number('buoyancy', 0.6, 0, 1), depth: number('letter-depth', 1, 0.4, 2),
              waves: number('waves', 0.85, 0, 1.5), sunlight: number('sunlight', 1, 0, 2),
              sun: color('sun-color', DEFAULT_SUBMERGE_STATE.sun), foam: color('foam-color', DEFAULT_SUBMERGE_STATE.foam),
              caustics: number('caustics', 0.75, 0, 1.5), haze: number('haze', 0.055, 0, 0.15),
              particles: number('particles', 0.65, 0, 1), bubbles: number('bubbles', 0.5, 0, 1), architecture: number('architecture', 1, 0, 1),
              material: material === 'metal' || material === 'glass' ? material : 'ceramic',
              water: Array.isArray(water) && water.length >= 3 ? [Number(water[0]), Number(water[1]), Number(water[2])] : DEFAULT_SUBMERGE_STATE.water,
              bass: audioEnabled && paused ? state.bass : Math.min(1, signal('bass') + (audioEnabled ? number('ledKick', 0, 0, 1) * 0.4 : 0)),
              mids: audioEnabled && paused ? state.mids : signal('mids'),
              highs: audioEnabled && paused ? state.highs : Math.min(1, signal('highs') + (audioEnabled ? number('ledTransient', 0, 0, 1) * 0.5 : 0)),
              energy: audioEnabled && paused ? state.energy : signal('energy'),
            }
            core.lifecycle.update({ ...update, parameters: adapt(parameters) })
          },
          dispose() { clock.reset(); core.lifecycle.dispose() },
        },
        getDiagnostics: () => core.getDiagnostics?.().map(diagnostic => ({
          ...diagnostic, code: diagnostic.code.replace('SAY_IT', 'SUBMERGE'),
        })) ?? [],
      }
    },
  }
}
export const cinema2SubmergeNativeModuleDefinition = createCinema2SubmergeNativeModuleDefinition()
