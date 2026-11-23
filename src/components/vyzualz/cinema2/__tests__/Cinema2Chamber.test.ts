import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CINEMA2_CHAMBER_PRESET_MANIFEST as manifest } from '../presets/Cinema2ChamberPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'

describe('CHAMBER source GLB preservation', () => {
  it('compiles and validates its original asset instance', () => {
    const result = compileCinema2NativePreset(manifest)
    if (!result.ok) throw new Error(result.diagnostics.map(entry => entry.message).join('\n'))
    expect(cinema2NativeModuleRegistry.validateModules(manifest.modules!).diagnostics).toEqual([])
    expect(cinema2NativeEffectRegistry.validateEffects(manifest.effects ?? []).diagnostics).toEqual([])
    expect(manifest.modules![0]!.config).toMatchObject({
      instances: [{ asset: 'cinema2-chamber', node: 'chamber-room', preserveMaterials: true, spin: false }],
      hdr: true,
    })
    expect(manifest.modules![0]!.config!.instances).toHaveLength(1)
  })

  it('keeps the source materials and embedded texture, including authored emission', () => {
    const glb = readFileSync(new URL('../../../../../public/cinema2/models/chamber.glb', import.meta.url))
    const asset = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()) as {
      materials: { name: string; emissiveFactor?: number[]; pbrMetallicRoughness?: { roughnessFactor?: number } }[]
      images: { bufferView: number; mimeType: string }[]
      meshes: unknown[]
    }
    expect(asset.meshes).toHaveLength(23)
    expect(asset.materials).toHaveLength(10)
    expect(asset.materials.find(material => material.name === 'White')?.emissiveFactor).toEqual([1, 1, 1])
    expect(asset.materials.find(material => material.name === 'Turquoise')?.emissiveFactor).toEqual([0, 1, 1])
    expect(asset.materials.find(material => material.name === 'blue_metal_grey')?.pbrMetallicRoughness?.roughnessFactor).toBeLessThan(.13)
    expect(asset.images).toEqual([{ bufferView: expect.any(Number), mimeType: 'image/png' }])
    // The viewer's reflection strength is a control; no GLB material property is overridden by the manifest.
    expect(manifest.modules![0]!.parameters!.environmentIntensity).toBe(.015)
    expect(Object.keys(manifest.modules![0]!.parameters!).filter(name => /roughness|metalness|emissiveIntensity|color$/i.test(name) && !/Color$/.test(name))).toEqual([])
  })

  it('handles viewer light and highlights without recoloring or replacing source surfaces', () => {
    expect(manifest.effects!.map(effect => effect.typeId)).toEqual(['hdr-bloom', 'cinematic-finish'])
    expect(manifest.effects![1]!.parameters).toMatchObject({ exposure: 1, contrast: 1, saturation: 1, temperature: 0, tint: 0, tintAmount: 0, grain: 0, aberration: 0 })
    expect(manifest.lighting!.lights.find(light => light.type === 'ambient')!.intensity).toBeLessThan(.05)
    expect(manifest.lighting!.lights.some(light => light.type === 'directional')).toBe(false)
    expect(manifest.render!.passes.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen', 'output'])
    expect(manifest.scene!.nodes.filter(node => node.kind === 'module')).toHaveLength(1)
    expect(manifest.scene!.nodes.find(node => node.id === 'chamber-room')?.transform).toEqual({ position: [0, 438.02, -446.92] })
  })
})

import { cinema2Ref } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CHAMBER_PRESET_ID, chamberParameterId } from '../presets/Cinema2ChamberPreset'
import { Cinema2ChamberController } from '../modules/Cinema2ChamberNativeModule'
import { CHAMBER_PALETTE_DEFAULTS } from '../modules/chamber/Cinema2ChamberPalette'
import {
  CHAMBER_BEACON_CELLS, CHAMBER_LAMP_CELLS, CHAMBER_RING_CELLS, CHAMBER_TICK_CELLS, CINEMA2_CHAMBER_PATTERN_IDS, evaluateChamberPattern,
} from '../modules/chamber/Cinema2ChamberPatterns'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { loadChamberScene } from './support/ChamberFixture'
import { describeMoodMigration } from './support/describeMoodMigration'
import { moodMusic } from './support/MoodMigrationHarness'

const byLabel = (label: string) => manifest.parameters!.find(parameter => parameter.label === label)!
const defaults: Record<string, unknown> = Object.fromEntries(manifest.parameters!.map(parameter => [parameter.id, parameter.defaultValue]))

describe('CHAMBER controls', () => {
  it('exposes the standard Master Controls, Pattern controls, an Emission and Lights group, a Camera group, effects and a palette', () => {
    expect(manifest.id).toBe(CINEMA2_CHAMBER_PRESET_ID); expect(manifest.revision).toBe(5)
    expect(byLabel('BPM Sync')).toMatchObject({ type: 'boolean', designParentGroup: 'master-controls', defaultValue: true })
    expect(byLabel('Intensity')).toMatchObject({ designParentGroup: 'master-controls', defaultValue: 1 })
    expect(byLabel('Pattern')).toMatchObject({ type: 'enum', designParentGroup: 'design', group: 'Pattern' })
    expect((byLabel('Pattern').options as readonly unknown[]).length).toBeGreaterThanOrEqual(6)
    expect(byLabel('Pattern Change')).toMatchObject({ type: 'boolean', defaultValue: false, group: 'Pattern' })
    expect(byLabel('Trigger')).toMatchObject({ type: 'enum', group: 'Pattern', visibleWhen: [expect.objectContaining({ parameterId: chamberParameterId('patternChange'), value: true })] })
    for (const label of ['Platform Ring', 'Floor Ticks', 'Corner Beacons', 'Arm Lamps', 'Core Lamp']) expect(manifest.parameters!.find(p => p.label === label && p.group === 'Emission'), label).toBeTruthy()
    for (const label of ['Floor Pool', 'Platform Glow', 'Device Glow', 'Window Spill', 'Rim Light', 'Ambient Fill', 'Reflections']) expect(manifest.parameters!.find(p => p.label === label && p.group === 'Lights'), label).toBeTruthy()
    expect(['Camera Mode', 'View Motion Speed', 'Camera Heading', 'Camera Elevation', 'Camera Distance', 'Field of View'].map(label => byLabel(label).group)).toEqual(Array(6).fill('Camera'))
    expect(['Bloom', 'Exposure', 'Vignette'].map(label => byLabel(label).designParentGroup)).toEqual(['effects', 'effects', 'effects'])
    expect(manifest.parameters!.filter(p => p.type === 'color' && p.designParentGroup === 'palette').length).toBeGreaterThanOrEqual(4)
  })

  it('declares no control without a reader: the module, a light, an effect or the camera', () => {
    const refs = new Set([
      ...Object.values(manifest.modules![0]!.parameterBindings!), ...Object.values(manifest.cameras![0]!.controls!),
      ...manifest.effects!.flatMap(effect => Object.values(effect.parameterBindings ?? {})), ...manifest.lighting!.lights.flatMap(light => Object.values(light.controls ?? {})),
    ].map(ref => (ref as { $ref: string }).$ref))
    for (const parameter of manifest.parameters!) expect(refs.has(parameter.id as string), parameter.label).toBe(true)
  })

  it('starts every light at its authored level, so the defaults are the original look', () => {
    const light = (id: string) => manifest.lighting!.lights.find(entry => entry.id === id)!
    for (const [id, name] of [['chamber-floor-pool', 'floorPool'], ['chamber-device', 'deviceGlow'], ['chamber-platform', 'platformGlow'], ['chamber-left-spill', 'windowSpill'], ['chamber-rim', 'rim'], ['chamber-fill', 'fill']] as const) {
      expect(light(id).intensity, id).toBe(defaults[chamberParameterId(name) as string]); expect(light(id).controls?.intensity).toEqual(cinema2Ref(chamberParameterId(name)))
    }
    expect(light('chamber-left-spill').controls?.color).toEqual(cinema2Ref(chamberParameterId('spillColor')))
  })
})

describe('CHAMBER light programs', () => {
  it('has eight programs; Standby is the authored level and every other one is different, finite and bounded', () => {
    expect(CINEMA2_CHAMBER_PATTERN_IDS).toHaveLength(8)
    const rest = evaluateChamberPattern('standby', 3.3)
    expect([...rest.ring, ...rest.ticks, ...rest.beacons, ...rest.lamps, rest.core].every(level => level === 1)).toBe(true)
    const signatures = CINEMA2_CHAMBER_PATTERN_IDS.map(id => JSON.stringify(evaluateChamberPattern(id, 5.3)))
    expect(new Set(signatures).size).toBe(8)
    for (const id of CINEMA2_CHAMBER_PATTERN_IDS) for (const beats of [0, .3, 1.7, 4.2, 9.9, 15.5]) {
      const levels = evaluateChamberPattern(id, beats)
      expect(levels.ring).toHaveLength(CHAMBER_RING_CELLS); expect(levels.ticks).toHaveLength(CHAMBER_TICK_CELLS); expect(levels.beacons).toHaveLength(CHAMBER_BEACON_CELLS); expect(levels.lamps).toHaveLength(CHAMBER_LAMP_CELLS)
      for (const level of [...levels.ring, ...levels.ticks, ...levels.beacons, ...levels.lamps, levels.core]) { expect(Number.isFinite(level), id).toBe(true); expect(level, id).toBeGreaterThanOrEqual(0); expect(level, id).toBeLessThanOrEqual(2.2) }
    }
  })

  it('runs a comet round the ring, fills the ring on a build, and alternates the arms', () => {
    const peak = (beats: number) => evaluateChamberPattern('ring-chase', beats).ring.reduce((best, level, index) => level > best.level ? { level, index } : best, { level: 0, index: 0 }).index
    expect(peak(0)).not.toBe(peak(1)); expect(new Set([0, 1, 2, 3].map(peak)).size).toBe(4)
    const lit = (beats: number) => evaluateChamberPattern('charge-ring', beats).ring.filter(level => level > 1).length
    expect(lit(2)).toBeLessThan(lit(8)); expect(lit(8)).toBeLessThan(lit(15))
    const arms = (beats: number) => { const l = evaluateChamberPattern('sentinel-sweep', beats).lamps; return [l.slice(0, 3), l.slice(3)].map(side => side.reduce((a, b) => a + b, 0)) }
    expect(arms(.5)[0]).toBeGreaterThan(arms(.5)[1]!); expect(arms(1.5)[1]).toBeGreaterThan(arms(1.5)[0]!)
  })
})

describe('CHAMBER native module on the real model', () => {
  const library = { THREE } as unknown as Cinema2ThreeLibrary
  async function rig(controls: Record<string, unknown> = {}) {
    const scene = await loadChamberScene(), controller = new Cinema2ChamberController(library)
    controller.attach(scene)
    const values = new Map<string, unknown>(), revisions = new Map<string, number>()
    for (const name of ['bpmSync', 'intensity', 'reactivity', 'autoPerformance', 'armMotion', 'scoreAmount', 'cueCore', 'cueLamps', 'cueRing', 'cueTicks', 'cueBeacons', 'pattern', 'patternChange', 'trigger', 'ringLight', 'tickLight', 'beaconLight', 'lampLight', 'coreLight', 'ringColor', 'tickColor', 'beaconColor', 'lampColor', 'coreColor']) values.set(name, defaults[chamberParameterId(name) as string] ?? (name.startsWith('cue') ? 0 : undefined))
    for (const [name, value] of Object.entries(controls)) values.set(name, value)
    const parameters = { get: (name: string) => values.get(name), getEditRevision: (name: string) => revisions.get(name) ?? 0 }
    const set = (name: string, value: unknown) => { values.set(name, value); revisions.set(name, (revisions.get(name) ?? 0) + 1) }
    // The beat clock starts at elapsed seconds x 120 BPM / 60, so a frame at beats / 2 seconds places it exactly; later frames add nothing.
    const draw = (beats: number) => { controller.update({ frame: { elapsedTimeSec: beats / 2, deltaTimeSec: 0, timestampMs: 0, contextGeneration: 1 }, parameters } as never); controller.beforeDraw() }
    const cells: Record<string, THREE.Mesh[]> = {}
    scene.traverse(object => { const mesh = object as THREE.Mesh; const match = /:(ring|ticks|beacons|lamps):\d+$/.exec(mesh.name); if (mesh.isMesh && match) (cells[match[1]!] ??= []).push(mesh) })
    const meshesBy = (name: string) => { const found: THREE.Mesh[] = []; scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).name === name && !m.name.includes(':')) found.push(m) }); return found }
    const step = (frame: unknown) => { controller.update({ frame, parameters } as never); controller.beforeDraw() }
    return { scene, controller, set, draw, step, cells, meshesBy, pattern: () => controller.inspect().pattern as string }
  }
  const emission = (mesh: THREE.Mesh) => { const m = mesh.material as THREE.MeshStandardMaterial; return m.emissive.clone().multiplyScalar(m.emissiveIntensity) }

  it('splits the glowing meshes into 12 ring arcs, 8 floor ticks, 4 corner beacons, 6 arm lamps and the core-lamp pieces, and hides the originals', async () => {
    const r = await rig(); r.draw(1)
    expect(r.controller.inspect().cells).toEqual({ ring: 12, ticks: 8, beacons: 4, lamps: 6, core: 3 })
    expect(Object.fromEntries(Object.entries(r.cells).map(([family, meshes]) => [family, meshes.length]))).toEqual({ ring: 12, ticks: 8, beacons: 4, lamps: 6 })
    for (const name of ['turquoise_glow', 'blue_screen_glow', 'Turquoise']) for (const mesh of r.meshesBy(name)) expect(mesh.visible, name).toBe(false)
    // Every triangle of the originals is still drawn, once.
    const drawn = (family: string) => r.cells[family]!.reduce((sum, mesh) => sum + mesh.geometry.getAttribute('position').count / 3, 0)
    expect(drawn('ring')).toBe(104); expect(drawn('beacons')).toBe(72); expect(drawn('ticks') + drawn('lamps')).toBe(496)
  })

  it('reproduces the file\'s own emission at the defaults, and leaves every other surface alone', async () => {
    const r = await rig(); r.draw(3.3)
    const before = await loadChamberScene()
    const authored = (name: string) => { const found: THREE.MeshStandardMaterial[] = []; before.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).name === name) found.push(m.material as THREE.MeshStandardMaterial) }); return found[0]! }
    for (const [family, name] of [['ring', 'turquoise_glow'], ['ticks', 'Turquoise'], ['beacons', 'blue_screen_glow'], ['lamps', 'Turquoise']] as const) {
      const expected = authored(name).emissive.clone().multiplyScalar(authored(name).emissiveIntensity)
      for (const mesh of r.cells[family]!) { const got = emission(mesh); expect(got.r).toBeCloseTo(expected.r, 5); expect(got.g).toBeCloseTo(expected.g, 5); expect(got.b).toBeCloseTo(expected.b, 5) }
    }
    const room = authored('blue_metal_grey'); let checked = 0
    r.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).name === 'blue_metal_grey') { const material = m.material as THREE.MeshStandardMaterial; expect(material.color.equals(room.color)).toBe(true); expect(material.emissiveIntensity).toBe(room.emissiveIntensity); checked++ } })
    expect(checked).toBeGreaterThan(0)
  })

  it('scales all emission with Intensity and each family with its own control, and recolors a family from the palette', async () => {
    const r = await rig(); r.draw(1)
    const total = () => Object.values(r.cells).flat().reduce((sum, mesh) => { const e = emission(mesh); return sum + e.r + e.g + e.b }, 0)
    const base = total(); expect(base).toBeGreaterThan(0)
    r.set('intensity', 0); r.draw(1); expect(total()).toBe(0)
    r.set('intensity', 2); r.draw(1); expect(total()).toBeCloseTo(base * 2, 4)
    r.set('intensity', 1); r.set('ringLight', 0); r.draw(1)
    expect(r.cells.ring!.every(mesh => emission(mesh).g === 0)).toBe(true); expect(r.cells.ticks!.every(mesh => emission(mesh).g > 0)).toBe(true)
    r.set('ringLight', 1); r.set('tickColor', [1, 0, 0, 1]); r.draw(1)
    const tick = emission(r.cells.ticks![0]!); expect(tick.r).toBeGreaterThan(0); expect(tick.g).toBe(0)
    expect(emission(r.cells.beacons![0]!).g).toBeGreaterThan(0)
  })

  it('plays a program on the cells, takes a manual pick at once and eases in a changed program', async () => {
    const r = await rig({ pattern: 'ring-chase' }); r.draw(2)
    const levels = () => r.cells.ring!.map(mesh => (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity)
    const chase = levels(); expect(Math.max(...chase) - Math.min(...chase)).toBeGreaterThan(.5)
    const direct = await rig({ pattern: 'countdown' }); direct.draw(2)
    r.set('pattern', 'countdown'); r.draw(2)
    expect(r.cells.ticks!.map(mesh => (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity)).toEqual(direct.cells.ticks!.map(mesh => (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity))
  })

  it('restores the original meshes and releases its own on dispose', async () => {
    const r = await rig(); r.draw(1)
    const own = Object.values(r.cells).flat(); let disposed = 0; own.forEach(mesh => mesh.geometry.addEventListener('dispose', () => { disposed++ }))
    r.controller.dispose()
    expect(disposed).toBe(own.length)
    for (const name of ['turquoise_glow', 'blue_screen_glow', 'Turquoise']) for (const mesh of r.meshesBy(name)) expect(mesh.visible, name).toBe(true)
  })
})

describe('CHAMBER camera', () => {
  const compiled = compileCinema2NativePreset(manifest)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const rig = () => {
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: target => target.parameterId ? state.getValue(target.parameterId) : target.authoredBaseValue })
    const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver))
    const frame = (time: number, bpm = 120) => ({ frameId: Math.round(time * 30) + 1, timestampMs: time * 1000, elapsedTimeSec: time, deltaTimeSec: 1 / 30, contextGeneration: 1, viewport: { width: 1280, height: 720, dpr: 1 }, audio: null, director: null,
      transport: { sourcePresent: true, playing: true, paused: false, animationActive: true, timeSec: time, bpm } }) as never
    const run = (from: number, to: number, bpm = 120) => { let last = camera.update(frame(from, bpm)); for (let t = from + 1 / 30; t <= to + 1e-6; t += 1 / 30) last = camera.update(frame(t, bpm)); return last }
    const set = (name: string, value: unknown) => state.setPersistentValue(chamberParameterId(name) as never, value as never)
    return { camera, state, run, set }
  }

  it('keeps the approved framing by default, drifts round the platform on request, and holds with speed zero', () => {
    const home = rig(); home.camera.reset()
    expect(home.run(0, 9).position).toEqual([0, 3.6, 8])
    const drift = rig(); drift.set('cameraMode', 'drift'); drift.camera.reset()
    const moved = drift.run(0, 10).position
    expect(Math.abs(moved[0]!)).toBeGreaterThan(1); expect(Math.hypot(moved[0]! , moved[2]! + .3)).toBeCloseTo(8.3, 0)
    const held = rig(); held.set('cameraMode', 'drift'); held.set('cameraSpeed', 0); held.camera.reset()
    expect(held.run(0, 10).position[0]).toBeCloseTo(0, 6)
  })

  it('locks the drift to the track tempo with BPM Sync on, and keeps every drift and manual view inside the safety box', () => {
    const at = (bpm: number, sync: boolean) => { const r = rig(); r.set('cameraMode', 'drift'); r.set('bpmSync', sync); r.camera.reset(); return r.run(0, 8, bpm).position[0]! }
    expect(Math.abs(at(60, true))).toBeLessThan(Math.abs(at(120, true)))
    expect(at(60, false)).toBeCloseTo(at(120, false), 1)
    const manual = (heading: number, elevation: number, distance: number) => { const r = rig(); r.set('cameraMode', 'manual'); r.set('cameraHeading', heading); r.set('cameraElevation', elevation); r.set('cameraDistance', distance); r.camera.reset(); return r.run(0, .2).position }
    for (const heading of [-60, 0, 60]) for (const elevation of [-10, 40]) for (const distance of [6, 9.4]) {
      const p = manual(heading, elevation, distance)
      expect(p[0]!).toBeGreaterThanOrEqual(-9 - 1e-6); expect(p[0]!).toBeLessThanOrEqual(9 + 1e-6); expect(p[1]!).toBeGreaterThanOrEqual(1.2 - 1e-6); expect(p[1]!).toBeLessThanOrEqual(8.4 + 1e-6); expect(p[2]!).toBeLessThanOrEqual(9.6 + 1e-6)
    }
    expect(Math.abs(manual(40, 0, 8.3)[0]!)).toBeGreaterThan(3); expect(manual(0, 30, 8.3)[1]!).toBeGreaterThan(5.5)
  })
})

describe('CHAMBER audio, choreography and Auto Performance', () => {
  it('has Audio Reactivity, Zoom on Kick and Auto Performance (off) in Master Controls, and a kick punch that only changes the lens', () => {
    expect(byLabel('Audio Reactivity')).toMatchObject({ designParentGroup: 'master-controls', defaultValue: .65, min: 0, max: 1 })
    expect(byLabel('Zoom on Kick')).toMatchObject({ type: 'boolean', designParentGroup: 'master-controls', defaultValue: true })
    expect(byLabel('Auto Performance')).toMatchObject({ type: 'boolean', designParentGroup: 'master-controls', defaultValue: false })
    const camera = manifest.cameras![0]!
    expect(camera.motion!.tempo).toMatchObject({ punch: 1.6 }); expect(camera.motion!.tempo!.weave ?? 0).toBe(0); expect(camera.controls!.kickZoom).toEqual(cinema2Ref(chamberParameterId('zoomOnKick')))
  })

  it('routes the bands, the voice, kick, snare, downbeat and drop to real controls and lights, scaled by Audio Reactivity', () => {
    const rules = manifest.choreography!.rules
    const strength = cinema2Ref(chamberParameterId('reactivity'))
    expect(rules.filter(rule => rule.id.startsWith('chamber-') && !rule.id.includes('-mood-') && !rule.id.includes('-drive-')).every(rule => (rule.strengthParameter as { $ref: string } | undefined)?.$ref === (strength as { $ref: string }).$ref)).toBe(true)
    const targets = new Set(rules.flatMap(rule => rule.actions.map(action => { const t = action.target as { kind: string; property?: string }; return `${t.kind}:${t.property}` })))
    for (const expected of ['module:ringLight', 'module:lampLight', 'module:tickLight', 'module:beaconLight', 'module:coreLight', 'light:intensity', 'effect:intensity', 'light-group:intensity']) expect(targets.has(expected), expected).toBe(true)
    expect(manifest.lighting!.groups!.map(group => group.id)).toEqual(['chamber-floor-lights', 'chamber-room-lights'])
    expect(rules.some(rule => rule.actions.some(action => (action.target as { stagger?: unknown }).stagger))).toBe(true)
  })

  const rigged = async (controls: Record<string, unknown>) => {
    const scene = await loadChamberScene(), controller = new Cinema2ChamberController({ THREE } as unknown as Cinema2ThreeLibrary); controller.attach(scene)
    const values = new Map<string, unknown>(); for (const parameter of manifest.parameters!) values.set(String(parameter.id).replace(/^chamber-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), parameter.defaultValue)
    for (const [name, value] of Object.entries(controls)) values.set(name, value)
    const parameters = { get: (name: string) => values.get(name), getEditRevision: () => 0 }
    return { controller, step: (frame: unknown) => controller.update({ frame, parameters } as never), set: (name: string, value: unknown) => values.set(name, value), pattern: () => controller.inspect().pattern as string }
  }
  const quiet = (music: ReturnType<typeof moodMusic>, count: number, rig: Awaited<ReturnType<typeof rigged>>, extra: Parameters<ReturnType<typeof moodMusic>['next']>[0] = {}) => { for (let i = 0; i < count; i++) rig.step(music.next({ energy: .8, ...extra })) }

  it('puts Charge Ring on stage for a build and returns to the authored Pattern, never rewriting the saved one', async () => {
    const rig = await rigged({ autoPerformance: true, pattern: 'core-breath', reactivity: 1 }), music = moodMusic()
    quiet(music, 20, rig); expect(rig.pattern()).toBe('core-breath')
    for (let i = 0; i < 90; i++) rig.step(music.next({ energy: .8, build: Math.min(.9, i / 40) }))
    expect(rig.pattern(), 'a build is on stage').toBe('charge-ring')
    quiet(music, 500, rig); expect(rig.pattern(), 'the authored Pattern resumes').toBe('core-breath')
  })

  it('puts Lockdown Flash on stage on a drop and then returns to the authored Pattern', async () => {
    const rig = await rigged({ autoPerformance: true, pattern: 'countdown', reactivity: 1 }), music = moodMusic()
    quiet(music, 20, rig); expect(rig.pattern()).toBe('countdown')
    for (let i = 0; i < 12; i++) rig.step(music.next({ energy: 1, bass: 1, event: 'drop', eventId: 900 + i, build: 0 }))
    expect(rig.pattern(), 'the drop is on stage').toBe('lockdown-flash')
    quiet(music, 700, rig); expect(rig.pattern(), 'the authored Pattern resumes').toBe('countdown')
  })

  it('leaves the pattern alone with Auto Performance off, however the music builds and drops', async () => {
    const rig = await rigged({ autoPerformance: false, pattern: 'sentinel-sweep' }), music = moodMusic()
    quiet(music, 20, rig)
    for (let i = 0; i < 90; i++) rig.step(music.next({ energy: .8, build: Math.min(.9, i / 40) }))
    for (let i = 0; i < 12; i++) rig.step(music.next({ energy: 1, bass: 1, event: 'drop', eventId: 900 + i }))
    expect(rig.pattern()).toBe('sentinel-sweep')
  })
})

const SCENE = 'chamber-scene'
describeMoodMigration('CHAMBER', [{
  name: 'Chamber performance', manifest, auto: chamberParameterId('autoPerformance'), strength: chamberParameterId('reactivity'),
  pattern: { patternChange: chamberParameterId('patternChange'), trigger: chamberParameterId('trigger') },
  up: [[SCENE, 'ringLight'], [SCENE, 'lampLight'], ['chamber-source-bloom', 'intensity']],
  down: [[SCENE, 'lampLight'], [SCENE, 'intensity']],
  shock: [[SCENE, 'beaconLight']],
}])

describe('CHAMBER device, kick ripple and atmosphere', () => {
  const library = { THREE } as unknown as Cinema2ThreeLibrary
  async function rig(controls: Record<string, unknown> = {}) {
    const scene = await loadChamberScene(), controller = new Cinema2ChamberController(library); controller.attach(scene)
    const values = new Map<string, unknown>([['bpmSync', true], ['intensity', 1], ['armMotion', 1], ['scoreAmount', .5], ['pattern', 'standby'], ['patternChange', false], ['trigger', 'bar4']])
    for (const [name, value] of Object.entries(controls)) values.set(name, value)
    const parameters = { get: (name: string) => values.get(name), getEditRevision: () => 0 }
    const draw = (beats: number) => { controller.update({ frame: { elapsedTimeSec: beats / 2, deltaTimeSec: 0, timestampMs: 0, contextGeneration: 1 }, parameters } as never); controller.beforeDraw(); scene.updateMatrixWorld(true) }
    const set = (name: string, value: unknown) => values.set(name, value)
    const named = (match: RegExp) => { const found: THREE.Object3D[] = []; scene.traverse(o => { if (match.test(o.name)) found.push(o) }); return found }
    return { scene, controller, draw, set, named }
  }

  it('hangs the two arms from pivots and keeps every triangle of the device, once', async () => {
    const r = await rig(); r.draw(1)
    expect(r.controller.inspect().arms).toBe(2)
    expect(r.named(/^chamber-arm:/).map(o => o.name)).toEqual(['chamber-arm:left', 'chamber-arm:right'])
    const triangles = (match: RegExp) => r.named(match).reduce((sum, o) => sum + ((o as THREE.Mesh).geometry.getAttribute('position').count / 3), 0)
    // Object_6 has 1688 triangles; its body and arm parts together are exactly those.
    expect(triangles(/^Object_6:(body|left-arm|right-arm)$/)).toBe(1688)
    // Object_6 is the arms' own housings, so half its triangles hang from each arm.
    expect(triangles(/^Object_6:left-arm$/)).toBe(844); expect(triangles(/^Object_6:right-arm$/)).toBe(844)
    for (const mesh of r.named(/^Object_6$/)) expect(mesh.visible).toBe(false)
  })

  it('leaves the arms exactly where the model has them in Standby, swings them in the other programs, and scales the swing with Arm Motion', async () => {
    const standby = await rig(), plain = await loadChamberScene(); plain.updateMatrixWorld(true)
    standby.draw(3.7)
    // At rest a body or arm piece is placed exactly like the original mesh it came from.
    const original = plain.getObjectByName('Object_6')!, piece = standby.named(/^Object_6:right-arm$/)[0]!
    const worldOf = (o: THREE.Object3D) => { const v = new THREE.Vector3(); (o as THREE.Mesh).geometry.computeBoundingBox(); (o as THREE.Mesh).geometry.boundingBox!.getCenter(v); return v.applyMatrix4(o.matrixWorld) }
    const rest = worldOf(piece)
    const originalBox = new THREE.Box3().setFromObject(original), inside = originalBox.expandByScalar(1e-3).containsPoint(rest)
    expect(inside).toBe(true)
    const moving = await rig({ pattern: 'sentinel-sweep' }); moving.draw(.9)
    const swung = worldOf(moving.named(/^Object_6:(left|right)-arm$/)[0]!), still = await rig({ pattern: 'sentinel-sweep', armMotion: 0 }); still.draw(.9)
    const held = worldOf(still.named(/^Object_6:(left|right)-arm$/)[0]!), base = await rig(); base.draw(.9)
    const home = worldOf(base.named(/^Object_6:(left|right)-arm$/)[0]!)
    expect(held.distanceTo(home)).toBeLessThan(1e-6)
    expect(Math.max(swung.distanceTo(home), worldOf(moving.named(/^Object_6:(left|right)-arm$/)[1] ?? moving.named(/^Object_6:(left|right)-arm$/)[0]!).distanceTo(worldOf(base.named(/^Object_6:(left|right)-arm$/)[1] ?? base.named(/^Object_6:(left|right)-arm$/)[0]!)))).toBeGreaterThan(.01)
  })

  it('moves the arm lamps with their arm', async () => {
    const r = await rig({ pattern: 'sentinel-sweep' }); r.draw(.9)
    const home = await rig(); home.draw(.9)
    const lamp = (scene: { named: (match: RegExp) => THREE.Object3D[] }) => scene.named(/:lamps:\d$/).map(o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()))
    const moved = lamp(r), at = lamp(home)
    expect(moved.some((position, index) => position.distanceTo(at[index]!) > .01)).toBe(true)
  })

  it('adds the kick ripple per family from its score channel, and silences it with Kick Ripple at zero', async () => {
    const r = await rig(); r.draw(1)
    const ring = () => r.named(/:ring:\d+$/).map(o => ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity)
    const quiet = ring()
    r.set('cueRing', 1); r.draw(1)
    expect(ring().every((level, index) => level > quiet[index]!)).toBe(true)
    r.set('scoreAmount', 0); r.draw(1); expect(ring()).toEqual(quiet)
  })

  it('wires the ripple outward in order, and adds one field of faint dust', () => {
    const delays = ['core', 'lamps', 'ring', 'ticks', 'beacons'].map(name => manifest.choreography!.rules.find(rule => rule.id === `chamber-score-kick-cue-${name}`)!.actions[0]!.delayBeats)
    expect(delays).toEqual([0, .125, .25, .375, .5])
    const particles = manifest.modules![0]!.config!.particles as { count: number; brightness: number }[]
    expect(particles).toHaveLength(1); expect(particles[0]!.count).toBeLessThanOrEqual(200); expect(particles[0]!.brightness).toBeLessThan(.5)
  })

  it('restores the original meshes and removes the arm pivots on dispose', async () => {
    const r = await rig(); r.draw(1); r.controller.dispose()
    expect(r.named(/^chamber-arm:/)).toHaveLength(0)
    expect(r.named(/^Object_(6|7|10|14|20|21|22)$/).every(mesh => mesh.visible)).toBe(true)
  })
})

describe('CHAMBER model slot', () => {
  const library = { THREE } as unknown as Cinema2ThreeLibrary
  const OFFSET = new THREE.Vector3(0, 438.02, -446.92)
  const names = ['bpmSync', 'intensity', 'reactivity', 'autoPerformance', 'pattern', 'patternChange', 'trigger', 'armMotion', 'scoreAmount', 'modelSize', 'modelTilt', 'modelDrift', 'modelLight', 'cueModel']

  /** The real chamber, plus a stand-in for a normalized user model (centered, longest side 2, like the loader makes it). */
  async function rig(controls: Record<string, unknown> = {}, assetId = 'user-model:test:1', dims: readonly [number, number, number] = [4, 2, 1]) {
    const scene = await loadChamberScene(), controller = new Cinema2ChamberController(library)
    controller.attach(scene)
    const model = new THREE.Group(); model.name = 'Cinema2UserModel'
    const box = new THREE.Mesh(new THREE.BoxGeometry(...dims), new THREE.MeshStandardMaterial()); model.add(box)
    model.scale.setScalar(2 / Math.max(...dims))
    controller.attach(model, true, [], assetId)
    const values = new Map<string, unknown>([['bpmSync', true], ['intensity', 1], ['armMotion', 1], ['scoreAmount', .5], ['pattern', 'standby'], ['patternChange', false], ['trigger', 'bar4'], ['modelSize', 1], ['modelTilt', 1], ['modelDrift', 1], ['cueModel', 0]])
    for (const [name, value] of Object.entries(controls)) values.set(name, value)
    const parameters = { get: (name: string) => values.get(name), getEditRevision: () => 0 }
    // The beat clock starts at elapsed seconds x 120 BPM / 60, so a frame at beats / 2 seconds places it exactly.
    const draw = (beats: number) => { controller.update({ frame: { elapsedTimeSec: beats / 2, deltaTimeSec: 0, timestampMs: 0, contextGeneration: 1 }, parameters } as never); controller.beforeDraw(); model.updateMatrixWorld(true) }
    // Frames that let time pass (0.1 s steps; the first call places the clock exactly), for tests that need the beat position to move.
    let seconds = 0, stamp = 0, started = false
    const run = (beats: number) => {
      const target = beats / 2
      const frame = (dt: number) => { controller.update({ frame: { elapsedTimeSec: seconds, deltaTimeSec: dt, timestampMs: stamp, contextGeneration: 1 }, parameters } as never); controller.beforeDraw(); model.updateMatrixWorld(true) }
      if (!started) { started = true; seconds = target; stamp = seconds * 1000; frame(0); return }
      while (seconds < target - 1e-9) { const dt = Math.min(.1, target - seconds); seconds += dt; stamp += dt * 1000; frame(dt) }
    }
    const corners = () => {
      const geometry = box.geometry as THREE.BoxGeometry; geometry.computeBoundingBox()
      const b = geometry.boundingBox!
      return [b.min.x, b.max.x].flatMap(x => [b.min.y, b.max.y].flatMap(y => [b.min.z, b.max.z].map(z => new THREE.Vector3(x, y, z).applyMatrix4(box.matrixWorld))))
    }
    const set = (name: string, value: unknown) => values.set(name, value)
    return { scene, controller, model, draw, run, corners, set, names }
  }

  it('declares a model slot the way Bass Sigil does: a hidden Model parameter bound as userModel, a slot with no scene node, and three controls', () => {
    const module = manifest.modules![0]!
    expect(module.config!.userModel).toEqual({ node: null, neutralFloor: false, spin: false })
    expect(module.parameterBindings!.userModel).toEqual(cinema2Ref(chamberParameterId('model')))
    expect(module.parameters!.userModel).toBe('default-model')
    expect(byLabel('Model')).toMatchObject({ type: 'string', defaultValue: 'default-model', exposure: 'hidden', modulatable: false })
    expect(byLabel('Model Size')).toMatchObject({ type: 'float', designParentGroup: 'master-controls', defaultValue: 1, min: .5, max: 1.5 })
    expect(byLabel('Model Tilt')).toMatchObject({ type: 'float', designParentGroup: 'design', group: 'Model', defaultValue: 1, min: 0 })
    expect(byLabel('Model Drift')).toMatchObject({ type: 'float', designParentGroup: 'design', group: 'Model', defaultValue: 1, min: 0 })
    for (const name of ['modelSize', 'modelTilt', 'modelDrift']) expect(module.parameterBindings![name]).toEqual(cinema2Ref(chamberParameterId(name)))
    expect(compileCinema2NativePreset(manifest).ok).toBe(true)
    // The chamber itself is unchanged: still one instance of its own asset.
    expect(module.config!.instances).toHaveLength(1)
  })

  it('leaves the middle empty with no model chosen, and the chamber exactly as it was', async () => {
    const r = await rig({}, 'user-model-default'); r.draw(3)
    expect(r.model.visible).toBe(false)
    expect(r.controller.inspect()).toMatchObject({ modelPlaced: false, modelPose: null, cells: { ring: 12, ticks: 8, beacons: 4, lamps: 6, core: 3 } })
  })

  it('stands the model in the middle of the structure at the size asked for, between the platform and the lamp under the device', async () => {
    const r = await rig(); r.draw(4)
    const box = new THREE.Box3(); for (const corner of r.corners()) box.expandByPoint(corner)
    const center = box.getCenter(new THREE.Vector3())
    expect(Math.abs(center.x)).toBeLessThan(.3); expect(Math.abs(center.z)).toBeLessThan(.3); expect(center.y).toBeGreaterThan(2.8); expect(center.y).toBeLessThan(3.4)
    // The box is 4 x 2 x 1, normalized to a longest side of 2, then scaled to fill the space in the middle of the chamber (8.8 wide, 3.2 tall): 8.8 wide would be 4.4 tall, so its height limits it.
    r.set('modelTilt', 0); r.set('modelDrift', 0); r.draw(5)
    const still = new THREE.Box3(); for (const corner of r.corners()) still.expandByPoint(corner)
    expect(still.getSize(new THREE.Vector3()).x).toBeCloseTo(6.4, 3); expect(still.getSize(new THREE.Vector3()).y).toBeCloseTo(3.2, 3); expect(still.getCenter(new THREE.Vector3()).y).toBeCloseTo(3.1, 3)
    r.set('modelSize', 1.5); r.draw(5)
    const large = new THREE.Box3(); for (const corner of r.corners()) large.expandByPoint(corner)
    expect(large.getSize(new THREE.Vector3()).x).toBeCloseTo(9.6, 3)
    r.set('modelSize', .5); r.draw(5)
    const small = new THREE.Box3(); for (const corner of r.corners()) small.expandByPoint(corner)
    expect(small.getSize(new THREE.Vector3()).x).toBeCloseTo(3.2, 3)
  })

  it('fits each model to the space by its own shape: a wide logo fills the width, a tall one is limited by the height', async () => {
    const extent = async (dims: readonly [number, number, number]) => {
      const r = await rig({ modelTilt: 0, modelDrift: 0 }, 'user-model:test:1', dims); r.draw(5)
      const box = new THREE.Box3(); for (const corner of r.corners()) box.expandByPoint(corner)
      return box.getSize(new THREE.Vector3())
    }
    const wordmark = await extent([6.4, 2, .6]), tall = await extent([1, 3, .3]), square = await extent([2, 2, .5])
    expect(wordmark.x).toBeCloseTo(8.8, 2); expect(wordmark.y).toBeLessThan(3.2)
    expect(tall.y).toBeCloseTo(3.2, 2); expect(tall.x).toBeLessThan(8.8)
    expect(square.y).toBeCloseTo(3.2, 2); expect(square.x).toBeCloseTo(3.2, 2)
  })

  it('eases the lean and turn as a model gets bigger, so its corners do not swing further than a small model\'s', async () => {
    const swing = async (size: number) => {
      const r = await rig({ modelSize: size }); let yaw = 0
      for (let beats = 0; beats <= 40; beats += .5) { r.run(beats); yaw = Math.max(yaw, Math.abs((r.controller.inspect().modelPose as { yaw: number }).yaw)) }
      return yaw
    }
    expect(await swing(.5)).toBeGreaterThan(await swing(1))
    expect(await swing(1)).toBeGreaterThan(await swing(1.5) - 1e-9)
  })

  it('tilts and moves slightly, never turning right round, and stays inside the structure through a long run of beats', async () => {
    const chamber = await loadChamberScene(); chamber.updateMatrixWorld(true)
    const ring = new THREE.Box3(), lamps = new THREE.Box3()
    chamber.traverse(object => { const mesh = object as THREE.Mesh; if (!mesh.isMesh) return; const material = (mesh.material as THREE.Material).name; if (material === 'turquoise_glow') ring.expandByObject(mesh); if (material === 'White_0') lamps.expandByObject(mesh) })
    ring.translate(OFFSET); lamps.translate(OFFSET)
    const platformTop = ring.max.y, lampBottom = lamps.min.y, radius = Math.min(ring.getSize(new THREE.Vector3()).x, ring.getSize(new THREE.Vector3()).z) / 2
    const r = await rig()
    let minYaw = Infinity, maxYaw = -Infinity, travel = 0, last: THREE.Vector3 | null = null
    for (let beats = 0; beats <= 200; beats += .25) {
      r.run(beats)
      const pose = r.controller.inspect().modelPose as { position: [number, number, number]; yaw: number; pitch: number; roll: number }
      minYaw = Math.min(minYaw, pose.yaw); maxYaw = Math.max(maxYaw, pose.yaw)
      expect(Math.abs(pose.pitch)).toBeLessThan(.15); expect(Math.abs(pose.roll)).toBeLessThan(.17)
      const here = new THREE.Vector3(...pose.position); if (last) travel = Math.max(travel, here.distanceTo(last)); last = here
      for (const corner of r.corners()) {
        expect(corner.y).toBeGreaterThan(platformTop + .05); expect(corner.y).toBeLessThan(lampBottom - .05)
        // Wide as the middle of the structure allows, but clear of the pillars at the sides and well inside the room.
        expect(Math.abs(corner.x)).toBeLessThan(4.2); expect(Math.hypot(corner.x, corner.z)).toBeLessThan(radius * 3)
      }
    }
    // It leans and turns about 13 degrees either way at this size (eased from 24 for a small model, so a big one's corners do not swing far): it really moves, and never anywhere near a half turn.
    expect(maxYaw).toBeGreaterThan(.15); expect(minYaw).toBeLessThan(-.15); expect(maxYaw).toBeLessThan(.45); expect(minYaw).toBeGreaterThan(-.45)
    // And it moves smoothly: no jump between quarter-beat frames.
    expect(travel).toBeLessThan(.1)
  })

  it('holds still at Model Tilt 0 and Model Drift 0, and follows each control on its own', async () => {
    const r = await rig({ modelTilt: 0, modelDrift: 0 })
    const pose = (beats: number) => { r.run(beats); return JSON.stringify(r.controller.inspect().modelPose) }
    expect(pose(3)).toBe(pose(11.7))
    r.set('modelTilt', 1); r.draw(3); const leaned = r.controller.inspect().modelPose as { position: number[]; yaw: number }
    expect(leaned.yaw).not.toBe(0); expect(leaned.position).toEqual([0, 3.1, 0])
    r.set('modelTilt', 0); r.set('modelDrift', 1); r.draw(3); const floated = r.controller.inspect().modelPose as { position: number[]; yaw: number; pitch: number; roll: number }
    expect(floated.yaw).toBeCloseTo(0, 9); expect(floated.pitch).toBeCloseTo(0, 9); expect(floated.roll).toBeCloseTo(0, 9); expect(floated.position).not.toEqual([0, 3.1, 0])
  })

  it('follows the beat: BPM-locked and the same at any frame rate, and the kick nods and lifts it', async () => {
    const r = await rig()
    r.draw(6); const rest = r.controller.inspect().modelPose as { position: number[]; pitch: number; scale: number }
    r.draw(6); expect(r.controller.inspect().modelPose).toEqual(rest)
    r.set('cueModel', 1); r.draw(6)
    const kicked = r.controller.inspect().modelPose as { position: number[]; pitch: number; scale: number }
    expect(kicked.position[1]).toBeGreaterThan(rest.position[1]! + .01); expect(kicked.pitch).toBeLessThan(rest.pitch - .02); expect(kicked.scale).toBeGreaterThan(rest.scale)
    // Kick Ripple 0 silences the kick's part (the choreography does not set the cue, and the model ignores it).
    r.set('scoreAmount', 0); r.draw(6); expect(r.controller.inspect().modelPose).toEqual(rest)
  })

  it('lets the model be replaced or removed, and takes it away with the controller', async () => {
    const r = await rig(); r.draw(2)
    expect(r.controller.inspect().modelPlaced).toBe(true)
    const before = JSON.stringify(r.controller.inspect().modelPose)
    r.controller.detach(new THREE.Group()); expect(r.controller.inspect().modelPlaced).toBe(true)
    r.controller.detach(r.model); expect(r.controller.inspect()).toMatchObject({ modelPlaced: false, modelPose: null })
    r.draw(3); expect(r.model.matrixAutoUpdate).toBe(false); expect(JSON.stringify(r.controller.inspect().modelPose)).not.toBe(before)
    const again = await rig(); again.draw(2); again.controller.dispose(); expect(again.controller.inspect().modelPlaced).toBe(false)
  })

  it('lights the model with a light of its own that stays put while the model moves, and has no light at all with no model', async () => {
    const lightsIn = (root: THREE.Object3D) => { const found: THREE.PointLight[] = []; root.traverse(object => { if ((object as THREE.PointLight).isPointLight) found.push(object as THREE.PointLight) }); return found }
    const none = await rig({}, 'user-model-default'); none.draw(3)
    expect(lightsIn(none.model)).toHaveLength(0); expect(lightsIn(none.scene)).toHaveLength(0); expect(none.controller.inspect().modelLight).toBeNull()
    const r = await rig(); r.run(2)
    const worldPosition = () => { const light = lightsIn(r.model)[0]!; r.model.updateMatrixWorld(true); return light.getWorldPosition(new THREE.Vector3()) }
    expect(lightsIn(r.model)).toHaveLength(1)
    const first = worldPosition().clone()
    expect(first.distanceTo(new THREE.Vector3(.6, 3.6, 3.6))).toBeLessThan(1e-4)
    r.run(40); expect(worldPosition().distanceTo(first)).toBeLessThan(1e-4)
    // Model Light is the intensity the manifest lights would give it (intensity x pi x (range / 2)^2), and 0 turns it off.
    const light = lightsIn(r.model)[0]!
    expect(light.intensity).toBeCloseTo(.5 * Math.PI * 3.25 ** 2, 4); expect(light.distance).toBe(6.5); expect(light.decay).toBe(2)
    r.set('modelLight', 0); r.run(41); expect(light.intensity).toBe(0)
    r.set('modelLight', 1.5); r.run(42); expect(light.intensity).toBeCloseTo(1.5 * Math.PI * 3.25 ** 2, 4)
    r.controller.detach(r.model); expect(lightsIn(r.model)).toHaveLength(0)
    const again = await rig(); again.draw(1); again.controller.dispose(); expect(lightsIn(again.model)).toHaveLength(0)
    expect(byLabel('Model Light')).toMatchObject({ type: 'float', designParentGroup: 'design', group: 'Lights', defaultValue: .5, min: 0 })
    expect(manifest.lighting!.lights.some(entry => String(entry.id).includes('model'))).toBe(false)
  })

  it('does not disturb the chamber: the glowing cells and arms are the same with a model in the middle', async () => {
    const r = await rig(); r.draw(3)
    expect(r.controller.inspect()).toMatchObject({ arms: 2, cells: { ring: 12, ticks: 8, beacons: 4, lamps: 6, core: 3 } })
    const withoutModel = await loadChamberScene(); const plain = new Cinema2ChamberController(library); plain.attach(withoutModel)
    expect(plain.inspect().cells).toEqual(r.controller.inspect().cells)
  })

  it('moves the model with the music: it floats more with energy and a calm passage, and the kick cue is a choreography channel', () => {
    const rules = manifest.choreography!.rules.map(rule => String(rule.id))
    expect(rules).toContain('chamber-score-kick-cue-model'); expect(rules).toContain('chamber-energy-model')
    expect(manifest.modules![0]!.parameters!.cueModel).toBe(0)
    const drives = JSON.stringify(manifest.choreography!.rules.filter(rule => String(rule.id).includes('mood')).map(rule => rule.id)); expect(drives.length).toBeGreaterThan(2)
  })
})
