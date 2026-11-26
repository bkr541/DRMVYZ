import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ColossusScene } from '../modules/colossus/ColossusScene'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { CINEMA2_COLOSSUS_PRESET_MANIFEST as manifest } from '../presets/Cinema2ColossusPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { ARM_SURFACE_ALLOWANCE, COLOSSUS_CAMERA, COLOSSUS_FLOOR_Y, COLOSSUS_PALETTE, COLOSSUS_PATTERNS, HERO_EXCLUSION, colossusArmPose, type ArmInput } from '../modules/colossus/ColossusGeometry'
import { checkColossusProgramSeparation, checkColossusCamera, checkColossusTriggerAuthority, checkColossusAutoPerformance } from './support/ColossusMotionChecks'
import { ColossusPerformance } from '../modules/colossus/ColossusPerformance'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
const param=(name:string)=>manifest.parameters!.find(p=>p.id===`colossus-${name}`)!
const input:ArmInput={pattern:'assembly',phase:2.3,routePhase:.2,reach:.5,articulation:.5,piston:.4,jaw:.4,release:0,kick:0,snare:0,bass:0,mid:0,build:0,vocal:0,safety:1}

describe('COLOSSUS',()=>{
  it('separates all six reduced-motion trajectories and retargets without a discontinuity',()=>{checkColossusProgramSeparation()})
  it('drives the shared camera runtime from real choreography and respects permission and safety',()=>{checkColossusCamera()})
  it('uses shared Auto Performance build and drop overrides without changing saved controls',()=>{checkColossusAutoPerformance()})
  it('consumes two real shared drop events with manual takeover, pause and seek',()=>{checkColossusTriggerAuthority()})
  it('compiles both authored and production coverage with canonical source, pattern and Inspector contracts',()=>{
    const covered=withCinema2AutoCoverage(manifest,{exempt:CINEMA2_AUTO_COVERAGE_EXEMPT.colossus})
    for(const m of [manifest,covered]){
      expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest:m}).diagnostics).toEqual([])
      expect(compileCinema2NativePreset(m).diagnostics).toEqual([])
      expect(new Set(m.parameters!.filter(p=>p.designParentGroup).map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
      expect(m.modules![0].config?.userModel).toMatchObject({node:null,neutralFloor:false})
      expect(m.modules![0].parameterBindings?.userModel.$ref).toBe('colossus-model')
      expect(m.choreography!.rules!.filter(r=>String(r.id).includes('mood')||String(r.id).includes('cover')).flatMap(r=>r.actions).some(a=>a.target.kind==='module'&&/^model-(scale|x|y|z|yaw|pitch|roll)$/.test(a.target.property))).toBe(false)
    }
    expect(param('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(param('pattern').options).toEqual(COLOSSUS_PATTERNS)
    expect(param('pattern-change').metadata?.moodPolicy).toBe('patternChange')
    expect(param('model')).toMatchObject({exposure:'hidden',metadata:{editor:'user-model-selector'}})
    expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette'&&p.type==='color')).toHaveLength(5)
  })
  it('keeps all links and end tools outside the maximum hero exclusion radius',()=>{
    for(const {value} of COLOSSUS_PATTERNS)for(let arm=0;arm<4;arm++)for(let phase=0;phase<16;phase+=.25)for(const amount of [0,.5,1]){
      const pose=colossusArmPose(arm,{...input,pattern:value,phase,reach:amount,articulation:amount,piston:amount,jaw:amount,release:amount,kick:amount,snare:amount,bass:amount,mid:amount,build:amount})
      const joints=[pose.shoulder,pose.elbow,pose.tip]
      for(let i=0;i<2;i++)for(let k=0;k<=10;k++){const a=joints[i]!,b=joints[i+1]!,t=k/10;expect(Math.hypot(...a.map((x,j)=>x+(b[j]!-x)*t))-ARM_SURFACE_ALLOWANCE).toBeGreaterThan(HERO_EXCLUSION)}
    }
  })
  it('keeps blended native poses clear of the hero and the expanded floor',()=>{
    for(const {value} of COLOSSUS_PATTERNS)for(const {value:previousPattern} of COLOSSUS_PATTERNS)for(let arm=0;arm<4;arm++)for(const blend of [0,.25,.5,.75,1]){
      const pose=colossusArmPose(arm,{...input,pattern:value,previousPattern,blend,phase:5.4,reach:1,articulation:1,piston:1,jaw:1,kick:1,bass:1,build:1})
      for(const point of [pose.shoulder,pose.elbow,pose.tip]){
        expect(Math.hypot(...point)-ARM_SURFACE_ALLOWANCE).toBeGreaterThan(HERO_EXCLUSION)
        // The shoulder is a fixed attachment inside its side tower; the mobile links must clear the deck.
        if(point!==pose.shoulder)expect(point[1]-ARM_SURFACE_ALLOWANCE).toBeGreaterThan(COLOSSUS_FLOOR_Y)
      }
    }
  })
  it('contains the conservative hero volume throughout the shared camera safety envelope',()=>{
    const camera=new THREE.PerspectiveCamera(COLOSSUS_CAMERA.minFovDegrees,16/9,.12,65)
    const sphere=new THREE.Sphere(new THREE.Vector3(),HERO_EXCLUSION/1.15)
    for(const x of [COLOSSUS_CAMERA.minPosition[0],COLOSSUS_CAMERA.maxPosition[0]])for(const y of [COLOSSUS_CAMERA.minPosition[1],COLOSSUS_CAMERA.maxPosition[1]])for(const z of [COLOSSUS_CAMERA.minPosition[2],COLOSSUS_CAMERA.maxPosition[2]])for(const offset of [-.08,.08]){
      camera.position.set(x,y,z);camera.lookAt(offset,COLOSSUS_CAMERA.target[1]+offset,offset);camera.updateMatrixWorld(true)
      const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse))
      for(const plane of frustum.planes)expect(plane.distanceToPoint(sphere.center)).toBeGreaterThan(sphere.radius)
    }
  })
  it('uses actual native scene geometry, preserves private model materials and scales detail by tier',()=>{
    const root=new THREE.Group(),scene=new ColossusScene({THREE} as Cinema2ThreeLibrary,root)
    const values:Record<string,number>={'model-scale':1.2,'model-x':.2,'model-y':.2,'model-z':.2,'model-yaw':90,'model-pitch':25,'model-roll':20}
    const p={n:(key:string,fallback:number)=>values[key]??fallback,text:(_key:string,fallback:string)=>fallback,on:()=>true,color:(key:keyof typeof COLOSSUS_PALETTE)=>COLOSSUS_PALETTE[key]}
    const defaultHero=root.getObjectByName('colossus-default-hero')!,tool=root.getObjectByName('colossus-tool-0')!
    const camera=new THREE.PerspectiveCamera(COLOSSUS_CAMERA.fovDegrees,16/9,.12,65)
    camera.position.set(...COLOSSUS_CAMERA.position);camera.lookAt(...COLOSSUS_CAMERA.target);camera.updateMatrixWorld(true)
    const countVisibleMeshes=()=>{let count=0;root.traverseVisible(o=>{if((o as THREE.Mesh).isMesh)count++});return count}
    const assertFits=(model:THREE.Object3D)=>{root.updateMatrixWorld(true);model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const projected=new THREE.Vector3(x,y,z).project(camera);expect(Math.abs(projected.x)).toBeLessThan(1);expect(Math.abs(projected.y)).toBeLessThan(1)
    }}
    scene.apply(p,input,0,0,'high');const idle=tool.position.clone(),high=countVisibleMeshes();assertFits(defaultHero)
    expect(scene.estimateAdditionalGpuBytes()).toBeGreaterThan(0)
    let instanceBatches=0;root.traverse(o=>{if((o as THREE.InstancedMesh).isInstancedMesh)instanceBatches++});expect(instanceBatches).toBeGreaterThan(30)
    scene.apply(p,{...input,build:1},3,.5,'medium');const medium=countVisibleMeshes(),build=tool.position.clone();expect(build.distanceTo(idle)).toBeGreaterThan(.01)
    scene.apply(p,{...input,pattern:'impact',release:1},6,.75,'low');expect(tool.position.distanceTo(build)).toBeGreaterThan(.01);expect(countVisibleMeshes()).toBeLessThan(medium);expect(medium).toBeLessThan(high)
    for(const dims of [[10,1,2],[1,12,2]] as const){
      const geometry=new THREE.BoxGeometry(dims[0],dims[1],dims[2]),material=new THREE.MeshStandardMaterial({color:0x9a374f,metalness:.21,roughness:.74,emissive:0x112233,emissiveIntensity:.12})
      const model=new THREE.Mesh(geometry,material);model.position.set(3,-7,2);root.add(model);scene.attachModel(model)
      scene.apply(p,input,2,.2,'high');assertFits(model);expect(defaultHero.visible).toBe(false);expect(model.visible).toBe(true);expect(material.color.getHex()).toBe(0x9a374f);expect(material.metalness).toBe(.21);expect(material.roughness).toBe(.74);expect(material.emissive.getHex()).toBe(0x112233)
      scene.detachModel(model);root.remove(model);geometry.dispose();material.dispose()
    }
    scene.apply(p,input,0,0,'low');expect(defaultHero.visible).toBe(true);scene.dispose();scene.dispose()
  })
  it('has six distinct poses, a bounded release and a hard motion lock',()=>{
    const signatures=COLOSSUS_PATTERNS.map(({value})=>JSON.stringify([0,1,2,3].map(i=>colossusArmPose(i,{...input,pattern:value}))))
    expect(new Set(signatures).size).toBe(6)
    const p=colossusArmPose(0,input),drop=colossusArmPose(0,{...input,release:1})
    expect(Math.hypot(...drop.tip)).toBeGreaterThan(Math.hypot(...p.tip))
    expect(colossusArmPose(0,{...input,safety:0,phase:0}).tip).toEqual(colossusArmPose(0,{...input,safety:0,phase:10,pattern:'impact',kick:1}).tip)
  })
  it('applies manual pattern edits, pauses phase and resets on track replacement',()=>{
    const perf=new ColossusPerformance(i=>(i%7)/7),values:Record<string,unknown>={pattern:'assembly','bpm-sync':true,'pattern-change':false,'auto-performance':false}
    const update=(time:number,paused=false,trackId='track')=>perf.update({parameters:{get:(key:string)=>values[key]},frame:{contextGeneration:1,frameId:Math.round(time*60),timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:.05,audio:null,director:null,mood:null,transport:{trackId,timeSec:time,playing:!paused,paused,animationActive:!paused,bpmSync:true,bpm:120,sourcePresent:true}}} as unknown as Cinema2ModuleUpdateContext)
    update(0);update(.05);expect(perf.phase).toBeGreaterThan(0)
    values.pattern='separation';update(.1);expect(perf.pattern).toBe('separation');expect(perf.patternBlend).toBeLessThan(1);expect(perf.basePattern).toBe('separation')
    const phase=perf.phase;update(.15,true);expect(perf.phase).toBe(phase)
    update(.2,false,'new');expect(perf.phase).toBe(0)
  })
})
