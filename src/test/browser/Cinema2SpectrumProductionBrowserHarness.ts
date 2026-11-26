import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_SPECTRUM_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2SpectrumPreset'
import { CINEMA2_QUALITY_MODE_PARAMETER_ID } from '../../components/vyzualz/cinema2/parameters/Cinema2PerformanceParameters'
import type { Cinema2ParameterId, Cinema2PresetId } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { Cinema2PresetsPanel } from '../../components/vyzualz/react/Cinema2PresetsPanel'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { trippyBroMusicFixture } from '../support/TrippyBroMusicFixture'
import '../../styles.css'
import '../../styles/vyzualz.css'
import '../../styles/reactView.css'

const canvas=document.querySelector<HTMLCanvasElement>('#spectrum-production')!
const rail=document.createElement('aside');rail.style.cssText='position:fixed;left:0;top:0;bottom:0;width:320px;overflow:auto;background:#111820;color:white;display:none';document.body.append(rail)
const railRoot=createRoot(rail)
let runtime:Cinema2Runtime,active=CINEMA2_SPECTRUM_PRESET_ID,source=false,paused=false,time=0,last=0,sequence=0
let captureNext:((png:string)=>void)|null=null
const resize=()=>runtime.resize({width:innerWidth,height:innerHeight,dpr:1})
function select(id:Cinema2PresetId){
  runtime?.dispose();active=id;last=0
  const result=Cinema2Runtime.create(canvas,{presetId:id,diagnosticsEnabled:true,randomness:{mode:'deterministic',seed:'spectrum-regression'},
    requestAnimationFrame:cb=>requestAnimationFrame(t=>{
      if(source&&!paused){if(last)time+=Math.min(.1,(t-last)/1000);AudioFeatureBus.setFrame(trippyBroMusicFixture({timeSec:time,frameId:++sequence,bpm:120}))}
      last=t;cb(t);if(captureNext){const done=captureNext;captureNext=null;done(canvas.toDataURL('image/png'))}
    }),cancelAnimationFrame:id=>cancelAnimationFrame(id),
    transportSource:{getState:()=>({sourcePresent:source,playing:source&&!paused,analysisActive:source,paused,trackId:source?trippyBroMusicFixture({timeSec:time,frameId:sequence}).trackId:null,timeSec:time,bpm:120,bpmSync:true})}})
  if(!result.runtime)throw Error(result.error)
  runtime=result.runtime;resize();runtime.start();railRoot.render(createElement(Cinema2PresetsPanel,{activePresetId:active,onSelectPreset:select}))
}
const status=()=>({active,modules:runtime.getModuleRuntimeSnapshot(),render:runtime.getRenderGraphExecutorSnapshot()})
const api={status,showRail(show:boolean){rail.style.display=show?'block':'none'},capture(){return new Promise<string>(resolve=>{captureNext=resolve})},
  play(){source=true;paused=false},pause(){paused=true},seek(){time=0;last=0},reset(){runtime.getParameterState().resetAll()},
  quality(mode:'performance'|'balanced'|'quality'){const r=runtime.getParameterState().setPersistentValue(CINEMA2_QUALITY_MODE_PARAMETER_ID,mode);if(!r.ok)throw Error(JSON.stringify(r.diagnostics))},
  procedural(){const r=runtime.getParameterState().setPersistentValue('spectrum-source-mode' as Cinema2ParameterId,'procedural');if(!r.ok)throw Error(JSON.stringify(r.diagnostics))},
  glError(){return canvas.getContext('webgl2')!.getError()},
  dispose(){runtime.dispose();railRoot.unmount();AudioFeatureBus.reset();return status()},
}
declare global{interface Window{__spectrumProduction?:typeof api}}
AudioFeatureBus.reset();select(CINEMA2_SPECTRUM_PRESET_ID);window.__spectrumProduction=api;addEventListener('resize',resize)
