import { createHash } from 'node:crypto'
import { CRATE_MODEL_SHA256 } from './Cinema2ApprovedModelHashes'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CINEMA2_CRATE_ARTIFACTS, CINEMA2_CRATE_PRESET_MANIFESTS } from '../presets/Cinema2CratePresets'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { createCinema2LegacyMaterialPlugin } from '../modules/three/Cinema2LegacyMaterialPlugin'
import { layoutParallaxCipherGlyphs, PARALLAX_CIPHER_EYE, PARALLAX_CIPHER_TARGET, sampleParallaxCipherEye } from '../modules/crate/Cinema2ParallaxCipherLayout'
import { CINEMA2_PARALLAX_CIPHER_TEXT_ID } from '../presets/Cinema2ParallaxCipherPreset'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { cinema2NamespacedId, type Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'

describe('Cinema 2.0 crate reference presets', () => {
  it('registers six references, preserving original assets across static and animated presets', () => {
    expect(CINEMA2_CRATE_PRESET_MANIFESTS).toHaveLength(6)
    // Retired ids are no longer part of the preset id union, which is the point of asserting they are gone.
    expect(cinema2NativePresetRegistry.get(cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.crate-glitch-array'))).toBeNull()
    expect(cinema2NativePresetRegistry.get(cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.crate-nested-pulse'))).toBeNull()
    for (const manifest of CINEMA2_CRATE_PRESET_MANIFESTS) {
      const registered = cinema2NativePresetRegistry.get(manifest.id)!
      expect(cinema2NativePresetRegistry.compile(manifest.id).ok).toBe(true)
      const cameraPath = ['bass-sigil', 'moire-orb', 'beam-lattice', 'paradox-weave', 'glyph-sphere', 'wireframe-portal'].some(slug => manifest.id === `drmvyz.cinema2.crate-${slug}`)
      if (!cameraPath) { expect(registered.parameters).toHaveLength(0); expect(registered.choreography?.rules ?? []).toHaveLength(0) }
      expect(registered.cameras?.[0].rig?.kind).toBe(cameraPath ? 'path' : 'static')
      expect(manifest.modules?.[0].config?.instances).toEqual(expect.arrayContaining([expect.objectContaining({ spin: false, preserveMaterials: manifest.id !== 'drmvyz.cinema2.crate-beam-lattice' })]))
    }
  })
  it('ships byte-for-byte copies of the supplied artifacts', () => {
    for (const artifact of CINEMA2_CRATE_ARTIFACTS) {
      const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
      expect(hash(`public/cinema2/models/crate/${artifact.file}`)).toBe(CRATE_MODEL_SHA256[artifact.file])
    }
  })
  it('projects separated Parallax Cipher glyphs onto the typeset line at the reveal camera', () => {
    const manifest = CINEMA2_CRATE_PRESET_MANIFESTS.find(preset => preset.id === 'drmvyz.cinema2.crate-paradox-weave')!
    expect(manifest.parameters?.map(parameter => parameter.id)).toContain(CINEMA2_PARALLAX_CIPHER_TEXT_ID)
    expect(manifest.modules?.[0].config?.instances).toEqual([
      expect.objectContaining({ asset: 'cinema2-crate-paradox-weave' }),
      expect.objectContaining({ asset: 'cinema2-say-it-glyphs' }),
    ])
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, .08, 88)
    const setEye = (position: readonly [number, number, number]) => {
      camera.position.set(...position)
      camera.lookAt(...PARALLAX_CIPHER_TARGET)
      camera.updateMatrixWorld()
    }
    const reading = layoutParallaxCipherGlyphs('TEST TYPE')
    expect(reading.map(({ glyph }) => glyph.character).join('')).toBe('TESTTYPE')
    expect(new Set(reading.map(({ position }) => position[2])).size).toBe(reading.length)
    for (const time of [0, 1.5, 13, 24]) expect(sampleParallaxCipherEye(time)).toEqual(PARALLAX_CIPHER_EYE)
    setEye(PARALLAX_CIPHER_EYE)
    for (const { position, aligned } of reading) {
      const drawn = new THREE.Vector3(...position).project(camera)
      const typeset = new THREE.Vector3(...aligned).project(camera)
      expect(drawn.x).toBeCloseTo(typeset.x, 8)
      expect(drawn.y).toBeCloseTo(typeset.y, 8)
    }
    const glyph = reading[0]!
    setEye(sampleParallaxCipherEye(7.5))
    const oblique = new THREE.Vector3(...glyph.position).project(camera)
    const unshifted = new THREE.Vector3(...glyph.aligned).project(camera)
    expect(Math.abs(oblique.x - unshifted.x)).toBeGreaterThan(.06)
  })
  it('preserves the legacy Paradox diffuse colors and gloss instead of silently importing white materials', async () => {
    const bytes = readFileSync('public/cinema2/models/crate/paradox_abstract_art_of_python.glb')
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
