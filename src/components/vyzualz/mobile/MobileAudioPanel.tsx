import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useAudioStore, type SavedAudioTrack } from '../../../stores/audioStore'
import { loadSavedTrackIntoEngine } from '../../../audio/savedTrackLoader'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { IconChipButton } from '../react/controls/IconChipButton'
import { AppIcon } from '../../shared/icons/AppIcon'
import { describeUnplayableFile, PHONE_TRACK_ACCEPT } from './mobileAudioFiles'

type AudioTab = 'Mic' | 'Track'

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

/**
 * Where the visuals get their audio on a phone: the microphone (Live Input, for room or DJ audio), a file chosen from the phone, or one of the
 * user's saved tracks. All go through the shared audio engine, so the visualizer reacts exactly as it does on desktop. A phone file lives only
 * in this browser session; it is not uploaded to the account.
 */
export function MobileAudioPanel() {
  const engine = useSharedAudio()
  const savedTracks = useAudioStore(state => state.savedTracks)
  const loading = useAudioStore(state => state.loading)
  const loadError = useAudioStore(state => state.loadError)
  const [tab, setTab] = useState<AudioTab>(engine.source === 'microphone' ? 'Mic' : 'Track')
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const [trackError, setTrackError] = useState<string | null>(null)

  useEffect(() => { void useAudioStore.getState().loadSavedTracks() }, [])

  const listening = engine.source === 'microphone' && engine.liveInputActive
  const toggleMic = useCallback(() => {
    // Starting must happen inside this tap: phone browsers only allow the microphone prompt from a user gesture.
    void engine.setSource(listening ? 'file' : 'microphone')
  }, [engine, listening])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pickFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Clear the input so choosing the same file again still fires a change.
    event.target.value = ''
    if (!file) return
    const problem = describeUnplayableFile(file)
    if (problem) { setTrackError(problem); return }
    setTrackError(null)
    // Everything below is synchronous inside the picker's change event, so playback starts from the user's own action.
    const loaded = engine.replaceTracks([file])
    if (loaded.length === 0) return
    if (engine.source !== 'file') void engine.setSource('file')
    engine.play()
  }, [engine])

  const playTrack = useCallback(async (track: SavedAudioTrack) => {
    setTrackError(null)
    setLoadingTrackId(track.dbId)
    try {
      await loadSavedTrackIntoEngine(engine, track, { getSignedUrl: path => useAudioStore.getState().getSignedUrl(path) }, { autoplay: true })
    } catch (error) {
      setTrackError(error instanceof Error ? error.message : 'The track could not be loaded.')
    } finally {
      setLoadingTrackId(null)
    }
  }, [engine])

  return <section className="mobile-audio" aria-label="Audio source">
    <UnderlineTabs className="dv-underline-tabs--equal" tabs={[{ id: 'Mic', label: 'Mic' }, { id: 'Track', label: 'Track' }]}
      activeTab={tab} onChange={id => setTab(id as AudioTab)} ariaLabel="Audio source" />
    {tab === 'Mic' && <div className="mobile-audio-body">
      <p className="mobile-audio-status" role="status" data-listening={listening || undefined}>
        {listening ? 'Listening to the microphone' : engine.micError ?? 'The visuals react to sound this phone hears.'}
      </p>
      <IconChipButton tone={listening ? 'default' : 'primary'} icon={<AppIcon kind="waveform" size={16} />} onClick={toggleMic}>
        {listening ? 'Stop listening' : 'Start listening'}
      </IconChipButton>
    </div>}
    {tab === 'Track' && <div className="mobile-audio-body">
      {/* The system file picker: a track from this phone's Files app or storage. The input is hidden; the button opens it from the tap. */}
      <input ref={fileInputRef} type="file" accept={PHONE_TRACK_ACCEPT} className="mobile-audio-file-input" tabIndex={-1} aria-hidden="true" onChange={pickFile} />
      <IconChipButton tone="primary" icon={<AppIcon kind="plus" size={16} />} onClick={() => fileInputRef.current?.click()}>
        Choose a file from this phone
      </IconChipButton>
      {engine.source === 'file' && engine.currentTrack && <div className="mobile-audio-transport">
        <IconChipButton icon={<AppIcon kind={engine.isPlaying ? 'pause' : 'play'} size={16} />} onClick={() => engine.isPlaying ? engine.pause() : engine.play()}
          aria-label={engine.isPlaying ? 'Pause' : 'Play'} />
        <span className="mobile-audio-now">
          <strong>{engine.currentTrack.title ?? engine.currentTrack.name}</strong>
          <span className="mobile-audio-time">{formatTime(engine.currentTime)} / {formatTime(engine.duration)}</span>
        </span>
      </div>}
      {(trackError || engine.trackLoadError || loadError) && <p className="mobile-audio-status" role="alert" data-error="true">{trackError ?? engine.trackLoadError ?? loadError}</p>}
      {loading && savedTracks.length === 0 && <p className="mobile-audio-status" role="status">Loading your tracks…</p>}
      {!loading && savedTracks.length === 0 && !loadError && <p className="mobile-audio-status" role="status">No saved tracks yet. Music you upload in the desktop app will appear here.</p>}
      <ul className="mobile-track-list">
        {savedTracks.map(track => {
          const active = engine.source === 'file' && engine.currentAudioTrackId === track.dbId
          return <li key={track.dbId}>
            <button type="button" className="mobile-track" data-active={active || undefined} aria-pressed={active} disabled={loadingTrackId !== null || !track.storagePath}
              onClick={() => void playTrack(track)}>
              <strong>{track.title}</strong>
              <small>{loadingTrackId === track.dbId ? 'Loading…' : track.artist ?? track.fileName}</small>
            </button>
          </li>
        })}
      </ul>
    </div>}
  </section>
}
