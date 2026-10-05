import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { Badge } from '../../../components/vyzualz/react/controls/Badge'
import { LyricSearchFilterRow } from './LyricSearchFilterRow'
import { Copy01Icon, Delete02Icon, PencilEdit01Icon, CheckmarkCircle02Icon } from 'hugeicons-react'
import { useEffect, useState } from 'react'
import type { LyricDocumentVersion } from '../lyricManagerTypes'

type DocFilter = 'all' | 'active' | 'manual' | 'imported' | 'ai_transcription'

interface Props {
  documents: LyricDocumentVersion[]
  legacyDocuments?: LyricDocumentVersion[]
  loading: boolean
  openDocumentId: string | null
  hasSelectedTrack: boolean
  onSelectDocument: (doc: LyricDocumentVersion) => void
  onDuplicateDocument: (doc: LyricDocumentVersion) => void
  onRenameDocument: (doc: LyricDocumentVersion, title: string) => void
  onActivateDocument: (doc: LyricDocumentVersion) => void
  onDeleteDocument: (doc: LyricDocumentVersion) => void
  /** Optional mockup/layout behavior: keep version actions collapsed until the version is open. */
  actionsVisibleForOpenDocumentOnly?: boolean
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

const NEUTRAL_BADGE_TONE = '#9ab2bc'
const BADGE_TONES: Record<string, string> = {
  ai_transcription: '#b84fc9',
  manual: '#4ac7db',
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
  openDocumentId,
  legacy = false,
  renaming,
  onStartRename,
  onCancelRename,
  onCommitRename,
  onSelectDocument,
  onDuplicateDocument,
  onActivateDocument,
  onDeleteDocument,
  showActions,
}: {
  doc: LyricDocumentVersion
  openDocumentId: string | null
  legacy?: boolean
  renaming: boolean
  onStartRename: () => void
  onCancelRename: () => void
  onCommitRename: (title: string) => void
  onSelectDocument: () => void
  onDuplicateDocument: () => void
  onActivateDocument: () => void
  onDeleteDocument: () => void
  showActions: boolean
}) {
  const [renameValue, setRenameValue] = useState(doc.title)

  useEffect(() => {
    if (!renaming) setRenameValue(doc.title)
  }, [doc.title, renaming])

  const isOpen = doc.id === openDocumentId
  return (
    <div className={`lmv-doc-card${isOpen ? ' lmv-doc-card--open' : ''}${doc.isActive ? ' lmv-doc-card--active' : ''}`}>
      <div className="lmv-doc-card-heading">
        {renaming ? (
          <div className="lmv-doc-rename-row">
            <DreamVizTextInput
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
      </div>

      <div className="lmv-doc-card-meta">
        <Badge label={SOURCE_LABELS[doc.sourceType] ?? doc.sourceType} tone={BADGE_TONES[doc.sourceType] ?? NEUTRAL_BADGE_TONE} />
        {isOpen && <Badge label="Open" tone="#e8f4f8" />}
        {doc.isActive && <Badge label="Active" tone="#61d6aa" />}
        {legacy && <Badge label="Unattached" tone="#d8b95a" />}
        <Badge label={`${doc.cueCount} cues`} tone={NEUTRAL_BADGE_TONE} />
        {doc.language && <Badge label={doc.language} tone={NEUTRAL_BADGE_TONE} />}
      </div>
      <div className="lmv-doc-card-detail">
        <span>{doc.documentReviewStatus || 'Review —'}</span>
        <span className="lmv-doc-card-date">{fmtRelativeDate(doc.updatedAt)}</span>
        {!renaming && showActions && (
          <div className="lmv-doc-actions" role="group" aria-label={`Actions for ${doc.title || 'lyric version'}`}>
            <button type="button" className="lmv-doc-action" onClick={onStartRename} title="Rename" aria-label="Rename">
              <PencilEdit01Icon size={15} color="currentColor" />
            </button>
            {!legacy && (
              <button type="button" className="lmv-doc-action" onClick={onDuplicateDocument} title="Duplicate" aria-label="Duplicate">
                <Copy01Icon size={15} color="currentColor" />
              </button>
            )}
            {!legacy && !doc.isActive && (
              <button type="button" className="lmv-doc-action" onClick={onActivateDocument} title="Make Active" aria-label="Make Active">
                <CheckmarkCircle02Icon size={15} color="currentColor" />
              </button>
            )}
            <button type="button" className="lmv-doc-action lmv-doc-action--danger" onClick={onDeleteDocument} title="Delete" aria-label="Delete">
              <Delete02Icon size={15} color="currentColor" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function LyricDocumentSidebar({
  documents,
  legacyDocuments = [],
  loading,
  openDocumentId,
  hasSelectedTrack,
  onSelectDocument,
  onDuplicateDocument,
  onRenameDocument,
  onActivateDocument,
  onDeleteDocument,
  actionsVisibleForOpenDocumentOnly = false,
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
      openDocumentId={openDocumentId}
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
      showActions={!actionsVisibleForOpenDocumentOnly || doc.id === openDocumentId}
    />
  )

  return (
    <aside className="lmv-doc-sidebar">
      <div className="lmv-lyric-versions-body">
        <LyricSearchFilterRow
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search versions…"
          searchAriaLabel="Search lyric versions"
          filterId="lyric-version-filter"
          filterValue={filter}
          filterOptions={FILTERS.map(item => ({ value: item.id, label: item.label }))}
          onFilterChange={value => setFilter(value as DocFilter)}
          filterAriaLabel={`Filter versions: ${FILTERS.find(item => item.id === filter)?.label ?? 'All'}`}
          filterMenuLabel="Lyric Version Filters"
          filterMenuWidth={180}
        />
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
