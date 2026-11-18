import type { GLTFParser, GLTFLoaderPlugin } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Cinema2ThreeLibrary } from './Cinema2ThreeLibrary'

export const CINEMA2_LEGACY_MATERIAL_EXTENSION = 'KHR_materials_pbrSpecularGlossiness'

/** The crate's Paradox file uses factor-only legacy specular/gloss materials.
 * Preserve those colors/finish at decode time without rewriting the supplied GLB. */
export function createCinema2LegacyMaterialPlugin(parser: GLTFParser, library: Cinema2ThreeLibrary): GLTFLoaderPlugin {
  const extension = (index: number) => parser.json.materials?.[index]?.extensions?.[CINEMA2_LEGACY_MATERIAL_EXTENSION]
  return {
    name: CINEMA2_LEGACY_MATERIAL_EXTENSION,
    getMaterialType: index => extension(index) ? library.THREE.MeshPhysicalMaterial : null,
    async extendMaterialParams(index, params) {
      const values = extension(index)
      if (!values) return
      if (values.specularGlossinessTexture) throw new Error('Textured legacy specular/gloss materials require conversion before import.')
      const diffuse = values.diffuseFactor ?? [1, 1, 1, 1]
      params.color = new library.THREE.Color().fromArray(diffuse)
      params.opacity = diffuse[3]
      params.metalness = 0
      params.roughness = 1 - (values.glossinessFactor ?? 1)
      params.specularColor = new library.THREE.Color().fromArray(values.specularFactor ?? [1, 1, 1])
      if (values.diffuseTexture) await parser.assignTexture(params, 'map', values.diffuseTexture, library.THREE.SRGBColorSpace)
    },
  }
}
