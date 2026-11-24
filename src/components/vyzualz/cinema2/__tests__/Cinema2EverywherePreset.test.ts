import { afterEach, describe, expect, it } from 'vitest'
import { setAutoPerformanceUserDefault } from '../../../../lib/autoPerformanceDefault'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_EVERYWHERE_PRESET_ID, CINEMA2_EVERYWHERE_PRESET_MANIFEST } from '../presets/Cinema2EverywherePreset'
import { Cinema2EverywherePerformance } from '../modules/Cinema2EverywhereNativeModule'
import { buildEverywhereCabinetLayout, EVERYWHERE_PATTERNS, EVERYWHERE_REAR_DEPTH, everywhereWallCoverScale, everywhereScreenGain, type EverywhereLook } from '../modules/everywhere/Cinema2EverywhereWall'
import { everywhereEyePose } from '../modules/everywhere/Cinema2EverywhereEyeMotion'
import { EVERYWHERE_SCREEN_FRAGMENT } from '../modules/everywhere/Cinema2EverywhereScreens'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const manifest = CINEMA2_EVERYWHERE_PRESET_MANIFEST
const parameter = (name: string) => manifest.parameters!.find(item => item.id === `everywhere-${name}`)!

afterEach(() => setAutoPerformanceUserDefault(null))

describe('Everywhere', () => {
  it('registers the production graph, twelve patterns, and all canonical trigger options', () => {
    const result = cinema2NativePresetRegistry.compile(CINEMA2_EVERYWHERE_PRESET_ID)
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest }).diagnostics).toEqual([])
    expect(manifest.mediaSlots).toEqual([{ id: 'everywhere-screen-media', label: 'Screen Media', accepts: ['image', 'video', 'svg'] }])
    expect(parameter('pattern').options).toHaveLength(12)
    expect(parameter('pool-trigger').options).toEqual([{value:'program',label:'Program cadence'},...CINEMA2_AFTERHOURS_TRIGGER_OPTIONS])
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
    expect(wall[0]).toMatchObject({ x: 0, scale: 3.05 })
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

  it('covers the entire perspective frustum with rear cabinets in every tested layout', () => {
    const rear=buildEverywhereCabinetLayout().filter(c=>c.z<=EVERYWHERE_REAR_DEPTH+.05)
    expect(rear).toHaveLength(117)
    expect(manifest.cameras?.[0]?.minAspect).toBeUndefined()
    // Ray/rounded cabinet front-plane intersection; use the un-beveled lip
    // footprint, not a loose bounding box. Test the maximum wall roll and push.
    for (const aspect of [.45,9/16,1,1.2,1.5,16/9,1.9,21/9,32/9,4]) {
      const cover=everywhereWallCoverScale(aspect)
      for (const [roll,push] of [[-.01,0],[.01,.42]] as const) {
        let missing=0
        for (let iy=0;iy<=40;iy++) for (let ix=0;ix<=60;ix++) {
          const rx=(ix/30-1)*Math.tan(Math.PI/9)*aspect
          const ry=(iy/20-1)*Math.tan(Math.PI/9)
          const hit=rear.some(c=>{
            const d=10.8-(c.z+.145*c.scale+push)
            const x=(rx*d*Math.cos(roll)+ry*d*Math.sin(roll))/cover-c.x
            const y=(-rx*d*Math.sin(roll)+ry*d*Math.cos(roll))/cover-c.y
            const dx=Math.abs(x)/c.scale-(.99-.153)
            const dy=Math.abs(y)/c.scale-(.725-.153)
            return Math.hypot(Math.max(dx,0),Math.max(dy,0))+Math.min(Math.max(dx,dy),0)<=.153
          })
          if (!hit) missing++
        }
        expect(missing, `aspect=${aspect}, roll=${roll}, push=${push}`).toBe(0)
      }
    }
  })

  it('choreographs bounded synchronized gazes, actual blinks and rolls without a local clock', () => {
    const wall=buildEverywhereCabinetLayout()
    const look: EverywhereLook = {
      pattern:'all-eyes', phase:.22, brightness:1.06, coverage:.86, angle:.84, motion:.72,
      scan:.2, glare:.65, layout:'repeat', colors: { background:[0,0,0,1],cabinet:[.2,.2,.2,1],cool:[0,1,1,1],warm:[1,.5,.2,1],screen:[1,1,1,1] },
      energy:0,bass:0,high:0,vocal:0,kick:0,snare:0,build:0,drop:0,
    }
    const pose=(i:number,changes:Partial<EverywhereLook>)=>everywhereEyePose(wall[i]!,i,{...look,...changes})
    expect(pose(0,{})).toEqual([0,0,0,0])
    expect(pose(0,{phase:1.22})[0]).toBeGreaterThan(.5)
    expect(pose(0,{phase:5.22})[0]).toBeLessThan(-.5)
    expect(pose(0,{phase:2.48})[2]).toBeCloseTo(1)
    expect(pose(0,{phase:1.22})).toEqual(pose(12,{phase:1.22}))
    expect(pose(0,{phase:1.22,drop:1})[3]).toBeGreaterThan(.65)
    expect(pose(0,{phase:1.22,drop:1})[0]).toBe(0)
    expect(pose(0,{phase:1.22,kick:1})[2]).toBeGreaterThan(.6)
    expect(pose(0,{phase:5.22,drop:1,kick:1,motion:0})).toEqual([0,0,0,0])
    const programs=EVERYWHERE_PATTERNS.map(({value})=>Array.from({length:25},(_,i)=>pose(i,{pattern:value,phase:3.2})))
    expect(new Set(programs.map(value=>JSON.stringify(value))).size).toBe(12)
    for (const program of programs) for (const [x,y,b,r] of program) {
      expect([x,y,b,r].every(Number.isFinite)).toBe(true)
      expect(Math.abs(x)).toBeLessThanOrEqual(1); expect(Math.abs(y)).toBeLessThanOrEqual(1)
      expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(1)
      expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(1)
    }
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
