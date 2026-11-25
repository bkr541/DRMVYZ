import { afterEach, describe, expect, it } from 'vitest'
import { setAutoPerformanceUserDefault } from '../../../../lib/autoPerformanceDefault'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2CorridorPerformance, corridorPoolTrigger } from '../modules/Cinema2CorridorNativeModule'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { CORRIDOR_PATTERNS, buildCorridorGeometry, CORRIDOR_VERTEX_FLOATS, CORRIDOR_MAX_INSET, CORRIDOR_BANK_SPAN } from '../modules/corridor/Cinema2CorridorRenderer'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_CORRIDOR_MEDIA_SLOT, CINEMA2_CORRIDOR_PRESET_ID, CINEMA2_CORRIDOR_PRESET_MANIFEST } from '../presets/Cinema2CorridorPreset'
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

  it('declares an optional canonical media slot and an independent musical pool cadence', () => {
    expect(manifest.mediaSlots).toEqual([{ id: CINEMA2_CORRIDOR_MEDIA_SLOT, label: 'Panel Media', accepts: ['image','video','svg'] }])
    expect(manifest.modules?.[0]?.media?.panelMedia?.$ref).toBe(CINEMA2_CORRIDOR_MEDIA_SLOT)
    expect(parameter('panel-media').mediaSlot?.$ref).toBe(CINEMA2_CORRIDOR_MEDIA_SLOT)
    expect(parameter('pool-trigger')).toMatchObject({ defaultValue: 'program', options: [{ value: 'program', label: 'Program cadence' }, ...CINEMA2_AFTERHOURS_TRIGGER_OPTIONS] })
    expect(CORRIDOR_PATTERNS.map(pattern => corridorPoolTrigger(pattern.value))).toEqual(['bar4','beat4','bar','bar4','beat2','bar'])
  })

  it('builds a backing, telescoping mount, rigid body, bevel, recessed strip and face for every cell', () => {
    const geometry = buildCorridorGeometry()
    const cells = new Map<string, Map<number, number[]>>()
    for (let i = 0; i < geometry.length; i += CORRIDOR_VERTEX_FLOATS) {
      const cell = `${geometry[i+5]}:${geometry[i+6]}:${geometry[i+7]}`
      const parts = cells.get(cell) ?? new Map<number, number[]>()
      const part = geometry[i+8]!
      const depths = parts.get(part) ?? []
      depths.push(geometry[i+2]!)
      parts.set(part,depths)
      cells.set(cell,parts)
    }
    expect(cells.size).toBe(192)
    expect(geometry.byteLength).toBe(1382400)
    expect(CORRIDOR_BANK_SPAN + CORRIDOR_MAX_INSET).toBeLessThan(1)
    for (const parts of cells.values()) {
      expect([...parts.keys()].sort()).toEqual([0,1,2,3,4,5])
      expect(Math.max(...parts.get(0)!)).toBe(0)
      expect(Math.min(...parts.get(5)!)).toBe(0)
      expect(Math.max(...parts.get(5)!)).toBe(1)
      expect(Math.max(...parts.get(2)!)).toBe(1)
      expect(Math.max(...parts.get(3)!)).toBeLessThan(Math.min(...parts.get(4)!))
    }
  })

  it('uses the shared routed bass, kick and build with bounded attack, pause, reset and manual authority', () => {
    const performance = new Cinema2CorridorPerformance(() => .5)
    const values: Record<string, unknown> = { autoPerformance: true, motion: .75, bass: 0, kick: 0, build: 0 }
    let time = 0
    let generation = 1
    const update = (paused = false, playing = true) => {
      time += .1
      return performance.update({
        parameters: { get: (name: string) => values[name] },
        frame: {
          contextGeneration: generation, elapsedTimeSec: time, deltaTimeSec: .1, audio: null, director: null, mood: null,
          transport: { sourcePresent: true, playing, paused, animationActive: !paused, timeSec: time, trackId: 'test', bpm: 120 },
        },
      } as unknown as Cinema2ModuleUpdateContext)
    }
    update()
    Object.assign(values,{ bass: 1, kick: 1, build: 1 })
    const attack = update()
    expect(attack.bass).toBe(.75)
    expect(attack.kick).toBe(.75)
    expect(attack.extensionBuild).toBeGreaterThan(0)
    expect(attack.extensionBuild).toBeLessThan(.75)
    const charged = update()
    expect(charged.extensionBuild).toBeGreaterThan(attack.extensionBuild)
    Object.assign(values,{ bass: 0, kick: 0, build: 0 })
    expect(update(true)).toMatchObject({ bass: charged.bass, kick: charged.kick, extensionBuild: charged.extensionBuild })
    const released = update()
    expect(released.bass).toBe(0)
    expect(released.kick).toBe(0)
    expect(released.extensionBuild).toBeLessThan(charged.extensionBuild)
    Object.assign(values,{ bass: 1, kick: 1, build: 1 })
    update()
    generation++
    expect(update()).toMatchObject({ bass: 0, kick: 0, extensionBuild: 0 })
    values.autoPerformance = false
    expect(update()).toMatchObject({ bass: 0, kick: 0, extensionBuild: 0 })
    values.autoPerformance = true
    values.motion = 0
    expect(update()).toMatchObject({ bass: 0, kick: 0, extensionBuild: 0 })
    values.motion = .75
    expect(update(false,false)).toMatchObject({ bass: 0, kick: 0, extensionBuild: 0 })
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
