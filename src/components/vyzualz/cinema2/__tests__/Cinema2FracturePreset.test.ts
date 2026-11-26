import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { FractureScene, type FractureLook } from '../modules/fracture/FractureScene'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ManagedMediaResource } from '../media/Cinema2MediaSlotRuntime'
import { CINEMA2_FRACTURE_PRESET_MANIFEST as manifest } from '../presets/Cinema2FracturePreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS } from '../../react/canvasPerformance/CanvasPerformanceTypes'
import { FRACTURE_PATTERNS, FRACTURE_COLORS, PANEL_WIDTH, PANEL_HEIGHT, tessellate, polygonArea, insetPolygon, shardPose, ruptureField, ruptureEnvelope, obsidianRest, type FractureMotion } from '../modules/fracture/FractureDomain'
import { FracturePerformance } from '../modules/Cinema2FractureNativeModule'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
const parameter=(name:string)=>manifest.parameters!.find(p=>p.id===`fracture-${name}`)!
const motion:FractureMotion={pattern:'fracture',phase:1.8,spread:.5,depthTravel:.45,rotation:25,reassemblyTime:1.1,active:true,intensity:.75,safe:true,locked:false,readability:true,vocal:0,kick:0,snare:0,drop:0,bass:0,mid:0,build:0,downbeat:0,phrase:0,impact:0,high:0,energy:0,beat:0,crackEmission:.45}
describe('FRACTURE native preset',()=>{
  it('compiles authored and covered manifests and uses canonical schema and triggers',()=>{
    for(const m of [manifest,withCinema2AutoCoverage(manifest,{exempt:CINEMA2_AUTO_COVERAGE_EXEMPT.fracture})]){
      expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest:m}).diagnostics).toEqual([])
      const result=compileCinema2NativePreset(m);expect(result.diagnostics).toEqual([]);expect(result.ok).toBe(true)
    }
    expect(new Set(manifest.parameters!.map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    expect(parameter('pattern').options).toEqual(FRACTURE_PATTERNS)
    expect(parameter('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(parameter('pool-trigger').options).toEqual(CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS)
    expect(parameter('pool-automation').defaultValue).toBe(false)
    expect(parameter('media-layout').defaultValue).toBe('continuous')
    expect(manifest.mediaSlots?.[0]?.accepts).toEqual(['image','video'])
    expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette'&&p.type==='color')).toHaveLength(5)
  })
  it('partitions the whole rest rectangle for all supported counts, with deterministic shared adjacency',()=>{
    for(let count=16;count<=120;count++)for(const seed of [0,17,65535]){
      const shards=tessellate(count,seed);expect(shards).toHaveLength(count);expect(shards).toEqual(tessellate(count,seed))
      expect(shards.reduce((sum,s)=>sum+polygonArea(s.polygon),0)).toBeCloseTo(36,7)
      for(const shard of shards){expect(shard.route).toBeGreaterThanOrEqual(0);expect(polygonArea(shard.polygon)).toBeGreaterThan(.01);expect(polygonArea(insetPolygon(shard,.16))).toBeGreaterThan(0);for(const id of shard.neighbors)expect(shards[id]!.neighbors).toContain(shard.id);for(const p of shard.polygon){expect(Math.abs(p.x)).toBeLessThanOrEqual(4+1e-8);expect(Math.abs(p.y)).toBeLessThanOrEqual(2.25+1e-8)}}
    }
  })
  it('produces six distinct bounded shard programs and exact idle targets',()=>{
    const shards=tessellate(48,17);const signatures=FRACTURE_PATTERNS.map(({value})=>JSON.stringify(shards.map(s=>shardPose(s,{...motion,pattern:value}))))
    expect(new Set(signatures).size).toBe(6)
    for(const {value} of FRACTURE_PATTERNS)for(const s of shards)for(let i=0;i<60;i++){
      const p=shardPose(s,{...motion,pattern:value,phase:i*Math.PI/30,spread:1,depthTravel:1,rotation:70,intensity:1,kick:1,drop:1,mid:1,safe:false,readability:false});expect(Object.values(p).every(Number.isFinite)).toBe(true);expect(Math.abs(p.x)).toBeLessThanOrEqual(1.65);expect(Math.abs(p.y)).toBeLessThanOrEqual(1.05);expect(Math.abs(p.z)).toBeLessThanOrEqual(2.65);expect(p.light).toBeLessThanOrEqual(1)
    }
    for(const s of shards){const p=shardPose(s,{...motion,active:false,drop:1});expect(Math.abs(p.x)+Math.abs(p.y)+Math.abs(p.z)+Math.abs(p.rx)+Math.abs(p.ry)+Math.abs(p.rz)).toBe(0)}
  })
  it('creates three deterministic depth layers with irregular geometry outside the intact media plane',()=>{
    const field=ruptureField(17);expect(field).toEqual(ruptureField(17));expect(field).not.toEqual(ruptureField(18));expect(field).toHaveLength(36)
    expect(new Set(field.map(f=>f.layer)).size).toBe(3)
    expect(field.some(f=>f.z>0)).toBe(true);expect(field.some(f=>f.z<-6)).toBe(true)
    expect(field.every(f=>Math.abs(f.x)>4.9&&f.thickness>0)).toBe(true)
    expect(field.filter(f=>f.lit).length).toBeLessThan(field.length/2)
    expect(new Set(tessellate(48,17).map(s=>obsidianRest(s).z)).size).toBeGreaterThan(20)
  })
  it('has intact, cracking, separated, suspended and restored stages, with shared musical overrides',()=>{
    expect(ruptureEnvelope(0)).toEqual({crack:0,open:0,suspend:0})
    expect(ruptureEnvelope(.20).crack).toBeGreaterThan(0);expect(ruptureEnvelope(.20).open).toBe(0)
    expect(ruptureEnvelope(.40).open).toBeGreaterThan(0);expect(ruptureEnvelope(.60).suspend).toBe(1)
    expect(ruptureEnvelope(.98)).toEqual({crack:0,open:0,suspend:0})
    const shards=tessellate(48,17),sample={...motion,phase:Math.PI*1.05}
    const signature=FRACTURE_PATTERNS.map(({value})=>JSON.stringify(shards.map(s=>{const {light,...pose}=shardPose(s,{...sample,pattern:value});return pose})))
    expect(new Set(signature).size).toBe(6)
    const s=shards[0]!,p={...sample,pattern:'scatter' as const},size=(m:FractureMotion)=>{const v=shardPose(s,m);return Math.hypot(v.x,v.y,v.z)}
    expect(size({...p,phrase:1})).toBeLessThan(size(p));expect(size({...p,phase:0,drop:1})).toBeGreaterThan(size({...p,phase:0}));expect(size({...p,phase:0,kick:1})).toBeGreaterThan(0)
    for(const {value} of FRACTURE_PATTERNS)for(const shard of shards){const {light,...pose}=shardPose(shard,{...sample,pattern:value,phase:Math.PI*2*.99});expect(Object.values(pose).every(x=>Math.abs(x)<1e-8)).toBe(true)}
  })
  it('honors hard lock and zero authored extents, with vocal restraint',()=>{
    const s=tessellate(48,17)[0]!,p=shardPose(s,{...motion,spread:0,depthTravel:0,rotation:0,crackEmission:0,kick:1,bass:1,high:1,mid:1});expect(Math.abs(p.x)+Math.abs(p.y)+Math.abs(p.z)+Math.abs(p.rx)+Math.abs(p.ry)+Math.abs(p.rz)+p.light).toBe(0)
    const a=shardPose(s,{...motion,pattern:'scatter'}),b=shardPose(s,{...motion,pattern:'scatter',vocal:1});expect(Math.abs(b.x)).toBeLessThan(Math.abs(a.x))
    const locked=shardPose(s,{...motion,locked:true,drop:1});expect(Math.abs(locked.x)+Math.abs(locked.y)+Math.abs(locked.z)).toBe(0)
  })
  it('builds full source UV caps, reuses geometry, restores exact media plane and disposes all meshes',()=>{
    const root=new THREE.Group(),scene=new FractureScene({THREE} as Cinema2ThreeLibrary,root)
    const look:FractureLook={...motion,active:false,phase:0,reset:true,count:48,seed:17,crackWidth:.004,thickness:.04,mode:'auto',visible:true,fit:'contain',layout:'continuous',grouping:'quadrants',scale:1,offsetX:0,offsetY:0,angle:0,opacity:1,brightness:1,transition:0,reflection:.25,spill:.3,colors:FRACTURE_COLORS,dt:1/30,paused:false}
    const resource={texture:{},width:320,height:180} as Cinema2ManagedMediaResource
    try{
      scene.apply(look,[resource],0,'high')
      const world=root.children[0]!,cells=world.children.filter((g):g is THREE.Group=>g instanceof THREE.Group&&g.children.some(c=>c instanceof THREE.Mesh&&c.material instanceof THREE.ShaderMaterial))
      expect(cells).toHaveLength(48)
      const faces=cells.map(g=>g.children.find((c):c is THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>=>c instanceof THREE.Mesh&&c.material instanceof THREE.ShaderMaterial)!)
      let totalArea=0
      for(let k=0;k<faces.length;k++){
        const g=cells[k]!,f=faces[k]!,pos=f.geometry.getAttribute('position'),uv=f.geometry.getAttribute('uv'),idx=f.geometry.index!
        expect(g.position.z).toBe(0);expect(g.rotation.x).toBe(0);expect(f.scale.x).toBe(1)
        for(let i=0;i<pos.count;i++){expect(uv.getX(i)).toBeCloseTo((pos.getX(i)+g.position.x)/PANEL_WIDTH+.5,6);expect(uv.getY(i)).toBeCloseTo((pos.getY(i)+g.position.y)/PANEL_HEIGHT+.5,6)}
        for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);totalArea+=Math.abs((pos.getX(b)-pos.getX(a))*(pos.getY(c)-pos.getY(a))-(pos.getY(b)-pos.getY(a))*(pos.getX(c)-pos.getX(a)))/2}
      }
      expect(totalArea).toBeCloseTo(PANEL_WIDTH*PANEL_HEIGHT,4)
      const geometries=faces.map(f=>f.geometry),rest=cells.map(g=>g.position.clone())
      scene.apply({...look,active:true,reset:false,phase:Math.PI,pattern:'scatter',drop:1},[resource],0,'medium')
      expect(cells.some((g,i)=>g.position.distanceTo(rest[i]!)>0)).toBe(true);expect(faces.some(f=>f.scale.x<1)).toBe(true)
      for(let i=0;i<200;i++)scene.apply({...look,reset:false},[resource],0,'low')
      expect(cells.every((g,i)=>g.position.equals(rest[i]!))).toBe(true);expect(faces.every((f,i)=>f.geometry===geometries[i]&&f.scale.x===1)).toBe(true)
      scene.apply({...look,reset:false},[],0,'high');expect(cells.some(g=>g.position.z!==0)).toBe(true)
      scene.apply({...look,reset:false},[resource],1,'high');expect(cells.every((g,i)=>g.position.equals(rest[i]!))).toBe(true)
      let disposed=0;for(const geo of geometries)geo.addEventListener('dispose',()=>disposed++)
      scene.dispose();expect(disposed).toBe(48);expect(root.children).toHaveLength(0)
    }finally{if(root.children.length)scene.dispose()}
  })
  it('manual selection and discontinuity reset phase without changing authored controls',()=>{
    const perf=new FracturePerformance(i=>(i%7)/7),controls:Record<string,unknown>={pattern:'fracture','pattern-change':false,'bpm-sync':true,'auto-performance':false}
    const update=(t:number,revision:number)=>perf.update({parameters:{get:(key:string)=>controls[key]},frame:{contextGeneration:1,elapsedTimeSec:t,deltaTimeSec:.05,transport:{trackId:'track',timeSec:t,playing:true,paused:false,animationActive:true,bpmSync:true,bpm:120,sourcePresent:true},audio:{upstream:{sourceId:'track',publisherId:'test',analysisRevision:1,timelineRevision:revision},rhythm:{fixedClocks:{4:{boundary:null}}},structure:{section:{value:null},semanticMoments:{available:false,value:null},analyzedPhrases:{available:false,value:null}},discontinuity:{generation:0}}}} as unknown as Cinema2ModuleUpdateContext)
    update(0,1);update(.05,1);expect(perf.look?.phase).toBeGreaterThan(0);controls.pattern='contour-chase';update(.1,1);expect(perf.look?.pattern).toBe('contour-chase');update(.15,2);expect(perf.look?.phase).toBe(0);expect(controls.pattern).toBe('contour-chase');expect(perf.inspect().patternControlsAutomatic).toBe(false)
  })
})
