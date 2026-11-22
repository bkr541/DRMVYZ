import type * as THREE from 'three'
import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import type { Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { createCinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'
import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { Cinema2PatternAutoPerformance } from './mainframe/Cinema2PatternAutoPerformance'
import { resolveCinema2AfterhoursTriggerEventIdentity } from './Cinema2AfterhoursNativeModule'
import { Cinema2MainframePatternController, resolveCinema2MainframeTriggerEventIdentity, type Cinema2MainframeTriggerId } from './mainframe/Cinema2MainframePatternController'
import { Cinema2MainframeBeatClockResolver } from './mainframe/Cinema2MainframePatternEngine'
import { splitGeometryByCell } from './chamber/Cinema2ChamberCells'
import { SpaceBoiArm } from './spaceBoi/Cinema2SpaceBoiArms'
import { SPACE_BOI_PALETTE_DEFAULTS, type SpaceBoiPaletteName } from './spaceBoi/Cinema2SpaceBoiPalette'
import {
  CINEMA2_SPACE_BOI_DEFAULT_PATTERN, CINEMA2_SPACE_BOI_PATTERN_IDS, CINEMA2_SPACE_BOI_TRIGGER_IDS,
  blendSpaceBoiPoses, evaluateSpaceBoiPattern, type Cinema2SpaceBoiPattern, type SpaceBoiPose,
} from './spaceBoi/Cinema2SpaceBoiPatterns'

export const CINEMA2_SPACE_BOI_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('space-boi-native')
const TRANSITION_BEATS = 2
/** The black material of the file (the figure's fill, the hatching on the planets, the water's floor) and the off-white one (every line). */
const VOID_MATERIAL = 'Material.001'
/** The figure in the model's own space (scene units, floor at y = 0). Triangles above the neck are the head; outside the gap between the arms and the body they are an arm. */
const FIGURE = { waterY: .1, neckY: 2.52, armGap: .66, shoulderX: .62, shoulderY: 2.2 } as const
/** The nodes of each planet: a white disc or rings and the black hatching drawn over it. */
const PLANET_NODES: readonly (readonly string[])[] = [['Sphere', 'Sphere001', 'Sphere004'], ['Sphere005', 'Sphere006'], ['Sphere002', 'Sphere003'], ['Sphere007', 'Sphere008']]
const MOON_NODES = ['Sphere009', 'Sphere010', 'Sphere011'] as const
const WATER_NODES = ['waves', 'waves1', 'waves2'] as const
const FAMILY_GAIN = { figure: 'figureInk', water: 'waterInk', planets: 'planetInk', stars: 'starInk' } as const
type Family = keyof typeof FAMILY_GAIN
const FAMILY_PALETTE: Record<Family, SpaceBoiPaletteName> = { figure: 'figureColor', water: 'waterColor', planets: 'planetColor', stars: 'starColor' }
const CUE_CHANNEL: Record<Family, string> = { figure: 'cueFigure', water: 'cueWater', planets: 'cuePlanets', stars: 'cueStars' }

/** One lit ink: its own material, the family it belongs to and the pose level that drives it (planet k and moon j have one each, the water has three bands). */
interface Ink { family: Family; material: THREE.MeshBasicMaterial; read: (pose: SpaceBoiPose) => number }
interface Moved { mesh: THREE.Mesh; parent: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; material: THREE.Material | THREE.Material[]; visible: boolean }

/**
 * Drives the Space Boi model. The file is a flat, unlit drawing in 3D: a figure standing waist deep in water under planets, with ripples and stars.
 * The figure is one mesh, so its triangles are split by region into a head, a body and two arms that hang from their own shoulder joints; the planets,
 * moons, ripples and stars are already separate nodes and are posed as they are. The model's own meshes are never edited: every moved mesh is put back
 * on dispose, and every split piece and recoloured material is the controller's own copy.
 */
export class Cinema2SpaceBoiController {
  private readonly ownedGeometry: THREE.BufferGeometry[] = []
  private readonly ownedMaterial: THREE.Material[] = []
  private readonly moved: Moved[] = []
  private readonly hidden: THREE.Mesh[] = []
  private readonly rigs: THREE.Object3D[] = []
  private readonly inks: Ink[] = []
  private voidMaterial: THREE.MeshBasicMaterial | null = null
  private body: THREE.Group | null = null
  private head: THREE.Group | null = null
  private arm: SpaceBoiArm[] = []
  private planetRadius: number[] = []
  /** Which planet each hand holds: the viewer's left hand the big left planet, the right hand the ringed one. */
  private static readonly HELD = [1, 0] as const
  private planetRig: THREE.Group[] = []
  private planetHome: THREE.Vector3[] = []
  private moonRig: THREE.Group[] = []
  private waterRig: THREE.Group[] = []
  private stars: THREE.Group | null = null
  private starAngle = 0
  private lastBeats: number | null = null
  private readonly clock = new Cinema2BeatClock()
  private readonly triggerClock = new Cinema2MainframeBeatClockResolver()
  private readonly selection = new Cinema2MainframePatternController<Cinema2SpaceBoiPattern>(CINEMA2_SPACE_BOI_PATTERN_IDS, CINEMA2_SPACE_BOI_DEFAULT_PATTERN)
  private readonly policy = new Cinema2PatternControlResolver<Cinema2MainframeTriggerId>()
  // Auto Performance owns one thing: the pattern on stage during a build (Ascension) or a drop (Supernova) and, between them, one chosen by how the
  // passage feels. The saved Pattern, Pattern Change and Trigger are never written to.
  private readonly performance = new Cinema2PatternAutoPerformance<Cinema2SpaceBoiPattern>({
    buildPattern: 'ascension', dropPattern: 'supernova', buildMaxBeats: 32, dropBeats: 8,
    mood: { options: { calm: ['stargazing', 'tide-pulse'], driving: ['conductor', 'planet-waltz'], tense: ['look-around', 'reach'], peak: ['conductor', 'reach'] } },
  })
  private autoWasEnabled = false
  private overrideReason: string | null = null
  private params: Cinema2ModuleUpdateContext['parameters'] | null = null
  private pattern: Cinema2SpaceBoiPattern = CINEMA2_SPACE_BOI_DEFAULT_PATTERN
  private previousPattern: Cinema2SpaceBoiPattern = CINEMA2_SPACE_BOI_DEFAULT_PATTERN
  private transitionStart: number | null = null
  private beats = 0
  private previousTimeSec: number | null = null
  private previousTriggerBeat: number | null = null
  private previousTimestamp: number | null = null
  private identity: string | null = null
  private authoredPattern: Cinema2SpaceBoiPattern | null = null
  private editRevision: number | null = null
  private pose: SpaceBoiPose | null = null

  constructor(private readonly library: Cinema2ThreeLibrary) {}

  attach(root: THREE.Object3D): void {
    const { THREE } = this.library
    root.updateMatrixWorld(true)
    const meshes: THREE.Mesh[] = []
    root.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.isMesh && !Array.isArray(mesh.material)) meshes.push(mesh) })
    const node = (mesh: THREE.Mesh) => mesh.parent?.name ?? mesh.name
    const nodes = (...names: readonly string[]) => meshes.filter(mesh => names.includes(node(mesh)))
    const isVoid = (mesh: THREE.Mesh) => (mesh.material as THREE.Material).name === VOID_MATERIAL
    const body = nodes('body')
    if (body.length !== 2) throw new Error('SPACE BOI: the figure is missing from the model.')

    const reference = meshes.find(isVoid)
    if (!reference) throw new Error('SPACE BOI: the model has no black material.')
    this.voidMaterial = (reference.material as THREE.MeshBasicMaterial).clone(); this.ownedMaterial.push(this.voidMaterial)
    const ink = (mesh: THREE.Mesh, family: Family, read: Ink['read']) => {
      const material = (mesh.material as THREE.MeshBasicMaterial).clone(); this.ownedMaterial.push(material)
      this.inks.push({ family, material, read }); return material
    }
    const remember = (mesh: THREE.Mesh) => this.moved.push({ mesh, parent: mesh.parent!, position: mesh.position.clone(), quaternion: mesh.quaternion.clone(), scale: mesh.scale.clone(), material: mesh.material, visible: mesh.visible })
    /** A pivot placed at a world point, as a child of `parent` (the model's root by default). Rotating it swings everything attached to it about that point. */
    const pivot = (name: string, world: THREE.Vector3, parent: THREE.Object3D = root) => {
      const group = new THREE.Group(); group.name = name; root.add(group); group.position.copy(root.worldToLocal(world.clone())); group.updateMatrixWorld(true)
      if (parent !== root) parent.attach(group)
      this.rigs.push(group); return group
    }
    const at = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)
    const centerOf = (mesh: THREE.Mesh) => new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())

    // Every black mesh shares the Void colour; whatever else is black is cut out of the sky the same way.
    for (const mesh of meshes) if (isVoid(mesh)) { remember(mesh); mesh.material = this.voidMaterial }

    // The figure: split each of its two meshes (black fill and white outline) into body, head and two arms, and hang the parts from their joints.
    const bodyRig = pivot('space-boi-body', at(0, FIGURE.waterY)); this.body = bodyRig
    const headRig = pivot('space-boi-head', at(0, FIGURE.neckY), bodyRig); this.head = headRig
    const regionOf = (mesh: THREE.Mesh) => (centroid: THREE.Vector3) => {
      const p = centroid.clone().applyMatrix4(mesh.matrixWorld)
      return p.y > FIGURE.neckY ? 1 : p.x < -FIGURE.armGap ? 2 : p.x > FIGURE.armGap ? 3 : 0
    }
    const parts = [bodyRig, headRig]
    for (const mesh of body) {
      const white = !isVoid(mesh), geometries = splitGeometryByCell(THREE, mesh.geometry, 4, regionOf(mesh))
      const material = white ? ink(mesh, 'figure', pose => pose.figure) : this.voidMaterial!
      geometries.forEach((geometry, part) => {
        // The file's arm slivers (regions 2 and 3) are left out: the arms are drawn by SpaceBoiArm.
        if (part > 1 || !geometry.getAttribute('position').count) { geometry.dispose(); return }
        const piece = new THREE.Mesh(geometry, material)
        piece.name = `${mesh.name}:${['body', 'head'][part]}`
        piece.position.copy(mesh.position); piece.quaternion.copy(mesh.quaternion); piece.scale.copy(mesh.scale); mesh.parent!.add(piece); piece.updateMatrixWorld(true)
        parts[part]!.attach(piece); this.ownedGeometry.push(geometry)
      })
      mesh.visible = false; this.hidden.push(mesh)
    }

    // The water's three bands of ripples, scaled outward from the figure's feet.
    WATER_NODES.forEach(name => {
      const rig = pivot(`space-boi-water:${name}`, at(0, .08)); this.waterRig.push(rig)
      const index = this.waterRig.length - 1
      for (const mesh of nodes(name)) { remember(mesh); mesh.material = ink(mesh, 'water', pose => pose.ripples.level[index]!); rig.attach(mesh) }
    })

    // Planets: each is a group at its own centre, lifted and swelled as one.
    PLANET_NODES.forEach((names, planet) => {
      const group = nodes(...names); if (!group.length) return
      // The planet's own body (not its ring) sizes the hand that holds it; measured before the meshes move under the rig.
      this.planetRadius[planet] = Math.min(...group.map(mesh => new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).x)) / 2 / (root.getWorldScale(new THREE.Vector3()).x || 1)
      const rig = pivot(`space-boi-planet:${planet}`, centerOf(group[0]!)); this.planetRig[planet] = rig; this.planetHome[planet] = rig.position.clone()
      for (const mesh of group) { if (!isVoid(mesh)) { remember(mesh); mesh.material = ink(mesh, 'planets', pose => pose.planets.level[planet]!) } rig.attach(mesh) }
    })
    MOON_NODES.forEach((name, moon) => {
      const [mesh] = nodes(name); if (!mesh) return
      const rig = pivot(`space-boi-moon:${moon}`, centerOf(mesh)); this.moonRig[moon] = rig
      remember(mesh); mesh.material = ink(mesh, 'stars', pose => pose.moons[moon]!); rig.attach(mesh)
    })

    // The arms: the file has none, so each is drawn here and reaches for the planet it holds. The planets' radius (the body of the planet, not its ring) sizes the hand.
    const line = (body.find(mesh => !isVoid(mesh))!.material as THREE.MeshBasicMaterial).clone(); line.side = THREE.BackSide; this.ownedMaterial.push(line)
    this.inks.push({ family: 'figure', material: line, read: pose => pose.figure })
    bodyRig.updateMatrixWorld(true)
    ;([-1, 1] as const).forEach((side, index) => {
      const held = Cinema2SpaceBoiController.HELD[index]!, center = this.planetHome[held]
      if (!center || !this.planetRadius[held]) return
      const shoulder = root.worldToLocal(bodyRig.localToWorld(new THREE.Vector3(side * FIGURE.shoulderX, FIGURE.shoulderY - FIGURE.waterY, 0)))
      const arm = new SpaceBoiArm(this.library, side, this.voidMaterial!, line, shoulder.distanceTo(center) * 1.0, this.planetRadius[held]!)
      root.add(arm.group); this.arm.push(arm)
    })

    // The stars: one mesh of tiny triangles, turned slowly about the figure.
    const [stars] = nodes('particles')
    if (stars) { const rig = pivot('space-boi-stars', at(0, 0)); this.stars = rig; remember(stars); stars.material = ink(stars, 'stars', pose => pose.stars.level); rig.attach(stars) }
  }

  update({ frame, parameters }: Cinema2ModuleUpdateContext): void {
    this.params = parameters
    const time = frame.audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
    const identity = JSON.stringify([frame.contextGeneration, frame.transport?.trackId, frame.audio?.upstream.sourceId, frame.audio?.upstream.analysisRevision, frame.audio?.upstream.timelineRevision, frame.audio?.discontinuity.generation])
    const reset = identity !== this.identity || (this.previousTimeSec != null && time < this.previousTimeSec - .01)
    if (reset) { this.clock.reset(); this.selection.reset(); this.policy.reset(); this.performance.reset(); this.triggerClock.reset(); this.lastBeats = null }
    const active = !frame.transport?.paused && (!frame.transport?.sourcePresent || frame.transport.animationActive !== false)
    const idleDelta = this.previousTimestamp == null ? 0 : Math.max(0, (frame.timestampMs - this.previousTimestamp) / 1000)
    const delta = Math.min(.1, Math.max(0, frame.transport?.sourcePresent ? frame.deltaTimeSec : idleDelta))
    this.previousTimestamp = frame.timestampMs
    const timingFrame = { ...frame, elapsedTimeSec: frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec, deltaTimeSec: active ? delta : 0, ...(frame.transport ? { transport: { ...frame.transport, animationActive: active } } : {}) }
    this.beats = this.clock.update(timingFrame, parameters.get('bpmSync') !== false).beats
    const authored = readPattern(parameters.get('pattern'))
    const revision = parameters.getEditRevision?.('pattern') ?? 0
    const edited = (this.editRevision != null && revision !== this.editRevision) || (this.authoredPattern != null && authored !== this.authoredPattern)
    const savedTrigger = (CINEMA2_SPACE_BOI_TRIGGER_IDS as readonly string[]).includes(parameters.get('trigger') as string) ? parameters.get('trigger') as Cinema2MainframeTriggerId : 'bar4'
    const auto = parameters.get('autoPerformance') === true && this.number('reactivity', .65, 0, 1) > 0 && frame.transport?.sourcePresent === true && (frame.transport.playing || frame.transport.paused) && frame.mood != null
    const authorityRestored = this.autoWasEnabled && !auto
    this.autoWasEnabled = auto
    // With Auto Performance on, Pattern Change and the Trigger are the music's choice; the saved values apply again, unchanged, the moment it is off.
    const controls = this.policy.update({ saved: { patternChange: parameters.get('patternChange') === true, trigger: savedTrigger }, mood: frame.mood, autoPerformance: auto })
    const triggerTiming = this.triggerClock.resolve(timingFrame, true)
    const drop = resolveCinema2AfterhoursTriggerEventIdentity(frame, 'drop', this.previousTimeSec)
    const selected = this.selection.update({
      authoredPattern: authored, patternChange: controls.patternChange, trigger: controls.trigger,
      triggerEventId: controls.trigger === 'drop' ? drop : resolveCinema2MainframeTriggerEventIdentity(frame, controls.trigger, this.previousTimeSec, drop, { previousBeat: this.previousTriggerBeat, current: triggerTiming }),
      absoluteBeat: this.beats, reset: reset || edited,
    })
    const performing = this.performance.update({
      enabled: auto, absoluteBeat: this.beats, buildCharge: frame.mood?.silence && frame.mood.silence > .5 ? 0 : frame.director?.context.build.available ? frame.director.context.build.value ?? 0 : 0,
      dropEventId: drop, patternEdited: edited, reset, basePattern: selected.activePattern, patternChange: controls.patternChange, mood: frame.mood, deltaTimeSec: frame.deltaTimeSec, seed: identity,
    })
    this.overrideReason = performing.reason
    const next = performing.pattern ?? selected.activePattern
    if (next !== this.pattern) {
      this.previousPattern = this.pattern; this.pattern = next
      // A manual pick, a reset or Auto Performance turning off shows at once; only a Trigger- or music-driven change eases in.
      this.transitionStart = edited || reset || authorityRestored ? null : this.beats
    }
    if (reset || edited || authorityRestored) this.transitionStart = null
    this.previousTriggerBeat = triggerTiming.beats; this.previousTimeSec = time; this.identity = identity; this.authoredPattern = authored; this.editRevision = revision
  }

  beforeDraw(): void {
    const { THREE } = this.library
    const eased = this.transitionStart == null ? 1 : Math.min(1, Math.max(0, (this.beats - this.transitionStart) / TRANSITION_BEATS)), k = eased * eased * (3 - 2 * eased)
    if (eased >= 1) this.transitionStart = null
    const to = evaluateSpaceBoiPattern(this.pattern, this.beats)
    const pose = k < 1 ? blendSpaceBoiPoses(evaluateSpaceBoiPattern(this.previousPattern, this.beats), to, k) : to
    this.pose = pose
    const arms = this.number('armMotion', 1, 0, 1.5), headMotion = this.number('headMotion', 1, 0, 1.5), bodyMotion = this.number('bodyMotion', 1, 0, 1.5)
    const planetMotion = this.number('planetMotion', 1, 0, 1.5), rippleMotion = this.number('rippleMotion', 1, 0, 1.5), shimmer = this.number('starShimmer', 1, 0, 1.5)
    const quaternion = new THREE.Quaternion(), turn = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1)
    const about = (axis: THREE.Vector3, angle: number) => turn.setFromAxisAngle(axis, angle)

    // The body leans, bobs and breathes from the waterline; the head and both arms hang from it.
    if (this.body) {
      this.body.quaternion.copy(about(Z, -pose.body[0] * bodyMotion))
      this.body.position.set(0, FIGURE.waterY + pose.body[1] * bodyMotion, 0)
      this.body.scale.set(1, 1 + pose.body[2] * bodyMotion, 1)
    }
    if (this.head) this.head.quaternion.copy(about(Y, pose.head[0] * headMotion)).multiply(about(X, -pose.head[1] * headMotion)).multiply(about(Z, -pose.head[2] * headMotion))
    // Water, planets, moons and stars.
    this.waterRig.forEach((rig, band) => { const s = 1 + (pose.ripples.scale[band]! - 1) * rippleMotion; rig.scale.set(s, 1, s) })
    this.planetRig.forEach((rig, planet) => {
      if (!rig) return
      const home = this.planetHome[planet]!, s = 1 + (pose.planets.scale[planet]! - 1) * planetMotion
      rig.position.set(home.x, home.y + pose.planets.lift[planet]! * planetMotion, home.z); rig.scale.setScalar(s)
    })
    this.moonRig.forEach((rig, moon) => { if (rig) rig.scale.setScalar(1 + (pose.moons[moon]! - 1) * .25 * planetMotion) })
    const advanced = this.lastBeats == null ? 0 : Math.min(1, Math.max(0, this.beats - this.lastBeats)); this.lastBeats = this.beats
    this.starAngle += pose.stars.spin * shimmer * advanced
    if (this.stars) this.stars.quaternion.copy(about(Y, this.starAngle))

    // The arms: each shoulder rides the body, each hand cradles its planet wherever the pose has put it, and the elbow swings out with the pattern's arm raise.
    this.body?.updateMatrixWorld(true)
    this.arm.forEach((arm, index) => {
      const held = Cinema2SpaceBoiController.HELD[index]!, rig = this.planetRig[held]
      if (!rig || !this.body) return
      const root = rig.parent!
      const shoulder = root.worldToLocal(this.body.localToWorld(new THREE.Vector3(arm.side * FIGURE.shoulderX, FIGURE.shoulderY - FIGURE.waterY, 0)))
      arm.update({ shoulder, center: rig.position, radius: this.planetRadius[held]! * rig.scale.x, swing: Math.min(1, Math.max(0, pose.arms.raise[index]! * arms / 2.4)), grip: 1 })
    })

    // Ink: every family's level is its authored look times the pose, the family's own brightness, the master Intensity and the kick ripple.
    const score = this.number('scoreAmount', .5, 0, 1), master = this.number('intensity', 1, 0, 2)
    const colour = (name: SpaceBoiPaletteName) => { const c = this.color(name); return new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace) }
    const voidColor = colour('voidColor'); this.voidMaterial?.color.copy(voidColor)
    const base = {} as Record<Family, THREE.Color>, gain = {} as Record<Family, number>, cue = {} as Record<Family, number>
    for (const family of Object.keys(FAMILY_GAIN) as Family[]) {
      base[family] = colour(FAMILY_PALETTE[family]); gain[family] = this.number(FAMILY_GAIN[family], 1, 0, 2) * master; cue[family] = this.number(CUE_CHANNEL[family], 0, 0, 1) * score * 1.2
    }
    // How strongly each motion control carries the pose's brightness: a family at motion 0 stays at its authored level.
    const motion: Record<Family, number> = { figure: bodyMotion, water: rippleMotion, planets: planetMotion, stars: shimmer }
    for (const entry of this.inks) {
      const posed = 1 + (entry.read(pose) - 1) * motion[entry.family]
      const level = Math.max(0, (posed + cue[entry.family]) * gain[entry.family])
      if (level <= 1) entry.material.color.copy(voidColor).lerp(base[entry.family], level); else entry.material.color.copy(base[entry.family]).multiplyScalar(level)
    }
  }

  private number(name: string, fallback: number, min: number, max: number): number {
    const value = this.params?.get(name)
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
  }

  private color(name: SpaceBoiPaletteName): Cinema2Color {
    const value = this.params?.get(name)
    return Array.isArray(value) && value.length >= 3 && value.every(component => typeof component === 'number' && Number.isFinite(component)) ? value as unknown as Cinema2Color : SPACE_BOI_PALETTE_DEFAULTS[name]
  }

  inspect(): Readonly<Record<string, unknown>> {
    return {
      source: 'space-boi.glb', arms: this.arm.length, planetHome: this.planetHome.map(v => v?.toArray()), planetRadius: this.planetRadius, planets: this.planetRig.filter(Boolean).length, moons: this.moonRig.filter(Boolean).length, water: this.waterRig.length, inks: this.inks.length,
      ...this.policy.inspect(), performanceOverride: this.overrideReason, pattern: this.pattern, beats: this.beats, pose: this.pose,
    }
  }

  dispose(): void {
    // Put every original mesh back where the model had it, with its own material; then drop the rigs and the controller's own copies.
    for (const entry of this.moved) { entry.parent.add(entry.mesh); entry.mesh.position.copy(entry.position); entry.mesh.quaternion.copy(entry.quaternion); entry.mesh.scale.copy(entry.scale); entry.mesh.material = entry.material; entry.mesh.visible = entry.visible }
    for (const mesh of this.hidden) mesh.visible = true
    for (const rig of this.rigs) rig.removeFromParent()
    this.ownedGeometry.forEach(geometry => geometry.dispose()); this.ownedMaterial.forEach(material => material.dispose())
    this.ownedGeometry.length = 0; this.ownedMaterial.length = 0; this.moved.length = 0; this.hidden.length = 0; this.rigs.length = 0; this.inks.length = 0
    this.arm.forEach(arm => arm.dispose()); this.arm = []; this.planetRadius = []; this.planetRig = []; this.planetHome = []; this.moonRig = []; this.waterRig = []; this.body = null; this.head = null; this.stars = null; this.voidMaterial = null; this.starAngle = 0; this.lastBeats = null
    this.clock.reset(); this.selection.reset(); this.policy.reset(); this.performance.reset(); this.triggerClock.reset(); this.params = null
  }
}

function readPattern(value: unknown): Cinema2SpaceBoiPattern {
  return (CINEMA2_SPACE_BOI_PATTERN_IDS as readonly unknown[]).includes(value) ? value as Cinema2SpaceBoiPattern : CINEMA2_SPACE_BOI_DEFAULT_PATTERN
}

export const cinema2SpaceBoiModuleDefinition = createCinema2ThreeSceneModuleDefinition({
  typeId: CINEMA2_SPACE_BOI_MODULE_TYPE_ID, resourceKey: 'space-boi-native:bridge', createModelController: library => new Cinema2SpaceBoiController(library),
})
