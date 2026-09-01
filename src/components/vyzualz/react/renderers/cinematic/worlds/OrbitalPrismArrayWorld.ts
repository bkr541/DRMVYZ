import type { CinemaWorld3DObjectAnchor } from '../../../../cinema/CinemaWorld3DObject'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type {
  CinematicFrameContext,
  CinematicRendererResetReason,
  CinematicViewport,
  CinematicWebGLServices,
  CinematicWebGLWorldDefinition,
  CinematicWebGLWorldInitializeInput,
  CinematicWebGLWorldRenderer,
  CinematicWorldRenderTarget,
} from '../../CinematicWorldRenderer'
import { cinematicModulationValue } from '../CinematicAudioModulation'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'

interface MeshData {
  positions: Float32Array
  normals: Float32Array
  barycentrics: Float32Array
  vertexCount: number
}

interface MeshResource {
  vao: WebGLVertexArrayObject
  buffers: WebGLBuffer[]
  vertexCount: number
  instanceCount: number
}

interface ParticleResource {
  vao: WebGLVertexArrayObject
  buffers: WebGLBuffer[]
  count: number
}

interface Vec3 {
  x: number
  y: number
  z: number
}

interface Rgb {
  r: number
  g: number
  b: number
}

export interface OrbitalPrismComposition {
  crystalInstances: Float32Array
  ringInstances: Float32Array
  particles: Float32Array
  shardCount: number
  particleCount: number
}


export const ORBITAL_PRISM_ARRAY_OBJECT_ANCHOR: Readonly<CinemaWorld3DObjectAnchor> = Object.freeze({
  id: 'centerpiece',
  visible: true,
  transform: Object.freeze({
    position: Object.freeze([0, 0, 0] as const),
    rotation: Object.freeze([0, 0, 0] as const),
    scale: Object.freeze([1, 1, 1] as const),
  }),
  normalization: Object.freeze({ mode: 'fit-max-dimension' as const, size: 1.55 }),
  focusAnchor: Object.freeze([0, 0, 0] as const),
  framingPadding: 1.25,
})

export const ORBITAL_PRISM_RING_COUNT = 3
export const ORBITAL_PRISM_MAX_SHARDS = 18
export const ORBITAL_PRISM_MAX_PARTICLES = 132

const INSTANCE_FLOATS = 13
const INSTANCE_STRIDE = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT
const PARTICLE_FLOATS = 4
const ATTRIBUTES = {
  aPosition: 0,
  aNormal: 1,
  aBarycentric: 2,
  aInstancePosition: 3,
  aInstanceScale: 4,
  aInstanceRotation: 5,
  aInstanceSpin: 6,
  aInstanceTint: 7,
} as const

const REQUIRED_UNIFORMS = [
  'uViewProjection', 'uCameraPosition', 'uTime', 'uPointMode', 'uPointSize', 'uRole',
  'uPrimary', 'uSecondary', 'uAccent', 'uFogColor', 'uFogAmount', 'uFogDepth',
  'uIntensity', 'uGlow', 'uOpacity', 'uBrightness', 'uPrismScale', 'uPrismEnergy',
  'uRingMotion', 'uHighEnergy', 'uParticleEnergy', 'uBeatPulse', 'uDropPulse', 'uShardExpansion',
] as const

const VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aBarycentric;
layout(location=3) in vec3 aInstancePosition;
layout(location=4) in vec3 aInstanceScale;
layout(location=5) in vec3 aInstanceRotation;
layout(location=6) in vec3 aInstanceSpin;
layout(location=7) in float aInstanceTint;
uniform mat4 uViewProjection;
uniform float uTime;
uniform int uPointMode;
uniform float uPointSize;
uniform float uRole;
uniform float uPrismScale;
uniform float uRingMotion;
uniform float uHighEnergy;
uniform float uShardExpansion;
out vec3 vNormal;
out vec3 vBarycentric;
out vec3 vWorldPosition;
out float vTint;
flat out int vPointMode;
flat out int vShard;

vec3 rotateX(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}
vec3 rotateY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}
vec3 rotateZ(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
}
vec3 rotateEuler(vec3 p, vec3 a) {
  return rotateZ(rotateY(rotateX(p, a.x), a.y), a.z);
}

void main() {
  vPointMode = uPointMode;
  if (uPointMode == 1) {
    vWorldPosition = aPosition;
    vNormal = vec3(0.0, 0.0, 1.0);
    vBarycentric = vec3(1.0);
    vTint = aInstanceTint;
    vShard = 0;
    vec4 clip = uViewProjection * vec4(aPosition, 1.0);
    gl_Position = clip;
    gl_PointSize = uPointSize * clamp(3.6 / max(0.65, clip.w), 0.55, 1.5);
    return;
  }

  float phase = uTime;
  bool shard = uRole < 0.5 && gl_InstanceID > 0;
  if (uRole > 0.5) {
    phase += sin(uTime * 1.35 + float(gl_InstanceID) * 1.91) * uRingMotion * 0.30;
  } else if (shard) {
    phase += sin(uTime * 1.9 + float(gl_InstanceID) * 0.61) * uHighEnergy * 0.18;
  }

  vec3 angles = aInstanceRotation + aInstanceSpin * phase;
  vec3 local = aPosition * aInstanceScale;
  vec3 instancePosition = aInstancePosition;
  if (uRole < 0.5 && gl_InstanceID == 0) {
    local *= uPrismScale;
  } else if (shard) {
    instancePosition.xy *= 1.0 + uShardExpansion;
    float baseZ = instancePosition.z;
    instancePosition.z = baseZ >= 0.0
      ? baseZ * (1.0 - uShardExpansion * 0.45)
      : baseZ * (1.0 + uShardExpansion * 0.25);
  }
  vec3 world = rotateEuler(local, angles) + instancePosition;
  vec3 normal = normalize(rotateEuler(aNormal, angles));
  vWorldPosition = world;
  vNormal = normal;
  vBarycentric = aBarycentric;
  vTint = aInstanceTint;
  vShard = shard ? 1 : 0;
  gl_Position = uViewProjection * vec4(world, 1.0);
}
`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform vec3 uCameraPosition;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;
uniform vec3 uFogColor;
uniform float uFogAmount;
uniform float uFogDepth;
uniform float uIntensity;
uniform float uGlow;
uniform float uOpacity;
uniform float uBrightness;
uniform float uRole;
uniform float uPrismEnergy;
uniform float uRingMotion;
uniform float uHighEnergy;
uniform float uParticleEnergy;
uniform float uBeatPulse;
uniform float uDropPulse;
in vec3 vNormal;
in vec3 vBarycentric;
in vec3 vWorldPosition;
in float vTint;
flat in int vPointMode;
flat in int vShard;
out vec4 outColor;

vec3 palette(float t) {
  float x = clamp(t, 0.0, 1.0);
  if (x < 0.55) return mix(uPrimary, uSecondary, x / 0.55);
  return mix(uSecondary, uAccent, (x - 0.55) / 0.45);
}

void main() {
  vec3 base = palette(vTint);
  float distanceToCamera = length(uCameraPosition - vWorldPosition);
  float fog = clamp((distanceToCamera - uFogDepth * 0.35) / max(0.4, uFogDepth), 0.0, 1.0) * uFogAmount;

  if (vPointMode == 1) {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float radius = length(p);
    float particleBoost = 1.0 + uParticleEnergy * 0.62 + uBeatPulse * 0.16 + uDropPulse * 0.12;
    float alpha = (1.0 - smoothstep(0.12, 1.0, radius)) * uOpacity * (0.88 + uParticleEnergy * 0.12);
    vec3 sparkle = mix(base, vec3(1.0), 0.28) * (0.7 + uGlow * 0.5 + uBrightness * 0.2) * particleBoost;
    outColor = vec4(mix(sparkle, uFogColor, fog), alpha * (1.0 - fog * 0.7));
    return;
  }

  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
  vec3 lightDir = normalize(vec3(0.35, 0.72, 0.58));
  float diffuse = 0.28 + 0.72 * abs(dot(normal, lightDir));
  float rim = pow(1.0 - clamp(abs(dot(normal, viewDir)), 0.0, 1.0), 2.1);
  float edgeDistance = min(vBarycentric.x, min(vBarycentric.y, vBarycentric.z));
  float edge = 1.0 - smoothstep(0.018, 0.075, edgeDistance);
  float ringBoost = mix(1.0, 1.36, clamp(uRole, 0.0, 1.0));
  float reactiveGlow = uRole > 0.5
    ? uRingMotion * 0.08 + uBeatPulse * 0.22 + uDropPulse * 0.22
    : (vShard == 1
      ? uHighEnergy * 0.46 + uBeatPulse * 0.07 + uDropPulse * 0.18
      : uPrismEnergy * 0.52 + uBeatPulse * 0.24 + uDropPulse * 0.16);
  vec3 lit = base * (diffuse * (0.68 + uIntensity * 0.42) + 0.13);
  lit += mix(base, uAccent, 0.32) * rim * (0.34 + uGlow * 0.7);
  lit += mix(base, vec3(1.0), 0.46) * edge * (0.22 + uGlow * 0.52);
  lit *= ringBoost * (1.0 + max(0.0, uBrightness) * 0.35 + reactiveGlow);
  vec3 color = mix(lit, uFogColor, fog);
  outColor = vec4(color, uOpacity * (1.0 - fog * 0.58));
}
`

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function normalize(value: Vec3): Vec3 {
  const length = Math.hypot(value.x, value.y, value.z) || 1
  return { x: value.x / length, y: value.y / length, z: value.z / length }
}

function flatMesh(vertices: readonly Vec3[], faces: readonly (readonly [number, number, number])[]): MeshData {
  const positions: number[] = []
  const normals: number[] = []
  const barycentrics: number[] = []
  const bary = [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const
  for (const face of faces) {
    const a = vertices[face[0]]
    const b = vertices[face[1]]
    const c = vertices[face[2]]
    const normal = normalize(cross(subtract(b, a), subtract(c, a)))
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = vertices[face[corner]]
      positions.push(vertex.x, vertex.y, vertex.z)
      normals.push(normal.x, normal.y, normal.z)
      barycentrics.push(...bary[corner])
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    barycentrics: new Float32Array(barycentrics),
    vertexCount: positions.length / 3,
  }
}

function createCrystalMesh(): MeshData {
  const sides = 6
  const vertices: Vec3[] = [{ x: 0, y: 1.22, z: 0 }]
  for (let index = 0; index < sides; index += 1) {
    const angle = index / sides * Math.PI * 2
    vertices.push({ x: Math.cos(angle) * 0.62, y: 0.28, z: Math.sin(angle) * 0.62 })
  }
  for (let index = 0; index < sides; index += 1) {
    const angle = (index + 0.5) / sides * Math.PI * 2
    vertices.push({ x: Math.cos(angle) * 0.48, y: -0.48, z: Math.sin(angle) * 0.48 })
  }
  const bottomIndex = vertices.length
  vertices.push({ x: 0, y: -1.18, z: 0 })

  const faces: Array<readonly [number, number, number]> = []
  for (let index = 0; index < sides; index += 1) {
    const upper = 1 + index
    const upperNext = 1 + ((index + 1) % sides)
    const lower = 1 + sides + index
    const lowerNext = 1 + sides + ((index + 1) % sides)
    faces.push([0, upperNext, upper])
    faces.push([upper, upperNext, lowerNext], [upper, lowerNext, lower])
    faces.push([bottomIndex, lower, lowerNext])
  }
  return flatMesh(vertices, faces)
}

function createRingMesh(majorSegments = 48, tubeSegments = 5): MeshData {
  const vertices: Vec3[] = []
  const faces: Array<readonly [number, number, number]> = []
  const majorRadius = 1.42
  const tubeRadius = 0.025
  for (let major = 0; major < majorSegments; major += 1) {
    const a = major / majorSegments * Math.PI * 2
    for (let tube = 0; tube < tubeSegments; tube += 1) {
      const b = tube / tubeSegments * Math.PI * 2
      const radius = majorRadius + Math.cos(b) * tubeRadius
      vertices.push({
        x: Math.cos(a) * radius,
        y: Math.sin(b) * tubeRadius,
        z: Math.sin(a) * radius,
      })
    }
  }
  const indexOf = (major: number, tube: number) => (
    ((major + majorSegments) % majorSegments) * tubeSegments + ((tube + tubeSegments) % tubeSegments)
  )
  for (let major = 0; major < majorSegments; major += 1) {
    for (let tube = 0; tube < tubeSegments; tube += 1) {
      const a = indexOf(major, tube)
      const b = indexOf(major + 1, tube)
      const c = indexOf(major + 1, tube + 1)
      const d = indexOf(major, tube + 1)
      faces.push([a, b, c], [a, c, d])
    }
  }
  return flatMesh(vertices, faces)
}

function hashSeed(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return value >>> 0
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function writeInstance(
  target: Float32Array,
  index: number,
  position: Vec3,
  scale: Vec3,
  rotation: Vec3,
  spin: Vec3,
  tint: number,
): void {
  const offset = index * INSTANCE_FLOATS
  target.set([
    position.x, position.y, position.z,
    scale.x, scale.y, scale.z,
    rotation.x, rotation.y, rotation.z,
    spin.x, spin.y, spin.z,
    tint,
  ], offset)
}

export function createOrbitalPrismComposition(seed: number): OrbitalPrismComposition {
  const random = createSeededRandom(hashSeed(seed >>> 0, 0x4f52))
  const crystalInstances = new Float32Array((ORBITAL_PRISM_MAX_SHARDS + 1) * INSTANCE_FLOATS)
  writeInstance(
    crystalInstances,
    0,
    { x: 0, y: 0, z: 0 },
    { x: 0.86, y: 1.42, z: 0.86 },
    { x: 0.12, y: -0.18, z: 0.08 },
    { x: 0.025, y: 0.055, z: 0.018 },
    0.08,
  )

  for (let index = 0; index < ORBITAL_PRISM_MAX_SHARDS; index += 1) {
    const angle = random() * Math.PI * 2
    const elevation = (random() - 0.5) * 1.7
    const radius = 1.55 + random() * 1.2
    const z = (random() - 0.5) * 2.15 - 0.18
    writeInstance(
      crystalInstances,
      index + 1,
      {
        x: Math.cos(angle) * radius,
        y: elevation,
        z: Math.sin(angle) * radius * 0.42 + z,
      },
      {
        x: 0.075 + random() * 0.105,
        y: 0.24 + random() * 0.38,
        z: 0.065 + random() * 0.10,
      },
      {
        x: random() * Math.PI * 2,
        y: random() * Math.PI * 2,
        z: random() * Math.PI * 2,
      },
      {
        x: (random() - 0.5) * 0.12,
        y: (random() - 0.5) * 0.16,
        z: (random() - 0.5) * 0.10,
      },
      random(),
    )
  }

  const ringInstances = new Float32Array(ORBITAL_PRISM_RING_COUNT * INSTANCE_FLOATS)
  writeInstance(ringInstances, 0, { x: 0, y: 0.02, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 0.52, y: 0.18, z: 0.08 }, { x: 0.016, y: 0.026, z: 0.014 }, 0.06)
  writeInstance(ringInstances, 1, { x: 0, y: -0.02, z: 0 }, { x: 1.08, y: 0.92, z: 1.08 }, { x: -0.82, y: 0.74, z: 0.38 }, { x: -0.021, y: 0.013, z: 0.024 }, 0.58)
  writeInstance(ringInstances, 2, { x: 0, y: 0, z: 0 }, { x: 0.92, y: 1.10, z: 0.92 }, { x: 1.12, y: -0.42, z: -0.66 }, { x: 0.018, y: -0.022, z: 0.012 }, 0.94)

  const particles = new Float32Array(ORBITAL_PRISM_MAX_PARTICLES * PARTICLE_FLOATS)
  for (let index = 0; index < ORBITAL_PRISM_MAX_PARTICLES; index += 1) {
    const offset = index * PARTICLE_FLOATS
    const depth = -0.45 - random() * 7.2
    const spread = 1.25 + Math.abs(depth) * 0.42
    particles[offset] = (random() - 0.5) * spread * 2
    particles[offset + 1] = (random() - 0.5) * spread * 1.25
    particles[offset + 2] = depth
    particles[offset + 3] = random()
  }

  return {
    crystalInstances,
    ringInstances,
    particles,
    shardCount: ORBITAL_PRISM_MAX_SHARDS,
    particleCount: ORBITAL_PRISM_MAX_PARTICLES,
  }
}

export function resolveOrbitalPrismQualityCounts(
  qualityTier: CinematicFrameContext['config']['qualityTier'],
): { shardCount: number; particleCount: number } {
  switch (qualityTier) {
    case 'low': return { shardCount: 12, particleCount: 56 }
    case 'medium': return { shardCount: 14, particleCount: 80 }
    case 'ultra': return { shardCount: 18, particleCount: 132 }
    case 'auto': return { shardCount: 15, particleCount: 92 }
    default: return { shardCount: 16, particleCount: 108 }
  }
}

export interface OrbitalPrismReactivity {
  prismScale: number
  prismEnergy: number
  ringMotion: number
  highEnergy: number
  particleEnergy: number
  beatPulse: number
  dropPulse: number
  shardExpansion: number
}

function clampFinite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function resolveOrbitalPrismReactivity(
  modulation: CinematicFrameContext['modulation'],
  output: OrbitalPrismReactivity = {
    prismScale: 1, prismEnergy: 0, ringMotion: 0, highEnergy: 0,
    particleEnergy: 0, beatPulse: 0, dropPulse: 0, shardExpansion: 0,
  },
): OrbitalPrismReactivity {
  const bass = clampFinite(cinematicModulationValue(modulation, 'nodeScale'), 0, 1)
  const ringMotion = clampFinite(cinematicModulationValue(modulation, 'geometryRotation'), 0, 1)
  const highEnergy = clampFinite(cinematicModulationValue(modulation, 'edgeBrightness'), 0, 1)
  const particleEnergy = clampFinite(cinematicModulationValue(modulation, 'particleEmission'), 0, 1)
  const beatPulse = clampFinite(cinematicModulationValue(modulation, 'impact'), 0, 1)
  const dropPulse = clampFinite(cinematicModulationValue(modulation, 'burstImpulse'), 0, 1)

  output.prismScale = clampFinite(1 + bass * 0.085 + beatPulse * 0.022 + dropPulse * 0.014, 1, 1.12)
  output.prismEnergy = clampFinite(bass * 0.72 + beatPulse * 0.25 + dropPulse * 0.16, 0, 1)
  output.ringMotion = ringMotion
  output.highEnergy = highEnergy
  output.particleEnergy = clampFinite(Math.max(particleEnergy, highEnergy * 0.65), 0, 1)
  output.beatPulse = beatPulse
  output.dropPulse = dropPulse
  output.shardExpansion = clampFinite(dropPulse * 0.14, 0, 0.14)
  return output
}

function identityMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])
}

function translationMatrix(x: number, y: number, z: number): Float32Array {
  const matrix = identityMatrix()
  matrix[12] = x
  matrix[13] = y
  matrix[14] = z
  return matrix
}

function rotationXMatrix(angle: number): Float32Array {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ])
}

function rotationYMatrix(angle: number): Float32Array {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ])
}

function rotationZMatrix(angle: number): Float32Array {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return new Float32Array([
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])
}

function multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3]
    }
  }
  return out
}

function perspectiveMatrix(fieldOfViewDegrees: number, aspect: number, near = 0.05, far = 40): Float32Array {
  const f = 1 / Math.tan((fieldOfViewDegrees * Math.PI / 180) / 2)
  const rangeInv = 1 / (near - far)
  return new Float32Array([
    f / Math.max(0.01, aspect), 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * 2 * rangeInv, 0,
  ])
}

function viewProjectionMatrix(input: {
  position: Vec3
  rotation: Vec3
  fieldOfView: number
  aspect: number
}): Float32Array {
  const translation = translationMatrix(-input.position.x, -input.position.y, -input.position.z)
  const inverseRotation = multiplyMatrices(
    rotationZMatrix(-input.rotation.z),
    multiplyMatrices(rotationYMatrix(-input.rotation.y), rotationXMatrix(-input.rotation.x)),
  )
  return multiplyMatrices(perspectiveMatrix(input.fieldOfView, input.aspect), multiplyMatrices(inverseRotation, translation))
}

function createBuffer(gl: WebGL2RenderingContext, services: CinematicWebGLServices): WebGLBuffer {
  const buffer = gl.createBuffer()
  if (!buffer) throw new Error('Orbital Prism Array could not allocate a WebGL buffer')
  return services.resources.trackBuffer(buffer)
}

function createVertexArray(gl: WebGL2RenderingContext, services: CinematicWebGLServices): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()
  if (!vao) throw new Error('Orbital Prism Array could not allocate a vertex array')
  return services.resources.trackVAO(vao)
}

function bindStaticAttribute(
  gl: WebGL2RenderingContext,
  services: CinematicWebGLServices,
  location: number,
  size: number,
  data: Float32Array,
): WebGLBuffer {
  const buffer = createBuffer(gl, services)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
  return buffer
}

function bindInstanceAttributes(gl: WebGL2RenderingContext): void {
  const bind = (location: number, size: number, offsetFloats: number) => {
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, INSTANCE_STRIDE, offsetFloats * Float32Array.BYTES_PER_ELEMENT)
    gl.vertexAttribDivisor(location, 1)
  }
  bind(ATTRIBUTES.aInstancePosition, 3, 0)
  bind(ATTRIBUTES.aInstanceScale, 3, 3)
  bind(ATTRIBUTES.aInstanceRotation, 3, 6)
  bind(ATTRIBUTES.aInstanceSpin, 3, 9)
  bind(ATTRIBUTES.aInstanceTint, 1, 12)
}

function parseHexColor(value: string, fallback: Rgb): Rgb {
  const normalized = typeof value === 'string' ? value.trim().replace(/^#/, '') : ''
  const expanded = normalized.length === 3
    ? normalized.split('').map(character => `${character}${character}`).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return fallback
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16) / 255,
    g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
    b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
  }
}

function darken(color: Rgb, peak = 0.035): Rgb {
  const max = Math.max(color.r, color.g, color.b, 0.001)
  const scale = Math.min(1, peak / max)
  return { r: color.r * scale, g: color.g * scale, b: color.b * scale }
}

export class OrbitalPrismArrayWorld implements CinematicWebGLWorldRenderer {
  private services: CinematicWebGLServices | null = null
  private program: ShaderProgram | null = null
  private crystalResource: MeshResource | null = null
  private ringResource: MeshResource | null = null
  private particleResource: ParticleResource | null = null
  private composition: OrbitalPrismComposition | null = null
  private readonly reactivity: OrbitalPrismReactivity = {
    prismScale: 1, prismEnergy: 0, ringMotion: 0, highEnergy: 0,
    particleEnergy: 0, beatPulse: 0, dropPulse: 0, shardExpansion: 0,
  }
  private diagnostic: string | null = null
  private disposed = false

  initialize(input: CinematicWebGLWorldInitializeInput): void {
    this.services = input.services
    this.disposed = false
    this.program = input.services.compileProgram({
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      label: 'cinematic/world/orbitalPrismArray',
      attributes: ATTRIBUTES,
      requiredUniforms: [...REQUIRED_UNIFORMS],
    })
    this.composition = createOrbitalPrismComposition(input.config.seed)
    this.crystalResource = this.createMeshResource(createCrystalMesh(), this.composition.crystalInstances, ORBITAL_PRISM_MAX_SHARDS + 1)
    this.ringResource = this.createMeshResource(createRingMesh(), this.composition.ringInstances, ORBITAL_PRISM_RING_COUNT)
    this.particleResource = this.createParticleResource(this.composition.particles)
    this.diagnostic = null
  }

  resize(_viewport: CinematicViewport): void {}

  getDiagnostic(): string | null {
    return this.diagnostic
  }

  render(frame: CinematicFrameContext, target: CinematicWorldRenderTarget): void {
    if (this.disposed || !this.services || !this.program || !this.crystalResource || !this.ringResource || !this.particleResource) {
      this.diagnostic = 'Orbital Prism Array paused because required WebGL resources are unavailable.'
      return
    }
    if (target.width <= 0 || target.height <= 0 || !Number.isFinite(target.width) || !Number.isFinite(target.height)) {
      this.diagnostic = 'Orbital Prism Array paused because the render target is invalid.'
      return
    }
    this.diagnostic = null

    const gl = this.services.gl
    const camera = frame.camera?.pose ?? {
      position: { x: 0, y: 0, z: 4.4 },
      rotation: { x: 0, y: 0, z: 0 },
      fieldOfView: 58,
    }
    const viewProjection = viewProjectionMatrix({
      position: camera.position,
      rotation: camera.rotation,
      fieldOfView: camera.fieldOfView,
      aspect: target.width / Math.max(1, target.height),
    })
    if (!Array.from(viewProjection).every(Number.isFinite)) {
      this.diagnostic = 'Orbital Prism Array paused because the camera frame is invalid.'
      return
    }

    const primary = parseHexColor(frame.preset.palette.primary, { r: 0.05, g: 0.88, b: 0.94 })
    const secondary = parseHexColor(frame.preset.palette.secondary, { r: 0.94, g: 0.18, b: 0.70 })
    const accent = parseHexColor(frame.preset.palette.accent, { r: 0.93, g: 0.69, b: 0.25 })
    const background = darken(parseHexColor(frame.preset.palette.background, { r: 0.002, g: 0.006, b: 0.018 }))
    const fogColor = darken({
      r: background.r * 0.7 + primary.r * 0.3,
      g: background.g * 0.7 + primary.g * 0.3,
      b: background.b * 0.7 + primary.b * 0.3,
    }, 0.06)
    const quality = resolveOrbitalPrismQualityCounts(frame.config.qualityTier)
    const motion = Math.min(1, Math.max(0, frame.params.motion))
    const intensity = Math.min(1, Math.max(0, frame.params.intensity))
    const glow = Math.min(1.5, Math.max(0, frame.params.glow * frame.config.material.glow))
    const brightness = cinematicModulationValue(frame.modulation, 'environmentBrightness')
    const reactivity = resolveOrbitalPrismReactivity(frame.modulation, this.reactivity)
    const time = frame.elapsedTimeSec * (0.32 + motion * 0.68)

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
    gl.clearColor(background.r, background.g, background.b, 1)
    gl.clearDepth(1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    this.program.activate()
    this.program.setMat4('uViewProjection', viewProjection)
    this.program.setVec3('uCameraPosition', camera.position.x, camera.position.y, camera.position.z)
    this.program.setFloat('uTime', time)
    this.program.setVec3('uPrimary', primary.r, primary.g, primary.b)
    this.program.setVec3('uSecondary', secondary.r, secondary.g, secondary.b)
    this.program.setVec3('uAccent', accent.r, accent.g, accent.b)
    this.program.setVec3('uFogColor', fogColor.r, fogColor.g, fogColor.b)
    this.program.setFloat('uFogAmount', Math.min(1, Math.max(0, frame.config.environment.fog)))
    this.program.setFloat('uFogDepth', 2.7 + Math.min(1, Math.max(0, frame.config.environment.depth)) * 3.8)
    this.program.setFloat('uIntensity', intensity)
    this.program.setFloat('uGlow', glow)
    this.program.setFloat('uBrightness', brightness)
    this.program.setFloat('uPrismScale', reactivity.prismScale)
    this.program.setFloat('uPrismEnergy', reactivity.prismEnergy)
    this.program.setFloat('uRingMotion', reactivity.ringMotion)
    this.program.setFloat('uHighEnergy', reactivity.highEnergy)
    this.program.setFloat('uParticleEnergy', reactivity.particleEnergy)
    this.program.setFloat('uBeatPulse', reactivity.beatPulse)
    this.program.setFloat('uDropPulse', reactivity.dropPulse)
    this.program.setFloat('uShardExpansion', reactivity.shardExpansion)
    this.program.setFloat('uPointSize', 2.4)

    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.disable(gl.BLEND)
    gl.depthMask(true)
    this.program.setInt('uPointMode', 0)
    this.program.setFloat('uRole', 0)
    this.program.setFloat('uOpacity', 0.96)
    gl.bindVertexArray(this.crystalResource.vao)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.crystalResource.vertexCount, quality.shardCount + 1)

    const embeddedObject = this.services.object3d?.draw(ORBITAL_PRISM_ARRAY_OBJECT_ANCHOR)
    if (embeddedObject?.error) this.diagnostic = embeddedObject.error
    if (embeddedObject?.drawn) this.program.activate()

    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
    gl.depthMask(false)
    this.program.setFloat('uRole', 1)
    this.program.setFloat('uOpacity', 0.82)
    gl.bindVertexArray(this.ringResource.vao)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.ringResource.vertexCount, ORBITAL_PRISM_RING_COUNT)

    this.program.setInt('uPointMode', 1)
    this.program.setFloat('uRole', 0)
    this.program.setFloat('uOpacity', 0.48 + Math.min(1, frame.config.environment.stars) * 0.34)
    this.program.setFloat('uPointSize', 2.2 + intensity * 1.4)
    gl.bindVertexArray(this.particleResource.vao)
    gl.drawArraysInstanced(gl.POINTS, 0, quality.particleCount, 1)

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.BLEND)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(true)
  }

  reset(_reason: CinematicRendererResetReason): void {
    this.diagnostic = null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.services) {
      if (this.crystalResource) this.deleteResource(this.crystalResource.vao, this.crystalResource.buffers)
      if (this.ringResource) this.deleteResource(this.ringResource.vao, this.ringResource.buffers)
      if (this.particleResource) this.deleteResource(this.particleResource.vao, this.particleResource.buffers)
    }
    this.crystalResource = null
    this.ringResource = null
    this.particleResource = null
    this.composition = null
    this.program = null
    this.services = null
    this.diagnostic = null
  }

  private createMeshResource(mesh: MeshData, instances: Float32Array, instanceCount: number): MeshResource {
    if (!this.services) throw new Error('Orbital Prism Array services are unavailable')
    const gl = this.services.gl
    const vao = createVertexArray(gl, this.services)
    gl.bindVertexArray(vao)
    const buffers = [
      bindStaticAttribute(gl, this.services, ATTRIBUTES.aPosition, 3, mesh.positions),
      bindStaticAttribute(gl, this.services, ATTRIBUTES.aNormal, 3, mesh.normals),
      bindStaticAttribute(gl, this.services, ATTRIBUTES.aBarycentric, 3, mesh.barycentrics),
    ]
    const instanceBuffer = createBuffer(gl, this.services)
    buffers.push(instanceBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.STATIC_DRAW)
    bindInstanceAttributes(gl)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    return { vao, buffers, vertexCount: mesh.vertexCount, instanceCount }
  }

  private createParticleResource(particles: Float32Array): ParticleResource {
    if (!this.services) throw new Error('Orbital Prism Array services are unavailable')
    const gl = this.services.gl
    const vao = createVertexArray(gl, this.services)
    gl.bindVertexArray(vao)
    const positionValues = new Float32Array(ORBITAL_PRISM_MAX_PARTICLES * 3)
    const tintValues = new Float32Array(ORBITAL_PRISM_MAX_PARTICLES)
    for (let index = 0; index < ORBITAL_PRISM_MAX_PARTICLES; index += 1) {
      const source = index * PARTICLE_FLOATS
      const target = index * 3
      positionValues[target] = particles[source]
      positionValues[target + 1] = particles[source + 1]
      positionValues[target + 2] = particles[source + 2]
      tintValues[index] = particles[source + 3]
    }
    const buffers = [
      bindStaticAttribute(gl, this.services, ATTRIBUTES.aPosition, 3, positionValues),
      bindStaticAttribute(gl, this.services, ATTRIBUTES.aInstanceTint, 1, tintValues),
    ]
    gl.vertexAttribDivisor(ATTRIBUTES.aInstanceTint, 0)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    return { vao, buffers, count: ORBITAL_PRISM_MAX_PARTICLES }
  }

  private deleteResource(vao: WebGLVertexArrayObject, buffers: readonly WebGLBuffer[]): void {
    if (!this.services) return
    const gl = this.services.gl
    this.services.resources.untrackVAO(vao)
    gl.deleteVertexArray(vao)
    for (const buffer of buffers) {
      this.services.resources.untrackBuffer(buffer)
      gl.deleteBuffer(buffer)
    }
  }
}

const orbitalPrismArrayDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked', 'dolly', 'orbit', 'flyThrough', 'handheld', 'autoDirector'],
  safeCameraRange: {
    minDistance: 2.2,
    maxDistance: 6.4,
    minDepth: -6.4,
    maxDepth: 6.4,
    maxLateral: 1.3,
    minElevation: -0.85,
    maxElevation: 1.15,
    minFieldOfView: 38,
    maxFieldOfView: 76,
  },
  shots: [
    { id: 'orbital-prism-establish', rig: 'locked', sections: ['intro', 'breakdown', 'outro'], action: 'establish', pose: { position: { z: 4.7 }, fieldOfView: 62 } },
    { id: 'orbital-prism-orbit', rig: 'orbit', sections: ['verse', 'build', 'drop'], action: 'orbit', weight: 1.4, pose: { position: { z: 4.15 }, fieldOfView: 56 } },
    { id: 'orbital-prism-fly-through', rig: 'flyThrough', sections: ['bridge'], action: 'travel', weight: 1.2, pose: { position: { z: 4.6 }, fieldOfView: 56 } },
    { id: 'orbital-prism-focus', rig: 'dolly', sections: ['preDrop'], action: 'focus', pose: { position: { z: 3.35 }, fieldOfView: 48 } },
    { id: 'orbital-prism-hold', rig: 'locked', sections: ['unknown'], action: 'hold', pose: { position: { z: 4.4 }, fieldOfView: 58 } },
  ],
  dropActions: ['impact', 'orbit'],
  revealActions: ['reveal', 'orbit'],
  retreatActions: ['retreat', 'hold'],
  flyThroughPaths: [[
    { position: { x: 0, y: 0.15, z: 4.6 }, fieldOfView: 58 },
    { position: { x: 3.2, y: 0.45, z: 1.2 }, fieldOfView: 54 },
    { position: { x: 0, y: 0.1, z: -4.6 }, rotation: { y: Math.PI }, fieldOfView: 56 },
    { position: { x: -3.2, y: -0.2, z: -1.1 }, rotation: { y: Math.PI * 0.5 }, fieldOfView: 54 },
    { position: { x: 0, y: 0.15, z: 4.6 }, fieldOfView: 58 },
  ]],
})

export const orbitalPrismArrayWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'orbitalPrismArray',
  label: 'Orbital Prism Array',
  backend: 'webgl2',
  direction: orbitalPrismArrayDirection,
  object3dSlots: [ORBITAL_PRISM_ARRAY_OBJECT_ANCHOR],
  ownsTargetClear: true,
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'dolly', 'orbit', 'flyThrough', 'handheld', 'autoDirector'],
    modulationTargets: ['geometryRotation', 'environmentBrightness', 'nodeScale', 'edgeBrightness', 'particleEmission', 'impact', 'burstImpulse', 'bloom'],
    paletteRoles: ['primary', 'secondary', 'accent', 'background'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: false,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new OrbitalPrismArrayWorld(),
}
