import type { Cinema2EffectManifest, Cinema2EffectTypeId } from '../contracts/Cinema2NativePresetManifest'
import {
  cinema2BloomEffectDefinition,
  cinema2BlurEffectDefinition,
} from './Cinema2BuiltinEffects'
import type { Cinema2EffectDiagnostic, Cinema2EffectTypeDefinition } from './Cinema2EffectContracts'

export interface Cinema2EffectRegistryResult {
  ok: boolean
  diagnostics: readonly Cinema2EffectDiagnostic[]
}

function registryKey(typeId: Cinema2EffectTypeId, version: number): string {
  return `${typeId}@${version}`
}

export class Cinema2EffectRegistry {
  private readonly definitions = new Map<string, Readonly<Cinema2EffectTypeDefinition>>()

  register(definition: Cinema2EffectTypeDefinition): Cinema2EffectRegistryResult {
    if (!Number.isInteger(definition.version) || definition.version < 1) {
      return failure('CINEMA2_EFFECT_REGISTRY_VERSION_INVALID', 'Effect type version must be a positive integer.', '$.version')
    }
    const key = registryKey(definition.typeId, definition.version)
    if (this.definitions.has(key)) {
      return failure(
        'CINEMA2_EFFECT_REGISTRY_VERSION_CONFLICT',
        `Cinema 2.0 effect type "${definition.typeId}" version ${definition.version} is already registered.`,
        '$.version',
      )
    }
    this.definitions.set(key, Object.freeze({ ...definition }))
    return { ok: true, diagnostics: Object.freeze([]) }
  }

  get(typeId: Cinema2EffectTypeId, version: number): Readonly<Cinema2EffectTypeDefinition> | null {
    return this.definitions.get(registryKey(typeId, version)) ?? null
  }

  validateEffects(effects: readonly Readonly<Cinema2EffectManifest>[]): Cinema2EffectRegistryResult {
    const diagnostics: Cinema2EffectDiagnostic[] = []
    for (const [index, effect] of effects.entries()) {
      const definition = this.get(effect.typeId, effect.version)
      if (!definition) {
        diagnostics.push({
          code: 'CINEMA2_EFFECT_TYPE_VERSION_UNAVAILABLE',
          path: `$.effects[${index}]`,
          effectId: effect.id,
          message: `No Cinema 2.0 effect implementation is registered for "${effect.typeId}" version ${effect.version}.`,
        })
        continue
      }
      try {
        diagnostics.push(...(definition.validate?.(effect) ?? []).map(diagnostic => ({
          ...diagnostic,
          path: effectDiagnosticPath(index, diagnostic.path),
          effectId: effect.id,
        })))
      } catch (error) {
        diagnostics.push({
          code: 'CINEMA2_EFFECT_VALIDATION_FAILED',
          path: `$.effects[${index}]`,
          effectId: effect.id,
          message: `Effect validation failed: ${errorMessage(error)}`,
        })
      }
    }
    return { ok: diagnostics.length === 0, diagnostics: Object.freeze(diagnostics.map(diagnostic => Object.freeze({ ...diagnostic }))) }
  }
}

function failure(code: string, message: string, path: string): Cinema2EffectRegistryResult {
  return { ok: false, diagnostics: Object.freeze([Object.freeze({ code, message, path })]) }
}

function effectDiagnosticPath(index: number, path: string): string {
  if (path === '$') return `$.effects[${index}]`
  if (path.startsWith('$.')) return `$.effects[${index}].${path.slice(2)}`
  return `$.effects[${index}].${path}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const cinema2NativeEffectRegistry = new Cinema2EffectRegistry()
for (const definition of [cinema2BlurEffectDefinition, cinema2BloomEffectDefinition]) {
  const registration = cinema2NativeEffectRegistry.register(definition)
  if (!registration.ok) {
    throw new Error(`Cinema 2.0 built-in effect registration failed: ${registration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
  }
}
