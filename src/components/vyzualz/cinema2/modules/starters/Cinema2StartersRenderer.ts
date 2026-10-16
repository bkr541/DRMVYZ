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
  if (index == 0) return vec3(-1.72 * u_ballSpread, 0.69 + ballBounce(0.0), 1.03);
  if (index == 1) return vec3(0.02, 0.69 + ballBounce(2.1), 2.02);
  return vec3(1.72 * u_ballSpread, 0.69 + ballBounce(4.2), 1.03);
}

vec2 ballField(vec3 p, vec3 center) {
  float radius = 0.66 * u_ballScale;
  vec3 local = p - center;
  float sphere = length(local) - radius;
  float bandWidth = radius * 0.105;
  float material = abs(local.y) < bandWidth ? 8.0 : (local.y > 0.0 ? 6.0 : 7.0);
  vec2 result = vec2(sphere, material);

  // The black boss and inset silver button sit on the camera-facing equator.
  vec3 facing = normalize(vec3(0.18, 0.0, 1.0));
  vec3 bossCenter = center + facing * (radius * 0.91);
  float boss = length((p - bossCenter) * vec3(1.0, 1.0, 2.7)) - radius * 0.205;
  result = nearest(result, vec2(boss, 8.0));
  vec3 buttonCenter = center + facing * (radius * 1.015);
  float button = length((p - buttonCenter) * vec3(1.0, 1.0, 3.1)) - radius * 0.118;
  return nearest(result, vec2(button, 9.0));
}

vec2 mapScene(vec3 p) {
  vec2 result = vec2(p.y, 1.0);

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

  result = nearest(result, ballField(p, ballCenter(0)));
  result = nearest(result, ballField(p, ballCenter(1)));
  result = nearest(result, ballField(p, ballCenter(2)));
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
  if (material < 9.5) return u_metal * 1.16;
  return u_leather * 1.34;
}

vec3 backgroundColor(vec3 direction) {
  float height = clamp(direction.y * 0.9 + 0.45, 0.0, 1.0);
  vec3 deep = u_background * vec3(0.62, 0.92, 0.78);
  vec3 canopy = mix(u_background, u_grass * 0.34, 0.42);
  float foliage = fbm(direction.xz * 7.0 / max(0.18, abs(direction.y) + 0.18));
  vec3 color = mix(deep, canopy, height * 0.54 + foliage * 0.22);
  float bokeh = smoothstep(0.93, 0.995, hash21(floor(direction.xz * 34.0 + direction.xy * 11.0)));
  return color + u_grass * bokeh * 0.18;
}

void main() {
  vec2 pixel = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / max(u_resolution.y, 1.0);

  // Elevated three-quarter camera from the right, matching the approved view.
  vec3 camera = vec3(4.65, 5.05, 7.65);
  vec3 target = vec3(0.0, 0.96, 0.10);
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
    // Broad stepped light keeps the reference's illustrated, cel-painted finish.
    float toon = floor(halfLambert * 4.0 + 0.5) / 4.0;
    vec3 base = materialColor(hit.y, point);
    vec3 halfVector = normalize(lightDirection - ray);
    float gloss = pow(max(dot(normal, halfVector), 0.0), hit.y == 6.0 || hit.y == 7.0 || hit.y == 9.0 ? 46.0 : 24.0);
    float rim = pow(1.0 - max(dot(normal, -ray), 0.0), 3.5);
    color = base * (0.40 + 0.78 * toon) * ao;
    color += vec3(1.0, 0.91, 0.72) * gloss * (hit.y >= 6.0 ? 0.65 : 0.24);
    color += base * rim * 0.16;

    if (hit.y > 5.5 && hit.y < 6.5) {
      color += u_ballRed * (u_glow * 0.08 + u_energy * 0.10 + u_drop * 0.18);
    }
    color *= 1.0 + u_bass * 0.045 + u_snare * 0.035 + u_highs * gloss * 0.12;
  } else {
    color = backgroundColor(ray);
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
      'u_grassDensity', 'u_ambientMotion', 'u_glow', 'u_vignette', 'u_energy', 'u_bass',
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
