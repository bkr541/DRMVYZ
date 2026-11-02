import { describe, expect, it } from 'vitest'
import { CINEMA2_ASSET_RECORDS } from '../assets/Cinema2AssetManifest.generated'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { CINEMA2_PSYLO_PRESET_MANIFEST as manifest } from '../presets/Cinema2PsyloPreset'
import { cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'

describe('PSYLO accepted keeper', () => {
  it('registers as a user-accepted keeper and compiles on the production path', () => {
    expect(manifest.metadata.name).toBe('PSYLO')
    expect(cinema2NativePresetRegistry.get(manifest.id)).toBeTruthy()
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(d => d.manifest.id === manifest.id)!
    expect(declaration.role).toBe('keeper')
    expect(validateCinema2PresetAuthoringConventions(declaration).diagnostics).toEqual([])
    const compiled = compileCinema2NativePreset(manifest, {
      availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'],
    })
    expect(compiled.diagnostics.filter(d => d.severity === 'error')).toEqual([])
    expect(compiled.ok).toBe(true)
  })

  it('authors four camera modes, eight native patterns and all mandatory manual controls', () => {
    expect(manifest.effects?.map(e => e.typeId)).toEqual(['volumetric-atmosphere', 'hdr-bloom', 'cinematic-finish'])
    expect(manifest.choreography?.rules.filter(r => r.source.signal !== 'parameter')).toHaveLength(15)
    expect(Object.keys(manifest.cameras?.[0].rigVariants ?? {})).toEqual(['travel', 'elevated', 'orbit', 'fixed'])
    const parameters = manifest.parameters!
    expect(parameters.find(p => p.label === 'Pattern')?.options).toHaveLength(8)
    expect(parameters.find(p => p.label === 'Pattern Change')?.defaultValue).toBe(false)
    expect(parameters.find(p => p.label === 'Trigger')?.options).toHaveLength(11)
    expect(parameters.find(p => p.label === 'Trigger')?.visibleWhen).toHaveLength(1)
    expect(parameters.find(p => p.label === 'BPM Sync')?.designParentGroup).toBe('master-controls')
    expect(parameters.filter(p => p.type === 'color' && p.designParentGroup === 'palette')).toHaveLength(8)
    expect(manifest.render?.targets?.[0].descriptor.depthFormat).toBe('depth24')
  })

  it('resolves a distinct low-memory asset while preserving the complete geometry', () => {
    const asset = CINEMA2_ASSET_RECORDS.find(a => a.id === 'cinema2-psylo-static')!
    expect(asset.license).toBe('CC-BY-4.0')
    expect(asset.attribution).toContain('QumoDone')
    const files = asset.files as { high: { triangles: number }; low: { triangles: number } }
    expect(files.high.triangles).toBeLessThanOrEqual(250000)
    expect(files.low.triangles).toBe(files.high.triangles)
    expect(cinema2ThreeAssetRegistry.resolveUrl(asset.id, 'low')).toContain('psylo-static-low.glb')
  })
})
