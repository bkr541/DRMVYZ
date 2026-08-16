import { BubbleRevealSlider } from '../react/controls/BubbleRevealSlider'
import { NoticeCard } from '../react/controls/NoticeCard'
import { IconChipButton } from '../react/controls/IconChipButton'
import { useRef, useState, useEffect, useCallback } from 'react'
import { PlayIcon, PauseIcon } from 'hugeicons-react'
import { useMediaStore } from '../../../stores/mediaStore'
import type { UploadedMedia } from '../../../stores/mediaStore'

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}


export function restorePreviewPlaybackPosition(video: Pick<HTMLVideoElement, 'currentTime' | 'duration'>, resumeAt: number): boolean {
  if (!Number.isFinite(resumeAt) || resumeAt <= 0) return false
  const target = Number.isFinite(video.duration) ? Math.min(resumeAt, video.duration) : resumeAt
  try {
    video.currentTime = target
    return true
  } catch {
    return false
  }
}

export function MediaPreviewModal({
  media,
  onClose,
}: {
  media: UploadedMedia
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const resumeAtRef = useRef(0)
  const retryMediaAsset = useMediaStore(state => state.retryMediaAsset)
  const markMediaAssetLoaded = useMediaStore(state => state.markMediaAssetLoaded)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [videoError, setVideoError] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [recovering, setRecovering] = useState(false)

  const isVideo = media.type === 'video'
  const hasAlpha = media.metadata?.hasAlpha === true
  const src = media.url || null

  // A different media item starts from zero. A URL refresh for the same item
  // preserves its last playable position through resumeAtRef.
  useEffect(() => {
    resumeAtRef.current = 0
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setVideoError(false)
    setImageError(false)
    setRecovering(false)
  }, [media.id])

  // Set crossOrigin before src. When an expired URL is replaced, restore the
  // playback position after metadata is available instead of restarting.
  useEffect(() => {
    if (!isVideo || !src) return
    const video = videoRef.current
    if (!video) return
    video.crossOrigin = 'anonymous'
    video.src = src
    video.load()
    return () => {
      resumeAtRef.current = Math.max(resumeAtRef.current, video.currentTime || 0)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [isVideo, src])

  const recoverAsset = useCallback(async (variant: 'original' | 'thumbnail') => {
    if (recovering) return
    if (variant === 'original' && videoRef.current) {
      resumeAtRef.current = Math.max(resumeAtRef.current, videoRef.current.currentTime || currentTime)
    }
    setRecovering(true)
    const recovered = await retryMediaAsset(media.id, variant)
    if (recovered) {
      setVideoError(false)
      setImageError(false)
    }
    setRecovering(false)
  }, [currentTime, media.id, recovering, retryMediaAsset])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }, [])

  const handleScrub = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video || !isFinite(video.duration)) return
    video.currentTime = parseFloat(event.target.value)
  }, [])

  return (
    <div className="mum-backdrop" role="presentation">
      <div
        className="mpm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${media.title ?? media.name}`}
        onClick={event => event.stopPropagation()}
      >
        <div className="mpm-header">
          <span className="mpm-title" title={media.title ?? media.name}>{media.title ?? media.name}</span>
          <button className="mpm-close" onClick={onClose} aria-label="Close preview">×</button>
        </div>

        <div className={`mpm-media-area${hasAlpha ? ' mpm-media-area--transparent' : ''}`}>
          {!src ? (
            <NoticeCard className="mpm-error" tone="error" role="status" title="Media unavailable">{recovering ? 'Refreshing media link…' : 'Media file unavailable'}</NoticeCard>
          ) : isVideo && videoError ? (
            <NoticeCard className="mpm-error" tone="error" role="alert" title="Video unavailable">
              {recovering ? 'Refreshing media link…' : 'Video could not be loaded'}{' '}
              {!recovering && <IconChipButton onClick={() => { void recoverAsset('original') }}>Retry</IconChipButton>}
            </NoticeCard>
          ) : isVideo ? (
            <video
              ref={videoRef}
              className="mpm-video"
              onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
              onLoadedMetadata={event => {
                const video = event.currentTarget
                setDuration(video.duration)
                restorePreviewPlaybackPosition(video, resumeAtRef.current)
                markMediaAssetLoaded(media.id, 'original')
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={event => {
                const video = event.currentTarget
                resumeAtRef.current = Math.max(resumeAtRef.current, video.currentTime || currentTime)
                setVideoError(true)
                void recoverAsset('original')
              }}
              playsInline
            />
          ) : imageError ? (
            <NoticeCard className="mpm-error" tone="error" role="alert" title="Image unavailable">
              {recovering ? 'Refreshing media link…' : 'Image could not be loaded'}{' '}
              {!recovering && <IconChipButton onClick={() => { void recoverAsset('original') }}>Retry</IconChipButton>}
            </NoticeCard>
          ) : (
            <img
              src={src}
              alt={media.title ?? media.name}
              className="mpm-image"
              onLoad={() => markMediaAssetLoaded(media.id, 'original')}
              onError={() => {
                setImageError(true)
                void recoverAsset('original')
              }}
            />
          )}
        </div>

        {isVideo && src && !videoError && (
          <div className="mpm-controls">
            <button className="mpm-play-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <PauseIcon size={12} color="currentColor" /> : <PlayIcon size={12} color="currentColor" />}
            </button>
            <BubbleRevealSlider
              type="range"
              className="mpm-scrubber"
              min={0}
              max={duration || 100}
              step={0.05}
              value={currentTime}
              onChange={handleScrub}
              aria-label="Scrub video"
            />
            <span className="mpm-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
