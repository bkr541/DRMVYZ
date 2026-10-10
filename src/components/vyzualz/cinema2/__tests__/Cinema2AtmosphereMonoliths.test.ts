import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cinema2ThreeAssetRegistry, CINEMA2_ATMOSPHERE_MONOLITHS_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import {
  CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS,
  CINEMA2_ATMOSPHERE_REFERENCE_CENTER_LIGHT_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_CRACK_GLOW_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_CRYSTAL_CLARITY_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_CRYSTAL_SPARKLE_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_MODULE_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST as MANIFEST,
  CINEMA2_ATMOSPHERE_REFERENCE_RIGHT_LIGHT_ID,
} from '../presets/Cinema2AtmosphereReferencePreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_THREE_MODEL_REFERENCE_PRESET_MANIFEST } from '../presets/Cinema2ThreeModelReferencePreset'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting',
  'music.beat', 'music.downbeat', 'music.phrase', 'visual-director.significance',
] as const
const PARTS = ['left', 'violet', 'right', 'back'] as const
/** Each monolith colour has a matching crack part inside the centre crystal. */
const CRACK_PARTS = { left: 'crackLeft', violet: 'crackViolet', right: 'crackRight', back: 'crackBack' } as const
const CRYSTAL_PARTS = ['crystal', 'frame', ...Object.values(CRACK_PARTS)] as const

const objectModule = () => MANIFEST.modules!.find(module => module.id === CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_MODULE_ID)!

function readGlb(path: string) {
  const bytes = readFileSync(resolve(process.cwd(), path))
  const jsonLength = bytes.readUInt32LE(12)
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as {
    nodes: { name: string }[]
    materials: { name: string; pbrMetallicRoughness: { baseColorTexture?: unknown }; normalTexture?: unknown; emissiveTexture?: unknown; emissiveFactor?: number[] }[]
    images: { bufferView: number }[]
  }
}

describe('Cinema 2.0 Atmosphere Reference monoliths', () => {
  it('ships one model with a part per monolith (each with the full rock texture set and a crack emissive mask) and the crystal\'s parts', () => {
    for (const path of ['public/cinema2/models/atmosphere-monoliths.glb', 'public/cinema2/models/atmosphere-monoliths-512.glb']) {
      const glb = readGlb(path)
      const all = [...PARTS, ...CRYSTAL_PARTS].sort()
      expect(glb.nodes.map(node => node.name).sort()).toEqual(all)
      expect(glb.materials.map(material => material.name).sort()).toEqual(all)
      for (const material of glb.materials.filter(entry => (PARTS as readonly string[]).includes(entry.name))) {
        expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined()
        expect(material.normalTexture).toBeDefined()
        expect(material.emissiveTexture).toBeDefined()
        // White, so the per-part accent colour is what tints the cracks.
        expect(material.emissiveFactor).toEqual([1, 1, 1])
      }
      // The crack parts are untextured and white-emissive too, so the same accent colour tints them.
      for (const part of Object.values(CRACK_PARTS)) {
        expect(glb.materials.find(material => material.name === part)).toMatchObject({ emissiveFactor: [1, 1, 1] })
      }
      // Only the low build bakes a translucent crystal, because that tier draws no refraction.
      const crystal = glb.materials.find(material => material.name === 'crystal') as { alphaMode?: string }
      expect(crystal.alphaMode === 'BLEND').toBe(path.endsWith('-512.glb'))
      // The four monoliths share one set of four embedded images.
      expect(glb.images).toHaveLength(4)
    }
    expect(cinema2ThreeAssetRegistry.has(CINEMA2_ATMOSPHERE_MONOLITHS_ASSET_ID)).toBe(true)
    expect(cinema2ThreeAssetRegistry.resolveUrl(CINEMA2_ATMOSPHERE_MONOLITHS_ASSET_ID, 'low')).toContain('-512')
  })

  it('places that model with the preset module and gives every monolith its own accent colour and crack glow control', () => {
    const module = objectModule()
    expect(String(module.typeId)).toBe('three-scene')
    expect(module.config).toMatchObject({ instances: [{ asset: CINEMA2_ATMOSPHERE_MONOLITHS_ASSET_ID }], parts: [...PARTS, ...CRYSTAL_PARTS] })
    const instance = (module.config as { instances: { node: string }[] }).instances[0]
    expect(MANIFEST.scene!.nodes.find(node => String(node.id) === instance.node)).toMatchObject({ kind: 'module' })

    const parameters = module.parameters as Record<string, unknown>
    const bindings = module.parameterBindings as Record<string, { $ref: string }>
    const declared = new Map(MANIFEST.parameters!.map(parameter => [parameter.id, parameter]))
    const accents = new Set<string>()
    for (const part of PARTS) {
      const accent = declared.get(CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS[part])
      expect(accent).toMatchObject({ type: 'color', designParentGroup: 'palette' })
      expect(bindings[`${part}.emissive`].$ref).toBe(CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS[part])
      expect(bindings[`${part}.emissiveIntensity`].$ref).toBe(CINEMA2_ATMOSPHERE_REFERENCE_CRACK_GLOW_ID)
      expect(parameters[`${part}.emissive`]).toEqual((accent as { defaultValue: unknown }).defaultValue)
      accents.add(JSON.stringify(parameters[`${part}.emissive`]))
      // The crystal's matching crack part takes the same colour control and the same glow level.
      const crack = CRACK_PARTS[part]
      expect(bindings[`${crack}.emissive`].$ref).toBe(CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS[part])
      expect(bindings[`${crack}.emissiveIntensity`].$ref).toBe(CINEMA2_ATMOSPHERE_REFERENCE_CRACK_GLOW_ID)
      expect(parameters[`${crack}.emissive`]).toEqual(parameters[`${part}.emissive`])
    }
    expect(accents.size).toBe(4)
    expect(declared.get(CINEMA2_ATMOSPHERE_REFERENCE_CRACK_GLOW_ID)).toMatchObject({ type: 'float' })
    // Clear glass: see-through and prismatic, with its own two controls.
    expect(parameters['crystal.transmission']).toBeGreaterThan(0.8)
    expect(parameters['crystal.iridescence']).toBeGreaterThan(0)
    expect(bindings['crystal.transmission'].$ref).toBe(CINEMA2_ATMOSPHERE_REFERENCE_CRYSTAL_CLARITY_ID)
    expect(bindings['crystal.dispersion'].$ref).toBe(CINEMA2_ATMOSPHERE_REFERENCE_CRYSTAL_SPARKLE_ID)
  })

  it('lights the tall back monolith with the key spot and the side monoliths with the side spots', () => {
    const target = (lightId: string) => String(MANIFEST.lighting!.lights.find(light => light.id === lightId)!.targetNode!.$ref)
    expect(target(CINEMA2_ATMOSPHERE_REFERENCE_CENTER_LIGHT_ID)).toBe('atmosphere-reference-object-back')
    expect(target(CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID)).toBe('atmosphere-reference-object-left')
    expect(target(CINEMA2_ATMOSPHERE_REFERENCE_RIGHT_LIGHT_ID)).toBe('atmosphere-reference-object-right')
    const nodeIds = new Set(MANIFEST.scene!.nodes.map(node => String(node.id)))
    for (const part of PARTS) expect(nodeIds.has(`atmosphere-reference-object-${part}`)).toBe(true)
  })

  it('flares one colour per beat, in turn round a four-beat cycle, in its monolith and in the crystal', () => {
    const rules = MANIFEST.choreography!.rules.filter(rule => String(rule.id).startsWith('atmosphere-reference-monolith-'))
    expect(rules).toHaveLength(4)
    const phases = rules.map(rule => (rule.conditions![0] as { every: number; phase: number }))
    expect(phases.map(condition => condition.every)).toEqual([4, 4, 4, 4])
    expect(phases.map(condition => condition.phase).sort()).toEqual([0, 1, 2, 3])
    rules.forEach((rule, index) => {
      expect(rule.source).toMatchObject({ signal: 'beat' })
      // The monolith itself and the matching cracks inside the crystal flare together.
      expect(rule.actions.map(action => (action.target as { property: string }).property)).toEqual([
        `${PARTS[index]}.emissiveIntensity`,
        `${CRACK_PARTS[PARTS[index]]}.emissiveIntensity`,
      ])
    })
  })

  it('compiles, and leaves the Three Model Reference preset on its own pillar layout without the monolith controls', () => {
    expect(compileCinema2NativePreset(MANIFEST, { availableCapabilities: CAPABILITIES }).ok).toBe(true)
    const reference = CINEMA2_THREE_MODEL_REFERENCE_PRESET_MANIFEST
    expect(compileCinema2NativePreset(reference, { availableCapabilities: CAPABILITIES }).ok).toBe(true)
    expect(reference.scene!.nodes.filter(node => node.kind === 'module')).toHaveLength(4)
    expect(reference.parameters!.some(parameter => /accent|crystal/.test(String(parameter.id)))).toBe(false)
    expect(reference.choreography!.rules.some(rule => String(rule.id).startsWith('atmosphere-reference-monolith-'))).toBe(false)
  })
})
