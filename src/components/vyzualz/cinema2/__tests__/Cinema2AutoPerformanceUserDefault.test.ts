import { afterEach, describe, expect, it } from 'vitest'
import type { Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { setCinema2AutoPerformanceUserDefault, subscribeCinema2AutoPerformanceUserDefault } from '../parameters/Cinema2AutoPerformanceDefault'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_IFRIT_PRESET_MANIFEST } from '../presets/Cinema2IfritPreset'
import { CINEMA2_STARTERS_PRESET_MANIFEST } from '../presets/Cinema2StartersPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { MOOD_CAPABILITIES } from './support/MoodMigrationHarness'

const IFRIT_AP = 'ifrit-auto-performance' as Cinema2ParameterId
const STARTERS_AP = 'starters-auto-performance' as Cinema2ParameterId

function stateFor(manifest: typeof CINEMA2_IFRIT_PRESET_MANIFEST) {
  const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: MOOD_CAPABILITIES as never })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(d => d.message).join('; '))
  return new Cinema2ParameterState(compiled.plan.parameters)
}

describe('the user\'s Auto Performance default (System Settings)', () => {
  afterEach(() => setCinema2AutoPerformanceUserDefault(null))

  it('leaves each preset\'s authored default alone until the user has a setting', () => {
    expect(stateFor(CINEMA2_IFRIT_PRESET_MANIFEST).getValue(IFRIT_AP)).toBe(false)
    expect(stateFor(CINEMA2_STARTERS_PRESET_MANIFEST).getValue(STARTERS_AP)).toBe(true)
  })

  it('starts every preset with the user\'s value, on or off, whatever the preset authored', () => {
    setCinema2AutoPerformanceUserDefault(true)
    expect(stateFor(CINEMA2_IFRIT_PRESET_MANIFEST).getValue(IFRIT_AP)).toBe(true)
    setCinema2AutoPerformanceUserDefault(false)
    expect(stateFor(CINEMA2_STARTERS_PRESET_MANIFEST).getValue(STARTERS_AP)).toBe(false)
  })

  it('resets to the user\'s value and ignores a value saved before the setting existed', () => {
    setCinema2AutoPerformanceUserDefault(null)
    const saved = stateFor(CINEMA2_STARTERS_PRESET_MANIFEST).serialize()
    setCinema2AutoPerformanceUserDefault(false)
    const state = stateFor(CINEMA2_STARTERS_PRESET_MANIFEST)
    expect(state.restore(saved).ok).toBe(true)
    expect(state.getValue(STARTERS_AP)).toBe(false)
    state.setPersistentValue(STARTERS_AP, true)
    expect(state.getValue(STARTERS_AP)).toBe(true)
    state.reset(STARTERS_AP)
    expect(state.getValue(STARTERS_AP)).toBe(false)
  })

  it('does not touch any other saved value on restore', () => {
    const before = stateFor(CINEMA2_STARTERS_PRESET_MANIFEST)
    const other = Object.keys(before.getSnapshot().persistentValues).find(id => id !== STARTERS_AP && typeof before.getValue(id as Cinema2ParameterId) === 'number')!
    before.setPersistentValue(other as Cinema2ParameterId, 0.123)
    const saved = before.serialize()
    setCinema2AutoPerformanceUserDefault(false)
    const state = stateFor(CINEMA2_STARTERS_PRESET_MANIFEST)
    state.restore(saved)
    expect(state.getValue(other as Cinema2ParameterId)).toBeCloseTo(0.123, 2)
  })

  it('reaches a running preset when the setting changes', () => {
    setCinema2AutoPerformanceUserDefault(false)
    const state = stateFor(CINEMA2_IFRIT_PRESET_MANIFEST)
    const unsubscribe = subscribeCinema2AutoPerformanceUserDefault(value => state.applyAutoPerformanceDefault(value))
    setCinema2AutoPerformanceUserDefault(true)
    expect(state.getValue(IFRIT_AP)).toBe(true)
    setCinema2AutoPerformanceUserDefault(false)
    expect(state.getValue(IFRIT_AP)).toBe(false)
    unsubscribe()
    setCinema2AutoPerformanceUserDefault(true)
    expect(state.getValue(IFRIT_AP)).toBe(false)
  })

  it('reaches every registered preset that has an Auto Performance toggle, migrated or not', () => {
    const toggles: string[] = []
    for (const manifest of cinema2NativePresetRegistry.list()) {
      const compiled = cinema2NativePresetRegistry.compile(manifest.id, { availableCapabilities: MOOD_CAPABILITIES as never })
      if (!compiled.ok) continue
      const ids = compiled.plan.parameters.definitions.filter(definition => definition.type === 'boolean' && definition.label.trim().toLowerCase() === 'auto performance').map(definition => definition.id)
      for (const value of [true, false]) {
        setCinema2AutoPerformanceUserDefault(value)
        const state = new Cinema2ParameterState(compiled.plan.parameters)
        for (const id of ids) expect([manifest.id, id, state.getValue(id)]).toEqual([manifest.id, id, value])
      }
      toggles.push(...ids)
    }
    expect(toggles.length).toBeGreaterThan(35)
  })
})
