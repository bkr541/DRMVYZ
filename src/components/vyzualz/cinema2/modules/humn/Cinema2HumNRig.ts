import { identityMatrix, multiplyMatrices, translationMatrix, type Cinema2Mat4 } from '../../spatial/Cinema2LightMatrices'
import { CINEMA2_HUMN_BONE, CINEMA2_HUMN_BONE_COUNT, CINEMA2_HUMN_BONE_PARENTS, CINEMA2_HUMN_BONE_PIVOTS } from './Cinema2HumNMesh'
import type { Cinema2HumNPerformancePose } from './Cinema2HumNPerformance'

/**
 * Pose rig for the HUM:N figure: forward kinematics over ten bones, producing one skinning matrix per bone. Two things drive it:
 *   - idle body language (weight shift, spine and head sway, breathing, a dip and nod on every beat), scaled by Motion Amount and locked to
 *     the beat clock when BPM Sync is on;
 *   - the gestures the performance runtime schedules from drops, phrases and sections (reach, shock, head grab, lunge, look, turn, nod).
 * Angles are authored in degrees. Rotation about +X pitches +Y toward +Z (positive nods forward), about +Y turns the face toward +X (the
 * viewer's right), about +Z swings a hanging arm toward +X.
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

interface Rotation {
  x: number
  y: number
  z: number
}

const DEG = Math.PI / 180
const TAU = Math.PI * 2

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

/**
 * Yaw, then pitch, then roll (applied to a vector in the reverse order). A hand rolls about its forearm first and only then flexes at the
 * wrist, so its rotation is composed the other way round: pitch, then yaw, then roll.
 */
function rotationMatrix(rotation: Readonly<Rotation>, hand: boolean): Cinema2Mat4 {
  const x = rotationX(rotation.x * DEG)
  const y = rotationY(rotation.y * DEG)
  const z = rotationZ(rotation.z * DEG)
  return hand ? multiplyMatrices(x, multiplyMatrices(y, z)) : multiplyMatrices(y, multiplyMatrices(x, z))
}

function blank(): Rotation {
  return { x: 0, y: 0, z: 0 }
}

export interface Cinema2HumNRigState {
  /** One column-major 4x4 skinning matrix per bone, ready to upload. */
  readonly skinMatrices: Float32Array
  /** How far the figure has been pushed toward the camera (metres), for framing decisions. */
  rootZ: number
}

const world: Cinema2Mat4[] = Array.from({ length: CINEMA2_HUMN_BONE_COUNT }, () => identityMatrix())
const inverseBind: Cinema2Mat4[] = CINEMA2_HUMN_BONE_PIVOTS.map(pivot => translationMatrix(-pivot[0], -pivot[1], -pivot[2]))

export function createCinema2HumNRigState(): Cinema2HumNRigState {
  return { skinMatrices: new Float32Array(CINEMA2_HUMN_BONE_COUNT * 16), rootZ: 0 }
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

/** Evaluates the pose and writes the skinning matrices. Pure apart from the state buffer it fills. */
export function evaluateCinema2HumNRig(input: Readonly<Cinema2HumNRigInput>, state: Cinema2HumNRigState): void {
  const bones = Array.from({ length: CINEMA2_HUMN_BONE_COUNT }, blank)
  const root = { x: 0, y: 0, z: 0 }
  const b = CINEMA2_HUMN_BONE
  const amount = clamp01(input.motion)
  const beat = input.beat
  const env = clamp01(input.beatEnvelope)
  const wave = (period: number, phase = 0) => Math.sin(((beat / period) + phase) * TAU)

  // ── Idle: a weight shift over two bars, a slow spine and head sway, a dip and nod on every beat, breathing.
  root.x += 0.02 * amount * wave(8)
  root.y += -0.012 * amount * env + 0.004 * amount * wave(4)
  bones[b.root]!.y = 5 * amount * wave(16, 0.3)
  bones[b.spine]!.y = 7 * amount * wave(16, 0.55)
  bones[b.spine]!.z = 3 * amount * wave(8)
  bones[b.spine]!.x = 2 * amount * wave(4) + 2.5 * amount * env
  bones[b.neck]!.y = 3 * amount * wave(12, 0.2)
  bones[b.head]!.y = 9 * amount * wave(12, 0.6)
  bones[b.head]!.x = 3 * amount * wave(6) + 5 * amount * env
  bones[b.head]!.z = 2.5 * amount * wave(8, 0.25)
  for (const side of [-1, 1]) {
    const upper = side < 0 ? b.leftUpperArm : b.rightUpperArm
    const fore = side < 0 ? b.leftForearm : b.rightForearm
    bones[upper]!.z = side * (3 + 3 * wave(4, side * 0.2)) * amount
    bones[upper]!.x = -4 * amount * wave(8, side * 0.25)
    bones[fore]!.x = -(8 + 6 * wave(8, 0.5 + side * 0.1)) * amount
  }

  // ── Gestures.
  const g = input.pose
  const look = Math.max(-1, Math.min(1, g.lookYaw))
  const turn = Math.max(-1, Math.min(1, g.bodyTurn))
  bones[b.head]!.y += 42 * look
  bones[b.neck]!.y += 10 * look
  bones[b.spine]!.y += 30 * turn
  bones[b.root]!.y += 12 * turn
  bones[b.head]!.x += 14 * clamp01(g.nod)

  const reach = clamp01(g.reach)
  if (reach > 0) {
    bones[b.leftUpperArm]!.x += -96 * reach
    bones[b.leftUpperArm]!.z += 4 * reach
    bones[b.leftForearm]!.x += -12 * reach
    // The hand rolls and flexes back so an open palm faces the camera, fingers up.
    bones[b.leftHand]!.x += -90 * reach
    bones[b.leftHand]!.y += -90 * reach
    bones[b.rightUpperArm]!.x += 14 * reach
    bones[b.rightUpperArm]!.z += 12 * reach
    bones[b.spine]!.x += 8 * reach
    bones[b.spine]!.y += 8 * reach
    bones[b.head]!.y += -14 * reach
    bones[b.head]!.x += -5 * reach
    root.z += 0.14 * reach
  }

  const shock = clamp01(g.shock)
  if (shock > 0) {
    root.y += 0.022 * shock
    root.z += -0.08 * shock
    bones[b.spine]!.x += -8 * shock
    bones[b.head]!.x += -13 * shock
    bones[b.leftUpperArm]!.z += -26 * shock
    bones[b.rightUpperArm]!.z += 26 * shock
    bones[b.leftUpperArm]!.x += -34 * shock
    bones[b.rightUpperArm]!.x += -34 * shock
    bones[b.leftForearm]!.x += -58 * shock
    bones[b.rightForearm]!.x += -58 * shock
  }

  const grab = clamp01(g.headGrab)
  if (grab > 0) {
    // Upper arms lift out and forward; the forearms fold up so the hands land on the sides of the head.
    bones[b.leftUpperArm]!.z += -62 * grab
    bones[b.rightUpperArm]!.z += 62 * grab
    bones[b.leftUpperArm]!.x += -78 * grab
    bones[b.rightUpperArm]!.x += -78 * grab
    bones[b.leftForearm]!.x += -128 * grab
    bones[b.rightForearm]!.x += -128 * grab
    bones[b.leftForearm]!.z += -22 * grab
    bones[b.rightForearm]!.z += 22 * grab
    bones[b.head]!.x += 12 * grab
    bones[b.head]!.z += 5 * grab
    bones[b.spine]!.x += 5 * grab
  }

  const lunge = clamp01(g.lunge)
  if (lunge > 0) {
    root.z += 0.32 * lunge
    bones[b.spine]!.x += 20 * lunge
    bones[b.head]!.x += -16 * lunge
    bones[b.leftUpperArm]!.x += -48 * lunge
    bones[b.rightUpperArm]!.x += -48 * lunge
    bones[b.leftUpperArm]!.z += -16 * lunge
    bones[b.rightUpperArm]!.z += 16 * lunge
    bones[b.leftForearm]!.x += -24 * lunge
    bones[b.rightForearm]!.x += -24 * lunge
  }

  // ── Forward kinematics.
  for (let index = 0; index < CINEMA2_HUMN_BONE_COUNT; index += 1) {
    const pivot = CINEMA2_HUMN_BONE_PIVOTS[index]!
    const parent = CINEMA2_HUMN_BONE_PARENTS[index]!
    const rotation = rotationMatrix(bones[index]!, index === b.leftHand || index === b.rightHand)
    if (parent < 0) {
      world[index] = multiplyMatrices(translationMatrix(pivot[0] + root.x, pivot[1] + root.y, pivot[2] + root.z), rotation)
    } else {
      const parentPivot = CINEMA2_HUMN_BONE_PIVOTS[parent]!
      world[index] = multiplyMatrices(world[parent]!, multiplyMatrices(translationMatrix(pivot[0] - parentPivot[0], pivot[1] - parentPivot[1], pivot[2] - parentPivot[2]), rotation))
    }
    const skin = multiplyMatrices(world[index]!, inverseBind[index]!)
    for (let element = 0; element < 16; element += 1) state.skinMatrices[index * 16 + element] = skin[element]!
  }
  state.rootZ = root.z
}
