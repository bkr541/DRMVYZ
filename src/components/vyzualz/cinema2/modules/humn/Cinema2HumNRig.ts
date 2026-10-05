import { identityMatrix, multiplyMatrices, translationMatrix, type Cinema2Mat4 } from '../../spatial/Cinema2LightMatrices'
import {
  CINEMA2_HUMN_BONE,
  CINEMA2_HUMN_BONE_COUNT,
  CINEMA2_HUMN_BONE_PARENTS,
  CINEMA2_HUMN_BONE_PIVOTS,
  CINEMA2_HUMN_FINGERS,
  type Cinema2HumNVec3,
} from './Cinema2HumNMesh'
import type { Cinema2HumNPerformancePose } from './Cinema2HumNPerformance'

/**
 * Pose rig for the HUM:N figure: forward kinematics over 44 bones (spine, chest, neck, head, jaw, clavicles, arms, hands and three joints on
 * every finger), producing one skinning matrix per bone. The mesh's rest pose is MakeHuman's A-pose, so every bone first takes a fixed rest
 * rotation (arms lowered to hang beside the body, elbows and fingers softly bent) and then the live rotation on top, authored against the
 * figure standing relaxed. Three things drive the live rotation:
 *   - idle body language (weight shift, breathing, spine and head sway, a dip, nod and small jaw drop on every beat), scaled by Motion Amount
 *     and locked to the beat clock when BPM Sync is on;
 *   - the gestures the performance runtime schedules from drops, phrases and sections: reaching toward the lens with the fingers spread,
 *     sweeping an arm across the body, looking up, looking back over a shoulder, recoiling, grabbing the head, lunging, nodding;
 *   - a camera "shot" per gesture (a low angle for looking up, over the shoulder for a turn, close for a reach). The camera belongs to the
 *     preset, and the stage is black, so the shot is applied by moving the figure relative to the lens (see `shot`).
 *
 * Live angles are degrees about the world axes of the relaxed figure: rotation about +X pitches +Y toward +Z (positive nods forward), about
 * +Y turns the face toward +X (the viewer's right), about +Z swings a hanging arm toward +X. Fingers curl about their knuckle line and spread
 * within the palm; both axes are measured from the hand's own joints, so they suit either hand.
 */

export interface Cinema2HumNRigInput {
  /** Musical position in beats (beat-grid locked when BPM Sync is on, a free-running 120 BPM clock otherwise). */
  beat: number
  /** 0..1 amount of idle body motion. */
  motion: number
  /** 0..1 envelope that jumps to 1 on every beat and decays; the body dips and the head nods with it. */
  beatEnvelope: number
  /** 0..1 gesture pose from the performance runtime. */
  pose: Readonly<Cinema2HumNPerformancePose>
}

/** How the figure is placed relative to the lens for the current gesture: degrees of yaw and pitch about the framing anchor, metres of dolly. */
export interface Cinema2HumNShot {
  yaw: number
  pitch: number
  dolly: number
  lift: number
}

export interface Cinema2HumNRigState {
  /** One column-major 4x4 skinning matrix per bone, ready to upload. */
  readonly skinMatrices: Float32Array
  /** How far the figure has been pushed toward the camera (metres), for framing decisions. */
  rootZ: number
  readonly shot: Cinema2HumNShot
}

interface Rotation {
  x: number
  y: number
  z: number
}

/** Anatomical rotations about axes measured from the bind pose (degrees). Elbows bend and twist; wrists flex. */
interface Anatomy {
  /** Forearm: bends at the elbow hinge (positive = more bent). */
  bend: number
  /** Forearm: rolls about its own length (mirrored per side, so a positive twist rolls either palm the same way). */
  twist: number
  /** Hand: bends at the wrist about the knuckle line (positive = back of the hand toward the forearm). */
  flex: number
}

interface HandPose {
  /** Degrees each finger joint bends toward the palm (the thumb a little less). */
  curl: number
  /** Degrees the fingers fan apart within the palm. */
  spread: number
}

const DEG = Math.PI / 180
const TAU = Math.PI * 2
const B = CINEMA2_HUMN_BONE

function rotationX(angle: number): Cinema2Mat4 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]
}

function rotationY(angle: number): Cinema2Mat4 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]
}

function rotationZ(angle: number): Cinema2Mat4 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

/** Rotation by `angle` radians about a unit axis (right-handed). */
function axisAngle(axis: Cinema2HumNVec3, angle: number): Cinema2Mat4 {
  const [x, y, z] = axis
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c
  return [
    t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
    t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
    0, 0, 0, 1,
  ]
}

/** Yaw, then pitch, then roll (applied to a vector in the reverse order). */
function eulerMatrix(rotation: Readonly<Rotation>): Cinema2Mat4 {
  return multiplyMatrices(rotationY(rotation.y * DEG), multiplyMatrices(rotationX(rotation.x * DEG), rotationZ(rotation.z * DEG)))
}

const sub = (a: Cinema2HumNVec3, b: Cinema2HumNVec3): Cinema2HumNVec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Cinema2HumNVec3, b: Cinema2HumNVec3): Cinema2HumNVec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (a: Cinema2HumNVec3): Cinema2HumNVec3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / length, a[1] / length, a[2] / length]
}
const pivot = (bone: number) => CINEMA2_HUMN_BONE_PIVOTS[bone]!

// ── Hand geometry (measured once from the bind pose) ─────────────────────────────────────────────────────────────────────────────────
type Side = 'left' | 'right'
const fingerBone = (side: Side, finger: typeof CINEMA2_HUMN_FINGERS[number], joint: 1 | 2 | 3) => B[`${side}${finger}${joint}` as keyof typeof B]

interface HandFrame {
  /** Unit axis per finger bone that curls it toward the palm with a positive angle. */
  curlAxis: Map<number, Cinema2HumNVec3>
  /** Unit palm normal; spreading rotates each finger's base about it. */
  palmNormal: Cinema2HumNVec3
}

function measureHand(side: Side): HandFrame {
  const across = normalize(sub(pivot(fingerBone(side, 'Index', 1)), pivot(fingerBone(side, 'Pinky', 1))))
  const along = normalize(sub(pivot(fingerBone(side, 'Middle', 2)), pivot(fingerBone(side, 'Middle', 1))))
  // The palm faces the body in the A-pose, so of the two normals pick the one pointing toward the centre line.
  let palmNormal = normalize(cross(along, across))
  const handX = pivot(side === 'left' ? B.leftHand : B.rightHand)[0]
  if (palmNormal[0] * -Math.sign(handX) < 0) palmNormal = [-palmNormal[0], -palmNormal[1], -palmNormal[2]]
  const curlAxis = new Map<number, Cinema2HumNVec3>()
  for (const finger of CINEMA2_HUMN_FINGERS) {
    for (const joint of [1, 2, 3] as const) {
      const bone = fingerBone(side, finger, joint)
      const next = joint < 3 ? pivot(fingerBone(side, finger, (joint + 1) as 2 | 3)) : null
      const direction = next ? normalize(sub(next, pivot(bone))) : normalize(sub(pivot(bone), pivot(fingerBone(side, finger, 2))))
      // Curling rotates the finger's direction toward the palm normal: axis = direction x palmNormal.
      curlAxis.set(bone, normalize(cross(direction, palmNormal)))
    }
  }
  return { curlAxis, palmNormal }
}

const HANDS: Readonly<Record<Side, HandFrame>> = { left: measureHand('left'), right: measureHand('right') }

interface ArmAxes {
  hinge: Cinema2HumNVec3
  length: Cinema2HumNVec3
  knuckles: Cinema2HumNVec3
}

function measureArm(side: Side): ArmAxes {
  const upper = side === 'left' ? B.leftUpperArm : B.rightUpperArm
  const fore = side === 'left' ? B.leftForearm : B.rightForearm
  const hand = side === 'left' ? B.leftHand : B.rightHand
  const upperDirection = normalize(sub(pivot(fore), pivot(upper)))
  const length = normalize(sub(pivot(hand), pivot(fore)))
  const hinge = normalize(cross(upperDirection, length))
  const twistAxis: Cinema2HumNVec3 = side === 'left' ? length : [-length[0], -length[1], -length[2]]
  // Flex sign: positive tips the fingers away from the palm (back of the hand toward the forearm).
  const across = normalize(sub(pivot(fingerBone(side, 'Index', 1)), pivot(fingerBone(side, 'Pinky', 1))))
  const palm = HANDS[side].palmNormal
  const fingers = normalize(sub(pivot(fingerBone(side, 'Middle', 1)), pivot(hand)))
  const probe = cross(across, fingers)
  const knuckles: Cinema2HumNVec3 = probe[0] * palm[0] + probe[1] * palm[1] + probe[2] * palm[2] < 0 ? across : [-across[0], -across[1], -across[2]]
  return { hinge, length: twistAxis, knuckles }
}

const ARMS: Readonly<Record<Side, ArmAxes>> = { left: measureArm('left'), right: measureArm('right') }

/** Fan order across the hand, so a positive spread opens the fingers away from the middle finger. */
const SPREAD_SHARE: Readonly<Record<typeof CINEMA2_HUMN_FINGERS[number], number>> = { Thumb: 1.6, Index: 1, Middle: 0, Ring: -0.8, Pinky: -1.6 }

// ── Rest pose: from MakeHuman's A-pose to a relaxed stance ───────────────────────────────────────────────────────────────────────────
const REST: Readonly<Partial<Record<number, Readonly<Rotation>>>> = {
  [B.leftUpperArm]: { x: 6, y: 0, z: 33 },
  [B.rightUpperArm]: { x: 6, y: 0, z: -33 },
}
/** The A-pose elbow is bent about 46 degrees forward; a relaxed arm keeps about 18. */
const REST_BEND = -28
const REST_HAND: HandPose = { curl: 14, spread: 0 }

/** Bones in parent-before-child order (the indices are not: the chest and clavicles were added after the neck and arms). */
const EVALUATION_ORDER: readonly number[] = (() => {
  const depth = (bone: number): number => (CINEMA2_HUMN_BONE_PARENTS[bone]! < 0 ? 0 : 1 + depth(CINEMA2_HUMN_BONE_PARENTS[bone]!))
  return Array.from({ length: CINEMA2_HUMN_BONE_COUNT }, (_, bone) => bone).sort((a, b) => depth(a) - depth(b) || a - b)
})()

const world: Cinema2Mat4[] = Array.from({ length: CINEMA2_HUMN_BONE_COUNT }, () => identityMatrix())
const inverseBind: Cinema2Mat4[] = CINEMA2_HUMN_BONE_PIVOTS.map(p => translationMatrix(-p[0], -p[1], -p[2]))
const restMatrices: Cinema2Mat4[] = Array.from({ length: CINEMA2_HUMN_BONE_COUNT }, (_, bone) => (REST[bone] ? eulerMatrix(REST[bone]!) : identityMatrix()))

export function createCinema2HumNRigState(): Cinema2HumNRigState {
  return { skinMatrices: new Float32Array(CINEMA2_HUMN_BONE_COUNT * 16), rootZ: 0, shot: { yaw: 0, pitch: 0, dolly: 0, lift: 0 } }
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const clampSigned = (value: number) => Math.min(Math.max(value, -1), 1)

function blendHand(target: HandPose, amount: number, into: HandPose): void {
  into.curl += (target.curl - into.curl) * amount
  into.spread += (target.spread - into.spread) * amount
}

/** Evaluates the pose and writes the skinning matrices. Pure apart from the state buffer it fills. */
export function evaluateCinema2HumNRig(input: Readonly<Cinema2HumNRigInput>, state: Cinema2HumNRigState): void {
  const bones: Rotation[] = Array.from({ length: CINEMA2_HUMN_BONE_COUNT }, () => ({ x: 0, y: 0, z: 0 }))
  const root = { x: 0, y: 0, z: 0 }
  const amount = clamp01(input.motion)
  const beat = input.beat
  const env = clamp01(input.beatEnvelope)
  const wave = (period: number, phase = 0) => Math.sin(((beat / period) + phase) * TAU)
  const hands: Record<Side, HandPose> = { left: { ...REST_HAND }, right: { ...REST_HAND } }
  const anatomy: Record<Side, Anatomy> = { left: { bend: REST_BEND, twist: 0, flex: 0 }, right: { bend: REST_BEND, twist: 0, flex: 0 } }
  const shot: Cinema2HumNShot = { yaw: 0, pitch: 0, dolly: 0, lift: 0 }

  // ── Idle: visible full-body weight transfer, breathing, articulated arms,
  // spine and head sway, plus a dip, nod and small jaw drop on every beat.
  root.x += 0.036 * amount * wave(8)
  root.y += -0.014 * amount * env + 0.007 * amount * wave(4)
  root.z += 0.016 * amount * wave(8, 0.25)
  bones[B.root]!.y = 7 * amount * wave(16, 0.3)
  bones[B.spine]!.y = 8 * amount * wave(16, 0.55)
  bones[B.spine]!.z = 3.5 * amount * wave(8)
  bones[B.chest]!.x = -4 * amount * wave(4) + 3 * amount * env
  bones[B.neck]!.y = 3 * amount * wave(12, 0.2)
  bones[B.head]!.y = 8 * amount * wave(12, 0.6)
  bones[B.head]!.x = 3 * amount * wave(6) + 5 * amount * env
  bones[B.head]!.z = 2.5 * amount * wave(8, 0.25)
  bones[B.jaw]!.x = 4 * amount * env
  for (const side of [-1, 1] as const) {
    const upper = side < 0 ? B.leftUpperArm : B.rightUpperArm
    const fore = side < 0 ? B.leftForearm : B.rightForearm
    const clavicle = side < 0 ? B.leftClavicle : B.rightClavicle
    const limb = side < 0 ? anatomy.left : anatomy.right
    bones[clavicle]!.z = -side * (3 + 3 * wave(4, 0.1)) * amount
    bones[upper]!.z = side * -(7 + 8 * wave(16, side * 0.18) + 3 * wave(4, side * 0.2)) * amount
    bones[upper]!.x = (-8 * wave(8, side * 0.25) + 3 * wave(4, 0.15)) * amount
    bones[upper]!.y = side * 5 * amount * wave(16, 0.4 + side * 0.1)
    limb.bend += (12 + 14 * wave(8, 0.5 + side * 0.1)) * amount
    limb.twist += side * 8 * amount * wave(16, 0.2)
    limb.flex += 9 * amount * wave(8, 0.35 + side * 0.15)
  }
  hands.left.curl += 6 * amount * wave(8, 0.1)
  hands.right.curl += 6 * amount * wave(8, 0.6)

  // ── Gestures.
  const g = input.pose
  const look = clampSigned(g.lookYaw)
  const turn = clampSigned(g.bodyTurn)
  bones[B.head]!.y += 40 * look
  bones[B.neck]!.y += 14 * look
  // Over the shoulder: the body turns about 65 degrees away and the head turns back to find the lens, so the near shoulder fills the foreground.
  bones[B.root]!.y += 20 * turn
  bones[B.spine]!.y += 22 * turn
  bones[B.chest]!.y += 23 * turn
  bones[B.neck]!.y += -18 * turn
  bones[B.head]!.y += -34 * turn
  bones[B.head]!.x += 6 * Math.abs(turn)
  shot.dolly += 0.12 * Math.abs(turn)
  bones[B.head]!.x += 14 * clamp01(g.nod)

  const reach = clamp01(g.reach)
  if (reach > 0) {
    // The viewer-left arm reaches straight at the lens, open hand, fingers spread and a little clawed; the body leans in after it.
    bones[B.leftUpperArm]!.x += -112 * reach
    bones[B.leftUpperArm]!.y += -16 * reach
    // Nearly straight at the elbow, palm rolled over, wrist bent back: the open palm faces the lens with the fingers up.
    anatomy.left.bend += -12 * reach
    anatomy.left.twist += -90 * reach
    anatomy.left.flex += 75 * reach
    bones[B.leftClavicle]!.y += 10 * reach
    bones[B.rightUpperArm]!.x += 10 * reach
    bones[B.chest]!.x += 8 * reach
    bones[B.chest]!.y += 14 * reach
    bones[B.head]!.y += -10 * reach
    bones[B.head]!.x += -6 * reach
    root.z += 0.05 * reach
    blendHand({ curl: 12, spread: 20 }, reach, hands.left)
    // Preserve the signature foreground-hand close-up from the wider base shot.
    shot.dolly += 0.16 * reach
    shot.yaw += 8 * reach
  }

  const sweep = clamp01(g.sweep)
  if (sweep > 0) {
    // The viewer-right arm sweeps out and across at shoulder height, fingers splayed; the other arm comes up across the chest.
    bones[B.rightUpperArm]!.z += 74 * sweep
    bones[B.rightUpperArm]!.x += -26 * sweep
    anatomy.right.bend += -12 * sweep
    bones[B.rightHand]!.z += 12 * sweep
    bones[B.leftUpperArm]!.x += -58 * sweep
    bones[B.leftUpperArm]!.y += 34 * sweep
    anatomy.left.bend += 60 * sweep
    bones[B.chest]!.y += -16 * sweep
    bones[B.chest]!.x += 10 * sweep
    bones[B.head]!.y += 12 * sweep
    root.z += 0.06 * sweep
    blendHand({ curl: 10, spread: 22 }, sweep, hands.right)
    blendHand({ curl: 30, spread: 6 }, sweep, hands.left)
    shot.yaw += -10 * sweep
    // The arm span is the composition here, so widen instead of pushing the
    // torso toward the lens and cropping the hands.
    shot.dolly += -0.08 * sweep
  }

  const lookUp = clamp01(g.lookUp)
  if (lookUp > 0) {
    // The chin lifts and the chest opens to look up past the lens; the shot drops low and tilts up at the figure.
    bones[B.head]!.x += -30 * lookUp
    bones[B.neck]!.x += -16 * lookUp
    bones[B.chest]!.x += -8 * lookUp
    bones[B.leftClavicle]!.z += -5 * lookUp
    bones[B.rightClavicle]!.z += 5 * lookUp
    shot.pitch += 16 * lookUp
    shot.lift += -0.1 * lookUp
    shot.dolly += 0.04 * lookUp
  }

  const shock = clamp01(g.shock)
  if (shock > 0) {
    root.y += 0.02 * shock
    root.z += -0.07 * shock
    bones[B.chest]!.x += -9 * shock
    bones[B.head]!.x += -12 * shock
    bones[B.leftClavicle]!.z += -8 * shock
    bones[B.rightClavicle]!.z += 8 * shock
    bones[B.leftUpperArm]!.z += -24 * shock
    bones[B.rightUpperArm]!.z += 24 * shock
    bones[B.leftUpperArm]!.x += -30 * shock
    bones[B.rightUpperArm]!.x += -30 * shock
    anatomy.left.bend += 46 * shock
    anatomy.right.bend += 46 * shock
    blendHand({ curl: 4, spread: 24 }, shock, hands.left)
    blendHand({ curl: 4, spread: 24 }, shock, hands.right)
    shot.dolly += -0.06 * shock
  }

  const grab = clamp01(g.headGrab)
  if (grab > 0) {
    // Upper arms lift out and forward; the forearms fold up so the hands land on the sides of the head.
    bones[B.leftUpperArm]!.z += -52 * grab
    bones[B.rightUpperArm]!.z += 52 * grab
    bones[B.leftUpperArm]!.x += -86 * grab
    bones[B.rightUpperArm]!.x += -86 * grab
    bones[B.leftUpperArm]!.y += 18 * grab
    bones[B.rightUpperArm]!.y += -18 * grab
    anatomy.left.bend += 128 * grab
    anatomy.right.bend += 128 * grab
    bones[B.head]!.x += 12 * grab
    bones[B.chest]!.x += 6 * grab
    blendHand({ curl: 34, spread: 10 }, grab, hands.left)
    blendHand({ curl: 34, spread: 10 }, grab, hands.right)
    // Widen for both raised forearms and hands instead of cropping them away.
    shot.dolly += -0.12 * grab
  }

  const lunge = clamp01(g.lunge)
  if (lunge > 0) {
    root.z += 0.26 * lunge
    bones[B.spine]!.x += 10 * lunge
    bones[B.chest]!.x += 12 * lunge
    bones[B.head]!.x += -18 * lunge
    bones[B.leftUpperArm]!.x += -40 * lunge
    bones[B.rightUpperArm]!.x += -40 * lunge
    bones[B.leftUpperArm]!.z += -14 * lunge
    bones[B.rightUpperArm]!.z += 14 * lunge
    anatomy.left.bend += 28 * lunge
    anatomy.right.bend += 28 * lunge
    blendHand({ curl: 40, spread: 4 }, lunge, hands.left)
    blendHand({ curl: 40, spread: 4 }, lunge, hands.right)
    shot.dolly += 0.04 * lunge
  }

  // ── Forward kinematics.
  const anatomyRotation = new Map<number, Cinema2Mat4>()
  for (const side of ['left', 'right'] as const) {
    const axes = ARMS[side]
    const a = anatomy[side]
    anatomyRotation.set(side === 'left' ? B.leftForearm : B.rightForearm, multiplyMatrices(axisAngle(axes.hinge, a.bend * DEG), axisAngle(axes.length, a.twist * DEG)))
    anatomyRotation.set(side === 'left' ? B.leftHand : B.rightHand, axisAngle(axes.knuckles, a.flex * DEG))
  }
  const fingerRotation = new Map<number, Cinema2Mat4>()
  for (const side of ['left', 'right'] as const) {
    const frame = HANDS[side]
    for (const finger of CINEMA2_HUMN_FINGERS) {
      for (const joint of [1, 2, 3] as const) {
        const bone = fingerBone(side, finger, joint)
        const curl = hands[side].curl * (finger === 'Thumb' ? 0.55 : 1) * (joint === 1 ? 0.8 : 1)
        let rotation = axisAngle(frame.curlAxis.get(bone)!, curl * DEG)
        if (joint === 1) rotation = multiplyMatrices(axisAngle(frame.palmNormal, hands[side].spread * SPREAD_SHARE[finger] * DEG * (side === 'left' ? -1 : 1)), rotation)
        fingerRotation.set(bone, rotation)
      }
    }
  }
  for (const index of EVALUATION_ORDER) {
    const p = pivot(index)
    const parent = CINEMA2_HUMN_BONE_PARENTS[index]!
    let rotation = multiplyMatrices(eulerMatrix(bones[index]!), restMatrices[index]!)
    const anatomical = anatomyRotation.get(index)
    if (anatomical) rotation = multiplyMatrices(rotation, anatomical)
    const finger = fingerRotation.get(index)
    if (finger) rotation = multiplyMatrices(rotation, finger)
    if (parent < 0) {
      world[index] = multiplyMatrices(translationMatrix(p[0] + root.x, p[1] + root.y, p[2] + root.z), rotation)
    } else {
      const parentPivot = pivot(parent)
      world[index] = multiplyMatrices(world[parent]!, multiplyMatrices(translationMatrix(p[0] - parentPivot[0], p[1] - parentPivot[1], p[2] - parentPivot[2]), rotation))
    }
    const skin = multiplyMatrices(world[index]!, inverseBind[index]!)
    for (let element = 0; element < 16; element += 1) state.skinMatrices[index * 16 + element] = skin[element]!
  }
  state.rootZ = root.z
  Object.assign(state.shot, shot)
}

/**
 * The figure's model matrix for a shot: scaled about the framing anchor, then turned (yaw, then pitch) about it and moved toward the lens
 * (dolly) and up or down (lift). Equivalent to moving the camera the other way, which the preset's shared camera cannot do per gesture.
 */
export function cinema2HumNShotMatrix(shot: Readonly<Cinema2HumNShot>, anchor: Readonly<{ x: number; y: number; z: number }>, scale: number): Cinema2Mat4 {
  const turn = multiplyMatrices(rotationY(shot.yaw * DEG), rotationX(shot.pitch * DEG))
  const scaled: Cinema2Mat4 = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1]
  return multiplyMatrices(
    translationMatrix(anchor.x, anchor.y + shot.lift, anchor.z + shot.dolly),
    multiplyMatrices(multiplyMatrices(turn, scaled), translationMatrix(-anchor.x, -anchor.y, -anchor.z)),
  )
}

let restSkin: Float32Array | null = null

/**
 * The skinning matrices of the relaxed stance (neutral pose, no idle motion): what the figure shows when nothing is moving it. Not the
 * identity, because the mesh's bind pose is the A-pose. Computed once.
 */
export function cinema2HumNRestSkinMatrices(): Readonly<Float32Array> {
  if (!restSkin) {
    const state = createCinema2HumNRigState()
    evaluateCinema2HumNRig({ beat: 0, motion: 0, beatEnvelope: 0, pose: { reach: 0, shock: 0, headGrab: 0, lunge: 0, lookYaw: 0, bodyTurn: 0, nod: 0, sweep: 0, lookUp: 0 } }, state)
    restSkin = state.skinMatrices
  }
  return restSkin
}
