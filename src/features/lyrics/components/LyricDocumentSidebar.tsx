import { useState } from 'react'
import type { LyricDocument } from '../../../types/lyrics'

type DocFilter = 'all' | 'active' | 'manual' | 'json_import' | 'ai_transcription'

interface Props {
  documents: LyricDocument[]
  loading: boolean
  activeDocumentId: string | null
  onSelectDocument: (doc: LyricDocument) => void
  onNewDocument: () => void
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  lrc_import: 'LRC',
  enhanced_lrc_import: 'eLRC',
  vtt_import: 'VTT',
  ai_transcription: 'AI',
  api_lookup: 'API',
  json_import: 'JSON',
}

function fmtRelativeDate(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 1)   return 'just now'
    if (mins < 60)  return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)   return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30)  return `${days}d ago`
    return new Date(iso).toLocaleDateString()
  } catch { return '' }
}

const FILTERS: { id: DocFilter; label: string }[] = [
  { id: 'all',             label: 'All'       },
  { id: 'active',          label: 'Active'    },
  { id: 'manual',          label: 'Manual'    },
  { id: 'json_import',     label: 'JSON'      },
  { id: 'ai_transcription',label: 'AI'        },
]

export function LyricDocumentSidebar({
  documents, loading, activeDocumentId, onSelectDocument, onNewDocument,
}: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DocFilter>('all')

  const filtered = documents.filter(doc => {
    if (filter === 'active' && !doc.isActive) return false
    if (filter === 'manual' && doc.sourceType !== 'manual') return false
    if (filter === 'json_import' && doc.sourceType !== 'lrc_import') {
      // treat any non-AI, non-manual as "json" imports
      if (!['lrc_import','enhanced_lrc_import','vtt_import'].includes(doc.sourceType) &&
           doc.sourceType !== 'api_lookup') return false
    }
    if (filter === 'ai_transcription' && doc.sourceType !== 'ai_transcription') return false

    if (search.trim()) {
      const q = search.toLowerCase()
      return doc.title.toLowerCase().includes(q) || doc.artist.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <aside className="lmv-doc-sidebar">
      <div className="lmv-doc-sidebar-head">
        <div className="lmv-doc-search-wrap">
          <svg className="lmv-doc-search-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            className="lmv-doc-search"
            placeholder="Search lyric documents…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button className="lmv-btn lmv-btn--ghost lmv-doc-new-btn" onClick={onNewDocument}>
          + New Document
        </button>
      </div>

      <div className="lmv-doc-filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`lmv-filter-chip${filter === f.id ? ' lmv-filter-chip--active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="lmv-doc-list">
        {loading && (
          <div className="lmv-doc-empty">Loading documents…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="lmv-doc-empty">
            {documents.length === 0
              ? 'No lyric documents yet. Create one to get started.'
              : 'No documents match the current filter.'}
          </div>
        )}
        {!loading && filtered.map(doc => (
          <div
            key={doc.id}
            className={`lmv-doc-card${doc.id === activeDocumentId ? ' lmv-doc-card--active' : ''}`}
            onClick={() => onSelectDocument(doc)}
          >
            <div className="lmv-doc-card-title">{doc.title || '(Untitled)'}</div>
            {doc.artist && <div className="lmv-doc-card-artist">{doc.artist}</div>}
            <div className="lmv-doc-card-meta">
              <span className={`lmv-source-badge lmv-source-badge--${doc.sourceType}`}>
                {SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}
              </span>
              {doc.isActive && <span className="lmv-active-badge">Active</span>}
              <span className="lmv-doc-card-date">{fmtRelativeDate(doc.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
