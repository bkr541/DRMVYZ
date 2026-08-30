import { useState } from 'react'
import { AudioWave02Icon, Download01Icon, SubtitleIcon, Delete02Icon } from 'hugeicons-react'
import { ContextActionMenu } from '../context-menu/ContextActionMenu'
import type { SavedAudioTrack } from '../../../stores/audioStore'

export interface AudioTrackCardProps {
  track: SavedAudioTrack
  onLoad: () => void
  onRemove?: () => void
  loading: boolean
  loaded: boolean
  playing: boolean
  loadError?: string | null
  canLoad: boolean
  canOpenLyrics: boolean
  canRemove: boolean
  isActive?: boolean
  onSelect?: () => void
  onOpenTimeline?: () => void
  onOpenActiveLyrics?: () => void
  onOpenAiExtract?: () => void
}

function fmtDuration(s: number | null): string {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// Short format label for the art tile's corner badge, derived from the
// track's own mime type (falling back to its file extension) — never
// invented data.
function formatLabel(track: SavedAudioTrack): string {
  const mime = track.mimeType?.toLowerCase() ?? ''
  if (mime.includes('wav')) return 'WAV'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'MP3'
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'M4A'
  if (mime.includes('ogg')) return 'OGG'
  if (mime.includes('flac')) return 'FLAC'
  const ext = track.fileName.split('.').pop()
  return ext ? ext.toUpperCase() : 'AUDIO'
}

/**
 * Reusable audio track card for the Media Library's Tracks list. Mirrors
 * the visual language of the non-audio media cards (art tile, corner
 * format badge, stacked title/artist/details, bare bottom-right icon
 * actions) instead of the flat, unshelled row it replaced — promoted from
 * the "Style 2" option in the AudioTrackStyleMockups review gallery.
 */
export function AudioTrackCard({
  track,
  onLoad,
  onRemove,
  loading,
  loaded,
  playing,
  loadError,
  canLoad,
  canOpenLyrics,
  canRemove,
  isActive,
  onSelect,
  onOpenTimeline,
  onOpenActiveLyrics,
  onOpenAiExtract,
}: AudioTrackCardProps) {
  const [lyricsMenu, setLyricsMenu] = useState<{ x: number; y: number } | null>(null)
  const details: string[] = []
  if (track.durationSec) details.push(fmtDuration(track.durationSec))
  if (track.bpm)         details.push(`${track.bpm} BPM`)
  if (track.musicalKey)  details.push(track.musicalKey)

  return (
    <div
      className={`vz-track-row${loaded ? ' vz-track-row--loaded' : ''}${playing ? ' vz-track-row--playing' : ''}${isActive ? ' vz-track-row--active' : ''}`}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } } : undefined}
    >
      <div className="vz-track-row-art">
        <div className="vz-track-row-badge">{formatLabel(track)}</div>
        <AudioWave02Icon size={20} color="currentColor" />
      </div>
      <div className="vz-track-row-info">
        <div className="vz-track-row-title-line">
          <span className="vz-track-row-title">{track.title}</span>
          <span className="vz-track-row-state-badges">
            {loaded && <span className="lmv-loaded-badge">Loaded</span>}
            {playing && <span className="lmv-playing-badge">Playing</span>}
          </span>
        </div>
        {track.artist && <div className="vz-track-row-artist">{track.artist}</div>}
        {details.length > 0 && <div className="vz-track-row-details">{details.join(' · ')}</div>}
        {loadError && <div className="vz-track-row-error" role="alert">{loadError}</div>}
      </div>
      <div className="vz-track-row-actions">
        {canLoad && (
          <button
            type="button"
            className="vz-track-action-btn"
            onClick={event => { event.stopPropagation(); onLoad() }}
            disabled={loading}
            title={loading ? 'Loading…' : loaded ? 'Reload this saved track without starting playback' : 'Load this saved track without starting playback'}
            aria-label={loading ? `Loading ${track.title}` : loaded ? `Reload ${track.title}` : `Load ${track.title}`}
          >
            <Download01Icon size={13} color="currentColor" />
          </button>
        )}
        {canOpenLyrics && (
          <button
            type="button"
            className="vz-track-action-btn"
            aria-haspopup="menu"
            title="Lyrics"
            aria-label={`Lyric actions for ${track.title}`}
            onClick={event => {
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              setLyricsMenu({ x: rect.right, y: rect.bottom + 4 })
            }}
          >
            <SubtitleIcon size={13} color="currentColor" />
          </button>
        )}
        {canRemove && onRemove && (
          <button
            type="button"
            className="vz-track-remove-btn"
            onClick={event => {
              event.stopPropagation()
              const confirmed = window.confirm(
                `Delete “${track.title}”? This also deletes its saved lyric versions and transcription jobs.`,
              )
              if (confirmed) onRemove()
            }}
            title="Delete track and linked lyric data"
            aria-label={`Delete ${track.title} and linked lyric data`}
          >
            <Delete02Icon size={12} color="currentColor" />
          </button>
        )}
      </div>
      {lyricsMenu && (
        <ContextActionMenu
          x={lyricsMenu.x}
          y={lyricsMenu.y}
          ariaLabel={`Lyric actions for ${track.title}`}
          header={{ title: track.title, subtitle: track.artist || 'Unknown artist' }}
          onClose={() => setLyricsMenu(null)}
          items={[
            { id: 'timeline', label: 'Open in Lyric Manager', onSelect: () => onOpenTimeline?.() },
            { id: 'active', label: 'Open Active Lyrics', onSelect: () => onOpenActiveLyrics?.() },
            { id: 'extract', label: 'AI Extract Lyrics', onSelect: () => onOpenAiExtract?.() },
          ]}
        />
      )}
    </div>
  )
}
