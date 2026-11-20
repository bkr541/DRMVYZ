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
import { connectedPieces, splitGeometryByCell } from './chamber/Cinema2ChamberCells'
import { CHAMBER_PALETTE_DEFAULTS, CHAMBER_PALETTE_NAMES, type ChamberPaletteName } from './chamber/Cinema2ChamberPalette'
import {
  CINEMA2_CHAMBER_DEFAULT_PATTERN, CINEMA2_CHAMBER_PATTERN_IDS, CINEMA2_CHAMBER_TRIGGER_IDS, blendChamberLevels, evaluateChamberPattern,
  type ChamberLevels, type Cinema2ChamberPattern,
} from './chamber/Cinema2ChamberPatterns'

export const CINEMA2_CHAMBER_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('chamber-native')
export type ChamberFamily = 'ring' | 'ticks' | 'beacons' | 'lamps' | 'core'
const FAMILY_PALETTE: Record<ChamberFamily, ChamberPaletteName> = { ring: 'ringColor', ticks: 'tickColor', beacons: 'beaconColor', lamps: 'lampColor', core: 'coreColor' }
const FAMILY_GAIN: Record<ChamberFamily, string> = { ring: 'ringLight', ticks: 'tickLight', beacons: 'beaconLight', lamps: 'lampLight', core: 'coreLight' }
const TRANSITION_BEATS = 2
/** The device's two arms hang from ceiling brackets at about this distance either side of the platform's centre, 7.9 above the ring. Triangles in these boxes (relative to the ring's centre) belong to an arm. */
const ARM_REGION = { minX: 1.25, maxX: 3.2, minY: 4.85, maxY: 8.05, maxZ: 2.2, pivotX: 1.55, pivotY: 7.9 } as const
interface Arm { pivot: THREE.Group; swingAxis: THREE.Vector3; twistAxis: THREE.Vector3 }

/** One lit element: its own mesh and material, so it can be driven alone. */
interface Cell { family: ChamberFamily; index: number; mesh: THREE.Mesh | null; material: THREE.MeshStandardMaterial; color: THREE.Color; emissive: THREE.Color; intensity: number; peak: number; colorPeak: number }

/**
 * Drives the glowing elements of the chamber GLB: the 12 arcs of the platform ring, the 8 floor ticks, the 4 corner beacons, the 6 lamps on the
 * device's arms and the lamp under the device. Everything else in the file is left exactly as authored. The model's own meshes are only hidden and
 * replaced by per-element copies; its geometry and materials are never modified.
 */
export class Cinema2ChamberController {
  private readonly cells: Cell[] = []
  private readonly ownedGeometry: THREE.BufferGeometry[] = []
  private readonly ownedMaterial: THREE.Material[] = []
  private readonly hidden: THREE.Mesh[] = []
  private readonly arms: Arm[] = []
  private readonly clock = new Cinema2BeatClock()
  private readonly triggerClock = new Cinema2MainframeBeatClockResolver()
  private readonly selection = new Cinema2MainframePatternController<Cinema2ChamberPattern>(CINEMA2_CHAMBER_PATTERN_IDS, CINEMA2_CHAMBER_DEFAULT_PATTERN)
  private readonly policy = new Cinema2PatternControlResolver<Cinema2MainframeTriggerId>()
  // Auto Performance owns one thing: the pattern on stage during a build (Charge Ring) or a drop (Lockdown Flash) and, between them, one chosen by how the
  // passage feels. The saved Pattern, Pattern Change and Trigger are never written to.
  private readonly performance = new Cinema2PatternAutoPerformance<Cinema2ChamberPattern>({
    buildPattern: 'charge-ring', dropPattern: 'lockdown-flash', buildMaxBeats: 32, dropBeats: 8,
    mood: { options: { calm: ['standby', 'core-breath'], driving: ['ring-chase', 'sentinel-sweep'], tense: ['countdown', 'pulse-ripple'], peak: ['ring-chase', 'pulse-ripple'] } },
  })
  private autoWasEnabled = false
  private overrideReason: string | null = null
  private params: Cinema2ModuleUpdateContext['parameters'] | null = null
  private pattern: Cinema2ChamberPattern = CINEMA2_CHAMBER_DEFAULT_PATTERN
  private previousPattern: Cinema2ChamberPattern = CINEMA2_CHAMBER_DEFAULT_PATTERN
  private transitionStart: number | null = null
  private beats = 0
  private previousTimeSec: number | null = null
  private previousTriggerBeat: number | null = null
  private previousTimestamp: number | null = null
  private identity: string | null = null
  private authoredPattern: Cinema2ChamberPattern | null = null
  private editRevision: number | null = null
  private levels: ChamberLevels | null = null

  constructor(private readonly library: Cinema2ThreeLibrary) {}

  attach(root: THREE.Object3D): void {
    const { THREE } = this.library
    root.updateMatrixWorld(true)
    const meshes = new Map<string, THREE.Mesh[]>()
    root.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh || Array.isArray(mesh.material)) return
      const name = (mesh.material as THREE.Material).name
      meshes.set(name, [...meshes.get(name) ?? [], mesh])
    })
    const only = (name: string) => meshes.get(name) ?? []
    const ring = only('turquoise_glow')[0]
    if (!ring) throw new Error('CHAMBER: the platform ring is missing from the model.')
    // Everything is placed by angle round the platform's centre, in the model's own space, so the programs run the same way round every ring.
    const ringBox = new THREE.Box3().setFromObject(ring), center = ringBox.getCenter(new THREE.Vector3())
    const angle = (point: THREE.Vector3) => { const a = Math.atan2(point.z - center.z, point.x - center.x) / (Math.PI * 2); return a - Math.floor(a) }
    const world = (mesh: THREE.Mesh, local: THREE.Vector3) => local.clone().applyMatrix4(mesh.matrixWorld)

    const pieces = (mesh: THREE.Mesh) => {
      const found = connectedPieces(mesh.geometry), sums = Array.from({ length: found.count }, () => ({ sum: new THREE.Vector3(), tris: 0 }))
      const positions = mesh.geometry.getAttribute('position'), index = mesh.geometry.index, v = new THREE.Vector3()
      for (let triangle = 0; triangle < found.piece.length; triangle++) for (let corner = 0; corner < 3; corner++) {
        v.fromBufferAttribute(positions, index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner)
        const entry = sums[found.piece[triangle]!]!; entry.sum.add(v); entry.tris++ // counts corners
      }
      return { piece: found.piece, centers: sums.map(entry => world(mesh, entry.sum.multiplyScalar(1 / entry.tris))) }
    }
    const rank = (values: number[]) => { const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value); const result = new Array<number>(values.length); order.forEach((entry, position) => { result[entry.index] = position }); return result }
    /** Replaces a mesh by one mesh per element; `cellOf` gives each connected piece its element number (or -1 to leave it out). */
    const split = (mesh: THREE.Mesh, family: ChamberFamily, cellOf: (piece: number) => number, count: number) => {
      const found = pieces(mesh)
      const geometries = splitGeometryByCell(THREE, mesh.geometry, count, (_c, triangle) => cellOf(found.piece[triangle]!))
      geometries.forEach((geometry, index) => {
        if (!geometry.getAttribute('position').count) { geometry.dispose(); return }
        const material = (mesh.material as THREE.MeshStandardMaterial).clone()
        const cell = new THREE.Mesh(geometry, material)
        cell.name = `${mesh.name}:${family}:${index}`
        cell.position.copy(mesh.position); cell.quaternion.copy(mesh.quaternion); cell.scale.copy(mesh.scale); mesh.parent!.add(cell)
        this.ownedGeometry.push(geometry); this.ownedMaterial.push(material)
        this.cells.push(this.makeCell(family, index, material, cell))
      })
      mesh.visible = false; this.hidden.push(mesh)
      return found
    }

    const ringPieces = pieces(ring), ringRank = rank(ringPieces.centers.map(angle))
    split(ring, 'ring', piece => ringRank[piece]!, ringPieces.centers.length)
    for (const beacon of only('blue_screen_glow')) { const found = pieces(beacon), order = rank(found.centers.map(angle)); split(beacon, 'beacons', piece => order[piece]!, found.centers.length) }
    for (const mesh of only('Turquoise')) {
      const found = pieces(mesh), lamp = found.centers.map(point => point.y - center.y > 2)
      const ticks = found.centers.map((point, piece) => lamp[piece] ? Infinity : angle(point)), tickRank = rank(ticks)
      // Lamps: three on the left arm (smaller x), three on the right, each side from the highest down.
      const lamps = found.centers.map((point, piece) => ({ piece, point })).filter(entry => lamp[entry.piece])
      const leftOf = (entry: { point: THREE.Vector3 }) => entry.point.x < center.x
      const lampNumber = new Map<number, number>()
      for (const side of [true, false]) lamps.filter(entry => leftOf(entry) === side).sort((a, b) => b.point.y - a.point.y).forEach((entry, position) => lampNumber.set(entry.piece, (side ? 0 : 3) + position))
      split(mesh, 'ticks', piece => lamp[piece] ? -1 : tickRank[piece]!, found.centers.filter((_, piece) => !lamp[piece]).length)
      split(mesh, 'lamps', piece => lampNumber.get(piece) ?? -1, 6)
    }
    // The device's two arms: every triangle of the structural meshes (and of the white lamp meshes) inside an arm's box moves with that arm, so the arms can swing
    // from their ceiling brackets. A mesh with no arm triangles is left alone, and an arm at rest is exactly the model as authored.
    const parent = ring.parent!
    const inverse = new THREE.Matrix4().copy(parent.matrixWorld).invert()
    for (const side of [-1, 1]) {
      const local = new THREE.Vector3(center.x + side * ARM_REGION.pivotX, center.y + ARM_REGION.pivotY, center.z).applyMatrix4(inverse)
      const pivot = new THREE.Group(); pivot.name = `chamber-arm:${side < 0 ? 'left' : 'right'}`; pivot.position.copy(local); parent.add(pivot)
      this.arms.push({ pivot, swingAxis: new THREE.Vector3(0, 0, 1).transformDirection(inverse), twistAxis: new THREE.Vector3(0, 1, 0).transformDirection(inverse) })
    }
    const armOf = (mesh: THREE.Mesh) => (c: THREE.Vector3) => {
      const p = c.clone().applyMatrix4(mesh.matrixWorld), dx = p.x - center.x, dy = p.y - center.y, dz = p.z - center.z
      if (dy < ARM_REGION.minY || dy > ARM_REGION.maxY || Math.abs(dz) > ARM_REGION.maxZ) return 0
      return dx > ARM_REGION.minX && dx < ARM_REGION.maxX ? 2 : dx < -ARM_REGION.minX && dx > -ARM_REGION.maxX ? 1 : 0
    }
    /** Splits a mesh into its body and its two arm parts (body 0, left 1, right 2); the arm parts hang from their pivots. Returns the new meshes by part, or null when no arm triangle is in the mesh. */
    const splitArms = (mesh: THREE.Mesh): (THREE.Mesh | null)[] | null => {
      const assign = armOf(mesh)
      const parts = splitGeometryByCell(THREE, mesh.geometry, 3, assign)
      if (!parts[1]!.getAttribute('position').count && !parts[2]!.getAttribute('position').count) { parts.forEach(part => part.dispose()); return null }
      const made = parts.map((geometry, part) => {
        if (!geometry.getAttribute('position').count) { geometry.dispose(); return null }
        const material = (mesh.material as THREE.MeshStandardMaterial).clone(), piece = new THREE.Mesh(geometry, material)
        piece.name = `${mesh.name}:${part === 0 ? 'body' : part === 1 ? 'left-arm' : 'right-arm'}`
        piece.position.copy(mesh.position); piece.quaternion.copy(mesh.quaternion); piece.scale.copy(mesh.scale)
        if (part === 0) parent.add(piece); else { const arm = this.arms[part - 1]!; piece.position.sub(arm.pivot.position); arm.pivot.add(piece) }
        this.ownedGeometry.push(geometry); this.ownedMaterial.push(material)
        return piece
      })
      mesh.visible = false; this.hidden.push(mesh)
      return made
    }
    for (const mesh of [...meshes.values()].flat()) {
      const name = (mesh.material as THREE.Material).name
      if (!mesh.visible || ['turquoise_glow', 'blue_screen_glow', 'Turquoise', 'White', 'White_0'].includes(name)) continue
      splitArms(mesh)
    }
    // The lamps on each arm move with it (cells 0 to 2 are the left arm's, 3 to 5 the right's).
    for (const cell of this.cells) if (cell.family === 'lamps' && cell.mesh) {
      const arm = this.arms[cell.index < 3 ? 0 : 1]!
      cell.mesh.removeFromParent(); cell.mesh.position.sub(arm.pivot.position); arm.pivot.add(cell.mesh)
    }
    for (const name of ['White', 'White_0']) for (const mesh of only(name)) {
      const material = mesh.material as THREE.MeshStandardMaterial
      const made = name === 'White' ? splitArms(mesh) : null
      if (made) { for (const piece of made) if (piece) this.cells.push(this.makeCell('core', this.cells.length, piece.material as THREE.MeshStandardMaterial, piece)) }
      else this.cells.push(this.makeCell('core', this.cells.length, material, mesh))
    }
  }

  private makeCell(family: ChamberFamily, index: number, material: THREE.MeshStandardMaterial, mesh: THREE.Mesh | null = null): Cell {
    return { family, index, mesh, material, color: material.color.clone(), emissive: material.emissive.clone(), intensity: material.emissiveIntensity,
      peak: Math.max(material.emissive.r, material.emissive.g, material.emissive.b, 1e-6), colorPeak: Math.max(material.color.r, material.color.g, material.color.b) }
  }

  update({ frame, parameters }: Cinema2ModuleUpdateContext): void {
    this.params = parameters
    const time = frame.audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
    const identity = JSON.stringify([frame.contextGeneration, frame.transport?.trackId, frame.audio?.upstream.sourceId, frame.audio?.upstream.analysisRevision, frame.audio?.upstream.timelineRevision, frame.audio?.discontinuity.generation])
    const reset = identity !== this.identity || (this.previousTimeSec != null && time < this.previousTimeSec - .01)
    if (reset) { this.clock.reset(); this.selection.reset(); this.policy.reset(); this.performance.reset(); this.triggerClock.reset() }
    const active = !frame.transport?.paused && (!frame.transport?.sourcePresent || frame.transport.animationActive !== false)
    const idleDelta = this.previousTimestamp == null ? 0 : Math.max(0, (frame.timestampMs - this.previousTimestamp) / 1000)
    const delta = Math.min(.1, Math.max(0, frame.transport?.sourcePresent ? frame.deltaTimeSec : idleDelta))
    this.previousTimestamp = frame.timestampMs
    const timingFrame = { ...frame, elapsedTimeSec: frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec, deltaTimeSec: active ? delta : 0, ...(frame.transport ? { transport: { ...frame.transport, animationActive: active } } : {}) }
    this.beats = this.clock.update(timingFrame, parameters.get('bpmSync') !== false).beats
    const authored = readPattern(parameters.get('pattern'))
    const revision = parameters.getEditRevision?.('pattern') ?? 0
    const edited = (this.editRevision != null && revision !== this.editRevision) || (this.authoredPattern != null && authored !== this.authoredPattern)
    const savedTrigger = (CINEMA2_CHAMBER_TRIGGER_IDS as readonly string[]).includes(parameters.get('trigger') as string) ? parameters.get('trigger') as Cinema2MainframeTriggerId : 'bar4'
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
    const to = evaluateChamberPattern(this.pattern, this.beats)
    const levels = k < 1 ? blendChamberLevels(evaluateChamberPattern(this.previousPattern, this.beats), to, k) : to
    this.levels = levels
    // The arms hang from their brackets by whatever the program asks of them (nothing in Standby), scaled by Arm Motion.
    const armMotion = this.number('armMotion', 1, 0, 1.5), q = new THREE.Quaternion()
    this.arms.forEach((arm, index) => {
      arm.pivot.quaternion.setFromAxisAngle(arm.swingAxis, (index === 0 ? -1 : 1) * levels.arms.swing[index]! * armMotion).multiply(q.setFromAxisAngle(arm.twistAxis, levels.arms.twist[index]! * armMotion))
    })
    // A kick sends a ripple outward through the glowing elements (the score channels are set by the choreography, with a delay each); Kick Ripple scales it.
    const score = this.number('scoreAmount', .5, 0, 1)
    const cue: Record<ChamberFamily, number> = { core: this.number('cueCore', 0, 0, 1), lamps: this.number('cueLamps', 0, 0, 1), ring: this.number('cueRing', 0, 0, 1), ticks: this.number('cueTicks', 0, 0, 1), beacons: this.number('cueBeacons', 0, 0, 1) }
    const master = this.number('intensity', 1, 0, 2)
    const chosen = {} as Record<ChamberPaletteName, THREE.Color>
    for (const name of CHAMBER_PALETTE_NAMES) { const c = this.color(name); chosen[name] = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace) }
    const gains: Record<ChamberFamily, number> = { ring: 1, ticks: 1, beacons: 1, lamps: 1, core: 1 }
    for (const family of Object.keys(gains) as ChamberFamily[]) gains[family] = this.number(FAMILY_GAIN[family], 1, 0, 2)
    for (const cell of this.cells) {
      const level = cell.family === 'core' ? levels.core : (levels[cell.family === 'ring' ? 'ring' : cell.family] as readonly number[])[cell.index] ?? 1
      const color = chosen[FAMILY_PALETTE[cell.family]], authored = CHAMBER_PALETTE_DEFAULTS[FAMILY_PALETTE[cell.family]]
      const changed = [0, 1, 2].some(channel => Math.abs(this.color(FAMILY_PALETTE[cell.family])[channel]! - authored[channel]!) > 1e-6)
      cell.material.emissive.copy(color).multiplyScalar(cell.peak)
      if (changed) cell.material.color.copy(color).multiplyScalar(cell.colorPeak); else cell.material.color.copy(cell.color)
      cell.material.emissiveIntensity = cell.intensity * master * gains[cell.family] * (level + cue[cell.family] * score * 1.2)
    }
  }

  private number(name: string, fallback: number, min: number, max: number): number {
    const value = this.params?.get(name)
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
  }

  private color(name: ChamberPaletteName): Cinema2Color {
    const value = this.params?.get(name)
    return Array.isArray(value) && value.length >= 3 && value.every(component => typeof component === 'number' && Number.isFinite(component)) ? value as unknown as Cinema2Color : CHAMBER_PALETTE_DEFAULTS[name]
  }

  inspect(): Readonly<Record<string, unknown>> {
    const count = (family: ChamberFamily) => this.cells.filter(cell => cell.family === family).length
    return { source: 'dark-chamber.glb', arms: this.arms.length, ...this.policy.inspect(), performanceOverride: this.overrideReason, pattern: this.pattern, beats: this.beats, cells: { ring: count('ring'), ticks: count('ticks'), beacons: count('beacons'), lamps: count('lamps'), core: count('core') }, levels: this.levels }
  }

  dispose(): void {
    for (const mesh of this.hidden) mesh.visible = true
    for (const arm of this.arms) arm.pivot.removeFromParent()
    this.arms.length = 0
    this.ownedGeometry.forEach(geometry => geometry.dispose()); this.ownedMaterial.forEach(material => material.dispose())
    this.ownedGeometry.length = 0; this.ownedMaterial.length = 0; this.cells.length = 0; this.hidden.length = 0
    this.clock.reset(); this.selection.reset(); this.policy.reset(); this.performance.reset(); this.triggerClock.reset(); this.params = null
  }
}

function readPattern(value: unknown): Cinema2ChamberPattern {
  return (CINEMA2_CHAMBER_PATTERN_IDS as readonly unknown[]).includes(value) ? value as Cinema2ChamberPattern : CINEMA2_CHAMBER_DEFAULT_PATTERN
}

export const cinema2ChamberModuleDefinition = createCinema2ThreeSceneModuleDefinition({
  typeId: CINEMA2_CHAMBER_MODULE_TYPE_ID, resourceKey: 'chamber-native:bridge', createModelController: library => new Cinema2ChamberController(library),
})
