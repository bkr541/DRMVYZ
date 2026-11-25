import { describe, expect, it } from 'vitest'
import { CINEMA2_EXOSKELETON_PRESET_MANIFEST as manifest } from '../presets/Cinema2ExoskeletonPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { EXOSKELETON_PATTERNS, armorBankCounts, armorHalfExtent, armorPose, type ArmorInput } from '../modules/exoskeleton/ExoskeletonGeometry'
import { ExoskeletonPerformance } from '../modules/exoskeleton/ExoskeletonPerformance'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
const param=(name:string)=>manifest.parameters!.find(p=>p.id===`exoskeleton-${name}`)!
const input:ArmorInput={pattern:'armor',phase:2.3,routePhase:.2,opening:.55,travel:.45,kick:0,snare:0,bass:0,mid:0,build:0,drop:0,vocal:0,safety:1}

describe('EXOSKELETON',()=>{
  it('compiles both authored and production coverage with canonical source, pattern and Inspector contracts',()=>{
    const covered=withCinema2AutoCoverage(manifest,{exempt:CINEMA2_AUTO_COVERAGE_EXEMPT.exoskeleton})
    for(const m of [manifest,covered]){
      expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest:m}).diagnostics).toEqual([])
      expect(compileCinema2NativePreset(m).diagnostics).toEqual([])
      expect(new Set(m.parameters!.filter(p=>p.designParentGroup).map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
      expect(m.modules![0].config?.userModel).toMatchObject({node:null,neutralFloor:false})
      expect(m.modules![0].parameterBindings?.userModel.$ref).toBe('exoskeleton-model')
      expect(m.choreography!.rules!.filter(r=>String(r.id).includes('mood')||String(r.id).includes('cover')).flatMap(r=>r.actions).some(a=>a.target.kind==='module'&&/^model-(scale|x|y|z|yaw|pitch|roll)$/.test(a.target.property))).toBe(false)
    }
    expect(param('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(param('pattern').options).toEqual(EXOSKELETON_PATTERNS)
    expect(param('pattern-change').metadata?.moodPolicy).toBe('patternChange')
    expect(param('model')).toMatchObject({exposure:'hidden',metadata:{editor:'user-model-selector'}})
    expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette'&&p.type==='color')).toHaveLength(5)
  })
  it('uses exact plate counts and at least 12% fit-relative clearance for each bound',()=>{
    for(const count of [12,18,24])expect(armorBankCounts(count).reduce((a,b)=>a+b,0)).toBe(count)
    for(const bounds of [[1.8,.12,.08],[.12,1.8,.5],[.3,.4,1.8],[1,1,1]])for(const clearance of [.12,.2,.4]){
      const largest=Math.max(...bounds)
      for(const half of bounds)expect(armorHalfExtent(half,largest,clearance)-half).toBeGreaterThanOrEqual(largest*clearance)
    }
  })
  it('has six distinct poses with bounded outward hinge/travel, drop release and motion lock',()=>{
    const signatures=EXOSKELETON_PATTERNS.map(({value})=>JSON.stringify([0,1,2,3,4].map(i=>armorPose(i,i,{...input,pattern:value}))))
    expect(new Set(signatures).size).toBe(6)
    for(const {value} of EXOSKELETON_PATTERNS)for(let bank=0;bank<5;bank++)for(let i=0;i<6;i++)for(let phase=0;phase<16;phase+=.5){
      const p=armorPose(i,bank,{...input,pattern:value,phase,kick:1,bass:1,mid:1,drop:1,build:1})
      expect(p.angle).toBeGreaterThanOrEqual(0);expect(p.angle).toBeLessThanOrEqual(65*Math.PI/180)
      expect(p.travel).toBeGreaterThanOrEqual(0);expect(p.travel).toBeLessThanOrEqual(.60)
      expect(p.pulse).toBeGreaterThanOrEqual(0);expect(p.pulse).toBeLessThanOrEqual(1)
    }
    const p=armorPose(0,0,input),drop=armorPose(0,0,{...input,drop:1});expect(drop.travel).toBeGreaterThan(p.travel)
    const locked=armorPose(0,0,{...input,safety:0});const other=armorPose(0,0,{...input,safety:0,pattern:'deployment',phase:10,kick:1});expect(locked.angle).toBe(other.angle);expect(locked.travel).toBe(other.travel)
  })
  it('applies manual pattern edits, pauses phase and resets on track replacement',()=>{
    const perf=new ExoskeletonPerformance(i=>(i%7)/7),values:Record<string,unknown>={pattern:'armor','bpm-sync':true,'pattern-change':false,'auto-performance':false}
    const update=(time:number,paused=false,trackId='track')=>perf.update({parameters:{get:(key:string)=>values[key]},frame:{contextGeneration:1,frameId:Math.round(time*60),timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:.05,audio:null,director:null,mood:null,transport:{trackId,timeSec:time,playing:!paused,paused,animationActive:!paused,bpmSync:true,bpm:120,sourcePresent:true}}} as unknown as Cinema2ModuleUpdateContext)
    update(0);update(.05);expect(perf.phase).toBeGreaterThan(0)
    values.pattern='retraction';update(.1);expect(perf.pattern).toBe('retraction');expect(perf.patternBlend).toBe(1)
    const phase=perf.phase;update(.15,true);expect(perf.phase).toBe(phase)
    update(.2,false,'new');expect(perf.phase).toBe(0)
  })
})
