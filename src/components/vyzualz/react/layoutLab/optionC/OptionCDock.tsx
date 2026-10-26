import { useEffect, useRef, useState } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../../shared/InfoPopover'
import { RgbWaveformCanvas } from '../../../transport/RgbWaveformCanvas'
import { isDockBlankSpace } from '../../../shared/dockBlankSpace'
import { LAB_WAVEFORM, LAB_WAVEFORM_CUES, LAB_WAVEFORM_DURATION_SEC, LAB_WAVEFORM_START_SEC } from '../layoutLabWaveformFixture'
import { OcKey, OcRange, OcSelect, OcSwitch } from './ocControls'

const TRACKS = [
  { title: 'Mocha ID - Nelly Grillz (Clean Edit) 8A 170', artist: 'Mocha' },
  { title: 'Jeremih x Max Styler - Birthday Sex x I Know You Want To (RAFAEL Edit) 6A 129', artist: 'Jeremih, Max Styler' },
  { title: 'Trace of You', artist: 'DVYDRM' },
]
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/** Fixture transport, with original queue/source choices and no audio decoding. */
export function OptionCDock() {
  const [index, setIndex] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
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
    const timer = window.setInterval(() => setTime(value => value + .1 >= LAB_WAVEFORM_DURATION_SEC ? LAB_WAVEFORM_START_SEC : value + .1), 100)
    return () => window.clearInterval(timer)
  }, [playing])
  const track = TRACKS[index]!
  return <section className="oc-dock oc-surface" data-collapsed={collapsed} aria-label="Audio dock" onClick={event => { if (isDockBlankSpace(event.target, event.currentTarget)) setCollapsed(value => !value) }}>
    <div className="oc-record"><span className={`oc-record-art${playing ? ' is-playing' : ''}`} aria-hidden="true"><AppIcon kind="navMedia" size={20} /></span><div><span className="oc-caption">NOW LOADED <em>{String(index + 1).padStart(2, '0')} / 03</em></span><strong title={track.title}>{track.title}</strong><span>{track.artist}</span></div><OcKey icon="plus" label="Replace Track" /></div>
    <div className="oc-transport"><OcKey icon="previous" label="Previous track" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))} /><OcKey icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} className="oc-play" onClick={() => setPlaying(value => !value)} /><OcKey icon="next" label="Next track" disabled={index === TRACKS.length - 1} onClick={() => setIndex(value => Math.min(TRACKS.length - 1, value + 1))} /></div>
    <div className="oc-wave-deck"><div className="oc-waveform"><RgbWaveformCanvas analysis={LAB_WAVEFORM} duration={LAB_WAVEFORM_DURATION_SEC} currentTime={time} markers={LAB_WAVEFORM_CUES} onSeek={setTime} zoom={zoom} ownerDocumentSizing monochrome showCueMarkerLines={false} /></div><div className="oc-wave-meta"><span><strong>{clock(time)}</strong> <em>/ {clock(LAB_WAVEFORM_DURATION_SEC)}</em></span><div><span>{zoom}×</span><OcKey icon="minus" label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value / 2))} /><OcKey icon="plus" label="Zoom in" disabled={zoom >= 16} onClick={() => setZoom(value => Math.min(16, value * 2))} /></div></div><input className="oc-progress" type="range" aria-label="Track position" min={0} max={LAB_WAVEFORM_DURATION_SEC} step={.1} value={time} onChange={event => setTime(Number(event.target.value))} /></div>
    <div className="oc-tempo"><label><span className="oc-caption">TEMPO / BPM</span><input type="number" aria-label="BPM override" min={40} max={300} step={.01} value={bpm} onChange={event => { if (event.target.value) setBpm(Math.min(300, Math.max(40, Number(event.target.value)))) }} /></label><span className="oc-tempo-origin">Rekordbox · cues / sections</span><div className="oc-tempo-keys"><OcKey icon="tap" label="Tap tempo" /><OcKey icon="cue" label="Jump to cue (0:00)" /><OcKey icon="sync" label={sync ? 'BPM Sync: ON' : 'BPM Sync: OFF'} active={sync} onClick={() => setSync(value => !value)} />{bpm !== 129 && <OcKey icon="rotateLeft" label="Reset BPM" onClick={() => setBpm(129)} />}</div></div>
    <div className="oc-dock-actions"><button type="button" className="oc-key" ref={sourceRef} aria-label="Audio source & Rekordbox" title="Audio source & Rekordbox" aria-expanded={popover === 'source'} onClick={() => setPopover(value => value === 'source' ? null : 'source')}><AppIcon kind="sliders" size={17} /></button><button type="button" className="oc-key" ref={playlistRef} aria-label="Playlist" title="Playlist" aria-expanded={popover === 'playlist'} onClick={() => setPopover(value => value === 'playlist' ? null : 'playlist')}><AppIcon kind="playlist" size={17} /></button><OcKey icon="timeline" label="Open the Track Timeline Visualizer" /><button type="button" className="oc-key" title={collapsed ? 'Expand audio dock' : 'Collapse audio dock'} aria-label={collapsed ? 'Expand audio dock' : 'Collapse audio dock'} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}><AppIcon kind={collapsed ? 'chevronUp' : 'chevronDown'} size={16} /></button></div>
    <div className="oc-dock-level"><AppIcon kind="volume" size={15} /><OcRange label="Track volume" value={volume} step={.005} onChange={setVolume} format={value => value < .001 ? '−∞ dB' : `${(20 * Math.log10(value)).toFixed(1)} dB`} /></div>
    <InfoPopover className="oc-popover" open={popover === 'source'} anchorRef={sourceRef} title="Audio source" width={300} placement="above" align="end" onOpenChange={() => setPopover(null)}><OcSelect label="Input" value={source} onChange={setSource} options={[{ value: 'file', label: 'Track Input' }, { value: 'microphone', label: 'Live Input' }, { value: 'demo', label: 'Demo Signal' }]} /><OcSelect label="Rekordbox" value="" onChange={() => {}} options={[{ value: 'xml', label: 'Import XML…' }, { value: 'usb', label: 'Scan USB…' }, { value: 'mode', label: 'Arm USB Mode' }]} /></InfoPopover>
    <InfoPopover className="oc-popover" open={popover === 'playlist'} anchorRef={playlistRef} title="Playlist" width={390} placement="above" align="end" onOpenChange={() => setPopover(null)}><OcSwitch label="Automatic advance" value={advance} onChange={setAdvance} /><OcSelect label="New track loads" value={loadMode} onChange={setLoadMode} options={[{ value: 'replace', label: 'Replace queue' }, { value: 'append', label: 'Append to queue' }]} /><div className="oc-queue">{TRACKS.map((item, i) => <div className="oc-queue-row" key={item.title}><button type="button" aria-pressed={i === index} onClick={() => setIndex(i)}><span>0{i + 1}</span><div><strong>{item.title}</strong><small>{item.artist}</small></div>{i === index && <AppIcon kind="check" size={14} />}</button><OcKey icon="delete" label={`Remove ${item.title} from playlist`} /></div>)}</div></InfoPopover>
  </section>
}
