import { useCallback, useEffect, useState } from 'react'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useAudioStore, type SavedAudioTrack } from '../../../stores/audioStore'
import { loadSavedTrackIntoEngine } from '../../../audio/savedTrackLoader'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { IconChipButton } from '../react/controls/IconChipButton'
import { AppIcon } from '../../shared/icons/AppIcon'

type AudioTab = 'Mic' | 'Track'

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

/**
 * Where the visuals get their audio on a phone: the microphone (Live Input, for room or DJ audio) or one of the user's saved tracks. Both
 * go through the shared audio engine, so the visualizer reacts exactly as it does on desktop.
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
      {engine.source === 'file' && engine.currentTrack && <div className="mobile-audio-transport">
        <IconChipButton icon={<AppIcon kind={engine.isPlaying ? 'pause' : 'play'} size={16} />} onClick={() => engine.isPlaying ? engine.pause() : engine.play()}
          aria-label={engine.isPlaying ? 'Pause' : 'Play'} />
        <span className="mobile-audio-time">{formatTime(engine.currentTime)} / {formatTime(engine.duration)}</span>
      </div>}
      {(trackError || engine.trackLoadError || loadError) && <p className="mobile-audio-status" role="alert" data-error="true">{trackError ?? engine.trackLoadError ?? loadError}</p>}
      {loading && savedTracks.length === 0 && <p className="mobile-audio-status" role="status">Loading your tracks…</p>}
      {!loading && savedTracks.length === 0 && !loadError && <p className="mobile-audio-status" role="status">No saved tracks yet. Upload music in the desktop app and it will appear here.</p>}
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
