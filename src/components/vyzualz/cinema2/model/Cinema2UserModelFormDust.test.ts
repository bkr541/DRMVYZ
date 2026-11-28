import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2PresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2UserModelPreviewEffects } from './Cinema2UserModelPreviewEffects'
import { cinema2DustCycle, cinema2DustPosition, cinema2DustSurfaceRank } from './Cinema2UserModelFormDust'
import { CINEMA2_USER_MODEL_PREVIEWS, CINEMA2_USER_MODEL_PROXY_LIMITS } from './Cinema2UserModelPreviewPatterns'
import { createCinema2UserModelPreset, cinema2UserModelPreviewParameterId } from '../presets/Cinema2UserModelPresetFactory'
const library = { THREE } as unknown as Cinema2ThreeLibrary
const frame = (time: number, values: Record<string, unknown>, paused = false): Cinema2ModuleUpdateContext => ({
  frame: { elapsedTimeSec: time, timestampMs: time * 1000, deltaTimeSec: .125, contextGeneration: 1,
    transport: { trackId: 'logo', sourcePresent: true, playing: !paused, paused, animationActive: !paused, timeSec: time, bpm: 120 }, audio: null },
  parameters: { get: (key: string) => values[key], getEditRevision: () => 0 },
} as unknown as Cinema2ModuleUpdateContext)
function setup(kind: 'form' | 'dust') {
  const root = new THREE.Group(), material = new THREE.MeshPhysicalMaterial({ color: '#ae9765', roughness: .2, metalness: .8, transparent: true, opacity: .92, depthWrite: false })
  const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(.6, .2, 48, 8), material); root.add(mesh)
  const controller = new Cinema2UserModelPreviewEffects(library, kind)
  controller.attach(root, true)
  const values: Record<string, unknown> = { intensity: 1, emission: 0, patternChange: false, autoPerformance: false, reactivity: 0, movement: .35, speed: 1 }
  let time = 0
  const at = (next: number, paused = false) => {
    if (next < time) { controller.update(frame(next, values, paused)); time = next }
    for (; time + .125 < next + 1e-8; time += .125) controller.update(frame(time, values, paused))
    controller.update(frame(next, values, paused)); time = next
    controller.beforeDraw('high')
  }
  return { root, mesh, material, controller, values, at, pivot: root.children[0] }
}

describe('Phase 3: Form material-preserving choreography', () => {
  it('keeps original PBR colors, maps, transparency and geometry, with palette tint explicitly opt-in', () => {
    const model = setup('form'), positions = [...model.mesh.geometry.attributes.position.array], color = model.material.color.clone()
    const roughness = model.material.roughness, metalness = model.material.metalness
    model.at(0); model.at(1)
    expect(model.material.color.toArray()).toEqual(color.toArray())
    expect(model.material.roughness).toBe(roughness); expect(model.material.metalness).toBe(metalness)
    expect(model.material.opacity).toBe(.92); expect(model.material.depthWrite).toBe(false)
    model.values.tintModel = true; model.values.primary = [1, 0, 0]; model.at(1.125)
    expect(model.material.color.g).toBe(0)
    model.values.tintModel = false; model.at(1.25)
    expect(model.material.color.toArray()).toEqual(color.toArray())
    expect([...model.mesh.geometry.attributes.position.array]).toEqual(positions); model.controller.dispose()
  })
  it.each(CINEMA2_USER_MODEL_PREVIEWS.form)('animates %s with Pattern Change and Auto Performance off; freezes on pause', pattern => {
    const model = setup('form'); model.values.pattern = pattern
    model.at(0); const initial = model.pivot.matrix.clone(); model.root.updateMatrixWorld(true); initial.copy(model.pivot.matrix)
    model.at(1); model.root.updateMatrixWorld(true); expect(model.pivot.matrix.toArray()).not.toEqual(initial.toArray())
    const frozen = model.pivot.matrix.toArray()
    model.at(1.125, true); model.at(1.25, true); model.root.updateMatrixWorld(true)
    expect(model.pivot.matrix.toArray()).toEqual(frozen)
    model.controller.dispose()
  })
})

describe('Phase 4: model-to-dust-to-model lifecycle', () => {
  it('passes through every stage and recovers the complete mesh without changing its buffers', () => {
    const model = setup('dust')
    const positions = [...model.mesh.geometry.attributes.position.array]
    model.at(0); expect(model.controller.inspect().dustCycle?.stage).toBe('solid')
    model.at(1.8); expect(model.controller.inspect().dustCycle?.stage).toBe('dissolving')
    model.at(3.5); expect(model.controller.inspect().dustCycle?.stage).toBe('drifting')
    expect(model.mesh.parent!.visible).toBe(false)
    model.at(6.2); expect(model.controller.inspect().dustCycle?.stage).toBe('gathering')
    model.at(7.5); expect(model.controller.inspect().dustCycle?.stage).toBe('reforming')
    expect(model.controller.inspect().dustCycle?.spread).toBe(0)
    model.at(8); expect(model.controller.inspect().dustCycle?.stage).toBe('solid')
    expect(model.mesh.parent!.visible).toBe(true)
    const points: THREE.Points[] = []; model.root.traverse(object => { if ((object as THREE.Points).isPoints) points.push(object as THREE.Points) })
    expect(points.every(cloud => !cloud.visible)).toBe(true)
    expect([...model.mesh.geometry.attributes.position.array]).toEqual(positions)
    expect(model.values.patternChange).toBe(false); expect(model.values.autoPerformance).toBe(false)
    model.controller.dispose()
  })
  it.each(CINEMA2_USER_MODEL_PREVIEWS.dust)('runs a full cycle for %s and returns each particle to its own surface position', pattern => {
    const model = setup('dust'); model.values.pattern = pattern; model.at(0); model.at(3.5)
    expect(model.controller.inspect().dustCycle?.stage).toBe('drifting')
    model.at(7.2); expect(model.controller.inspect().dustCycle?.spread).toBe(0)
    const points: THREE.Points[] = []; model.root.traverse(object => { if ((object as THREE.Points).isPoints) points.push(object as THREE.Points) })
    for (const cloud of points) expect(cloud.geometry.drawRange.count).toBe(CINEMA2_USER_MODEL_PROXY_LIMITS.high.dust / 2)
    const firstPositions = points[0].geometry.attributes.position.array.slice(0, 60)
    model.at(15.2)
    expect(points[0].geometry.attributes.position.array.slice(0, 60)).toEqual(firstPositions)
    model.controller.dispose()
  })
  it('provides distinct particle choreography, exact gathering and bounded displacement', () => {
    const rest = new THREE.Vector3(.1, .2, -.1), out = new THREE.Vector3(), poses = new Set<string>()
    for (let pattern = 0; pattern < 6; pattern++) {
      cinema2DustPosition(out, rest, 2, 37, pattern, 2, 1, .8, 1); poses.add(out.toArray().join(','))
      expect(out.length()).toBeLessThan(3)
      cinema2DustPosition(out, rest, 2, 37, pattern, 2, 0, .8, 1); expect(out.toArray()).toEqual(rest.toArray())
    }
    expect(poses.size).toBe(6)
    expect(cinema2DustSurfaceRank(.1, .4, .2)).toBeGreaterThan(cinema2DustSurfaceRank(.1, -.4, .2))
    expect(cinema2DustCycle(0)).toEqual(cinema2DustCycle(16))
  })
  it('freezes the cycle on pause, resets on a seek, honors zero movement, and applies quality counts without reallocating', () => {
    const model = setup('dust'); model.at(0); model.at(3.5)
    const before = model.controller.inspect().dustCycle
    model.at(3.625, true); model.at(3.75, true); expect(model.controller.inspect().dustCycle).toEqual(before)
    model.at(0); expect(model.controller.inspect().dustCycle?.stage).toBe('solid')
    model.values.movement = 0; model.at(2); expect(model.controller.inspect().dustCycle?.dissolve).toBe(0)
    const cpuBytes = model.controller.inspect().preparations[0].cpuBytes, gpuBytes = model.controller.estimateAdditionalGpuBytes()
    for (const quality of ['low', 'medium', 'high'] as const) {
      model.controller.beforeDraw(quality)
      model.root.traverse(object => { if ((object as THREE.Points).isPoints) expect((object as THREE.Points).geometry.drawRange.count).toBe(CINEMA2_USER_MODEL_PROXY_LIMITS[quality].dust / 2) })
      expect(model.controller.inspect().preparations[0].cpuBytes).toBe(cpuBytes); expect(model.controller.estimateAdditionalGpuBytes()).toBe(gpuBytes)
    }
    expect(gpuBytes).toBe(CINEMA2_USER_MODEL_PROXY_LIMITS.high.dust * 20); model.controller.dispose(); expect(model.controller.estimateAdditionalGpuBytes()).toBe(0)
  })
  it('chains material shaders and restores their hooks on detach; point grains have per-sample opacity', () => {
    const model = setup('dust'), shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <alphatest_fragment>\n#include <opaque_fragment>' }
    model.material.onBeforeCompile(shader as never, {} as never)
    expect(shader.vertexShader).toContain('vC2DustRest'); expect(shader.fragmentShader).toContain('dustRank < c2DustAmount')
    expect(shader.uniforms).toHaveProperty('c2DustAmount')
    const hook = model.material.onBeforeCompile, dispose = vi.spyOn(model.mesh.geometry, 'dispose')
    model.at(2); model.controller.detach(model.root)
    expect(model.material.onBeforeCompile).not.toBe(hook); expect(dispose).not.toHaveBeenCalled()
    expect(model.root.children).toEqual([model.mesh]); model.controller.dispose()
  })
})

describe('Form and Dust production controls', () => {
  it.each(['form', 'dust'] as const)('restores a Phase 1 %s model binding while new controls take defaults', kind => {
    const manifest = createCinema2UserModelPreset(kind), registry = new Cinema2PresetRegistry(); registry.register(manifest)
    const result = registry.compile(manifest.id); if (!result.ok) throw new Error('compile failed')
    const state = new Cinema2ParameterState(result.plan.parameters), modelId = cinema2UserModelPreviewParameterId(kind, 'model')
    const binding = 'user-model:c0000000-0000-4000-8000-000000000001:1'; state.setPersistentValue(modelId, binding)
    const legacy = JSON.parse(state.serialize())
    for (const key of ['tintModel', 'modelYaw', 'modelScale', 'cycleBeats']) delete legacy.values[cinema2UserModelPreviewParameterId(kind, key)]
    const restored = new Cinema2ParameterState(result.plan.parameters)
    expect(restored.restore(JSON.stringify(legacy)).ok).toBe(true)
    expect(restored.getValue(modelId)).toBe(binding)
    expect(restored.getValue(cinema2UserModelPreviewParameterId(kind, 'tintModel'))).toBe(kind === 'form' ? false : undefined)
    expect(restored.getValue(cinema2UserModelPreviewParameterId(kind, 'modelScale'))).toBe(1)
  })

  it.each(['form', 'dust'] as const)('keeps model binding and shared control groups for %s while enabling neutral studio presentation', kind => {
    const manifest = createCinema2UserModelPreset(kind), find = (key: string) => manifest.parameters!.find(p => p.id === cinema2UserModelPreviewParameterId(kind, key))!
    expect(manifest.revision).toBe(1)
    if (kind === 'form') expect(find('tintModel')).toMatchObject({ defaultValue: false, designParentGroup: 'effects' })
    expect(find('modelScale')).toMatchObject({ min: .5, max: 1.2 })
    expect(manifest.modules![0].config).toMatchObject({ userModelPreview: kind, environment: 'cinema2-studio-environment-neutral', userModel: { neutralFloor: false } })
    if (kind === 'dust') expect(find('cycleBeats')).toBeUndefined()
  })
})
