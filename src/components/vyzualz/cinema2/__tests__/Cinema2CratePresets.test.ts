import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CINEMA2_CRATE_ARTIFACTS, CINEMA2_CRATE_PRESET_MANIFESTS } from '../presets/Cinema2CratePresets'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { createCinema2LegacyMaterialPlugin } from '../modules/three/Cinema2LegacyMaterialPlugin'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'

describe('static Cinema 2.0 crate presets', () => {
  it('registers all eight artifacts without adding controls, motion, or audio behavior', () => {
    expect(CINEMA2_CRATE_PRESET_MANIFESTS).toHaveLength(8)
    for (const manifest of CINEMA2_CRATE_PRESET_MANIFESTS) {
      const registered = cinema2NativePresetRegistry.get(manifest.id)!
      expect(cinema2NativePresetRegistry.compile(manifest.id).ok).toBe(true)
      expect(registered.parameters).toHaveLength(0)
      expect(registered.choreography?.rules ?? []).toHaveLength(0)
      expect(registered.cameras?.[0].rig?.kind).toBe('static')
      expect(manifest.modules?.[0].config?.instances).toEqual([expect.objectContaining({ spin: false, preserveMaterials: true })])
    }
  })
  it('ships byte-for-byte copies of the supplied artifacts', () => {
    for (const artifact of CINEMA2_CRATE_ARTIFACTS) {
      const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
      expect(hash(`public/cinema2/models/crate/${artifact.file}`)).toBe(hash(`3D Cinema 2.0 Crate/${artifact.file}`))
    }
  })
  it('preserves the legacy Paradox diffuse colors and gloss instead of silently importing white materials', async () => {
    const bytes = readFileSync('3D Cinema 2.0 Crate/paradox_abstract_art_of_python.glb')
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const loader = new GLTFLoader()
    loader.register(parser => createCinema2LegacyMaterialPlugin(parser, { THREE } as Cinema2ThreeLibrary))
    const gltf = await loader.parseAsync(buffer, '')
    const materials = new Map<string, THREE.MeshPhysicalMaterial>()
    gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) { const material = object.material as THREE.MeshPhysicalMaterial; materials.set(material.name, material) } })
    expect(materials.get('Material')?.color.toArray()).toEqual([1, 0, 0])
    expect(materials.get('Material')?.roughness).toBe(0)
    expect(materials.get('Root')?.roughness).toBe(.6)
  })
})
