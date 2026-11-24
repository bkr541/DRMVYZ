import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_HONEY_PRESET_ID,honeyParameterId } from '../../components/vyzualz/cinema2/presets/Cinema2HoneyPreset'
import { CINEMA2_RUNTIME_FOUNDATION_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import type { Cinema2PresetId } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { Cinema2PresetsPanel } from '../../components/vyzualz/react/Cinema2PresetsPanel'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import '../../styles.css'
import '../../styles/vyzualz.css'
import '../../styles/reactView.css'

const canvas=document.querySelector<HTMLCanvasElement>('#honey-production')!
let runtime:Cinema2Runtime,active=CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,captureNext:((png:string)=>void)|null=null
const rail=document.createElement('aside');rail.style.cssText='position:fixed;left:0;top:0;bottom:0;width:320px;overflow:auto;background:#111820;color:white;display:none';document.body.append(rail)
const inspector=document.createElement('aside');inspector.style.cssText='position:fixed;right:0;top:0;bottom:0;width:320px;overflow:auto;background:#111820;color:white;display:none';document.body.append(inspector)
const railRoot=createRoot(rail),inspectorRoot=createRoot(inspector)
const resize=()=>runtime.resize({width:innerWidth,height:innerHeight,dpr:1})
const refresh=()=>{railRoot.render(createElement(Cinema2PresetsPanel,{activePresetId:active,onSelectPreset:select}));inspectorRoot.render(createElement(Cinema2InspectorPanel,{runtime,surface:'design',sharedAudioAnalysis:false}))}
function select(id:Cinema2PresetId,serializedParameterState?:string){
  runtime?.dispose();active=id
  const result=Cinema2Runtime.create(canvas,{presetId:id,serializedParameterState,renderQuality:'high',diagnosticsEnabled:true,randomness:{mode:'deterministic',seed:'honey-review'},requestAnimationFrame:cb=>requestAnimationFrame(t=>{cb(t);if(captureNext){const done=captureNext;captureNext=null;done(canvas.toDataURL('image/png'))}}),cancelAnimationFrame:id=>cancelAnimationFrame(id),transportSource:{getState:()=>({sourcePresent:false,playing:false,analysisActive:false,paused:false,trackId:null,timeSec:0,bpmSync:true})}})
  if(!result.runtime)throw Error(result.error);runtime=result.runtime;resize();runtime.start();refresh()
}
const settle=async()=>{for(let i=0;i<5;i++)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))}
const status=()=>({active,modules:runtime.getModuleRuntimeSnapshot(),render:runtime.getRenderGraphExecutorSnapshot(),resources:runtime.getResourceManagerSnapshot()})
const api={status,async prepare(){await settle();const s=status();if(s.modules.failedModuleCount||s.render.failedPassCount)throw Error(JSON.stringify(s));return s},capture(){return new Promise<string>(resolve=>{captureNext=resolve})},async set(key:string,value:unknown){const result=runtime.getParameterState().setPersistentValue(honeyParameterId(key),value);if(!result.ok)throw Error(JSON.stringify(result.diagnostics));refresh();await settle()},async reset(){runtime.getParameterState().resetAll();refresh();await settle()},showRail(show:boolean){rail.style.display=show?'block':'none'},showInspector(show:boolean){inspector.style.display=show?'block':'none'},async reenter(){const saved=runtime.getParameterState().serialize();select(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID);await settle();select(CINEMA2_HONEY_PRESET_ID,saved);await settle();return status()},dispose(){runtime.dispose();railRoot.unmount();inspectorRoot.unmount();return status()}}
declare global{interface Window{__honeyProduction?:typeof api}}
select(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID);window.__honeyProduction=api;addEventListener('resize',resize)
