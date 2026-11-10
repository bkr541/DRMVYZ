import {
  CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST,
  type Cinema2CapabilityId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from './Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from './Cinema2PresetAuthoring'
import {
  compileCinema2NativePreset,
  type Cinema2PresetCompilationResult,
  type Cinema2PresetDiagnostic,
} from './Cinema2PresetCompiler'

export interface Cinema2PresetRegistryRegisterResult {
  ok: boolean
  diagnostics: readonly Cinema2PresetDiagnostic[]
}

export interface Cinema2PresetRegistryCompileOptions {
  availableCapabilities?: Iterable<Cinema2CapabilityId>
}

/**
 * Cinema 2.0-only authored preset registry. It intentionally has no dependency
 * on the Cinema 1 catalog, graph compiler, adapters or runtime owners.
 */
export class Cinema2PresetRegistry {
  private readonly compiled = new Map<string, Cinema2PresetCompilationResult>()
  private readonly manifests = new Map<Cinema2PresetId, Readonly<Cinema2NativePresetManifest>>()

  register(value: unknown): Cinema2PresetRegistryRegisterResult {
    const compiled = compileCinema2NativePreset(value)
    if (!compiled.ok) return { ok: false, diagnostics: compiled.diagnostics }
    const presetId = compiled.plan.presetId
    if (this.manifests.has(presetId)) {
      return {
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: 'CINEMA2_PRESET_REGISTRY_DUPLICATE_ID',
          severity: 'error' as const,
          message: `Cinema 2.0 preset "${presetId}" is already registered.`,
          path: '$.id',
        })]),
      }
    }
    this.manifests.set(presetId, compiled.plan.manifest)
    return { ok: true, diagnostics: compiled.diagnostics }
  }

  has(presetId: Cinema2PresetId): boolean {
    return this.manifests.has(presetId)
  }

  get(presetId: Cinema2PresetId): Readonly<Cinema2NativePresetManifest> | null {
    return this.manifests.get(presetId) ?? null
  }

  list(): readonly Readonly<Cinema2NativePresetManifest>[] {
    return Object.freeze([...this.manifests.values()].sort((left, right) => left.id.localeCompare(right.id)))
  }

  compile(
    presetId: Cinema2PresetId,
    options: Cinema2PresetRegistryCompileOptions = {},
  ): Cinema2PresetCompilationResult {
    const manifest = this.manifests.get(presetId)
    if (!manifest) {
      return {
        ok: false,
        plan: null,
        diagnostics: Object.freeze([Object.freeze({
          code: 'CINEMA2_PRESET_REGISTRY_NOT_FOUND',
          severity: 'error' as const,
          message: `Cinema 2.0 preset "${presetId}" is not registered.`,
          path: '$.id',
        })]),
      }
    }
    const capabilities = options.availableCapabilities == null ? undefined : [...new Set(options.availableCapabilities)].sort()
    const key = JSON.stringify([presetId, capabilities ?? null])
    const cached = this.compiled.get(key)
    if (cached) {
      this.compiled.delete(key)
      this.compiled.set(key, cached)
      return cached
    }
    const result = compileCinema2NativePreset(manifest, { availableCapabilities: capabilities })
    if (result.ok) {
      // Plans are deeply frozen by the compiler; never cache parameter state or GPU resources.
      this.compiled.set(key, Object.freeze(result))
      if (this.compiled.size > 64) this.compiled.delete(this.compiled.keys().next().value!)
    }
    return result
  }
}

export const CINEMA2_RUNTIME_FOUNDATION_PRESET_ID = CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST.id

export const cinema2NativePresetRegistry = new Cinema2PresetRegistry()
for (const declaration of CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS) {
  const authoringValidation = validateCinema2PresetAuthoringConventions(declaration)
  if (!authoringValidation.ok) {
    throw new Error(
      `Cinema 2.0 ${declaration.role} preset authoring validation failed for "${declaration.manifest.id}": ${authoringValidation.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`,
    )
  }
  const registration = cinema2NativePresetRegistry.register(declaration.manifest)
  if (!registration.ok) {
    throw new Error(
      `Cinema 2.0 ${declaration.role} preset registration failed for "${declaration.manifest.id}": ${registration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`,
    )
  }
}
