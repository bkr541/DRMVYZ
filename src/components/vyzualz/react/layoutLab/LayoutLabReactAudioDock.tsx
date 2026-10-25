import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../shared/InfoPopover'
import { isDockBlankSpace } from '../../shared/dockBlankSpace'
import { RgbWaveformCanvas } from '../../transport/RgbWaveformCanvas'
import { BubbleRevealSlider } from '../controls/BubbleRevealSlider'
import { IconMorphToggle } from '../controls/IconMorphToggle'
import { UnderlineDropdown } from '../controls/UnderlineDropdown'
import { TrackTimelineIcon } from '../trackTimeline/TrackTimelineIcon'
import { LAB_WAVEFORM, LAB_WAVEFORM_CUES, LAB_WAVEFORM_DURATION_SEC, LAB_WAVEFORM_START_SEC } from './layoutLabWaveformFixture'

// ── Layout Lab · bottom audio dock · React ──────────────────────────────────
//
// A disconnected mirror of the bottom audio dock React View mounts (VyzualzAudioDock with `expandable`,
// `showAudioSourceControl` and the Track Timeline key in the lower reserved slot), written from the production JSX: the
// same regions, cards, classes, keys, BPM block, Source line, Audio Source and Playlist popovers, and the same
// click-empty-space-to-collapse behaviour. The waveform is production's own deck canvas (RgbWaveformCanvas, as
// PeaksWaveformView renders it for React) drawing a synthetic loaded track from layoutLabWaveformFixture.ts, with cue
// flags, the playhead and zoom. It differs only in what feeds it: a fixed three-track queue, a fixed BPM and that
// generated analysis instead of the audio engine, stores and analyser, so nothing is decoded and no sound plays; the
// playhead advances while Play is on, and clicking the waveform moves it.

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
const ACCENT = '#4ac7db'

export function LayoutLabReactAudioDock() {
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
  const volPct = `${Math.round(volume * 100)}%`
  const overridden = Math.round(bpm * 100) !== ANALYZED_BPM * 100

  const dockClassName = ['az-dock', 'vz-transport-dock', 'vz-transport-dock--expandable', collapsed ? 'vz-transport-dock--collapsed' : '']
    .filter(Boolean).join(' ')

  const scrubBpm = (event: { clientX: number; currentTarget: HTMLElement }) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)))
    setBpm(Math.round((BPM_MIN + ratio * (BPM_MAX - BPM_MIN)) * 100) / 100)
  }

  return (
    <div
      className={dockClassName}
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label="Audio dock"
      onClick={event => { if (isDockBlankSpace(event.target, event.currentTarget)) setCollapsed(value => !value) }}
    >
      {/* ── LEFT ─────────────────────────────────────────────────────── */}
      <div className="vz-dock-region">
        <div className="vz-dock-left vz-dock-card">
          <div className="vz-dock-play-slot">
            <button
              type="button"
              className="vz-dock-track-nav-btn vz-dock-track-nav-btn--previous"
              title={index > 0 ? 'Previous track' : 'No previous track'}
              aria-label="Previous track"
              disabled={index === 0}
              onClick={() => setIndex(value => Math.max(0, value - 1))}
            >
              <AppIcon kind="previous" size="16" />
            </button>
            <button
              type="button"
              className="az-play-btn"
              title={playing ? 'Pause' : 'Play'}
              aria-label={playing ? 'Pause' : 'Play'}
              style={{ borderColor: ACCENT, color: ACCENT, boxShadow: `0 0 12px ${ACCENT}30` }}
              onClick={() => setPlaying(value => !value)}
            >
              {playing ? <AppIcon kind="pause" size="26" /> : <AppIcon kind="play" size="26" />}
            </button>
            <button
              type="button"
              className="vz-dock-track-nav-btn vz-dock-track-nav-btn--next"
              title={index < TRACKS.length - 1 ? 'Next track' : 'No next track'}
              aria-label="Next track"
              disabled={index === TRACKS.length - 1}
              onClick={() => setIndex(value => Math.min(TRACKS.length - 1, value + 1))}
            >
              <AppIcon kind="next" size="16" />
            </button>
          </div>

          <div className="vz-dock-left-body">
            <div className="vz-dock-track-row">
              <span className="vz-dock-track-title" title={track.name}>{track.name}</span>
              {track.artist && <span className="vz-dock-track-artist" title={track.artist}>{track.artist}</span>}
            </div>
            <div className="az-dock-volume vz-dock-volume-row">
              <span className="az-dock-vol-icon" aria-hidden="true"><AppIcon kind="volume" size="14" /></span>
              <span className="az-dock-vol-db vz-dock-vol-db">
                {volume < 0.001 ? '-∞ dB' : `${(20 * Math.log10(volume)).toFixed(1)} dB`}
              </span>
              <BubbleRevealSlider
                type="range"
                className="az-dock-vol-slider"
                aria-label="Track volume"
                title={`Track volume: ${Math.round(volume * 100)}%`}
                min={0}
                max={1}
                step={0.005}
                value={volume}
                onChange={event => setVolume(parseFloat(event.target.value))}
                style={{ '--pct': volPct } as CSSProperties}
              />
            </div>
          </div>

          <label className="vz-dock-addtrack-btn" aria-label="Replace Track" title={`Replace: ${track.name}`}>
            <AppIcon kind="plus" size="18" />
            <span>Replace Track</span>
          </label>
        </div>
      </div>

      {/* ── CENTER ───────────────────────────────────────────────────── */}
      <div className="vz-dock-region">
        <div className="vz-dock-center vz-dock-card">
          <div className="vz-dock-waveform-wrap">
            <div className="vz-peaks-wrap vz-peaks-wrap--deck">
              <RgbWaveformCanvas
                analysis={LAB_WAVEFORM}
                duration={LAB_WAVEFORM_DURATION_SEC}
                currentTime={time}
                markers={LAB_WAVEFORM_CUES}
                onSeek={setTime}
                zoom={zoom}
                monochrome
                showCueMarkerLines={false}
              />
            </div>
          </div>
          <div className="vz-dock-zoom-btns">
            <button className="vz-dock-zoom-btn" onClick={() => setZoom(value => value * 2)} disabled={zoom >= ZOOM_MAX} title="Zoom in"><AppIcon kind="plus" size={14} /></button>
            <button className="vz-dock-zoom-btn" onClick={() => setZoom(value => value / 2)} disabled={zoom <= ZOOM_MIN} title="Zoom out"><AppIcon kind="minus" size={14} /></button>
          </div>
        </div>
      </div>

      {/* ── RIGHT ────────────────────────────────────────────────────── */}
      <div className="vz-dock-region">
        <div className="vz-dock-right vz-dock-card">
          <div className="vz-dock-right-main">
            <div className="vz-dock-bpm-wrap">
              <div className="vz-dock-bpm-block">
                <div className="vz-dock-bpm-track-top">
                  <span className="vz-dock-bpm-block-label">BPM</span>
                  <span
                    className="vz-dock-bpm-block-val"
                    title={overridden ? `Override active — analyzed: ${ANALYZED_BPM.toFixed(2)} BPM` : 'Double-click to edit BPM'}
                    style={{ cursor: 'text' }}
                  >
                    {bpm.toFixed(2)}
                  </span>
                  {overridden && (
                    <button className="vz-dock-bpm-reset-btn" onClick={() => setBpm(ANALYZED_BPM)} title={`Reset to analyzed BPM (${ANALYZED_BPM.toFixed(2)})`}>
                      <AppIcon kind="rotateLeft" size={14} />
                    </button>
                  )}
                </div>
                <div
                  className="vz-dock-bpm-track-bar"
                  onPointerDown={event => { scrubBpm(event); event.currentTarget.setPointerCapture(event.pointerId) }}
                  onPointerMove={event => { if (event.buttons === 1) scrubBpm(event) }}
                  role="slider"
                  aria-label="BPM"
                  aria-valuemin={BPM_MIN}
                  aria-valuemax={BPM_MAX}
                  aria-valuenow={Math.round(bpm)}
                >
                  <div className="vz-dock-bpm-track-fill" style={{ width: `${Math.min(100, Math.max(0, ((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100))}%` }} />
                </div>
                {overridden && <span className="vz-dock-bpm-analyzed-label">analyzed {ANALYZED_BPM.toFixed(2)}</span>}
                <span
                  className="vz-dock-source-inline vz-dock-source-inline--rekordbox"
                  title="Rekordbox data loaded, cues, sections"
                  aria-label="Rekordbox data loaded, cues, sections"
                  data-audio-source-kind="rekordbox"
                >
                  <span className="vz-dock-source-inline-label">Source</span>
                  <span className="vz-dock-source-inline-value">
                    <strong className="vz-dock-source-inline-name">Rekordbox</strong>
                    <span className="vz-dock-source-inline-tag" aria-hidden="true">CUES · SECTIONS</span>
                  </span>
                </span>
              </div>
            </div>

            <button
              ref={sourceTriggerRef}
              type="button"
              className="vz-dock-source-trigger"
              onClick={() => { setPlaylistPopover(false); setSourcePopover(value => !value) }}
              aria-haspopup="dialog"
              aria-expanded={sourcePopover}
              aria-label="Audio source & Rekordbox"
              title="Audio source & Rekordbox"
            >
              <AppIcon kind="sliders" size="16" />
            </button>
            <InfoPopover
              open={sourcePopover}
              anchorRef={sourceTriggerRef}
              onOpenChange={setSourcePopover}
              title="Audio Source"
              headerIcon={<AppIcon kind="mic" />}
              className="vz-dock-source-popover"
              placement="above"
              align="start"
              width={280}
            >
              <div className="vz-dock-source-popover-body">
                <div className="mum-field">
                  <label className="mum-field-label" htmlFor="ll-dock-input">INPUT</label>
                  <UnderlineDropdown
                    triggerId="ll-dock-input"
                    value={input}
                    onChange={setInput}
                    options={[
                      { value: 'file', label: 'Track Input' },
                      { value: 'microphone', label: 'Live Input' },
                      { value: 'demo', label: 'Demo Signal' },
                    ]}
                    ariaLabel="Input"
                    menuLabel="Input"
                    menuClassName="vz-dock-source-menu"
                    size="compact"
                    showDescriptions={false}
                  />
                </div>
                <div className="mum-field" aria-label="Rekordbox import tools">
                  <label className="mum-field-label" htmlFor="ll-dock-rekordbox">REKORDBOX</label>
                  <UnderlineDropdown
                    triggerId="ll-dock-rekordbox"
                    value=""
                    placeholder="RB Tools"
                    onChange={() => {}}
                    options={[
                      { value: 'xml', label: 'Import XML…' },
                      { value: 'usb', label: 'Scan USB…' },
                      { value: 'mode', label: 'Arm USB Mode' },
                    ]}
                    ariaLabel="Rekordbox"
                    menuLabel="Rekordbox"
                    menuClassName="vz-dock-source-menu"
                    size="compact"
                    showDescriptions={false}
                    title="Import Rekordbox metadata or arm USB Mode. USB Mode does not import cues unless XML or the native parser matches the track."
                  />
                </div>
              </div>
            </InfoPopover>
          </div>

          <div className="vz-dock-right-btns">
            <button className="vz-dock-tap-btn" title="Tap tempo" aria-label="Tap tempo">
              <AppIcon kind="tap" className="vz-dock-action-icon" size="16" />
            </button>
            <button className="vz-dock-cue-btn" title="Jump to cue (0:00)" aria-label="Jump to cue (0:00)">
              <span className="vz-dock-action-icon vz-dock-cue-icon" aria-hidden="true"><AppIcon kind="cue" size="100%" /></span>
            </button>
            <button
              className={`vz-dock-sync-master-btn${bpmSync ? ' vz-dock-sync-master-btn--on' : ''}`}
              onClick={() => setBpmSync(value => !value)}
              title={bpmSync ? 'BPM Sync: ON' : 'BPM Sync: OFF'}
              aria-label={bpmSync ? 'BPM Sync: ON' : 'BPM Sync: OFF'}
            >
              {bpmSync && <span className="vz-dock-sync-dot" />}
              <AppIcon kind="sync" className="vz-dock-action-icon" size="16" />
            </button>
            <div className="vz-dock-blank-group">
              <button
                ref={playlistTriggerRef}
                type="button"
                className="vz-dock-playlist-trigger"
                title="Playlist"
                aria-label="Playlist"
                aria-haspopup="dialog"
                aria-expanded={playlistPopover}
                onClick={() => { setSourcePopover(false); setPlaylistPopover(value => !value) }}
              >
                <AppIcon kind="playlist" size="16" />
              </button>
              <button
                type="button"
                className="vz-dock-track-timeline-btn"
                data-state="ready"
                title="Open the Track Timeline Visualizer"
                aria-label="Open the Track Timeline Visualizer"
              >
                <TrackTimelineIcon />
              </button>
            </div>
            <InfoPopover
              open={playlistPopover}
              anchorRef={playlistTriggerRef}
              onOpenChange={setPlaylistPopover}
              title="Playlist"
              description={`${index + 1} of ${TRACKS.length} selected`}
              headerIcon={<AppIcon kind="playlist" />}
              className="vz-dock-source-popover vz-dock-playlist-popover"
              placement="above"
              align="end"
              width={360}
              maxHeight={480}
            >
              <div className="vz-dock-playlist-popover-body">
                <div className="vz-dock-playlist-setting">
                  <span>
                    <strong>Automatic advance</strong>
                    <small>Continue with the next track when playback ends.</small>
                  </span>
                  <IconMorphToggle
                    checked={autoAdvance}
                    onCheckedChange={setAutoAdvance}
                    className="vz-settings-seg-btn vz-dock-playlist-toggle"
                    aria-label="Automatic advance"
                  />
                </div>
                <fieldset className="vz-dock-playlist-load-mode">
                  <legend>New track loads</legend>
                  <div className="rv-segmented-control">
                    <button type="button" className={loadMode === 'append' ? 'is-active' : ''} aria-pressed={loadMode === 'append'} onClick={() => setLoadMode('append')}>Append</button>
                    <button type="button" className={loadMode === 'replace' ? 'is-active' : ''} aria-pressed={loadMode === 'replace'} onClick={() => setLoadMode('replace')}>Replace</button>
                  </div>
                </fieldset>
                <div className="vz-dock-playlist-state" aria-live="polite">
                  <span>Queue</span>
                  <strong>{TRACKS.length} tracks</strong>
                </div>
                <div className="vz-dock-playlist-tracks" role="list" aria-label="Loaded tracks">
                  {TRACKS.map((item, position) => {
                    const active = position === index
                    return (
                      <div key={item.id} className={`vz-dock-playlist-track${active ? ' is-active' : ''}`} role="listitem">
                        <button type="button" className="vz-dock-playlist-select" aria-current={active ? 'true' : undefined} disabled={active} onClick={() => setIndex(position)}>
                          <span className="vz-dock-playlist-index">{String(position + 1).padStart(2, '0')}</span>
                          <span className="vz-dock-playlist-identity">
                            <strong>{item.name}</strong>
                            {item.artist && <small>{item.artist}</small>}
                          </span>
                          {active && <span className="vz-dock-playlist-active-label">Active</span>}
                        </button>
                        <button type="button" className="vz-dock-playlist-remove" aria-label={`Remove ${item.name} from playlist`} title="Remove from playlist">
                          <AppIcon kind="delete" size="14" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </InfoPopover>
          </div>
        </div>
      </div>
    </div>
  )
}
