import { describe, expect, it } from 'vitest'
import type { Cinema2ModuleManifest } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import {
  CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
} from '../presets/Cinema2AfterhoursPreset'
import {
  CINEMA2_MAINFRAME_COVER_OVERSCAN,
  CINEMA2_MAINFRAME_MIN_SCALE,
  CINEMA2_MAINFRAME_MODEL_EXTENT_MULTIPLIER,
  CINEMA2_MAINFRAME_NATIVE_MODULE_TYPE_ID,
  CINEMA2_MAINFRAME_PARTS,
  cinema2MainframeNativeModuleDefinition,
  resolveCinema2MainframeCoverScale,
  resolveCinema2MainframeStaticFrame,
} from '../modules/Cinema2MainframeNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_MAINFRAME_ASSET_ID, cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'
import {
  CINEMA2_MAINFRAME_QUALITY_PROFILES,
} from '../modules/mainframe/Cinema2MainframeQuality'
import {
  CINEMA2_MAINFRAME_BACKGROUND_ID,
  CINEMA2_MAINFRAME_BPM_SYNC_ID,
  CINEMA2_MAINFRAME_CIRCUITS_COLOR_ID,
  CINEMA2_MAINFRAME_ENABLE_CHIP_ID,
  CINEMA2_MAINFRAME_ENABLE_RADAR_ID,
  CINEMA2_MAINFRAME_INDICATORS_COLOR_ID,
  CINEMA2_MAINFRAME_LOGO_COLOR_ID,
  CINEMA2_MAINFRAME_MASTER_INTENSITY_ID,
  CINEMA2_MAINFRAME_PATTERN_CHANGE_ID,
  CINEMA2_MAINFRAME_PATTERN_ID,
  CINEMA2_MAINFRAME_PATTERN_OPTIONS,
  CINEMA2_MAINFRAME_PRESET_ID,
  CINEMA2_MAINFRAME_PRESET_MANIFEST,
  CINEMA2_MAINFRAME_SCALE_ID,
  CINEMA2_MAINFRAME_TRIGGER_ID,
} from '../presets/Cinema2MainframePreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] as const
const manifest = CINEMA2_MAINFRAME_PRESET_MANIFEST
const module = manifest.modules?.[0] as Readonly<Cinema2ModuleManifest>
const parameters = manifest.parameters ?? []
const ref = (id: string) => ({ $ref: id })

function reader(values: Record<string, unknown>) {
  return {
    get: (name: string) => values[name],
    getAuthored: (name: string) => values[name],
    resolve: () => null,
  } as never
}

function compileMainframe() {
  const result = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
  expect(result.ok, result.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  if (!result.ok) throw new Error('Expected Mainframe to compile')
  return result.plan
}

describe('Mainframe Stage 5 preset', () => {
  it('is a visible first-party keeper and passes the authoring/compiler gates', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(entry => entry.manifest.id === CINEMA2_MAINFRAME_PRESET_ID)?.role).toBe('keeper')
    expect(manifest.metadata).toMatchObject({ name: 'Mainframe' })
    expect(manifest.metadata.tags).not.toContain('internal')
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })).toEqual({ ok: true, diagnostics: [] })
    expect(compileMainframe().render.passes.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen'])
    expect(cinema2NativePresetRegistry.get(CINEMA2_MAINFRAME_PRESET_ID)).not.toBeNull()
  })

  it('registers its dedicated renderer and shipped production model', () => {
    expect(module.typeId).toBe(CINEMA2_MAINFRAME_NATIVE_MODULE_TYPE_ID)
    expect(module.config).toMatchObject({ asset: CINEMA2_MAINFRAME_ASSET_ID })
    expect(cinema2ThreeAssetRegistry.has(CINEMA2_MAINFRAME_ASSET_ID)).toBe(true)
    expect(cinema2NativeModuleRegistry.get(CINEMA2_MAINFRAME_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(cinema2MainframeNativeModuleDefinition.validate?.(module)).toEqual([])
    expect(CINEMA2_MAINFRAME_PARTS).toHaveLength(13)
  })

  it('authors the complete four-group Inspector contract and conditionally reveals Trigger', () => {
    const visible = parameters.filter(parameter => parameter.exposure === 'primary' && parameter.section === 'Design')
    const inGroup = (group: string) => visible
      .filter(parameter => parameter.designParentGroup === group)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(parameter => parameter.label)
    expect(inGroup('master-controls')).toEqual(['Master Intensity', 'BPM Sync'])
    expect(inGroup('design')).toEqual(['Enable Radar Circuit', 'Enable Chip', 'Scale'])
    expect(inGroup('effects')).toEqual(['Pattern', 'Pattern Change', 'Trigger'])
    expect(inGroup('palette')).toEqual(['Background', 'Logo', 'Circuits', 'Indicators'])
    expect(parameters.find(parameter => parameter.id === CINEMA2_MAINFRAME_SCALE_ID)).toMatchObject({ defaultValue: 1, min: 0.45, max: 1.35 })
    expect(parameters.find(parameter => parameter.id === CINEMA2_MAINFRAME_PATTERN_ID)).toMatchObject({
      type: 'enum', defaultValue: 'outward-bus', options: CINEMA2_MAINFRAME_PATTERN_OPTIONS,
    })
    expect(parameters.find(parameter => parameter.id === CINEMA2_MAINFRAME_PATTERN_CHANGE_ID)).toMatchObject({ type: 'boolean', defaultValue: false })
    expect(parameters.find(parameter => parameter.id === CINEMA2_MAINFRAME_TRIGGER_ID)).toMatchObject({
      type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: CINEMA2_MAINFRAME_PATTERN_CHANGE_ID, value: true }],
    })

    const plan = compileMainframe()
    const state = new Cinema2ParameterState(plan.parameters)
    const effectLabels = () => {
      const effects = createCinema2DesignParentGroupModel(plan, state.getSnapshot()).find(parent => parent.label === 'Effects')
      return [
        ...(effects?.controls.map(control => control.definition.label) ?? []),
        ...(effects?.groups.flatMap(group => group.controls.map(control => control.definition.label)) ?? []),
      ]
    }
    expect(effectLabels()).toEqual(['Pattern', 'Pattern Change'])
    expect(state.setPersistentValue(CINEMA2_MAINFRAME_PATTERN_CHANGE_ID, true)).toMatchObject({ ok: true })
    expect(effectLabels()).toEqual(['Pattern', 'Pattern Change', 'Trigger'])
  })

  it('binds every static control to the native module', () => {
    expect(module.parameterBindings).toEqual({
      masterIntensity: ref(CINEMA2_MAINFRAME_MASTER_INTENSITY_ID),
      bpmSync: ref(CINEMA2_MAINFRAME_BPM_SYNC_ID),
      pattern: ref(CINEMA2_MAINFRAME_PATTERN_ID),
      patternChange: ref(CINEMA2_MAINFRAME_PATTERN_CHANGE_ID),
      trigger: ref(CINEMA2_MAINFRAME_TRIGGER_ID),
      enableRadar: ref(CINEMA2_MAINFRAME_ENABLE_RADAR_ID),
      enableChip: ref(CINEMA2_MAINFRAME_ENABLE_CHIP_ID),
      scale: ref(CINEMA2_MAINFRAME_SCALE_ID),
      background: ref(CINEMA2_MAINFRAME_BACKGROUND_ID),
      logoColor: ref(CINEMA2_MAINFRAME_LOGO_COLOR_ID),
      circuitsColor: ref(CINEMA2_MAINFRAME_CIRCUITS_COLOR_ID),
      indicatorsColor: ref(CINEMA2_MAINFRAME_INDICATORS_COLOR_ID),
    })
  })

  it('persists and restores all three pattern controls and resets each to its authored default', () => {
    const plan = compileMainframe()
    const state = new Cinema2ParameterState(plan.parameters)
    expect(state.setPersistentValue(CINEMA2_MAINFRAME_PATTERN_ID, 'system-surge')).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_MAINFRAME_PATTERN_CHANGE_ID, true)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_MAINFRAME_TRIGGER_ID, 'drop')).toMatchObject({ ok: true })

    const restored = new Cinema2ParameterState(plan.parameters)
    expect(restored.restore(state.serialize())).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_MAINFRAME_PATTERN_ID)).toBe('system-surge')
    expect(restored.getValue(CINEMA2_MAINFRAME_PATTERN_CHANGE_ID)).toBe(true)
    expect(restored.getValue(CINEMA2_MAINFRAME_TRIGGER_ID)).toBe('drop')

    expect(restored.reset(CINEMA2_MAINFRAME_PATTERN_ID)).toMatchObject({ ok: true })
    expect(restored.reset(CINEMA2_MAINFRAME_PATTERN_CHANGE_ID)).toMatchObject({ ok: true })
    expect(restored.reset(CINEMA2_MAINFRAME_TRIGGER_ID)).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_MAINFRAME_PATTERN_ID)).toBe('outward-bus')
    expect(restored.getValue(CINEMA2_MAINFRAME_PATTERN_CHANGE_ID)).toBe(false)
    expect(restored.getValue(CINEMA2_MAINFRAME_TRIGGER_ID)).toBe('bar4')
  })

  it('turns complete component assemblies off and maps Scale without touching route timing', () => {
    const frame = resolveCinema2MainframeStaticFrame(reader({
      enableRadar: false,
      enableChip: false,
      scale: 1.24,
      pattern: 'radar-sweep',
      patternChange: true,
      trigger: 'drop',
    }))
    expect(frame.scale).toBe(1.24)
    expect(frame).toMatchObject({ pattern: 'radar-sweep', patternChange: true, trigger: 'drop' })
    expect(frame.visibility).toEqual({ radarHardware: false, radarCores: false, chipHardware: false, chipCores: false })
    const on = resolveCinema2MainframeStaticFrame(reader({ enableRadar: true, enableChip: true }))
    expect(Object.values(on.visibility)).toEqual([true, true, true, true])
  })

  it('keeps hardware lit at zero Master Intensity while disabling every emissive family', () => {
    const dark = resolveCinema2MainframeStaticFrame(reader({ masterIntensity: 0 }))
    for (const name of ['circuitCores', 'indicatorCores', 'radarCores', 'chipCores', 'logoCore']) {
      expect(dark.overrides.parts[name]?.emissiveIntensity).toBe(0)
    }
    expect(dark.overrides.parts.logoHousing?.metalness).toBe(1)
    expect(dark.overrides.parts.board?.roughness).toBeGreaterThan(0.7)
    const bright = resolveCinema2MainframeStaticFrame(reader({ masterIntensity: 1 }))
    expect(bright.overrides.parts.logoCore?.emissiveIntensity).toBeGreaterThan(bright.overrides.parts.circuitCores?.emissiveIntensity as number)
    expect(bright.overrides.parts.circuitCores?.emissiveIntensity).toBeLessThan(0.2)
  })

  it('keeps logo, circuits and indicators independently recolorable and finishes with HDR bloom plus filmic grading', () => {
    const frame = resolveCinema2MainframeStaticFrame(reader({
      logoColor: [1, 0, 0, 1],
      circuitsColor: [0, 0, 1, 1],
      indicatorsColor: [1, 1, 0, 1],
    }))
    expect(frame.overrides.parts.logoCore?.emissive).toEqual([1, 0, 0])
    expect(frame.overrides.parts.circuitCores?.emissive).toEqual([0, 0, 1])
    expect(frame.overrides.parts.indicatorCores?.emissive).toEqual([1, 1, 0])
    expect(frame.overrides.parts.radarCores?.emissive).toEqual([1, 1, 0])
    expect(manifest.effects?.map(effect => effect.typeId)).toEqual(['hdr-bloom', 'cinematic-finish'])
    expect(manifest.effects?.[0]?.parameters).toMatchObject({ threshold: 1.65, intensity: 0.92, levels: 7 })
    expect(manifest.effects?.[1]?.parameters).toMatchObject({ toneMap: 1, aberration: 0.003 })
  })

  it('uses a static front camera, neutral PBR light rig and real shadow casting', () => {
    expect(manifest.cameras?.[0]).toMatchObject({ projection: 'perspective', fovDegrees: 35, rig: { kind: 'static' } })
    expect(manifest.cameras?.[0]).not.toHaveProperty('minAspect')
    expect(manifest.lighting?.lights).toHaveLength(4)
    expect(manifest.lighting?.lights[0]?.config).toMatchObject({ threeShadow: true })
    expect(manifest.environment).toMatchObject({ exposure: 1 })
    expect(manifest.choreography?.rules.map(rule => rule.source.signal)).toEqual([
      'kick', 'snare', 'transient', 'beat', 'downbeat', 'bar', 'phrase', 'section-change', 'drop',
    ])
  })

  it('cover-fits every Stage aspect with intentional crop and motion overscan', () => {
    expect(resolveCinema2MainframeCoverScale(1920, 1080)).toBeCloseTo(CINEMA2_MAINFRAME_COVER_OVERSCAN)
    expect(resolveCinema2MainframeCoverScale(1000, 1200)).toBeCloseTo(CINEMA2_MAINFRAME_COVER_OVERSCAN)
    expect(resolveCinema2MainframeCoverScale(2048, 1041)).toBeGreaterThan(CINEMA2_MAINFRAME_COVER_OVERSCAN)
    expect(resolveCinema2MainframeCoverScale(1920, 1080, 1.2)).toBeCloseTo(CINEMA2_MAINFRAME_COVER_OVERSCAN * 1.2)
    const deepestPortraitZoom = resolveCinema2MainframeCoverScale(1000, 1200, CINEMA2_MAINFRAME_MIN_SCALE)
    expect(deepestPortraitZoom * CINEMA2_MAINFRAME_MODEL_EXTENT_MULTIPLIER).toBeGreaterThan(1)
    expect(resolveCinema2MainframeCoverScale(1000, 1200, 0)).toBe(deepestPortraitZoom)
  })

  it('degrades deliberately across the three production quality tiers', () => {
    expect(CINEMA2_MAINFRAME_QUALITY_PROFILES).toMatchObject({
      low: { meshVariant: 'full', smallComponentDetail: 'full', renderTargetScale: 0.67, shadowLightLimit: 0, shadowMapSize: 0, bloomLevels: 5, normalAoDetail: false, visiblePartCount: 13 },
      medium: { meshVariant: 'full', smallComponentDetail: 'full', renderTargetScale: 0.82, shadowLightLimit: 2, shadowMapSize: 512, bloomLevels: 6, normalAoDetail: true, visiblePartCount: 13 },
      high: { meshVariant: 'full', smallComponentDetail: 'full', renderTargetScale: 1, shadowLightLimit: 2, shadowMapSize: 1024, bloomLevels: 7, normalAoDetail: true, visiblePartCount: 13 },
    })
  })
})
