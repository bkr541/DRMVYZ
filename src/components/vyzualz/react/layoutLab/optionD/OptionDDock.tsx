import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../../shared/InfoPopover'
import { RgbWaveformCanvas } from '../../../transport/RgbWaveformCanvas'
import { isDockBlankSpace } from '../../../shared/dockBlankSpace'
import { LAB_WAVEFORM, LAB_WAVEFORM_CUES, LAB_WAVEFORM_DURATION_SEC, LAB_WAVEFORM_START_SEC } from '../layoutLabWaveformFixture'
import { OdKey, OdRange, OdSelect, OdSwitch } from './odControls'

const TRACKS = [
  { title: 'Mocha ID - Nelly Grillz (Clean Edit) 8A 170', artist: 'Mocha' },
  { title: 'Jeremih x Max Styler - Birthday Sex x I Know You Want To (RAFAEL Edit) 6A 129', artist: 'Jeremih, Max Styler' },
  { title: 'Trace of You', artist: 'DVYDRM' },
]
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/** Capsule dock: identity, a lime Play pill, the waveform, a tempo readout, keys and level. Local fixture state only. */
export function OptionDDock() {
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
  const ratio = (time / LAB_WAVEFORM_DURATION_SEC) * 100
  return <section className="od-dock" data-collapsed={collapsed} aria-label="Audio dock" onClick={event => { if (isDockBlankSpace(event.target, event.currentTarget)) setCollapsed(value => !value) }}>
    <div className="od-record">
      <span className={`od-record-art${playing ? ' is-playing' : ''}`} aria-hidden="true"><AppIcon kind="navMedia" size={19} /></span>
      <div><span className="od-eyebrow">NOW LOADED <em>{String(index + 1).padStart(2, '0')} / 03</em></span><strong title={track.title}>{track.title}</strong><span className="od-artist">{track.artist}</span></div>
      <OdKey icon="plus" label="Replace Track" />
    </div>
    <div className="od-transport">
      <OdKey icon="previous" label="Previous track" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))} />
      <button type="button" className="od-play" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(value => !value)}><AppIcon kind={playing ? 'pause' : 'play'} size={18} /><span>{playing ? 'Pause' : 'Play'}</span></button>
      <OdKey icon="next" label="Next track" disabled={index === TRACKS.length - 1} onClick={() => setIndex(value => Math.min(TRACKS.length - 1, value + 1))} />
    </div>
    <div className="od-wave-deck" style={{ '--od-pos': `${ratio}%` } as CSSProperties}>
      <div className="od-time"><strong>{clock(time)}</strong><em>/ {clock(LAB_WAVEFORM_DURATION_SEC)}</em></div>
      <div className="od-waveform"><RgbWaveformCanvas analysis={LAB_WAVEFORM} duration={LAB_WAVEFORM_DURATION_SEC} currentTime={time} markers={LAB_WAVEFORM_CUES} onSeek={setTime} zoom={zoom} ownerDocumentSizing monochrome showCueMarkerLines={false} /></div>
      <div className="od-zoom"><OdKey icon="minus" label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value / 2))} /><span>{zoom}×</span><OdKey icon="plus" label="Zoom in" disabled={zoom >= 16} onClick={() => setZoom(value => Math.min(16, value * 2))} /></div>
      <input className="od-progress" type="range" aria-label="Track position" min={0} max={LAB_WAVEFORM_DURATION_SEC} step={.1} value={time} onChange={event => setTime(Number(event.target.value))} />
    </div>
    <div className="od-tempo">
      <label><span className="od-eyebrow">TEMPO</span><span className="od-tempo-figure"><input type="number" aria-label="BPM override" min={40} max={300} step={.01} value={bpm} onChange={event => { if (event.target.value) setBpm(Math.min(300, Math.max(40, Number(event.target.value)))) }} /><sup>BPM</sup></span></label>
      <span className="od-tempo-origin">Rekordbox · cues / sections</span>
      <div className="od-tempo-keys"><OdKey icon="tap" label="Tap tempo" /><OdKey icon="cue" label="Jump to cue (0:00)" /><OdKey icon="sync" label={sync ? 'BPM Sync: ON' : 'BPM Sync: OFF'} active={sync} onClick={() => setSync(value => !value)} />{bpm !== 129 && <OdKey icon="rotateLeft" label="Reset BPM" onClick={() => setBpm(129)} />}</div>
    </div>
    <div className="od-dock-actions">
      <button type="button" className="od-key" ref={sourceRef} aria-label="Audio source & Rekordbox" title="Audio source & Rekordbox" aria-expanded={popover === 'source'} onClick={() => setPopover(value => value === 'source' ? null : 'source')}><AppIcon kind="sliders" size={17} /></button>
      <button type="button" className="od-key" ref={playlistRef} aria-label="Playlist" title="Playlist" aria-expanded={popover === 'playlist'} onClick={() => setPopover(value => value === 'playlist' ? null : 'playlist')}><AppIcon kind="playlist" size={17} /></button>
      <OdKey icon="timeline" label="Open the Track Timeline Visualizer" />
      <button type="button" className="od-key" title={collapsed ? 'Expand audio dock' : 'Collapse audio dock'} aria-label={collapsed ? 'Expand audio dock' : 'Collapse audio dock'} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}><AppIcon kind={collapsed ? 'chevronUp' : 'chevronDown'} size={16} /></button>
    </div>
    <div className="od-dock-level"><AppIcon kind="volume" size={16} /><OdRange label="Track volume" value={volume} step={.005} onChange={setVolume} format={value => value < .001 ? '−∞ dB' : `${(20 * Math.log10(value)).toFixed(1)} dB`} /></div>
    <InfoPopover className="od-popover" open={popover === 'source'} anchorRef={sourceRef} title="Audio source" width={300} placement="above" align="end" onOpenChange={() => setPopover(null)}>
      <OdSelect label="Input" value={source} onChange={setSource} options={[{ value: 'file', label: 'Track Input' }, { value: 'microphone', label: 'Live Input' }, { value: 'demo', label: 'Demo Signal' }]} />
      <OdSelect label="Rekordbox" value="" onChange={() => {}} options={[{ value: 'xml', label: 'Import XML…' }, { value: 'usb', label: 'Scan USB…' }, { value: 'mode', label: 'Arm USB Mode' }]} />
    </InfoPopover>
    <InfoPopover className="od-popover" open={popover === 'playlist'} anchorRef={playlistRef} title="Playlist" width={390} placement="above" align="end" onOpenChange={() => setPopover(null)}>
      <OdSwitch label="Automatic advance" value={advance} onChange={setAdvance} />
      <OdSelect label="New track loads" value={loadMode} onChange={setLoadMode} options={[{ value: 'replace', label: 'Replace queue' }, { value: 'append', label: 'Append to queue' }]} />
      <div className="od-queue">{TRACKS.map((item, i) => <div className="od-queue-row" key={item.title}>
        <button type="button" aria-pressed={i === index} onClick={() => setIndex(i)}><span className="od-ring">0{i + 1}</span><div><strong>{item.title}</strong><small>{item.artist}</small></div>{i === index && <AppIcon kind="check" size={14} />}</button>
        <OdKey icon="delete" label={`Remove ${item.title} from playlist`} />
      </div>)}</div>
    </InfoPopover>
  </section>
}
