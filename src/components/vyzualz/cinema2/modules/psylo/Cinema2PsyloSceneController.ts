import { PSYLO_MUSIC_DEFAULTS, type PsyloMusic } from './Cinema2PsyloAudio'
import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { PSYLO_COLORS, type PsyloControls } from './Cinema2PsyloDomain'

// World-space deformations remain rooted even though glTF position quantization
// introduces per-mesh transforms. Geometry and cached materials stay immutable.
const motionShader = `
attribute vec3 _psylo_root;
attribute float _psylo_height;
attribute float _psylo_id;
attribute float _psylo_species;
attribute float _psylo_zone;
uniform float uMusicBend, uMusicKick, uMusicKickTravel, uMusicSnare, uMusicBeat, uMusicBuild, uMusicDrop, uMusicDropTravel;
uniform float uPsyloPhase, uPsyloAmount, uPsyloScale, uPsyloPattern, uPsyloDensity;
varying float vPsyloHeight, vPsyloSpecies, vPsyloGill, vPsyloKeep;
vec3 psyloPosition(vec3 p, float h) {
  if (_psylo_id < 0.0) return p;
  vec3 local = (p - _psylo_root) * uPsyloScale;
  float t = uPsyloPhase * 1.570796327;
  float a = atan(_psylo_root.x, _psylo_root.z + 8.0);
  float r = length(_psylo_root.xz - vec2(0.0, -8.0));
  float w = h * h;
  vec3 d = vec3(0.0);
  vec2 radial = normalize(_psylo_root.xz - vec2(0.0, -8.001));
  if (uPsyloPattern < 0.5) {
    float wave = sin(t - r * 0.42);
    d.xz = radial * wave * 0.65 * w; d.y = sin(t - r * 0.42 + 0.7) * 0.18 * w;
  } else if (uPsyloPattern < 1.5) {
    float turn = sin(t * 0.7 + a * 2.0) * 0.14 * w;
    d.xz = vec2(local.x * cos(turn) - local.z * sin(turn), local.x * sin(turn) + local.z * cos(turn)) - local.xz;
    d.y = cos(t + a * 2.0) * 0.18 * w;
  } else if (uPsyloPattern < 2.5) {
    float answer = pow(max(0.0, sin(t - _psylo_zone * 1.8)), 3.0);
    d.x = answer * 0.5 * w * sin(_psylo_id * 1.7); d.y = answer * 0.48 * w;
  } else if (uPsyloPattern < 3.5) {
    float breath = sin(t * 0.45 + _psylo_zone * 0.3);
    d.xz = local.xz * breath * 0.11 * smoothstep(0.4, 0.85, h); d.y = breath * 0.3 * w;
  } else if (uPsyloPattern < 4.5) {
    float relay = pow(max(0.0, cos(a - t * 0.65)), 8.0);
    d.xz = radial * relay * 0.62 * w; d.y = relay * 0.34 * w;
  } else if (uPsyloPattern < 5.5) {
    float relay = sin(t * 1.2 - _psylo_root.z * 0.32);
    d.x = relay * 0.68 * w; d.z = cos(t * 0.6 + _psylo_root.x * 0.25) * 0.18 * w;
  } else if (uPsyloPattern < 6.5) {
    float rise = 0.5 + 0.5 * sin(t * 0.6 - r * 0.16);
    d.y = rise * 0.62 * w; d.xz = local.xz * rise * 0.08 * smoothstep(0.48, 0.9, h);
  } else {
    float release = sin(t * 0.65 - r * 0.22);
    float front = sign(release) * release * release;
    d.xz = radial * front * 0.72 * w; d.y = -cos(t * 0.65 - r * 0.22) * 0.32 * w;
  }
  d.x += sin(t * 0.7 + _psylo_id * 0.2) * uMusicBend * 0.24 * w;
  float kickFront = exp(-abs(r - uMusicKickTravel * 36.0) * 0.12);
  float dropFront = exp(-abs(r - uMusicDropTravel * 36.0) * 0.12);
  d.y += (uMusicKick * kickFront * 0.5 + uMusicBeat * 0.2) * w;
  d.xz += vec2(radial.y, -radial.x) * sin(_psylo_zone * 2.1 + 1.0) * uMusicSnare * 0.35 * w;
  d.xz -= radial * uMusicBuild * 0.3 * w;
  d.y -= uMusicBuild * 0.18 * w;
  d.xz += radial * uMusicDrop * dropFront * 0.65 * w;
  d.y += uMusicDrop * dropFront * 0.3 * w;
  d *= uPsyloAmount;
  d *= min(1.0, 0.75 * uPsyloAmount / max(0.0001, length(d)));
  return _psylo_root + local + d;
}
`
const fragmentShader = `
uniform float uMusicLight;
uniform float uPsyloMaster, uPsyloEmission, uPsyloRole;
uniform vec3 uPsyloPrimary, uPsyloSecondary, uPsyloStem, uPsyloGill, uPsyloMycelium;
varying float vPsyloHeight, vPsyloSpecies, vPsyloGill, vPsyloKeep;
`

export class Cinema2PsyloSceneController {
  private readonly uniforms: Record<string, { value: number | Three.Color }>
  private points: Three.Points<Three.BufferGeometry, Three.PointsMaterial> | null = null
  private readonly colors: Record<keyof typeof PSYLO_COLORS, Three.Color>
  constructor(private readonly library: Cinema2ThreeLibrary) {
    const { THREE } = library
    this.colors = Object.fromEntries(Object.entries(PSYLO_COLORS).map(([key, c]) => [key, new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace)])) as typeof this.colors
    this.uniforms = Object.fromEntries(Object.entries({
      uPsyloPhase: 0, uPsyloAmount: .5, uPsyloScale: 1, uPsyloPattern: 0, uPsyloDensity: 1, uPsyloMaster: .85, uPsyloEmission: .6,
      uMusicBend: 0, uMusicKick: 0, uMusicKickTravel: 0, uMusicSnare: 0, uMusicBeat: 0, uMusicBuild: 0, uMusicDrop: 0, uMusicDropTravel: 0, uMusicLight: 1,
      uPsyloPrimary: new THREE.Color(1, 1, 1), uPsyloSecondary: new THREE.Color(1, 1, 1), uPsyloStem: new THREE.Color(1, 1, 1),
      uPsyloGill: this.colors.gillColor.clone(), uPsyloMycelium: new THREE.Color(1, 1, 1),
    }).map(([key, value]) => [key, { value }]))
  }
  attach(root: Three.Object3D): void {
    const { THREE } = this.library
    root.traverse(object => {
      const mesh = object as Three.Mesh
      if (!mesh.isMesh) return
      if (!mesh.geometry.getAttribute('_psylo_root')) throw new Error('PSYLO requires prepared root/height attributes.')
      mesh.frustumCulled = false
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const material = m as Three.MeshStandardMaterial
        const role = material.name.includes('mycelium') ? 1 : material.name.includes('source.') ? 0 : 2
        const prior = material.onBeforeCompile
        material.onBeforeCompile = (shader, renderer) => {
          prior.call(material, shader, renderer)
          Object.assign(shader.uniforms, this.uniforms, { uPsyloRole: { value: role } })
          shader.vertexShader = motionShader + shader.vertexShader
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
#include <begin_vertex>
vec3 psyloWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
transformed += inverse(mat3(modelMatrix)) * (psyloPosition(psyloWorld, _psylo_height) - psyloWorld);
vPsyloHeight = _psylo_height; vPsyloSpecies = _psylo_species;
vPsyloGill = smoothstep(0.38, 0.65, _psylo_height) * (1.0 - smoothstep(-0.55, -0.08, normalize(mat3(modelMatrix) * normal).y));
vPsyloKeep = _psylo_id < 7.0 || fract(sin(_psylo_id * 127.1) * 43758.5453) < uPsyloDensity ? 1.0 : 0.0;
`)
          // Recompute the bent surface normal from two local world-space samples.
          shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
#include <beginnormal_vertex>
if (_psylo_id >= 0.0 && uPsyloAmount > 0.0) {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 wn = normalize(mat3(modelMatrix) * objectNormal);
  vec3 tx = normalize(cross(abs(wn.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0), wn));
  vec3 ty = cross(wn, tx);
  float sh = max(0.01, (wp.y - _psylo_root.y) / max(0.0001, _psylo_height));
  vec3 a = psyloPosition(wp, _psylo_height);
  vec3 b = psyloPosition(wp + tx * 0.01, clamp(_psylo_height + tx.y * 0.01 / sh, 0.0, 1.0));
  vec3 c = psyloPosition(wp + ty * 0.01, clamp(_psylo_height + ty.y * 0.01 / sh, 0.0, 1.0));
  objectNormal = normalize(transpose(mat3(modelMatrix)) * normalize(cross(b-a, c-a)));
}
`)
          shader.fragmentShader = fragmentShader + shader.fragmentShader
          shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
#include <color_fragment>
if (vPsyloKeep < 0.5) discard;
if (uPsyloRole < 0.5) {
 vec3 cap = mod(vPsyloSpecies, 2.0) < 0.5 ? uPsyloPrimary : uPsyloSecondary;
 diffuseColor.rgb *= mix(uPsyloStem, cap, smoothstep(0.45, 0.7, vPsyloHeight));
} else if (uPsyloRole < 1.5) diffuseColor.rgb *= uPsyloMycelium;
`)
          shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
#include <emissivemap_fragment>
if (uPsyloRole < 0.5) totalEmissiveRadiance += uPsyloGill * vPsyloGill * 0.65;
else if (uPsyloRole < 1.5) totalEmissiveRadiance *= uPsyloMycelium;
totalEmissiveRadiance *= uPsyloMaster * uPsyloEmission / 0.6 * uMusicLight;
`)
        }
        const priorKey = material.customProgramCacheKey.bind(material)
        material.customProgramCacheKey = () => `${priorKey()}:psylo-native-v3:${role}`
      }
    })
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(128 * 3), 3))
    const material = new THREE.PointsMaterial({ color: this.colors.sporeColor, size: .14, transparent: true, opacity: .65, depthWrite: false, sizeAttenuation: true })
    // Circular native particles, no external texture or screen-space overlay.
    material.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;') }
    this.points = new THREE.Points(geometry, material); this.points.frustumCulled = false; root.add(this.points)
  }
  apply(c: PsyloControls, phase: number, music: PsyloMusic = { ...PSYLO_MUSIC_DEFAULTS }): void {
    const { THREE } = this.library, u = this.uniforms
    const moving = c.motion && c.amount > 0 && c.speed > 0
    for (const [key, value] of Object.entries({ uMusicBend: music.musicBend, uMusicKick: music.musicKick, uMusicKickTravel: music.musicKickTravel, uMusicSnare: music.musicSnare, uMusicBeat: music.musicBeat, uMusicBuild: music.musicBuild, uMusicDrop: music.musicDrop, uMusicDropTravel: music.musicDropTravel })) u[key].value = moving ? value : 0
    u.uMusicLight.value = music.musicLight
    for (const [key, value] of Object.entries({ uPsyloPhase: phase, uPsyloAmount: c.motion ? c.amount * (moving ? music.musicRange : 1) : 0, uPsyloScale: c.scale, uPsyloPattern: c.pattern, uPsyloDensity: c.density, uPsyloMaster: c.master, uPsyloEmission: c.emission })) u[key].value = value
    for (const [key, uniform] of [['primaryColor', 'uPsyloPrimary'], ['secondaryColor', 'uPsyloSecondary'], ['stemColor', 'uPsyloStem'], ['myceliumColor', 'uPsyloMycelium']] as const) {
      const color = c.colors[key], base = this.colors[key]
      const output = u[uniform].value as Three.Color
      output.setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace)
      output.setRGB(output.r / Math.max(.001, base.r), output.g / Math.max(.001, base.g), output.b / Math.max(.001, base.b))
    }
    const gill = c.colors.gillColor
    ;(u.uPsyloGill.value as Three.Color).setRGB(gill[0], gill[1], gill[2], THREE.SRGBColorSpace)
    if (this.points) {
      const count = Math.round(c.spores * 128 * music.musicSpore), p = this.points.geometry.attributes.position as Three.BufferAttribute
      for (let i = 0; i < count; i++) {
        const a = i * 2.39996, r = 4 + (i * 7.13 % 22), t = phase * .08
        const accent = moving ? music.musicSnare * .25 * Math.sin(i * 2.1) : 0
        const lift = c.pattern === 2 ? Math.max(0, Math.sin(phase * 1.57 - i % 3 * 1.8)) : 0
        p.setXYZ(i, Math.sin(a + t * .08) * r, .6 + ((i * .37 + t + lift + accent) % 5), -8 + Math.cos(a + t * .08) * r)
      }
      p.needsUpdate = true; this.points.geometry.setDrawRange(0, count)
      const color = c.colors.sporeColor
      this.points.material.color.setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace)
      this.points.material.opacity = .65 * c.master
    }
  }
  dispose(): void {
    if (this.points) { this.points.removeFromParent(); this.points.geometry.dispose(); this.points.material.dispose(); this.points = null }
  }
}
