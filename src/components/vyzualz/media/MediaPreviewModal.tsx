import { useRef, useState, useEffect, useCallback } from 'react'
import { PlayIcon, PauseIcon } from 'hugeicons-react'
import type { UploadedMedia } from '../../../stores/mediaStore'

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function MediaPreviewModal({
  media,
  onClose,
}: {
  media: UploadedMedia
  onClose: () => void
}) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const [playing,     setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [videoError,  setVideoError]  = useState(false)
  const [imageError,  setImageError]  = useState(false)

  const isVideo  = media.type === 'video'
  const hasAlpha = media.metadata?.hasAlpha === true
  const src      = media.url || null

  // Reset all playback and error state whenever the previewed media changes.
  useEffect(() => {
    const v = videoRef.current
    if (v) {
      v.pause()
      try { v.currentTime = 0 } catch { /* not yet loaded */ }
    }
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setVideoError(false)
    setImageError(false)
  }, [media.id, src])

  // Set crossOrigin BEFORE src — matching mediaPool.ts pattern.
  // JSX attribute order is not guaranteed, so we do this imperatively.
  useEffect(() => {
    if (!isVideo || !src) return
    const v = videoRef.current
    if (!v) return
    v.crossOrigin = 'anonymous'
    v.src = src
    v.load()
    return () => {
      v.pause()
      v.src = ''
    }
  }, [isVideo, src])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else          v.pause()
  }, [])

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v || !isFinite(v.duration)) return
    v.currentTime = parseFloat(e.target.value)
  }, [])

  return (
    <div className="mum-backdrop" role="presentation">
      <div
        className="mpm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${media.title ?? media.name}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mpm-header">
          <span className="mpm-title" title={media.title ?? media.name}>
            {media.title ?? media.name}
          </span>
          <button className="mpm-close" onClick={onClose} aria-label="Close preview">
            ×
          </button>
        </div>

        {/* Media area */}
        <div className={`mpm-media-area${hasAlpha ? ' mpm-media-area--transparent' : ''}`}>
          {!src ? (
            <div className="mpm-error">Media file unavailable</div>
          ) : isVideo && videoError ? (
            <div className="mpm-error">Video could not be loaded</div>
          ) : isVideo ? (
            <video
              key={src}
              ref={videoRef}
              className="mpm-video"
              onTimeUpdate={e  => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={e => {
                const v = e.currentTarget
                console.error('[MediaPreviewModal] video error', {
                  src: v.currentSrc || v.src,
                  code: v.error?.code,
                  message: v.error?.message,
                  networkState: v.networkState,
                  readyState: v.readyState,
                })
                setVideoError(true)
              }}
              playsInline
            />
          ) : imageError ? (
            <div className="mpm-error">Image could not be loaded</div>
          ) : (
            <img
              key={src}
              src={src}
              alt={media.title ?? media.name}
              className="mpm-image"
              onError={() => setImageError(true)}
            />
          )}
        </div>

        {/* Video controls */}
        {isVideo && src && !videoError && (
          <div className="mpm-controls">
            <button
              className="mpm-play-btn"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing
                ? <PauseIcon size={12} color="currentColor" />
                : <PlayIcon  size={12} color="currentColor" />
              }
            </button>
            <input
              type="range"
              className="mpm-scrubber"
              min={0}
              max={duration || 100}
              step={0.05}
              value={currentTime}
              onChange={handleScrub}
              aria-label="Scrub video"
            />
            <span className="mpm-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
