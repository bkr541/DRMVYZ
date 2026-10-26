import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../../shared/InfoPopover'
import { TrackTimelineIcon } from '../../trackTimeline/TrackTimelineIcon'
import { LAB_WAVEFORM, LAB_WAVEFORM_CUES, LAB_WAVEFORM_DURATION_SEC, LAB_WAVEFORM_START_SEC } from '../layoutLabWaveformFixture'
import { OaKnob, OaLed, OaSelect, OaSwitch } from './oaControls'
import { OaRing } from './oaInstruments'
import { OaScope } from './OaScope'

// ── Option A · audio dock ──────────────────────────────────────────────────────────────────────────────────────
//
// The deck, rebuilt as three instruments side by side instead of one strip of labelled buttons:
//   DECK   the loaded track, the transport keys (the Play key wears a progress ring) and the level knob;
//   SCOPE  the waveform with its cue ruler, a time readout and zoom;
//   TEMPO  the BPM as a large ring dial you can drag, the source readout and the keys for tap, cue, sync, source,
//          playlist and the Track Timeline.
// It carries everything the production dock does on the same local state (three-track queue, fixed 129 BPM analysis,
// override and reset, volume, zoom, Audio Source and Playlist popovers, click-empty-space-to-collapse); nothing is
// decoded and no sound plays. The popovers render in a portal, so they carry the `oa-popover` class.

const TRACKS = [
  { id: 't1', name: 'Mocha ID - Nelly Grillz (Clean Edit) 8A 170', artist: 'Mocha' },
  { id: 't2', name: 'Jeremih x Max Styler - Birthday Sex x I Know You Want To (RAFAEL Edit) 6A 129', artist: 'Jeremih, Max Styler' },
  { id: 't3', name: 'Trace of You', artist: 'DVYDRM' },
]
const ANALYZED_BPM = 129
const BPM_MIN = 40
const BPM_MAX = 300
const ZOOM_MIN = 1
const ZOOM_MAX = 16

const formatClock = (seconds: number) => {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${Math.floor((seconds - whole) * 10)}`
}

export function OptionADock() {
  const [collapsed, setCollapsed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(1)
  const [volume, setVolume] = useState(0.82)
  const [zoom, setZoom] = useState(1)
  const [time, setTime] = useState(LAB_WAVEFORM_START_SEC)
  const [bpm, setBpm] = useState(ANALYZED_BPM)
  const [bpmSync, setBpmSync] = useState(true)
  const [sourcePopover, setSourcePopover] = useState(false)
  const [playlistPopover, setPlaylistPopover] = useState(false)
  const [input, setInput] = useState('file')
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [loadMode, setLoadMode] = useState<'append' | 'replace'>('replace')
  const sourceTriggerRef = useRef<HTMLButtonElement>(null)
  const playlistTriggerRef = useRef<HTMLButtonElement>(null)
  const track = TRACKS[index]!

  // A moving playhead while Play is on, so the deck looks like it does mid-track; nothing is decoded or heard.
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setTime(current => {
        const next = current + 0.1
        return next >= LAB_WAVEFORM_DURATION_SEC ? LAB_WAVEFORM_START_SEC : next
      })
    }, 100)
    return () => window.clearInterval(timer)
  }, [playing])

  const overridden = Math.round(bpm * 100) !== ANALYZED_BPM * 100
  const bpmRatio = (bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)
  const progress = time / LAB_WAVEFORM_DURATION_SEC
  const scrubBpm = (event: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const angle = Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2))
    const turn = ((angle * 180) / Math.PI + 90 + 360) % 360 / 360
    setBpm(Math.round((BPM_MIN + turn * (BPM_MAX - BPM_MIN)) * 100) / 100)
  }

  return (
    <footer
      className="oa-dock"
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label="Audio dock"
      onClick={event => {
        const target = event.target as HTMLElement
        if (target === event.currentTarget || target.hasAttribute('data-oa-blank')) setCollapsed(value => !value)
      }}
    >
      {/* ── DECK ─────────────────────────────────────────────────────── */}
      <section className="oa-deck" data-oa-blank aria-label="Deck">
        <div className="oa-deck__transport" data-oa-blank>
          <button type="button" className="oa-key oa-key--round" title={index > 0 ? 'Previous track' : 'No previous track'} aria-label="Previous track" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))}>
            <AppIcon kind="previous" size={16} />
          </button>
          <OaRing ratio={progress} size={56} stroke={2.5} tone="white" className="oa-deck__ring">
            <button type="button" className="oa-play" title={playing ? 'Pause' : 'Play'} aria-label={playing ? 'Pause' : 'Play'} data-playing={playing} onClick={() => setPlaying(value => !value)}>
              {playing ? <AppIcon kind="pause" size={22} /> : <AppIcon kind="play" size={22} />}
            </button>
          </OaRing>
          <button type="button" className="oa-key oa-key--round" title={index < TRACKS.length - 1 ? 'Next track' : 'No next track'} aria-label="Next track" disabled={index === TRACKS.length - 1} onClick={() => setIndex(value => Math.min(TRACKS.length - 1, value + 1))}>
            <AppIcon kind="next" size={16} />
          </button>
        </div>

        <div className="oa-deck__track" data-oa-blank>
          <span className="oa-deck__slot">{String(index + 1).padStart(2, '0')} / {String(TRACKS.length).padStart(2, '0')}</span>
          <span className="oa-deck__title" title={track.name}>{track.name}</span>
          <span className="oa-deck__artist" title={track.artist}>{track.artist}</span>
          <label className="oa-deck__replace" aria-label="Replace Track" title={`Replace: ${track.name}`}>
            <AppIcon kind="plus" size={14} />
            <span>Replace track</span>
          </label>
        </div>

        <OaKnob
          label="Volume"
          size="sm"
          tone="ice"
          value={volume}
          defaultValue={0.82}
          step={0.005}
          onChange={setVolume}
          format={value => (value < 0.001 ? '-∞ dB' : `${(20 * Math.log10(value)).toFixed(1)} dB`)}
        />
      </section>

      {/* ── SCOPE ────────────────────────────────────────────────────── */}
      <section className="oa-scopebay" aria-label="Waveform">
        <div className="oa-scopebay__bar">
          <span className="oa-scopebay__time">{formatClock(time)}<small>/ {formatClock(LAB_WAVEFORM_DURATION_SEC)}</small></span>
          <span className="oa-scopebay__zoom">
            <span className="oa-scopebay__zoomvalue">Zoom ×{zoom >= 1 ? zoom : zoom.toFixed(2)}</span>
            <button type="button" className="oa-iconkey oa-iconkey--sm" onClick={() => setZoom(value => value / 2)} disabled={zoom <= ZOOM_MIN} title="Zoom out" aria-label="Zoom out"><AppIcon kind="minus" size={14} /></button>
            <button type="button" className="oa-iconkey oa-iconkey--sm" onClick={() => setZoom(value => value * 2)} disabled={zoom >= ZOOM_MAX} title="Zoom in" aria-label="Zoom in"><AppIcon kind="plus" size={14} /></button>
          </span>
        </div>
        <OaScope analysis={LAB_WAVEFORM} duration={LAB_WAVEFORM_DURATION_SEC} currentTime={time} markers={LAB_WAVEFORM_CUES} zoom={zoom} onSeek={setTime} />
      </section>

      {/* ── TEMPO ────────────────────────────────────────────────────── */}
      <section className="oa-tempo" data-oa-blank aria-label="Tempo and source">
        <div className="oa-tempo__dial" data-oa-blank>
          <div
            className="oa-tempo__ring"
            role="slider"
            tabIndex={0}
            aria-label="BPM"
            aria-valuemin={BPM_MIN}
            aria-valuemax={BPM_MAX}
            aria-valuenow={Math.round(bpm)}
            title={overridden ? `Override active — analyzed: ${ANALYZED_BPM.toFixed(2)} BPM` : 'Drag the ring to set the BPM'}
            onPointerDown={event => { scrubBpm(event); event.currentTarget.setPointerCapture(event.pointerId) }}
            onPointerMove={event => { if (event.buttons === 1) scrubBpm(event) }}
            onKeyDown={event => {
              if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); setBpm(value => Math.min(BPM_MAX, Math.round((value + 1) * 100) / 100)) }
              if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); setBpm(value => Math.max(BPM_MIN, Math.round((value - 1) * 100) / 100)) }
            }}
          >
            <OaRing ratio={bpmRatio} size={108} stroke={2.5} tone="ember">
              <span className="oa-tempo__readout">
                <strong>{bpm.toFixed(2)}</strong>
                <small>BPM</small>
              </span>
            </OaRing>
          </div>
          {overridden && (
            <button type="button" className="oa-iconkey oa-iconkey--sm oa-tempo__reset" onClick={() => setBpm(ANALYZED_BPM)} title={`Reset to analyzed BPM (${ANALYZED_BPM.toFixed(2)})`} aria-label="Reset BPM">
              <AppIcon kind="rotateLeft" size={14} />
            </button>
          )}
        </div>

        <div className="oa-tempo__side" data-oa-blank>
          <span className="oa-tempo__source" title="Rekordbox data loaded, cues, sections" aria-label="Rekordbox data loaded, cues, sections" data-audio-source-kind="rekordbox">
            <span className="oa-tempo__sourcelabel">Source</span>
            <strong>Rekordbox</strong>
            <small>Cues · Sections{overridden ? ` · analyzed ${ANALYZED_BPM.toFixed(2)}` : ''}</small>
          </span>
          <div className="oa-tempo__keys" data-oa-blank>
            <button type="button" className="oa-iconkey" title="Tap tempo" aria-label="Tap tempo"><AppIcon kind="tap" size={16} /></button>
            <button type="button" className="oa-iconkey" title="Jump to cue (0:00)" aria-label="Jump to cue (0:00)"><AppIcon kind="cue" size={16} /></button>
            <button type="button" className="oa-iconkey" data-selected={bpmSync} onClick={() => setBpmSync(value => !value)} title={bpmSync ? 'BPM Sync: ON' : 'BPM Sync: OFF'} aria-label={bpmSync ? 'BPM Sync: ON' : 'BPM Sync: OFF'}>
              <AppIcon kind="sync" size={16} />
              <OaLed on={bpmSync} className="oa-iconkey__led" />
            </button>
            <button
              ref={sourceTriggerRef}
              type="button"
              className="oa-iconkey"
              onClick={() => { setPlaylistPopover(false); setSourcePopover(value => !value) }}
              aria-haspopup="dialog"
              aria-expanded={sourcePopover}
              aria-label="Audio source & Rekordbox"
              title="Audio source & Rekordbox"
            >
              <AppIcon kind="sliders" size={16} />
            </button>
            <button
              ref={playlistTriggerRef}
              type="button"
              className="oa-iconkey"
              title="Playlist"
              aria-label="Playlist"
              aria-haspopup="dialog"
              aria-expanded={playlistPopover}
              onClick={() => { setSourcePopover(false); setPlaylistPopover(value => !value) }}
            >
              <AppIcon kind="playlist" size={16} />
            </button>
            <button type="button" className="oa-iconkey" data-state="ready" title="Open the Track Timeline Visualizer" aria-label="Open the Track Timeline Visualizer">
              <TrackTimelineIcon />
            </button>
          </div>
        </div>
      </section>

      <InfoPopover
        open={sourcePopover}
        anchorRef={sourceTriggerRef}
        onOpenChange={setSourcePopover}
        title="Audio Source"
        headerIcon={<AppIcon kind="mic" />}
        className="oa-popover"
        placement="above"
        align="end"
        width={300}
      >
        <div className="oa-popover__body">
          <OaSelect
            label="Input"
            value={input}
            onChange={setInput}
            options={[
              { value: 'file', label: 'Track Input' },
              { value: 'microphone', label: 'Live Input' },
              { value: 'demo', label: 'Demo Signal' },
            ]}
          />
          <OaSelect
            label="Rekordbox"
            value=""
            placeholder="RB Tools"
            onChange={() => {}}
            title="Import Rekordbox metadata or arm USB Mode. USB Mode does not import cues unless XML or the native parser matches the track."
            options={[
              { value: 'xml', label: 'Import XML…' },
              { value: 'usb', label: 'Scan USB…' },
              { value: 'mode', label: 'Arm USB Mode' },
            ]}
          />
        </div>
      </InfoPopover>

      <InfoPopover
        open={playlistPopover}
        anchorRef={playlistTriggerRef}
        onOpenChange={setPlaylistPopover}
        title="Playlist"
        description={`${index + 1} of ${TRACKS.length} selected`}
        headerIcon={<AppIcon kind="playlist" />}
        className="oa-popover"
        placement="above"
        align="end"
        width={380}
        maxHeight={480}
      >
        <div className="oa-popover__body">
          <OaSwitch label="Automatic advance" description="Continue with the next track when playback ends." value={autoAdvance} onChange={setAutoAdvance} />
          <fieldset className="oa-popover__modes">
            <legend>New track loads</legend>
            <div className="oa-segments">
              <button type="button" className="oa-segments__key" data-selected={loadMode === 'append'} aria-pressed={loadMode === 'append'} onClick={() => setLoadMode('append')}>Append</button>
              <button type="button" className="oa-segments__key" data-selected={loadMode === 'replace'} aria-pressed={loadMode === 'replace'} onClick={() => setLoadMode('replace')}>Replace</button>
            </div>
          </fieldset>
          <div className="oa-popover__queue" aria-live="polite"><span>Queue</span><strong>{TRACKS.length} tracks</strong></div>
          <div className="oa-popover__tracks" role="list" aria-label="Loaded tracks">
            {TRACKS.map((item, position) => {
              const active = position === index
              return (
                <div key={item.id} className="oa-popover__track" data-active={active} role="listitem">
                  <button type="button" className="oa-popover__select" aria-current={active ? 'true' : undefined} disabled={active} onClick={() => setIndex(position)}>
                    <span className="oa-popover__index">{String(position + 1).padStart(2, '0')}</span>
                    <span className="oa-popover__identity"><strong>{item.name}</strong>{item.artist && <small>{item.artist}</small>}</span>
                    {active && <span className="oa-popover__active">Active</span>}
                  </button>
                  <button type="button" className="oa-iconkey oa-iconkey--sm" aria-label={`Remove ${item.name} from playlist`} title="Remove from playlist"><AppIcon kind="delete" size={14} /></button>
                </div>
              )
            })}
          </div>
        </div>
      </InfoPopover>
    </footer>
  )
}
