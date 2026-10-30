import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_IFRIT_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2IfritPreset'
import { CINEMA2_RUNTIME_FOUNDATION_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import type { Cinema2ParameterId, Cinema2PresetId, Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { createCinema2DesignParentGroupModel } from '../../components/vyzualz/cinema2/parameters/Cinema2InspectorModel'
import { IFRIT_CHANNELS } from '../../components/vyzualz/cinema2/presets/Cinema2IfritChoreography'
import { MusicIntelligenceAnalyserFramePump } from '../../features/musicIntelligence/MusicIntelligenceAnalyserFramePump'
import { musicIntelligenceEngine } from '../../features/musicIntelligence/MusicIntelligenceEngine'
import { analyzeTrackBuffer } from '../../features/musicIntelligence/offlineTrackAnalyzer'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { ifritMusicFixture, type IfritFixtureOptions } from '../support/IfritMusicFixture'
import '../../styles/typography.css'
import '../../styles.css'
import '../../styles/vyzualz.css'
import '../../styles/reactView.css'

const canvas = document.querySelector<HTMLCanvasElement>('#ifrit-production')
if (!canvas) throw new Error('Ifrit review canvas is missing.')
AudioFeatureBus.reset()
let timestamp=0, targetTime=0, musicTime=0, paused=false, source=false, bpm=120, sequence=0, dirty=false
let fixture: Partial<IfritFixtureOptions> = {}
let published = ifritMusicFixture({ timeSec: 0, frameId: 0 })
let quality: Cinema2RenderQualityLevel = 'high'
let runtime: Cinema2Runtime
let realContext: AudioContext | null=null, realAnalyser: AnalyserNode | null=null, realSource: AudioBufferSourceNode | null=null
let realPump: MusicIntelligenceAnalyserFramePump | null=null, realStart=0
const realEvents: {time:number;kind:string;id:string;strength:number}[]=[]
const seenRealEvents=new Set<string>()
let realAnalysis: Awaited<ReturnType<typeof analyzeTrackBuffer>> | null=null
let realDuration=0, realEnded=false
const realPeaks:Record<string,number>={}
let realFrames=0
const realTrack='ifrit-reference-soundtrack'
const create = (presetId: Cinema2PresetId = CINEMA2_IFRIT_PRESET_ID, serializedParameterState?: string) => Cinema2Runtime.create(canvas, {
  presetId, serializedParameterState, renderQuality: quality, diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'ifrit-review' },
  requestAnimationFrame: callback => requestAnimationFrame(() => {
    if(realContext&&realAnalyser&&realPump) {
      timestamp=performance.now();musicTime=Math.min(realDuration,realContext.currentTime-realStart)
      realPump.sample({analyser:realAnalyser,audioTime:musicTime,isPlaying:!realEnded,trackIdentity:realTrack})
      callback(timestamp)
      realFrames++
      for(const key of IFRIT_CHANNELS) {
        const target=runtime.getCompiledPresetPlan().targets.targets.find(t=>t.kind==='module'&&t.property===key)
        const value=target?runtime.getTargetResolver().resolve(target.id).value:0
        if(typeof value==='number') realPeaks[key]=Math.max(realPeaks[key]??0,value)
      }
      const audio=runtime.getAudioIntelligenceFrame()
      for(const event of [audio?.rhythm.kick,audio?.rhythm.snare,audio?.rhythm.beat,audio?.rhythm.downbeat]) {
        if(event&&!seenRealEvents.has(event.id)) {seenRealEvents.add(event.id);realEvents.push({time:event.timeSec,kind:event.kind,id:event.id,strength:event.strength})}
      }
      return
    }
    const before=timestamp
    timestamp=Math.min(targetTime,timestamp+1000/60)
    if(source && (before!==timestamp || dirty)) {
      if(!paused) musicTime+=(timestamp-before)/1000
      published=ifritMusicFixture({ ...fixture, bpm, timeSec: musicTime, frameId: ++sequence })
      AudioFeatureBus.setFrame(published)
      dirty=false
    }
    callback(timestamp)
  }), cancelAnimationFrame: id => cancelAnimationFrame(id),
  transportSource: { getState: () => ({ sourcePresent: source, playing: source&&!paused&&!realEnded, analysisActive: source, paused,
    trackId: realContext ? realTrack : source ? published.trackId : null, timeSec: source ? musicTime : timestamp/1000, bpm, bpmSync: false }) },
})
const result=create()
if(!result.runtime) throw new Error(result.error)
runtime=result.runtime
const host=document.createElement('aside')
host.id='ifrit-inspector'
host.style.cssText='position:fixed;right:0;top:0;bottom:0;width:360px;overflow:auto;background:#16151f;color:white;padding:12px;display:none'
document.body.append(host)
const inspector=createRoot(host)
const refresh=() => inspector.render(createElement(Cinema2InspectorPanel,{ runtime, surface:'design', sharedAudioAnalysis:false }))
refresh()
const resize=() => runtime.resize({ width: innerWidth, height:innerHeight,dpr:1 })
resize(); runtime.start()
const frame=() => new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
const settle=async()=>{ for(let i=0;i<4;i++) await frame() }
const status=()=>({ snapshot:runtime.getSnapshot(), modules:runtime.getModuleRuntimeSnapshot(), effects:runtime.getEffectRuntimeSnapshot(),
  render:runtime.getRenderGraphExecutorSnapshot(), resources:runtime.getResourceManagerSnapshot(), history:runtime.getHistoryServiceSnapshot(),
  audio:runtime.getAudioIntelligenceFrame(), director:runtime.getVisualDirectorFrame(), transport:runtime.getTransportFrameState(),
  performance:runtime.getPerformanceSnapshot(), camera:runtime.getCameraRuntimeSnapshot(),
  channels:Object.fromEntries(IFRIT_CHANNELS.map(name=>{const target=runtime.getCompiledPresetPlan().targets.targets.find(t=>t.kind==='module'&&t.property===name);return [name,target?runtime.getTargetResolver().resolve(target.id).value:null]})),
  choreography:runtime.getChoreographyRuntimeSnapshot(), parameters:runtime.getParameterState().getSnapshot(),
  groups:createCinema2DesignParentGroupModel(runtime.getCompiledPresetPlan(),runtime.getParameterState().getSnapshot()),
})
const api={
  status,
  audioEvidence(){return {events:realEvents,analysis:realAnalysis,duration:realDuration,peaks:realPeaks,frames:realFrames,contextState:realContext?.state}},
  async playAudio(encoded:string) {
    realEvents.length=0;seenRealEvents.clear();realEnded=false;realFrames=0
    for(const key of Object.keys(realPeaks)) delete realPeaks[key]
    realContext=new AudioContext();await realContext.resume()
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)).buffer
    const buffer=await realContext.decodeAudioData(bytes)
    realDuration=buffer.duration
    realAnalysis=await analyzeTrackBuffer(buffer)
    realAnalyser=realContext.createAnalyser();realAnalyser.fftSize=2048
    const mute=realContext.createGain();mute.gain.value=0
    realSource=realContext.createBufferSource();realSource.buffer=buffer;realSource.onended=()=>{realEnded=true}
    realSource.connect(realAnalyser);realAnalyser.connect(mute);mute.connect(realContext.destination)
    source=true;paused=false;musicIntelligenceEngine.setSourceId(realTrack,realTrack)
    musicIntelligenceEngine.setTrackAnalysis(realAnalysis)
    realPump=new MusicIntelligenceAnalyserFramePump({publisherId:'ifrit-real-reference'})
    realStart=realContext.currentTime;realSource.start();await settle();return status()
  },
  async stopAudio() {
    realSource?.stop();realSource?.disconnect();realSource=null
    realPump?.dispose();realPump=null;realAnalyser?.disconnect();realAnalyser=null
    await realContext?.close();realContext=null;realEnded=false;source=false;targetTime=timestamp
    AudioFeatureBus.reset();await settle();return status()
  },
  async prepare(){ await settle(); const s=status(); if(s.modules.failedModuleCount || s.render.failedPassCount) throw new Error(JSON.stringify(s)); return s },
  async set(values:Record<string,unknown>){
    for(const [name,value] of Object.entries(values)) {
      const id=(name.startsWith('ifrit-') ? name : `ifrit-${name}`) as Cinema2ParameterId
      const changed=runtime.getParameterState().setPersistentValue(id,value)
      if(!changed.ok) throw new Error(JSON.stringify(changed.diagnostics))
    }
    refresh(); await settle(); return status()
  },
  async reset(){ runtime.getParameterState().resetAll(); refresh(); await settle(); return status() },
  async music(options:Partial<IfritFixtureOptions>, enabled=true){
    source=enabled
    if(options.timeSec!=null) musicTime=options.timeSec
    if(options.bpm!=null) bpm=options.bpm
    fixture={ ...options,eventTime:options.eventTime??musicTime }
    dirty=true
    if(!enabled) AudioFeatureBus.reset()
    await settle(); return status()
  },
  async repeatMusic(){ AudioFeatureBus.setFrame(published); await settle(); return status() },
  async advance(seconds:number, options:{ paused?:boolean; bpm?:number }={}){
    paused=options.paused??false; bpm=options.bpm??bpm
    targetTime+=seconds*1000
    while(timestamp<targetTime-0.001) await frame()
    await settle(); return status()
  },
  async reenter(preserve=true, nextQuality:Cinema2RenderQualityLevel='high'){
    const saved=preserve?runtime.getParameterState().serialize():undefined
    runtime.dispose()
    const retired=status()
    quality=nextQuality
    const other=create(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
    if(!other.runtime) throw new Error(other.error)
    other.runtime.resize({width:innerWidth,height:innerHeight,dpr:1}); other.runtime.start()
    await settle(); other.runtime.dispose()
    const next=create(CINEMA2_IFRIT_PRESET_ID,saved)
    if(!next.runtime) throw new Error(next.error)
    runtime=next.runtime; resize(); runtime.start(); refresh(); await settle()
    return { retired,current:status() }
  },
  showInspector(show:boolean){ host.style.display=show?'block':'none'; refresh() },
  dispose(){runtime.dispose();realPump?.dispose();void realContext?.close();return status()},
}
declare global { interface Window { __ifritProduction?:typeof api } }
window.__ifritProduction=api
addEventListener('resize',resize)
addEventListener('beforeunload',()=>{inspector.unmount();runtime.dispose()},{once:true})
