import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { RefractionScene, type RefractionLook } from '../modules/refraction/RefractionScene'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ManagedMediaResource } from '../media/Cinema2MediaSlotRuntime'
import { CINEMA2_REFRACTION_PRESET_MANIFEST as manifest } from '../presets/Cinema2RefractionPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS } from '../../react/canvasPerformance/CanvasPerformanceTypes'
import { REFRACTION_PATTERNS, REFRACTION_COLORS, PRISM_ANCHORS, opticalPath, prismPose, prismUv, type RefractionMotion } from '../modules/refraction/RefractionDomain'
import { RefractionPerformance } from '../modules/Cinema2RefractionNativeModule'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
const parameter=(name:string)=>manifest.parameters!.find(p=>p.id===`refraction-${name}`)!
const motion:RefractionMotion={pattern:'prism-rotation',phase:1.8,separation:.45,rotation:14,transmission:.75,roughness:.15,refraction:.25,intensity:.75,safe:true,readability:true,vocal:0,kick:0,snare:0,drop:0,bass:0,mid:0,build:0,downbeat:0,phrase:0,impact:0,high:0,energy:0,beat:0,edgeEmission:.4}
describe('REFRACTION native preset',()=>{
  it('compiles authored and covered manifests and uses canonical schema and triggers',()=>{
    for(const m of [manifest,withCinema2AutoCoverage(manifest,{exempt:CINEMA2_AUTO_COVERAGE_EXEMPT.refraction})]){
      expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest:m}).diagnostics).toEqual([])
      const result=compileCinema2NativePreset(m);expect(result.diagnostics).toEqual([]);expect(result.ok).toBe(true)
    }
    expect(new Set(manifest.parameters!.map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    expect(parameter('pattern').options).toEqual(REFRACTION_PATTERNS)
    expect(parameter('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(parameter('pool-trigger').options).toEqual(CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS)
    expect(parameter('pool-automation').defaultValue).toBe(false)
    expect(parameter('media-layout').defaultValue).toBe('grouped')
    expect(parameter('media-fit').defaultValue).toBe('contain')
    expect(manifest.mediaSlots?.[0]?.accepts).toEqual(['image','video'])
    expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette'&&p.type==='color')).toHaveLength(5)
  })
  it('assigns coherent continuous UVs and complete grouped apertures with valid channels',()=>{
    for(const grouping of ['front-mid-rear','upright-inverted'])for(const grouped of [true,false])for(let channels=1;channels<=3;channels++)for(let i=0;i<18;i++){
      const q=prismUv(i,grouping,grouped,channels,2)
      expect(q.x).toBeGreaterThanOrEqual(0);expect(q.y).toBeGreaterThanOrEqual(0);expect(q.x+q.w).toBeLessThanOrEqual(1+1e-8);expect(q.y+q.h).toBeLessThanOrEqual(1+1e-8);expect(q.channel).toBeLessThan(channels)
      if(grouped){expect(q.w).toBe(1);expect(q.h).toBe(1)}else expect(q.channel).toBe(2%channels)
    }
    expect(new Set(PRISM_ANCHORS.map((_,i)=>prismUv(i,'front-mid-rear',true,3,0).channel)).size).toBe(3)
  })
  it('produces six different bounded physical and optical pattern signatures',()=>{
    const signatures=REFRACTION_PATTERNS.map(({value})=>JSON.stringify(PRISM_ANCHORS.map((_,i)=>prismPose(i,{...motion,pattern:value}))))
    expect(new Set(signatures).size).toBe(6)
    for(const {value} of REFRACTION_PATTERNS)for(let i=0;i<18;i++)for(let n=0;n<60;n++){
      const p=prismPose(i,{...motion,pattern:value,phase:n*.2,separation:1,rotation:40,intensity:1,kick:1,snare:1,bass:1,drop:1})
      expect(Object.values(p).every(Number.isFinite)).toBe(true);expect(Math.abs(p.z)).toBeLessThanOrEqual(.8);expect(p.light).toBeGreaterThanOrEqual(0);expect(p.light).toBeLessThanOrEqual(1);expect(p.optical).toBeLessThanOrEqual(1)
    }
  })
  it('authors six distinct optical paths, bounded face crossings and a straight zero-refraction ray',()=>{
    const signatures=REFRACTION_PATTERNS.map(({value})=>JSON.stringify(PRISM_ANCHORS.map((_,i)=>opticalPath(i,{...motion,pattern:value}))))
    expect(new Set(signatures).size).toBe(6)
    for(const {value} of REFRACTION_PATTERNS)for(let i=0;i<18;i++)for(let n=0;n<40;n++){
      const p=opticalPath(i,{...motion,pattern:value,phase:n*.21,refraction:1,build:1,drop:1})
      for(const point of [p.source,p.entry,p.exit,p.primary,p.secondary])expect(point.every(Number.isFinite)).toBe(true)
      expect(Math.abs(p.entry[0])).toBeLessThanOrEqual(.36);expect(Math.abs(p.exit[0])).toBeLessThanOrEqual(.36)
      expect(Math.abs(p.entry[1])).toBeLessThanOrEqual(.30);expect(Math.abs(p.exit[1])).toBeLessThanOrEqual(.30)
      expect(p.source[2]).toBeLessThan(p.entry[2]);expect(p.exit[2]).toBeLessThan(p.primary[2]);expect(p.gain).toBeGreaterThan(0)
      const zero=opticalPath(i,{...motion,pattern:value,phase:n*.21,refraction:0})
      expect(zero.primary).toEqual(zero.secondary)
      for(const axis of [0,1] as const){
        const slope=(zero.entry[axis]-zero.source[axis])/(zero.entry[2]-zero.source[2])
        expect((zero.exit[axis]-zero.entry[axis])/(zero.exit[2]-zero.entry[2])).toBeCloseTo(slope)
        expect((zero.primary[axis]-zero.exit[axis])/(zero.primary[2]-zero.exit[2])).toBeCloseTo(slope)
      }
    }
    expect(opticalPath(0,{...motion,phase:1},true)).toEqual(opticalPath(0,{...motion,phase:4},true))
  })
  it('builds thick crystal shells, limits low quality beams and restores the procedural scene on media removal (CPU scene graph)',()=>{
    const root=new THREE.Group(),scene=new RefractionScene({THREE} as unknown as Cinema2ThreeLibrary,root)
    const look:RefractionLook={...motion,count:12,depth:.16,bevel:.025,spacing:1,locked:false,mode:'auto',visible:true,fit:'contain',layout:'grouped',grouping:'front-mid-rear',scale:1,offsetX:0,offsetY:0,angle:0,opacity:1,brightness:1,transition:0,reflection:.25,spill:.3,colors:REFRACTION_COLORS,dt:.05,paused:false}
    const crystal=root.getObjectByName('refraction-crystal-0') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshPhysicalMaterial>
    const screen=root.getObjectByName('refraction-media-0') as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>
    const ray=root.getObjectByName('refraction-ray-0-3')!,rearRay=root.getObjectByName('refraction-ray-8-2')!
    try{
      scene.apply(look,[],0,'high');expect(screen.visible).toBe(false);expect(crystal.material.transparent).toBe(true);expect(crystal.material.depthWrite).toBe(false)
      crystal.geometry.computeBoundingBox();expect(crystal.geometry.boundingBox!.getSize(new THREE.Vector3()).z*crystal.scale.z).toBeGreaterThan(1)
      expect(ray.visible).toBe(true);expect(rearRay.visible).toBe(true)
      scene.apply(look,[],0,'low');expect(rearRay.visible).toBe(false);expect(ray.visible).toBe(true);expect(crystal.material.forceSinglePass).toBe(true)
      const resource={texture:{},width:1920,height:1080} as unknown as Cinema2ManagedMediaResource
      scene.apply(look,[resource],0,'high');expect(screen.visible).toBe(true);expect(screen.material.transparent).toBe(true);expect(screen.material.uniforms.uAspect!.value.x).toBeCloseTo(16/9)
      expect(screen.material.uniforms.uFit!.value).toBe(0);expect(screen.material.uniforms.uOpacity!.value).toBe(1)
      scene.apply({...look,visible:false},[resource],0,'high');expect(screen.visible).toBe(false);expect(crystal.visible).toBe(true)
      scene.apply(look,[],0,'high');expect(screen.visible).toBe(false);expect(ray.visible).toBe(true)
      scene.apply({...look,edgeEmission:0},[],0,'high');expect(ray.visible).toBe(false)
    }finally{scene.dispose();expect(root.children).toHaveLength(0)}
  })
  it('honors zero optical, rotation and emission settings and vocal restraint',()=>{
    const p=prismPose(0,{...motion,refraction:0,edgeEmission:0,rotation:0,kick:1,high:1,mid:1})
    expect(p.optical).toBe(0);expect(p.light).toBe(0);expect(Math.abs(p.rx)+Math.abs(p.ry)).toBe(0)
    const a=prismPose(0,{...motion,pattern:'refraction'}),b=prismPose(0,{...motion,pattern:'refraction',vocal:1});expect(b.optical).toBeLessThan(a.optical)
  })
  it('manual selection and discontinuity reset phase without changing authored controls',()=>{
    const perf=new RefractionPerformance(i=>(i%7)/7),controls:Record<string,unknown>={pattern:'prism-rotation','pattern-change':false,'bpm-sync':true,'auto-performance':false}
    const update=(t:number,revision:number)=>perf.update({parameters:{get:(key:string)=>controls[key]},frame:{contextGeneration:1,elapsedTimeSec:t,deltaTimeSec:.05,transport:{trackId:'track',timeSec:t,playing:true,paused:false,animationActive:true,bpmSync:true,bpm:120,sourcePresent:true},audio:{upstream:{sourceId:'track',publisherId:'test',analysisRevision:1,timelineRevision:revision},rhythm:{fixedClocks:{4:{boundary:null}}},structure:{section:{value:null},semanticMoments:{available:false,value:null},analyzedPhrases:{available:false,value:null}},discontinuity:{generation:0}}}} as unknown as Cinema2ModuleUpdateContext)
    update(0,1);update(.05,1);expect(perf.look?.phase).toBeGreaterThan(0);controls.pattern='glass-relay';update(.1,1);expect(perf.look?.pattern).toBe('glass-relay');update(.15,2);expect(perf.look?.phase).toBe(0);expect(controls.pattern).toBe('glass-relay');expect(perf.inspect().patternControlsAutomatic).toBe(false)
  })
})
