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

  it('is revision 9, so a parameter state saved by an earlier, angled or differently framed version is discarded', () => {
    expect(manifest.revision).toBe(9)
    const compiled = cinema2NativePresetRegistry.compile(manifest.id)
    if (!compiled.ok) throw new Error('Open Decks did not compile')
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const stale = JSON.parse(state.serialize())
    stale.presetRevision = 8
    stale.values = { ...stale.values, 'open-decks-heading': 24 }
    expect(state.restore(JSON.stringify(stale)).ok).toBe(false)
    expect(state.getValue('open-decks-heading' as never)).toBe(0)
  })

  it('looks down onto the table by default', () => {
    const camera = manifest.cameras?.[0]
    expect(camera?.rig).toMatchObject({ kind: 'orbit', azimuthDegrees: 0, elevationDegrees: 30 })
    const defaults = Object.fromEntries((manifest.parameters ?? []).map(parameter => [parameter.id, parameter.defaultValue]))
    expect(defaults['open-decks-heading']).toBe(0)
    expect(defaults['open-decks-elevation']).toBe(30)
  })

  it('accepts camera elevation down to -70 degrees', () => {
    const elevation = manifest.parameters!.find(parameter => parameter.id === 'open-decks-elevation')!
    expect(elevation.min).toBe(-70)
    expect(elevation.max).toBe(30)
    const compiled = cinema2NativePresetRegistry.compile(manifest.id)
    if (!compiled.ok) throw new Error('Open Decks did not compile')
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    expect(state.setPersistentValue(elevation.id, -70).ok).toBe(true)
    expect(state.getValue(elevation.id)).toBe(-70)
  })

  it('restores close CDJ framing instead of the wide booth composition', () => {
    const camera = manifest.cameras![0]!
    expect(camera.rig).toMatchObject({ kind: 'orbit', radius: 5.6 })
    expect(camera.target).toEqual([0, 7.5, 0])
    expect(camera.minAspect).toBeCloseTo(1.15, 6)
    expect(camera.minAspectAnchor).toBe(0)
    const half = 5.6 * Math.tan(((camera.fovDegrees ?? 40) / 2) * Math.PI / 180)
    expect(half).toBeGreaterThan(1.9)
    expect(half * camera.minAspect!).toBeGreaterThan(1.25)
    const distance = manifest.parameters!.find(parameter => parameter.id === 'open-decks-distance')!
    expect(distance.defaultValue).toBe(5.6)
    expect(distance.max).toBe(40)
  })

  it('never zooms with Auto Performance on: no rule touches the lens or the distance, and camera movement is limited to heading sway and a crowd-reveal dip', () => {
    const targets = (manifest.choreography?.rules ?? []).flatMap(rule => rule.actions.map(action => action.target as { kind: string; ref?: { $ref: string }; property?: string }))
    const camera = targets.filter(target => target.kind === 'camera')
    expect(camera.length).toBeGreaterThan(0)
    for (const target of camera) expect(['control.orbitAzimuthDegrees', 'control.orbitElevationDegrees']).toContain(target.property)
    const sway = (manifest.choreography?.rules ?? []).filter(rule => String(rule.id).startsWith('open-decks-auto-sway-'))
    expect(sway).toHaveLength(2)
    expect(sway.map(rule => (rule.actions[0] as { value: number }).value).sort()).toEqual([-4, 4])
  })

  it('is lifted off its backdrop: the raised parts cast shadows onto the plate and glass beneath them and the device onto the wall behind it under a shadow-casting key, with a rim and a fill and the studio environment', () => {
    const module = manifest.modules?.[0]
    expect(module?.config?.shadows).toEqual({ cast: ['cdj', 'table'], receive: ['cdj', 'screen', 'table', 'backdrop'] })
    expect(module?.config?.environment).toBe('cinema2-studio-environment-neutral')
    const lights = manifest.lighting?.lights ?? []
    expect(lights.map(light => light.type)).toEqual(['spot', 'spot', 'spot', 'spot', 'spot'])
    expect(lights.filter(light => light.config?.threeShadow === true).map(light => light.id)).toEqual(['open-decks-key'])
  })
})

it('lays the CDJ flat with its back plane resting on the tabletop', () => {
  const node = manifest.scene!.nodes.find(node => node.id === 'open-decks-model')!
  expect(node.transform!.rotation).toEqual([-Math.PI / 2, 0, 0])
  expect(node.transform!.position).toEqual([0, 7.2, 0])
})

it('adds a music-gated crowd reveal without changing camera distance or authored defaults', () => {
  expect(manifest.modules?.[0].typeId).toBe('open-decks-club')
  const dip = manifest.choreography!.rules!.find(rule => rule.id === 'open-decks-auto-club-reveal')!
  expect(dip.enabledParameter?.$ref).toBe('open-decks-auto-performance')
  expect(dip.source).toEqual({ signal: 'drop', capability: 'music.drop' })
  expect(dip.actions[0]).toMatchObject({ operation: 'envelope', value: -22, composition: 'add', envelope: { attack: 1, hold: 2, release: 6, unit: 'beats' } })
})
