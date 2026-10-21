import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { bwcCanGlsl } from './Cinema2BwcCanModel'
import { bwcCreatureGlsl } from './Cinema2BwcCreatureModel'
import { BWC_EMBLEM_TEXTURE_BYTES, BWC_EMBLEM_TEXTURE_HEIGHT, BWC_EMBLEM_TEXTURE_WIDTH, bwcEmblemGlsl, rasterizeBwcEmblem } from './Cinema2BwcEmblem'

export interface Cinema2BwcRenderState {
  target: WebGLFramebuffer | null
  width: number
  height: number
  intensity: number
  portalScale: number
  canScale: number
  conveyorWidth: number
  ledStrength: number
  background: readonly [number, number, number]
  structure: readonly [number, number, number]
  canWhite: readonly [number, number, number]
  energy: readonly [number, number, number]
  darkMetal: readonly [number, number, number]
  /** The creature's printed label once the shipped texture has loaded; until then the body is plain ivory fleece. */
  creatureLabel?: WebGLTexture | null
}

/* Authored from the dimensions and functional groups in docs/BWC. */
const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform float u_portalScale;
uniform float u_canScale;
uniform float u_conveyorWidth;
uniform float u_ledStrength;
uniform vec3 u_background;
uniform vec3 u_structure;
uniform vec3 u_canWhite;
uniform vec3 u_energy;
uniform vec3 u_darkMetal;
uniform sampler2D u_canEmblem;
uniform sampler2D u_creatureLabel;
uniform float u_creatureLabelReady;
out vec4 outColor;

#define MAX_STEPS 144
#define MAX_DISTANCE 42.0
#define EPSILON 0.0016
// The U-turn at the back of the hall that joins the infeed belt (x -1.92) to the service walk (x 3.18): both lines end near z -10.6, so
// the turn is a half circle about (TURN_CX, TURN_CZ) whose radius is half the distance between their centre lines.
#define TURN_CX 0.63
#define TURN_CZ -10.60
#define TURN_R 2.55

float sdRoundBox(vec3 p, vec3 h, float r) {
  vec3 q = abs(p) - h + r;
  return min(max(q.x, max(q.y, q.z)), 0.0) + length(max(q, 0.0)) - r;
}
float sdCylinderY(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float sdCylinderZ(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
${bwcCanGlsl()}
${bwcEmblemGlsl()}
float sdTorusZ(vec3 p, float majorRadius, float minorRadius) {
  return length(vec2(length(p.xy) - majorRadius, p.z)) - minorRadius;
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
vec2 nearest(vec2 a, vec2 b) { return a.x < b.x ? a : b; }
${bwcCreatureGlsl()}

/* A point in the space of the creature that owns it: metres, feet on the floor, facing +Z, each turned a little toward the camera. */
vec3 creatureSpace(vec3 p, out float cell) {
  float last = floor((CREATURE_Z_LAST - CREATURE_Z_FIRST) / CREATURE_PITCH);
  cell = clamp(floor((p.z - CREATURE_Z_FIRST) / CREATURE_PITCH + 0.5), 0.0, last);
  vec3 offset = vec3(p.x - CREATURE_CENTER_X, p.y - CREATURE_BASE_Y, p.z - (CREATURE_Z_FIRST + cell * CREATURE_PITCH));
  float yaw = CREATURE_YAW_BIAS + (fract(sin(cell * 12.9898) * 43758.5453) - 0.5) * 2.0 * CREATURE_YAW_JITTER;
  float c = cos(yaw), s = sin(yaw);
  return vec3(c * offset.x - s * offset.z, offset.y, s * offset.x + c * offset.z) / CREATURE_SCALE;
}

/* A creature in the space of its own model, given where it stands and which way it is turned. */
vec3 creatureLocal(vec3 p, vec3 center, float yaw) {
  vec3 offset = p - center;
  float c = cos(yaw), s = sin(yaw);
  return vec3(c * offset.x - s * offset.z, offset.y, s * offset.x + c * offset.z) / CREATURE_SCALE;
}

/*
 * Items riding the turn: three cans on its first half (the belt side) and four creatures on its second (the service-walk side), so the
 * line reads as one loop. Phi runs from pi at the infeed belt to 0 at the service walk; each item sits on the centre line at the slot
 * centre, at the height of the surface under it, and a creature faces the way the line is travelling.
 */
#define TURN_CAN_STEP 0.502
#define TURN_CREATURE_STEP 0.431
float turnTop(float phi) {
  return mix(0.865, 0.505, smoothstep(0.0, 1.0, clamp(1.0 - phi / 3.14159265, 0.0, 1.0)));
}
bool inTurn(vec3 p, out vec2 q) {
  q = p.xz - vec2(TURN_CX, TURN_CZ);
  return q.y < 0.05 && q.y > -TURN_R - 1.6 && abs(q.x) < TURN_R + 1.6 && abs(length(q) - TURN_R) < 1.3 && p.y < 2.6;
}
bool turnCanSlot(vec3 p, out vec3 center) {
  center = vec3(0.0);
  vec2 q;
  if (!inTurn(p, q)) return false;
  float phi = atan(-q.y, q.x);
  if (phi < 1.5707963) return false;
  float k = clamp(floor((3.14159265 - phi) / TURN_CAN_STEP), 0.0, 2.0);
  float slot = 3.14159265 - (k + 0.5) * TURN_CAN_STEP;
  center = vec3(TURN_CX + TURN_R * cos(slot), turnTop(slot), TURN_CZ - TURN_R * sin(slot));
  return true;
}
bool turnCreatureSlot(vec3 p, out vec3 center, out float yaw) {
  center = vec3(0.0);
  yaw = 0.0;
  vec2 q;
  if (!inTurn(p, q)) return false;
  float phi = atan(-q.y, q.x);
  if (phi >= 1.5707963) return false;
  float k = clamp(floor(phi / TURN_CREATURE_STEP), 0.0, 3.0);
  float slot = (k + 0.5) * TURN_CREATURE_STEP;
  center = vec3(TURN_CX + TURN_R * cos(slot), turnTop(slot), TURN_CZ - TURN_R * sin(slot));
  yaw = slot + CREATURE_YAW_BIAS + (fract(sin((k + 17.0) * 12.9898) * 43758.5453) - 0.5) * 2.0 * CREATURE_YAW_JITTER;
  return true;
}
vec3 creatureLocalAt(vec3 p) {
  vec3 center;
  float yaw;
  if (turnCreatureSlot(p, center, yaw)) return creatureLocal(p, center, yaw);
  float cell;
  return creatureSpace(p, cell);
}

vec2 mapScene(vec3 p) {
  vec2 result = vec2(100.0, 0.0);

  // BWC_FACTORY_SHELL — panelled 48 x 12 x 18 m production hall.
  result = nearest(result, vec2(p.y, 1.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-5.60, 3.05, -3.0), vec3(0.16, 3.05, 12.5), 0.04), 1.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(5.55, 3.05, -3.0), vec3(0.13, 3.05, 12.5), 0.04), 1.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(0.0, 6.10, -3.0), vec3(5.7, 0.12, 12.5), 0.04), 3.0));
  // Back wall, behind the turn.
  result = nearest(result, vec2(sdRoundBox(p - vec3(0.0, 3.05, -15.6), vec3(5.7, 3.05, 0.14), 0.04), 1.0));
  vec3 wallBay = p;
  wallBay.z = mod(wallBay.z + 1.55, 3.10) - 1.55;
  result = nearest(result, vec2(sdRoundBox(wallBay - vec3(-5.32, 3.00, 0.0), vec3(0.18, 2.92, 0.09), 0.025), 2.0));
  result = nearest(result, vec2(sdRoundBox(wallBay - vec3(-5.15, 3.15, 0.0), vec3(0.09, 0.85, 1.35), 0.025), 1.0));
  result = nearest(result, vec2(sdRoundBox(wallBay - vec3(-5.02, 3.15, 0.0), vec3(0.055, 0.72, 0.22), 0.02), 7.0));
  // The right wall carries the same bays as the left, mirrored about the hall: each piece sits the same distance in front of its wall's
  // inner face (left face x -5.44, right face x 5.42).
  result = nearest(result, vec2(sdRoundBox(wallBay - vec3(5.30, 3.00, 0.0), vec3(0.18, 2.92, 0.09), 0.025), 2.0));
  result = nearest(result, vec2(sdRoundBox(wallBay - vec3(5.13, 3.15, 0.0), vec3(0.09, 0.85, 1.35), 0.025), 1.0));
  result = nearest(result, vec2(sdRoundBox(wallBay - vec3(5.00, 3.15, 0.0), vec3(0.055, 0.72, 0.22), 0.02), 7.0));
  vec3 roofBay = p;
  roofBay.z = mod(roofBay.z + 1.85, 3.70) - 1.85;
  result = nearest(result, vec2(sdRoundBox(roofBay - vec3(0.0, 5.72, 0.0), vec3(5.35, 0.09, 0.12), 0.025), 3.0));
  // Fluorescent tubes: one per bay, running the full width of the ceiling from the left wall to the right.
  result = nearest(result, vec2(sdRoundBox(roofBay - vec3(0.0, 5.66, -0.64), vec3(5.2, 0.035, 0.075), 0.018), 7.0));

  // BWC_CATWALKS — high left gallery with slim brass safety rails.
  result = nearest(result, vec2(sdRoundBox(p - vec3(-4.25, 3.70, -2.4), vec3(1.15, 0.12, 11.6), 0.035), 2.0));
  vec3 upperPost = p;
  upperPost.z = mod(upperPost.z + 0.75, 1.50) - 0.75;
  // Posts end at the top rail (y 4.58) rather than standing above it, so no peaks show against the pipes overhead.
  result = nearest(result, vec2(sdCylinderY(upperPost - vec3(-3.28, 4.16, 0.0), 0.045, 0.44), 8.0));
  result = nearest(result, vec2(sdCylinderY(upperPost - vec3(-5.12, 4.16, 0.0), 0.045, 0.44), 8.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-3.28, 4.58, -2.4), vec3(0.045, 0.045, 11.4), 0.02), 8.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-3.28, 4.12, -2.4), vec3(0.038, 0.038, 11.4), 0.018), 8.0));

  // BWC_CONVEYOR_PRIMARY — long infeed belt and polished guide rails.
  float conveyorHalf = 0.76 * u_conveyorWidth;
  result = nearest(result, vec2(sdRoundBox(p - vec3(-1.92, 0.62, -0.55), vec3(conveyorHalf, 0.18, 10.0), 0.055), 2.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-1.92, 0.82, -0.55), vec3(conveyorHalf * 0.82, 0.045, 9.95), 0.018), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-1.92 - conveyorHalf, 1.10, -0.55), vec3(0.045, 0.045, 10.0), 0.022), 2.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-1.92 + conveyorHalf, 1.10, -0.55), vec3(0.045, 0.045, 10.0), 0.022), 2.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-1.92 - conveyorHalf, 0.74, -0.55), vec3(0.075, 0.18, 10.0), 0.025), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-1.92 + conveyorHalf, 0.74, -0.55), vec3(0.075, 0.18, 10.0), 0.025), 3.0));
  vec3 conveyorSupport = p;
  conveyorSupport.z = mod(conveyorSupport.z + 0.72, 1.44) - 0.72;
  result = nearest(result, vec2(sdRoundBox(conveyorSupport - vec3(-1.92 - conveyorHalf, 0.34, 0.0), vec3(0.075, 0.34, 0.10), 0.025), 3.0));
  result = nearest(result, vec2(sdRoundBox(conveyorSupport - vec3(-1.92 + conveyorHalf, 0.34, 0.0), vec3(0.075, 0.34, 0.10), 0.025), 3.0));

  // BWC_CANS_PRIMARY — the BWC_CAN_PLAIN artifact (docs/BWC/BWC_Can_Plain_Ready.glb), enlarged to the manifest's 1 m
  // hero height at Can Scale 1, standing on the belt. Its own coordinates are metres with the origin at the base centre.
  if (p.z > -10.2 && p.z < 8.0) {
    float canSize = CAN_HERO_SCALE * u_canScale;
    vec3 canPoint = p - vec3(-1.92, 0.865, 0.0);
    canPoint.z = mod(canPoint.z + 0.64, 1.28) - 0.64;
    result = nearest(result, vec2(sdBwcCan(canPoint / canSize) * canSize, 5.0));
  }

  // BWC_CREATURES — the plush creature (docs/BWC/Ultra_White_Plush_Creature_Cinema2.glb) filling the right conveyor.
  if (p.x > 1.5 && p.x < 4.9 && p.z > CREATURE_Z_FIRST - 1.0 && p.z < CREATURE_Z_LAST + 1.0) {
    float cell;
    vec3 creaturePoint = creatureSpace(p, cell);
    vec2 creature = sdBwcCreature(creaturePoint);
    result = nearest(result, vec2(creature.x * CREATURE_SCALE, creature.y));
  }

  // Low right service walk matching the target's long perspective runway.
  result = nearest(result, vec2(sdRoundBox(p - vec3(3.18, 0.24, -0.7), vec3(1.20, 0.20, 10.0), 0.025), 2.0));
  vec3 deckPlate = p;
  deckPlate.z = mod(deckPlate.z + 0.62, 1.24) - 0.62;
  result = nearest(result, vec2(sdRoundBox(deckPlate - vec3(3.18, 0.47, 0.0), vec3(1.16, 0.035, 0.55), 0.012), 1.0));
  vec3 servicePost = p;
  servicePost.z = mod(servicePost.z + 0.82, 1.64) - 0.82;
  result = nearest(result, vec2(sdCylinderY(servicePost - vec3(1.98, 1.12, 0.0), 0.052, 0.66), 3.0));
  result = nearest(result, vec2(sdCylinderY(servicePost - vec3(4.38, 1.22, 0.0), 0.058, 0.76), 3.0));
  // The tall wall-side posts stop short of the camera end: the camera sits at z 8.85, so a post just ahead of it fills the right of the
  // frame with a black column and hides the wall bays behind it.
  if (p.z < 5.0) result = nearest(result, vec2(sdCylinderY(servicePost - vec3(4.86, 2.78, 0.0), 0.10, 2.30), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(1.98, 1.68, -0.7), vec3(0.048, 0.048, 10.0), 0.02), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(4.38, 1.82, -0.7), vec3(0.048, 0.048, 10.0), 0.02), 3.0));

  // BWC_CONVEYOR_TURN — the half-circle that carries the infeed belt around the back of the hall into the service walk. Along it the
  // belt's section (width, height, guard and rails) blends into the walk's, so both ends meet the straight runs without a step.
  vec2 turnQ = p.xz - vec2(TURN_CX, TURN_CZ);
  if (turnQ.y < 0.05 && turnQ.y > -TURN_R - 1.6 && abs(turnQ.x) < TURN_R + 1.6) {
    float turnR = length(turnQ);
    float turnT = clamp(1.0 - atan(-turnQ.y, turnQ.x) / 3.14159265, 0.0, 1.0);   // 0 at the infeed belt, 1 at the service walk
    float turnS = smoothstep(0.0, 1.0, turnT);
    float turnU = turnR - TURN_R;                                          // sideways offset from the centre line
    float turnCap = turnQ.y;                                               // ends the arc on the plane the straight runs start from
    float beltHalf = 0.76 * u_conveyorWidth;
    float halfWidth = mix(beltHalf, 1.20, turnS);
    float bodyY = mix(0.62, 0.24, turnS), bodyH = mix(0.18, 0.20, turnS);
    float deckY = mix(0.82, 0.47, turnS), deckH = mix(0.045, 0.035, turnS);
    float deckWide = mix(beltHalf * 0.82, 1.16, turnS);
    float railY = mix(1.10, 1.75, turnS), railOffset = mix(beltHalf, 1.20, turnS);
    result = nearest(result, vec2(max(sdRoundBox(vec3(turnU, p.y - bodyY, 0.0), vec3(halfWidth, bodyH, 1.0), 0.04), turnCap), 2.0));
    result = nearest(result, vec2(max(sdRoundBox(vec3(turnU, p.y - deckY, 0.0), vec3(deckWide, deckH, 1.0), 0.018), turnCap), mix(3.0, 1.0, step(0.5, turnS))));
    float guardH = mix(0.18, 0.02, turnS);
    result = nearest(result, vec2(max(sdRoundBox(vec3(abs(turnU) - beltHalf, p.y - mix(0.74, 0.45, turnS), 0.0), vec3(0.075, guardH, 1.0), 0.025), turnCap), 3.0));
    result = nearest(result, vec2(max(sdRoundBox(vec3(abs(turnU) - railOffset, p.y - railY, 0.0), vec3(0.047, 0.047, 1.0), 0.02), turnCap), mix(2.0, 3.0, step(0.5, turnS))));
    // Legs and rail posts every 0.30 rad of the arc.
    float stepAngle = 0.30;
    float turnPhi = atan(-turnQ.y, turnQ.x);
    float slot = mod(turnPhi + 0.5 * stepAngle, stepAngle) - 0.5 * stepAngle;
    vec3 turnLocal = vec3(abs(turnU) - railOffset, p.y, turnR * slot);
    float bodyBottom = max(bodyY - bodyH, 0.04);
    result = nearest(result, vec2(max(sdRoundBox(turnLocal - vec3(0.0, 0.5 * bodyBottom, 0.0), vec3(0.075, 0.5 * bodyBottom, 0.10), 0.025), turnCap), 3.0));
    float postBottom = bodyY + bodyH;
    result = nearest(result, vec2(max(sdCylinderY(turnLocal - vec3(0.0, 0.5 * (postBottom + railY), 0.0), 0.052, max(0.5 * (railY - postBottom), 0.02)), turnCap), 3.0));
    vec3 turnCanCenter;
    if (turnCanSlot(p, turnCanCenter)) {
      float turnCanSize = CAN_HERO_SCALE * u_canScale;
      result = nearest(result, vec2(sdBwcCan((p - turnCanCenter) / turnCanSize) * turnCanSize, 5.0));
    }
    vec3 turnCreatureCenter;
    float turnCreatureYaw;
    if (turnCreatureSlot(p, turnCreatureCenter, turnCreatureYaw)) {
      vec2 turnCreature = sdBwcCreature(creatureLocal(p, turnCreatureCenter, turnCreatureYaw));
      result = nearest(result, vec2(turnCreature.x * CREATURE_SCALE, turnCreature.y));
    }
  }

  // BWC_REACTOR_* — 6.45 m housing, green chamber and concentric armor.
  vec3 portalPoint = p - vec3(-0.38, 2.72, -3.55);
  portalPoint.xy /= u_portalScale;
  float portalFactor = min(u_portalScale, 1.0);
  result = nearest(result, vec2(sdCylinderZ(portalPoint - vec3(0.0, 0.0, 0.14), 1.46, 0.035) * portalFactor, 4.0));
  result = nearest(result, vec2(sdTorusZ(portalPoint, 1.52, 0.075) * portalFactor, 6.0));
  result = nearest(result, vec2(sdTorusZ(portalPoint, 1.72, 0.11) * portalFactor, 3.0));
  result = nearest(result, vec2(sdTorusZ(portalPoint, 2.02, 0.24) * portalFactor, 2.0));
  result = nearest(result, vec2(sdTorusZ(portalPoint, 2.30, 0.13) * portalFactor, 3.0));
  result = nearest(result, vec2(sdTorusZ(portalPoint, 2.48, 0.17) * portalFactor, 2.0));
  for (int i = 0; i < 8; i++) {
    float angle = float(i) * 0.785398;
    vec2 radial = vec2(cos(angle), sin(angle));
    vec3 clampPoint = portalPoint - vec3(radial * 2.23, -0.04);
    float c = cos(-angle), s = sin(-angle);
    clampPoint.xy = mat2(c, -s, s, c) * clampPoint.xy;
    result = nearest(result, vec2(sdRoundBox(clampPoint, vec3(0.31, 0.13, 0.34), 0.045) * portalFactor, 2.0));
  }
  result = nearest(result, vec2(sdRoundBox(p - vec3(-2.18, 0.72, -3.48), vec3(0.34, 0.72, 0.40), 0.055), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(1.42, 0.72, -3.48), vec3(0.34, 0.72, 0.40), 0.055), 3.0));

  // BWC_ENERGY_PIPES — five green manifolds and dark steel collars.
  vec3 hub = vec3(-0.38, 4.72, -3.52);
  // The four side pipes run under the ceiling tubes (centre line at most y 5.15, so their tops stay about 0.2 m below the tubes at
  // y 5.66) and finish on mounting flanges against the side walls. The fifth rises straight to the roof slab and stops in it.
  vec3 pipeA = vec3(-5.15, 5.15, 0.10), pipeB = vec3(-5.15, 5.10, -4.55);
  vec3 pipeC = vec3(-0.38, 6.15, -3.55), pipeD = vec3(5.15, 5.10, -4.72), pipeE = vec3(5.15, 5.10, -1.25);
  result = nearest(result, vec2(sdCapsule(p, hub, pipeA, 0.25), 6.0));
  result = nearest(result, vec2(sdCapsule(p, hub, pipeB, 0.25), 6.0));
  result = nearest(result, vec2(sdCapsule(p, hub, pipeC, 0.27), 6.0));
  result = nearest(result, vec2(sdCapsule(p, hub, pipeD, 0.25), 6.0));
  result = nearest(result, vec2(sdCapsule(p, hub, pipeE, 0.25), 6.0));
  // Wall flanges the four side pipes end on.
  result = nearest(result, vec2(sdRoundBox(p - vec3(-5.37, pipeA.y, pipeA.z), vec3(0.07, 0.40, 0.40), 0.03), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-5.37, pipeB.y, pipeB.z), vec3(0.07, 0.40, 0.40), 0.03), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(5.36, pipeD.y, pipeD.z), vec3(0.07, 0.40, 0.40), 0.03), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(5.36, pipeE.y, pipeE.z), vec3(0.07, 0.40, 0.40), 0.03), 3.0));
  result = nearest(result, vec2(length(p - hub) - 0.46, 3.0));
  result = nearest(result, vec2(length(p - mix(hub, pipeA, 0.36)) - 0.35, 3.0));
  result = nearest(result, vec2(length(p - mix(hub, pipeA, 0.72)) - 0.35, 3.0));
  result = nearest(result, vec2(length(p - mix(hub, pipeB, 0.52)) - 0.35, 3.0));
  result = nearest(result, vec2(length(p - mix(hub, pipeC, 0.50)) - 0.38, 3.0));
  result = nearest(result, vec2(length(p - mix(hub, pipeD, 0.50)) - 0.35, 3.0));
  result = nearest(result, vec2(length(p - mix(hub, pipeE, 0.52)) - 0.35, 3.0));
  return result;
}

vec2 raymarch(vec3 origin, vec3 direction) {
  float travel = 0.0, material = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec2 samplePoint = mapScene(origin + direction * travel);
    material = samplePoint.y;
    if (samplePoint.x < EPSILON || travel > MAX_DISTANCE) break;
    travel += samplePoint.x * 0.68;
  }
  return vec2(travel, material);
}
vec3 sceneNormal(vec3 p) {
  vec2 e = vec2(0.0023, 0.0);
  return normalize(vec3(
    mapScene(p + e.xyy).x - mapScene(p - e.xyy).x,
    mapScene(p + e.yxy).x - mapScene(p - e.yxy).x,
    mapScene(p + e.yyx).x - mapScene(p - e.yyx).x));
}
float softShadow(vec3 origin, vec3 direction) {
  float shade = 1.0, travel = 0.035;
  for (int i = 0; i < 28; i++) {
    float distanceToScene = mapScene(origin + direction * travel).x;
    shade = min(shade, 11.0 * distanceToScene / travel);
    travel += clamp(distanceToScene, 0.028, 0.42);
    if (distanceToScene < 0.001 || travel > 12.0) break;
  }
  return clamp(shade, 0.16, 1.0);
}

const vec3 CAMERA_POSITION = vec3(4.55, 3.18, 8.85);
const float PI = 3.14159265;

/*
 * The plain can's white with the three-claw emblem printed on the body, wrapped around it by arc length and turned to
 * face the camera (each can is a rotated copy of the same print, as on a real line). The emblem texture is sampled
 * unconditionally so its mip level is stable across the edge of the print.
 */
vec3 canColor(vec3 p) {
  float canSize = CAN_HERO_SCALE * u_canScale;
  vec3 q;
  vec2 toCamera;
  vec3 turnCenter;
  if (turnCanSlot(p, turnCenter)) {
    q = (p - turnCenter) / canSize;
    toCamera = CAMERA_POSITION.xz - turnCenter.xz;
  } else {
    vec3 local = p - vec3(-1.92, 0.865, 0.0);
    float zInCell = mod(local.z + 0.64, 1.28) - 0.64;
    q = vec3(local.x, local.y, zInCell) / canSize;
    toCamera = CAMERA_POSITION.xz - vec2(-1.92, local.z - zInCell);
  }
  float theta = atan(q.z, q.x) - atan(toCamera.y, toCamera.x);
  theta = mod(theta + PI, 2.0 * PI) - PI;
  vec2 uv = vec2(theta * EMBLEM_WRAP_RADIUS / EMBLEM_WIDTH + 0.5, 0.5 - (q.y - EMBLEM_CENTER_Y) / EMBLEM_HEIGHT);
  vec4 print = texture(u_canEmblem, clamp(uv, 0.001, 0.999));
  float onPrint = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * step(abs(theta), 1.4);
  return mix(u_canWhite, print.rgb, print.a * onPrint);
}

const vec3 CREATURE_IVORY = vec3(0.894, 0.886, 0.867);
const vec3 CREATURE_STITCH = vec3(0.761, 0.749, 0.710);
const vec3 CREATURE_COTTON = vec3(0.933, 0.925, 0.910);
const vec3 CREATURE_EYE = vec3(0.043, 0.051, 0.055);
const vec3 CREATURE_GLINT = vec3(1.0, 1.0, 0.992);
const vec3 CREATURE_THREAD = vec3(0.149, 0.157, 0.149);

/*
 * The creature's materials, from the artifact. The body wears its printed label, mapped with the mesh's own UVs
 * (u = 0.5 + atan2(x, z) / 2π, v = V0 - V1 y) and sampled at a level chosen from the distance, so there is no
 * dependence on screen-space derivatives across the edge of the creature.
 */
vec3 creatureColor(float material, vec3 p) {
  if (material < 10.5) {
    vec3 q = creatureLocalAt(p);
    vec2 uv = vec2(0.5 + atan(q.x, q.z) / (2.0 * PI), clamp(CREATURE_LABEL_V0 - CREATURE_LABEL_V1 * q.y, 0.0, 1.0));
    float footprint = length(p - CAMERA_POSITION) * (2.0 / max(u_resolution.y, 1.0)) / 2.22 / CREATURE_SCALE;
    float lod = max(log2(footprint / 0.0014), 0.0);
    vec3 printed = textureLod(u_creatureLabel, uv, lod).rgb;
    return mix(CREATURE_IVORY, printed, u_creatureLabelReady);
  }
  if (material < 11.5) return CREATURE_IVORY;
  if (material < 12.5) return CREATURE_STITCH;
  if (material < 13.5) return CREATURE_COTTON;
  if (material < 14.5) return CREATURE_EYE;
  if (material < 15.5) return CREATURE_GLINT;
  return CREATURE_THREAD;
}

vec3 materialColor(float material, vec3 p) {
  if (material > 9.5) return creatureColor(material, p);
  if (material < 1.5) {
    vec2 tile = abs(fract((p.xz + vec2(0.0, 0.18)) * vec2(0.42, 0.36)) - 0.5);
    float seams = smoothstep(0.465, 0.492, max(tile.x, tile.y));
    return mix(u_background * 1.34, u_darkMetal * 1.45, seams);
  }
  if (material < 2.5) return u_structure * 1.12;
  if (material < 3.5) return u_darkMetal * 1.35;
  if (material < 4.5) {
    float latticeA = 1.0 - smoothstep(0.018, 0.050, abs(sin(p.x * 8.0 + sin(p.y * 5.0))));
    float latticeB = 1.0 - smoothstep(0.020, 0.055, abs(sin(p.y * 7.5 - p.x * 1.8)));
    return mix(u_energy * 0.10, u_energy * 0.55, max(latticeA * 0.36, latticeB * 0.25));
  }
  // The can: one matte material (the artifact's roughness 0.6, metallic 0) with the emblem printed on it.
  if (material < 5.5) return canColor(p);
  if (material < 6.5) return mix(u_energy * 0.42, u_energy * 0.96, u_ledStrength / 1.5);
  if (material < 7.5) return vec3(0.82, 0.94, 1.0) * (0.72 + 0.28 * u_ledStrength);
  return vec3(0.52, 0.43, 0.12);
}

void main() {
  vec2 pixel = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / max(u_resolution.y, 1.0);
  vec3 camera = CAMERA_POSITION;
  vec3 target = vec3(-0.48, 2.22, -3.05);
  vec3 forward = normalize(target - camera);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec3 ray = normalize(forward * 2.22 + right * pixel.x + up * pixel.y);

  vec2 hit = raymarch(camera, ray);
  vec3 color = u_background * vec3(0.45, 0.68, 0.78);
  if (hit.x < MAX_DISTANCE) {
    vec3 point = camera + ray * hit.x;
    vec3 normal = sceneNormal(point);
    vec3 keyDirection = normalize(vec3(-0.55, 0.72, 0.42));
    vec3 fillDirection = normalize(vec3(0.62, 0.30, 0.72));
    float key = max(dot(normal, keyDirection), 0.0);
    float fill = max(dot(normal, fillDirection), 0.0);
    float shadow = softShadow(point + normal * 0.012, keyDirection);
    vec3 base = materialColor(hit.y, point);
    vec3 halfVector = normalize(keyDirection - ray);
    bool plainCan = hit.y > 4.5 && hit.y < 5.5;
    bool plush = hit.y > 9.5 && hit.y < 13.5;
    bool beadEye = hit.y > 13.5 && hit.y < 14.5;
    float gloss = plainCan ? 16.0 : beadEye ? 120.0 : plush ? 8.0 : 42.0;
    float specular = pow(max(dot(normal, halfVector), 0.0), gloss);
    color = base * (0.24 + key * shadow * 0.82 + fill * 0.30);
    color += vec3(0.70, 0.88, 1.0) * specular * (plainCan ? 0.30 : beadEye ? 1.1 : plush ? 0.06 : 0.64);
    // Fleece: a soft sheen at grazing angles, and the catchlights glow.
    color += base * (plush ? 1.0 : 0.0) * pow(1.0 - max(dot(normal, -ray), 0.0), 3.0) * 0.20;
    color += base * step(14.5, hit.y) * (1.0 - step(15.5, hit.y)) * 0.9;
    float energySurface = step(3.5, hit.y) * (1.0 - step(4.5, hit.y)) + step(5.5, hit.y) * (1.0 - step(6.5, hit.y));
    float whiteLight = step(6.5, hit.y) * (1.0 - step(7.5, hit.y));
    color += base * energySurface * (0.32 + u_ledStrength * 0.42);
    color += vec3(0.72, 0.90, 1.0) * whiteLight * (0.72 + u_ledStrength * 0.52);
    float distanceFog = smoothstep(15.0, 38.0, hit.x);
    color = mix(color, u_background * vec3(0.72, 0.92, 0.88), distanceFog * 0.42);
  }
  float vignette = 1.0 - smoothstep(0.42, 1.75, dot(pixel, pixel)) * 0.38;
  color *= vignette * u_intensity;
  color = color / (color + vec3(0.72));
  color = pow(max(color, 0.0), vec3(0.88));
  outColor = vec4(color, 1.0);
}
`

export class Cinema2BwcRenderer {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass
  private readonly emblem: WebGLTexture | null
  private readonly labelPlaceholder: WebGLTexture | null

  constructor(private readonly gl: WebGL2RenderingContext) {
    const uniforms = [
      'u_resolution', 'u_intensity', 'u_portalScale', 'u_canScale', 'u_conveyorWidth', 'u_ledStrength',
      'u_background', 'u_structure', 'u_canWhite', 'u_energy', 'u_darkMetal', 'u_canEmblem', 'u_creatureLabel', 'u_creatureLabelReady',
    ]
    const compiled = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema 2.0 BWC factory corridor v2',
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: uniforms,
    })
    if (!compiled.program) throw new Error(`BWC shader compilation failed: ${compiled.error.log}`)
    this.program = compiled.program
    this.pass = new FullscreenPass(gl)
    this.emblem = createEmblemTexture(gl)
    this.labelPlaceholder = createPlaceholderTexture(gl)
  }

  draw(state: Readonly<Cinema2BwcRenderState>): void {
    const p = this.program
    p.activate()
    p.setVec2('u_resolution', state.width, state.height)
    p.setFloat('u_intensity', state.intensity)
    p.setFloat('u_portalScale', state.portalScale)
    p.setFloat('u_canScale', state.canScale)
    p.setFloat('u_conveyorWidth', state.conveyorWidth)
    p.setFloat('u_ledStrength', state.ledStrength)
    p.setVec3('u_background', ...state.background)
    p.setVec3('u_structure', ...state.structure)
    p.setVec3('u_canWhite', ...state.canWhite)
    p.setVec3('u_energy', ...state.energy)
    p.setVec3('u_darkMetal', ...state.darkMetal)
    p.setFloat('u_creatureLabelReady', state.creatureLabel ? 1 : 0)
    const label = state.creatureLabel ?? this.labelPlaceholder
    this.pass.run(p, state.target, state.width, state.height, [
      ...(this.emblem ? [{ unit: 0, texture: this.emblem, uniformName: 'u_canEmblem' }] : []),
      ...(label ? [{ unit: 1, texture: label, uniformName: 'u_creatureLabel' }] : []),
    ])
  }

  estimateGpuBytes(): number { return 16 * 1024 + BWC_EMBLEM_TEXTURE_BYTES }
  dispose(): void {
    if (this.emblem) this.gl.deleteTexture(this.emblem)
    if (this.labelPlaceholder) this.gl.deleteTexture(this.labelPlaceholder)
    this.pass.dispose()
    this.program.dispose()
  }
}

/** The emblem as a mipmapped RGBA texture; where it cannot be drawn (no canvas) a single transparent texel, so no print. */
function createEmblemTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const texture = gl.createTexture()
  if (!texture) return null
  const art = rasterizeBwcEmblem()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  if (art) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, BWC_EMBLEM_TEXTURE_WIDTH, BWC_EMBLEM_TEXTURE_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, art as TexImageSource)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return texture
}

/** One ivory texel, bound to the label sampler until the shipped label has loaded. */
function createPlaceholderTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const texture = gl.createTexture()
  if (!texture) return null
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([228, 226, 221, 255]))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return texture
}
