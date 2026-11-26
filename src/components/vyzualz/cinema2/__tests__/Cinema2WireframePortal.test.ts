import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CINEMA2_WIREFRAME_PORTAL_PRESET_MANIFEST as manifest, wireframePortalParameterId as pid } from '../presets/Cinema2WireframePortalPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { CINEMA2_CRATE_PRESET_MANIFESTS } from '../presets/Cinema2CratePresets'
import { Cinema2WireframePortalController } from '../modules/Cinema2WireframePortalNativeModule'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { evaluateWireframePortalBay, evaluateWireframePortalBeam, WIREFRAME_PORTAL_PATTERN_IDS } from '../modules/wireframePortal/WireframePortalPatterns'
import { wireframePortalOrigin } from '../modules/wireframePortal/WireframePortalScene'
import { moodMusic } from './support/MoodMigrationHarness'

const source = 'public/cinema2/models/crate/lightweight.glb'

/** The decoded texture needs a browser; geometry, morph targets and the material's alpha cutoff are all the scene reads in a test, so the image is dropped. */
function withoutTexture(bytes: Buffer): ArrayBuffer {
  const jsonLength = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'))
  delete json.images; delete json.textures; delete json.samplers
  for (const material of json.materials) delete material.pbrMetallicRoughness.baseColorTexture
  let text = JSON.stringify(json)
  while (Buffer.byteLength(text) % 4) text += ' '
  const rest = bytes.subarray(20 + jsonLength)
  const head = Buffer.alloc(20)
  bytes.copy(head, 0, 0, 12)
  head.writeUInt32LE(Buffer.byteLength(text), 12)
  head.writeUInt32LE(0x4e4f534a, 16)
  const out = Buffer.concat([head, Buffer.from(text), rest])
  out.writeUInt32LE(out.length, 8)
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
}

async function setup() {
  const scene = (await new GLTFLoader().parseAsync(withoutTexture(readFileSync(source)), '')).scene
  const values: Record<string, unknown> = { ...manifest.modules![0]!.parameters }
  const controller = new Cinema2WireframePortalController({ THREE } as Cinema2ThreeLibrary)
  let sourceGeometry: THREE.BufferGeometry | null = null
  scene.traverse(object => { if (object instanceof THREE.Mesh) sourceGeometry = object.geometry })
  controller.attach(scene)
  let time = 0
  const edits = new Map<string, number>()
  const step = (quality: 'low' | 'medium' | 'high' = 'high', playing = true, eye?: [number, number, number]) => {
    time += 1 / 30
    const frame = {
      frameId: time * 30, timestampMs: time * 1000, elapsedTimeSec: time, deltaTimeSec: 1 / 30, contextGeneration: 1, audio: null, director: null, mood: null,
      transport: { sourcePresent: playing, playing, paused: !playing, animationActive: true, timeSec: time, trackId: playing ? 't' : null, bpm: 120 },
    }
    controller.update({ frame, parameters: { get: (name: string) => values[name], getEditRevision: (name: string) => edits.get(name) ?? 0 }, targets: {} } as unknown as Cinema2ModuleUpdateContext)
    controller.beforeDraw(quality, eye ? { position: eye } : undefined)
    scene.updateMatrixWorld(true)
  }
  const set = (name: string, value: unknown) => { values[name] = value; edits.set(name, (edits.get(name) ?? 0) + 1) }
  /** One frame with a real mood and director frame, for the Auto Performance tests. */
  const play = (frame: unknown) => {
    controller.update({ frame, parameters: { get: (name: string) => values[name], getEditRevision: (name: string) => edits.get(name) ?? 0 }, targets: {} } as unknown as Cinema2ModuleUpdateContext)
    controller.beforeDraw('high')
    scene.updateMatrixWorld(true)
  }
  return { controller, scene, values, step, set, play, sourceGeometry: sourceGeometry! as THREE.BufferGeometry }
}

const bayInput = (index: number) => ({ cell: [1, 0, -1] as const, index, count: 28, outward: [.6, 0, -.8] as const, axis: 0, sign: 1, drift: index * .3 })

it('keeps the original preset identity and asset, and compiles with the full control set', () => {
  expect(CINEMA2_CRATE_PRESET_MANIFESTS.find(preset => preset.id === manifest.id)).toBe(manifest)
  expect(cinema2NativePresetRegistry.compile(manifest.id).ok).toBe(true)
  expect(manifest.revision).toBe(3)
  expect(manifest.modules![0]!.config?.instances).toEqual([expect.objectContaining({ asset: 'cinema2-crate-wireframe-portal', spin: false, preserveMaterials: true })])
  const groups = (parent: string) => manifest.parameters!.filter(p => p.designParentGroup === parent).map(p => p.label)
  expect(groups('master-controls')).toEqual(['BPM Sync', 'Intensity', 'Audio Reactivity', 'Auto Performance'])
  expect(groups('palette')).toEqual(['Background', 'Steel', 'Hot Joints', 'Edge Runs', 'Cold Rim', 'Red Rim'])
  expect(groups('effects')).toEqual(['Haze', 'Dust', 'Bloom', 'Joint Glare', 'Depth Focus', 'Tone Finish'])
  expect(manifest.parameters!.filter(p => p.group === 'Pattern').map(p => p.label)).toEqual(['Pattern', 'Pattern Change', 'Trigger', 'Kinetics'])
  expect(manifest.parameters!.find(p => p.label === 'Pattern')).toMatchObject({ options: expect.arrayContaining([expect.objectContaining({ value: 'detonate' })]) })
  expect(Object.keys(manifest.cameras![0]!.rigVariants!)).toEqual(['director', 'flythrough', 'horizontal', 'manual'])
  expect(manifest.cameras![0]!.rig).toMatchObject({ kind: 'path' })
  expect(manifest.modules![0]!.parameters).toMatchObject({ flash: 0, blast: 0 })
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
  expect(hash(source)).toBe(hash('3D Cinema 2.0 Crate/lightweight.glb'))
})

it('uses wide exterior orbits and elevated travel lanes, looking at the structure throughout', () => {
  for (const name of ['director', 'flythrough'] as const) {
    const rig = manifest.cameras![0]!.rigVariants![name] as unknown as { points: { position: number[]; target: number[] }[] }
    const lanes = rig.points.filter(({ position: [x, y, z] }) => y! >= 12 && Math.abs(x!) < 4 && z! < 4 && z! > -14)
    expect(lanes.length).toBeGreaterThan(4)
    for (const point of rig.points) {
      expect(point.target).toEqual([0, 0, -3.7])
      expect(Math.hypot(point.position[0]!, point.position[1]!, point.position[2]! + 3.7)).toBeGreaterThanOrEqual(12)
    }
  }
})

it('has six programs that move the bays and aim the beams differently, and a blast on top of any of them', () => {
  const bays = new Set(WIREFRAME_PORTAL_PATTERN_IDS.map(id => JSON.stringify([.3, 1.4, 2.6].map(beats => evaluateWireframePortalBay(id, beats, bayInput(3))))))
  expect(bays.size).toBe(WIREFRAME_PORTAL_PATTERN_IDS.length)
  const beams = new Set(WIREFRAME_PORTAL_PATTERN_IDS.map(id => JSON.stringify([.3, 1.4, 2.6].map(beats => evaluateWireframePortalBeam(id, beats, { index: 2, count: 12, outward: [.6, 0, -.8] })))))
  expect(beams.size).toBe(WIREFRAME_PORTAL_PATTERN_IDS.length)
  const calm = evaluateWireframePortalBay('lattice', 1, bayInput(3))
  const blasted = evaluateWireframePortalBay('lattice', 1, bayInput(3), 1)
  expect(Math.hypot(...blasted.offset)).toBeGreaterThan(Math.hypot(...calm.offset) + 1.5)
  // Detonate blows apart and has put the structure back before the bar ends.
  expect(Math.hypot(...evaluateWireframePortalBay('detonate', 4.05, bayInput(3)).offset)).toBeGreaterThan(1.5)
  expect(Math.hypot(...evaluateWireframePortalBay('detonate', 7.95, bayInput(3)).offset)).toBeLessThan(.3)
})

it('builds 28 kinetic bays with cores, twelve beams with lenses, rim lights, haze and dust', async () => {
  const s = await setup()
  s.step()
  expect(s.controller.inspect()).toMatchObject({ bayCount: 28, satelliteCount: 16, satelliteBraceCount: 32, fixtureCount: 12, visibleBeams: 10, lights: ['truss-cold-rim', 'truss-red-rim', 'truss-under-key'] })
  for (const name of ['truss-bay-1-rails', 'truss-bay-28-joints', 'truss-bay-5-core', 'truss-beam-1', 'truss-beam-lens-12', 'truss-cold-rim', 'truss-dust']) expect(s.scene.getObjectByName(name), name).toBeDefined()
  const steel = (s.scene.getObjectByName('truss-bay-1-rails') as THREE.Mesh).material as THREE.MeshStandardMaterial
  expect(steel.metalness).toBeGreaterThan(.5)
  s.controller.dispose()
})

it('moves the bays with the program, holds them still at Kinetics 0 or while paused, and lets the beams follow', async () => {
  const s = await setup()
  s.set('pattern', 'extrude')
  s.step()
  const bay = s.scene.getObjectByName('truss-bay-6')!
  const beam = s.scene.getObjectByName('truss-beam-3')!
  const start = [bay.position.toArray(), beam.quaternion.toArray()]
  for (let i = 0; i < 20; i += 1) s.step()
  expect([bay.position.toArray(), beam.quaternion.toArray()]).not.toEqual(start)
  s.set('pattern', 'rotor')
  for (let i = 0; i < 40; i += 1) s.step()
  expect(bay.quaternion.toArray()).not.toEqual([0, 0, 0, 1])
  s.values.kinetics = 0
  s.step()
  wireframePortalOrigin([-1, 0, 0]).forEach((value, axis) => expect(bay.position.getComponent(axis)).toBeCloseTo(value))
  const frozen = bay.position.toArray()
  for (let i = 0; i < 20; i += 1) s.step()
  expect(bay.position.toArray()).toEqual(frozen)
  s.values.kinetics = 1
  for (let i = 0; i < 20; i += 1) s.step('high', false)
  const paused = bay.matrix.toArray()
  for (let i = 0; i < 20; i += 1) s.step('high', false)
  expect(bay.matrix.toArray()).toEqual(paused)
  s.controller.dispose()
})

it('keeps the connecting bars on the bays as they move', async () => {
  const s = await setup()
  s.set('pattern', 'detonate')
  s.step()
  const bars = s.scene.getObjectByName('Kinetic Truss')!.children.filter(child => (child as THREE.InstancedMesh).isInstancedMesh && (child as THREE.InstancedMesh).count > 10) as THREE.InstancedMesh[]
  expect(bars.length).toBeGreaterThan(0)
  const before = bars[0]!.instanceMatrix.array.slice(0, 16).join()
  for (let i = 0; i < 25; i += 1) s.step()
  expect(bars[0]!.instanceMatrix.array.slice(0, 16).join()).not.toBe(before)
  s.controller.dispose()
})

it('flashes the cores on a kick, blasts and strobes on a drop, and honours lighting zeros', async () => {
  const s = await setup()
  s.step()
  const core = (s.scene.getObjectByName('truss-bay-5-core') as THREE.Mesh).material as THREE.MeshBasicMaterial
  const beam = s.scene.getObjectByName('truss-beam-1') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  const quiet = core.color.r
  const quietBeam = beam.material.uniforms.uStrength!.value as number
  s.values.flash = 1
  s.step()
  expect(core.color.r).toBeGreaterThan(quiet)
  s.values.flash = 0; s.values.blast = 1
  s.step()
  const bay = s.scene.getObjectByName('truss-bay-5')!
  expect(bay.position.distanceTo(new THREE.Vector3(...wireframePortalOrigin([-2, 0, 0])))).toBeGreaterThan(1.5)
  expect(beam.material.uniforms.uStrength!.value as number).not.toBe(quietBeam)
  s.values.blast = 0; s.values.beamLighting = 0
  s.step()
  expect(beam.visible).toBe(false)
  s.values.rimLighting = 0
  s.step()
  expect((s.scene.getObjectByName('truss-cold-rim') as THREE.SpotLight).visible).toBe(false)
  s.values.intensity = 0
  s.step()
  expect(s.scene.getObjectByName('Kinetic Truss')!.visible).toBe(false)
  s.controller.dispose()
})

it('puts Fold on stage for a build and Detonate for a drop with Auto Performance on, and never rewrites the saved Pattern', async () => {
  const s = await setup()
  s.values.autoPerformance = true; s.values.reactivity = 1; s.set('pattern', 'lattice')
  const music = moodMusic()
  const quiet = (count: number) => { for (let i = 0; i < count; i += 1) s.play(music.next({ energy: .3 })) }
  quiet(20)
  expect(s.controller.inspect().pattern).toBe('lattice')
  for (let i = 0; i < 90; i += 1) s.play(music.next({ energy: .8, build: Math.min(.9, i / 40) }))
  expect(s.controller.inspect().pattern, 'a build is on stage').toBe('fold')
  quiet(500)
  expect(s.controller.inspect().pattern).toBe('lattice')
  for (let i = 0; i < 12; i += 1) s.play(music.next({ energy: 1, bass: 1, event: 'drop', eventId: 900 + i, build: 0 }))
  expect(s.controller.inspect().pattern, 'the drop is on stage').toBe('detonate')
  quiet(700)
  expect(s.controller.inspect().pattern).toBe('lattice')
  expect(s.values.pattern).toBe('lattice')
  s.controller.dispose()
})

it('does nothing to the Pattern with Auto Performance off, however the music builds and drops', async () => {
  const s = await setup()
  s.values.autoPerformance = false; s.set('pattern', 'ripple')
  const music = moodMusic()
  for (let i = 0; i < 20; i += 1) s.play(music.next({ energy: .3 }))
  for (let i = 0; i < 90; i += 1) s.play(music.next({ energy: .8, build: Math.min(.9, i / 40) }))
  for (let i = 0; i < 12; i += 1) s.play(music.next({ energy: 1, bass: 1, event: 'drop', eventId: 900 + i }))
  expect(s.controller.inspect().pattern).toBe('ripple')
  s.controller.dispose()
})

it('draws fewer beams on lower tiers, and disposes only what it owns', async () => {
  const s = await setup()
  s.step('high')
  expect(s.controller.inspect()).toMatchObject({ visibleBeams: 10, satelliteCount: 16, satelliteBraceCount: 32 })
  s.step('medium'); expect(s.controller.inspect()).toMatchObject({ visibleBeams: 6, satelliteCount: 8, satelliteBraceCount: 16 })
  s.step('low'); expect(s.controller.inspect()).toMatchObject({ visibleBeams: 4, satelliteCount: 4, satelliteBraceCount: 0 })
  expect(s.scene.getObjectByName('truss-dust')).toBeUndefined()
  expect((s.scene.getObjectByName('truss-red-rim') as THREE.SpotLight).visible).toBe(false)
  let sourceDisposed = false
  s.sourceGeometry.addEventListener('dispose', () => { sourceDisposed = true })
  const joints = (s.scene.getObjectByName('truss-bay-2-joints') as THREE.Mesh).geometry
  let ownedDisposed = false
  joints.addEventListener('dispose', () => { ownedDisposed = true })
  s.controller.dispose()
  expect(ownedDisposed).toBe(true)
  expect(sourceDisposed).toBe(false)
  expect(s.scene.getObjectByName('Kinetic Truss')).toBeUndefined()
})

it('fades the lenses, beams and cores out as the camera flies close to them, so none fills the screen', async () => {
  const s = await setup()
  s.step()
  const lens = s.scene.getObjectByName('truss-beam-lens-1') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  const beam = s.scene.getObjectByName('truss-beam-1') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  const core = (s.scene.getObjectByName('truss-bay-5-core') as THREE.Mesh).material as THREE.MeshBasicMaterial
  s.step('high', true, [0, 0, 40])
  const farLens = lens.material.color.r, farBeam = beam.material.uniforms.uStrength!.value as number, farCore = core.color.r
  expect(farLens).toBeGreaterThan(0)
  // Put the eye right on the first fixture and on the fifth bay.
  s.step('high', true, lens.position.toArray() as [number, number, number])
  expect(lens.visible).toBe(false)
  expect(beam.material.uniforms.uStrength!.value as number).toBeLessThan(farBeam * .5)
  const bay = s.scene.getObjectByName('truss-bay-5')!
  s.step('high', true, bay.position.toArray() as [number, number, number])
  expect(core.color.r).toBeLessThan(farCore * .1)
  expect(bay.visible).toBe(false)
  s.step('high', true, [0, 0, 40])
  expect(bay.visible).toBe(true)
  s.controller.dispose()
})


it('binds spatial controls to the real bay and satellite transforms without changing saved pattern or tier resources', async () => {
  const s = await setup()
  s.set('kinetics', 0)
  s.step()
  const primary = s.scene.getObjectByName('truss-bay-5')!
  const satellite = s.scene.getObjectByName('truss-satellite-rails') as THREE.InstancedMesh
  const braces = s.scene.getObjectByName('truss-satellite-braces') as THREE.InstancedMesh
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3()
  satellite.getMatrixAt(0, matrix)
  const before = position.setFromMatrixPosition(matrix).clone()
  const primaryBefore = primary.position.clone()
  const resourceCount = s.controller.inspect().instancedBatches
  s.set('spatialSpread', 1.2); s.step()
  expect(primary.position.x).toBeCloseTo(primaryBefore.x * 1.2)
  expect(primary.position.z).toBeCloseTo(primaryBefore.z)
  satellite.getMatrixAt(0, matrix)
  expect(position.setFromMatrixPosition(matrix).x).toBeCloseTo(before.x * 1.2)
  s.set('depthDistribution', 1.2); s.step()
  satellite.getMatrixAt(0, matrix)
  expect(position.setFromMatrixPosition(matrix).z + 3.7).toBeCloseTo((before.z + 3.7) * 1.2)
  expect(primary.position.z + 3.7).toBeCloseTo((primaryBefore.z + 3.7) * 1.2)
  s.set('structuralDensity', .5); s.step()
  expect(satellite.count).toBe(8)
  expect(braces.count).toBe(16)
  s.set('structuralDensity', 0); s.step()
  expect(satellite.count).toBe(0)
  expect(braces.count).toBe(0)
  expect(primary.visible).toBe(true)
  s.set('structuralDensity', 1); s.step()
  expect(satellite.count).toBe(16)
  expect(s.controller.inspect().instancedBatches).toBe(resourceCount)
  expect(s.values.pattern).toBe('lattice')
  s.controller.dispose()
})

it('keeps the new satellite batches on the six shared programs and pauses their transforms', async () => {
  const s = await setup()
  const satellite = s.scene.getObjectByName('truss-satellite-rails') as THREE.InstancedMesh
  const signatures = new Set<string>()
  for (const pattern of WIREFRAME_PORTAL_PATTERN_IDS) {
    s.set('pattern', pattern); s.step()
    signatures.add(satellite.instanceMatrix.array.slice(0, 16).join(','))
    expect(s.controller.inspect().activePattern).toBe(pattern)
  }
  expect(signatures.size).toBe(6)
  s.step('high', false)
  const paused = satellite.instanceMatrix.array.slice(0, 16).join(',')
  s.step('high', false)
  expect(satellite.instanceMatrix.array.slice(0, 16).join(',')).toBe(paused)
  s.controller.dispose()
})
