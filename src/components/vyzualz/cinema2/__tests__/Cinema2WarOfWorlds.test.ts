import { describe, expect, it } from 'vitest'
import { CINEMA2_ASSET_RECORDS } from '../assets/Cinema2AssetManifest.generated'
import { CINEMA2_DESIGN_PARENT_GROUP_IDS } from '../contracts/Cinema2NativePresetManifest'
import { cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { CINEMA2_WAR_OF_WORLDS_PRESET_MANIFEST as manifest } from '../presets/Cinema2WarOfWorldsPreset'

const assets = CINEMA2_ASSET_RECORDS.filter(record => record.id.startsWith('cinema2-war-of-worlds-'))
describe('War Of Worlds initial scene', () => {
  it('is visible, registered, and passes authoring and native compilation', () => {
    expect(manifest.metadata.name).toBe('War Of Worlds')
    expect(manifest.metadata.tags).not.toContain('internal')
    expect(cinema2NativePresetRegistry.get(manifest.id)).toBeTruthy()
    const gate = validateCinema2PresetAuthoringConventions({ role: 'reference', manifest })
    expect(gate.diagnostics).toEqual([])
    const compilation = compileCinema2NativePreset(manifest, {
      availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'],
    })
    expect(compilation.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    expect(compilation.ok).toBe(true)
  })

  it('exposes all four standard Design parents with connected controls and no choreography', () => {
    const groups = new Set(manifest.parameters?.filter(p => p.section === 'Design').map(p => p.designParentGroup))
    expect([...groups].sort()).toEqual([...CINEMA2_DESIGN_PARENT_GROUP_IDS].sort())
    expect(manifest.choreography?.rules ?? []).toHaveLength(0)
    expect(manifest.modules?.[0]?.config?.instances).toEqual([
      { asset: 'cinema2-war-of-worlds-a', node: 'war-of-worlds-model' },
      { asset: 'cinema2-war-of-worlds-b', node: 'war-of-worlds-model' },
    ])
  })

  it('ships all 381715 source triangles on both tiers, with local assets and attribution', () => {
    expect(assets).toHaveLength(2)
    let triangles = 0
    for (const asset of assets) {
      const files = asset.files as { high: { triangles: number }; low: { triangles: number } }
      triangles += files.high.triangles
      expect(files.high.triangles).toBe(files.low.triangles)
      expect(files.high.triangles).toBeLessThanOrEqual(250000)
      expect(asset.license).toBe('CC-BY-4.0')
      expect(asset.attribution).toContain('pinguinoconpulgares')
      expect(cinema2ThreeAssetRegistry.resolveUrl(asset.id, 'low')).toContain('-low.glb')
    }
    expect(triangles).toBe(381715)
  })
})
