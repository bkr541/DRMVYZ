import { describe,expect,it } from 'vitest'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_SWITCH_IT_PRESET_MANIFEST as SWITCH_IT_PHASE3_MANIFEST,CINEMA2_SWITCH_IT_PRESET_ID } from '../presets/Cinema2SwitchItPreset'
import { Cinema2SwitchItPerformance } from '../modules/switchIt/Cinema2SwitchItPerformance'
import { Cinema2SwitchItMotion } from '../modules/switchIt/Cinema2SwitchItMotion'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { switchItParameter } from '../presets/Cinema2SwitchItPhase2Preset'
import { Cinema2SwitchItAudio,applySwitchItAudio,SWITCH_IT_NEUTRAL_AUDIO } from '../modules/switchIt/Cinema2SwitchItAudio'
import { readSwitchItVisualControls } from '../modules/switchIt/Cinema2SwitchItMotion'
import { nightshiftMusicFixture,type NightshiftFixtureOptions } from '../../../../test/support/NightshiftMusicFixture'
import type { Cinema2ModuleFrameReadContext,Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'

function harness(){
 const result=compileCinema2NativePreset(SWITCH_IT_PHASE3_MANIFEST,{availableCapabilities:SWITCH_IT_PHASE3_MANIFEST.capabilities!.map(c=>c.id)})
 if(!result.ok)throw Error(JSON.stringify(result.diagnostics))
 const plan=result.plan,state=new Cinema2ParameterState(plan.parameters),resolver=new Cinema2FinalValueResolver(plan.targets),choreography=new Cinema2ChoreographyRuntime(plan,state,resolver),adapter=new Cinema2SwitchItAudio(),motion=new Cinema2SwitchItMotion(),performance=new Cinema2SwitchItPerformance(),director=new Cinema2VisualDirector()
 const module=plan.manifest.modules![0]
 const target=(name:string)=>plan.targets.targets.find(t=>t.kind==='module'&&t.property===name)!
 const parameters:Cinema2ModuleParameterReadFacet={get:name=>{
  const binding=module.parameterBindings?.[name];return binding?state.getSnapshot().persistentValues[binding.$ref]:resolver.resolve(target(name).id).value
 },getAuthored:name=>module.parameters?.[name],getEditRevision:name=>{const b=module.parameterBindings?.[name];return b?state.getEditRevision(b.$ref):0},resolve:name=>resolver.resolve(target(name).id)}
 let time=0,wall=0,sequence=0,frameId=0,playing=true,track='nightshift-audio-fixture',generation=1
 let upstream=nightshiftMusicFixture({timeSec:0,frameId:1})
 const bridge=new Cinema2AudioIntelligenceBridge({getFrame:()=>upstream,getPublicationMeta:()=>({sequence,publisherId:'switch-it-audio-test',kind:'frame',publishedAtMs:0})})
 const step=(options:Partial<NightshiftFixtureOptions>&{transient?:boolean;none?:boolean;directorMismatch?:boolean;inactiveAnimation?:boolean}={},dt=.02)=>{
  wall+=dt;if(playing)time+=dt;sequence++
  upstream=nightshiftMusicFixture({timeSec:time,frameId:sequence,trackId:track,energy:0,...options})
  if(options.transient)upstream={...upstream,rhythm:{...upstream.rhythm,transient:1,transientConfidence:.95}}
  let frame:Cinema2ModuleFrameReadContext={frameId:++frameId,timestampMs:wall*1000,elapsedTimeSec:time,deltaTimeSec:playing&&!options.inactiveAnimation?dt:0,contextGeneration:generation,viewport:{width:640,height:640,dpr:1},audio:options.none?null:bridge.capture(frameId),director:options.none?null:director.capture(bridge.capture(frameId)),transport:{sourcePresent:true,playing,paused:!playing,animationActive:playing,analysisActive:!options.none,trackId:track,timeSec:time,bpm:120,bpmSync:false}}
  if(options.directorMismatch&&frame.director)frame={...frame,director:{...frame.director,visualFrameId:-1}}
  choreography.update(frame)
  const update={frame,parameters,targets:null as never};motion.update(update);const drive=adapter.update(update),base=readSwitchItVisualControls(parameters),visual=performance.update(update,motion,drive,applySwitchItAudio(base,drive,parameters.get('response') as number))
  return{drive,base,visual,performance:{...performance.state},pose:{...performance.pose},motion:{...motion.state},frame,raw:(name:string)=>parameters.get(name)}
 }
 return{step,state,parameters,set(name:string,value:unknown){const result=state.setPersistentValue(switchItParameter(name),value);if(!result.ok)throw Error(JSON.stringify(result.diagnostics))},pause(value:boolean){playing=!value},seek(value:number){time=value},track(value:string){track=value},restore(){generation++},warm(options:Partial<NightshiftFixtureOptions>={},count=25){let out=step(options);for(let i=1;i<count;i++)out=step(options);return out}}
}
describe('Switch It production authority and release',()=>{
 it('registers the production keeper and compiles the full graph',()=>{
  expect(cinema2NativePresetRegistry.has(CINEMA2_SWITCH_IT_PRESET_ID)).toBe(true)
  expect(cinema2NativeModuleRegistry.get(SWITCH_IT_PHASE3_MANIFEST.modules![0].typeId,1)).not.toBeNull()
  const h=harness();expect(h.parameters.get('autoPerformance')).toBe(false)
  expect(SWITCH_IT_PHASE3_MANIFEST.parameters!.filter(p=>p.type==='color')).toHaveLength(6)
  expect(h.parameters.get('flecks')).toBe(0)
 })
 it('auto OFF preserves the selected program through builds and drops',()=>{
  const h=harness();h.set('pattern','split-portrait');h.warm();h.warm({build:1});
  expect(h.step({event:'drop',eventId:100}).performance).toMatchObject({visiblePattern:'split-portrait',override:null})
 })
 it('substitutes a rising build and restores the current underlying base',()=>{
  const h=harness();h.set('autoPerformance',true);h.set('patternChange',true);h.set('trigger','kick');h.warm();
  expect(h.warm({build:1},50).performance.override).toBe('build')
  const changed=h.step({build:1,event:'kick',eventId:100});expect(changed.performance.basePattern).not.toBe('switch-cycle');expect(changed.performance.visiblePattern).toBe('facet-peel')
  const restored=h.warm({},80);expect(restored.performance.override).toBeNull();expect(restored.performance.visiblePattern).toBe(changed.performance.basePattern)
  expect(h.parameters.get('patternChange')).toBe(true);expect(h.parameters.get('pattern')).toBe('switch-cycle')
 })
 it('bounds a drop to one shared cycle and consumes its identity',()=>{
  const h=harness();h.set('autoPerformance',true);h.warm();
  expect(h.step({event:'drop',eventId:100}).performance.override).toBe('drop')
  expect(h.warm({},150).performance.override).toBeNull()
  expect(h.step({event:'drop',eventId:100}).performance.override).toBeNull()
  expect(h.step({event:'drop',eventId:101}).performance.override).toBe('drop')
 })
 it('manual Pattern takeover preserves Pattern Change and suppresses the active build',()=>{
  const h=harness();h.set('autoPerformance',true);h.set('patternChange',true);h.warm();h.warm({build:1},50);h.set('pattern','twin-reveal')
  const manual=h.step({build:1});expect(manual.performance).toMatchObject({override:null,visiblePattern:'twin-reveal'});expect(h.parameters.get('patternChange')).toBe(true)
  expect(h.warm({build:1},30).performance.override).toBeNull()
  h.warm({},80);expect(h.warm({build:1},50).performance.override).toBe('build')
 })
 it('Reveal takeover disables Auto without mutating Pattern Change or the split',()=>{
  const h=harness();h.set('autoPerformance',true);h.set('patternChange',true);h.warm();h.warm({build:1},50);h.set('reveal',.31)
  expect(h.parameters.get('autoPerformance')).toBe(false);expect(h.parameters.get('patternChange')).toBe(true);expect(h.step({build:1}).performance.override).toBeNull();expect(h.parameters.get('reveal')).toBe(.31)
 })
 it('holds the performance pose on pause and does not replay paused drops',()=>{
  const h=harness();h.set('autoPerformance',true);h.warm();h.step({event:'drop',eventId:100});h.warm({},20);h.pause(true);const held=h.step();
  expect(h.warm({},40).pose).toEqual(held.pose);h.step({event:'drop',eventId:200});h.pause(false);h.warm({},180);expect(h.step({event:'drop',eventId:200}).performance.override).toBeNull()
 })
 it('valid Director facts add bounded emphasis and zero controls remain hard limits',()=>{
  const h=harness();h.set('directorStrength',0);const base=h.warm({energy:1,bass:1,high:1,build:1},50);h.set('directorStrength',1);const macro=h.warm({energy:1,bass:1,high:1,build:1},50)
  expect(macro.performance.directorAvailable).toBe(true);expect(macro.visual.audioLift).toBeGreaterThan(base.visual.audioLift);expect(macro.visual.audioCrest).toBeLessThanOrEqual(1)
  expect(macro.visual.skull).toEqual(base.visual.skull);expect(macro.visual.portraitScale).toBe(base.visual.portraitScale)
  h.set('reach',0);h.set('fragmentAmount',0);h.set('master',0);h.set('eyesEnabled',false);h.set('columnIntensity',0)
  const zero=h.warm({energy:1,bass:1,high:1,build:1});expect(zero.visual.audioLift).toBe(0);expect(zero.visual.audioCrest).toBe(0);expect(zero.visual.master).toBe(0);expect(zero.visual.eyeIntensity).toBe(0);expect(zero.visual.columnIntensity).toBe(0)
 })
 it('rejects mismatched Director frames and keeps no-analysis manual transitions live',()=>{
  const h=harness();h.warm();expect(h.step({directorMismatch:true}).performance.directorAvailable).toBe(false)
  h.set('pattern','split-portrait');h.set('reveal',.7);let result=h.step({none:true,inactiveAnimation:true});for(let i=0;i<40;i++)result=h.step({none:true,inactiveAnimation:true});expect(result.pose.reveal).toBeCloseTo(.7)
 })
 it('resets auto on source/seek/context changes and falls back without audio',()=>{
  const h=harness();h.set('autoPerformance',true);h.warm();h.step({event:'drop',eventId:100});expect(h.step({none:true}).performance.override).toBeNull()
  h.warm();h.step({event:'drop',eventId:101});h.seek(0);expect(h.step().performance.override).toBeNull()
  h.step({event:'drop',eventId:102});h.restore();expect(h.step().performance.override).toBeNull()
  h.track('another-track');expect(h.step().performance.override).toBeNull()
 })
})
