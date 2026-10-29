import { describe,expect,it } from 'vitest'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { createSwitchItPhase3Registries,SWITCH_IT_PHASE3_MANIFEST,SWITCH_IT_PHASE3_ID } from '../presets/Cinema2SwitchItPhase3Preset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { switchItParameter } from '../presets/Cinema2SwitchItPhase2Preset'
import { Cinema2SwitchItAudio,applySwitchItAudio,SWITCH_IT_NEUTRAL_AUDIO } from '../modules/switchIt/Cinema2SwitchItAudio'
import { readSwitchItVisualControls } from '../modules/switchIt/Cinema2SwitchItMotion'
import { nightshiftMusicFixture,type NightshiftFixtureOptions } from '../../../../test/support/NightshiftMusicFixture'
import type { Cinema2ModuleFrameReadContext,Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'

function harness(){
 const result=compileCinema2NativePreset(SWITCH_IT_PHASE3_MANIFEST,{availableCapabilities:SWITCH_IT_PHASE3_MANIFEST.capabilities!.map(c=>c.id)})
 if(!result.ok)throw Error(JSON.stringify(result.diagnostics))
 const plan=result.plan,state=new Cinema2ParameterState(plan.parameters),resolver=new Cinema2FinalValueResolver(plan.targets),choreography=new Cinema2ChoreographyRuntime(plan,state,resolver),adapter=new Cinema2SwitchItAudio()
 const module=plan.manifest.modules![0]
 const target=(name:string)=>plan.targets.targets.find(t=>t.kind==='module'&&t.property===name)!
 const parameters:Cinema2ModuleParameterReadFacet={get:name=>{
  const binding=module.parameterBindings?.[name];return binding?state.getSnapshot().persistentValues[binding.$ref]:resolver.resolve(target(name).id).value
 },getAuthored:name=>module.parameters?.[name],resolve:name=>resolver.resolve(target(name).id)}
 let time=0,wall=0,sequence=0,frameId=0,playing=true,track='nightshift-audio-fixture',generation=1
 let upstream=nightshiftMusicFixture({timeSec:0,frameId:1})
 const bridge=new Cinema2AudioIntelligenceBridge({getFrame:()=>upstream,getPublicationMeta:()=>({sequence,publisherId:'switch-it-audio-test',kind:'frame',publishedAtMs:0})})
 const step=(options:Partial<NightshiftFixtureOptions>&{transient?:boolean;none?:boolean}={},dt=.02)=>{
  wall+=dt;if(playing)time+=dt;sequence++
  upstream=nightshiftMusicFixture({timeSec:time,frameId:sequence,trackId:track,energy:0,...options})
  if(options.transient)upstream={...upstream,rhythm:{...upstream.rhythm,transient:1,transientConfidence:.95}}
  const frame:Cinema2ModuleFrameReadContext={frameId:++frameId,timestampMs:wall*1000,elapsedTimeSec:time,deltaTimeSec:playing?dt:0,contextGeneration:generation,viewport:{width:640,height:640,dpr:1},audio:options.none?null:bridge.capture(frameId),director:null,transport:{sourcePresent:true,playing,paused:!playing,animationActive:playing,analysisActive:!options.none,trackId:track,timeSec:time,bpm:120,bpmSync:false}}
  choreography.update(frame)
  const drive=adapter.update({frame,parameters,targets:null as never}),base=readSwitchItVisualControls(parameters)
  return{drive,base,visual:applySwitchItAudio(base,drive,parameters.get('response') as number),frame,raw:(name:string)=>parameters.get(name)}
 }
 return{step,state,parameters,set(name:string,value:unknown){const result=state.setPersistentValue(switchItParameter(name),value);if(!result.ok)throw Error(JSON.stringify(result.diagnostics))},pause(value:boolean){playing=!value},seek(value:number){time=value},track(value:string){track=value},restore(){generation++},warm(options:Partial<NightshiftFixtureOptions>={},count=25){let out=step(options);for(let i=1;i<count;i++)out=step(options);return out}}
}
describe('Switch It Phase 3 shared Audio Intelligence',()=>{
 it('compiles private resolved routes and a user-owned Audio Response control without Director rules',()=>{
  expect(()=>createSwitchItPhase3Registries()).not.toThrow();expect(cinema2NativePresetRegistry.has(SWITCH_IT_PHASE3_ID)).toBe(false)
  expect(SWITCH_IT_PHASE3_MANIFEST.parameters!.find(p=>p.label==='Audio Response')?.designParentGroup).toBe('master-controls')
  expect(SWITCH_IT_PHASE3_MANIFEST.choreography!.rules.some(r=>r.source.path?.startsWith('director.'))).toBe(false)
 })
 it('keeps the exact authored controls when audio is absent or response is zero',()=>{
  const h=harness();const absent=h.step({none:true});expect(absent.drive).toEqual(SWITCH_IT_NEUTRAL_AUDIO);expect(absent.visual).toEqual(absent.base)
  h.warm({energy:1,bass:1,high:1,build:1});h.set('response',0);const zero=h.step({energy:1,bass:1,high:1,build:1});expect(zero.drive).toEqual(SWITCH_IT_NEUTRAL_AUDIO);expect(zero.visual).toEqual(zero.base)
 })
 it('delivers bass/energy geometry, high-band rim and build crest as distinct properties',()=>{
  const h=harness();const quiet=h.warm({energy:.02}).visual,loud=h.warm({energy:1,bass:1}).visual
  expect(loud.audioLift).toBeGreaterThan(quiet.audioLift+.1);expect(loud.audioGlint).toBe(0)
  const high=h.warm({high:1}).visual;expect(high.audioGlint).toBeGreaterThan(.2)
  const build=h.warm({build:1}).visual;expect(build.audioCrest).toBeGreaterThan(.1)
  expect(build.portraitScale).toBe(1);expect(build.skull).toEqual([.95,.12,.19])
 })
 it.each(['kick','snare'] as const)('uses resolved %s envelopes once and releases to the authored base',kind=>{
  const h=harness();h.warm();let hit=h.step({event:kind,frameId:100,eventId:100});hit=h.step({event:kind,frameId:100,eventId:100},.04)
  expect(kind==='kick'?hit.drive.kick:hit.drive.snare).toBeGreaterThan(0)
  if(kind==='kick')expect(hit.visual.eyeIntensity).toBeGreaterThan(hit.base.eyeIntensity)
  else expect(hit.visual.audioLift).toBeGreaterThan(0)
  const released=h.warm({},40);expect(released.drive[kind]).toBe(0);expect(released.visual.eyeIntensity).toBe(1);expect(released.visual.audioLift).toBeCloseTo(0)
 })
 it('accepts a shared transient and a real semantic drop, never a fabricated build-only drop',()=>{
  const h=harness();h.warm();h.step({transient:true,frameId:100});const transient=h.step({transient:true,frameId:100},.04);expect(transient.drive.transient).toBeGreaterThan(0)
  h.warm({},40);h.step({event:'drop',eventId:200,frameId:200});const drop=h.step({event:null,frameId:201},.04);expect(drop.drive.drop).toBeGreaterThan(0);expect(drop.visual.audioCrest).toBeGreaterThan(0)
  expect(h.warm({build:1},40).drive.drop).toBe(0)
 })
 it('uses supported vocal facts to reduce discretionary fragments without changing saved density',()=>{
  const h=harness();const instrumental=h.warm({energy:1,bass:1}).visual,vocal=h.warm({energy:1,bass:1,vocal:1},50).visual
  expect(vocal.fragmentAmount).toBeLessThan(instrumental.fragmentAmount);expect(vocal.audioLift).toBeLessThan(instrumental.audioLift)
  expect(h.parameters.get('fragmentAmount')).toBe(1)
 })
 it('keeps zeros/OFF states, palette, framing, split and mask surface under manual authority',()=>{
  const h=harness();h.set('reach',0);h.set('fragmentAmount',0);h.set('eyesEnabled',false);h.set('columnIntensity',0);h.set('master',0);h.set('reveal',.37)
  const result=h.warm({energy:1,bass:1,high:1,build:1})
  expect(result.visual.audioLift).toBe(0);expect(result.visual.audioCrest).toBe(0);expect(result.visual.eyeIntensity).toBe(0);expect(result.visual.columnIntensity).toBe(0);expect(result.visual.master).toBe(0)
  expect(result.visual.shell).toEqual(result.base.shell);expect(result.visual.skull).toEqual(result.base.skull);expect(result.visual.portraitScale).toBe(1);expect(h.parameters.get('reveal')).toBe(.37);expect(result.visual.flareEnabled).toBe(false)
 })
 it('does not mute reactivity with BPM Sync OFF or replay disabled/paused events',()=>{
  const h=harness();h.set('bpmSync',false);expect(h.warm({bass:1}).visual.audioLift).toBeGreaterThan(.1)
  h.set('response',0);h.step({event:'kick',frameId:100});h.set('response',1);h.step({event:'kick',frameId:100},0);expect(h.step({frameId:101},.02).drive.kick).toBe(0)
  h.pause(true);const held=h.step({event:'kick',frameId:200});expect(h.step({none:true}).drive).toEqual(held.drive)
  h.pause(false);h.step({event:'kick',frameId:200},0);expect(h.warm({frameId:201},8).drive.kick).toBe(0)
 })
 it('rejects unavailable, stale, mismatched and reset facts',()=>{
  const h=harness();h.warm({energy:1,bass:1});expect(h.step({featuresAvailable:false}).drive).toEqual(SWITCH_IT_NEUTRAL_AUDIO)
  expect(h.step({timeSec:200}).drive).toEqual(SWITCH_IT_NEUTRAL_AUDIO)
  expect(h.step({trackId:'another-track'}).drive).toEqual(SWITCH_IT_NEUTRAL_AUDIO)
  h.track('new-track');expect(h.step({none:true}).drive).toEqual(SWITCH_IT_NEUTRAL_AUDIO)
  h.restore();expect(h.step({event:'kick',frameId:300}).drive.kick).toBe(0)
 })
})
