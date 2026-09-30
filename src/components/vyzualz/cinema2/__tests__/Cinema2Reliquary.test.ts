import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CINEMA2_DESIGN_PARENT_GROUP_IDS, CINEMA2_SHARED_LIGHT_LIMIT, type Cinema2ModuleManifest } from '../contracts/Cinema2NativePresetManifest'
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

const CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'music.beat', 'music.bar', 'music.downbeat', 'music.drop', 'visual-director.significance'] as const
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
  })

  it('overhead rig: six cue spots, each aimed at its own part of the logo, chase in syncopated 16th-note patterns locked to the bar while BPM Sync is on', () => {
    const cueGroup = manifest.lighting?.groups?.find(group => group.label === 'Overhead Cues')
    expect(cueGroup?.lights).toHaveLength(6)
    const lights = manifest.lighting?.lights ?? []
    const cues = lights.filter(light => cueGroup?.lights.some(ref => ref.$ref === light.id))
    expect(new Set(cues.map(light => (light as { targetNode?: { $ref: string } }).targetNode?.$ref)).size).toBe(6) // six different aim points
    const cueRules = (manifest.choreography?.rules ?? []).filter(rule => String(rule.id).startsWith('reliquary-cue-') && rule.actions[0]?.gate)
    expect(cueRules).toHaveLength(12) // two alternating bars x six spots
    for (const rule of cueRules) {
      expect(rule.enabledParameter).toEqual({ $ref: byLabel('BPM Sync')?.id })
      expect(rule.strengthParameter).toEqual({ $ref: byLabel('Master Intensity')?.id })
      const gate = rule.actions[0]?.gate
      expect(gate?.stepsPerBeat).toBe(4)
      expect(gate?.pattern).toHaveLength(16)
    }
    // Syncopated: some hits land off the beat (a 16th step that is not a multiple of 4).
    const offBeat = cueRules.some(rule => [...(rule.actions[0]?.gate?.pattern ?? '')].some((step, index) => step === 'x' && index % 4 !== 0))
    expect(offBeat).toBe(true)
  })

  it('strobe: a 16th-note full strobe on the drop (not gated by BPM Sync) and a roll on downbeats at the top of a build', () => {
    const rules = manifest.choreography?.rules ?? []
    const drop = rules.find(rule => rule.source.signal === 'drop')
    expect(drop?.enabledParameter).toBeUndefined()
    expect(drop?.actions[0]?.gate).toMatchObject({ stepsPerBeat: 4, pattern: 'x' })
    const peak = rules.find(rule => rule.source.signal === 'downbeat' && rule.conditions?.some(condition => condition.kind === 'build'))
    expect(peak?.actions[0]?.gate?.stepsPerBeat).toBe(4)
  })

  it('glow: roots, veins, leaves and the tree vines glow through the module, with a Glow Mode dropdown (Energy / Breathing / Energy & Breathing) sharing BPM Sync and Master Intensity', () => {
    const module = manifest.modules?.[0] as Readonly<Cinema2ModuleManifest>
    expect(Object.keys(module.config?.glow as object).sort()).toEqual(['buds', 'leaves', 'roots', 'veins', 'vines'])
    const mode = byLabel('Glow Mode') as unknown as { type: string; options: { value: string; label: string }[]; defaultValue: string }
    expect(mode.type).toBe('enum')
    expect(mode.options.map(option => option.label)).toEqual(['Energy', 'Breathing', 'Energy & Breathing'])
    expect(module.parameterBindings?.glowMode).toEqual({ $ref: byLabel('Glow Mode')?.id })
    expect(module.parameterBindings?.glowSync).toEqual({ $ref: byLabel('BPM Sync')?.id })
    expect(module.parameterBindings?.glowReactivity).toEqual({ $ref: byLabel('Master Intensity')?.id })
  })

  it('places the cut crystal logo (clear glass, no outline ring), the golden tree and the forest in one three-scene module, none spinning', () => {
    const module = manifest.modules?.[0] as Readonly<Cinema2ModuleManifest>
    expect(module.id).toBe(CINEMA2_RELIQUARY_MODULE_ID)
    const instances = module.config?.instances as { asset: string; node: string; spin?: boolean }[]
    expect(instances.map(instance => instance.asset).sort()).toEqual(['cinema2-dvydrm-logo-faceted', 'cinema2-golden-roots', 'cinema2-reliquary-trees'].sort())
    for (const instance of instances) expect(instance.spin, `${instance.asset} does not spin`).not.toBe(true)
    expect(module.parameters?.['crystal.transmission']).toBeGreaterThanOrEqual(0.8) // mostly clear glass (fully clear refracts the dark stage and reads black)
    expect(module.parameterBindings?.['crystal.transmission']).toEqual({ $ref: byLabel('Crystal Clarity')?.id })
    // The mockup's crystal is the cloud itself: no separate outline ring in the asset or the preset.
    expect(module.config?.parts).not.toContain('outline')
    expect(Object.keys(module.parameters ?? {}).some(key => key.startsWith('outline.'))).toBe(false)
    const logo = readFileSync(resolve(process.cwd(), 'public/cinema2/models/dvydrm-logo-faceted.glb'))
    const logoJson = JSON.parse(logo.subarray(20, 20 + logo.readUInt32LE(12)).toString('utf8')) as { materials: { name: string }[] }
    expect(logoJson.materials.map(material => material.name)).toEqual(['crystal'])
    expect(cinema2ThreeSceneModuleDefinition.validate?.(module)).toEqual([])
    const nodeIds = new Set((manifest.scene?.nodes ?? []).map(node => node.id))
    for (const instance of instances) expect(nodeIds.has(instance.node as never)).toBe(true)
    expect(nodeIds.has(CINEMA2_RELIQUARY_LOGO_NODE_ID)).toBe(true)
    expect(nodeIds.has(CINEMA2_RELIQUARY_ROOTS_NODE_ID)).toBe(true)
  })

  it('stays within the shared light limit, and a preset over it compiles with a warning naming the ignored lights', () => {
    const drawn = (manifest.lighting?.lights ?? []).filter(light => light.type !== 'ambient')
    expect(drawn.length).toBeLessThanOrEqual(CINEMA2_SHARED_LIGHT_LIMIT)
    const first = drawn[0]!
    const extra = Array.from({ length: CINEMA2_SHARED_LIGHT_LIMIT + 2 - drawn.length }, (_, index) => ({ ...first, id: `reliquary-extra-light-${index}` }))
    const over = { ...manifest, lighting: { ...manifest.lighting, lights: [...(manifest.lighting?.lights ?? []), ...extra] } }
    const compiled = compileCinema2NativePreset(over as never, { availableCapabilities: CAPABILITIES })
    expect(compiled.ok).toBe(true)
    const warning = compiled.diagnostics.find(diagnostic => diagnostic.code === 'CINEMA2_PRESET_LIGHT_LIMIT_EXCEEDED')
    expect(warning?.severity).toBe('warning')
    expect(warning?.message).toContain('reliquary-extra-light-')
  })

  it('renders scene -> wet floor -> haze (with ground mist) -> HDR bloom -> filmic finish, with a static camera', () => {
    expect((manifest.effects ?? []).map(effect => effect.typeId)).toEqual(['reflective-floor', 'volumetric-atmosphere', 'hdr-bloom', 'cinematic-finish'])
    expect(manifest.render?.passes?.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen', 'fullscreen', 'fullscreen'])
    expect(manifest.cameras?.[0]?.rig).toEqual({ kind: 'static' })
  })

  it('renders HDR: float targets with an 8-bit fallback, the glow emitted above white, a filmic tone curve and a 16:9 framing that holds on a narrow Stage', () => {
    for (const target of manifest.render?.targets ?? []) expect(target.descriptor).toMatchObject({ colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8' })
    expect((manifest.modules?.[0] as Readonly<Cinema2ModuleManifest>).config?.hdr).toBe(true)
    const finish = (manifest.effects ?? []).find(effect => effect.typeId === 'cinematic-finish')
    expect(finish?.parameters).toMatchObject({ toneMap: 1 })
    expect((finish?.parameters as { aberration: number }).aberration).toBeLessThanOrEqual(0.05)
    expect(manifest.cameras?.[0]?.minAspect).toBeCloseTo(16 / 9)
    // The front fill lights the models but stays out of the haze (aimed from the camera, it veiled the scene).
    const fill = (manifest.lighting?.lights ?? []).find(light => light.id === 'reliquary-fill')
    expect((fill as { config?: { scatter?: boolean } } | undefined)?.config?.scatter).toBe(false)
  })
})

describe('RELIQUARY assets', () => {
  it('ships the forest and the faceted crystal logo as registered, licensed models; the forest has textured bark, vines and buds with a glow phase', () => {
    for (const id of ['cinema2-reliquary-trees', 'cinema2-dvydrm-logo-faceted']) {
      expect(cinema2ThreeAssetRegistry.has(id)).toBe(true)
      expect(CINEMA2_ASSET_RECORDS.find(entry => entry.id === id)).toMatchObject({ kind: 'model', license: 'generated-in-house' })
    }
    const glb = readFileSync(resolve(process.cwd(), 'public/cinema2/models/reliquary-trees.glb'))
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { materials: { name: string }[]; meshes: { primitives: { attributes: Record<string, number> }[] }[] }
    expect(new Set(json.materials.map(material => material.name))).toEqual(new Set(['bark', 'vines', 'buds']))
    for (const mesh of json.meshes) expect(mesh.primitives[0]?.attributes).toHaveProperty('_GLOW_PHASE')
    // The bark carries the in-house bark texture (embedded normal + metal/roughness maps) and texture coordinates to map it.
    const full = json as unknown as { materials: { name: string; normalTexture?: { index: number }; pbrMetallicRoughness: { metallicRoughnessTexture?: { index: number } } }[]; meshes: { name: string; primitives: { attributes: Record<string, number> }[] }[]; images?: { mimeType: string }[] }
    const barkMaterial = full.materials.find(material => material.name === 'bark')
    expect(barkMaterial?.normalTexture).toBeDefined()
    expect(barkMaterial?.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined()
    expect(full.images?.every(image => image.mimeType === 'image/png')).toBe(true)
    expect(full.meshes.find(mesh => mesh.name === 'bark')?.primitives[0]?.attributes).toHaveProperty('TEXCOORD_0')
  })
})

describe('golden-roots shared asset', () => {
  it('is a registered, licensed model with three parts built from the hand-authored root/branch curve network, merged per material', () => {
    expect(cinema2ThreeAssetRegistry.has(CINEMA2_GOLDEN_ROOTS_ASSET_ID)).toBe(true)
    const record = CINEMA2_ASSET_RECORDS.find(entry => entry.id === CINEMA2_GOLDEN_ROOTS_ASSET_ID)
    expect(record).toMatchObject({ kind: 'model', license: 'generated-in-house' })
    const glb = readFileSync(resolve(process.cwd(), 'public/cinema2/models/golden-roots.glb'))
    expect(glb.readUInt32LE(0)).toBe(0x46546c67) // "glTF"
    const jsonLength = glb.readUInt32LE(12)
    const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')) as { meshes: { name: string }[]; materials: { name: string }[] }
    const parts = new Set(json.materials.map(material => material.name))
    expect(parts).toEqual(new Set(['roots', 'veins', 'leaves']))
    // Every curve and leaf is merged into one mesh per material (one draw call each), like the forest.
    expect(json.meshes.map(mesh => mesh.name).sort()).toEqual(['leaves', 'roots', 'veins'])
    const withPhase = (JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')) as { meshes: { primitives: { attributes: Record<string, number> }[] }[] }).meshes
    for (const mesh of withPhase) expect(mesh.primitives[0]?.attributes).toHaveProperty('_GLOW_PHASE')
  })

  it('is registered in the shared studio-neutral environment (reused from GO-TO, avoids tinting the metal)', () => {
    expect(cinema2ThreeEnvironmentRegistry.has(CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID)).toBe(true)
  })

  it('registers the three-scene module type', () => {
    expect(cinema2NativeModuleRegistry.get(cinema2ThreeSceneModuleDefinition.typeId, 1)).not.toBeNull()
  })
})
