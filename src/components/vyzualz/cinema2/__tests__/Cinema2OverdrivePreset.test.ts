import { describe, expect, it } from 'vitest'
import { CINEMA2_OVERDRIVE_PRESET_ID, CINEMA2_OVERDRIVE_PRESET_MANIFEST as manifest } from '../presets/Cinema2OverdrivePreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { Cinema2OverdrivePerformance, OverdrivePool } from '../modules/Cinema2OverdriveNativeModule'
import { DEFAULT_OVERDRIVE_LOOK, OVERDRIVE_PATTERNS, OVERDRIVE_POSES, overdriveAssemblyPose, overdriveBandRadius, overdriveFullColorGain, overdriveEnvironmentGain, overdriveInnerBankScale, OVERDRIVE_FOREGROUND_Z, OVERDRIVE_RIB_COUNT, OverdriveScene } from '../modules/overdrive/OverdriveScene'
import { normalizeOverdriveSpeaker, OVERDRIVE_SPEAKER_DIAMETER, OVERDRIVE_SPEAKER_FACE_Z } from '../modules/overdrive/OverdriveSpeakers'
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
  it('retains a shadow key and restrained reflections',()=>{
    expect(overdriveEnvironmentGain(DEFAULT_OVERDRIVE_LOOK)).toBeLessThan(.15)
    expect(overdriveEnvironmentGain({...DEFAULT_OVERDRIVE_LOOK,reflection:0})).toBe(0)
    expect(overdriveEnvironmentGain({...DEFAULT_OVERDRIVE_LOOK,pose:OVERDRIVE_POSES.blackout})).toBeLessThan(.02)
    expect(overdriveInnerBankScale(1)).toBe(1)
    expect(manifest.lighting?.lights[0]?.config?.threeShadow).toBe(true)
    expect(manifest.cameras?.[0]?.fovDegrees).toBe(46)
  })
  it('preserves the native +Z driver face and fits the circular mounting envelope',async()=>{
    const T=await import('three')
    const g=new T.CylinderGeometry(2,1,1,32)
    // The larger face is initially +Y; rotate it to native +Z like the bundled GLB.
    g.rotateX(Math.PI/2)
    const mesh=new T.Mesh(g,new T.MeshStandardMaterial());mesh.position.set(3,-2,4)
    const model=normalizeOverdriveSpeaker(T,mesh)
    const bounds=new T.Box3().setFromObject(model,true),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3())
    expect(size.x).toBeCloseTo(OVERDRIVE_SPEAKER_DIAMETER)
    expect(size.y).toBeCloseTo(OVERDRIVE_SPEAKER_DIAMETER)
    expect(center.x).toBeCloseTo(0);expect(center.y).toBeCloseTo(0)
    expect(bounds.max.z).toBeCloseTo(OVERDRIVE_SPEAKER_FACE_Z)
    // Outside the narrow rear cap, the ray must strike the broad front cap.
    model.updateMatrixWorld(true)
    const hit=new T.Raycaster(new T.Vector3(.5,0,2),new T.Vector3(0,0,-1)).intersectObject(model,true)[0]!
    expect(hit.point.z).toBeCloseTo(OVERDRIVE_SPEAKER_FACE_Z)
    g.dispose();mesh.material.dispose()
  })
  it('presents the real bundled speaker diaphragm, not its copper rear basket',async()=>{
    const T=await import('three')
    const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js')
    const {readFileSync}=await import('node:fs')
    const {resolve}=await import('node:path')
    const {disposeObject}=await import('../modules/three/Cinema2ThreeAssetCache')
    const bytes=readFileSync(resolve(process.cwd(),'src/components/vyzualz/cinema2/modules/overdrive/speaker.glb'))
    const {scene}=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'')
    try{
      const model=normalizeOverdriveSpeaker(T,scene)
      model.updateMatrixWorld(true)
      const frontMaterial=(x:number)=>{
        const hit=new T.Raycaster(new T.Vector3(x,0,2),new T.Vector3(0,0,-1)).intersectObject(model,true)[0]
        expect(hit).toBeDefined()
        const material=(hit!.object as import('three').Mesh).material
        return (Array.isArray(material)?material[hit!.face?.materialIndex??0]:material)?.name
      }
      // These two rays strike the authored black dust cap and grey diaphragm.
      // Reversing the driver exposes the copper motor/basket in front of them.
      expect(frontMaterial(.2)).toBe('Black')
      expect(frontMaterial(.3)).toBe('Grey')
      const bounds=new T.Box3().setFromObject(model,true)
      expect(bounds.max.z).toBeCloseTo(OVERDRIVE_SPEAKER_FACE_Z)
    }finally{disposeObject(scene)}
  })
  it('uses the same model in all ten driver instances, shares resources, retains pulse motion and keeps the core stable',async()=>{
    const THREE=await import('three')
    const {mergeGeometries}=await import('three/examples/jsm/utils/BufferGeometryUtils.js')
    const root=new THREE.Group()
    const scene=new OverdriveScene({THREE} as unknown as Cinema2ThreeLibrary,mergeGeometries,root)
    const material=new THREE.MeshStandardMaterial({color:0x999999})
    const g=new THREE.CylinderGeometry(1,1,.3,16).rotateX(Math.PI/2)
    const source=new THREE.Group();source.add(new THREE.Mesh(g,material))
    let disposals=0;g.addEventListener('dispose',()=>disposals++)
    try{
      expect(scene.speakersReady).toBe(false)
      scene.installSpeakers(source);expect(scene.speakersReady).toBe(true)
      const objects=(name:string)=>{const found:import('three').Object3D[]=[];root.traverse(o=>{if(o.name===name)found.push(o)});return found}
      scene.apply(DEFAULT_OVERDRIVE_LOOK,null,'high',16/9)
      root.updateMatrixWorld(true)
      const arms=objects('overdrive-acoustic-assembly')
      const pulses=objects('overdrive-speaker-pulse')
      expect(arms).toHaveLength(10);expect(pulses).toHaveLength(10)
      expect(pulses.map(p=>p.children[0]!.name)).toEqual(Array(10).fill('overdrive-speaker'))
      expect(objects('overdrive-recessed-diaphragm')).toHaveLength(0)
      expect(new Set(pulses.map(p=>p.children[0])).size).toBe(10)
      pulses.forEach(pulse=>pulse.traverse(o=>{const mesh=o as import('three').Mesh;if(mesh.isMesh){expect(mesh.geometry).toBe(g);expect(mesh.material).toBe(material)}}))
      const rest=pulses[0]!.position.z
      scene.apply({...DEFAULT_OVERDRIVE_LOOK,kick:1},null,'high',16/9)
      expect(pulses[0]!.position.z).toBeGreaterThan(rest)
      scene.apply({...DEFAULT_OVERDRIVE_LOOK,motion:0,kick:1},null,'high',16/9)
      expect(pulses[0]!.position.z).toBe(0)
      const authored=material.color.clone()
      scene.apply({...DEFAULT_OVERDRIVE_LOOK,pose:OVERDRIVE_POSES.blackout},null,'high',16/9)
      expect(material.color.r).toBeLessThan(authored.r)
      scene.apply(DEFAULT_OVERDRIVE_LOOK,null,'high',16/9)
      expect(material.color.toArray()).toEqual(authored.toArray())
      expect(arms[0]!.position.z).toBeCloseTo(OVERDRIVE_FOREGROUND_Z,1)
      expect(objects('overdrive-core-rib')).toHaveLength(OVERDRIVE_RIB_COUNT)
      const core=objects('overdrive-led-surface')[0]!
      const before=core.getWorldScale(new THREE.Vector3()).toArray()
      scene.apply(DEFAULT_OVERDRIVE_LOOK,null,'low',32/9);root.updateMatrixWorld(true)
      expect(core.getWorldScale(new THREE.Vector3()).toArray()).toEqual(before)
    }finally{scene.dispose()}
    scene.dispose();expect(disposals).toBe(1);expect(root.children).toHaveLength(0)
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
