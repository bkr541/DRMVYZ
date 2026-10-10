import { useState, type CSSProperties, type ReactNode } from 'react'
import rekordboxLogoUrl from '../../../../assets/rekordbox_logo.svg'

type SourceModeId = 'rekordbox' | 'file' | 'live' | 'stream' | 'empty'

interface SourceMode {
  id: SourceModeId
  button: string
  name: string
  route: string
  status: string
  bpm: string
  key: string
  format: string
  dockTag: string
  accent: string
}

const SOURCE_MODES: SourceMode[] = [
  { id: 'rekordbox', button: 'RBX', name: 'Rekordbox USB', route: 'Deck 1 · USB A', status: 'Grid + 6 cues', bpm: '95.00', key: '8A', format: 'AIFF', dockTag: 'CUES', accent: '#61d6aa' },
  { id: 'file', button: 'FILE', name: 'Local Audio', route: 'Library · Mac', status: 'Analyzed locally', bpm: '124.00', key: '11B', format: 'WAV', dockTag: 'TRACK', accent: '#4ac7db' },
  { id: 'live', button: 'LIVE', name: 'Live Input', route: 'Input 1 · Stereo', status: 'Signal locked', bpm: '—', key: '—', format: '48K', dockTag: 'INPUT 1', accent: '#61d6aa' },
  { id: 'stream', button: 'NET', name: 'Network Stream', route: 'Channel 3 · NDI', status: 'Buffer 42 ms', bpm: '128.00', key: '2A', format: 'PCM', dockTag: 'STREAM', accent: '#a77df0' },
  { id: 'empty', button: 'NONE', name: 'No Source', route: 'Awaiting input', status: 'Offline', bpm: '—', key: '—', format: '—', dockTag: 'OFFLINE', accent: '#71808a' },
]

function SourceName({ mode }: { mode: SourceMode }) {
  return mode.id === 'rekordbox'
    ? <span className="llsi-rekordbox-name"><img src={rekordboxLogoUrl} alt="Rekordbox" /><small>USB</small></span>
    : <span>{mode.name}</span>
}

function SourceGlyph({ mode }: { mode: SourceMode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {mode.id === 'rekordbox' && <><path d="m12 2.5 7.5 4.25v8.5L12 19.5l-7.5-4.25v-8.5z" /><circle cx="12" cy="11" r="3" /><path d="M12 5v3M12 14v3" /></>}
      {mode.id === 'file' && <><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4" /><path d="M9 13h6M9 16h4" /></>}
      {mode.id === 'live' && <><path d="M8 5.5a7 7 0 0 0 0 13M16 5.5a7 7 0 0 1 0 13" /><circle cx="12" cy="12" r="2.5" /></>}
      {mode.id === 'stream' && <><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" /></>}
      {mode.id === 'empty' && <><circle cx="12" cy="12" r="8" /><path d="m6.5 6.5 11 11" /></>}
    </svg>
  )
}

function DeckOled({ mode }: { mode: SourceMode }) {
  return (
    <div className="llsi-simple-deck">
      <span className="llsi-simple-glyph"><SourceGlyph mode={mode} /></span>
      <strong><SourceName mode={mode} /></strong>
      <span className="llsi-simple-value">{mode.bpm}<small>BPM</small></span>
    </div>
  )
}

function PatchBay({ mode }: { mode: SourceMode }) {
  return (
    <div className="llsi-simple-route">
      <span className="llsi-simple-port"><SourceGlyph mode={mode} /></span>
      <i className={mode.id === 'empty' ? 'is-off' : ''} />
      <span className="llsi-simple-dv">DV</span>
      <strong><SourceName mode={mode} /></strong>
    </div>
  )
}

function PlatterRing({ mode }: { mode: SourceMode }) {
  return (
    <div className="llsi-simple-platter">
      <span><i /><SourceGlyph mode={mode} /></span>
      <strong><SourceName mode={mode} /></strong>
      <small>{mode.status}</small>
    </div>
  )
}

function MixerMeter({ mode }: { mode: SourceMode }) {
  return (
    <div className="llsi-simple-meter">
      <span aria-hidden="true">{[45, 76, 58, 88].map((level, index) => <i key={index} style={{ height: mode.id === 'empty' ? '2px' : `${level}%` }} />)}</span>
      <strong><SourceName mode={mode} /></strong>
      <small><i className={mode.id === 'empty' ? '' : 'is-on'} />{mode.id === 'empty' ? 'IDLE' : 'ACTIVE'}</small>
    </div>
  )
}

function CrateSpine({ mode }: { mode: SourceMode }) {
  return (
    <div className="llsi-simple-label">
      <i />
      <strong><SourceName mode={mode} /></strong>
      <span>{mode.format}</span>
    </div>
  )
}

function DockInline({ mode }: { mode: SourceMode }) {
  return <div className="llsi-dock-inline"><i /><strong><SourceName mode={mode} /></strong><span>{mode.dockTag}</span></div>
}

function DockSeparated({ mode }: { mode: SourceMode }) {
  return <div className="llsi-dock-separated"><i /><SourceGlyph mode={mode} /><strong><SourceName mode={mode} /></strong><span /><small>{mode.dockTag}</small></div>
}

function DockUnderline({ mode }: { mode: SourceMode }) {
  return <div className="llsi-dock-underline"><i /><strong><SourceName mode={mode} /></strong><small>{mode.status}</small><b /></div>
}

function DockSourceKey({ mode }: { mode: SourceMode }) {
  return <div className="llsi-dock-key"><span><SourceGlyph mode={mode} /></span><strong><SourceName mode={mode} /></strong><small>{mode.dockTag}</small></div>
}

function DockDataLine({ mode }: { mode: SourceMode }) {
  return <div className="llsi-dock-data"><i /><strong><SourceName mode={mode} /></strong><span>{mode.bpm !== '—' ? `${mode.bpm} BPM` : mode.format}</span></div>
}

const CONCEPTS: Array<{ id: string; title: string; blurb: string; render: (mode: SourceMode) => ReactNode }> = [
  { id: 'deck-oled', title: '01 · Deck Readout', blurb: 'Source identity with one tempo value.', render: mode => <DeckOled mode={mode} /> },
  { id: 'patch-bay', title: '02 · Signal Route', blurb: 'A minimal input-to-DRMVYZ connection.', render: mode => <PatchBay mode={mode} /> },
  { id: 'platter-ring', title: '03 · Platter Mark', blurb: 'A source icon, name, and short status.', render: mode => <PlatterRing mode={mode} /> },
  { id: 'mixer-meter', title: '04 · Level Strip', blurb: 'Source identity with a compact activity meter.', render: mode => <MixerMeter mode={mode} /> },
  { id: 'crate-spine', title: '05 · Library Label', blurb: 'A restrained source label with format tag.', render: mode => <CrateSpine mode={mode} /> },
  { id: 'dock-inline', title: '06 · Dock Inline', blurb: 'The current dock language with a status light, source name, and one data label.', render: mode => <DockInline mode={mode} /> },
  { id: 'dock-separated', title: '07 · Dock Divider', blurb: 'A source glyph and subtle divider clarify where the metadata begins.', render: mode => <DockSeparated mode={mode} /> },
  { id: 'dock-underline', title: '08 · Dock Underline', blurb: 'A thin source-color rail adds state without introducing another container.', render: mode => <DockUnderline mode={mode} /> },
  { id: 'dock-source-key', title: '09 · Dock Source Key', blurb: 'The existing source-button geometry expanded just enough to identify the signal.', render: mode => <DockSourceKey mode={mode} /> },
  { id: 'dock-data-line', title: '10 · Dock Data Line', blurb: 'A quiet source label with one useful value aligned at the far edge.', render: mode => <DockDataLine mode={mode} /> },
]

export function AudioSourceIndicatorStyleGallery() {
  const [modeId, setModeId] = useState<SourceModeId>('rekordbox')
  const mode = SOURCE_MODES.find(candidate => candidate.id === modeId) ?? SOURCE_MODES[0]

  return (
    <div className="llsi-gallery" aria-label="Audio source indicator concepts" data-source-mode={mode.id} style={{ '--llsi-accent': mode.accent } as CSSProperties}>
      <div className="llsi-mode-bar" role="tablist" aria-label="Audio source mode preview">
        {SOURCE_MODES.map(candidate => (
          <button key={candidate.id} type="button" role="tab" aria-selected={candidate.id === mode.id} className={candidate.id === mode.id ? 'is-active' : ''} onClick={() => setModeId(candidate.id)}>
            {candidate.button}
          </button>
        ))}
      </div>
      {CONCEPTS.map(concept => (
        <section key={concept.id} className="llsi-concept" data-testid={`audio-source-concept-${concept.id}`}>
          <div className="llsi-concept-copy"><span>{concept.title}</span><p>{concept.blurb}</p></div>
          <div className="llsi-stage">
            <div className="llsi-source-control" data-mockup-height="32">{concept.render(mode)}</div>
          </div>
        </section>
      ))}
    </div>
  )
}
