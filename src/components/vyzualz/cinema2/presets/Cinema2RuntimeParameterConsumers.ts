import type { Cinema2NativePresetManifest, Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { modelAudioConsumerParameterIds, modelAudioParameterId, resolveCinema2ModelAudioKind } from '../model/Cinema2ModelAudioParameterContract'
import type { Cinema2PresetDiagnostic } from './Cinema2PresetCompiler'

/** Validate explicit direct-reader declarations; never treat a prefix or arbitrary owner as a binding. */
export function validateCinema2RuntimeParameterConsumers(manifest: Readonly<Cinema2NativePresetManifest>): {
  consumers: ReadonlySet<Cinema2ParameterId>
  diagnostics: readonly Cinema2PresetDiagnostic[]
} {
  const consumers = new Set<Cinema2ParameterId>()
  const diagnostics: Cinema2PresetDiagnostic[] = []
  const fail = (message: string, path: string) => diagnostics.push({ code: 'CINEMA2_PRESET_RUNTIME_PARAMETER_CONSUMER_INVALID', severity: 'error', message, path })
  const declarations = manifest.runtimeParameterConsumers
  if (declarations === undefined) return { consumers, diagnostics }
  if (!Array.isArray(declarations)) {
    fail('Runtime parameter consumers must be an array.', '$.runtimeParameterConsumers')
    return { consumers, diagnostics }
  }
  const parameters = new Set((Array.isArray(manifest.parameters) ? manifest.parameters : []).map(parameter => parameter?.id))
  const preview = Array.isArray(manifest.modules) ? resolveCinema2ModelAudioKind(manifest) : null
  const kind = preview && parameters.has(modelAudioParameterId(preview, 'audioMappingsEnabled')) ? preview : null
  const allowed = new Set(kind ? modelAudioConsumerParameterIds(kind) : [])
  const owners = new Set<string>()
  for (const [index, declaration] of declarations.entries()) {
    const path = `$.runtimeParameterConsumers[${index}]`
    if (declaration?.owner !== 'model-audio-choreography' || !kind) {
      fail('Runtime parameter consumer must name an active, registered direct reader.', `${path}.owner`)
      continue
    }
    if (owners.has(declaration.owner)) {
      fail(`Duplicate runtime parameter consumer "${declaration.owner}".`, `${path}.owner`)
      continue
    }
    owners.add(declaration.owner)
    if (!Array.isArray(declaration.parameterIds) || declaration.parameterIds.length === 0) {
      fail('Runtime parameter consumer must declare a nonempty array of parameter IDs.', `${path}.parameterIds`)
      continue
    }
    for (const [parameterIndex, id] of declaration.parameterIds.entries()) {
      const parameterPath = `${path}.parameterIds[${parameterIndex}]`
      if (!parameters.has(id) || !allowed.has(id)) {
        fail(`Parameter "${String(id)}" is not a declared input of the active model audio reader.`, parameterPath)
      } else if (consumers.has(id)) {
        fail(`Duplicate runtime parameter input "${id}".`, parameterPath)
      } else {
        consumers.add(id)
      }
    }
  }
  return { consumers, diagnostics }
}
