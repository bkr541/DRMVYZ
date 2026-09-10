import { useState } from 'react'
import { Download01Icon, SubtitleIcon, MagicWand01Icon, Delete02Icon } from 'hugeicons-react'
import { ContextActionMenu } from '../context-menu/ContextActionMenu'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'
import { StatusBadge } from '../react/controls/StatusBadge'
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
  /** Show a "Selected" text badge when `isActive` (Media Library relies on the ring alone). */
  selectedBadge?: boolean
  /** Adds a "Load and Play" item to the lyric actions menu. */
  onLoadAndPlay?: () => void
  /** Adds a "Make Active Version" item to the lyric actions menu. */
  onMakeActiveVersion?: () => void
  /** When false, Delete calls `onRemove` immediately and the caller owns the
   *  confirmation dialog. Defaults to true (this card shows its own). */
  confirmRemove?: boolean
  /** Lyric Manager: replace the lyric-actions menu button with a single direct
   *  "AI Extract" icon button (calls `onOpenAiExtract`). */
  directAiExtract?: boolean
}

function fmtDuration(s: number | null): string {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/**
 * Reusable audio track card for the Media Library's Tracks list: stacked
 * title/artist/details with bare icon actions — promoted from the "Style 2"
 * option in the AudioTrackStyleMockups review gallery.
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
  selectedBadge,
  onLoadAndPlay,
  onMakeActiveVersion,
  confirmRemove = true,
  directAiExtract,
}: AudioTrackCardProps) {
  const [lyricsMenu, setLyricsMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const lyricsMenuItems = [
    ...(onLoadAndPlay ? [{ id: 'load-play', label: 'Load and Play', onSelect: onLoadAndPlay }] : []),
    ...(onOpenTimeline ? [{ id: 'timeline', label: 'Open in Lyric Manager', onSelect: onOpenTimeline }] : []),
    ...(onOpenActiveLyrics ? [{ id: 'active', label: 'Open Active Lyrics', onSelect: onOpenActiveLyrics }] : []),
    ...(onOpenAiExtract ? [{ id: 'extract', label: 'AI Extract Lyrics', onSelect: onOpenAiExtract }] : []),
    ...(onMakeActiveVersion ? [{ id: 'make-active', label: 'Make Active Version', onSelect: onMakeActiveVersion }] : []),
  ]
  const details: string[] = []
  if (track.durationSec) details.push(fmtDuration(track.durationSec))
  if (track.bpm)         details.push(`${track.bpm} BPM`)
  if (track.musicalKey)  details.push(track.musicalKey)

  return (
    <div
      className={`vz-track-row${loaded ? ' vz-track-row--loaded' : ''}${playing ? ' vz-track-row--playing' : ''}${isActive ? ' vz-track-row--active' : ''}`}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      aria-pressed={onSelect ? Boolean(isActive) : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } } : undefined}
    >
      <div className="vz-track-row-info">
        <div className="vz-track-row-title-line">
          <span className="vz-track-row-title">{track.title}</span>
          <span className="vz-track-row-state-badges">
            {selectedBadge && isActive && <StatusBadge tone="selected">Selected</StatusBadge>}
            {loaded && <StatusBadge tone="loaded">Loaded</StatusBadge>}
            {playing && <StatusBadge tone="playing">Playing</StatusBadge>}
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
        {canOpenLyrics && directAiExtract && onOpenAiExtract && (
          <button
            type="button"
            className="vz-track-action-btn"
            title="AI extract lyrics from this track"
            aria-label={`AI extract lyrics for ${track.title}`}
            onClick={event => { event.stopPropagation(); onOpenAiExtract() }}
          >
            <MagicWand01Icon size={13} color="currentColor" />
          </button>
        )}
        {canOpenLyrics && !directAiExtract && lyricsMenuItems.length > 0 && (
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
              if (confirmRemove) setConfirmDelete(true)
              else onRemove()
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
          items={lyricsMenuItems}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Track"
          message={`Delete “${track.title}”? This also deletes its saved lyric versions and transcription jobs.`}
          notice="Deleted audio tracks will not be available to use within specific areas within React Shows, Lyrics, etc. The same deleted audio track will still be available to be used when loaded in the Audio Dock."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { setConfirmDelete(false); onRemove?.() }}
        />
      )}
    </div>
  )
}
