import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CINEMA2_DESIGN_PARENT_GROUP_IDS, type Cinema2ModuleManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_ASSET_RECORDS } from '../assets/Cinema2AssetManifest.generated'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_THREE_SCENE_MODULE_TYPE_ID, cinema2ThreeSceneModuleDefinition, cinema2ThreeSpinRadians } from '../modules/Cinema2ThreeSceneModule'
import { CINEMA2_DVYDRM_LOGO_ASSET_ID, cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { CINEMA2_GO_TO_LOGO_NODE_ID, CINEMA2_GO_TO_MODULE_ID, CINEMA2_GO_TO_PRESET_ID, CINEMA2_GO_TO_PRESET_MANIFEST } from '../presets/Cinema2GoToPreset'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'music.beat', 'music.downbeat', 'visual-director.significance'] as const
const manifest = CINEMA2_GO_TO_PRESET_MANIFEST
const parameters = manifest.parameters ?? []
const byLabel = (label: string) => parameters.find(parameter => parameter.label === label)

describe('GO-TO preset', () => {
  it('is a visible keeper in the first-party catalog, named GO-TO, and passes the authoring gate and the native compiler', () => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(entry => entry.manifest.id === CINEMA2_GO_TO_PRESET_ID)
    expect(declaration?.role).toBe('keeper')
    expect(manifest.metadata.name).toBe('GO-TO')
    expect(manifest.metadata.tags).not.toContain('internal')
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })).toMatchObject({ ok: true })
    const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    expect(cinema2NativePresetRegistry.get(CINEMA2_GO_TO_PRESET_ID)).not.toBeNull()
    expect(cinema2NativeModuleRegistry.get(CINEMA2_THREE_SCENE_MODULE_TYPE_ID, 1)).not.toBeNull()
  })

  it('meets the shared control contract: Master Intensity and a real BPM Sync under Master Controls, four or more palette colors, every Design control under a parent group', () => {
    const designControls = parameters.filter(parameter => parameter.section === 'Design')
    for (const parameter of designControls) expect(CINEMA2_DESIGN_PARENT_GROUP_IDS).toContain(parameter.designParentGroup)
    expect(byLabel('Master Intensity')?.designParentGroup).toBe('master-controls')
    expect(byLabel('BPM Sync')).toMatchObject({ designParentGroup: 'master-controls', type: 'boolean', defaultValue: true })
    expect(designControls.filter(parameter => parameter.designParentGroup === 'palette' && parameter.type === 'color').length).toBeGreaterThanOrEqual(4)
    // BPM Sync is consumed twice: by the logo's spin lock and by the camera's tempo sway.
    const module = manifest.modules?.[0] as Readonly<Cinema2ModuleManifest>
    expect(module.parameterBindings?.spinSync).toEqual({ $ref: byLabel('BPM Sync')?.id })
    expect(manifest.cameras?.[0]?.controls?.tempoSync).toEqual({ $ref: byLabel('BPM Sync')?.id })
  })

  it('places the shared logo asset on its node, spinning, with the shipped studio environment', () => {
    const module = manifest.modules?.[0] as Readonly<Cinema2ModuleManifest>
    expect(module.id).toBe(CINEMA2_GO_TO_MODULE_ID)
    expect(module.config?.instances).toEqual([{ asset: CINEMA2_DVYDRM_LOGO_ASSET_ID, node: CINEMA2_GO_TO_LOGO_NODE_ID, spin: true }])
    expect(cinema2ThreeSceneModuleDefinition.validate?.(module)).toEqual([])
    expect(byLabel('Spin Period')).toMatchObject({ defaultValue: 24, min: 6 })
  })
})

describe('shared DVYDRM logo asset', () => {
  it('is a registered, licensed model with three parts built from the master SVG', () => {
    expect(cinema2ThreeAssetRegistry.has(CINEMA2_DVYDRM_LOGO_ASSET_ID)).toBe(true)
    const record = CINEMA2_ASSET_RECORDS.find(entry => entry.id === CINEMA2_DVYDRM_LOGO_ASSET_ID)
    expect(record).toMatchObject({ kind: 'model', license: 'generated-in-house' })
    const glb = readFileSync(resolve(process.cwd(), 'public/cinema2/models/dvydrm-logo.glb'))
    expect(glb.readUInt32LE(0)).toBe(0x46546c67) // "glTF"
    const jsonLength = glb.readUInt32LE(12)
    const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')) as { nodes: { name: string }[]; materials: { name: string }[] }
    expect(json.nodes.map(node => node.name)).toEqual(['outline', 'body', 'star'])
    expect(json.materials.map(material => material.name)).toEqual(['outline', 'body', 'star'])
  })
})

describe('three-scene turntable spin', () => {
  it('turns once per Spin Period at the 120 BPM reference and wraps into [0, 2π)', () => {
    // 24 s per turn at 120 BPM (2 beats a second) = 48 beats a turn.
    expect(cinema2ThreeSpinRadians(0, 24)).toBe(0)
    expect(cinema2ThreeSpinRadians(12, 24)).toBeCloseTo(Math.PI / 2, 9)
    expect(cinema2ThreeSpinRadians(24, 24)).toBeCloseTo(Math.PI, 9)
    expect(cinema2ThreeSpinRadians(48, 24)).toBeCloseTo(0, 9)
    expect(cinema2ThreeSpinRadians(60, 24)).toBeCloseTo(Math.PI / 2, 9)
    for (const beats of [0.1, 7.3, 1e6, 123456.789]) {
      const angle = cinema2ThreeSpinRadians(beats, 24)
      expect(angle).toBeGreaterThanOrEqual(0)
      expect(angle).toBeLessThan(Math.PI * 2)
    }
  })

  it('a shorter period turns faster, and no period, a non-number or a negative beat count means no runaway value', () => {
    expect(cinema2ThreeSpinRadians(12, 12)).toBeCloseTo(Math.PI, 9)
    expect(cinema2ThreeSpinRadians(12, 0)).toBe(0)
    expect(cinema2ThreeSpinRadians(Number.NaN, 24)).toBe(0)
    expect(cinema2ThreeSpinRadians(12, Number.NaN)).toBe(0)
    const before = cinema2ThreeSpinRadians(-6, 24)
    expect(before).toBeGreaterThanOrEqual(0)
    expect(before).toBeLessThan(Math.PI * 2)
  })

  it('only accepts a boolean spin flag on an instance', () => {
    const module = (spin: unknown) => ({ ...(manifest.modules?.[0] as object), config: { instances: [{ asset: CINEMA2_DVYDRM_LOGO_ASSET_ID, spin }] } }) as unknown as Readonly<Cinema2ModuleManifest>
    expect(cinema2ThreeSceneModuleDefinition.validate?.(module(true))).toEqual([])
    expect(cinema2ThreeSceneModuleDefinition.validate?.(module('yes'))).toEqual([expect.objectContaining({ code: 'CINEMA2_THREE_SCENE_INSTANCE_INVALID', path: '$.config.instances[0].spin' })])
  })
})
