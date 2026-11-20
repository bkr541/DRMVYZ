import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CINEMA2_CHAMBER_PRESET_MANIFEST as manifest } from '../presets/Cinema2ChamberPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'

describe('CHAMBER source GLB preservation', () => {
  it('compiles and validates its original asset instance', () => {
    const result = compileCinema2NativePreset(manifest)
    if (!result.ok) throw new Error(result.diagnostics.map(entry => entry.message).join('\n'))
    expect(cinema2NativeModuleRegistry.validateModules(manifest.modules!).diagnostics).toEqual([])
    expect(cinema2NativeEffectRegistry.validateEffects(manifest.effects ?? []).diagnostics).toEqual([])
    expect(manifest.modules![0]!.config).toEqual({
      instances: [{ asset: 'cinema2-chamber', node: 'chamber-room', preserveMaterials: true, spin: false }],
      hdr: true,
    })
  })

  it('keeps the source materials and embedded texture, including authored emission', () => {
    const glb = readFileSync(new URL('../../../../../public/cinema2/models/chamber.glb', import.meta.url))
    const asset = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()) as {
      materials: { name: string; emissiveFactor?: number[]; pbrMetallicRoughness?: { roughnessFactor?: number } }[]
      images: { bufferView: number; mimeType: string }[]
      meshes: unknown[]
    }
    expect(asset.meshes).toHaveLength(23)
    expect(asset.materials).toHaveLength(10)
    expect(asset.materials.find(material => material.name === 'White')?.emissiveFactor).toEqual([1, 1, 1])
    expect(asset.materials.find(material => material.name === 'Turquoise')?.emissiveFactor).toEqual([0, 1, 1])
    expect(asset.materials.find(material => material.name === 'blue_metal_grey')?.pbrMetallicRoughness?.roughnessFactor).toBeLessThan(.13)
    expect(asset.images).toEqual([{ bufferView: expect.any(Number), mimeType: 'image/png' }])
    expect(Object.keys(manifest.modules![0]!.parameters!)).toEqual(['environmentIntensity'])
    expect(manifest.modules![0]!.parameterBindings).toBeUndefined()
  })

  it('handles viewer light and highlights without recoloring or replacing source surfaces', () => {
    expect(manifest.effects!.map(effect => effect.typeId)).toEqual(['hdr-bloom', 'cinematic-finish'])
    expect(manifest.effects![1]!.parameters).toMatchObject({ exposure: 1, contrast: 1, saturation: 1, temperature: 0, tint: 0, tintAmount: 0, grain: 0, aberration: 0 })
    expect(manifest.lighting!.lights.find(light => light.type === 'ambient')!.intensity).toBeLessThan(.05)
    expect(manifest.lighting!.lights.some(light => light.type === 'directional')).toBe(false)
    expect(manifest.choreography?.rules ?? []).toEqual([])
    expect(manifest.parameters ?? []).toEqual([])
    expect(manifest.render!.passes.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen', 'output'])
    expect(manifest.scene!.nodes.filter(node => node.kind === 'module')).toHaveLength(1)
    expect(manifest.scene!.nodes.find(node => node.id === 'chamber-room')?.transform).toEqual({ position: [0, 438.02, -446.92] })
  })
})
