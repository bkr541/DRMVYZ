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

#define MAX_STEPS 120
#define MAX_DISTANCE 35.0
#define EPSILON 0.0018

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float sdRoundBox(vec3 p, vec3 halfSize, float radius) {
  vec3 q = abs(p) - halfSize + radius;
  return min(max(q.x, max(q.y, q.z)), 0.0) + length(max(q, 0.0)) - radius;
}

float sdCylinderY(vec3 p, float radius, float halfHeight) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(radius, halfHeight);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdCylinderZ(vec3 p, float radius, float halfDepth) {
  vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(radius, halfDepth);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdTorusZ(vec3 p, float majorRadius, float minorRadius) {
  return length(vec2(length(p.xy) - majorRadius, p.z)) - minorRadius;
}

float sdTorusY(vec3 p, float majorRadius, float minorRadius) {
  return length(vec2(length(p.xz) - majorRadius, p.y)) - minorRadius;
}

vec2 nearest(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

vec2 mapScene(vec3 p) {
  vec2 result = vec2(p.y, 1.0);

  // Factory shell and structural ribs.
  result = nearest(result, vec2(sdRoundBox(p - vec3(0.0, 3.25, -5.25), vec3(6.8, 3.2, 0.22), 0.08), 2.0));
  for (int i = 0; i < 5; i++) {
    float x = -5.4 + float(i) * 2.7;
    result = nearest(result, vec2(sdRoundBox(p - vec3(x, 3.1, -4.92), vec3(0.10, 3.0, 0.12), 0.025), 3.0));
  }
  result = nearest(result, vec2(sdRoundBox(p - vec3(0.0, 5.35, -1.2), vec3(6.2, 0.12, 4.3), 0.04), 3.0));

  // Conveyor chassis, black belt and polished guide rails.
  float halfWidth = 0.92 * u_conveyorWidth;
  result = nearest(result, vec2(sdRoundBox(p - vec3(-0.70, 0.48, 0.65), vec3(halfWidth, 0.20, 4.45), 0.08), 2.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-0.70, 0.70, 0.65), vec3(halfWidth * 0.83, 0.055, 4.32), 0.025), 3.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-0.70 - halfWidth, 0.91, 0.65), vec3(0.055, 0.055, 4.38), 0.025), 2.0));
  result = nearest(result, vec2(sdRoundBox(p - vec3(-0.70 + halfWidth, 0.91, 0.65), vec3(0.055, 0.055, 4.38), 0.025), 2.0));

  // Static white cans staged along the production line.
  for (int i = 0; i < 5; i++) {
    float z = 3.75 - float(i) * 1.62;
    vec3 canPoint = p - vec3(-0.70, 1.28, z);
    canPoint /= u_canScale;
    float body = sdCylinderY(canPoint, 0.38, 0.67) * u_canScale;
    result = nearest(result, vec2(body, 5.0));
    float topRim = sdTorusY(canPoint - vec3(0.0, 0.68, 0.0), 0.33, 0.032) * u_canScale;
    float bottomRim = sdTorusY(canPoint + vec3(0.0, 0.68, 0.0), 0.34, 0.026) * u_canScale;
    result = nearest(result, vec2(min(topRim, bottomRim), 3.0));
    result = nearest(result, vec2(sdCylinderY(canPoint - vec3(0.0, 0.675, 0.0), 0.325, 0.018) * u_canScale, 3.0));
  }

  // Portal core, nested armor rings, luminous insert and radial clamps.
  vec3 portalPoint = p - vec3(-0.70, 2.38, -3.72);
  portalPoint.xy /= u_portalScale;
  float scaledDistance = min(u_portalScale, 1.0);
  result = nearest(result, vec2(sdCylinderZ(portalPoint, 1.48, 0.12) * scaledDistance, 4.0));
  result = nearest(result, vec2(sdTorusZ(portalPoint, 1.74, 0.22) * scaledDistance, 6.0));
  result = nearest(result, vec2(sdTorusZ(portalPoint, 2.08, 0.31) * scaledDistance, 2.0));
  result = nearest(result, vec2(sdTorusZ(portalPoint, 2.37, 0.10) * scaledDistance, 3.0));
  for (int i = 0; i < 8; i++) {
    float angle = float(i) * 0.785398;
    vec2 radial = vec2(cos(angle), sin(angle));
    vec3 clampPoint = portalPoint - vec3(radial * 2.18, 0.0);
    float c = cos(-angle), s = sin(-angle);
    clampPoint.xy = mat2(c, -s, s, c) * clampPoint.xy;
    result = nearest(result, vec2(sdRoundBox(clampPoint, vec3(0.34, 0.16, 0.40), 0.055) * scaledDistance, 2.0));
  }

  // Static overhead energy conduits establish the industrial production hall.
  result = nearest(result, vec2(sdCylinderY(p - vec3(-4.7, 2.85, -3.8), 0.56, 2.25), 2.0));
  result = nearest(result, vec2(sdCylinderY(p - vec3(4.5, 2.85, -4.0), 0.56, 2.25), 2.0));
  result = nearest(result, vec2(sdCylinderY(p - vec3(-4.7, 2.85, -3.8), 0.43, 1.62), 6.0));
  result = nearest(result, vec2(sdCylinderY(p - vec3(4.5, 2.85, -4.0), 0.43, 1.62), 6.0));
  return result;
}

vec2 raymarch(vec3 origin, vec3 direction) {
  float travel = 0.0;
  float material = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec2 samplePoint = mapScene(origin + direction * travel);
    material = samplePoint.y;
    if (samplePoint.x < EPSILON || travel > MAX_DISTANCE) break;
    travel += samplePoint.x * 0.72;
  }
  return vec2(travel, material);
}

vec3 sceneNormal(vec3 p) {
  vec2 e = vec2(0.0024, 0.0);
  return normalize(vec3(
    mapScene(p + e.xyy).x - mapScene(p - e.xyy).x,
    mapScene(p + e.yxy).x - mapScene(p - e.yxy).x,
    mapScene(p + e.yyx).x - mapScene(p - e.yyx).x
  ));
}

float softShadow(vec3 origin, vec3 direction) {
  float shade = 1.0;
  float travel = 0.03;
  for (int i = 0; i < 34; i++) {
    float distanceToScene = mapScene(origin + direction * travel).x;
    shade = min(shade, 12.0 * distanceToScene / travel);
    travel += clamp(distanceToScene, 0.025, 0.36);
    if (distanceToScene < 0.001 || travel > 11.0) break;
  }
  return clamp(shade, 0.20, 1.0);
}

vec3 materialColor(float material, vec3 p) {
  if (material < 1.5) {
    vec2 tile = abs(fract(p.xz * 0.42) - 0.5);
    float seams = smoothstep(0.47, 0.49, max(tile.x, tile.y));
    return mix(u_background * 1.28, u_structure * 0.34, seams);
  }
  if (material < 2.5) return u_structure;
  if (material < 3.5) return u_darkMetal;
  if (material < 4.5) {
    float cells = smoothstep(0.60, 0.92, hash21(floor(p.xy * 8.0)));
    return u_energy * (1.35 + cells * 0.95);
  }
  if (material < 5.5) {
    float localX = p.x + 0.70;
    float bodyY = p.y - 1.28;
    float strokeA = 1.0 - smoothstep(0.035, 0.075, abs(localX + 0.17 + sin(bodyY * 8.0) * 0.025));
    float strokeB = 1.0 - smoothstep(0.035, 0.075, abs(localX + sin(bodyY * 7.2 + 1.1) * 0.025));
    float strokeC = 1.0 - smoothstep(0.035, 0.075, abs(localX - 0.17 + sin(bodyY * 8.5 + 2.0) * 0.025));
    float logo = max(strokeA, max(strokeB, strokeC)) * smoothstep(0.55, 0.34, abs(bodyY));
    return mix(u_canWhite, u_energy * 0.72, logo);
  }
  return mix(u_energy * 0.48, u_energy * 1.35, u_ledStrength);
}

void main() {
  vec2 pixel = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / max(u_resolution.y, 1.0);
  vec3 camera = vec3(5.65, 4.35, 9.25);
  vec3 target = vec3(-0.55, 1.65, -1.10);
  vec3 forward = normalize(target - camera);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec3 ray = normalize(forward * 2.55 + right * pixel.x + up * pixel.y);

  vec2 hit = raymarch(camera, ray);
  vec3 color = u_background * vec3(0.60, 0.78, 0.92);
  if (hit.x < MAX_DISTANCE) {
    vec3 point = camera + ray * hit.x;
    vec3 normal = sceneNormal(point);
    vec3 lightDirection = normalize(vec3(-0.55, 0.74, 0.46));
    float diffuse = max(dot(normal, lightDirection), 0.0);
    float shadow = softShadow(point + normal * 0.012, lightDirection);
    vec3 base = materialColor(hit.y, point);
    float emissive = step(3.5, hit.y) * (1.0 - step(4.5, hit.y)) + step(5.5, hit.y);
    vec3 halfVector = normalize(lightDirection - ray);
    float specular = pow(max(dot(normal, halfVector), 0.0), hit.y > 4.5 && hit.y < 5.5 ? 72.0 : 34.0);
    color = base * (0.30 + diffuse * shadow * 0.92);
    color += vec3(0.82, 0.92, 1.0) * specular * 0.48;
    color += base * emissive * (0.72 + u_ledStrength * 0.75);
    color += u_energy * emissive * 0.18;
  }

  float vignette = 1.0 - smoothstep(0.36, 1.55, dot(pixel, pixel)) * 0.34;
  color *= vignette * u_intensity;
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
      label: 'Cinema 2.0 BWC static production portal',
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
