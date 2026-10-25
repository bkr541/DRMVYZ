import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Cinema2Runtime, cinema2NativePresetRegistry, type Cinema2PresetId, type Cinema2RuntimeSnapshot } from '../../cinema2'
import { Cinema2PresetRegistry } from '../../cinema2/presets/Cinema2PresetRegistry'
import { Cinema2PresetsPanel } from '../Cinema2PresetsPanel'
import { Cinema2InspectorPanel } from '../Cinema2InspectorPanel'
import { Cinema2RuntimeDiagnostics } from '../Cinema2RuntimeDiagnostics'
import { Cinema2LayersPanel } from '../Cinema2LayersPanel'
import { WorkspaceRail } from '../../layout/WorkspaceRail'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { RailTabs } from '../../layout/RailTabs'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { Collapsible, SelectRow } from '../ReactControlRows'
import { Cinema2AudioIntelligenceBridge } from '../../cinema2/audio/Cinema2AudioIntelligenceBridge'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { AudioTrackCard } from '../../media/AudioTrackCard'
import { LAB_TRACKS } from './layoutLabPreviewFixtures'

/** A private registry and runtime: production rendering without saved-session access. */
export function LayoutLabCinemaPreview({ transport, active }: {transport: ReactNode; active: boolean}) {
  const catalog = useMemo(()=>{
    const presets = cinema2NativePresetRegistry.list().filter(p=>['drmvyz.cinema2.vacancy','drmvyz.cinema2.electric-storm','drmvyz.cinema2.afterhours'].includes(p.id))
    const base=presets.find(p=>p.id==='drmvyz.cinema2.vacancy') ?? presets[0]
    if(!base) throw new Error('Layout Lab requires a registered Cinema 2.0 preset.')
    const saved={...base,id:'drmvyz.cinema2.lab-saved-vacancy' as Cinema2PresetId, metadata:{...base.metadata,name:'Vacancy · Late Night',description:'Local design-preview saved preset.'}}
    const registry=new Cinema2PresetRegistry()
    for(const preset of [...presets,saved]) { const result=registry.register(preset); if(!result.ok) throw new Error(result.diagnostics.map(d=>d.message).join('; ')) }
    return {presets:[...presets,saved],userIds:new Set([saved.id]),registry,initial:base.id}
  },[])
  const [presetId,setPresetId]=useState(catalog.initial)
  const [runtime,setRuntime]=useState<Cinema2Runtime|null>(null)
  const [snapshot,setSnapshot]=useState<Cinema2RuntimeSnapshot|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [leftTab,setLeftTab]=useState<'source'|'layers'>('source')
  const [rightTab,setRightTab]=useState<'presets'|'design'|'react'|'output'>('design')
  const [loaded,setLoaded]=useState('mocha')
  const [media,setMedia]=useState('static')
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const savedStates=useRef(new Map<string,string>())
  useEffect(()=>{
    const canvas=canvasRef.current
    if(!canvas) return
    setRuntime(null);setMedia('static')
    const owner=canvas.ownerDocument.defaultView!
    const states=savedStates.current
    let lastPublish=0,active=true
    const result=Cinema2Runtime.create(canvas,{presetId,presetRegistry:catalog.registry,serializedParameterState:states.get(presetId),renderQuality:'medium',audioIntelligenceBridge:new Cinema2AudioIntelligenceBridge({getFrame:()=>DEFAULT_MI_FRAME,getPublicationMeta:()=>({sequence:0,publisherId:'layout-lab-isolated',kind:'frame',publishedAtMs:0})}),requestAnimationFrame:owner.requestAnimationFrame.bind(owner),cancelAnimationFrame:owner.cancelAnimationFrame.bind(owner),onSnapshot:next=>{if(active && owner.performance.now()-lastPublish>500){lastPublish=owner.performance.now();setSnapshot(next)}}})
    if(!result.runtime){setError(result.error);return}
    const current=result.runtime
    setRuntime(current);setError(null);setSnapshot(current.getSnapshot())
    const resize=()=>{const box=canvas.parentElement!.getBoundingClientRect();current.resize({width:Math.max(1,box.width),height:Math.max(1,box.height),dpr:Math.min(1.5,owner.devicePixelRatio||1)})}
    const observer=new owner.ResizeObserver(resize);observer.observe(canvas.parentElement!);resize();current.start()
    const monitor=owner.setInterval(()=>{if(active)setSnapshot(current.getSnapshot())},500)
    return ()=>{active=false;states.set(presetId,current.getParameterState().serialize());owner.clearInterval(monitor);observer.disconnect();current.dispose()}
  },[presetId,catalog])
  useEffect(()=>{ runtime?.setSuspended(!active) },[runtime,active])
  const selectMedia=async(value:string)=>{
    setMedia(value)
    if(!runtime)return
    const slots=runtime.getMediaSlotRuntime(),slot=slots.getSnapshot().slots[0]
    if(!slot)return
    if(value==='static'){slots.remove(slot.id);return}
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#1b1b21"/><circle cx="256" cy="256" r="145" fill="none" stroke="#68d1df" stroke-width="24"/><path d="M125 256h262M256 125v262" stroke="#e8ac86" stroke-width="14"/></svg>'
    await slots.replace(slot.id,{id:'lab-artwork',label:'Lab artwork',kind:'svg',url:`data:image/svg+xml,${encodeURIComponent(svg)}`})
  }
  return <>
    <div className="rv-layout ll-workbench-layout">
      <WorkspaceRail side="left" label="Preview source and layers">
        <RailWindowHeader side="left" label="Source Library" icon={<AppIcon kind="navMedia" size={15}/>} />
        <RailTabs variant="underline" tabs={[{id:'source',label:'Source'},{id:'layers',label:'Layers'}]} activeTab={leftTab} onChange={setLeftTab} ariaLabel="Preview source tabs" />
        <div className="ll-preview-rail-scroll">
          <div hidden={leftTab!=='source'}><Collapsible label="Audio Tracks">{LAB_TRACKS.map(track=><AudioTrackCard key={track.id} track={track} loading={false} loaded={loaded===track.dbId} playing={false} canLoad canOpenLyrics={false} canRemove={false} isActive={loaded===track.dbId} artwork={<span>{track.title.slice(0,2).toUpperCase()}</span>} onLoad={()=>setLoaded(track.dbId)} onSelect={()=>setLoaded(track.dbId)} />)}</Collapsible>
          <Collapsible label="Screen media"><SelectRow label="Screen source" value={media} onChange={value=>void selectMedia(value)} options={[{value:'static',label:'Preset static'},{value:'artwork',label:'Lab artwork'}]} description="Enable Media on Screens in Design to display the artwork." /></Collapsible></div>
          <div hidden={leftTab!=='layers'}><Cinema2LayersPanel runtime={runtime} /></div>
        </div>
      </WorkspaceRail>
      <div className="rv-center-col"><div className="rv-canvas-wrap ll-preview-canvas" data-preview-phase={snapshot?.phase} data-preview-gpu-bytes={runtime?.getModuleRuntimeSnapshot().estimatedGpuBytes ?? 0}><canvas ref={canvasRef} aria-label="Live Cinema 2.0 preview" />{error&&<div role="alert" className="ll-preview-error">{error}</div>}</div><div className="ll-preview-caption">{catalog.presets.find(p=>p.id===presetId)?.metadata.name} · private Cinema runtime</div></div>
      <WorkspaceRail side="right" label="Cinema 2.0 preview inspector">
        <RailWindowHeader side="right" label="Preset Workspace" icon={<AppIcon kind="cinema" size={15}/>} />
        <RailTabs variant="underline" tabs={[{id:'presets',label:'Presets'},{id:'design',label:'Design'},{id:'react',label:'React'},{id:'output',label:'Output'}]} activeTab={rightTab} onChange={setRightTab} ariaLabel="Preview inspector tabs" />
        <div className="ll-preview-rail-content">
          <div hidden={rightTab!=='presets'}><Cinema2PresetsPanel activePresetId={presetId} onSelectPreset={setPresetId} catalog={catalog} /></div>
          <div hidden={rightTab!=='design'}><Cinema2InspectorPanel runtime={runtime} surface="design" sharedAudioAnalysis={false}/></div>
          <div hidden={rightTab!=='react'}><Cinema2InspectorPanel runtime={runtime} surface="react" sharedAudioAnalysis={false}/></div>
          <div hidden={rightTab!=='output'} className="ll-preview-rail-scroll"><Cinema2RuntimeDiagnostics runtime={runtime} snapshot={snapshot}/></div>
        </div>
      </WorkspaceRail>
    </div>{transport}
  </>
}
