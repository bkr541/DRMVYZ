import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'

export const CINEMA2_MODEL_MATERIAL_STYLES = ['original', 'chrome', 'blackChrome', 'gold', 'iridescent', 'glass', 'neon', 'holographic'] as const
export const CINEMA2_MODEL_LOOKS = {
  manual: { style: 'original', rim: 0 }, darkStudio: { style: 'original', rim: .18 },
  blackChromeNeon: { style: 'blackChrome', rim: 2.2 }, goldReflection: { style: 'gold', rim: .3 },
  glassEnergy: { style: 'glass', rim: 1.6 }, electricHologram: { style: 'holographic', rim: 2.5 },
  cinematicAtmosphere: { style: 'iridescent', rim: .7 }, neonKaleidoscope: { style: 'neon', rim: 2.8 },
} as const
const profiles = {
  chrome: [0xc4d3e2, 1, .12, 1, .02], blackChrome: [0x202c38, .96, .2, 1, .015],
  gold: [0xffbd53, 1, .23, 1, .025], iridescent: [0x6946b0, .82, .24, 1, .08],
  glass: [0x81dcff, .08, .12, .32, .12], neon: [0x05cbff, .25, .3, 1, 2.5],
  holographic: [0x4078ff, .25, .33, .38, .8],
} as const
export function modelFxNumber(p: Cinema2ModuleParameterReadFacet, key: string, fallback: number, min = 0, max = 4): number {
  const value = p.get(key)
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}
export function modelFxColor(T: Cinema2ThreeLibrary['THREE'], p: Cinema2ModuleParameterReadFacet, key: string, fallback: number, target = new T.Color()): Three.Color {
  const v = p.get(key)
  return Array.isArray(v) && v.length >= 3 && [v[0], v[1], v[2]].every(n => typeof n === 'number' && Number.isFinite(n))
    ? target.setRGB(Number(v[0]), Number(v[1]), Number(v[2]), T.SRGBColorSpace) : target.setHex(fallback)
}
export function resolveModelLook(p: Cinema2ModuleParameterReadFacet) {
  const look = String(p.get('cinematicLook')) as keyof typeof CINEMA2_MODEL_LOOKS
  const known = Object.prototype.hasOwnProperty.call(CINEMA2_MODEL_LOOKS, look)
  const preset = known ? CINEMA2_MODEL_LOOKS[look] : CINEMA2_MODEL_LOOKS.manual
  const selected = String(p.get('cinematicMaterial')) as typeof CINEMA2_MODEL_MATERIAL_STYLES[number]
  const manual = CINEMA2_MODEL_MATERIAL_STYLES.includes(selected)
  return { style: manual ? selected : preset.style, rim: manual ? 0 : preset.rim }
}
interface Surface {
  material: Three.MeshStandardMaterial
  restoreHook: () => void
  readonly initial: { metalness: number; roughness: number; env: number; transmission: number; clearcoat: number; coatRoughness: number; iridescence: number }
  readonly color: Three.Color
  readonly emissive: Three.Color
  intensity: number
  opacity: number
  transparent: boolean
  depthWrite: boolean
  renderedTransparent: boolean
  applied: boolean
  styled: boolean
}
interface ColoredSurface { material: Three.Material & { color: Three.Color }; color: Three.Color; applied: boolean }
/** Only representation-owned materials are passed here. Keep prior dust/scan shaders and texture slots intact. */
export class Cinema2ModelCinematicMaterials {
  private readonly surfaces: Surface[] = []
  private readonly colored: ColoredSurface[] = []
  private readonly scratchColors: readonly [Three.Color, Three.Color, Three.Color]
  private readonly uniforms: { c2CinemaRim: { value: number }; c2CinemaPower: { value: number }; c2CinemaColor: { value: Three.Color }; c2CinemaIridescent: { value: number }; c2CinemaSecondary: { value: Three.Color }; c2CinemaScan: { value: number }; c2CinemaTime: { value: number } }
  constructor(private readonly library: Cinema2ThreeLibrary, root: Three.Object3D) {
    const T = library.THREE
    this.scratchColors = [new T.Color(), new T.Color(), new T.Color()]
    this.uniforms = { c2CinemaRim: { value: 0 }, c2CinemaPower: { value: 3 }, c2CinemaColor: { value: new T.Color(0x00eaff) }, c2CinemaIridescent: { value: 0 }, c2CinemaSecondary: { value: new T.Color(0xe32cff) }, c2CinemaScan: { value: 0 }, c2CinemaTime: { value: 0 } }
    const seen = new Set<Three.Material>()
    root.traverse(node => {
      const obj = node as Three.Mesh
      if (!obj.material) return
      for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        if (seen.has(material)) continue
        seen.add(material)
        const m = material as Three.MeshStandardMaterial
        if (!m.isMeshStandardMaterial) {
          if ((material as Three.PointsMaterial).isPointsMaterial || (material as Three.MeshBasicMaterial).isMeshBasicMaterial || material.type === 'LineMaterial') { const colored = material as Three.Material & { color: Three.Color }; this.colored.push({ material: colored, color: colored.color.clone(), applied: false }) }
          continue
        }
        const compile = m.onBeforeCompile, key = m.customProgramCacheKey, oldKey = key.call(m)
        m.onBeforeCompile = (shader, renderer) => {
          compile.call(m, shader, renderer)
          Object.assign(shader.uniforms, this.uniforms)
          shader.fragmentShader = `uniform float c2CinemaRim, c2CinemaPower, c2CinemaIridescent, c2CinemaScan, c2CinemaTime; uniform vec3 c2CinemaColor, c2CinemaSecondary;\n` + shader.fragmentShader
          shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
            float cinemaF = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), c2CinemaPower);
            outgoingLight += c2CinemaRim * cinemaF * c2CinemaColor;
            outgoingLight = mix(outgoingLight, outgoingLight * mix(c2CinemaColor, c2CinemaSecondary, cinemaF) + cinemaF * c2CinemaSecondary * .35, c2CinemaIridescent);
            outgoingLight += c2CinemaScan * c2CinemaColor * (.2 + .2 * sin(vViewPosition.y * 65.0 + c2CinemaTime * 5.0));
            #include <opaque_fragment>`)
        }
        m.customProgramCacheKey = () => oldKey + ':cinema-model-light-v1'
        m.needsUpdate = true
        const physical = m as Three.MeshPhysicalMaterial
        this.surfaces.push({ material: m, restoreHook: () => { m.onBeforeCompile = compile; m.customProgramCacheKey = key; m.needsUpdate = true }, initial: { metalness: m.metalness, roughness: m.roughness, env: m.envMapIntensity, transmission: physical.transmission, clearcoat: physical.clearcoat, coatRoughness: physical.clearcoatRoughness, iridescence: physical.iridescence }, color: m.color.clone(), emissive: m.emissive.clone(), intensity: m.emissiveIntensity, opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite, renderedTransparent: m.transparent, applied: false, styled: false })
      }
    })
  }
  /** Restore the mode's own values before it evaluates the next frame. */
  restore(): void {
    for (const s of this.surfaces) if (s.applied) {
      const m = s.material; m.color.copy(s.color); m.emissive.copy(s.emissive); m.emissiveIntensity = s.intensity; m.opacity = s.opacity; m.transparent = s.transparent; m.depthWrite = s.depthWrite; s.applied = false
    }
    for (const s of this.colored) if (s.applied) { s.material.color.copy(s.color); s.applied = false }
  }
  private restoreStatic(s: Surface): void {
    if (!s.styled) return
    const m = s.material, physical = m as Three.MeshPhysicalMaterial, old = s.initial
    m.metalness = old.metalness; m.roughness = old.roughness; m.envMapIntensity = old.env
    if (physical.isMeshPhysicalMaterial) { physical.transmission = old.transmission; physical.clearcoat = old.clearcoat; physical.clearcoatRoughness = old.coatRoughness; physical.iridescence = old.iridescence }
    if (s.renderedTransparent !== m.transparent) m.needsUpdate = true
    s.renderedTransparent = m.transparent; s.styled = false
  }
  apply(p: Cinema2ModuleParameterReadFacet, time: number): void {
    const T = this.library.THREE, { style, rim } = resolveModelLook(p), profile = style === 'original' ? null : profiles[style]
    const n = (key: string, fallback: number, min = 0, max = 4) => modelFxNumber(p, key, fallback, min, max)
    const tint = modelFxColor(T, p, 'cinematicBaseColor', 0xffffff, this.scratchColors[0]), emission = modelFxColor(T, p, 'cinematicEmissiveColor', 0xffffff, this.scratchColors[1])
    modelFxColor(T, p, 'cinematicRimColor', 0x00eaff, this.uniforms.c2CinemaColor.value)
    modelFxColor(T, p, 'secondary', 0xe32cff, this.uniforms.c2CinemaSecondary.value)
    this.uniforms.c2CinemaRim.value = (rim + n('cinematicRim', 0)) * n('cinematicRimBloom', 1, 0, 2)
    this.uniforms.c2CinemaPower.value = n('cinematicRimFalloff', 3, .5, 10) / n('cinematicRimWidth', 1, .25, 3)
    this.uniforms.c2CinemaIridescent.value = style === 'iridescent' ? n('cinematicIridescence', .8, 0, 1) : 0
    this.uniforms.c2CinemaScan.value = style === 'holographic' ? .6 : 0
    this.uniforms.c2CinemaTime.value = time
    const metalness = n('cinematicMetalness', 1, 0, 2), roughness = n('cinematicRoughness', 1, .1, 4), reflection = n('cinematicReflection', 1, 0, 4), opacity = n('cinematicOpacity', 1, 0, 1), energy = n('cinematicEmission', 1, 0, 4)
    const transmission = n('cinematicTransmission', .5, 0, 1), clearcoat = n('cinematicClearcoat', .5, 0, 1), coatRoughness = n('cinematicCoatRoughness', .2, 0, 1)
    for (const s of this.surfaces) {
      const m = s.material, physical = m as Three.MeshPhysicalMaterial
      s.color.copy(m.color); s.emissive.copy(m.emissive); s.intensity = m.emissiveIntensity; s.opacity = m.opacity; s.transparent = m.transparent; s.depthWrite = m.depthWrite; s.applied = true; s.styled = true
      if (profile) m.color.setHex(profile[0])
      m.color.multiply(tint)
      m.metalness = Math.min(1, (profile?.[1] ?? s.initial.metalness) * metalness)
      m.roughness = Math.max(profile ? .04 : 0, Math.min(1, (profile?.[2] ?? s.initial.roughness) * roughness))
      if (profile) m.emissive.copy(m.color)
      m.emissive.multiply(emission); m.emissiveIntensity = profile ? profile[4] * energy + s.intensity : s.intensity * energy
      m.envMapIntensity = profile ? reflection : s.initial.env * reflection
      m.opacity = s.opacity * (profile?.[3] ?? 1) * opacity
      const translucent = s.transparent || m.opacity < .999
      if (s.renderedTransparent !== translucent) m.needsUpdate = true
      s.renderedTransparent = translucent; m.transparent = translucent; m.depthWrite = s.depthWrite && !translucent
      if (physical.isMeshPhysicalMaterial) {
        physical.transmission = profile ? (style === 'glass' ? transmission : 0) : s.initial.transmission
        physical.clearcoat = profile ? clearcoat : s.initial.clearcoat; physical.clearcoatRoughness = profile ? coatRoughness : s.initial.coatRoughness
        physical.iridescence = profile ? this.uniforms.c2CinemaIridescent.value : s.initial.iridescence
      }
    }
    const coloredTint = this.scratchColors[2].copy(tint)
    if (profile) coloredTint.setHex(profile[0]).multiply(tint).multiplyScalar(1 + profile[4] * energy)
    for (const s of this.colored) { s.color.copy(s.material.color); s.applied = true; s.material.color.multiply(coloredTint) }
  }
  dispose(): void { this.restore(); for (const s of this.surfaces) { this.restoreStatic(s); s.restoreHook() } }
}
