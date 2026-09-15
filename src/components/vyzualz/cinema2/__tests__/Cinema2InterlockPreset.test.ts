import { describe, expect, it } from 'vitest'

import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createCinema2InspectorModel } from '../parameters/Cinema2InspectorModel'
import {
  CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID,
  CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION,
} from '../modules/Cinema2InterlockNativeModule'
import {
  CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID,
  CINEMA2_INTERLOCK_PATTERN_IDS,
} from '../modules/interlock/Cinema2InterlockDomain'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import {
  CINEMA2_INTERLOCK_LAYER_ID,
  CINEMA2_INTERLOCK_LED_COLOR_ID,
  CINEMA2_INTERLOCK_LED_INTENSITY_ID,
  CINEMA2_INTERLOCK_MODULE_ID,
  CINEMA2_INTERLOCK_MORPH_DURATION_ID,
  CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID,
  CINEMA2_INTERLOCK_PRESET_ID,
  CINEMA2_INTERLOCK_PRESET_MANIFEST,
  CINEMA2_INTERLOCK_RENDER_PASS_ID,
  CINEMA2_INTERLOCK_RENDER_TARGET_ID,
  CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID,
  CINEMA2_INTERLOCK_SYMMETRY_ID,
} from '../presets/Cinema2InterlockPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const AVAILABLE_CAPABILITIES = Object.freeze(['render.webgl2', 'audio.transport'] as const)
const EXPECTED_PARAMETER_IDS = Object.freeze([
  CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID,
  CINEMA2_INTERLOCK_SYMMETRY_ID,
  CINEMA2_INTERLOCK_LED_COLOR_ID,
  CINEMA2_INTERLOCK_LED_INTENSITY_ID,
  CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID,
  CINEMA2_INTERLOCK_MORPH_DURATION_ID,
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
  it('registers exactly once as a keeper and activates through the canonical compiler and module registries', () => {
    const declarations = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(candidate => candidate.manifest.id === CINEMA2_INTERLOCK_PRESET_ID)
    expect(declarations).toHaveLength(1)
    expect(declarations[0]).toMatchObject({ role: 'keeper' })
    expect(declarations[0]?.manifest.metadata.name).toBe('Interlock')
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_INTERLOCK_PRESET_MANIFEST })).toMatchObject({ ok: true })
    expect(cinema2NativePresetRegistry.has(CINEMA2_INTERLOCK_PRESET_ID)).toBe(true)
    expect(cinema2NativeModuleRegistry.get(CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID, CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION)).not.toBeNull()

    const registryCompilation = cinema2NativePresetRegistry.compile(CINEMA2_INTERLOCK_PRESET_ID, {
      availableCapabilities: AVAILABLE_CAPABILITIES,
    })
    expect(registryCompilation.ok).toBe(true)
    if (!registryCompilation.ok) return
    expect(registryCompilation.plan.presetId).toBe(CINEMA2_INTERLOCK_PRESET_ID)
    expect(registryCompilation.plan.manifest.modules?.[0]).toMatchObject({
      id: CINEMA2_INTERLOCK_MODULE_ID,
      typeId: CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID,
      version: CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION,
    })
    expect(cinema2NativeModuleRegistry.validateModules(registryCompilation.plan.manifest.modules ?? [])).toMatchObject({ ok: true })
  })

  it('authors exactly the six Stage 2 controls and projects them through the shared Inspector without preset-specific UI', () => {
    const plan = compileInterlock()
    expect(plan.parameters.definitions.map(definition => definition.id)).toEqual(EXPECTED_PARAMETER_IDS)
    expect(plan.parameters.authoredDefaults[CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID]).toBe(CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID)

    const pattern = plan.parameters.definitions.find(definition => definition.id === CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID)
    expect(pattern?.options?.map(option => option.value)).toEqual(CINEMA2_INTERLOCK_PATTERN_IDS)
    expect(plan.parameters.definitions.find(definition => definition.id === CINEMA2_INTERLOCK_LED_INTENSITY_ID)).toMatchObject({ min: 0, max: 1 })
    expect(plan.parameters.definitions.find(definition => definition.id === CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID)).toMatchObject({ min: 0, max: 1 })
    expect(plan.parameters.definitions.find(definition => definition.id === CINEMA2_INTERLOCK_MORPH_DURATION_ID)).toMatchObject({ min: 0.25, max: 8 })

    const state = new Cinema2ParameterState(plan.parameters)
    const design = createCinema2InspectorModel(plan, state.getSnapshot(), 'design')
    const controls = design
      .flatMap(section => section.groups)
      .flatMap(group => group.kind === 'instance' ? group.controls : group.controls)
      .map(control => control.definition.id)
    expect(controls).toEqual(expect.arrayContaining(EXPECTED_PARAMETER_IDS))
    expect(controls).toHaveLength(EXPECTED_PARAMETER_IDS.length)
  })

  it('persists and reconstructs all Stage 2 authored state while keeping runtime transition/GPU state out of serialization', () => {
    const plan = compileInterlock()
    const state = new Cinema2ParameterState(plan.parameters)

    expect(state.setPersistentValue(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID, 'fourWayVortex')).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_LED_COLOR_ID, [0.3, 0.8, 1, 1])).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_LED_INTENSITY_ID, 0.61)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID, 0.42)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_MORPH_DURATION_ID, 4.25)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_INTERLOCK_SYMMETRY_ID, false)).toMatchObject({ ok: true })

    const serialized = state.serialize()
    const payload = JSON.parse(serialized) as { presetId: string; values: Record<string, unknown> }
    expect(payload.presetId).toBe(CINEMA2_INTERLOCK_PRESET_ID)
    expect(Object.keys(payload.values).sort()).toEqual([...EXPECTED_PARAMETER_IDS].sort())
    expect(JSON.stringify(payload)).not.toMatch(/transition|angle|endpoint|buffer|program|viewport|contextGeneration/i)

    const restored = new Cinema2ParameterState(plan.parameters)
    expect(restored.restore(serialized)).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID)).toBe('fourWayVortex')
    expect(restored.getValue(CINEMA2_INTERLOCK_LED_COLOR_ID)).toEqual([0.3, 0.8, 1, 1])
    expect(restored.getValue(CINEMA2_INTERLOCK_LED_INTENSITY_ID)).toBe(0.61)
    expect(restored.getValue(CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID)).toBe(0.42)
    expect(restored.getValue(CINEMA2_INTERLOCK_MORPH_DURATION_ID)).toBe(4.25)
    expect(restored.getValue(CINEMA2_INTERLOCK_SYMMETRY_ID)).toBe(false)
  })

  it('uses the required screen-space/no-depth production shape and does not smuggle later-stage systems into Stage 2', () => {
    const plan = compileInterlock()
    expect(plan.capabilities.required).toEqual(['render.webgl2'])
    expect(plan.manifest.cameras ?? []).toHaveLength(0)
    expect(plan.manifest.lighting?.lights ?? []).toHaveLength(0)
    expect(plan.manifest.mediaSlots ?? []).toHaveLength(0)
    expect(plan.manifest.effects ?? []).toHaveLength(0)
    expect(plan.manifest.variations ?? []).toHaveLength(0)
    expect(plan.manifest.choreography).toBeUndefined()

    expect(plan.manifest.layers).toEqual([expect.objectContaining({
      id: CINEMA2_INTERLOCK_LAYER_ID,
      depthPolicy: 'disabled',
      blendMode: 'normal',
    })])
    expect(plan.manifest.render?.targets).toEqual([expect.objectContaining({
      id: CINEMA2_INTERLOCK_RENDER_TARGET_ID,
      descriptor: expect.objectContaining({ colorFormat: 'rgba8', depthFormat: 'none' }),
    })])
    expect(plan.manifest.render?.passes).toEqual([expect.objectContaining({
      id: CINEMA2_INTERLOCK_RENDER_PASS_ID,
      kind: 'scene',
    })])
    expect(plan.scene.nodes.every(node => node.coordinateSpace === 'normalized-screen')).toBe(true)
  })
})
