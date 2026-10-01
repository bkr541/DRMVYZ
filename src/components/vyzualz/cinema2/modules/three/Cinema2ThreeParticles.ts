import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'

/**
 * A field of glowing points drifting through a box in the three-scene module (`config.particles`): embers round glowing trees, dust in a light
 * shaft. Each point wraps round the box as it drifts (so the field never empties), sways a little on its own, twinkles, and is drawn as a soft
 * round sprite with additive blending, bright enough in an HDR scene for bloom to catch. The music lifts it: `reactivity` scales how much the
 * audio glow's breath brightens the field. Positions are animated in the vertex shader, so a field costs one draw call and no per-frame upload.
 */
export interface Cinema2ThreeParticleSpec {
  /** Number of points on high quality (medium draws half, low none). */
  count: number
  /** Centre and size of the box the points drift through (world units). */
  center: readonly [number, number, number]
  size: readonly [number, number, number]
  /** Sprite diameter in world units. */
  pointSize: number
  /** sRGB color, 0-1. Ignored when `tint` is `glow`. */
  color: readonly [number, number, number]
  /** `glow`: take the module's glow color (embers follow the Glow Color control). */
  tint?: 'color' | 'glow'
  /** Brightness multiplier (above 1 glows in an HDR scene). */
  brightness: number
  /** Drift velocity, world units per second. */
  drift: readonly [number, number, number]
  /** 0-1: how strongly each point twinkles. */
  twinkle: number
  /** 0-1: how much the audio glow brightens the field (0: steady). */
  reactivity: number
}

/** Share of `count` drawn per quality tier. */
export const CINEMA2_THREE_PARTICLE_TIER_SHARE: Readonly<Record<Cinema2RenderQualityLevel, number>> = Object.freeze({ low: 0, medium: 0.5, high: 1 })

const VERTEX = `
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uSize;
uniform vec3 uDrift;
uniform float uPointSize;
uniform float uScale;
attribute vec4 aSeed;
varying float vTwinkle;
varying float vFade;
void main() {
  // Drift and wrap round the box; each point also sways on its own slow loop.
  vec3 unit = fract( position + uDrift * uTime / max( uSize, vec3( 0.001 ) ) + 0.5 ) - 0.5;
  vec3 sway = vec3( sin( uTime * ( 0.3 + aSeed.x * 0.5 ) + aSeed.y * 6.28 ), cos( uTime * ( 0.25 + aSeed.z * 0.4 ) + aSeed.x * 6.28 ), sin( uTime * 0.2 + aSeed.w * 6.28 ) ) * 0.04;
  vec3 world = uCenter + unit * uSize + sway * uSize;
  // Fade in and out near the box's edges, so wrapping points never pop.
  vec3 edge = smoothstep( vec3( 0.5 ), vec3( 0.38 ), abs( unit ) );
  vFade = edge.x * edge.y * edge.z;
  vTwinkle = 0.5 + 0.5 * sin( uTime * ( 1.5 + aSeed.y * 3.0 ) + aSeed.w * 40.0 );
  vec4 view = modelViewMatrix * vec4( world, 1.0 );
  gl_Position = projectionMatrix * view;
  gl_PointSize = max( 1.0, uPointSize * ( 0.6 + aSeed.z * 0.8 ) * uScale / max( 0.1, - view.z ) );
}
`

const FRAGMENT = `
uniform vec3 uColor;
uniform float uBrightness;
uniform float uTwinkle;
varying float vTwinkle;
varying float vFade;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot( p, p );
  if ( d > 1.0 ) discard;
  float core = exp( - d * 4.0 );
  float light = uBrightness * core * vFade * mix( 1.0, vTwinkle, uTwinkle );
  gl_FragColor = vec4( uColor * light, 1.0 );
  #include <colorspace_fragment>
}
`

/** Deterministic 0-1 random from an integer. */
function random(seed: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export class Cinema2ThreeParticleField {
  readonly points: ThreeNamespace.Points
  private readonly material: ThreeNamespace.ShaderMaterial
  private readonly geometry: ThreeNamespace.BufferGeometry
  private readonly baseColor: ThreeNamespace.Color

  constructor(THREE: typeof ThreeNamespace, private readonly spec: Readonly<Cinema2ThreeParticleSpec>, index: number) {
    const count = Math.max(0, Math.floor(spec.count))
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count * 4)
    for (let i = 0; i < count; i += 1) {
      for (let k = 0; k < 3; k += 1) positions[i * 3 + k] = random(index * 100003 + i * 7 + k) - 0.5
      for (let k = 0; k < 4; k += 1) seeds[i * 4 + k] = random(index * 200003 + i * 11 + k + 3)
    }
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
    // Positions are animated in the shader: never cull the field by its unit-box bounds.
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Number.POSITIVE_INFINITY)
    this.baseColor = new THREE.Color().setRGB(spec.color[0], spec.color[1], spec.color[2], THREE.SRGBColorSpace)
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3(...spec.center) },
        uSize: { value: new THREE.Vector3(...spec.size) },
        uDrift: { value: new THREE.Vector3(...spec.drift) },
        uPointSize: { value: spec.pointSize },
        uScale: { value: 1 },
        uColor: { value: this.baseColor.clone() },
        uBrightness: { value: spec.brightness },
        uTwinkle: { value: Math.min(1, Math.max(0, spec.twinkle)) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 10
  }

  /**
   * Per frame: `time` in seconds, the tier, the glow's breath (0 = none) and color (sRGB-linear THREE color), and the projection scale (pixels
   * per world unit at unit distance: viewport height times the projection's y scale, halved).
   */
  update(time: number, quality: Cinema2RenderQualityLevel, breath: number, glowColor: ThreeNamespace.Color | null, scale: number): void {
    const uniforms = this.material.uniforms
    uniforms.uTime!.value = Number.isFinite(time) ? time % 10000 : 0
    uniforms.uScale!.value = scale
    const color = this.spec.tint === 'glow' && glowColor ? glowColor : this.baseColor
    ;(uniforms.uColor!.value as ThreeNamespace.Color).copy(color)
    uniforms.uBrightness!.value = this.spec.brightness * (1 + Math.min(1, Math.max(0, this.spec.reactivity)) * Math.max(0, breath) * 1.5)
    const drawn = Math.floor(this.spec.count * CINEMA2_THREE_PARTICLE_TIER_SHARE[quality])
    this.geometry.setDrawRange(0, drawn)
    this.points.visible = drawn > 0
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

/** Reads and validates one `config.particles` entry; null when it is not a valid spec. */
export function parseCinema2ThreeParticleSpec(value: unknown): Readonly<Cinema2ThreeParticleSpec> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  const vec = (x: unknown, min = -Infinity) => (Array.isArray(x) && x.length === 3 && x.every(n => typeof n === 'number' && Number.isFinite(n) && n >= min) ? [x[0], x[1], x[2]] as [number, number, number] : null)
  const num = (x: unknown, min: number, max: number) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : null)
  const count = num(v.count, 0, 4000)
  const center = vec(v.center)
  const size = vec(v.size, 0.001)
  const pointSize = num(v.pointSize, 0.001, 2)
  const color = vec(v.color, 0)
  const brightness = num(v.brightness, 0, 100)
  const drift = vec(v.drift ?? [0, 0, 0])
  const twinkle = num(v.twinkle ?? 0, 0, 1)
  const reactivity = num(v.reactivity ?? 0, 0, 1)
  const tint = v.tint === undefined ? 'color' : v.tint
  if (count === null || !center || !size || pointSize === null || !color || color.some(c => c > 1) || brightness === null || !drift || twinkle === null || reactivity === null || (tint !== 'color' && tint !== 'glow')) return null
  return Object.freeze({ count, center, size, pointSize, color, brightness, drift, twinkle, reactivity, tint })
}
