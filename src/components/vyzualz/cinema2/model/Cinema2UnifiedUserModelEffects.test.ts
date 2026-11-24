import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2UnifiedUserModelEffects } from './Cinema2UnifiedUserModelEffects'
import { CINEMA2_USER_MODEL_PREVIEWS, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'
import { createCinema2UserModelPreset, cinema2UserModelPreviewParameterId } from '../presets/Cinema2UserModelPresetFactory'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'

const library = { THREE } as unknown as Cinema2ThreeLibrary
const modes = Object.keys(CINEMA2_USER_MODEL_PREVIEWS) as Cinema2UserModelPreviewKind[]
const identity = 'user-model:c0000000-0000-4000-8000-000000000001:7'
function car() {
  const root = new THREE.Group(), paint = new THREE.MeshStandardMaterial({ color: '#c02020' }), rubber = new THREE.MeshStandardMaterial({ color: '#222222' })
  root.add(new THREE.Mesh(new THREE.BoxGeometry(2, .4, .9), paint))
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(.9, .45, .7), paint); cabin.position.y = .425; root.add(cabin)
  for (const x of [-.7, .7]) for (const z of [-.48, .48]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .18, 8), rubber)
    wheel.rotation.x = Math.PI / 2; wheel.position.set(x, -.2, z); root.add(wheel)
  }
  return root
}
function logo() {
  const shape = new THREE.Shape(); shape.moveTo(-1, -1); shape.lineTo(1, -1); shape.lineTo(1, -.5); shape.lineTo(-.5, -.5); shape.lineTo(-.5, 1); shape.lineTo(-1, 1); shape.closePath()
  const root = new THREE.Group(); root.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .25, bevelEnabled: false }), new THREE.MeshStandardMaterial())); return root
}
function draw(controller: Cinema2UnifiedUserModelEffects, representation: string, seconds: number, extra: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = { representation, effectPose: 'representation', movement: 0, shardDetail: '4', shatterSpread: 0, dustDrift: 0, sliceSeparation: 0, voxelSeparation: 0, transitionDuration: 0, ...extra }
  const context = { frame: { frameId: Math.round(seconds * 1000), timestampMs: seconds * 1000, elapsedTimeSec: seconds, deltaTimeSec: .016, contextGeneration: 1, viewport: { width: 1280, height: 720, dpr: 1 }, transport: { trackId: 'test', sourcePresent: true, playing: false, paused: true, animationActive: false, timeSec: 0, bpm: 120 }, audio: null, director: null }, parameters: { get: (name: string) => values[name], getAuthored: () => undefined, resolve: () => null, getEditRevision: () => 0 }, targets: {} } as unknown as Cinema2ModuleUpdateContext
  controller.update(context); controller.beforeDraw('low')
}
function visibleGeometry(root: THREE.Object3D) {
  let count = 0; root.traverseVisible(object => { if ((object as THREE.Mesh).isMesh || (object as THREE.Points).isPoints || (object as THREE.LineSegments).isLineSegments) count++ }); return count
}
describe('unified private-model representations', () => {
  it.each([['car', car], ['extruded logo', logo]] as const)('switches every ordered mode pair with the same %s and stable transform', (_name, fixture) => {
    const root = fixture(), originalChildren = [...root.children], source = root.children[0] as THREE.Mesh, dispose = vi.spyOn(source.geometry, 'dispose')
    const controller = new Cinema2UnifiedUserModelEffects(library, 'form'); controller.attach(root, true, [], identity)
    const transform = { modelPosition: [.2, .3, -.1], modelRotation: [4, 15, 2], modelScale: .9 }
    let t = 1; draw(controller, 'form', t, transform); const stable = controller.inspect().transform
    for (const from of modes) for (const to of modes) {
      draw(controller, from, t += .016, transform); draw(controller, to, t += .016, transform)
      expect(controller.inspect()).toMatchObject({ activeRepresentation: to, modelIdentity: identity, attachmentCount: 1, transform: stable })
      expect(controller.inspect().residentRepresentations.length).toBeLessThanOrEqual(2)
      expect(visibleGeometry(root)).toBeGreaterThan(0)
    }
    controller.dispose(); expect(root.children).toEqual(originalChildren); expect(dispose).not.toHaveBeenCalled(); expect(controller.inspect().attachmentCount).toBe(0)
  }, 120_000)
  it('completes and reverses a paused cross-transition, then interrupts it with a third target', () => {
    const root = logo(), controller = new Cinema2UnifiedUserModelEffects(library, 'form'); controller.attach(root, true, [], identity)
    const transition = { transitionDuration: 1, transitionEasing: 'linear' }
    draw(controller, 'form', 0); draw(controller, 'dust', .1, transition); draw(controller, 'dust', .35, transition)
    expect(controller.inspect().transitionProgress).toBeCloseTo(.25)
    draw(controller, 'form', .35, transition); expect(controller.inspect().transitionProgress).toBeCloseTo(.75)
    draw(controller, 'form', .6, transition); expect(controller.inspect().transitionProgress).toBe(1)
    draw(controller, 'dust', .7, transition); draw(controller, 'hologram', .8, transition)
    expect(controller.inspect().activeRepresentation).toBe('hologram'); expect(visibleGeometry(root)).toBeGreaterThan(0)
    for (let i = 1; i <= 5; i++) draw(controller, 'hologram', .8 + i * .2, transition)
    expect(controller.inspect().transitionProgress).toBe(1); controller.dispose()
  })
  it('disposes derived material resources and replaces version identity on model change and remount', () => {
    const first = logo(), second = car(), controller = new Cinema2UnifiedUserModelEffects(library, 'form')
    controller.attach(first, true, [], identity); draw(controller, 'form', 1)
    const mode = first.getObjectByName('UnifiedRepresentation:form')!; let cloned: THREE.Material | undefined
    mode.traverse(object => { if ((object as THREE.Mesh).isMesh && (object as THREE.Mesh).geometry === (first.getObjectByName('UnifiedModelSource')!.children[0] as THREE.Mesh).geometry) cloned = (object as THREE.Mesh).material as THREE.Material })
    const dispose = vi.spyOn(cloned!, 'dispose'); draw(controller, 'dust', 1.1, { transitionDuration: 1 })
    controller.attach(second, true, [], identity.replace(':7', ':8')); expect(dispose).toHaveBeenCalled(); expect(first.children[0].isObject3D).toBe(true)
    draw(controller, 'hologram', 1.2); expect(controller.inspect().modelIdentity).toBe(identity.replace(':7', ':8'))
    controller.dispose(); controller.attach(first, true, [], identity); draw(controller, 'form', 2); expect(controller.inspect().modelIdentity).toBe(identity); controller.dispose()
  })
  it('retains the source on unsupported or incomplete geometry rather than throwing', () => {
    const controller = new Cinema2UnifiedUserModelEffects(library, 'dust'), empty = new THREE.Group()
    controller.attach(empty, true, [], identity); expect(() => draw(controller, 'dust', 1)).not.toThrow(); expect(controller.inspect().activeRepresentation).toBe('form'); expect(controller.getDiagnostics().length).toBeGreaterThan(0)
    const malformed = new THREE.Group(), geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1], 3)); malformed.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()))
    controller.attach(malformed, true, [], identity); expect(() => draw(controller, 'voxel', 2)).not.toThrow(); expect(controller.inspect().activeRepresentation).toBe('form'); controller.dispose()
  })
  it.each(modes)('restores historical %s preset state and round-trips unified controls', kind => {
    const preset = createCinema2UserModelPreset(kind), compiled = cinema2NativePresetRegistry.compile(preset.id)
    if (!compiled.ok) throw new Error('Compatibility preset failed to compile')
    const state = new Cinema2ParameterState(compiled.plan.parameters), id = (key: string) => cinema2UserModelPreviewParameterId(kind, key)
    const old = JSON.parse(state.serialize()); old.values = { [id('model')]: identity, [id('pattern')]: CINEMA2_USER_MODEL_PREVIEWS[kind][2], [id('modelYaw')]: 27 }
    expect(state.restore(old).ok).toBe(true)
    expect(state.getSnapshot().persistentValues).toMatchObject({ [id('model')]: identity, [id('defaultRepresentation')]: kind, [id('representation')]: 'default' })
    expect(state.setPersistentValues({ [id('representation')]: 'voxel', [id('cameraOrbit')]: 35, [id('cameraTarget')]: [.1, .2, .3] }).ok).toBe(true)
    const restored = new Cinema2ParameterState(compiled.plan.parameters); expect(restored.restore(state.serialize()).ok).toBe(true); expect(restored.getSnapshot().persistentValues).toEqual(state.getSnapshot().persistentValues)
  })
})
