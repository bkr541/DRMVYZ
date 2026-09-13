import {
  CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST,
  type Cinema2CapabilityId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST } from './Cinema2ReferenceVisualPreset'
import { CINEMA2_REACTOR_PRESET_MANIFEST } from './Cinema2ReactorPreset'
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
    return compileCinema2NativePreset(manifest, options)
  }
}

export const CINEMA2_RUNTIME_FOUNDATION_PRESET_ID = CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST.id

export const cinema2NativePresetRegistry = new Cinema2PresetRegistry()
const foundationRegistration = cinema2NativePresetRegistry.register(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST)
if (!foundationRegistration.ok) {
  throw new Error(`Cinema 2.0 foundation preset registration failed: ${foundationRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const referenceVisualRegistration = cinema2NativePresetRegistry.register(CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST)
if (!referenceVisualRegistration.ok) {
  throw new Error(`Cinema 2.0 Reference Visual preset registration failed: ${referenceVisualRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
const reactorRegistration = cinema2NativePresetRegistry.register(CINEMA2_REACTOR_PRESET_MANIFEST)
if (!reactorRegistration.ok) {
  throw new Error(`Cinema 2.0 Reactor preset registration failed: ${reactorRegistration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
