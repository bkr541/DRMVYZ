import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  Cinema2ThreeMaterialLibrary,
  applyCinema2MaterialProfile,
  applyCinema2MaterialProfileToObject,
  applyCinema2MaterialQualityGate,
  applyCinema2TextureFiltering,
  auditCinema2Material,
  cinema2ProfileNeedsPhysical,
  normalizeCinema2TextureColorSpaces,
  releaseCinema2ObjectResources,
  retainCinema2ObjectResources,
} from '../modules/three/Cinema2ThreeMaterialKit'
import { Cinema2ThreeResourceLedger } from '../modules/three/Cinema2ThreeResourceLedger'
import { CINEMA2_RENDER_QUALITY_PROFILES } from '../render/Cinema2RenderQualityProfiles'

const texture = (): THREE.DataTexture => new THREE.DataTexture(new Uint8Array(4 * 4 * 4), 4, 4)

describe('Cinema 2.0 material kit', () => {
  it('changes only the properties a profile names and leaves imported values alone', () => {
    const material = new THREE.MeshStandardMaterial({ color: 0x336699, roughness: 0.42, metalness: 0.9, emissive: 0x221100, emissiveIntensity: 2 })
    material.name = 'imported'
    const before = { color: material.color.getHex(), metalness: material.metalness, emissive: material.emissive.getHex() }
    const result = applyCinema2MaterialProfile(THREE, material, { roughness: 0.1, normalScale: 0.5, opacity: 0.5 })
    expect(result.material).toBe(material)
    expect(result.upgraded).toBe(false)
    expect(material.roughness).toBe(0.1)
    expect(material.normalScale.toArray()).toEqual([0.5, 0.5])
    expect(material.transparent).toBe(true)
    expect(material.color.getHex()).toBe(before.color)
    expect(material.metalness).toBe(before.metalness)
    expect(material.emissive.getHex()).toBe(before.emissive)
    expect(material.emissiveIntensity).toBe(2)
    expect(result.applied).toEqual(['roughness', 'normalScale', 'opacity'])
  })

  it('applies every physical property to a physical material', () => {
    const material = new THREE.MeshPhysicalMaterial()
    const result = applyCinema2MaterialProfile(THREE, material, {
      clearcoat: 0.7, clearcoatRoughness: 0.1, transmission: 0.9, ior: 1.33, thickness: 0.4, attenuationColor: 0x88ccff, attenuationDistance: 2,
      iridescence: 1, iridescenceIOR: 1.4, iridescenceThicknessRange: [100, 500], anisotropy: 0.6, anisotropyRotation: 1, specularIntensity: 0.5,
      specularColor: [1, 0.9, 0.8], sheen: 0.5, sheenColor: 0xff00ff, sheenRoughness: 0.3, dispersion: 0.2, emissiveIntensity: 3, displacementScale: 0.1, bumpScale: 2,
    })
    expect(result.material).toBe(material)
    expect(result.skipped).toEqual([])
    expect([material.clearcoat, material.clearcoatRoughness, material.transmission, material.ior, material.thickness]).toEqual([0.7, 0.1, 0.9, 1.33, 0.4])
    expect(material.iridescenceThicknessRange).toEqual([100, 500])
    expect([material.anisotropy, material.anisotropyRotation, material.specularIntensity, material.sheen, material.sheenRoughness, material.dispersion]).toEqual([0.6, 1, 0.5, 0.5, 0.3, 0.2])
    expect(material.sheenColor.getHex()).toBe(0xff00ff)
    expect(material.emissiveIntensity).toBe(3)
    expect(material.bumpScale).toBe(2)
  })

  it('promotes a standard material to physical, keeping its look, name, user data and compile hooks', () => {
    const standard = new THREE.MeshStandardMaterial({ color: 0xaa5500, roughness: 0.3, metalness: 1 })
    standard.name = 'brass'
    standard.userData = { part: 'trim' }
    standard.customProgramCacheKey = () => 'brass-key'
    const result = applyCinema2MaterialProfile(THREE, standard, { clearcoat: 1 })
    const physical = result.material as THREE.MeshPhysicalMaterial
    expect(result.upgraded).toBe(true)
    expect(physical.isMeshPhysicalMaterial).toBe(true)
    expect(physical).not.toBe(standard)
    expect(physical.name).toBe('brass')
    expect(physical.userData).toEqual({ part: 'trim' })
    expect(physical.customProgramCacheKey()).toBe('brass-key')
    expect(physical.color.getHex()).toBe(0xaa5500)
    expect(physical.roughness).toBe(0.3)
    expect(physical.metalness).toBe(1)
    expect(physical.clearcoat).toBe(1)
  })

  it('refuses to promote a material that carries a custom shader hook, and says why', () => {
    const standard = new THREE.MeshStandardMaterial()
    standard.onBeforeCompile = () => {}
    const result = applyCinema2MaterialProfile(THREE, standard, { clearcoat: 1, roughness: 0.2 })
    expect(result.material).toBe(standard)
    expect(result.upgraded).toBe(false)
    expect(standard.roughness).toBe(0.2)
    expect(result.skipped.map(entry => entry.property)).toEqual(['clearcoat'])
  })

  it('never replaces custom shaders or non-PBR materials', () => {
    const shader = new THREE.ShaderMaterial()
    const basic = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    for (const material of [shader, basic]) {
      const result = applyCinema2MaterialProfile(THREE, material, { roughness: 0.2, clearcoat: 1 })
      expect(result.material).toBe(material)
      expect(result.applied).toEqual([])
      expect(result.skipped[0]?.reason).toMatch(/left untouched/)
    }
    expect(basic.color.getHex()).toBe(0xff0000)
  })

  it('maps alpha modes and skips features the quality tier turns off', () => {
    const material = new THREE.MeshPhysicalMaterial()
    applyCinema2MaterialProfile(THREE, material, { alphaMode: 'mask', alphaCutoff: 0.3 })
    expect([material.transparent, material.alphaTest, material.depthWrite]).toEqual([false, 0.3, true])
    applyCinema2MaterialProfile(THREE, material, { alphaMode: 'blend' })
    expect([material.transparent, material.alphaTest, material.depthWrite]).toEqual([true, 0, false])

    const low = applyCinema2MaterialProfile(THREE, new THREE.MeshPhysicalMaterial(), { transmission: 1, iridescence: 1, clearcoat: 1 }, { features: CINEMA2_RENDER_QUALITY_PROFILES.low.pbr })
    expect(low.skipped.map(entry => entry.property).sort()).toEqual(['iridescence', 'transmission'])
    expect(low.applied).toEqual(['clearcoat'])
  })

  it('sets environment reflection strength only with an environment (Three ignores it otherwise)', () => {
    const material = new THREE.MeshStandardMaterial()
    expect(applyCinema2MaterialProfile(THREE, material, { reflectionIntensity: 2 }).skipped).toHaveLength(1)
    const environment = texture()
    applyCinema2MaterialProfile(THREE, material, { reflectionIntensity: 2 }, { environment })
    expect(material.envMap).toBe(environment)
    expect(material.envMapIntensity).toBe(2)
  })

  it('keeps color maps sRGB and data maps linear, and reports what it fixed', () => {
    const material = new THREE.MeshStandardMaterial()
    material.map = texture(); material.map.colorSpace = THREE.NoColorSpace
    material.normalMap = texture(); material.normalMap.colorSpace = THREE.SRGBColorSpace
    material.roughnessMap = texture()
    material.emissiveMap = texture(); material.emissiveMap.colorSpace = THREE.SRGBColorSpace
    expect(auditCinema2Material(THREE, material).textures.filter(entry => !entry.colorSpaceCorrect).map(entry => entry.slot).sort()).toEqual(['map', 'normalMap'])
    const fixes = normalizeCinema2TextureColorSpaces(THREE, material)
    expect(fixes.map(fix => fix.slot).sort()).toEqual(['map', 'normalMap'])
    expect(material.map.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(material.normalMap.colorSpace).toBe(THREE.NoColorSpace)
    expect(normalizeCinema2TextureColorSpaces(THREE, material)).toEqual([])
  })

  it('accepts a linear-sRGB data texture (KTX2Loader labels non-color textures that way) without re-uploading it', () => {
    const material = new THREE.MeshStandardMaterial()
    material.normalMap = texture()
    material.normalMap.colorSpace = THREE.LinearSRGBColorSpace
    const version = material.normalMap.version
    expect(normalizeCinema2TextureColorSpaces(THREE, material)).toEqual([])
    expect(material.normalMap.version).toBe(version)
    expect(auditCinema2Material(THREE, material).textures[0]!.colorSpaceCorrect).toBe(true)
    material.map = texture()
    material.map.colorSpace = THREE.LinearSRGBColorSpace
    expect(auditCinema2Material(THREE, material).textures.find(entry => entry.slot === 'map')!.colorSpaceCorrect).toBe(false)
  })

  it('transforms UVs on a private copy of the texture so other materials sharing it are not affected', () => {
    const shared = texture()
    const a = new THREE.MeshStandardMaterial({ map: shared })
    const b = new THREE.MeshStandardMaterial({ map: shared })
    applyCinema2MaterialProfile(THREE, a, { uvTransform: { all: { repeat: [3, 2], offset: [0.25, 0], rotation: 0.5 } } })
    expect(a.map).not.toBe(shared)
    expect(a.map!.repeat.toArray()).toEqual([3, 2])
    expect(a.map!.wrapS).toBe(THREE.RepeatWrapping)
    expect(a.map!.source).toBe(shared.source)
    expect(b.map).toBe(shared)
    expect(shared.repeat.toArray()).toEqual([1, 1])
    const own = a.map
    applyCinema2MaterialProfile(THREE, a, { uvTransform: { map: { repeat: [5, 5] } } })
    expect(a.map).toBe(own)
    expect(own!.repeat.toArray()).toEqual([5, 5])
  })

  it('clamps anisotropy to the GPU and re-uploads only when something changed', () => {
    const map = texture()
    expect(applyCinema2TextureFiltering(THREE, map, { anisotropy: 16, minFilter: 'linear-mipmap-linear' }, 8)).toBe(true)
    expect(map.anisotropy).toBe(8)
    const version = map.version
    expect(applyCinema2TextureFiltering(THREE, map, { anisotropy: 16 }, 8)).toBe(false)
    expect(map.version).toBe(version)
  })

  it('gates transmission, iridescence and anisotropy per tier and restores the authored values', () => {
    const material = new THREE.MeshPhysicalMaterial({ transmission: 0.8, iridescence: 1, anisotropy: 0.5 })
    expect(applyCinema2MaterialQualityGate(material, CINEMA2_RENDER_QUALITY_PROFILES.low.pbr)).toBe(true)
    expect([material.transmission, material.iridescence, material.anisotropy]).toEqual([0, 0, 0])
    expect(applyCinema2MaterialQualityGate(material, CINEMA2_RENDER_QUALITY_PROFILES.low.pbr)).toBe(false)
    expect(applyCinema2MaterialQualityGate(material, CINEMA2_RENDER_QUALITY_PROFILES.high.pbr)).toBe(true)
    expect([material.transmission, material.iridescence, material.anisotropy]).toEqual([0.8, 1, 0.5])
  })

  it('applies a profile across an object tree once per shared material and lists replaced originals', () => {
    const shared = new THREE.MeshStandardMaterial({ roughness: 1 })
    shared.name = 'shared'
    const other = new THREE.MeshStandardMaterial()
    other.name = 'other'
    const root = new THREE.Group()
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), shared), new THREE.Mesh(new THREE.BoxGeometry(), shared), new THREE.Mesh(new THREE.BoxGeometry(), other))
    const { replaced, results } = applyCinema2MaterialProfileToObject(THREE, root, { clearcoat: 1 }, { materialName: 'shared' })
    expect(results).toHaveLength(1)
    expect(replaced).toEqual([shared])
    const [first, second, third] = root.children as THREE.Mesh[]
    expect(first!.material).toBe(second!.material)
    expect((first!.material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial).toBe(true)
    expect(third!.material).toBe(other)
    expect(cinema2ProfileNeedsPhysical({ roughness: 1 })).toBe(false)
  })
})

describe('shared material and texture ownership', () => {
  it('disposes a shared texture only when the last scene releases it', () => {
    const ledger = new Cinema2ThreeResourceLedger()
    const shared = texture()
    let disposed = 0
    shared.addEventListener('dispose', () => { disposed += 1 })
    const sceneA = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: shared }))
    const sceneB = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: shared }))
    retainCinema2ObjectResources(ledger, sceneA)
    retainCinema2ObjectResources(ledger, sceneB)
    releaseCinema2ObjectResources(ledger, sceneA)
    expect(disposed).toBe(0)
    releaseCinema2ObjectResources(ledger, sceneB)
    expect(disposed).toBe(1)
    expect(ledger.getSnapshot().liveCount).toBe(0)
  })

  it('hands the same cached material to every holder and disposes it after the last release', () => {
    const library = new Cinema2ThreeMaterialLibrary()
    let created = 0
    const make = () => { created += 1; return new THREE.MeshStandardMaterial({ map: texture() }) }
    const a = library.acquire('brushed', make)
    const b = library.acquire('brushed', make)
    expect(a).toBe(b)
    expect(created).toBe(1)
    let disposed = 0
    a.addEventListener('dispose', () => { disposed += 1 })
    library.release('brushed')
    expect(library.has('brushed')).toBe(true)
    expect(disposed).toBe(0)
    library.release('brushed')
    expect(library.has('brushed')).toBe(false)
    expect(disposed).toBe(1)
    expect(library.getLedger().getSnapshot().liveCount).toBe(0)
  })
})
