import { memo, useState, useMemo, useRef, useEffect, useCallback } from 'react'
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
} from 'hugeicons-react'
import { useMediaStore } from '../../../stores/mediaStore'
import type { UploadedMedia, MediaCollection } from '../../../stores/mediaStore'
import { MediaUploadModal } from '../MediaUploadModal'
import { MediaPreviewModal } from './MediaPreviewModal'
import { MediaStatusBar } from './MediaStatusBar'
import { MEDIA_ROLE_BADGE_LABELS, MEDIA_ROLE_LABELS } from '../../../lib/mediaRoles'

type DeckFilter = 'all' | 'collections' | 'images' | 'videos' | 'favorites' | 'backgrounds' | 'logos' | 'transparent' | 'overlays'
type ViewMode  = 'grid' | 'list'

const DECK_FILTERS: { key: DeckFilter; label: string }[] = [
  { key: 'all',         label: 'All'         },
  { key: 'collections', label: 'Collections' },
  { key: 'images',      label: 'Images'      },
  { key: 'videos',      label: 'Videos'      },
  { key: 'favorites',   label: 'Favorites'   },
  { key: 'backgrounds', label: 'Backgrounds' },
  { key: 'logos',       label: 'Logos'       },
  { key: 'transparent', label: 'Transparent' },
  { key: 'overlays',    label: 'Overlays'    },
]

function matchesDeckFilter(m: UploadedMedia, f: DeckFilter): boolean {
  switch (f) {
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

// ── Collection folder card ─────────────────────────────────────────────────

function CollectionFolder({
  collection, items, viewMode, onClick,
}: {
  collection: MediaCollection
  items: UploadedMedia[]
  viewMode: ViewMode
  onClick: () => void
}) {
  const thumbs = items.slice(0, 4)
  const count  = items.length

  if (viewMode === 'list') {
    return (
      <div className="vz-coll-folder-row" onClick={onClick}>
        <FolderLibraryIcon size={13} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-coll-folder-name" style={{ flex: 1 }}>{collection.name}</span>
        <span className="vz-coll-folder-count">{count} {count === 1 ? 'item' : 'items'}</span>
      </div>
    )
  }

  return (
    <div className="vz-coll-folder" onClick={onClick}>
      <div className="vz-coll-folder-hd">
        <FolderLibraryIcon size={13} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-coll-folder-name">{collection.name}</span>
        <span className="vz-coll-folder-count">{count} {count === 1 ? 'item' : 'items'}</span>
      </div>
      {thumbs.length > 0 ? (
        <div className="vz-coll-thumb-strip">
          {thumbs.map(m => (
            <div key={m.id} className="vz-coll-thumb">
              {(m.localThumbnailObjectUrl ?? m.thumbnailUrl) ? (
                <img
                  src={m.localThumbnailObjectUrl ?? m.thumbnailUrl!}
                  alt={m.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div className="vz-coll-thumb-empty" />
              )}
            </div>
          ))}
          {count > 4 && (
            <div className="vz-coll-thumb vz-coll-thumb-more">+{count - 4}</div>
          )}
        </div>
      ) : (
        <div className="vz-coll-empty-strip">No media in this collection</div>
      )}
    </div>
  )
}

// ── Media card (shared between all views) ─────────────────────────────────

function MediaCard({
  m, isActive, viewMode, onSelect, onEdit, onRemove, onToggleFavorite, onPreview,
}: {
  m: UploadedMedia
  isActive: boolean
  viewMode: ViewMode
  onSelect: () => void
  onEdit: () => void
  onRemove: () => void
  onToggleFavorite: () => void
  onPreview: () => void
}) {
  const isList = viewMode === 'list'
  const displayName = (m.title ?? m.name).length > (isList ? 40 : 22)
    ? (m.title ?? m.name).slice(0, isList ? 40 : 22) + '…'
    : (m.title ?? m.name)

  const badge = m.uploading ? (
    <span className="vz-media-type-badge" style={{ background: 'rgba(74,199,219,0.25)', color: '#4ac7db' }}>↑ SYNC</span>
  ) : m.uploadError ? (
    <span className="vz-media-type-badge" style={{ background: 'rgba(248,113,113,0.22)', color: '#f87171' }} title={m.uploadError}>⚠ LOCAL</span>
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
        className={`vz-media-row ${isActive ? 'vz-media-row--active' : ''}`}
        onClick={() => !m.uploading && onSelect()}
        style={m.uploading ? { opacity: 0.6, cursor: 'default' } : undefined}
        draggable={!m.uploading}
        onDragStart={e => { e.dataTransfer.setData('vz/mediaId', m.id); e.dataTransfer.effectAllowed = 'copy' }}
      >
        <div className="vz-media-row-thumb">
          {(m.localThumbnailObjectUrl ?? m.thumbnailUrl) && (
            <img src={m.localThumbnailObjectUrl ?? m.thumbnailUrl!} alt={m.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
          {badge}
        </div>
        <div className="vz-media-row-info">
          <span className="vz-media-row-name">{displayName}</span>
          {m.meta && <span className="vz-media-row-meta">{m.meta}</span>}
        </div>
        <div className="vz-media-row-actions">
          <button
            className={`vz-media-star ${m.favorite ? 'vz-media-star--active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleFavorite() }}
            title={m.favorite ? 'Unfavourite' : 'Favourite'}
            style={{ position: 'static' }}
          >
            <FavouriteIcon size={14} color="currentColor" />
          </button>
          <button
            className="vz-media-edit-btn"
            onClick={e => { e.stopPropagation(); onEdit() }}
            title="Edit media"
            style={{ opacity: 1 }}
          >
            <PencilEdit01Icon size={11} color="currentColor" />
          </button>
          <button
            className="vz-media-edit-btn"
            onClick={e => { e.stopPropagation(); onPreview() }}
            title="Preview media"
            style={{ opacity: 1, color: 'rgba(74,199,219,0.7)' }}
          >
            <PropertyViewIcon size={11} color="currentColor" />
          </button>
          <button
            className="vz-media-remove"
            onClick={e => { e.stopPropagation(); onRemove() }}
            title="Remove"
            style={{ position: 'static' }}
          >
            <Delete02Icon size={13} color="currentColor" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`vz-media-card ${isActive ? 'vz-media-card--active' : ''}`}
      onClick={() => !m.uploading && onSelect()}
      style={m.uploading ? { opacity: 0.6, cursor: 'default' } : undefined}
      draggable={!m.uploading}
      onDragStart={e => {
        e.dataTransfer.setData('vz/mediaId', m.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <div className="vz-media-thumb" style={{ background: '#050a12', overflow: 'hidden', position: 'relative' }}>
        {(m.localThumbnailObjectUrl ?? m.thumbnailUrl) && (
          <img
            src={m.localThumbnailObjectUrl ?? m.thumbnailUrl!}
            alt={m.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {badge}
        <button
          className={`vz-media-star ${m.favorite ? 'vz-media-star--active' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleFavorite() }}
          title={m.favorite ? 'Unfavourite' : 'Favourite'}
        >
          <FavouriteIcon size={17} color="currentColor" />
        </button>
        <button
          className="vz-media-remove"
          onClick={e => { e.stopPropagation(); onRemove() }}
          title="Remove"
        >
          <Delete02Icon size={15} color="currentColor" />
        </button>
        <button
          className="vz-media-preview-btn"
          onClick={e => { e.stopPropagation(); onPreview() }}
          title="Preview media"
        >
          <PropertyViewIcon size={13} color="currentColor" />
        </button>
      </div>
      <div className="vz-media-info">
        <div className="vz-media-name-row">
          <div className="vz-media-name">{displayName}</div>
          <button
            className="vz-media-edit-btn"
            onClick={e => { e.stopPropagation(); onEdit() }}
            title="Edit media"
          >
            <PencilEdit01Icon size={11} color="currentColor" />
          </button>
        </div>
        <div className="vz-media-meta">{m.meta}</div>
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

// ── Panel ──────────────────────────────────────────────────────────────────

type MediaDeckPanelProps = {
  activeMediaId: string | null
  onSelect: (id: string) => void
}

export const MediaDeckPanel = memo(function MediaDeckPanel({ activeMediaId, onSelect }: MediaDeckPanelProps) {
  const {
    items, addFiles, removeItem, toggleFavorite,
    loadFromSupabase, loading,
    collections, collectionsLoading, loadCollections,
    importModalOpen, openImportMediaModal, closeImportMediaModal,
  } = useMediaStore()
  const [deckFilter, setDeckFilter] = useState<DeckFilter>('all')
  const [openCollectionId, setOpenCollectionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [dragOver, setDragOver]       = useState(false)
  const [editItem, setEditItem]       = useState<UploadedMedia | null>(null)
  const [previewItem, setPreviewItem] = useState<UploadedMedia | null>(null)

  const searchActive = searchQuery.length > 2
  const searchLower  = searchQuery.toLowerCase()

  const loadFromSupabaseRef = useRef(loadFromSupabase)
  useEffect(() => { loadFromSupabaseRef.current = loadFromSupabase }, [loadFromSupabase])

  const loadCollectionsRef = useRef(loadCollections)
  useEffect(() => { loadCollectionsRef.current = loadCollections }, [loadCollections])

  useEffect(() => { loadFromSupabaseRef.current() }, [])

  // Load collections when switching to the Collections tab (lazy)
  useEffect(() => {
    if (deckFilter === 'collections') loadCollectionsRef.current()
  }, [deckFilter])

  // Reset drilled-in folder when switching away
  const handleSetFilter = useCallback((f: DeckFilter) => {
    setDeckFilter(f)
    if (f !== 'collections') setOpenCollectionId(null)
  }, [])

  const filtered = useMemo(() => {
    const base = items.filter(m => matchesDeckFilter(m, deckFilter))
    if (!searchActive) return base
    return base.filter(m =>
      (m.title ?? m.name).toLowerCase().includes(searchLower) ||
      m.name.toLowerCase().includes(searchLower) ||
      m.tags.some(t => t.toLowerCase().includes(searchLower))
    )
  }, [items, deckFilter, searchActive, searchLower])

  // Items per collection (keyed by collection id)
  const itemsByCollection = useMemo(() => {
    const map = new Map<string, UploadedMedia[]>()
    for (const c of collections) map.set(c.id, [])
    for (const m of items) {
      for (const cid of m.collectionIds) {
        if (map.has(cid)) map.get(cid)!.push(m)
      }
    }
    return map
  }, [collections, items])

  const openCollection = useMemo(
    () => collections.find(c => c.id === openCollectionId) ?? null,
    [collections, openCollectionId]
  )

  const openCollectionItems = useMemo(() => {
    const base = openCollectionId ? (itemsByCollection.get(openCollectionId) ?? []) : []
    if (!searchActive) return base
    return base.filter(m =>
      (m.title ?? m.name).toLowerCase().includes(searchLower) ||
      m.name.toLowerCase().includes(searchLower) ||
      m.tags.some(t => t.toLowerCase().includes(searchLower))
    )
  }, [itemsByCollection, openCollectionId, searchActive, searchLower])

  const filteredCollections = useMemo(() => {
    if (!searchActive) return collections
    return collections.filter(c => c.name.toLowerCase().includes(searchLower))
  }, [collections, searchActive, searchLower])

  const handleQuickDrop = (files: File[]) => {
    const media = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') ||
      /\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv)$/i.test(f.name)
    )
    if (media.length) addFiles(media)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const renderGrid = (mediaList: UploadedMedia[]) => (
    <div className={viewMode === 'list' ? 'vz-media-list' : 'vz-media-grid'}>
      {mediaList.map(m => (
        <MediaCard
          key={m.id}
          m={m}
          isActive={activeMediaId === m.id}
          viewMode={viewMode}
          onSelect={() => onSelect(m.id)}
          onEdit={() => setEditItem(m)}
          onRemove={() => removeItem(m.id)}
          onToggleFavorite={() => toggleFavorite(m.id)}
          onPreview={() => setPreviewItem(m)}
        />
      ))}
    </div>
  )

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
              <div className="vz-coll-folder-empty">No media in this collection</div>
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
            {searchActive ? `No collections match "${searchQuery}"` : 'No collections yet — create one in the media editor'}
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
          />
        ))}
      </div>
    )
  }

  return (
    <>
      {importModalOpen && <MediaUploadModal onClose={closeImportMediaModal} />}
      {editItem && <MediaUploadModal editItem={editItem} onClose={() => setEditItem(null)} />}
      {previewItem && <MediaPreviewModal media={previewItem} onClose={() => setPreviewItem(null)} />}
      <div
        className="vz-panel"
        style={{ flex: 1, minHeight: 0 }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleQuickDrop(Array.from(e.dataTransfer.files)) }}
      >
        <div className="vz-panel-header">
          <Layers01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
          <span className="vz-panel-title">Media Deck</span>
          <button className="vz-import-btn" onClick={openImportMediaModal}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Import
          </button>
        </div>

        <div className="vz-filter-tabs">
          {DECK_FILTERS.map(({ key, label }) => (
            <button key={key}
              className={`vz-filter-tab ${deckFilter === key ? 'vz-filter-tab--active' : ''}`}
              onClick={() => handleSetFilter(key)}
            >{label}</button>
          ))}
        </div>

        <div className="vz-md-search-row">
          <div className="vz-md-search-wrap">
            <svg className="vz-md-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              className="vz-md-search-input"
              type="text"
              placeholder="Search media…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery.length > 0 && (
              <button className="vz-md-search-clear" onClick={() => setSearchQuery('')} title="Clear search">✕</button>
            )}
          </div>
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
        </div>

        <MediaStatusBar />

        <div className="vz-media-scroll">
          {deckFilter === 'collections' ? (
            renderCollectionsView()
          ) : loading && items.length === 0 ? (
            <div className="vz-media-grid" style={{ padding: '8px 4px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="vz-media-card" style={{ opacity: 0.4, pointerEvents: 'none' }}>
                  <div className="vz-media-thumb" style={{ background: 'linear-gradient(90deg,#0a1420 25%,#0f1f30 50%,#0a1420 75%)', backgroundSize: '200% 100%', animation: 'vz-skeleton-shimmer 1.4s infinite' }}/>
                  <div className="vz-media-info"><div className="vz-media-name" style={{ background: '#0a1420', borderRadius: 2, height: 8, width: '70%' }}/></div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div
              className="ref-empty-slot"
              style={{ cursor: 'pointer', margin: 12, height: 120, display: 'flex' }}
              onClick={openImportMediaModal}
            >
              <div className="ref-empty-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </div>
              <div className="ref-empty-title">Import Media</div>
              <div className="ref-empty-sub" style={{ fontSize: 9 }}>{dragOver ? 'Drop here!' : 'Images & Video'}</div>
            </div>
          ) : (
            renderGrid(filtered)
          )}
        </div>
      </div>
    </>
  )
})
