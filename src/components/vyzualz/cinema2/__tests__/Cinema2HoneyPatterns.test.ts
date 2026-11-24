import { describe,expect,it } from 'vitest'
import { HONEY_PATTERN_IDS } from '../modules/honey/Cinema2HoneyDomain'
import { buildHoneyLayout,isHoneyPoseSafe } from '../modules/honey/Cinema2HoneyLayout'
import { sampleHoneyPattern } from '../modules/honey/Cinema2HoneyPatterns'
import { advanceHoneyCell,createHoneyCellState,HONEY_MOTION_DEFAULTS,targetHoneyCell } from '../modules/honey/Cinema2HoneyMotion'
import { Cinema2HoneyOrchestration } from '../modules/honey/Cinema2HoneyOrchestration'
import type { Cinema2ModuleFrameReadContext,Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../modules/Cinema2AfterhoursNativeModule'
import type { Cinema2MoodFrame } from '../conductor/Cinema2MoodConductor'

const layout=buildHoneyLayout()
const maxima={...HONEY_MOTION_DEFAULTS,motion:1,rotation:1,tilt:1,separation:1}
const visible=layout.filter(c=>Math.abs(c.x)<6&&Math.abs(c.y)<4)
function fixture(){
  const engine=new Cinema2HoneyOrchestration(visible)
  const values:Record<string,Cinema2JsonValue>={...HONEY_MOTION_DEFAULTS,pattern:'cascade',patternChange:false,trigger:'bar4',bpmSync:true,autoPerformance:false}
  let time=0,patternRevision=0
  function tick(dt=1/60,overrides:Partial<Cinema2ModuleFrameReadContext>={},bpm=150,global=true){
    time+=dt
    const frame:Cinema2ModuleFrameReadContext={frameId:Math.round(time*120),timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:dt,viewport:{width:960,height:540,dpr:1},contextGeneration:1,audio:null,director:null,transport:{sourcePresent:true,playing:true,animationActive:true,analysisActive:true,paused:false,trackId:'track',timeSec:time,bpm,bpmSync:global},...overrides}
    engine.update({frame,parameters:{get:key=>values[key],getAuthored:key=>values[key],getEditRevision:key=>key==='pattern'?patternRevision:0,resolve:()=>null},targets:{} as Cinema2ModuleUpdateContext['targets']})
    return frame
  }
  return {engine,values,tick,reselect:()=>{patternRevision++}}
}
function audioEvent(id:string,time:number):NonNullable<Cinema2ModuleFrameReadContext['audio']>{
  const event={id,strength:1,timeSec:time}
  return {upstream:{timeSec:time,sourceId:'source',publisherId:'publisher',analysisRevision:1,timelineRevision:1},discontinuity:{generation:1},rhythm:{bpm:{available:true,value:150},beatIndex:{available:true,value:32},beatPhase:{available:true,value:0},barIndex:{available:true,value:8},beat:event,kick:event,snare:event,downbeat:event,fixedClocks:{4:{boundary:event},16:{boundary:event}}},structure:{analyzedPhrases:{available:true,value:[event]},semanticMoments:{available:true,value:[{...event,type:'drop'}]}}} as unknown as NonNullable<Cinema2ModuleFrameReadContext['audio']>
}
describe('HONEY motion and patterns',()=>{
  it('has eight deterministic, distinct geometry and lighting signatures at multiple beats; every target is safe',()=>{
    const signatures=new Set<string>()
    for(const pattern of HONEY_PATTERN_IDS){
      const signature=[]
      for(const beat of [0,.5,1,2,4,8])for(const cell of layout){
        const s=sampleHoneyPattern(pattern,cell,beat),target=targetHoneyCell(cell,s,maxima)
        expect(isHoneyPoseSafe(target.pose)).toBe(true)
        expect(s).toEqual(sampleHoneyPattern(pattern,cell,beat))
        expect(target.channels.every(v=>v>=0&&v<=1)).toBe(true)
        signature.push([target.elevation,...target.channels].map(v=>v.toFixed(3)).join(':'))
      }
      signatures.add(signature.join(','))
    }
    expect(signatures.size).toBe(8)
  },30000)
  it('exhibits all axes, retains identity and settles safely across every pattern change',()=>{
    const seen=new Set<string>(),states=visible.map(createHoneyCellState)
    for(const pattern of HONEY_PATTERN_IDS)for(let i=0;i<60;i++)states.forEach((state,j)=>{
      const c=visible[j]!,target=targetHoneyCell(c,sampleHoneyPattern(pattern,c,i/24),maxima)
      advanceHoneyCell(state,target,1/60,maxima)
      expect(state.current.id).toBe(c.id);expect(state.current.finish).toBe(c.finish);expect(isHoneyPoseSafe(state.current.pose)).toBe(true)
      for(const key of ['rotation','tiltX','tiltY','x','y'] as const)if(Math.abs(state.current.pose[key])>.001)seen.add(key)
      if(state.current.elevation>c.elevation+.025)seen.add('extension');if(state.current.elevation<c.elevation-.025)seen.add('retraction')
    })
    expect(seen.size).toBe(7)
  },30000)
  it('keeps constant-target damping consistent across 30/60/120 Hz',()=>{
    const cell=layout.find(c=>c.elevation===.49)!,target=targetHoneyCell(cell,{activation:1,elevation:1,rotation:0,tiltX:0,tiltY:0,separation:0,outer:1,inner:0,under:1},maxima)
    const results=[30,60,120].map(rate=>{const state=createHoneyCellState(cell);for(let i=0;i<rate;i++)advanceHoneyCell(state,target,1/rate,maxima);return state.current.elevation})
    expect(Math.max(...results)-Math.min(...results)).toBeLessThan(1e-8)
  })
  it('holds on pause and zero motion, resets on seek, and composes both BPM permissions',()=>{
    const f=fixture();for(let i=0;i<60;i++)f.tick();const before=f.engine.cells.map(c=>c.pose),phase=f.engine.inspect().phase
    const paused=f.tick(0).transport!;f.tick(1/60,{transport:{...paused,paused:true,playing:false,animationActive:false}})
    expect(f.engine.inspect().phase).toBe(phase);expect(f.engine.cells.map(c=>c.pose)).toEqual(before)
    f.values.motion=0;f.tick();expect(f.engine.cells.map(c=>c.pose)).toEqual(before)
    f.tick(1/60,{},150,false);expect(f.engine.inspect().locked).toBe(false)
    f.values.bpmSync=false;f.tick();expect(f.engine.inspect().locked).toBe(false)
    f.values.bpmSync=true;const current=f.tick();expect(f.engine.inspect().locked).toBe(true)
    f.tick(1/60,{transport:{...current.transport!,timeSec:0}});expect(f.engine.inspect().phase).toBe(0)
    const slow=fixture(),fast=fixture();for(let i=0;i<61;i++){slow.tick(1/60,{},90);fast.tick(1/60,{},150)}
    expect(fast.engine.inspect().phase).toBeGreaterThan(slow.engine.inspect().phase)
  })
  it('switches on every canonical event, suppresses held identities, and honors manual changes while enabled',()=>{
    for(const trigger of CINEMA2_AFTERHOURS_TRIGGER_IDS){
      const f=fixture();f.values.patternChange=true;f.values.trigger=trigger
      f.tick(0,{audio:audioEvent('baseline',0)});f.tick(.1,{audio:audioEvent('new',.1)})
      expect(f.engine.inspect().activePattern).toBe('shockwave')
      f.tick(.1,{audio:audioEvent('new',.1)});expect(f.engine.inspect().activePattern).toBe('shockwave')
      f.values.pattern='fracture';f.tick(.1,{audio:audioEvent('edit',.3)});expect(f.engine.inspect().activePattern).toBe('fracture')
      f.tick(.1,{audio:audioEvent('next',.4)});expect(f.engine.inspect().activePattern).toBe('alternating')
      expect(f.values.pattern).toBe('fracture')
    }
  })
  it('honors an explicit same-value Pattern edit without consuming the held trigger',()=>{
    const f=fixture();f.values.patternChange=true;f.values.trigger='kick'
    f.tick(0,{audio:audioEvent('base',0)});f.tick(.1,{audio:audioEvent('new',.1)})
    expect(f.engine.inspect().activePattern).toBe('shockwave')
    f.reselect();f.tick(.1,{audio:audioEvent('edit',.2)})
    expect(f.engine.inspect().activePattern).toBe('cascade')
    f.tick(.1,{audio:audioEvent('edit',.2)})
    expect(f.engine.inspect().activePattern).toBe('cascade')
    f.tick(.1,{audio:audioEvent('next',.4)})
    expect(f.engine.inspect().activePattern).toBe('shockwave')
    expect(f.values.patternChange).toBe(true);expect(f.values.pattern).toBe('cascade')
  })
  it('uses both sync permissions at 90, 128, 140 and 150 BPM without changing the authored rate',()=>{
    for(const bpm of [90,128,140,150]){
      const locked=fixture(),hostOff=fixture(),presetOff=fixture();presetOff.values.bpmSync=false
      for(let i=0;i<=60;i++){locked.tick(1/60,{},bpm);hostOff.tick(1/60,{},bpm,false);presetOff.tick(1/60,{},bpm)}
      expect(locked.engine.inspect().locked).toBe(true)
      expect(locked.engine.inspect().phase).toBeCloseTo(bpm/60,6)
      expect(hostOff.engine.inspect().phase).toBeCloseTo(2,6)
      expect(presetOff.engine.inspect().phase).toBeCloseTo(2,6)
      expect(locked.values.rate).toBe(HONEY_MOTION_DEFAULTS.rate)
    }
  })
  it('uses the shared mood policy, holds in silence and falls back to the saved pair without a grid',()=>{
    const f=fixture();f.values.autoPerformance=true;f.values.trigger='bar4';f.values.patternChange=false
    const mood={silence:0,pattern:{patternChange:true,trigger:'beat',reason:'driving'}} as Cinema2MoodFrame
    f.tick(0,{mood,audio:audioEvent('base',0)});f.tick(.1,{mood,audio:audioEvent('next',.1)})
    expect(f.engine.inspect()).toMatchObject({activePattern:'shockwave',effectivePatternChange:true,effectiveTrigger:'beat',patternControlsAutomatic:true})
    f.tick(.1,{mood:{...mood,silence:1,pattern:{patternChange:false,trigger:'beat',reason:'silence'}},audio:audioEvent('silent',.2)})
    expect(f.engine.inspect().activePattern).toBe('shockwave')
    f.tick(.1,{mood:{...mood,pattern:null},audio:audioEvent('silent',.2)})
    expect(f.engine.inspect()).toMatchObject({activePattern:'cascade',effectivePatternChange:false,effectiveTrigger:'bar4',patternControlsAutomatic:false})
    expect(f.values.patternChange).toBe(false);expect(f.values.trigger).toBe('bar4')
  })
})
