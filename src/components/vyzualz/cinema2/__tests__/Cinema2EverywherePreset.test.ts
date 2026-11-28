import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { OBB } from 'three/examples/jsm/math/OBB.js'
import { EVERYWHERE_CABINET_STYLES, buildEverywhereCabinetParts } from '../modules/everywhere/Cinema2EverywhereCabinets'
import { everywhereMediaPose } from '../modules/everywhere/Cinema2EverywhereMediaMotion'
import { afterEach, describe, expect, it } from 'vitest'
import { setAutoPerformanceUserDefault } from '../../../../lib/autoPerformanceDefault'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_EVERYWHERE_PRESET_ID, CINEMA2_EVERYWHERE_PRESET_MANIFEST } from '../presets/Cinema2EverywherePreset'
import { Cinema2EverywherePerformance } from '../modules/Cinema2EverywhereNativeModule'
import { buildEverywhereCabinetLayout, EVERYWHERE_PATTERNS, everywhereWallCoverScale, everywhereCabinetArticulation, everywhereEyeFraming, everywhereScreenGain, type EverywhereLook } from '../modules/everywhere/Cinema2EverywhereWall'
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
    expect(wall.length).toBeGreaterThan(40)
    expect(wall.length).toBeLessThanOrEqual(120)
    expect(Math.abs(wall[0]!.x)).toBeLessThan(.2)
    expect(wall[0]!.scale).toBeGreaterThan(Math.max(...wall.slice(1).map(c=>c.scale)))
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

  it('builds four genuinely different CRT carcasses and fits the glass inside each aperture', () => {
    const dimensions=EVERYWHERE_CABINET_STYLES.map(style=>{
      const parts=buildEverywhereCabinetParts(THREE,mergeGeometries,style)
      const bounds=new THREE.Box3()
      for(const {geometry} of parts) {
        geometry.computeBoundingBox()
        bounds.union(geometry.boundingBox!)
        expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
        expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
        geometry.dispose()
      }
      expect(bounds.min.z).toBeLessThan(-.9)
      expect(Math.abs(style.screenX)+style.screenW/2).toBeLessThan(style.w/2)
      expect(Math.abs(style.screenY)+style.screenH/2).toBeLessThan(style.h/2)
      return bounds.getSize(new THREE.Vector3()).toArray().map(n=>n.toFixed(2)).join('/')
    })
    expect(new Set(dimensions).size).toBe(4)
  })

  it('uses natural perspective, independent world positions, depth separation and distinct eye framing', () => {
    const wall=buildEverywhereCabinetLayout(), surrounding=wall.slice(1)
    expect(new Set(wall.map(c=>c.style)).size).toBe(4)
    expect(new Set(surrounding.map(c=>c.y.toFixed(1))).size).toBeGreaterThan(30)
    expect(Math.max(...wall.map(c=>c.z))-Math.min(...wall.map(c=>c.z))).toBeGreaterThan(9)
    expect(surrounding.some(c=>c.z>wall[0]!.z)).toBe(true)
    expect(surrounding.some(c=>c.z<-5)).toBe(true)
    expect(Math.max(...wall.map(c=>c.x))).toBeGreaterThan(15)
    expect(Math.min(...wall.map(c=>c.x))).toBeLessThan(-15)
    expect(everywhereWallCoverScale(32/9)).toBe(1)
    expect(manifest.cameras?.[0]?.minAspect).toBeUndefined()
    expect(everywhereEyeFraming(wall[0]!,0)).toEqual([1,0,0,0])
    expect(new Set(surrounding.map((c,i)=>JSON.stringify(everywhereEyeFraming(c,i+1)))).size).toBe(surrounding.length)
    // The projected size of the same physical cabinet must shrink with distance.
    const camera=new THREE.PerspectiveCamera(38,16/9,.2,60)
    camera.position.z=14;camera.updateMatrixWorld()
    const apparent=(z:number)=>new THREE.Vector3(1,0,z).project(camera).x-new THREE.Vector3(-1,0,z).project(camera).x
    expect(apparent(4)).toBeGreaterThan(apparent(-5)*1.8)
  })

  // Use the actual merged family geometry, including the glass bulge. A
  // hand-written box that ignores knobs, feet or extrusion bevels is unsafe.
  const localCabinetBounds=()=>EVERYWHERE_CABINET_STYLES.map(style=>{
    const bounds=new THREE.Box3()
    for(const {geometry} of buildEverywhereCabinetParts(THREE,mergeGeometries,style)) {
      geometry.computeBoundingBox()
      bounds.union(geometry.boundingBox!)
      geometry.dispose()
    }
    bounds.max.z=Math.max(bounds.max.z,style.screenZ+style.glassDepth)
    return bounds
  })
  const transform=(c:ReturnType<typeof buildEverywhereCabinetLayout>[number],angle:number)=>{
    const object=new THREE.Object3D()
    object.position.set(c.x,c.y,c.z)
    const a=everywhereCabinetArticulation(angle)
    object.rotation.set(c.pitch*a,c.yaw*a,c.roll*a)
    object.scale.set(c.scale*c.width,c.scale*c.height,c.scale*c.depth)
    object.updateMatrix()
    return object.matrix.clone()
  }

  it('keeps actual cabinet bounds disjoint throughout the Cabinet Angle control', () => {
    const wall=buildEverywhereCabinetLayout(), bounds=localCabinetBounds()
    for(const angle of Array.from({length:51},(_,i)=>i*.025)) {
      const boxes=wall.map(c=>{
        const b=bounds[c.style]!
        const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(c.pitch*everywhereCabinetArticulation(angle),c.yaw*everywhereCabinetArticulation(angle),c.roll*everywhereCabinetArticulation(angle)))
        const center=b.getCenter(new THREE.Vector3()).multiplyScalar(c.scale).applyMatrix4(rotation).add(new THREE.Vector3(c.x,c.y,c.z))
        const half=b.getSize(new THREE.Vector3()).multiplyScalar(c.scale/2)
        return new OBB(center,half,new THREE.Matrix3().setFromMatrix4(rotation))
      })
      for(let i=0;i<boxes.length;i++)for(let j=0;j<i;j++) {
        expect(boxes[i]!.intersectsOBB(boxes[j]!),`angle=${angle}, cabinets ${i}/${j}`).toBe(false)
      }
    }
  })

  it('keeps a dominant hero and dense projected geometry at supported camera distances and aspects',()=>{
    const wall=buildEverywhereCabinetLayout(), bounds=localCabinetBounds()
    const matrices=wall.map(c=>transform(c,.84)), inverses=matrices.map(m=>m.clone().invert())
    const camera=new THREE.PerspectiveCamera(38,16/9,.2,60)
    const point=new THREE.Vector3(), ray=new THREE.Ray(), localRay=new THREE.Ray()
    const update=(aspect:number,z:number)=>{
      camera.aspect=aspect;camera.position.set(0,0,z);camera.lookAt(0,0,0)
      camera.updateProjectionMatrix();camera.updateMatrixWorld(true)
    }
    update(16/9,14)
    const hero=new THREE.Box3(), b=bounds[wall[0]!.style]!
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]) {
      hero.expandByPoint(point.set(x,y,z).applyMatrix4(matrices[0]!).project(camera))
    }
    const size=hero.getSize(new THREE.Vector3())
    expect(size.x/2).toBeGreaterThan(.30);expect(size.x/2).toBeLessThan(.39)
    expect(size.y/2).toBeGreaterThan(.42);expect(size.y/2).toBeLessThan(.56)
    // Test projected cabinet carcasses, not padded bounding boxes. A tapered
    // frustum with inset corners is conservative for the actual bevels. Ray
    // intersections include actual sides and rear profile, not empty OBB space.
    const carcasses=EVERYWHERE_CABINET_STYLES.map(style=>{
      const ring=(w:number,h:number,z:number)=>[
        new THREE.Vector3(-w*.48,-h*.48,z),new THREE.Vector3(w*.48,-h*.48,z),
        new THREE.Vector3(w*.48,h*.48,z),new THREE.Vector3(-w*.48,h*.48,z),
      ]
      const v=[...ring(style.w,style.h,.10),...ring((style.w-.075)*style.taperX,(style.h-.075)*style.taperY,-style.depth)]
      const faces=[[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]
      return faces.flatMap(([a,b,c,d])=>[[v[a!]!,v[b!]!,v[c!]!],[v[a!]!,v[c!]!,v[d!]!]] as const)
    })
    const hit=new THREE.Vector3()
    for(const z of [12.3,14,15])for(const aspect of [9/16,1,16/9,32/9]) {
      update(aspect,z)
      let hits=0
      const columns=64, rows=36
      for(let y=0;y<rows;y++)for(let x=0;x<columns;x++) {
        point.set(2*(x+.5)/columns-1,2*(y+.5)/rows-1,.5).unproject(camera)
        ray.set(camera.position,point.sub(camera.position).normalize())
        if(wall.some((c,i)=>{
          localRay.copy(ray).applyMatrix4(inverses[i]!)
          if(!localRay.intersectsBox(bounds[c.style]!))return false
          return carcasses[c.style]!.some(([a,b,c])=>localRay.intersectTriangle(a,b,c,false,hit)!==null)
        })) hits++
      }
      expect(hits/(columns*rows),`aspect=${aspect}, camera=${z}`).toBeGreaterThan(z===15?.86:.90)
    }
    expect(everywhereCabinetArticulation(0)).toBeGreaterThan(.5)
    expect(everywhereCabinetArticulation(1.25)).toBeGreaterThan(everywhereCabinetArticulation(0))
    expect(wall.slice(1,6).filter(c=>Math.abs(c.yaw)>.60).length).toBeGreaterThanOrEqual(3)
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
    const camera=manifest.cameras![0]!
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
