import '../../../../styles/lyricManager.css'
import { useState, type ReactNode } from 'react'
import { WorkspaceRail } from '../../layout/WorkspaceRail'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { RailTabs } from '../../layout/RailTabs'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { LyricTrackBrowser } from '../../../../features/lyrics/components/LyricTrackBrowser'
import { LyricDocumentSidebar } from '../../../../features/lyrics/components/LyricDocumentSidebar'
import { LyricInspector } from '../../../../features/lyrics/components/LyricInspector'
import { LyricCueInspector } from '../../../../features/lyrics/editor/LyricCueInspector'
import { LyricDocumentPresentationPanel } from '../../../../features/lyrics/components/LyricDocumentPresentationPanel'
import { LyricLivePreviewPanel } from '../../../../features/lyrics/components/LyricPreviewPanel'
import { LyricCueTimeline } from '../../../../features/lyrics/editor/LyricCueTimeline'
import { LyricReviewSummary } from '../../../../features/lyrics/components/LyricReviewSummary'
import type { LyricManagerTrack, LyricDocumentVersion } from '../../../../features/lyrics/lyricManagerTypes'
import type { LyricCue } from '../../../../types/lyrics'
import { Collapsible } from '../ReactControlRows'
import { LAB_TRACKS, LAB_CUES, labDocuments } from './layoutLabPreviewFixtures'

export function LayoutLabLyricPreview({time,playing,onSeek,transport}:{time:number;playing:boolean;onSeek:(seconds:number)=>void;transport:ReactNode}) {
  const [tracks,setTracks]=useState(LAB_TRACKS)
  const [trackId,setTrackId]=useState(LAB_TRACKS[0].dbId)
  const [loaded,setLoaded]=useState(LAB_TRACKS[0].dbId)
  const [documents,setDocuments]=useState(()=>Object.fromEntries(LAB_TRACKS.map(track=>[track.dbId,labDocuments(track)])))
  const [documentId,setDocumentId]=useState(`${LAB_TRACKS[0].dbId}-draft`)
  const [cueSets,setCueSets]=useState<Record<string,LyricCue[]>>({})
  const [selectedCueId,setSelectedCueId]=useState('cue-1')
  const [query,setQuery]=useState('')
  const [tab,setTab]=useState<'cue'|'document'|'review'>('cue')
  const [leftTab,setLeftTab]=useState<'tracks'|'versions'>('tracks')
  const [notice,setNotice]=useState('')
  const track=tracks.find(item=>item.dbId===trackId) ?? tracks[0]
  const versions=documents[track.dbId] ?? []
  const document=versions.find(item=>item.id===documentId) ?? versions[0]
  const cues=cueSets[document.id] ?? LAB_CUES
  const selectedCue=cues.find(cue=>cue.id===selectedCueId) ?? cues[0]
  const selectTrack=(item:LyricManagerTrack)=>{setTrackId(item.dbId);setDocumentId(documents[item.dbId][0].id);setSelectedCueId('cue-1')}
  const patchDocument=(patch:Partial<LyricDocumentVersion>)=>setDocuments(previous=>({...previous,[track.dbId]:previous[track.dbId].map(item=>item.id===document.id?{...item,...patch}:item)}))
  const patchCue=(id:string,patch:Partial<LyricCue>)=>setCueSets(previous=>({...previous,[document.id]:(previous[document.id]??LAB_CUES).map(cue=>cue.id===id?{...cue,...patch}:cue)}))
  return <>
    <div className="rv-layout ll-workbench-layout lmv-root ll-preview-lyrics">
      <WorkspaceRail side="left" label="Preview tracks and versions">
        <RailWindowHeader side="left" label="Tracks & Versions" icon={<AppIcon kind="waveform" size={15}/>} />
        <RailTabs variant="underline" tabs={[{id:'tracks',label:'Tracks'},{id:'versions',label:'Versions'}]} activeTab={leftTab} onChange={setLeftTab} ariaLabel="Preview track library tabs" />
        <div className="ll-preview-rail-scroll">
          <div hidden={leftTab!=='tracks'}><LyricTrackBrowser tracks={tracks} selectedTrackId={trackId} loadedAudioTrackId={loaded} playingAudioTrackId={playing?loaded:null} search={query} loading={false} error={null} hasMore={false} onSearchChange={setQuery} onSelectTrack={selectTrack} onLoadTrack={item=>{selectTrack(item);setLoaded(item.dbId)}} onOpenActiveLyrics={item=>{selectTrack(item);setLeftTab('versions')}} onOpenAiExtract={()=>setNotice('Extraction uses an external service and is unavailable in the design preview.')} onMakeOpenVersionActive={()=>patchDocument({isActive:true})} canMakeOpenVersionActive={()=>false} onDeleteTrack={item=>{if(tracks.length<2){setNotice('Keep one sample track for the preview.');return}const next=tracks.filter(t=>t.id!==item.id);setTracks(next);if(item.dbId===trackId)selectTrack(next[0])}} onLoadMore={()=>{}} onRetry={()=>{}} /></div>
          <div hidden={leftTab!=='versions'}><LyricDocumentSidebar documents={versions} loading={false} openDocumentId={document.id} hasSelectedTrack onSelectDocument={item=>setDocumentId(item.id)} onDuplicateDocument={item=>{const id=`${item.id}-copy-${versions.length}`;setDocuments(previous=>({...previous,[track.dbId]:[...previous[track.dbId],{...item,id,title:`${item.title} copy`,isActive:false}]}));setCueSets(previous=>({...previous,[id]:(previous[item.id]??LAB_CUES).map(cue=>({...cue}))}));setDocumentId(id)}} onRenameDocument={(item,title)=>setDocuments(previous=>({...previous,[track.dbId]:previous[track.dbId].map(doc=>doc.id===item.id?{...doc,title}:doc)}))} onActivateDocument={item=>setDocuments(previous=>({...previous,[track.dbId]:previous[track.dbId].map(doc=>({...doc,isActive:doc.id===item.id}))}))} onDeleteDocument={item=>{if(versions.length<2){setNotice('Keep one sample document for the preview.');return}setDocuments(previous=>({...previous,[track.dbId]:previous[track.dbId].filter(doc=>doc.id!==item.id)}))}} /></div>
          {notice&&<p className="rv-ctrl-info" role="status">{notice}</p>}
        </div>
      </WorkspaceRail>
      <div className="rv-center-col ll-preview-lyric-center">
        <div className="ll-preview-lyric-live"><LyricLivePreviewPanel cues={cues} document={document} selectedCue={selectedCue} currentAudioTimeMs={time*1000} isPlaying={playing} onPreviewLyrics={()=>setNotice('The center displays this local document. No performance output was changed.')} track={track} loading={false} selectedTrackLoaded={loaded===trackId} onLoadTrack={()=>setLoaded(trackId)} /></div>
        <Collapsible label="Track Timeline"><LyricCueTimeline cues={cues} selectedCueId={selectedCue.id} currentTimeMs={time*1000} durationMs={20000} zoom={1} waveformPeaks={Array.from({length:160},(_,index)=>.15+Math.abs(Math.sin(index*.31))*.7)} snapContext={{mode:'none'}} onSelectCue={id=>{if(id)setSelectedCueId(id)}} onSeek={ms=>onSeek(ms/1000)} onCommitCue={patchCue} /></Collapsible>
        <Collapsible label="Cue List"><div className="ll-preview-cue-list">{cues.map(cue=><button key={cue.id} onClick={()=>{setSelectedCueId(cue.id);onSeek(cue.startMs/1000)}} aria-pressed={selectedCue.id===cue.id}><span>{(cue.startMs/1000).toFixed(2)}s</span><strong>{cue.text}</strong></button>)}</div></Collapsible>
      </div>
      <WorkspaceRail side="right" label="Preview document workspace">
        <RailWindowHeader side="right" label="Document Workspace" icon={<AppIcon kind="file" size={15}/>} />
        <div className="ll-preview-rail-scroll"><LyricInspector activeTab={tab} onTabChange={setTab} cue={<LyricCueInspector cue={selectedCue} cues={cues} durationMs={225000} onUpdateCue={patchCue} />} document={<LyricDocumentPresentationPanel defaultStyle={document.defaultStyle} defaultAnimation={document.defaultAnimation} defaultEffects={document.defaultEffects} onUpdateDefaultStyle={patch=>patchDocument({defaultStyle:{...document.defaultStyle,...patch}})} onUpdateDefaultAnimation={patch=>patchDocument({defaultAnimation:{...document.defaultAnimation,...patch}})} onUpdateDefaultEffects={patch=>patchDocument({defaultEffects:{...document.defaultEffects,...patch}})} />} review={<LyricReviewSummary cues={cues} onOpenReview={()=>setTab('cue')} />} /></div>
      </WorkspaceRail>
    </div>{transport}
  </>
}
