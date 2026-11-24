import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { describe, expect, it, vi } from 'vitest'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2UnifiedUserModelEffects } from './Cinema2UnifiedUserModelEffects'
import { Cinema2UserModelPreviewEffects } from './Cinema2UserModelPreviewEffects'
import { cinema2GrainSeed, cinema2ProgressiveSample } from './Cinema2UserModelFormDust'
import { CINEMA2_USER_MODEL_PROXY_LIMITS, cinema2ResolveFractureDetail } from './Cinema2UserModelPreviewPatterns'
import { prepareCinema2UserModel } from './Cinema2UserModelPreparation'
import { animateCinema2Shatter, Cinema2ShatteredUserModel, CINEMA2_SHATTER_LIMITS } from './Cinema2UserModelShatter'
import { buildCinema2UserModelSlices } from './Cinema2UserModelSlices'
import { Cinema2UserModelHologram } from './Cinema2UserModelHologram'
import { Cinema2VoxelizedUserModel } from './Cinema2UserModelVoxels'
import { createCinema2UserModelPreset, cinema2UserModelPreviewParameterId } from '../presets/Cinema2UserModelPresetFactory'

const library = { THREE, wideLines: { LineSegments2, LineSegmentsGeometry, LineMaterial } } as unknown as Cinema2ThreeLibrary
function fixture(geometry: THREE.BufferGeometry = new THREE.BoxGeometry(2, .8, 1)) {
  const root = new THREE.Group(), material = new THREE.MeshPhysicalMaterial({ metalness: .8, roughness: .15, clearcoat: 1 })
  const mesh = new THREE.Mesh(geometry, material); root.add(mesh)
  return { root, mesh, material }
}
function context(values: Record<string, unknown>, seconds = 0): Cinema2ModuleUpdateContext {
  return { frame: { elapsedTimeSec: seconds, timestampMs: seconds * 1000, deltaTimeSec: .016, contextGeneration: 1, transport: { trackId: 'phase02', sourcePresent: true, playing: false, paused: true, animationActive: false, timeSec: 0, bpm: 120 }, audio: null }, parameters: { get: (key: string) => values[key], getEditRevision: () => 0 } } as unknown as Cinema2ModuleUpdateContext
}
function shaderFixture() {
  return { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '#include <begin_vertex>\ngl_PointSize = size;', fragmentShader: '#include <color_fragment>\n#include <opaque_fragment>' }
}

describe('Phase 02 advanced model representations', () => {
  it('uses deterministic, unique progressive surface indices and bounded independent seeds', () => {
    for (const count of [1, 19, 768, 16384]) {
      const order = Array.from({ length: count }, (_, i) => cinema2ProgressiveSample(i, count))
      expect(new Set(order).size).toBe(count); expect(order.every(i => i >= 0 && i < count)).toBe(true)
      expect(order).toEqual(Array.from({ length: count }, (_, i) => cinema2ProgressiveSample(i, count)))
    }
    const seeds = Array.from({ length: 256 }, (_, i) => cinema2GrainSeed(i))
    expect(new Set(seeds).size).toBe(256); expect(seeds.every(seed => seed >= 0 && seed < 1)).toBe(true)
    expect(cinema2ResolveFractureDetail('auto', 'low', 100)).toBe(48)
    expect(cinema2ResolveFractureDetail('192', 'medium', 100)).toBe(96)
    expect(cinema2ResolveFractureDetail('192', 'high', 120000)).toBe(24)
    expect(cinema2ResolveFractureDetail('12', 'high', 100)).toBe(12)
    expect(cinema2ResolveFractureDetail('invalid', 'low', 100)).toBe(48)
  })
  it('builds seeded irregular fracture geometry and exactly restores its rest transforms', () => {
    const f = fixture(), prepared = prepareCinema2UserModel(library, f.root)
    const first = Cinema2ShatteredUserModel.build(library, f.root, prepared, [f.mesh], 48), second = Cinema2ShatteredUserModel.build(library, f.root, prepared, [f.mesh], 48)
    expect(first.fragments.length).toBeGreaterThan(24); expect(first.fragments.length).toBeLessThanOrEqual(48)
    expect(first.centers.map(c => c.toArray())).toEqual(second.centers.map(c => c.toArray()))
    expect(first.bytes).toBeLessThanOrEqual(CINEMA2_SHATTER_LIMITS.bytes)
    const rest = first.fragments.map(fragment => fragment.position.toArray())
    animateCinema2Shatter(first, 0, 1, 1, prepared.extent, .35, .5, 1, 1)
    expect(first.fragments.some((fragment, i) => fragment.position.distanceTo(first.centers[i]) > .05)).toBe(true)
    animateCinema2Shatter(first, 0, 2, 0, prepared.extent, .35, .5, 1, 0)
    expect(first.fragments.map(fragment => fragment.position.toArray())).toEqual(rest)
    expect(first.fragments.every(fragment => fragment.rotation.x === 0 && fragment.rotation.y === 0 && fragment.rotation.z === 0 && fragment.scale.x === 1)).toBe(true)
    const dispose = vi.spyOn(f.mesh.geometry, 'dispose'); first.dispose(); second.dispose(); expect(dispose).not.toHaveBeenCalled(); prepared.dispose()
  })
  it('uses GPU uniforms for movement, density, opacity and turbulence without rewriting particle attributes', () => {
    const f = fixture(), controller = new Cinema2UserModelPreviewEffects(library, 'dust'); controller.attach(f.root, true)
    const values = { effectPose: 'representation', dustDrift: .6, dustDensity: .5, dustSize: 2, dustOpacity: .4, dustTurbulence: 1.5, opacity: 1, pattern: 'Rising Drift' }
    controller.update(context(values)); controller.beforeDraw('high')
    const clouds: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>[] = []
    f.root.traverse(object => { if ((object as THREE.Points).isPoints) clouds.push(object as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>) })
    expect(clouds).toHaveLength(2)
    for (const cloud of clouds) {
      const position = cloud.geometry.attributes.position as THREE.BufferAttribute, version = position.version, array = position.array, shader = shaderFixture()
      cloud.material.onBeforeCompile(shader as never, {} as never)
      expect(shader.uniforms.c2Spread.value).toBe(.6); expect(shader.uniforms.c2Turbulence.value).toBe(1.5)
      expect(shader.vertexShader).toContain('transformed = mix(position'); expect(cloud.material.opacity).toBe(.4)
      expect(cloud.geometry.drawRange.count).toBe(CINEMA2_USER_MODEL_PROXY_LIMITS.high.dust / 4)
      controller.update(context({ ...values, dustDrift: 0 })); controller.beforeDraw('low')
      expect(shader.uniforms.c2Spread.value).toBe(0); expect(position.array).toBe(array); expect(position.version).toBe(version)
      controller.update(context(values)); controller.beforeDraw('high')
    }
    controller.dispose(); expect(controller.estimateAdditionalGpuBytes()).toBe(0)
  })
  it('cuts actual geometry on each axis, preserves assembled bounds and creates closed faces', () => {
    const f = fixture(), prepared = prepareCinema2UserModel(library, f.root), expected = new THREE.Box3().setFromObject(f.root, true)
    for (const axis of ['x', 'y', 'z']) {
      const cut = buildCinema2UserModelSlices(library, prepared, [f.mesh], 9, axis)
      expect(cut.meshes).toHaveLength(9); expect(cut.capTriangles).toBeGreaterThan(0)
      const actual = new THREE.Box3().setFromObject(cut.group, true)
      expect(actual.min.distanceTo(expected.min)).toBeLessThan(1e-5); expect(actual.max.distanceTo(expected.max)).toBeLessThan(1e-5)
      cut.dispose()
    }
    prepared.dispose()
  })
  it('uses instanced thick edge geometry, uniforms and bounded line counts without changing the source texture', () => {
    const f = fixture(new THREE.TorusKnotGeometry(.6, .2, 64, 12)), prepared = prepareCinema2UserModel(library, f.root), hook = f.material.onBeforeCompile
    const hologram = new Cinema2UserModelHologram(library, f.root, [f.mesh], prepared)
    hologram.thickness.value = 2; hologram.scanWidth.value = .3; hologram.direction.value = 2; hologram.rim.value = 2
    hologram.animate(1, 2, 1, prepared.extent, .8, 1, [1, .7, .3], [1, .1, .5])
    expect(hologram.materials[0].linewidth).toBe(2.5); expect(hologram.echoes[0].children.some(child => child instanceof LineSegments2)).toBe(true)
    const shader = shaderFixture(); f.material.onBeforeCompile(shader as never, {} as never)
    expect(shader.uniforms.c2HoloWidth.value).toBe(.3); expect(shader.uniforms.c2HoloDirection.value).toBe(2); expect(shader.fragmentShader).toContain('holoRim')
    const lines = hologram.echoes[0].children[0] as LineSegments2, count = lines.geometry.instanceCount
    hologram.qualityScale = .35; hologram.animate(1, 2, 1, prepared.extent, .8, 1, [1, .7, .3], [1, .1, .5]); expect(lines.geometry.instanceCount).toBeLessThan(count)
    hologram.dispose(); expect(f.material.onBeforeCompile).toBe(hook); expect(hologram.additionalGpuBytes).toBe(0); prepared.dispose()
  })
  it('keeps open geometry a shell and caches voxel matrices when a pose is unchanged', () => {
    const f = fixture(new THREE.PlaneGeometry(2, 1, 12, 8)), prepared = prepareCinema2UserModel(library, f.root), voxels = new Cinema2VoxelizedUserModel(library, prepared, [f.mesh]), dummy = new THREE.Object3D(), color = new THREE.Color()
    expect(voxels.solid).toBe(false)
    voxels.animate('high', 0, 1, 0, .35, 0, false, [1, 1, 1], [1, 1, 1], dummy, color)
    const grid = [...voxels.grids.values()].find(item => item.mesh.visible)!, version = grid.mesh.instanceMatrix.version
    voxels.animate('high', 4, 2, 0, .35, 0, false, [1, 1, 1], [1, 1, 1], dummy, color); expect(grid.mesh.instanceMatrix.version).toBe(version)
    voxels.animate('high', 4, 2, 1, .35, 0, false, [1, 1, 1], [1, 1, 1], dummy, color); expect(grid.mesh.instanceMatrix.version).toBeGreaterThan(version)
    voxels.dispose(); expect(voxels.additionalGpuBytes).toBe(0); prepared.dispose()
  })
  it('preserves physical material slots and immutable textures during Form flex and disposal', () => {
    const f = fixture(new THREE.TorusKnotGeometry(.65, .18, 96, 16)), texture = new THREE.Texture(); f.material.map = texture; f.material.roughnessMap = texture
    const source = f.material.toJSON(), dispose = vi.spyOn(texture, 'dispose'), controller = new Cinema2UnifiedUserModelEffects(library, 'form')
    controller.attach(f.root, true, [], 'phase02-textured'); controller.update(context({ representation: 'form', formDeformation: .15, formMaterial: 'original', intensity: 1, emission: 0 })); controller.beforeDraw('high')
    const pivot = f.root.getObjectByName('UserModelPreview')!; expect(pivot.scale.x).not.toBe(pivot.scale.y)
    controller.dispose(); expect(f.material.toJSON()).toEqual(source); expect(dispose).not.toHaveBeenCalled()
  })
  it('registers additive effect controls and binds them to the unified scene module without changing preset revision', () => {
    const preset = createCinema2UserModelPreset('form')
    expect(preset.revision).toBe(1)
    for (const property of ['shardDebris', 'dustSize', 'dustOpacity', 'dustTurbulence', 'hologramThickness', 'hologramScanWidth', 'hologramRim', 'sliceCount', 'sliceAxis', 'voxelRotation', 'formDeformation']) {
      const parameter = preset.parameters!.find(item => item.id === cinema2UserModelPreviewParameterId('form', property))
      expect(parameter?.designParentGroup).toBe('effects'); expect(preset.modules![0].parameterBindings).toHaveProperty(property)
    }
  })
})
