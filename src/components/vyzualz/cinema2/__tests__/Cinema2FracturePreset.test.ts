import { describe, expect, it } from 'vitest'
import { CINEMA2_FRACTURE_PRESET_MANIFEST as manifest } from '../presets/Cinema2FracturePreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS } from '../../react/canvasPerformance/CanvasPerformanceTypes'
import { FRACTURE_PATTERNS, tessellate, polygonArea, insetPolygon, shardPose, type FractureMotion } from '../modules/fracture/FractureDomain'
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
      const p=shardPose(s,{...motion,pattern:value,phase:i*Math.PI/30,spread:1,depthTravel:1,rotation:70,intensity:1,kick:1,drop:1,mid:1,safe:false,readability:false});expect(Object.values(p).every(Number.isFinite)).toBe(true);expect(Math.abs(p.x)).toBeLessThanOrEqual(1.35);expect(Math.abs(p.y)).toBeLessThanOrEqual(.78);expect(Math.abs(p.z)).toBeLessThanOrEqual(1.2);expect(p.light).toBeLessThanOrEqual(1)
    }
    for(const s of shards){const p=shardPose(s,{...motion,active:false,drop:1});expect(Math.abs(p.x)+Math.abs(p.y)+Math.abs(p.z)+Math.abs(p.rx)+Math.abs(p.ry)+Math.abs(p.rz)).toBe(0)}
  })
  it('honors hard lock and zero authored extents, with vocal restraint',()=>{
    const s=tessellate(48,17)[0]!,p=shardPose(s,{...motion,spread:0,depthTravel:0,rotation:0,crackEmission:0,kick:1,bass:1,high:1,mid:1});expect(Math.abs(p.x)+Math.abs(p.y)+Math.abs(p.z)+Math.abs(p.rx)+Math.abs(p.ry)+Math.abs(p.rz)+p.light).toBe(0)
    const a=shardPose(s,{...motion,pattern:'scatter'}),b=shardPose(s,{...motion,pattern:'scatter',vocal:1});expect(Math.abs(b.x)).toBeLessThan(Math.abs(a.x))
    const locked=shardPose(s,{...motion,locked:true,drop:1});expect(Math.abs(locked.x)+Math.abs(locked.y)+Math.abs(locked.z)).toBe(0)
  })
  it('manual selection and discontinuity reset phase without changing authored controls',()=>{
    const perf=new FracturePerformance(i=>(i%7)/7),controls:Record<string,unknown>={pattern:'fracture','pattern-change':false,'bpm-sync':true,'auto-performance':false}
    const update=(t:number,revision:number)=>perf.update({parameters:{get:(key:string)=>controls[key]},frame:{contextGeneration:1,elapsedTimeSec:t,deltaTimeSec:.05,transport:{trackId:'track',timeSec:t,playing:true,paused:false,animationActive:true,bpmSync:true,bpm:120,sourcePresent:true},audio:{upstream:{sourceId:'track',publisherId:'test',analysisRevision:1,timelineRevision:revision},rhythm:{fixedClocks:{4:{boundary:null}}},structure:{section:{value:null},semanticMoments:{available:false,value:null},analyzedPhrases:{available:false,value:null}},discontinuity:{generation:0}}}} as unknown as Cinema2ModuleUpdateContext)
    update(0,1);update(.05,1);expect(perf.look?.phase).toBeGreaterThan(0);controls.pattern='contour-chase';update(.1,1);expect(perf.look?.pattern).toBe('contour-chase');update(.15,2);expect(perf.look?.phase).toBe(0);expect(controls.pattern).toBe('contour-chase');expect(perf.inspect().patternControlsAutomatic).toBe(false)
  })
})
