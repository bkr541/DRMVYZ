import type { Cinema2ModuleManifest, Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleDiagnostic, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { cinema2FullscreenShaderModuleDefinition } from './Cinema2FullscreenShaderModule'
import { cinema2ReactorNativeModuleDefinition } from './Cinema2ReactorNativeModule'
import { cinema2Object3DModuleDefinition } from './Cinema2Object3DModule'
import { cinema2ElectricStormNativeModuleDefinition } from './Cinema2ElectricStormNativeModule'
import { cinema2AfterhoursNativeModuleDefinition } from './Cinema2AfterhoursNativeModule'
import { cinema2InterlockNativeModuleDefinition } from './Cinema2InterlockNativeModule'
import { cinema2InterlockLiquidLightModuleDefinition } from './Cinema2InterlockLiquidLightModule'
import { cinema2HumNNativeModuleDefinition } from './Cinema2HumNNativeModule'
import { cinema2ThresholdNativeModuleDefinition } from './Cinema2ThresholdNativeModule'
import { cinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'

export interface Cinema2ModuleRegistryResult {
  ok: boolean
  diagnostics: readonly Cinema2ModuleDiagnostic[]
}

function registryKey(typeId: Cinema2ModuleTypeId, version: number): string {
  return `${typeId}@${version}`
}

export class Cinema2ModuleRegistry {
  private readonly definitions = new Map<string, Readonly<Cinema2ModuleTypeDefinition>>()

  register(definition: Cinema2ModuleTypeDefinition): Cinema2ModuleRegistryResult {
    if (!Number.isInteger(definition.version) || definition.version < 1) {
      return failure('CINEMA2_MODULE_REGISTRY_VERSION_INVALID', 'Module type version must be a positive integer.', '$.version')
    }
    const key = registryKey(definition.typeId, definition.version)
    if (this.definitions.has(key)) {
      return failure(
        'CINEMA2_MODULE_REGISTRY_VERSION_CONFLICT',
        `Cinema 2.0 module type "${definition.typeId}" version ${definition.version} is already registered.`,
        '$.version',
      )
    }
    this.definitions.set(key, Object.freeze({ ...definition }))
    return { ok: true, diagnostics: Object.freeze([]) }
  }

  get(typeId: Cinema2ModuleTypeId, version: number): Readonly<Cinema2ModuleTypeDefinition> | null {
    return this.definitions.get(registryKey(typeId, version)) ?? null
  }

  validateModules(modules: readonly Readonly<Cinema2ModuleManifest>[]): Cinema2ModuleRegistryResult {
    const diagnostics: Cinema2ModuleDiagnostic[] = []
    for (const [index, module] of modules.entries()) {
      const definition = this.get(module.typeId, module.version)
      if (!definition) {
        diagnostics.push({
          code: 'CINEMA2_MODULE_TYPE_VERSION_UNAVAILABLE',
          path: `$.modules[${index}]`,
          moduleId: module.id,
          message: `No Cinema 2.0 module implementation is registered for "${module.typeId}" version ${module.version}.`,
        })
        continue
      }
      try {
        diagnostics.push(...(definition.validate?.(module) ?? []).map(diagnostic => ({
          ...diagnostic,
          path: moduleDiagnosticPath(index, diagnostic.path),
          moduleId: module.id,
        })))
      } catch (error) {
        diagnostics.push({
          code: 'CINEMA2_MODULE_VALIDATION_FAILED',
          path: `$.modules[${index}]`,
          moduleId: module.id,
          message: `Module validation failed: ${errorMessage(error)}`,
        })
      }
    }
    return { ok: diagnostics.length === 0, diagnostics: Object.freeze(diagnostics.map(diagnostic => Object.freeze({ ...diagnostic }))) }
  }
}

function failure(code: string, message: string, path: string): Cinema2ModuleRegistryResult {
  return { ok: false, diagnostics: Object.freeze([Object.freeze({ code, message, path })]) }
}

export const cinema2NativeModuleRegistry = new Cinema2ModuleRegistry()
const fullscreenShaderRegistration = cinema2NativeModuleRegistry.register(cinema2FullscreenShaderModuleDefinition)
if (!fullscreenShaderRegistration.ok) {
  throw new Error(`Cinema 2.0 fullscreen shader module registration failed: ${fullscreenShaderRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const reactorNativeRegistration = cinema2NativeModuleRegistry.register(cinema2ReactorNativeModuleDefinition)
if (!reactorNativeRegistration.ok) {
  throw new Error(`Cinema 2.0 Reactor native module registration failed: ${reactorNativeRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const object3DRegistration = cinema2NativeModuleRegistry.register(cinema2Object3DModuleDefinition)
if (!object3DRegistration.ok) {
  throw new Error(`Cinema 2.0 Object3D module registration failed: ${object3DRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const electricStormRegistration = cinema2NativeModuleRegistry.register(cinema2ElectricStormNativeModuleDefinition)
if (!electricStormRegistration.ok) {
  throw new Error(`Cinema 2.0 Electric Storm native module registration failed: ${electricStormRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const afterhoursNativeRegistration = cinema2NativeModuleRegistry.register(cinema2AfterhoursNativeModuleDefinition)
if (!afterhoursNativeRegistration.ok) {
  throw new Error(`Cinema 2.0 Afterhours native module registration failed: ${afterhoursNativeRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const interlockNativeRegistration = cinema2NativeModuleRegistry.register(cinema2InterlockNativeModuleDefinition)
if (!interlockNativeRegistration.ok) {
  throw new Error(`Cinema 2.0 Interlock native module registration failed: ${interlockNativeRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const interlockLiquidLightRegistration = cinema2NativeModuleRegistry.register(cinema2InterlockLiquidLightModuleDefinition)
if (!interlockLiquidLightRegistration.ok) {
  throw new Error(`Cinema 2.0 Interlock liquid-light module registration failed: ${interlockLiquidLightRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const humNNativeRegistration = cinema2NativeModuleRegistry.register(cinema2HumNNativeModuleDefinition)
if (!humNNativeRegistration.ok) {
  throw new Error(`Cinema 2.0 HUM:N native module registration failed: ${humNNativeRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const thresholdNativeRegistration = cinema2NativeModuleRegistry.register(cinema2ThresholdNativeModuleDefinition)
if (!thresholdNativeRegistration.ok) {
  throw new Error(`Cinema 2.0 Threshold native module registration failed: ${thresholdNativeRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const threeSceneRegistration = cinema2NativeModuleRegistry.register(cinema2ThreeSceneModuleDefinition)
if (!threeSceneRegistration.ok) {
  throw new Error(`Cinema 2.0 Three scene module registration failed: ${threeSceneRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}

function moduleDiagnosticPath(index: number, path: string): string {
  if (path === '$') return `$.modules[${index}]`
  if (path.startsWith('$.')) return `$.modules[${index}].${path.slice(2)}`
  return `$.modules[${index}].${path}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
