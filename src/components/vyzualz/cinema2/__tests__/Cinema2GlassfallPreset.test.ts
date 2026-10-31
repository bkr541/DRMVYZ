import { describe, it, expect } from 'vitest'
import { CINEMA2_GLASSFALL_PRESET_ID, CINEMA2_GLASSFALL_PRESET_MANIFEST as manifest } from '../presets/Cinema2GlassfallPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { glassfallParameterId as pid } from '../presets/Cinema2GlassfallPhase2Definition'
describe('GLASSFALL final production wiring', () => {
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
