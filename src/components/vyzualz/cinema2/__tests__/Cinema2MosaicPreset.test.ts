import { describe, expect, it } from 'vitest'
import { CINEMA2_MOSAIC_PRESET_MANIFEST as manifest } from '../presets/Cinema2MosaicPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS } from '../../react/canvasPerformance/CanvasPerformanceTypes'
import { MOSAIC_PATTERNS, mosaicUv, mosaicPose, type MosaicMotion } from '../modules/mosaic/MosaicDomain'
import { MosaicPerformance } from '../modules/Cinema2MosaicNativeModule'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
const parameter=(name:string)=>manifest.parameters!.find(p=>p.id===`mosaic-${name}`)!
const motion:MosaicMotion={pattern:'mosaic',phase:1.8,extrusion:.45,rotation:12,scatter:.35,intensity:.75,safe:true,readability:true,vocal:0,kick:0,snare:0,drop:0,bass:0,mid:0,build:0,downbeat:0,phrase:0,impact:0,high:0,energy:0,beat:0,frameEmission:.35}

describe('MOSAIC native preset',()=>{
  it('passes native and first-party authoring validation before and after coverage',()=>{
    for(const m of [manifest,withCinema2AutoCoverage(manifest,{exempt:CINEMA2_AUTO_COVERAGE_EXEMPT.mosaic})]){
      expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest:m}).diagnostics).toEqual([])
      const result=compileCinema2NativePreset(m);expect(result.diagnostics).toEqual([]);expect(result.ok).toBe(true)
    }
    expect(new Set(manifest.parameters!.map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    expect(parameter('pattern').options).toEqual(MOSAIC_PATTERNS)
    expect(parameter('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(parameter('pool-trigger').options).toEqual(CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS)
    expect(parameter('pool-automation').defaultValue).toBe(false)
    expect(manifest.mediaSlots?.[0]?.accepts).toEqual(['image','video'])
    expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette'&&p.type==='color')).toHaveLength(5)
  })
  it('covers the unit UV rectangle exactly across every supported grid density',()=>{
    for(let c=4;c<=12;c++)for(let r=3;r<=8;r++){
      let area=0
      for(let y=0;y<r;y++)for(let x=0;x<c;x++){
        const q=mosaicUv(x,y,c,r,'blocks',false,3,2);area+=q.w*q.h;expect(q.channel).toBe(2)
        expect(q.x).toBeCloseTo(x/c);expect(q.y).toBeCloseTo(y/r);expect(q.x+q.w).toBeLessThanOrEqual(1+1e-9);expect(q.y+q.h).toBeLessThanOrEqual(1+1e-9)
      }
      expect(area).toBeCloseTo(1)
    }
  })
  it('assigns coherent grouped UVs and never addresses a nonexistent feed',()=>{
    for(const grouping of ['rows','columns','blocks']){
      const results=Array.from({length:40},(_,i)=>mosaicUv(i%8,Math.floor(i/8),8,5,grouping,true,3,1));expect(new Set(results.map(r=>r.channel)).size).toBe(3)
      expect(results.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=1+1e-9&&r.y+r.h<=1+1e-9)).toBe(true)
    }
  })
  it('produces six different bounded pose/light signatures and preserves content coordinates',()=>{
    const signatures=MOSAIC_PATTERNS.map(({value})=>JSON.stringify(Array.from({length:40},(_,i)=>mosaicPose(i%8,Math.floor(i/8),8,5,{...motion,pattern:value}))))
    expect(new Set(signatures).size).toBe(6)
    for(const {value} of MOSAIC_PATTERNS)for(let i=0;i<40;i++){
      const p=mosaicPose(i%8,Math.floor(i/8),8,5,{...motion,pattern:value,phase:4.2,extrusion:1,rotation:35,scatter:1,kick:1,snare:1,drop:1,bass:1,mid:1,intensity:1})
      expect(Object.values(p).every(Number.isFinite)).toBe(true);expect(Math.abs(p.z)).toBeLessThanOrEqual(.7);expect(p.light).toBeGreaterThanOrEqual(0);expect(p.light).toBeLessThanOrEqual(1)
    }
    const pose=mosaicPose(2,2,8,5,motion);expect(mosaicPose(2,2,8,5,{...motion,kick:1}).z).toBeGreaterThan(pose.z)
  })
  it('manual selection and discontinuity reset the native pattern phase without modifying controls',()=>{
    const perf=new MosaicPerformance(i=>(i%7)/7),controls:Record<string,unknown>={pattern:'mosaic','pattern-change':false,'bpm-sync':true,'auto-performance':false}
    const update=(t:number,revision:number)=>perf.update({parameters:{get:(key:string)=>controls[key]},frame:{contextGeneration:1,elapsedTimeSec:t,deltaTimeSec:.05,transport:{trackId:'track',timeSec:t,playing:true,paused:false,animationActive:true,bpmSync:true,bpm:120,sourcePresent:true},audio:{upstream:{sourceId:'track',publisherId:'test',analysisRevision:1,timelineRevision:revision},rhythm:{fixedClocks:{4:{boundary:null}}},structure:{section:{value:null},semanticMoments:{available:false,value:null},analyzedPhrases:{available:false,value:null}},discontinuity:{generation:0}}}} as unknown as Cinema2ModuleUpdateContext)
    update(0,1);update(.05,1);expect(perf.look?.phase).toBeGreaterThan(0);controls.pattern='wave';update(.1,1);expect(perf.look?.pattern).toBe('wave');update(.15,2);expect(perf.look?.phase).toBe(0);expect(controls.pattern).toBe('wave')
  })
})
