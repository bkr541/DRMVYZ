import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { getLoadedCinema2ThreeLibrary, setCinema2ThreeLibraryLoaderForTests, type Cinema2ThreeLibrary } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeLibrary'
import { CINEMA2_SPECTRUM_MEDIA_SLOT, CINEMA2_SPECTRUM_PRESET_ID } from '../../components/vyzualz/cinema2/presets/Cinema2SpectrumPreset'
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
type MusicStage='build'|'drop'|'breakdown'
let stage:MusicStage='breakdown',stageFrame=0
let fixtureLibrary:Cinema2ThreeLibrary|null=null,releaseLoad:(()=>void)|null=null
let lastRetired:ReturnType<typeof status>|null=null
let captureNext:((png:string)=>void)|null=null
const resize=()=>runtime.resize({width:innerWidth,height:innerHeight,dpr:1})
function select(id:Cinema2PresetId){
  runtime?.dispose();const retired=runtime?status():null;lastRetired=retired;active=id;last=0
  const result=Cinema2Runtime.create(canvas,{presetId:id,diagnosticsEnabled:true,randomness:{mode:'deterministic',seed:'spectrum-regression'},
    requestAnimationFrame:cb=>requestAnimationFrame(t=>{
      if(source&&!paused){
        if(last)time+=Math.min(.1,(t-last)/1000)
        const energy=stage==='drop'?.95:stage==='build'?.65:.16
        const event=stage==='drop'&&stageFrame===0?'drop':stageFrame%15===0?'kick':null
        const frame=trippyBroMusicFixture({timeSec:time,frameId:++sequence,bpm:120,energy,bass:energy,high:energy*.7,build:stage==='build'?.7:0,event,eventId:sequence,advanceBeatGrid:true})
        AudioFeatureBus.setFrame({...frame,section:{...frame.section,type:stage,intensity:energy}});stageFrame++
      }
      last=t;cb(t);if(captureNext){const done=captureNext;captureNext=null;done(canvas.toDataURL('image/png'))}
    }),cancelAnimationFrame:id=>cancelAnimationFrame(id),
    transportSource:{getState:()=>({sourcePresent:source,playing:source&&!paused,analysisActive:source,paused,trackId:source?trippyBroMusicFixture({timeSec:time,frameId:sequence}).trackId:null,timeSec:time,bpm:120,bpmSync:true})}})
  if(!result.runtime)throw Error(result.error)
  runtime=result.runtime;resize();runtime.start();railRoot.render(createElement(Cinema2PresetsPanel,{activePresetId:active,onSelectPreset:select}));return retired
}
const status=()=>({active,runtime:runtime.getSnapshot(),modules:runtime.getModuleRuntimeSnapshot(),render:runtime.getRenderGraphExecutorSnapshot(),resources:runtime.getResourceManagerSnapshot(),media:runtime.getMediaSlotRuntimeSnapshot()})
const api={status,retired:()=>lastRetired,showRail(show:boolean){rail.style.display=show?'block':'none'},capture(){return new Promise<string>(resolve=>{captureNext=resolve})},
  select,play(next:MusicStage='breakdown'){source=true;paused=false;stage=next;stageFrame=0},pause(){paused=true},seek(){time=0;last=0;stageFrame=0},reset(){runtime.getParameterState().resetAll()},
  quality(mode:'performance'|'balanced'|'quality'){const r=runtime.getParameterState().setPersistentValue(CINEMA2_QUALITY_MODE_PARAMETER_ID,mode);if(!r.ok)throw Error(JSON.stringify(r.diagnostics))},
  procedural(){const r=runtime.getParameterState().setPersistentValue('spectrum-source-mode' as Cinema2ParameterId,'procedural');if(!r.ok)throw Error(JSON.stringify(r.diagnostics))},
  pattern(value:string){const r=runtime.getParameterState().setPersistentValue('spectrum-pattern' as Cinema2ParameterId,value);if(!r.ok)throw Error(JSON.stringify(r.diagnostics))},
  async media(remove:boolean){
    const slots=runtime.getMediaSlotRuntime()
    if(remove)slots.remove(CINEMA2_SPECTRUM_MEDIA_SLOT)
    else {
      const image=document.createElement('canvas');image.width=320;image.height=180
      const ctx=image.getContext('2d')!;ctx.fillStyle='#ff2222';ctx.fillRect(0,0,160,180);ctx.fillStyle='#2277ff';ctx.fillRect(160,0,160,180)
      const result=await slots.replace(CINEMA2_SPECTRUM_MEDIA_SLOT,{id:'qa03-rgb',label:'QA-03 fixture',kind:'image',url:image.toDataURL(),width:320,height:180},{fit:'contain'})
      if(result.status!=='ready')throw Error(JSON.stringify(result))
    }
    return status()
  },
  renderer(){const gl=canvas.getContext('webgl2')!;const ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR),renderer:gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),unmasked:!!ext}},
  // Test-only loader boundary: retain the actual library for recovery, never supply substitute pixels.
  fixture(mode:'reject'|'delay'|'fatal'|'restore'){
    if(mode==='restore'){releaseLoad?.();releaseLoad=null;setCinema2ThreeLibraryLoaderForTests(null);return}
    fixtureLibrary=fixtureLibrary??getLoadedCinema2ThreeLibrary()
    const real=fixtureLibrary;if(!real)throw Error('Fixture requires a previously loaded library')
    if(mode==='reject')setCinema2ThreeLibraryLoaderForTests(async()=>{throw Error('QA-03 injected library rejection')})
    if(mode==='fatal')setCinema2ThreeLibraryLoaderForTests(async()=>({...real,THREE:{...real.THREE,Group:class {constructor(){throw Error('QA-03 injected arena construction failure')}}} as unknown as Cinema2ThreeLibrary['THREE']}))
    if(mode==='delay')setCinema2ThreeLibraryLoaderForTests(()=>new Promise(resolve=>{releaseLoad=()=>resolve(real)}))
  },
  releaseLoad(){releaseLoad?.();releaseLoad=null},
  async recoverContext(){
    const gl=canvas.getContext('webgl2')!,ext=gl.getExtension('WEBGL_lose_context');if(!ext)throw Error('WEBGL_lose_context unavailable')
    const generation=runtime.getSnapshot().contextGeneration
    const wait=async(predicate:()=>boolean)=>{for(let i=0;i<240;i++){if(predicate())return;await new Promise(r=>setTimeout(r,25))}throw Error('Context lifecycle timed out')}
    ext.loseContext();await wait(()=>runtime.getSnapshot().phase==='context-lost');const lost=status()
    ext.restoreContext();await wait(()=>runtime.getSnapshot().phase==='running'&&runtime.getSnapshot().contextGeneration>generation)
    return {lost,restored:status()}
  },
  glError(){return canvas.getContext('webgl2')!.getError()},
  dispose(){runtime.dispose();railRoot.unmount();AudioFeatureBus.reset();removeEventListener('resize',resize);return status()},
}
declare global{interface Window{__spectrumProduction?:typeof api}}
AudioFeatureBus.reset();select(CINEMA2_SPECTRUM_PRESET_ID);window.__spectrumProduction=api;addEventListener('resize',resize)
