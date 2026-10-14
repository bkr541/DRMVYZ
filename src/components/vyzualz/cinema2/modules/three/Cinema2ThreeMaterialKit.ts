import type * as ThreeNamespace from 'three'
import type { Cinema2PbrQuality } from '../../render/Cinema2RenderQualityProfiles'
import { Cinema2ThreeResourceLedger, type Cinema2Disposable } from './Cinema2ThreeResourceLedger'

/**
 * Reusable PBR material layer for future Cinema 2.0 scenes.
 *
 * The goal is that a professionally authored Blender material (glTF `pbrMetallicRoughness` plus the Khronos material extensions Three imports)
 * is used as authored, and a preset that wants a different look states only the properties it changes, in one profile object, instead of
 * rebuilding the material's shader plumbing in code.
 *
 * Rules the kit keeps:
 *  - Only properties named in a profile are touched. Imported values are never reset or "normalized".
 *  - Materials that are not `MeshStandardMaterial` / `MeshPhysicalMaterial` (custom `ShaderMaterial`s, the Audio Intelligence emissive shaders,
 *    `MeshBasicMaterial`) are left untouched and reported as skipped, so custom shader work is never replaced by a generic material.
 *  - Promoting a standard material to physical copies its `onBeforeCompile`, `customProgramCacheKey`, `userData` and name, and refuses when the
 *    material carries a custom shader hook that the copy could not keep in sync.
 *  - Color textures are sRGB; normal, roughness, metalness, occlusion, displacement and all other data textures are non-color.
 *  - Per-slot UV transforms and filtering never leak into other materials that share the texture (the texture is cloned on first write; the clone
 *    shares the decoded image, so nothing is uploaded twice).
 *  - Shared resources are disposed only when their last holder releases them (`Cinema2ThreeResourceLedger`).
 *
 * Nothing in this module is applied to an existing preset.
 */
export type Cinema2ThreeNamespace = typeof ThreeNamespace
export type Cinema2ColorInput = string | number | readonly [r: number, g: number, b: number]
export type Cinema2Vec2Input = readonly [x: number, y: number]

export type Cinema2MaterialMapSlot =
  | 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'aoMap' | 'emissiveMap' | 'displacementMap' | 'bumpMap' | 'alphaMap' | 'lightMap'
  | 'clearcoatMap' | 'clearcoatRoughnessMap' | 'clearcoatNormalMap' | 'transmissionMap' | 'thicknessMap'
  | 'iridescenceMap' | 'iridescenceThicknessMap' | 'anisotropyMap' | 'specularIntensityMap' | 'specularColorMap' | 'sheenColorMap' | 'sheenRoughnessMap'

export const CINEMA2_MATERIAL_MAP_SLOTS: readonly Cinema2MaterialMapSlot[] = Object.freeze([
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'displacementMap', 'bumpMap', 'alphaMap', 'lightMap',
  'clearcoatMap', 'clearcoatRoughnessMap', 'clearcoatNormalMap', 'transmissionMap', 'thicknessMap',
  'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap', 'specularIntensityMap', 'specularColorMap', 'sheenColorMap', 'sheenRoughnessMap',
])

/** Slots that hold color (sRGB). Every other slot holds data and must stay linear (`NoColorSpace`). */
export const CINEMA2_COLOR_MAP_SLOTS: ReadonlySet<Cinema2MaterialMapSlot> = new Set<Cinema2MaterialMapSlot>(['map', 'emissiveMap', 'specularColorMap', 'sheenColorMap'])

export interface Cinema2TextureTransform {
  offset?: Cinema2Vec2Input
  repeat?: Cinema2Vec2Input
  /** Radians. */
  rotation?: number
  center?: Cinema2Vec2Input
}

export type Cinema2TextureFilter = 'nearest' | 'linear' | 'nearest-mipmap-nearest' | 'linear-mipmap-nearest' | 'nearest-mipmap-linear' | 'linear-mipmap-linear'

export interface Cinema2TextureFiltering {
  /** Anisotropic filtering level (clamped to the GPU maximum in `options.maxAnisotropy`). */
  anisotropy?: number
  minFilter?: Cinema2TextureFilter
  magFilter?: 'nearest' | 'linear'
  generateMipmaps?: boolean
}

export interface Cinema2MaterialProfile {
  color?: Cinema2ColorInput
  metalness?: number
  roughness?: number
  /** One number scales both axes. */
  normalScale?: number | Cinema2Vec2Input
  aoMapIntensity?: number
  emissive?: Cinema2ColorInput
  emissiveIntensity?: number
  /** Height / displacement. Displacement needs enough vertices; use `bumpScale` for per-pixel relief on sparse meshes. */
  displacementScale?: number
  displacementBias?: number
  bumpScale?: number
  opacity?: number
  alphaMode?: 'opaque' | 'mask' | 'blend'
  /** Cutoff for `alphaMode: 'mask'`. */
  alphaCutoff?: number
  doubleSided?: boolean
  clearcoat?: number
  clearcoatRoughness?: number
  transmission?: number
  ior?: number
  /** Volume thickness (world units) for transmission / refraction. */
  thickness?: number
  attenuationColor?: Cinema2ColorInput
  attenuationDistance?: number
  dispersion?: number
  iridescence?: number
  iridescenceIOR?: number
  iridescenceThicknessRange?: Cinema2Vec2Input
  anisotropy?: number
  /** Radians. */
  anisotropyRotation?: number
  specularIntensity?: number
  specularColor?: Cinema2ColorInput
  sheen?: number
  sheenColor?: Cinema2ColorInput
  sheenRoughness?: number
  /**
   * Strength of environment reflections on this material. Three applies this only to a material that holds its own `envMap`, so setting it
   * needs `options.environment`; the scene-wide strength is `scene.environmentIntensity` (see the environment profiles).
   */
  reflectionIntensity?: number
  /** Per-slot UV transform; `all` applies to every slot that has no entry of its own. */
  uvTransform?: Partial<Record<Cinema2MaterialMapSlot | 'all', Cinema2TextureTransform>>
  filtering?: Cinema2TextureFiltering
}

export interface Cinema2MaterialApplyOptions {
  /** Largest anisotropy the GPU supports (`renderer.capabilities.getMaxAnisotropy()`); defaults to 1. */
  maxAnisotropy?: number
  /** Required for `reflectionIntensity`. */
  environment?: ThreeNamespace.Texture | null
  /** Quality gates: a physical feature the tier turns off is skipped with a reason. */
  features?: Readonly<Cinema2PbrQuality>
}

export interface Cinema2MaterialApplyResult {
  /** The material to use from now on: the same instance, or a physical replacement when the profile needed physical features. */
  material: ThreeNamespace.Material
  upgraded: boolean
  applied: readonly string[]
  skipped: readonly Readonly<{ property: string; reason: string }>[]
}

const PHYSICAL_KEYS: readonly (keyof Cinema2MaterialProfile)[] = Object.freeze([
  'clearcoat', 'clearcoatRoughness', 'transmission', 'ior', 'thickness', 'attenuationColor', 'attenuationDistance', 'dispersion',
  'iridescence', 'iridescenceIOR', 'iridescenceThicknessRange', 'anisotropy', 'anisotropyRotation',
  'specularIntensity', 'specularColor', 'sheen', 'sheenColor', 'sheenRoughness',
])

/** Which tier feature gates a physical property. */
const FEATURE_OF: Readonly<Record<string, keyof Cinema2PbrQuality>> = Object.freeze({
  clearcoat: 'clearcoat', clearcoatRoughness: 'clearcoat',
  sheen: 'sheen', sheenColor: 'sheen', sheenRoughness: 'sheen',
  transmission: 'transmission', ior: 'transmission', thickness: 'transmission', attenuationColor: 'transmission', attenuationDistance: 'transmission', dispersion: 'transmission',
  iridescence: 'iridescence', iridescenceIOR: 'iridescence', iridescenceThicknessRange: 'iridescence',
  anisotropy: 'anisotropy', anisotropyRotation: 'anisotropy',
})

export function cinema2ProfileNeedsPhysical(profile: Readonly<Cinema2MaterialProfile>): boolean {
  return PHYSICAL_KEYS.some(key => profile[key] !== undefined)
}

interface MaterialLike extends ThreeNamespace.Material {
  isMeshStandardMaterial?: boolean
  isMeshPhysicalMaterial?: boolean
}

function isStandardFamily(material: ThreeNamespace.Material): material is ThreeNamespace.MeshStandardMaterial {
  const m = material as MaterialLike
  return m.isMeshStandardMaterial === true || m.isMeshPhysicalMaterial === true
}

/** Standard to physical, keeping everything the standard material carried. Returns null when a custom shader hook makes a copy unsafe. */
export function upgradeCinema2MaterialToPhysical(THREE: Cinema2ThreeNamespace, material: ThreeNamespace.MeshStandardMaterial): ThreeNamespace.MeshPhysicalMaterial | null {
  if ((material as MaterialLike).isMeshPhysicalMaterial) return material as ThreeNamespace.MeshPhysicalMaterial
  // A hook installed on the standard material compiles into the standard program; the physical copy would keep the hook but not its uniforms.
  if (material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return null
  const physical = new THREE.MeshPhysicalMaterial()
  THREE.MeshStandardMaterial.prototype.copy.call(physical, material)
  physical.name = material.name
  physical.userData = material.userData
  physical.customProgramCacheKey = material.customProgramCacheKey
  return physical
}

function applyColor(THREE: Cinema2ThreeNamespace, target: ThreeNamespace.Color, input: Cinema2ColorInput): void {
  if (typeof input === 'string' || typeof input === 'number') target.set(input as ThreeNamespace.ColorRepresentation)
  else target.setRGB(input[0], input[1], input[2])
}

const FILTERS: Readonly<Record<Cinema2TextureFilter, (THREE: Cinema2ThreeNamespace) => ThreeNamespace.TextureFilter>> = Object.freeze({
  'nearest': THREE => THREE.NearestFilter,
  'linear': THREE => THREE.LinearFilter,
  'nearest-mipmap-nearest': THREE => THREE.NearestMipmapNearestFilter,
  'linear-mipmap-nearest': THREE => THREE.LinearMipmapNearestFilter,
  'nearest-mipmap-linear': THREE => THREE.NearestMipmapLinearFilter,
  'linear-mipmap-linear': THREE => THREE.LinearMipmapLinearFilter,
})

/** The correct color space for a slot: sRGB for color maps, `NoColorSpace` for data. */
export function expectedCinema2TextureColorSpace(THREE: Cinema2ThreeNamespace, slot: Cinema2MaterialMapSlot): string {
  return CINEMA2_COLOR_MAP_SLOTS.has(slot) ? THREE.SRGBColorSpace : THREE.NoColorSpace
}

/**
 * Whether a texture's color space is acceptable for its slot. Data slots accept `NoColorSpace` and `LinearSRGBColorSpace` alike: both mean
 * "sample as stored, no transfer function", and `KTX2Loader` labels the non-color textures of a KTX2 file `srgb-linear`. Only a transfer function
 * on a data slot (or none on a color slot) is wrong.
 */
export function isCinema2TextureColorSpaceCorrect(THREE: Cinema2ThreeNamespace, slot: Cinema2MaterialMapSlot, colorSpace: string): boolean {
  if (CINEMA2_COLOR_MAP_SLOTS.has(slot)) return colorSpace === THREE.SRGBColorSpace
  return colorSpace === THREE.NoColorSpace || colorSpace === THREE.LinearSRGBColorSpace
}

/** Sets the filtering a profile asks for. Returns whether the texture must be re-uploaded (sampler state is applied at upload). */
export function applyCinema2TextureFiltering(THREE: Cinema2ThreeNamespace, texture: ThreeNamespace.Texture, filtering: Readonly<Cinema2TextureFiltering>, maxAnisotropy = 1): boolean {
  let changed = false
  if (filtering.anisotropy !== undefined) {
    const value = Math.max(1, Math.min(Math.floor(filtering.anisotropy), Math.max(1, maxAnisotropy)))
    if (texture.anisotropy !== value) { texture.anisotropy = value; changed = true }
  }
  if (filtering.minFilter !== undefined) {
    const value = FILTERS[filtering.minFilter](THREE)
    if (texture.minFilter !== value) { texture.minFilter = value; changed = true }
  }
  if (filtering.magFilter !== undefined) {
    const value = FILTERS[filtering.magFilter](THREE)
    if (texture.magFilter !== value) { texture.magFilter = value as ThreeNamespace.MagnificationTextureFilter; changed = true }
  }
  if (filtering.generateMipmaps !== undefined && texture.generateMipmaps !== filtering.generateMipmaps) {
    texture.generateMipmaps = filtering.generateMipmaps
    changed = true
  }
  if (changed) texture.needsUpdate = true
  return changed
}

function applyTransform(THREE: Cinema2ThreeNamespace, texture: ThreeNamespace.Texture, transform: Readonly<Cinema2TextureTransform>): void {
  if (transform.offset) texture.offset.set(transform.offset[0], transform.offset[1])
  if (transform.repeat) texture.repeat.set(transform.repeat[0], transform.repeat[1])
  if (transform.center) texture.center.set(transform.center[0], transform.center[1])
  if (transform.rotation !== undefined) texture.rotation = transform.rotation
  // A repeat only tiles when the texture wraps; clamped textures would just smear their edge pixels.
  if (transform.repeat) {
    if (texture.wrapS === THREE.ClampToEdgeWrapping) texture.wrapS = THREE.RepeatWrapping
    if (texture.wrapT === THREE.ClampToEdgeWrapping) texture.wrapT = THREE.RepeatWrapping
  }
}

/** Marks a texture clone as owned by one material, so later transforms mutate it instead of cloning again. */
const OWNER_KEY = 'cinema2UvOwner'

function ownedTexture(material: ThreeNamespace.Material, texture: ThreeNamespace.Texture): ThreeNamespace.Texture {
  if (texture.userData?.[OWNER_KEY] === material.uuid) return texture
  const clone = texture.clone()
  clone.userData = { ...texture.userData, [OWNER_KEY]: material.uuid }
  return clone
}

function mapsOf(material: ThreeNamespace.Material): { slot: Cinema2MaterialMapSlot; texture: ThreeNamespace.Texture }[] {
  const found: { slot: Cinema2MaterialMapSlot; texture: ThreeNamespace.Texture }[] = []
  const record = material as unknown as Record<string, unknown>
  for (const slot of CINEMA2_MATERIAL_MAP_SLOTS) {
    const value = record[slot]
    if (value && (value as ThreeNamespace.Texture).isTexture) found.push({ slot, texture: value as ThreeNamespace.Texture })
  }
  return found
}

export interface Cinema2TextureColorSpaceFix {
  slot: Cinema2MaterialMapSlot
  expected: string
  was: string
}

/**
 * Makes every texture slot's color space match what the slot holds (sRGB color, linear data). GLTFLoader already does this for imported
 * materials; the function is the safety net for materials assembled in code and returns what it had to correct. A corrected texture is
 * re-uploaded because its internal format changes.
 */
export function normalizeCinema2TextureColorSpaces(THREE: Cinema2ThreeNamespace, material: ThreeNamespace.Material): readonly Cinema2TextureColorSpaceFix[] {
  const fixes: Cinema2TextureColorSpaceFix[] = []
  for (const { slot, texture } of mapsOf(material)) {
    const expected = expectedCinema2TextureColorSpace(THREE, slot)
    if (isCinema2TextureColorSpaceCorrect(THREE, slot, texture.colorSpace)) continue
    fixes.push({ slot, expected, was: texture.colorSpace })
    texture.colorSpace = expected
    texture.needsUpdate = true
  }
  return fixes
}

export interface Cinema2MaterialAudit {
  className: string
  physical: boolean
  /** Textures by slot, with whether their color space is the one the slot needs. */
  textures: readonly Readonly<{ slot: Cinema2MaterialMapSlot; colorSpace: string; colorSpaceCorrect: boolean; anisotropy: number; width: number | null; height: number | null }>[]
  /** Physical features the material actually uses (value differs from Three's neutral default). */
  features: readonly string[]
  customShader: boolean
}

export function auditCinema2Material(THREE: Cinema2ThreeNamespace, material: ThreeNamespace.Material): Readonly<Cinema2MaterialAudit> {
  const textures = mapsOf(material).map(({ slot, texture }) => {
    const image = texture.image as { width?: number; height?: number } | null
    return Object.freeze({
      slot,
      colorSpace: texture.colorSpace,
      colorSpaceCorrect: isCinema2TextureColorSpaceCorrect(THREE, slot, texture.colorSpace),
      anisotropy: texture.anisotropy,
      width: image?.width ?? null,
      height: image?.height ?? null,
    })
  })
  const features: string[] = []
  const m = material as unknown as Record<string, number | undefined>
  if (isStandardFamily(material)) {
    if ((m.clearcoat ?? 0) > 0) features.push('clearcoat')
    if ((m.transmission ?? 0) > 0) features.push('transmission')
    if ((m.iridescence ?? 0) > 0) features.push('iridescence')
    if ((m.anisotropy ?? 0) > 0) features.push('anisotropy')
    if ((m.sheen ?? 0) > 0) features.push('sheen')
    if ((m.dispersion ?? 0) > 0) features.push('dispersion')
    if (m.specularIntensity !== undefined && m.specularIntensity !== 1) features.push('specular')
    if (m.ior !== undefined && Math.abs(m.ior - 1.5) > 1e-6) features.push('ior')
    if ((m.emissiveIntensity ?? 1) !== 1) features.push('emissive-intensity')
  }
  return Object.freeze({
    className: material.constructor?.name ?? 'Material',
    physical: (material as MaterialLike).isMeshPhysicalMaterial === true,
    textures: Object.freeze(textures),
    features: Object.freeze(features),
    customShader: (material as MaterialLike & { isShaderMaterial?: boolean }).isShaderMaterial === true || material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile,
  })
}

/**
 * Applies a profile to a material. Returns the material to use (a physical replacement when the profile needs one; the caller must swap it onto
 * its mesh and may dispose the original through the ledger). Never throws on an unsupported material: it is skipped and reported.
 */
export function applyCinema2MaterialProfile(
  THREE: Cinema2ThreeNamespace,
  source: ThreeNamespace.Material,
  profile: Readonly<Cinema2MaterialProfile>,
  options: Readonly<Cinema2MaterialApplyOptions> = {},
): Readonly<Cinema2MaterialApplyResult> {
  const applied: string[] = []
  const skipped: { property: string; reason: string }[] = []
  const finish = (material: ThreeNamespace.Material, upgraded: boolean): Readonly<Cinema2MaterialApplyResult> =>
    Object.freeze({ material, upgraded, applied: Object.freeze(applied), skipped: Object.freeze(skipped.map(entry => Object.freeze(entry))) })

  if (!isStandardFamily(source)) {
    skipped.push({ property: '*', reason: `${source.constructor?.name ?? 'This material'} is a custom or non-PBR material; it is left untouched.` })
    return finish(source, false)
  }

  let material: ThreeNamespace.MeshStandardMaterial | ThreeNamespace.MeshPhysicalMaterial = source
  let upgraded = false
  if (cinema2ProfileNeedsPhysical(profile) && !(source as MaterialLike).isMeshPhysicalMaterial) {
    const physical = upgradeCinema2MaterialToPhysical(THREE, source)
    if (physical) { material = physical; upgraded = true }
    else {
      for (const key of PHYSICAL_KEYS) if (profile[key] !== undefined) skipped.push({ property: key, reason: 'the material has a custom shader hook and cannot be promoted to a physical material' })
    }
  }
  const physical = (material as MaterialLike).isMeshPhysicalMaterial === true ? material as ThreeNamespace.MeshPhysicalMaterial : null

  const set = (property: string, apply: () => void): void => { apply(); applied.push(property) }
  const gated = (property: string): boolean => {
    const feature = FEATURE_OF[property]
    if (feature && options.features && !options.features[feature]) {
      skipped.push({ property, reason: `${feature} is turned off on this quality tier` })
      return true
    }
    return false
  }
  const physicalOnly = (property: string, apply: (m: ThreeNamespace.MeshPhysicalMaterial) => void): void => {
    if (profile[property as keyof Cinema2MaterialProfile] === undefined) return
    if (!physical) return // already reported when the upgrade was refused
    if (gated(property)) return
    set(property, () => apply(physical))
  }

  if (profile.color !== undefined) set('color', () => applyColor(THREE, material.color, profile.color!))
  if (profile.metalness !== undefined) set('metalness', () => { material.metalness = profile.metalness! })
  if (profile.roughness !== undefined) set('roughness', () => { material.roughness = profile.roughness! })
  if (profile.normalScale !== undefined) {
    set('normalScale', () => {
      const scale = profile.normalScale!
      if (typeof scale === 'number') material.normalScale.set(scale, scale)
      else material.normalScale.set(scale[0], scale[1])
    })
  }
  if (profile.aoMapIntensity !== undefined) set('aoMapIntensity', () => { material.aoMapIntensity = profile.aoMapIntensity! })
  if (profile.emissive !== undefined) set('emissive', () => applyColor(THREE, material.emissive, profile.emissive!))
  if (profile.emissiveIntensity !== undefined) set('emissiveIntensity', () => { material.emissiveIntensity = profile.emissiveIntensity! })
  if (profile.displacementScale !== undefined) set('displacementScale', () => { material.displacementScale = profile.displacementScale! })
  if (profile.displacementBias !== undefined) set('displacementBias', () => { material.displacementBias = profile.displacementBias! })
  if (profile.bumpScale !== undefined) set('bumpScale', () => { material.bumpScale = profile.bumpScale! })

  if (profile.opacity !== undefined) {
    set('opacity', () => {
      material.opacity = profile.opacity!
      if (profile.alphaMode === undefined && profile.opacity! < 1) material.transparent = true
    })
  }
  if (profile.alphaMode !== undefined) {
    set('alphaMode', () => {
      if (profile.alphaMode === 'blend') { material.transparent = true; material.alphaTest = 0; material.depthWrite = false }
      else if (profile.alphaMode === 'mask') { material.transparent = false; material.alphaTest = profile.alphaCutoff ?? 0.5; material.depthWrite = true }
      else { material.transparent = false; material.alphaTest = 0; material.depthWrite = true }
      material.needsUpdate = true
    })
  } else if (profile.alphaCutoff !== undefined) {
    set('alphaCutoff', () => { material.alphaTest = profile.alphaCutoff!; material.needsUpdate = true })
  }
  if (profile.doubleSided !== undefined) set('doubleSided', () => { material.side = profile.doubleSided ? THREE.DoubleSide : THREE.FrontSide })

  physicalOnly('clearcoat', m => { m.clearcoat = profile.clearcoat! })
  physicalOnly('clearcoatRoughness', m => { m.clearcoatRoughness = profile.clearcoatRoughness! })
  // Transmission is held above zero once requested: exactly 0 drops the refraction pass from the program, and a later non-zero value would recompile.
  physicalOnly('transmission', m => { m.transmission = profile.transmission! })
  physicalOnly('ior', m => { m.ior = profile.ior! })
  physicalOnly('thickness', m => { m.thickness = profile.thickness! })
  physicalOnly('attenuationColor', m => applyColor(THREE, m.attenuationColor, profile.attenuationColor!))
  physicalOnly('attenuationDistance', m => { m.attenuationDistance = profile.attenuationDistance! })
  physicalOnly('dispersion', m => { m.dispersion = profile.dispersion! })
  physicalOnly('iridescence', m => { m.iridescence = profile.iridescence! })
  physicalOnly('iridescenceIOR', m => { m.iridescenceIOR = profile.iridescenceIOR! })
  physicalOnly('iridescenceThicknessRange', m => { m.iridescenceThicknessRange = [profile.iridescenceThicknessRange![0], profile.iridescenceThicknessRange![1]] })
  physicalOnly('anisotropy', m => { m.anisotropy = profile.anisotropy! })
  physicalOnly('anisotropyRotation', m => { m.anisotropyRotation = profile.anisotropyRotation! })
  physicalOnly('specularIntensity', m => { m.specularIntensity = profile.specularIntensity! })
  physicalOnly('specularColor', m => applyColor(THREE, m.specularColor, profile.specularColor!))
  physicalOnly('sheen', m => { m.sheen = profile.sheen! })
  physicalOnly('sheenColor', m => applyColor(THREE, m.sheenColor, profile.sheenColor!))
  physicalOnly('sheenRoughness', m => { m.sheenRoughness = profile.sheenRoughness! })

  if (profile.reflectionIntensity !== undefined) {
    if (options.environment) {
      set('reflectionIntensity', () => { material.envMap = options.environment!; material.envMapIntensity = profile.reflectionIntensity! })
    } else {
      skipped.push({ property: 'reflectionIntensity', reason: 'needs options.environment (Three applies envMapIntensity only to a material that holds its own envMap)' })
    }
  }

  if (profile.uvTransform) {
    for (const { slot, texture } of mapsOf(material)) {
      const transform = profile.uvTransform[slot] ?? profile.uvTransform.all
      if (!transform) continue
      const own = ownedTexture(material, texture)
      applyTransform(THREE, own, transform)
      if (own !== texture) (material as unknown as Record<string, unknown>)[slot] = own
      applied.push(`uvTransform.${slot}`)
    }
  }
  if (profile.filtering) {
    let any = false
    for (const { slot, texture } of mapsOf(material)) {
      const own = ownedTexture(material, texture)
      const changed = applyCinema2TextureFiltering(THREE, own, profile.filtering, options.maxAnisotropy)
      if (own !== texture) (material as unknown as Record<string, unknown>)[slot] = own
      if (changed) any = true
    }
    if (any) applied.push('filtering')
  }

  if (upgraded || applied.length > 0) material.needsUpdate = true
  return finish(material, upgraded)
}

/**
 * Applies a profile to every standard/physical material under `root`, replacing materials that had to be promoted to physical. Returns the
 * originals that were replaced; the caller releases them (ledger) when nothing else uses them.
 */
export function applyCinema2MaterialProfileToObject(
  THREE: Cinema2ThreeNamespace,
  root: ThreeNamespace.Object3D,
  profile: Readonly<Cinema2MaterialProfile>,
  options: Readonly<Cinema2MaterialApplyOptions> & { materialName?: string | RegExp } = {},
): { replaced: ThreeNamespace.Material[]; results: Cinema2MaterialApplyResult[] } {
  const replaced: ThreeNamespace.Material[] = []
  const results: Cinema2MaterialApplyResult[] = []
  const done = new Map<ThreeNamespace.Material, ThreeNamespace.Material>()
  const matches = (name: string): boolean => options.materialName === undefined
    || (typeof options.materialName === 'string' ? options.materialName === name : options.materialName.test(name))
  root.traverse(object => {
    const mesh = object as ThreeNamespace.Mesh
    if (!mesh.isMesh) return
    const swap = (material: ThreeNamespace.Material): ThreeNamespace.Material => {
      if (!matches(material.name)) return material
      const known = done.get(material)
      if (known) return known
      const result = applyCinema2MaterialProfile(THREE, material, profile, options)
      results.push(result)
      done.set(material, result.material)
      if (result.material !== material) replaced.push(material)
      return result.material
    }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material)
  })
  return { replaced, results }
}

// ---------------------------------------------------------------- quality gates

const GATE_KEY = 'cinema2QualityGate'

interface GateRecord { transmission?: number; iridescence?: number; anisotropy?: number }

/**
 * Turns a physical feature off for a quality tier, remembering the authored value so a later, higher tier restores it. Cheap per-frame state
 * does not change; the shader recompiles only when a feature crosses zero, which happens on a tier change, not during playback.
 */
export function applyCinema2MaterialQualityGate(material: ThreeNamespace.Material, features: Readonly<Cinema2PbrQuality>): boolean {
  if (!(material as MaterialLike).isMeshPhysicalMaterial) return false
  const physical = material as ThreeNamespace.MeshPhysicalMaterial
  const record = (physical.userData[GATE_KEY] ??= {}) as GateRecord
  let changed = false
  const gate = (name: keyof GateRecord, allowed: boolean): void => {
    const current = physical[name]
    if (!allowed) {
      if (current > 0) { record[name] = current; physical[name] = 0; changed = true }
    } else if (record[name] !== undefined) {
      physical[name] = record[name]!
      delete record[name]
      changed = true
    }
  }
  gate('transmission', features.transmission)
  gate('iridescence', features.iridescence)
  gate('anisotropy', features.anisotropy)
  if (changed) physical.needsUpdate = true
  return changed
}

export function applyCinema2MaterialQualityGateToObject(root: ThreeNamespace.Object3D, features: Readonly<Cinema2PbrQuality>): number {
  let changed = 0
  const seen = new Set<ThreeNamespace.Material>()
  root.traverse(object => {
    const mesh = object as ThreeNamespace.Mesh
    if (!mesh.isMesh) return
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (seen.has(material)) continue
      seen.add(material)
      if (applyCinema2MaterialQualityGate(material, features)) changed += 1
    }
  })
  return changed
}

// ---------------------------------------------------------------- shared ownership

function collectResources(root: ThreeNamespace.Object3D): Set<Cinema2Disposable> {
  const resources = new Set<Cinema2Disposable>()
  root.traverse(object => {
    const mesh = object as ThreeNamespace.Mesh
    if (!mesh.isMesh) return
    if (mesh.geometry) resources.add(mesh.geometry)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material) continue
      resources.add(material)
      for (const value of Object.values(material)) {
        if (value && (value as ThreeNamespace.Texture).isTexture) resources.add(value as ThreeNamespace.Texture)
      }
    }
  })
  return resources
}

/** Registers every geometry, material and texture under `root` as held by one more owner. */
export function retainCinema2ObjectResources(ledger: Cinema2ThreeResourceLedger, root: ThreeNamespace.Object3D): number {
  const resources = collectResources(root)
  for (const resource of resources) ledger.retain(resource)
  return resources.size
}

/** Releases the holds `retainCinema2ObjectResources` took; anything no other owner holds is disposed. Returns how many were disposed. */
export function releaseCinema2ObjectResources(ledger: Cinema2ThreeResourceLedger, root: ThreeNamespace.Object3D): number {
  let disposed = 0
  for (const resource of collectResources(root)) if (ledger.release(resource)) disposed += 1
  return disposed
}

interface LibraryEntry { material: ThreeNamespace.Material; holders: number }

/**
 * Shared material cache. Two scenes asking for the same key get the same material instance; the material (and the textures only it holds) is
 * disposed when the last holder releases it.
 */
export class Cinema2ThreeMaterialLibrary {
  private readonly entries = new Map<string, LibraryEntry>()

  constructor(private readonly ledger: Cinema2ThreeResourceLedger = new Cinema2ThreeResourceLedger()) {}

  acquire(key: string, create: () => ThreeNamespace.Material): ThreeNamespace.Material {
    const existing = this.entries.get(key)
    if (existing) {
      existing.holders += 1
      return existing.material
    }
    const material = create()
    this.ledger.retain(material)
    for (const value of Object.values(material)) {
      if (value && (value as ThreeNamespace.Texture).isTexture) this.ledger.retain(value as ThreeNamespace.Texture)
    }
    this.entries.set(key, { material, holders: 1 })
    return material
  }

  release(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    entry.holders -= 1
    if (entry.holders > 0) return
    this.entries.delete(key)
    for (const value of Object.values(entry.material)) {
      if (value && (value as ThreeNamespace.Texture).isTexture) this.ledger.release(value as ThreeNamespace.Texture)
    }
    this.ledger.release(entry.material)
  }

  has(key: string): boolean {
    return this.entries.has(key)
  }

  get size(): number {
    return this.entries.size
  }

  getLedger(): Cinema2ThreeResourceLedger {
    return this.ledger
  }

  dispose(): void {
    for (const key of [...this.entries.keys()]) {
      const entry = this.entries.get(key)
      if (entry) entry.holders = 1
      this.release(key)
    }
  }
}
