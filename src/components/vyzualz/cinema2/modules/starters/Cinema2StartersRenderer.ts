import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'

export interface Cinema2StartersRenderState {
  target: WebGLFramebuffer | null
  width: number
  height: number
  time: number
  intensity: number
  caseOpen: number
  ballSpread: number
  ballScale: number
  ballWiggle: number
  ballRotation: number
  cameraMotion: number
  cameraOrbit: number
  cameraPan: number
  cameraSpeed: number
  centerLight: number
  grassDensity: number
  ambientMotion: number
  glow: number
  vignette: number
  energy: number
  bass: number
  kick: number
  snare: number
  build: number
  drop: number
  highs: number
  background: readonly [number, number, number]
  grass: readonly [number, number, number]
  leather: readonly [number, number, number]
  ballRed: readonly [number, number, number]
  ballWhite: readonly [number, number, number]
  metal: readonly [number, number, number]
}

// A fully procedural 3D scene. The reference establishes the camera, object
// construction, arrangement, palette and illustrated lighting; no source image
// is sampled by this shader.
const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
uniform float u_caseOpen;
uniform float u_ballSpread;
uniform float u_ballScale;
uniform float u_ballWiggle;
uniform float u_ballRotation;
uniform float u_cameraMotion;
uniform float u_cameraOrbit;
uniform float u_cameraPan;
uniform float u_cameraSpeed;
uniform float u_centerLight;
uniform float u_grassDensity;
uniform float u_ambientMotion;
uniform float u_glow;
uniform float u_vignette;
uniform float u_energy;
uniform float u_bass;
uniform float u_kick;
uniform float u_snare;
uniform float u_build;
uniform float u_drop;
uniform float u_highs;
uniform vec3 u_background;
uniform vec3 u_grass;
uniform vec3 u_leather;
uniform vec3 u_ballRed;
uniform vec3 u_ballWhite;
uniform vec3 u_metal;
out vec4 outColor;

#define MAX_STEPS 112
#define MAX_DISTANCE 30.0
#define SURFACE_EPSILON 0.0018

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  for (int i = 0; i < 5; i++) {
    value += valueNoise(p) * amplitude;
    p = mat2(1.63, 1.21, -1.21, 1.63) * p;
    amplitude *= 0.5;
  }
  return value;
}

float sdRoundBox(vec3 p, vec3 halfSize, float radius) {
  vec3 q = abs(p) - halfSize + radius;
  return min(max(q.x, max(q.y, q.z)), 0.0) + length(max(q, 0.0)) - radius;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float radius) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - radius;
}

float sdEllipsoid(vec3 p, vec3 radii) {
  float normalizedDistance = length(p / radii) - 1.0;
  return normalizedDistance * min(radii.x, min(radii.y, radii.z));
}

float sdShortCylinder(vec3 p, vec3 axis, float radius, float halfDepth) {
  float axial = dot(p, axis);
  vec2 q = vec2(length(p - axis * axial) - radius, abs(axial) - halfDepth);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
}

vec3 rotateX(vec3 p, float angle) {
  float c = cos(angle), s = sin(angle);
  p.yz = mat2(c, -s, s, c) * p.yz;
  return p;
}

vec3 rotateY(vec3 p, float angle) {
  float c = cos(angle), s = sin(angle);
  p.xz = mat2(c, s, -s, c) * p.xz;
  return p;
}

vec3 rotateZ(vec3 p, float angle) {
  float c = cos(angle), s = sin(angle);
  p.xy = mat2(c, -s, s, c) * p.xy;
  return p;
}

vec2 nearest(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

vec3 lidPoint(vec3 p) {
  vec3 pivot = vec3(0.0, 1.43, -2.05);
  vec3 q = p - pivot;
  float angle = clamp(u_caseOpen + u_build * 0.08, 0.0, 1.0) * 1.18;
  float c = cos(angle);
  float s = sin(angle);
  q.yz = mat2(c, s, -s, c) * q.yz;
  return q - vec3(0.0, 0.42, 0.76);
}

float ballBounce(float phase) {
  float idle = sin(u_time * 1.5 + phase) * 0.035 * u_ambientMotion;
  return idle + (u_kick * 0.11 + u_drop * 0.15) * (0.78 + 0.22 * sin(phase));
}

vec3 ballCenter(int index) {
  float dropSpread = 1.0 + u_drop * 0.075;
  if (index == 0) return vec3(-1.72 * u_ballSpread * dropSpread, 0.69 + ballBounce(0.0), 1.03);
  if (index == 1) return vec3(0.02, 0.69 + ballBounce(2.1) + u_drop * 0.06, 2.02);
  return vec3(1.72 * u_ballSpread * dropSpread, 0.69 + ballBounce(4.2), 1.03);
}

vec2 ballField(vec3 p, vec3 center, int index) {
  float indexPhase = float(index) * 2.17;
  float direction = index == 1 ? -1.0 : 1.0;
  float musicalDrive = 0.18 + u_energy * 0.46 + u_bass * 0.36;
  float rock = sin(u_time * 1.570796 + indexPhase) * 0.115 * musicalDrive;
  rock += direction * (u_kick * 0.15 - u_snare * 0.095) + sin(u_time * 3.14159 + indexPhase) * u_highs * 0.035;
  rock *= u_ballWiggle;
  // Use a bounded camera-biased turn rather than an unlimited spin. The
  // reference motion reads as a rolling struggle, while its center button
  // remains a persistent focal point instead of rotating onto the far side.
  float turn = direction * sin(u_time * 0.48 + indexPhase) * 0.34 * u_ballRotation;
  turn += sin(u_time * 0.785398 + indexPhase) * 0.15 * u_ballWiggle * (0.3 + u_energy * 0.7);
  turn += direction * u_drop * 0.20 * u_ballRotation;

  float radius = 0.66 * u_ballScale * (1.0 + u_drop * 0.045 + u_kick * 0.018);
  vec3 originalLocal = p - center;
  vec3 local = originalLocal;
  local = rotateZ(local, -rock);
  local = rotateX(local, -rock * 0.28);
  local = rotateY(local, -turn);

  // The mounting bezel follows only part of the shell's turn. This keeps it
  // attached to the rocking gesture while retaining a visible circular face.
  vec3 buttonLocal = rotateZ(originalLocal, -rock * 0.58);
  buttonLocal = rotateX(buttonLocal, -rock * 0.16);
  buttonLocal = rotateY(buttonLocal, -turn * 0.30);

  // Proportions measured from the supplied Blender collection: independent
  // lacquered shells float over a slightly smaller black core, leaving a
  // recessed equatorial band instead of merely recolouring one sphere.
  vec2 result = vec2(length(local) - radius * 0.965, 8.0);
  float shellGap = radius * 0.052;
  float redShell = max(length(local) - radius, shellGap - local.y);
  float whiteShell = max(length(local) - radius, local.y + shellGap);
  result = nearest(result, vec2(redShell, 6.0));
  result = nearest(result, vec2(whiteShell, 7.0));

  // The source model uses two shallow circular parts: a broad black mounting
  // bezel and a smaller white release button. Aim them at the approved camera
  // so their circular silhouette and stepped depth remain clearly readable.
  vec3 facing = normalize(vec3(0.52, 0.0, 0.854));
  float bezel = sdShortCylinder(buttonLocal - facing * (radius * 0.965), facing, radius * 0.225, radius * 0.060);
  result = nearest(result, vec2(bezel, 8.0));
  float button = sdShortCylinder(buttonLocal - facing * (radius * 1.035), facing, radius * 0.132, radius * 0.038);
  return nearest(result, vec2(button, 9.0));
}

vec2 forestField(vec3 p) {
  // Repeated but irregular tree cells create a continuous rear woodland. All
  // trunks and shrubs begin at y=0, so they visibly emerge from the same 3D
  // grass plane as the hero objects instead of floating in a backdrop layer.
  float treeCell = floor((p.x + 1.7) / 3.4);
  float treeRandom = hash21(vec2(treeCell, 4.7));
  float rearArc = min(p.x * p.x, 30.0);
  float leftWing = smoothstep(2.5, 10.5, -p.x);
  vec3 treePoint = p;
  treePoint.x = mod(p.x + 1.7, 3.4) - 1.7;
  // The woodland occupies a shallow rear arc: the center of the tree line is
  // nearest and its outer edges recede, following the grass horizon instead
  // of reading as a straight row pasted behind the hero composition.
  float treeDepth = 14.40 + rearArc * 0.025 - leftWing * (6.35 + rearArc * 0.012);
  treePoint.z += treeDepth + (treeRandom - 0.5) * 0.50;
  float treeHeight = mix(3.70, 5.15, treeRandom);
  float treeSway = sin(u_time * 0.22 + treeCell * 1.71) * u_ambientMotion * (0.018 + u_bass * 0.026);
  treePoint.x -= treeSway * smoothstep(0.15, treeHeight, treePoint.y);

  float trunkRadius = mix(0.13, 0.20, hash21(vec2(treeCell, 8.3)));
  float trunk = sdCapsule(treePoint, vec3(0.0, 0.0, 0.0), vec3(treeSway * 1.6, treeHeight * 0.72, 0.0), trunkRadius);
  vec2 result = vec2(trunk, 11.0);

  vec3 crown = treePoint - vec3(treeSway * 1.5, treeHeight * 0.76, 0.0);
  float foliage = sdEllipsoid(crown, vec3(0.82, treeHeight * 0.25, 0.58));
  foliage = min(foliage, sdEllipsoid(crown - vec3(-0.55, -0.12, 0.05), vec3(0.58, treeHeight * 0.20, 0.50)));
  foliage = min(foliage, sdEllipsoid(crown - vec3(0.54, -0.06, -0.04), vec3(0.62, treeHeight * 0.21, 0.52)));
  foliage = min(foliage, sdEllipsoid(crown - vec3(0.02, 0.55, 0.02), vec3(0.56, treeHeight * 0.19, 0.46)));
  float leafBreakup = (fbm(treePoint.xy * 2.3 + treePoint.z) - 0.5) * 0.075;
  result = nearest(result, vec2(foliage + leafBreakup, 12.0));

  float shrubCell = floor((p.x + 0.85) / 1.7);
  float shrubRandom = hash21(vec2(shrubCell, 12.4));
  vec3 shrubPoint = p;
  shrubPoint.x = mod(p.x + 0.85, 1.7) - 0.85;
  float shrubDepth = 13.65 + rearArc * 0.023 - leftWing * (5.85 + rearArc * 0.010);
  shrubPoint.z += shrubDepth + (shrubRandom - 0.5) * 0.42;
  float shrubHeight = mix(0.66, 1.18, shrubRandom);
  shrubPoint.x -= sin(u_time * 0.28 + shrubCell) * u_ambientMotion * 0.012 * smoothstep(0.0, shrubHeight, shrubPoint.y);
  float shrub = sdEllipsoid(shrubPoint - vec3(0.0, shrubHeight * 0.48, 0.0), vec3(0.68, shrubHeight * 0.58, 0.48));
  shrub = min(shrub, sdEllipsoid(shrubPoint - vec3(-0.46, shrubHeight * 0.38, 0.04), vec3(0.43, shrubHeight * 0.43, 0.38)));
  shrub = min(shrub, sdEllipsoid(shrubPoint - vec3(0.45, shrubHeight * 0.34, -0.03), vec3(0.45, shrubHeight * 0.40, 0.36)));
  shrub += (fbm(shrubPoint.xy * 3.7 + shrubPoint.z * 1.8) - 0.5) * 0.055;
  result = nearest(result, vec2(shrub, 13.0));

  // Continue the rear perimeter around the left side with true world-space
  // clusters. Keeping these as separate SDF objects avoids distorting the
  // distance field while completing the curved woodland boundary.
  for (int i = 0; i < 4; i++) {
    float index = float(i);
    float sideRandom = hash21(vec2(index, 21.7));
    vec3 sideCenter = vec3(-5.25 - index * 3.12, 0.0, -13.25 + index * 3.86);
    vec3 sidePoint = p - sideCenter;
    float sideHeight = mix(3.45, 4.85, sideRandom);
    float sideSway = sin(u_time * 0.20 + index * 1.47) * u_ambientMotion * (0.018 + u_bass * 0.024);
    sidePoint.x -= sideSway * smoothstep(0.1, sideHeight, sidePoint.y);

    float sideTrunk = sdCapsule(sidePoint, vec3(0.0), vec3(sideSway * 1.5, sideHeight * 0.71, 0.0), mix(0.13, 0.19, sideRandom));
    result = nearest(result, vec2(sideTrunk, 11.0));
    vec3 sideCrown = sidePoint - vec3(sideSway * 1.4, sideHeight * 0.76, 0.0);
    float sideFoliage = sdEllipsoid(sideCrown, vec3(0.78, sideHeight * 0.24, 0.56));
    sideFoliage = min(sideFoliage, sdEllipsoid(sideCrown - vec3(-0.51, -0.10, 0.04), vec3(0.55, sideHeight * 0.19, 0.47)));
    sideFoliage = min(sideFoliage, sdEllipsoid(sideCrown - vec3(0.50, -0.04, -0.03), vec3(0.58, sideHeight * 0.20, 0.49)));
    sideFoliage += (fbm(sidePoint.xy * 2.35 + sidePoint.z) - 0.5) * 0.07;
    result = nearest(result, vec2(sideFoliage, 12.0));

    vec3 sideShrubPoint = p - (sideCenter + vec3(-1.25, 0.0, 0.36));
    float sideShrubHeight = mix(0.68, 1.08, hash21(vec2(index, 32.8)));
    float sideShrub = sdEllipsoid(sideShrubPoint - vec3(0.0, sideShrubHeight * 0.48, 0.0), vec3(1.18, sideShrubHeight * 0.58, 0.55));
    sideShrub += (fbm(sideShrubPoint.xy * 3.5 + sideShrubPoint.z * 1.7) - 0.5) * 0.05;
    result = nearest(result, vec2(sideShrub, 13.0));
  }
  return result;
}

vec2 mapScene(vec3 p) {
  vec2 result = vec2(p.y, 1.0);

  result = nearest(result, forestField(p));

  // Lower case and its visible right-side depth.
  result = nearest(result, vec2(sdRoundBox(p - vec3(0.0, 0.83, -1.18), vec3(2.70, 0.70, 0.93), 0.20), 2.0));

  // Dark front trim with an inset leather panel leaves a precise border.
  result = nearest(result, vec2(sdRoundBox(p - vec3(0.0, 0.92, -0.225), vec3(2.49, 0.49, 0.075), 0.16), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(0.0, 0.92, -0.135), vec3(2.35, 0.37, 0.045), 0.12), 2.0));

  // Hinged lid, its raised rim, straps and pale identification panel all share
  // one transform so Case Open remains a real geometric control.
  vec3 lp = lidPoint(p);
  result = nearest(result, vec2(sdRoundBox(lp, vec3(2.64, 0.36, 0.85), 0.18), 2.0));
  result = nearest(result, vec2(sdRoundBox(lp - vec3(0.0, 0.325, 0.0), vec3(2.45, 0.045, 0.73), 0.07), 10.0));
  result = nearest(result, vec2(sdRoundBox(lp - vec3(-1.26, 0.39, 0.0), vec3(0.16, 0.065, 0.88), 0.055), 3.0));
  result = nearest(result, vec2(sdRoundBox(lp - vec3(1.35, 0.39, 0.0), vec3(0.16, 0.065, 0.88), 0.055), 3.0));
  result = nearest(result, vec2(sdRoundBox(lp - vec3(-0.12, 0.395, 0.0), vec3(1.10, 0.018, 0.29), 0.035), 5.0));

  // Two catches and a substantial U-shaped leather handle on the front face.
  result = nearest(result, vec2(sdRoundBox(p - vec3(-1.34, 0.72, -0.055), vec3(0.28, 0.22, 0.10), 0.055), 4.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(1.34, 0.72, -0.055), vec3(0.28, 0.22, 0.10), 0.055), 4.0));
  result = nearest(result, vec2(sdCapsule(p, vec3(-0.72, 0.55, 0.04), vec3(-0.62, 0.18, 0.28), 0.13), 3.0));
  result = nearest(result, vec2(sdCapsule(p, vec3(-0.62, 0.18, 0.28), vec3(0.62, 0.18, 0.28), 0.13), 3.0));
  result = nearest(result, vec2(sdCapsule(p, vec3(0.62, 0.18, 0.28), vec3(0.72, 0.55, 0.04), 0.13), 3.0));

  result = nearest(result, ballField(p, ballCenter(0), 0));
  result = nearest(result, ballField(p, ballCenter(1), 1));
  result = nearest(result, ballField(p, ballCenter(2), 2));
  return result;
}

vec2 raymarch(vec3 origin, vec3 direction) {
  float travel = 0.0;
  float material = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec2 samplePoint = mapScene(origin + direction * travel);
    material = samplePoint.y;
    if (samplePoint.x < SURFACE_EPSILON || travel > MAX_DISTANCE) break;
    travel += samplePoint.x * 0.72;
  }
  return vec2(travel, material);
}

vec3 sceneNormal(vec3 p) {
  vec2 e = vec2(0.0025, 0.0);
  return normalize(vec3(
    mapScene(p + e.xyy).x - mapScene(p - e.xyy).x,
    mapScene(p + e.yxy).x - mapScene(p - e.yxy).x,
    mapScene(p + e.yyx).x - mapScene(p - e.yyx).x
  ));
}

float ambientOcclusion(vec3 p, vec3 normal) {
  float occlusion = 0.0;
  float scale = 1.0;
  for (int i = 1; i <= 5; i++) {
    float distanceAlongNormal = 0.045 * float(i);
    float sceneDistance = mapScene(p + normal * distanceAlongNormal).x;
    occlusion += (distanceAlongNormal - sceneDistance) * scale;
    scale *= 0.64;
  }
  return clamp(1.0 - occlusion * 2.6, 0.28, 1.0);
}

float softShadow(vec3 origin, vec3 direction) {
  float shade = 1.0;
  float travel = 0.025;
  for (int i = 0; i < 42; i++) {
    float distanceToScene = mapScene(origin + direction * travel).x;
    shade = min(shade, 13.0 * distanceToScene / travel);
    travel += clamp(distanceToScene, 0.025, 0.32);
    if (distanceToScene < 0.001 || travel > 12.0) break;
  }
  return clamp(shade, 0.18, 1.0);
}

vec3 grassColor(vec3 p) {
  float broad = fbm(p.xz * 0.72);
  float blades = pow(hash21(floor(p.xz * mix(8.0, 24.0, u_grassDensity))), 2.2);
  float fine = fbm(p.xz * 5.2 + vec2(8.0, -3.0));
  vec3 darkGrass = u_grass * vec3(0.24, 0.38, 0.25);
  vec3 brightGrass = u_grass * vec3(1.35, 1.10, 0.82);
  vec3 color = mix(darkGrass, brightGrass, clamp(broad * 0.62 + fine * 0.28 + blades * 0.34, 0.0, 1.0));
  vec2 cloverCell = fract(p.xz * 3.2) - 0.5;
  float cloverSeed = smoothstep(0.965, 0.995, hash21(floor(p.xz * 3.2)));
  float clover = cloverSeed * smoothstep(0.28, 0.06, length(cloverCell)) * u_grassDensity;
  return mix(color, vec3(0.38, 0.88, 0.14), clover * 0.65);
}

vec3 materialColor(float material, vec3 p) {
  if (material < 1.5) return grassColor(p);
  if (material < 2.5) {
    float leatherGrain = fbm(p.xz * 7.0 + p.xy * 2.0);
    return u_leather * mix(0.76, 1.18, leatherGrain);
  }
  if (material < 3.5) return u_leather * vec3(0.46, 0.34, 0.29);
  if (material < 4.5) return u_metal;
  if (material < 5.5) return vec3(0.88, 0.87, 0.79) * (0.95 + 0.05 * fbm(p.xz * 9.0));
  if (material < 6.5) return u_ballRed;
  if (material < 7.5) return u_ballWhite;
  if (material < 8.5) return vec3(0.012, 0.018, 0.018);
  if (material < 9.5) return u_ballWhite * 1.04;
  if (material < 10.5) return u_leather * 1.34;
  if (material < 11.5) {
    float barkGrain = fbm(p.xy * vec2(3.0, 7.0) + p.z * 1.4);
    return mix(vec3(0.095, 0.045, 0.018), u_leather * vec3(0.30, 0.22, 0.13), barkGrain);
  }
  if (material < 12.5) {
    float leaves = fbm(p.xy * 3.8 + p.z * 2.1);
    return mix(u_grass * vec3(0.18, 0.40, 0.16), u_grass * vec3(0.58, 0.76, 0.34), leaves);
  }
  float shrubLeaves = fbm(p.xz * 5.2 + p.y * 3.4);
  return mix(u_grass * vec3(0.24, 0.52, 0.20), u_grass * vec3(0.78, 0.90, 0.42), shrubLeaves);
}

float centerLightFlash() {
  float pulse = u_kick * 0.92 + u_snare * 0.68 + u_drop * 1.32;
  pulse += u_highs * 0.22 + u_energy * 0.12;
  return clamp(pulse * u_centerLight * (0.52 + u_glow * 0.48), 0.0, 1.75);
}

vec3 centerLightColor() {
  vec3 warm = vec3(1.0, 0.78, 0.18);
  vec3 green = vec3(0.20, 1.0, 0.58);
  vec3 red = vec3(1.0, 0.12, 0.055);
  vec3 color = mix(warm, green, step(0.5, mod(floor(u_time), 2.0)));
  color = mix(color, warm, clamp(u_kick, 0.0, 1.0));
  color = mix(color, green, clamp(u_snare + u_highs * 0.25, 0.0, 1.0));
  return mix(color, red, clamp(u_drop, 0.0, 1.0));
}

float coniferMask(vec2 p, float density, float baseline, float seed, float heightScale) {
  float cell = floor((p.x + seed) * density);
  float localX = fract((p.x + seed) * density) - 0.5;
  float random = hash21(vec2(cell, seed));
  float height = heightScale * mix(0.74, 1.18, random);
  float y = (p.y - baseline) / height;
  float tier = fract(y * 3.25);
  float crownWidth = mix(0.47, 0.025, clamp(y, 0.0, 1.0));
  crownWidth *= mix(0.78, 1.12, smoothstep(0.0, 0.42, tier));
  float crown = (1.0 - smoothstep(crownWidth - 0.035, crownWidth, abs(localX)))
    * smoothstep(-0.03, 0.025, y) * (1.0 - smoothstep(0.94, 1.0, y));
  float trunk = (1.0 - smoothstep(0.035, 0.055, abs(localX)))
    * smoothstep(-0.035, 0.015, y) * (1.0 - smoothstep(0.52, 0.66, y));
  return max(crown, trunk);
}

vec2 broadleafTreeMask(vec2 p, float density, float baseline, float seed, float heightScale) {
  float cell = floor((p.x + seed) * density);
  float localX = fract((p.x + seed) * density) - 0.5;
  float random = hash21(vec2(cell, seed));
  float height = heightScale * mix(0.76, 1.16, random);
  float y = (p.y - baseline) / height;
  float lean = (hash21(vec2(cell + 8.1, seed)) - 0.5) * 0.12 * y;
  float x = localX - lean;

  float trunkWidth = mix(0.048, 0.022, clamp(y / 0.72, 0.0, 1.0));
  float trunk = (1.0 - smoothstep(trunkWidth, trunkWidth + 0.022, abs(x)))
    * smoothstep(-0.035, 0.015, y) * (1.0 - smoothstep(0.67, 0.74, y));

  vec2 crownPoint = vec2(x * 1.50, (y - 0.70) * 1.08);
  float crown = 1.0 - smoothstep(0.31, 0.36, length(crownPoint));
  crown = max(crown, 1.0 - smoothstep(0.22, 0.28, length(crownPoint - vec2(-0.24, -0.04))));
  crown = max(crown, 1.0 - smoothstep(0.22, 0.28, length(crownPoint - vec2(0.24, -0.02))));
  crown = max(crown, 1.0 - smoothstep(0.20, 0.26, length(crownPoint - vec2(0.0, 0.24))));
  return vec2(crown * smoothstep(0.28, 0.38, y), trunk);
}

float shrubMask(vec2 p, float density, float baseline, float seed, float heightScale) {
  float cell = floor((p.x + seed) * density);
  float localX = fract((p.x + seed) * density) - 0.5;
  float random = hash21(vec2(cell, seed));
  float height = heightScale * mix(0.72, 1.28, random);
  float y = (p.y - baseline) / height;
  float arch = 1.0 - pow(abs(localX) * 1.72, 2.0);
  float crown = 1.0 - smoothstep(arch - 0.10, arch, y);
  return crown * smoothstep(-0.08, 0.04, y) * (1.0 - smoothstep(0.92, 1.02, y));
}

vec3 backgroundColor(vec3 direction, vec2 screenPoint) {
  float height = clamp(direction.y * 0.9 + 0.45, 0.0, 1.0);
  vec3 deep = u_background * vec3(0.62, 0.92, 0.78);
  vec3 canopy = mix(u_background, u_grass * 0.34, 0.42);
  float foliage = fbm(direction.xz * 7.0 / max(0.18, abs(direction.y) + 0.18));
  vec3 color = mix(deep, canopy, height * 0.54 + foliage * 0.22);
  float bokeh = smoothstep(0.93, 0.995, hash21(floor(direction.xz * 34.0 + direction.xy * 11.0)));
  color += u_grass * bokeh * 0.18;

  // Only a subdued far canopy remains in screen space. The readable trunks,
  // trees and shrubs are ray-marched geometry rooted in the grass plane.
  vec2 forestPoint = screenPoint;
  forestPoint.x += sin(u_time * 0.22 + screenPoint.y * 3.2) * u_ambientMotion * (0.002 + u_bass * 0.008);
  float farPines = coniferMask(forestPoint, 4.7, 0.56, 0.18, 0.58);
  farPines = max(farPines, coniferMask(forestPoint, 5.4, 0.55, 0.73, 0.48));
  vec3 farForest = mix(u_background * vec3(0.60, 1.10, 0.72), u_grass * vec3(0.28, 0.43, 0.24), 0.54);
  color = mix(color, farForest, farPines * 0.88);

  return color;
}

void main() {
  vec2 pixel = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / max(u_resolution.y, 1.0);

  // A bounded front-hemisphere orbit keeps the release buttons readable while
  // adding the familiar Cinema camera drift around the foreground trio.
  vec3 baseTarget = vec3(0.0, 0.96, 0.10);
  vec3 cameraOffset = vec3(4.65, 4.09, 7.55);
  float cameraPhase = u_time * mix(0.20, 0.72, u_cameraSpeed);
  float cameraAuthority = u_cameraMotion;
  float orbitAngle = sin(cameraPhase) * 0.16 * u_cameraOrbit * cameraAuthority;
  cameraOffset = rotateY(cameraOffset, orbitAngle);
  cameraOffset.y += sin(cameraPhase * 0.63 + 1.1) * 0.16 * u_cameraOrbit * cameraAuthority;
  float panAmount = sin(cameraPhase * 0.78 + 0.4) * 0.48 * u_cameraPan * cameraAuthority;
  vec3 target = baseTarget + vec3(panAmount, sin(cameraPhase * 0.52) * 0.035 * u_cameraPan * cameraAuthority, 0.0);
  vec3 camera = baseTarget + cameraOffset + vec3(panAmount * 0.28, 0.0, -u_drop * 0.10 * cameraAuthority);
  vec3 forward = normalize(target - camera);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec3 ray = normalize(forward * 2.70 + right * pixel.x + up * pixel.y);

  vec2 hit = raymarch(camera, ray);
  vec3 color;
  if (hit.x < MAX_DISTANCE) {
    vec3 point = camera + ray * hit.x;
    vec3 normal = sceneNormal(point);
    vec3 lightDirection = normalize(vec3(-0.62, 0.78, 0.48));
    float diffuse = max(dot(normal, lightDirection), 0.0);
    float shadow = softShadow(point + normal * 0.012, lightDirection);
    float ao = ambientOcclusion(point, normal);
    float halfLambert = 0.42 + 0.58 * diffuse * shadow;
    // Broad stepped light keeps the case and environment illustrated. The
    // supplied ball rendering is intentionally smoother and more reflective.
    float toon = floor(halfLambert * 4.0 + 0.5) / 4.0;
    bool ballSurface = hit.y >= 6.0 && hit.y < 10.0;
    float surfaceLight = ballSurface ? mix(halfLambert, diffuse * shadow, 0.32) : toon;
    vec3 base = materialColor(hit.y, point);
    vec3 halfVector = normalize(lightDirection - ray);
    float gloss = pow(max(dot(normal, halfVector), 0.0), ballSurface ? 58.0 : 24.0);
    float rim = pow(1.0 - max(dot(normal, -ray), 0.0), 3.5);
    color = base * (0.40 + 0.78 * surfaceLight) * ao;
    color += vec3(1.0, 0.94, 0.84) * gloss * (ballSurface ? 0.82 : 0.24);
    color += base * rim * 0.16;

    float centerFlash = centerLightFlash();
    if (hit.y > 8.5 && hit.y < 9.5) {
      vec3 lightColor = centerLightColor();
      color = mix(color, lightColor * (1.15 + centerFlash * 1.65), clamp(centerFlash, 0.0, 1.0));
      color += lightColor * centerFlash * 0.42;
    } else if (ballSurface) {
      color += centerLightColor() * centerFlash * 0.035;
    }

    if (hit.y > 5.5 && hit.y < 6.5) {
      color += u_ballRed * (u_glow * 0.08 + u_energy * 0.10 + u_drop * 0.18);
    }
    color *= 1.0 + u_bass * 0.045 + u_snare * 0.035 + u_highs * gloss * 0.12;
  } else {
    color = backgroundColor(ray, pixel);
  }

  float vignette = 1.0 - u_vignette * 0.36 * smoothstep(0.30, 1.22, dot(pixel, pixel));
  color *= vignette * u_intensity;
  color = pow(max(color, 0.0), vec3(0.92));
  outColor = vec4(color, 1.0);
}
`

export class Cinema2StartersRenderer {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass

  constructor(private readonly gl: WebGL2RenderingContext) {
    const uniforms = [
      'u_resolution', 'u_time', 'u_intensity', 'u_caseOpen', 'u_ballSpread', 'u_ballScale',
      'u_ballWiggle', 'u_ballRotation', 'u_cameraMotion', 'u_cameraOrbit', 'u_cameraPan', 'u_cameraSpeed',
      'u_centerLight', 'u_grassDensity', 'u_ambientMotion', 'u_glow', 'u_vignette', 'u_energy', 'u_bass',
      'u_kick', 'u_snare', 'u_build', 'u_drop', 'u_highs', 'u_background', 'u_grass',
      'u_leather', 'u_ballRed', 'u_ballWhite', 'u_metal',
    ]
    const compiled = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema 2.0 Starters procedural 3D scene',
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: uniforms,
    })
    if (!compiled.program) throw new Error(`Starters shader compilation failed: ${compiled.error.log}`)
    this.program = compiled.program
    this.pass = new FullscreenPass(gl)
  }

  draw(state: Readonly<Cinema2StartersRenderState>): void {
    const p = this.program
    p.activate()
    p.setVec2('u_resolution', state.width, state.height)
    p.setFloat('u_time', state.time)
    p.setFloat('u_intensity', state.intensity)
    p.setFloat('u_caseOpen', state.caseOpen)
    p.setFloat('u_ballSpread', state.ballSpread)
    p.setFloat('u_ballScale', state.ballScale)
    p.setFloat('u_ballWiggle', state.ballWiggle)
    p.setFloat('u_ballRotation', state.ballRotation)
    p.setFloat('u_cameraMotion', state.cameraMotion)
    p.setFloat('u_cameraOrbit', state.cameraOrbit)
    p.setFloat('u_cameraPan', state.cameraPan)
    p.setFloat('u_cameraSpeed', state.cameraSpeed)
    p.setFloat('u_centerLight', state.centerLight)
    p.setFloat('u_grassDensity', state.grassDensity)
    p.setFloat('u_ambientMotion', state.ambientMotion)
    p.setFloat('u_glow', state.glow)
    p.setFloat('u_vignette', state.vignette)
    p.setFloat('u_energy', state.energy)
    p.setFloat('u_bass', state.bass)
    p.setFloat('u_kick', state.kick)
    p.setFloat('u_snare', state.snare)
    p.setFloat('u_build', state.build)
    p.setFloat('u_drop', state.drop)
    p.setFloat('u_highs', state.highs)
    p.setVec3('u_background', ...state.background)
    p.setVec3('u_grass', ...state.grass)
    p.setVec3('u_leather', ...state.leather)
    p.setVec3('u_ballRed', ...state.ballRed)
    p.setVec3('u_ballWhite', ...state.ballWhite)
    p.setVec3('u_metal', ...state.metal)
    this.pass.run(p, state.target, state.width, state.height, [])
  }

  estimateGpuBytes(): number { return 16 * 1024 }
  dispose(): void { this.pass.dispose(); this.program.dispose() }
}
