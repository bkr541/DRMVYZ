import { describe,expect,it } from 'vitest'
import { Cinema2SwitchItMotion, SWITCH_IT_PATTERNS, sampleSwitchItProgram, readSwitchItVisualControls } from '../modules/switchIt/Cinema2SwitchItMotion'
import { createSwitchItPhase2Registries, SWITCH_IT_PHASE2_MANIFEST, SWITCH_IT_PHASE2_ID, switchItParameter } from '../presets/Cinema2SwitchItPhase2Preset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../../../../test/support/NightshiftMusicFixture'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'

function harness(){
 const motion=new Cinema2SwitchItMotion(),values={...SWITCH_IT_PHASE2_MANIFEST.modules![0].parameters} as Record<string,Cinema2JsonValue>,revisions=new Map<string,number>()
 let wall=0,time=0,playing=true,bpm:number|null=120,hostSync=true,track='nightshift-audio-fixture',generation=1,index=0
 let upstream=nightshiftMusicFixture({timeSec:0,frameId:0})
 const bridge=new Cinema2AudioIntelligenceBridge({getFrame:()=>upstream,getPublicationMeta:()=>({sequence:index,publisherId:'switch-it-test',kind:'frame',publishedAtMs:0})})
 const parameters:Cinema2ModuleParameterReadFacet={get:name=>values[name],getAuthored:name=>values[name],getEditRevision:name=>revisions.get(name)??0,resolve:()=>null}
 const step=(dt=1/60,music?:Partial<NightshiftFixtureOptions>)=>{
  wall+=dt;if(playing)time+=dt
  let audio=null
  if(music){index++;upstream=nightshiftMusicFixture({timeSec:time,frameId:index,trackId:track,...music});audio=bridge.capture(index)}
  const frame:Cinema2ModuleFrameReadContext={frameId:++index,timestampMs:wall*1000,deltaTimeSec:dt,elapsedTimeSec:wall,viewport:{width:640,height:640,dpr:1},contextGeneration:generation,audio,director:null,transport:{sourcePresent:true,playing,paused:!playing,animationActive:playing&&!!audio,analysisActive:!!audio,trackId:track,timeSec:time,bpm,bpmSync:hostSync}}
  motion.update({frame,parameters,targets:null as never});return motion.state
 }
 return{motion,parameters,values,step,set(name:string,value:Cinema2JsonValue){values[name]=value;revisions.set(name,(revisions.get(name)??0)+1)},run(n:number){for(let i=0;i<n;i++)step()},pause(value:boolean){playing=!value},tempo(value:number|null,sync=true){bpm=value;hostSync=sync},seek(value:number){time=value},track(value:string){track=value},restore(){generation++}}
}
describe('Switch It Phase 2 authored motion and controls',()=>{
 it('compiles privately with four generic parent groups, six colors and the complete canonical pattern trio',()=>{
  expect(()=>createSwitchItPhase2Registries()).not.toThrow();expect(cinema2NativePresetRegistry.has(SWITCH_IT_PHASE2_ID)).toBe(false)
  const p=SWITCH_IT_PHASE2_MANIFEST.parameters!
  expect(new Set(p.map(x=>x.designParentGroup).filter(Boolean))).toEqual(new Set(['master-controls','design','effects','palette']))
  expect(p.filter(x=>x.type==='color')).toHaveLength(6)
  expect(p.some(x=>x.id===switchItParameter('seamWidth')||x.id===switchItParameter('seamGlow'))).toBe(false)
  expect(p.some(x=>x.id===switchItParameter('maskOpacity'))).toBe(false)
  expect(p.filter(x=>x.group==='Pattern').map(x=>x.label)).toEqual(['Pattern','Pattern Change','Trigger'])
  expect(p.find(x=>x.label==='Trigger')!.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
  expect(p.find(x=>x.label==='Pattern Change')!.defaultValue).toBe(false)
  expect(SWITCH_IT_PHASE2_MANIFEST.modules![0].parameterBindings!.patternChange).toEqual({'$ref':switchItParameter('patternChange')})
 })
 it('has six distinct deterministic programs with closed cycle boundaries',()=>{
  const signatures=new Set(SWITCH_IT_PATTERNS.map(({value})=>JSON.stringify([0,.2,.4,.6,.8].map(t=>sampleSwitchItProgram(value,t)))))
  expect(signatures.size).toBe(6)
  for(const {value}of SWITCH_IT_PATTERNS){expect(sampleSwitchItProgram(value,0)).toEqual(sampleSwitchItProgram(value,1));for(let i=0;i<101;i++){const p=sampleSwitchItProgram(value,i/100);expect(p.weights.reduce((a,b)=>a+b,0)).toBe(1);expect(Object.values(p).flat().every(Number.isFinite)).toBe(true)}}
 })
 it('holds the authored split at every phase',()=>{
  for(let i=0;i<120;i++)expect(sampleSwitchItProgram('split-portrait',i/53,.37)).toEqual(sampleSwitchItProgram('split-portrait',0,.37))
 })
 it('uses four shared beats or a 2.25-second free cycle and composes host sync permission',()=>{
  const run=(sync:boolean,bpm:number|null,host=true)=>{const h=harness();h.set('bpmSync',sync);h.tempo(bpm,host);h.step(0);h.run(60);return h.motion.state}
  expect(run(true,60).phase).toBeCloseTo(.25,4);expect(run(false,60).phase).toBeCloseTo(1/2.25,4)
  expect(run(true,60,false).phase).toBeCloseTo(run(false,60).phase,5)
  expect(run(true,null).locked).toBe(false);expect(run(true,null).phase).toBeCloseTo(1/2.25,4)
 })
 it('freezes native motion on pause and speed zero, but honors manual edits while paused',()=>{
  const h=harness();h.step(0);h.run(30);h.pause(true);const frozen=JSON.stringify(h.motion.pose);h.run(120);expect(JSON.stringify(h.motion.pose)).toBe(frozen)
  h.set('pattern','split-portrait');h.set('reveal',.3);h.run(20);expect(h.motion.pose.reveal).toBeCloseTo(.3);h.run(20);expect(h.motion.pose.reveal).toBeCloseTo(.3)
  h.pause(false);h.set('speed',0);const phase=h.motion.state.phase;h.run(60);expect(h.motion.state.phase).toBe(phase)
 })
 it('does not snap on sync handoff and resets deliberately on track, seek, loop and context restoration',()=>{
  const h=harness();h.step(0);h.run(50);const before=h.motion.state.phase;h.set('bpmSync',false);h.step(0);expect(h.motion.state.phase).toBe(before)
  h.track('other');h.step(0);expect(h.motion.state.phase).toBe(0);h.run(20);h.seek(20);h.step(0);expect(h.motion.state.phase).toBe(0)
  h.run(20);h.seek(0);h.step(0);expect(h.motion.state.phase).toBe(0);h.run(20);h.restore();h.step(0);expect(h.motion.state.phase).toBe(0)
 })
 it('interpolates repeated manual program handoffs without a topology jump',()=>{
  const h=harness();h.step(0);h.run(20)
  for(const pattern of ['facet-peel','twin-reveal','crown-surge','split-portrait']){const before=h.motion.pose;h.set('pattern',pattern);h.step();const after=h.motion.pose;expect(Math.abs(before.reveal-after.reveal)).toBeLessThan(.05);expect(Math.max(...before.weights.map((v,i)=>Math.abs(v-after.weights[i])))).toBeLessThan(.05);h.run(3)}
 })
 it.each(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS.map(x=>x.value))('reuses fresh canonical %s events without changing saved Pattern',trigger=>{
  const h=harness();h.set('patternChange',true);h.set('trigger',trigger);h.step(.1,{event:null,beatIndex:0})
  const event=(trigger.startsWith('bar')?'bar':trigger==='beat2'||trigger==='beat4'?'beat':trigger) as NightshiftFixtureOptions['event']
  h.step(.1,{event,eventId:110,frameId:110,beatIndex:32});expect(h.motion.state.pattern).toBe('split-portrait');expect(h.values.pattern).toBe('switch-cycle');expect(h.values.patternChange).toBe(true)
  h.step(0,{event,eventId:110,frameId:110,beatIndex:32});expect(h.motion.state.pattern).toBe('split-portrait')
  h.set('pattern','skull-projection');h.step(0,{event,eventId:110,frameId:110,beatIndex:32});expect(h.motion.state.pattern).toBe('skull-projection')
  h.step(.1,{event,eventId:111,frameId:111,beatIndex:64});expect(h.motion.state.pattern).toBe('crown-surge');expect(h.values.pattern).toBe('skull-projection')
 })
 it('does not replay an event observed while paused',()=>{
  const h=harness();h.set('patternChange',true);h.set('trigger','kick');h.step(.1,{event:null});h.pause(true);h.step(.1,{event:'kick',eventId:5,frameId:5});h.pause(false);h.step(0,{event:'kick',eventId:5,frameId:5});expect(h.motion.state.pattern).toBe('switch-cycle');h.step(.1,{event:'kick',eventId:6,frameId:6});expect(h.motion.state.pattern).toBe('split-portrait')
 })
 it('clamps hard manual limits and retains independent palette values',()=>{
  const h=harness();h.set('master',-1);h.set('reach',0);h.set('fragmentAmount',0);h.set('eyesEnabled',false);h.set('flareEnabled',false);h.set('shell',[.5,.1,.2,1]);const v=readSwitchItVisualControls(h.parameters)
  expect(v.master).toBe(0);expect(v.reach).toBe(0);expect(v.fragmentAmount).toBe(0);expect(v.eyesEnabled).toBe(false);expect(v.flareEnabled).toBe(false);expect(v.shell).toEqual([.5,.1,.2]);expect(v.rim).not.toEqual(v.shell)
 })
})
