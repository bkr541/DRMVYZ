import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t) }
export type Cinema2DustStage = 'solid' | 'dissolving' | 'drifting' | 'gathering' | 'reforming'
/** One complete cycle per authored number of beats; independent of Pattern Change. */
export function cinema2DustCycle(beats: number, duration = 16) {
  const phase = ((beats / Math.max(8, duration)) % 1 + 1) % 1
  const stage: Cinema2DustStage = phase < .12 ? 'solid' : phase < .34 ? 'dissolving' : phase < .66 ? 'drifting' : phase < .88 ? 'gathering' : 'reforming'
  return { phase, stage, dissolve: phase < .66 ? smooth(.12, .34, phase) : phase < .88 ? 1 : 1 - smooth(.88, .98, phase), spread: smooth(.12, .34, phase) * (1 - smooth(.66, .88, phase)) }
}

/** Same surface rank in JS and GLSL: a rising front with small, fixed spatial flecks. */
export function cinema2DustSurfaceRank(x: number, y: number, z: number): number {
  const cx = Math.floor(x * 96), cy = Math.floor(y * 96), cz = Math.floor(z * 96)
  const hash = ((cx * 13 + cy * 37 + cz * 17 + cx * cz * 7) % 97 + 97) % 97 / 97
  return clamp(.08 + .64 * (y + .5) + .28 * hash)
}

/** Writes into a reused vector. Spread zero ALWAYS returns the exact rest position. */
export function cinema2DustPosition(out: Three.Vector3, rest: Three.Vector3, extent: number, index: number, pattern: number, phase: number, spread: number, movement: number, reaction: number): void {
  const x = rest.x / extent, y = rest.y / extent, z = rest.z / extent
  const seed = index * 2.3999632297, t = phase, strength = .45 + movement * .65 + reaction * .2
  let px = x, py = y, pz = z
  if (pattern === 0) { px = x * (1 + strength) + Math.sin(seed + t) * .12; py = y * (1 + strength) + Math.cos(seed * .7 + t) * .12; pz = z + Math.sin(seed * .3 + t) * .35 }
  if (pattern === 1) { px = x + Math.cos(seed + t) * .25; py = y + .35 + (Math.sin(seed) * .5 + .5) * strength * .55; pz = z + Math.sin(seed + t) * .25 }
  if (pattern === 2) { const angle = seed + t; px = Math.cos(angle) * (.55 + z * .18); py = y * .5 + Math.sin(angle * 2) * .18; pz = Math.sin(angle) * (.55 + z * .18) }
  if (pattern === 3) { const side = x < 0 ? -1 : 1; px = side * (.37 + Math.sin(seed + t) * .15); py = y * .6 + Math.cos(seed * .3 + t) * .42; pz = z + Math.sin(seed + t * side) * .28 }
  if (pattern === 4) { px = x + Math.cos(y * 6 + t) * .23; py = y + Math.sin(x * 8 + t) * .23; pz = z + Math.sin(x * 5 + y * 5 + t) * .4 }
  if (pattern === 5) { px = x * .45 + Math.cos(seed + t * .4) * .19; py = y * .45 + Math.sin(seed * .7 + t * .6) * .19; pz = z * .45 + Math.sin(seed + t) * .23 }
  const envelope = Math.max(1, Math.hypot(px, py, pz) / .72)
  px /= envelope; py /= envelope; pz /= envelope
  out.set(rest.x + (px * extent - rest.x) * spread, rest.y + (py * extent - rest.y) * spread, rest.z + (pz * extent - rest.z) * spread)
}

/** Adds spatial discard to the existing PBR shader; source textures/material models remain intact. */
export class Cinema2UserModelDustDissolve {
  readonly amount = { value: 0 }
  readonly edgeColor: { value: Three.Color }
  readonly edgeStrength = { value: .15 }
  private readonly restore: (() => void)[] = []
  constructor(library: Cinema2ThreeLibrary, root: Three.Object3D, meshes: readonly Three.Mesh[], center: Three.Vector3, extent: number) {
    const T = library.THREE
    this.edgeColor = { value: new T.Color(0.4, 0.85, 1) }
    root.updateWorldMatrix(true, true)
    const normalize = new T.Matrix4().makeScale(1 / extent, 1 / extent, 1 / extent).multiply(new T.Matrix4().makeTranslation(-center.x, -center.y, -center.z)).multiply(root.matrixWorld.clone().invert())
    const seen = new Set<Three.Material>()
    for (const mesh of meshes) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (seen.has(material)) continue
      seen.add(material)
      const originalCompile = material.onBeforeCompile, originalKey = material.customProgramCacheKey
      const local = { value: new T.Matrix4().multiplyMatrices(normalize, mesh.matrixWorld) }
      material.onBeforeCompile = (shader, renderer) => {
        originalCompile.call(material, shader, renderer)
        Object.assign(shader.uniforms, { c2DustAmount: this.amount, c2DustRest: local, c2DustEdge: this.edgeColor, c2DustStrength: this.edgeStrength })
        shader.vertexShader = 'uniform mat4 c2DustRest; varying vec3 vC2DustRest;\n' + shader.vertexShader
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvC2DustRest = (c2DustRest * vec4(position, 1.0)).xyz;')
        shader.fragmentShader = 'uniform float c2DustAmount; uniform vec3 c2DustEdge; uniform float c2DustStrength; varying vec3 vC2DustRest;\n' + shader.fragmentShader
        shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
          vec3 dustCell = floor(vC2DustRest * 96.0);
          float dustNoise = mod(dustCell.x * 13.0 + dustCell.y * 37.0 + dustCell.z * 17.0 + dustCell.x * dustCell.z * 7.0, 97.0) / 97.0;
          float dustRank = clamp(.08 + .64 * (vC2DustRest.y + .5) + .28 * dustNoise, 0.0, 1.0);
          if (dustRank < c2DustAmount || c2DustAmount >= .99999) discard;
        `)
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float dustEdge = (1.0 - smoothstep(0.0, .035, abs(dustRank - c2DustAmount))) * step(.001, c2DustAmount) * (1.0 - step(.999, c2DustAmount));
          outgoingLight += c2DustEdge * dustEdge * c2DustStrength;
          #include <opaque_fragment>
        `)
      }
      const baseKey = originalKey.call(material)
      material.customProgramCacheKey = () => baseKey + ':c2-model-dust-v1'
      material.needsUpdate = true
      this.restore.push(() => { material.onBeforeCompile = originalCompile; material.customProgramCacheKey = originalKey; material.needsUpdate = true })
    }
  }
  dispose(): void { for (const restore of this.restore.splice(0)) restore() }
}

/** Circular, soft-edged grains with per-particle release opacity, using the standard PointsMaterial path. */
export function decorateCinema2DustPoints(material: Three.PointsMaterial, uniforms?: Cinema2DustUniforms): void {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float c2DustAlpha; varying float vC2DustAlpha;\n' + shader.vertexShader
    if (uniforms) {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = `attribute float c2Seed; uniform float c2Extent, c2Release, c2Spread, c2Time, c2Pattern, c2Motion, c2Turbulence, c2Density, c2Impulse, c2FlowBias; varying float vC2Seed;
` + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 q = position / c2Extent;
        float t = c2Time, seed = c2Seed * 6.2831853;
        float release = smoothstep(c2DustAlpha - .035, c2DustAlpha + .035, c2Release);
        if (c2Release >= .99999) release = 1.;
        vec3 target = q * (1. + c2Motion) + vec3(cos(seed), sin(seed * 2.), sin(seed)) * .24;
        if (c2Pattern > .5) target = q + vec3(cos(seed+t)*.2, .35 + c2Seed*.45, sin(seed+t)*.2);
        if (c2Pattern > 1.5) target = vec3(cos(seed+t)*(.55+q.z*.2), q.y*.5, sin(seed+t)*(.55+q.z*.2));
        if (c2Pattern > 2.5) target = vec3(sign(q.x)*(.37+cos(seed+t)*.15), q.y*.6+sin(seed+t)*.42, q.z+sin(seed+t)*.2);
        if (c2Pattern > 3.5) target = q + vec3(cos(q.y*6.+t),sin(q.x*8.+t),sin((q.x+q.y)*5.+t))*.28;
        if (c2Pattern > 4.5) target = q*.45 + vec3(cos(seed+t*.4),sin(seed+t*.6),sin(seed+t))*.2;
        // Divergence-free periodic field (each component varies on the other axes).
        vec3 curl = vec3(sin(q.y*11.+t*.7)-cos(q.z*9.-t*.5), sin(q.z*9.+t*.6)-cos(q.x*10.+t*.4), sin(q.x*10.-t*.8)-cos(q.y*11.+t*.3));
        target += curl * .12 * c2Turbulence;
        // Stable radial expansion: the shared kick envelope drives a spatially staggered wave.
        float radial = length(q);
        float wave = .55 + .45 * sin(radial * 12. - c2Impulse * 4.);
        target += q / max(.12, radial) * c2Impulse * wave * .25;
        target.y += c2FlowBias * c2Spread * .5;
        target /= max(1., length(target)/.92);
        transformed = mix(position, target*c2Extent, c2Spread*release);
        vC2Seed = c2Seed;
      `)
      shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * mix(.55, 1.55, c2Seed);')
      shader.fragmentShader = 'varying float vC2Seed; uniform float c2Density, c2Sparkle, c2Time;\n' + shader.fragmentShader
    }
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', uniforms ? '#include <begin_vertex>\nvC2DustAlpha = smoothstep(c2DustAlpha - .035, c2DustAlpha + .035, c2Release); if(c2Release >= .99999) vC2DustAlpha = 1.;' : '#include <begin_vertex>\nvC2DustAlpha = c2DustAlpha;')
    shader.fragmentShader = 'varying float vC2DustAlpha;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float dustRadius = length(gl_PointCoord - vec2(.5)) * 2.0;
      diffuseColor.a *= vC2DustAlpha * (1.0 - smoothstep(.15, 1.0, dustRadius));
      ${uniforms ? 'diffuseColor.rgb *= mix(.65, 1.35, vC2Seed) * (1. + c2Sparkle * .4 * pow(.5 + .5 * sin(vC2Seed * 89. + c2Time * 2.), 4.)); diffuseColor.a *= mix(.7, 1., vC2Seed) * mix(1., .7, c2Density);' : ''}
      if (diffuseColor.a < .004) discard;
    `)
  }
  material.customProgramCacheKey = () => uniforms ? 'c2-model-dust-grain-gpu-v3' : 'c2-model-dust-grain-v1'
}

/** A progressive permutation of the existing area-stratified surface samples. */
export function cinema2ProgressiveSample(index: number, count: number): number {
  if (count <= 1) return 0
  if ((count & (count - 1)) !== 0) {
    // Coprime stride distributes prefixes even for non-power-of-two edge counts.
    let stride = Math.max(1, Math.floor(count * .61803398875))
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
    while (gcd(count, stride) !== 1) stride++
    return (index * stride) % count
  }
  let reversed = 0, value = index
  for (let n = count; n > 1; n >>>= 1) { reversed = reversed * 2 + (value & 1); value >>>= 1 }
  return reversed
}
export function cinema2GrainSeed(index: number): number {
  let n = (index + 1) >>> 0
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d)
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
export function createCinema2DustUniforms(extent: number) {
  return { c2Extent: { value: extent }, c2Release: { value: 0 }, c2Spread: { value: 0 }, c2Time: { value: 0 }, c2Pattern: { value: 0 }, c2Motion: { value: .35 }, c2Turbulence: { value: .5 }, c2Density: { value: 1 }, c2Impulse: { value: 0 }, c2FlowBias: { value: 0 }, c2Sparkle: { value: 0 } }
}
export type Cinema2DustUniforms = ReturnType<typeof createCinema2DustUniforms>
