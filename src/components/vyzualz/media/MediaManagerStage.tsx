import { useEffect, useRef, useState } from 'react'
import { MusicNote01Icon, PauseIcon, PlayIcon } from 'hugeicons-react'
import { NoticeCard } from '../react/controls/NoticeCard'
import { IconChipButton } from '../react/controls/IconChipButton'
import { BubbleRevealSlider } from '../react/controls/BubbleRevealSlider'
import { VzMiniWaveform } from '../transport/VzMiniWaveform'
import { useWaveformPeaks } from '../hooks/useWaveformPeaks'
import { useMediaStore } from '../../../stores/mediaStore'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { useAudioStore } from '../../../stores/audioStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── Visual media (plain, no live effects) ────────────────────────────────────

function VisualMediaStage({ media }: { media: UploadedMedia }) {
  const retryMediaAsset = useMediaStore(state => state.retryMediaAsset)
  const markMediaAssetLoaded = useMediaStore(state => state.markMediaAssetLoaded)
  const [videoError, setVideoError] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setVideoError(false)
    setImageError(false)
    setRecovering(false)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [media.id])

  const isVideo = media.type === 'video'
  const hasAlpha = media.metadata?.hasAlpha === true
  const src = media.url || null

  const recoverAsset = async () => {
    if (recovering) return
    setRecovering(true)
    const recovered = await retryMediaAsset(media.id, 'original')
    if (recovered) { setVideoError(false); setImageError(false) }
    setRecovering(false)
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }

  return (
    <div className="mms-stage">
      <div className={`mms-media-area${hasAlpha ? ' mms-media-area--transparent' : ''}`}>
        {!src ? (
          <NoticeCard tone="error" role="status" title="Media unavailable">{recovering ? 'Refreshing media link…' : 'Media file unavailable'}</NoticeCard>
        ) : isVideo && videoError ? (
          <NoticeCard tone="error" role="alert" title="Video unavailable">
            {recovering ? 'Refreshing media link…' : 'Video could not be loaded'}{' '}
            {!recovering && <IconChipButton onClick={() => { void recoverAsset() }}>Retry</IconChipButton>}
          </NoticeCard>
        ) : isVideo ? (
          <video
            ref={videoRef}
            className="mms-video"
            src={src}
            crossOrigin="anonymous"
            onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
            onLoadedMetadata={event => { setDuration(event.currentTarget.duration); markMediaAssetLoaded(media.id, 'original') }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => { setVideoError(true); void recoverAsset() }}
            playsInline
          />
        ) : imageError ? (
          <NoticeCard tone="error" role="alert" title="Image unavailable">
            {recovering ? 'Refreshing media link…' : 'Image could not be loaded'}{' '}
            {!recovering && <IconChipButton onClick={() => { void recoverAsset() }}>Retry</IconChipButton>}
          </NoticeCard>
        ) : (
          <img
            src={src}
            alt={media.title ?? media.name}
            className="mms-image"
            onLoad={() => markMediaAssetLoaded(media.id, 'original')}
            onError={() => { setImageError(true); void recoverAsset() }}
          />
        )}
      </div>

      {isVideo && src && !videoError && (
        <div className="mms-controls">
          <button className="mms-play-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <PauseIcon size={13} color="currentColor" /> : <PlayIcon size={13} color="currentColor" />}
          </button>
          <BubbleRevealSlider
            type="range"
            className="mms-scrubber"
            min={0}
            max={duration || 100}
            step={0.05}
            value={currentTime}
            onChange={event => {
              const video = videoRef.current
              if (video && isFinite(video.duration)) video.currentTime = parseFloat(event.target.value)
            }}
            aria-label="Scrub video"
          />
          <span className="mms-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      )}

      <div className="mms-caption">{media.title ?? media.name}</div>
    </div>
  )
}

// ── Audio track (independent preview player, never touches the shared deck) ─

function AudioTrackStage({ track }: { track: SavedAudioTrack }) {
  const getSignedUrl = useAudioStore(state => state.getSignedUrl)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(track.durationSec ?? 0)

  useEffect(() => {
    setSignedUrl(null)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(track.durationSec ?? 0)
    if (!track.storagePath) return
    let cancelled = false
    void getSignedUrl(track.storagePath).then(url => { if (!cancelled) setSignedUrl(url) })
    return () => { cancelled = true }
  }, [track.id, track.storagePath]) // eslint-disable-line react-hooks/exhaustive-deps

  const { peaks } = useWaveformPeaks(track.id, null, signedUrl)

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }

  return (
    <div className="mms-stage mms-stage--audio">
      <div className="mms-track-hero">
        <div className="mms-track-hero-art" aria-hidden="true">
          <MusicNote01Icon size={28} color="currentColor" />
        </div>
        <div className="mms-track-hero-info">
          <div className="mms-track-hero-title">{track.title}</div>
          <div className="mms-track-hero-artist">{track.artist || 'Unknown artist'}</div>
          <div className="mms-track-hero-meta">
            {track.musicalKey && <span>{track.musicalKey}</span>}
            {track.bpm && <span>{track.bpm} BPM</span>}
          </div>
        </div>
      </div>

      <div className="mms-controls">
        <button className="mms-play-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} disabled={!signedUrl}>
          {playing ? <PauseIcon size={13} color="currentColor" /> : <PlayIcon size={13} color="currentColor" />}
        </button>
        <div className="mms-waveform-wrap">
          <VzMiniWaveform
            duration={duration}
            currentTime={currentTime}
            peaks={peaks}
            onSeek={time => { const audio = audioRef.current; if (audio) audio.currentTime = time }}
          />
        </div>
        <span className="mms-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>

      {signedUrl && (
        <audio
          ref={audioRef}
          src={signedUrl}
          onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={event => { if (isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration) }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function MediaManagerStage({
  media,
  track,
}: {
  media: UploadedMedia | null
  track: SavedAudioTrack | null
}) {
  if (media) return <VisualMediaStage key={media.id} media={media} />
  if (track) return <AudioTrackStage key={track.id} track={track} />
  return (
    <div className="mms-empty">
      <p>Select media from the library to preview it here.</p>
    </div>
  )
}
