import type * as THREE from 'three'

type ThreeLib = typeof THREE

/**
 * Space Boi's arms. The model has no arms of its own (its body mesh is only the torso and the shoulder domes), so each arm is drawn here in the file's own
 * style: a black solid with an inverted-hull white outline, the same way the model draws the body. An arm is a shoulder ball, an upper arm, an elbow, a forearm
 * and a hand, solved by two-bone IK so the hand always cradles its planet whatever the planet is doing: fingers curl up the planet's front, the thumb on the
 * inner side, the palm underneath.
 */
const LINE = .03
/** Radius at the shoulder, the elbow and the wrist. */
const R_SHOULDER = .27, R_ELBOW = .2, R_WRIST = .13
const FINGER_RADIUS = .075, THUMB_RADIUS = .09
/** The finger arcs in planet units: [azimuth from the front, start polar angle, end polar angle] (degrees; polar angle is from the planet's top, so 180 is the underside). */
const FINGERS: ReadonlyArray<readonly [number, number, number]> = [[-46, 146, 112], [-17, 152, 104], [13, 152, 106], [42, 146, 114]]
const THUMB: readonly [number, number, number] = [80, 140, 118]

export interface SpaceBoiArmPlacement {
  /** Shoulder joint, planet centre and planet radius, all in the model root's space. */
  readonly shoulder: THREE.Vector3
  readonly center: THREE.Vector3
  readonly radius: number
  /** 0 lets the elbow hang down; 1 swings it out to the side. */
  readonly swing: number
  /** 0 to 1: how far the fingers wrap (1 is the authored hold). */
  readonly grip: number
}

export class SpaceBoiArm {
  readonly group: THREE.Group
  private readonly fill: THREE.Material
  private readonly line: THREE.Material
  private readonly geometry: THREE.BufferGeometry[] = []
  private readonly upper: THREE.Group
  private readonly lower: THREE.Group
  private readonly joints: THREE.Group[]
  private readonly hand: THREE.Group
  private readonly fingers: THREE.Group[] = []
  private readonly up: THREE.Vector3
  private readonly work = { dir: null as unknown as THREE.Vector3, elbow: null as unknown as THREE.Vector3, wrist: null as unknown as THREE.Vector3, pole: null as unknown as THREE.Vector3, perp: null as unknown as THREE.Vector3, away: null as unknown as THREE.Vector3 }
  private lengths: [number, number] | null = null

  constructor(private readonly library: { THREE: ThreeLib }, readonly side: -1 | 1, fill: THREE.Material, line: THREE.Material, restReach: number, planetRadius: number) {
    const { THREE } = library
    this.fill = fill; this.line = line
    this.group = new THREE.Group(); this.group.name = `space-boi-arm:${side < 0 ? 'left' : 'right'}`
    this.up = new THREE.Vector3(0, 1, 0)
    for (const key of Object.keys(this.work) as (keyof typeof this.work)[]) this.work[key] = new THREE.Vector3()
    void restReach
    this.upper = this.segment(R_SHOULDER, R_ELBOW)
    this.lower = this.segment(R_ELBOW, R_WRIST)
    this.joints = [this.ball(R_SHOULDER), this.ball(R_ELBOW), this.ball(R_WRIST * 1.05)]
    this.hand = this.buildHand(planetRadius)
    this.group.add(this.upper, this.lower, ...this.joints, this.hand)
  }

  /** A solid and its outline as one group: a unit-length tapered cylinder from `base` radius to `tip` radius along +Y. */
  private segment(base: number, tip: number): THREE.Group {
    const { THREE } = this.library, group = new THREE.Group()
    const make = (b: number, t: number, material: THREE.Material, side: THREE.Side) => {
      const geometry = new THREE.CylinderGeometry(t, b, 1, 24, 1, false); geometry.translate(0, .5, 0); this.geometry.push(geometry)
      const mesh = new THREE.Mesh(geometry, material); mesh.material = material; if (side === THREE.BackSide) mesh.renderOrder = 0
      return mesh
    }
    group.add(make(base + LINE, tip + LINE, this.line, THREE.BackSide), make(base, tip, this.fill, THREE.FrontSide))
    return group
  }

  private ball(radius: number): THREE.Group {
    const { THREE } = this.library, group = new THREE.Group()
    for (const [r, material] of [[radius + LINE, this.line], [radius, this.fill]] as const) {
      const geometry = new THREE.SphereGeometry(r, 24, 16); this.geometry.push(geometry); group.add(new THREE.Mesh(geometry, material))
    }
    return group
  }

  /** The hand in planet units (the planet has radius 1, its centre is the origin, the wrist is straight below at -Y, the front is +Z). */
  private buildHand(planetRadius: number): THREE.Group {
    const { THREE } = this.library, hand = new THREE.Group(), line = LINE / Math.max(.1, planetRadius)
    const palm = (radius: readonly [number, number, number], at: readonly [number, number, number], grow: number, material: THREE.Material) => {
      const geometry = new THREE.SphereGeometry(1, 24, 16); this.geometry.push(geometry)
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...at); mesh.scale.set(radius[0] + grow, radius[1] + grow, radius[2] + grow); return mesh
    }
    hand.add(palm([.36, .17, .32], [0, -1.12, .1], line, this.line), palm([.36, .17, .32], [0, -1.12, .1], 0, this.fill))
    const digit = (azimuthDeg: number, from: number, to: number, radius: number, side: number) => {
      const group = new THREE.Group(), points: THREE.Vector3[] = [], reach = 1 + radius * .9, psi = azimuthDeg * Math.PI / 180 * side
      for (let i = 0; i <= 8; i++) {
        const theta = (from + (to - from) * i / 8) * Math.PI / 180
        points.push(new THREE.Vector3(reach * Math.sin(theta) * Math.sin(psi), reach * Math.cos(theta), reach * Math.sin(theta) * Math.cos(psi)))
      }
      const curve = new THREE.CatmullRomCurve3(points)
      for (const [r, material] of [[radius + line, this.line], [radius, this.fill]] as const) {
        const tube = new THREE.TubeGeometry(curve, 18, r, 10, false); const tip = new THREE.SphereGeometry(r, 12, 10); this.geometry.push(tube, tip)
        const cap = new THREE.Mesh(tip, material); cap.position.copy(points[points.length - 1]!); group.add(new THREE.Mesh(tube, material), cap)
      }
      return group
    }
    for (const [azimuth, from, to] of FINGERS) { const finger = digit(azimuth, from, to, FINGER_RADIUS, this.side); this.fingers.push(finger); hand.add(finger) }
    // The thumb is on the inner side: toward the body.
    const thumb = digit(THUMB[0], THUMB[1], THUMB[2], THUMB_RADIUS, -this.side); this.fingers.push(thumb); hand.add(thumb)
    return hand
  }

  update(place: Readonly<SpaceBoiArmPlacement>): void {
    const { THREE } = this.library, { dir, elbow, wrist, pole, perp, away } = this.work
    // The wrist sits on the planet's underside, on the shoulder's side of it.
    away.copy(place.shoulder).sub(place.center); away.z = 0
    if (away.lengthSq() < 1e-6) away.set(-this.side, 0, 0)
    away.normalize().multiplyScalar(.75).add(new THREE.Vector3(0, -.6, 0)).normalize()
    const grip = place.radius * 1.06 + .17
    wrist.copy(place.center).addScaledVector(away, grip)

    dir.copy(wrist).sub(place.shoulder)
    const distance = dir.length() || 1e-3; dir.multiplyScalar(1 / distance)
    // The arm's length is fixed by the authored hold, with a little slack so it is long, graceful and almost straight, with a soft bend at the elbow.
    this.lengths ??= [distance * .512, distance * .512]
    // An arm that has to stretch farther than it is long simply lengthens, so the hand never lets go of the planet.
    const stretch = Math.max(1, distance / (this.lengths[0] + this.lengths[1]) * 1.004), l1 = this.lengths[0] * stretch, l2 = this.lengths[1] * stretch
    const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance), height = Math.sqrt(Math.max(0, l1 * l1 - along * along))
    pole.set(this.side * place.swing * 1.2, -1 + place.swing * .7, -.45).normalize()
    perp.copy(pole).addScaledVector(dir, -pole.dot(dir)); if (perp.lengthSq() < 1e-6) perp.set(0, 0, -1); perp.normalize()
    elbow.copy(place.shoulder).addScaledVector(dir, along).addScaledVector(perp, height)

    const aim = (group: THREE.Group, from: THREE.Vector3, to: THREE.Vector3) => {
      const length = from.distanceTo(to) || 1e-3
      group.position.copy(from); group.scale.set(1, length, 1)
      group.quaternion.setFromUnitVectors(this.up, new THREE.Vector3().copy(to).sub(from).multiplyScalar(1 / length))
    }
    aim(this.upper, place.shoulder, elbow); aim(this.lower, elbow, wrist)
    this.joints[0]!.position.copy(place.shoulder); this.joints[1]!.position.copy(elbow); this.joints[2]!.position.copy(wrist)

    // The hand is turned so its palm faces the planet; fingers uncurl away from the planet as the grip lets go.
    this.hand.position.copy(place.center); this.hand.scale.setScalar(place.radius)
    this.hand.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(away.y, away.x) + Math.PI / 2)
    const open = 1 + (1 - place.grip) * .12
    this.fingers.forEach(finger => finger.scale.setScalar(open))
  }

  dispose(): void {
    this.geometry.forEach(geometry => geometry.dispose()); this.geometry.length = 0
    this.group.removeFromParent()
  }
}
