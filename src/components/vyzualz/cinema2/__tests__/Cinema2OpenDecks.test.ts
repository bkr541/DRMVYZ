import { describe, expect, it } from 'vitest'
import { CINEMA2_ASSET_RECORDS } from '../assets/Cinema2AssetManifest.generated'
import { CINEMA2_DESIGN_PARENT_GROUP_IDS } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { CINEMA2_OPEN_DECKS_PRESET_MANIFEST as manifest } from '../presets/Cinema2OpenDecksPreset'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

describe('Open Decks (preview only)', () => {
  it('is a visible reference preset named Open Decks, registered, and passes authoring and native compilation', () => {
    expect(manifest.metadata.name).toBe('Open Decks')
    expect(manifest.metadata.tags).not.toContain('internal')
    expect(cinema2NativePresetRegistry.get(manifest.id)).toBeTruthy()
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(declaration => declaration.manifest.id === manifest.id)?.role).toBe('reference')
    expect(validateCinema2PresetAuthoringConventions({ role: 'reference', manifest }).diagnostics).toEqual([])
    const compilation = compileCinema2NativePreset(manifest, { availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] })
    expect(compilation.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    expect(compilation.ok).toBe(true)
  })

  it('exposes all four standard Design parents, and its only choreography is Auto Performance, gated by that toggle', () => {
    const groups = new Set(manifest.parameters?.filter(p => p.section === 'Design').map(p => p.designParentGroup))
    expect([...groups].sort()).toEqual([...CINEMA2_DESIGN_PARENT_GROUP_IDS].sort())
    const rules = manifest.choreography?.rules ?? []
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) expect(rule.enabledParameter?.$ref, rule.id).toBe('open-decks-auto-performance')
  })

  it('shows one model, the textured CDJ, from a local meshopt asset within the per-model triangle budget', () => {
    expect(manifest.modules?.[0]?.config?.instances).toEqual([{ asset: 'cinema2-open-decks', node: 'open-decks-model' }])
    const asset = CINEMA2_ASSET_RECORDS.find(record => record.id === 'cinema2-open-decks')!
    expect(asset).toBeTruthy()
    expect(asset.kind).toBe('model')
    expect(asset.compression).toBe('meshopt')
    expect(asset.license).toBe('generated-in-house')
    const files = asset.files as { high: { triangles: number; bytes: number } }
    expect(files.high.triangles).toBeGreaterThan(1_000)
    expect(files.high.triangles).toBeLessThanOrEqual(250_000)
    expect(cinema2ThreeAssetRegistry.resolveUrl(asset.id, 'high')).toContain('open-decks.glb')
  })

  it('is revision 3, so a parameter state saved by an earlier, angled or differently framed version is discarded', () => {
    expect(manifest.revision).toBe(3)
    const compiled = cinema2NativePresetRegistry.compile(manifest.id)
    if (!compiled.ok) throw new Error('Open Decks did not compile')
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const stale = JSON.parse(state.serialize())
    stale.presetRevision = 1
    stale.values = { ...stale.values, 'open-decks-heading': 24 }
    expect(state.restore(JSON.stringify(stale)).ok).toBe(false)
    expect(state.getValue('open-decks-heading' as never)).toBe(0)
  })

  it('faces the camera head on by default', () => {
    const camera = manifest.cameras?.[0]
    expect(camera?.rig).toMatchObject({ kind: 'orbit', azimuthDegrees: 0, elevationDegrees: 0 })
    const defaults = Object.fromEntries((manifest.parameters ?? []).map(parameter => [parameter.id, parameter.defaultValue]))
    expect(defaults['open-decks-heading']).toBe(0)
    expect(defaults['open-decks-elevation']).toBe(0)
  })

  it('is lifted off its backdrop: the raised parts cast shadows onto the plate and glass beneath them and the device onto the wall behind it under a shadow-casting key, with a rim and a fill and the studio environment', () => {
    const module = manifest.modules?.[0]
    expect(module?.config?.shadows).toEqual({ cast: ['cdj'], receive: ['cdj', 'screen', 'backdrop'] })
    expect(module?.config?.environment).toBe('cinema2-studio-environment-neutral')
    const lights = manifest.lighting?.lights ?? []
    expect(lights.map(light => light.type)).toEqual(['spot', 'spot', 'spot'])
    expect(lights.filter(light => light.config?.threeShadow === true).map(light => light.id)).toEqual(['open-decks-key'])
  })
})
