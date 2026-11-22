import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CINEMA2_SPACE_BOI_PRESET_MANIFEST as manifest, CINEMA2_SPACE_BOI_PRESET_ID, spaceBoiParameterId } from '../presets/Cinema2SpaceBoiPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { Cinema2SpaceBoiController } from '../modules/Cinema2SpaceBoiNativeModule'
import { SPACE_BOI_PALETTE_DEFAULTS, SPACE_BOI_PALETTE_NAMES } from '../modules/spaceBoi/Cinema2SpaceBoiPalette'
import {
  CINEMA2_SPACE_BOI_PATTERN_IDS, SPACE_BOI_MOON_COUNT, SPACE_BOI_PLANET_COUNT, SPACE_BOI_REST_POSE, blendSpaceBoiPoses, evaluateSpaceBoiPattern, type SpaceBoiPose,
} from '../modules/spaceBoi/Cinema2SpaceBoiPatterns'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { loadSpaceBoiScene } from './support/SpaceBoiFixture'
import { describeMoodMigration } from './support/describeMoodMigration'
import { moodMusic } from './support/MoodMigrationHarness'

const byLabel = (label: string) => manifest.parameters!.find(parameter => parameter.label === label)!
const defaults: Record<string, unknown> = Object.fromEntries(manifest.parameters!.map(parameter => [parameter.id, parameter.defaultValue]))
const library = { THREE } as unknown as Cinema2ThreeLibrary

describe('SPACE BOI source GLB preservation', () => {
  it('compiles and validates its original asset instance', () => {
    const result = compileCinema2NativePreset(manifest)
    if (!result.ok) throw new Error(result.diagnostics.map(entry => entry.message).join('\n'))
    expect(cinema2NativeModuleRegistry.validateModules(manifest.modules!).diagnostics).toEqual([])
    expect(cinema2NativeEffectRegistry.validateEffects(manifest.effects ?? []).diagnostics).toEqual([])
    expect(manifest.modules![0]!.config).toMatchObject({ instances: [{ asset: 'cinema2-space-boi', node: 'space-boi-scene-node', preserveMaterials: true, spin: false }], hdr: true })
    expect(manifest.modules![0]!.config!.instances).toHaveLength(1)
  })

  it('ships the file unchanged: 21 meshes, two flat unlit materials, no textures or animation', () => {
    const glb = readFileSync(new URL('../../../../../public/cinema2/models/space-boi.glb', import.meta.url))
    const asset = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()) as { meshes: unknown[]; materials: { name: string; extensions?: Record<string, unknown> }[]; textures?: unknown[]; animations?: unknown[]; asset: { extras: { license: string } } }
    expect(asset.meshes).toHaveLength(21)
    expect(asset.materials.map(material => material.name).sort()).toEqual(['Material.001', 'Material.002'])
    for (const material of asset.materials) expect(material.extensions).toHaveProperty('KHR_materials_unlit')
    expect(asset.textures ?? []).toHaveLength(0); expect(asset.animations ?? []).toHaveLength(0)
    expect(asset.asset.extras.license).toMatch(/CC-BY-NC-4\.0/)
  })

  it('is registered with its licence and credit, and is a user-facing performance preset', () => {
    const record = JSON.parse(readFileSync(new URL('../../../../../public/cinema2/attributions.json', import.meta.url), 'utf8')) as { assets: { id: string; license: string; attribution: string }[] }
    const asset = record.assets.find(entry => entry.id === 'cinema2-space-boi')!
    expect(asset.license).toBe('CC-BY-NC-4.0'); expect(asset.attribution).toMatch(/silvercrow101/); expect(asset.attribution).toMatch(/Non-commercial/)
    expect(cinema2NativePresetRegistry.get(CINEMA2_SPACE_BOI_PRESET_ID)?.metadata.name).toBe('Space Boi')
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.some(declaration => declaration.manifest.id === CINEMA2_SPACE_BOI_PRESET_ID)).toBe(true)
  })
})

describe('SPACE BOI controls', () => {
  it('exposes the mandatory shared controls: BPM Sync, Pattern / Pattern Change / Trigger, and at least four palette colors', () => {
    expect(manifest.revision).toBe(1)
    expect(byLabel('BPM Sync')).toMatchObject({ type: 'boolean', designParentGroup: 'master-controls', defaultValue: true })
    expect(byLabel('Intensity')).toMatchObject({ designParentGroup: 'master-controls', defaultValue: 1 })
    expect(byLabel('Auto Performance')).toMatchObject({ type: 'boolean', designParentGroup: 'master-controls', defaultValue: false })
    expect(byLabel('Pattern')).toMatchObject({ type: 'enum', designParentGroup: 'design', group: 'Pattern', order: 0 })
    expect((byLabel('Pattern').options as readonly unknown[]).length).toBeGreaterThanOrEqual(6)
    expect(byLabel('Pattern Change')).toMatchObject({ type: 'boolean', defaultValue: false, designParentGroup: 'design', group: 'Pattern', order: 1 })
    expect(byLabel('Trigger')).toMatchObject({ type: 'enum', designParentGroup: 'design', group: 'Pattern', order: 2, visibleWhen: [expect.objectContaining({ parameterId: spaceBoiParameterId('patternChange'), value: true })] })
    expect(byLabel('Trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect((byLabel('Trigger').options as readonly { value: string }[]).map(option => option.value)).toEqual(['beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop'])
    const palette = manifest.parameters!.filter(parameter => parameter.designParentGroup === 'palette')
    expect(palette.every(parameter => parameter.type === 'color')).toBe(true); expect(palette.length).toBeGreaterThanOrEqual(4)
    expect(new Set(palette.map(parameter => parameter.label)).size).toBe(palette.length)
  })

  it('puts every Design parameter under exactly one of the four parent groups', () => {
    const compiled = compileCinema2NativePreset(manifest)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const model = createCinema2DesignParentGroupModel(compiled.plan, new Cinema2ParameterState(compiled.plan.parameters).getSnapshot())
    expect(model.map(group => group.id)).toEqual(['master-controls', 'design', 'effects', 'palette'])
    const seen = model.flatMap(group => [...group.controls, ...group.groups.flatMap(nested => nested.controls)].map(control => String(control.definition.id)))
    // Controls that depend on another (Trigger, and the Manual View and Sky Drift settings) are not listed until their condition holds.
    expect(new Set(seen).size).toBe(seen.length); expect(seen.length).toBe(manifest.parameters!.filter(parameter => !parameter.visibleWhen).length)
  })

  it('declares no control without a reader: the module, an effect, the camera or the environment', () => {
    const refs = new Set([
      ...Object.values(manifest.modules![0]!.parameterBindings!), ...Object.values(manifest.cameras![0]!.controls!),
      ...manifest.effects!.flatMap(effect => Object.values(effect.parameterBindings ?? {})), ...Object.values(manifest.environment?.controls ?? {}),
    ].map(ref => (ref as { $ref: string }).$ref))
    for (const parameter of manifest.parameters!) expect(refs.has(parameter.id as string), parameter.label).toBe(true)
  })

  it('starts at the authored look: the Void is the background and the module\'s black, and the four inks default to the file\'s own off-white', () => {
    expect(manifest.environment!.controls!.backgroundColor).toEqual({ $ref: spaceBoiParameterId('voidColor') })
    expect(defaults[spaceBoiParameterId('voidColor') as string]).toEqual([0, 0, 0, 1])
    const ink = SPACE_BOI_PALETTE_DEFAULTS.figureColor
    for (const name of ['waterColor', 'planetColor', 'starColor'] as const) expect(SPACE_BOI_PALETTE_DEFAULTS[name]).toEqual(ink)
    // Decoding the sRGB default gives the file's linear factor back.
    const decoded = new THREE.Color().setRGB(ink[0], ink[1], ink[2], THREE.SRGBColorSpace)
    expect(decoded.r).toBeCloseTo(.8464433773127846, 5); expect(decoded.g).toBeCloseTo(.812893709811717, 5)
  })
})

describe('SPACE BOI patterns', () => {
  const finite = (pose: SpaceBoiPose) => [...pose.head, ...pose.body, ...pose.arms.raise, ...pose.arms.forward, ...pose.ripples.scale, ...pose.ripples.level, ...pose.planets.lift, ...pose.planets.scale, ...pose.planets.level, ...pose.moons, pose.stars.level, pose.stars.spin, pose.figure]

  it('has eight programs; Stargazing starts exactly at the authored pose and every program is different, finite and bounded', () => {
    expect(CINEMA2_SPACE_BOI_PATTERN_IDS).toHaveLength(8)
    expect(evaluateSpaceBoiPattern('stargazing', 0).head).toEqual([0, 0, 0]); expect(evaluateSpaceBoiPattern('stargazing', 0).body).toEqual([0, 0, 0])
    expect(evaluateSpaceBoiPattern('stargazing', 0).planets).toEqual(SPACE_BOI_REST_POSE.planets); expect(evaluateSpaceBoiPattern('stargazing', 0).arms).toEqual(SPACE_BOI_REST_POSE.arms)
    expect(new Set(CINEMA2_SPACE_BOI_PATTERN_IDS.map(id => JSON.stringify(evaluateSpaceBoiPattern(id, 5.3)))).size).toBe(8)
    for (const id of CINEMA2_SPACE_BOI_PATTERN_IDS) for (const beats of [0, .3, 1.7, 4.2, 9.9, 15.5, 31.2]) {
      const pose = evaluateSpaceBoiPattern(id, beats)
      expect(pose.planets.lift).toHaveLength(SPACE_BOI_PLANET_COUNT); expect(pose.planets.scale).toHaveLength(SPACE_BOI_PLANET_COUNT); expect(pose.planets.level).toHaveLength(SPACE_BOI_PLANET_COUNT); expect(pose.moons).toHaveLength(SPACE_BOI_MOON_COUNT)
      for (const value of finite(pose)) expect(Number.isFinite(value), id).toBe(true)
      for (const value of [...pose.arms.raise, ...pose.arms.forward]) { expect(value, id).toBeGreaterThanOrEqual(-.01); expect(value, id).toBeLessThanOrEqual(2.6) }
      for (const value of [...pose.ripples.level, ...pose.planets.level, ...pose.moons, pose.stars.level, pose.figure]) { expect(value, id).toBeGreaterThanOrEqual(0); expect(value, id).toBeLessThanOrEqual(3.2) }
      for (const value of [...pose.ripples.scale, ...pose.planets.scale]) { expect(value, id).toBeGreaterThan(.5); expect(value, id).toBeLessThan(2) }
    }
  })

  it('raises the arms in Reach, takes the beat with alternate arms in Conductor, and visits each planet with the gaze in Look Around', () => {
    const reach = (beats: number) => Math.max(...evaluateSpaceBoiPattern('reach', beats).arms.raise)
    expect(reach(0)).toBe(0); expect(reach(3)).toBeGreaterThan(1.5); expect(reach(7.9)).toBeLessThan(.3)
    const arms = (beats: number) => evaluateSpaceBoiPattern('conductor', beats).arms.raise
    expect(arms(.1)[0]!).toBeGreaterThan(arms(.1)[1]!); expect(arms(1.1)[1]!).toBeGreaterThan(arms(1.1)[0]!)
    const yaw = [0, 2, 4, 6].map(beats => evaluateSpaceBoiPattern('look-around', beats + 1.2).head[0])
    expect(new Set(yaw.map(value => value.toFixed(2))).size).toBe(4)
    const lit = (beats: number) => evaluateSpaceBoiPattern('look-around', beats).planets.level.indexOf(Math.max(...evaluateSpaceBoiPattern('look-around', beats).planets.level))
    expect(new Set([.2, 2.2, 4.2, 6.2].map(lit)).size).toBe(4)
  })

  it('spreads the ripples in Tide Pulse, builds in Ascension and slams in Supernova', () => {
    const spread = (beats: number) => evaluateSpaceBoiPattern('tide-pulse', beats).ripples.scale[1]
    expect(spread(.1)).toBeLessThan(spread(2)); expect(spread(2)).toBeLessThan(spread(3.9)); expect(spread(4.1)).toBeLessThan(spread(3.9))
    const climb = (beats: number) => Math.max(...evaluateSpaceBoiPattern('ascension', beats).arms.raise)
    expect(climb(2)).toBeLessThan(climb(8)); expect(climb(8)).toBeLessThan(climb(14))
    const stars = (beats: number) => evaluateSpaceBoiPattern('ascension', beats).stars.level
    expect(stars(2)).toBeLessThan(stars(10)); expect(stars(10)).toBeLessThan(stars(15))
    const flash = (beats: number) => evaluateSpaceBoiPattern('supernova', beats).stars.level
    expect(flash(.02)).toBeGreaterThan(flash(.45) + .5); expect(flash(.52)).toBeGreaterThan(flash(.95) + .5)
    const evenPlanets = evaluateSpaceBoiPattern('supernova', .02).planets.level, oddPlanets = evaluateSpaceBoiPattern('supernova', .52).planets.level
    expect(evenPlanets[0]!).toBeGreaterThan(evenPlanets[1]!); expect(oddPlanets[1]!).toBeGreaterThan(oddPlanets[0]!)
  })

  it('eases between two programs from one to the other', () => {
    const a = evaluateSpaceBoiPattern('stargazing', 3), b = evaluateSpaceBoiPattern('supernova', 3)
    expect(blendSpaceBoiPoses(a, b, 0)).toEqual(a); expect(blendSpaceBoiPoses(a, b, 1)).toEqual(b)
    expect(blendSpaceBoiPoses(a, b, .5).stars.level).toBeCloseTo((a.stars.level + b.stars.level) / 2, 8)
  })
})

describe('SPACE BOI native module on the real model', () => {
  async function rig(controls: Record<string, unknown> = {}) {
    const scene = await loadSpaceBoiScene(), controller = new Cinema2SpaceBoiController(library)
    controller.attach(scene)
    const values = new Map<string, unknown>(), revisions = new Map<string, number>()
    for (const parameter of manifest.parameters!) values.set(String(parameter.id).replace(/^space-boi-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), parameter.defaultValue)
    for (const name of ['cueFigure', 'cueWater', 'cuePlanets', 'cueStars']) values.set(name, 0)
    for (const [name, value] of Object.entries(controls)) values.set(name, value)
    const parameters = { get: (name: string) => values.get(name), getEditRevision: (name: string) => revisions.get(name) ?? 0 }
    const set = (name: string, value: unknown) => { values.set(name, value); revisions.set(name, (revisions.get(name) ?? 0) + 1) }
    // The beat clock starts at elapsed seconds x 120 BPM / 60, so a frame at beats / 2 seconds places it exactly; later frames add nothing.
    const draw = (beats: number) => { controller.update({ frame: { elapsedTimeSec: beats / 2, deltaTimeSec: 0, timestampMs: 0, contextGeneration: 1 }, parameters } as never); controller.beforeDraw(); scene.updateMatrixWorld(true) }
    /** Real frames, a tenth of a second apart: the beat clock advances only with frame time. */
    const run = (seconds: number) => { for (let i = 1; i <= Math.round(seconds * 10); i++) { controller.update({ frame: { elapsedTimeSec: i / 10, deltaTimeSec: .1, timestampMs: i * 100, contextGeneration: 1 }, parameters } as never); controller.beforeDraw() } scene.updateMatrixWorld(true) }
    const named = (match: RegExp) => { const found: THREE.Object3D[] = []; scene.traverse(o => { if (match.test(o.name)) found.push(o) }); return found }
    const meshes = (match: RegExp) => named(match) as THREE.Mesh[]
    const inkOf = (name: string) => ((scene.getObjectByName(name) as THREE.Mesh).material as THREE.MeshBasicMaterial).color.clone()
    return { scene, controller, set, draw, run, named, meshes, inkOf }
  }
  const center = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())
  const triangles = (list: THREE.Mesh[]) => list.reduce((sum, mesh) => sum + mesh.geometry.getAttribute('position').count / 3, 0)

  it('splits the figure into a body, a head and two arms, hides the originals and keeps every triangle, once', async () => {
    const r = await rig(); r.draw(1)
    expect(r.controller.inspect()).toMatchObject({ arms: 2, planets: SPACE_BOI_PLANET_COUNT, moons: SPACE_BOI_MOON_COUNT, water: 3 })
    expect(r.named(/^space-boi-arm:/).map(o => o.name)).toEqual(['space-boi-arm:left', 'space-boi-arm:right'])
    expect(triangles(r.meshes(/^body_Material001_0:(body|head|left-arm|right-arm)$/))).toBe(4416)
    expect(triangles(r.meshes(/^body_Material002_0:(body|head|left-arm|right-arm)$/))).toBe(4992)
    for (const part of ['head', 'left-arm', 'right-arm', 'body']) expect(r.meshes(new RegExp(`:${part}$`)).length, part).toBe(2)
    for (const mesh of r.meshes(/^body_Material00[12]_0$/)) expect(mesh.visible).toBe(false)
    // The arms are the outer strips and the head sits above the neck.
    const left = r.meshes(/^body_Material002_0:left-arm$/)[0]!, right = r.meshes(/^body_Material002_0:right-arm$/)[0]!, head = r.meshes(/^body_Material002_0:head$/)[0]!
    expect(center(left).x).toBeLessThan(-.7); expect(center(right).x).toBeGreaterThan(.7); expect(center(head).y).toBeGreaterThan(2.9)
  })

  it('leaves the figure exactly where the model has it at rest, and every other mesh where it was', async () => {
    const plain = await loadSpaceBoiScene(), r = await rig(); r.draw(0)
    const box = (scene: THREE.Object3D, match: RegExp) => { const b = new THREE.Box3(); scene.traverse(o => { if (match.test(o.name) && (o as THREE.Mesh).isMesh) b.union(new THREE.Box3().setFromObject(o)) }); return b }
    const before = box(plain, /^body_Material002_0$/), after = box(r.scene, /^body_Material002_0:/)
    for (const axis of ['x', 'y', 'z'] as const) { expect(after.min[axis]).toBeCloseTo(before.min[axis], 4); expect(after.max[axis]).toBeCloseTo(before.max[axis], 4) }
    for (const name of ['Sphere004_Material002_0', 'Sphere009_Material002_0', 'waves_Material002_0', 'particles_Material002_0', 'Cube_Material001_0']) {
      const a = new THREE.Box3().setFromObject(plain.getObjectByName(name)!), b = new THREE.Box3().setFromObject(r.scene.getObjectByName(name)!)
      expect(b.min.distanceTo(a.min), name).toBeLessThan(1e-4); expect(b.max.distanceTo(a.max), name).toBeLessThan(1e-4)
    }
  })

  it('reproduces the file\'s own colours at the defaults', async () => {
    const plain = await loadSpaceBoiScene(), r = await rig(); r.draw(0)
    const authored = (name: string) => (plain.getObjectByName(name) as THREE.Mesh).material as THREE.MeshBasicMaterial
    for (const name of ['body_Material002_0:head', 'waves_Material002_0', 'Sphere004_Material002_0', 'particles_Material002_0', 'Sphere009_Material002_0']) {
      const got = r.inkOf(name), want = authored(name.replace(/:.*/, '')).color
      expect(got.r, name).toBeCloseTo(want.r, 4); expect(got.g, name).toBeCloseTo(want.g, 4); expect(got.b, name).toBeCloseTo(want.b, 4)
    }
    for (const name of ['body_Material001_0:body', 'Cube_Material001_0', 'Sphere_Material001_0']) { const c = r.inkOf(name); expect(c.r + c.g + c.b, name).toBe(0) }
  })

  it('swings the arms out and up from their shoulders, scales the swing with Arm Motion, and holds them with it at zero', async () => {
    const quiet = { headMotion: 0, bodyMotion: 0, planetMotion: 0, rippleMotion: 0, starShimmer: 0 }
    const home = await rig({ ...quiet, armMotion: 0 }); home.draw(3)
    const moving = await rig({ ...quiet, pattern: 'reach' }); moving.draw(3)
    const still = await rig({ ...quiet, pattern: 'reach', armMotion: 0 }); still.draw(3)
    const arm = (r: Awaited<ReturnType<typeof rig>>, side: 'left' | 'right') => center(r.meshes(new RegExp(`^body_Material002_0:${side}-arm$`))[0]!)
    for (const side of ['left', 'right'] as const) {
      expect(arm(moving, side).distanceTo(arm(home, side)), side).toBeGreaterThan(.5)
      expect(arm(still, side).distanceTo(arm(home, side)), side).toBeLessThan(1e-6)
    }
    // Raised, the arms are higher and further out than hanging.
    expect(arm(moving, 'left').y).toBeGreaterThan(arm(home, 'left').y); expect(arm(moving, 'left').x).toBeLessThan(arm(home, 'left').x)
    expect(arm(moving, 'right').y).toBeGreaterThan(arm(home, 'right').y); expect(arm(moving, 'right').x).toBeGreaterThan(arm(home, 'right').x)
  })

  it('turns the head, sways and lifts the body, and scales each with its own control', async () => {
    const head = (r: Awaited<ReturnType<typeof rig>>) => center(r.meshes(/^body_Material002_0:head$/)[0]!)
    const base = await rig({ headMotion: 0, bodyMotion: 0 }); base.draw(3)
    const turn = await rig({ pattern: 'look-around', bodyMotion: 0 }); turn.draw(1.4)
    expect(head(turn).distanceTo(head(base))).toBeGreaterThan(.02)
    const stiff = await rig({ pattern: 'look-around', headMotion: 0, bodyMotion: 0 }); stiff.draw(1.4)
    expect(head(stiff).distanceTo(head(base))).toBeLessThan(1e-6)
    const body = (r: Awaited<ReturnType<typeof rig>>) => center(r.meshes(/^body_Material002_0:body$/)[0]!)
    const rise = await rig({ pattern: 'ascension' }); rise.draw(12)
    expect(body(rise).y).toBeGreaterThan(body(base).y + .05)
    const held = await rig({ pattern: 'ascension', bodyMotion: 0 }); held.draw(12); expect(body(held).distanceTo(body(base))).toBeLessThan(1e-6)
  })

  it('lifts and swells the planets, spreads the ripples, and turns the stars, each with its own control', async () => {
    const planet = (r: Awaited<ReturnType<typeof rig>>) => center(r.named(/^space-boi-planet:0$/)[0]!)
    const base = await rig({ planetMotion: 0, rippleMotion: 0, starShimmer: 0 }); base.draw(3)
    const lifted = await rig({ pattern: 'ascension' }); lifted.draw(12)
    expect(planet(lifted).y).toBeGreaterThan(planet(base).y + .2)
    const parked = await rig({ pattern: 'ascension', planetMotion: 0 }); parked.draw(12); expect(planet(parked).distanceTo(planet(base))).toBeLessThan(1e-6)
    const wave = (r: Awaited<ReturnType<typeof rig>>) => new THREE.Box3().setFromObject(r.meshes(/^waves_Material002_0$/)[0]!).getSize(new THREE.Vector3()).x
    const tide = await rig({ pattern: 'tide-pulse' }); tide.draw(3.5); expect(wave(tide)).toBeGreaterThan(wave(base) * 1.1)
    const calm = await rig({ pattern: 'tide-pulse', rippleMotion: 0 }); calm.draw(3.5); expect(wave(calm)).toBeCloseTo(wave(base), 4)
    const turned = await rig({ pattern: 'supernova' }); turned.run(3)
    const stars = (r: Awaited<ReturnType<typeof rig>>) => r.named(/^space-boi-stars$/)[0]!.quaternion.angleTo(new THREE.Quaternion())
    expect(stars(turned)).toBeGreaterThan(.05)
    const frozen = await rig({ pattern: 'supernova', starShimmer: 0 }); frozen.run(3); expect(stars(frozen)).toBeLessThan(1e-9)
  })

  it('scales all ink with Intensity and each family with its own control, and recolors each family from its own palette color', async () => {
    const r = await rig(); r.draw(1)
    const sum = (c: THREE.Color) => c.r + c.g + c.b
    const names = { figure: 'body_Material002_0:head', water: 'waves_Material002_0', planets: 'Sphere004_Material002_0', stars: 'particles_Material002_0' } as const
    const base = Object.fromEntries(Object.entries(names).map(([family, name]) => [family, sum(r.inkOf(name))]))
    expect(Object.values(base).every(value => value > 1)).toBe(true)
    r.set('intensity', 0); r.draw(1); for (const name of Object.values(names)) expect(sum(r.inkOf(name)), name).toBe(0)
    r.set('intensity', 1); r.set('waterInk', 0); r.draw(1)
    expect(sum(r.inkOf(names.water))).toBe(0); expect(sum(r.inkOf(names.figure))).toBeCloseTo(base.figure!, 5)
    r.set('waterInk', 1); r.set('planetColor', [1, 0, 0, 1]); r.draw(1)
    const planet = r.inkOf(names.planets); expect(planet.r).toBeGreaterThan(0); expect(planet.g).toBe(0); expect(planet.b).toBe(0)
    expect(sum(r.inkOf(names.stars))).toBeCloseTo(base.stars!, 5); expect(sum(r.inkOf(names.figure))).toBeCloseTo(base.figure!, 5)
    r.set('planetColor', SPACE_BOI_PALETTE_DEFAULTS.planetColor); r.set('voidColor', [0, 0, .5, 1]); r.draw(1)
    expect(r.inkOf('Cube_Material001_0').b).toBeGreaterThan(0); expect(r.inkOf('body_Material001_0:body').b).toBeGreaterThan(0)
  })

  it('has five distinct palette roles, each reaching its own meshes', async () => {
    expect(SPACE_BOI_PALETTE_NAMES).toHaveLength(5)
    const r = await rig(); r.draw(1)
    const probe = { figureColor: 'body_Material002_0:head', waterColor: 'waves1_Material002_0', planetColor: 'Sphere006_Material002_0', starColor: 'Sphere010_Material002_0' } as const
    for (const [name, mesh] of Object.entries(probe)) {
      r.set(name, [0, 1, 0, 1]); r.draw(1)
      for (const [other, otherMesh] of Object.entries(probe)) { const c = r.inkOf(otherMesh); if (other === name) expect(c.r, `${name} -> ${mesh}`).toBe(0); else expect(c.r, `${name} leaves ${other}`).toBeGreaterThan(.5) }
      r.set(name, SPACE_BOI_PALETTE_DEFAULTS[name as keyof typeof SPACE_BOI_PALETTE_DEFAULTS]); r.draw(1)
    }
  })

  it('plays a program on the scene, takes a manual pick at once and eases in a changed program', async () => {
    const r = await rig({ pattern: 'reach' }); r.draw(3)
    const arm = () => center(r.meshes(/^body_Material002_0:left-arm$/)[0]!)
    const reached = arm(); const direct = await rig({ pattern: 'conductor' }); direct.draw(3)
    r.set('pattern', 'conductor'); r.draw(3)
    expect(arm().distanceTo(center(direct.meshes(/^body_Material002_0:left-arm$/)[0]!))).toBeLessThan(1e-6); expect(arm().distanceTo(reached)).toBeGreaterThan(.1)
  })

  it('restores the original meshes and their materials and releases its own on dispose', async () => {
    const plain = await loadSpaceBoiScene(), r = await rig(); r.draw(1)
    const own = r.meshes(/:(body|head|left-arm|right-arm)$/); let disposed = 0; own.forEach(mesh => mesh.geometry.addEventListener('dispose', () => { disposed++ }))
    r.controller.dispose()
    expect(disposed).toBe(own.length)
    expect(r.named(/^space-boi-/)).toHaveLength(0)
    r.scene.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const p = plain.getObjectByName(m.name) as THREE.Mesh | undefined; if (!p) return; expect(m.visible, m.name).toBe(true); expect((m.material as THREE.Material).name, m.name).toBe((p.material as THREE.Material).name) })
    expect(r.scene.getObjectByName('body_Material002_0')!.parent!.name).toBe('body')
    expect(new THREE.Box3().setFromObject(r.scene.getObjectByName('Sphere004_Material002_0')!).min.distanceTo(new THREE.Box3().setFromObject(plain.getObjectByName('Sphere004_Material002_0')!).min)).toBeLessThan(1e-4)
  })
})

describe('SPACE BOI camera', () => {
  const compiled = compileCinema2NativePreset(manifest)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const rig = () => {
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: target => target.parameterId ? state.getValue(target.parameterId) : target.authoredBaseValue })
    const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver))
    const frame = (time: number, bpm = 120) => ({ frameId: Math.round(time * 30) + 1, timestampMs: time * 1000, elapsedTimeSec: time, deltaTimeSec: 1 / 30, contextGeneration: 1, viewport: { width: 1280, height: 720, dpr: 1 }, audio: null, director: null,
      transport: { sourcePresent: true, playing: true, paused: false, animationActive: true, timeSec: time, bpm } }) as never
    const run = (from: number, to: number, bpm = 120) => { let last = camera.update(frame(from, bpm)); for (let t = from + 1 / 30; t <= to + 1e-6; t += 1 / 30) last = camera.update(frame(t, bpm)); return last }
    const set = (name: string, value: unknown) => state.setPersistentValue(spaceBoiParameterId(name) as never, value as never)
    return { camera, state, run, set }
  }
  const HOME = manifest.cameras![0]!.transform!.position!

  it('keeps the approved framing by default, drifts round the figure on request, and holds with speed zero', () => {
    const home = rig(); home.camera.reset()
    expect(home.run(0, 9).position).toEqual(HOME)
    const drift = rig(); drift.set('cameraMode', 'drift'); drift.camera.reset()
    const moved = drift.run(0, 12).position
    expect(Math.abs(moved[0]!)).toBeGreaterThan(1); expect(Math.hypot(moved[0]!, moved[2]!)).toBeGreaterThan(9)
    const held = rig(); held.set('cameraMode', 'drift'); held.set('cameraSpeed', 0); held.camera.reset()
    expect(held.run(0, 10).position[0]).toBeCloseTo(0, 6)
  })

  it('puts Manual View, at its defaults, on the home view; locks the drift to the tempo with BPM Sync on; and keeps every view inside the safety box', () => {
    const manual = (heading: number, elevation: number, distance: number) => { const r = rig(); r.set('cameraMode', 'manual'); r.set('cameraHeading', heading); r.set('cameraElevation', elevation); r.set('cameraDistance', distance); r.camera.reset(); return r.run(0, .2).position }
    const start = manual(0, 13, 11)
    for (let axis = 0; axis < 3; axis++) expect(start[axis]!).toBeCloseTo(HOME[axis]!, 2)
    const at = (bpm: number, sync: boolean) => { const r = rig(); r.set('cameraMode', 'drift'); r.set('bpmSync', sync); r.camera.reset(); return r.run(0, 8, bpm).position[0]! }
    expect(Math.abs(at(60, true))).toBeLessThan(Math.abs(at(120, true))); expect(at(60, false)).toBeCloseTo(at(120, false), 1)
    for (const heading of [-50, 0, 50]) for (const elevation of [-5, 45]) for (const distance of [8, 13]) {
      const p = manual(heading, elevation, distance)
      expect(p[0]!).toBeGreaterThanOrEqual(-10 - 1e-6); expect(p[0]!).toBeLessThanOrEqual(10 + 1e-6); expect(p[1]!).toBeGreaterThanOrEqual(1.4 - 1e-6); expect(p[1]!).toBeLessThanOrEqual(12 + 1e-6); expect(p[2]!).toBeGreaterThanOrEqual(4 - 1e-6); expect(p[2]!).toBeLessThanOrEqual(14 + 1e-6)
    }
    expect(Math.abs(manual(40, 13, 11)[0]!)).toBeGreaterThan(3); expect(manual(0, 35, 11)[1]!).toBeGreaterThan(HOME[1]! + 2)
  })
})

describe('SPACE BOI audio, choreography and Auto Performance', () => {
  it('has Audio Reactivity, Zoom on Kick and a kick punch that only changes the lens', () => {
    expect(byLabel('Audio Reactivity')).toMatchObject({ designParentGroup: 'master-controls', defaultValue: .65, min: 0, max: 1 })
    expect(byLabel('Zoom on Kick')).toMatchObject({ type: 'boolean', designParentGroup: 'master-controls', defaultValue: true })
    const camera = manifest.cameras![0]!
    expect(camera.motion!.tempo).toMatchObject({ punch: 1.6 }); expect(camera.motion!.tempo!.weave ?? 0).toBe(0)
  })

  it('maps different musical information to different parts of the picture, all scaled by Audio Reactivity', () => {
    const rules = manifest.choreography!.rules
    const strength = { $ref: spaceBoiParameterId('reactivity') }
    expect(rules.filter(rule => rule.id.startsWith('space-boi-') && !rule.id.includes('-mood-') && !rule.id.includes('-drive-')).every(rule => (rule.strengthParameter as { $ref: string } | undefined)?.$ref === strength.$ref)).toBe(true)
    const route = (signal: string, path?: string) => new Set(rules.filter(rule => rule.source.signal === signal && (path == null || (rule.source as { path?: string }).path === path)).flatMap(rule => rule.actions.map(action => (action.target as { property?: string }).property)))
    expect(route('continuous', 'audio.bands.bass')).toEqual(new Set(['rippleMotion', 'waterInk']))
    expect(route('continuous', 'audio.bands.mid')).toEqual(new Set(['planetMotion', 'planetInk']))
    expect(route('continuous', 'audio.bands.high')).toEqual(new Set(['starShimmer', 'starInk']))
    expect(route('continuous', 'audio.features.vocalPresence')).toEqual(new Set(['headMotion', 'figureInk']))
    expect(route('kick')).toEqual(new Set(['armMotion', 'bodyMotion', 'cueFigure', 'cueWater', 'cuePlanets', 'cueStars']))
    expect(route('snare')).toEqual(new Set(['planetInk', 'starInk'])); expect(route('downbeat')).toEqual(new Set(['headMotion']))
    // The drop's bloom is the effect's own Intensity.
    expect(route('drop')).toEqual(new Set(['intensity', 'rippleMotion', 'planetMotion']))
    const delays = ['figure', 'water', 'planets', 'stars'].map(name => rules.find(rule => rule.id === `space-boi-score-kick-cue-${name}`)!.actions[0]!.delayBeats)
    expect(delays).toEqual([0, .125, .25, .375])
    // Beat-grid accents wait for sound; a drop is never gated.
    for (const rule of rules.filter(rule => ['kick', 'snare', 'downbeat'].includes(rule.source.signal))) expect(rule.conditions?.some(condition => condition.kind === 'not-silent'), rule.id).toBe(true)
    for (const rule of rules.filter(rule => rule.source.signal === 'drop')) expect(rule.conditions?.some(condition => condition.kind === 'not-silent'), rule.id).toBeFalsy()
  })

  const rigged = async (controls: Record<string, unknown>) => {
    const scene = await loadSpaceBoiScene(), controller = new Cinema2SpaceBoiController(library); controller.attach(scene)
    const values = new Map<string, unknown>(); for (const parameter of manifest.parameters!) values.set(String(parameter.id).replace(/^space-boi-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), parameter.defaultValue)
    for (const [name, value] of Object.entries(controls)) values.set(name, value)
    const parameters = { get: (name: string) => values.get(name), getEditRevision: () => 0 }
    return { controller, step: (frame: unknown) => controller.update({ frame, parameters } as never), pattern: () => controller.inspect().pattern as string }
  }
  const quiet = (music: ReturnType<typeof moodMusic>, count: number, rig: Awaited<ReturnType<typeof rigged>>, extra: Parameters<ReturnType<typeof moodMusic>['next']>[0] = {}) => { for (let i = 0; i < count; i++) rig.step(music.next({ energy: .8, ...extra })) }

  it('puts Ascension on stage for a build and returns to the authored Pattern, never rewriting the saved one', async () => {
    const rig = await rigged({ autoPerformance: true, pattern: 'planet-waltz', reactivity: 1 }), music = moodMusic()
    quiet(music, 20, rig); expect(rig.pattern()).toBe('planet-waltz')
    for (let i = 0; i < 90; i++) rig.step(music.next({ energy: .8, build: Math.min(.9, i / 40) }))
    expect(rig.pattern(), 'a build is on stage').toBe('ascension')
    quiet(music, 500, rig); expect(rig.pattern(), 'the authored Pattern resumes').toBe('planet-waltz')
  })

  it('puts Supernova on stage on a drop and then returns to the authored Pattern', async () => {
    const rig = await rigged({ autoPerformance: true, pattern: 'look-around', reactivity: 1 }), music = moodMusic()
    quiet(music, 20, rig); expect(rig.pattern()).toBe('look-around')
    for (let i = 0; i < 12; i++) rig.step(music.next({ energy: 1, bass: 1, event: 'drop', eventId: 900 + i, build: 0 }))
    expect(rig.pattern(), 'the drop is on stage').toBe('supernova')
    quiet(music, 700, rig); expect(rig.pattern(), 'the authored Pattern resumes').toBe('look-around')
  })

  it('leaves the pattern alone with Auto Performance off, however the music builds and drops', async () => {
    const rig = await rigged({ autoPerformance: false, pattern: 'conductor' }), music = moodMusic()
    quiet(music, 20, rig)
    for (let i = 0; i < 90; i++) rig.step(music.next({ energy: .8, build: Math.min(.9, i / 40) }))
    for (let i = 0; i < 12; i++) rig.step(music.next({ energy: 1, bass: 1, event: 'drop', eventId: 900 + i }))
    expect(rig.pattern()).toBe('conductor')
  })
})

const SCENE = 'space-boi-scene'
describeMoodMigration('SPACE BOI', [{
  name: 'Space Boi performance', manifest, auto: spaceBoiParameterId('autoPerformance'), strength: spaceBoiParameterId('reactivity'),
  pattern: { patternChange: spaceBoiParameterId('patternChange'), trigger: spaceBoiParameterId('trigger') },
  up: [[SCENE, 'armMotion'], [SCENE, 'rippleMotion'], ['space-boi-source-bloom', 'intensity']],
  down: [[SCENE, 'armMotion'], [SCENE, 'intensity']],
  shock: [[SCENE, 'starInk']],
}])
