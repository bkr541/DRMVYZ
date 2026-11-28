import { describe, expect, it } from 'vitest'
import { cinema2StableId, type Cinema2NativePresetManifest, type Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2ModelAudioParameters } from '../model/Cinema2ModelAudioChoreography'
import { createCinema2ModelCinematicParameters } from '../presets/Cinema2ModelCinematicAuthoring'
import { modelAudioConsumerParameterIds } from '../model/Cinema2ModelAudioParameterContract'
import { CINEMA2_SELECTABLE_USER_MODEL_PREVIEWS } from '../model/Cinema2UserModelPreviewPatterns'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { createCinema2UserModelPreset, cinema2UserModelPreviewParameterId } from '../presets/Cinema2UserModelPresetFactory'

const kinds = CINEMA2_SELECTABLE_USER_MODEL_PREVIEWS
const check = (manifest: Readonly<Cinema2NativePresetManifest>) => validateCinema2PresetAuthoringConventions({ role: 'reference', manifest })
const invalid = 'CINEMA2_PRESET_RUNTIME_PARAMETER_CONSUMER_INVALID'
const unconsumed = 'CINEMA2_PRESET_AUTHORING_CONTROL_UNCONSUMED'
function legacyFixture(): Cinema2NativePresetManifest {
  const raw = createCinema2UserModelPreset('form')
  const id = (key: string) => cinema2UserModelPreviewParameterId('form', key)
  const visual = [...raw.parameters!, ...createCinema2ModelCinematicParameters(id).filter(p => p.id === id('cinematicMaterial'))]
  const audio = createCinema2ModelAudioParameters('form', visual)
  return { ...raw, parameters: [...visual, ...audio], runtimeParameterConsumers: [{ owner: 'model-audio-choreography', parameterIds: modelAudioConsumerParameterIds('form') }] }
}

describe('Cinema 2.0 direct runtime parameter consumers', () => {
  it.each(kinds)('validates and compiles the real %s preview, before and after production auto coverage', kind => {
    const raw = createCinema2UserModelPreset(kind)
    expect(raw.runtimeParameterConsumers).toBeUndefined()
    expect(check(raw).diagnostics).toEqual([])
    const production = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(declaration => declaration.manifest.id === raw.id)!
    expect(production.manifest.runtimeParameterConsumers).toEqual(raw.runtimeParameterConsumers)
    expect(validateCinema2PresetAuthoringConventions(production).diagnostics).toEqual([])
    const result = cinema2NativePresetRegistry.compile(raw.id)
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true)
    if (!result.ok) throw new Error('Production preset failed compilation')
    expect(result.plan.manifest.runtimeParameterConsumers).toEqual(raw.runtimeParameterConsumers)
    expect(result.plan.manifest.revision).toBe(1)
    expect(result.plan.manifest.modules).toEqual(raw.modules)
    expect(result.plan.manifest.parameters).toEqual(production.manifest.parameters)
    expect(result.plan.manifest.parameters?.map(parameter => [parameter.id, parameter.defaultValue])).toEqual(raw.parameters?.map(parameter => [parameter.id, parameter.defaultValue]))
  })

  it('initializes the complete production catalog and retains every registration', () => {
    expect(cinema2NativePresetRegistry.list().map(manifest => manifest.id)).toEqual(
      CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.map(declaration => declaration.manifest.id).sort((a, b) => a.localeCompare(b)),
    )
  })

  it('still rejects real direct inputs when their consumer declaration is absent', () => {
    const raw = legacyFixture()
    const result = check({ ...raw, runtimeParameterConsumers: undefined })
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: unconsumed, message: expect.stringContaining('user-model-form-audio-map1-source') })]))
  })

  it('rejects fabricated inputs, unknown IDs, duplicate IDs and unregistered owners in both gates', () => {
    const raw = legacyFixture()
    const declaration = raw.runtimeParameterConsumers![0]!
    const fake = cinema2StableId<Cinema2ParameterId>('user-model-form-audio-map1-fake')
    const extra = { ...raw, parameters: [...raw.parameters!, { id: fake, label: 'Fake control', type: 'boolean' as const, defaultValue: false }] }
    const cases: Cinema2NativePresetManifest[] = [
      { ...extra, runtimeParameterConsumers: [{ ...declaration, parameterIds: [...declaration.parameterIds, fake] }] },
      { ...raw, runtimeParameterConsumers: [{ ...declaration, parameterIds: [...declaration.parameterIds, cinema2UserModelPreviewParameterId('shatter', 'audioMap1Source')] }] },
      { ...raw, runtimeParameterConsumers: [{ ...declaration, parameterIds: [...declaration.parameterIds, declaration.parameterIds[0]!] }] },
      { ...raw, runtimeParameterConsumers: [declaration, declaration] },
      { ...raw, runtimeParameterConsumers: [{ ...declaration, owner: 'nonexistent' }] } as unknown as Cinema2NativePresetManifest,
      { ...raw, runtimeParameterConsumers: [{ ...declaration, parameterIds: [] }] },
      { ...raw, runtimeParameterConsumers: {} } as unknown as Cinema2NativePresetManifest,
      { ...raw, modules: raw.modules!.map(module => ({ ...module, config: { ...module.config, userModelPreview: 'unknown' } })) },
      { ...raw, parameters: raw.parameters!.filter(parameter => parameter.id !== cinema2UserModelPreviewParameterId('form', 'audioMappingsEnabled')) },
    ]
    for (const manifest of cases) {
      expect(check(manifest).diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: invalid })]))
      const compiled = compileCinema2NativePreset(manifest)
      expect(compiled.ok).toBe(false)
      expect(compiled.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: invalid })]))
    }
    // An unrelated control cannot be rescued by the direct reader declaration.
    expect(check(extra).diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: unconsumed, message: expect.stringContaining(fake) })]))
  })
})
