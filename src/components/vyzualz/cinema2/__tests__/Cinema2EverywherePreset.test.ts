import { everywhereMediaPose } from '../modules/everywhere/Cinema2EverywhereMediaMotion'
import { afterEach, describe, expect, it } from 'vitest'
import { setAutoPerformanceUserDefault } from '../../../../lib/autoPerformanceDefault'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_EVERYWHERE_PRESET_ID, CINEMA2_EVERYWHERE_PRESET_MANIFEST } from '../presets/Cinema2EverywherePreset'
import { Cinema2EverywherePerformance } from '../modules/Cinema2EverywhereNativeModule'
import { buildEverywhereCabinetLayout, EVERYWHERE_PATTERNS, everywhereWallCoverScale, everywhereScreenGain, type EverywhereLook } from '../modules/everywhere/Cinema2EverywhereWall'
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

  it('builds a deterministic spatial wall with a prominent hero and distinct screen programs', () => {
    const wall = buildEverywhereCabinetLayout()
    expect(wall).toHaveLength(92)
    expect(wall[0]).toMatchObject({ x: 0, scale: 2.65 })
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

  it('keeps a varied curved installation, deliberate seams and wide framing instead of a rear tile grid', () => {
    const wall=buildEverywhereCabinetLayout()
    const surrounding=wall.slice(1)
    expect(new Set(surrounding.map(c=>c.style)).size).toBe(3)
    expect(new Set(surrounding.map(c=>c.z.toFixed(2))).size).toBeGreaterThan(65)
    expect(new Set(surrounding.map(c=>c.scale.toFixed(2))).size).toBeGreaterThan(30)
    expect(Math.max(...surrounding.map(c=>c.depth))-Math.min(...surrounding.map(c=>c.depth))).toBeGreaterThan(.5)
    expect(surrounding.every(c=>Math.abs(c.x)<3 || c.x*c.yaw<0)).toBe(true)
    expect(Math.max(...wall.map(c=>c.z))-Math.min(...wall.map(c=>c.z))).toBeGreaterThan(2.5)
    expect(Math.max(...wall.map(c=>c.x))).toBeGreaterThan(15)
    expect(Math.min(...wall.map(c=>c.x))).toBeLessThan(-15)
    expect(manifest.cameras?.[0]?.minAspect).toBeUndefined()
    // Project the actual front corners (XYZ Euler order, default Cabinet Angle).
    // This is a framing regression, not a pixel-perfect WebGL occlusion test.
    for (const aspect of [.45,9/16,1,16/9,1.9,21/9,32/9,4]) {
      const cover=everywhereWallCoverScale(aspect)
      for (const distance of [9,14,17]) {
        const polygons=wall.map(c=>{
          const [pitch,yaw,roll]=[c.pitch*.84,c.yaw*.84,c.roll*.84]
          return [[-1.04,-.78],[1.04,-.78],[1.04,.78],[-1.04,.78]].map(([px,py])=>{
            const x=px!*c.scale*c.width,y=py!*c.scale*c.height,z=.18*c.scale*c.depth
            const rx=x*Math.cos(roll)-y*Math.sin(roll), ry=x*Math.sin(roll)+y*Math.cos(roll)
            const yx=rx*Math.cos(yaw)+z*Math.sin(yaw), yz=-rx*Math.sin(yaw)+z*Math.cos(yaw)
            const wx=yx+c.x, wy=ry*Math.cos(pitch)-yz*Math.sin(pitch)+c.y
            const wz=ry*Math.sin(pitch)+yz*Math.cos(pitch)+c.z
            return [wx*cover/(distance-wz),wy*cover/(distance-wz)] as const
          })
        })
        const inside=(x:number,y:number,poly:typeof polygons[number])=>poly.every(([ax,ay],i)=>{
          const [bx,by]=poly[(i+1)%poly.length]!
          return (bx-ax)*(y-ay)-(by-ay)*(x-ax)>=0
        })
        let hits=0
        const fov=Math.tan(Math.PI/9)
        for(let iy=0;iy<25;iy++) for(let ix=0;ix<41;ix++) {
          const x=((ix+.5)/41*2-1)*fov*aspect,y=((iy+.5)/25*2-1)*fov
          if(polygons.some(poly=>inside(x,y,poly))) hits++
        }
        expect(inside(0,0,polygons[0]!)).toBe(true)
        expect(hits/(25*41),`aspect=${aspect}, distance=${distance}`).toBeGreaterThan(.55)
        // At the normal wide view, the installation must not become wallpaper.
        if(aspect===16/9 && distance===14) expect(hits/(25*41)).toBeLessThan(.90)
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

  it('gates the built-in eye by source mode and composites media against dark glass', () => {
    expect(EVERYWHERE_SCREEN_FRAGMENT).toContain('uSourceMode < .5 && uHasEye > .5')
    expect(EVERYWHERE_SCREEN_FRAGMENT).toContain('picture=vec3(.002,.003,.004)')
    expect(EVERYWHERE_SCREEN_FRAGMENT).toContain('result.a*=inside')
    expect(EVERYWHERE_SCREEN_FRAGMENT).toContain('uSourceMode > 1.5')
    expect(EVERYWHERE_SCREEN_FRAGMENT).toContain('mix(picture,linearColor(media.rgb)')
    expect(EVERYWHERE_SCREEN_FRAGMENT).toContain('glassAlpha')
  })

  it('authors distinct, bounded content programs for every screen and keeps the hero readable', () => {
    const wall=buildEverywhereCabinetLayout()
    const look={...new Cinema2EverywherePerformance(()=>.5).look,phase:4.2,layout:'choreographed' as const}
    const programs=EVERYWHERE_PATTERNS.map(({value})=>wall.map((cabinet,index)=>everywhereMediaPose(cabinet,index,{...look,pattern:value})))
    expect(new Set(programs.map(program=>JSON.stringify(program))).size).toBe(12)
    for(const program of programs) {
      expect(program[0]?.power).toBe(1)
      expect(program.some(pose=>pose.power===0)).toBe(true)
      expect(new Set(program.map(pose=>pose.scale)).size).toBeGreaterThan(1)
      for(const pose of program) {
        expect(Object.values(pose).every(Number.isFinite)).toBe(true)
        expect(pose.scale).toBeGreaterThanOrEqual(.45)
        expect(pose.scale).toBeLessThanOrEqual(1.6)
        expect([0,1,2]).toContain(pose.channel)
      }
    }
    expect(everywhereMediaPose(wall[20]!,20,{...look,motion:0})).toMatchObject({scale:1,x:0,y:0,rotation:0,power:1,distortion:0,stretch:1})
    expect(everywhereMediaPose(wall[20]!,20,{...look,screenPower:false}).power).toBe(1)
    expect(parameter('media-layout').options?.map(item=>item.value)).toEqual(['choreographed','repeat','wall'])
  })

  it('uses the shared camera, bounded dolly travel and all twelve authored camera profiles',()=>{
    const camera=manifest.cameras?.[0]!
    expect(camera.transform?.position).toEqual([0,0,14])
    expect(camera.controls?.motionEnabled?.$ref).toBe('everywhere-camera-motion')
    expect(camera.controls?.positionOffset?.$ref).toBe('everywhere-camera-distance')
    expect(camera.motion?.tempo?.weave).toBeGreaterThan(0)
    const rules=manifest.choreography?.rules??[]
    expect(rules.filter(rule=>rule.id.startsWith('everywhere-camera-track-'))).toHaveLength(12)
    expect(rules.find(rule=>rule.id==='everywhere-camera-drop')?.source.signal).toBe('drop')
    expect(rules.find(rule=>rule.id==='everywhere-camera-kick')?.enabledWhen).toContainEqual({kind:'parameter-equals',parameterId:'everywhere-kick-zoom',value:true})
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
