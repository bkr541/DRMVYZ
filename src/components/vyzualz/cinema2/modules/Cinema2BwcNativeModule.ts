import { cinema2StableId, type Cinema2Color, type Cinema2ModuleManifest, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleRenderExecutionContext, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2BwcRenderer, type Cinema2BwcRenderState } from './bwc/Cinema2BwcRenderer'

export const CINEMA2_BWC_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('bwc-native')
export const CINEMA2_BWC_NATIVE_MODULE_VERSION = 1 as const

export interface Cinema2BwcRendererLike {
  draw(state: Readonly<Cinema2BwcRenderState>): void
  estimateGpuBytes(): number
  dispose(): void
}

export function createCinema2BwcNativeModuleDefinition(
  options: { createRenderer?: (gl: WebGL2RenderingContext) => Cinema2BwcRendererLike } = {},
): Readonly<Cinema2ModuleTypeDefinition> {
  const createRenderer = options.createRenderer ?? (gl => new Cinema2BwcRenderer(gl))
  return Object.freeze({
    typeId: CINEMA2_BWC_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_BWC_NATIVE_MODULE_VERSION,
    validate: validateModule,
    create(context: Cinema2ModuleCreateContext) {
      const renderer = context.resources.acquire('bwc:factory-corridor-v2', 'Cinema2BwcRenderer', gl => createRenderer(gl), value => value.dispose())
      context.resources.reportGpuBytes(renderer.estimateGpuBytes())
      const provider = Object.freeze({
        id: `${context.module.id}:bwc`, moduleId: context.module.id, intent: 'fullscreen' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          const p = context.parameters
          renderer.draw({
            target: execution.target, width: execution.width, height: execution.height,
            intensity: clamp(readNumber(p, 'intensity', 1.1), 0, 2),
            portalScale: clamp(readNumber(p, 'portalScale', 1), 0.7, 1.35),
            canScale: clamp(readNumber(p, 'canScale', 1), 0.7, 1.35),
            conveyorWidth: clamp(readNumber(p, 'conveyorWidth', 1), 0.75, 1.35),
            ledStrength: clamp(readNumber(p, 'ledStrength', 0.85), 0, 1.5),
            background: rgb(readColor(p, 'backgroundColor', [0.035, 0.055, 0.058, 1])),
            structure: rgb(readColor(p, 'structureColor', [0.52, 0.59, 0.62, 1])),
            canWhite: rgb(readColor(p, 'canWhiteColor', [0.86, 0.88, 0.86, 1])),
            energy: rgb(readColor(p, 'energyColor', [0.28, 0.62, 0.18, 1])),
            darkMetal: rgb(readColor(p, 'darkMetalColor', [0.018, 0.028, 0.032, 1])),
          })
        },
      })
      return { lifecycle: { update() {}, dispose() {} }, render: { providers: Object.freeze([provider]) } }
    },
  })
}

export const cinema2BwcNativeModuleDefinition = createCinema2BwcNativeModuleDefinition()
function validateModule(_module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] { return Object.freeze([]) }
type Parameters = Cinema2ModuleCreateContext['parameters']
function readNumber(parameters: Parameters, name: string, fallback: number): number { const value = parameters.get(name); return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function readColor(parameters: Parameters, name: string, fallback: Cinema2Color): Cinema2Color { const value = parameters.get(name); return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component)) ? value as unknown as Cinema2Color : fallback }
function rgb(value: Cinema2Color): readonly [number, number, number] { return [value[0], value[1], value[2]] }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)) }
