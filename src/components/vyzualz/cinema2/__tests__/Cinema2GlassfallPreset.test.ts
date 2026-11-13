import { describe, it, expect } from 'vitest'
import { CINEMA2_GLASSFALL_PRESET_ID, CINEMA2_GLASSFALL_PRESET_MANIFEST as manifest } from '../presets/Cinema2GlassfallPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { glassfallParameterId as pid } from '../presets/Cinema2GlassfallPhase2Definition'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { GLASSFALL_CHOREOGRAPHY_ENABLED_ID } from '../presets/Cinema2GlassfallChoreography'
describe('GLASSFALL final production wiring', () => {
  it.each([false, true])('restores saved settings containing the legacy choreography value %s', legacy => {
    const result = cinema2NativePresetRegistry.compile(CINEMA2_GLASSFALL_PRESET_ID)
    if (!result.ok) throw new Error('GLASSFALL must compile')
    const state = new Cinema2ParameterState(result.plan.parameters)
    const saved = JSON.parse(state.serialize())
    saved.values[GLASSFALL_CHOREOGRAPHY_ENABLED_ID] = legacy
    saved.values[pid('autoPerformance')] = true
    saved.values[pid('intensity')] = .63
    expect(state.restore(saved).ok).toBe(true)
    expect(state.getValue(pid('intensity'))).toBe(.63)
    expect(state.getValue(pid('autoPerformance'))).toBe(true)
  })
  it('gives Auto Performance sole ownership of choreography, Director routes and temporary patterns', () => {
    expect(manifest.parameters!.find(p => p.id === GLASSFALL_CHOREOGRAPHY_ENABLED_ID)?.exposure).toBe('hidden')
    const module = manifest.modules![0]
    expect(module.parameters).toMatchObject({ autoPerformance: false, choreography: false })
    expect(module.parameterBindings).toMatchObject({
      autoPerformance: { $ref: pid('autoPerformance') },
      choreography: { $ref: pid('autoPerformance') },
    })
    expect(manifest.choreography!.rules).toHaveLength(12)
    for (const rule of manifest.choreography!.rules) expect(rule.enabledParameter?.$ref).toBe(pid('autoPerformance'))
    const master = manifest.parameters!.filter(p => p.designParentGroup === 'master-controls' && p.exposure !== 'hidden').sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    expect(master.slice(-2).map(p => p.label)).toEqual(['BPM Sync', 'Auto Performance'])
  })
  it('registers and compiles through the actual catalog/module registry', () => {
    expect(validateCinema2PresetAuthoringConventions({ role: 'reference', manifest }).diagnostics).toEqual([])
    expect(cinema2NativePresetRegistry.has(CINEMA2_GLASSFALL_PRESET_ID)).toBe(true)
    expect(cinema2NativePresetRegistry.compile(CINEMA2_GLASSFALL_PRESET_ID).ok).toBe(true)
    expect(cinema2NativeModuleRegistry.validateModules(manifest.modules!).ok).toBe(true)
  })
  it('retains six patterns, exact shared triggers, palette roles and explicit manual defaults', () => {
    const parameter = (name: string) => manifest.parameters!.find(p => p.id === pid(name))!
    expect(parameter('pattern').options).toHaveLength(6)
    expect(parameter('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(parameter('patternChange').defaultValue).toBe(false)
    expect(parameter('autoPerformance').defaultValue).toBe(false)
    expect(parameter('sync').designParentGroup).toBe('master-controls')
    expect(manifest.parameters!.filter(p => p.type === 'color' && p.designParentGroup === 'palette').length).toBeGreaterThanOrEqual(4)
    expect(manifest.parameters!.every(p => ['master-controls', 'design', 'effects', 'palette'].includes(p.designParentGroup!))).toBe(true)
    expect(parameter('bloom').min).toBe(0)
  })
})
