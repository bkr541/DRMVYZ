import { describe, expect, it } from 'vitest'

import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createCinema2InspectorModel } from '../parameters/Cinema2InspectorModel'
import {
  CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID,
  CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION,
} from '../modules/Cinema2InterlockNativeModule'
import {
  CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_TYPE_ID,
  CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_VERSION,
  deriveCinema2InterlockLiquidLightPalette,
} from '../modules/Cinema2InterlockLiquidLightModule'
import {
  CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID,
  CINEMA2_INTERLOCK_PATTERN_IDS,
} from '../modules/interlock/Cinema2InterlockDomain'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import {
  CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID,
  CINEMA2_INTERLOCK_BACKGROUND_ACCENT_ID,
  CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID,
  CINEMA2_INTERLOCK_BACKGROUND_COLOR_ID,
  CINEMA2_INTERLOCK_BACKGROUND_FLOW_ID,
  CINEMA2_INTERLOCK_BACKGROUND_LAYER_ID,
  CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID,
  CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID,
  CINEMA2_INTERLOCK_BANK_STAGGER_ID,
  CINEMA2_INTERLOCK_BASS_ROTATION_ID,
  CINEMA2_INTERLOCK_BLOOM_EFFECT_ID,
  CINEMA2_INTERLOCK_BLOOM_PASS_ID,
  CINEMA2_INTERLOCK_BUILD_TENSION_ID,
  CINEMA2_INTERLOCK_CENTER_GLOW_ID,
  CINEMA2_INTERLOCK_EDGE_DARKNESS_ID,
  CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID,
  CINEMA2_INTERLOCK_HIGH_SHIMMER_ID,
  CINEMA2_INTERLOCK_LAYER_ID,
  CINEMA2_INTERLOCK_LED_COLOR_ID,
  CINEMA2_INTERLOCK_LED_INTENSITY_ID,
  CINEMA2_INTERLOCK_LIT_DENSITY_ID,
  CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID,
  CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_ID,
  CINEMA2_INTERLOCK_MODULE_ID,
  CINEMA2_INTERLOCK_MORPH_DURATION_ID,
  CINEMA2_INTERLOCK_PATTERN_CHANGE_ID,
  CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID,
  CINEMA2_INTERLOCK_PRESET_ID,
  CINEMA2_INTERLOCK_PRESET_MANIFEST,
  CINEMA2_INTERLOCK_RENDER_PASS_ID,
  CINEMA2_INTERLOCK_RENDER_TARGET_ID,
  CINEMA2_INTERLOCK_RESET_TRAILS_ID,
  CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID,
  CINEMA2_INTERLOCK_SEGMENT_AFTERGLOW_ID,
  CINEMA2_INTERLOCK_SEGMENT_FADE_ID,
  CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID,
  CINEMA2_INTERLOCK_SEGMENT_REACTIVITY_ID,
  CINEMA2_INTERLOCK_SEGMENT_SPEED_ID,
  CINEMA2_INTERLOCK_SYMMETRY_ID,
  CINEMA2_INTERLOCK_TRAILS_EFFECT_ID,
  CINEMA2_INTERLOCK_TRAILS_PASS_ID,
  CINEMA2_INTERLOCK_TRAILS_TARGET_ID,
  CINEMA2_INTERLOCK_TRANSIENT_PULSE_ID,
  CINEMA2_INTERLOCK_TRIGGER_ID,
  CINEMA2_INTERLOCK_UNLIT_VISIBILITY_ID,
  CINEMA2_INTERLOCK_VOCAL_RESTRAINT_ID,
} from '../presets/Cinema2InterlockPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const AVAILABLE_CAPABILITIES = Object.freeze(['render.webgl2', 'render.history', 'audio.transport', 'audio.bands', 'audio.features', 'music.rhythm-events', 'music.beat', 'music.downbeat', 'music.bar', 'music.phrase', 'music.section', 'music.drop', 'music.vocal-presence', 'visual-director.significance'] as const)
const PERSISTED_PARAMETER_IDS = Object.freeze([
  CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID,
  CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID,
  CINEMA2_INTERLOCK_SYMMETRY_ID,
  CINEMA2_INTERLOCK_LED_COLOR_ID,
  CINEMA2_INTERLOCK_LED_INTENSITY_ID,
  CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID,
  CINEMA2_INTERLOCK_LIT_DENSITY_ID,
  CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID,
  CINEMA2_INTERLOCK_BACKGROUND_COLOR_ID,
  CINEMA2_INTERLOCK_BACKGROUND_ACCENT_ID,
  CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID,
  CINEMA2_INTERLOCK_CENTER_GLOW_ID,
  CINEMA2_INTERLOCK_EDGE_DARKNESS_ID,
  CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID,
  CINEMA2_INTERLOCK_MORPH_DURATION_ID,
  CINEMA2_INTERLOCK_SEGMENT_SPEED_ID,
  CINEMA2_INTERLOCK_SEGMENT_FADE_ID,
  CINEMA2_INTERLOCK_BANK_STAGGER_ID,
  CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_ID,
  CINEMA2_INTERLOCK_BACKGROUND_FLOW_ID,
  CINEMA2_INTERLOCK_PATTERN_CHANGE_ID,
  CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID,
  CINEMA2_INTERLOCK_BASS_ROTATION_ID,
  CINEMA2_INTERLOCK_SEGMENT_REACTIVITY_ID,
  CINEMA2_INTERLOCK_TRANSIENT_PULSE_ID,
  CINEMA2_INTERLOCK_HIGH_SHIMMER_ID,
  CINEMA2_INTERLOCK_BUILD_TENSION_ID,
  CINEMA2_INTERLOCK_VOCAL_RESTRAINT_ID,
  CINEMA2_INTERLOCK_TRIGGER_ID,
  CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID,
  CINEMA2_INTERLOCK_SEGMENT_AFTERGLOW_ID,
  CINEMA2_INTERLOCK_UNLIT_VISIBILITY_ID,
])

function compileInterlock() {
  const result = compileCinema2NativePreset(CINEMA2_INTERLOCK_PRESET_MANIFEST, {
    availableCapabilities: AVAILABLE_CAPABILITIES,
  })
  expect(result.ok, result.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  if (!result.ok) throw new Error('Expected Interlock to compile')
  return result.plan
}

describe('Cinema 2.0 Interlock production preset', () => {
  it('registers the keeper and both Stage 4 native modules exactly through the canonical registries', () => {
    const declarations = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(candidate => candidate.manifest.id === CINEMA2_INTERLOCK_PRESET_ID)
    expect(declarations).toHaveLength(1)
    expect(declarations[0]).toMatchObject({ role: 'keeper' })
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_INTERLOCK_PRESET_MANIFEST })).toMatchObject({ ok: true })
    expect(cinema2NativePresetRegistry.has(CINEMA2_INTERLOCK_PRESET_ID)).toBe(true)
    expect(cinema2NativeModuleRegistry.get(CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID, CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION)).not.toBeNull()
    expect(cinema2NativeModuleRegistry.get(CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_TYPE_ID, CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_VERSION)).not.toBeNull()

    const plan = compileInterlock()
    expect(plan.manifest.modules).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID, typeId: CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_TYPE_ID }),
      expect.objectContaining({ id: CINEMA2_INTERLOCK_MODULE_ID, typeId: CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID }),
    ]))
    expect(cinema2NativeModuleRegistry.validateModules(plan.manifest.modules ?? [])).toMatchObject({ ok: true })
  })

  it('authors Stage 6 Auto Performance and reactivity controls through the shared schema with the required defaults', () => {
    const plan = compileInterlock()
    const definitions = plan.parameters.definitions
    const ids = definitions.map(definition => definition.id)
    expect(ids).toEqual(expect.arrayContaining([...PERSISTED_PARAMETER_IDS, CINEMA2_INTERLOCK_RESET_TRAILS_ID]))
    expect(plan.parameters.authoredDefaults[CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID]).toBe(CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID)
    expect(plan.parameters.authoredDefaults[CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID]).toBe(0.25)
    expect(plan.parameters.authoredDefaults[CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID]).toBe(0.35)
    expect(plan.parameters.authoredDefaults[CINEMA2_INTERLOCK_BANK_STAGGER_ID]).toBe(0)
    expect(plan.parameters.authoredDefaults[CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID]).toBe(true)
    expect(plan.parameters.authoredDefaults[CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID]).toBe(0.75)
    expect(plan.parameters.authoredDefaults[CINEMA2_INTERLOCK_VOCAL_RESTRAINT_ID]).toBe(0.35)
    expect(definitions.find(definition => definition.id === CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID)).toMatchObject({ min: 0, max: 1 })
    expect(definitions.find(definition => definition.id === CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID)).toMatchObject({ min: 0, max: 1 })
    expect(definitions.find(definition => definition.id === CINEMA2_INTERLOCK_RESET_TRAILS_ID)).toMatchObject({ type: 'trigger', persistence: 'runtime-only', exposure: 'hidden' })
    expect(definitions.find(definition => definition.id === CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID)?.options?.map(option => option.value)).toEqual(CINEMA2_INTERLOCK_PATTERN_IDS)
    expect(definitions.find(definition => definition.id === CINEMA2_INTERLOCK_PATTERN_CHANGE_ID)).toMatchObject({ section: 'Scene', group: 'Performance' })
    expect(definitions.find(definition => definition.id === CINEMA2_INTERLOCK_BANK_STAGGER_ID)).toMatchObject({ section: 'Motion', group: 'Segments', persistence: 'preset' })
    expect(definitions.filter(definition => /sync|bpm/i.test(definition.label))).toEqual([])

    const state = new Cinema2ParameterState(plan.parameters)
    const controls = createCinema2InspectorModel(plan, state.getSnapshot(), 'design')
      .flatMap(section => section.groups)
      .flatMap(group => group.controls)
      .map(control => control.definition.id)
    expect(controls).toEqual(expect.arrayContaining(PERSISTED_PARAMETER_IDS.filter(id =>
      id !== CINEMA2_INTERLOCK_BACKGROUND_COLOR_ID && id !== CINEMA2_INTERLOCK_BACKGROUND_ACCENT_ID
    )))
    expect(controls).not.toContain(CINEMA2_INTERLOCK_BACKGROUND_COLOR_ID)
    expect(controls).not.toContain(CINEMA2_INTERLOCK_BACKGROUND_ACCENT_ID)
    expect(controls).not.toContain(CINEMA2_INTERLOCK_RESET_TRAILS_ID)

    expect(state.setPersistentValue(CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID, 'manual')).toMatchObject({ ok: true })
    const manualControls = createCinema2InspectorModel(plan, state.getSnapshot(), 'design')
      .flatMap(section => section.groups)
      .flatMap(group => group.controls)
      .map(control => control.definition.id)
    expect(manualControls).toEqual(expect.arrayContaining([
      CINEMA2_INTERLOCK_BACKGROUND_COLOR_ID,
      CINEMA2_INTERLOCK_BACKGROUND_ACCENT_ID,
    ]))
  })

  it('atomically gives manual Pattern and Segment Pattern edits canonical authority over Auto Performance', () => {
    const plan = compileInterlock()
    const state = new Cinema2ParameterState(plan.parameters)

    expect(state.getValue(CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID)).toBe(true)
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_LED_INTENSITY_ID, 0.43)).toMatchObject({ ok: true })

    expect(state.setPersistentValue(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID, 'bassPortal')).toMatchObject({ ok: true })
    expect(state.getValue(CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID)).toBe(false)
    expect(state.getValue(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID)).toBe('bassPortal')
    expect(state.getValue(CINEMA2_INTERLOCK_LED_INTENSITY_ID)).toBe(0.43)

    expect(state.setPersistentValue(CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID, true)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID, 'not-a-pattern')).toMatchObject({ ok: false })
    expect(state.getValue(CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID)).toBe(true)
    expect(state.getValue(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID)).toBe('bassPortal')

    expect(state.setPersistentValue(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID, 'alternating')).toMatchObject({ ok: true })
    expect(state.getValue(CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID)).toBe(false)
    expect(state.getValue(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID)).toBe('alternating')

    const restored = new Cinema2ParameterState(plan.parameters)
    expect(restored.restore(state.serialize())).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID)).toBe(false)
    expect(restored.getValue(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID)).toBe('bassPortal')
    expect(restored.getValue(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID)).toBe('alternating')
  })

  it('persists authored Stage 6 controls while keeping resolved runtime hooks and reset actions out of serialization', () => {
    const plan = compileInterlock()
    const state = new Cinema2ParameterState(plan.parameters)
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_LED_COLOR_ID, [0.2, 0.75, 1, 1])).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID, 'manual')).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_BACKGROUND_COLOR_ID, [0.01, 0.02, 0.04, 1])).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_BACKGROUND_ACCENT_ID, [0.15, 0.4, 0.8, 1])).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID, 0.62)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID, 0.73)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID, 0.44)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_TRIGGER_ID, 'kick')).toMatchObject({ ok: true })

    const serialized = state.serialize()
    const payload = JSON.parse(serialized) as { values: Record<string, unknown> }
    expect(Object.keys(payload.values).sort()).toEqual([...PERSISTED_PARAMETER_IDS].sort())
    expect(serialized).not.toMatch(/reset-trails|backgroundEnergy|backgroundBassExpansion|backgroundFlux|backgroundBuild|backgroundDropImpact|backgroundVocalRestraint/i)

    const restored = new Cinema2ParameterState(plan.parameters)
    expect(restored.restore(serialized)).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID)).toBe(0.62)
    expect(restored.getValue(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID)).toBe(0.73)
    expect(restored.getValue(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID)).toBe(0.44)
    expect(restored.getValue(CINEMA2_INTERLOCK_TRIGGER_ID)).toBe('kick')
  })

  it('restores pre-Stage-7 saved state with the new Bank Stagger default and rejects malformed values without corrupting state', () => {
    const plan = compileInterlock()
    const current = new Cinema2ParameterState(plan.parameters)
    expect(current.setPersistentValue(CINEMA2_INTERLOCK_LED_INTENSITY_ID, 0.51)).toMatchObject({ ok: true })
    const payload = JSON.parse(current.serialize()) as { values: Record<string, unknown> }
    delete payload.values[CINEMA2_INTERLOCK_BANK_STAGGER_ID]

    const restored = new Cinema2ParameterState(plan.parameters)
    expect(restored.restore({
      schemaId: 'drmvyz.cinema2.parameter-state',
      schemaVersion: 1,
      presetId: CINEMA2_INTERLOCK_PRESET_ID,
      presetRevision: CINEMA2_INTERLOCK_PRESET_MANIFEST.revision,
      values: payload.values,
    })).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_INTERLOCK_LED_INTENSITY_ID)).toBe(0.51)
    expect(restored.getValue(CINEMA2_INTERLOCK_BANK_STAGGER_ID)).toBe(0)

    const before = restored.getValue(CINEMA2_INTERLOCK_BANK_STAGGER_ID)
    expect(restored.setPersistentValue(CINEMA2_INTERLOCK_BANK_STAGGER_ID, Number.POSITIVE_INFINITY)).toMatchObject({ ok: false })
    expect(restored.getValue(CINEMA2_INTERLOCK_BANK_STAGGER_ID)).toBe(before)
    expect(restored.setPersistentValue(CINEMA2_INTERLOCK_BANK_STAGGER_ID, 3)).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_INTERLOCK_BANK_STAGGER_ID)).toBe(1)
  })

  it('keeps rendering ownership explicit while Stage 6 choreography targets modules and built-in effects without cameras', () => {
    const plan = compileInterlock()
    expect(plan.capabilities.required).toEqual(['render.webgl2'])
    expect(plan.manifest.cameras ?? []).toHaveLength(0)
    expect(plan.manifest.lighting?.lights ?? []).toHaveLength(0)
    expect(plan.manifest.mediaSlots ?? []).toHaveLength(0)
    expect(plan.manifest.choreography?.rules.length).toBeGreaterThanOrEqual(18)
    expect(plan.manifest.choreography?.rules.some(rule => rule.source.signal === 'drop')).toBe(true)
    expect(plan.manifest.choreography?.rules.some(rule => rule.source.path === 'director.intensity')).toBe(true)
    expect(plan.manifest.choreography?.rules.some(rule => rule.source.path === 'audio.features.vocalPresence')).toBe(true)
    expect(plan.manifest.choreography?.rules.every(rule => rule.enabledParameter?.$ref !== CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID)).toBe(true)
    expect(plan.manifest.choreography?.rules.every(rule => rule.strengthParameter?.$ref === CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID)).toBe(true)

    expect(plan.manifest.layers).toEqual([
      expect.objectContaining({ id: CINEMA2_INTERLOCK_BACKGROUND_LAYER_ID, order: 0, blendMode: 'normal', depthPolicy: 'disabled' }),
      expect.objectContaining({ id: CINEMA2_INTERLOCK_LAYER_ID, order: 1, blendMode: 'normal', depthPolicy: 'disabled' }),
    ])
    expect(plan.manifest.effects).toEqual([
      expect.objectContaining({
        id: CINEMA2_INTERLOCK_TRAILS_EFFECT_ID,
        order: 0,
        parameters: expect.objectContaining({ mix: 0.35, persistence: 0.76, transportAware: true }),
      }),
      expect.objectContaining({
        id: CINEMA2_INTERLOCK_BLOOM_EFFECT_ID,
        order: 1,
        parameters: expect.objectContaining({ mix: 0.38, threshold: 0.64, radius: 2.2, intensity: 0.35 }),
      }),
    ])
    expect(plan.manifest.render?.targets).toEqual([
      expect.objectContaining({ id: CINEMA2_INTERLOCK_RENDER_TARGET_ID, descriptor: expect.objectContaining({ colorFormat: 'rgba8', depthFormat: 'none' }) }),
      expect.objectContaining({ id: CINEMA2_INTERLOCK_TRAILS_TARGET_ID, descriptor: expect.objectContaining({ colorFormat: 'rgba8', depthFormat: 'none' }) }),
    ])
    expect(plan.manifest.render?.passes).toEqual([
      expect.objectContaining({ id: CINEMA2_INTERLOCK_RENDER_PASS_ID, kind: 'scene' }),
      expect.objectContaining({ id: CINEMA2_INTERLOCK_TRAILS_PASS_ID, kind: 'fullscreen', effect: { id: CINEMA2_INTERLOCK_TRAILS_EFFECT_ID } }),
      expect.objectContaining({ id: CINEMA2_INTERLOCK_BLOOM_PASS_ID, kind: 'fullscreen', effect: { id: CINEMA2_INTERLOCK_BLOOM_EFFECT_ID } }),
    ])
    expect(plan.manifest.render?.outputPass).toEqual({ id: CINEMA2_INTERLOCK_BLOOM_PASS_ID })

    const backgroundParameters = plan.manifest.modules?.find(module => module.id === CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID)?.parameters ?? {}
    expect(backgroundParameters).toMatchObject({
      backgroundEnergy: 0,
      backgroundBassExpansion: 0,
      backgroundFlux: 0,
      backgroundBuild: 0,
      backgroundDropImpact: 0,
      backgroundVocalRestraint: 0,
    })
    const ledModule = plan.manifest.modules?.find(module => module.id === CINEMA2_INTERLOCK_MODULE_ID)
    expect(ledModule?.parameters?.unlitVisibility).toBe(0.085)
    expect(ledModule?.parameterBindings?.effectsIntensity).toEqual({ id: CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID })
    expect(ledModule?.parameterBindings?.segmentBankPhase).toEqual({ id: CINEMA2_INTERLOCK_BANK_STAGGER_ID })
    expect(ledModule?.parameterBindings?.autoPerformance).toEqual({ id: CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID })
    expect(ledModule?.parameterBindings?.masterReactivity).toEqual({ id: CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID })
    expect(plan.manifest.effects?.find(effect => effect.id === CINEMA2_INTERLOCK_TRAILS_EFFECT_ID)?.parameterBindings?.mix).toEqual({ id: CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID })
    expect(plan.manifest.effects?.find(effect => effect.id === CINEMA2_INTERLOCK_BLOOM_EFFECT_ID)?.parameterBindings?.intensity).toEqual({ id: CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID })
  })

  it('derives deterministic bounded background palettes and preserves manual color authority', () => {
    const whiteA = deriveCinema2InterlockLiquidLightPalette([1, 1, 1, 1])
    const whiteB = deriveCinema2InterlockLiquidLightPalette([1, 1, 1, 1])
    expect(whiteA).toEqual(whiteB)
    expect(whiteA.base[2]).toBeGreaterThan(whiteA.base[0])
    expect(whiteA.accent[2]).toBeGreaterThan(whiteA.accent[0])

    for (const led of [[0, 0, 0, 1], [1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1]] as const) {
      const palette = deriveCinema2InterlockLiquidLightPalette(led)
      for (const color of [palette.base, palette.accent]) {
        expect(color.every(component => component >= 0 && component <= 1)).toBe(true)
      }
      expect(Math.max(...palette.base.slice(0, 3))).toBeLessThanOrEqual(0.12)
    }

    const manualBase = [0.02, 0.03, 0.04, 1] as const
    const manualAccent = [0.1, 0.2, 0.3, 1] as const
    expect(deriveCinema2InterlockLiquidLightPalette([1, 0, 0, 1], 'manual', manualBase, manualAccent)).toEqual({
      base: manualBase,
      accent: manualAccent,
    })
  })
})
