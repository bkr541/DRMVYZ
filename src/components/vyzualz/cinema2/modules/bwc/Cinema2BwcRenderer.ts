import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'

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
out vec4 outColor;

#define MAX_STEPS 144
#define MAX_DISTANCE 42.0
#define EPSILON 0.0016

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
float sdTorusZ(vec3 p, float majorRadius, float minorRadius) {
  return length(vec2(length(p.xy) - majorRadius, p.z)) - minorRadius;
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
vec2 nearest(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

vec2 mapScene(vec3 p) {
  vec2 result = vec2(100.0, 0.0);

  // BWC_FACTORY_SHELL — panelled 48 x 12 x 18 m production hall.
  result = nearest(result, vec2(p.y, 1.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-5.60, 3.05, -1.0), vec3(0.16, 3.05, 10.5), 0.04), 1.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(5.55, 3.05, -1.0), vec3(0.13, 3.05, 10.5), 0.04), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(0.0, 6.10, -1.0), vec3(5.7, 0.12, 10.5), 0.04), 3.0));
  vec3 wallBay = p;
  wallBay.z = mod(wallBay.z + 1.55, 3.10) - 1.55;
  result = nearest(result, vec2(sdRoundBox(wallBay - vec3(-5.32, 3.00, 0.0), vec3(0.18, 2.92, 0.09), 0.025), 2.0));
  result = nearest(result, vec2(sdRoundBox(wallBay - vec3(-5.15, 3.15, 0.0), vec3(0.09, 0.85, 1.35), 0.025), 1.0));
  result = nearest(result, vec2(sdRoundBox(wallBay - vec3(-5.02, 3.15, 0.0), vec3(0.055, 0.72, 0.22), 0.02), 7.0));
  vec3 roofBay = p;
  roofBay.z = mod(roofBay.z + 1.85, 3.70) - 1.85;
  result = nearest(result, vec2(sdRoundBox(roofBay - vec3(0.0, 5.72, 0.0), vec3(5.35, 0.09, 0.12), 0.025), 3.0));
  result = nearest(result, vec2(sdRoundBox(roofBay - vec3(-2.85, 5.66, -0.64), vec3(1.02, 0.035, 0.075), 0.018), 7.0));

  // BWC_CATWALKS — high left gallery with slim brass safety rails.
  result = nearest(result, vec2(sdRoundBox(p - vec3(-4.25, 3.70, -1.0), vec3(1.15, 0.12, 10.2), 0.035), 2.0));
  vec3 upperPost = p;
  upperPost.z = mod(upperPost.z + 0.75, 1.50) - 0.75;
  result = nearest(result, vec2(sdCylinderY(upperPost - vec3(-3.28, 4.30, 0.0), 0.045, 0.58), 8.0));
  result = nearest(result, vec2(sdCylinderY(upperPost - vec3(-5.12, 4.30, 0.0), 0.045, 0.58), 8.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-3.28, 4.58, -1.0), vec3(0.045, 0.045, 10.0), 0.02), 8.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-3.28, 4.12, -1.0), vec3(0.038, 0.038, 10.0), 0.018), 8.0));

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

  // BWC_CANS_PRIMARY — the manifest's intentionally hero-scaled 1 m cans.
  if (p.z > -10.2 && p.z < 8.0) {
    vec3 canPoint = p - vec3(-1.92, 1.44, 0.0);
    canPoint.z = mod(canPoint.z + 0.64, 1.28) - 0.64;
    canPoint /= u_canScale;
    result = nearest(result, vec2(sdCylinderY(canPoint, 0.31, 0.56) * u_canScale, 5.0));
    result = nearest(result, vec2(sdCylinderY(canPoint - vec3(0.0, 0.565, 0.0), 0.275, 0.018) * u_canScale, 3.0));
    result = nearest(result, vec2(sdCylinderY(canPoint + vec3(0.0, 0.565, 0.0), 0.278, 0.018) * u_canScale, 3.0));
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
  result = nearest(result, vec2(sdCylinderY(servicePost - vec3(4.86, 2.78, 0.0), 0.10, 2.30), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(1.98, 1.68, -0.7), vec3(0.048, 0.048, 10.0), 0.02), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(4.38, 1.82, -0.7), vec3(0.048, 0.048, 10.0), 0.02), 3.0));

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
  vec3 pipeA = vec3(-4.70, 6.12, 0.10), pipeB = vec3(-4.50, 5.78, -4.55);
  vec3 pipeC = vec3(-0.38, 7.25, -3.55), pipeD = vec3(3.55, 5.85, -4.72), pipeE = vec3(4.45, 5.68, -1.25);
  result = nearest(result, vec2(sdCapsule(p, hub, pipeA, 0.25), 6.0));
  result = nearest(result, vec2(sdCapsule(p, hub, pipeB, 0.25), 6.0));
  result = nearest(result, vec2(sdCapsule(p, hub, pipeC, 0.27), 6.0));
  result = nearest(result, vec2(sdCapsule(p, hub, pipeD, 0.25), 6.0));
  result = nearest(result, vec2(sdCapsule(p, hub, pipeE, 0.25), 6.0));
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

vec3 materialColor(float material, vec3 p) {
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
  if (material < 5.5) {
    float bodyY = p.y - 1.44, bodyX = p.x + 1.92;
    float a = 1.0 - smoothstep(0.026, 0.055, abs(bodyX + 0.13 + sin(bodyY * 7.0) * 0.018));
    float b = 1.0 - smoothstep(0.026, 0.055, abs(bodyX + sin(bodyY * 7.8 + 1.0) * 0.018));
    float c = 1.0 - smoothstep(0.026, 0.055, abs(bodyX - 0.13 + sin(bodyY * 7.2 + 2.0) * 0.018));
    float logo = max(a, max(b, c)) * smoothstep(0.47, 0.28, abs(bodyY));
    return mix(u_canWhite, u_darkMetal * 1.8, logo);
  }
  if (material < 6.5) return mix(u_energy * 0.42, u_energy * 0.96, u_ledStrength / 1.5);
  if (material < 7.5) return vec3(0.82, 0.94, 1.0) * (0.72 + 0.28 * u_ledStrength);
  return vec3(0.52, 0.43, 0.12);
}

void main() {
  vec2 pixel = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / max(u_resolution.y, 1.0);
  vec3 camera = vec3(4.55, 3.18, 8.85);
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
    float gloss = hit.y > 4.5 && hit.y < 5.5 ? 82.0 : 42.0;
    float specular = pow(max(dot(normal, halfVector), 0.0), gloss);
    color = base * (0.24 + key * shadow * 0.82 + fill * 0.30);
    color += vec3(0.70, 0.88, 1.0) * specular * 0.64;
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

  constructor(private readonly gl: WebGL2RenderingContext) {
    const uniforms = [
      'u_resolution', 'u_intensity', 'u_portalScale', 'u_canScale', 'u_conveyorWidth', 'u_ledStrength',
      'u_background', 'u_structure', 'u_canWhite', 'u_energy', 'u_darkMetal',
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
    this.pass.run(p, state.target, state.width, state.height, [])
  }

  estimateGpuBytes(): number { return 16 * 1024 }
  dispose(): void { this.pass.dispose(); this.program.dispose() }
}
