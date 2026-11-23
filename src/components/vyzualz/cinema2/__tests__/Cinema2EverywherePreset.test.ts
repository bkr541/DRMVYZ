import { afterEach, describe, expect, it } from 'vitest'
import { setAutoPerformanceUserDefault } from '../../../../lib/autoPerformanceDefault'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_EVERYWHERE_PRESET_ID, CINEMA2_EVERYWHERE_PRESET_MANIFEST } from '../presets/Cinema2EverywherePreset'
import { Cinema2EverywherePerformance } from '../modules/Cinema2EverywhereNativeModule'
import { buildEverywhereCabinetLayout, EVERYWHERE_PATTERNS, everywhereScreenGain, type EverywhereLook } from '../modules/everywhere/Cinema2EverywhereWall'
import { EVERYWHERE_SCREEN_FRAGMENT } from '../modules/everywhere/Cinema2EverywhereScreens'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const manifest = CINEMA2_EVERYWHERE_PRESET_MANIFEST
const parameter = (name: string) => manifest.parameters!.find(item => item.id === `everywhere-${name}`)!

afterEach(() => setAutoPerformanceUserDefault(null))

describe('Everywhere', () => {
  it('registers the production graph, six patterns, and all canonical trigger options', () => {
    const result = cinema2NativePresetRegistry.compile(CINEMA2_EVERYWHERE_PRESET_ID)
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest }).diagnostics).toEqual([])
    expect(manifest.mediaSlots).toEqual([{ id: 'everywhere-screen-media', label: 'Screen Media', accepts: ['image', 'video', 'svg'] }])
    expect(parameter('pattern').options).toHaveLength(6)
    expect(manifest.schemaId).toBe('drmvyz.cinema2.native-preset')
    expect(manifest.modules?.[0]?.id).toBe('everywhere-cassettes')
    expect(manifest.layers?.[0]?.label).toBe('CRT Wall')
    expect(manifest.cameras?.[0]?.targetNode?.$ref).toBe('everywhere-aim')
    expect(manifest.capabilities?.find(capability => capability.id === 'render.depth')?.purpose).toContain('television')
    expect(JSON.stringify(manifest)).not.toMatch(/corridor|passage of|wall tiles/i)
    expect(parameter('pattern-change')).toMatchObject({ defaultValue: false, metadata: { moodPolicy: 'patternChange' } })
    expect(parameter('trigger')).toMatchObject({
      options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: 'everywhere-pattern-change', value: true }],
    })
  })

  it('follows both System Settings values and preserves the contracted Inspector authority', () => {
    const result = cinema2NativePresetRegistry.compile(CINEMA2_EVERYWHERE_PRESET_ID)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    for (const setting of [true, false]) {
      setAutoPerformanceUserDefault(setting)
      const state = new Cinema2ParameterState(result.plan.parameters)
      expect(state.getValue(parameter('auto-performance').id)).toBe(setting)
      const groups = createCinema2DesignParentGroupModel(result.plan, state.getSnapshot())
      expect(groups.map(group => group.id)).toEqual(['master-controls','design','effects','palette'])
      const controls = groups.flatMap(group => [...group.controls, ...group.groups.flatMap(child => child.controls)])
      expect(controls.find(control => control.definition.id === 'everywhere-trigger')).toBeUndefined()
      for (const control of controls) {
        const editable = control.definition.designParentGroup === 'palette'
          || ['everywhere-auto-performance','everywhere-bpm-sync'].includes(control.definition.id)
        expect(control.enabled, control.definition.label).toBe(!setting || editable)
      }
      expect(state.setPersistentValue(parameter('pattern-change').id,true).ok).toBe(true)
      const next = createCinema2DesignParentGroupModel(result.plan, state.getSnapshot())
      expect(next.flatMap(group => group.groups.flatMap(child => child.controls)).some(control => control.definition.id === 'everywhere-trigger')).toBe(true)
    }
  })

  it('builds a dense deterministic wall with a prominent hero and distinct screen programs', () => {
    const wall = buildEverywhereCabinetLayout()
    expect(wall.length).toBeGreaterThan(60)
    expect(wall[0]).toMatchObject({ x: 0, scale: 2.75 })
    expect(buildEverywhereCabinetLayout()).toEqual(wall)
    expect(wall.some(screen => screen.x < -6)).toBe(true)
    expect(wall.some(screen => screen.x > 6)).toBe(true)
    const look: EverywhereLook = {
      pattern: 'all-eyes', phase: 1.2, brightness: 1.06, coverage: 1, angle: .84, motion: .72,
      scan: .2, glare: .65, layout: 'repeat',
      colors: { background: [0, 0, 0, 1], cabinet: [.2, .2, .2, 1], cool: [0, 1, 1, 1],
        warm: [1, .5, .2, 1], screen: [1, 1, 1, 1] },
      energy: 0, bass: 0, high: 0, vocal: 0, kick: 0, snare: 0, build: 0, drop: 0,
    }
    const gains = EVERYWHERE_PATTERNS.map(({ value }) => [value,
      wall.slice(0, 20).map((cabinet, index) => everywhereScreenGain(cabinet, index, { ...look, pattern: value })),
    ] as const)
    for (const [name, values] of gains) {
      expect(values.every(value => value >= 0 && value <= 1.5), name).toBe(true)
    }
    for (let first = 0; first < gains.length; first++) {
      for (let second = first + 1; second < gains.length; second++) {
        expect(gains[first]![1]).not.toEqual(gains[second]![1])
      }
    }
    expect(everywhereScreenGain(wall[0]!, 0, { ...look, vocal: 1 })).toBeGreaterThanOrEqual(.66)
    expect(everywhereScreenGain(wall[3]!, 3, { ...look, coverage: .18 })).toBeLessThanOrEqual(
      everywhereScreenGain(wall[3]!, 3, look),
    )
  })

  it('preserves the default eye underneath transparent assigned media', () => {
    expect(EVERYWHERE_SCREEN_FRAGMENT).toContain('media.a * inside * uMediaOpacity')
    expect(EVERYWHERE_SCREEN_FRAGMENT).toContain('mix(picture,linearColor(media.rgb)')
    expect(EVERYWHERE_SCREEN_FRAGMENT).toContain('glassAlpha')
  })

  it('resets its musical phase when the track timeline revision changes', () => {
    const performance = new Cinema2EverywherePerformance(index => (index % 7) / 7)
    const controls: Record<string, unknown> = {
      pattern: 'all-eyes', motion: .8, bpmSync: true, autoPerformance: false, patternChange: false,
    }
    const update = (time: number, revision: number) => performance.update({
      parameters: { get: (name: string) => controls[name] },
      frame: {
        contextGeneration: 1, elapsedTimeSec: time, deltaTimeSec: .05,
        transport: { trackId: 'track-1', timeSec: time, playing: true, paused: false,
          animationActive: true, bpmSync: true, bpm: 120, sourcePresent: true },
        audio: { upstream: { sourceId: 'track-1', publisherId: 'test', analysisRevision: 1,
          timelineRevision: revision }, rhythm: { fixedClocks: { 4: { boundary: null } } },
          discontinuity: { generation: 0 } },
      },
    } as unknown as Cinema2ModuleUpdateContext)
    update(0, 1)
    update(.05, 1)
    update(.10, 1)
    expect(performance.look.phase).toBeGreaterThan(.22)
    update(.15, 2)
    expect(performance.look.phase).toBeCloseTo(.22)
    controls.pattern = 'cross-cut'
    update(.20, 2)
    expect(performance.look.pattern).toBe('cross-cut')
  })

})
