import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { ANCIENT_MACHINE_CORE_MAX_RADIUS, ANCIENT_MACHINE_CORE_RADIUS, CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS, CINEMA2_ANCIENT_MACHINE_PART_CODES, buildCinema2AncientMachineShaftDebris, packCinema2AncientMachineInstances } from './Cinema2AncientMachineLayout'
import { ANCIENT_MACHINE_ROCK_VARIANT_COUNT, buildCinema2AncientMachineRockGeometry } from './Cinema2AncientMachineRockGeometry'
import { ANCIENT_MACHINE_COLLAR_CENTER_Z, ANCIENT_MACHINE_COLLAR_INNER_RADIUS, ANCIENT_MACHINE_SHAFT_VERTEX_BYTES, buildCinema2AncientMachineShaft } from './Cinema2AncientMachineShaft'

const DEFAULT_SHAFT_BACKGROUND = [0.004, 0.006, 0.006] as const
const GLSL_CRYSTAL_CENTER = `vec3(0.0, 0.0, ${ANCIENT_MACHINE_COLLAR_CENTER_Z.toFixed(2)})`

const SHAFT_VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in float a_material;
uniform mat4 u_viewProjection;
out vec3 v_world;
flat out vec3 v_normal;
flat out float v_material;

void main() {
  v_world = a_position;
  v_normal = a_normal;
  v_material = a_material;
  gl_Position = u_viewProjection * vec4(a_position, 1.0);
}`

const SHAFT_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 v_world;
flat in vec3 v_normal;
flat in float v_material;
uniform vec3 u_cameraPosition;
uniform vec3 u_backgroundColor;
uniform vec3 u_internalColor;
uniform vec3 u_glyphColor;
out vec4 outColor;

void main() {
  float distanceToEye = length(u_cameraPosition - v_world);
  float air = smoothstep(11.0, 40.0, distanceToEye);
  vec3 airColor = vec3(0.079, 0.155, 0.182) + 1.35 * u_backgroundColor;
  vec3 normal = normalize(v_normal);
  vec3 color;
  if (v_material == 3.0 || v_material == 4.0) {
    color = (v_material == 3.0 ? u_internalColor : u_glyphColor) * (v_material == 3.0 ? 0.94 : 1.12);
  } else {
    vec3 viewDirection = normalize(u_cameraPosition - v_world);
    float key = max(0.0, dot(normal, normalize(vec3(-0.46, 0.78, 0.35))));
    float fill = max(0.0, dot(normal, normalize(vec3(0.38, -0.35, -0.70))));
    float edge = pow(1.0 - max(0.0, dot(normal, viewDirection)), 3.0);
    vec3 metal = v_material == 0.0 ? vec3(0.113, 0.159, 0.177) : vec3(0.215, 0.261, 0.282);
    if (v_material == 2.0) metal = vec3(0.43, 0.283, 0.148);
    if (v_material == 5.0) {
      float grooves = smoothstep(0.16, 0.26, fract(v_world.z * 5.0));
      metal *= mix(0.58, 1.13, grooves);
    }
    vec3 cell = floor(v_world * vec3(36.0, 32.0, 47.0));
    float grain = fract(sin(dot(cell, vec3(12.9898, 78.233, 23.337))) * 43758.5453);
    color = metal * (0.76 + key * 0.63 + fill * 0.36) * (0.93 + grain * 0.14);
    color += u_internalColor * (0.024 + edge * 0.05) * (0.5 + fill);
    if (v_material == 2.0) color += u_glyphColor * (key * 0.07 + edge * 0.08);
  }
  outColor = vec4(mix(color, airColor, air * 0.76), 1.0);
}`

const VERTEX_SOURCE = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec4 i_centerSizeX;
layout(location = 4) in vec4 i_sizeRotationKind;
layout(location = 5) in vec4 i_ringGroupRandom;
layout(location = 6) in vec4 i_reserved;
layout(location = 7) in vec3 a_surfaceTangent;
uniform mat4 u_viewProjection;
uniform float u_time;
uniform float u_rotationSpeed;
uniform float u_counterRotation;
uniform float u_mechanicalDepth;
uniform float u_lockProgress;
uniform float u_aperture;
uniform float u_build;
uniform float u_drop;
uniform float u_kick;
uniform float u_bass;
uniform int u_look;
out vec3 v_world;
out vec3 v_normal;
out vec2 v_uv;
flat out vec3 v_surfaceTangent;
out float v_lampDistance;
flat out float v_kind;
flat out float v_ring;
flat out float v_group;
flat out float v_random;

vec3 rotateBlock(vec3 point, vec3 c, vec3 s) {
  point.yz = mat2(c.x, -s.x, s.x, c.x) * point.yz;
  point.xz = mat2(c.y, -s.y, s.y, c.y) * point.xz;
  point.xy = mat2(c.z, -s.z, s.z, c.z) * point.xy;
  return point;
}

vec3 spinBlock(vec3 point, vec3 axis, float c, float s) {
  return point * c + cross(axis, point) * s + axis * dot(axis, point) * (1.0 - c);
}

void main() {
  float ring = i_ringGroupRandom.x;
  float kind = i_sizeRotationKind.w;
  vec3 center = i_centerSizeX.xyz;
  vec3 size = vec3(i_centerSizeX.w, i_sizeRotationKind.xy);
  v_uv = a_uv;
  v_kind = kind;
  v_ring = ring;
  v_group = i_ringGroupRandom.y;
  v_random = i_ringGroupRandom.z;
  v_lampDistance = 0.0;
  if (kind > 4.5) {
    float drift = u_time * (0.11 + v_random * 0.21) + v_random * 31.0;
    center += 0.21 * sin(vec3(1.0, 0.83, 0.71) * drift + vec3(0.0, 2.1, 4.2));
    vec3 angles = vec3(i_reserved.xy, i_sizeRotationKind.z);
    vec3 c = cos(angles);
    vec3 s = sin(angles);
    // Constant angular velocity around a different axis for each block.
    vec3 spinAxis = normalize(vec3(i_reserved.xy, 0.55 + v_random * 0.45));
    float speed = mix(0.32, 0.93, fract(v_random * 11.37)) / (1.0 + 0.75 * size.x);
    float spin = u_time * speed * mix(-1.0, 1.0, step(0.5, v_random));
    float spinC = cos(spin);
    float spinS = sin(spin);
    v_world = center + spinBlock(rotateBlock(a_position * size, c, s), spinAxis, spinC, spinS);
    v_normal = spinBlock(rotateBlock(a_normal / size, c, s), spinAxis, spinC, spinS);
    v_surfaceTangent = spinBlock(rotateBlock(a_surfaceTangent * size, c, s), spinAxis, spinC, spinS);
    // A slice through the rock makes the recessed band wrap continuously over the facets.
    v_lampDistance = dot(a_position, vec3(1.0, 0.18, -0.22)) - 0.08;
    gl_Position = u_viewProjection * vec4(v_world, 1.0);
    return;
  }
  float direction = mod(ring, 2.0) < 0.5 ? 1.0 : -max(0.05, u_counterRotation);
  float lookRate = u_look == 1 ? 1.8 : (u_look == 2 ? 0.24 : (u_look == 3 ? 0.95 : 0.55));
  float dynamicRotation = u_time * u_rotationSpeed * lookRate * direction * (0.35 + ring * 0.08);
  dynamicRotation += u_build * direction * ring * 0.018;
  const vec3 crystalCenter = ${GLSL_CRYSTAL_CENTER};
  center -= crystalCenter;
  vec3 radial = normalize(center);
  vec3 reference = abs(radial.y) > 0.92 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 tangent = normalize(cross(reference, radial));
  vec3 bitangent = cross(radial, tangent);
  // Look 3 (Counter Orrery) nests the rings as gimbals: each tilts a fixed step from the last. The others scatter them by the golden angle.
  float tilt = u_look == 3 ? ring * 0.62 : ring * 2.39996323;
  float tumble = u_look == 3 ? 1.15 : 0.52;
  vec3 axis = normalize(vec3(cos(tilt) * tumble, sin(tilt) * tumble, 0.85));
  float c = cos(dynamicRotation);
  float s = sin(dynamicRotation);
  float debris = step(3.5, kind);
  float bassDrive = smoothstep(0.035, 0.88, u_bass);
  float vibrationPhase = u_time * (19.0 + i_ringGroupRandom.z * 11.0) + i_ringGroupRandom.z * 31.0;
  float radialVibration = sin(vibrationPhase) * (0.035 + i_ringGroupRandom.z * 0.055);
  float tangentVibration = cos(vibrationPhase * 1.37 + i_ringGroupRandom.y * 1.7) * (0.025 + (1.0 - i_ringGroupRandom.z) * 0.045);
  center += debris * bassDrive * (radial * radialVibration + tangent * tangentVibration + bitangent * sin(vibrationPhase * 1.83) * 0.075);
  center *= 1.0 + (u_aperture * 0.018 + u_drop * 0.024) * debris;
  center += radial * (u_drop * (i_ringGroupRandom.z - 0.5) * 0.23 - u_build * ring * 0.012);
  center = spinBlock(center, axis, c, s);
  center.z *= 1.0 + (u_mechanicalDepth - 1.0) * 0.13;
  const float minShellRadius = ${(ANCIENT_MACHINE_CORE_MAX_RADIUS + .43).toFixed(2)};
  center *= max(1.0, minShellRadius / length(center));
  const float maxCollarRadius = ${(ANCIENT_MACHINE_COLLAR_INNER_RADIUS - .27).toFixed(2)};
  center.xy *= min(1.0, maxCollarRadius / max(length(center.xy), 0.001));
  float authoredRotation = i_sizeRotationKind.z;
  float rc = cos(authoredRotation);
  float rs = sin(authoredRotation);
  mat2 localRotation = mat2(rc, -rs, rs, rc);
  vec3 debrisExpansion = vec3(
    0.035 + i_ringGroupRandom.z * 0.075,
    0.045 + fract(i_ringGroupRandom.z * 3.71) * 0.085,
    0.03 + fract(i_ringGroupRandom.z * 6.13) * 0.065
  );
  size *= 1.0 + debris * bassDrive * debrisExpansion;
  if (kind > 2.5 && kind < 3.5) size.y *= 1.0 + u_kick * 0.55;
  if (u_look == 0) size *= mix(0.94, 1.0, u_lockProgress);
  vec3 local = a_position * size;
  local.xy = localRotation * local.xy;
  vec3 normal = a_normal / size;
  normal.xy = localRotation * normal.xy;
  vec3 surfaceTangent = a_surfaceTangent * size;
  surfaceTangent.xy = localRotation * surfaceTangent.xy;
  mat3 frame = mat3(tangent, bitangent, radial);
  v_world = crystalCenter + center + spinBlock(frame * local, axis, c, s);
  v_normal = spinBlock(frame * normal, axis, c, s);
  v_surfaceTangent = spinBlock(frame * surfaceTangent, axis, c, s);
  gl_Position = u_viewProjection * vec4(v_world, 1.0);
}`

const CORE_VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
uniform mat4 u_viewProjection;
uniform float u_time;
uniform float u_bass;
uniform float u_kick;
uniform float u_energy;
uniform float u_aperture;
uniform float u_drop;
out vec3 v_world;
out vec3 v_normal;
out vec3 v_crystalPosition;
out vec2 v_uv;

void main() {
  vec3 direction = normalize(a_position);
  float directionalWave = sin(dot(direction, vec3(5.7, 8.3, 6.1)) + u_time * 2.4);
  directionalWave += cos(dot(direction, vec3(-7.1, 4.9, 9.2)) - u_time * 1.65) * 0.55;
  float audioPressure = clamp(u_bass * 0.72 + u_energy * 0.2 + u_kick * 0.34, 0.0, 1.5);
  float radius = ${ANCIENT_MACHINE_CORE_RADIUS.toFixed(2)} * (1.0 + u_aperture * 0.16 + u_drop * 0.13 + audioPressure * 0.12);
  float crystalWarp = 1.0 + directionalWave * (0.018 + audioPressure * 0.025);
  vec3 world = ${GLSL_CRYSTAL_CENTER} + direction * min(radius * crystalWarp, ${ANCIENT_MACHINE_CORE_MAX_RADIUS.toFixed(2)});
  v_world = world;
  v_normal = normalize(a_normal + direction * directionalWave * audioPressure * 0.045);
  v_crystalPosition = direction;
  v_uv = a_uv;
  gl_Position = u_viewProjection * vec4(world, 1.0);
}`

const CORE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 v_world;
in vec3 v_normal;
in vec3 v_crystalPosition;
in vec2 v_uv;
uniform vec3 u_cameraPosition;
uniform vec3 u_glyphColor;
uniform vec3 u_internalColor;
uniform float u_time;
uniform float u_intensity;
uniform float u_energy;
uniform float u_bass;
uniform float u_kick;
uniform float u_drop;
uniform int u_look;
out vec4 outColor;

void main() {
  vec3 normal = normalize(v_normal);
  vec3 viewDirection = normalize(u_cameraPosition - v_world);
  float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.25);
  vec3 facetCell = floor((normalize(v_crystalPosition) + 1.0) * 5.5);
  float facet = fract(sin(dot(facetCell, vec3(17.17, 41.73, 73.31))) * 43758.5453);
  float veins = pow(0.5 + 0.5 * sin(v_uv.x * 34.0 + v_uv.y * 21.0 - u_time * 1.8 + facet * 5.0), 8.0);
  float pressure = clamp(u_bass * 0.78 + u_energy * 0.25 + u_kick * 0.48 + u_drop * 0.34, 0.0, 1.8);
  float heart = 0.72 + pressure * 1.35 + 0.12 * sin(u_time * (u_look == 1 ? 5.2 : 2.8));
  vec3 crystal = mix(u_internalColor * 0.58, u_glyphColor, 0.16 + facet * 0.22);
  crystal *= (heart + fresnel * (1.25 + pressure * 0.75) + veins * (0.24 + pressure * 0.42));
  crystal += u_internalColor * (0.28 + pressure * 0.55);
  outColor = vec4(crystal * u_intensity, 1.0);
}`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;
in vec3 v_world;
in vec3 v_normal;
in vec2 v_uv;
flat in vec3 v_surfaceTangent;
in float v_lampDistance;
flat in float v_kind;
flat in float v_ring;
flat in float v_group;
flat in float v_random;
uniform vec3 u_cameraPosition;
uniform vec3 u_metalColor;
uniform vec3 u_glyphColor;
uniform vec3 u_internalColor;
uniform float u_intensity;
uniform float u_rockLightIntensity;
uniform float u_glyphDensity;
uniform float u_energy;
uniform float u_beat;
uniform float u_kick;
uniform float u_snare;
uniform float u_downbeat;
uniform float u_phrase;
uniform float u_build;
uniform float u_drop;
uniform float u_quality;
uniform int u_look;
uniform bool u_hasRockMaterial;
uniform sampler2D u_rockMaterial;
out vec4 outColor;

float glyphEmission() {
  float cadence = 0.16 + u_energy * 0.22 + u_beat * 0.22 + u_downbeat * 0.42;
  cadence += u_kick * (0.18 + 0.16 * step(0.5, v_group)) + u_phrase * 0.18;
  if (u_look == 0) cadence *= 0.64 + 0.36 * step(mod(v_ring, 4.0), 0.5);
  if (u_look == 1) cadence *= 1.24;
  if (u_look == 2) cadence *= 0.5 + u_build * 0.65;
  if (u_look == 3) cadence *= 0.55 + 0.45 * step(mod(v_ring, 2.0), 0.5);
  return (0.12 + cadence * 2.5 + u_snare * 0.42 + u_drop * 1.25) * u_intensity;
}

float stripeCoverage(float position, float halfWidth, float pixelWidth) {
  return smoothstep(-pixelWidth, pixelWidth, position + halfWidth)
       - smoothstep(-pixelWidth, pixelWidth, position - halfWidth);
}

void main() {
  float lampPixelWidth = max(0.003, fwidth(v_lampDistance) * 0.55);
  if (v_random > mix(0.52, 1.0, u_quality) && v_kind > 0.5 && v_kind < 3.5) discard;
  vec3 normal = normalize(v_normal);
  vec3 viewDirection = normalize(u_cameraPosition - v_world);
  float diffuse = max(dot(normal, normalize(vec3(-0.35, 0.62, 0.7))), 0.0);
  float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.8);
  if (v_kind < 0.5 || v_kind > 2.5) {
    vec3 base = u_metalColor;
    vec3 surfaceLight = vec3(0.0);
    if (u_hasRockMaterial) {
      vec2 mirror = (step(vec2(0.5), fract(v_random * vec2(13.37, 21.91))) * 2.0 - 1.0);
      vec2 uv = 0.5 + (v_uv - 0.5) * mirror * 0.96;
      vec4 rock = texture(u_rockMaterial, vec2(uv.x, 1.0 - uv.y));
      vec2 xy = (rock.rg * 2.0 - 1.0) * vec2(mirror.x, -mirror.y);
      vec3 tangent = normalize(v_surfaceTangent);
      vec3 bitangent = cross(normal, tangent);
      normal = normalize(tangent * xy.x + bitangent * xy.y + normal * sqrt(max(0.01, 1.0 - dot(xy, xy))));
      vec3 key = normalize(vec3(-0.35, 0.62, 0.7));
      diffuse = max(dot(normal, key), 0.0);
      float highlight = pow(max(dot(normal, normalize(key + viewDirection)), 0.0), mix(52.0, 7.0, rock.a));
      float fissure = smoothstep(0.16, 0.75, rock.b);
      base = mix(base * 0.64, base * 0.30, fissure);
      surfaceLight = vec3(0.12, 0.15, 0.16) * highlight * (1.0 - rock.a * 0.75);
      surfaceLight += u_internalColor * fissure * 0.18;
    }
    vec3 metal = base * (0.48 + diffuse * 1.08 + rim * 0.48) + surfaceLight;
    float edge = 1.0 - smoothstep(0.0, 0.047, min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y)));
    vec3 fromCrystal = v_world - ${GLSL_CRYSTAL_CENTER};
    float coreSpill = 1.0 / (1.0 + 0.65 * dot(fromCrystal, fromCrystal));
    float rimFill = max(dot(normal, normalize(vec3(0.62, -0.3, 0.55))), 0.0);
    metal += u_internalColor * (0.022 * rimFill + 0.095 * coreSpill);
    metal += u_glyphColor * edge * (0.032 + diffuse * 0.072);
    if (v_kind > 4.5) {
      float overhead = max(0.0, dot(normal, normalize(vec3(-0.3, 0.85, 0.4))));
      metal *= 0.79 + 0.41 * v_random;
      metal += u_glyphColor * (0.084 * overhead + 0.035 * rim);
      float slot = stripeCoverage(v_lampDistance, 0.081, lampPixelWidth);
      float strip = stripeCoverage(v_lampDistance, 0.055, lampPixelWidth);
      metal *= 1.0 - 0.72 * slot;
      metal += u_internalColor * (max(0.0, glyphEmission()) * u_rockLightIntensity) * (0.92 * strip + 0.08 * slot);
    } else {
      metal += u_internalColor * (u_drop * 0.18 + u_build * 0.05) * (0.4 + v_random);
    }
    outColor = vec4(metal, 1.0);
    return;
  }
  float glyphGate = step(v_random, u_glyphDensity);
  vec3 emissionColor = v_kind > 1.5 ? u_internalColor : u_glyphColor;
  float edge = smoothstep(0.0, 0.12, min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y)));
  float emission = glyphEmission() * glyphGate;
  outColor = vec4(emissionColor * emission * mix(0.75, 1.0, edge), 1.0);
}`

export interface Cinema2AncientMachineDrawState {
  viewProjection: readonly number[]
  cameraPosition: readonly [number, number, number]
  rockMaterialTexture?: WebGLTexture | null
  backgroundColor?: readonly [number, number, number]
  timeSeconds: number
  look: number
  metalColor: readonly [number, number, number]
  glyphColor: readonly [number, number, number]
  internalColor: readonly [number, number, number]
  intensity: number
  rockLightIntensity?: number
  rotationSpeed: number
  counterRotation: number
  mechanicalDepth: number
  lockProgress: number
  aperture: number
  glyphDensity: number
  energy: number
  bass: number
  beat: number
  kick: number
  snare: number
  downbeat: number
  phrase: number
  build: number
  drop: number
  quality: number
}

interface MechanismBatch {
  vao: WebGLVertexArrayObject
  indexCount: number
  instanceCount: number
  bytes: number
}

export class Cinema2AncientMachineRenderer {
  private readonly shaftProgram: ShaderProgram
  private readonly shaftVao: WebGLVertexArrayObject
  private readonly shaftVertexCount: number
  private readonly program: ShaderProgram
  private readonly coreProgram: ShaderProgram
  private readonly mechanismBatches: readonly MechanismBatch[]
  private readonly coreVao: WebGLVertexArrayObject
  private readonly fallbackRockMaterial: WebGLTexture
  private readonly buffers: WebGLBuffer[] = []
  private readonly coreIndexCount: number
  private readonly gpuBytes: number
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, instances: Float32Array) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/AncientMachine/CeremonialMechanism',
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: [
        'u_viewProjection', 'u_cameraPosition', 'u_time', 'u_rotationSpeed', 'u_counterRotation', 'u_mechanicalDepth',
        'u_lockProgress', 'u_aperture', 'u_build', 'u_drop', 'u_kick', 'u_look', 'u_metalColor', 'u_glyphColor',
        'u_internalColor', 'u_intensity', 'u_glyphDensity', 'u_energy', 'u_bass', 'u_beat', 'u_snare', 'u_downbeat', 'u_phrase', 'u_quality',
        'u_rockMaterial', 'u_hasRockMaterial', 'u_rockLightIntensity',
      ],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program
    const debris = packCinema2AncientMachineInstances(buildCinema2AncientMachineShaftDebris())
    this.mechanismBatches = groupMechanismInstances(instances, debris).map((packed, group) =>
      this.createMechanismBatch(group === 0 ? buildBox() : buildCinema2AncientMachineRockGeometry(group - 1), packed))

    const coreResult = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/AncientMachine/EnergyCrystal',
      vertSrc: CORE_VERTEX_SOURCE,
      fragSrc: CORE_FRAGMENT_SOURCE,
      requiredUniforms: [
        'u_viewProjection', 'u_cameraPosition', 'u_time', 'u_bass', 'u_kick', 'u_energy', 'u_aperture', 'u_drop',
        'u_glyphColor', 'u_internalColor', 'u_intensity', 'u_look',
      ],
    })
    if (!coreResult.program) throw new Error(`Shader compilation failed at ${coreResult.error.stage} for "${coreResult.error.label}": ${coreResult.error.log}`)
    this.coreProgram = coreResult.program
    const sphere = buildSphere(20, 14)
    const coreVao = gl.createVertexArray()
    if (!coreVao) throw new Error('Cinema 2.0 Ancient Machine could not allocate the energy crystal vertex array.')
    this.coreVao = coreVao
    gl.bindVertexArray(coreVao)
    this.createBuffer(gl.ARRAY_BUFFER, sphere.vertices)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24)
    this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, sphere.indices)
    gl.bindVertexArray(null)
    this.coreIndexCount = sphere.indices.length

    const shaftResult = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/AncientMachine/ReactorShaft',
      vertSrc: SHAFT_VERTEX_SOURCE,
      fragSrc: SHAFT_FRAGMENT_SOURCE,
      requiredUniforms: ['u_viewProjection', 'u_cameraPosition', 'u_backgroundColor', 'u_internalColor', 'u_glyphColor'],
    })
    if (!shaftResult.program) throw new Error(`Shader compilation failed at ${shaftResult.error.stage} for "${shaftResult.error.label}": ${shaftResult.error.log}`)
    this.shaftProgram = shaftResult.program
    const shaftVao = gl.createVertexArray()
    if (!shaftVao) throw new Error('Cinema 2.0 Ancient Machine could not allocate the reactor shaft vertex array.')
    this.shaftVao = shaftVao
    const shaft = buildCinema2AncientMachineShaft()
    gl.bindVertexArray(shaftVao)
    this.createBuffer(gl.ARRAY_BUFFER, shaft)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, ANCIENT_MACHINE_SHAFT_VERTEX_BYTES, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, ANCIENT_MACHINE_SHAFT_VERTEX_BYTES, 12)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, ANCIENT_MACHINE_SHAFT_VERTEX_BYTES, 24)
    gl.bindVertexArray(null)
    this.shaftVertexCount = shaft.byteLength / ANCIENT_MACHINE_SHAFT_VERTEX_BYTES
    const fallbackRockMaterial = gl.createTexture()
    if (!fallbackRockMaterial) throw new Error('Cinema 2.0 Ancient Machine could not allocate a fallback rock texture.')
    this.fallbackRockMaterial = fallbackRockMaterial
    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null
    gl.bindTexture(gl.TEXTURE_2D, fallbackRockMaterial)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.bindTexture(gl.TEXTURE_2D, previousTexture)
    const mechanismBytes = this.mechanismBatches.reduce((bytes, batch) => bytes + batch.bytes, 0)
    this.gpuBytes = mechanismBytes + sphere.vertices.byteLength + sphere.indices.byteLength + shaft.byteLength + 4
    assertCinema2NoGlErrors(gl, 'Ancient Machine renderer setup')
  }

  estimateGpuBytes(): number { return this.gpuBytes }

  draw(state: Readonly<Cinema2AncientMachineDrawState>): void {
    if (this.disposed) return
    const { gl, program } = this
    const viewProjection = new Float32Array(state.viewProjection)
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND)
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.colorMask(true, true, true, true)
    const shaftProgram = this.shaftProgram
    shaftProgram.activate()
    shaftProgram.setMat4('u_viewProjection', viewProjection)
    shaftProgram.setVec3('u_cameraPosition', ...state.cameraPosition)
    shaftProgram.setVec3('u_backgroundColor', ...(state.backgroundColor ?? DEFAULT_SHAFT_BACKGROUND))
    shaftProgram.setVec3('u_internalColor', ...state.internalColor)
    shaftProgram.setVec3('u_glyphColor', ...state.glyphColor)
    gl.bindVertexArray(this.shaftVao)
    gl.drawArrays(gl.TRIANGLES, 0, this.shaftVertexCount)

    program.activate()
    program.setMat4('u_viewProjection', viewProjection)
    program.setVec3('u_cameraPosition', ...state.cameraPosition)
    for (const [name, value] of Object.entries({
      u_time: state.timeSeconds, u_rotationSpeed: state.rotationSpeed, u_counterRotation: state.counterRotation,
      u_mechanicalDepth: state.mechanicalDepth, u_lockProgress: state.lockProgress, u_aperture: state.aperture,
      u_glyphDensity: state.glyphDensity, u_intensity: state.intensity, u_rockLightIntensity: state.rockLightIntensity ?? 1,
      u_energy: state.energy, u_beat: state.beat,
      u_bass: state.bass, u_kick: state.kick, u_snare: state.snare, u_downbeat: state.downbeat, u_phrase: state.phrase,
      u_build: state.build, u_drop: state.drop, u_quality: state.quality,
    })) program.setFloat(name, value)
    program.setVec3('u_metalColor', ...state.metalColor)
    program.setVec3('u_glyphColor', ...state.glyphColor)
    program.setVec3('u_internalColor', ...state.internalColor)
    program.setInt('u_look', state.look)
    program.setInt('u_hasRockMaterial', state.rockMaterialTexture ? 1 : 0)
    program.setSampler('u_rockMaterial', 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, state.rockMaterialTexture ?? this.fallbackRockMaterial)
    for (const batch of this.mechanismBatches) {
      gl.bindVertexArray(batch.vao)
      gl.drawElementsInstanced(gl.TRIANGLES, batch.indexCount, gl.UNSIGNED_SHORT, 0, batch.instanceCount)
    }
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindVertexArray(null); gl.disable(gl.CULL_FACE)

    const coreProgram = this.coreProgram
    coreProgram.activate()
    coreProgram.setMat4('u_viewProjection', viewProjection)
    coreProgram.setVec3('u_cameraPosition', ...state.cameraPosition)
    coreProgram.setVec3('u_glyphColor', ...state.glyphColor)
    coreProgram.setVec3('u_internalColor', ...state.internalColor)
    for (const [name, value] of Object.entries({
      u_time: state.timeSeconds, u_bass: state.bass, u_kick: state.kick, u_energy: state.energy,
      u_aperture: state.aperture, u_drop: state.drop, u_intensity: state.intensity,
    })) coreProgram.setFloat(name, value)
    coreProgram.setInt('u_look', state.look)
    gl.bindVertexArray(this.coreVao)
    gl.drawElements(gl.TRIANGLES, this.coreIndexCount, gl.UNSIGNED_SHORT, 0)
    gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl, 'Ancient Machine draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer)
    this.gl.deleteTexture(this.fallbackRockMaterial)
    this.gl.deleteVertexArray(this.shaftVao); this.shaftProgram.dispose()
    for (const batch of this.mechanismBatches) this.gl.deleteVertexArray(batch.vao)
    this.gl.deleteVertexArray(this.coreVao)
    this.program.dispose(); this.coreProgram.dispose()
  }

  private createMechanismBatch(mesh: { vertices: Float32Array; indices: Uint16Array }, instances: Float32Array): MechanismBatch {
    const { gl } = this
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Cinema 2.0 Ancient Machine could not allocate a mechanism vertex array.')
    gl.bindVertexArray(vao)
    this.createBuffer(gl.ARRAY_BUFFER, mesh.vertices)
    for (const [attribute, size, offset] of [[0, 3, 0], [1, 3, 12], [2, 2, 24], [7, 3, 32]]) {
      gl.enableVertexAttribArray(attribute)
      gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 44, offset)
    }
    this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices)
    this.createBuffer(gl.ARRAY_BUFFER, instances)
    const stride = CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS * 4
    for (let attribute = 0; attribute < 4; attribute += 1) {
      gl.enableVertexAttribArray(3 + attribute)
      gl.vertexAttribPointer(3 + attribute, 4, gl.FLOAT, false, stride, attribute * 16)
      gl.vertexAttribDivisor(3 + attribute, 1)
    }
    gl.bindVertexArray(null)
    return {
      vao,
      indexCount: mesh.indices.length,
      instanceCount: instances.length / CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS,
      bytes: mesh.vertices.byteLength + mesh.indices.byteLength + instances.byteLength,
    }
  }

  private createBuffer(target: number, data: Float32Array | Uint16Array): void {
    const buffer = this.gl.createBuffer()
    if (!buffer) throw new Error('Cinema 2.0 Ancient Machine could not allocate a buffer.')
    this.gl.bindBuffer(target, buffer); this.gl.bufferData(target, data as ArrayBufferView<ArrayBuffer>, this.gl.STATIC_DRAW)
    this.buffers.push(buffer)
  }
}

function groupMechanismInstances(instances: Float32Array, debris: Float32Array): Float32Array[] {
  const stride = CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS
  const packed = new Float32Array(instances.length + debris.length)
  packed.set(instances)
  packed.set(debris, instances.length)
  const groups = Array.from({ length: ANCIENT_MACHINE_ROCK_VARIANT_COUNT + 1 }, (): number[] => [])
  const { glyph, 'internal-light': internalLight } = CINEMA2_ANCIENT_MACHINE_PART_CODES
  for (let offset = 0; offset < packed.length; offset += stride) {
    const kind = packed[offset + 7]!
    const random = packed[offset + 10]!
    const group = kind === glyph || kind === internalLight
      ? 0
      : Math.min(ANCIENT_MACHINE_ROCK_VARIANT_COUNT, 1 + Math.floor(random * ANCIENT_MACHINE_ROCK_VARIANT_COUNT))
    groups[group]!.push(offset)
  }
  return groups.map(offsets => {
    const group = new Float32Array(offsets.length * stride)
    offsets.forEach((offset, index) => group.set(packed.subarray(offset, offset + stride), index * stride))
    return group
  })
}

function buildSphere(longitudes: number, latitudes: number): { vertices: Float32Array; indices: Uint16Array } {
  const vertices: number[] = []
  const indices: number[] = []
  for (let latitude = 0; latitude <= latitudes; latitude += 1) {
    const v = latitude / latitudes
    const theta = v * Math.PI
    const ringRadius = Math.sin(theta)
    const y = Math.cos(theta)
    for (let longitude = 0; longitude <= longitudes; longitude += 1) {
      const u = longitude / longitudes
      const phi = u * Math.PI * 2
      const x = ringRadius * Math.cos(phi)
      const z = ringRadius * Math.sin(phi)
      vertices.push(x, y, z, x, y, z, u, v)
    }
  }
  const stride = longitudes + 1
  for (let latitude = 0; latitude < latitudes; latitude += 1) {
    for (let longitude = 0; longitude < longitudes; longitude += 1) {
      const topLeft = latitude * stride + longitude
      const bottomLeft = topLeft + stride
      indices.push(topLeft, bottomLeft, topLeft + 1, bottomLeft, bottomLeft + 1, topLeft + 1)
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}

function buildBox(): { vertices: Float32Array; indices: Uint16Array } {
  const faces: readonly (readonly [readonly number[], readonly number[], readonly number[]])[] = [
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  ]
  const vertices: number[] = []; const indices: number[] = []
  faces.forEach(([normal, tangent, bitangent], faceIndex) => {
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
      const su = u - 0.5; const sv = v - 0.5
      vertices.push(
        normal[0]! * 0.5 + tangent[0]! * su + bitangent[0]! * sv,
        normal[1]! * 0.5 + tangent[1]! * su + bitangent[1]! * sv,
        normal[2]! * 0.5 + tangent[2]! * su + bitangent[2]! * sv,
        ...normal, u, v, ...tangent,
      )
    }
    const base = faceIndex * 4; indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}
