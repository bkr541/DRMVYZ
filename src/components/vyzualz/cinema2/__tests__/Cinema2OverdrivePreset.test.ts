import { describe, expect, it } from 'vitest'
import { CINEMA2_OVERDRIVE_PRESET_ID, CINEMA2_OVERDRIVE_PRESET_MANIFEST as manifest } from '../presets/Cinema2OverdrivePreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { Cinema2OverdrivePerformance, OverdrivePool } from '../modules/Cinema2OverdriveNativeModule'
import { DEFAULT_OVERDRIVE_LOOK, OVERDRIVE_PATTERNS, OVERDRIVE_POSES, overdriveAssemblyPose, overdriveBandRadius, overdriveFullColorGain, overdriveEnvironmentGain, overdriveInnerBankScale, OVERDRIVE_FOREGROUND_Z, OVERDRIVE_RIB_COUNT, OVERDRIVE_CONE_PROFILE, OverdriveScene } from '../modules/overdrive/OverdriveScene'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2MediaSlotRuntime, Cinema2MediaSource } from '../media/Cinema2MediaSlotRuntime'

const parameter=(name:string)=>manifest.parameters!.find(p=>p.id===`overdrive-${name}`)!
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
describe('OVERDRIVE',()=>{
  it('compiles the authored and catalog-coverage manifests with four Inspector groups and canonical triggers',()=>{
    expect(manifest.id).toBe(CINEMA2_OVERDRIVE_PRESET_ID)
    expect(validateCinema2PresetAuthoringConventions({role:'keeper',manifest}).diagnostics).toEqual([])
    for(const value of [manifest,withCinema2AutoCoverage(manifest)]){const result=compileCinema2NativePreset(value);expect(result.diagnostics).toEqual([]);expect(result.ok).toBe(true)}
    expect(new Set(manifest.parameters!.map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    expect(parameter('pattern').options).toHaveLength(12)
    expect(parameter('pattern-change')).toMatchObject({defaultValue:false,metadata:{moodPolicy:'patternChange'}})
    expect(parameter('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(parameter('auto-performance').metadata?.moodPolicy).toBe('autoPerformance')
  })
  it('keeps Full Color source exposure independent of reactive pose gain except authored Blackout',()=>{
    for(const {value} of OVERDRIVE_PATTERNS){
      const look={...DEFAULT_OVERDRIVE_LOOK,brightness:1,pattern:value,pose:OVERDRIVE_POSES[value]}
      expect(overdriveFullColorGain(look)).toBe(value==='blackout'?look.pose[7]:1)
      expect(overdriveFullColorGain({...look,brightness:0})).toBe(0)
    }
    expect(overdriveFullColorGain({...DEFAULT_OVERDRIVE_LOOK,brightness:.5})).toBe(.5)
  })
  it('has twelve distinct finite mechanical poses, a spherical profile and bounded kick displacement',()=>{
    expect(new Set(OVERDRIVE_PATTERNS.map(p=>JSON.stringify(OVERDRIVE_POSES[p.value]))).size).toBe(12)
    expect(overdriveBandRadius(0)).toBeCloseTo(1.46)
    expect(overdriveBandRadius(1.425)).toBeLessThan(.35)
    for(const {value} of OVERDRIVE_PATTERNS)for(let i=0;i<10;i++){
      const pose=overdriveAssemblyPose(i,{...DEFAULT_OVERDRIVE_LOOK,pose:OVERDRIVE_POSES[value],phase:3.1,bass:1,kick:1,drop:1})
      expect(Object.values(pose).every(Number.isFinite)).toBe(true)
      expect(pose.radial).toBeGreaterThan(2)
    }
    const base=overdriveAssemblyPose(0,DEFAULT_OVERDRIVE_LOOK)
    expect(overdriveAssemblyPose(0,{...DEFAULT_OVERDRIVE_LOOK,kick:1}).cone).toBeGreaterThan(base.cone)
    expect(overdriveAssemblyPose(0,{...DEFAULT_OVERDRIVE_LOOK,motion:0,kick:1}).cone).toBe(0)
  })
  it('authors a recessed front-facing cone, a shadow key and restrained reflections',()=>{
    expect(OVERDRIVE_CONE_PROFILE[0][1]-OVERDRIVE_CONE_PROFILE[7][1]).toBeGreaterThan(.3)
    expect(OVERDRIVE_CONE_PROFILE[0][0]).toBeGreaterThan(OVERDRIVE_CONE_PROFILE[OVERDRIVE_CONE_PROFILE.length-1]![0])
    expect(overdriveEnvironmentGain(DEFAULT_OVERDRIVE_LOOK)).toBeLessThan(.15)
    expect(overdriveEnvironmentGain({...DEFAULT_OVERDRIVE_LOOK,reflection:0})).toBe(0)
    expect(overdriveEnvironmentGain({...DEFAULT_OVERDRIVE_LOOK,pose:OVERDRIVE_POSES.blackout})).toBeLessThan(.02)
    expect(overdriveInnerBankScale(1)).toBe(1)
    expect(manifest.lighting?.lights[0]?.config?.threeShadow).toBe(true)
    expect(manifest.cameras?.[0]?.fovDegrees).toBe(46)
  })
  it('constructs real reusable meshes with axial depth, visible cones and a stable core at different aspects',async()=>{
    const THREE=await import('three')
    const {mergeGeometries}=await import('three/examples/jsm/utils/BufferGeometryUtils.js')
    const root=new THREE.Group()
    const scene=new OverdriveScene({THREE} as unknown as Cinema2ThreeLibrary,mergeGeometries,root)
    try{
      const objects=(name:string)=>{const found:import('three').Object3D[]=[];root.traverse(o=>{if(o.name===name)found.push(o)});return found}
      scene.apply(DEFAULT_OVERDRIVE_LOOK,null,'high',16/9)
      root.updateMatrixWorld(true)
      const arms=objects('overdrive-acoustic-assembly')
      const cones=objects('overdrive-recessed-diaphragm') as import('three').Mesh[]
      expect(arms).toHaveLength(10);expect(cones).toHaveLength(10)
      expect(new Set(cones.map(c=>c.geometry)).size).toBe(1)
      expect(arms[0]!.position.z).toBeCloseTo(OVERDRIVE_FOREGROUND_Z,1)
      expect(objects('overdrive-core-rib')).toHaveLength(OVERDRIVE_RIB_COUNT)
      const core=objects('overdrive-led-surface')[0]!
      const before=core.getWorldScale(new THREE.Vector3()).toArray()
      scene.apply(DEFAULT_OVERDRIVE_LOOK,null,'low',32/9);root.updateMatrixWorld(true)
      expect(core.getWorldScale(new THREE.Vector3()).toArray()).toEqual(before)
      // Front-side raycast catches inverted lathe winding (the previous profile faced backwards).
      const cone=cones[0]!,world=cone.localToWorld(new THREE.Vector3(.25,0,1.5))
      const direction=new THREE.Vector3(0,0,-1).transformDirection(cone.matrixWorld)
      expect(new THREE.Raycaster(world,direction).intersectObject(cone).length).toBeGreaterThan(0)
    }finally{scene.dispose()}
    expect(root.children).toHaveLength(0)
  })
  it('honors manual pattern edits and resets phase on timeline revisions',()=>{
    const perf=new Cinema2OverdrivePerformance(i=>(i%7)/7)
    const controls:Record<string,unknown>={pattern:'core-lock',bpmSync:true,autoPerformance:false,patternChange:false}
    const update=(time:number,revision:number)=>perf.update({parameters:{get:(name:string)=>controls[name]},frame:{contextGeneration:1,elapsedTimeSec:time,deltaTimeSec:.05,transport:{trackId:'track',timeSec:time,playing:true,paused:false,animationActive:true,bpmSync:true,bpm:120,sourcePresent:true},audio:{upstream:{sourceId:'track',publisherId:'test',analysisRevision:1,timelineRevision:revision},rhythm:{fixedClocks:{4:{boundary:null}}},discontinuity:{generation:0}}}} as unknown as Cinema2ModuleUpdateContext)
    update(0,1);update(.05,1);expect(perf.look.phase).toBeGreaterThan(0)
    controls.pattern='iris';update(.1,1);expect(perf.look.pattern).toBe('iris')
    update(.15,2);expect(perf.look.phase).toBe(0)
  })
  it('advances the single pool channel once per musical event and clears when disabled',async()=>{
    const seen:string[]=[];const slots={remove:()=>{},replace:async(_slot:string,source:Cinema2MediaSource)=>{seen.push(source.id)},getManagedResource:()=>null,updateVideoTextures:()=>{},dispose:()=>{}} as unknown as Cinema2MediaSlotRuntime
    const pool=new OverdrivePool({getSelection:()=>({id:'p',mediaIds:['a','b','a']}),resolve:async id=>({id,label:id,kind:'image',url:`https://example.test/${id}.png`})},slots)
    pool.update('track','0',true,false,true);await flush();expect(seen).toEqual(['a'])
    pool.update('track','1',false,false,true);await flush();expect(seen).toEqual(['a','b'])
    pool.update('track','1',false,false,true);await flush();expect(seen).toEqual(['a','b'])
    pool.update('track','2',false,false,false);await flush();expect(seen).toEqual(['a','b']);pool.dispose()
  })
})
