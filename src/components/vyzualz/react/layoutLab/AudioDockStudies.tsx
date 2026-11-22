import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type RefObject } from 'react'
import rekordboxLogo from '../../../../assets/rekordbox_logo.svg?inline'
import { InfoPopover } from '../../../shared/InfoPopover'
import popoverStyles from '../../../shared/InfoPopover/InfoPopover.css?inline'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import styles from './audioDockStudies.css?inline'

const STUDIES = [
  { id: 'slate', name: 'Slate Rail' },
  { id: 'inset', name: 'Inset Deck' },
  { id: 'meter', name: 'Meter Panel' },
  { id: 'split', name: 'Split Console' },
  { id: 'glass', name: 'Signal Glass' },
] as const

const TRACKS = [
  { title: 'After Hours', detail: 'Extended Mix', bpm: 126, duration: 288, rekordbox: 'Cues · Sections' },
  { title: 'Crossfade', detail: 'Club Mix', bpm: 124, duration: 255, rekordbox: 'Cues' },
  { title: 'Night Signal', detail: 'Original Mix', bpm: 128, duration: 312, rekordbox: null },
] as const

const SOURCES = [
  { id: 'track', label: 'Track Input' },
  { id: 'live', label: 'Live Input' },
  { id: 'demo', label: 'Demo Signal' },
] as const

type Source = (typeof SOURCES)[number]
type Track = (typeof TRACKS)[number]
type Panel = 'playlist' | 'timeline' | 'source'

interface Transport {
  queue: Track[]
  index: number
  elapsed: number
  cue: number
  playing: boolean
}

function selectTrack(state: Transport, index: number, playing: boolean): Transport {
  return { ...state, index, elapsed: 0, cue: 0, playing }
}

function timecode(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

// A fixed sample waveform makes the control layouts directly comparable.
const WAVEFORM = Array.from({ length: 144 }, (_, index) => {
  const envelope = index > 52 && index < 72 ? .34 : .48 + .52 * Math.abs(Math.sin(index / 19 + .6))
  const height = 2 + envelope * (11 + 19 * Math.abs(Math.cos(index * 2.39)) * Math.abs(Math.sin(index * .83)))
  return { x: index * 3 + 1.5, height, accent: index % 5 === 0 }
})

function PreviewWaveform({ progress, cue }: { progress: number; cue?: number }) {
  return <svg className="ll-ad-waveform" viewBox="0 0 432 68" preserveAspectRatio="none" aria-hidden="true">
    {WAVEFORM.map(({ x, height, accent }) => <line key={x} x1={x} x2={x} y1={34 - height} y2={34 + height}
      className="ll-ad-bar" data-played={x <= progress * 432} data-accent={accent} />)}
    {cue != null && <line className="ll-ad-cue-line" x1={cue * 432} x2={cue * 432} y1="0" y2="68" />}
    <line className="ll-ad-playhead" x1={progress * 432} x2={progress * 432} y1="0" y2="68" />
  </svg>
}

function DockKey({ icon, label, buttonRef, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: AppIconKind
  label: string
  buttonRef?: RefObject<HTMLButtonElement>
}) {
  return <button type="button" ref={buttonRef} className={`ll-ad-key ${className}`} title={label} aria-label={label} {...props}>
    <AppIcon kind={icon} size={16} />
  </button>
}

function AudioDockStudy({ study }: { study: (typeof STUDIES)[number] }) {
  const [transport, setTransport] = useState<Transport>({ queue: TRACKS.slice(0, 2), index: 0, elapsed: 52, cue: 0, playing: false })
  const [source, setSource] = useState<Source>(SOURCES[0])
  const [sync, setSync] = useState(false)
  const [volume, setVolume] = useState(78)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [loadMode, setLoadMode] = useState<'append' | 'replace'>('append')
  const [panel, setPanel] = useState<Panel | null>(null)
  const [tempoOverrides, setTempoOverrides] = useState<Record<string, number>>({})
  const tapTimes = useRef<number[]>([])
  const playlistRef = useRef<HTMLButtonElement>(null)
  const sourceRef = useRef<HTMLButtonElement>(null)
  const timelineRef = useRef<HTMLButtonElement>(null)

  const { queue, index, elapsed, cue, playing } = transport
  const track = queue[index]
  const trackInput = source.id === 'track'
  const trackReady = trackInput && !!track
  const bpm = trackReady ? tempoOverrides[track.title] ?? track.bpm : null
  const rekordbox = trackInput ? track?.rekordbox : null
  const rekordboxStatus = rekordbox ?? (trackInput ? 'No data' : 'Inactive')
  const progress = track ? elapsed / track.duration : 0
  const cueProgress = track && cue > 0 ? cue / track.duration : undefined

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setTransport(current => {
      const currentTrack = current.queue[current.index]
      if (!currentTrack) return { ...current, playing: false }
      if (current.elapsed + .25 < currentTrack.duration) return { ...current, elapsed: current.elapsed + .25 }
      if (autoAdvance && current.index < current.queue.length - 1) return selectTrack(current, current.index + 1, true)
      return { ...current, elapsed: currentTrack.duration, playing: false }
    }), 250)
    return () => window.clearInterval(timer)
  }, [autoAdvance, playing])

  const addTrack = () => setTransport(current => {
    const sample = TRACKS.find(candidate => !current.queue.includes(candidate)) ?? TRACKS[0]
    if (loadMode === 'replace' || current.queue.length === 0) return selectTrack({ ...current, queue: [sample] }, 0, false)
    return { ...current, queue: [...current.queue, sample] }
  })

  const removeTrack = (removed: number) => setTransport(current => {
    const remaining = current.queue.filter((_, position) => position !== removed)
    if (removed !== current.index) return { ...current, queue: remaining, index: current.index - Number(removed < current.index) }
    return selectTrack({ ...current, queue: remaining }, Math.max(0, Math.min(removed, remaining.length - 1)), false)
  })

  const tapTempo = () => {
    if (!trackReady) return
    const now = performance.now()
    const previous = tapTimes.current.at(-1)
    const taps = tapTimes.current = previous == null || now - previous > 1500 ? [now] : [...tapTimes.current.slice(-3), now]
    if (taps.length < 2) return
    const bpm = Math.round(60000 * (taps.length - 1) / (now - taps[0]))
    if (bpm >= 40 && bpm <= 300) setTempoOverrides(current => ({ ...current, [track.title]: bpm }))
  }

  const changeTrack = (next: number, play: boolean) => {
    tapTimes.current = []
    setTransport(current => selectTrack(current, next, play))
  }

  const changeSource = (source: Source) => {
    setSource(source)
    setPanel(null)
    tapTimes.current = []
    setTransport(current => ({ ...current, playing: false }))
    sourceRef.current?.focus()
  }

  const panelAnchor = panel === 'playlist' ? playlistRef : panel === 'timeline' ? timelineRef : sourceRef
  const panelTitle = panel === 'playlist' ? 'Playlist' : panel === 'timeline' ? 'Track Timeline' : 'Audio Source'

  return <section className="ll-ad-study" data-audio-dock-study={study.id} aria-labelledby={`ll-ad-${study.id}`}>
    <h2 id={`ll-ad-${study.id}`}>{study.name}</h2>
    <div className="ll-ad-dock">
      <div className="ll-ad-side ll-ad-left" role="group" aria-label="Track and playback">
        <div className="ll-ad-track-name"><strong>{track?.title ?? 'No track loaded'}</strong><span>{track?.detail ?? 'Add Track to preview playback'}</span></div>
        <div className="ll-ad-toolbar">
          <div className="ll-ad-actions" role="group" aria-label="Transport">
            <DockKey icon="plus" label="Add Track" onClick={addTrack} disabled={!trackInput} />
            <DockKey icon="previous" label="Previous track" onClick={() => changeTrack(index - 1, playing)} disabled={!trackReady || index === 0} />
            <DockKey icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} className="ll-ad-play" disabled={!trackReady}
              onClick={() => setTransport(current => ({ ...current, elapsed: current.elapsed >= track.duration ? 0 : current.elapsed, playing: !current.playing }))} />
            <DockKey icon="next" label="Next track" onClick={() => changeTrack(index + 1, playing)} disabled={!trackReady || index >= queue.length - 1} />
            <DockKey icon="playlist" label="Playlist" buttonRef={playlistRef} aria-haspopup="dialog" aria-expanded={panel === 'playlist'} onClick={() => setPanel('playlist')} />
          </div>
          <label className="ll-ad-volume" title={`Preview volume: ${volume}%`}>
            <AppIcon kind="volume" size={13} />
            <input type="range" min="0" max="100" value={volume} aria-label="Preview volume"
              style={{ '--ad-volume': `${volume}%` } as CSSProperties} onChange={event => setVolume(event.target.valueAsNumber)} />
          </label>
        </div>
      </div>

      <div className="ll-ad-center" role="group" aria-label="Waveform">
        <div className="ll-ad-plot">
          <PreviewWaveform progress={progress} cue={cueProgress} />
          <input type="range" min="0" max={track?.duration ?? 1} step="0.25" value={elapsed} disabled={!trackReady} aria-label="Seek preview waveform"
            onChange={event => { const elapsed = event.target.valueAsNumber; setTransport(current => ({ ...current, elapsed })) }} />
        </div>
        <div className="ll-ad-time"><span>{timecode(elapsed)}</span><span>{timecode(track?.duration ?? 0)}</span></div>
      </div>

      <div className="ll-ad-side ll-ad-right" role="group" aria-label="Timing and source">
        <div className="ll-ad-readouts">
          <div className="ll-ad-bpm" role="group" aria-label="BPM">
            <span className="ll-ad-label">BPM</span>
            <div className="ll-ad-bpm-value">
              <output aria-label="Preview BPM">{bpm?.toFixed(2) ?? '—'}</output>
              <button type="button" className="ll-ad-tap" title="Tap tempo" aria-label="Tap tempo" disabled={!trackReady} onClick={tapTempo}><AppIcon kind="tap" size={11} />Tap</button>
            </div>
          </div>
          <div className="ll-ad-source">
            <span className="ll-ad-label">Source</span>
            <output className="ll-ad-source-value" data-source={source.id} aria-label="Selected audio source"><i aria-hidden="true" />{source.label}</output>
          </div>
        </div>
        <div className="ll-ad-toolbar">
          <div className="ll-ad-actions" role="group" aria-label="Track tools">
            <DockKey icon="timeline" label="Track Timeline" buttonRef={timelineRef} aria-haspopup="dialog" aria-expanded={panel === 'timeline'} disabled={!trackReady} onClick={() => setPanel('timeline')} />
            <DockKey icon="cue" label={playing ? 'Set cue point here' : 'Jump to cue'} disabled={!trackReady} onClick={() => setTransport(current => current.playing
              ? { ...current, cue: current.elapsed } : { ...current, elapsed: current.cue })} />
            <DockKey icon="sync" label="BPM Sync" aria-pressed={sync} disabled={source.id === 'live'} onClick={() => setSync(value => !value)} />
            <DockKey icon="sliders" label="Audio Source" buttonRef={sourceRef} aria-haspopup="dialog" aria-expanded={panel === 'source'} onClick={() => setPanel('source')} />
          </div>
          <output className="ll-ad-rekordbox" aria-label="Rekordbox status" data-loaded={!!rekordbox} title={`Rekordbox · ${rekordboxStatus}`}>
            <img src={rekordboxLogo} alt="Rekordbox" width={66} height={11} />
            <span>{rekordboxStatus}</span>
          </output>
        </div>
      </div>
    </div>

    <InfoPopover open={panel != null} anchorRef={panelAnchor} title={panelTitle} width={320} placement="below" align="end"
      className="ll-ad-popover" onOpenChange={open => { if (!open) setPanel(null) }}>
      {panel === 'playlist' && <>
        <div className="ll-ad-queue-settings">
          <label><input type="checkbox" checked={autoAdvance} onChange={event => setAutoAdvance(event.target.checked)} /> Automatic advance</label>
          <div role="group" aria-label="New track loads">
            <button type="button" aria-pressed={loadMode === 'append'} onClick={() => setLoadMode('append')}>Append</button>
            <button type="button" aria-pressed={loadMode === 'replace'} onClick={() => setLoadMode('replace')}>Replace</button>
          </div>
        </div>
        {queue.length === 0 && <p>No tracks loaded.</p>}
        <div className="ll-ad-menu">
          {queue.map((entry, position) => <div key={`${entry.title}-${position}`} className="ll-ad-queue-row">
            <button type="button" aria-pressed={position === index} disabled={!trackInput} onClick={() => changeTrack(position, true)}>{entry.title}</button>
            <DockKey icon="close" label={`Remove ${entry.title} from playlist`} disabled={!trackInput} onClick={() => removeTrack(position)} />
          </div>)}
        </div>
      </>}
      {panel === 'source' && <div className="ll-ad-menu">
        {SOURCES.map(option => <button type="button" key={option.id} aria-pressed={option.id === source.id} onClick={() => changeSource(option)}>{option.label}</button>)}
      </div>}
      {panel === 'timeline' && <div className="ll-ad-timeline"><span>{track?.title}</span><PreviewWaveform progress={progress} cue={cueProgress} /></div>}
    </InfoPopover>
  </section>
}

export function AudioDockStudies() {
  return <div className="ll-audio-studies" aria-label="Audio Dock design studies">
    <style>{popoverStyles + styles}</style>
    {STUDIES.map(study => <AudioDockStudy key={study.id} study={study} />)}
  </div>
}
