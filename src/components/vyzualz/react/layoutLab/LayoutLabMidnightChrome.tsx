import { useEffect, useRef, useState } from 'react'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../shared/InfoPopover'
import { RgbWaveformCanvas } from '../../transport/RgbWaveformCanvas'
import { UnderlineDropdown } from '../controls/UnderlineDropdown'
import { LAB_WAVEFORM, LAB_WAVEFORM_CUES, LAB_WAVEFORM_DURATION_SEC, LAB_WAVEFORM_START_SEC } from './layoutLabWaveformFixture'

export function LayoutLabMidnightHeader() {
  return <>
    <div className="ll-header-lead">
      <button className="az-logo" type="button" aria-label="DRMVYZ"><AppIcon kind="brand" className="az-logo-icon" size={26} /><span className="az-logo-mark">DRMVYZ</span></button>
      <span className="ll-option-label">Option B</span>
    </div>
    <div className="fw-app-header-controls"><div className="vz-header ll-b-header-controls" data-react-header-controls>
      <div className="ll-b-output-buttons" role="group" aria-label="React controls">
        <button disabled aria-label="OUTPUT PREVIEW"><i />Output preview</button>
        <button disabled aria-label="Reveal output"><AppIcon kind="eye" size={16} />Reveal</button>
        <button disabled aria-label="Blackout output"><AppIcon kind="blackout" size={16} />Blackout</button>
      </div>
      <div className="ll-b-header-metrics">
        <span><small>Saved</small><strong>11:31 <em>AM</em></strong></span>
        <span><small>Frame rate</small><strong>60 <em>FPS</em></strong></span>
        <span><small>Frame time</small><strong>16.6 <em>ms</em></strong></span>
        <span><small>High quality</small><strong>0 <em>% CPU</em></strong></span>
      </div>
      <button className="ll-b-circle-key" aria-label="Layout Lab" title="Layout Lab"><AppIcon kind="sliders" size={17} /></button>
      <button className="ll-b-circle-key" aria-label="Notifications" title="Notifications"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3ZM10 20h4" /></svg><i /></button>
      <button className="vz-header-avatar" title="Profile"><span className="vz-header-avatar-initials">DV</span></button>
    </div></div>
  </>
}

const TRACKS = [
  { title: 'Mocha ID — Nelly Grillz (Clean Edit)', artist: 'Mocha' },
  { title: 'Birthday Sex × I Know You Want To', artist: 'Jeremih, Max Styler · RAFAEL Edit' },
  { title: 'Trace of You', artist: 'DVYDRM' },
]

function PlayerKey({ icon, label, onClick, active = false, className = '', disabled = false }: {
  icon: AppIconKind; label: string; onClick?: () => void; active?: boolean; className?: string; disabled?: boolean
}) {
  return <button type="button" className={`ll-b-player-key ${className}`} aria-label={label} title={label} aria-pressed={active || undefined} disabled={disabled} onClick={onClick}><AppIcon kind={icon} size={17} /></button>
}

/** A separate player composition: all state stays within the design study. */
export function LayoutLabMidnightAudioDock() {
  const [index, setIndex] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(LAB_WAVEFORM_START_SEC)
  const [volume, setVolume] = useState(.82)
  const [zoom, setZoom] = useState(1)
  const [bpm, setBpm] = useState(129)
  const [sync, setSync] = useState(true)
  const [popover, setPopover] = useState<'source' | 'playlist' | null>(null)
  const [source, setSource] = useState('file')
  const [advance, setAdvance] = useState(true)
  const [loadMode, setLoadMode] = useState('replace')
  const sourceRef = useRef<HTMLButtonElement>(null)
  const playlistRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setTime(value => (value + .1) % LAB_WAVEFORM_DURATION_SEC), 100)
    return () => window.clearInterval(timer)
  }, [playing])
  const track = TRACKS[index]
  const key = (icon: AppIconKind, label: string, handler?: () => void) => <PlayerKey icon={icon} label={label} onClick={handler} />
  return <div className="vz-transport-dock ll-b-player" aria-label="Audio dock">
    <div className="ll-b-player-track">
      <div className="ll-b-record-sleeve"><span aria-hidden="true" /><i aria-hidden="true" /><button className="ll-b-player-key ll-b-replace-track" aria-label="Replace Track" title="Replace Track"><AppIcon kind="plus" size={13} /></button></div>
      <div className="ll-b-player-track-copy"><strong>{track.title}</strong><span>{track.artist}</span></div>
      <div className="ll-b-player-transport">
        <PlayerKey icon="previous" label="Previous track" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))} />
        <PlayerKey icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} className="az-play-btn" onClick={() => setPlaying(value => !value)} />
        <PlayerKey icon="next" label="Next track" disabled={index === TRACKS.length - 1} onClick={() => setIndex(value => Math.min(TRACKS.length - 1, value + 1))} />
        <AppIcon kind="volume" size={14} /><input type="range" aria-label="Track volume" min={0} max={1} step={.01} value={volume} onChange={event => setVolume(Number(event.target.value))} />
      </div>
    </div>
    <div className="ll-b-player-progression">
      <div className="ll-b-waveform-heading"><span>Track progression</span><span>{Math.floor(time / 60)}:{String(Math.floor(time % 60)).padStart(2, '0')}<i> / 1:59</i></span></div>
      <div className="ll-b-player-waveform"><RgbWaveformCanvas analysis={LAB_WAVEFORM} duration={LAB_WAVEFORM_DURATION_SEC} currentTime={time} markers={LAB_WAVEFORM_CUES} onSeek={setTime} zoom={zoom} monochrome showCueMarkerLines={false} /></div>
      <div className="ll-b-player-zoom">{key('minus', 'Zoom out', () => setZoom(value => Math.max(1, value / 2)))}{key('plus', 'Zoom in', () => setZoom(value => Math.min(16, value * 2)))}</div>
    </div>
    <div className="ll-b-player-tempo"><div><strong>{Math.floor(bpm)}<span>.{bpm.toFixed(2).split('.')[1]}</span></strong><small>BPM</small></div><input className="ll-b-player-tempo-meter" type="range" min={40} max={300} step={.01} value={bpm} aria-label="BPM override" onChange={event => setBpm(Number(event.target.value))} /><span className="ll-b-player-source-label">Source <b>{source === 'file' ? 'Rekordbox' : 'Live input'}</b></span></div>
    <div className="ll-b-player-tools">
      {key('tap', 'Tap tempo')}{key('cue', 'Jump to cue (0:00)', () => setTime(0))}<PlayerKey icon="sync" label="BPM Sync" active={sync} onClick={() => setSync(value => !value)} />
      <button ref={playlistRef} className="ll-b-player-key" aria-label="Playlist" title="Playlist" aria-expanded={popover === 'playlist'} onClick={() => setPopover(value => value === 'playlist' ? null : 'playlist')}><AppIcon kind="playlist" size={17} /></button>
      {key('timeline', 'Open the Track Timeline Visualizer')}
      <button ref={sourceRef} className="ll-b-player-key vz-dock-source-trigger" aria-label="Audio source & Rekordbox" title="Audio source & Rekordbox" aria-expanded={popover === 'source'} onClick={() => setPopover(value => value === 'source' ? null : 'source')}><AppIcon kind="sliders" size={17} /></button>
    </div>
    <InfoPopover open={popover === 'source'} anchorRef={sourceRef} title="Audio source" width={300} placement="above" align="end" onOpenChange={() => setPopover(null)}>
      <div className="ll-b-player-popover-fields"><UnderlineDropdown label="Input" ariaLabel="Audio input" value={source} onChange={setSource} options={[{ value: 'file', label: 'Track input' }, { value: 'live', label: 'Live input' }]} /><UnderlineDropdown label="Rekordbox" value="tools" options={[{ value: 'tools', label: 'RB Tools' }]} /></div>
    </InfoPopover>
    <InfoPopover open={popover === 'playlist'} anchorRef={playlistRef} title="Playlist" width={360} placement="above" align="end" onOpenChange={() => setPopover(null)}>
      <div className="ll-b-player-popover-fields"><label className="ll-b-queue-advance">Automatic advance<input type="checkbox" checked={advance} onChange={event => setAdvance(event.target.checked)} /></label><UnderlineDropdown label="New track loads" value={loadMode} onChange={setLoadMode} options={[{ value: 'replace', label: 'Replace queue' }, { value: 'append', label: 'Append to queue' }]} />
        {TRACKS.map((item, i) => <div className={`ll-b-queue-row${i === index ? ' is-active' : ''}`} key={item.title}><button className="ll-b-queue-select" onClick={() => setIndex(i)}><span>0{i + 1}</span><div><strong>{item.title}</strong><small>{item.artist}</small></div>{i === index && <AppIcon kind="check" size={16} />}</button><button className="ll-b-queue-remove" aria-label={`Remove ${item.title} from playlist`}><AppIcon kind="delete" size={15} /></button></div>)}
      </div>
    </InfoPopover>
  </div>
}
