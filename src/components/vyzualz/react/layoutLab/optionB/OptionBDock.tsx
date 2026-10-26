import { useEffect, useRef, useState } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../../shared/InfoPopover'
import { RgbWaveformCanvas } from '../../../transport/RgbWaveformCanvas'
import { LAB_WAVEFORM, LAB_WAVEFORM_CUES, LAB_WAVEFORM_DURATION_SEC, LAB_WAVEFORM_START_SEC } from '../layoutLabWaveformFixture'
import { ObKey, ObSelect, ObSwitch } from './obControls'

const TRACKS = [
  { title: 'Mocha ID — Nelly Grillz (Clean Edit)', artist: 'Mocha' },
  { title: 'Birthday Sex × I Know You Want To', artist: 'Jeremih, Max Styler · RAFAEL Edit' },
  { title: 'Trace of You', artist: 'DVYDRM' },
]
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/** The same fixture analysis and disconnected transport, composed as a two-level editing deck. */
export function OptionBDock() {
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
  const track = TRACKS[index]!
  return <section className="ob-dock" aria-label="Audio dock">
    <div className="ob-deck-wave"><div className="ob-deck-wave-label"><span className="ob-eyebrow">TRACK PROGRESSION</span><small>{zoom}×</small></div><div className="ob-waveform"><RgbWaveformCanvas analysis={LAB_WAVEFORM} duration={LAB_WAVEFORM_DURATION_SEC} currentTime={time} markers={LAB_WAVEFORM_CUES} onSeek={setTime} zoom={zoom} monochrome showCueMarkerLines={false} /></div><div className="ob-zoom"><ObKey icon="minus" label="Zoom out" onClick={() => setZoom(value => Math.max(1, value / 2))} /><ObKey icon="plus" label="Zoom in" onClick={() => setZoom(value => Math.min(16, value * 2))} /></div></div>
    <div className="ob-deck-controls">
      <div className="ob-track"><div className="ob-track-art" aria-hidden="true"><AppIcon kind="navMedia" size={21} /></div><div className="ob-track-copy ll-b-player-track-copy"><small>NOW LOADED / 0{index + 1}</small><strong title={track.title}>{track.title}</strong><span>{track.artist}</span></div><ObKey icon="plus" label="Replace Track" /></div>
      <div className="ob-transport"><ObKey icon="previous" label="Previous track" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))} /><ObKey icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} className="ob-play" onClick={() => setPlaying(value => !value)} /><ObKey icon="next" label="Next track" disabled={index === TRACKS.length - 1} onClick={() => setIndex(value => Math.min(TRACKS.length - 1, value + 1))} /></div>
      <div className="ob-clock"><strong>{clock(time)}</strong><small>/ {clock(LAB_WAVEFORM_DURATION_SEC)}</small></div>
      <div className="ob-tempo"><div><strong>{Math.floor(bpm)}<em>.{bpm.toFixed(2).split('.')[1]}</em></strong><small>BPM</small></div><input type="range" min={40} max={300} step={.01} value={bpm} aria-label="BPM override" onChange={event => setBpm(Number(event.target.value))} /></div>
      <div className="ob-deck-utilities"><div><ObKey icon="tap" label="Tap tempo" /><ObKey icon="cue" label="Jump to cue (0:00)" onClick={() => setTime(0)} /><ObKey icon="sync" label="BPM Sync" active={sync} onClick={() => setSync(value => !value)} /></div><label className="ob-volume"><AppIcon kind="volume" size={14} /><input type="range" aria-label="Track volume" min={0} max={1} step={.01} value={volume} onChange={event => setVolume(Number(event.target.value))} /></label></div>
      <div className="ob-source"><button type="button" className="ob-source-button" ref={sourceRef} aria-label="Audio source & Rekordbox" aria-expanded={popover === 'source'} onClick={() => setPopover(value => value === 'source' ? null : 'source')}><AppIcon kind="sliders" size={15} /><span><small>AUDIO SOURCE</small><strong>{source === 'file' ? 'Rekordbox' : 'Live input'}</strong></span><AppIcon kind="chevronUp" size={12} /></button></div>
      <div className="ob-deck-actions"><button type="button" className="ob-key" ref={playlistRef} aria-label="Playlist" title="Playlist" aria-expanded={popover === 'playlist'} onClick={() => setPopover(value => value === 'playlist' ? null : 'playlist')}><AppIcon kind="playlist" size={18} /></button><ObKey icon="timeline" label="Open the Track Timeline Visualizer" /></div>
    </div>
    <InfoPopover className="ob-popover" open={popover === 'source'} anchorRef={sourceRef} title="Audio source" width={300} placement="above" align="end" onOpenChange={() => setPopover(null)}><ObSelect label="Input" value={source} onChange={setSource} options={[{ value: 'file', label: 'Track input' }, { value: 'live', label: 'Live input' }]} /><ObSelect label="Rekordbox" value="tools" onChange={() => {}} options={[{ value: 'tools', label: 'RB Tools' }]} /></InfoPopover>
    <InfoPopover className="ob-popover" open={popover === 'playlist'} anchorRef={playlistRef} title="Playlist" width={380} placement="above" align="end" onOpenChange={() => setPopover(null)}><ObSwitch label="Automatic advance" value={advance} onChange={setAdvance} /><ObSelect label="New track loads" value={loadMode} onChange={setLoadMode} options={[{ value: 'replace', label: 'Replace queue' }, { value: 'append', label: 'Append to queue' }]} /><div className="ob-queue">{TRACKS.map((item, i) => <div className="ob-queue-row" key={item.title}><button type="button" aria-pressed={i === index} onClick={() => setIndex(i)}><span>0{i + 1}</span><div><strong>{item.title}</strong><small>{item.artist}</small></div>{i === index && <AppIcon kind="check" size={14} />}</button><ObKey icon="delete" label={`Remove ${item.title} from playlist`} /></div>)}</div></InfoPopover>
  </section>
}
