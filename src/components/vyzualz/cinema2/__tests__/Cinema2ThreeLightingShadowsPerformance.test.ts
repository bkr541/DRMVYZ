import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CINEMA2_LIGHTING_RIGS, buildCinema2LightingRig, listCinema2LightingRigs } from '../modules/three/Cinema2ThreeLightingRigs'
import { Cinema2InstancedBatch, cinema2GridLayout, cinema2RingLayout } from '../modules/three/Cinema2ThreeInstancing'
import { cinema2LodSkippedLevels, createCinema2Lod } from '../modules/three/Cinema2ThreeLod'
import {
  applyCinema2ShadowToLight,
  cinema2ShadowMapType,
  disposeCinema2LightShadow,
  fitCinema2DirectionalShadow,
  resolveCinema2ShadowProfile,
  setCinema2ShadowParticipation,
} from '../modules/three/Cinema2ThreeShadowProfiles'
import {
  applyCinema2EnvironmentProfile,
  cinema2EnvironmentFormat,
  downsampleEquirectangular,
  environmentDownsampleFactor,
} from '../modules/three/Cinema2ThreeEnvironmentProfiles'

describe('shadow profiles', () => {
  it('resolves consistently per tier and scales bias with map size', () => {
    const low = resolveCinema2ShadowProfile('low')
    const high = resolveCinema2ShadowProfile('high')
    expect([low.mapSize, high.mapSize]).toEqual([512, 2048])
    expect(Math.abs(low.bias)).toBeGreaterThan(Math.abs(high.bias))
    expect(resolveCinema2ShadowProfile('medium', { mapSize: 4096, bias: -0.001 })).toMatchObject({ mapSize: 4096, bias: -0.001 })
  })

  it('maps filters to Three shadow map types (PCFSoft no longer exists)', () => {
    expect(cinema2ShadowMapType(THREE, 'basic')).toBe(THREE.BasicShadowMap)
    expect(cinema2ShadowMapType(THREE, 'pcf')).toBe(THREE.PCFShadowMap)
    expect(cinema2ShadowMapType(THREE, 'vsm')).toBe(THREE.VSMShadowMap)
  })

  it('applies a profile to a light and releases the old map when the size changes', () => {
    const light = new THREE.DirectionalLight()
    let disposed = 0
    light.shadow.map = { dispose: () => { disposed += 1 } } as unknown as THREE.WebGLRenderTarget
    applyCinema2ShadowToLight(light, resolveCinema2ShadowProfile('high', { normalBias: 0.05 }))
    expect(light.castShadow).toBe(true)
    expect(light.shadow.mapSize.toArray()).toEqual([2048, 2048])
    expect(light.shadow.normalBias).toBe(0.05)
    expect(disposed).toBe(1)
    expect(light.shadow.map).toBeNull()
    disposeCinema2LightShadow(light)
    expect(light.castShadow).toBe(false)
  })

  it('rejects lights that cannot cast shadows', () => {
    expect(() => applyCinema2ShadowToLight(new THREE.AmbientLight() as unknown as THREE.DirectionalLight, resolveCinema2ShadowProfile('low'))).toThrow(/cannot cast/)
  })

  it('fits a directional shadow frustum tightly around bounds', () => {
    const light = new THREE.DirectionalLight()
    light.position.set(0, 10, 0)
    light.target.position.set(0, 0, 0)
    applyCinema2ShadowToLight(light, resolveCinema2ShadowProfile('medium'))
    fitCinema2DirectionalShadow(THREE, light, new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 1, 2)), false)
    const camera = light.shadow.camera
    expect(camera.right - camera.left).toBeCloseTo(4, 3)
    expect(camera.top - camera.bottom).toBeCloseTo(4, 3)
    expect(camera.near).toBeCloseTo(8.5, 1)
    expect(camera.far).toBeCloseTo(10.5, 1)
  })

  it('sets cast and receive by mesh name only on matches', () => {
    const root = new THREE.Group()
    const names = ['floor', 'bolt-1', 'bolt-2', 'glass']
    for (const name of names) { const mesh = new THREE.Mesh(); mesh.name = name; root.add(mesh) }
    const counts = setCinema2ShadowParticipation(root, { cast: /^bolt/, receive: ['floor'] })
    expect(counts).toEqual({ cast: 2, receive: 1 })
    expect(root.children.map(child => (child as THREE.Mesh).castShadow)).toEqual([false, true, true, false])
    expect(root.children.map(child => (child as THREE.Mesh).receiveShadow)).toEqual([true, false, false, false])
  })
})

describe('lighting rigs', () => {
  it('defines the six requested rigs', () => {
    expect(listCinema2LightingRigs().map(rig => rig.id).sort()).toEqual(['colored-accent', 'dramatic-directional', 'industrial-overhead', 'product-display', 'softbox', 'three-point'])
  })

  it('builds a group of real lights, aimed and named by role, and disposes cleanly', () => {
    const scene = new THREE.Scene()
    const rig = buildCinema2LightingRig(THREE, 'three-point', { center: [0, 1, 0], scale: 2 })
    scene.add(rig.group)
    expect(Object.keys(rig.lights).sort()).toEqual(['fill', 'key', 'rim'])
    expect(rig.lights.key).toBeInstanceOf(THREE.DirectionalLight)
    expect(rig.lights.key!.position.toArray()).toEqual([-8, 11, 10])
    expect(rig.requiresAreaLightTables).toBe(false)
    expect((rig.lights.key as THREE.DirectionalLight).castShadow).toBe(false)
    rig.dispose()
    expect(scene.children).toHaveLength(0)
  })

  it('keeps illumination constant when a rig is scaled by scaling point intensity with distance squared', () => {
    const base = buildCinema2LightingRig(THREE, 'colored-accent')
    const scaled = buildCinema2LightingRig(THREE, 'colored-accent', { scale: 3 })
    expect((scaled.lights['accent-warm'] as THREE.PointLight).intensity).toBeCloseTo((base.lights['accent-warm'] as THREE.PointLight).intensity * 9, 6)
    expect((scaled.lights.key as THREE.DirectionalLight).intensity).toBe((base.lights.key as THREE.DirectionalLight).intensity)
  })

  it('flags area lights, applies color and intensity overrides, and shadows only when asked', () => {
    const softbox = buildCinema2LightingRig(THREE, 'softbox', { intensityScale: 0.5, colors: { 'top-box': 0xff0000 } })
    expect(softbox.requiresAreaLightTables).toBe(true)
    expect((softbox.lights['top-box'] as THREE.RectAreaLight).color.getHex()).toBe(0xff0000)
    expect((softbox.lights['top-box'] as THREE.RectAreaLight).intensity).toBe(CINEMA2_LIGHTING_RIGS.softbox.lights[0]!.intensity * 0.5)
    const shadowed = buildCinema2LightingRig(THREE, 'dramatic-directional', { shadows: { tier: 'high' } })
    expect((shadowed.lights.key as THREE.SpotLight).castShadow).toBe(true)
    expect((shadowed.lights.key as THREE.SpotLight).shadow.mapSize.x).toBe(2048)
    expect((shadowed.lights.rim as THREE.DirectionalLight).castShadow).toBe(false)
    shadowed.dispose()
  })
})

describe('environment profiles', () => {
  it('detects the file format and the integer downsample factor', () => {
    expect([cinema2EnvironmentFormat('/a/b.hdr'), cinema2EnvironmentFormat('/a/b.EXR?v=2'), cinema2EnvironmentFormat('/a/b.png')]).toEqual(['hdr', 'exr', null])
    expect([environmentDownsampleFactor(2048, 2048), environmentDownsampleFactor(2048, 1024), environmentDownsampleFactor(2048, 512), environmentDownsampleFactor(3000, 1024)]).toEqual([1, 2, 4, 3])
  })

  it('box-averages an equirectangular image', () => {
    const data = new Float32Array(4 * 2 * 4)
    for (let pixel = 0; pixel < 8; pixel += 1) data.set([pixel, pixel * 2, 0, 1], pixel * 4)
    const reduced = downsampleEquirectangular(data, 4, 2, 2)
    expect([reduced.width, reduced.height]).toEqual([2, 1])
    expect(Array.from(reduced.data.slice(0, 4))).toEqual([(0 + 1 + 4 + 5) / 4, (0 + 2 + 8 + 10) / 4, 0, 1])
    expect(downsampleEquirectangular(data, 4, 2, 1).data).toBe(data)
  })

  it('applies intensity, rotation and an optional background to a scene', () => {
    const scene = new THREE.Scene()
    const texture = new THREE.Texture()
    applyCinema2EnvironmentProfile(THREE, scene, texture, { intensity: 0.4, rotationDegrees: [0, 90, 0], background: { blurriness: 0.2 } })
    expect(scene.environment).toBe(texture)
    expect(scene.environmentIntensity).toBe(0.4)
    expect(scene.environmentRotation.y).toBeCloseTo(Math.PI / 2, 6)
    expect(scene.background).toBe(texture)
    expect(scene.backgroundBlurriness).toBe(0.2)
    applyCinema2EnvironmentProfile(THREE, scene, texture, { intensity: 1 })
    expect(scene.background).toBeNull()
  })
})

describe('LOD and instancing', () => {
  const level = (name: string, distance: number) => ({ object: Object.assign(new THREE.Object3D(), { name }), distance })
  const levels = [level('fine', 0), level('mid', 10), level('coarse', 30)]

  it('drops the finest levels on lower tiers and scales distances', () => {
    expect([cinema2LodSkippedLevels(3, 'low'), cinema2LodSkippedLevels(3, 'medium'), cinema2LodSkippedLevels(3, 'high'), cinema2LodSkippedLevels(1, 'low')]).toEqual([1, 1, 0, 0])
    const high = createCinema2Lod(THREE, levels, { tier: 'high' })
    expect(high.levels.map(entry => entry.object.name)).toEqual(['fine', 'mid', 'coarse'])
    expect(high.levels[1]!.distance).toBeCloseTo(16, 6)
    const low = createCinema2Lod(THREE, levels, { tier: 'low' })
    expect(low.levels.map(entry => entry.object.name)).toEqual(['mid', 'coarse'])
    expect(low.levels[0]!.distance).toBe(0)
    expect(low.levels[1]!.distance).toBeCloseTo(18, 6)
    expect(() => createCinema2Lod(THREE, [])).toThrow()
  })

  it('shows the level for the camera distance', () => {
    const lod = createCinema2Lod(THREE, levels, { tier: 'medium' })
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 0, 5)
    lod.update(camera)
    expect(lod.getCurrentLevel()).toBe(0)
    camera.position.set(0, 0, 200)
    camera.updateMatrixWorld()
    lod.update(camera)
    expect(lod.getCurrentLevel()).toBe(1)
  })

  it('draws repeated objects in one call, tracks capacity and uploads on commit', () => {
    const batch = new Cinema2InstancedBatch(THREE, new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 100, { perInstanceColor: true, castShadow: true })
    batch.setAll([...cinema2RingLayout(24, 4), ...cinema2GridLayout(4, 4, [1, 1])].map((transform, index) => ({ ...transform, color: index % 2 ? 0xff0000 : 0x00ff00, scale: 0.5 })))
    const stats = batch.getStats()
    expect(stats).toMatchObject({ capacity: 100, count: 40, drawCalls: 1, triangles: 40 * 12 })
    expect(batch.mesh.castShadow).toBe(true)
    expect(batch.mesh.boundingSphere).not.toBeNull()
    expect(() => batch.set(100, { position: [0, 0, 0] })).toThrow(RangeError)
    expect(() => batch.setAll(Array.from({ length: 101 }, () => ({ position: [0, 0, 0] as const })))).toThrow(/holds 100/)
    const matrix = new THREE.Matrix4()
    batch.mesh.getMatrixAt(30, matrix)
    expect(matrix.elements[0]).toBeCloseTo(0.5, 6)
    batch.setCount(0)
    expect(batch.getStats().drawCalls).toBe(0)
    batch.dispose()
  })

  it('refuses per-instance color on a batch that did not allocate it, and leaves dynamic batches unculled', () => {
    const plain = new Cinema2InstancedBatch(THREE, new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4)
    expect(() => plain.setColor(0, 0xff0000)).toThrow(/perInstanceColor/)
    const dynamic = new Cinema2InstancedBatch(THREE, new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4, { dynamic: true })
    expect(dynamic.mesh.frustumCulled).toBe(false)
  })
})
