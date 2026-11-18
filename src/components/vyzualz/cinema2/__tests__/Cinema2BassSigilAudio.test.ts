import { expect, it } from 'vitest'
import { CINEMA2_BASS_SIGIL_PRESET_ID, bassSigilParameterId } from '../presets/Cinema2BassSigilPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../../../../test/support/NightshiftMusicFixture'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'

function setup() {
  const compiled=cinema2NativePresetRegistry.compile(CINEMA2_BASS_SIGIL_PRESET_ID);if(!compiled.ok)throw new Error(JSON.stringify(compiled.diagnostics))
  const state=new Cinema2ParameterState(compiled.plan.parameters)
  const resolver=new Cinema2FinalValueResolver(compiled.plan.targets,{resolveBaseValue:t=>t.parameterId?state.getValue(t.parameterId):t.authoredBaseValue,readEditRevision:t=>t.parameterId?state.getEditRevision(t.parameterId):0})
  const choreography=new Cinema2ChoreographyRuntime(compiled.plan,state,resolver)
  let time=0,publication=0,source=nightshiftMusicFixture({timeSec:0,frameId:0,energy:0})
  const bridge=new Cinema2AudioIntelligenceBridge({getFrame:()=>source,getPublicationMeta:()=>({sequence:publication,publishedAtMs:time*1000,publisherId:'bass-sigil-test',kind:'frame'})})
  const set=(name:string,value:number|boolean)=>state.setPersistentValue(bassSigilParameterId(name),value)
  const value=(name:string)=>{const t=compiled.plan.targets.targets.find(t=>t.kind==='module'&&t.property===name)!;return resolver.resolve(t.id).value as number}
  const step=(music:Partial<NightshiftFixtureOptions>={},seconds=1/30,paused=false)=>{
    if(!paused)time+=seconds
    source=nightshiftMusicFixture({energy:0,bass:0,high:0,vocal:0,...music,timeSec:time,frameId:++publication,advanceBeatGrid:true})
    const audio=bridge.capture(publication)
    const frame={frameId:publication,timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:paused?0:seconds,contextGeneration:1,viewport:{width:960,height:540,dpr:1},audio,director:null,transport:{sourcePresent:true,playing:!paused,paused,animationActive:!paused,timeSec:time,trackId:source.trackId,bpm:120}} as Cinema2ModuleFrameReadContext
    choreography.update(frame);return audio
  }
  const settle=(music:Partial<NightshiftFixtureOptions>)=>{for(let i=0;i<30;i++)step(music)}
  return {state,choreography,set,value,step,settle,get time(){return time}}
}
it('maps independent shared facts to geometry, motion, glow and vocal restraint without rewriting saved values',()=>{
  const h=setup();h.set('reactivity',1);const saved=h.state.serialize()
  h.settle({energy:1,bass:1,high:1,vocal:1})
  expect(h.value('membraneScale')).toBeCloseTo(1.12,3)
  expect(h.value('motionRate')).toBeCloseTo(1.25,3)
  expect(h.value('membraneOpacity')).toBeCloseTo(.8,3)
  expect(h.value('particleDensity')).toBeCloseTo(.65,3)
  expect(h.state.serialize()).toBe(saved)
  h.choreography.dispose()
})
it('zero reactivity, unavailable features and hard-disable controls retain their authored authority',()=>{
  const h=setup();h.set('reactivity',0);h.settle({energy:1,bass:1,high:1,vocal:1})
  for(const name of ['membraneScale','motionRate','membraneOpacity','particleDensity'])expect(h.value(name)).toBe(1)
  h.set('reactivity',1);h.set('geometryMotion',false);h.set('logoMotion',false);h.set('coreTravel',0);h.set('glow',0);h.set('particleDensity',0)
  h.settle({energy:1,bass:1,high:1,vocal:1,event:'kick',eventId:1})
  expect(h.value('membraneScale')).toBe(1);expect(h.value('motionRate')).toBe(1)
  expect(h.value('coreTravel')).toBe(0);expect(h.value('glow')).toBe(0);expect(h.value('particleDensity')).toBe(0)
  h.step({event:'snare',eventId:2});h.step({},.025);expect(h.value('logoRoll')).toBe(0)
  h.choreography.dispose()
  const missing=setup();missing.settle({energy:1,bass:1,high:1,vocal:1,featuresAvailable:false})
  for(const name of ['membraneScale','motionRate','membraneOpacity','particleDensity'])expect(missing.value(name)).toBe(1)
  missing.choreography.dispose()
})
it('shared kick/snare/downbeat envelopes visibly drive different controls and return to base',()=>{
  for(const [event,name,base]of [['kick','coreTravel',.25],['snare','logoRoll',0],['downbeat','heroScale',1]] as const) {
    const h=setup();h.set('reactivity',1);h.step()
    if(event==='downbeat') { for(let i=0;i<65&&h.value(name)===base;i++)h.step({energy:.6}) }
    else { h.step({event,eventId:10,energy:.6});h.step({energy:.6},.025) }
    expect(h.value(name)).toBeGreaterThan(base)
    for(let i=0;i<20;i++)h.step({energy:.6})
    expect(h.value(name)).toBeCloseTo(base,6);h.choreography.dispose()
  }
})
it('does not replay a duplicate event and freezes the current envelope during pause',()=>{
  const h=setup();h.set('reactivity',1);h.step();h.step({event:'kick',eventId:1});h.step({},.025)
  const held=h.value('coreTravel');for(let i=0;i<10;i++)h.step({},1/30,true)
  expect(h.value('coreTravel')).toBe(held)
  for(let i=0;i<20;i++)h.step({event:'kick',eventId:1,eventTime:.0666666667})
  expect(h.value('coreTravel')).toBeCloseTo(.25,6);h.choreography.dispose()
})
it('clears accents on seek/track changes and clamps extreme combined contributions to control bounds',()=>{
  const h=setup();h.set('reactivity',1);h.step();h.step({event:'kick',eventId:1});h.step({},.025)
  expect(h.value('coreTravel')).toBeGreaterThan(.25)
  h.step({},5);expect(h.value('coreTravel')).toBeCloseTo(.25,6)
  h.step({trackId:'other-track'});expect(h.value('coreTravel')).toBeCloseTo(.25,6)
  h.set('membraneScale',1.4);h.set('motionRate',2);h.set('glow',2);h.settle({energy:1,bass:1,high:1})
  expect(h.value('membraneScale')).toBeLessThanOrEqual(1.4);expect(h.value('motionRate')).toBeLessThanOrEqual(2);expect(h.value('glow')).toBeLessThanOrEqual(2)
  h.choreography.dispose()
})

it('does not invent downbeat accents when shared musical features are unavailable',()=>{
  const h=setup();h.set('reactivity',1)
  for(let i=0;i<100;i++){h.step({featuresAvailable:false},.0333333333);expect(h.value('heroScale')).toBe(1)}
  h.choreography.dispose()
})
