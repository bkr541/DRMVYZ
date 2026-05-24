import { memo, useState, useMemo, useRef, useEffect } from 'react'
import {
  Layers01Icon,
  FavouriteIcon,
  Delete02Icon,
  PencilEdit01Icon,
} from 'hugeicons-react'
import { useMediaStore } from '../../../stores/mediaStore'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { MediaUploadModal } from '../MediaUploadModal'
import { MediaStatusBar } from './MediaStatusBar'
import { MEDIA_ROLE_BADGE_LABELS, MEDIA_ROLE_LABELS } from '../../../lib/mediaRoles'

type DeckFilter = 'all' | 'images' | 'videos' | 'favorites' | 'backgrounds' | 'logos' | 'transparent' | 'overlays'

const DECK_FILTERS: { key: DeckFilter; label: string }[] = [
  { key: 'all',         label: 'All'         },
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

type MediaDeckPanelProps = {
  activeMediaId: string | null
  onSelect: (id: string) => void
}

export const MediaDeckPanel = memo(function MediaDeckPanel({ activeMediaId, onSelect }: MediaDeckPanelProps) {
  const {
    items, addFiles, removeItem, toggleFavorite,
    loadFromSupabase, loading,
    importModalOpen, openImportMediaModal, closeImportMediaModal,
  } = useMediaStore()
  const [deckFilter, setDeckFilter] = useState<DeckFilter>('all')
  const [dragOver, setDragOver] = useState(false)
  const [editItem, setEditItem] = useState<UploadedMedia | null>(null)

  const loadFromSupabaseRef = useRef(loadFromSupabase)
  useEffect(() => { loadFromSupabaseRef.current = loadFromSupabase }, [loadFromSupabase])

  useEffect(() => { loadFromSupabaseRef.current() }, [])

  const filtered = useMemo(
    () => items.filter(m => matchesDeckFilter(m, deckFilter)),
    [items, deckFilter]
  )

  const handleQuickDrop = (files: File[]) => {
    const media = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') ||
      /\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv)$/i.test(f.name)
    )
    if (media.length) addFiles(media)
  }

  return (
    <>
      {importModalOpen && <MediaUploadModal onClose={closeImportMediaModal} />}
      {editItem && <MediaUploadModal editItem={editItem} onClose={() => setEditItem(null)} />}
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
              onClick={() => setDeckFilter(key)}
            >{label}</button>
          ))}
        </div>

        <MediaStatusBar />

        <div className="vz-media-scroll">
          {loading && items.length === 0 ? (
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
            <div className="vz-media-grid">
              {filtered.map(m => (
                <div
                  key={m.id}
                  className={`vz-media-card ${activeMediaId === m.id ? 'vz-media-card--active' : ''}`}
                  onClick={() => !m.uploading && onSelect(m.id)}
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
                    {m.uploading ? (
                      <span className="vz-media-type-badge" style={{ background: 'rgba(74,199,219,0.25)', color: '#4ac7db' }}>↑ SYNC</span>
                    ) : m.uploadError ? (
                      <span className="vz-media-type-badge" style={{ background: 'rgba(248,113,113,0.22)', color: '#f87171' }} title={m.uploadError}>⚠ LOCAL</span>
                    ) : m.mediaRole && m.mediaRole !== 'other' ? (
                      <span
                        className="vz-media-type-badge"
                        style={{ background: 'rgba(10,20,32,0.75)' }}
                        title={`Role: ${MEDIA_ROLE_LABELS[m.mediaRole]}`}
                      >
                        {MEDIA_ROLE_BADGE_LABELS[m.mediaRole]}
                      </span>
                    ) : (
                      <span className="vz-media-type-badge">{m.type === 'video' ? 'VID' : 'IMG'}</span>
                    )}
                    <button
                      className={`vz-media-star ${m.favorite ? 'vz-media-star--active' : ''}`}
                      onClick={e => { e.stopPropagation(); toggleFavorite(m.id) }}
                      title={m.favorite ? 'Unfavourite' : 'Favourite'}
                    >
                      <FavouriteIcon size={17} color="currentColor" />
                    </button>
                    <button
                      className="vz-media-remove"
                      onClick={e => { e.stopPropagation(); removeItem(m.id) }}
                      title="Remove"
                    >
                      <Delete02Icon size={15} color="currentColor" />
                    </button>
                  </div>
                  <div className="vz-media-info">
                    <div className="vz-media-name-row">
                      <div className="vz-media-name">{((m.title ?? m.name).length > 22 ? (m.title ?? m.name).slice(0, 22) + '…' : (m.title ?? m.name))}</div>
                      <button
                        className="vz-media-edit-btn"
                        onClick={e => { e.stopPropagation(); setEditItem(m) }}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
})
