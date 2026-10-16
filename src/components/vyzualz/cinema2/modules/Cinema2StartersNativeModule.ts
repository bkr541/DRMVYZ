import { cinema2StableId, type Cinema2Color, type Cinema2ModuleManifest, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2BeatClock, type Cinema2BeatState } from './Cinema2BeatClock'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleRenderExecutionContext, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { Cinema2StartersRenderer, type Cinema2StartersRenderState } from './starters/Cinema2StartersRenderer'

export const CINEMA2_STARTERS_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('starters-native')
export const CINEMA2_STARTERS_NATIVE_MODULE_VERSION = 1 as const

export interface Cinema2StartersRendererLike {
  draw(state: Readonly<Cinema2StartersRenderState>): void
  estimateGpuBytes(): number
  dispose(): void
}

export function createCinema2StartersNativeModuleDefinition(
  options: { createRenderer?: (gl: WebGL2RenderingContext) => Cinema2StartersRendererLike } = {},
): Readonly<Cinema2ModuleTypeDefinition> {
  const createRenderer = options.createRenderer ?? (gl => new Cinema2StartersRenderer(gl))
  return Object.freeze({
    typeId: CINEMA2_STARTERS_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_STARTERS_NATIVE_MODULE_VERSION,
    validate: validateModule,
    create(context: Cinema2ModuleCreateContext) {
      const renderer = context.resources.acquire(
        'starters:procedural-scene-v1',
        'Cinema2StartersRenderer',
        gl => createRenderer(gl),
        value => value.dispose(),
      )
      context.resources.reportGpuBytes(renderer.estimateGpuBytes())
      const beatClock = new Cinema2BeatClock()
      let beat: Readonly<Cinema2BeatState> = beatClock.getState()
      let lastContextGeneration: number | null = null
      let lastTrackId: string | null | undefined
      let lastTransportTime: number | null = null

      const provider = Object.freeze({
        id: `${context.module.id}:starters`,
        moduleId: context.module.id,
        intent: 'fullscreen' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          const p = context.parameters
          renderer.draw({
            target: execution.target,
            width: execution.width,
            height: execution.height,
            time: beat.beats,
            intensity: clamp(readNumber(p, 'intensity', 1), 0, 2),
            caseOpen: clamp(readNumber(p, 'caseOpen', 0), 0, 1),
            ballSpread: clamp(readNumber(p, 'ballSpread', 1), 0.55, 1.6),
            ballScale: clamp(readNumber(p, 'ballScale', 1), 0.6, 1.5),
            grassDensity: clamp(readNumber(p, 'grassDensity', 0.72), 0, 1),
            ambientMotion: clamp(readNumber(p, 'ambientMotion', 0.45), 0, 1),
            glow: clamp(readNumber(p, 'glow', 0.38), 0, 1.5),
            vignette: clamp(readNumber(p, 'vignette', 0.35), 0, 1),
            energy: clamp(readNumber(p, 'overallEnergy', 0), 0, 1),
            bass: clamp(readNumber(p, 'bassPressure', 0), 0, 1),
            kick: clamp(readNumber(p, 'kickAccent', 0), 0, 1),
            snare: clamp(readNumber(p, 'snareAccent', 0), 0, 1),
            build: clamp(readNumber(p, 'buildAmount', 0), 0, 1),
            drop: clamp(readNumber(p, 'dropAccent', 0), 0, 1),
            highs: clamp(readNumber(p, 'highsAmount', 0), 0, 1),
            background: rgb(readColor(p, 'backgroundColor', [0.005, 0.06, 0.025, 1])),
            grass: rgb(readColor(p, 'grassColor', [0.02, 0.64, 0.18, 1])),
            leather: rgb(readColor(p, 'leatherColor', [0.68, 0.29, 0.055, 1])),
            ballRed: rgb(readColor(p, 'ballRedColor', [0.9, 0.055, 0.12, 1])),
            ballWhite: rgb(readColor(p, 'ballWhiteColor', [0.92, 0.94, 0.9, 1])),
            metal: rgb(readColor(p, 'metalColor', [0.58, 0.62, 0.6, 1])),
          })
        },
      })

      return {
        lifecycle: {
          update({ parameters, frame }: Cinema2ModuleUpdateContext) {
            const trackId = frame.transport?.trackId
            const transportTime = frame.transport?.timeSec
            const discontinuity = lastContextGeneration != null && (
              frame.contextGeneration !== lastContextGeneration
              || trackId !== lastTrackId
              || (typeof transportTime === 'number' && lastTransportTime != null && (transportTime < lastTransportTime || transportTime - lastTransportTime > 1))
            )
            if (discontinuity) beatClock.reset()
            beat = beatClock.update(frame, readBoolean(parameters, 'bpmSync', true))
            lastContextGeneration = frame.contextGeneration
            lastTrackId = trackId
            lastTransportTime = typeof transportTime === 'number' ? transportTime : null
          },
          dispose() { beatClock.reset() },
        },
        render: { providers: Object.freeze([provider]) },
      }
    },
  })
}

export const cinema2StartersNativeModuleDefinition = createCinema2StartersNativeModuleDefinition()

function validateModule(_module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] { return Object.freeze([]) }
type Parameters = Cinema2ModuleCreateContext['parameters']
function readNumber(parameters: Parameters, name: string, fallback: number): number { const value = parameters.get(name); return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function readBoolean(parameters: Parameters, name: string, fallback: boolean): boolean { const value = parameters.get(name); return typeof value === 'boolean' ? value : fallback }
function readColor(parameters: Parameters, name: string, fallback: Cinema2Color): Cinema2Color { const value = parameters.get(name); return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component)) ? value as unknown as Cinema2Color : fallback }
function rgb(value: Cinema2Color): readonly [number, number, number] { return [value[0], value[1], value[2]] }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)) }
