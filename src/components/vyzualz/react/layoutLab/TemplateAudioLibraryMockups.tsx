import { useState, type CSSProperties } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { IconChipButton } from '../controls/IconChipButton'
import { PresetSearchRow } from '../controls/PresetSearchRow'
import { UnderlineDropdown } from '../controls/UnderlineDropdown'
import './templateAudioLibraryMockups.css'

const TRACKS = [
  { id: 'mocha', artist: 'Mocha', title: 'Mocha ID — Nelly Grilz', meta: '3:45 · 170 BPM · C♯m', kind: 'Loaded', tone: '#68d1df' },
  { id: 'trace', artist: 'DVYDRM', title: 'Trace of You', meta: '2:42 · 148 BPM · Fm', kind: 'Analyzed', tone: '#e8ac86' },
  { id: 'orc', artist: 'DVYDRM', title: 'Free Orc Vox 1', meta: '1:52 · 145 BPM · A♭m', kind: 'Vocal', tone: '#b2a0df' },
  { id: 'after', artist: 'DVYDRM', title: 'After the Lights', meta: '4:08 · 140 BPM · Dm', kind: 'Analyzed', tone: '#e8ac86' },
  { id: 'glass', artist: 'DVYDRM', title: 'Glass Houses', meta: '3:16 · 150 BPM · Gm', kind: 'New', tone: '#68d1df' },
  { id: 'static', artist: 'DVYDRM', title: 'Static Hearts', meta: '2:58 · 172 BPM · Bm', kind: 'Analyzed', tone: '#e8ac86' },
  { id: 'night', artist: 'DVYDRM', title: 'Night Drive', meta: '3:38 · 128 BPM · Am', kind: 'New', tone: '#68d1df' },
  { id: 'outro', artist: 'DVYDRM', title: 'One More Night', meta: '4:21 · 145 BPM · Em', kind: 'Vocal', tone: '#b2a0df' },
] as const

type Study = 'audio' | 'uploads' | 'lyrics'
const STUDIES: { id: Study; number: string; title: string; description: string }[] = [
  { id: 'audio', number: '01', title: 'User Audio', description: 'A personal audio collection. Compact production-height rows with quiet status markers and track details.' },
  { id: 'uploads', number: '02', title: 'Uploaded Tracks', description: 'The same collection as a file library, with format, analysis state and musical details kept secondary.' },
  { id: 'lyrics', number: '03', title: 'Lyric Manager · Left Window', description: 'A compact single-column track library above lyric versions. Selection carries through to the version cards.' },
]

function LibraryStudy({ id, number, title, description }: typeof STUDIES[number]) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState('mocha')
  const [version, setVersion] = useState('draft')
  const [menu, setMenu] = useState<string | null>(null)
  const visible = TRACKS.filter(track => `${track.artist} ${track.title}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || track.kind.toLowerCase() === filter))
  const current = TRACKS.find(track => track.id === selected)!
  return (
    <section className={`ll-audio-study ll-audio-study--${id}`} aria-label={`${title} mockup`}>
      <div className="ll-audio-study-caption"><span>{number} /</span><div><h2>{title}</h2><p>{description}</p></div><span className="ll-audio-concept">CONCEPT</span></div>
      <div className="ll-audio-stage">
        <div className="ll-audio-reference-rail" aria-hidden="true"><AppIcon kind="waveform" size={20} /><AppIcon kind="navMedia" size={16} /><AppIcon kind="navLyrics" size={16} /><AppIcon kind="plus" size={16} /></div>
        <div className="ll-audio-surface">
          <header className="ll-audio-heading"><div><span className="ll-audio-eyebrow">YOUR WORKSPACE</span><h3>{id === 'audio' ? 'Your audio' : id === 'uploads' ? 'Uploaded tracks' : 'Tracks'}</h3></div><IconChipButton icon={<AppIcon kind="plus" size={14} />} aria-label={`Show all ${title}`} onClick={() => { setQuery(''); setFilter('all') }}>View all</IconChipButton></header>
          <div className="ll-audio-toolbar">
            <UnderlineDropdown ariaLabel={`Filter ${title}`} size="compact" value={filter} onChange={setFilter} options={[{value:'all',label:'All tracks'},{value:'loaded',label:'Loaded'},{value:'analyzed',label:'Analyzed'},{value:'new',label:'New'},{value:'vocal',label:'Vocals'}]} />
            <span>{visible.length} of {TRACKS.length} tracks</span>
            <PresetSearchRow query={query} onQueryChange={setQuery} placeholder="Search tracks…" ariaLabel={`Search ${title}`} />
          </div>
          <div className="ll-audio-card-grid">
            {visible.map(track => (
              <div key={track.id} className={`ll-audio-card${selected === track.id ? ' is-selected' : ''}`} style={{ '--audio-card-accent': track.tone } as CSSProperties}>
                <button className="ll-audio-card-select" type="button" aria-pressed={selected === track.id} aria-label={`Select ${track.title}`} onClick={() => { setSelected(track.id); setMenu(null) }}>
                  <span className="ll-audio-card-type">{id === 'uploads' ? 'WAV / AUDIO' : track.kind}</span>
                  <span className="ll-audio-card-copy"><span>{track.artist}</span><strong>{track.title}</strong><small>{id === 'uploads' ? `${track.meta} · 48 kHz` : track.meta}</small></span>
                </button>
                <button className="ll-audio-card-more" aria-label={`Details for ${track.title}`} aria-expanded={menu === track.id} onClick={() => setMenu(menu === track.id ? null : track.id)}><span aria-hidden="true">···</span></button>
                {menu === track.id && <div className="ll-audio-card-details" role="status">{track.kind} · {id === 'uploads' ? 'Stereo WAV · 24-bit' : track.meta}</div>}
              </div>
            ))}
          </div>
          {visible.length === 0 && <p className="ll-audio-empty">No matching tracks. Clear the search or choose another filter.</p>}
          {id === 'lyrics' && <div className="ll-audio-versions"><div className="ll-audio-versions-heading"><h3>Versions</h3><span>{current.title}</span></div><div className="ll-audio-version-grid">{[{id:'draft',label:'AI Draft',detail:'69 cues · English',status:'Active'},{id:'edit',label:'Stage edit',detail:'64 cues · English',status:'Saved'}].map(item=><button key={item.id} className={`ll-audio-version${version === item.id ? ' is-selected' : ''}`} aria-pressed={version === item.id} onClick={()=>setVersion(item.id)}><span>{item.status}</span><strong>{current.title} / {item.label}</strong><small>{item.detail}</small></button>)}</div></div>}
          <footer className="ll-audio-footer"><span><i />{current.title}</span><span>Selected · visual study only</span></footer>
        </div>
      </div>
    </section>
  )
}

/** Local-only studies; never reads or changes the user's audio or lyric stores. */
export function TemplateAudioLibraryMockups() {
  return <div className="ll-audio-studies" aria-label="Audio library mockups">{STUDIES.map(study=><LibraryStudy key={study.id} {...study} />)}</div>
}
