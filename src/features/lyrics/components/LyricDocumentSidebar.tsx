import { useEffect, useState } from 'react'
import type { LyricDocumentVersion } from '../lyricManagerTypes'

type DocFilter = 'all' | 'active' | 'manual' | 'imported' | 'ai_transcription'

interface Props {
  documents: LyricDocumentVersion[]
  legacyDocuments?: LyricDocumentVersion[]
  loading: boolean
  activeDocumentId: string | null
  hasSelectedTrack: boolean
  onSelectDocument: (doc: LyricDocumentVersion) => void
  onNewDocument: () => void
  onDuplicateDocument: (doc: LyricDocumentVersion) => void
  onRenameDocument: (doc: LyricDocumentVersion, title: string) => void
  onActivateDocument: (doc: LyricDocumentVersion) => void
  onDeleteDocument: (doc: LyricDocumentVersion) => void
  onImportDocument: () => void
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
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(iso).toLocaleDateString()
  } catch {
    return ''
  }
}

const FILTERS: { id: DocFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'manual', label: 'Manual' },
  { id: 'imported', label: 'Imported' },
  { id: 'ai_transcription', label: 'AI' },
]

function matchesFilter(doc: LyricDocumentVersion, filter: DocFilter, search: string): boolean {
  if (filter === 'active' && !doc.isActive) return false
  if (filter === 'manual' && doc.sourceType !== 'manual') return false
  if (filter === 'imported' && ['manual', 'ai_transcription'].includes(doc.sourceType)) return false
  if (filter === 'ai_transcription' && doc.sourceType !== 'ai_transcription') return false
  if (!search.trim()) return true
  const query = search.toLowerCase()
  return doc.title.toLowerCase().includes(query) || doc.artist.toLowerCase().includes(query)
}

function DocumentCard({
  doc,
  activeDocumentId,
  legacy = false,
  renaming,
  onStartRename,
  onCancelRename,
  onCommitRename,
  onSelectDocument,
  onDuplicateDocument,
  onActivateDocument,
  onDeleteDocument,
}: {
  doc: LyricDocumentVersion
  activeDocumentId: string | null
  legacy?: boolean
  renaming: boolean
  onStartRename: () => void
  onCancelRename: () => void
  onCommitRename: (title: string) => void
  onSelectDocument: () => void
  onDuplicateDocument: () => void
  onActivateDocument: () => void
  onDeleteDocument: () => void
}) {
  const [renameValue, setRenameValue] = useState(doc.title)

  useEffect(() => {
    if (!renaming) setRenameValue(doc.title)
  }, [doc.title, renaming])

  return (
    <div className={`lmv-doc-card${doc.id === activeDocumentId ? ' lmv-doc-card--active' : ''}`}>
      {renaming ? (
        <div className="lmv-doc-rename-row">
          <input
            className="lmv-input"
            value={renameValue}
            autoFocus
            onChange={event => setRenameValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && renameValue.trim()) onCommitRename(renameValue.trim())
              if (event.key === 'Escape') onCancelRename()
            }}
            aria-label="Lyric document name"
          />
          <button type="button" className="lmv-icon-btn" onClick={() => onCommitRename(renameValue.trim())} disabled={!renameValue.trim()} aria-label="Save lyric document name">✓</button>
          <button type="button" className="lmv-icon-btn" onClick={onCancelRename} aria-label="Cancel lyric document rename">×</button>
        </div>
      ) : (
        <button className="lmv-doc-card-main" onClick={onSelectDocument}>
          <div className="lmv-doc-card-title">{doc.title || '(Untitled)'}</div>
          {doc.artist && <div className="lmv-doc-card-artist">{doc.artist}</div>}
        </button>
      )}

      <div className="lmv-doc-card-meta">
        <span className={`lmv-source-badge lmv-source-badge--${doc.sourceType}`}>
          {SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}
        </span>
        {doc.isActive && <span className="lmv-active-badge">Active</span>}
        {legacy && <span className="lmv-legacy-badge">Unattached</span>}
        <span>{doc.cueCount} cues</span>
        <span>{doc.language || 'Language —'}</span>
        <span>{doc.documentReviewStatus || 'Review —'}</span>
        <span className="lmv-doc-card-date">{fmtRelativeDate(doc.updatedAt)}</span>
      </div>

      {!renaming && (
        <div className="lmv-doc-actions">
          <button className="lmv-doc-action" onClick={onStartRename}>Rename</button>
          {!legacy && <button className="lmv-doc-action" onClick={onDuplicateDocument}>Duplicate</button>}
          {!legacy && !doc.isActive && <button className="lmv-doc-action" onClick={onActivateDocument}>Make Active</button>}
          <button className="lmv-doc-action lmv-doc-action--danger" onClick={onDeleteDocument}>Delete</button>
        </div>
      )}
    </div>
  )
}

export function LyricDocumentSidebar({
  documents,
  legacyDocuments = [],
  loading,
  activeDocumentId,
  hasSelectedTrack,
  onSelectDocument,
  onNewDocument,
  onDuplicateDocument,
  onRenameDocument,
  onActivateDocument,
  onDeleteDocument,
  onImportDocument,
}: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DocFilter>('all')
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const filtered = documents.filter(doc => matchesFilter(doc, filter, search))
  const filteredLegacy = legacyDocuments.filter(doc => matchesFilter(doc, filter, search))

  const renderCard = (doc: LyricDocumentVersion, legacy = false) => (
    <DocumentCard
      key={doc.id}
      doc={doc}
      legacy={legacy}
      activeDocumentId={activeDocumentId}
      renaming={renamingId === doc.id}
      onStartRename={() => setRenamingId(doc.id)}
      onCancelRename={() => setRenamingId(null)}
      onCommitRename={title => {
        if (!title) return
        onRenameDocument(doc, title)
        setRenamingId(null)
      }}
      onSelectDocument={() => onSelectDocument(doc)}
      onDuplicateDocument={() => onDuplicateDocument(doc)}
      onActivateDocument={() => onActivateDocument(doc)}
      onDeleteDocument={() => onDeleteDocument(doc)}
    />
  )

  return (
    <aside className="lmv-doc-sidebar">
      <div className="lmv-doc-sidebar-head">
        <div className="lmv-doc-title-row">
          <div className="lmv-doc-sidebar-title">LYRIC VERSIONS</div>
          <button className="lmv-icon-btn" onClick={onNewDocument} disabled={!hasSelectedTrack} aria-label="Create new lyric version">+</button>
        </div>
        <div className="lmv-doc-search-wrap">
          <input
            className="lmv-doc-search"
            placeholder="Search versions…"
            aria-label="Search lyric versions"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <div className="lmv-doc-primary-actions">
          <button className="lmv-btn lmv-btn--ghost" onClick={onNewDocument} disabled={!hasSelectedTrack}>+ New Version</button>
          <button className="lmv-btn lmv-btn--ghost" onClick={onImportDocument} disabled={!hasSelectedTrack}>Import</button>
        </div>
      </div>

      <div className="lmv-doc-filters">
        {FILTERS.map(item => (
          <button
            key={item.id}
            className={`lmv-filter-chip${filter === item.id ? ' lmv-filter-chip--active' : ''}`}
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="lmv-doc-list">
        {loading && <div className="lmv-doc-empty">Loading lyric versions…</div>}
        {!loading && !hasSelectedTrack && (
          <div className="lmv-doc-empty">Select a stored track to inspect its lyric versions.</div>
        )}
        {!loading && hasSelectedTrack && filtered.length === 0 && (
          <div className="lmv-doc-empty">
            {documents.length === 0
              ? 'This track has no lyrics yet. Create a blank version or import timed lyrics.'
              : 'No versions match the current filter.'}
          </div>
        )}
        {!loading && filtered.map(doc => renderCard(doc))}

        {!loading && filteredLegacy.length > 0 && (
          <>
            <div className="lmv-doc-section-label">LEGACY UNATTACHED DOCUMENTS</div>
            <div className="lmv-doc-legacy-note">These older documents are not linked to an audio track and remain unattached when saved.</div>
            {filteredLegacy.map(doc => renderCard(doc, true))}
          </>
        )}
      </div>
    </aside>
  )
}
