import { describe, expect, it } from 'vitest'
import { CINEMA2_SPECTRUM_PRESET_MANIFEST as manifest } from '../presets/Cinema2SpectrumPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS } from '../../react/canvasPerformance/CanvasPerformanceTypes'
import { SPECTRUM_PATTERNS, bayAngle, spectrumPose, spectrumUv, floorPulse, type SpectrumMotion } from '../modules/spectrum/SpectrumDomain'
import { SpectrumPerformance } from '../modules/Cinema2SpectrumNativeModule'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
const parameter=(name:string)=>manifest.parameters!.find(p=>p.id===`spectrum-${name}`)!
const motion:SpectrumMotion={pattern:'orbit',phase:1.8,opening:.35,tilt:8,floorRelay:.55,sweep:.55,overhead:.35,intensity:.75,safe:true,readability:true,vocal:0,kick:0,snare:0,drop:0,bass:0,mid:0,build:0,downbeat:0,phrase:0,impact:0,high:0,energy:0,beat:0}
describe('SPECTRUM native arena',()=>{
  it('compiles the authored and covered manifests with canonical controls',()=>{
    for(const m of [manifest,withCinema2AutoCoverage(manifest,{exempt:CINEMA2_AUTO_COVERAGE_EXEMPT.spectrum})]){
      expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest:m}).diagnostics).toEqual([])
      const result=compileCinema2NativePreset(m);expect(result.diagnostics).toEqual([]);expect(result.ok).toBe(true)
    }
    expect(new Set(manifest.parameters!.map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    expect(parameter('pattern').options).toEqual(SPECTRUM_PATTERNS)
    expect(parameter('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(parameter('pool-trigger').options).toEqual(CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS)
    expect(parameter('pool-automation').defaultValue).toBe(false)
    expect(parameter('media-layout').defaultValue).toBe('continuous')
    expect(parameter('media-fit').defaultValue).toBe('contain')
    expect(manifest.mediaSlots?.[0]?.accepts).toEqual(['image','video'])
    expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette'&&p.type==='color')).toHaveLength(5)
  })
  it('maps contiguous angular UVs, one channel per group and a seam at the front',()=>{
    for(let count=8;count<=16;count++)for(const coverage of ['front-arc','wide-arc','full-wrap'])for(const grouping of ['left-center-right','quadrants'])for(const grouped of [false,true])for(let channels=1;channels<=3;channels++){
      const uvs=Array.from({length:count},(_,i)=>spectrumUv(i,count,7,3.65,coverage,grouping,grouped,channels,2))
      const active=uvs.filter(q=>q.channel>=0)
      expect(active.length).toBe(coverage==='full-wrap'?count:coverage==='front-arc'?Math.ceil(count/3):Math.ceil(count*2/3))
      for(const q of active){expect(q.x).toBeGreaterThanOrEqual(0);expect(q.x+q.w).toBeLessThanOrEqual(1+1e-8);expect(q.channel).toBeLessThan(channels);expect(q.aspect).toBeGreaterThan(0)}
      if(!grouped){expect(active.every(q=>q.channel===2%channels)).toBe(true);expect(active.reduce((s,q)=>s+q.w,0)).toBeCloseTo(1)}
      expect(bayAngle(0,count)).toBeLessThan(0);expect(bayAngle(count-1,count)).toBeGreaterThan(0)
    }
    expect(new Set(Array.from({length:12},(_,i)=>spectrumUv(i,12,7,3.65,'wide-arc','left-center-right',true,3,0).channel).filter(c=>c>=0)).size).toBe(3)
  })
  it('keeps six distinct programs and bounds every physical and light response',()=>{
    const signatures=SPECTRUM_PATTERNS.map(({value})=>JSON.stringify(Array.from({length:12},(_,i)=>spectrumPose(i,12,{...motion,pattern:value}))))
    expect(new Set(signatures).size).toBe(6)
    for(const {value} of SPECTRUM_PATTERNS)for(let i=0;i<16;i++)for(let n=0;n<60;n++){
      const m={...motion,pattern:value,phase:n*.2,opening:1,tilt:25,intensity:1,kick:1,snare:1,bass:1,drop:1},p=spectrumPose(i,16,m)
      expect(Object.values(p).every(Number.isFinite)).toBe(true);expect(Math.abs(p.radial)).toBeLessThanOrEqual(1);expect(Math.abs(p.tilt)).toBeLessThanOrEqual(25*Math.PI/180);expect(p.light).toBeGreaterThanOrEqual(0);expect(p.light).toBeLessThanOrEqual(1);expect(floorPulse(i,m)).toBeLessThanOrEqual(1)
    }
    expect(floorPulse(1,{...motion,kick:1})).toBeGreaterThan(floorPulse(1,motion))
    expect(Math.abs(spectrumPose(2,12,{...motion,vocal:1}).radial)).toBeLessThan(Math.abs(spectrumPose(2,12,motion).radial))
  })
  it('holds authored controls on manual selection and discontinuities',()=>{
    const perf=new SpectrumPerformance(i=>(i%7)/7),controls:Record<string,unknown>={pattern:'orbit','pattern-change':false,'bpm-sync':true,'auto-performance':false}
    const update=(t:number,revision:number)=>perf.update({parameters:{get:(key:string)=>controls[key]},frame:{contextGeneration:1,elapsedTimeSec:t,deltaTimeSec:.05,transport:{trackId:'track',timeSec:t,playing:true,paused:false,animationActive:true,bpmSync:true,bpm:120,sourcePresent:true},audio:{upstream:{sourceId:'track',publisherId:'test',analysisRevision:1,timelineRevision:revision},rhythm:{fixedClocks:{4:{boundary:null}}},structure:{section:{value:null},semanticMoments:{available:false,value:null},analyzedPhrases:{available:false,value:null}},discontinuity:{generation:0}}}} as unknown as Cinema2ModuleUpdateContext)
    update(0,1);update(.05,1);expect(perf.look?.phase).toBeGreaterThan(0);controls.pattern='circumference-relay';update(.1,1);expect(perf.look?.pattern).toBe('circumference-relay');update(.15,2);expect(perf.look?.phase).toBe(0);expect(controls.pattern).toBe('circumference-relay');expect(perf.inspect().patternControlsAutomatic).toBe(false)
  })
})
