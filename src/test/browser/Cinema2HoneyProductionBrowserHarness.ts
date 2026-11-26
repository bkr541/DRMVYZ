import { createElement } from 'react'
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../features/musicIntelligence/types'
import { Cinema2AudioIntelligenceBridge } from '../../components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge'
import { createRoot } from 'react-dom/client'
import { Cinema2Runtime,type Cinema2RuntimeTransportSnapshot } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_HONEY_PRESET_ID,honeyParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2HoneyPreset'
import { CINEMA2_RUNTIME_FOUNDATION_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { CINEMA2_QUALITY_MODE_PARAMETER_ID } from '../../components/vyzualz/cinema2/parameters/Cinema2PerformanceParameters'
import type { Cinema2PresetId } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { Cinema2PresetsPanel } from '../../components/vyzualz/react/Cinema2PresetsPanel'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import '../../styles.css'
import '../../styles/vyzualz.css'
import '../../styles/reactView.css'

const phase06=new URLSearchParams(location.search).get('phase')==='06'
let playStart=0
let transport:Cinema2RuntimeTransportSnapshot={sourcePresent:false,playing:false,analysisActive:false,paused:false,trackId:null,timeSec:0,bpmSync:true,bpm:120}
const transportState=()=>({...transport,timeSec:transport.playing?transport.timeSec+(performance.now()-playStart)/1000:transport.timeSec})
// The test injects the same typed MI source the production bridge consumes. No extra analyzer,
// synthetic renderer or alternate choreography runtime is installed.
let source:MusicIntelligenceFrame=DEFAULT_MI_FRAME,sequence=0
const bridgeSource={getFrame:()=>source,getPublicationMeta:()=>({sequence,publishedAtMs:source.timeSec*1000,publisherId:'honey-production-fixture',kind:'frame' as const})}
function publishAudio(patch:Partial<MusicIntelligenceFrame>={}){
  source={...DEFAULT_MI_FRAME,sourceId:'honey-production-fixture',trackId:transport.trackId,frameId:++sequence,timeSec:transportState().timeSec,
    capabilities:{...DEFAULT_MI_FRAME.capabilities!,liveBands:true,rhythmEvents:true,beatGrid:true,stemCurves:true,sections:true},
    rhythm:{...DEFAULT_MI_FRAME.rhythm,bpm:transport.bpm??120,bpmConfidence:1,transientConfidence:1},
    confidence:{...DEFAULT_MI_FRAME.confidence,overall:1,rhythm:1,section:1},...patch}
}
const canvas=document.querySelector<HTMLCanvasElement>('#honey-production')!
let runtime:Cinema2Runtime,active=CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,captureNext:((png:string)=>void)|null=null
const rail=document.createElement('aside');rail.style.cssText='position:fixed;left:0;top:0;bottom:0;width:320px;overflow:auto;background:#111820;color:white;display:none';document.body.append(rail)
const inspector=document.createElement('aside');inspector.style.cssText='position:fixed;right:0;top:0;bottom:0;width:320px;overflow:auto;background:#111820;color:white;display:none';document.body.append(inspector)
const railRoot=createRoot(rail),inspectorRoot=createRoot(inspector)
const resize=()=>runtime.resize({width:innerWidth,height:innerHeight,dpr:1})
const refresh=()=>{railRoot.render(createElement(Cinema2PresetsPanel,{activePresetId:active,onSelectPreset:select}));inspectorRoot.render(createElement(Cinema2InspectorPanel,{runtime,surface:'design',sharedAudioAnalysis:false}))}
function select(id:Cinema2PresetId,serializedParameterState?:string){
  runtime?.dispose();active=id
  const result=Cinema2Runtime.create(canvas,{presetId:id,serializedParameterState,...(phase06?{}:{renderQuality:'high' as const}),diagnosticsEnabled:true,randomness:{mode:'deterministic',seed:'honey-review'},requestAnimationFrame:cb=>requestAnimationFrame(t=>{cb(t);if(captureNext){const done=captureNext;captureNext=null;done(canvas.toDataURL('image/png'))}}),cancelAnimationFrame:id=>cancelAnimationFrame(id),transportSource:{getState:transportState},audioIntelligenceBridge:new Cinema2AudioIntelligenceBridge(bridgeSource)})
  if(!result.runtime)throw Error(result.error);runtime=result.runtime;if(phase06&&id===CINEMA2_HONEY_PRESET_ID&&!serializedParameterState)runtime.getParameterState().setPersistentValue(CINEMA2_QUALITY_MODE_PARAMETER_ID,'quality');resize();runtime.start();refresh()
}
const settle=async()=>{for(let i=0;i<5;i++)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))}
const status=()=>({active,runtime:runtime.getSnapshot(),performance:runtime.getPerformanceSnapshot(),modules:runtime.getModuleRuntimeSnapshot(),render:runtime.getRenderGraphExecutorSnapshot(),resources:runtime.getResourceManagerSnapshot(),effects:runtime.getEffectRuntimeSnapshot(),shadow:runtime.getShadowServiceSnapshot()})
const api={status,camera:()=>runtime.getCameraRuntimeSnapshot().camera,
  async quality(mode:'auto'|'performance'|'balanced'|'quality'){const result=runtime.getParameterState().setPersistentValue(CINEMA2_QUALITY_MODE_PARAMETER_ID,mode);if(!result.ok)throw Error(JSON.stringify(result.diagnostics));await settle();return status()},
  async benchmark(frames=30){const intervals:number[]=[];let previous:number|null=null;for(let i=0;i<=frames;i++){const t=await new Promise<number>(resolve=>requestAnimationFrame(resolve));if(previous!==null)intervals.push(t-previous);previous=t}const sorted=[...intervals].sort((a,b)=>a-b),mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;const gl=canvas.getContext('webgl2')!,info=gl.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),width:canvas.width,height:canvas.height,frames,meanMs:mean,fps:1000/mean,p50:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.floor((sorted.length-1)*.95)],p99:sorted[Math.floor((sorted.length-1)*.99)],status:status()}},
  async recoverContext(){const ext=canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');if(!ext)throw Error('WEBGL_lose_context unavailable');const generation=runtime.getSnapshot().contextGeneration;const lost=new Promise<void>(resolve=>canvas.addEventListener('webglcontextlost',()=>resolve(),{once:true}));ext.loseContext();await lost;const restored=new Promise<void>(resolve=>canvas.addEventListener('webglcontextrestored',()=>resolve(),{once:true}));ext.restoreContext();await restored;await settle();if(runtime.getSnapshot().contextGeneration<=generation)throw Error('Context generation did not advance');return status()},
  async captureOutput(){const stream=canvas.captureStream(30),video=document.createElement('video');video.muted=true;video.srcObject=stream;try{await video.play();await new Promise<void>(resolve=>video.requestVideoFrameCallback(()=>resolve()));const copy=document.createElement('canvas');copy.width=video.videoWidth;copy.height=video.videoHeight;copy.getContext('2d')!.drawImage(video,0,0);return copy.toDataURL('image/png')}finally{video.pause();video.srcObject=null;stream.getTracks().forEach(track=>track.stop())}},
  saved:()=>runtime.getParameterState().serialize(),async audioFixture(input:{band?:'sub'|'bass'|'lowMid'|'mid'|'high'|'air';cue?:'kick'|'snare'|'downbeat'|'phrase'|'drop';vocal?:boolean;energy?:number;build?:number;grid?:boolean;section?:'build'|'drop'|'breakdown'}={}){
  const names={sub:'normalizedSub',bass:'normalizedBass',lowMid:'normalizedLowMid',mid:'normalizedMid',high:'normalizedHigh',air:'normalizedAir'} as const
  const time=transportState().timeSec,cue=input.cue
  publishAudio({bands:{...DEFAULT_MI_FRAME.bands,...(input.band?{[names[input.band]]:1}:{})},energy:{...DEFAULT_MI_FRAME.energy,instant:input.energy??0,rms:input.energy??0,buildProgress:input.build??0},semantics:{...DEFAULT_MI_FRAME.semantics,buildConfidence:input.build??0},capabilities:{...DEFAULT_MI_FRAME.capabilities!,liveBands:true,rhythmEvents:true,beatGrid:input.grid!==false,stemCurves:true,sections:true},stems:{...DEFAULT_MI_FRAME.stems,vocalActivity:input.vocal?1:0},
    ...(input.section?{section:{...DEFAULT_MI_FRAME.section,type:input.section,label:input.section,startSec:0,endSec:600,confidence:1}}:{}),
    rhythm:{...DEFAULT_MI_FRAME.rhythm,bpm:transport.bpm??120,bpmConfidence:1,transientConfidence:1,kickHit:cue==='kick',kickStrength:cue==='kick'?1:0,snareHit:cue==='snare',snareStrength:cue==='snare'?1:0,downbeatHit:cue==='downbeat'},
    phraseMarkers:cue==='phrase'?[{id:`phrase-${sequence}`,timeSec:time,phraseLength:4,confidence:1}]:[],semanticMoments:cue==='drop'?[{id:`drop-${sequence}`,timeSec:time,type:'drop',confidence:1}]:[],timeSec:time})
  await settle();return status()
},async audioSeek(timeSec:number){transport={...transport,timeSec};playStart=performance.now();publishAudio();await settle();return status()},async play(bpm=120,globalSync=true){const was=transportState();transport={sourcePresent:true,playing:true,analysisActive:true,paused:false,trackId:'honey-browser-fixture',timeSec:was.timeSec,bpmSync:globalSync,bpm};playStart=performance.now();await settle()},async pause(){const was=transportState();transport={...was,playing:false,paused:true};await settle()},async stop(){transport={sourcePresent:false,playing:false,analysisActive:false,paused:false,trackId:null,timeSec:0,bpmSync:true,bpm:120};source={...DEFAULT_MI_FRAME};sequence++;await settle()},async prepare(){await settle();const s=status();if(s.modules.failedModuleCount||s.render.failedPassCount||s.effects.failedEffectCount||s.shadow.lastDiagnostic)throw Error(JSON.stringify(s));return s},capture(){return new Promise<string>(resolve=>{captureNext=resolve})},async set(key:string,value:unknown){const result=runtime.getParameterState().setPersistentValue(honeyParameterId(key),value);if(!result.ok)throw Error(JSON.stringify(result.diagnostics));refresh();await settle()},async reset(){runtime.getParameterState().resetAll();refresh();await settle()},showRail(show:boolean){rail.style.display=show?'block':'none'},showInspector(show:boolean){inspector.style.display=show?'block':'none'},async reenter(){const saved=runtime.getParameterState().serialize();select(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID);await settle();select(CINEMA2_HONEY_PRESET_ID,saved);await settle();return status()},dispose(){runtime.dispose();railRoot.unmount();inspectorRoot.unmount();return status()}}
declare global{interface Window{__honeyProduction?:typeof api}}
select(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID);window.__honeyProduction=api;addEventListener('resize',resize)
