import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_TRIPPY_BRO_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2TrippyBroPreset'
import { CINEMA2_RUNTIME_FOUNDATION_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import type { Cinema2ParameterId, Cinema2PresetId, Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { createCinema2DesignParentGroupModel } from '../../components/vyzualz/cinema2/parameters/Cinema2InspectorModel'
import { TRIPPY_BRO_CHANNELS } from '../../components/vyzualz/cinema2/presets/Cinema2TrippyBroChoreography'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { trippyBroMusicFixture, type TrippyBroFixtureOptions } from '../support/TrippyBroMusicFixture'
import '../../styles/typography.css'
import '../../styles.css'
import '../../styles/vyzualz.css'
import '../../styles/reactView.css'

const canvas = document.querySelector<HTMLCanvasElement>('#trippy-bro-production')
if (!canvas) throw new Error('Trippy, Bro review canvas is missing.')
AudioFeatureBus.reset()
let timestamp=0, targetTime=0, musicTime=0, paused=false, source=false, bpm=120, sequence=0, dirty=false
let fixture: Partial<TrippyBroFixtureOptions> = {}
let published = trippyBroMusicFixture({ timeSec: 0, frameId: 0 })
let quality: Cinema2RenderQualityLevel = 'high'
let runtime: Cinema2Runtime
let captureNext: ((png: string) => void) | null = null
const create = (presetId: Cinema2PresetId = CINEMA2_TRIPPY_BRO_PRESET_ID, serializedParameterState?: string) => Cinema2Runtime.create(canvas, {
  presetId, serializedParameterState, renderQuality: quality, diagnosticsEnabled: true,
  randomness: { mode: 'deterministic', seed: 'trippy-bro-review' },
  requestAnimationFrame: callback => requestAnimationFrame(() => {
    const before=timestamp
    timestamp=Math.min(targetTime,timestamp+1000/60)
    if(source && (before!==timestamp || dirty)) {
      if(!paused) musicTime+=(timestamp-before)/1000
      published=trippyBroMusicFixture({ ...fixture, bpm, timeSec: musicTime, frameId: ++sequence })
      AudioFeatureBus.setFrame(published)
      dirty=false
    }
    callback(timestamp)
    // Capture the actual final production canvas before WebGL's default buffer is retired.
    if (captureNext) { const complete=captureNext; captureNext=null; complete(canvas.toDataURL('image/png')) }
  }), cancelAnimationFrame: id => cancelAnimationFrame(id),
  transportSource: { getState: () => ({ sourcePresent: source, playing: source&&!paused, analysisActive: source, paused,
    trackId: source ? published.trackId : null, timeSec: source ? musicTime : timestamp/1000, bpm, bpmSync: false }) },
})
const result=create()
if(!result.runtime) throw new Error(result.error)
runtime=result.runtime
const host=document.createElement('aside')
host.id='trippy-bro-inspector'
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
  performance:runtime.getPerformanceSnapshot(),
  channels:Object.fromEntries(TRIPPY_BRO_CHANNELS.map(name=>{const target=runtime.getCompiledPresetPlan().targets.targets.find(t=>t.kind==='module'&&t.property===name);return [name,target?runtime.getTargetResolver().resolve(target.id).value:null]})),
  choreography:runtime.getChoreographyRuntimeSnapshot(), parameters:runtime.getParameterState().getSnapshot(),
  groups:createCinema2DesignParentGroupModel(runtime.getCompiledPresetPlan(),runtime.getParameterState().getSnapshot()),
})
const api={
  status,
  capture(){ return new Promise<string>(resolve=>{ captureNext=resolve }) },
  async prepare(){ await settle(); const s=status(); if(s.modules.failedModuleCount || s.render.failedPassCount) throw new Error(JSON.stringify(s)); return s },
  async set(values:Record<string,unknown>){
    for(const [name,value] of Object.entries(values)) {
      const id=(name.startsWith('trippy-bro-') ? name : `trippy-bro-${name}`) as Cinema2ParameterId
      const changed=runtime.getParameterState().setPersistentValue(id,value)
      if(!changed.ok) throw new Error(JSON.stringify(changed.diagnostics))
    }
    refresh(); await settle(); return status()
  },
  async reset(){ runtime.getParameterState().resetAll(); refresh(); await settle(); return status() },
  async music(options:Partial<TrippyBroFixtureOptions>, enabled=true){
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
    const next=create(CINEMA2_TRIPPY_BRO_PRESET_ID,saved)
    if(!next.runtime) throw new Error(next.error)
    runtime=next.runtime; resize(); runtime.start(); refresh(); await settle()
    return { retired,current:status() }
  },
  showInspector(show:boolean){ host.style.display=show?'block':'none'; refresh() },
  dispose(){runtime.dispose();return status()},
}
declare global { interface Window { __trippyBroProduction?:typeof api } }
window.__trippyBroProduction=api
addEventListener('resize',resize)
addEventListener('beforeunload',()=>{inspector.unmount();runtime.dispose()},{once:true})
