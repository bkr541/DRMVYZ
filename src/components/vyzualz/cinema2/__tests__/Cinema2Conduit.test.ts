import { describe, expect, it } from 'vitest'
import { CINEMA2_DESIGN_PARENT_GROUP_IDS, CINEMA2_SHARED_LIGHT_LIMIT, type Cinema2ModuleManifest } from '../contracts/Cinema2NativePresetManifest'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2ThreeSceneModuleDefinition } from '../modules/Cinema2ThreeSceneModule'
import {
  CINEMA2_CONDUIT_CHAMBER_ASSET_ID,
  CINEMA2_CONDUIT_TUBES_ASSET_ID,
  CINEMA2_CONDUIT_WORDMARK_ASSET_ID,
  cinema2ThreeAssetRegistry,
} from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_THREE_SEGMENT_PATTERNS } from '../modules/three/Cinema2ThreeSegmentLighting'
import {
  CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID,
  CINEMA2_CONDUIT_BPM_SYNC_ID,
  CINEMA2_CONDUIT_CAMERA_MOVEMENT_ID,
  CINEMA2_CONDUIT_ZOOM_ON_KICK_ID,
  CINEMA2_CONDUIT_ENERGY_COLOR_ID,
  CINEMA2_CONDUIT_FLICKER_ID,
  CINEMA2_CONDUIT_MASTER_INTENSITY_ID,
  CINEMA2_CONDUIT_PATTERN_ID,
  CINEMA2_CONDUIT_PRESET_ID,
  CINEMA2_CONDUIT_PRESET_MANIFEST,
} from '../presets/Cinema2ConduitPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'music.beat', 'music.bar', 'music.downbeat', 'music.drop', 'visual-director.significance'] as const
const manifest = CINEMA2_CONDUIT_PRESET_MANIFEST
const parameters = manifest.parameters ?? []
const module = manifest.modules![0]! as Readonly<Cinema2ModuleManifest>
const ref = (id: string) => ({ $ref: id })

describe('CONDUIT preset', () => {
  it('is a visible keeper in the first-party catalog, named CONDUIT, and passes the authoring gate and the native compiler', () => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(entry => entry.manifest.id === CINEMA2_CONDUIT_PRESET_ID)
    expect(declaration?.role).toBe('keeper')
    expect(manifest.metadata.name).toBe('CONDUIT')
    expect(manifest.metadata.tags).not.toContain('internal')
    const gate = validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })
    if (!gate.ok) throw new Error(gate.diagnostics.map(diagnostic => `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`).join('\n'))
    const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    expect(cinema2NativePresetRegistry.get(CINEMA2_CONDUIT_PRESET_ID)).not.toBeNull()
  })

  it('has exactly the owner\'s controls in the four Design groups', () => {
    const visible = parameters.filter(parameter => parameter.exposure === 'primary' && parameter.section === 'Design')
    for (const parameter of visible) expect(CINEMA2_DESIGN_PARENT_GROUP_IDS).toContain(parameter.designParentGroup)
    const inGroup = (group: string) => visible.filter(parameter => parameter.designParentGroup === group).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(parameter => parameter.label)
    expect(inGroup('master-controls')).toEqual(['Auto Performance', 'Master Intensity', 'BPM Sync', 'Camera Movement', 'Zoom on Kick'])
    expect(inGroup('design')).toEqual(['Pattern'])
    expect(inGroup('effects')).toEqual(['Flicker'])
    expect(inGroup('palette')).toEqual(['Energy Color'])
    const byId = (id: string) => parameters.find(parameter => parameter.id === id)
    expect(byId(CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID)).toMatchObject({ type: 'boolean', defaultValue: true })
    expect(byId(CINEMA2_CONDUIT_BPM_SYNC_ID)).toMatchObject({ type: 'boolean', defaultValue: true })
    expect(byId(CINEMA2_CONDUIT_MASTER_INTENSITY_ID)).toMatchObject({ type: 'float', min: 0, max: 1 })
    expect(byId(CINEMA2_CONDUIT_CAMERA_MOVEMENT_ID)).toMatchObject({ type: 'float', min: 0, max: 1 })
    expect(byId(CINEMA2_CONDUIT_ZOOM_ON_KICK_ID)).toMatchObject({ type: 'boolean', defaultValue: true })
    expect(byId(CINEMA2_CONDUIT_FLICKER_ID)).toMatchObject({ type: 'float', min: 0, max: 1 })
    expect(byId(CINEMA2_CONDUIT_ENERGY_COLOR_ID)).toMatchObject({ type: 'color' })
  })

  it('Pattern lists Energy Flow, Ring Chase, Split and Pulse, and choosing one turns Auto Performance off', () => {
    const pattern = parameters.find(parameter => parameter.id === CINEMA2_CONDUIT_PATTERN_ID) as unknown as { options: { value: string; label: string }[]; metadata: Record<string, unknown> }
    expect(pattern.options.map(option => option.value)).toEqual([...CINEMA2_THREE_SEGMENT_PATTERNS])
    expect(pattern.options.map(option => option.label)).toEqual(['Energy Flow', 'Ring Chase', 'Split', 'Pulse'])
    expect(pattern.metadata.userEditSetParameters).toEqual({ [CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID]: false })
  })

  it('drives the segment lighting from the controls: pattern, auto, sync, flicker, reactivity (Master Intensity) and the energy color', () => {
    expect(module.config?.segments).toEqual({ energy: 'feed', rim: 'core', segments: 'field' })
    expect(module.parameterBindings).toMatchObject({
      segmentPattern: ref(CINEMA2_CONDUIT_PATTERN_ID),
      segmentAuto: ref(CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID),
      segmentSync: ref(CINEMA2_CONDUIT_BPM_SYNC_ID),
      segmentFlicker: ref(CINEMA2_CONDUIT_FLICKER_ID),
      segmentReactivity: ref(CINEMA2_CONDUIT_MASTER_INTENSITY_ID),
      segmentColor: ref(CINEMA2_CONDUIT_ENERGY_COLOR_ID),
    })
  })

  it('Camera Movement scales the camera\'s drift, weave, lens breath and kick zoom, locked to the beat by BPM Sync', () => {
    const camera = manifest.cameras![0]!
    expect(camera.controls).toEqual({ motionAmount: ref(CINEMA2_CONDUIT_CAMERA_MOVEMENT_ID), tempoSync: ref(CINEMA2_CONDUIT_BPM_SYNC_ID), kickZoom: ref(CINEMA2_CONDUIT_ZOOM_ON_KICK_ID) })
    expect(camera.motion?.tempo).toMatchObject({ weave: expect.any(Number), fov: expect.any(Number), punch: expect.any(Number) })
    expect(camera.motion?.drift?.position).toBeGreaterThan(0)
  })

  it('draws the three CONDUIT assets through a valid three-scene module', () => {
    const instances = (module.config?.instances as { asset: string }[]).map(instance => instance.asset)
    expect(instances).toEqual([CINEMA2_CONDUIT_CHAMBER_ASSET_ID, CINEMA2_CONDUIT_TUBES_ASSET_ID, CINEMA2_CONDUIT_WORDMARK_ASSET_ID])
    for (const asset of instances) expect(cinema2ThreeAssetRegistry.has(asset)).toBe(true)
    expect(cinema2NativeModuleRegistry.get(module.typeId, module.version)).not.toBeNull()
    expect(cinema2ThreeSceneModuleDefinition.validate!(module)).toEqual([])
  })

  it('keeps the logo key and symmetric wall fill in the low-tier light budget, with paired washes and reactive energy lights at higher tiers', () => {
    const lights = manifest.lighting?.lights ?? []
    expect(lights.filter(light => light.type !== 'ambient').length).toBeLessThanOrEqual(CINEMA2_SHARED_LIGHT_LIMIT)
    expect(lights.slice(0, 4).map(light => light.id)).toEqual(['conduit-key', 'conduit-wall-low-fill', 'conduit-wall-wash-left', 'conduit-wall-wash-right'])
    expect(lights[2]?.intensity).toBe(lights[3]?.intensity)
    expect(Number(lights[1]?.intensity)).toBeLessThan(Number(lights[2]?.intensity))
    const energy = manifest.lighting?.groups?.find(group => group.label === 'Energy Lights')
    expect(energy?.lights).toHaveLength(3)
    for (const light of lights.filter(entry => energy?.lights.some(member => member.$ref === entry.id))) {
      expect((light as { controls?: { color?: unknown } }).controls?.color).toEqual(ref(CINEMA2_CONDUIT_ENERGY_COLOR_ID))
    }
    const rules = manifest.choreography?.rules ?? []
    expect(rules.some(rule => rule.source.signal === 'downbeat' && rule.actions.some(action => action.target.kind === 'light-group'))).toBe(true)
    expect(rules.some(rule => rule.source.signal === 'drop')).toBe(true)
    for (const rule of rules) expect(rule.strengthParameter).toEqual(ref(CINEMA2_CONDUIT_MASTER_INTENSITY_ID))
  })

  it('keeps raised chamber metal above recessed metal, with controlled studio reflections and tube-housing highlights', () => {
    const material = module.parameters as Record<string, unknown>
    const red = (part: string) => (material[`${part}.color`] as readonly number[])[0]
    expect(red('shell')).toBeGreaterThan(red('steel'))
    expect(red('steel')).toBeGreaterThan(red('iris'))
    expect(red('pipe')).toBeGreaterThan(red('coupler'))
    expect(material['pipe.roughness']).toBeGreaterThanOrEqual(0.16)
    expect(material['shell.environmentIntensity']).toBeLessThan(1)
    expect(material['hull.environmentIntensity']).toBeLessThan(1)
    expect(material.environmentIntensity).toBeLessThan(0.45)
    expect(manifest.environment?.exposure).toBe(1)
  })

  it('finishes with the reflective floor at the chamber floor, a light haze, HDR bloom and a filmic grade', () => {
    const effects = manifest.effects ?? []
    expect(effects.map(effect => effect.typeId)).toEqual(['reflective-floor', 'volumetric-atmosphere', 'hdr-bloom', 'cinematic-finish'])
    expect(effects[0]!.parameters).toMatchObject({ floorY: 0, grit: 0, samplingStability: 1 })
    expect((effects[0]!.parameters as { reflectivity: number }).reflectivity).toBeLessThan(0.3)
    expect((effects[1]!.parameters as { density: number }).density).toBeLessThan(0.03)
  })
})
