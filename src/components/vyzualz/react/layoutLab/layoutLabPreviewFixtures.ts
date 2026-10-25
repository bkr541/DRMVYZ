import type { LyricManagerTrack, LyricDocumentVersion } from '../../../../features/lyrics/lyricManagerTypes'
import type { LyricCue } from '../../../../types/lyrics'
export const LAB_TRACKS: LyricManagerTrack[] = [
  ['mocha', 'Mocha ID — Nelly Grilz', 'Mocha', 170],
  ['trace', 'Trace of You', 'DVYDRM', 148],
  ['orc', 'Free Orc Vox 1', 'DVYDRM', 145],
].map(([id,title,artist,bpm]) => ({ id: `audio-${id}`, dbId: String(id), title: String(title), artist: String(artist), bpm: Number(bpm), fileName: `${id}.wav`, storagePath: null, durationSec: 225, sampleRate: 48000, channels: 2, fileSizeByte: 43200000, mimeType: 'audio/wav', transcriptionAssets: null, genre: 'Electronic', musicalKey: 'C♯m', createdAt: '2026-10-25T08:00:00Z', lyricVersionCount: 2, activeLyricDocumentId: `${id}-draft`, activeLyricDocumentName: 'AI Draft' }))
export function labDocuments(track: LyricManagerTrack): LyricDocumentVersion[] {
  return ['draft','edit'].map((suffix,index)=>({ id:`${track.dbId}-${suffix}`, userId:'layout-lab-preview', audioTrackId:track.dbId, title:`${track.title} / ${index ? 'Stage Edit':'AI Draft'}`, artist:track.artist ?? '', sourceType:index?'manual':'ai_transcription', sourceFormat:'json', defaultStyle:{fontSize:48,color:'#ffffff',fontFamily:"'Space Grotesk', system-ui, sans-serif"}, defaultAnimation:{},defaultEffects:{},globalOffsetMs:0,isActive:!index,metadata:{},revision:1,createdAt:'2026-10-25T08:00:00Z',updatedAt:'2026-10-25T08:00:00Z',cueCount:4,language:'English',documentReviewStatus:'unreviewed' }))
}
export const LAB_CUES: LyricCue[] = [
  {id:'cue-1',startMs:0,endMs:4000,text:'We light up the night',reviewStatus:'reviewed',confidence:.98},
  {id:'cue-2',startMs:4500,endMs:8500,text:'Let the rhythm take you',reviewStatus:'unreviewed',confidence:.92},
  {id:'cue-3',startMs:9000,endMs:13500,text:'Every color comes alive',reviewStatus:'unreviewed',confidence:.88},
  {id:'cue-4',startMs:14000,endMs:19000,text:'One more time',reviewStatus:'reviewed',confidence:.97},
]
