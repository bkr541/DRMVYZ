import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { UnderlineDropdown } from '../controls/UnderlineDropdown'
import { IconChipButton } from '../controls/IconChipButton'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { TrackScrubber } from '../../../shared/TrackScrubber'
import { LAYOUT_LAB_DESIGNS, LAYOUT_LAB_WORKSPACES, type LayoutLabDesignId, type LayoutLabWorkspaceId } from './layoutLabDesignCatalog'
import './layoutLabDesignWorkbench.css'
import './templateAudioTheme.css'
const CinemaPreview=lazy(()=>import('./LayoutLabCinemaPreview').then(module=>({default:module.LayoutLabCinemaPreview})))
const LyricPreview=lazy(()=>import('./LayoutLabLyricPreview').then(module=>({default:module.LayoutLabLyricPreview})))

export function LayoutLabDesignWorkbench({reference,initialWorkspace='cinema2'}:{reference:ReactNode;initialWorkspace?:LayoutLabWorkspaceId}) {
  const rootRef=useRef<HTMLDivElement>(null)
  const [design,setDesign]=useState<LayoutLabDesignId>('design-01')
  const [workspace,setWorkspace]=useState<LayoutLabWorkspaceId>(initialWorkspace)
  const [visited,setVisited]=useState<LayoutLabWorkspaceId[]>([initialWorkspace])
  const [playing,setPlaying]=useState(false)
  const [time,setTime]=useState(1)
  useEffect(()=>{
    if(!playing)return
    const timer=setInterval(()=>setTime(value=>(value+.1)%225),100)
    return ()=>clearInterval(timer)
  },[playing])
  useEffect(()=>{
    const doc=rootRef.current?.ownerDocument.documentElement
    if(!doc)return
    const previousPreview=doc.getAttribute('data-layout-lab-preview'),previousDesign=doc.getAttribute('data-layout-lab-design')
    doc.setAttribute('data-layout-lab-preview','true');doc.setAttribute('data-layout-lab-design',design)
    return ()=>{if(previousPreview==null)doc.removeAttribute('data-layout-lab-preview');else doc.setAttribute('data-layout-lab-preview',previousPreview);if(previousDesign==null)doc.removeAttribute('data-layout-lab-design');else doc.setAttribute('data-layout-lab-design',previousDesign)}
  },[design])
  const selectWorkspace=(value:string)=>{const next=value as LayoutLabWorkspaceId;setWorkspace(next);setVisited(previous=>previous.includes(next)?previous:[...previous,next])}
  const selectedDesign=LAYOUT_LAB_DESIGNS.find(option=>option.value===design)!
  const themeClass='themeClassName' in selectedDesign?selectedDesign.themeClassName:''
  const transport=<div className="ll-preview-transport" aria-label="Isolated preview transport"><span><strong>Preview transport</strong><small>Sample timeline · no audio output</small></span><IconChipButton aria-label={playing?'Pause preview':'Play preview'} onClick={()=>setPlaying(value=>!value)} icon={<AppIcon kind={playing?'pause':'play'} size={16}/>} /><TrackScrubber currentTime={time} duration={225} onSeek={setTime} /></div>
  return <div ref={rootRef} className="ll-design-workbench" data-lab-design={design} data-lab-workspace={workspace}>
    <header className="ll-design-toolbar"><div><span>LAYOUT LAB</span><strong>Workspace design preview</strong></div><UnderlineDropdown ariaLabel="Layout Lab design" eyebrow="Design" size="compact" value={design} disabled={workspace==='reference'} options={LAYOUT_LAB_DESIGNS} onChange={value=>setDesign(value as LayoutLabDesignId)} /><UnderlineDropdown ariaLabel="Layout Lab workspace" eyebrow="Workspace" size="compact" value={workspace} options={LAYOUT_LAB_WORKSPACES} onChange={selectWorkspace}/><p>Local preview<br/><span>Changes never save to your project</span></p></header>
    <div className={`rv-shell ll-design-stage${themeClass && workspace!=='reference'?` ${themeClass}`:''}`}>
      <Suspense fallback={<div className="ll-preview-loading" role="status">Loading workspace components…</div>}>
        {visited.includes('cinema2')&&<div className="ll-design-workspace" hidden={workspace!=='cinema2'}><CinemaPreview active={workspace==='cinema2'} transport={transport}/></div>}
        {visited.includes('lyrics')&&<div className="ll-design-workspace" hidden={workspace!=='lyrics'}><LyricPreview time={time} playing={playing&&workspace==='lyrics'} onSeek={setTime} transport={transport}/></div>}
        {workspace==='reference'&&reference}
      </Suspense>
    </div>
  </div>
}
