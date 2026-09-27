import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CINEMA2_DESIGN_PARENT_GROUP_IDS, type Cinema2ModuleManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_ASSET_RECORDS } from '../assets/Cinema2AssetManifest.generated'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2ThreeSceneModuleDefinition } from '../modules/Cinema2ThreeSceneModule'
import { CINEMA2_GOLDEN_ROOTS_ASSET_ID, cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID, cinema2ThreeEnvironmentRegistry } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import {
  CINEMA2_RELIQUARY_LOGO_NODE_ID,
  CINEMA2_RELIQUARY_MODULE_ID,
  CINEMA2_RELIQUARY_PRESET_ID,
  CINEMA2_RELIQUARY_PRESET_MANIFEST,
  CINEMA2_RELIQUARY_ROOTS_NODE_ID,
} from '../presets/Cinema2ReliquaryPreset'

const CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'music.beat'] as const
const manifest = CINEMA2_RELIQUARY_PRESET_MANIFEST
const parameters = manifest.parameters ?? []
const byLabel = (label: string) => parameters.find(parameter => parameter.label === label)

describe('RELIQUARY preset', () => {
  it('is a visible keeper in the first-party catalog, named RELIQUARY, and passes the authoring gate and the native compiler', () => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(entry => entry.manifest.id === CINEMA2_RELIQUARY_PRESET_ID)
    expect(declaration?.role).toBe('keeper')
    expect(manifest.metadata.name).toBe('RELIQUARY')
    expect(manifest.metadata.tags).not.toContain('internal')
    const gate = validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })
    if (!gate.ok) throw new Error(gate.diagnostics.map(diagnostic => `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`).join('\n'))
    expect(gate.ok).toBe(true)
    const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    expect(cinema2NativePresetRegistry.get(CINEMA2_RELIQUARY_PRESET_ID)).not.toBeNull()
  })

  it('meets the shared control contract: Master Intensity and a real BPM Sync under Master Controls, four or more palette colors, every Design control under a parent group', () => {
    const designControls = parameters.filter(parameter => parameter.section === 'Design')
    for (const parameter of designControls) expect(CINEMA2_DESIGN_PARENT_GROUP_IDS).toContain(parameter.designParentGroup)
    expect(byLabel('Master Intensity')?.designParentGroup).toBe('master-controls')
    expect(byLabel('BPM Sync')).toMatchObject({ designParentGroup: 'master-controls', type: 'boolean', defaultValue: true })
    expect(designControls.filter(parameter => parameter.designParentGroup === 'palette' && parameter.type === 'color').length).toBeGreaterThanOrEqual(4)
    // Both are genuinely consumed (the beat-alternation rule), not just declared: the authoring gate's CONTROL_UNCONSUMED check already
    // proves this, but check the wiring directly too, since a future edit could re-break it silently.
    const rule = manifest.choreography?.rules?.[0]
    expect(rule?.strengthParameter).toEqual({ $ref: byLabel('Master Intensity')?.id })
    expect(rule?.enabledParameter).toEqual({ $ref: byLabel('BPM Sync')?.id })
  })

  it('places the shared logo asset (its outline tinted/roughened to match the crystal, no gold ring) and the golden-roots asset, both static, sharing one three-scene module', () => {
    const module = manifest.modules?.[0] as Readonly<Cinema2ModuleManifest>
    expect(module.id).toBe(CINEMA2_RELIQUARY_MODULE_ID)
    const instances = module.config?.instances as { asset: string; node: string; spin?: boolean }[]
    expect(instances.map(instance => instance.asset).sort()).toEqual(['cinema2-dvydrm-logo', 'cinema2-golden-roots'].sort())
    for (const instance of instances) expect(instance.spin, `${instance.asset} does not spin`).not.toBe(true)
    expect(module.config?.parts).toEqual(['outline', 'crystal', 'roots', 'leaves'])
    expect(module.parameters?.['outline.color']).toEqual(module.parameters?.['crystal.color'])
    expect(module.parameters?.['outline.roughness']).toEqual(module.parameters?.['crystal.roughness'])
    expect(module.parameterBindings?.['outline.color']).toEqual(module.parameterBindings?.['crystal.color'])
    expect(cinema2ThreeSceneModuleDefinition.validate?.(module)).toEqual([])
    // Two distinct scene nodes place the two instances; each instance's own `node` matches one of them.
    const nodeIds = new Set((manifest.scene?.nodes ?? []).map(node => node.id))
    expect(nodeIds.has(CINEMA2_RELIQUARY_LOGO_NODE_ID)).toBe(true)
    expect(nodeIds.has(CINEMA2_RELIQUARY_ROOTS_NODE_ID)).toBe(true)
    expect(instances.map(instance => instance.node).sort()).toEqual([CINEMA2_RELIQUARY_LOGO_NODE_ID, CINEMA2_RELIQUARY_ROOTS_NODE_ID].sort())
  })

  it('renders directly through one depth-enabled scene pass - no haze, bloom, floor reflection or cinematic finish yet - and the camera is static', () => {
    expect(manifest.effects ?? []).toEqual([])
    expect(manifest.render?.passes).toHaveLength(1)
    expect(manifest.render?.passes?.[0]?.kind).toBe('scene')
    expect(manifest.cameras?.[0]?.rig).toEqual({ kind: 'static' })
    expect(manifest.cameras?.[0]).not.toHaveProperty('motion')
  })
})

describe('golden-roots shared asset', () => {
  it('is a registered, licensed model with four parts built from the hand-authored root/branch curve network', () => {
    expect(cinema2ThreeAssetRegistry.has(CINEMA2_GOLDEN_ROOTS_ASSET_ID)).toBe(true)
    const record = CINEMA2_ASSET_RECORDS.find(entry => entry.id === CINEMA2_GOLDEN_ROOTS_ASSET_ID)
    expect(record).toMatchObject({ kind: 'model', license: 'generated-in-house' })
    const glb = readFileSync(resolve(process.cwd(), 'public/cinema2/models/golden-roots.glb'))
    expect(glb.readUInt32LE(0)).toBe(0x46546c67) // "glTF"
    const jsonLength = glb.readUInt32LE(12)
    const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')) as { meshes: { name: string }[]; materials: { name: string }[] }
    const parts = new Set(json.materials.map(material => material.name))
    expect(parts).toEqual(new Set(['roots', 'leaves', 'dais', 'daisRing']))
    expect(json.meshes.length).toBeGreaterThan(4) // many curves/leaves, not one mesh per part
  })

  it('is registered in the shared studio-neutral environment (reused from GO-TO, avoids tinting the metal)', () => {
    expect(cinema2ThreeEnvironmentRegistry.has(CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID)).toBe(true)
  })

  it('registers the three-scene module type', () => {
    expect(cinema2NativeModuleRegistry.get(cinema2ThreeSceneModuleDefinition.typeId, 1)).not.toBeNull()
  })
})
