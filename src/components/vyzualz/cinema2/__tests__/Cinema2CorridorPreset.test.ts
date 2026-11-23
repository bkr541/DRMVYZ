import { afterEach, describe, expect, it } from 'vitest'
import { setAutoPerformanceUserDefault } from '../../../../lib/autoPerformanceDefault'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_CORRIDOR_PRESET_ID, CINEMA2_CORRIDOR_PRESET_MANIFEST } from '../presets/Cinema2CorridorPreset'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const manifest = CINEMA2_CORRIDOR_PRESET_MANIFEST
const parameter = (name: string) => manifest.parameters!.find(item => item.id === `corridor-${name}`)!

afterEach(() => setAutoPerformanceUserDefault(null))

describe('Corridor', () => {
  it('registers the production graph, six patterns, and all canonical trigger options', () => {
    const result = cinema2NativePresetRegistry.compile(CINEMA2_CORRIDOR_PRESET_ID)
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest }).diagnostics).toEqual([])
    expect(parameter('pattern').options).toHaveLength(6)
    expect(parameter('pattern-change')).toMatchObject({ defaultValue: false, metadata: { moodPolicy: 'patternChange' } })
    expect(parameter('trigger')).toMatchObject({
      options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: 'corridor-pattern-change', value: true }],
    })
  })

  it('follows both System Settings values and preserves the contracted Inspector authority', () => {
    const result = cinema2NativePresetRegistry.compile(CINEMA2_CORRIDOR_PRESET_ID)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    for (const setting of [true, false]) {
      setAutoPerformanceUserDefault(setting)
      const state = new Cinema2ParameterState(result.plan.parameters)
      expect(state.getValue(parameter('auto-performance').id)).toBe(setting)
      const groups = createCinema2DesignParentGroupModel(result.plan, state.getSnapshot())
      expect(groups.map(group => group.id)).toEqual(['master-controls','design','effects','palette'])
      const controls = groups.flatMap(group => [...group.controls, ...group.groups.flatMap(child => child.controls)])
      expect(controls.find(control => control.definition.id === 'corridor-trigger')).toBeUndefined()
      for (const control of controls) {
        const editable = control.definition.designParentGroup === 'palette'
          || ['corridor-auto-performance','corridor-bpm-sync'].includes(control.definition.id)
        expect(control.enabled, control.definition.label).toBe(!setting || editable)
      }
      expect(state.setPersistentValue(parameter('pattern-change').id,true).ok).toBe(true)
      const next = createCinema2DesignParentGroupModel(result.plan, state.getSnapshot())
      expect(next.flatMap(group => group.groups.flatMap(child => child.controls)).some(control => control.definition.id === 'corridor-trigger')).toBe(true)
    }
  })
})
