import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { describe, expect, it, vi } from 'vitest'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { prepareCinema2UserModel } from './Cinema2UserModelPreparation'
import { Cinema2ShatteredUserModel, animateCinema2Shatter, CINEMA2_SHATTER_LIMITS } from './Cinema2UserModelShatter'
import { Cinema2VoxelizedUserModel, CINEMA2_VOXEL_LIMITS } from './Cinema2UserModelVoxels'
import { Cinema2UserModelHologram, CINEMA2_HOLOGRAM_LIMITS } from './Cinema2UserModelHologram'
import { Cinema2UserModelPreviewEffects } from './Cinema2UserModelPreviewEffects'
import { CINEMA2_USER_MODEL_PREVIEWS, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2PresetRegistry } from '../presets/Cinema2PresetRegistry'
import { createCinema2UserModelPreset, cinema2UserModelPreviewParameterId } from '../presets/Cinema2UserModelPresetFactory'
const library = { THREE, wideLines: { LineSegments2, LineSegmentsGeometry, LineMaterial } } as unknown as Cinema2ThreeLibrary
const kinds = Object.keys(CINEMA2_USER_MODEL_PREVIEWS) as Cinema2UserModelPreviewKind[]
function model(geometry: THREE.BufferGeometry = new THREE.BoxGeometry(2, 1.5, .8)) {
  const root = new THREE.Group(), material = new THREE.MeshPhysicalMaterial({ color: '#c6a875', metalness: .8, roughness: .2 }), mesh = new THREE.Mesh(geometry, material)
  root.add(mesh); const prepared = prepareCinema2UserModel(library, root)
  return { root, material, mesh, prepared }
}
function volume(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true); let result = 0
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  root.traverse(object => {
    const mesh = object as THREE.Mesh; if (!mesh.isMesh) return
    const position = mesh.geometry.attributes.position, index = mesh.geometry.index, count = index?.count ?? position.count
    for (let i = 0; i < count; i += 3) {
      a.fromBufferAttribute(position, index?.getX(i) ?? i).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(position, index?.getX(i + 1) ?? i + 1).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(position, index?.getX(i + 2) ?? i + 2).applyMatrix4(mesh.matrixWorld)
      result += a.dot(b.cross(c)) / 6
    }
  }); return result
}
function frame(time: number, values: Record<string, unknown>, paused = false, generation = 1, track = 'logo'): Cinema2ModuleUpdateContext {
  return { frame: { elapsedTimeSec: time, timestampMs: time * 1000, deltaTimeSec: .25, contextGeneration: generation,
    transport: { trackId: track, sourcePresent: true, playing: !paused, paused, animationActive: !paused, timeSec: time, bpm: 120 }, audio: null },
    parameters: { get: (key: string) => values[key], getEditRevision: () => 0 },
  } as unknown as Cinema2ModuleUpdateContext
}

describe('Phase 6: real model fracture', () => {
  it('conserves closed mesh volume and exact assembled bounds with capped pieces, UVs and original texture maps', () => {
    const m = model(); m.material.map = new THREE.Texture(); const cached = [...m.mesh.geometry.attributes.position.array]
    const dispose = vi.spyOn(m.mesh.geometry, 'dispose'), textureDispose = vi.spyOn(m.material.map, 'dispose')
    const cut = Cinema2ShatteredUserModel.build(library, m.root, m.prepared, [m.mesh])
    expect(cut.fragments.length).toBe(24); expect(cut.triangles).toBeLessThan(CINEMA2_SHATTER_LIMITS.triangles)
    expect(cut.openContours).toBe(0); expect(volume(cut.group)).toBeCloseTo(volume(m.root), 5)
    const bounds = new THREE.Box3().setFromObject(cut.group), expected = new THREE.Box3().setFromObject(m.root)
    expect(bounds.min.distanceTo(expected.min)).toBeLessThan(1e-6); expect(bounds.max.distanceTo(expected.max)).toBeLessThan(1e-6)
    expect(cut.materials.some(material => (material as THREE.MeshStandardMaterial).map === m.material.map)).toBe(true)
    cut.group.traverse(object => { if ((object as THREE.Mesh).isMesh) expect((object as THREE.Mesh).geometry.attributes.uv).toBeDefined() })
    for (let pattern = 0; pattern < 6; pattern++) {
      animateCinema2Shatter(cut, pattern, 2, 1, m.prepared.extent, .35, .8)
      expect(cut.fragments.some((part, i) => part.position.distanceTo(cut.centers[i]) > .01)).toBe(true)
      animateCinema2Shatter(cut, pattern, 2, 0, m.prepared.extent, .35, .8)
      expect(volume(cut.group)).toBeCloseTo(volume(m.root), 5)
    }
    cut.dispose(); cut.dispose(); expect(dispose).not.toHaveBeenCalled(); expect(textureDispose).not.toHaveBeenCalled()
    expect([...m.mesh.geometry.attributes.position.array]).toEqual(cached); m.prepared.dispose()
  })
  it('respects nested transforms and does not collapse the rest model to its origin', () => {
    const m = model(); m.mesh.position.set(.5, -.3, .2); m.mesh.rotation.z = .3; m.mesh.scale.set(1.2, .8, .7); m.prepared.dispose()
    const prepared = prepareCinema2UserModel(library, m.root), cut = Cinema2ShatteredUserModel.build(library, m.root, prepared, [m.mesh])
    const actual = new THREE.Box3().setFromObject(cut.group).translate(prepared.center), expected = new THREE.Box3().setFromObject(m.root)
    expect(actual.min.distanceTo(expected.min)).toBeLessThan(1e-5); expect(actual.max.distanceTo(expected.max)).toBeLessThan(1e-5)
    cut.dispose(); prepared.dispose()
  })
})

describe('Phase 7: surface hologram', () => {
  it('chains PBR hooks, uses actual transformed mesh edges and restores shader ownership', () => {
    const m = model(), original = m.material.onBeforeCompile, previous = vi.fn(); m.material.onBeforeCompile = previous
    const projection = new Cinema2UserModelHologram(library, m.root, [m.mesh], m.prepared)
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <opaque_fragment>' }
    m.material.onBeforeCompile(shader as never, {} as never)
    expect(previous).toHaveBeenCalledOnce(); expect(shader.vertexShader).toContain('c2HoloRest * vec4(position')
    expect(shader.fragmentShader).toContain('holoScan'); expect(shader.fragmentShader).toContain('holoSignal')
    expect(projection.echoes).toHaveLength(3); expect(projection.additionalGpuBytes).toBeGreaterThan(0)
    const poses = new Set<string>()
    for (let pattern = 0; pattern < 6; pattern++) {
      projection.animate(pattern, 2, 1, 2, 1, 1, [.2, .6, 1], [.1, 1, .7])
      expect(projection.mode.value).toBe(pattern); poses.add(JSON.stringify([projection.mode.value, projection.echoes.map(echo => echo.position.toArray())]))
    }
    expect(poses.size).toBe(6)
    projection.animate(0, 2, 0, 2, 1, 1, [1, 1, 1], [1, 1, 1]); expect(projection.echoes.every(echo => !echo.visible)).toBe(true)
    const geometryDispose = vi.spyOn(m.mesh.geometry, 'dispose'); projection.dispose(); projection.dispose()
    expect(m.material.onBeforeCompile).toBe(previous); expect(geometryDispose).not.toHaveBeenCalled(); expect(projection.additionalGpuBytes).toBe(0)
    m.material.onBeforeCompile = original; m.prepared.dispose()
  })
})

it('keeps surface projection active when contour preparation exceeds its limit', () => {
  const m = model(); m.prepared.triangleCount = CINEMA2_HOLOGRAM_LIMITS.edgeInputTriangles + 1
  const projection = new Cinema2UserModelHologram(library, m.root, [m.mesh], m.prepared)
  expect(projection.edgeProblem).toContain('budget'); expect(projection.echoes).toHaveLength(0)
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <opaque_fragment>' }
  m.material.onBeforeCompile(shader as never, {} as never); expect(shader.uniforms).toHaveProperty('c2HoloAmount')
  projection.dispose(); m.prepared.dispose()
})

describe('Phase 8: actual spatial voxelization', () => {
  it('fills a closed mesh and builds three complete, bounded grids without per-frame geometry allocation', () => {
    const m = model(new THREE.BoxGeometry(2, 2, 2)), voxels = new Cinema2VoxelizedUserModel(library, m.prepared, [m.mesh])
    expect(voxels.solid).toBe(true); expect(voxels.tests).toBeLessThan(CINEMA2_VOXEL_LIMITS.triangleBoxTests)
    const dummy = new THREE.Object3D(), color = new THREE.Color()
    for (const quality of ['low', 'medium', 'high'] as const) {
      const grid = voxels.grids.get(quality)!, nearOrigin = Array.from({ length: grid.count }, (_, i) => Math.hypot(...grid.rest.subarray(i * 3, i * 3 + 3)))
      expect(Math.min(...nearOrigin)).toBeLessThan(grid.side * 1.8); expect(grid.count).toBeLessThanOrEqual(CINEMA2_VOXEL_LIMITS.cells)
      const matrices = grid.mesh.instanceMatrix.array
      voxels.animate(quality, 2, 2, 1, .35, .8, false, [1, 1, 1], [1, 1, 1], dummy, color)
      voxels.animate(quality, 2, 3, 0, .35, 0, false, [1, 1, 1], [1, 1, 1], dummy, color)
      expect(grid.mesh.instanceMatrix.array).toBe(matrices)
      grid.mesh.getMatrixAt(0, dummy.matrix); dummy.position.setFromMatrixPosition(dummy.matrix)
      expect(dummy.position.toArray()).toEqual(Array.from(grid.rest.subarray(0, 3)))
    }
    const sourceDispose = vi.spyOn(m.mesh.geometry, 'dispose'); expect(voxels.additionalGpuBytes).toBeGreaterThan(0)
    voxels.dispose(); voxels.dispose(); expect(sourceDispose).not.toHaveBeenCalled(); m.prepared.dispose()
  })
  it('keeps the hole of a closed torus empty rather than filling its bounding box', () => {
    const m = model(new THREE.TorusGeometry(.7, .18, 10, 32)), voxels = new Cinema2VoxelizedUserModel(library, m.prepared, [m.mesh])
    expect(voxels.solid).toBe(true)
    for (const grid of voxels.grids.values()) for (let i = 0; i < grid.count; i++) expect(Math.hypot(grid.rest[i * 3], grid.rest[i * 3 + 1])).toBeGreaterThan(.3)
    voxels.dispose(); m.prepared.dispose()
  })
  it('explicitly treats an open model as a surface shell', () => {
    const m = model(new THREE.PlaneGeometry(2, 2)), voxels = new Cinema2VoxelizedUserModel(library, m.prepared, [m.mesh])
    expect(voxels.solid).toBe(false); for (const grid of voxels.grids.values()) expect(grid.count).toBeLessThan((CINEMA2_VOXEL_LIMITS.resolutions.high + 2) ** 2 * 2)
    voxels.dispose(); m.prepared.dispose()
    const controller = new Cinema2UserModelPreviewEffects(library, 'voxel'); controller.attach(m.root, true)
    expect(controller.getDiagnostics()[0].code).toBe('CINEMA2_USER_MODEL_VOXEL_SHELL'); controller.dispose()
  })
})

describe.each(kinds)('Phase 9: %s integration', kind => {
  it('runs a three-minute transport with Pattern Change off, bounds resources, freezes, resets seek/track/context and restores ownership', () => {
    const m = model(), controller = new Cinema2UserModelPreviewEffects(library, kind)
    const hook = m.material.onBeforeCompile, materialJSON = m.material.toJSON(), geometry = [...m.mesh.geometry.attributes.position.array]
    const values = { patternChange: false, autoPerformance: false, intensity: 1, emission: 0, reactivity: 0, movement: .35, speed: 1 }
    controller.attach(m.root, true); controller.update(frame(0, values)); controller.beforeDraw('high')
    const bytes = controller.estimateAdditionalGpuBytes(), cpu = controller.inspect().preparations[0].cpuBytes
    let moved = false
    for (let t = .25; t <= 180; t += .25) {
      controller.update(frame(t, values))
      if (t % 1 === 0) controller.beforeDraw(t % 3 === 0 ? 'low' : t % 3 === 1 ? 'medium' : 'high')
      moved ||= kind === 'form' ? controller.inspect().phase > 0 : kind === 'dust' ? (controller.inspect().dustCycle?.spread ?? 0) > .5 : controller.inspect().transformSpread > .5
    }
    expect(moved).toBe(true); expect(controller.estimateAdditionalGpuBytes()).toBe(bytes); expect(controller.inspect().preparations[0].cpuBytes).toBe(cpu)
    const before = controller.inspect(); controller.update(frame(180.25, values, true)); controller.update(frame(180.5, values, true))
    expect(controller.inspect().phase).toBe(before.phase); expect(controller.inspect().transformSpread).toBe(before.transformSpread)
    for (const [t, generation, track] of [[0, 1, 'logo'], [.25, 1, 'new'], [.5, 2, 'new']] as const) {
      controller.update(frame(t, values, false, generation, track)); expect(controller.inspect().transformSpread).toBe(0)
    }
    controller.beforeDraw('high'); expect(m.mesh.parent!.visible).toBe(true)
    controller.dispose(); expect(controller.estimateAdditionalGpuBytes()).toBe(0); expect(controller.inspect().attachmentCount).toBe(0)
    expect(m.material.onBeforeCompile).toBe(hook); expect(m.material.toJSON()).toEqual(materialJSON); expect([...m.mesh.geometry.attributes.position.array]).toEqual(geometry)
    expect(m.root.children).toEqual([m.mesh]); expect(values.patternChange).toBe(false); m.prepared.dispose()
  })
  it('restores existing pinned assets and persists the added controls without changing the preset revision', () => {
    const manifest = createCinema2UserModelPreset(kind), registry = new Cinema2PresetRegistry(); registry.register(manifest)
    const compiled = registry.compile(manifest.id); if (!compiled.ok) throw Error('compile failed')
    const id = (key: string) => cinema2UserModelPreviewParameterId(kind, key), state = new Cinema2ParameterState(compiled.plan.parameters)
    const binding = 'user-model:c0000000-0000-4000-8000-000000000001:1'; state.setPersistentValue(id('model'), binding)
    const legacy = JSON.parse(state.serialize())
    for (const key of ['tintModel', 'modelYaw', 'modelScale', 'transformCycleBeats']) delete legacy.values[id(key)]
    const restored = new Cinema2ParameterState(compiled.plan.parameters); expect(restored.restore(JSON.stringify(legacy)).ok).toBe(true)
    expect(restored.getValue(id('model'))).toBe(binding); expect(restored.getValue(id('modelScale'))).toBe(1); expect(manifest.revision).toBe(1)
    if (['shatter', 'hologram', 'voxel'].includes(kind)) {
      restored.setPersistentValue(id('modelScale'), .8)
      const copy = new Cinema2ParameterState(compiled.plan.parameters); expect(copy.restore(restored.serialize()).ok).toBe(true)
      expect(copy.getValue(id('modelScale'))).toBe(.8); expect(copy.getValue(id('model'))).toBe(binding)
    }
  })
})
