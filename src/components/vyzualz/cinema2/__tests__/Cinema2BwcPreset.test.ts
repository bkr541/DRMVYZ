import { describe, expect, it, vi } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2BwcNativeModuleDefinition, CINEMA2_BWC_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2BwcNativeModule'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_BWC_PARAMETER_IDS, CINEMA2_BWC_PRESET_ID, CINEMA2_BWC_PRESET_MANIFEST } from '../presets/Cinema2BwcPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'

describe('Cinema 2.0 BWC preset', () => {
  it('registers as a static compilable keeper without choreography or effects', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_BWC_PRESET_ID)).toMatchObject({ role: 'keeper' })
    expect(cinema2NativeModuleRegistry.get(CINEMA2_BWC_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_BWC_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    expect(compileCinema2NativePreset(CINEMA2_BWC_PRESET_MANIFEST, { availableCapabilities: new Set(['render.webgl2']) }).ok).toBe(true)
    expect(CINEMA2_BWC_PRESET_MANIFEST.choreography).toBeUndefined()
    expect(CINEMA2_BWC_PRESET_MANIFEST.effects).toBeUndefined()
    expect(CINEMA2_BWC_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_BWC_PARAMETER_IDS.portalScale)).toMatchObject({ label: 'Portal Scale', designParentGroup: 'design' })
  })

  it('passes authored static geometry and palette values to the renderer', () => {
    const moduleManifest = CINEMA2_BWC_PRESET_MANIFEST.modules![0]!
    const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
    values.set('portalScale', 1.2)
    values.set('canScale', 0.8)
    values.set('conveyorWidth', 1.15)
    values.set('ledStrength', 1.25)
    const parameters = { get: (name: string) => values.get(name), getAuthored: (name: string) => values.get(name), resolve: () => null }
    const draw = vi.fn()
    const renderer = { draw, dispose: vi.fn(), estimateGpuBytes: () => 16384 }
    const definition = createCinema2BwcNativeModuleDefinition({ createRenderer: () => renderer })
    const resources = { acquire: (_key: string, _kind: string, create: (gl: WebGL2RenderingContext) => typeof renderer) => create({} as WebGL2RenderingContext), reportGpuBytes: vi.fn(), getSnapshot: () => ({ activeLeaseCount: 1, disposedLeaseCount: 0, estimatedGpuBytes: 16384 }) }
    const instance = definition.create({ module: moduleManifest, parameters, targets: {}, media: {}, resources, randomness: { sample: () => 0.5 } } as unknown as Cinema2ModuleCreateContext)
    instance.render!.providers[0]!.execute({ target: null, width: 1280, height: 720, frame: { elapsedTimeSec: 2 } } as never)
    expect(draw.mock.calls[0]![0]).toMatchObject({ width: 1280, height: 720, portalScale: 1.2, canScale: 0.8, conveyorWidth: 1.15, ledStrength: 1.25 })
    expect(resources.reportGpuBytes).toHaveBeenCalledWith(16384)
  })
})
