import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { NoticeCard } from '../react/controls/NoticeCard'
import { IconChipButton } from '../react/controls/IconChipButton'
import { memo, useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  Layers01Icon,
  FavouriteIcon,
  Delete02Icon,
  PencilEdit01Icon,
  FolderLibraryIcon,
  ArrowLeft01Icon,
  GridViewIcon,
  ListViewIcon,
  PropertyViewIcon,
  MusicNote01Icon,
  Refresh01Icon,
} from 'hugeicons-react'
import { useMediaStore } from '../../../stores/mediaStore'
import type { UploadedMedia, MediaCollection, MediaMutationState } from '../../../stores/mediaStore'
import type { MediaLibraryQuery, MediaLibraryServerFilter } from '../../../lib/mediaDb'
import type { MediaRole } from '../../../lib/mediaRoles'
import { useAudioStore } from '../../../stores/audioStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { MediaUploadModal } from '../MediaUploadModal'
import { MediaPreviewModal } from './MediaPreviewModal'
import { MediaStatusBar } from './MediaStatusBar'
import { AudioTrackEditModal } from './AudioTrackEditModal'
import { AudioTrackPreviewModal } from './AudioTrackPreviewModal'
import { CollectionEditorModal } from './CollectionEditorModal'
import { MEDIA_ROLE_BADGE_LABELS, MEDIA_ROLE_LABELS } from '../../../lib/mediaRoles'
import { isUnifiedSvgMediaItem } from '../../../lib/svgMediaEligibility'
import type { MediaLibraryCapability, MediaLibraryContext } from './mediaLibraryCapabilities'
import { loadSavedTrackIntoEngine } from '../../../audio/savedTrackLoader'
import { ContextActionMenu } from '../context-menu/ContextActionMenu'
import { createLyricManagerNavigationIntent } from '../../../features/lyrics/lyricNavigation'
import type { LyricManagerNavigationIntent } from '../../../features/lyrics/lyricNavigation'

type MediaLibraryFilter = 'all' | 'tracks' | 'collections' | 'images' | 'videos' | 'favorites' | 'backgrounds' | 'logos' | 'transparent' | 'overlays' | 'svg'
type ViewMode = 'grid' | 'list'


export interface VirtualMediaWindow {
  columns: number
  rowHeight: number
  startIndex: number
  endIndex: number
  topSpacer: number
  bottomSpacer: number
}

export function computeVirtualMediaWindow(input: {
  itemCount: number
  width: number
  height: number
  scrollTop: number
  viewMode: ViewMode
  manager: boolean
  overscanRows?: number
}): VirtualMediaWindow {
  const width = Math.max(240, input.width || (input.manager ? 900 : 320))
  const height = Math.max(240, input.height || 600)
  const columns = input.viewMode === 'list'
    ? 1
    : input.manager ? Math.max(1, Math.floor((width - 8 + 10) / 200)) : 2
  const rowHeight = input.viewMode === 'list' ? 58 : input.manager ? 190 : 150
  const totalRows = Math.ceil(input.itemCount / columns)
  const overscan = input.overscanRows ?? 3
  const firstVisibleRow = Math.max(0, Math.floor(Math.max(0, input.scrollTop) / rowHeight))
  const visibleRows = Math.max(1, Math.ceil(height / rowHeight))
  const startRow = Math.max(0, firstVisibleRow - overscan)
  const endRow = Math.min(totalRows, firstVisibleRow + visibleRows + overscan)
  return {
    columns,
    rowHeight,
    startIndex: Math.min(input.itemCount, startRow * columns),
    endIndex: Math.min(input.itemCount, endRow * columns),
    topSpacer: startRow * rowHeight,
    bottomSpacer: Math.max(0, (totalRows - endRow) * rowHeight),
  }
}

const VirtualizedMediaCards = memo(function VirtualizedMediaCards({
  items,
  viewMode,
  manager,
  scrollRef,
  renderCard,
  ensureSigned,
  onNearEnd,
  hasMore,
  loadingMore,
}: {
  items: UploadedMedia[]
  viewMode: ViewMode
  manager: boolean
  scrollRef: RefObject<HTMLDivElement>
  renderCard: (item: UploadedMedia) => ReactNode
  ensureSigned?: (visibleIds: string[], nearIds: string[]) => void
  onNearEnd?: () => void
  hasMore?: boolean
  loadingMore?: boolean
}) {
  const [metrics, setMetrics] = useState({ width: manager ? 900 : 320, height: 600, scrollTop: 0 })

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const update = () => setMetrics({
      width: element.clientWidth || (manager ? 900 : 320),
      height: element.clientHeight || 600,
      scrollTop: element.scrollTop,
    })
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(element)
    return () => {
      element.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [manager, scrollRef])

  const windowed = computeVirtualMediaWindow({ itemCount: items.length, ...metrics, viewMode, manager })
  const visibleItems = items.slice(windowed.startIndex, windowed.endIndex)
  const nearStart = Math.max(0, windowed.startIndex - windowed.columns * 2)
  const nearEnd = Math.min(items.length, windowed.endIndex + windowed.columns * 2)
  const visibleIdKey = visibleItems.map(item => item.id).join('\u0000')
  const nearIdKey = items.slice(nearStart, nearEnd).map(item => item.id).join('\u0000')

  useEffect(() => {
    ensureSigned?.(
      visibleIdKey ? visibleIdKey.split('\u0000') : [],
      nearIdKey ? nearIdKey.split('\u0000') : [],
    )
  }, [ensureSigned, nearIdKey, visibleIdKey])

  useEffect(() => {
    if (!hasMore || loadingMore || items.length === 0) return
    if (windowed.endIndex >= Math.max(0, items.length - windowed.columns * 3)) onNearEnd?.()
  }, [hasMore, items.length, loadingMore, onNearEnd, windowed.columns, windowed.endIndex])

  return (
    <div className="vz-media-virtual" data-rendered-cards={visibleItems.length}>
      {windowed.topSpacer > 0 && <div className="vz-media-virtual-spacer" style={{ height: windowed.topSpacer }} aria-hidden="true" />}
      <div className={viewMode === 'list' ? 'vz-media-list' : 'vz-media-grid'}>
        {visibleItems.map(renderCard)}
      </div>
      {windowed.bottomSpacer > 0 && <div className="vz-media-virtual-spacer" style={{ height: windowed.bottomSpacer }} aria-hidden="true" />}
      {loadingMore && <div className="vz-media-page-state" role="status">Loading more media…</div>}
      {!hasMore && items.length > 0 && <div className="vz-media-page-state">End of library</div>}
    </div>
  )
})

function toServerFilter(filter: MediaLibraryFilter): MediaLibraryServerFilter {
  if (filter === 'tracks' || filter === 'collections') return 'all'
  return filter
}

function matchesSearch(item: UploadedMedia, query: string): boolean {
  const lower = query.trim().toLowerCase()
  if (!lower) return true
  return (item.title ?? item.name).toLowerCase().includes(lower)
    || item.name.toLowerCase().includes(lower)
    || (item.description ?? '').toLowerCase().includes(lower)
    || item.tags.some(tag => tag.toLowerCase().includes(lower))
}

function PerformanceDeckEmptyState({
  message,
  onOpenMediaManager,
}: {
  message: string
  onOpenMediaManager?: () => void
}) {
  return (
    <div className="vz-media-empty">
      <span>{message}</span>
      {onOpenMediaManager && (
        <IconChipButton onClick={onOpenMediaManager}>
          Open Media Manager
        </IconChipButton>
      )}
    </div>
  )
}

const VISUALIZER_FILTERS: { key: MediaLibraryFilter; label: string }[] = [
  { key: 'all',         label: 'All'         },
  { key: 'collections', label: 'Collections' },
  { key: 'favorites',   label: 'Favorites'   },
  { key: 'tracks',      label: 'Tracks'      },
  { key: 'images',      label: 'Images'      },
  { key: 'videos',      label: 'Videos'      },
  { key: 'backgrounds', label: 'Backgrounds' },
  { key: 'logos',       label: 'Logos'       },
  { key: 'transparent', label: 'Transparent' },
  { key: 'overlays',    label: 'Overlays'    },
]

const REACT_FILTERS: { key: MediaLibraryFilter; label: string }[] = [
  { key: 'all',         label: 'All'         },
  { key: 'collections', label: 'Collections' },
  { key: 'favorites',   label: 'Favorites'   },
  { key: 'tracks',      label: 'Tracks'      },
  { key: 'svg',         label: 'SVG'         },
  { key: 'logos',       label: 'Logos'       },
  { key: 'transparent', label: 'Transparent' },
  { key: 'overlays',    label: 'Overlays'    },
]

const CANVAS_FILTERS: { key: MediaLibraryFilter; label: string }[] = [
  { key: 'all',         label: 'All'         },
  { key: 'collections', label: 'Collections' },
  { key: 'favorites',   label: 'Favorites'   },
  { key: 'images',      label: 'Images'      },
  { key: 'videos',      label: 'Videos'      },
  { key: 'svg',         label: 'SVG'         },
]

const PIX_GRID_FILTERS: { key: MediaLibraryFilter; label: string }[] = [
  { key: 'all',         label: 'All Visuals' },
  { key: 'collections', label: 'Collections' },
  { key: 'favorites',   label: 'Favorites'   },
  { key: 'images',      label: 'Still Images' },
  { key: 'svg',         label: 'SVG'         },
]


const MANAGER_FILTERS: { key: MediaLibraryFilter; label: string }[] = [
  { key: 'all',         label: 'All Visuals' },
  { key: 'tracks',      label: 'Audio Tracks' },
  { key: 'collections', label: 'Collections' },
  { key: 'favorites',   label: 'Favorites' },
  { key: 'images',      label: 'Images' },
  { key: 'videos',      label: 'Videos' },
  { key: 'svg',         label: 'SVG' },
  { key: 'backgrounds', label: 'Backgrounds' },
  { key: 'logos',       label: 'Logos' },
  { key: 'transparent', label: 'Transparent' },
  { key: 'overlays',    label: 'Overlays' },
]

const REACT_ELIGIBLE_ROLES = new Set<MediaRole>(['svg', 'logo', 'transparent_element', 'overlay'])

function isReactEligibleMedia(m: UploadedMedia): boolean {
  if (m.mediaRole === 'svg') return isUnifiedSvgMediaItem(m)
  return REACT_ELIGIBLE_ROLES.has(m.mediaRole)
}

function matchesMediaLibraryFilter(m: UploadedMedia, f: MediaLibraryFilter): boolean {
  switch (f) {
    case 'svg':         return isUnifiedSvgMediaItem(m)
    case 'images':      return m.type === 'image'
    case 'videos':      return m.type === 'video'
    case 'favorites':   return m.favorite
    case 'backgrounds': return m.mediaRole === 'background_image' || m.mediaRole === 'background_video'
    case 'logos':       return m.mediaRole === 'logo'
    case 'transparent': return m.mediaRole === 'transparent_element'
    case 'overlays':    return m.mediaRole === 'overlay'
    default:            return true
  }
}

function fmtDur(s: number | null): string {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── Collection folder card ─────────────────────────────────────────────────

function CollectionFolder({
  collection, items, viewMode, onClick, onEdit, onRemove,
}: {
  collection: MediaCollection
  items: UploadedMedia[]
  viewMode: ViewMode
  onClick: () => void
  onEdit?: () => void
  onRemove?: () => void
}) {
  const thumbs = items.slice(0, 4)
  const count  = items.length
  const actions = (onEdit || onRemove) ? (
    <div className="vz-coll-actions" onClick={event => event.stopPropagation()}>
      {onEdit && <button type="button" className="vz-media-edit-btn" onClick={onEdit} title="Edit collection"><PencilEdit01Icon size={11} color="currentColor" /></button>}
      {onRemove && <button type="button" className="vz-media-remove" onClick={onRemove} title="Delete collection"><Delete02Icon size={12} color="currentColor" /></button>}
    </div>
  ) : null

  if (viewMode === 'list') {
    return (
      <div className="vz-coll-folder-row" role="button" tabIndex={0} onClick={onClick} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } }}>
        <FolderLibraryIcon size={13} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-coll-folder-name" style={{ flex: 1 }}>{collection.name}</span>
        <span className="vz-coll-folder-count">{count} {count === 1 ? 'item' : 'items'}</span>
        {actions}
      </div>
    )
  }

  return (
    <div className="vz-coll-folder" role="button" tabIndex={0} onClick={onClick} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } }}>
      <div className="vz-coll-folder-hd">
        <FolderLibraryIcon size={13} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-coll-folder-name">{collection.name}</span>
        <span className="vz-coll-folder-count">{count} {count === 1 ? 'item' : 'items'}</span>
        {actions}
      </div>
      {collection.description && <div className="vz-coll-description">{collection.description}</div>}
      {thumbs.length > 0 ? (
        <div className="vz-coll-thumb-strip">
          {thumbs.map(m => (
            <div key={m.id} className="vz-coll-thumb">
              {(m.localThumbnailObjectUrl ?? m.thumbnailUrl) ? (
                <img src={m.localThumbnailObjectUrl ?? m.thumbnailUrl!} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : <div className="vz-coll-thumb-empty" />}
            </div>
          ))}
          {count > 4 && <div className="vz-coll-thumb vz-coll-thumb-more">+{count - 4}</div>}
        </div>
      ) : <div className="vz-coll-empty-strip">No media in this collection</div>}
    </div>
  )
}

// ── Audio track row ────────────────────────────────────────────────────────

function AudioTrackRow({
  track,
  onLoad,
  onRemove,
  loading,
  loaded,
  playing,
  loadError,
  canLoad,
  canOpenLyrics,
  canRemove, canEdit, canPreview, onEdit, onPreview,
  onOpenTimeline,
  onOpenActiveLyrics,
  onOpenAiExtract,
}: {
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
  canEdit: boolean
  canPreview: boolean
  onEdit?: () => void
  onPreview?: () => void
  onOpenTimeline?: () => void
  onOpenActiveLyrics?: () => void
  onOpenAiExtract?: () => void
}) {
  const [lyricsMenu, setLyricsMenu] = useState<{ x: number; y: number } | null>(null)
  const meta: string[] = []
  if (track.durationSec) meta.push(fmtDur(track.durationSec))
  if (track.bpm)         meta.push(`${track.bpm} BPM`)
  if (track.musicalKey)  meta.push(track.musicalKey)

  return (
    <div className={`vz-track-row${loaded ? ' vz-track-row--loaded' : ''}${playing ? ' vz-track-row--playing' : ''}`}>
      <div className="vz-track-row-icon">
        <MusicNote01Icon size={14} color="currentColor" />
      </div>
      <div className="vz-track-row-info">
        <div className="vz-track-row-title-line">
          <span className="vz-track-row-title">{track.title}</span>
          <span className="vz-track-row-state-badges">
            {loaded && <span className="lmv-loaded-badge">Loaded</span>}
            {playing && <span className="lmv-playing-badge">Playing</span>}
          </span>
        </div>
        <div className="vz-track-row-meta">
          {track.artist && <span className="vz-track-row-artist">{track.artist}</span>}
          {meta.length > 0 && <span>{meta.join(' · ')}</span>}
        </div>
        {loadError && <div className="vz-track-row-error" role="alert">{loadError}</div>}
      </div>
      <div className="vz-track-row-actions">
        {canPreview && onPreview && <IconChipButton onClick={onPreview}>Preview</IconChipButton>}
        {canEdit && onEdit && <button type="button" className="vz-media-edit-btn" onClick={onEdit} title="Edit track metadata"><PencilEdit01Icon size={12} color="currentColor" /></button>}
        {canLoad && (
          <IconChipButton
            onClick={onLoad}
            disabled={loading}
            title="Load this saved track without starting playback"
          >
            {loading ? 'Loading…' : loaded ? 'Reload' : 'Load Track'}
          </IconChipButton>
        )}
        {canOpenLyrics && (
          <IconChipButton
            aria-haspopup="menu"
            onClick={event => {
              const rect = event.currentTarget.getBoundingClientRect()
              setLyricsMenu({ x: rect.right, y: rect.bottom + 4 })
            }}
          >
            Lyrics ▾
          </IconChipButton>
        )}
        {canRemove && onRemove && (
          <button
            type="button"
            className="vz-track-remove-btn"
            onClick={() => {
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

// ── Media card (shared between all views) ─────────────────────────────────

function MediaCard({
  m,
  isActive,
  viewMode,
  onSelect,
  onEdit,
  onRemove,
  onToggleFavorite,
  onPreview,
  canSelect,
  canEdit,
  canRemove,
  canFavorite,
  canPreview,
  canDrag,
  canRetry,
  onRetry,
  disabledReason,
  mutationStates,
  onThumbnailError,
  onThumbnailLoad,
}: {
  m: UploadedMedia
  isActive: boolean
  viewMode: ViewMode
  onSelect: () => void
  onEdit?: () => void
  onRemove?: () => void
  onToggleFavorite: () => void
  onPreview: () => void
  canSelect: boolean
  canEdit: boolean
  canRemove: boolean
  canFavorite: boolean
  canPreview: boolean
  canDrag: boolean
  canRetry: boolean
  onRetry: () => void
  disabledReason?: string | null
  mutationStates: MediaMutationState[]
  onThumbnailError: () => void
  onThumbnailLoad: () => void
}) {
  const isList = viewMode === 'list'
  const disabled = Boolean(disabledReason)
  const mutationState = [...mutationStates].sort((a, b) => {
    const priority = { conflict: 3, failed: 2, pending: 1 }
    return priority[b.status] - priority[a.status] || b.updatedAt - a.updatedAt
  })[0]
  const favoritePending = mutationStates.some(state => state.operation === 'favorite' && state.status === 'pending')
  const mutationLabel = mutationState?.status === 'pending'
    ? 'Saving'
    : mutationState?.status === 'conflict'
      ? 'Conflict'
      : mutationState ? 'Retry available' : null
  const displayName = (m.title ?? m.name).length > (isList ? 40 : 22)
    ? (m.title ?? m.name).slice(0, isList ? 40 : 22) + '…'
    : (m.title ?? m.name)

  const badge = m.uploading ? (
    <span className="vz-media-type-badge" style={{ background: 'rgba(74,199,219,0.25)', color: '#4ac7db' }}>↑ SYNC</span>
  ) : m.uploadError ? (
    <span className="vz-media-type-badge" style={{ background: 'rgba(248,113,113,0.22)', color: '#f87171' }} title={m.uploadError}>⚠ LOCAL</span>
  ) : m.derivativeWarning ? (
    <span className="vz-media-type-badge" style={{ background: 'rgba(251,191,36,0.22)', color: '#fbbf24' }} title={m.derivativeWarning}>⚠ DERIVATIVE</span>
  ) : m.mediaRole && m.mediaRole !== 'other' ? (
    <span className="vz-media-type-badge" style={{ background: 'rgba(10,20,32,0.75)' }} title={`Role: ${MEDIA_ROLE_LABELS[m.mediaRole]}`}>
      {MEDIA_ROLE_BADGE_LABELS[m.mediaRole]}
    </span>
  ) : (
    <span className="vz-media-type-badge">{m.type === 'video' ? 'VID' : 'IMG'}</span>
  )

  if (isList) {
    return (
      <div
        className={`vz-media-row ${isActive ? 'vz-media-row--active' : ''}${disabled ? ' vz-media-row--disabled' : ''}`}
        onClick={() => canSelect && !disabled && !m.uploading && onSelect()}
        style={m.uploading || disabled || !canSelect ? { opacity: m.uploading ? 0.6 : disabled ? 0.72 : 1, cursor: disabled ? 'not-allowed' : 'default' } : undefined}
        title={disabledReason ?? undefined}
        draggable={canDrag && !m.uploading && !disabled}
        onDragStart={e => { e.dataTransfer.setData('vz/mediaId', m.id); e.dataTransfer.effectAllowed = 'copy' }}
      >
        <div className="vz-media-row-thumb">
          {(m.localThumbnailObjectUrl ?? m.thumbnailUrl) ? (
            <img src={m.localThumbnailObjectUrl ?? m.thumbnailUrl!} alt={m.name} onError={onThumbnailError} onLoad={onThumbnailLoad}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div className={`vz-media-signing-placeholder${m.thumbnailSigningError ? ' vz-media-signing-placeholder--error' : ''}`}>
              {m.thumbnailSigningError ? 'Preview unavailable' : m.thumbnailSigning ? 'Signing…' : 'Preview pending'}
            </div>
          )}
          {badge}
          {canPreview && (
            <button
              className="vz-media-preview-btn"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onPreview() }}
              title="Preview media"
            >
              <PropertyViewIcon size={11} color="currentColor" />
            </button>
          )}
        </div>
        <div className="vz-media-row-info">
          <span className="vz-media-row-name">{displayName}</span>
          {m.meta && <span className="vz-media-row-meta">{m.meta}</span>}
          {disabledReason && <span className="vz-media-disabled-reason">{disabledReason}</span>}
          {mutationLabel && <span className={`vz-media-mutation-state vz-media-mutation-state--${mutationState!.status}`}>{mutationLabel}</span>}
        </div>
        <div className="vz-media-row-actions">
          {canRetry && (m.uploadError || (m.derivativeWarning && m.uploadSourceFile)) && <IconChipButton onClick={e => { e.stopPropagation(); onRetry() }}>{m.derivativeWarning ? 'Retry derivative' : 'Retry'}</IconChipButton>}
          {canFavorite && (
            <button
              className={`vz-media-star ${m.favorite ? 'vz-media-star--active' : ''}`}
              onClick={e => { e.stopPropagation(); onToggleFavorite() }}
              disabled={favoritePending}
              aria-busy={favoritePending}
              title={favoritePending ? 'Saving favorite…' : m.favorite ? 'Unfavourite' : 'Favourite'}
              style={{ position: 'static' }}
            >
              <FavouriteIcon size={14} color="currentColor" />
            </button>
          )}
          {canEdit && onEdit && (
            <button
              className="vz-media-edit-btn"
              onClick={e => { e.stopPropagation(); onEdit() }}
              title="Edit media"
              style={{ opacity: 1 }}
            >
              <PencilEdit01Icon size={11} color="currentColor" />
            </button>
          )}
          {canRemove && onRemove && (
            <button
              className="vz-media-remove"
              onClick={e => { e.stopPropagation(); onRemove() }}
              title="Remove"
              style={{ position: 'static' }}
            >
              <Delete02Icon size={13} color="currentColor" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`vz-media-card ${isActive ? 'vz-media-card--active' : ''}${disabled ? ' vz-media-card--disabled' : ''}`}
      onClick={() => canSelect && !disabled && !m.uploading && onSelect()}
      style={m.uploading || disabled || !canSelect ? { opacity: m.uploading ? 0.6 : disabled ? 0.72 : 1, cursor: disabled ? 'not-allowed' : 'default' } : undefined}
      title={disabledReason ?? undefined}
      draggable={canDrag && !m.uploading && !disabled}
      onDragStart={e => {
        e.dataTransfer.setData('vz/mediaId', m.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <div className="vz-media-thumb" style={{ background: '#050a12', overflow: 'hidden', position: 'relative' }}>
        {(m.localThumbnailObjectUrl ?? m.thumbnailUrl) ? (
          <img
            src={m.localThumbnailObjectUrl ?? m.thumbnailUrl!}
            alt={m.name}
            onError={onThumbnailError}
            onLoad={onThumbnailLoad}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div className={`vz-media-signing-placeholder${m.thumbnailSigningError ? ' vz-media-signing-placeholder--error' : ''}`}>
            {m.thumbnailSigningError ? 'Preview unavailable' : m.thumbnailSigning ? 'Signing media…' : 'Preview pending'}
          </div>
        )}
        {badge}
        {canRetry && (m.uploadError || (m.derivativeWarning && m.uploadSourceFile)) && <IconChipButton className="vz-media-retry" onClick={e => { e.stopPropagation(); onRetry() }}>{m.derivativeWarning ? 'Retry derivative' : 'Retry upload'}</IconChipButton>}
        {disabledReason && <div className="vz-media-disabled-reason vz-media-disabled-reason--overlay">{disabledReason}</div>}
        {canFavorite && (
          <button
            className={`vz-media-star ${m.favorite ? 'vz-media-star--active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleFavorite() }}
            disabled={favoritePending}
            aria-busy={favoritePending}
            title={favoritePending ? 'Saving favorite…' : m.favorite ? 'Unfavourite' : 'Favourite'}
          >
            <FavouriteIcon size={17} color="currentColor" />
          </button>
        )}
        {canRemove && onRemove && (
          <button
            className="vz-media-remove"
            onClick={e => { e.stopPropagation(); onRemove() }}
            title="Remove"
          >
            <Delete02Icon size={15} color="currentColor" />
          </button>
        )}
        {canPreview && (
          <button
            className="vz-media-preview-btn"
            onClick={e => { e.stopPropagation(); onPreview() }}
            title="Preview media"
          >
            <PropertyViewIcon size={13} color="currentColor" />
          </button>
        )}
      </div>
      <div className="vz-media-info">
        <div className="vz-media-name-row">
          <div className="vz-media-name">{displayName}</div>
          {canEdit && onEdit && (
            <button
              className="vz-media-edit-btn"
              onClick={e => { e.stopPropagation(); onEdit() }}
              title="Edit media"
            >
              <PencilEdit01Icon size={11} color="currentColor" />
            </button>
          )}
        </div>
        <div className="vz-media-meta">{m.meta}</div>
        {mutationLabel && <div className={`vz-media-mutation-state vz-media-mutation-state--${mutationState!.status}`}>{mutationLabel}</div>}
        {disabledReason && <div className="vz-media-disabled-reason">{disabledReason}</div>}
        {m.tags.length > 0 && (
          <div className="vz-media-tags">
            {m.tags.slice(0, 3).map(t => (
              <span key={t} className="vz-media-tag">{t}</span>
            ))}
            {m.tags.length > 3 && <span className="vz-media-tag vz-media-tag--more">+{m.tags.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared browser ─────────────────────────────────────────────────────────

export interface MediaLibraryBrowserProps {
  activeMediaId: string | null
  onSelect?: (id: string) => void
  onOpenMediaManager?: () => void
  onOpenLyricManager?: (intent: LyricManagerNavigationIntent) => void
  context?: MediaLibraryContext
  title?: string
  capabilities: readonly MediaLibraryCapability[]
  getDisabledReason?: (media: UploadedMedia) => string | null
}

export const MediaLibraryBrowser = memo(function MediaLibraryBrowser({
  activeMediaId,
  onSelect,
  onOpenMediaManager,
  onOpenLyricManager,
  context = 'visualizer',
  title = 'Media Library',
  capabilities,
  getDisabledReason,
}: MediaLibraryBrowserProps) {
  const {
    items, queryItemIds, addFilesToUploadQueue, clearUploadQueue, removeItem, retryUpload, toggleFavorite,
    loadFromSupabase, setLibraryQuery, ensureLibraryLoaded, loadNextPage, refreshLibrary,
    ensureMediaSigned, retryMediaAsset, markMediaAssetLoaded, loading, nextPageLoading, refreshing, hasMore, queryError, invalidated,
    collections, collectionsLoading, loadCollections, removeCollection,
    importModalOpen, openImportMediaModal, closeImportMediaModal,
    mutationStates = {},
  } = useMediaStore(useShallow(state => ({
    items: state.items,
    queryItemIds: state.queryItemIds,
    addFilesToUploadQueue: state.addFilesToUploadQueue,
    clearUploadQueue: state.clearUploadQueue,
    removeItem: state.removeItem,
    retryUpload: state.retryUpload,
    toggleFavorite: state.toggleFavorite,
    loadFromSupabase: state.loadFromSupabase,
    setLibraryQuery: state.setLibraryQuery,
    ensureLibraryLoaded: state.ensureLibraryLoaded,
    loadNextPage: state.loadNextPage,
    refreshLibrary: state.refreshLibrary,
    ensureMediaSigned: state.ensureMediaSigned,
    retryMediaAsset: state.retryMediaAsset,
    markMediaAssetLoaded: state.markMediaAssetLoaded,
    loading: state.loading,
    nextPageLoading: state.nextPageLoading,
    refreshing: state.refreshing,
    hasMore: state.hasMore,
    queryError: state.queryError,
    invalidated: state.invalidated,
    collections: state.collections,
    collectionsLoading: state.collectionsLoading,
    loadCollections: state.loadCollections,
    removeCollection: state.removeCollection,
    importModalOpen: state.importModalOpen,
    openImportMediaModal: state.openImportMediaModal,
    closeImportMediaModal: state.closeImportMediaModal,
    mutationStates: state.mutationStates,
  })))

  const { savedTracks, loading: tracksLoading, loadSavedTracks, removeSavedTrack, getSignedUrl } = useAudioStore()
  const engine = useSharedAudio()
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const [trackLoadErrors, setTrackLoadErrors] = useState<Record<string, string | null>>({})

  const [libraryFilter, setMediaLibraryFilter] = useState<MediaLibraryFilter>('all')
  const [openCollectionId, setOpenCollectionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [dragOver, setDragOver]       = useState(false)
  const [editItem, setEditItem]       = useState<UploadedMedia | null>(null)
  const [previewItem, setPreviewItem] = useState<UploadedMedia | null>(null)
  const [editTrack, setEditTrack] = useState<SavedAudioTrack | null>(null)
  const [previewTrack, setPreviewTrack] = useState<SavedAudioTrack | null>(null)
  const [editCollection, setEditCollection] = useState<MediaCollection | undefined>(undefined)
  const [collectionEditorOpen, setCollectionEditorOpen] = useState(false)
  const [preserveQueuedFiles, setPreserveQueuedFiles] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const searchActive = searchQuery.length > 0
  const searchLower  = searchQuery.toLowerCase()
  const serverManaged = Array.isArray(queryItemIds)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 180)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const capabilitySet = useMemo(() => new Set<MediaLibraryCapability>(capabilities), [capabilities])
  const isManager = context === 'manager'
  const isCanvasMode = context === 'canvas'
  const isPixGridMode = context === 'pixGrid'
  const canSelect = capabilitySet.has('select') && onSelect !== undefined
  const canLoadTrack = capabilitySet.has('load-track')
  const canOpenLyrics = capabilitySet.has('lyrics') && onOpenLyricManager !== undefined
  const canPreview = capabilitySet.has('preview')
  const canFavorite = capabilitySet.has('favorite')
  const canUpload = (isManager || isCanvasMode) && capabilitySet.has('upload')
  const canEdit = isManager && capabilitySet.has('edit')
  const canRemove = isManager && capabilitySet.has('remove')
  const canBrowseCollections = capabilitySet.has('collections')
  const canDragMedia = capabilitySet.has('drag-media')

  const isReactMode = context === 'react'
  const availableFilters = useMemo(() => {
    const source = context === 'manager'
      ? MANAGER_FILTERS
      : isCanvasMode
        ? CANVAS_FILTERS
        : isPixGridMode
          ? PIX_GRID_FILTERS
          : isReactMode
            ? REACT_FILTERS
            : VISUALIZER_FILTERS
    return canBrowseCollections
      ? source
      : source.filter(filter => filter.key !== 'collections')
  }, [canBrowseCollections, context, isCanvasMode, isPixGridMode, isReactMode])

  const loadCollectionsRef = useRef(loadCollections)
  useEffect(() => { loadCollectionsRef.current = loadCollections }, [loadCollections])
  const loadSavedTracksRef = useRef(loadSavedTracks)
  useEffect(() => { loadSavedTracksRef.current = loadSavedTracks }, [loadSavedTracks])

  const libraryQuery = useMemo<MediaLibraryQuery>(() => ({
    search: debouncedSearch,
    filter: toServerFilter(libraryFilter),
    scope: isReactMode ? 'react' : 'all',
    collectionId: openCollectionId,
    sort: 'created_desc',
  }), [debouncedSearch, isReactMode, libraryFilter, openCollectionId])

  useEffect(() => {
    if (typeof setLibraryQuery === 'function' && typeof ensureLibraryLoaded === 'function') {
      setLibraryQuery(libraryQuery)
      void ensureLibraryLoaded(libraryQuery)
    } else {
      void loadFromSupabase?.()
    }
  }, [ensureLibraryLoaded, libraryQuery, loadFromSupabase, setLibraryQuery])

  useEffect(() => {
    if (invalidated && !loading && !refreshing && typeof ensureLibraryLoaded === 'function') {
      void ensureLibraryLoaded(libraryQuery, true)
    }
  }, [ensureLibraryLoaded, invalidated, libraryQuery, loading, refreshing])

  useEffect(() => {
    if (context !== 'manager') return
    loadCollectionsRef.current?.()
    loadSavedTracksRef.current?.()
  }, [context])

  useEffect(() => {
    if (canBrowseCollections && libraryFilter === 'collections') loadCollectionsRef.current?.()
  }, [canBrowseCollections, libraryFilter])

  useEffect(() => {
    if (libraryFilter === 'tracks') loadSavedTracksRef.current?.()
  }, [libraryFilter])

  const handleSetFilter = useCallback((f: MediaLibraryFilter) => {
    setMediaLibraryFilter(f)
    if (f !== 'collections') setOpenCollectionId(null)
  }, [])

  const queryItems = useMemo(() => {
    if (!serverManaged) return items
    const byId = new Map(items.map(item => [item.id, item]))
    return queryItemIds.map(id => byId.get(id)).filter((item): item is UploadedMedia => Boolean(item))
  }, [items, queryItemIds, serverManaged])

  const filtered = useMemo(() => {
    const source = serverManaged ? queryItems : (isReactMode ? items.filter(isReactEligibleMedia) : items)
    const base = serverManaged ? source : source.filter(item => matchesMediaLibraryFilter(item, libraryFilter))
    if (!searchActive) return base
    if (serverManaged && searchQuery.trim() === debouncedSearch) return base
    return base.filter(item => matchesSearch(item, searchQuery))
  }, [debouncedSearch, isReactMode, items, libraryFilter, queryItems, searchActive, searchQuery, serverManaged])

  const filteredTracks = useMemo(() => {
    if (!searchActive) return savedTracks
    return savedTracks.filter(t =>
      t.title.toLowerCase().includes(searchLower) ||
      (t.artist ?? '').toLowerCase().includes(searchLower) ||
      (t.genre ?? '').toLowerCase().includes(searchLower)
    )
  }, [savedTracks, searchActive, searchLower])

  // Items per collection (keyed by collection id); React mode counts only eligible media
  const itemsByCollection = useMemo(() => {
    const map = new Map<string, UploadedMedia[]>()
    for (const c of collections) map.set(c.id, [])
    const source = isReactMode ? items.filter(isReactEligibleMedia) : items
    for (const m of source) {
      for (const cid of m.collectionIds) {
        if (map.has(cid)) map.get(cid)!.push(m)
      }
    }
    return map
  }, [collections, items, isReactMode])

  const openCollection = useMemo(
    () => collections.find(c => c.id === openCollectionId) ?? null,
    [collections, openCollectionId]
  )

  const openCollectionItems = useMemo(() => {
    const raw = serverManaged && openCollectionId ? queryItems : (openCollectionId ? (itemsByCollection.get(openCollectionId) ?? []) : [])
    const base = isReactMode ? raw.filter(isReactEligibleMedia) : raw
    if (!searchActive || (serverManaged && searchQuery.trim() === debouncedSearch)) return base
    return base.filter(item => matchesSearch(item, searchQuery))
  }, [debouncedSearch, isReactMode, itemsByCollection, openCollectionId, queryItems, searchActive, searchQuery, serverManaged])

  const filteredCollections = useMemo(() => {
    let list = collections
    // In React mode, hide collections that contain no React-eligible media
    if (isReactMode) list = list.filter(c => (itemsByCollection.get(c.id)?.length ?? 0) > 0)
    if (!searchActive) return list
    return list.filter(c => c.name.toLowerCase().includes(searchLower))
  }, [collections, itemsByCollection, searchActive, searchLower, isReactMode])

  const handleQuickDrop = (files: File[]) => {
    clearUploadQueue()
    const queued = addFilesToUploadQueue(files)
    if (queued > 0) {
      setPreserveQueuedFiles(true)
      openImportMediaModal()
    }
  }

  const handleLoadTrack = useCallback(async (track: SavedAudioTrack) => {
    setLoadingTrackId(track.id)
    setTrackLoadErrors(current => ({ ...current, [track.dbId]: null }))
    try {
      await loadSavedTrackIntoEngine(engine, track, { getSignedUrl })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The saved track could not be loaded.'
      setTrackLoadErrors(current => ({ ...current, [track.dbId]: message }))
    } finally {
      setLoadingTrackId(null)
    }
  }, [engine, getSignedUrl])

  const handleRemoveTrack = useCallback(async (track: SavedAudioTrack) => {
    const deleted = await removeSavedTrack(track.id)
    if (deleted) engine.removeTrack(track.id)
  }, [engine, removeSavedTrack])

  useEffect(() => {
    if (editItem) {
      const current = items.find(item => item.id === editItem.id)
      if (!current) setEditItem(null)
      else if (current !== editItem) setEditItem(current)
    }
    if (previewItem) {
      const current = items.find(item => item.id === previewItem.id)
      if (!current) setPreviewItem(null)
      else if (current !== previewItem) setPreviewItem(current)
    }
  }, [editItem, items, previewItem])

  useEffect(() => {
    if (editTrack && !savedTracks.some(track => track.id === editTrack.id)) setEditTrack(null)
    if (previewTrack && !savedTracks.some(track => track.id === previewTrack.id)) setPreviewTrack(null)
  }, [editTrack, previewTrack, savedTracks])

  // ── Render ────────────────────────────────────────────────────────────────

  const handleSelectMedia = useCallback(async (media: UploadedMedia) => {
    if (typeof ensureMediaSigned === 'function') await ensureMediaSigned([media.id], 'visible')
    onSelect?.(media.id)
  }, [ensureMediaSigned, onSelect])

  const handlePreviewMedia = useCallback(async (media: UploadedMedia) => {
    if (typeof ensureMediaSigned === 'function') await ensureMediaSigned([media.id], 'visible')
    const current = items.find(item => item.id === media.id) ?? media
    setPreviewItem(current)
  }, [ensureMediaSigned, items])

  const renderMediaCard = useCallback((media: UploadedMedia) => {
    const disabledReason = getDisabledReason?.(media) ?? null
    return (
      <MediaCard
        key={media.id}
        m={media}
        isActive={activeMediaId === media.id}
        viewMode={viewMode}
        onSelect={() => { void handleSelectMedia(media) }}
        onEdit={canEdit ? () => setEditItem(media) : undefined}
        onRemove={canRemove ? () => {
          if (window.confirm(`Delete “${media.title ?? media.name}”? It will disappear immediately, while exact storage cleanup remains recoverable until finalized.`)) void removeItem(media.id)
        } : undefined}
        onToggleFavorite={() => { void toggleFavorite(media.id) }}
        onPreview={() => { void handlePreviewMedia(media) }}
        canSelect={canSelect && !disabledReason}
        canEdit={canEdit}
        canRemove={canRemove}
        canFavorite={canFavorite}
        canPreview={canPreview}
        canDrag={canDragMedia && !disabledReason}
        canRetry={context === 'manager'}
        onRetry={() => { void retryUpload(media.id) }}
        mutationStates={Object.values(mutationStates).filter(state => state.itemId === media.id)}
        disabledReason={disabledReason}
        onThumbnailError={() => { void retryMediaAsset?.(media.id, 'thumbnail') }}
        onThumbnailLoad={() => { markMediaAssetLoaded?.(media.id, 'thumbnail') }}
      />
    )
  }, [activeMediaId, canDragMedia, canEdit, canFavorite, canPreview, canRemove, canSelect, context, getDisabledReason, handlePreviewMedia, handleSelectMedia, markMediaAssetLoaded, mutationStates, removeItem, retryMediaAsset, retryUpload, toggleFavorite, viewMode])

  const handleEnsureSigned = useCallback((visibleIds: string[], nearIds: string[]) => {
    void ensureMediaSigned?.(visibleIds, 'visible')
    const visible = new Set(visibleIds)
    void ensureMediaSigned?.(nearIds.filter(id => !visible.has(id)), 'near')
  }, [ensureMediaSigned])

  const handleNearEnd = useCallback(() => {
    void loadNextPage?.()
  }, [loadNextPage])

  const renderGrid = (mediaList: UploadedMedia[]) => (
    <VirtualizedMediaCards
      items={mediaList}
      viewMode={viewMode}
      manager={isManager}
      scrollRef={scrollRef}
      renderCard={renderMediaCard}
      ensureSigned={handleEnsureSigned}
      onNearEnd={handleNearEnd}
      hasMore={hasMore ?? false}
      loadingMore={nextPageLoading ?? false}
    />
  )

  const renderTracksView = () => {
    if (tracksLoading && savedTracks.length === 0) {
      return (
        <div className="vz-track-list">
          {[0, 1, 2].map(i => (
            <div key={i} className="vz-track-row" style={{ opacity: 0.4, pointerEvents: 'none' }}>
              <div className="vz-track-row-icon" />
              <div className="vz-track-row-info">
                <div style={{ width: '60%', height: 9, background: '#0a1420', borderRadius: 3 }} />
                <div style={{ width: '40%', height: 7, background: '#0a1420', borderRadius: 3, marginTop: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (filteredTracks.length === 0) {
      return (
        <div className="vz-track-list">
          <div className="vz-track-empty">
            {searchActive ? (
              `No tracks match "${searchQuery}"`
            ) : isManager ? (
              'No audio tracks yet. Import audio files to get started.'
            ) : (
              <PerformanceDeckEmptyState
                message="No audio tracks available. Add files from Media Manager."
                onOpenMediaManager={onOpenMediaManager}
              />
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="vz-track-list">
        {filteredTracks.map(t => (
          <AudioTrackRow
            key={t.id}
            track={t}
            onLoad={() => handleLoadTrack(t)}
            onRemove={canRemove ? () => { void handleRemoveTrack(t) } : undefined}
            loading={loadingTrackId === t.id}
            loaded={engine.currentAudioTrackId === t.dbId}
            playing={engine.currentAudioTrackId === t.dbId && engine.isPlaying}
            loadError={trackLoadErrors[t.dbId]}
            canLoad={canLoadTrack}
            canOpenLyrics={canOpenLyrics}
            canRemove={canRemove}
            canEdit={canEdit}
            canPreview={isManager && canPreview}
            onEdit={canEdit ? () => setEditTrack(t) : undefined}
            onPreview={isManager && canPreview ? () => setPreviewTrack(t) : undefined}
            onOpenTimeline={canOpenLyrics ? () => onOpenLyricManager?.(createLyricManagerNavigationIntent(t.dbId, 'timeline')) : undefined}
            onOpenActiveLyrics={canOpenLyrics ? () => onOpenLyricManager?.(createLyricManagerNavigationIntent(t.dbId, 'active-lyrics')) : undefined}
            onOpenAiExtract={canOpenLyrics ? () => onOpenLyricManager?.(createLyricManagerNavigationIntent(t.dbId, 'ai-extract')) : undefined}
          />
        ))}
      </div>
    )
  }

  const renderCollectionsView = () => {
    // Drilled into a specific collection
    if (openCollectionId && openCollection) {
      return (
        <>
          <div className="vz-coll-breadcrumb">
            <button className="vz-coll-back-btn" onClick={() => setOpenCollectionId(null)}>
              <ArrowLeft01Icon size={12} color="currentColor" />
            </button>
            <FolderLibraryIcon size={12} color="currentColor" style={{ flexShrink: 0 }} />
            <span className="vz-coll-breadcrumb-name">{openCollection.name}</span>
            <span className="vz-coll-folder-count">{openCollectionItems.length} {openCollectionItems.length === 1 ? 'item' : 'items'}</span>
          </div>
          {openCollectionItems.length === 0 ? (
            <div className="vz-media-grid">
              {isManager ? (
                <div className="vz-coll-folder-empty">No media in this collection</div>
              ) : (
                <PerformanceDeckEmptyState
                  message="No media in this collection. Add files from Media Manager."
                  onOpenMediaManager={onOpenMediaManager}
                />
              )}
            </div>
          ) : renderGrid(openCollectionItems)}
        </>
      )
    }

    // Top-level: folder list
    if (collectionsLoading && collections.length === 0) {
      return (
        <div className="vz-media-grid" style={{ padding: '8px 4px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="vz-coll-folder" style={{ opacity: 0.4, pointerEvents: 'none' }}>
              <div className="vz-coll-folder-hd">
                <div style={{ width: 80, height: 10, background: '#0a1420', borderRadius: 3 }} />
              </div>
              <div className="vz-coll-thumb-strip">
                {[0, 1, 2].map(j => <div key={j} className="vz-coll-thumb" style={{ background: 'linear-gradient(90deg,#0a1420 25%,#0f1f30 50%,#0a1420 75%)', backgroundSize: '200% 100%', animation: 'vz-skeleton-shimmer 1.4s infinite' }} />)}
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (filteredCollections.length === 0) {
      return (
        <div className="vz-media-grid">
          <div className="vz-coll-folder-empty">
            {searchActive ? (
              `No collections match "${searchQuery}"`
            ) : isManager ? (
              'No collections yet. Use New Collection to create one.'
            ) : (
              <PerformanceDeckEmptyState
                message="No collections available. Create collections from Media Manager."
                onOpenMediaManager={onOpenMediaManager}
              />
            )}
          </div>
        </div>
      )
    }

    return (
      <div className={viewMode === 'list' ? 'vz-media-list' : 'vz-coll-list'}>
        {filteredCollections.map(c => (
          <CollectionFolder
            key={c.id}
            collection={c}
            items={itemsByCollection.get(c.id) ?? []}
            viewMode={viewMode}
            onClick={() => setOpenCollectionId(c.id)}
            onEdit={isManager ? () => { setEditCollection(c); setCollectionEditorOpen(true) } : undefined}
            onRemove={isManager ? () => {
              if (window.confirm(`Delete collection “${c.name}”? Media files will remain in the library.`)) void removeCollection(c.id)
            } : undefined}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      {canUpload && importModalOpen && <MediaUploadModal preserveQueuedFiles={preserveQueuedFiles} onClose={() => { setPreserveQueuedFiles(false); closeImportMediaModal() }} />}
      {canEdit && editItem && <MediaUploadModal editItem={editItem} onClose={() => setEditItem(null)} />}
      {canPreview && previewItem && <MediaPreviewModal media={previewItem} onClose={() => setPreviewItem(null)} />}
      {isManager && editTrack && <AudioTrackEditModal track={editTrack} onClose={() => setEditTrack(null)} />}
      {isManager && previewTrack && <AudioTrackPreviewModal track={previewTrack} onClose={() => setPreviewTrack(null)} />}
      {isManager && collectionEditorOpen && <CollectionEditorModal collection={editCollection} onClose={() => { setCollectionEditorOpen(false); setEditCollection(undefined) }} />}
      <div
        className={`vz-panel vz-media-browser${isManager ? ' vz-media-browser--manager' : ''}`}
        style={{ flex: 1, minHeight: 0 }}
        onDragOver={canUpload ? e => { e.preventDefault(); setDragOver(true) } : undefined}
        onDragLeave={canUpload ? () => setDragOver(false) : undefined}
        onDrop={canUpload ? e => { e.preventDefault(); setDragOver(false); handleQuickDrop(Array.from(e.dataTransfer.files)) } : undefined}
      >
        <div className="vz-panel-header">
          <Layers01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
          <span className={`vz-panel-title${isCanvasMode ? ' vz-panel-title--nowrap' : ''}`} title={title}>{title}</span>
          {isManager && canBrowseCollections && (
            <IconChipButton onClick={() => { setEditCollection(undefined); setCollectionEditorOpen(true) }}>New Collection</IconChipButton>
          )}
          {isCanvasMode ? (
            <button
              type="button"
              className="vz-md-refresh-icon-btn"
              onClick={() => { void refreshLibrary?.() }}
              disabled={refreshing}
              title="Refresh media library"
              aria-label="Refresh media library"
            >
              <Refresh01Icon size={11} color="currentColor" />
            </button>
          ) : (
            <IconChipButton
              onClick={() => { void refreshLibrary?.() }}
              disabled={refreshing}
              title="Refresh media library"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </IconChipButton>
          )}
          {canUpload && (
            <IconChipButton
              tone="primary"
              onClick={() => { setPreserveQueuedFiles(false); openImportMediaModal() }}
              icon={
                <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              }
            >
              {isCanvasMode ? 'Add media to library' : 'Import'}
            </IconChipButton>
          )}
        </div>

        <UnderlineTabs
          tabs={availableFilters.map(({ key, label }) => ({ id: key, label }))}
          activeTab={libraryFilter}
          onChange={handleSetFilter}
          ariaLabel="Media library filter"
          className="vz-filter-tabs dv-underline-tabs--scroll"
        />

        <div className="vz-md-search-row">
          <div className="vz-md-search-wrap">
            <svg className="vz-md-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <DreamVizTextInput
              className="vz-md-search-input"
              type="text"
              placeholder={libraryFilter === 'tracks' ? 'Search tracks…' : 'Search media…'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery.length > 0 && (
              <button className="vz-md-search-clear" onClick={() => setSearchQuery('')} title="Clear search">✕</button>
            )}
          </div>
          {libraryFilter !== 'tracks' && (
            <div className="vz-md-view-toggles">
              <button
                className={`vz-md-view-btn${viewMode === 'grid' ? ' vz-md-view-btn--active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <GridViewIcon size={13} color="currentColor" />
              </button>
              <button
                className={`vz-md-view-btn${viewMode === 'list' ? ' vz-md-view-btn--active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <ListViewIcon size={13} color="currentColor" />
              </button>
            </div>
          )}
        </div>

        <MediaStatusBar includeAudio={isManager} />

        <div className="vz-media-scroll" ref={scrollRef}>
          {libraryFilter === 'tracks' ? (
            renderTracksView()
          ) : libraryFilter === 'collections' ? (
            renderCollectionsView()
          ) : queryError && filtered.length === 0 ? (
            <div className="vz-media-page-error">
              <NoticeCard tone="error" role="alert">
                {queryError}{' '}
                <IconChipButton onClick={() => { void refreshLibrary?.() }}>Retry</IconChipButton>
              </NoticeCard>
            </div>
          ) : loading && filtered.length === 0 ? (
            <div className="vz-media-grid" style={{ padding: '8px 4px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="vz-media-card" style={{ opacity: 0.4, pointerEvents: 'none' }}>
                  <div className="vz-media-thumb" style={{ background: 'linear-gradient(90deg,#0a1420 25%,#0f1f30 50%,#0a1420 75%)', backgroundSize: '200% 100%', animation: 'vz-skeleton-shimmer 1.4s infinite' }}/>
                  <div className="vz-media-info"><div className="vz-media-name" style={{ background: '#0a1420', borderRadius: 2, height: 8, width: '70%' }}/></div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 && !searchActive && canUpload ? (
            <div
              className="ref-empty-slot"
              style={{ cursor: 'pointer', margin: 12, height: 120, display: 'flex' }}
              onClick={() => { setPreserveQueuedFiles(false); openImportMediaModal() }}
            >
              <div className="ref-empty-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </div>
              <div className="ref-empty-title">{isCanvasMode ? 'Add media to library' : 'Import Media'}</div>
              <div className="ref-empty-sub" style={{ fontSize: 9 }}>{dragOver ? 'Drop here!' : isCanvasMode ? 'Saved visual media' : isReactMode ? 'SVGs, Logos & Overlays' : 'Images & Video'}</div>
            </div>
          ) : filtered.length === 0 ? (
            isManager ? (
              <div className="vz-media-grid">
                <div className="vz-coll-folder-empty">
                  {searchActive ? `No media matches "${searchQuery}"` : 'No media matches this filter.'}
                </div>
              </div>
            ) : (
              <PerformanceDeckEmptyState
                message={searchActive ? `No media matches "${searchQuery}"` : isCanvasMode ? 'No saved media available. Add files from Media Manager.' : 'No media available. Add files from Media Manager.'}
                onOpenMediaManager={searchActive || isCanvasMode ? undefined : onOpenMediaManager}
              />
            )
          ) : (
            renderGrid(filtered)
          )}
        </div>
      </div>
    </>
  )
})
