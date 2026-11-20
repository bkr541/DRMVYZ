import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CINEMA2_GLYPH_SPHERE_PRESET_MANIFEST as manifest, glyphSphereParameterId as pid } from '../presets/Cinema2GlyphSpherePreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { CINEMA2_CRATE_PRESET_MANIFESTS } from '../presets/Cinema2CratePresets'
import { Cinema2GlyphSphereController } from '../modules/Cinema2GlyphSphereNativeModule'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'

const source = 'public/cinema2/models/crate/oyes.glb'

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
  const controller = new Cinema2GlyphSphereController({ THREE } as Cinema2ThreeLibrary)
  let sourceGeometry: THREE.BufferGeometry | null = null
  scene.traverse(object => { if (object instanceof THREE.Mesh) sourceGeometry = object.geometry })
  controller.attach(scene)
  let time = 0
  const step = (quality: 'low' | 'medium' | 'high' = 'high', playing = true) => {
    time += 1 / 30
    const frame = {
      frameId: time * 30, timestampMs: time * 1000, elapsedTimeSec: time, deltaTimeSec: 1 / 30, contextGeneration: 1, audio: null, director: null, mood: null,
      transport: { sourcePresent: playing, playing, paused: !playing, animationActive: true, timeSec: time, trackId: playing ? 't' : null, bpm: 120 },
    }
    controller.update({ frame, parameters: { get: (name: string) => values[name], getEditRevision: () => 0 }, targets: {} } as unknown as Cinema2ModuleUpdateContext)
    controller.beforeDraw(quality)
    scene.updateMatrixWorld(true)
  }
  return { controller, scene, values, step, sourceGeometry: sourceGeometry! as THREE.BufferGeometry }
}

it('keeps the original preset identity and asset, and compiles with the full control set', () => {
  expect(CINEMA2_CRATE_PRESET_MANIFESTS.find(preset => preset.id === manifest.id)).toBe(manifest)
  expect(cinema2NativePresetRegistry.compile(manifest.id).ok).toBe(true)
  expect(manifest.revision).toBe(3)
  expect(manifest.modules![0]!.config?.instances).toEqual([expect.objectContaining({ asset: 'cinema2-crate-glyph-sphere', spin: false, preserveMaterials: true })])
  const groups = (parent: string) => manifest.parameters!.filter(p => p.designParentGroup === parent).map(p => p.label)
  expect(groups('master-controls')).toEqual(['BPM Sync', 'Intensity', 'Audio Reactivity', 'Auto Performance'])
  expect(groups('palette')).toEqual(['Background', 'Core', 'Inner Band', 'Middle Band', 'Outer Band', 'Frames'])
  expect(groups('effects')).toEqual(['Core Halo', 'Bloom', 'Starfield', 'Tone Finish'])
  expect(Object.keys(manifest.cameras![0]!.rigVariants!)).toEqual(['manual', 'horizontal', 'omnidirectional'])
  expect(manifest.cameras![0]!.controls).toMatchObject({ kickZoom: { $ref: pid('cameraKickZoom') } })
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
  expect(hash(source)).toBe(hash('3D Cinema 2.0 Crate/oyes.glb'))
})

it('builds the core, three ruled bands with beat-chased ticks, halo, dome and two star layers', async () => {
  const s = await setup()
  s.step()
  expect(s.controller.inspect()).toMatchObject({ bands: 3, ticksPerBand: 32, starLayers: 2, morphTargets: 3 })
  for (const name of ['glyph-core', 'glyph-core-halo', 'inner-glyph-band', 'middle-glyph-band', 'outer-glyph-band', 'distant-ambient-backdrop', 'glyph-starfield-far', 'glyph-starfield-near']) {
    expect(s.scene.getObjectByName(name), name).toBeDefined()
  }
  s.controller.dispose()
})

it('moves: bands turn and rock with the beat clock, the core breathes, and every motion switch holds it', async () => {
  const s = await setup()
  s.step()
  const band = s.scene.getObjectByName('middle-glyph-band')!
  const start = band.matrixWorld.clone()
  const core = s.scene.getObjectByName('glyph-core') as THREE.Group
  const mesh = s.scene.getObjectByName('original-glyph-sphere')!.children[0] as THREE.Mesh
  const morph = [...mesh.morphTargetInfluences!]
  for (let i = 0; i < 30; i += 1) s.step()
  expect(band.matrixWorld.elements).not.toEqual(start.elements)
  expect(core.rotation.y).toBeGreaterThan(0)
  expect(mesh.morphTargetInfluences).not.toEqual(morph)
  // Zero spin and wobble: the ring holds still; zero breath: the slats hold.
  s.values.motionRate = 0; s.values.bandWobble = 0; s.values.coreBreath = 0
  s.step()
  const held = band.matrixWorld.clone()
  for (let i = 0; i < 10; i += 1) s.step()
  expect(band.matrixWorld.elements).toEqual(held.elements)
  expect([...mesh.morphTargetInfluences!]).toEqual([0, 0, 0])
  s.controller.dispose()
})

it('holds still while playback is paused', async () => {
  const s = await setup()
  for (let i = 0; i < 20; i += 1) s.step()
  s.step('high', false)
  const band = s.scene.getObjectByName('outer-glyph-band')!
  const held = band.matrixWorld.clone()
  for (let i = 0; i < 20; i += 1) s.step('high', false)
  expect(band.matrixWorld.elements).toEqual(held.elements)
  s.controller.dispose()
})

it('honours lighting and intensity zeros, spreads the rings, and recolours the palette', async () => {
  const s = await setup()
  s.step()
  const ticks = s.scene.getObjectByName('armillary-index-ticks')!
  const joints = s.scene.getObjectByName('armillary-joint-lights')!
  const halo = s.scene.getObjectByName('glyph-core-halo')!
  expect(ticks.visible && joints.visible && halo.visible).toBe(true)
  s.values.tickLighting = 0; s.values.jointLighting = 0; s.values.halo = 0
  s.step()
  expect(ticks.visible).toBe(false); expect(joints.visible).toBe(false); expect(halo.visible).toBe(false)
  const ring = s.scene.getObjectByName('outer-glyph-band')!
  const before = ring.scale.x
  s.values.bandSpread = 1.25
  s.step()
  expect(ring.scale.x).toBeGreaterThan(before)
  const glyphs = (ring.children.find(child => (child as THREE.Mesh).isMesh === undefined && child.userData.lightingFamily === 'outer-glyph-band') as THREE.Group).children[0] as THREE.Mesh
  const material = glyphs.material as THREE.MeshBasicMaterial
  const red = material.color.r
  s.values.outerColor = [1, 0, 0, 1]
  s.step()
  expect(material.color.r).toBeGreaterThan(material.color.g * 3)
  expect(material.color.r).not.toBe(red)
  s.values.intensity = 0
  s.step()
  expect(s.scene.getObjectByName('Glyph Armillary')!.visible).toBe(false)
  s.controller.dispose()
})

it('draws no stars on the low tier, fewer on medium, and rebuilds them without leaking', async () => {
  const s = await setup()
  const count = () => ['glyph-starfield-far', 'glyph-starfield-near'].reduce((sum, name) => sum + ((s.scene.getObjectByName(name) as THREE.Points | undefined)?.geometry.getAttribute('position').count ?? 0), 0)
  s.step('high'); const high = count()
  s.step('medium'); const medium = count()
  s.step('low')
  expect(high).toBeGreaterThan(medium)
  expect(medium).toBeGreaterThan(0)
  expect(s.scene.getObjectByName('glyph-starfield-far')).toBeUndefined()
  s.controller.dispose()
})

it('owns its procedural resources and leaves the source geometry alone on disposal', async () => {
  const s = await setup()
  s.step()
  let sourceDisposed = false
  s.sourceGeometry.addEventListener('dispose', () => { sourceDisposed = true })
  const halo = s.scene.getObjectByName('glyph-core-halo') as THREE.Mesh
  let ownedDisposed = false
  halo.geometry.addEventListener('dispose', () => { ownedDisposed = true })
  s.controller.dispose()
  expect(ownedDisposed).toBe(true)
  expect(sourceDisposed).toBe(false)
  expect(s.scene.getObjectByName('Glyph Armillary')).toBeUndefined()
})
