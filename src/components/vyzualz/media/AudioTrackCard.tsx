import { AppIcon } from '../../shared/icons/AppIcon'
import { useState, type ReactNode } from 'react'

import { ContextActionMenu, type ContextActionMenuItem } from '../context-menu/ContextActionMenu'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'
import { StatusBadge } from '../react/controls/StatusBadge'
import type { SavedAudioTrack } from '../../../stores/audioStore'

export interface AudioTrackCardProps {
  track: SavedAudioTrack
  onLoad: () => void
  onRemove?: () => void
  loading: boolean
  loaded: boolean
  /** Show loaded state as a single accessible dot instead of a capsule. */
  loadedDot?: boolean
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
  /** Show a dot-only "Selected" badge when `isActive` (Media Library relies on the ring alone). */
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
  /** Lyric Manager: the row's actions are an Open Active Lyrics icon (when `onOpenActiveLyrics` is supplied)
   *  and one "more" (⋯) button; Load, AI Extract, Make Active Version and Delete Track are text items in
   *  its menu. Items appear only when their handler is supplied (`canLoad`, `canOpenLyrics` +
   *  `onOpenAiExtract`, `onMakeActiveVersion`, `canRemove` + `onRemove`). */
  actionsInOverflow?: boolean
  /** Render the card as a list row (see `artwork`) without an artwork tile. Duration, BPM and key then show as
   *  separate values, each under its own label, instead of one dotted line. */
  listRow?: boolean
  /** List row: the artist line sits above the title line, with the state badges right-aligned on it. */
  artistFirst?: boolean
  /** Compact icon/value metadata, used by Lyric Manager. */
  metadataIcons?: boolean
  /** Lyric Manager: render the card as a flat list row (hairline-separated, no card chrome) led by a
   *  square artwork tile holding this content (e.g. the title initials; tracks have no artwork field). */
  artwork?: ReactNode
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
  loadedDot,
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
  actionsInOverflow,
  listRow,
  artistFirst,
  metadataIcons,
  artwork,
}: AudioTrackCardProps) {
  const list = Boolean(artwork) || Boolean(listRow)
  const iconSize = list ? 15 : 13
  const [lyricsMenu, setLyricsMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const requestRemove = () => {
    if (confirmRemove) setConfirmDelete(true)
    else onRemove?.()
  }
  const overflowItems: ContextActionMenuItem[] = actionsInOverflow
    ? [
        ...(canLoad
          ? [{
              id: 'load',
              label: loading ? 'Loading…' : loaded ? 'Reload Track' : 'Load Track',
              disabled: loading,
              onSelect: onLoad,
            }]
          : []),
        ...(canOpenLyrics && onOpenAiExtract ? [{ id: 'extract', label: 'AI Extract Lyrics', onSelect: onOpenAiExtract }] : []),
        ...(onMakeActiveVersion ? [{ id: 'make-active', label: 'Make Open Version Active', onSelect: onMakeActiveVersion }] : []),
        ...(canRemove && onRemove
          ? [{
              id: 'delete',
              label: 'Delete Track',
              danger: true,
              dividerBefore: Boolean(canLoad || onMakeActiveVersion || (canOpenLyrics && onOpenAiExtract)),
              onSelect: requestRemove,
            }]
          : []),
      ]
    : []
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
  const stats = [
    track.durationSec ? { label: 'Duration', icon: 'clock' as const, value: fmtDuration(track.durationSec) } : null,
    track.bpm ? { label: 'BPM', icon: 'rhythm' as const, value: String(track.bpm) } : null,
    track.musicalKey ? { label: 'Key', icon: 'music' as const, value: track.musicalKey } : null,
  ].filter((stat): stat is NonNullable<typeof stat> => stat !== null)

  const stateBadges = (
    <span className="vz-track-row-state-badges">
      {selectedBadge && isActive && (
        // Dot only: the row's wash and left bar already say "selected"; the text stays for assistive tech and the tooltip.
        <span className="vz-track-row-selected-dot" title="Selected">
          <StatusBadge tone="selected"><span className="sr-only">Selected</span></StatusBadge>
        </span>
      )}
      {loaded && (loadedDot
        ? <span className="vz-track-row-loaded-dot" role="img" aria-label="Loaded" title="Loaded" />
        : <StatusBadge tone="loaded">Loaded</StatusBadge>)}
      {playing && <StatusBadge tone="playing">Playing</StatusBadge>}
    </span>
  )
  const hasStateBadges = Boolean((selectedBadge && isActive) || loaded || playing)

  return (
    <div
      className={`vz-track-row${list ? ' vz-track-row--list' : ''}${loaded ? ' vz-track-row--loaded' : ''}${playing ? ' vz-track-row--playing' : ''}${isActive ? ' vz-track-row--active' : ''}`}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      aria-pressed={onSelect ? Boolean(isActive) : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } } : undefined}
    >
      {artwork && <div className="vz-track-row-art vz-track-row-art--list" aria-hidden="true">{artwork}</div>}
      <div className="vz-track-row-info">
        {artistFirst && (track.artist || hasStateBadges) && (
          <div className="vz-track-row-artist-line">
            {track.artist && <span className="vz-track-row-artist">{track.artist}</span>}
            {stateBadges}
          </div>
        )}
        <div className="vz-track-row-title-line">
          <span className="vz-track-row-title">{track.title}</span>
          {!artistFirst && stateBadges}
        </div>
        {!artistFirst && track.artist && <div className="vz-track-row-artist">{track.artist}</div>}
        {listRow
          ? stats.length > 0 && (
              <dl className={`vz-track-row-stats${metadataIcons ? ' vz-track-row-stats--icons' : ''}`}>
                {stats.map(stat => (
                  <div key={stat.label} className="vz-track-row-stat">
                    <dt className={metadataIcons ? 'sr-only' : undefined}>{stat.label}</dt>
                    <dd className={metadataIcons ? 'lmv-track-stat-value' : undefined} title={metadataIcons ? `${stat.label}: ${stat.value}` : undefined}>
                      {metadataIcons && <AppIcon kind={stat.icon} size={12} />}
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )
          : details.length > 0 && <div className="vz-track-row-details">{details.join(' · ')}</div>}
        {loadError && <div className="vz-track-row-error" role="alert">{loadError}</div>}
      </div>
      <div className="vz-track-row-actions">
        {canLoad && !actionsInOverflow && (
          <button
            type="button"
            className="vz-track-action-btn"
            onClick={event => { event.stopPropagation(); onLoad() }}
            disabled={loading}
            title={loading ? 'Loading…' : loaded ? 'Reload this saved track without starting playback' : 'Load this saved track without starting playback'}
            aria-label={loading ? `Loading ${track.title}` : loaded ? `Reload ${track.title}` : `Load ${track.title}`}
          >
            <AppIcon kind="download" size={iconSize} color="currentColor" />
          </button>
        )}
        {canOpenLyrics && directAiExtract && !actionsInOverflow && onOpenAiExtract && (
          <button
            type="button"
            className="vz-track-action-btn"
            title="AI extract lyrics from this track"
            aria-label={`AI extract lyrics for ${track.title}`}
            onClick={event => { event.stopPropagation(); onOpenAiExtract() }}
          >
            <AppIcon kind="wand" size={iconSize} color="currentColor" />
          </button>
        )}
        {canOpenLyrics && !directAiExtract && !actionsInOverflow && lyricsMenuItems.length > 0 && (
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
            <AppIcon kind="lyrics" size={iconSize} color="currentColor" />
          </button>
        )}
        {actionsInOverflow && onOpenActiveLyrics && (
          <button
            type="button"
            className="vz-track-action-btn"
            title="Open active lyrics"
            aria-label={`Open active lyrics for ${track.title}`}
            onClick={event => { event.stopPropagation(); onOpenActiveLyrics() }}
          >
            <AppIcon kind="lyricVersions" size={iconSize} color="currentColor" />
          </button>
        )}
        {actionsInOverflow && overflowItems.length > 0 && (
          <button
            type="button"
            className="vz-track-action-btn"
            aria-haspopup="menu"
            title="More actions"
            aria-label={`More actions for ${track.title}`}
            onClick={event => {
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              setLyricsMenu({ x: rect.right, y: rect.bottom + 4 })
            }}
          >
            <AppIcon kind="more" size={iconSize} color="currentColor" />
          </button>
        )}
        {!actionsInOverflow && canRemove && onRemove && (
          <button
            type="button"
            className="vz-track-remove-btn"
            onClick={event => {
              event.stopPropagation()
              requestRemove()
            }}
            title="Delete track and linked lyric data"
            aria-label={`Delete ${track.title} and linked lyric data`}
          >
            <AppIcon kind="delete" size={12} color="currentColor" />
          </button>
        )}
      </div>
      {/* Both are portaled, but React still bubbles their events through this card: keep menu/dialog clicks from selecting the row. */}
      <div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
        {lyricsMenu && (
          <ContextActionMenu
            x={lyricsMenu.x}
            y={lyricsMenu.y}
            ariaLabel={`Lyric actions for ${track.title}`}
            header={{ title: track.title, subtitle: track.artist || 'Unknown artist' }}
            onClose={() => setLyricsMenu(null)}
            items={actionsInOverflow ? overflowItems : lyricsMenuItems}
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
    </div>
  )
}
