import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import { Cinema2SyncedMotionClockResolver } from '../Cinema2SyncedMotionClock'

/*
 * The BWC production line is one closed loop that every can and creature rides: the infeed belt on the left, the intake hood at the reactor,
 * the rest of the belt to the back of the hall, the half-circle turn, and the service walk back to the front. Position along the loop is a
 * single number, in metres from the point where cans spawn on the belt. Items are evenly spaced (the loop holds exactly `count` slots) and the
 * whole line advances by one shared phase, so a slot that leaves the end of the walk is the slot that appears at the start of the belt.
 *
 * Both ends sit outside the frame of the preset camera (see Cinema2BwcLoop.test.ts), so items enter at the left edge and leave at the bottom.
 */
export const BWC_TURN = Object.freeze({ cx: 0.63, cz: -10.6, r: 2.55 })

export const BWC_LOOP = Object.freeze({
  beltX: -1.92,
  walkX: 3.18,
  /** Height of the surface items stand on: the belt, and the service walk. */
  beltTopY: 0.865,
  walkTopY: 0.505,
  /** Where an item enters the loop on the left belt, and where it leaves the walk. */
  spawnZ: 8.6,
  exitZ: 8,
  hoodCenterZ: -3.55,
  hoodHalfLength: 0.9,
  /** How far inside the hood an item is cut, so the cut face is hidden behind the curtain strips. */
  hoodClipInset: 0.08,
  count: 35,
})

export const BWC_LOOP_LENGTH_A = BWC_LOOP.spawnZ - BWC_TURN.cz
export const BWC_LOOP_LENGTH_B = Math.PI * BWC_TURN.r
export const BWC_LOOP_LENGTH_C = BWC_LOOP.exitZ - BWC_TURN.cz
export const BWC_LOOP_LENGTH = BWC_LOOP_LENGTH_A + BWC_LOOP_LENGTH_B + BWC_LOOP_LENGTH_C
/** Distance between neighbouring items; the loop holds exactly `count` of them. */
export const BWC_LOOP_PITCH = BWC_LOOP_LENGTH / BWC_LOOP.count
/** Loop position of the hood's centre: items before it are cans, items after it are creatures. */
export const BWC_LOOP_HOOD_S = BWC_LOOP.spawnZ - BWC_LOOP.hoodCenterZ

/** One slot moves every two beats; at the 120 BPM reference tempo that is one slot a second. */
export const BWC_BEATS_PER_SLOT = 2
const REFERENCE_BPM = 120
const SLOTS_PER_SECOND_AT_REFERENCE = REFERENCE_BPM / 60 / BWC_BEATS_PER_SLOT

export function wrapBwcLoopPhase(phase: number): number {
  const wrapped = phase % BWC_LOOP_LENGTH
  return wrapped < 0 ? wrapped + BWC_LOOP_LENGTH : wrapped
}

/** Metres the line moves for `syncedSeconds` of the shared motion clock (1 s per second at 120 BPM) at a given speed multiplier. */
export function bwcLoopAdvance(syncedSeconds: number, speed: number): number {
  return syncedSeconds * speed * SLOTS_PER_SECOND_AT_REFERENCE * BWC_LOOP_PITCH
}

/** What stands at a loop position: a can on the belt before the hood, a creature everywhere after it. */
export function bwcLoopItemKind(s: number): 'can' | 'creature' {
  return s < BWC_LOOP_HOOD_S ? 'can' : 'creature'
}

/**
 * The line's phase over time. It rides the shared motion clock: with BPM Sync on (and the host's Audio Dock Sync on) it advances in step
 * with the analysed tempo, one slot every two beats; with it off it free-runs at the 120 BPM rate. Changing the speed changes only the
 * rate, never the position, so the line never jumps; the clock's own resets (track change, seek back, new context) restart it at zero.
 */
export class Cinema2BwcConveyorClock {
  private readonly clock = new Cinema2SyncedMotionClockResolver()
  private phase = 0
  private lastSyncedSec: number | null = null

  resolve(frame: Readonly<Cinema2ModuleFrameReadContext>, bpmSync: boolean, speed: number): number {
    const { syncedTimeSec } = this.clock.resolve(frame, bpmSync)
    if (this.lastSyncedSec === null || syncedTimeSec < this.lastSyncedSec) {
      this.phase = 0
    } else {
      this.phase = wrapBwcLoopPhase(this.phase + bwcLoopAdvance(syncedTimeSec - this.lastSyncedSec, speed))
    }
    this.lastSyncedSec = syncedTimeSec
    return this.phase
  }

  reset(): void {
    this.clock.reset()
    this.phase = 0
    this.lastSyncedSec = null
  }
}

const f = (value: number) => (Number.isInteger(value) ? value.toFixed(1) : String(Number(value.toFixed(6))))

/** The shared turn constants, as GLSL macros. */
export function bwcTurnGlsl(): string {
  return `#define TURN_CX ${f(BWC_TURN.cx)}
#define TURN_CZ ${f(BWC_TURN.cz)}
#define TURN_R ${f(BWC_TURN.r)}`
}

/** The loop's path, slot and item placement, as GLSL. Needs `u_loopPhase`, the TURN_* macros and `u_canScale`-independent geometry only. */
export function bwcLoopGlsl(): string {
  const enterClip = BWC_LOOP.hoodCenterZ + BWC_LOOP.hoodHalfLength - BWC_LOOP.hoodClipInset
  const exitClip = BWC_LOOP.hoodCenterZ - BWC_LOOP.hoodHalfLength + BWC_LOOP.hoodClipInset
  return `
#define LOOP_PI 3.14159265
const float LOOP_A_START = ${f(BWC_LOOP.spawnZ)};
const float LOOP_LEN_A = ${f(BWC_LOOP_LENGTH_A)};
const float LOOP_LEN_B = ${f(BWC_LOOP_LENGTH_B)};
const float LOOP_LEN = ${f(BWC_LOOP_LENGTH)};
const float LOOP_PITCH = ${f(BWC_LOOP_PITCH)};
const float LOOP_COUNT = ${f(BWC_LOOP.count)};
const float LOOP_S_HOOD = ${f(BWC_LOOP_HOOD_S)};
const float LOOP_BELT_X = ${f(BWC_LOOP.beltX)};
const float LOOP_WALK_X = ${f(BWC_LOOP.walkX)};
const float LOOP_BELT_TOP = ${f(BWC_LOOP.beltTopY)};
const float LOOP_WALK_TOP = ${f(BWC_LOOP.walkTopY)};
const float LOOP_HOOD_Z = ${f(BWC_LOOP.hoodCenterZ)};
const float LOOP_HOOD_HALF = ${f(BWC_LOOP.hoodHalfLength)};
// Cans are kept only in front of the hood's entrance curtain, creatures only behind its exit curtain.
const float LOOP_ENTER_CLIP = ${f(enterClip)};
const float LOOP_EXIT_CLIP = ${f(exitClip)};

/* Height of the surface under the turn at angle phi (pi at the belt, 0 at the walk): the belt's top blends into the walk's. */
float turnTop(float phi) {
  return mix(LOOP_BELT_TOP, LOOP_WALK_TOP, smoothstep(0.0, 1.0, clamp(1.0 - phi / LOOP_PI, 0.0, 1.0)));
}

/* Where a point is along the line, in metres from the spawn point, and how far it is to the side of the line. */
float loopCoordinate(vec3 p, out float lateral) {
  vec2 q = p.xz - vec2(TURN_CX, TURN_CZ);
  if (q.y < 0.0) {
    lateral = abs(length(q) - TURN_R);
    return LOOP_LEN_A + (LOOP_PI - atan(-q.y, q.x)) * TURN_R;
  }
  if (p.x < TURN_CX) {
    lateral = abs(p.x - LOOP_BELT_X);
    return LOOP_A_START - p.z;
  }
  lateral = abs(p.x - LOOP_WALK_X);
  return LOOP_LEN_A + LOOP_LEN_B + (p.z - TURN_CZ);
}

/*
 * The item whose slot is nearest a point: where it stands, which way the line is carrying it (yaw: forward is (sin yaw, cos yaw)), whether
 * it is still a can, and which of the loop's items it is. A slot whose position falls past either end of the line belongs to the other
 * end (the loop wraps there, out of frame), so nothing is drawn for it.
 */
bool loopItem(vec3 p, out vec3 center, out float travelYaw, out bool isCan, out float id) {
  center = vec3(0.0);
  travelYaw = 0.0;
  isCan = true;
  id = 0.0;
  float lateral;
  float sp = loopCoordinate(p, lateral);
  if (lateral > 1.25 || p.y > 2.8 || sp < -LOOP_PITCH || sp > LOOP_LEN + LOOP_PITCH) return false;
  float k = floor((sp - u_loopPhase) / LOOP_PITCH + 0.5);
  float s = u_loopPhase + k * LOOP_PITCH;
  if (s < 0.0 || s >= LOOP_LEN) return false;
  id = mod(k, LOOP_COUNT);
  isCan = s < LOOP_S_HOOD;
  if (s < LOOP_LEN_A) {
    center = vec3(LOOP_BELT_X, LOOP_BELT_TOP, LOOP_A_START - s);
    travelYaw = LOOP_PI;
  } else if (s < LOOP_LEN_A + LOOP_LEN_B) {
    float phi = LOOP_PI - (s - LOOP_LEN_A) / TURN_R;
    center = vec3(TURN_CX + TURN_R * cos(phi), turnTop(phi), TURN_CZ - TURN_R * sin(phi));
    travelYaw = phi;
  } else {
    center = vec3(LOOP_WALK_X, LOOP_WALK_TOP, TURN_CZ + (s - LOOP_LEN_A - LOOP_LEN_B));
    travelYaw = 0.0;
  }
  return true;
}
`
}
